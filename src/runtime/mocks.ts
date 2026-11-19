/**
 * Stand-in answers for a run that must not call a model or touch anything: `halo run --mock`,
 * `halo test`, and dry runs in `halo serve`.
 */

import type { ParseResult } from "../parser/types.js";
import type { HaloRuntime } from "./runtime.js";

/** Every agent answers with a placeholder and every tool with an echo of its call, except tools named in `live`. */
export function mockEverything(rt: HaloRuntime, ast: ParseResult, live: Set<string> = new Set()): void {
  const preview = (s: string | undefined) => (s ?? "").replace(/\s+/g, " ").slice(0, 80);
  const mocks: Record<string, unknown> = {
    "*": (req: { target: string; prompt?: string }) => `[mock ${req.target}] ${preview(req.prompt)}`,
    // The runtime's own transcription calls a paid service: a rehearsal says what it would have done.
    "Media.transcript": (req: { args: unknown[] }) => ({ text: `[mock transcript of ${(req.args[0] as { name?: string })?.name ?? "the recording"}]`, model: "mock", cost: 0 }),
    "Media.digest": (req: { args: unknown[] }) => ({ transcript: { text: `[mock transcript of ${(req.args[0] as { name?: string })?.name ?? "the video"}]` }, frames: [] }),
  };
  for (const t of [...ast.tools, ...ast.stores]) {
    if (live.has(t.name)) continue;
    mocks[t.name] = (req: { target: string; args: unknown[]; named: Record<string, unknown> }) => ({ mock: true, tool: req.target, named: req.named });
  }
  rt.mockAll(mocks);
}

/**
 * A mocks file's entries: canned answers keyed like `runtime.mockAll` (`Agent.method`, `Agent`,
 * `Tool.method`, `Tool`, `*`, `yield`, a listen target), and the tools marked `"live"`, which
 * run for real.
 */
export function splitMocks(data: unknown, file: string): { mocks: Record<string, unknown>; live: Set<string> } {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error(`Mocks file ${file} must be a JSON object of target → answer`);
  const mocks: Record<string, unknown> = {};
  const live = new Set<string>();
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (value === "live") live.add(key);
    else mocks[key] = value;
  }
  return { mocks, live };
}
