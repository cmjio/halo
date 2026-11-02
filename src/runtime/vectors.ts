/**
 * Local vector store backed by bun:sqlite.
 *
 * Embeddings are hashed bag-of-words vectors (unigrams + bigrams), so search is
 * lexical-semantic, deterministic, and needs no network or API key.
 */

import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

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

const asText = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v));

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

export class LocalVectorStore {
  private db: Database;
  private indexes = new Map<string, Index>();

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
  }

  insert(namespace: string, content: unknown, tags: string[] = [], metadata: Record<string, unknown> = {}): MemoryRecord {
    const createdAt = new Date().toISOString();
    const vec = embed(`${asText(content)} ${tags.join(" ")}`);
    const row = this.db
      .query("INSERT INTO entries (namespace, content, tags, metadata, embedding, created_at) VALUES (?, ?, ?, ?, ?, ?) RETURNING id")
      .get(namespace, JSON.stringify(content), JSON.stringify(tags), JSON.stringify(metadata), new Uint8Array(vec.buffer), createdAt) as { id: number };
    return { id: row.id, content, tags, metadata, createdAt };
  }

  /**
   * Entries closest to `query`. Options: `tags` (an entry must have all of them),
   * `excludeTags` (an entry with any of them is left out), `minScore`, and
   * `order: "recent"` to return the newest matches first instead of the closest.
   */
  search(
    namespace: string,
    query: unknown,
    options: { limit?: number; minScore?: number; tags?: string[]; excludeTags?: string[]; order?: "score" | "recent" } = {},
  ): SearchHit[] {
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
    const rows = this.db.query(`SELECT id, content, tags, metadata, created_at FROM entries WHERE id IN (${top.map(() => "?").join(",")})`).all(...top.map((h) => h.id)) as any[];
    const byId = new Map(rows.map((r) => [r.id as number, r]));
    return top.filter((h) => byId.has(h.id)).map((h) => ({ ...this.toRecord(byId.get(h.id)), score: h.score }));
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
    const index = this.index(namespace);
    const ids = index.ids.filter((_, row) => filter.tags?.every((t) => index.tags[row]!.includes(t)));
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
