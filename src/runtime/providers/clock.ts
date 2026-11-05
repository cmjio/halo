/**
 * Clock: dates and times, so an agent doesn't have to guess what day it is or count on its fingers.
 *
 *   tool Time : Clock(timezone: "Europe/London")
 *     now(timezone?)   add(date?, duration? | days? hours? ...)   diff(from, to?)   format(date, timezone?, style?)   parse(text)
 *
 * Dates go in as ISO 8601 strings (or anything Date.parse reads, or unix milliseconds)
 * and come out as records with `iso` (UTC) and `local` (in the timezone). `now:` on the
 * declaration pins the current time, for tests and replays.
 */

import { HaloError } from "../errors.js";
import type { ToolCall, ToolProvider } from "../tools.js";
import { explicitFirst, str, unknownMethod } from "./common.js";

const METHODS = ["now", "add", "diff", "format", "parse"];
const UNIT_MS: Record<string, number> = { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 };
const STYLES = ["full", "long", "medium", "short"] as const;

function argError(call: ToolCall, message: string): HaloError {
  return new HaloError(`${call.tool.name}.${call.method}: ${message}`, { code: "TOOL_ARGUMENT" });
}

function now(call: ToolCall): Date {
  const pinned = call.config("now");
  return pinned === undefined || pinned === null ? new Date() : toDate(call, pinned, "now");
}

function toDate(call: ToolCall, value: unknown, name: string): Date {
  const d = typeof value === "number" ? new Date(value) : value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) throw argError(call, `${name} is not a date: ${str(value)}`);
  return d;
}

function timezone(call: ToolCall, given: unknown): string {
  const tz = String(given ?? call.config("timezone") ?? "UTC");
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
  } catch {
    throw argError(call, `unknown timezone "${tz}" (use an IANA name like "America/New_York")`);
  }
  return tz;
}

/** The wall-clock parts of `d` in `tz`. */
function parts(d: Date, tz: string): Record<string, string> {
  const out: Record<string, string> = {};
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", weekday: "long" });
  for (const p of fmt.formatToParts(d)) out[p.type] = p.value;
  return out;
}

/** UTC offset of `tz` at `d`, like "+01:00". */
function offset(d: Date, tz: string): string {
  const p = parts(d, tz);
  const wall = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
  const mins = Math.round((wall - Math.floor(d.getTime() / 1000) * 1000) / 60_000);
  const sign = mins < 0 ? "-" : "+";
  const a = Math.abs(mins);
  return `${sign}${String(Math.floor(a / 60)).padStart(2, "0")}:${String(a % 60).padStart(2, "0")}`;
}

export function describe(d: Date, tz: string) {
  const p = parts(d, tz);
  return {
    iso: d.toISOString(),
    unix: Math.floor(d.getTime() / 1000),
    timezone: tz,
    local: `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${offset(d, tz)}`,
    date: `${p.year}-${p.month}-${p.day}`,
    time: `${p.hour}:${p.minute}`,
    weekday: p.weekday,
  };
}

/** "90m", "-2d", "1h30m", "2w" → milliseconds. */
export function parseSpan(text: string): number {
  const t = text.replace(/\s+/g, "");
  const m = t.match(/^([+-]?)((?:\d+(?:\.\d+)?(?:ms|s|m|h|d|w))+)$/);
  if (!m) return NaN;
  let total = 0;
  for (const [, n, unit] of m[2]!.matchAll(/(\d+(?:\.\d+)?)(ms|s|m|h|d|w)/g)) total += Number(n) * UNIT_MS[unit!]!;
  return m[1] === "-" ? -total : total;
}

function human(ms: number): string {
  const a = Math.abs(ms);
  const units: [string, number][] = [["day", 86_400_000], ["hour", 3_600_000], ["minute", 60_000], ["second", 1000]];
  const out: string[] = [];
  let rest = a;
  for (const [name, size] of units) {
    const n = Math.floor(rest / size);
    if (n > 0 && out.length < 2) out.push(`${n} ${name}${n === 1 ? "" : "s"}`);
    if (n > 0) rest -= n * size;
  }
  const s = out.join(" ") || "0 seconds";
  return ms < 0 ? `-${s}` : s;
}

export const clock: ToolProvider = async (call) => {
  const n = call.named;
  switch (call.method) {
    case "now":
      return describe(now(call), timezone(call, n.timezone));
    case "add": {
      const tz = timezone(call, n.timezone);
      const base = n.date ?? explicitFirst(call);
      const d = new Date((base === undefined ? now(call) : toDate(call, base, "date")).getTime());
      let changed = false;
      if (n.duration !== undefined) {
        const ms = typeof n.duration === "number" ? n.duration * 1000 : parseSpan(String(n.duration));
        if (!Number.isFinite(ms)) throw argError(call, `duration must be like "90m", "-2d", "1h30m" or "2w", got ${str(n.duration)}`);
        d.setTime(d.getTime() + ms);
        changed = true;
      }
      const num = (k: string) => {
        const v = n[k];
        if (v === undefined) return 0;
        const x = Number(v);
        if (!Number.isFinite(x)) throw argError(call, `${k} must be a number, got ${str(v)}`);
        changed = true;
        return x;
      };
      const years = num("years");
      const months = num("months");
      if (years || months) d.setUTCMonth(d.getUTCMonth() + Math.trunc(months) + Math.trunc(years) * 12);
      d.setTime(d.getTime() + num("weeks") * UNIT_MS.w! + num("days") * UNIT_MS.d! + num("hours") * UNIT_MS.h! + num("minutes") * UNIT_MS.m! + num("seconds") * 1000);
      if (!changed) throw argError(call, "needs duration: (like \"3d\") or days:, hours:, minutes:, weeks:, months:, years:");
      return describe(d, tz);
    }
    case "diff": {
      if (n.from === undefined) throw argError(call, "needs from (a date)");
      const from = toDate(call, n.from, "from");
      const to = n.to === undefined ? now(call) : toDate(call, n.to, "to");
      const ms = to.getTime() - from.getTime();
      return { ms, seconds: Math.round(ms / 1000), minutes: Math.round(ms / 60_000), hours: +(ms / 3_600_000).toFixed(2), days: +(ms / 86_400_000).toFixed(2), human: human(ms) };
    }
    case "format": {
      const value = n.date ?? explicitFirst(call);
      const d = value === undefined ? now(call) : toDate(call, value, "date");
      const tz = timezone(call, n.timezone);
      const style = String(n.style ?? "long");
      if (!(STYLES as readonly string[]).includes(style)) throw argError(call, `style must be one of ${STYLES.join(", ")}`);
      const locale = String(n.locale ?? call.config("locale") ?? "en-US");
      let text: string;
      try {
        text = new Intl.DateTimeFormat(locale, { timeZone: tz, dateStyle: style as (typeof STYLES)[number], timeStyle: style === "full" ? "long" : (style as (typeof STYLES)[number]) }).format(d);
      } catch {
        throw argError(call, `unknown locale "${locale}"`);
      }
      return { ...describe(d, tz), text };
    }
    case "parse": {
      const value = n.text ?? n.date ?? explicitFirst(call);
      if (value === undefined) throw argError(call, "needs text (a date to read)");
      return describe(toDate(call, value, "text"), timezone(call, n.timezone));
    }
    default:
      return unknownMethod(call, METHODS);
  }
};
