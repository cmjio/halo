import { useEffect, useState } from 'react';
import { IconCheck, IconX } from '@tabler/icons-react';

/** The Evolve tab: start `halo evolve` runs, watch them, read the variants and their diffs, apply one. */

type Api = <T>(path: string, init?: RequestInit) => Promise<T>;

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

interface FenceCheck { rule: string; ok: boolean; detail: string }

interface VariantRecord {
  id: string;
  round: number;
  parent: string;
  rationale: string;
  status: 'invalid' | 'outside' | 'duplicate' | 'scored' | 'unscored';
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
  status: 'running' | 'done' | 'error';
  winner?: string;
  verdict?: string;
  spent?: number;
  budget?: number;
  variants?: number;
}

interface EvolveDetail {
  id: string;
  status: 'running' | 'done' | 'error';
  log: string[];
  error?: string;
  spent?: number;
  budget?: number;
  record?: EvolveRecord;
  diffs: Record<string, string>;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
const money = (n?: number) => (n === undefined ? '' : `$${n.toFixed(4)}`);

function ScoreCell({ s }: { s?: Score }) {
  if (!s) return <span className="muted">—</span>;
  const cls = s.unreliable ? 'unreliable' : s.winRate > 0.5 ? 'good' : s.winRate === 0.5 ? 'even' : 'bad';
  return (
    <span className={`score ${cls}`} title={`${s.scored} run(s) scored${s.diverged ? `, ${s.diverged} diverged` : ''}`}>
      <strong>{pct(s.winRate)}</strong> <span className="wtl">{s.won}·{s.tied}·{s.lost}</span>
      {s.costPerRun !== undefined && (s.costPerRun > 0 || (s.originalCostPerRun ?? 0) > 0) && <span className="cost">{money(s.costPerRun)}</span>}
      {s.unreliable && <span className="flag">unreliable</span>}
    </span>
  );
}

function DiffView({ text }: { text: string }) {
  if (!text) return <p className="muted">No change.</p>;
  return (
    <pre className="diff">
      {text.split('\n').map((line, i) => (
        <div key={i} className={line.startsWith('@@') ? 'hunk' : line.startsWith('+') && !line.startsWith('+++') ? 'add' : line.startsWith('-') && !line.startsWith('---') ? 'del' : ''}>{line || ' '}</div>
      ))}
    </pre>
  );
}

/** The form in the sidebar that starts a run. */
export function EvolveStart({ api, pipelines, onStarted }: { api: Api; pipelines: Array<{ name: string; file: string }>; onStarted: (id: string) => void }) {
  const [pipeline, setPipeline] = useState('');
  const [variants, setVariants] = useState('4');
  const [rounds, setRounds] = useState('2');
  const [budget, setBudget] = useState('3.00');
  const [criteria, setCriteria] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!pipeline && pipelines[0]) setPipeline(pipelines[0].name); }, [pipelines, pipeline]);
  const start = async () => {
    setError(null);
    setBusy(true);
    try {
      const { id } = await api<{ id: string }>('/api/evolve', { method: 'POST', body: JSON.stringify({ pipeline, variants: Number(variants), rounds: Number(rounds), budget: Number(budget), criteria: criteria || undefined }) });
      onStarted(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="pipeline-form evolve-form">
      <label>Pipeline
        <select value={pipeline} onChange={(e) => setPipeline(e.target.value)}>
          {pipelines.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
        </select>
      </label>
      <div className="evolve-numbers">
        <label>Variants <input value={variants} onChange={(e) => setVariants(e.target.value)} inputMode="numeric" /></label>
        <label>Rounds <input value={rounds} onChange={(e) => setRounds(e.target.value)} inputMode="numeric" /></label>
        <label>Budget $ <input value={budget} onChange={(e) => setBudget(e.target.value)} inputMode="decimal" /></label>
      </div>
      <label>Criteria <span className="param-type">what a better output looks like (optional)</span>
        <textarea rows={3} value={criteria} onChange={(e) => setCriteria(e.target.value)} />
      </label>
      <button className="run-button" disabled={busy || !pipeline} onClick={start}>{busy ? 'Starting…' : `Evolve ${pipeline}`}</button>
      <p className="hint">A model proposes rewrites; any that reach something new are thrown away; the rest are judged against the original on recorded runs. Nothing changes until you apply one.</p>
      {error && <div className="form-error">{error}</div>}
    </div>
  );
}

/** One evolve run: progress while it runs, then the verdict, every variant, and the chosen one's diff. */
export function EvolveView({ api, id }: { api: Api; id: string }) {
  const [d, setD] = useState<EvolveDetail | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    setD(null);
    setSelected(null);
    setApplied(null);
    const load = async () => {
      try {
        const next = await api<EvolveDetail>(`/api/evolve/${id}`);
        if (stop) return;
        setD(next);
        setError(null);
        if (next.status === 'running') timer = setTimeout(load, 2000);
      } catch (e) {
        if (!stop) setError(e instanceof Error ? e.message : String(e));
      }
    };
    load();
    return () => { stop = true; clearTimeout(timer); };
  }, [id, api]);

  useEffect(() => {
    if (d?.record && !selected) setSelected(d.record.winner ?? d.record.variants.find((v) => v.status === 'scored')?.id ?? null);
  }, [d, selected]);

  const apply = async (variant: string) => {
    if (!d?.record) return;
    if (!confirm(`Write ${variant} over ${d.record.file}? Review the diff first. The server keeps serving the version it loaded until restarted.`)) return;
    try {
      const r = await api<{ applied: string; file: string; note: string }>(`/api/evolve/${id}/apply`, { method: 'POST', body: JSON.stringify({ variant }) });
      setApplied(`${r.applied} written to ${r.file}. ${r.note}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  if (error && !d) return <div className="evolve-view"><div className="banner error">{error}</div></div>;
  if (!d) return <div className="evolve-view"><p className="muted">Loading…</p></div>;
  const r = d.record;
  const v = r?.variants.find((x) => x.id === selected);
  return (
    <div className="evolve-view">
      {error && <div className="banner error">{error}</div>}
      {applied && <div className="banner applied">{applied}</div>}
      <header className="evolve-header">
        <h2>{r ? `Evolving ${r.pipeline}` : id}</h2>
        <span className={`run-status ${d.status === 'done' ? 'completed' : d.status}`}>{d.status}</span>
        {d.spent !== undefined && <span className="muted">spent {money(d.spent)}{d.budget !== undefined ? ` of $${d.budget.toFixed(2)}` : ''}</span>}
      </header>
      {r && (
        <section className={`verdict ${r.winner ? 'won' : 'none'}`}>
          <p>{r.verdict}</p>
          <p className="muted">
            {r.file} · {r.split.proposal.length} runs to propose from, {r.split.holdout.length} held out (seed {r.seed}) · proposer {r.models.proposer} · judge {r.models.judge}
          </p>
        </section>
      )}
      {d.status !== 'done' && (
        <section>
          <h3>Progress</h3>
          {d.error && <div className="banner error">{d.error}</div>}
          <pre className="evolve-log">{d.log.length ? d.log.join('\n') : 'Proposing the first rewrite…'}</pre>
        </section>
      )}
      {r && (
        <>
          <section>
            <h3>Variants</h3>
            <table className="variants">
              <thead>
                <tr><th>Variant</th><th>From</th><th>Status</th><th>Runs the proposer saw</th><th>Held out</th><th>Rationale</th></tr>
              </thead>
              <tbody>
                {r.variants.map((x) => (
                  <tr key={x.id} className={`${x.id === selected ? 'active' : ''} ${x.id === r.winner ? 'winner' : ''}`} onClick={() => setSelected(x.id)}>
                    <td className="mono">{x.id}{x.id === r.winner && <span className="flag win">winner</span>}</td>
                    <td className="mono muted">{x.parent}</td>
                    <td><span className={`vstatus ${x.status}`}>{x.status === 'outside' ? 'outside the fence' : x.status}</span></td>
                    <td><ScoreCell s={x.score} /></td>
                    <td><ScoreCell s={x.holdoutScore} /></td>
                    <td className="rationale">{x.rationale || <span className="muted">{x.problems[0]}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          {v && (
            <section className="variant-detail">
              <div className="variant-head">
                <h3>{v.id}</h3>
                {(v.status === 'scored' || v.status === 'unscored') && (
                  <button className="run-button" onClick={() => apply(v.id)}>Apply {v.id}</button>
                )}
              </div>
              {v.rationale && <p>{v.rationale}</p>}
              {v.problems.length > 0 && <ul className="problems">{v.problems.map((p) => <li key={p}>{p}</li>)}</ul>}
              {v.fence && (
                <table className="fence">
                  <tbody>
                    {v.fence.map((c) => (
                      <tr key={c.rule}><td className={c.ok ? 'ok' : 'bad'}>{c.ok ? <IconCheck size={14} stroke={2.5} aria-label="passes" /> : <IconX size={14} stroke={2.5} aria-label="fails" />}</td><td className="mono">{c.rule}</td><td className="muted">{c.detail}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
              <DiffView text={d.diffs[v.id] ?? ''} />
              {(v.status === 'scored' || v.status === 'unscored') && (
                <p className="hint">From a terminal: <code>halo evolve apply .halo/evolve/{id} {v.id}</code>, or add <code>--pr</code> to open a pull request instead.</p>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
