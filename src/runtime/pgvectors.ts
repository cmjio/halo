/**
 * VectorStore on Postgres with pgvector: `VectorStore(url: Env.DATABASE_URL, embeddings: "openai/...")`.
 *
 * One table (default `halo_vectors`) holds every namespace. The `embedding` column is an
 * untyped `vector`, so models of any size can share the table; each dimension count gets its
 * own partial HNSW cosine index over `embedding::vector(N)` (or `halfvec(N)` above 2000 dims,
 * pgvector's limit for `vector` indexes), and searches cast the same way so they use it.
 */

import { HaloError } from "./errors.js";
import { modelMismatch, type MemoryRecord, type ModelVector, type SearchHit, type SearchOptions, type VectorBackend } from "./vectors.js";

type SQL = InstanceType<typeof Bun.SQL>;

const IDENT = /^[A-Za-z_][A-Za-z0-9_]{0,62}$/;

/** `table` or `schema.table`, each part a plain identifier. Returns the quoted name and a base for index names. */
export function validateTableName(table: string): { quoted: string; base: string } {
  const parts = table.split(".");
  if (parts.length > 2 || !parts.every((p) => IDENT.test(p))) {
    throw new HaloError(`VectorStore table: "${table}" is not a valid table name (letters, digits and _, optionally schema.table)`, { code: "TOOL_ARGUMENT" });
  }
  return { quoted: parts.map((p) => `"${p}"`).join("."), base: parts[parts.length - 1]! };
}

/** The cast an index on `dims` uses, or undefined when pgvector can't index that many. */
function castFor(dims: number): string | undefined {
  if (!Number.isInteger(dims) || dims <= 0) throw new HaloError(`VectorStore: bad vector size ${dims}`);
  if (dims <= 2000) return `vector(${dims})`;
  if (dims <= 4000) return `halfvec(${dims})`;
  return undefined;
}

const literal = (v: Float32Array) => `[${Array.from(v).join(",")}]`;

/** Schema setup, once per connection pool and table. */
const ready = new WeakMap<SQL, Map<string, Promise<void>>>();
const indexed = new WeakMap<SQL, Map<string, Promise<void>>>();

function once(map: WeakMap<SQL, Map<string, Promise<void>>>, sql: SQL, key: string, run: () => Promise<void>): Promise<void> {
  let m = map.get(sql);
  if (!m) map.set(sql, (m = new Map()));
  let p = m.get(key);
  if (!p) {
    p = run();
    m.set(key, p);
    p.catch(() => m!.delete(key));
  }
  return p;
}

export class PgVectorStore implements VectorBackend {
  private quoted: string;
  private base: string;

  constructor(private sql: SQL, private table = "halo_vectors") {
    ({ quoted: this.quoted, base: this.base } = validateTableName(table));
  }

  private ensure(): Promise<void> {
    const t = this.quoted;
    return once(ready, this.sql, t, async () => {
      await this.sql.unsafe("CREATE EXTENSION IF NOT EXISTS vector");
      await this.sql.unsafe(`CREATE TABLE IF NOT EXISTS ${t} (
        id BIGSERIAL PRIMARY KEY,
        namespace TEXT NOT NULL,
        content TEXT NOT NULL,
        tags JSONB NOT NULL DEFAULT '[]',
        metadata TEXT NOT NULL DEFAULT '{}',
        model TEXT NOT NULL,
        dims INTEGER NOT NULL,
        embedding vector NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
      await this.sql.unsafe(`CREATE INDEX IF NOT EXISTS "${this.base}_ns" ON ${t} (namespace, id)`);
    });
  }

  private ensureIndex(dims: number): Promise<void> {
    const cast = castFor(dims);
    if (!cast) return Promise.resolve();
    const ops = cast.startsWith("halfvec") ? "halfvec_cosine_ops" : "vector_cosine_ops";
    const name = `${this.base.slice(0, 40)}_hnsw_${dims}`;
    return once(indexed, this.sql, `${this.quoted}:${dims}`, async () => {
      await this.sql.unsafe(`CREATE INDEX IF NOT EXISTS "${name}" ON ${this.quoted} USING hnsw ((embedding::${cast}) ${ops}) WHERE dims = ${dims}`);
    });
  }

  private async checkModel(namespace: string, want: { model: string; dims: number }) {
    const [have] = await this.sql.unsafe(`SELECT model, dims FROM ${this.quoted} WHERE namespace = $1 LIMIT 1`, [namespace]);
    if (have && (have.model !== want.model || Number(have.dims) !== want.dims)) throw modelMismatch(namespace, { model: have.model, dims: Number(have.dims) }, want);
    return !!have;
  }

  async insert(namespace: string, content: unknown, tags: string[] = [], metadata: Record<string, unknown> = {}, embedding?: ModelVector): Promise<MemoryRecord> {
    if (!embedding) throw new HaloError("PgVectorStore.insert needs an embedding");
    await this.ensure();
    const dims = embedding.vector.length;
    await this.checkModel(namespace, { model: embedding.model, dims });
    await this.ensureIndex(dims);
    const [row] = await this.sql.unsafe(
      `INSERT INTO ${this.quoted} (namespace, content, tags, metadata, model, dims, embedding) VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7::vector) RETURNING id, created_at`,
      [namespace, JSON.stringify(content), JSON.stringify(tags), JSON.stringify(metadata), embedding.model, dims, literal(embedding.vector)],
    );
    return { id: Number(row.id), content, tags, metadata, createdAt: new Date(row.created_at).toISOString() };
  }

  async search(namespace: string, _query: unknown, options: SearchOptions = {}, embedding?: ModelVector): Promise<SearchHit[]> {
    if (!embedding) throw new HaloError("PgVectorStore.search needs an embedding");
    const { limit = 5, minScore = 0, tags, excludeTags, order = "score" } = options;
    const k = Math.max(0, Math.floor(limit));
    if (!k) return [];
    await this.ensure();
    const dims = embedding.vector.length;
    if (!(await this.checkModel(namespace, { model: embedding.model, dims }))) return [];
    const cast = castFor(dims) ?? "vector";
    const params: unknown[] = [];
    const $ = (v: unknown) => `$${params.push(v)}`;
    const filters = [`namespace = ${$(namespace)}`, `dims = ${dims}`];
    if (tags?.length) filters.push(`tags @> ${$(JSON.stringify(tags))}::jsonb`);
    if (excludeTags?.length) filters.push(`NOT (tags ?| ARRAY(SELECT jsonb_array_elements_text(${$(JSON.stringify(excludeTags))}::jsonb)))`);
    const dist = `embedding::${cast} <=> ${$(literal(embedding.vector))}::${cast}`;
    const lim = $(k);
    const min = $(minScore);
    const text =
      order === "recent"
        ? `SELECT id, content, tags, metadata, created_at, 1 - (${dist}) AS score FROM ${this.quoted}
             WHERE ${filters.join(" AND ")} AND 1 - (${dist}) >= ${min} ORDER BY id DESC LIMIT ${lim}`
        : // Nearest first through the HNSW index; the min score applies after, which is equivalent when sorted.
          `SELECT * FROM (SELECT id, content, tags, metadata, created_at, 1 - (${dist}) AS score FROM ${this.quoted}
             WHERE ${filters.join(" AND ")} ORDER BY ${dist} LIMIT ${lim}) hits WHERE score >= ${min}`;
    const rows = await this.sql.unsafe(text, params);
    const hits = [...rows].map((r: any) => ({
      id: Number(r.id),
      content: JSON.parse(r.content),
      tags: typeof r.tags === "string" ? JSON.parse(r.tags) : r.tags,
      metadata: JSON.parse(r.metadata),
      createdAt: new Date(r.created_at).toISOString(),
      score: Math.round(Number(r.score) * 1e4) / 1e4,
    }));
    return order === "recent" ? hits : hits.sort((a, b) => b.score - a.score || a.id - b.id);
  }

  async delete(namespace: string, filter: { id?: number; tags?: string[] }): Promise<number> {
    await this.ensure();
    if (filter.id !== undefined) {
      const r = await this.sql.unsafe(`DELETE FROM ${this.quoted} WHERE namespace = $1 AND id = $2 RETURNING id`, [namespace, filter.id]);
      return r.length;
    }
    if (!filter.tags) return 0;
    const r = await this.sql.unsafe(`DELETE FROM ${this.quoted} WHERE namespace = $1 AND tags @> $2::jsonb RETURNING id`, [namespace, JSON.stringify(filter.tags)]);
    return r.length;
  }

  async count(namespace: string): Promise<number> {
    await this.ensure();
    const [r] = await this.sql.unsafe(`SELECT COUNT(*)::int AS n FROM ${this.quoted} WHERE namespace = $1`, [namespace]);
    return Number(r.n);
  }
}
