/**
 * Data: reshape JSON without a model call: pick, filter, sort, group, count, sum, join, diff, CSV.
 *
 *   tool Rows : Data()
 *     get(data, path)   pick(data, fields)   filter(data, where)   sort(data, by, desc?)   limit(data, n, offset?)
 *     group(data, by)   count(data, by?)   aggregate(data, field, op, by?)   unique(data, by?)   flatten(data, depth?)
 *     join(left, right, on)   diff(before, after, key?)   from_csv(text, delimiter?)   to_csv(data, fields?)
 *
 * `data:` defaults to the flowing value. Paths are dotted (`user.address.city`, `items.0.id`).
 * A `where:` is a record of path → value (equal), or path → { op: value } with ops
 * = != > >= < <= in not_in contains starts_with ends_with matches exists; or, since
 * pipelines have no record literals, text: "total > 100 && status == 'paid'".
 * Everything is deterministic and runs in-process, so it is cheap to put between agent stages.
 */

import { HaloError } from "../errors.js";
import type { ToolCall, ToolProvider } from "../tools.js";
import { explicitFirst, intArg, str, unknownMethod } from "./common.js";
import { parseDelimited, rowsToRecords } from "./documents.js";

const METHODS = ["get", "pick", "filter", "sort", "limit", "group", "count", "aggregate", "unique", "flatten", "join", "diff", "from_csv", "to_csv"];
const MAX_CSV_CHARS = 20_000_000;

function argError(call: ToolCall, message: string): HaloError {
  return new HaloError(`${call.tool.name}.${call.method}: ${message}`, { code: "TOOL_ARGUMENT" });
}

/** Read a dotted path. A segment applied to a list maps over it (`items.title` → every title). */
export function getPath(value: unknown, path: string): unknown {
  if (path === "" || path === ".") return value;
  let v: unknown = value;
  for (const part of path.split(".")) {
    if (v === null || v === undefined) return undefined;
    if (Array.isArray(v)) {
      if (/^\d+$/.test(part)) v = v[Number(part)];
      else if (part === "length") v = v.length;
      else v = v.map((x) => (x !== null && typeof x === "object" && Object.hasOwn(x, part) ? (x as Record<string, unknown>)[part] : undefined));
    } else if (typeof v === "object") {
      v = Object.hasOwn(v, part) ? (v as Record<string, unknown>)[part] : undefined;
    } else return undefined;
  }
  return v;
}

function setPath(target: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".");
  let o = target;
  for (const p of parts.slice(0, -1)) {
    if (p === "__proto__" || p === "constructor" || p === "prototype") return;
    o = (o[p] && typeof o[p] === "object" ? o[p] : (o[p] = {})) as Record<string, unknown>;
  }
  const last = parts.at(-1)!;
  if (last === "__proto__" || last === "constructor" || last === "prototype") return;
  o[last] = value;
}

function list(call: ToolCall, value: unknown, name = "data"): unknown[] {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null) throw argError(call, `needs ${name} (a list)`);
  throw argError(call, `${name} must be a list, got ${typeof value}`);
}

function input(call: ToolCall): unknown {
  return call.named.data ?? explicitFirst(call) ?? (call.implicitInput ? call.positional[0] : undefined);
}

function stringList(call: ToolCall, value: unknown, name: string): string[] {
  if (value === undefined || value === null) throw argError(call, `needs ${name}`);
  const items = Array.isArray(value) ? value : String(value).split(",");
  return items.map((x) => String(x).trim()).filter(Boolean);
}

function key(v: unknown): string {
  return typeof v === "string" ? v : JSON.stringify(v) ?? "undefined";
}

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === undefined || a === null) return 1;
  if (b === undefined || b === null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  const na = Number(a);
  const nb = Number(b);
  if (typeof a !== "boolean" && typeof b !== "boolean" && a !== "" && b !== "" && Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
  return String(a).localeCompare(String(b));
}

function equal(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a === "number" || typeof b === "number") return Number(a) === Number(b) && a !== "" && b !== "" && a !== null && b !== null;
  return JSON.stringify(a) === JSON.stringify(b);
}

const OPS = ["=", "==", "!=", ">", ">=", "<", "<=", "in", "not_in", "contains", "starts_with", "ends_with", "matches", "exists"];

function test(call: ToolCall, actual: unknown, op: string, expected: unknown): boolean {
  switch (op) {
    case "=":
    case "==":
      return equal(actual, expected);
    case "!=":
      return !equal(actual, expected);
    case ">":
      return actual !== undefined && actual !== null && compare(actual, expected) > 0;
    case ">=":
      return actual !== undefined && actual !== null && compare(actual, expected) >= 0;
    case "<":
      return actual !== undefined && actual !== null && compare(actual, expected) < 0;
    case "<=":
      return actual !== undefined && actual !== null && compare(actual, expected) <= 0;
    case "in":
      return Array.isArray(expected) && expected.some((e) => equal(actual, e));
    case "not_in":
      return Array.isArray(expected) && !expected.some((e) => equal(actual, e));
    case "contains":
      return Array.isArray(actual) ? actual.some((a) => equal(a, expected)) : typeof actual === "string" && actual.toLowerCase().includes(String(expected).toLowerCase());
    case "starts_with":
      return typeof actual === "string" && actual.toLowerCase().startsWith(String(expected).toLowerCase());
    case "ends_with":
      return typeof actual === "string" && actual.toLowerCase().endsWith(String(expected).toLowerCase());
    case "matches": {
      let re: RegExp;
      try {
        re = new RegExp(String(expected), "i");
      } catch {
        throw argError(call, `"${str(expected)}" is not a valid regular expression`);
      }
      return typeof actual === "string" && re.test(actual);
    }
    case "exists":
      return (actual !== undefined && actual !== null) === (expected !== false);
    default:
      throw argError(call, `unknown operator "${op}" (use ${OPS.join(", ")})`);
  }
}

const WORD_OPS = ["contains", "starts_with", "ends_with", "matches", "not_in", "in", "exists"];

function literal(raw: string): unknown {
  const t = raw.trim();
  if (/^(["']).*\1$/s.test(t)) return t.slice(1, -1);
  if (t === "true") return true;
  if (t === "false") return false;
  if (t === "null") return null;
  if (t.startsWith("[")) {
    try {
      return JSON.parse(t.replace(/'/g, '"'));
    } catch {}
  }
  if (t !== "" && Number.isFinite(Number(t))) return Number(t);
  return t;
}

/** Split on `&&` outside quotes. */
function splitAnd(text: string): string[] {
  const parts: string[] = [];
  let quote = "";
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quote) {
      if (c === quote) quote = "";
    } else if (c === '"' || c === "'") quote = c;
    else if (c === "&" && text[i + 1] === "&") {
      parts.push(text.slice(start, i));
      start = i + 2;
      i++;
    }
  }
  parts.push(text.slice(start));
  return parts.map((p) => p.trim()).filter(Boolean);
}

/**
 * A where written as text, for pipelines (which have no record literals):
 *   "status == 'paid' && total > 100 && tags contains urgent"
 * or a JSON object.
 */
export function parseWhere(call: ToolCall, text: string): Record<string, Record<string, unknown>> | Record<string, unknown> {
  const t = text.trim();
  if (t.startsWith("{")) {
    try {
      const v = JSON.parse(t);
      if (v && typeof v === "object" && !Array.isArray(v)) return v;
    } catch {}
    throw argError(call, "where is not a valid JSON object");
  }
  const out: Record<string, Record<string, unknown>> = {};
  for (const clause of splitAnd(t)) {
    const m =
      clause.match(/^([\w.]+)\s*(==|!=|>=|<=|=|>|<)\s*(.+)$/s) ??
      clause.match(new RegExp(`^([\\w.]+)\\s+(${WORD_OPS.join("|")})(?:\\s+(.+))?$`, "s"));
    if (!m) throw argError(call, `can't read the condition "${clause}" (write it like: total > 100 && status == 'paid')`);
    const [, path, op, value] = m;
    (out[path!] ??= {})[op!] = value === undefined ? true : literal(value);
  }
  return out;
}

function whereOf(call: ToolCall, value: unknown): Record<string, unknown> {
  if (typeof value === "string") return parseWhere(call, value);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw argError(call, "needs where: a record of path → value or path → { op: value }, or text like \"total > 100 && status == 'paid'\"");
  return value as Record<string, unknown>;
}

export function matches(call: ToolCall, item: unknown, where: Record<string, unknown>): boolean {
  for (const [path, cond] of Object.entries(where)) {
    const actual = getPath(item, path);
    if (cond !== null && typeof cond === "object" && !Array.isArray(cond)) {
      for (const [op, expected] of Object.entries(cond)) if (!test(call, actual, op, expected)) return false;
    } else if (!equal(actual, cond)) return false;
  }
  return true;
}

function groupBy(items: unknown[], by: string): Map<string, unknown[]> {
  const groups = new Map<string, unknown[]>();
  for (const item of items) {
    const k = key(getPath(item, by) ?? null);
    const g = groups.get(k);
    if (g) g.push(item);
    else groups.set(k, [item]);
  }
  return groups;
}

function aggregate(call: ToolCall, items: unknown[], field: string | undefined, op: string): unknown {
  if (op === "count") return items.length;
  if (!field) throw argError(call, `op "${op}" needs field`);
  const values = items.map((x) => getPath(x, field)).filter((v) => v !== undefined && v !== null);
  if (op === "list") return values;
  if (op === "first") return values[0] ?? null;
  if (op === "last") return values.at(-1) ?? null;
  if (op === "min" || op === "max") {
    if (!values.length) return null;
    return values.reduce((a, b) => ((op === "min" ? compare(b, a) < 0 : compare(b, a) > 0) ? b : a));
  }
  const nums = values.map(Number).filter(Number.isFinite);
  const sum = nums.reduce((a, b) => a + b, 0);
  if (op === "sum") return Number(sum.toPrecision(15));
  if (op === "avg" || op === "mean") return nums.length ? Number((sum / nums.length).toPrecision(15)) : null;
  throw argError(call, `unknown op "${op}" (use count, sum, avg, min, max, first, last, list)`);
}

interface Change {
  path: string;
  type: "added" | "removed" | "changed";
  before?: unknown;
  after?: unknown;
}

/** Structural differences between two JSON values. Lists of records diff by `key` when given. */
export function diffValues(before: unknown, after: unknown, keyField?: string, path = "", out: Change[] = [], limit = 500): Change[] {
  if (out.length >= limit) return out;
  const isObj = (v: unknown) => v !== null && typeof v === "object" && !Array.isArray(v);
  const at = (k: string | number) => (path ? `${path}.${k}` : String(k));
  if (Array.isArray(before) && Array.isArray(after) && keyField) {
    const index = (l: unknown[]) => new Map(l.map((x) => [key(getPath(x, keyField)), x] as [string, unknown]));
    const a = index(before);
    const b = index(after);
    for (const [k, v] of a) if (!b.has(k)) out.push({ path: at(k), type: "removed", before: v });
    for (const [k, v] of b) {
      if (!a.has(k)) out.push({ path: at(k), type: "added", after: v });
      else diffValues(a.get(k), v, undefined, at(k), out, limit);
    }
    return out;
  }
  if (Array.isArray(before) && Array.isArray(after)) {
    const n = Math.max(before.length, after.length);
    for (let i = 0; i < n && out.length < limit; i++) {
      if (i >= before.length) out.push({ path: at(i), type: "added", after: after[i] });
      else if (i >= after.length) out.push({ path: at(i), type: "removed", before: before[i] });
      else diffValues(before[i], after[i], undefined, at(i), out, limit);
    }
    return out;
  }
  if (isObj(before) && isObj(after)) {
    const a = before as Record<string, unknown>;
    const b = after as Record<string, unknown>;
    for (const k of Object.keys(a)) if (!Object.hasOwn(b, k)) out.push({ path: at(k), type: "removed", before: a[k] });
    for (const k of Object.keys(b)) {
      if (!Object.hasOwn(a, k)) out.push({ path: at(k), type: "added", after: b[k] });
      else diffValues(a[k], b[k], undefined, at(k), out, limit);
    }
    return out;
  }
  if (JSON.stringify(before) !== JSON.stringify(after)) out.push({ path: path || ".", type: "changed", before, after });
  return out;
}

function csvCell(v: unknown, delimiter: string): string {
  const s = v === undefined || v === null ? "" : typeof v === "string" ? v : JSON.stringify(v);
  return /["\r\n]/.test(s) || s.includes(delimiter) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const data: ToolProvider = async (call) => {
  const n = call.named;
  switch (call.method) {
    case "get": {
      if (typeof n.path !== "string") throw argError(call, "needs path (like \"items.0.title\")");
      return getPath(input(call), n.path) ?? null;
    }
    case "pick": {
      const fields = stringList(call, n.fields, "fields (a list of paths)");
      const one = (x: unknown) => {
        const o: Record<string, unknown> = {};
        for (const f of fields) {
          const v = getPath(x, f);
          if (v !== undefined) setPath(o, f, v);
        }
        return o;
      };
      const v = input(call);
      return Array.isArray(v) ? v.map(one) : one(v);
    }
    case "filter":
    case "where": {
      const where = whereOf(call, n.where);
      return list(call, input(call)).filter((x) => matches(call, x, where));
    }
    case "find": {
      const where = whereOf(call, n.where);
      return list(call, input(call)).find((x) => matches(call, x, where)) ?? null;
    }
    case "sort": {
      const by = n.by === undefined ? [] : stringList(call, n.by, "by");
      const desc = n.desc === true || n.order === "desc";
      const sorted = [...list(call, input(call))].sort((a, b) => {
        for (const f of by.length ? by : [""]) {
          const c = compare(getPath(a, f), getPath(b, f));
          if (c) return desc ? -c : c;
        }
        return 0;
      });
      return sorted;
    }
    case "limit": {
      const items = list(call, input(call));
      const offset = intArg(call, "offset", n.offset, 0, 0, Number.MAX_SAFE_INTEGER);
      return items.slice(offset, offset + intArg(call, "n", n.n ?? n.limit, 10, 0, Number.MAX_SAFE_INTEGER));
    }
    case "group": {
      if (typeof n.by !== "string") throw argError(call, "needs by (a path)");
      return Object.fromEntries(groupBy(list(call, input(call)), n.by));
    }
    case "count": {
      const items = list(call, input(call));
      if (n.by === undefined) return items.length;
      if (typeof n.by !== "string") throw argError(call, "by must be a path");
      return Object.fromEntries([...groupBy(items, n.by)].map(([k, g]) => [k, g.length]).sort((a, b) => (b[1] as number) - (a[1] as number)));
    }
    case "aggregate": {
      const op = String(n.op ?? "sum");
      const field = n.field === undefined ? undefined : String(n.field);
      const items = list(call, input(call));
      if (n.by === undefined) return aggregate(call, items, field, op);
      return Object.fromEntries([...groupBy(items, String(n.by))].map(([k, g]) => [k, aggregate(call, g, field, op)]));
    }
    case "unique": {
      const seen = new Set<string>();
      const by = n.by === undefined ? undefined : String(n.by);
      return list(call, input(call)).filter((x) => {
        const k = key(by ? getPath(x, by) : x);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    }
    case "flatten": {
      const depth = intArg(call, "depth", n.depth, 1, 1, 100);
      return list(call, input(call)).flat(depth);
    }
    case "join": {
      const left = list(call, n.left ?? input(call), "left");
      const right = list(call, n.right, "right");
      const on = n.on;
      const [lk, rk] = Array.isArray(on) ? [String(on[0]), String(on[1] ?? on[0])] : typeof on === "string" ? [on, on] : [undefined, undefined];
      if (!lk || !rk) throw argError(call, "needs on (a path in both lists, or [left_path, right_path])");
      const index = new Map<string, unknown>();
      for (const r of right) index.set(key(getPath(r, rk)), r);
      const inner = n.type === "inner";
      const out: unknown[] = [];
      for (const l of left) {
        const r = index.get(key(getPath(l, lk)));
        if (r === undefined && inner) continue;
        const base = l !== null && typeof l === "object" && !Array.isArray(l) ? l : { value: l };
        const extra = r !== null && typeof r === "object" && !Array.isArray(r) ? r : r === undefined ? {} : { joined: r };
        out.push({ ...extra, ...base });
      }
      return out;
    }
    case "diff": {
      if (!("before" in n) || !("after" in n)) throw argError(call, "needs before and after");
      const changes = diffValues(n.before, n.after, n.key === undefined ? undefined : String(n.key));
      return { changed: changes.length > 0, count: changes.length, changes };
    }
    case "from_csv": {
      const text = n.text ?? explicitFirst(call) ?? (call.implicitInput ? call.positional[0] : undefined);
      if (typeof text !== "string") throw argError(call, "needs text (CSV)");
      if (text.length > MAX_CSV_CHARS) throw argError(call, "text is too long");
      const delimiter = typeof n.delimiter === "string" && n.delimiter.length === 1 ? n.delimiter : text.split("\n", 1)[0]!.includes("\t") && !text.split("\n", 1)[0]!.includes(",") ? "\t" : ",";
      return rowsToRecords(parseDelimited(text, delimiter));
    }
    case "to_csv": {
      const items = list(call, input(call));
      const delimiter = typeof n.delimiter === "string" && n.delimiter.length === 1 ? n.delimiter : ",";
      const fields = n.fields === undefined ? [...new Set(items.flatMap((x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.keys(x) : [])))] : stringList(call, n.fields, "fields");
      const lines = [fields.map((f) => csvCell(f, delimiter)).join(delimiter)];
      for (const x of items) lines.push(fields.map((f) => csvCell(getPath(x, f), delimiter)).join(delimiter));
      return `${lines.join("\n")}\n`;
    }
    default:
      return unknownMethod(call, METHODS);
  }
};
