// Library entry point.
export * from "./parser/index.js";
export * from "./runtime/runtime.js";
export * from "./runtime/adapter.js";
export * from "./runtime/router.js";
export { SqliteTelemetry, toTelemetryRow, type TelemetryRow } from "./runtime/telemetry.js";
export { LocalVectorStore, embed } from "./runtime/vectors.js";

import { parse } from "./parser/index.js";
import { validate, type Diagnostic, type ValidateOptions } from "./parser/validate.js";
import type { ParseResult } from "./parser/types.js";

/** Parse and validate in one step. `ok` is false on syntax errors or validation errors. */
export function compile(source: string, options?: ValidateOptions): { ast: ParseResult; diagnostics: Diagnostic[]; ok: boolean } {
  const ast = parse(source);
  if (ast.errors.length) {
    return { ast, diagnostics: ast.errors.map((message) => ({ severity: "error", message })), ok: false };
  }
  const diagnostics = validate(ast, options);
  return { ast, diagnostics, ok: !diagnostics.some((d) => d.severity === "error") };
}
