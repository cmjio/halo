/**
 * Thread state: what a `@thread(key)` pipeline keeps from one run to the next.
 *
 * A thread is named (the pipeline, or the name `@thread(key, Name)` gives) and keyed
 * by one of the run's inputs, e.g. a user or ticket id. A run reads it as
 * `context.thread` and changes it with `Thread.set`, `Thread.append` and `Thread.clear`.
 * The changes are kept as a list of operations and saved when the run ends (completed
 * or halted; not when it fails or while it is paused). Saving applies them to the
 * thread as it is then, inside a transaction, so two runs on one thread can't lose
 * each other's appends: `append` adds to whatever is there, and `set` and `clear`
 * win in the order the runs end.
 *
 * Every save adds a line to the thread's log (run, version, operations), so a thread's
 * changes can be traced to the runs that made them, and a reset is logged too.
 */

import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { HaloError } from "./errors.js";

export type ThreadOp =
  | { op: "set"; fields: Record<string, unknown> }
  | { op: "append"; fields: Record<string, unknown>; keep?: number }
  | { op: "clear"; names?: string[] };

export type ThreadState = Record<string, unknown>;

/** A run's view of its thread: the state it loaded, and what it has done since. */
export interface ThreadContext {
  name: string;
  key: string;
  /** The thread's version and state when the run loaded it. */
  version: number;
  base: ThreadState;
  /** `base` with `ops` applied: what `context.thread` shows. */
  state: ThreadState;
  ops: ThreadOp[];
  /** How many of `ops` another run already saved (a rewound run's shared steps). */
  saved?: number;
}

export interface ThreadRecord {
  name: string;
  key: string;
  state: ThreadState;
  version: number;
  /** How many runs have saved changes. */
  runs: number;
  updatedAt: string;
}

export interface ThreadLogEntry {
  version: number;
  runId: string;
  at: string;
  ops: ThreadOp[] | "reset";
}

const structured = <T>(v: T): T => (v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T));

/** Apply operations to a state, returning a new one. */
export function applyOps(state: ThreadState, ops: ThreadOp[]): ThreadState {
  const next: ThreadState = structured(state);
  for (const o of ops) {
    if (o.op === "set") Object.assign(next, structured(o.fields));
    else if (o.op === "append") {
      for (const [field, value] of Object.entries(o.fields)) {
        const list = Array.isArray(next[field]) ? (next[field] as unknown[]) : next[field] === undefined ? [] : [next[field]];
        list.push(structured(value));
        next[field] = o.keep !== undefined && o.keep >= 0 ? list.slice(Math.max(0, list.length - o.keep)) : list;
      }
    } else if (o.names?.length) for (const n of o.names) delete next[n];
    else for (const n of Object.keys(next)) delete next[n];
  }
  return next;
}

/** Threads in a SQLite file (".halo/threads.sqlite" by default; ":memory:" for tests and mock runs). */
export class ThreadStore {
  private db: Database;

  constructor(readonly path = ".halo/threads.sqlite") {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new Database(path, { create: true });
    this.db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
    this.db.exec(`CREATE TABLE IF NOT EXISTS threads (
      name TEXT NOT NULL, key TEXT NOT NULL, state TEXT NOT NULL, version INTEGER NOT NULL,
      runs INTEGER NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (name, key))`);
    this.db.exec(`CREATE TABLE IF NOT EXISTS thread_log (
      name TEXT NOT NULL, key TEXT NOT NULL, version INTEGER NOT NULL, run_id TEXT NOT NULL,
      at TEXT NOT NULL, ops TEXT NOT NULL)`);
    this.db.exec("CREATE INDEX IF NOT EXISTS thread_log_by_thread ON thread_log (name, key, version)");
  }

  get(name: string, key: string): ThreadRecord | undefined {
    const row = this.db.query("SELECT * FROM threads WHERE name = ? AND key = ?").get(name, key) as Row | null;
    return row ? fromRow(row) : undefined;
  }

  /** Start a run's view of a thread (an empty one if it has never been saved). */
  open(name: string, key: string): ThreadContext {
    const t = this.get(name, key);
    const state = t?.state ?? {};
    return { name, key, version: t?.version ?? 0, base: state, state: structured(state), ops: [] };
  }

  /** Save a run's operations onto the thread as it is now. */
  commit(name: string, key: string, ops: ThreadOp[], runId: string): ThreadRecord {
    return this.db.transaction(() => {
      const now = this.get(name, key);
      const state = applyOps(now?.state ?? {}, ops);
      const version = (now?.version ?? 0) + 1;
      const at = new Date().toISOString();
      this.db
        .query("INSERT OR REPLACE INTO threads (name, key, state, version, runs, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
        .run(name, key, JSON.stringify(state), version, (now?.runs ?? 0) + 1, at);
      this.db.query("INSERT INTO thread_log (name, key, version, run_id, at, ops) VALUES (?, ?, ?, ?, ?, ?)").run(name, key, version, runId, at, JSON.stringify(ops));
      return { name, key, state, version, runs: (now?.runs ?? 0) + 1, updatedAt: at };
    }).immediate();
  }

  list(): ThreadRecord[] {
    return (this.db.query("SELECT * FROM threads ORDER BY updated_at DESC").all() as Row[]).map(fromRow);
  }

  /** The thread's saves, newest first. */
  log(name: string, key: string, limit = 20): ThreadLogEntry[] {
    const rows = this.db.query("SELECT * FROM thread_log WHERE name = ? AND key = ? ORDER BY rowid DESC LIMIT ?").all(name, key, limit) as LogRow[];
    return rows.map((r) => ({ version: r.version, runId: r.run_id, at: r.at, ops: JSON.parse(r.ops) as ThreadLogEntry["ops"] }));
  }

  /** Whether a run has saved changes to this thread. */
  savedBy(name: string, key: string, runId: string): boolean {
    return !!this.db.query("SELECT 1 FROM thread_log WHERE name = ? AND key = ? AND run_id = ?").get(name, key, runId);
  }

  /** Delete a thread's state. Its log keeps a "reset" line, so the history says what happened. */
  reset(name: string, key: string): boolean {
    return this.db.transaction(() => {
      const now = this.get(name, key);
      if (!now) return false;
      this.db.query("DELETE FROM threads WHERE name = ? AND key = ?").run(name, key);
      this.db.query("INSERT INTO thread_log (name, key, version, run_id, at, ops) VALUES (?, ?, ?, ?, ?, ?)").run(name, key, now.version + 1, "", new Date().toISOString(), JSON.stringify("reset"));
      return true;
    }).immediate();
  }

  close(): void {
    this.db.close();
  }
}

interface Row {
  name: string;
  key: string;
  state: string;
  version: number;
  runs: number;
  updated_at: string;
}

interface LogRow {
  version: number;
  run_id: string;
  at: string;
  ops: string;
}

function fromRow(r: Row): ThreadRecord {
  return { name: r.name, key: r.key, state: JSON.parse(r.state) as ThreadState, version: r.version, runs: r.runs, updatedAt: r.updated_at };
}

/** The thread key a run's input gives: a string or number, not empty. */
export function threadKey(value: unknown, param: string, pipeline: string): string {
  if ((typeof value !== "string" && typeof value !== "number") || String(value) === "") {
    throw new HaloError(`Pipeline "${pipeline}" keeps a thread per ${param}, so it needs ${param} (a string or number); got ${JSON.stringify(value) ?? "nothing"}`);
  }
  return String(value);
}
