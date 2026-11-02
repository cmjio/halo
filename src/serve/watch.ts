/**
 * Watches: start a pipeline when something changes.
 *
 *   "watches": [
 *     { "pipeline": "OnPrice", "url": "https://api.example.com/price.json", "every": "5m" },
 *     { "pipeline": "OnData",  "file": "data/orders.csv", "every": "30s" },
 *     { "pipeline": "OnDeploy", "command": "git rev-parse origin/main", "every": "1m" }
 *   ]
 *
 * Each check reads the source and compares it with the last reading, without any
 * model call. Only a change starts the pipeline, with `{ source, before, after,
 * changes }`: for JSON, the paths that changed; for text, the lines added and
 * removed. The last reading is kept in the state folder, so a restart doesn't
 * count everything as new.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { parseDuration } from "../parser/builtins.js";

export interface WatchConfig {
  pipeline: string;
  /** Exactly one source. */
  url?: string;
  file?: string;
  command?: string;
  /** How often to check: "30s", "5m", "1h". Default 1m; at least 5s. */
  every?: string;
  /** Headers for a url, e.g. { "Authorization": "Env.TOKEN" }. */
  headers?: Record<string, string>;
  /** Extra arguments for the pipeline. */
  args?: Record<string, unknown>;
  /** Also run on the first reading (default: the first reading is only remembered). */
  runOnStart?: boolean;
}

export interface Change {
  path?: string;
  before?: unknown;
  after?: unknown;
  /** For text: a line added or removed. */
  added?: string;
  removed?: string;
}

export interface Reading {
  hash: string;
  value: unknown;
  at: string;
}

const MAX_CHANGES = 200;
const MAX_KEPT = 1_000_000;

export function watchKey(w: WatchConfig): string {
  return `${w.pipeline}:${w.url ? `url:${w.url}` : w.file ? `file:${w.file}` : `command:${w.command}`}`;
}

export function watchInterval(w: WatchConfig): number {
  const ms = parseDuration(w.every ?? "1m");
  if (!(ms > 0)) throw new Error(`Watch for ${w.pipeline}: every must be a duration like 30s or 5m (got "${w.every}")`);
  return Math.max(5_000, ms);
}

export function checkWatchConfig(w: WatchConfig): void {
  const sources = [w.url, w.file, w.command].filter((s) => s !== undefined);
  if (sources.length !== 1) throw new Error(`Watch for ${w.pipeline} needs exactly one of url, file, or command`);
  if (w.url && !/^https?:\/\//i.test(w.url)) throw new Error(`Watch for ${w.pipeline}: url must start with http:// or https://`);
  watchInterval(w);
}

/** Read a watch's source: parsed JSON when it is JSON, else text. */
export async function readSource(w: WatchConfig, io: { fetch: typeof fetch; env: Record<string, string | undefined>; signal?: AbortSignal }): Promise<unknown> {
  let text: string;
  if (w.url) {
    const headers = Object.fromEntries(Object.entries(w.headers ?? {}).map(([k, v]) => [k, /^Env\.\w+$/.test(v) ? (io.env[v.slice(4)] ?? "") : v]));
    const res = await io.fetch(w.url, { headers, signal: io.signal });
    if (!res.ok) throw new Error(`GET ${w.url} failed (${res.status})`);
    text = await res.text();
  } else if (w.file) {
    text = existsSync(w.file) ? readFileSync(w.file, "utf8") : "";
  } else {
    // The command comes from the server's own config, written by its operator.
    const proc = Bun.spawn(["bash", "-c", w.command!], { stdout: "pipe", stderr: "pipe", stdin: "ignore" });
    const timer = setTimeout(() => proc.kill(), 60_000);
    const [out, code] = await Promise.all([new Response(proc.stdout).text(), proc.exited]);
    clearTimeout(timer);
    if (code !== 0) throw new Error(`\`${w.command}\` exited with ${code}`);
    text = out;
  }
  const trimmed = text.trim();
  if (/^[[{]/.test(trimmed)) {
    try {
      return JSON.parse(trimmed);
    } catch {}
  }
  return text;
}

export function reading(value: unknown): Reading {
  const json = JSON.stringify(value) ?? "";
  return { hash: createHash("sha256").update(json).digest("hex"), value: json.length > MAX_KEPT ? undefined : value, at: new Date().toISOString() };
}

/** What changed between two readings: JSON paths, or lines added and removed. */
export function diff(before: unknown, after: unknown): Change[] {
  const out: Change[] = [];
  if (isObj(before) && isObj(after)) walk(before, after, "", out);
  else if (typeof before === "string" && typeof after === "string") lines(before, after, out);
  else out.push({ before, after });
  return out.slice(0, MAX_CHANGES);
}

const isObj = (v: unknown): v is Record<string, unknown> | unknown[] => typeof v === "object" && v !== null;

function walk(a: unknown, b: unknown, path: string, out: Change[]) {
  if (out.length >= MAX_CHANGES) return;
  if (isObj(a) && isObj(b) && Array.isArray(a) === Array.isArray(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) walk((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], path ? `${path}.${k}` : k, out);
  } else if (JSON.stringify(a) !== JSON.stringify(b)) {
    out.push({ path, before: a, after: b });
  }
}

function lines(a: string, b: string, out: Change[]) {
  const count = (text: string) => {
    const m = new Map<string, number>();
    for (const l of text.split("\n")) m.set(l, (m.get(l) ?? 0) + 1);
    return m;
  };
  const was = count(a);
  const now = count(b);
  for (const [l, n] of now) for (let i = was.get(l) ?? 0; i < n; i++) out.push({ added: l });
  for (const [l, n] of was) for (let i = now.get(l) ?? 0; i < n; i++) out.push({ removed: l });
}
