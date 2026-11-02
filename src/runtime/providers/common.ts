/** Small helpers shared by the local providers (Workspace, KV, Code, Documents). */

import { HaloError } from "../errors.js";
import type { ToolCall } from "../tools.js";

export function str(v: unknown): string {
  return typeof v === "string" ? v : JSON.stringify(v);
}

export function need(call: ToolCall, name: string, value: unknown): string {
  if (value === undefined || value === null || value === "") {
    throw new HaloError(`${call.tool.name}.${call.method} needs ${name}`, { code: "TOOL_ARGUMENT" });
  }
  return str(value);
}

export function unknownMethod(call: ToolCall, methods: string[]): never {
  throw new HaloError(`${call.tool.provider} tool "${call.tool.name}" has no method "${call.method}" (use ${methods.join(", ")})`, { code: "TOOL_METHOD" });
}

/** A whole-number argument, clamped to [min, max]; `fallback` when it's not given. */
export function intArg(call: ToolCall, name: string, value: unknown, fallback: number, min: number, max: number): number {
  if (value === undefined || value === null || value === "") return fallback;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) throw new HaloError(`${call.tool.name}.${call.method}: ${name} must be a number, got ${str(value)}`, { code: "TOOL_ARGUMENT" });
  return Math.min(Math.max(Math.trunc(n), min), max);
}

/** The first positional arg, unless it is only the flowing pipeline value. */
export function explicitFirst(call: ToolCall): unknown {
  return call.implicitInput ? undefined : call.positional[0];
}
