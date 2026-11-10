/**
 * The backend for a web app built on Halo: the piece that sits between a browser and
 * the Halo runtime. It owns everything Halo deliberately leaves to the host application:
 *
 *  - who the user is (a session cookie), and filling `user_id` in from it, never from the
 *    request body, so a user can't read or write someone else's @thread state;
 *  - which runs belong to whom, so only the user who started a run can watch or answer it;
 *  - turning runtime events into a small, safe stream for the browser (Server-Sent
 *    Events), without prompts, system prompts, or raw model output;
 *  - limits per user: one run at a time, and a spend cap;
 *  - mapping a click on "Approve" to `runtime.signal(...)`.
 *
 * `createApp` returns a `fetch` handler, so it can be tested without a network
 * (see test/web-app.test.ts) and mounted in `Bun.serve` (see server.ts).
 */

import { compile, FileRunStore, HaloError, HaloRuntime, type MockValue, type RunResult, type RuntimeConfig, type RuntimeEvent } from "./halo.ts";

/** What the browser is told about a run. Deliberately much less than a RuntimeEvent. */
export type PublicEvent =
  | { type: "stage"; label: string; status: "start" | "end" }
  | { type: "blocked"; policy: string; rule: string }
  | { type: "paused"; message: string; triage: unknown; order: unknown; draft: unknown; check: unknown }
  | { type: "done"; status: "completed" | "halted" | "error"; output?: unknown; error?: string; cost: number };

interface Run {
  owner: string;
  events: PublicEvent[];
  listeners: Set<(e: PublicEvent) => void>;
  /** Waiting for the user (paused) or running: anything but finished. */
  finished: boolean;
  paused: boolean;
}

export interface AppOptions {
  /** The .halo source. */
  source: string;
  pipeline?: string;
  /** Where paused runs and @thread state live. Use ":memory:" in tests. */
  stateDir?: string;
  /** Canned answers (offline demo and tests). */
  mocks?: Record<string, MockValue>;
  /** Most a user may spend, in USD, across runs in this process. */
  spendCapUsd?: number;
  runtime?: Partial<RuntimeConfig>;
}

const COOKIE = "sid";
const MAX_MESSAGE = 4000;

export function createApp(options: AppOptions) {
  const pipeline = options.pipeline ?? "DraftReply";
  const spendCap = options.spendCapUsd ?? 0.5;
  const memory = options.stateDir === ":memory:";

  const { ast, ok, diagnostics } = compile(options.source);
  if (!ok) throw new Error(diagnostics.map((d) => `${d.line}:${d.column} ${d.message}`).join("\n"));

  const runs = new Map<string, Run>();
  const spent = new Map<string, number>();
  const sessions = new Map<string, string>(); // session id → user id

  // Paused runs must outlive the request that started them (and, with files, a restart).
  const runStore = memory ? undefined : new FileRunStore(`${options.stateDir ?? ".halo"}/runs`);
  const runtime = new HaloRuntime({
    ...options.runtime,
    runStore,
    threadPath: memory ? ":memory:" : `${options.stateDir ?? ".halo"}/threads.sqlite`,
    // One listener for every run; events are routed to the run's owner by runId.
    onEvent: (e) => route(e),
  }).load(ast);
  if (options.mocks) runtime.mockAll(options.mocks);

  function publish(runId: string, e: PublicEvent) {
    const run = runs.get(runId);
    if (!run) return;
    run.events.push(e);
    for (const l of run.listeners) l(e);
  }

  /** Translate a runtime event into what the browser may see, or nothing. */
  function route(e: RuntimeEvent) {
    if (!("runId" in e) || !runs.has(e.runId)) return;
    if (e.type === "stage" && e.kind === "call") publish(e.runId, { type: "stage", label: e.label, status: e.status });
    else if (e.type === "violation") publish(e.runId, { type: "blocked", policy: e.policy, rule: e.rule });
    else if (e.type === "run" && typeof e.cost === "number" && e.status !== "start") {
      const run = runs.get(e.runId)!;
      spent.set(run.owner, (spent.get(run.owner) ?? 0) + e.cost);
    }
    // "llm" and "token" events carry prompts and raw answers: they stay on the server.
  }

  /** What the person approving needs to see: the facts the draft was built from, and the check. */
  function pausedEvent(message: string | undefined, data: Record<string, unknown>): PublicEvent {
    return { type: "paused", message: message ?? "Approve?", triage: data.triage, order: data.order ?? null, draft: data.draft, check: data.check };
  }

  /** Follow a run (or a resumed run) to its next stop and tell the browser. */
  function settle(runId: string, promise: Promise<RunResult>) {
    const run = runs.get(runId)!;
    run.paused = false;
    promise.then(
      (r) => {
        if (r.status === "paused") {
          run.paused = true;
          publish(runId, pausedEvent(r.context.meta.paused?.message, r.context.data));
        } else {
          run.finished = true;
          publish(runId, { type: "done", status: r.status, output: r.output, cost: r.context.meta.cost });
        }
      },
      (err: unknown) => {
        run.finished = true;
        // Error messages can quote the prompt or the model's answer: send only the code.
        const code = err instanceof HaloError ? err.code : "INTERNAL";
        if (!(err instanceof HaloError)) console.error(`run ${runId} failed:`, err);
        publish(runId, { type: "done", status: "error", error: code, cost: 0 });
      },
    );
  }

  // ── sessions ──

  function session(req: Request): { userId: string; setCookie?: string } {
    const sid = /(?:^|;\s*)sid=([\w-]+)/.exec(req.headers.get("cookie") ?? "")?.[1];
    const known = sid && sessions.get(sid);
    if (known) return { userId: known };
    // A real app would sign people in here. The demo gives each browser its own user.
    const newSid = crypto.randomUUID();
    const userId = `user-${newSid.slice(0, 8)}`;
    sessions.set(newSid, userId);
    return { userId, setCookie: `${COOKIE}=${newSid}; HttpOnly; SameSite=Strict; Path=/` };
  }

  const json = (body: unknown, status = 200, setCookie?: string) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...(setCookie ? { "Set-Cookie": setCookie } : {}) } });

  /** The run, if it exists and belongs to this user. Someone else's run looks the same as a missing one. */
  const ownRun = async (runId: string, userId: string) => {
    let run = runs.get(runId);
    // After a restart a paused run is only on disk. Its saved arguments say whose it is.
    if (!run && runStore) {
      const snap = await runStore.load(runId).catch(() => undefined);
      if (snap?.waitingFor && typeof snap.input.user_id === "string") {
        run = { owner: snap.input.user_id, events: [], listeners: new Set(), finished: false, paused: true };
        run.events.push(pausedEvent(snap.meta.paused?.message, snap.data));
        runs.set(runId, run);
      }
    }
    return run && run.owner === userId ? run : undefined;
  };

  // ── routes ──

  async function startDraft(req: Request) {
    const { userId, setCookie } = session(req);
    const body = (await req.json().catch(() => ({}))) as { message?: unknown; user_id?: unknown };
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message) return json({ error: "Write a message first" }, 400, setCookie);
    if (message.length > MAX_MESSAGE) return json({ error: `Keep it under ${MAX_MESSAGE} characters` }, 413, setCookie);
    if ([...runs.values()].some((r) => r.owner === userId && !r.finished && !r.paused)) return json({ error: "You already have a draft in progress" }, 429, setCookie);
    if ((spent.get(userId) ?? 0) >= spendCap) return json({ error: "You've reached your spending limit" }, 429, setCookie);

    // We choose the run id, so the browser can subscribe before the first event happens.
    const runId = crypto.randomUUID();
    runs.set(runId, { owner: userId, events: [], listeners: new Set(), finished: false, paused: false });
    // body.user_id is ignored on purpose: the session decides whose thread this is.
    settle(runId, runtime.run(pipeline, { user_id: userId, message }, { runId }));
    return json({ runId }, 202, setCookie);
  }

  async function events(req: Request, runId: string) {
    const { userId } = session(req);
    const run = await ownRun(runId, userId);
    if (!run) return json({ error: "Not found" }, 404);

    let cleanup = () => {};
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const send = (e: PublicEvent) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
        // Replay what already happened (the run started before the browser connected) ...
        for (const e of run.events) send(e);
        if (run.finished) return controller.close();
        // ... then follow it live. A comment every 15s keeps proxies from closing an idle stream.
        const listener = (e: PublicEvent) => {
          send(e);
          if (e.type === "done") { cleanup(); controller.close(); }
        };
        const ping = setInterval(() => controller.enqueue(encoder.encode(": ping\n\n")), 15_000);
        run.listeners.add(listener);
        cleanup = () => { clearInterval(ping); run.listeners.delete(listener); };
        req.signal.addEventListener("abort", () => cleanup());
      },
      cancel: () => cleanup(),
    });
    return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "X-Accel-Buffering": "no" } });
  }

  async function answer(req: Request, runId: string) {
    const { userId } = session(req);
    const run = await ownRun(runId, userId);
    if (!run) return json({ error: "Not found" }, 404);
    if (!run.paused) return json({ error: "This draft isn't waiting for you" }, 409);
    const body = (await req.json().catch(() => ({}))) as { approved?: unknown; reply?: unknown };
    const payload: Record<string, unknown> = { approved: body.approved === true, by: userId, via: "web" };
    if (typeof body.reply === "string" && body.reply.trim()) payload.reply = body.reply.trim().slice(0, MAX_MESSAGE);
    run.paused = false; // a double click must not resume twice
    settle(runId, runtime.signal(runId, "yield", payload));
    return json({ ok: true }, 202);
  }

  async function fetch(req: Request): Promise<Response | undefined> {
    const url = new URL(req.url);
    // Only same-origin pages may call the API. The session cookie is SameSite=Strict, and a
    // JSON content type can't be sent cross-site without a CORS preflight we never answer.
    if (req.method === "POST" && !req.headers.get("content-type")?.startsWith("application/json")) return json({ error: "Send JSON" }, 415);

    if (url.pathname === "/api/me" && req.method === "GET") {
      const { userId, setCookie } = session(req);
      return json({ userId, spent: spent.get(userId) ?? 0, cap: spendCap, mocked: !!options.mocks }, 200, setCookie);
    }
    if (url.pathname === "/api/drafts" && req.method === "POST") return startDraft(req);
    const m = /^\/api\/runs\/([\w-]+)\/(events|answer)$/.exec(url.pathname);
    if (m && m[2] === "events" && req.method === "GET") return events(req, m[1]!);
    if (m && m[2] === "answer" && req.method === "POST") return answer(req, m[1]!);
    if (url.pathname.startsWith("/api/")) return json({ error: "Not found" }, 404);
    return undefined;
  }

  return { fetch, runtime, close: () => runtime.close() };
}
