import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Splitter } from "@ark-ui/react";
import { IconAlertTriangle, IconArrowLeft, IconBrain, IconChevronDown, IconChevronRight, IconExternalLink, IconHandStop, IconPointFilled, IconTool, IconX } from "@tabler/icons-react";
import { api, message, type RunDetail } from "./api";
import { clock, count, duration, money, plural, when } from "./format";
import { axisTicks, tickLabel, buildTrace, parsePayload, RUN_LABEL, type Pause, type Span, type Trace } from "./trace";
import { CopyButton, Field, rowKeys, StatusPill, Tip, useNow, Value } from "./ui";

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function KindIcon({ kind, size = 15 }: { kind: Span["kind"]; size?: number }) {
  if (kind === "model") return <IconBrain size={size} stroke={1.75} />;
  if (kind === "tool") return <IconTool size={size} stroke={1.75} />;
  return <IconPointFilled size={size} />;
}

const shortModel = (model: string) => model.slice(model.lastIndexOf("/") + 1);

type Row = { span: Span; parent?: Span } | { pause: Pause };

/** The tree as the rows to draw, with a marker wherever the run sat waiting. */
function rowsOf(trace: Trace, closed: Set<string>): Row[] {
  const rows: Row[] = [];
  const pauses = [...trace.pauses];
  for (const span of trace.spans) {
    while (pauses[0] && span.start >= pauses[0].start) rows.push({ pause: pauses.shift()! });
    rows.push({ span });
    if (!closed.has(span.id)) for (const child of span.children) rows.push({ span: child, parent: span });
  }
  for (const pause of pauses) rows.push({ pause });
  return rows;
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

function Waterfall({ trace, selected, onSelect }: { trace: Trace; selected?: Span; onSelect: (id: string) => void }) {
  const [closed, setClosed] = useState<Set<string>>(() => new Set());
  const rows = useMemo(() => rowsOf(trace, closed), [trace, closed]);
  const total = Math.max(trace.active, 1);
  const ticks = axisTicks(total);
  const toggle = (id: string) => {
    const next = new Set(closed);
    if (!next.delete(id)) next.add(id);
    setClosed(next);
  };

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
          if ("pause" in row) {
            const p = row.pause;
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
  const extra = call ? Object.entries(call).filter(([k, v]) => !["system", "prompt", "output", "cost", "mocked"].includes(k) && v !== null && v !== undefined) : [];
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
            <Field title="Answer" value={callOutput} />
          </>
        )}
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

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    setDetail(null);
    setError(null);
    setSelectedId(null);
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
        if (status === "running") next = 1500;
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
        <header className="run-head">
          <div className="run-head-top">
            <h1>{trace.pipeline ?? "Unknown pipeline"}</h1>
            <StatusPill status={trace.status} label={RUN_LABEL[trace.status]} />
            <span className="grow" />
            <CopyButton text={id} label={`Run ${id.slice(0, 8)}`} />
          </div>
          <p className="run-facts">
            <span>{when(trace.start)}</span>
            <span>{trace.status === "waiting" ? `${duration(trace.active)} of work so far` : duration(trace.end - trace.start)}</span>
            {trace.cost !== undefined && trace.cost > 0 && <span>{money(trace.cost)}</span>}
            {trace.tokens > 0 && <span>{count(trace.tokens)} tokens</span>}
            {trace.modelCalls > 0 && <span>{plural(trace.modelCalls, "model call")}</span>}
            {trace.toolCalls > 0 && <span>{plural(trace.toolCalls, "tool call")}</span>}
          </p>
        </header>

        {error && <div className="callout error">{error}. Trying again…</div>}
        {detail.paused && trace.status === "waiting" && <WaitingBanner runId={id} paused={detail.paused} onAnswered={() => reload.current()} />}
        {trace.status === "failed" && (
          <div className="callout error">
            <IconAlertTriangle size={16} stroke={1.75} />
            <div>
              <strong>This run failed</strong>
              <Value value={trace.error} />
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
          <h2>
            Trace <span className="muted">{plural(steps, "step")}</span>
          </h2>
          {steps > 0 ? <Waterfall trace={trace} selected={selected} onSelect={(sid) => setSelectedId(sid === selected?.id ? null : sid)} /> : <p className="note">No steps recorded yet.</p>}
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
