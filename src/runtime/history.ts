/**
 * Every step of a @checkpoint run, not just the latest.
 *
 * The checkpoint file holds where a run is now; each save overwrites it. Beside it,
 * `<checkpoint>.steps.jsonl` gets one line per save: the stage that just ran, the
 * value it produced, and only the `context.data` keys that changed since the step
 * before. Folding the lines up to step N gives the run's state as it was after N.
 *
 * A step's number is the length of the trace when it was saved, so it matches the
 * trace entry (and the hash chain) for that stage, through loops and resumes.
 */

import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { appendFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { HaloError } from "./errors.js";
import type { RunSnapshot } from "./runtime.js";

export interface Step {
  /** 1-based, and equal to the trace's length after this stage. */
  step: number;
  /** The stage that ran, and its label. */
  stage: number;
  label: string;
  at: string;
  /** The stage a resume from here would run next. */
  next: number;
  /** Set when a gate closed at this step. */
  halted?: true;
  current: unknown;
  /** `context.data` keys added or changed at this step, and keys removed. */
  set: Record<string, unknown>;
  unset?: string[];
  cost: number;
  tokens: { prompt: number; completion: number };
  /** How many calls the run had made by this step. */
  calls: number;
  /** How many thread changes (`Thread.set`, ...) the run had made by this step. */
  thread?: number;
  loops?: RunSnapshot["loops"];
  loopFeedback?: RunSnapshot["loopFeedback"];
}

/** The run as it was after one step. */
export interface StepState {
  step: Step;
  data: Record<string, unknown>;
  current: unknown;
}

export const stepsPathFor = (corePath: string) => corePath.replace(/\.json$/, "") + ".steps.jsonl";

/** The serialized `context.data` keys each history last wrote, so the next step stores only what changed. */
const last = new Map<string, Map<string, string>>();

async function lastWritten(path: string): Promise<Map<string, string>> {
  let keys = last.get(path);
  if (keys) return keys;
  // A run resumed in a new process continues its history from what the file says.
  keys = new Map();
  if (existsSync(path)) {
    for (const s of await readSteps(path)) {
      for (const [k, v] of Object.entries(s.set)) keys.set(k, JSON.stringify(v));
      for (const k of s.unset ?? []) keys.delete(k);
    }
  }
  last.set(path, keys);
  return keys;
}

/** Add the step a checkpoint save just recorded to its history. */
export async function appendStep(corePath: string, snap: RunSnapshot): Promise<void> {
  const entry = snap.trace.at(-1);
  if (!entry) return;
  const path = stepsPathFor(corePath);
  mkdirSync(dirname(path), { recursive: true });
  const keys = await lastWritten(path);
  const set: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(snap.data)) {
    const json = JSON.stringify(v);
    if (keys.get(k) === json) continue;
    set[k] = v;
    keys.set(k, json);
  }
  const unset = [...keys.keys()].filter((k) => !Object.hasOwn(snap.data, k));
  for (const k of unset) keys.delete(k);
  const step: Step = {
    step: snap.trace.length,
    stage: entry.index,
    label: entry.label,
    at: entry.at,
    next: snap.nextStage,
    ...(snap.meta.halted ? { halted: true as const } : {}),
    current: snap.current,
    set,
    ...(unset.length ? { unset } : {}),
    cost: snap.meta.cost,
    tokens: snap.meta.tokens,
    calls: snap.meta.calls.length,
    ...(snap.thread ? { thread: snap.thread.ops.length } : {}),
    ...(snap.loops && Object.keys(snap.loops).length ? { loops: snap.loops } : {}),
    ...(snap.loopFeedback ? { loopFeedback: snap.loopFeedback } : {}),
  };
  await appendFile(path, JSON.stringify(step) + "\n");
}

export async function readSteps(path: string): Promise<Step[]> {
  const text = await Bun.file(path).text();
  return text
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as Step);
}

/** Fold a history up to `step` (the last step by default). */
export function stateAt(steps: Step[], step = steps.at(-1)?.step ?? 0): StepState {
  const at = steps.findIndex((s) => s.step === step);
  if (at < 0) throw new HaloError(`No step ${step} in this history (it has steps ${steps[0]?.step ?? 0}–${steps.at(-1)?.step ?? 0})`);
  const data: Record<string, unknown> = {};
  for (const s of steps.slice(0, at + 1)) {
    Object.assign(data, s.set);
    for (const k of s.unset ?? []) delete data[k];
  }
  return { step: steps[at]!, data, current: steps[at]!.current };
}

/** Find a run's history in a checkpoint folder by its run id. */
export function findSteps(dir: string, runId: string): string {
  if (!/^[\w-]+$/.test(runId)) throw new HaloError(`Invalid run id "${runId}"`);
  const suffix = `-${runId}.steps.jsonl`;
  const file = existsSync(dir) ? readdirSync(dir).find((f) => f.endsWith(suffix)) : undefined;
  if (!file) throw new HaloError(`No step history for run ${runId} in ${dir} (only pipelines with @checkpoint keep one)`);
  return join(dir, file);
}
