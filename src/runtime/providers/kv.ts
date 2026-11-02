/**
 * KV: a small persistent key-value store in a local SQLite file.
 *
 *   tool Cache : KV(".halo/kv.sqlite", namespace: "cache")
 *     get(key)   set(key, value, ttl?)   delete(key)   list(prefix?, limit?)   incr(key, by?)
 *
 * Values are stored as JSON, so strings, numbers, lists and records come back
 * as they went in. `ttl:` is seconds or a duration ("30s", "5m", "1h", "2d");
 * an expired key reads as missing and is cleaned up later. The namespace
 * defaults to the tool's name, so two tools on one file don't see each other's
 * keys unless they share a namespace.
 */

import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseDuration } from "../../parser/builtins.js";
import { HaloError } from "../errors.js";
import type { ToolCall, ToolProvider } from "../tools.js";
import { intArg, need, str, unknownMethod } from "./common.js";

const DEFAULT_PATH = ".halo/kv.sqlite";
const MAX_VALUE_BYTES = 1_000_000;
const MAX_LIST = 1000;
/** How often (ms) a handle sweeps out expired keys. Reads filter them regardless. */
const SWEEP_EVERY = 60_000;

const METHODS = ["get", "set", "delete", "list", "incr"];

interface Handle {
  db: Database;
  lastSweep: number;
}

const handles = new Map<string, Handle>();

function open(path: string): Handle {
  const key = resolve(path);
  let h = handles.get(key);
  if (!h) {
    mkdirSync(dirname(key), { recursive: true });
    const db = new Database(key, { create: true });
    db.exec("PRAGMA journal_mode = WAL");
    db.exec("PRAGMA busy_timeout = 5000");
    db.exec(`CREATE TABLE IF NOT EXISTS kv (
      ns TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      expires_at INTEGER,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (ns, key)
    )`);
    db.exec("CREATE INDEX IF NOT EXISTS kv_expires ON kv (expires_at) WHERE expires_at IS NOT NULL");
    h = { db, lastSweep: 0 };
    handles.set(key, h);
  }
  return h;
}

/** Close every cached KV database (tests, shutdown). */
export function closeKvDatabases(): void {
  for (const h of handles.values()) h.db.close();
  handles.clear();
}

/** A TTL in milliseconds: a number of seconds, or a duration string like "5m". */
function ttlMs(call: ToolCall, ttl: unknown): number | undefined {
  if (ttl === undefined || ttl === null) return undefined;
  const ms = typeof ttl === "number" ? ttl * 1000 : /^\s*\d+(\.\d+)?\s*$/.test(String(ttl)) ? Number(ttl) * 1000 : parseDuration(String(ttl));
  if (!Number.isFinite(ms) || ms <= 0) {
    throw new HaloError(`${call.tool.name}.${call.method}: ttl must be seconds or a duration like "30s", "5m", "1h", got ${str(ttl)}`, { code: "TOOL_ARGUMENT" });
  }
  return ms;
}

/** Escape LIKE wildcards so a prefix matches literally. */
function likePrefix(prefix: string): string {
  return `${prefix.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export const kv: ToolProvider = async (call) => {
  if (!METHODS.includes(call.method)) unknownMethod(call, METHODS);
  const path = call.config(0) ?? call.config("path") ?? DEFAULT_PATH;
  if (typeof path !== "string" || !path) throw new HaloError(`Tool "${call.tool.name}" needs a file path, e.g. KV(".halo/kv.sqlite")`, { code: "TOOL_CONFIG" });
  const ns = String(call.config("namespace") ?? call.tool.name);
  const h = open(path);
  const db = h.db;
  const now = Date.now();
  if (now - h.lastSweep > SWEEP_EVERY) {
    h.lastSweep = now;
    db.query("DELETE FROM kv WHERE expires_at IS NOT NULL AND expires_at <= ?").run(now);
  }
  const named = call.named;
  const keyGiven = named.key !== undefined;
  const key = () => need(call, "key:", named.key ?? call.positional[0]);
  const live = "(expires_at IS NULL OR expires_at > ?)";

  switch (call.method) {
    case "get": {
      const row = db.query(`SELECT value FROM kv WHERE ns = ? AND key = ? AND ${live}`).get(ns, key(), now) as { value: string } | null;
      return row ? JSON.parse(row.value) : (named.default ?? null);
    }

    case "set": {
      const k = key();
      // set(key: "k", value: v), set("k", v), or v |> set(key: "k").
      const value = named.value !== undefined ? named.value : keyGiven ? call.positional[0] : call.positional[1];
      if (value === undefined) throw new HaloError(`${call.tool.name}.set needs value:`, { code: "TOOL_ARGUMENT" });
      const json = JSON.stringify(value);
      if (json.length > MAX_VALUE_BYTES) throw new HaloError(`${call.tool.name}.set: value is over ${MAX_VALUE_BYTES} bytes`, { code: "TOOL_ARGUMENT" });
      const ttl = ttlMs(call, named.ttl ?? call.config("ttl"));
      const expiresAt = ttl === undefined ? null : now + ttl;
      db.query("INSERT OR REPLACE INTO kv (ns, key, value, expires_at, updated_at) VALUES (?, ?, ?, ?, ?)").run(ns, k, json, expiresAt, now);
      return { key: k, set: true, ...(expiresAt ? { expires_at: new Date(expiresAt).toISOString() } : {}) };
    }

    case "delete": {
      const k = key();
      const res = db.query(`DELETE FROM kv WHERE ns = ? AND key = ? AND ${live}`).run(ns, k, now);
      return { key: k, deleted: res.changes > 0 };
    }

    case "list": {
      const prefix = named.prefix ?? (keyGiven ? undefined : call.positional[0]);
      const limit = intArg(call, "limit", named.limit, 100, 1, MAX_LIST);
      const rows = (
        prefix === undefined || prefix === null || prefix === ""
          ? db.query(`SELECT key, value FROM kv WHERE ns = ? AND ${live} ORDER BY key LIMIT ?`).all(ns, now, limit)
          : db.query(`SELECT key, value FROM kv WHERE ns = ? AND key LIKE ? ESCAPE '\\' AND ${live} ORDER BY key LIMIT ?`).all(ns, likePrefix(str(prefix)), now, limit)
      ) as Array<{ key: string; value: string }>;
      return rows.map((r) => ({ key: r.key, value: JSON.parse(r.value) }));
    }

    case "incr": {
      const k = key();
      const by = Number(named.by ?? 1);
      if (!Number.isFinite(by)) throw new HaloError(`${call.tool.name}.incr: by must be a number`, { code: "TOOL_ARGUMENT" });
      const ttl = ttlMs(call, named.ttl);
      return db.transaction(() => {
        const row = db.query(`SELECT value, expires_at FROM kv WHERE ns = ? AND key = ? AND ${live}`).get(ns, k, now) as { value: string; expires_at: number | null } | null;
        const current = row ? JSON.parse(row.value) : 0;
        if (typeof current !== "number") throw new HaloError(`${call.tool.name}.incr: "${k}" holds ${typeof current}, not a number`, { code: "TOOL_ARGUMENT" });
        const value = current + by;
        // An existing key keeps its expiry; a new one gets ttl:, if given.
        const expiresAt = row ? row.expires_at : ttl === undefined ? null : now + ttl;
        db.query("INSERT OR REPLACE INTO kv (ns, key, value, expires_at, updated_at) VALUES (?, ?, ?, ?, ?)").run(ns, k, JSON.stringify(value), expiresAt, now);
        return value;
      })();
    }
  }
  return unknownMethod(call, METHODS);
};
