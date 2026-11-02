/**
 * Cron schedules for `halo serve`: standard 5-field expressions
 * (minute hour day-of-month month day-of-week), local time.
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
  return { source, minutes, hours, days, months, weekdays, dayRestricted: parts[2] !== "*", weekdayRestricted: parts[4] !== "*" };
}

/** Does the schedule fire in the minute containing `date`? */
export function cronMatches(cron: CronSchedule, date: Date): boolean {
  if (!cron.minutes.has(date.getMinutes()) || !cron.hours.has(date.getHours()) || !cron.months.has(date.getMonth() + 1)) return false;
  const day = cron.days.has(date.getDate());
  const weekday = cron.weekdays.has(date.getDay());
  if (cron.dayRestricted && cron.weekdayRestricted) return day || weekday;
  return day && weekday;
}

/** The next minute after `from` when the schedule fires (searches up to ~4 years). */
export function nextRun(cron: CronSchedule, from: Date): Date | undefined {
  const d = new Date(from);
  d.setSeconds(0, 0);
  for (let i = 0; i < 4 * 366 * 24 * 60; i++) {
    d.setMinutes(d.getMinutes() + 1);
    if (cronMatches(cron, d)) return new Date(d);
  }
  return undefined;
}
