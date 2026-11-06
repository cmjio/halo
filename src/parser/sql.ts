/**
 * Parameterised SQL only: a pipeline's call to a SQLite tool must write its SQL out
 * as a plain string, with values in `params:`. A {{placeholder}} in the SQL would
 * splice a value into the statement's text (SQL injection), and SQL taken from a
 * variable can't be checked before the run. Shared by `halo validate` and the runtime,
 * which refuses the call even when validate was skipped (the SDK).
 */

import type { Arg } from "./types.js";

/** Providers whose `sql:` must be written out with no {{placeholders}}. */
export const PARAMETERISED_SQL_PROVIDERS = new Set(["SQLite"]);

/**
 * Why this call's SQL isn't parameterised, or undefined when it is (or the call passes none).
 * `positional`: the first unnamed arg is the SQL (a direct tool call, not `Agent.task(tool: DB, "...")`).
 */
export function sqlArgProblem(argList: readonly Arg[], positional = true): string | undefined {
  const arg = argList.find((a) => a.name === "sql" || a.name === "query") ?? (positional ? argList.find((a) => !a.name) : undefined);
  if (!arg) return undefined;
  const v = arg.value;
  if (v.kind !== "string") {
    return `SQL must be written out as a string, not taken from ${v.kind === "ref" || v.kind === "context" ? v.path.join(".") : "a value"}; put the values in params:`;
  }
  if (/\{\{/.test(v.value)) return "SQL can't contain {{placeholders}}; use ? or :name in the SQL and put the values in params:";
  return undefined;
}
