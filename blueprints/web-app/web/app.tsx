// The browser side. It never talks to a model or to Halo directly: it calls our own
// backend (app.ts), which owns the keys, the user's identity, and the runs.

import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { PublicEvent } from "../app.ts";

type Step = { label: string; status: "start" | "end" };
type Paused = Extract<PublicEvent, { type: "paused" }>;
type Done = Extract<PublicEvent, { type: "done" }>;
type Triage = { category?: string; mood?: string; summary?: string };
type Order = { id: string; item?: string; customer?: string; status?: string; shipping?: string; shipped_on?: string; business_days_in_transit?: number | null };
type Check = { ok?: boolean; problems?: string[] };

async function post(path: string, body: unknown) {
  const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

function App() {
  const [me, setMe] = useState<{ userId: string; spent: number; cap: number; mocked: boolean }>();
  const [message, setMessage] = useState("Hi, my lamp (order A1001) still hasn't arrived. It's been ages. This is ridiculous.");
  const [runId, setRunId] = useState<string>();
  const [steps, setSteps] = useState<Step[]>([]);
  const [blocked, setBlocked] = useState<string[]>([]);
  const [paused, setPaused] = useState<Paused>();
  const [edited, setEdited] = useState("");
  const [done, setDone] = useState<Done>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const source = useRef<EventSource | null>(null);

  const refreshMe = () => fetch("/api/me").then((r) => r.json()).then(setMe);
  useEffect(() => { refreshMe(); }, []);

  // Follow a run. EventSource reconnects by itself, and the server replays what we missed.
  useEffect(() => {
    if (!runId) return;
    const es = new EventSource(`/api/runs/${runId}/events`);
    source.current = es;
    es.onmessage = (msg) => {
      const e = JSON.parse(msg.data) as PublicEvent;
      if (e.type === "stage") setSteps((s) => (e.status === "start" ? [...s, e] : s.map((x) => (x.label === e.label && x.status === "start" ? e : x))));
      if (e.type === "blocked") setBlocked((b) => [...b, `${e.policy}: ${e.rule}`]);
      if (e.type === "paused") { setPaused(e); setEdited(String(e.draft ?? "")); setBusy(false); }
      if (e.type === "done") { setDone(e); setPaused(undefined); setBusy(false); es.close(); refreshMe(); }
    };
    return () => es.close();
  }, [runId]);

  async function start() {
    setError(undefined); setSteps([]); setBlocked([]); setPaused(undefined); setDone(undefined); setBusy(true);
    try { setRunId((await post("/api/drafts", { message })).runId); }
    catch (e) { setError((e as Error).message); setBusy(false); }
  }

  async function decide(approved: boolean) {
    if (!runId || !paused) return;
    const reply = approved && edited !== String(paused.draft) ? edited : undefined;
    setPaused(undefined); setBusy(true);
    try { await post(`/api/runs/${runId}/answer`, { approved, reply }); }
    catch (e) { setError((e as Error).message); setBusy(false); }
  }

  const triage = (paused?.triage ?? {}) as Triage;
  const order = (paused?.order ?? null) as Order | null;
  const check = (paused?.check ?? {}) as Check;

  return (
    <main>
      <header>
        <h1>Reply desk</h1>
        {me && <p className="muted">Signed in as <code>{me.userId}</code> · spent ${me.spent.toFixed(3)} of ${me.cap.toFixed(2)}{me.mocked && " · offline (canned answers)"}</p>}
      </header>

      <section className="card">
        <label htmlFor="msg">Customer message</label>
        <textarea id="msg" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} disabled={busy || !!paused} />
        <button onClick={start} disabled={busy || !!paused || !message.trim()}>Draft a reply</button>
        {error && <p className="error">{error}</p>}
      </section>

      {steps.length > 0 && (
        <section className="card">
          <h2>Progress</h2>
          <ol className="steps">
            {steps.map((s, i) => <li key={i} className={s.status}>{s.label}</li>)}
          </ol>
          {blocked.map((b, i) => <p key={i} className="error">Blocked by policy {b}</p>)}
        </section>
      )}

      {paused && (
        <section className="card highlight">
          <h2>{paused.message}</h2>
          {triage.category && <p className="muted"><span className="tag">{triage.category}</span> <span className="tag">{triage.mood}</span> {triage.summary}</p>}
          <p className="muted">
            {order
              ? <>Order <code>{order.id}</code>: {order.item} for {order.customer} · {order.status?.replace("_", " ")} ({order.shipping}){order.business_days_in_transit != null && <> · {order.business_days_in_transit} business days since it shipped</>}</>
              : "No matching order found: the draft can't rely on order details."}
          </p>
          {check.ok === false
            ? <div className="warn"><strong>The checker found problems:</strong><ul>{(check.problems ?? []).map((p, i) => <li key={i}>{p}</li>)}</ul></div>
            : check.ok === true && <p className="ok">✓ Checked against the shipping policy and voice guide</p>}
          <textarea rows={10} value={edited} onChange={(e) => setEdited(e.target.value)} />
          <div className="row">
            <button onClick={() => decide(true)}>{edited !== String(paused.draft) ? "Send my edit" : "Approve"}</button>
            <button className="secondary" onClick={() => decide(false)}>Reject</button>
          </div>
        </section>
      )}

      {done && (
        <section className="card">
          <h2>{done.status === "completed" ? "Sent ✓" : done.status === "halted" ? "Rejected" : "Something went wrong"}</h2>
          {done.status === "completed" && <pre>{String(done.output)}</pre>}
          {done.error && <p className="error">Error: {done.error}</p>}
          <p className="muted">This run cost ${done.cost.toFixed(4)}.{done.status === "completed" && " Approved replies are remembered, so the next draft matches your style."}</p>
        </section>
      )}
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
