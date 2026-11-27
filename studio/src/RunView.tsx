import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Splitter } from "@ark-ui/react";
import { IconAlertTriangle, IconArrowLeft, IconBrain, IconChevronDown, IconChevronRight, IconCoin, IconExternalLink, IconHandStop, IconPlayerPlay, IconPlayerStop, IconPointFilled, IconChevronsDown, IconChevronsUp, IconHistory, IconTool, IconX } from "@tabler/icons-react";
import { api, message, type RunControls, type RunDetail, type RunStep } from "./api";
import { clock, count, duration, money, plural, when } from "./format";
import { axisTicks, tickLabel, buildTrace, parsePayload, rowsOf, RUN_LABEL, type TraceOrder as Order, type Span, type Trace } from "./trace";
import { ConfirmDialog, CopyButton, Field, rowKeys, Segments, StatusPill, Tip, useNow, Value } from "./ui";

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function KindIcon({ kind, size = 15 }: { kind: Span["kind"]; size?: number }) {
  if (kind === "model") return <IconBrain size={size} stroke={1.75} />;
  if (kind === "tool") return <IconTool size={size} stroke={1.75} />;
  return <IconPointFilled size={size} />;
}

const shortModel = (model: string) => model.slice(model.lastIndexOf("/") + 1);

const ORDER_KEY = "halo-trace-order";

function savedOrder(): Order {
  try {
    return localStorage.getItem(ORDER_KEY) === "newest" ? "newest" : "oldest";
  } catch {
    return "oldest";
  }
}

function rememberOrder(order: Order) {
  try {
    localStorage.setItem(ORDER_KEY, order);
  } catch {}
}

function findSpan(trace: Trace, id: string | null): Span | undefined {
  if (!id) return undefined;
  for (const s of trace.spans) {
    if (s.id === id) return s;
    for (const c of s.children) if (c.id === id) return c;
  }
  // A call row becomes part of its stage once the stage ends.
  for (const s of trace.spans) {
    if (s.call && `c${s.call.id}` === id) return s;
    for (const c of s.children) if (c.call && `c${c.call.id}` === id) return c;
  }
  return undefined;
}

function Waterfall({ trace, selected, onSelect, closed, onToggle, order }: { trace: Trace; selected?: Span; onSelect: (id: string) => void; closed: Set<string>; onToggle: (id: string) => void; order: Order }) {
  const rows = useMemo(() => rowsOf(trace, closed, order), [trace, closed, order]);
  const total = Math.max(trace.active, 1);
  const ticks = axisTicks(total);
  const toggle = onToggle;

  return (
    <div className="trace" onKeyDown={rowKeys}>
      <div className="trace-axis" aria-hidden="true">
        <span className="trace-axis-label">Step</span>
        <div className="trace-track">
          {ticks.map((t) => (
            <span key={t} className="tick" style={{ left: `${(t / total) * 100}%` }}>
              {t === 0 ? "0" : t / total > 0.92 ? "" : tickLabel(t)}
            </span>
          ))}
        </div>
        <span className="trace-axis-label end">Took</span>
      </div>
      <div className="trace-rows">
        <div className="trace-grid" aria-hidden="true">
          <div className="trace-track">
            {ticks.map((t) => (
              <i key={t} style={{ left: `${(t / total) * 100}%` }} />
            ))}
          </div>
        </div>
        {rows.map((row) => {
          if ("raise" in row) {
            const r = row.raise;
            return (
              <div className="trace-pause budget" key={`b${r.at}`}>
                <IconCoin size={14} stroke={1.75} />
                Budget raised by {money(r.added)} at {clock(r.at)}
                {r.total !== r.added && <span className="muted">{money(r.total)} added in all</span>}
              </div>
            );
          }
          if ("pause" in row) {
            const p = row.pause;
            if (p.kind === "stopped") {
              return (
                <div className="trace-pause" key={`p${p.start}`}>
                  <IconPlayerPlay size={14} stroke={1.75} />
                  Ended here, resumed {duration((p.end ?? p.start) - p.start)} later
                  <span className="muted">not counted on the timeline</span>
                </div>
              );
            }
            return (
              <div className="trace-pause" key={`p${p.start}`}>
                <IconHandStop size={14} stroke={1.75} />
                {p.end === null ? `Waiting since ${clock(p.start)}` : `Waited ${duration(p.end - p.start)} for an answer`}
                <span className="muted">not counted on the timeline</span>
              </div>
            );
          }
          const s = row.span;
          const left = (trace.at(s.start) / total) * 100;
          const width = ((trace.at(s.end) - trace.at(s.start)) / total) * 100;
          const kids = s.children.length;
          return (
            <div className={`trace-row depth-${s.depth} ${selected?.id === s.id ? "selected" : ""} ${s.status}`} key={s.id}>
              {kids > 0 ? (
                <button type="button" className="twist" onClick={() => toggle(s.id)} aria-label={closed.has(s.id) ? `Show the ${kids} steps inside` : "Hide the steps inside"} aria-expanded={!closed.has(s.id)}>
                  {closed.has(s.id) ? <IconChevronRight size={14} stroke={2} /> : <IconChevronDown size={14} stroke={2} />}
                </button>
              ) : (
                <span className="twist" />
              )}
              <button type="button" className="trace-hit" data-row onClick={() => onSelect(s.id)} aria-current={selected?.id === s.id ? "true" : undefined}>
                <span className="trace-name">
                  <span className={`kind ${s.kind}`}>
                    <KindIcon kind={s.kind} />
                  </span>
                  <span className="trace-label" title={s.label}>
                    {s.label}
                  </span>
                  {s.model && <span className="trace-model">{shortModel(s.model)}</span>}
                  {kids > 0 && closed.has(s.id) && <span className="trace-model">{plural(kids, "step")}</span>}
                  {s.mocked && <span className="tag">mocked</span>}
                </span>
                <span className="trace-track">
                  <span className={`bar ${s.kind} ${s.status}`} style={{ left: `min(${left}%, calc(100% - 3px))`, width: `${width}%` }} />
                </span>
                <span className="trace-took">{s.status === "error" ? "failed" : s.status === "waiting" ? "waiting" : s.status === "unfinished" ? "cut short" : duration(s.duration ?? s.end - s.start)}</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const KIND_WORD = { model: "Model call", tool: "Tool call", stage: "Stage" } as const;

function Inspector({ span, trace, onClose }: { span: Span; trace: Trace; onClose: () => void }) {
  const call = isRecord(parsePayload(span.call?.payload ?? null)) ? (parsePayload(span.call!.payload) as Record<string, unknown>) : undefined;
  const result = span.result ? parsePayload(span.result.payload) : undefined;
  const callOutput = call?.output;
  // What the stage passed on is usually the call's answer; show it again only when it isn't.
  const passedOnDiffers = span.result !== undefined && span.call !== undefined && JSON.stringify(result) !== JSON.stringify(callOutput);
  const extra = call ? Object.entries(call).filter(([k, v]) => !["system", "prompt", "media", "sent", "output", "cost", "mocked"].includes(k) && v !== null && v !== undefined) : [];
  const took = span.duration ?? (span.status === "running" ? span.end - span.start : null);

  return (
    <>
      <header className="inspector-head">
        <span className={`kind ${span.kind}`}>
          <KindIcon kind={span.kind} size={16} />
        </span>
        <div className="inspector-title">
          <h3 title={span.label}>{span.label}</h3>
          <p>
            {KIND_WORD[span.kind]}
            {span.model ? ` · ${span.model}` : ""}
            {span.mocked ? " · mocked" : ""}
          </p>
        </div>
        <Tip label="Close (Esc)">
          <button type="button" className="btn ghost icon" onClick={onClose} aria-label="Close details">
            <IconX size={16} stroke={2} />
          </button>
        </Tip>
      </header>
      <dl className="stats">
        <div>
          <dt>Took</dt>
          <dd>{took !== null ? duration(took) : "—"}</dd>
        </div>
        {span.tokens !== undefined && (
          <div>
            <dt>Tokens</dt>
            <dd>{count(span.tokens)}</dd>
          </div>
        )}
        {span.cost !== undefined && span.cost > 0 && (
          <div>
            <dt>Cost</dt>
            <dd>{money(span.cost)}</dd>
          </div>
        )}
        <div>
          <dt>Started</dt>
          <dd>+{duration(trace.at(span.start))}</dd>
        </div>
      </dl>
      <div className="inspector-body">
        {span.status === "error" && (
          <div className="callout error">
            <IconAlertTriangle size={16} stroke={1.75} />
            <div>
              <strong>The run failed during this step</strong>
              {trace.error && <Value value={trace.error} />}
            </div>
          </div>
        )}
        {span.status === "running" && <p className="note">Still running. Its result appears here when it finishes.</p>}
        {span.status === "waiting" && <p className="note">The run is paused at this step until someone answers.</p>}
        {span.status === "unfinished" && <p className="note">This step started but never recorded an end.</p>}
        {span.kind === "model" && call && (
          <>
            {typeof call.system === "string" && call.system && <Field title="System prompt" value={call.system} />}
            <Field title="Prompt" value={call.prompt} />
            {Array.isArray(call.media) && call.media.length > 0 && <Field title={call.media.length === 1 ? "File sent with it" : "Files sent with it"} value={call.media} />}
            <Field title="Answer" value={callOutput} />
          </>
        )}
        {span.kind === "tool" && call && Array.isArray(call.sent) && call.sent.length > 0 && <Field title={call.sent.length === 1 ? "File sent" : "Files sent"} value={call.sent} />}
        {span.kind === "tool" && call && <Field title="Output" value={callOutput} />}
        {extra.map(([k, v]) => (
          <Field key={k} title={k} value={v} />
        ))}
        {span.result && (!span.call || passedOnDiffers) && <Field title={span.call ? "Passed to the next step" : "Result"} value={result} empty="This step passed on nothing" />}
      </div>
    </>
  );
}

function waitingTitle(waitingFor: string): string {
  if (waitingFor === "yield") return "This run is waiting for your go-ahead";
  if (waitingFor === "approval") return "An agent is asking to use a tool";
  return `This run is waiting for "${waitingFor}"`;
}

function WaitingBanner({ runId, paused, onAnswered }: { runId: string; paused: NonNullable<RunDetail["paused"]>; onAnswered: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [other, setOther] = useState(false);
  const [text, setText] = useState("");
  const send = async (answer: string) => {
    setBusy(answer);
    setError(null);
    try {
      await api(`/api/runs/${runId}/signal`, { method: "POST", body: JSON.stringify({ answer }) });
      onAnswered();
    } catch (e) {
      setError(message(e));
      setBusy(null);
    }
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (text.trim()) void send(text.trim());
  };
  return (
    <section className="ask">
      <div className="ask-text">
        <strong>{waitingTitle(paused.waitingFor)}</strong>
        {paused.message && <p>{paused.message}</p>}
      </div>
      <div className="ask-actions">
        <button type="button" className="btn primary" disabled={busy !== null} onClick={() => send("approve")}>
          {busy === "approve" ? "Approving…" : "Approve"}
        </button>
        <button type="button" className="btn" disabled={busy !== null} onClick={() => send("reject")}>
          {busy === "reject" ? "Rejecting…" : "Reject"}
        </button>
        {!other && (
          <button type="button" className="btn ghost" disabled={busy !== null} onClick={() => setOther(true)}>
            Answer something else
          </button>
        )}
        <span className="ask-links">
          <CopyButton text={paused.approveUrl} label="Copy approval link" />
          <a className="btn ghost small" href={paused.approveUrl} target="_blank" rel="noreferrer">
            <IconExternalLink size={14} stroke={1.75} />
            Open
          </a>
        </span>
      </div>
      {other && (
        <form className="ask-other" onSubmit={submit}>
          <input autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="A word, a sentence, or JSON" aria-label="Your answer" />
          <button type="submit" className="btn" disabled={busy !== null || !text.trim()}>
            Send answer
          </button>
        </form>
      )}
      {error && <p className="form-error">{error}</p>}
    </section>
  );
}

/** Near the end of the budget: from here on Studio offers to raise it. */
const NEAR_BUDGET = 0.8;

const ranOutOfBudget = (trace: Trace) => trace.status === "failed" && !!trace.error && /Budget exceeded/.test(trace.error);

/** Spent against the run's budget: the lowest MaxSpend, plus what has been added. */
function BudgetMeter({ budget, spent, onExtend, canExtend }: { budget: NonNullable<RunControls["budget"]>; spent: number; onExtend: () => void; canExtend: boolean }) {
  const limit = budget.limit + budget.added;
  const share = limit > 0 ? spent / limit : 0;
  const tone = share >= 1 ? "error" : share >= NEAR_BUDGET ? "warn" : "ok";
  const several = budget.limits.length > 1;
  return (
    <div className={`budget-meter ${tone}`}>
      <div className="budget-text">
        <span>
          <strong>{money(spent) || "$0"}</strong> of {money(limit)} budget
        </span>
        {budget.added > 0 && <span className="muted">{money(budget.added)} added</span>}
        {several && (
          <Tip label={`Agents stop at ${budget.limits.map(money).join(", ")}; this shows the lowest${budget.added ? ", plus what was added" : ""}.`}>
            <span className="muted">lowest of {budget.limits.length} limits</span>
          </Tip>
        )}
      </div>
      <div className="budget-bar" role="meter" aria-label="Budget spent" aria-valuemin={0} aria-valuemax={limit} aria-valuenow={Math.min(spent, limit)} aria-valuetext={`${money(spent)} of ${money(limit)}`}>
        <i style={{ width: `${Math.min(100, share * 100)}%` }} />
      </div>
      {canExtend && (
        <button type="button" className={`btn small ${tone === "ok" ? "ghost" : "primary"}`} onClick={onExtend}>
          <IconCoin size={14} stroke={1.75} />
          {tone === "ok" ? "Raise budget" : "Extend budget"}
        </button>
      )}
    </div>
  );
}

const PRESETS = [0.5, 1, 5];

/** Ask how much to add; the caller decides whether that raises a live run or resumes a stopped one. */
function ExtendDialog({ open, onClose, limit, resume, onDone }: { open: boolean; onClose: () => void; limit: number; resume: boolean; onDone: (add: number) => Promise<void> }) {
  const [amount, setAmount] = useState("1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const add = Number(amount);
  const valid = Number.isFinite(add) && add > 0 && add <= 10_000;
  const go = async () => {
    setBusy(true);
    setError(null);
    try {
      await onDone(add);
      onClose();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      title={resume ? "Add budget and resume" : "Extend this run's budget"}
      actions={
        <>
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn primary" disabled={!valid || busy} onClick={go}>
            {busy ? "Working…" : resume ? `Add ${valid ? money(add) : ""} and resume` : `Add ${valid ? money(add) : ""}`}
          </button>
        </>
      }
    >
      <p>
        Every spend limit this run works under goes up by this much{resume ? ", and the run continues from its last finished step" : ", from its next model call"}. It applies to this run only: the pipeline's file is unchanged.
      </p>
      <div className="extend-amount">
        <label>
          <span className="sr-only">Amount in USD</span>
          <span className="prefix">$</span>
          <input type="number" min="0.01" max="10000" step="0.5" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
        </label>
        {[...new Set([...PRESETS, limit])].map((n) => (
          <button key={n} type="button" className={`btn small ${add === n ? "" : "ghost"}`} onClick={() => setAmount(String(n))}>
            +{money(n)}
          </button>
        ))}
      </div>
      {error && <p className="form-error">{error}</p>}
    </ConfirmDialog>
  );
}

/** Pick a step of the run's history to run again from, as a new run. */
function RewindDialog({ open, onClose, runId, onDone }: { open: boolean; onClose: () => void; runId: string; onDone: (newRunId: string) => void }) {
  const [steps, setSteps] = useState<RunStep[] | null>(null);
  const [step, setStep] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    setError(null);
    setSteps(null);
    api<{ steps: RunStep[] }>(`/api/runs/${runId}/steps`).then(
      (d) => {
        setSteps(d.steps);
        setStep(d.steps.at(-1)?.step ?? null);
      },
      (e) => setError(message(e)),
    );
  }, [open, runId]);
  const go = async () => {
    if (step === null) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ runId: string }>(`/api/runs/${runId}/rewind`, { method: "POST", body: JSON.stringify({ step }) });
      onClose();
      onDone(r.runId);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      title="Rewind to a step"
      actions={
        <>
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn primary" disabled={step === null || busy} onClick={go}>
            {busy ? "Starting…" : step === null ? "Run again from here" : `Run again from step ${step}`}
          </button>
        </>
      }
    >
      <p>A new run starts with this run's state after the step you pick, and runs every stage after it again with the pipeline as it is now. This run is left as it is.</p>
      {!steps && !error && <p className="loading">Loading steps…</p>}
      {steps && (
        <div className="rewind-steps" role="radiogroup" aria-label="Step to continue from">
          {steps.map((st) => (
            <label key={st.step} className={`rewind-step ${step === st.step ? "on" : ""}`}>
              <input type="radio" name="rewind-step" checked={step === st.step} onChange={() => setStep(st.step)} />
              <span className="n">{st.step}</span>
              <span className="label" title={st.label}>
                {st.label}
                {st.halted && <span className="tag">halted</span>}
              </span>
              <span className="muted">{money(st.cost) || "$0"}</span>
            </label>
          ))}
        </div>
      )}
      {error && <p className="form-error">{error}</p>}
    </ConfirmDialog>
  );
}

/** Stop, resume, rewind: what can be done to the run right now. */
function RunActions({ runId, controls, onChanged }: { runId: string; controls: RunControls; onChanged: () => void }) {
  const [asking, setAsking] = useState<"stop" | "rewind" | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const act = async (what: string, path: string, body: unknown = {}) => {
    setBusy(what);
    setError(null);
    try {
      await api(path, { method: "POST", body: JSON.stringify(body) });
      onChanged();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(null);
    }
  };
  if (!controls.stoppable && !controls.resumable && !controls.rewindable) return null;
  return (
    <>
      <span className="run-actions">
        {controls.stoppable && (
          <button type="button" className="btn small" disabled={busy !== null} onClick={() => setAsking("stop")}>
            <IconPlayerStop size={14} stroke={1.75} />
            {busy === "stop" ? "Stopping…" : "Stop"}
          </button>
        )}
        {controls.resumable && (
          <Tip label="Continue from the last step that finished">
            <button type="button" className="btn small" disabled={busy !== null} onClick={() => act("resume", `/api/runs/${runId}/resume`)}>
              <IconPlayerPlay size={14} stroke={1.75} />
              {busy === "resume" ? "Resuming…" : "Resume"}
            </button>
          </Tip>
        )}
        {controls.rewindable && (
          <button type="button" className="btn small ghost" disabled={busy !== null} onClick={() => setAsking("rewind")}>
            <IconHistory size={14} stroke={1.75} />
            Rewind…
          </button>
        )}
      </span>
      {error && <p className="form-error run-actions-error">{error}</p>}
      <ConfirmDialog
        open={asking === "stop"}
        onClose={() => setAsking(null)}
        title="Stop this run?"
        actions={
          <>
            <button type="button" className="btn ghost" onClick={() => setAsking(null)}>
              Keep running
            </button>
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                setAsking(null);
                void act("stop", `/api/runs/${runId}/stop`, { reason: "Stopped from Studio" });
              }}
            >
              Stop the run
            </button>
          </>
        }
      >
        <p>The step it's on is cut short and the run ends as stopped. {controls.steps > 0 ? "It has a checkpoint, so you can resume it from its last finished step." : "Its pipeline has no @checkpoint, so it can't be resumed: a new run would start from the beginning."}</p>
      </ConfirmDialog>
      <RewindDialog open={asking === "rewind"} onClose={() => setAsking(null)} runId={runId} onDone={(id) => (location.hash = `#/runs/${id}`)} />
    </>
  );
}

const INSPECTOR_KEY = "halo-inspector-size";

/** How much of the width the details panel takes, as a percentage; it is yours to drag. */
function savedInspectorSize(): number {
  try {
    const n = Number(localStorage.getItem(INSPECTOR_KEY));
    return n >= 24 && n <= 66 ? n : 40;
  } catch {
    return 40;
  }
}

function rememberInspectorSize(size: number) {
  try {
    localStorage.setItem(INSPECTOR_KEY, String(Math.round(size)));
  } catch {}
}

/** One run: what happened, what it produced, and every step on a timeline. */
export function RunView({ id }: { id: string }) {
  const [detail, setDetail] = useState<RunDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const reload = useRef<() => void>(() => {});
  const [inspectorSize, setInspectorSize] = useState(savedInspectorSize);
  const [closed, setClosed] = useState<Set<string>>(() => new Set());
  const [order, setOrder] = useState<Order>(savedOrder);
  const [extending, setExtending] = useState(false);
  // The header sticks to the top as the trace scrolls under it; a line under it shows once it does.
  const sentinel = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setStuck(!e!.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  });

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    setDetail(null);
    setError(null);
    setSelectedId(null);
    setClosed(new Set());
    const load = async () => {
      clearTimeout(timer);
      let next = 4000;
      try {
        const d = await api<RunDetail>(`/api/runs/${id}`);
        if (stop) return;
        setDetail(d);
        setError(null);
        const status = buildTrace(d.events, { running: d.running, paused: !!d.paused }).status;
        // Finished runs don't change; a run nobody ended might still be going in a terminal.
        // A run just resumed is running before its telemetry says so.
        if (status === "running" || d.running || d.controls?.stoppable) next = 1500;
        else if (status === "waiting") next = 3000;
        else if (status === "unfinished") next = 10_000;
        else return;
      } catch (e) {
        if (stop) return;
        setError(message(e));
      }
      timer = setTimeout(load, next);
    };
    reload.current = load;
    void load();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [id]);

  const live = !!detail && (detail.running || !detail.events.some((e) => e.type === "error" || (e.type === "stream_end" && !e.payload?.includes('"paused"'))));
  const now = useNow(live);
  const trace = useMemo(() => (detail ? buildTrace(detail.events, { running: detail.running, paused: !!detail.paused }, now) : null), [detail, now]);
  const selected = trace ? findSpan(trace, selectedId) : undefined;

  useEffect(() => {
    if (!selectedId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("dialog[open]")) setSelectedId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId]);

  if (!detail || !trace) {
    return (
      <div className="page">
        <BackLink />
        {error ? <div className="callout error">{error}</div> : <p className="loading">Loading run…</p>}
      </div>
    );
  }

  if (detail.events.length === 0) {
    return (
      <div className="page">
        <BackLink />
        <div className="blank">
          <h2>Nothing recorded for this run</h2>
          <p>
            Run <code>{id.slice(0, 8)}</code> isn't in this folder's telemetry. Studio keeps the last 100 finished runs.
          </p>
        </div>
      </div>
    );
  }

  const steps = trace.spans.length;
  const parents = trace.spans.filter((s) => s.children.length > 0).map((s) => s.id);
  const controls = detail.controls;
  // A live run's spend comes from the server (it counts calls still in flight); otherwise from the trace.
  const spent = Math.max(controls?.budget?.spent ?? 0, trace.cost ?? 0);
  const canExtend = !!controls?.budget && (controls.stoppable || !!detail.paused || (controls.resumable && ranOutOfBudget(trace)));
  return (
    <Splitter.Root
      className="run"
      panels={selected ? [{ id: "main", minSize: 30 }, { id: "inspector", minSize: 24, maxSize: 66 }] : [{ id: "main" }]}
      size={selected ? [100 - inspectorSize, inspectorSize] : [100]}
      onResize={(d) => {
        if (d.size.length === 2) setInspectorSize(d.size[1]!);
      }}
      onResizeEnd={(d) => {
        if (d.size.length === 2) rememberInspectorSize(d.size[1]!);
      }}
    >
      {/* Ark sizes the panels and clips them; the scrolling happens one level in. */}
      <Splitter.Panel id="main" className="pane">
       <div className="page run-main">
        <BackLink />
        <div ref={sentinel} className="run-head-sentinel" aria-hidden="true" />
        <header className={`run-head ${stuck ? "stuck" : ""}`}>
          <div className="run-head-top">
            <h1>{trace.pipeline ?? "Unknown pipeline"}</h1>
            <StatusPill status={trace.stopped ? "stopped" : trace.status} label={trace.stopped ? "Stopped" : RUN_LABEL[trace.status]} />
            <span className="grow" />
            {controls && <RunActions runId={id} controls={controls} onChanged={() => reload.current()} />}
            <CopyButton text={id} label={`Run ${id.slice(0, 8)}`} />
          </div>
          <p className="run-facts">
            <span>{when(trace.start)}</span>
            <span>{trace.status === "waiting" ? `${duration(trace.active)} of work so far` : duration(trace.end - trace.start)}</span>
            {spent > 0 && <span>{money(spent)}</span>}
            {trace.tokens > 0 && <span>{count(trace.tokens)} tokens</span>}
            {trace.modelCalls > 0 && <span>{plural(trace.modelCalls, "model call")}</span>}
            {trace.toolCalls > 0 && <span>{plural(trace.toolCalls, "tool call")}</span>}
          </p>
          {controls?.budget && <BudgetMeter budget={controls.budget} spent={spent} canExtend={canExtend} onExtend={() => setExtending(true)} />}
        </header>
        {controls?.budget && (
          <ExtendDialog
            open={extending}
            onClose={() => setExtending(false)}
            limit={controls.budget.limit}
            resume={!controls.stoppable && !detail.paused}
            onDone={async (add) => {
              if (controls.stoppable || detail.paused) await api(`/api/runs/${id}/budget`, { method: "POST", body: JSON.stringify({ add }) });
              else await api(`/api/runs/${id}/resume`, { method: "POST", body: JSON.stringify({ addBudget: add }) });
              reload.current();
            }}
          />
        )}

        {error && <div className="callout error">{error}. Trying again…</div>}
        {detail.paused && trace.status === "waiting" && <WaitingBanner runId={id} paused={detail.paused} onAnswered={() => reload.current()} />}
        {trace.status === "failed" && (
          <div className={`callout ${trace.stopped ? "" : "error"}`}>
            <IconAlertTriangle size={16} stroke={1.75} />
            <div>
              <strong>{trace.stopped ? "This run was stopped" : ranOutOfBudget(trace) ? "This run ran out of budget" : "This run failed"}</strong>
              <Value value={trace.error} />
              {controls?.resumable && ranOutOfBudget(trace) && controls.budget && (
                <p className="callout-actions">
                  <button type="button" className="btn small primary" onClick={() => setExtending(true)}>
                    <IconCoin size={14} stroke={1.75} />
                    Add budget and resume
                  </button>
                </p>
              )}
              {!controls?.resumable && !controls?.rewindable && (trace.stopped || ranOutOfBudget(trace)) && <p className="muted">Its pipeline has no @checkpoint, so it can't be continued from here. Add @checkpoint to be able to resume runs like this.</p>}
            </div>
          </div>
        )}
        {trace.status === "unfinished" && (
          <div className="callout">
            <IconAlertTriangle size={16} stroke={1.75} />
            <div>
              <strong>This run never recorded an end</strong>
              <p>It was most likely stopped part-way, or the process running it was closed. What it did up to then is below.</p>
            </div>
          </div>
        )}

        {trace.hasOutput && (
          <section className="block output">
            <h2>Output</h2>
            <Field title={trace.status === "halted" ? "The value when it halted" : "What the pipeline returned"} value={trace.output} />
          </section>
        )}

        <section className="block">
          <div className="block-head trace-head">
            <h2>
              Trace <span className="muted">{plural(steps, "step")}</span>
            </h2>
            {steps > 0 && (
              <div className="trace-tools">
                {parents.length > 0 && (
                  <>
                    <Tip label="Show the steps inside every step">
                      <button type="button" className="btn small ghost" disabled={closed.size === 0} onClick={() => setClosed(new Set())}>
                        <IconChevronsDown size={14} stroke={1.75} />
                        Expand all
                      </button>
                    </Tip>
                    <Tip label="Show only the top-level steps">
                      <button type="button" className="btn small ghost" disabled={closed.size === parents.length} onClick={() => setClosed(new Set(parents))}>
                        <IconChevronsUp size={14} stroke={1.75} />
                        Collapse all
                      </button>
                    </Tip>
                  </>
                )}
                <Segments
                  small
                  label="Order of the steps"
                  value={order}
                  onChange={(v) => {
                    const o = v === "newest" ? "newest" : "oldest";
                    setOrder(o);
                    rememberOrder(o);
                  }}
                  options={[
                    { value: "oldest", label: "Oldest first" },
                    { value: "newest", label: "Newest first" },
                  ]}
                />
              </div>
            )}
          </div>
          {steps > 0 ? (
            <Waterfall
              trace={trace}
              selected={selected}
              onSelect={(sid) => setSelectedId(sid === selected?.id ? null : sid)}
              closed={closed}
              order={order}
              onToggle={(sid) => {
                const next = new Set(closed);
                if (!next.delete(sid)) next.add(sid);
                setClosed(next);
              }}
            />
          ) : (
            <p className="note">No steps recorded yet.</p>
          )}
          {steps > 0 && !selected && <p className="hint">Select a step to read its prompt, answer, and result.</p>}
        </section>
       </div>
      </Splitter.Panel>
      {selected && (
        <>
          <Splitter.ResizeTrigger id="main:inspector" className="grip" aria-label="Resize the details panel" />
          {/* The panel stays mounted while you move between steps, so it slides in once, not on every step. */}
          <Splitter.Panel id="inspector" className="pane inspector-pane">
            <aside className="inspector" aria-label="Step details">
              <Inspector key={selected.id} span={selected} trace={trace} onClose={() => setSelectedId(null)} />
            </aside>
          </Splitter.Panel>
        </>
      )}
    </Splitter.Root>
  );
}

function BackLink() {
  return (
    <a className="back" href="#/">
      <IconArrowLeft size={15} stroke={2} />
      All runs
    </a>
  );
}
