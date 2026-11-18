/** How Studio writes durations, money, times and schedules. */

export function duration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || Number.isNaN(ms)) return "";
  if (ms < 1000) return `${Math.max(0, Math.round(ms))}ms`;
  const s = ms / 1000;
  if (s < 10) return `${s.toFixed(1)}s`;
  if (s < 60) return `${Math.round(s)}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${Math.round(s % 60)}s`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

export function money(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "";
  if (n === 0) return "$0";
  if (n < 0.0001) return "<$0.0001";
  return n < 0.1 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`;
}

export const count = (n: number) => n.toLocaleString();

export const plural = (n: number, one: string, many = `${one}s`) => `${count(n)} ${n === 1 ? one : many}`;

export function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function clock(ts: number | string | Date): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** "Today", "Yesterday", or the date. */
export function dayLabel(ts: number | string | Date, now = new Date()): string {
  const d = new Date(ts);
  const days = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days === -1) return "Tomorrow";
  return d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short", ...(d.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }) });
}

/** "Today at 14:32", "Mon 9 Nov at 08:30". */
export function when(ts: number | string | Date, now = new Date()): string {
  return `${dayLabel(ts, now)} at ${clock(ts)}`;
}

/** "in 14h", "in 3m", "any moment". */
export function until(ts: number | string | Date, now = Date.now()): string {
  const ms = new Date(ts).getTime() - now;
  if (ms < 45_000) return "any moment";
  const m = Math.round(ms / 60_000);
  if (m < 60) return `in ${m}m`;
  const h = Math.round(m / 60);
  if (h < 36) return `in ${h}h`;
  return `in ${Math.round(h / 24)}d`;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** The common cron shapes in words; anything else is shown as written. */
export function cronInWords(cron: string): string {
  const f = cron.trim().split(/\s+/);
  if (f.length !== 5) return cron;
  const [min, hour, dom, mon, dow] = f as [string, string, string, string, string];
  const num = (s: string) => /^\d+$/.test(s);
  const at = num(min) && num(hour) ? `${hour.padStart(2, "0")}:${min.padStart(2, "0")}` : undefined;
  const everyDay = dom === "*" && mon === "*";
  if (everyDay && dow === "*") {
    const step = min.match(/^\*\/(\d+)$/);
    if (step && hour === "*") return `Every ${step[1]} minutes`;
    if (min === "*" && hour === "*") return "Every minute";
    if (num(min) && hour === "*") return `Every hour at :${min.padStart(2, "0")}`;
    const hours = hour.match(/^\*\/(\d+)$/);
    if (num(min) && hours) return `Every ${hours[1]} hours at :${min.padStart(2, "0")}`;
    if (at) return `Every day at ${at}`;
  }
  if (everyDay && at) {
    if (dow === "1-5" || dow.toLowerCase() === "mon-fri") return `Weekdays at ${at}`;
    if (dow === "0,6" || dow === "6,0") return `Weekends at ${at}`;
    if (num(dow) && Number(dow) <= 7) return `Every ${DAYS[Number(dow) % 7]} at ${at}`;
  }
  if (at && num(dom) && mon === "*" && dow === "*") return `Day ${dom} of every month at ${at}`;
  return cron;
}
