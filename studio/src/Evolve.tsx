import { useEffect, useMemo, useState, type FormEvent } from "react";
import { NumberInput } from "@ark-ui/react";
import { IconArrowLeft, IconCheck, IconChevronDown, IconChevronUp, IconTrophy, IconX } from "@tabler/icons-react";
import { api, message } from "./api";
import { duration, money, plural } from "./format";
import { ConfirmDialog, CopyButton, Picker, rowKeys, StatusPill, TextField } from "./ui";

/** Evolve: start `halo evolve` runs, watch them, read the variants and their diffs, apply one. */

interface Score {
  won: number;
  tied: number;
  lost: number;
  scored: number;
  winRate: number;
  diverged: number;
  unreliable: boolean;
  costPerRun?: number;
  originalCostPerRun?: number;
}

interface FenceCheck {
  rule: string;
  ok: boolean;
  detail: string;
}

interface VariantRecord {
  id: string;
  round: number;
  parent: string;
  rationale: string;
  status: "invalid" | "outside" | "duplicate" | "scored" | "unscored";
  problems: string[];
  score?: Score;
  holdoutScore?: Score;
  fence?: FenceCheck[];
}

interface EvolveRecord {
  file: string;
  pipeline: string;
  seed: number;
  split: { proposal: string[]; holdout: string[] };
  models: { proposer?: string; judge?: string };
  budget: number;
  spent: number;
  winner?: string;
  verdict: string;
  variants: VariantRecord[];
}

export interface EvolveSummary {
  id: string;
  pipeline: string;
  file: string;
  startedAt: string;
  status: "running" | "done" | "error";
  winner?: string;
  verdict?: string;
  spent?: number;
  budget?: number;
  variants?: number;
}

interface EvolveDetail {
  id: string;
  status: "running" | "done" | "error";
  log: string[];
  /** What a running evolve is doing right now, and since when. */
  now?: string;
  nowSince?: string;
  error?: string;
  spent?: number;
  budget?: number;
  record?: EvolveRecord;
  diffs: Record<string, string>;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

const VARIANT_STATUS: Record<VariantRecord["status"], string> = {
  scored: "Scored",
  unscored: "Not scored",
  outside: "Reaches something new",
  invalid: "Doesn't parse",
  duplicate: "Same as another",
};

/** How an evolve run reads in a list: its state, and whether it found a winner. */
export function evolveOutcome(e: { status: string; winner?: string }): { status: string; label: string } {
  if (e.status === "running") return { status: "running", label: "Running" };
  if (e.status === "error") return { status: "failed", label: "Failed" };
  return e.winner ? { status: "completed", label: "Found a winner" } : { status: "halted", label: "No winner" };
}

function ScoreCell({ s }: { s?: Score }) {
  if (!s) return <span className="muted">—</span>;
  const tone = s.unreliable ? "unreliable" : s.winRate > 0.5 ? "good" : s.winRate === 0.5 ? "even" : "bad";
  return (
    <span className={`score ${tone}`} title={`${plural(s.scored, "run")} scored${s.diverged ? `, ${s.diverged} went a different way` : ""}`}>
      <strong>{pct(s.winRate)}</strong>
      <span className="wtl">
        {s.won} won · {s.tied} tied · {s.lost} lost
      </span>
      {s.costPerRun !== undefined && (s.costPerRun > 0 || (s.originalCostPerRun ?? 0) > 0) && <span className="wtl">{money(s.costPerRun)} a run</span>}
      {s.unreliable && <span className="tag">unreliable</span>}
    </span>
  );
}

function DiffView({ text }: { text: string }) {
  if (!text) return <p className="note">This variant is the same as the original.</p>;
  return (
    <pre className="diff">
      {text.split("\n").map((line, i) => (
        <div key={i} className={line.startsWith("@@") ? "hunk" : line.startsWith("+") && !line.startsWith("+++") ? "add" : line.startsWith("-") && !line.startsWith("---") ? "del" : ""}>
          {line || " "}
        </div>
      ))}
    </pre>
  );
}

/** A number with buttons to nudge it up and down; the arrow keys do the same. */
function Stepper({ label, note, value, onChange, min, max, step = 1 }: { label: string; note: string; value: string; onChange: (value: string) => void; min: number; max: number; step?: number }) {
  return (
    <NumberInput.Root className="form-field stepper" value={value} onValueChange={(d) => onChange(d.value)} min={min} max={max} step={step} allowMouseWheel={false}>
      <span className="label">
        <NumberInput.Label>{label}</NumberInput.Label>
        <span className="type">{note}</span>
      </span>
      <NumberInput.Control className="stepper-control">
        <NumberInput.Input />
        <span className="stepper-buttons">
          <NumberInput.IncrementTrigger aria-label={`More ${label.toLowerCase()}`}>
            <IconChevronUp size={12} stroke={2.25} />
          </NumberInput.IncrementTrigger>
          <NumberInput.DecrementTrigger aria-label={`Fewer ${label.toLowerCase()}`}>
            <IconChevronDown size={12} stroke={2.25} />
          </NumberInput.DecrementTrigger>
        </span>
      </NumberInput.Control>
    </NumberInput.Root>
  );
}

/** The page that starts an evolve run. */
export function EvolveStart({ pipelines, onStarted }: { pipelines: Array<{ name: string; file: string }>; onStarted: (id: string) => void }) {
  const [pipeline, setPipeline] = useState("");
  const [variants, setVariants] = useState("4");
  const [rounds, setRounds] = useState("2");
  const [budget, setBudget] = useState("3");
  const [criteria, setCriteria] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!pipeline && pipelines[0]) setPipeline(pipelines[0].name);
  }, [pipelines, pipeline]);

  const options = useMemo(() => pipelines.map((p) => ({ value: p.name, label: p.name })), [pipelines]);

  const start = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { id } = await api<{ id: string }>("/api/evolve", {
        method: "POST",
        body: JSON.stringify({ pipeline, variants: Number(variants), rounds: Number(rounds), budget: Number(budget), criteria: criteria || undefined }),
      });
      onStarted(id);
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page narrow">
      <header className="page-head">
        <h1>Evolve a pipeline</h1>
        <p className="muted">Let a model look for a better version of a pipeline, using runs you've already recorded. Nothing changes until you apply a variant.</p>
      </header>

      <ol className="how">
        <li>
          <strong>Propose</strong>
          <span>A model reads recorded runs and writes variants: sharper prompts, cheaper models, an extra check.</span>
        </li>
        <li>
          <strong>Fence</strong>
          <span>Any variant that would reach something new (a tool, a provider, a weaker policy) is thrown away.</span>
        </li>
        <li>
          <strong>Judge</strong>
          <span>The rest replay against recorded runs, and a judge compares each with the original, then again on runs the proposer never saw.</span>
        </li>
      </ol>

      <form className="card run-form evolve-form" onSubmit={start}>
        <Picker label="Pipeline" value={pipeline} onChange={setPipeline} options={options} disabled={options.length === 0} placeholder={options.length === 0 ? "No pipelines are being served" : "Choose a pipeline"} />
        <div className="row-3">
          <Stepper label="Variants" note="1 to 12 a round" value={variants} onChange={setVariants} min={1} max={12} />
          <Stepper label="Rounds" note="1 to 6" value={rounds} onChange={setRounds} min={1} max={6} />
          <Stepper label="Budget" note="USD, up to 100" value={budget} onChange={setBudget} min={0.5} max={100} step={0.5} />
        </div>
        <TextField multiline label="What better looks like" note="optional" value={criteria} onChange={setCriteria} placeholder="For example: shorter answers that still name the file and line." />
        <div className="run-form-foot">
          <button type="submit" className="btn primary" disabled={busy || !pipeline}>
            {busy ? "Starting…" : pipeline ? `Evolve ${pipeline}` : "Evolve"}
          </button>
          <span className="muted">Needs about ten finished recorded runs of the pipeline.</span>
        </div>
        {error && <p className="form-error">{error}</p>}
      </form>
    </div>
  );
}

/** One evolve run: progress while it runs, then the verdict, every variant, and the chosen one's diff. */
export function EvolveView({ id }: { id: string }) {
  const [d, setD] = useState<EvolveDetail | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    setD(null);
    setSelected(null);
    setApplied(null);
    setError(null);
    const load = async () => {
      try {
        const next = await api<EvolveDetail>(`/api/evolve/${id}`);
        if (stop) return;
        setD(next);
        setError(null);
        if (next.status === "running") timer = setTimeout(load, 2000);
      } catch (e) {
        if (stop) return;
        setError(message(e));
        timer = setTimeout(load, 5000);
      }
    };
    void load();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [id]);

  useEffect(() => {
    if (d?.record && !selected) setSelected(d.record.winner ?? d.record.variants.find((v) => v.status === "scored")?.id ?? d.record.variants[0]?.id ?? null);
  }, [d, selected]);

  const apply = async () => {
    if (!confirming) return;
    setApplying(true);
    try {
      const r = await api<{ applied: string; file: string; note: string }>(`/api/evolve/${id}/apply`, { method: "POST", body: JSON.stringify({ variant: confirming }) });
      setApplied(`${r.applied} is now in ${r.file}. Restart halo serve to serve the new version.`);
      setError(null);
    } catch (e) {
      setError(message(e));
    } finally {
      setApplying(false);
      setConfirming(null);
    }
  };

  const back = (
    <a className="back" href="#/evolve">
      <IconArrowLeft size={15} stroke={2} />
      Evolve runs
    </a>
  );
  if (!d) return <div className="page">{back}{error ? <div className="callout error">{error}</div> : <p className="loading">Loading…</p>}</div>;

  const r = d.record;
  const v = r?.variants.find((x) => x.id === selected);
  const outcome = evolveOutcome({ status: d.status, winner: r?.winner });
  const canApply = (x: VariantRecord) => x.status === "scored" || x.status === "unscored";

  return (
    <div className="page">
      {back}
      <header className="run-head">
        <div className="run-head-top">
          <h1>{r ? `Evolving ${r.pipeline}` : id}</h1>
          <StatusPill status={outcome.status} label={outcome.label} />
        </div>
        <p className="run-facts">
          {r && <span className="mono">{r.file}</span>}
          {d.spent !== undefined && (
            <span>
              {money(d.spent)} spent{d.budget !== undefined ? ` of $${d.budget.toFixed(2)}` : ""}
            </span>
          )}
          {r && <span>{plural(r.variants.length, "variant")}</span>}
        </p>
      </header>

      {error && <div className="callout error">{error}</div>}
      {applied && (
        <div className="callout ok">
          <IconCheck size={16} stroke={2} />
          <div>{applied}</div>
        </div>
      )}

      {r && (
        <section className={`verdict ${r.winner ? "won" : ""}`}>
          {r.winner && <IconTrophy size={18} stroke={1.75} />}
          <div>
            <p className="verdict-text">{r.verdict}</p>
            <p className="muted">
              {plural(r.split.proposal.length, "run")} for the proposer to learn from, {r.split.holdout.length} held back to check the result. Proposer {r.models.proposer}, judge {r.models.judge}.
            </p>
          </div>
        </section>
      )}

      {d.status !== "done" && (
        <section className="block">
          <h2>Progress</h2>
          {d.error && <div className="callout error">{d.error}</div>}
          {d.status === "running" && (
            <div className="log">
              {d.log.length > 0 && <pre>{d.log.join("\n")}</pre>}
              <p className="log-now" aria-live="polite">
                <span className="dot running" aria-hidden="true" />
                <span>{d.now ?? (d.log.length ? "Working…" : "Starting…")}</span>
                {d.nowSince && <span className="muted">{duration(Date.now() - Date.parse(d.nowSince))}</span>}
              </p>
            </div>
          )}
          {d.status === "error" && d.log.length > 0 && <pre className="log">{d.log.join("\n")}</pre>}
        </section>
      )}

      {r && (
        <>
          <section className="block">
            <h2>Variants</h2>
            <div className="table-wrap" onKeyDown={rowKeys}>
              <table className="variants">
                <thead>
                  <tr>
                    <th>Variant</th>
                    <th>Status</th>
                    <th>Against runs the proposer saw</th>
                    <th>Against held-back runs</th>
                    <th>Why</th>
                  </tr>
                </thead>
                <tbody>
                  {r.variants.map((x) => (
                    <tr key={x.id} className={x.id === selected ? "selected" : ""} onClick={() => setSelected(x.id)}>
                      <td>
                        <button type="button" className="variant-id mono" data-row aria-current={x.id === selected ? "true" : undefined}>
                          {x.id}
                        </button>
                        {x.id === r.winner && <span className="tag win">winner</span>}
                        <div className="muted small">from {x.parent}</div>
                      </td>
                      <td>
                        <span className={`vstatus ${x.status}`}>{VARIANT_STATUS[x.status]}</span>
                      </td>
                      <td>
                        <ScoreCell s={x.score} />
                      </td>
                      <td>
                        <ScoreCell s={x.holdoutScore} />
                      </td>
                      <td className="rationale">{x.rationale || <span className="muted">{x.problems[0]}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {v && (
            <section className="block">
              <div className="block-head">
                <h2>
                  <span className="mono">{v.id}</span>
                  {v.id === r.winner && <span className="tag win">winner</span>}
                </h2>
                {canApply(v) && (
                  <button type="button" className="btn primary" onClick={() => setConfirming(v.id)}>
                    Apply {v.id}…
                  </button>
                )}
              </div>
              {v.rationale && <p className="lead">{v.rationale}</p>}
              {v.problems.length > 0 && (
                <ul className="problems">
                  {v.problems.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              )}
              {v.fence && v.fence.length > 0 && (
                <ul className="fence">
                  {v.fence.map((c) => (
                    <li key={c.rule} className={c.ok ? "ok" : "bad"}>
                      {c.ok ? <IconCheck size={14} stroke={2.5} aria-label="passes" /> : <IconX size={14} stroke={2.5} aria-label="fails" />}
                      <span className="mono">{c.rule}</span>
                      <span className="muted">{c.detail}</span>
                    </li>
                  ))}
                </ul>
              )}
              <DiffView text={d.diffs[v.id] ?? ""} />
              {canApply(v) && (
                <p className="hint cli">
                  From a terminal: <code>halo evolve apply .halo/evolve/{id} {v.id}</code>
                  <CopyButton text={`halo evolve apply .halo/evolve/${id} ${v.id}`} />
                  Add <code>--pr</code> to open a pull request instead.
                </p>
              )}
            </section>
          )}
        </>
      )}

      <ConfirmDialog
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        title={`Apply ${confirming ?? ""}?`}
        actions={
          <>
            <button type="button" className="btn" onClick={() => setConfirming(null)}>
              Cancel
            </button>
            <button type="button" className="btn primary" disabled={applying} onClick={apply}>
              {applying ? "Writing…" : `Write to ${r?.file ?? "the file"}`}
            </button>
          </>
        }
      >
        <p>
          This overwrites <code>{r?.file}</code> with the variant. Read the diff first; git is the way back.
        </p>
        <p className="muted">The server keeps serving the version it loaded until you restart it.</p>
      </ConfirmDialog>
    </div>
  );
}
