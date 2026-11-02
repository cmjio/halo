/**
 * Recording runs, and replaying them exactly.
 *
 * A recording keeps everything a run got from outside, in order: each model
 * answer (including the tool calls it asked for), each tool result, and each
 * approval. Replaying feeds those back instead of calling anything, so a run
 * can be stepped through again, debugged, or rerun against a changed pipeline
 * for free. With live models (or live tools), only the other side is replayed:
 * e.g. new prompts against the same tool results.
 *
 * Recordings hold unredacted answers, so they stay in the local state folder.
 */

import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { HaloError } from "./errors.js";
import { useTool, type MockRequest, type RecordedCall, type RunResult } from "./runtime.js";

export interface Recording {
  runId: string;
  pipeline: string;
  args: Record<string, unknown>;
  startedAt: string;
  calls: RecordedCall[];
  /** How the run ended (the last time it ended, for a run that paused and resumed). */
  end?: { status: RunResult["status"] | "error"; output?: unknown; error?: string };
}

type Line = { start: Omit<Recording, "calls" | "end"> } | { c: RecordedCall } | { end: NonNullable<Recording["end"]> };

/** Appends a run's calls to `<dir>/<runId>.jsonl` as they happen (a resumed run keeps appending). */
export class Recorder {
  readonly path: string;
  constructor(dir: string, readonly runId: string) {
    if (!/^[\w-]+$/.test(runId)) throw new HaloError(`Invalid run id "${runId}"`);
    this.path = join(dir, `${runId}.jsonl`);
    mkdirSync(dirname(this.path), { recursive: true });
  }
  private write(line: Line) {
    appendFileSync(this.path, JSON.stringify(line) + "\n");
  }
  start(pipeline: string, args: Record<string, unknown>) {
    if (!existsSync(this.path)) this.write({ start: { runId: this.runId, pipeline, args, startedAt: new Date().toISOString() } });
  }
  readonly record = (entry: RecordedCall) => this.write({ c: entry });
  finish(end: NonNullable<Recording["end"]>) {
    this.write({ end });
  }
}

export function readRecording(dir: string, runId: string): Recording {
  if (!/^[\w-]+$/.test(runId)) throw new HaloError(`Invalid run id "${runId}"`);
  const path = join(dir, `${runId}.jsonl`);
  if (!existsSync(path)) throw new HaloError(`No recording of run ${runId} in ${dir}`);
  let rec: Recording | undefined;
  for (const text of readFileSync(path, "utf8").split("\n")) {
    if (!text.trim()) continue;
    const line = JSON.parse(text) as Line;
    if ("start" in line) rec = { ...line.start, calls: [] };
    else if (!rec) throw new HaloError(`${path} doesn't start with a run header`);
    else if ("c" in line) rec.calls.push(line.c);
    else rec.end = line.end;
  }
  if (!rec) throw new HaloError(`${path} is empty`);
  return rec;
}

/** Keep the newest `keep` recordings in a folder. */
export function pruneRecordings(dir: string, keep = 50): void {
  if (!existsSync(dir)) return;
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".jsonl"))
    .map((f) => ({ f, t: statSync(join(dir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  for (const { f } of files.slice(keep)) rmSync(join(dir, f), { force: true });
}

/**
 * Mocks that answer each call with what the recording says it got, in order, per target.
 * A call the recording has no answer for means the pipeline (or its input) changed.
 */
export function replayMocks(rec: Recording, options: { liveModels?: boolean; liveTools?: boolean; tools?: string[] } = {}): Record<string, unknown> {
  const queues = new Map<string, RecordedCall[]>();
  for (const c of rec.calls) {
    const key = `${c.kind}:${c.target}`;
    if (!queues.has(key)) queues.set(key, []);
    queues.get(key)!.push(c);
  }
  const next = (kind: RecordedCall["kind"], target: string) => {
    const c = queues.get(`${kind}:${target}`)?.shift();
    const what = { agent: "model answers", tool: "results", approval: "approvals", yield: "answers", listen: "events" }[kind];
    if (!c) throw new HaloError(`The recording has no more ${what} for ${target}: the pipeline or its input changed since run ${rec.runId}`, { code: "REPLAY_MISMATCH" });
    return c;
  };
  const mocks: Record<string, unknown> = {};
  for (const c of rec.calls) {
    if (c.kind === "agent" && !options.liveModels) {
      mocks[c.target] = (req: MockRequest) => {
        const got = next("agent", req.target);
        return got.toolCalls?.length ? got.toolCalls.map((t) => useTool(t.name, t.args)) : got.value;
      };
    } else if (c.kind === "tool" && !options.liveTools) {
      mocks[c.target] = (req: MockRequest) => next("tool", req.target).value;
    } else if (c.kind === "approval") {
      mocks.approval = (req: MockRequest) => next("approval", req.target).value;
    } else if (c.kind === "yield") {
      mocks.yield = () => next("yield", "yield").value;
    } else if (c.kind === "listen") {
      mocks[c.target] = (req: MockRequest) => next("listen", req.target).value;
    }
  }
  // A tool the recording never called would run for real: refuse instead (by tool name, after the recorded "Tool.method" keys).
  if (!options.liveTools) {
    for (const name of options.tools ?? []) {
      mocks[name] ??= (req: MockRequest) => {
        throw new HaloError(`The recording has no results for ${req.target}: the pipeline changed since run ${rec.runId} (pass --live-tools to call tools for real)`, { code: "REPLAY_MISMATCH" });
      };
    }
  }
  // Anything else that would call a model (a shadow, or a new agent stage) isn't in the recording.
  if (!options.liveModels) {
    mocks["*"] = (req: MockRequest) => {
      throw new HaloError(`The recording has no model answers for ${req.target}: the pipeline changed since run ${rec.runId}`, { code: "REPLAY_MISMATCH" });
    };
  }
  return mocks;
}
