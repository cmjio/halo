/** Helpers for walking, formatting, and parsing runtime values. */

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/** Walk `path` into `root`, returning undefined when any segment is missing. */
export function getPath(root: unknown, path: string[]): unknown {
  let cur = root;
  for (const part of path) {
    if (cur === null || cur === undefined) return undefined;
    if (Array.isArray(cur) && /^\d+$/.test(part)) cur = cur[Number(part)];
    else if (typeof cur === "object") cur = (cur as Record<string, unknown>)[part];
    else return undefined;
  }
  return cur;
}

/** Like getPath, but a non-numeric part applied to a list maps over its items (`labels.name`). */
function pluck(root: unknown, path: string[]): unknown {
  let cur = root;
  for (const [i, part] of path.entries()) {
    if (cur === null || cur === undefined) return undefined;
    if (Array.isArray(cur) && !/^\d+$/.test(part)) return cur.map((item) => pluck(item, path.slice(i)));
    cur = getPath(cur, [part]);
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
    const v = pluck(value, f.split("."));
    if (v !== undefined) out[f] = clip(v);
  }
  return out;
}

/** Render a value for inclusion in a prompt or log line. */
export function formatValue(v: unknown): string {
  if (v === undefined) return "";
  if (typeof v === "string") return v;
  return JSON.stringify(v, null, 2) ?? String(v);
}

/** Replace `{{path}}` placeholders. Unresolved placeholders are left as written. */
export function interpolate(template: string, resolve: (path: string[]) => unknown, format: (v: unknown) => string = formatValue): { text: string; used: boolean } {
  let used = false;
  const text = template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, expr: string) => {
    used = true;
    const value = resolve(expr.split("."));
    return value === undefined ? match : format(value);
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
  if (typeof a === "boolean" || typeof b === "boolean") return String(a) === String(b);
  const na = Number(a);
  const nb = Number(b);
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
