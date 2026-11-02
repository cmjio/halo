/**
 * Telemetry: records runtime events to SQLite so Halo Studio can show each run
 * (stages, model calls, tool calls, errors). Opt in with:
 *
 *   const telemetry = new SqliteTelemetry(".halo/telemetry.db");
 *   new HaloRuntime({ onEvent: telemetry.handler });
 *
 * The CLI records to .halo/telemetry.db unless you pass --no-telemetry.
 */

import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { RuntimeEvent } from "./runtime.js";

/** Row types Studio understands. */
export type TelemetryType = "stream_start" | "stream_end" | "node_start" | "node_end" | "llm_call" | "tool_call" | "error" | "event";

export interface TelemetryRow {
  runId: string;
  timestamp: number;
  type: TelemetryType;
  stage: string;
  payload: unknown;
  durationMs?: number;
  tokens?: number;
}

/** Map a runtime event to a Studio row (undefined for events Studio doesn't show). */
export function toTelemetryRow(e: RuntimeEvent, now = Date.now()): TelemetryRow | undefined {
  switch (e.type) {
    case "run":
      if (e.status === "start") return { runId: e.runId, timestamp: now, type: "stream_start", stage: e.pipeline, payload: null };
      if (e.status === "error") return { runId: e.runId, timestamp: now, type: "error", stage: e.pipeline, payload: { error: e.error, cost: e.cost } };
      return { runId: e.runId, timestamp: now, type: "stream_end", stage: e.pipeline, payload: { status: e.status, output: e.output, cost: e.cost }, durationMs: e.durationMs };
    case "stage":
      return e.status === "start"
        ? { runId: e.runId, timestamp: now, type: "node_start", stage: `${e.index}: ${e.label}`, payload: null }
        : { runId: e.runId, timestamp: now, type: "node_end", stage: `${e.index}: ${e.label}`, payload: e.value, durationMs: e.durationMs };
    case "llm":
      return {
        runId: e.runId,
        timestamp: now,
        type: "llm_call",
        stage: `${e.agent} via ${e.model}`,
        payload: { system: e.system, prompt: e.prompt, output: e.output, cost: e.cost, mocked: e.mocked },
        durationMs: e.latencyMs,
        tokens: e.tokens ? e.tokens.prompt + e.tokens.completion : undefined,
      };
    case "tool":
      return { runId: e.runId, timestamp: now, type: "tool_call", stage: `${e.tool}.${e.method}`, payload: { output: e.output, mocked: e.mocked }, durationMs: e.latencyMs };
    case "paused":
      return { runId: e.runId, timestamp: now, type: "stream_end", stage: e.pipeline, payload: { status: "paused", waitingFor: e.waitingFor } };
    default:
      return undefined;
  }
}

function json(v: unknown): string | null {
  if (v === undefined) return null;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

/** Writes telemetry rows to a SQLite file, keeping the most recent `keepRuns` runs. */
export class SqliteTelemetry {
  private db: Database;
  private insert;

  constructor(readonly path = ".halo/telemetry.db", private keepRuns = 100) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new Database(path, { create: true });
    this.db.run(`CREATE TABLE IF NOT EXISTS telemetry (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT, timestamp INTEGER, type TEXT, stage TEXT, payload TEXT, duration_ms INTEGER, tokens INTEGER
    )`);
    this.db.run("CREATE INDEX IF NOT EXISTS idx_telemetry_run_id ON telemetry(run_id)");
    this.insert = this.db.prepare("INSERT INTO telemetry (run_id, timestamp, type, stage, payload, duration_ms, tokens) VALUES (?, ?, ?, ?, ?, ?, ?)");
  }

  /** Pass as (or call from) RuntimeConfig.onEvent. */
  handler = (event: RuntimeEvent): void => {
    const row = toTelemetryRow(event);
    if (!row) return;
    if (row.type === "stream_start") this.prune();
    this.insert.run(row.runId, row.timestamp, row.type, row.stage, json(row.payload), row.durationMs ?? null, row.tokens ?? null);
  };

  private prune() {
    this.db.run(
      `DELETE FROM telemetry WHERE run_id NOT IN (
         SELECT run_id FROM telemetry GROUP BY run_id ORDER BY MIN(timestamp) DESC LIMIT ?
       )`,
      [this.keepRuns - 1],
    );
  }

  /** Rows for one run, oldest first. */
  run(runId: string): Array<Record<string, unknown>> {
    return this.db.query("SELECT * FROM telemetry WHERE run_id = ? ORDER BY timestamp, id").all(runId) as Array<Record<string, unknown>>;
  }

  close() {
    this.db.close();
  }
}
