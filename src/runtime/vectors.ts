/**
 * Local vector store backed by bun:sqlite.
 *
 * By default, embeddings are hashed bag-of-words vectors (unigrams + bigrams), so search is
 * lexical-semantic, deterministic, and needs no network or API key. A namespace can instead
 * hold model embeddings (dense mode): the caller passes each vector with its model name.
 * One namespace holds one kind of vector; mixing models or dimensions is refused.
 */

import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { HaloError } from "./errors.js";

const DIMS = 512;

export interface MemoryRecord {
  id: number;
  content: unknown;
  tags: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface SearchHit extends MemoryRecord {
  score: number;
}

export interface SearchOptions {
  limit?: number;
  minScore?: number;
  tags?: string[];
  excludeTags?: string[];
  order?: "score" | "recent";
}

/** A model embedding: the (normalized) vector and the model that made it. */
export interface ModelVector {
  model: string;
  vector: Float32Array;
}

/** What VectorStore's provider needs from a backend (local SQLite, or Postgres + pgvector). */
export interface VectorBackend {
  insert(namespace: string, content: unknown, tags?: string[], metadata?: Record<string, unknown>, embedding?: ModelVector): MemoryRecord | Promise<MemoryRecord>;
  search(namespace: string, query: unknown, options?: SearchOptions, embedding?: ModelVector): SearchHit[] | Promise<SearchHit[]>;
  delete(namespace: string, filter: { id?: number; tags?: string[] }): number | Promise<number>;
  count(namespace: string): number | Promise<number>;
}

export const HASHED_MODEL = "hashed";
export const HASHED_DIMS = 512;

/** The error for a namespace that holds another model's vectors. */
export function modelMismatch(namespace: string, have: { model: string; dims: number }, want: { model: string; dims: number }): HaloError {
  return new HaloError(
    `VectorStore namespace "${namespace}" holds ${have.model} embeddings (${have.dims} dims), but this store uses ${want.model} (${want.dims} dims). ` +
      `Use another namespace:, or delete the namespace's entries to switch models.`,
    { code: "VECTOR_MODEL_MISMATCH" },
  );
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 1)
    .map((t) => t.replace(/(?:ing|ed|es|s)$/, "") || t);
}

export function embed(text: string): Float32Array {
  const v = new Float32Array(DIMS);
  const tokens = tokenize(text);
  const features = [...tokens, ...tokens.slice(1).map((t, i) => `${tokens[i]} ${t}`)];
  for (const f of features) {
    const h = Number(BigInt(Bun.hash(f)) & 0xffffffffn);
    v[h % DIMS]! += h & 0x80000000 ? -1 : 1;
  }
  let norm = 0;
  for (let i = 0; i < DIMS; i++) {
    // Sublinear term frequency dampens repeated words.
    const x = v[i]!;
    v[i] = Math.sign(x) * Math.log1p(Math.abs(x));
    norm += v[i]! * v[i]!;
  }
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < DIMS; i++) v[i]! /= norm;
  return v;
}

export const asText = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v));

/**
 * One namespace's embeddings in memory as an inverted index: for each dimension, the rows
 * that use it and their weights. A text sets about 50 of the 512 dimensions, so a search
 * only visits the rows that share a dimension with the query.
 */
interface Index {
  ids: number[];
  tags: string[][];
  postings: Array<{ rows: number[]; weights: number[] }>;
  /** Highest row id loaded, and the row count when loaded: new rows are read incrementally. */
  maxId: number;
  count: number;
}

/**
 * One dense namespace in memory: row r's vector is matrix[r*dims .. (r+1)*dims). Rows are in
 * id order, so the newest are at the end.
 */
interface DenseIndex {
  model: string;
  dims: number;
  ids: Float64Array;
  tags: string[][];
  matrix: Float32Array;
  rows: number;
  maxId: number;
  count: number;
}

export class LocalVectorStore implements VectorBackend {
  private db: Database;
  private indexes = new Map<string, Index>();
  private dense = new Map<string, DenseIndex>();

  constructor(path = ".halo/vectors.sqlite") {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new Database(path, { create: true });
    this.db.run("PRAGMA journal_mode = WAL");
    this.db.run(`CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      namespace TEXT NOT NULL,
      content TEXT NOT NULL,
      tags TEXT NOT NULL,
      metadata TEXT NOT NULL,
      embedding BLOB NOT NULL,
      created_at TEXT NOT NULL
    )`);
    this.db.run("CREATE INDEX IF NOT EXISTS entries_ns ON entries(namespace)");
    // Dense mode (added later): the model and dimensions of each row. NULL model = hashed.
    const cols = new Set((this.db.query("PRAGMA table_info(entries)").all() as Array<{ name: string }>).map((c) => c.name));
    if (!cols.has("model")) this.db.run("ALTER TABLE entries ADD COLUMN model TEXT");
    if (!cols.has("dims")) this.db.run("ALTER TABLE entries ADD COLUMN dims INTEGER");
  }

  /** The model and dimensions a namespace's entries use, or undefined when it's empty. */
  namespaceModel(namespace: string): { model: string; dims: number } | undefined {
    const r = this.db.query("SELECT model, dims FROM entries WHERE namespace = ? LIMIT 1").get(namespace) as { model: string | null; dims: number | null } | null;
    return r ? { model: r.model ?? HASHED_MODEL, dims: r.dims ?? HASHED_DIMS } : undefined;
  }

  private checkModel(namespace: string, want: { model: string; dims: number }) {
    const have = this.namespaceModel(namespace);
    if (have && (have.model !== want.model || have.dims !== want.dims)) throw modelMismatch(namespace, have, want);
  }

  /** Store an entry. With `embedding`, the entry gets that model vector instead of a hashed one. */
  insert(namespace: string, content: unknown, tags: string[] = [], metadata: Record<string, unknown> = {}, embedding?: ModelVector): MemoryRecord {
    const createdAt = new Date().toISOString();
    const want = embedding ? { model: embedding.model, dims: embedding.vector.length } : { model: HASHED_MODEL, dims: HASHED_DIMS };
    this.checkModel(namespace, want);
    const vec = embedding?.vector ?? embed(`${asText(content)} ${tags.join(" ")}`);
    const bytes = new Uint8Array(vec.buffer, vec.byteOffset, vec.byteLength);
    const row = this.db
      .query("INSERT INTO entries (namespace, content, tags, metadata, embedding, created_at, model, dims) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id")
      .get(namespace, JSON.stringify(content), JSON.stringify(tags), JSON.stringify(metadata), bytes, createdAt, embedding ? embedding.model : null, embedding ? want.dims : null) as { id: number };
    return { id: row.id, content, tags, metadata, createdAt };
  }

  /**
   * Entries closest to `query`. Options: `tags` (an entry must have all of them),
   * `excludeTags` (an entry with any of them is left out), `minScore`, and
   * `order: "recent"` to return the newest matches first instead of the closest.
   */
  search(namespace: string, query: unknown, options: SearchOptions = {}, embedding?: ModelVector): SearchHit[] {
    const have = this.namespaceModel(namespace);
    if (!have) return [];
    const want = embedding ? { model: embedding.model, dims: embedding.vector.length } : { model: HASHED_MODEL, dims: HASHED_DIMS };
    if (have.model !== want.model || have.dims !== want.dims) throw modelMismatch(namespace, have, want);
    if (embedding) return this.searchDense(namespace, embedding.vector, options);
    const { limit = 5, minScore = 0, tags, excludeTags, order = "score" } = options;
    const q = embed(asText(query));
    // Score from the inverted index; only the hits that make the cut are read from SQLite.
    const index = this.index(namespace);
    const dots = new Float64Array(index.ids.length);
    for (let d = 0; d < DIMS; d++) {
      const w = q[d]!;
      if (w === 0) continue;
      const { rows, weights } = index.postings[d]!;
      for (let k = 0; k < rows.length; k++) dots[rows[k]!]! += w * weights[k]!;
    }
    const matches: Array<{ id: number; score: number }> = [];
    for (let row = 0; row < index.ids.length; row++) {
      const score = Math.round(dots[row]! * 1e4) / 1e4;
      if (score < minScore) continue;
      const t = index.tags[row]!;
      if ((tags?.length && !tags.every((x) => t.includes(x))) || excludeTags?.some((x) => t.includes(x))) continue;
      matches.push({ id: index.ids[row]!, score });
    }
    const top = matches.sort((a, b) => (order === "recent" ? b.id - a.id : b.score - a.score || a.id - b.id)).slice(0, limit);
    if (!top.length) return [];
    return this.fetchHits(top);
  }

  private fetchHits(top: Array<{ id: number; score: number }>): SearchHit[] {
    if (!top.length) return [];
    const rows = this.db.query(`SELECT id, content, tags, metadata, created_at FROM entries WHERE id IN (${top.map(() => "?").join(",")})`).all(...top.map((h) => h.id)) as any[];
    const byId = new Map(rows.map((r) => [r.id as number, r]));
    return top.filter((h) => byId.has(h.id)).map((h) => ({ ...this.toRecord(byId.get(h.id)), score: h.score }));
  }

  /**
   * Brute-force cosine over the namespace's matrix (vectors are normalized, so a dot product).
   * Scores go into one Float32Array; the top `limit` are kept in small parallel arrays, so the
   * loop over rows allocates nothing.
   */
  private searchDense(namespace: string, q: Float32Array, options: SearchOptions): SearchHit[] {
    const { limit = 5, minScore = 0, tags, excludeTags, order = "score" } = options;
    const index = this.denseIndex(namespace);
    const { dims, matrix, ids, rows } = index;
    const k = Math.max(0, Math.min(Math.floor(limit), rows));
    if (!k) return [];
    const needTags = tags?.length ? tags : undefined;
    const skipTags = excludeTags?.length ? excludeTags : undefined;
    const passes = (row: number) => {
      if (!needTags && !skipTags) return true;
      const t = index.tags[row]!;
      if (needTags) for (let i = 0; i < needTags.length; i++) if (!t.includes(needTags[i]!)) return false;
      if (skipTags) for (let i = 0; i < skipTags.length; i++) if (t.includes(skipTags[i]!)) return false;
      return true;
    };
    // Four accumulators, so the adds don't wait on each other.
    const tail = dims & ~3;
    const score = (row: number) => {
      const o = row * dims;
      let a = 0, b = 0, c = 0, e = 0, d = 0;
      for (; d < tail; d += 4) {
        a += q[d]! * matrix[o + d]!;
        b += q[d + 1]! * matrix[o + d + 1]!;
        c += q[d + 2]! * matrix[o + d + 2]!;
        e += q[d + 3]! * matrix[o + d + 3]!;
      }
      for (; d < dims; d++) a += q[d]! * matrix[o + d]!;
      return Math.round((a + b + c + e) * 1e4) / 1e4;
    };
    const topRows = new Int32Array(k);
    const topScores = new Float64Array(k);
    let n = 0;
    if (order === "recent") {
      // Rows are in id order: walk back from the newest until `limit` match.
      for (let row = rows - 1; row >= 0 && n < k; row--) {
        if (!passes(row)) continue;
        const s = score(row);
        if (s < minScore) continue;
        topRows[n] = row;
        topScores[n++] = s;
      }
    } else {
      for (let row = 0; row < rows; row++) {
        const s = score(row);
        // Ties keep the lower id (the earlier row), as in hashed search.
        if (s < minScore || (n === k && s <= topScores[k - 1]!)) continue;
        if (!passes(row)) continue;
        let i = n < k ? n++ : k - 1;
        while (i > 0 && topScores[i - 1]! < s) {
          topScores[i] = topScores[i - 1]!;
          topRows[i] = topRows[i - 1]!;
          i--;
        }
        topScores[i] = s;
        topRows[i] = row;
      }
    }
    const top: Array<{ id: number; score: number }> = [];
    for (let i = 0; i < n; i++) top.push({ id: ids[topRows[i]!]!, score: topScores[i]! });
    return this.fetchHits(top);
  }

  /** The namespace's dense matrix, brought up to date the same way as the hashed index. */
  private denseIndex(namespace: string, rebuild = false): DenseIndex {
    const { n, maxId } = this.db.query("SELECT COUNT(*) AS n, COALESCE(MAX(id), 0) AS maxId FROM entries WHERE namespace = ?").get(namespace) as { n: number; maxId: number };
    const have = this.namespaceModel(namespace) ?? { model: "", dims: 0 };
    let old = rebuild ? undefined : this.dense.get(namespace);
    if (old && (old.model !== have.model || old.dims !== have.dims)) old = undefined;
    if (old && old.count === n && old.maxId === maxId) return old;
    const index: DenseIndex =
      old && n >= old.count && maxId >= old.maxId
        ? old
        : { model: have.model, dims: have.dims, ids: new Float64Array(0), tags: [], matrix: new Float32Array(0), rows: 0, maxId: 0, count: 0 };
    const base = index === old;
    const fresh = this.db.query("SELECT id, tags, embedding FROM entries WHERE namespace = ? AND id > ? ORDER BY id").all(namespace, index.maxId) as Array<{ id: number; tags: string; embedding: Uint8Array }>;
    const need = index.rows + fresh.length;
    if (need * index.dims > index.matrix.length || need > index.ids.length) {
      // Grow by half again, so appending one row at a time stays cheap.
      const cap = Math.max(64, Math.ceil(need * 1.5));
      const matrix = new Float32Array(cap * index.dims);
      matrix.set(index.matrix.subarray(0, index.rows * index.dims));
      const idsArr = new Float64Array(cap);
      idsArr.set(index.ids.subarray(0, index.rows));
      index.matrix = matrix;
      index.ids = idsArr;
    }
    for (const r of fresh) {
      const bytes = new Uint8Array(r.embedding);
      if (bytes.byteLength !== index.dims * 4) throw new HaloError(`VectorStore namespace "${namespace}": entry ${r.id} has ${bytes.byteLength / 4} dims, expected ${index.dims}`);
      index.matrix.set(new Float32Array(bytes.buffer, bytes.byteOffset, index.dims), index.rows * index.dims);
      index.ids[index.rows] = r.id;
      index.tags.push(JSON.parse(r.tags) as string[]);
      index.rows++;
    }
    index.maxId = maxId;
    index.count = n;
    if (index.rows !== n) {
      this.dense.delete(namespace);
      return base ? this.denseIndex(namespace, true) : index;
    }
    this.dense.set(namespace, index);
    return index;
  }

  /**
   * The namespace's packed index, brought up to date: rows added since it was built are
   * appended; if any went away (deleted, possibly by another process), it is rebuilt.
   */
  private index(namespace: string, rebuild = false): Index {
    const { n, maxId } = this.db.query("SELECT COUNT(*) AS n, COALESCE(MAX(id), 0) AS maxId FROM entries WHERE namespace = ?").get(namespace) as { n: number; maxId: number };
    const old = rebuild ? undefined : this.indexes.get(namespace);
    if (old && old.count === n && old.maxId === maxId) return old;
    // Rows only added since the last build are appended in place; anything else starts over.
    const index: Index = old && n >= old.count && maxId >= old.maxId ? old : { ids: [], tags: [], postings: Array.from({ length: DIMS }, () => ({ rows: [], weights: [] })), maxId: 0, count: 0 };
    const base = index === old;
    const rows = this.db.query("SELECT id, tags, embedding FROM entries WHERE namespace = ? AND id > ? ORDER BY id").all(namespace, index.maxId) as Array<{ id: number; tags: string; embedding: Uint8Array }>;
    for (const r of rows) {
      const v = new Float32Array(new Uint8Array(r.embedding).buffer);
      const row = index.ids.length;
      for (let d = 0; d < DIMS; d++) {
        if (v[d] === 0) continue;
        index.postings[d]!.rows.push(row);
        index.postings[d]!.weights.push(v[d]!);
      }
      index.ids.push(r.id);
      index.tags.push(JSON.parse(r.tags) as string[]);
    }
    index.maxId = maxId;
    index.count = n;
    // Rows were added and others deleted since the last build: start over once.
    if (index.ids.length !== n) {
      this.indexes.delete(namespace);
      return base ? this.index(namespace, true) : index;
    }
    this.indexes.set(namespace, index);
    return index;
  }

  delete(namespace: string, filter: { id?: number; tags?: string[] }): number {
    if (filter.id !== undefined) {
      return this.db.query("DELETE FROM entries WHERE namespace = ? AND id = ?").run(namespace, filter.id).changes;
    }
    // Read tags straight from SQLite, so this works for hashed and dense namespaces alike.
    const all = this.db.query("SELECT id, tags FROM entries WHERE namespace = ?").all(namespace) as Array<{ id: number; tags: string }>;
    const ids = all.filter((r) => filter.tags?.every((t) => (JSON.parse(r.tags) as string[]).includes(t))).map((r) => r.id);
    const remove = this.db.prepare("DELETE FROM entries WHERE id = ?");
    this.db.transaction(() => {
      for (const id of ids) remove.run(id);
    })();
    return ids.length;
  }

  count(namespace: string): number {
    return (this.db.query("SELECT COUNT(*) AS n FROM entries WHERE namespace = ?").get(namespace) as { n: number }).n;
  }

  close(): void {
    this.db.close();
  }

  private toRecord(r: any): MemoryRecord {
    return { id: r.id, content: JSON.parse(r.content), tags: JSON.parse(r.tags), metadata: JSON.parse(r.metadata), createdAt: r.created_at };
  }
}
