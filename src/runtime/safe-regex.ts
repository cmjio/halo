/**
 * Regular expressions that can't stall a run.
 *
 * JavaScript's own engine backtracks: a pattern like ^(a+)+$ can take seconds or minutes on one
 * line, and Bun's engine then gives up and says "no match". For a policy that refuses on a match,
 * "no match" lets the call through. So every regex a policy, a tool rule or a model writes runs
 * here instead:
 *
 * - Most patterns run on RE2 (the re2js package), which takes time linear in the text and can't
 *   backtrack. Halo keeps JavaScript's meaning for `.` and `\s`, and leading lookaheads like
 *   ^(?!rm )... are split into separate RE2 checks.
 * - A pattern RE2 can't express (a backreference like (a)\1, a lookahead that isn't at the start)
 *   runs on JavaScript's engine on a worker thread, with a time limit (FALLBACK_MS). The main
 *   thread waits for it at most that long. Where a worker can't be waited on (a browser's main
 *   thread), the check can't be decided.
 *
 * test() returns true, false, or undefined when the check could not be decided (time limit,
 * engine limit, error). Callers fail closed on undefined: a deny rule refuses, a must-match rule
 * reports a violation, a filter errors.
 *
 * This file is bundled into the site's playground: it must not import node:* modules.
 */

import { RE2JS } from "re2js";

/** How long a pattern RE2 can't run may take on the worker before the check is refused (ms). */
export const FALLBACK_MS = 250;

export interface RegexOptions {
  /** Case-insensitive (the `i` flag). */
  ignoreCase?: boolean;
  /** `.` also matches line breaks (the `s` flag). */
  dotAll?: boolean;
  /** The pattern must cover the whole text, as if written ^(?:...)$. Otherwise it may match anywhere. */
  whole?: boolean;
}

export interface SafeRegex {
  readonly source: string;
  /** "re2" runs in linear time; "bounded" runs on JavaScript's engine under a time limit. */
  readonly engine: "re2" | "bounded";
  /** Whether the pattern matches `text`; undefined when that could not be decided. */
  test(text: string): boolean | undefined;
  /** Whether the pattern matches any of `texts`; undefined when that could not be decided. */
  testAny(texts: string[]): boolean | undefined;
}

/** A pattern that is not a regular expression at all. */
export class RegexSyntaxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RegexSyntaxError";
  }
}

const CACHE_MAX = 1000;
const cache = new Map<string, SafeRegex>();

/** Compile once per (source, options) and reuse. Throws RegexSyntaxError for a pattern that isn't valid. */
export function safeRegex(source: string, opts: RegexOptions = {}): SafeRegex {
  const key = `${opts.ignoreCase ? "i" : ""}${opts.dotAll ? "s" : ""}${opts.whole ? "w" : ""}\0${source}`;
  const known = cache.get(key);
  if (known) return known;
  const compiled = compile(source, opts);
  if (cache.size >= CACHE_MAX) cache.clear();
  cache.set(key, compiled);
  return compiled;
}

/** What validate needs to know: is it valid, and which engine runs it. */
export function regexProblem(source: string, opts: RegexOptions = {}): { error: string } | { engine: SafeRegex["engine"] } {
  try {
    return { engine: safeRegex(source, opts).engine };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

/**
 * True when a pattern has the shape that makes a backtracking engine take exponential time: a
 * repeated group whose body itself repeats or alternates, like (a+)+, (\w+\s?)*, (a|ab)+. A
 * heuristic for validate's warnings; RE2 runs these safely, so it only matters for "bounded" ones.
 */
export function canBacktrackBadly(source: string): boolean {
  const stack: Array<{ inner: boolean }> = [];
  let inClass = false;
  for (let i = 0; i < source.length; i++) {
    const c = source[i]!;
    if (c === "\\") {
      i++;
      continue;
    }
    if (inClass) {
      if (c === "]") inClass = false;
      continue;
    }
    if (c === "[") inClass = true;
    else if (c === "(") stack.push({ inner: false });
    else if (c === "|" && stack.length) stack.at(-1)!.inner = true;
    else if (c === ")") {
      const group = stack.pop();
      const next = source[i + 1];
      const repeated = next === "*" || next === "+" || (next === "{" && /^\{\d*,\d*\}/.test(source.slice(i + 1)));
      if (group?.inner && repeated) return true;
      if (stack.length && (group?.inner || repeated)) stack.at(-1)!.inner = true;
    } else if ((c === "*" || c === "+" || c === "{") && stack.length) stack.at(-1)!.inner = true;
  }
  return false;
}

function compile(source: string, opts: RegexOptions): SafeRegex {
  const plan = re2Plan(source, opts);
  if (plan) return plan;
  const flags = `${opts.ignoreCase ? "i" : ""}${opts.dotAll ? "s" : ""}`;
  const native = opts.whole ? `^(?:${source})$` : source;
  try {
    new RegExp(native, flags);
  } catch (e) {
    throw new RegexSyntaxError((e as Error).message);
  }
  return bounded(source, native, flags);
}

// ---------------------------------------------------------------------------
// RE2

/** The same pattern as RE2 checks: leading lookaheads, each tested at the start, and the rest. */
function re2Plan(source: string, opts: RegexOptions): SafeRegex | undefined {
  if (/\\k</.test(source)) return undefined; // a named backreference; translateRegExp would make it literal text
  let flags = RE2JS.LOOKBEHINDS;
  if (opts.ignoreCase) flags |= RE2JS.CASE_INSENSITIVE;
  if (opts.dotAll) flags |= RE2JS.DOTALL;
  const re2 = (pattern: string) => {
    try {
      return RE2JS.compile(jsMeaning(RE2JS.translateRegExp(pattern), !!opts.dotAll), flags);
    } catch {
      return undefined;
    }
  };
  const split = leadingLookaheads(source, !!opts.whole);
  const parts = split ?? { looks: [], rest: source };
  const body = re2(opts.whole ? `^(?:${parts.rest})$` : split ? `^(?:${parts.rest})` : parts.rest);
  if (!body) return undefined;
  const looks: Array<{ negative: boolean; re: RE2JS }> = [];
  for (const l of parts.looks) {
    const re = re2(`^(?:${l.inner})`);
    if (!re) return undefined;
    looks.push({ negative: l.negative, re });
  }
  const test = (text: string): boolean | undefined => {
    try {
      for (const l of looks) if (l.re.test(text) === l.negative) return false;
      return body.test(text);
    } catch {
      return undefined;
    }
  };
  return {
    source,
    engine: "re2",
    test,
    testAny(texts) {
      let undecided = false;
      for (const t of texts) {
        const r = test(t);
        if (r) return true;
        if (r === undefined) undecided = true;
      }
      return undecided ? undefined : false;
    },
  };
}

/** Index of the ")" that closes the group opened at `open`, or -1. */
function groupEnd(source: string, open: number): number {
  let depth = 0;
  let inClass = false;
  for (let i = open; i < source.length; i++) {
    const c = source[i]!;
    if (c === "\\") i++;
    else if (inClass) inClass = c !== "]";
    else if (c === "[") inClass = true;
    else if (c === "(") depth++;
    else if (c === ")" && --depth === 0) return i;
  }
  return -1;
}

function hasTopLevelAlternation(source: string): boolean {
  let depth = 0;
  let inClass = false;
  for (let i = 0; i < source.length; i++) {
    const c = source[i]!;
    if (c === "\\") i++;
    else if (inClass) inClass = c !== "]";
    else if (c === "[") inClass = true;
    else if (c === "(") depth++;
    else if (c === ")") depth--;
    else if (c === "|" && depth === 0) return true;
  }
  return false;
}

/**
 * `^(?!A)(?=B)rest` as its parts. A lookahead right after the start anchor looks at the text
 * from position 0, so it is its own anchored check. Only when nothing else could make it mean
 * something different: no top-level `|` (which would leave the lookahead on one branch) and no
 * quantifier on the lookahead.
 */
function leadingLookaheads(source: string, whole: boolean): { looks: Array<{ negative: boolean; inner: string }>; rest: string } | undefined {
  let i = 0;
  if (source.startsWith("^")) i = 1;
  else if (!whole) return undefined;
  if (!source.startsWith("(?=", i) && !source.startsWith("(?!", i)) return undefined;
  if (hasTopLevelAlternation(source)) return undefined;
  const looks: Array<{ negative: boolean; inner: string }> = [];
  while (source.startsWith("(?=", i) || source.startsWith("(?!", i)) {
    const end = groupEnd(source, i);
    if (end < 0 || /^[*+?{]/.test(source.slice(end + 1))) return undefined;
    looks.push({ negative: source[i + 2] === "!", inner: source.slice(i + 3, end) });
    i = end + 1;
  }
  return { looks, rest: source.slice(i) };
}

/** JavaScript's whitespace, for \s. RE2's \s is only [\t\n\f\r ]. */
const JS_SPACE = String.raw`\t\n\x{0B}\f\r \x{A0}\x{1680}\x{2000}-\x{200A}\x{2028}\x{2029}\x{202F}\x{205F}\x{3000}\x{FEFF}`;

/** Keep JavaScript's meaning for `.` (not a line break of any kind) and `\s` in RE2 syntax. */
function jsMeaning(pattern: string, dotAll: boolean): string {
  let out = "";
  let inClass = false;
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i]!;
    if (c === "\\") {
      const n = pattern[i + 1] ?? "";
      i++;
      if (n === "s") out += inClass ? JS_SPACE : `[${JS_SPACE}]`;
      else if (n === "S" && !inClass) out += `[^${JS_SPACE}]`;
      else out += c + n;
      continue;
    }
    if (inClass) inClass = c !== "]";
    else if (c === "[") inClass = true;
    else if (c === "." && !dotAll) {
      out += String.raw`[^\n\r\x{2028}\x{2029}]`;
      continue;
    }
    out += c;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Bounded: JavaScript's engine on a worker, under a time limit

const WORKER = `self.onmessage = (e) => {
  const { signal, source, flags, texts } = e.data;
  const cell = new Int32Array(signal);
  let result = 3;
  try { const re = new RegExp(source, flags); result = texts.some((t) => re.test(t)) ? 1 : 2; } catch {}
  Atomics.store(cell, 1, result);
  Atomics.store(cell, 0, 1);
  Atomics.notify(cell, 0);
};`;

let workerUrl: string | undefined;
let worker: Worker | undefined;
/** When workers were given up on: each may still be running its regex until the engine stops it. */
let abandoned: number[] = [];
const MAX_ABANDONED = 2;
const ABANDON_WINDOW_MS = 10_000;

function bounded(source: string, native: string, flags: string): SafeRegex {
  const testAny = (texts: string[]): boolean | undefined => runBounded(native, flags, texts);
  return { source, engine: "bounded", test: (text) => testAny([text]), testAny };
}

function runBounded(source: string, flags: string, texts: string[]): boolean | undefined {
  if (!texts.length) return false;
  try {
    const now = Date.now();
    abandoned = abandoned.filter((t) => now - t < ABANDON_WINDOW_MS);
    // Workers still stuck on earlier patterns use a CPU each; don't start more.
    if (abandoned.length >= MAX_ABANDONED) return undefined;
    workerUrl ??= URL.createObjectURL(new Blob([WORKER], { type: "application/javascript" }));
    if (!worker) {
      worker = new Worker(workerUrl);
      (worker as { unref?: () => void }).unref?.();
    }
    const cell = new Int32Array(new SharedArrayBuffer(8));
    worker.postMessage({ signal: cell.buffer, source, flags, texts });
    // Throws on a browser's main thread, where waiting isn't allowed: the check is undecided.
    if (Atomics.wait(cell, 0, 0, FALLBACK_MS) === "timed-out") {
      worker.terminate();
      worker = undefined;
      abandoned.push(Date.now());
      return undefined;
    }
    const result = Atomics.load(cell, 1);
    return result === 1 ? true : result === 2 ? false : undefined;
  } catch {
    return undefined;
  }
}
