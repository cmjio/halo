/**
 * `@expect(...)`: what a pipeline's output must satisfy, written beside the pipeline.
 *
 *   @expect("output.labels.length <= 3", "output.summary != null")
 *   pipeline Triage(issue: String) -> Result:
 *
 * Each argument is a condition in the same language as a gate (`|? (...)`), over `output` (what the
 * run returned) and the pipeline's inputs (`input.issue`, or just `issue`). No model is involved, so
 * they are hard checks:
 *
 *   - `halo run` and `halo test` report them after a run that completes; `halo test` fails on a broken one
 *     (unless every answer is a placeholder from --mock without --mocks).
 *   - `halo compare` and `halo evolve` hold every variant to the ORIGINAL's expectations: a variant whose
 *     output breaks one the original's met loses that run without asking the judge.
 */

import { parseCondition } from "./parser/index.js";
import type { CondExpr, ParseResult, Value } from "./parser/types.js";
import { asNumber, getPath, hasOwnKey, looseEquals, truthy } from "./runtime/values.js";

export interface Expectation {
  text: string;
  expr?: CondExpr;
  errors: string[];
}

export interface ExpectResult {
  text: string;
  ok: boolean;
}

/** The `@expect` conditions on a pipeline, parsed. */
export function expectationsOf(ast: ParseResult, pipeline: string): Expectation[] {
  const decl = ast.pipelines.find((p) => p.name === pipeline);
  return (decl?.directives ?? [])
    .filter((d) => d.name === "expect")
    .flatMap((d) => d.args ?? [])
    .map((text) => {
      const parsed = parseCondition(text);
      return { text, expr: parsed.expr, errors: parsed.errors };
    });
}

function lookup(path: string[], output: unknown, input: Record<string, unknown>): unknown {
  const [root, ...rest] = path as [string, ...string[]];
  if (root === "output") return getPath(output, rest);
  if (root === "input") return getPath(input, rest);
  // context.input.x / context.output, as a gate would write them.
  if (root === "context" && rest[0] === "input") return getPath(input, rest.slice(1));
  if (root === "context" && rest[0] === "output") return getPath(output, rest.slice(1));
  if (hasOwnKey(input, root)) return getPath(input[root], rest);
  return undefined;
}

function value(v: Value, output: unknown, input: Record<string, unknown>): unknown {
  switch (v.kind) {
    case "string":
    case "model":
      return v.value;
    case "number":
    case "bool":
      return v.value;
    case "null":
      return null;
    case "duration":
      return v.raw;
    case "ref":
      return lookup(v.path, output, input);
    case "context":
      return lookup(["context", ...v.path], output, input);
    case "list":
      return v.items.map((i) => value(i, output, input));
  }
}

function evaluate(c: CondExpr, output: unknown, input: Record<string, unknown>): unknown {
  switch (c.kind) {
    case "or":
      return c.terms.some((t) => truthy(evaluate(t, output, input)));
    case "and":
      return c.terms.every((t) => truthy(evaluate(t, output, input)));
    case "not":
      return !truthy(evaluate(c.expr, output, input));
    case "value":
      return value(c.value, output, input);
    case "compare": {
      const l = evaluate(c.left, output, input);
      const r = evaluate(c.right, output, input);
      if (c.op === "==") return looseEquals(l, r);
      if (c.op === "!=") return !looseEquals(l, r);
      const [a, b] = [asNumber(l), asNumber(r)];
      if (l === null || l === undefined || r === null || r === undefined || Number.isNaN(a) || Number.isNaN(b)) return false;
      return c.op === ">" ? a > b : c.op === "<" ? a < b : c.op === ">=" ? a >= b : a <= b;
    }
  }
}

/** Each expectation, checked against one run's output and inputs. One that doesn't parse fails. */
export function checkExpectations(expectations: Expectation[], output: unknown, input: Record<string, unknown>): ExpectResult[] {
  return expectations.map((e) => ({ text: e.text, ok: !!e.expr && truthy(evaluate(e.expr, output, input)) }));
}
