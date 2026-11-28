import { useEffect, useMemo, useState, type FormEvent } from "react";
import { PasswordInput } from "@ark-ui/react";
import { IconEye, IconEyeOff, IconPlus } from "@tabler/icons-react";
import "./App.css";
import { api, ApiError, message, saveToken, type PipelineInfo, type RunSummary } from "./api";
import { EvolveStart, EvolveView, evolveOutcome, type EvolveSummary } from "./Evolve";
import { clock, dayLabel, duration, money, ownerLabel } from "./format";
import { Pipelines, runStatus } from "./Pipelines";
import { RunView } from "./RunView";
import { RUN_LABEL } from "./trace";
import { HaloMark, Picker, rowKeys, Segments, StatusDot, useNow, usePoll } from "./ui";

type Route = { view: "home" } | { view: "run"; id: string } | { view: "evolve" } | { view: "evolve-run"; id: string };

function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  if (parts[0] === "runs" && parts[1]) return { view: "run", id: parts[1] };
  if (parts[0] === "evolve") return parts[1] ? { view: "evolve-run", id: parts[1] } : { view: "evolve" };
  return { view: "home" };
}

function useRoute(): Route {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const on = () => setHash(location.hash);
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return useMemo(() => parseRoute(hash), [hash]);
}

const go = (hash: string) => {
  location.hash = hash;
};

type Filter = "all" | "active" | "failed";
/** The pipeline filter's "no filter" choice. */
const EVERY = "*";
const SECTIONS = [
  { value: "runs", label: "Runs" },
  { value: "evolve", label: "Evolve" },
];

/** Rows under a heading for each day. */
function byDay<T>(items: T[], time: (item: T) => number | string): Array<{ day: string; items: T[] }> {
  const groups: Array<{ day: string; items: T[] }> = [];
  for (const item of items) {
    const day = dayLabel(time(item));
    const last = groups.at(-1);
    if (last?.day === day) last.items.push(item);
    else groups.push({ day, items: [item] });
  }
  return groups;
}

function RunList({ runs, selected, now, loaded }: { runs: RunSummary[]; selected: string | null; now: number; loaded: boolean }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [pipeline, setPipeline] = useState("");
  const names = useMemo(() => [...new Set(runs.map((r) => r.pipeline).filter((n): n is string => !!n))].sort(), [runs]);
  const pipelineOptions = useMemo(() => [{ value: EVERY, label: "Every pipeline" }, ...names.map((n) => ({ value: n, label: n }))], [names]);
  const counts = useMemo(() => {
    let active = 0;
    let failed = 0;
    for (const r of runs) {
      const s = runStatus(r, now);
      if (s === "running" || s === "waiting") active++;
      if (s === "failed") failed++;
    }
    return { active, failed };
  }, [runs, now]);
  const shown = runs.filter((r) => {
    if (pipeline && r.pipeline !== pipeline) return false;
    const s = runStatus(r, now);
    if (filter === "active") return s === "running" || s === "waiting";
    if (filter === "failed") return s === "failed";
    return true;
  });

  return (
    <>
      <div className="filters">
        <Segments
          small
          label="Show"
          value={filter}
          onChange={(v) => setFilter(v as Filter)}
          options={[
            { value: "all", label: "All" },
            { value: "active", label: "Active", count: counts.active },
            { value: "failed", label: "Failed", count: counts.failed },
          ]}
        />
        {names.length > 1 && <Picker small hideLabel label="Pipeline" value={pipeline || EVERY} onChange={(v) => setPipeline(v === EVERY ? "" : v)} options={pipelineOptions} />}
      </div>
      <nav className="list" aria-label="Runs" onKeyDown={rowKeys}>
        {loaded && runs.length === 0 && <p className="list-empty">No runs yet. Start one from a pipeline, or run one with the CLI in this folder.</p>}
        {runs.length > 0 && shown.length === 0 && (
          <p className="list-empty">
            Nothing matches.{" "}
            <button
              type="button"
              className="link"
              onClick={() => {
                setFilter("all");
                setPipeline("");
              }}
            >
              Show every run
            </button>
          </p>
        )}
        {byDay(shown, (r) => r.start_time).map((group) => (
          <section key={group.day}>
            <h3>{group.day}</h3>
            {group.items.map((r) => {
              const s = runStatus(r, now);
              const took = s === "running" ? now - r.start_time : r.end_time - r.start_time;
              return (
                <a key={r.run_id} data-row href={`#/runs/${r.run_id}`} className={`item ${selected === r.run_id ? "selected" : ""}`} aria-current={selected === r.run_id ? "page" : undefined}>
                  <StatusDot status={s} />
                  <span className="item-main">
                    <span className="item-title">{r.pipeline ?? "Unknown pipeline"}</span>
                    <span className="item-sub">{[s === "completed" ? "" : RUN_LABEL[s], s === "waiting" ? "" : duration(Math.max(0, took)), r.cost ? money(r.cost) : "", r.owner && r.owner !== "operator" ? ownerLabel(r.owner) : ""].filter(Boolean).join(" · ")}</span>
                  </span>
                  <time className="item-time">{clock(r.start_time)}</time>
                </a>
              );
            })}
          </section>
        ))}
      </nav>
    </>
  );
}

function EvolveList({ evolves, selected, loaded }: { evolves: EvolveSummary[]; selected: string | null; loaded: boolean }) {
  return (
    <nav className="list" aria-label="Evolve runs" onKeyDown={rowKeys}>
      {loaded && evolves.length === 0 && <p className="list-empty">No evolve runs yet. A pipeline needs about ten finished recorded runs before it can be evolved.</p>}
      {byDay(evolves, (e) => e.startedAt).map((group) => (
        <section key={group.day}>
          <h3>{group.day}</h3>
          {group.items.map((e) => {
            const outcome = evolveOutcome(e);
            return (
              <a key={e.id} data-row href={`#/evolve/${encodeURIComponent(e.id)}`} className={`item ${selected === e.id ? "selected" : ""}`} aria-current={selected === e.id ? "page" : undefined}>
                <StatusDot status={outcome.status} />
                <span className="item-main">
                  <span className="item-title">{e.pipeline}</span>
                  <span className="item-sub">
                    {e.status === "done" && e.winner ? `Winner ${e.winner}` : outcome.label}
                    {e.spent !== undefined ? ` · ${money(e.spent)}` : ""}
                    {e.variants ? ` · ${e.variants} variants` : ""}
                  </span>
                </span>
                <time className="item-time">{clock(e.startedAt)}</time>
              </a>
            );
          })}
        </section>
      ))}
    </nav>
  );
}

/** Shown when the server wants a token Studio doesn't have. */
function TokenGate({ wrong, onSaved }: { wrong: boolean; onSaved: () => void }) {
  const [token, setToken] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!token.trim()) return;
    saveToken(token.trim());
    onSaved();
  };
  return (
    <main className="gate">
      <form className="card" onSubmit={submit}>
        <HaloMark size={30} />
        <h1>This server needs its token</h1>
        <p className="muted">
          Paste the value of <code>HALO_SERVE_TOKEN</code>. It's kept for this tab only.
        </p>
        <PasswordInput.Root className="password" autoComplete="new-password">
          <PasswordInput.Label className="sr-only">Token</PasswordInput.Label>
          <PasswordInput.Control className="password-control">
            <PasswordInput.Input autoFocus value={token} onChange={(e) => setToken(e.target.value)} placeholder="Token" />
            <PasswordInput.VisibilityTrigger className="btn ghost icon" aria-label="Show or hide the token">
              <PasswordInput.Indicator fallback={<IconEyeOff size={16} stroke={1.75} />}>
                <IconEye size={16} stroke={1.75} />
              </PasswordInput.Indicator>
            </PasswordInput.VisibilityTrigger>
          </PasswordInput.Control>
        </PasswordInput.Root>
        {wrong && <p className="form-error">That token wasn't accepted.</p>}
        <button type="submit" className="btn primary" disabled={!token.trim()}>
          Open Studio
        </button>
      </form>
    </main>
  );
}

function App() {
  const route = useRoute();
  const mode = route.view === "evolve" || route.view === "evolve-run" ? "evolve" : "runs";
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [runsLoaded, setRunsLoaded] = useState(false);
  const [pipelines, setPipelines] = useState<PipelineInfo[]>([]);
  const [pipelinesLoaded, setPipelinesLoaded] = useState(false);
  const [evolves, setEvolves] = useState<EvolveSummary[]>([]);
  const [evolvesLoaded, setEvolvesLoaded] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [auth, setAuth] = useState<"ok" | "needed" | "wrong">("ok");
  const [attempt, setAttempt] = useState(0);

  const failed = (e: unknown) => {
    if (e instanceof ApiError && e.status === 401) setAuth((a) => (a === "ok" ? "needed" : a));
    else setProblem(message(e));
  };

  // Runs started by schedules, webhooks, the CLI, or approvals appear on their own.
  usePoll(
    async () => {
      if (auth !== "ok") return;
      try {
        setRuns(await api<RunSummary[]>("/api/runs?limit=200"));
        setRunsLoaded(true);
        setProblem(null);
      } catch (e) {
        failed(e);
      }
    },
    3000,
    [auth, attempt],
  );

  // Schedules move on, so the pipelines are re-read now and then.
  usePoll(
    async () => {
      if (auth !== "ok") return;
      try {
        setPipelines(await api<PipelineInfo[]>("/api/pipelines"));
        setPipelinesLoaded(true);
      } catch (e) {
        failed(e);
      }
    },
    30_000,
    [auth, attempt],
  );

  usePoll(
    async () => {
      if (auth !== "ok" || mode !== "evolve") return;
      try {
        setEvolves(await api<EvolveSummary[]>("/api/evolve"));
        setEvolvesLoaded(true);
      } catch (e) {
        failed(e);
      }
    },
    3000,
    [auth, attempt, mode],
  );

  const anyRunning = runs.some((r) => r.status === null);
  const now = useNow(anyRunning || route.view === "home");

  useEffect(() => {
    const name = route.view === "run" ? runs.find((r) => r.run_id === route.id)?.pipeline : route.view === "evolve" || route.view === "evolve-run" ? "Evolve" : null;
    document.title = name ? `${name} · Halo Studio` : "Halo Studio";
  }, [route, runs]);

  if (auth !== "ok") {
    return (
      <TokenGate
        wrong={auth === "wrong"}
        onSaved={() => {
          // If the new token is refused too, the next 401 says so.
          setAuth("ok");
          setAttempt((n) => n + 1);
          api("/api/health").catch((e) => {
            if (e instanceof ApiError && e.status === 401) setAuth("wrong");
          });
        }}
      />
    );
  }

  const detail = route.view === "run" || route.view === "evolve-run";
  return (
    <div className={`app ${detail ? "on-detail" : "on-home"}`}>
      <aside className="sidebar">
        <header className="brand">
          <a href="#/" className="brand-name">
            <HaloMark />
            <span>
              Halo <span className="muted">Studio</span>
            </span>
          </a>
        </header>
        <div className="sections">
          <Segments label="Section" value={mode} onChange={(v) => go(v === "evolve" ? "#/evolve" : "#/")} options={SECTIONS} />
        </div>
        {mode === "runs" ? (
          <>
            <a className={`btn new ${route.view === "home" ? "current" : ""}`} href="#/">
              <IconPlus size={15} stroke={2} />
              New run
            </a>
            <RunList runs={runs} selected={route.view === "run" ? route.id : null} now={now} loaded={runsLoaded} />
          </>
        ) : (
          <>
            <a className={`btn new ${route.view === "evolve" ? "current" : ""}`} href="#/evolve">
              <IconPlus size={15} stroke={2} />
              New evolve run
            </a>
            <EvolveList evolves={evolves} selected={route.view === "evolve-run" ? route.id : null} loaded={evolvesLoaded} />
          </>
        )}
        <footer className={`conn ${problem ? "down" : ""}`} role="status">
          <span className={`dot ${problem ? "error" : "ok"}`} aria-hidden="true" />
          {problem ? `${problem}. Trying again…` : location.host}
        </footer>
      </aside>

      <main className="main">
        {route.view === "home" && <Pipelines pipelines={pipelines} runs={runs} now={now} loaded={pipelinesLoaded} onStarted={(id) => go(`#/runs/${id}`)} />}
        {route.view === "run" && <RunView key={route.id} id={route.id} />}
        {route.view === "evolve" && <EvolveStart pipelines={pipelines} onStarted={(id) => go(`#/evolve/${encodeURIComponent(id)}`)} />}
        {route.view === "evolve-run" && <EvolveView key={route.id} id={route.id} />}
      </main>
    </div>
  );
}

export default App;
