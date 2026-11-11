/**
 * Cron schedules for `halo serve`: standard 5-field expressions
 * (minute hour day-of-month month day-of-week), in a time zone (default: the server's).
 *
 *   "0 9 * * 1-5"     9:00 on weekdays
 *   "*\/15 * * * *"   every 15 minutes
 *   "30 8 1 * *"      8:30 on the 1st of each month
 *
 * Fields accept `*`, numbers, ranges (`1-5`), lists (`1,15`), steps (`*\/10`,
 * `0-30/5`), and names for months (`jan`) and weekdays (`mon`; 0 and 7 are Sunday).
 * As in standard cron, when both day-of-month and day-of-week are restricted,
 * a day matches if either does.
 */

const FIELDS = [
  { name: "minute", min: 0, max: 59 },
  { name: "hour", min: 0, max: 23 },
  { name: "day of month", min: 1, max: 31 },
  { name: "month", min: 1, max: 12, names: ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"] },
  { name: "day of week", min: 0, max: 7, names: ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] },
] as const;

export interface CronSchedule {
  source: string;
  minutes: Set<number>;
  hours: Set<number>;
  days: Set<number>;
  months: Set<number>;
  weekdays: Set<number>;
  /** Whether day-of-month / day-of-week were restricted (not `*`). */
  dayRestricted: boolean;
  weekdayRestricted: boolean;
  /** The minute or hour field starts with `*`: the job follows real time across clock changes. */
  wildcardTime: boolean;
}

export class CronError extends Error {}

function parseField(text: string, field: (typeof FIELDS)[number]): Set<number> {
  const values = new Set<number>();
  const names: readonly string[] = "names" in field ? field.names : [];
  const num = (s: string): number => {
    const named = names.indexOf(s.toLowerCase());
    if (named >= 0) return named + (field.name === "month" ? 1 : 0);
    if (!/^\d+$/.test(s)) throw new CronError(`"${s}" is not a valid ${field.name}`);
    const n = Number(s);
    if (n < field.min || n > field.max) throw new CronError(`${field.name} ${n} is out of range ${field.min}-${field.max}`);
    return n;
  };
  for (const part of text.split(",")) {
    const [range, stepText] = part.split("/") as [string, string | undefined];
    const step = stepText === undefined ? 1 : Number(stepText);
    if (!Number.isInteger(step) || step < 1) throw new CronError(`"${part}" has an invalid step`);
    let [lo, hi]: [number, number] = [field.min, field.max];
    if (range !== "*") {
      const [a, b] = range.split("-") as [string, string | undefined];
      lo = num(a);
      hi = b === undefined ? (stepText === undefined ? lo : field.max) : num(b);
      if (hi < lo) throw new CronError(`"${range}" is an empty range`);
    }
    for (let v = lo; v <= hi; v += step) values.add(v);
  }
  return values;
}

export function parseCron(source: string): CronSchedule {
  const parts = source.trim().split(/\s+/);
  if (parts.length !== 5) throw new CronError(`"${source}" needs 5 fields (minute hour day-of-month month day-of-week)`);
  const [minutes, hours, days, months, weekdays] = parts.map((p, i) => parseField(p, FIELDS[i]!)) as [Set<number>, Set<number>, Set<number>, Set<number>, Set<number>];
  if (weekdays.delete(7)) weekdays.add(0); // 7 is Sunday too
  return { source, minutes, hours, days, months, weekdays, dayRestricted: parts[2] !== "*", weekdayRestricted: parts[4] !== "*", wildcardTime: parts[0]!.startsWith("*") || parts[1]!.startsWith("*") };
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** The wall-clock fields cron reads. */
export interface WallFields {
  minute: number;
  hour: number;
  day: number;
  month: number;
  weekday: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" });
    formatters.set(tz, f);
  }
  return f;
}

/** Throws a CronError unless `tz` is an IANA time zone name the runtime knows. */
export function checkTimeZone(tz: string): void {
  try {
    formatter(tz);
  } catch {
    throw new CronError(`"${tz}" is not a time zone (use an IANA name like "Europe/London" or "UTC")`);
  }
}

/** How far the wall clock in `tz` (default: the server's zone) is ahead of UTC at instant `t`, in ms. */
export function zoneOffset(t: number, tz?: string): number {
  if (!tz) return -new Date(t).getTimezoneOffset() * MINUTE;
  const p: Record<string, number> = {};
  for (const part of formatter(tz).formatToParts(t)) if (part.type !== "literal") p[part.type] = Number(part.value);
  return Date.UTC(p.year!, p.month! - 1, p.day!, p.hour!, p.minute!, p.second!) - Math.floor(t / 1000) * 1000;
}

/** Fields of a "floating" time: a wall clock reading stored as if it were UTC. */
function floatingFields(wall: number): WallFields {
  const d = new Date(wall);
  return { minute: d.getUTCMinutes(), hour: d.getUTCHours(), day: d.getUTCDate(), month: d.getUTCMonth() + 1, weekday: d.getUTCDay() };
}

/** The wall-clock fields at instant `t` in `tz` (default: the server's zone). */
export function wallFields(t: number, tz?: string): WallFields {
  return floatingFields(t + zoneOffset(t, tz));
}

function dayMatches(cron: CronSchedule, f: WallFields): boolean {
  const day = cron.days.has(f.day);
  const weekday = cron.weekdays.has(f.weekday);
  return cron.dayRestricted && cron.weekdayRestricted ? day || weekday : day && weekday;
}

/** Does the schedule match these wall-clock fields? */
export function fieldsMatch(cron: CronSchedule, f: WallFields): boolean {
  return cron.minutes.has(f.minute) && cron.hours.has(f.hour) && cron.months.has(f.month) && dayMatches(cron, f);
}

/** Does the schedule fire in the minute containing `date` (server time, ignoring DST rules)? */
export function cronMatches(cron: CronSchedule, date: Date): boolean {
  return fieldsMatch(cron, wallFields(date.getTime()));
}

/**
 * Is the minute starting at `t` a slot: an instant the schedule is due, in `tz`?
 *
 * Clock changes follow Vixie cron. For a fixed time (minute and hour not `*`):
 *   - Spring forward: wall times that don't exist that day fire once, in the first minute after the jump.
 *   - Fall back: a wall time that happens twice fires once, the first time.
 * A job whose minute or hour starts with `*` (`*\/15 * * * *`, `0 * * * *`) follows real time:
 * it runs at the wall times that happen, including both copies of a repeated hour.
 */
export function isSlot(cron: CronSchedule, t: number, tz?: string): boolean {
  t = Math.floor(t / MINUTE) * MINUTE;
  const off = zoneOffset(t, tz);
  const before = zoneOffset(t - MINUTE, tz);
  if (!cron.wildcardTime && off > before) {
    // The clocks jumped forward at t: the wall times in between never happened.
    for (let wall = t + before; wall < t + off; wall += MINUTE) if (fieldsMatch(cron, floatingFields(wall))) return true;
  }
  if (!fieldsMatch(cron, floatingFields(t + off))) return false;
  // The clocks went back within the last few hours: skip a wall time that already happened.
  const earlier = cron.wildcardTime ? off : zoneOffset(t - 3 * HOUR, tz);
  if (earlier > off) {
    const first = t - (earlier - off);
    if (first + zoneOffset(first, tz) === t + off) return false;
  }
  return true;
}

/** The first slot after `after` (ms), up to `until` (default: about 4 years on). */
export function nextSlot(cron: CronSchedule, after: number, tz?: string, until = after + 4 * 366 * 24 * HOUR): number | undefined {
  let t = Math.floor(after / MINUTE) * MINUTE + MINUTE;
  while (t <= until) {
    if (isSlot(cron, t, tz)) return t;
    const off = zoneOffset(t, tz);
    const f = floatingFields(t + off);
    // On a day that can't match, jump to the next wall-clock midnight; in an hour that can't, to the
    // next hour. Never jump past a clock change, where a skipped time might be due.
    const step = !cron.months.has(f.month) || !dayMatches(cron, f) ? ((24 - f.hour) * 60 - f.minute) * MINUTE : !cron.hours.has(f.hour) ? (60 - f.minute) * MINUTE : MINUTE;
    let next = t + step;
    if (step > MINUTE && zoneOffset(next, tz) !== off) {
      let lo = t;
      while (next - lo > MINUTE) {
        const mid = lo + Math.floor((next - lo) / 2 / MINUTE) * MINUTE;
        if (zoneOffset(mid, tz) === off) lo = mid;
        else next = mid;
      }
    }
    t = next;
  }
  return undefined;
}

/** Every slot in (`after`, `until`], oldest first, at most `limit` of them. */
export function slotsBetween(cron: CronSchedule, after: number, until: number, tz?: string, limit = 100_000): number[] {
  const slots: number[] = [];
  for (let t = nextSlot(cron, after, tz, until); t !== undefined && slots.length < limit; t = nextSlot(cron, t, tz, until)) slots.push(t);
  return slots;
}

/** The next minute after `from` when the schedule fires (searches up to ~4 years). */
export function nextRun(cron: CronSchedule, from: Date, tz?: string): Date | undefined {
  const t = nextSlot(cron, from.getTime(), tz);
  return t === undefined ? undefined : new Date(t);
}
