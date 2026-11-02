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

function cosine(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i]! * b[i]!;
  return dot;
}

const asText = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v));

export class LocalVectorStore {
  private db: Database;

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

  search(namespace: string, query: unknown, limit = 5, minScore = 0, tags?: string[]): SearchHit[] {
    const q = embed(asText(query));
    const rows = this.db.query("SELECT * FROM entries WHERE namespace = ?").all(namespace) as any[];
    return rows
      .map((r) => {
        const emb = new Float32Array(new Uint8Array(r.embedding).buffer);
        return { ...this.toRecord(r), score: Math.round(cosine(q, emb) * 1e4) / 1e4 };
      })
      .filter((h) => h.score >= minScore && (!tags?.length || tags.every((t) => h.tags.includes(t))))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  delete(namespace: string, filter: { id?: number; tags?: string[] }): number {
    if (filter.id !== undefined) {
      return this.db.query("DELETE FROM entries WHERE namespace = ? AND id = ?").run(namespace, filter.id).changes;
    }
    const rows = this.db.query("SELECT id, tags FROM entries WHERE namespace = ?").all(namespace) as Array<{ id: number; tags: string }>;
    const ids = rows.filter((r) => filter.tags?.every((t) => (JSON.parse(r.tags) as string[]).includes(t))).map((r) => r.id);
    for (const id of ids) this.db.query("DELETE FROM entries WHERE id = ?").run(id);
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
