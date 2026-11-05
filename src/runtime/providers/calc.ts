/**
 * Calc: exact arithmetic and statistics, so numbers in a report come from a calculator, not a model.
 *
 *   tool Math : Calc(precision: 6)
 *     eval(expression, vars?)   stats(values)   percent(part, whole)   change(from, to)
 *
 * `eval` reads its own small expression language and never runs JavaScript:
 * numbers, + - * / % ^ (power), parentheses, comparisons (< <= > >= == !=, giving 1 or 0),
 * names from `vars:` (dotted paths reach into records), the constants pi and e, and the
 * functions abs, ceil, floor, round(x, digits?), sqrt, cbrt, exp, ln, log (base 10), log2,
 * pow, min, max, sum, avg, mean, median, sin, cos, tan, if(cond, a, b).
 */

import { HaloError } from "../errors.js";
import type { ToolCall, ToolProvider } from "../tools.js";
import { explicitFirst, str, unknownMethod } from "./common.js";

const METHODS = ["eval", "stats", "percent", "change"];
const MAX_EXPRESSION = 10_000;

export class CalcError extends Error {}

type Fn = (...a: number[]) => number;

const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
function median(a: number[]): number {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

const FUNCS: Record<string, Fn> = {
  abs: Math.abs,
  ceil: Math.ceil,
  floor: Math.floor,
  round: (x, d = 0) => {
    const f = 10 ** Math.trunc(d);
    return Math.round((x + Number.EPSILON * Math.sign(x)) * f) / f;
  },
  sqrt: Math.sqrt,
  cbrt: Math.cbrt,
  exp: Math.exp,
  ln: Math.log,
  log: Math.log10,
  log2: Math.log2,
  pow: Math.pow,
  min: (...a) => Math.min(...a),
  max: (...a) => Math.max(...a),
  sum: (...a) => a.reduce((x, y) => x + y, 0),
  avg: (...a) => mean(a),
  mean: (...a) => mean(a),
  median: (...a) => median(a),
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  if: (c, a, b) => (c ? a : b),
};
const CONSTS: Record<string, number> = { pi: Math.PI, e: Math.E };

type Token = { t: "num"; v: number } | { t: "name"; v: string } | { t: "op"; v: string };

function tokenize(src: string): Token[] {
  const out: Token[] = [];
  const re = /\s*(?:(\d+(?:\.\d+)?(?:e[+-]?\d+)?|\.\d+)|([A-Za-z_][\w.]*)|(\*\*|<=|>=|==|!=|&&|\|\||[-+*/%^(),<>!]))/iy;
  let i = 0;
  while (i < src.length) {
    if (/^\s*$/.test(src.slice(i))) break;
    re.lastIndex = i;
    const m = re.exec(src);
    if (!m) throw new CalcError(`unexpected "${src.slice(i).trim()[0]}" at position ${i + 1}`);
    if (m[1] !== undefined) out.push({ t: "num", v: Number(m[1]) });
    else if (m[2] !== undefined) out.push({ t: "name", v: m[2] });
    else out.push({ t: "op", v: m[3] === "**" ? "^" : m[3]! });
    i = re.lastIndex;
  }
  return out;
}

function lookup(vars: Record<string, unknown>, path: string): number {
  let v: unknown = vars;
  for (const part of path.split(".")) {
    if (v === null || typeof v !== "object" || !Object.hasOwn(v, part)) {
      v = undefined;
      break;
    }
    v = (v as Record<string, unknown>)[part];
  }
  if (v === undefined) {
    if (Object.hasOwn(CONSTS, path)) return CONSTS[path]!;
    throw new CalcError(`unknown name "${path}"`);
  }
  if (typeof v === "boolean") return v ? 1 : 0;
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v.replace(/[,_]/g, "")) : NaN;
  if (!Number.isFinite(n)) throw new CalcError(`"${path}" is not a number: ${str(v)}`);
  return n;
}

/** Evaluate an arithmetic expression. Throws CalcError on anything it doesn't understand. */
export function evaluate(expression: string, vars: Record<string, unknown> = {}): number {
  if (expression.length > MAX_EXPRESSION) throw new CalcError("expression is too long");
  const toks = tokenize(expression);
  let p = 0;
  const peek = () => toks[p];
  const isOp = (v: string) => peek()?.t === "op" && peek()!.v === v;
  const expect = (v: string) => {
    if (!isOp(v)) throw new CalcError(`expected "${v}"`);
    p++;
  };

  // Precedence, lowest first: || → && → comparisons → + - → * / % → unary → ^ (right-assoc) → atoms.
  const or = (): number => {
    let x = and();
    while (isOp("||")) {
      p++;
      const y = and();
      x = x || y ? 1 : 0;
    }
    return x;
  };
  const and = (): number => {
    let x = cmp();
    while (isOp("&&")) {
      p++;
      const y = cmp();
      x = x && y ? 1 : 0;
    }
    return x;
  };
  const cmp = (): number => {
    let x = add();
    for (;;) {
      const t = peek();
      if (t?.t !== "op" || !["<", "<=", ">", ">=", "==", "!="].includes(t.v)) return x;
      p++;
      const y = add();
      x = { "<": x < y, "<=": x <= y, ">": x > y, ">=": x >= y, "==": x === y, "!=": x !== y }[t.v] ? 1 : 0;
    }
  };
  const add = (): number => {
    let x = mul();
    for (;;) {
      if (isOp("+")) (p++, (x += mul()));
      else if (isOp("-")) (p++, (x -= mul()));
      else return x;
    }
  };
  const mul = (): number => {
    let x = unary();
    for (;;) {
      if (isOp("*")) (p++, (x *= unary()));
      else if (isOp("/")) {
        p++;
        const y = unary();
        if (y === 0) throw new CalcError("division by zero");
        x /= y;
      } else if (isOp("%")) {
        p++;
        const y = unary();
        if (y === 0) throw new CalcError("division by zero");
        x %= y;
      } else return x;
    }
  };
  const unary = (): number => {
    if (isOp("-")) return p++, -unary();
    if (isOp("+")) return p++, unary();
    if (isOp("!")) return p++, unary() ? 0 : 1;
    return power();
  };
  const power = (): number => {
    const base = atom();
    if (isOp("^")) {
      p++;
      return base ** unary();
    }
    return base;
  };
  const atom = (): number => {
    const t = toks[p++];
    if (!t) throw new CalcError("unexpected end of expression");
    if (t.t === "num") return t.v;
    if (t.t === "op" && t.v === "(") {
      const x = or();
      expect(")");
      return x;
    }
    if (t.t === "name") {
      if (isOp("(")) {
        p++;
        const fn = Object.hasOwn(FUNCS, t.v.toLowerCase()) ? FUNCS[t.v.toLowerCase()]! : undefined;
        if (!fn) throw new CalcError(`unknown function "${t.v}" (use ${Object.keys(FUNCS).join(", ")})`);
        const args: number[] = [];
        if (!isOp(")")) {
          // A name that holds a list spreads into the call: sum(prices).
          for (;;) {
            const listName = peek()?.t === "name" && toks[p + 1]?.t === "op" && [",", ")"].includes((toks[p + 1] as { v: string }).v) ? (peek() as { v: string }).v : undefined;
            const list = listName ? listValue(vars, listName) : undefined;
            if (list) (p++, args.push(...list));
            else args.push(or());
            if (isOp(",")) p++;
            else break;
          }
        }
        expect(")");
        return fn(...args);
      }
      return lookup(vars, t.v);
    }
    throw new CalcError(`unexpected "${t.v}"`);
  };

  const result = or();
  if (p < toks.length) throw new CalcError(`unexpected "${(toks[p] as { v: unknown }).v}"`);
  return result;
}

function listValue(vars: Record<string, unknown>, path: string): number[] | undefined {
  let v: unknown = vars;
  for (const part of path.split(".")) {
    if (v === null || typeof v !== "object" || !Object.hasOwn(v, part)) return undefined;
    v = (v as Record<string, unknown>)[part];
  }
  if (!Array.isArray(v)) return undefined;
  return v.map((x, i) => {
    const n = typeof x === "number" ? x : Number(x);
    if (!Number.isFinite(n)) throw new CalcError(`${path}.${i} is not a number: ${str(x)}`);
    return n;
  });
}

function numbers(call: ToolCall, value: unknown, name: string): number[] {
  if (!Array.isArray(value)) throw new HaloError(`${call.tool.name}.${call.method}: ${name} must be a list of numbers`, { code: "TOOL_ARGUMENT" });
  return value.map((x, i) => {
    const n = typeof x === "number" ? x : Number(typeof x === "string" ? x.replace(/[,_]/g, "") : x);
    if (!Number.isFinite(n)) throw new HaloError(`${call.tool.name}.${call.method}: ${name}.${i} is not a number: ${str(x)}`, { code: "TOOL_ARGUMENT" });
    return n;
  });
}

function num(call: ToolCall, value: unknown, name: string): number {
  const n = typeof value === "number" ? value : Number(value);
  if (value === undefined || value === null || value === "" || !Number.isFinite(n)) throw new HaloError(`${call.tool.name}.${call.method}: ${name} must be a number, got ${str(value)}`, { code: "TOOL_ARGUMENT" });
  return n;
}

export const calc: ToolProvider = async (call) => {
  const digits = call.config("precision");
  const fix = (x: number) => (typeof digits === "number" && Number.isFinite(x) ? Number(x.toFixed(Math.min(Math.max(Math.trunc(digits), 0), 15))) : Number.isFinite(x) ? Number(x.toPrecision(15)) : x);
  const n = call.named;
  switch (call.method) {
    case "eval":
    case "calculate":
    case "compute": {
      const expression = n.expression ?? n.expr ?? explicitFirst(call);
      if (typeof expression !== "string" || !expression.trim()) throw new HaloError(`${call.tool.name}.${call.method} needs expression (like "price * 1.2")`, { code: "TOOL_ARGUMENT" });
      const vars = n.vars && typeof n.vars === "object" && !Array.isArray(n.vars) ? (n.vars as Record<string, unknown>) : {};
      try {
        const result = evaluate(expression, vars);
        if (!Number.isFinite(result)) throw new CalcError(`the result is not a finite number (${result})`);
        return { expression, result: fix(result) };
      } catch (err) {
        if (err instanceof CalcError) throw new HaloError(`${call.tool.name}.${call.method}: ${err.message} in "${expression.slice(0, 200)}"`, { code: "TOOL_ARGUMENT" });
        throw err;
      }
    }
    case "stats": {
      const values = numbers(call, n.values ?? explicitFirst(call) ?? (call.implicitInput ? call.positional[0] : undefined), "values");
      if (!values.length) return { count: 0 };
      const m = mean(values);
      const variance = values.length > 1 ? values.reduce((a, x) => a + (x - m) ** 2, 0) / (values.length - 1) : 0;
      return {
        count: values.length,
        sum: fix(values.reduce((a, x) => a + x, 0)),
        mean: fix(m),
        median: fix(median(values)),
        min: Math.min(...values),
        max: Math.max(...values),
        stdev: fix(Math.sqrt(variance)),
      };
    }
    case "percent": {
      const part = num(call, n.part, "part");
      const whole = num(call, n.whole, "whole");
      if (whole === 0) throw new HaloError(`${call.tool.name}.percent: whole is 0`, { code: "TOOL_ARGUMENT" });
      return { part, whole, percent: fix((part / whole) * 100) };
    }
    case "change": {
      const from = num(call, n.from, "from");
      const to = num(call, n.to, "to");
      return { from, to, difference: fix(to - from), percent: from === 0 ? null : fix(((to - from) / Math.abs(from)) * 100) };
    }
    default:
      return unknownMethod(call, METHODS);
  }
};
