/**
 * Turns a run's telemetry rows into what Studio draws: a short tree of steps, each with a
 * start and an end, plus the run's totals.
 *
 * The rows are flat and carry no parent ids, so the shape is worked out from what they do say:
 *  - a stage that starts while no top-level stage is open is a top-level step; anything that
 *    starts before it ends happened inside it;
 *  - model and tool calls are recorded when they finish, with how long they took;
 *  - a stage that made exactly one call is shown as that call, not as two rows.
 */

export interface TelemetryEvent {
  id: number;
  run_id: string;
  timestamp: number;
  type: string;
  stage: string;
  payload: string | null;
  duration_ms: number | null;
  tokens: number | null;
}

export type SpanKind = "stage" | "model" | "tool";
export type SpanStatus = "done" | "running" | "waiting" | "error" | "unfinished";
export type RunStatus = "running" | "waiting" | "completed" | "halted" | "failed" | "unfinished";

export const RUN_LABEL: Record<RunStatus, string> = {
  running: "Running",
  waiting: "Waiting for you",
  completed: "Completed",
  halted: "Halted",
  failed: "Failed",
  unfinished: "Unfinished",
};

export interface Span {
  id: string;
  kind: SpanKind;
  /** The stage or call, without its index: "Writer.draft", "Shell.run". */
  label: string;
  /** The stage's position in its pipeline, when it is a stage. */
  index?: number;
  /** The model a model call used. */
  model?: string;
  depth: number;
  start: number;
  end: number;
  /** Null while it has not finished. */
  duration: number | null;
  status: SpanStatus;
  tokens?: number;
  cost?: number;
  mocked?: boolean;
  /** The model or tool call row. */
  call?: TelemetryEvent;
  /** The stage's end row, whose payload is the value it passed on. */
  result?: TelemetryEvent;
  children: Span[];
}

export interface Pause {
  start: number;
  /** Null while the run is still waiting. */
  end: number | null;
  waitingFor?: string;
  /** "stopped": the run failed or was stopped here, and was resumed later. Otherwise it waited for an answer. */
  kind?: "stopped";
}

/** A person raised the run's budget while it ran. */
export interface BudgetRaise {
  at: number;
  added: number;
  /** All that has been added to the run's budget by then. */
  total: number;
}

export interface Trace {
  pipeline: string | null;
  status: RunStatus;
  start: number;
  end: number;
  spans: Span[];
  pauses: Pause[];
  hasOutput: boolean;
  output?: unknown;
  error?: string;
  /** The run failed because someone stopped it. */
  stopped: boolean;
  budgetRaises: BudgetRaise[];
  cost?: number;
  tokens: number;
  modelCalls: number;
  toolCalls: number;
  /** Time spent working: the run's length with the time it sat waiting for someone taken out. */
  active: number;
  /** Where a moment falls on that working-time axis, in ms from the start. */
  at: (t: number) => number;
}

export type TraceRow = { span: Span; parent?: Span } | { pause: Pause } | { raise: BudgetRaise };
export type TraceOrder = "oldest" | "newest";
type Marker = { at: number; row: TraceRow };

/**
 * The tree as the rows to draw, with a marker wherever the run sat waiting or its budget was
 * raised. Newest first reverses the steps and the steps inside each, but keeps each step's
 * insides under it.
 */
export function rowsOf(trace: Trace, closed: Set<string>, order: TraceOrder = "oldest"): TraceRow[] {
  const markers: Marker[] = [...trace.pauses.map((pause) => ({ at: pause.start, row: { pause } })), ...trace.budgetRaises.map((raise) => ({ at: raise.at, row: { raise } }))].sort((a, b) => a.at - b.at);
  const groups: TraceRow[][] = [];
  for (const span of trace.spans) {
    while (markers[0] && span.start >= markers[0].at) groups.push([markers.shift()!.row]);
    const kids = closed.has(span.id) ? [] : span.children.map((child) => ({ span: child, parent: span }));
    groups.push([{ span }, ...(order === "newest" ? kids.reverse() : kids)]);
  }
  for (const m of markers) groups.push([m.row]);
  return (order === "newest" ? groups.reverse() : groups).flat();
}

/** A run with no end recorded counts as still going if it logged something this recently. */
export const QUIET_LIMIT_MS = 5 * 60_000;

export function parsePayload(payload: string | null): unknown {
  if (payload === null || payload === undefined) return null;
  try {
    return JSON.parse(payload);
  } catch {
    return payload;
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** "3: Writer.draft" -> [3, "Writer.draft"] */
function splitStage(stage: string): [number | undefined, string] {
  const m = stage.match(/^(\d+): ([\s\S]*)$/);
  return m ? [Number(m[1]), m[2]!] : [undefined, stage];
}

/** Whether a call belongs to a stage with this label. */
function callFits(call: Span, stageLabel: string): boolean {
  if (call.kind === "tool") return stageLabel === call.label;
  return stageLabel === call.label || stageLabel.startsWith(`${call.label}.`);
}

export function buildTrace(events: TelemetryEvent[], live: { running: boolean; paused: boolean }, now = Date.now()): Trace {
  const roots: Span[] = [];
  const open: Span[] = [];
  /** Calls not yet folded into a stage, and the list each sits in. */
  const loose = new Map<Span, Span[]>();
  const pauses: Pause[] = [];
  let top: Span | null = null;
  let pipeline: string | null = null;
  let ended: "completed" | "halted" | "failed" | undefined;
  let output: unknown;
  let hasOutput = false;
  let error: string | undefined;
  let stopped = false;
  let failedAt: number | undefined;
  const budgetRaises: BudgetRaise[] = [];
  let cost: number | undefined;
  let summedCost = 0;
  let tokens = 0;
  let modelCalls = 0;
  let toolCalls = 0;

  const first = events[0]?.timestamp ?? now;
  const last = events.at(-1)?.timestamp ?? now;

  for (const ev of events) {
    const t = ev.timestamp;
    switch (ev.type) {
      case "stream_start": {
        pipeline ??= ev.stage;
        const waiting = pauses.at(-1);
        if (waiting && waiting.end === null) {
          waiting.end = t;
          for (const s of open) if (s.status === "waiting") s.status = "running";
        }
        // A run that failed and was resumed: the time in between is left off the timeline too.
        if (ended === "failed" && failedAt !== undefined) pauses.push({ start: failedAt, end: t, kind: "stopped" });
        ended = undefined;
        stopped = false;
        failedAt = undefined;
        break;
      }
      case "node_start": {
        const [index, label] = splitStage(ev.stage);
        const span: Span = { id: `s${ev.id}`, kind: "stage", label, index, depth: top ? 1 : 0, start: t, end: t, duration: null, status: "running", children: [] };
        (top ? top.children : roots).push(span);
        if (!top) top = span;
        open.push(span);
        break;
      }
      case "node_end": {
        const [index, label] = splitStage(ev.stage);
        const began = t - (ev.duration_ms ?? 0);
        // Several stages with one name can be open at once (the branches of a fan-out). Prefer an
        // inner one, then whichever started closest to when this one says it did.
        const candidates = open.filter((s) => s.label === label && s.index === index);
        const inner = candidates.filter((s) => s !== top);
        const pool = inner.length ? inner : candidates;
        let span = pool[0];
        for (const s of pool) if (Math.abs(s.start - began) < Math.abs(span!.start - began)) span = s;
        if (!span) {
          // Its start was never recorded (pruned, or logged by an older version).
          span = { id: `s${ev.id}`, kind: "stage", label, index, depth: top ? 1 : 0, start: began, end: t, duration: null, status: "done", children: [] };
          (top ? top.children : roots).push(span);
        } else {
          open.splice(open.indexOf(span), 1);
        }
        span.end = t;
        span.duration = ev.duration_ms ?? t - span.start;
        span.status = "done";
        span.result = ev;
        // A stage that made one call is that call.
        const fits = [...loose.keys()].filter((c) => callFits(c, label) && c.start >= span.start - 30 && c.end <= t + 30);
        if (fits.length === 1 && span.children.filter((c) => c !== fits[0]).length === 0) {
          const call = fits[0]!;
          const list = loose.get(call)!;
          list.splice(list.indexOf(call), 1);
          loose.delete(call);
          span.kind = call.kind;
          span.model = call.model;
          span.tokens = call.tokens;
          span.cost = call.cost;
          span.mocked = call.mocked;
          span.call = call.call;
        } else {
          for (const c of fits) loose.delete(c);
        }
        if (span === top) top = null;
        break;
      }
      case "llm_call":
      case "tool_call": {
        const payload = parsePayload(ev.payload);
        const info = isRecord(payload) ? payload : {};
        const isModel = ev.type === "llm_call";
        const via = isModel ? ev.stage.match(/^([\s\S]*?) via ([\s\S]*)$/) : null;
        const span: Span = {
          id: `c${ev.id}`,
          kind: isModel ? "model" : "tool",
          label: via ? via[1]! : ev.stage,
          model: via ? via[2] : undefined,
          depth: top ? 1 : 0,
          start: t - (ev.duration_ms ?? 0),
          end: t,
          duration: ev.duration_ms,
          status: "done",
          tokens: ev.tokens ?? undefined,
          cost: typeof info.cost === "number" ? info.cost : undefined,
          mocked: info.mocked === true,
          call: ev,
          children: [],
        };
        const list = top ? top.children : roots;
        list.push(span);
        loose.set(span, list);
        if (isModel) {
          modelCalls++;
          tokens += ev.tokens ?? 0;
          summedCost += span.cost ?? 0;
        } else {
          toolCalls++;
        }
        break;
      }
      case "stream_end": {
        const payload = parsePayload(ev.payload);
        const info = isRecord(payload) ? payload : {};
        if (info.status === "paused") {
          // A pause is recorded twice: once as the run's status, once with what it is waiting for.
          const waitingFor = typeof info.waitingFor === "string" ? info.waitingFor : undefined;
          const current = pauses.at(-1);
          if (current && current.end === null) current.waitingFor ??= waitingFor;
          else pauses.push({ start: t, end: null, waitingFor });
          for (const s of open) s.status = "waiting";
          break;
        }
        ended = info.status === "halted" ? "halted" : "completed";
        if ("output" in info && info.output !== undefined) {
          output = info.output;
          hasOutput = true;
        }
        if (typeof info.cost === "number") cost = info.cost;
        for (const s of open.splice(0)) {
          s.status = "done";
          s.end = t;
        }
        top = null;
        break;
      }
      case "error": {
        const payload = parsePayload(ev.payload);
        const info = isRecord(payload) ? payload : {};
        ended = "failed";
        failedAt = t;
        stopped = info.stopped === true;
        error = typeof info.error === "string" ? info.error : typeof payload === "string" ? payload : "The run failed";
        if (typeof info.cost === "number") cost = info.cost;
        // Everything still open was cut short; the step it failed in is the one that started last
        // (and the top-level step around it).
        const failedIn = open.at(-1);
        for (const s of open.splice(0)) {
          s.status = s === failedIn || s === top ? "error" : "unfinished";
          s.end = t;
        }
        top = null;
        break;
      }
      case "event": {
        if (ev.stage !== "budget") break;
        const info = parsePayload(ev.payload);
        if (isRecord(info) && typeof info.added === "number") budgetRaises.push({ at: t, added: info.added, total: typeof info.budgetAdded === "number" ? info.budgetAdded : info.added });
        break;
      }
    }
  }

  const waiting = !ended && (live.paused || pauses.at(-1)?.end === null);
  const running = !ended && !waiting && (live.running || now - last < QUIET_LIMIT_MS);
  const status: RunStatus = ended ?? (waiting ? "waiting" : running ? "running" : "unfinished");
  const end = running ? Math.max(now, last) : last;
  for (const s of open) {
    if (waiting) {
      s.status = "waiting";
      s.end = last;
    } else if (running) {
      s.status = "running";
      s.end = end;
    } else {
      s.status = "unfinished";
      s.end = last;
    }
  }

  const byStart = (a: Span, b: Span) => a.start - b.start;
  roots.sort(byStart);
  for (const s of roots) s.children.sort(byStart);

  const at = (t: number) => {
    let gone = 0;
    for (const p of pauses) {
      if (t <= p.start) break;
      gone += Math.min(t, p.end ?? Infinity) - p.start;
    }
    return Math.max(0, t - first - gone);
  };

  return {
    pipeline,
    status,
    start: first,
    end,
    spans: roots,
    pauses,
    hasOutput,
    output,
    error,
    stopped,
    budgetRaises,
    cost: cost ?? (summedCost > 0 ? summedCost : undefined),
    tokens,
    modelCalls,
    toolCalls,
    active: at(end),
    at,
  };
}

/** A tick's time, as short as it can be said: "500ms", "2s", "1m", "1m 30s". */
export function tickLabel(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${ms / 1000}s`;
  if (ms < 3_600_000) return ms % 60_000 ? `${Math.floor(ms / 60_000)}m ${(ms % 60_000) / 1000}s` : `${ms / 60_000}m`;
  return ms % 3_600_000 ? `${Math.floor(ms / 3_600_000)}h ${(ms % 3_600_000) / 60_000}m` : `${ms / 3_600_000}h`;
}

/** Round steps for the time axis: about five of them across the run. */
export function axisTicks(total: number): number[] {
  if (total <= 0) return [0];
  const steps = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10_000, 15_000, 30_000, 60_000, 120_000, 300_000, 600_000, 1_800_000, 3_600_000, 7_200_000, 21_600_000, 86_400_000];
  const step = steps.find((s) => total / s <= 6) ?? steps.at(-1)!;
  const ticks: number[] = [];
  for (let t = 0; t <= total; t += step) ticks.push(t);
  return ticks;
}
