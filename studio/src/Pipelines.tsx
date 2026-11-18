import { useState, type FormEvent } from "react";
import { Switch } from "@ark-ui/react";
import { IconClock, IconPlayerPlayFilled, IconWebhook } from "@tabler/icons-react";
import { api, message, type PipelineInfo, type RunSummary } from "./api";
import { cronInWords, dayLabel, until, when } from "./format";
import { RUN_LABEL, type RunStatus } from "./trace";
import { CopyButton, StatusDot, TextField, Tip } from "./ui";


const ARGS_KEY = "halo-args:";

function remembered(name: string): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(ARGS_KEY + name) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

/** What a field's text means for its type, or why it can't be used. */
function readArg(text: string, type: string): { value: unknown } | { problem: string } {
  if (type === "String") return { value: text };
  if (text.trim() === "") return { problem: "needs a value" };
  if (type === "Number") {
    const n = Number(text);
    return Number.isFinite(n) ? { value: n } : { problem: "must be a number" };
  }
  if (type === "Boolean") return { value: text === "true" };
  // Lists, records and declared types: JSON when it parses, otherwise the text as written.
  try {
    return { value: JSON.parse(text) };
  } catch {
    return { value: text };
  }
}

export function runStatus(r: RunSummary, now: number): RunStatus {
  if (r.status === "paused") return "waiting";
  if (r.status === "error") return "failed";
  if (r.status === "completed" || r.status === "halted") return r.status;
  return r.running || now - r.end_time < 5 * 60_000 ? "running" : "unfinished";
}

function PipelineCard({ p, runs, now, onStarted }: { p: PipelineInfo; runs: RunSummary[]; now: number; onStarted: (runId: string) => void }) {
  const [values, setValues] = useState<Record<string, string>>(() => remembered(p.name));
  const [problems, setProblems] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const start = async (e: FormEvent) => {
    e.preventDefault();
    const args: Record<string, unknown> = {};
    const found: Record<string, string> = {};
    for (const param of p.params) {
      const read = readArg(values[param.name] ?? (param.type === "Boolean" ? "false" : ""), param.type);
      if ("problem" in read) found[param.name] = read.problem;
      else args[param.name] = read.value;
    }
    setProblems(found);
    if (Object.keys(found).length) return;
    setError(null);
    setBusy(true);
    try {
      const { runId } = await api<{ runId: string }>(`/api/pipelines/${p.name}/runs`, { method: "POST", body: JSON.stringify({ args }) });
      try {
        localStorage.setItem(ARGS_KEY + p.name, JSON.stringify(values));
      } catch {}
      onStarted(runId);
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  };

  const recent = runs.filter((r) => r.pipeline === p.name).slice(0, 12);
  const set = (name: string, v: string) => {
    setValues({ ...values, [name]: v });
    if (problems[name]) setProblems({ ...problems, [name]: "" });
  };

  return (
    <article className="card pipeline">
      <header className="pipeline-head">
        <div>
          <h2>{p.name}</h2>
          <p className="mono muted">{p.file}</p>
        </div>
        {recent.length > 0 && (
          <div className="history" aria-label="Recent runs, newest last">
            {recent.map((r) => (
              <Tip key={r.run_id} label={`${RUN_LABEL[runStatus(r, now)]} · ${when(r.start_time)}`}>
                <a href={`#/runs/${r.run_id}`} aria-label={`${RUN_LABEL[runStatus(r, now)]}, ${when(r.start_time)}`}>
                  <StatusDot status={runStatus(r, now)} />
                </a>
              </Tip>
            ))}
            <span className="history-label">Recent runs</span>
          </div>
        )}
      </header>

      {(p.schedules.length > 0 || p.webhooks.length > 0) && (
        <ul className="triggers">
          {p.schedules.map((s) => (
            <li key={s.cron}>
              <IconClock size={15} stroke={1.75} />
              <span>
                {cronInWords(s.cron)}
                {s.tz ? <span className="muted"> ({s.tz})</span> : null}
              </span>
              {s.next && (
                <span className="muted">
                  next {until(s.next, now)}, {dayLabel(s.next).toLowerCase()} at {new Date(s.next).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </li>
          ))}
          {p.webhooks.map((w) => (
            <li key={w}>
              <IconWebhook size={15} stroke={1.75} />
              <span className="mono">POST {w}</span>
              <CopyButton text={location.origin + w} label="Copy URL" />
            </li>
          ))}
        </ul>
      )}

      <form className="run-form" onSubmit={start} noValidate>
        {p.params.map((param) =>
          param.type === "Boolean" ? (
            <Switch.Root key={param.name} className="switch" checked={values[param.name] === "true"} onCheckedChange={(d) => set(param.name, String(d.checked))}>
              <Switch.Label className="label">
                {param.name} <span className="type">{param.type}</span>
              </Switch.Label>
              <Switch.Control className="switch-track">
                <Switch.Thumb className="switch-thumb" />
              </Switch.Control>
              <Switch.HiddenInput />
            </Switch.Root>
          ) : (
            <TextField
              key={param.name}
              label={param.name}
              note={param.type}
              problem={problems[param.name] || undefined}
              value={values[param.name] ?? ""}
              onChange={(v) => set(param.name, v)}
              inputMode={param.type === "Number" ? "decimal" : undefined}
              placeholder={param.type === "String" || param.type === "Number" ? undefined : "JSON, or plain text"}
            />
          ),
        )}
        <div className="run-form-foot">
          <button type="submit" className="btn primary" disabled={busy}>
            <IconPlayerPlayFilled size={13} />
            {busy ? "Starting…" : `Run ${p.name}`}
          </button>
          {p.returnType && (
            <span className="muted mono">
              returns {p.returnType}
            </span>
          )}
        </div>
        {error && <p className="form-error">{error}</p>}
      </form>
    </article>
  );
}

/** Home: every pipeline this server runs, how each gets started, and a form to start one now. */
export function Pipelines({ pipelines, runs, now, loaded, onStarted }: { pipelines: PipelineInfo[]; runs: RunSummary[]; now: number; loaded: boolean; onStarted: (runId: string) => void }) {
  return (
    <div className="page">
      <header className="page-head">
        <h1>Pipelines</h1>
        <p className="muted">Start a run here, or pick one from the list to see what it did. Runs from schedules, webhooks, and the CLI in this folder show up on their own.</p>
      </header>
      {loaded && pipelines.length === 0 && (
        <div className="blank">
          <h2>This server isn't serving any pipelines</h2>
          <p>
            Point <code>halo serve</code> at a folder of <code>.halo</code> files, or list them under <code>files</code> in <code>halo.json</code>.
          </p>
        </div>
      )}
      <div className="pipelines">
        {pipelines.map((p) => (
          <PipelineCard key={p.name} p={p} runs={runs} now={now} onStarted={onStarted} />
        ))}
      </div>
    </div>
  );
}
