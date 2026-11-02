import { HaloError } from "./errors.js";
/** Helpers for walking, formatting, and parsing runtime values. */

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/** Names that would reach or replace an object's prototype. Never used as data keys. */
const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export function isSafeKey(key: string): boolean {
  return !UNSAFE_KEYS.has(key);
}

/** Own (not inherited) property check, safe for any object. */
export function hasOwnKey(obj: unknown, key: string): boolean {
  return obj !== null && typeof obj === "object" && isSafeKey(key) && Object.hasOwn(obj, key);
}

/**
 * Walk `path` into `root`, returning undefined when any segment is missing.
 * On a list, a number picks an item (`items.0`), `length` counts them, and
 * any other name maps over the items (`issues.title` → every title).
 * A string's `length` is its length.
 */
export function getPath(root: unknown, path: string[]): unknown {
  let cur = root;
  for (const [i, part] of path.entries()) {
    if (cur === null || cur === undefined) return undefined;
    if (Array.isArray(cur)) {
      if (/^\d+$/.test(part)) cur = cur[Number(part)];
      else if (part === "length") cur = cur.length;
      else return cur.map((item) => getPath(item, path.slice(i)));
    } else if (typeof cur === "string") {
      return part === "length" && i === path.length - 1 ? cur.length : undefined;
    } else if (typeof cur === "object") cur = hasOwnKey(cur, part) ? (cur as Record<string, unknown>)[part] : undefined;
    else return undefined;
  }
  return cur;
}

/**
 * Keep only `fields` (dotted paths) of an object, or of each item of a list.
 * Strings longer than `maxChars` are cut, so large API payloads stay prompt-sized.
 */
export function pick(value: unknown, fields: string[], maxChars = Infinity): unknown {
  if (Array.isArray(value)) return value.map((v) => pick(v, fields, maxChars));
  if (value === null || typeof value !== "object") return value;
  const clip = (v: unknown): unknown =>
    typeof v === "string" ? (v.length > maxChars ? `${v.slice(0, maxChars)}…` : v) : Array.isArray(v) ? v.map(clip) : v;
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const v = getPath(value, f.split("."));
    if (v !== undefined && isSafeKey(f)) out[f] = clip(v);
  }
  return out;
}

/** Render a value for inclusion in a prompt or log line. */
export function formatValue(v: unknown): string {
  if (v === undefined) return "";
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v, null, 2) ?? String(v);
  } catch (err) {
    if (err instanceof RangeError) throw new HaloError("A value is nested too deeply to use (thousands of levels of lists or objects)", { code: "VALUE_TOO_DEEP" });
    // A value that contains itself: show the repeat instead of failing.
    const seen = new WeakSet<object>();
    return JSON.stringify(v, (_k, x: unknown) => (x && typeof x === "object" ? (seen.has(x) ? "[Circular]" : (seen.add(x), x)) : x), 2) ?? "";
  }
}

/**
 * A value as text, or as a number, without trusting the value's own methods: JSON with a
 * "toString" or "valueOf" key (from a model or a request) makes String() and Number() throw.
 */
export function asText(v: unknown): string {
  return v !== null && typeof v === "object" ? formatValue(v) : String(v);
}

export function asNumber(v: unknown): number {
  return v !== null && typeof v === "object" ? NaN : Number(v);
}

/** Replace `{{path}}` placeholders. Unresolved placeholders are left as written. */
export function interpolate(template: string, resolve: (path: string[]) => unknown, format: (v: unknown, offset: number) => string = formatValue): { text: string; used: boolean } {
  let used = false;
  const text = template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, expr: string, offset: number) => {
    used = true;
    const value = resolve(expr.split("."));
    return value === undefined ? match : format(value, offset);
  });
  return { text, used };
}

/** Parse an LLM response that is entirely JSON (optionally in a ```json fence); otherwise return the text. */
export function parseOutput(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/);
  const body = fenced ? fenced[1]!.trim() : trimmed;
  if (/^[[{]/.test(body)) {
    try {
      return JSON.parse(body);
    } catch {}
  }
  return text;
}

/** "analyze_trends" / "searchNews" → "analyze trends" / "search news" */
export function humanize(method: string): string {
  return method.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").toLowerCase();
}

/** Loose equality used by gates: numbers compare numerically, everything else as strings. */
export function looseEquals(a: unknown, b: unknown): boolean {
  if (a === null || a === undefined || b === null || b === undefined) return (a ?? null) === (b ?? null);
  if (typeof a === "boolean" || typeof b === "boolean") return asText(a) === asText(b);
  const na = asNumber(a);
  const nb = asNumber(b);
  if (typeof a !== "object" && typeof b !== "object" && a !== "" && b !== "" && !Number.isNaN(na) && !Number.isNaN(nb)) return na === nb;
  return formatValue(a) === formatValue(b);
}

export function truthy(v: unknown): boolean {
  if (typeof v === "string") return v !== "" && v.toLowerCase() !== "false";
  if (Array.isArray(v)) return v.length > 0;
  return Boolean(v);
}

export const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => (clearTimeout(t), reject(signal.reason)), { once: true });
  });

/** The response used when a yield/listen is approved without an explicit answer. */
export const APPROVED = { action: "approve", approved: true, status: "approved", reaction: "approve" };

/**
 * Turn a human's typed answer into an event gates can inspect: JSON is used as
 * is; a word like "approve" or "label" becomes `{ action, approved, ... }`.
 */
export function answerToEvent(answer: string): unknown {
  let parsed: unknown = answer;
  try {
    parsed = JSON.parse(answer);
  } catch {}
  if (typeof parsed !== "string") return parsed;
  const word = parsed.trim();
  return { action: word, status: word, reaction: word, text: word, approved: /^(?:approved?|yes|y|ok|lgtm|merged)$/i.test(word) };
}
