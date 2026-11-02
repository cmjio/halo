/**
 * An example module provider: code that runs inside Halo, so installing it needs --trust.
 * It exports `provider` (called for each tool call) and `info` (its methods, for agents).
 */

type Call = { tool: { name: string }; method: string; named: Record<string, unknown>; positional: unknown[]; implicitInput?: boolean };

function zone(name: unknown): string {
  const z = String(name ?? "UTC");
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: z });
  } catch {
    throw new Error(`Unknown time zone "${z}" (use IANA names like Europe/Lisbon)`);
  }
  return z;
}

function show(date: Date, timeZone: string) {
  const local = new Intl.DateTimeFormat("sv-SE", { timeZone, dateStyle: "short", timeStyle: "medium" }).format(date);
  const offset = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" }).formatToParts(date).find((p) => p.type === "timeZoneName")?.value ?? "";
  return { zone: timeZone, local, offset: offset.replace("GMT", "UTC") || "UTC", iso: date.toISOString() };
}

/** The UTC instant of a wall-clock time in a zone. */
function fromLocal(local: string, timeZone: string): Date {
  const m = local.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) throw new Error(`Write the time as YYYY-MM-DD HH:MM (got "${local}")`);
  const guess = Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!, +(m[6] ?? 0));
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(guess)).map((p) => [p.type, p.value]));
  const seen = Date.UTC(+parts.year!, +parts.month! - 1, +parts.day!, +parts.hour!, +parts.minute!, +parts.second!);
  return new Date(guess - (seen - guess));
}

export async function provider(call: Call) {
  const args = call.named;
  switch (call.method) {
    case "now":
      return show(new Date(), zone(args.zone ?? (call.implicitInput ? undefined : call.positional[0])));
    case "convert": {
      const from = zone(args.from);
      const to = zone(args.to);
      const instant = fromLocal(String(args.time ?? ""), from);
      return { from: show(instant, from), to: show(instant, to) };
    }
    default:
      throw new Error(`WorldTime tool "${call.tool.name}" has no method "${call.method}" (use now, convert)`);
  }
}

export const info = {
  methods: [
    {
      name: "now",
      description: "The current date and time in a time zone.",
      effect: "read",
      params: { type: "object", properties: { zone: { type: "string", description: "IANA zone, e.g. America/New_York" } }, required: ["zone"] },
    },
    {
      name: "convert",
      description: "Convert a wall-clock time from one zone to another.",
      effect: "read",
      params: {
        type: "object",
        properties: { time: { type: "string", description: "YYYY-MM-DD HH:MM" }, from: { type: "string" }, to: { type: "string" } },
        required: ["time", "from", "to"],
      },
    },
  ],
};
