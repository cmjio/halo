/**
 * Snapshot files that grow by appending.
 *
 * A run's trace and call records only ever grow, and a snapshot is saved at every
 * pause (and, with @checkpoint, after every stage). Rewriting them whole each time
 * makes a long run's saves add up to its length squared. So a snapshot is two files:
 * a small core (everything else, plus how much of the log is its own) and a log of
 * trace and call entries that each save extends.
 *
 * The core is written last and names the log's length in bytes, so a crash between
 * the two leaves extra log lines that readers ignore and the next save cuts off.
 */

import { existsSync, mkdirSync, statSync, truncateSync } from "node:fs";
import { appendFile, unlink } from "node:fs/promises";
import { dirname } from "node:path";
import type { RunSnapshot } from "./runtime.js";

interface LogExtent {
  trace: number;
  calls: number;
  bytes: number;
}

type Core = Omit<RunSnapshot, "trace" | "meta"> & { meta: Omit<RunSnapshot["meta"], "calls">; log: LogExtent };

/** What this process last wrote to each log, so the next save knows what is new. */
const written = new Map<string, LogExtent>();

export const logPathFor = (corePath: string) => corePath.replace(/\.json$/, "") + ".log.jsonl";

export async function writeSnapshot(corePath: string, snapshot: RunSnapshot, logPath = logPathFor(corePath)): Promise<void> {
  mkdirSync(dirname(corePath), { recursive: true });
  const { trace, meta, ...rest } = snapshot;
  const { calls, ...metaRest } = meta;
  const prev = written.get(logPath);
  // Append only when the log is still exactly what we last wrote and the lists only grew.
  const extend = prev && trace.length >= prev.trace && calls.length >= prev.calls && existsSync(logPath) && statSync(logPath).size >= prev.bytes;
  const from = extend ? prev : { trace: 0, calls: 0, bytes: 0 };
  const lines = [...trace.slice(from.trace).map((t) => JSON.stringify({ t })), ...calls.slice(from.calls).map((c) => JSON.stringify({ c }))];
  const chunk = lines.length ? `${lines.join("\n")}\n` : "";
  if (extend) {
    if (statSync(logPath).size > prev.bytes) truncateSync(logPath, prev.bytes);
    if (chunk) await appendFile(logPath, chunk);
  } else {
    await Bun.write(logPath, chunk);
  }
  const log = { trace: trace.length, calls: calls.length, bytes: from.bytes + Buffer.byteLength(chunk) };
  await Bun.write(corePath, JSON.stringify({ ...rest, meta: metaRest, log } satisfies Core));
  written.set(logPath, log);
}

/** Read a snapshot written by writeSnapshot, or a single-file snapshot from before logs. */
export async function readSnapshot(corePath: string, logPath = logPathFor(corePath)): Promise<RunSnapshot | undefined> {
  const file = Bun.file(corePath);
  if (!(await file.exists())) return undefined;
  const core = (await file.json()) as Core | RunSnapshot;
  if (!("log" in core)) return core;
  const { log, meta, ...rest } = core;
  const trace: RunSnapshot["trace"] = [];
  const calls: RunSnapshot["meta"]["calls"] = [];
  const text = log.bytes ? await Bun.file(logPath).slice(0, log.bytes).text() : "";
  for (const line of text.split("\n")) {
    if (!line) continue;
    const entry = JSON.parse(line) as { t?: RunSnapshot["trace"][number]; c?: RunSnapshot["meta"]["calls"][number] };
    if (entry.t && trace.length < log.trace) trace.push(entry.t);
    else if (entry.c && calls.length < log.calls) calls.push(entry.c);
  }
  return { ...rest, trace, meta: { ...meta, calls } } as RunSnapshot;
}

/** Forget and remove a snapshot's log. */
export async function deleteLog(logPath: string): Promise<void> {
  written.delete(logPath);
  await unlink(logPath).catch(() => {});
}
