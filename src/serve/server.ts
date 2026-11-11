/**
 * `halo serve`: run Halo pipelines as a service.
 *
 *   - HTTP API: list pipelines, start runs, resume paused runs
 *   - Webhooks: POST /hooks/<path> starts a pipeline with the JSON body as its arguments
 *   - Schedules: cron expressions start pipelines
 *   - Watches: a change in a URL, file, or command's output starts a pipeline
 *   - Slack: Approve/Reject buttons on pause notices answer the run (with a signing secret)
 *   - MCP: the pipelines as tools at /mcp
 *   - Approvals: a run that pauses at `|! yield` / `~> listen` gets a signed
 *     approve/reject link (and an optional Slack notification)
 *   - Halo Studio at /, reading the same telemetry
 *
 * It listens on localhost unless given a token, because run data includes
 * prompts and answers, and the API starts runs that spend money.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { hostname } from "node:os";
import { join, relative, resolve } from "node:path";
import { checkLinked, entryPipelines } from "../linker/index.js";
import { linkFile } from "../linker/node.js";
import type { ParseResult, PipelineDeclaration } from "../parser/types.js";
import { AdapterRegistry } from "../runtime/adapter.js";
import { FileRunStore, HaloRuntime, SignalError, type RunResult, type RuntimeConfig, type RuntimeEvent } from "../runtime/runtime.js";
import { SqliteTelemetry } from "../runtime/telemetry.js";
import { answerToEvent, APPROVED, formatValue, isPlainObject } from "../runtime/values.js";
import { checkTimeZone, CronError, nextSlot, parseCron, slotsBetween, type CronSchedule } from "./cron.js";
import { parseDuration } from "../parser/builtins.js";
import { createMcpServer } from "./mcp-server.js";
import { evolveApi, type EvolveConfig } from "./evolve-api.js";
import { pruneRecordings, Recorder } from "../runtime/replay.js";
import { checkWatchConfig, diff, readSource, reading, watchInterval, watchKey, type Reading, type WatchConfig } from "./watch.js";
import { loadInstalled } from "../registry/packages.js";
import pkg from "../../package.json" with { type: "json" };
import studioPage from "../../studio/index.html";

/** halo.json (all optional). Strings like "Env.NAME" are read from the environment. */
export interface ServeConfig {
  /** .halo files or folders to load. Default: the current folder. */
  files?: string[];
  port?: number;
  /** Interface to listen on. Default 127.0.0.1; anything else requires a token. */
  host?: string;
  /** API token (or set HALO_SERVE_TOKEN). Required for every /api request when set. */
  token?: string;
  /** Base URL for approval links, e.g. https://halo.example.com, or "Env.X". Default: HALO_PUBLIC_URL, else the server's own address. */
  publicUrl?: string;
  /** IANA time zone for schedules that don't name one, e.g. "Europe/London". Default: the server's. */
  timezone?: string;
  schedules?: ScheduleConfig[];
  /** POST /hooks/<path> starts <pipeline>. With a secret, requests must carry it (or a GitHub signature). */
  webhooks?: Array<{ path: string; pipeline: string; secret?: string }>;
  /** Where to announce paused runs: a Slack incoming-webhook URL. */
  notify?: { slack?: string };
  /** Start pipelines when a URL, file, or command's output changes (see watch.ts). */
  watches?: WatchConfig[];
  /**
   * Your Slack app's signing secret. With it, pause notices get Approve/Reject buttons, and
   * clicks on them (and on Slack tool buttons from a run) are received at /slack/actions.
   */
  slack?: { signingSecret?: string };
  /** Folder for runs, telemetry, and paused runs. Default .halo */
  stateDir?: string;
  /** Serve the pipelines as MCP tools at /mcp (behind the API token). Default true. */
  mcp?: boolean;
  /**
   * `serve: true` records every run to <stateDir>/recordings, as `halo run` does, so `halo replay`,
   * `halo compare` and `halo evolve` can use production traffic. Recordings aren't redacted.
   * `keep` is how many to keep (default 50).
   */
  recordings?: { serve?: boolean; keep?: number };
  /** Defaults for `halo evolve` and Studio's Evolve tab. */
  evolve?: EvolveConfig;
}

/** One entry of halo.json `schedules`. */
export interface ScheduleConfig {
  pipeline: string;
  /** 5-field cron: minute hour day-of-month month day-of-week. */
  cron: string;
  args?: Record<string, unknown>;
  /** IANA time zone. Default: `timezone`, else the server's. */
  tz?: string;
  /** While this schedule's last run is still running or paused: "skip" the slot (default) or "allow" another run. */
  overlap?: "skip" | "allow";
  /** How late a missed slot may still run, once, e.g. "1h" (default) or "24h"; "none" never runs late. */
  catchup?: string;
}

/** A schedule as `halo serve` sees it: its config, its next slot, and what happened last. */
export interface ScheduleInfo {
  pipeline: string;
  cron: string;
  /** The zone it runs in (the server's, by name, when the config names none). */
  tz: string;
  next?: string;
  lastSlot?: string;
  lastRunId?: string;
  lastStatus?: string;
  skipped: number;
  missed: number;
}

/** What `halo serve` keeps per schedule in <stateDir>/schedules.json, so restarts neither repeat nor forget. */
interface ScheduleState {
  /** When the schedule was first seen (it never catches up on slots before this). */
  since?: string;
  /** The last slot handled: run, skipped, or missed. */
  lastSlot?: string;
  lastRunId?: string;
  lastStatus?: string;
  lastStartedAt?: string;
  skipped: number;
  missed: number;
}

const MINUTE = 60_000;
/** A slot this late is still on time (a slow timer, a restart within the minute). */
const ON_TIME = 90_000;
/** How far back a restart looks for missed slots to count. */
const MISSED_LOOKBACK = 31 * 24 * 60 * MINUTE;
/** A scheduler lock without a heartbeat for this long is abandoned. */
const LOCK_STALE = 150_000;

export interface ServeOptions extends ServeConfig {
  env?: Record<string, string | undefined>;
  /** Extra runtime options (adapters' fetch, mocks are set per runtime via onRuntime). */
  runtime?: Partial<RuntimeConfig>;
  /** The project folder whose halo.lock lists installed tool packages. Default: the current folder. */
  root?: string;
  /** Called for each loaded runtime, e.g. to install mocks in tests. */
  onRuntime?: (runtime: HaloRuntime, file: string) => void;
  /** Serve Halo Studio at /. Default true. */
  studio?: boolean;
  /** Set to "PORT" when the host was chosen because PORT is set (see listenAddress), to explain a refusal. */
  hostFrom?: string;
  /** Start the cron timer. Default true (tests call tick() instead). */
  scheduler?: boolean;
  logger?: Pick<Console, "log" | "warn" | "error">;
  fetch?: typeof fetch;
}

interface Entry {
  name: string;
  file: string;
  runtime: HaloRuntime;
  decl: PipelineDeclaration;
  ast: ParseResult;
  /** Absolute path of the file. */
  path: string;
}

export interface HaloServer {
  url: string;
  port: number;
  pipelines: string[];
  /**
   * Run the schedules due at `now`, and (once each) a missed slot still within its catch-up window.
   * Returns the ids of the runs started. Only the process holding the state folder's scheduler lock starts any.
   */
  tick(now?: Date): string[];
  /** Every schedule with its zone, next slot, and last outcome. */
  schedules(): ScheduleInfo[];
  /** Check every watch now; resolves with the runs started by changes. */
  checkWatches(): Promise<string[]>;
  /** Start a run as the API would; resolves with its id. */
  start(pipeline: string, args: Record<string, unknown>, source: string): string;
  /** Wait for a started run to finish its current stretch (complete, halt, pause, or fail). */
  settled(runId: string): Promise<RunResult | undefined>;
  /** The signed link answering a paused run's current pause (undefined if it isn't paused). */
  approvalUrl(runId: string): Promise<string | undefined>;
  stop(): Promise<void>;
}

export class ServeError extends Error {}

const LOOPBACK = new Set(["127.0.0.1", "localhost", "::1"]);

function collectHaloFiles(targets: string[]): string[] {
  const files: string[] = [];
  const walk = (p: string) => {
    if (statSync(p).isDirectory()) {
      for (const e of readdirSync(p).sort()) if (!e.startsWith(".") && e !== "node_modules") walk(join(p, e));
    } else if (p.endsWith(".halo")) files.push(p);
  };
  for (const t of targets) {
    if (!existsSync(t)) throw new ServeError(`Not found: ${t}`);
    walk(t);
  }
  return files;
}

function safeEqual(a: string, b: string): boolean {
  const [x, y] = [Buffer.from(a), Buffer.from(b)];
  return x.length === y.length && timingSafeEqual(x, y);
}

function pidAlive(pid: number | undefined): boolean {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as { code?: string }).code === "EPERM";
  }
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Arguments for a pipeline from a JSON body: matching fields by name, else the whole body as the only parameter. */
/** A webhook body as a pipeline's arguments: its matching fields, or the whole body for a one-parameter pipeline. */
export function argsFromBody(decl: PipelineDeclaration, body: unknown): Record<string, unknown> {
  const params = decl.params.map((p) => p.name);
  if (body && typeof body === "object" && !Array.isArray(body)) {
    const obj = body as Record<string, unknown>;
    const args = Object.fromEntries(params.filter((p) => Object.hasOwn(obj, p)).map((p) => [p, obj[p]]));
    if (Object.keys(args).length || params.length !== 1) return args;
  }
  return params.length === 1 && body !== undefined ? { [params[0]!]: body } : {};
}

export async function startServer(options: ServeOptions = {}): Promise<HaloServer> {
  const env = options.env ?? Bun.env;
  const logger = options.logger ?? console;
  const fromEnv = (v: string | undefined) => (v && /^Env\.\w+$/.test(v) ? env[v.slice(4)] : v);
  // The public address differs per deployment: it can name a variable, or come from HALO_PUBLIC_URL.
  const publicUrl = fromEnv(options.publicUrl) || env.HALO_PUBLIC_URL || platformPublicUrl(env);
  if (publicUrl && !/^https?:\/\/[^/]/.test(publicUrl)) throw new ServeError(`publicUrl "${publicUrl}" must be an http(s) URL`);
  options = { ...options, publicUrl };
  const host = options.host ?? "127.0.0.1";
  const token = fromEnv(options.token) ?? env.HALO_SERVE_TOKEN;
  // A token that names an unset variable must not silently turn into "no token".
  if (options.token !== undefined && !token) throw new ServeError(`The API token "${options.token}" is empty or not set`);
  if (!LOOPBACK.has(host) && !token) {
    const why = options.hostFrom === "PORT" ? " (PORT is set, so Halo listens on every interface; set HALO_HOST=127.0.0.1 to keep it local)" : "";
    throw new ServeError(`Refusing to listen on ${host} without a token: set HALO_SERVE_TOKEN (runs spend money and their data includes prompts)${why}`);
  }

  const stateDir = resolve(options.stateDir ?? ".halo");
  mkdirSync(stateDir, { recursive: true });
  const runStore = new FileRunStore(join(stateDir, "runs"));
  const telemetry = new SqliteTelemetry(join(stateDir, "telemetry.db"));

  // Approval links are signed with the token, or with a secret kept in the state folder.
  const secretFile = join(stateDir, "serve-secret");
  let signingKey = token;
  if (!signingKey) {
    if (!existsSync(secretFile)) await Bun.write(secretFile, randomBytes(32).toString("hex"));
    signingKey = (await Bun.file(secretFile).text()).trim();
  }
  // A link answers one particular pause of one run, so it can't be replayed on a later pause.
  const sign = (runId: string, pauseId: string) => createHmac("sha256", signingKey!).update(`approve:${runId}:${pauseId}`).digest("hex").slice(0, 32);

  // ── Load pipelines ──
  const registry = new AdapterRegistry();
  const installed = await loadInstalled(options.root ?? process.cwd()).catch((err: unknown) => {
    throw new ServeError(err instanceof Error ? err.message : String(err));
  });
  const entries = new Map<string, Entry>();
  const runtimes: HaloRuntime[] = [];
  // Recording: runs share a runtime, so each run's calls find their recorder through the async context.
  const recordingsDir = options.recordings?.serve ? join(stateDir, "recordings") : undefined;
  const recording = new AsyncLocalStorage<Recorder>();
  const recorder = recordingsDir ? { recorder: (c: Parameters<Recorder["record"]>[0]) => recording.getStore()?.record(c) } : {};
  const onEvent = (e: RuntimeEvent) => {
    telemetry.handler(e);
    options.runtime?.onEvent?.(e);
    if (e.type === "paused") void announcePause(e.runId);
  };
  const files = collectHaloFiles(options.files?.length ? options.files : ["."]);
  if (!files.length) throw new ServeError(`No .halo files found in ${(options.files ?? ["."]).join(", ")}`);
  for (const file of files) {
    const rel = relative(process.cwd(), file) || file;
    // Each file is linked with everything it `use`s, so its pipelines can call pipelines in other files.
    const linked = linkFile(file, options.root ? { root: options.root } : {});
    const ast = linked.program;
    if (ast.errors.length) throw new ServeError(`${rel} has syntax errors:\n  ${ast.errors.join("\n  ")}`);
    const errors = checkLinked(linked, { canHandleModel: (id) => !!registry.findAdapter(id), toolProviders: installed.map((p) => p.name) }).filter((d) => d.severity === "error");
    const where = (d: { file: string; line?: number }) => `${d.file === resolve(file) ? "" : `${relative(process.cwd(), d.file)}:`}${d.line ?? "?"}`;
    if (errors.length) throw new ServeError(`${rel} has errors:\n  ${errors.map((d) => `${where(d)}: ${d.message}`).join("\n  ")}`);
    const own = entryPipelines(ast);
    if (!own.length) continue;
    const runtime = new HaloRuntime({ logger, ...options.runtime, ...recorder, env, runStore, onEvent }).load(ast);
    for (const p of installed) runtime.registerToolProvider(p.name, p.provider, p.info);
    options.onRuntime?.(runtime, rel);
    runtimes.push(runtime);
    for (const decl of own) {
      const prev = entries.get(decl.name);
      if (prev) throw new ServeError(`Pipeline "${decl.name}" is declared in both ${prev.file} and ${rel}`);
      entries.set(decl.name, { name: decl.name, file: rel, runtime, decl, ast, path: resolve(file) });
    }
  }

  const entry = (name: string) => {
    const e = entries.get(name);
    if (!e) throw new ServeError(`Unknown pipeline "${name}" (have: ${[...entries.keys()].join(", ")})`);
    return e;
  };

  // ── Triggers from config ──
  const schedules: Array<{ key: string; label: string; pipeline: string; cron: CronSchedule; tz?: string; args: Record<string, unknown>; overlap: "skip" | "allow"; catchupMs: number }> = [];
  for (const s of options.schedules ?? []) {
    entry(s.pipeline);
    const tz = s.tz ?? options.timezone;
    const where = `Schedule "${s.cron}" for ${s.pipeline}`;
    let cron: CronSchedule;
    try {
      cron = parseCron(s.cron);
      if (tz) checkTimeZone(tz);
    } catch (err) {
      throw new ServeError(`${where}: ${err instanceof CronError ? err.message : err}`);
    }
    if (s.overlap !== undefined && s.overlap !== "skip" && s.overlap !== "allow") throw new ServeError(`${where}: overlap must be "skip" or "allow" (got "${s.overlap}")`);
    const catchupMs = s.catchup === "none" ? 0 : parseDuration(s.catchup ?? "1h");
    if (!(catchupMs >= 0)) throw new ServeError(`${where}: catchup must be "none" or a duration like 30m or 24h (got "${s.catchup}")`);
    const key = `${s.pipeline} ${cron.source.trim().split(/\s+/).join(" ")}${tz ? ` ${tz}` : ""}`;
    if (schedules.some((x) => x.key === key)) throw new ServeError(`${where} is listed twice`);
    schedules.push({ key, label: `"${cron.source}"${tz ? ` (${tz})` : ""}`, pipeline: s.pipeline, cron, tz, args: s.args ?? {}, overlap: s.overlap ?? "skip", catchupMs });
  }
  const scheduleFile = join(stateDir, "schedules.json");
  let scheduleState: Record<string, ScheduleState> = {};
  try {
    if (existsSync(scheduleFile)) scheduleState = JSON.parse(readFileSync(scheduleFile, "utf8"));
  } catch (err) {
    logger.warn(`[halo] ${scheduleFile} could not be read, so schedules start fresh: ${err instanceof Error ? err.message : err}`);
  }
  const saveSchedules = () => {
    try {
      writeFileSync(`${scheduleFile}.tmp`, JSON.stringify(scheduleState, null, 2));
      renameSync(`${scheduleFile}.tmp`, scheduleFile);
    } catch (err) {
      logger.error(`[halo] could not save ${scheduleFile}: ${err instanceof Error ? err.message : err}`);
    }
  };
  const stateOf = (key: string) => (scheduleState[key] ??= { skipped: 0, missed: 0 });
  /** Which schedule started each run, so its outcome is recorded when the run ends (again, after a resume). */
  const scheduledRuns = new Map<string, string>();
  const webhooks = new Map<string, { pipeline: string; secret?: string }>();
  for (const w of options.webhooks ?? []) {
    entry(w.pipeline);
    const path = w.path.replace(/^\/+|\/+$/g, "");
    if (!/^[\w./-]+$/.test(path)) throw new ServeError(`Webhook path "${w.path}" may only use letters, digits, _ . / -`);
    const secret = fromEnv(w.secret);
    // A secret that names an unset variable must not silently turn into "no secret".
    if (w.secret !== undefined && !secret) throw new ServeError(`Webhook /hooks/${path} has secret "${w.secret}", but it is empty or not set`);
    if (secret === undefined) logger.warn(`[halo] Webhook /hooks/${path} has no secret: anyone who can reach this server can start ${w.pipeline}`);
    webhooks.set(path, { pipeline: w.pipeline, secret });
  }
  const slackUrl = fromEnv(options.notify?.slack);
  const slackSecret = fromEnv(options.slack?.signingSecret);
  if (options.slack?.signingSecret !== undefined && !slackSecret) throw new ServeError(`slack.signingSecret "${options.slack.signingSecret}" is empty or not set`);

  const watches = (options.watches ?? []).map((w) => {
    entry(w.pipeline);
    try {
      checkWatchConfig(w);
    } catch (err) {
      throw new ServeError(err instanceof Error ? err.message : String(err));
    }
    return { config: w, key: watchKey(w), every: watchInterval(w), busy: false };
  });
  const watchFile = join(stateDir, "watches.json");
  const readings: Record<string, Reading> = existsSync(watchFile) ? JSON.parse(await Bun.file(watchFile).text()) : {};

  // ── Runs ──
  const inflight = new Map<string, Promise<RunResult | undefined>>();
  // Recent outcomes, so a caller asking after a fast run finished still gets its result.
  const recent = new Map<string, RunResult | undefined>();
  const remember = (runId: string, r: RunResult | undefined) => {
    recent.delete(runId);
    recent.set(runId, r);
    if (recent.size > 500) recent.delete(recent.keys().next().value!);
  };
  const track = (runId: string, label: string, work: Promise<RunResult>) => {
    const p = work.then(
      (r) => {
        logger.log(`[halo] ${label} ${r.status} (run ${runId.slice(0, 8)})`);
        remember(runId, r);
        scheduledRunEnded(runId, r.status);
        return r;
      },
      (err: unknown) => {
        logger.error(`[halo] ${label} failed (run ${runId.slice(0, 8)}): ${err instanceof Error ? err.message : err}`);
        remember(runId, undefined);
        scheduledRunEnded(runId, "error");
        return undefined;
      },
    );
    inflight.set(runId, p);
    void p.finally(() => {
      if (inflight.get(runId) === p) inflight.delete(runId);
    });
    return p;
  };

  const start = (pipeline: string, args: Record<string, unknown>, source: string) => {
    const e = entry(pipeline);
    if (!args || typeof args !== "object" || Array.isArray(args)) throw new ServeError(`${pipeline} needs its arguments as a JSON object`);
    const missing = e.decl.params.filter((p) => !Object.hasOwn(args, p.name)).map((p) => p.name);
    if (missing.length) throw new ServeError(`${pipeline} needs ${missing.join(", ")}`);
    const runId = crypto.randomUUID();
    logger.log(`[halo] ${pipeline} started by ${source} (run ${runId.slice(0, 8)})`);
    track(runId, pipeline, recorded(runId, pipeline, args, () => e.runtime.run(pipeline, args, { runId })));
    return runId;
  };

  /** Writes how a recorded run ended (each time it ends: a run that pauses ends, then ends again after resuming). */
  function ended(rec: Recorder, work: Promise<RunResult>): Promise<RunResult> {
    return work.then(
      (r) => (rec.finish({ status: r.status, output: r.output }), r),
      (err: unknown) => {
        rec.finish({ status: "error", error: err instanceof Error ? err.message : String(err) });
        throw err;
      },
    );
  }

  /** Runs `work` with a recorder for `runId` (when serve records). */
  function recorded(runId: string, pipeline: string, args: Record<string, unknown>, work: () => Promise<RunResult>): Promise<RunResult> {
    if (!recordingsDir) return work();
    pruneRecordings(recordingsDir, options.recordings?.keep ?? 50);
    const rec = new Recorder(recordingsDir, runId);
    rec.start(pipeline, args);
    return ended(rec, recording.run(rec, work));
  }

  const settled = (runId: string) => inflight.get(runId) ?? Promise.resolve(recent.get(runId));

  function scheduledRunEnded(runId: string, status: string) {
    const key = scheduledRuns.get(runId);
    const st = key ? scheduleState[key] : undefined;
    if (!st || st.lastRunId !== runId) return;
    st.lastStatus = status;
    saveSchedules();
  }

  /**
   * Claim a paused run and continue it. Resolves once the claim succeeds (the
   * run continues in the background) or with an error message: not paused,
   * a different event expected, or already answered by someone else.
   */
  const resume = async (runId: string, payload: unknown, event?: string, pauseId?: string): Promise<{ work: Promise<RunResult | undefined> } | { error: string; status: number }> => {
    const snap = await runStore.load(runId);
    if (snap?.waitingFor === undefined) return { error: "That run is not paused", status: 409 };
    try {
      // The resumed run keeps appending to its recording (the answer to the pause is recorded too).
      const rec = recordingsDir ? new Recorder(recordingsDir, runId) : undefined;
      const waitingFor = event ?? snap.waitingFor;
      const claim = () => entry(snap.pipeline).runtime.resumePaused(runId, waitingFor, payload, { pauseId });
      // The run continues inside the recorder's context; a failed claim (already answered, wrong event) records nothing.
      const claimed = rec ? await recording.run(rec, claim) : await claim();
      logger.log(`[halo] ${claimed.pipeline} resumed (run ${runId.slice(0, 8)})`);
      return { work: track(runId, claimed.pipeline, rec ? ended(rec, claimed.result) : claimed.result) };
    } catch (err) {
      if (err instanceof SignalError) return { error: err.message, status: 409 };
      throw err;
    }
  };

  let baseUrl = "";
  const linkFor = (runId: string, pauseId: string) => `${(options.publicUrl ?? baseUrl).replace(/\/+$/, "")}/approve/${runId}?sig=${sign(runId, pauseId)}`;
  const approvalUrl = async (runId: string) => {
    const snap = await runStore.load(runId);
    const pauseId = snap?.waitingFor !== undefined ? snap.meta.paused?.id : undefined;
    return pauseId ? linkFor(runId, pauseId) : undefined;
  };

  async function announcePause(runId: string) {
    const snap = await runStore.load(runId);
    if (!snap?.waitingFor) return;
    const what = snap.waitingFor === "yield" ? "a human" : snap.waitingFor;
    const link = snap.meta.paused?.id ? linkFor(runId, snap.meta.paused.id) : "(no link: resume it with the API)";
    const text = `‖ ${snap.pipeline} is waiting for ${what}${snap.meta.paused?.message ? `: ${snap.meta.paused.message}` : ""}\nRespond: ${link}`;
    logger.log(`[halo] ${text.replace("\n", " · ")}`);
    if (!slackUrl) return;
    // With a signing secret, Slack can tell us about clicks: answer right in the message.
    const pauseId = snap.meta.paused?.id;
    const blocks =
      slackSecret && pauseId
        ? [
            { type: "section", text: { type: "mrkdwn", text } },
            {
              type: "actions",
              elements: (["approve", "reject"] as const).map((answer) => ({
                type: "button",
                text: { type: "plain_text", text: answer === "approve" ? "Approve" : "Reject" },
                style: answer === "approve" ? "primary" : "danger",
                action_id: `halo_${answer}`,
                value: JSON.stringify({ runId, pauseId, answer, sig: sign(runId, pauseId) }),
              })),
            },
          ]
        : undefined;
    try {
      const res = await (options.fetch ?? fetch)(slackUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, blocks }) });
      if (!res.ok) logger.warn(`[halo] Slack notification failed (${res.status})`);
    } catch (err) {
      logger.warn(`[halo] Slack notification failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  const checkWatch = async (w: (typeof watches)[number]): Promise<string | undefined> => {
    if (w.busy) return undefined;
    w.busy = true;
    try {
      const value = await readSource(w.config, { fetch: options.fetch ?? fetch, env });
      const now = reading(value);
      const last = readings[w.key];
      readings[w.key] = now;
      await Bun.write(watchFile, JSON.stringify(readings));
      if (last ? last.hash === now.hash : !w.config.runOnStart) return undefined;
      const changes = last ? diff(last.value, value) : [];
      const source = w.config.url ?? w.config.file ?? w.config.command;
      const body = { ...(w.config.args ?? {}), source, before: last?.value, after: value, changes };
      return start(w.config.pipeline, argsFromBody(entry(w.config.pipeline).decl, body), `a change in ${source}`);
    } catch (err) {
      logger.warn(`[halo] watch for ${w.config.pipeline} failed: ${err instanceof Error ? err.message : err}`);
      return undefined;
    } finally {
      w.busy = false;
    }
  };
  const checkWatches = async () => (await Promise.all(watches.map(checkWatch))).filter((id): id is string => !!id);

  // ── Scheduler ──
  // One `halo serve` per state folder runs the schedules; another one serves the API but doesn't fire them.
  const lockFile = join(stateDir, "scheduler.lock");
  const lockOwner = crypto.randomUUID();
  let lockHeldBy: string | undefined;
  const claimLock = (): boolean => {
    let lock: { owner?: string; pid?: number; host?: string; processStart?: number; heartbeat?: number } | undefined;
    try {
      lock = existsSync(lockFile) ? JSON.parse(readFileSync(lockFile, "utf8")) : undefined;
    } catch {}
    if (lock?.owner && lock.owner !== lockOwner && Date.now() - (lock.heartbeat ?? 0) < LOCK_STALE) {
      // A process on this machine that has exited (or whose pid now belongs to us after a restart) holds nothing.
      const sameHost = lock.host === hostname();
      const restarted = sameHost && lock.pid === process.pid && Math.abs((lock.processStart ?? 0) - performance.timeOrigin) > 1000;
      if (!sameHost || (!restarted && pidAlive(lock.pid))) {
        if (lockHeldBy !== lock.owner) logger.warn(`[halo] Another halo serve (pid ${lock.pid} on ${lock.host}) runs the schedules for ${stateDir}; this one won't until it stops.`);
        lockHeldBy = lock.owner;
        return false;
      }
    }
    if (lockHeldBy && lockHeldBy !== lockOwner) logger.log(`[halo] Taking over the schedules for ${stateDir}`);
    lockHeldBy = lockOwner;
    try {
      writeFileSync(`${lockFile}.${lockOwner}`, JSON.stringify({ owner: lockOwner, pid: process.pid, host: hostname(), processStart: performance.timeOrigin, heartbeat: Date.now() }));
      renameSync(`${lockFile}.${lockOwner}`, lockFile);
    } catch (err) {
      logger.error(`[halo] could not write ${lockFile}: ${err instanceof Error ? err.message : err}`);
    }
    return true;
  };

  /** A run is active while it is running, or paused (its snapshot is in the run store). */
  const active = (runId: string) => inflight.has(runId) || existsSync(join(stateDir, "runs", `${runId}.json`));
  /** The minute up to which each schedule's slots have been handled by this process. */
  const checked = new Map<string, number>();

  const tick = (now = new Date()) => {
    const started: string[] = [];
    if (!schedules.length || !claimLock()) return started;
    const t = now.getTime();
    const minute = Math.floor(t / MINUTE) * MINUTE;
    let dirty = false;
    for (const s of schedules) {
      const st = stateOf(s.key);
      if (!st.since) {
        // New schedules don't catch up on slots from before they existed.
        st.since = new Date(t - ON_TIME).toISOString();
        dirty = true;
      }
      const from = Math.max(Date.parse(st.lastSlot ?? st.since), checked.get(s.key) ?? -Infinity, minute - MISSED_LOOKBACK);
      checked.set(s.key, minute);
      if (from >= minute) continue;
      const slots = slotsBetween(s.cron, from, minute, s.tz);
      const slot = slots.at(-1);
      if (slot === undefined) continue;
      const late = t - slot;
      const tooLate = late > Math.max(s.catchupMs, ON_TIME);
      const missed = slots.length - 1 + (tooLate ? 1 : 0);
      st.lastSlot = new Date(slot).toISOString();
      dirty = true;
      if (missed) {
        st.missed += missed;
        logger.warn(`[halo] Schedule ${s.label} → ${s.pipeline} missed ${missed} run(s) while the server was stopped or asleep (the latest was due ${new Date(tooLate ? slot : slots.at(-2)!).toISOString()})`);
      }
      if (tooLate) continue;
      if (s.overlap === "skip" && st.lastRunId && active(st.lastRunId)) {
        st.skipped++;
        const paused = !inflight.has(st.lastRunId);
        logger.warn(`[halo] Schedule ${s.label} → ${s.pipeline} skipped: its last run (${st.lastRunId.slice(0, 8)}) is still ${paused ? "paused, waiting for an answer" : "running"}`);
        if (paused) void announcePause(st.lastRunId);
        continue;
      }
      try {
        const runId = start(s.pipeline, s.args, `schedule ${s.label}${late > ON_TIME ? `, ${Math.round(late / MINUTE)}m late` : ""}`);
        Object.assign(st, { lastRunId: runId, lastStatus: "running", lastStartedAt: now.toISOString() });
        scheduledRuns.set(runId, s.key);
        started.push(runId);
      } catch (err) {
        st.lastStatus = "error";
        logger.error(`[halo] schedule ${s.label} could not start ${s.pipeline}: ${err instanceof Error ? err.message : err}`);
      }
    }
    if (dirty) saveSchedules();
    return started;
  };

  const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const scheduleInfo = (): ScheduleInfo[] =>
    schedules.map((s) => {
      const st = scheduleState[s.key];
      const next = nextSlot(s.cron, Date.now(), s.tz);
      return {
        pipeline: s.pipeline,
        cron: s.cron.source,
        tz: s.tz ?? localZone,
        next: next === undefined ? undefined : new Date(next).toISOString(),
        lastSlot: st?.lastSlot,
        lastRunId: st?.lastRunId,
        lastStatus: st?.lastStatus,
        skipped: st?.skipped ?? 0,
        missed: st?.missed ?? 0,
      };
    });

  // ── HTTP ──
  const authorized = (req: Request, url: URL) => {
    if (!token) return true;
    const header = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? url.searchParams.get("token") ?? "";
    return safeEqual(header, token);
  };

  // Hosts this server answers to: blocks DNS rebinding (a site resolving its own
  // name to 127.0.0.1 to read the API from the user's browser).
  const allowedHosts = new Set(["localhost", "127.0.0.1", "[::1]", host.includes(":") ? `[${host}]` : host]);
  if (options.publicUrl) allowedHosts.add(new URL(options.publicUrl).hostname);
  /** Why a request looks like it came from another site's page, or undefined if it's fine. */
  const foreign = (req: Request, url: URL, checkHost = true): string | undefined => {
    const hostname = (req.headers.get("host") ?? url.host).replace(/:\d+$/, "");
    if (checkHost && !allowedHosts.has(hostname)) return `Host "${hostname}" is not allowed`;
    const origin = req.headers.get("origin");
    if (origin && !/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin) && !(options.publicUrl && origin === new URL(options.publicUrl).origin)) {
      return `Requests from ${origin} are not allowed`;
    }
    return undefined;
  };
  /** Why an /api request looks cross-site, or undefined if it's fine. */
  const crossSite = (req: Request, url: URL): string | undefined => {
    // A web page can send "simple" cross-site requests without asking; requiring JSON
    // (and a same-site Origin when the browser sends one) means only Studio and API clients get in.
    const refused = foreign(req, url);
    if (refused) return refused;
    if (req.method === "POST" && !(req.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
      return "POST requests to /api must be Content-Type: application/json";
    }
    return undefined;
  };

  const readJson = async (req: Request): Promise<unknown> => {
    const text = await req.text();
    if (!text.trim()) return undefined;
    try {
      return JSON.parse(text);
    } catch {
      throw new ServeError("Request body must be JSON");
    }
  };

  /** The paused run a signed link answers, or undefined if the link is wrong or that pause is over. */
  const linkedPause = async (runId: string, url: URL) => {
    const snap = await runStore.load(runId);
    const pauseId = snap?.waitingFor !== undefined ? snap.meta.paused?.id : undefined;
    return snap && pauseId && safeEqual(url.searchParams.get("sig") ?? "", sign(runId, pauseId)) ? { snap, pauseId } : undefined;
  };

  const approvalPage = async (runId: string, url: URL, done?: string): Promise<Response> => {
    const linked = done ? undefined : await linkedPause(runId, url);
    if (!done && !linked) return new Response("This link is invalid, or that step was already answered.", { status: 403 });
    const snap = linked?.snap;
    const head = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Halo approval</title>
<style>body{font:15px/1.5 -apple-system,system-ui,sans-serif;max-width:640px;margin:40px auto;padding:0 16px;color:#1f2937}
pre{background:#f3f4f6;padding:12px;border-radius:8px;white-space:pre-wrap;max-height:50vh;overflow:auto}
button{font:inherit;padding:8px 16px;border-radius:8px;border:1px solid #d1d5db;background:#fff;cursor:pointer;margin-right:8px}
button.approve{background:#10b981;color:#fff;border-color:#10b981}input{font:inherit;padding:8px;border:1px solid #d1d5db;border-radius:8px;width:60%}</style>`;
    if (done) return new Response(`${head}<h2>${escapeHtml(done)}</h2>`, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    if (!snap?.waitingFor) return new Response(`${head}<h2>This run is no longer waiting.</h2>`, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    const message = snap.meta.paused?.message ?? (snap.waitingFor === "yield" ? "Approve this run?" : `Waiting for ${snap.waitingFor}`);
    const action = `/approve/${runId}?sig=${sign(runId, linked!.pauseId)}`;
    return new Response(
      `${head}<h2>${escapeHtml(snap.pipeline)} is waiting for you</h2>
<p>${escapeHtml(message)}</p>
<details><summary>Current value</summary><pre>${escapeHtml(formatValue(snap.current))}</pre></details>
<form method="post" action="${escapeHtml(action)}">
<p><button class="approve" name="answer" value="approve">Approve</button><button name="answer" value="reject">Reject</button></p>
<p><input name="custom" placeholder="Or another answer (a word or JSON)"> <button name="answer" value="custom">Send</button></p>
</form>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  };

  // ── Slack buttons ──
  /**
   * A click on a button in Slack. Slack signs each request with the app's signing secret.
   * Pause notices carry their run, pause, and a link signature; a Slack tool's buttons from a
   * run carry that run, and answer whatever it is waiting for when clicked.
   */
  async function slackAction(req: Request): Promise<Response> {
    if (!slackSecret) return json({ error: "Slack actions need slack.signingSecret in halo.json" }, 404);
    const raw = await req.text();
    const ts = req.headers.get("x-slack-request-timestamp") ?? "";
    const sig = req.headers.get("x-slack-signature") ?? "";
    if (!/^\d+$/.test(ts) || Math.abs(Date.now() / 1000 - Number(ts)) > 300) return json({ error: "Stale or missing Slack timestamp" }, 401);
    if (!safeEqual(sig, `v0=${createHmac("sha256", slackSecret).update(`v0:${ts}:${raw}`).digest("hex")}`)) return json({ error: "Bad Slack signature" }, 401);
    let payload: { actions?: Array<{ value?: string }>; user?: { username?: string; name?: string; id?: string }; response_url?: string };
    try {
      payload = JSON.parse(new URLSearchParams(raw).get("payload") ?? "");
    } catch {
      return json({ error: "No Slack payload" }, 400);
    }
    let action: { runId?: string; pauseId?: string; answer?: string; sig?: string; after?: number };
    try {
      action = JSON.parse(payload.actions?.[0]?.value ?? "");
    } catch {
      return new Response("", { status: 200 }); // a button that isn't Halo's
    }
    if (!action.runId || !/^[\w-]+$/.test(action.runId)) return new Response("", { status: 200 });
    // A pause notice's button answers only that pause.
    if (action.pauseId !== undefined && !(action.sig && safeEqual(action.sig, sign(action.runId, action.pauseId)))) return json({ error: "Bad button signature" }, 403);
    // A Slack tool's button answers only the run's next pause after the post, and never a tool-call approval.
    if (action.pauseId === undefined) {
      const snap = await runStore.load(action.runId);
      if (!snap || snap.waitingFor === "approval" || typeof action.after !== "number" || (snap.meta.pauses ?? 0) !== action.after + 1 || !snap.meta.paused?.id) {
        return new Response("", { status: 200 });
      }
      action.pauseId = snap.meta.paused.id;
    }
    const who = payload.user?.username ?? payload.user?.name ?? payload.user?.id ?? "someone";
    const answer = String(action.answer ?? "approve");
    const event = answerToEvent(answer);
    const outcome = await resume(action.runId, isPlainObject(event) ? { ...event, by: who, via: "slack" } : event, undefined, action.pauseId);
    const text = "work" in outcome ? `${answer === "reject" ? "✗ Rejected" : "✓ Answered"} by ${who}: ${answer}` : `This step was already answered (${outcome.error}).`;
    // Replace the buttons with what happened. Slack sends response_url to its own domain.
    if (payload.response_url && /^https:\/\/hooks\.slack\.com\//.test(payload.response_url)) {
      void (options.fetch ?? fetch)(payload.response_url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ replace_original: true, text }) }).catch(() => {});
    }
    return new Response("", { status: 200 });
  }

  // ── MCP ──
  // Evolve runs (Studio's Evolve tab): their own runtimes, configured like the served ones but recording nothing.
  const evolveRoutes = evolveApi({
    stateDir,
    root: resolve(options.root ?? process.cwd()),
    pipelines: () => [...entries.values()].map((e) => ({ name: e.name, file: e.file, decl: e.decl, ast: e.ast, path: e.path })),
    runtime: () => {
      const rt = new HaloRuntime({ logger: { log() {}, warn() {} }, ...options.runtime, onEvent: undefined, recorder: undefined, env, threadPath: ":memory:" });
      for (const p of installed) rt.registerToolProvider(p.name, p.provider, p.info);
      return rt;
    },
    fence: { providerInfo: (provider) => runtimes[0]?.toolProviderInfo(provider) ?? new HaloRuntime({ logger: { log() {}, warn() {} } }).toolProviderInfo(provider) },
    validate: { canHandleModel: (id) => !!registry.findAdapter(id), toolProviders: installed.map((p) => p.name) },
    config: options.evolve,
    version: pkg.version,
    logger,
  });

  const mcp = createMcpServer(
    {
      list: () => [...entries.values()].map((e) => ({ name: e.name, description: describePipeline(e), params: e.decl.params })),
      call: async (name, args, signal) => {
        const e = entry(name);
        const runId = crypto.randomUUID();
        logger.log(`[halo] ${name} started by MCP (run ${runId.slice(0, 8)})`);
        const work = e.runtime.run(name, args, { runId, signal });
        track(runId, name, work);
        try {
          const r = await work;
          return { status: r.status, output: r.output, runId, waitingFor: r.context.meta.paused?.waitingFor };
        } catch (err) {
          return { status: "failed", runId, error: err instanceof Error ? err.message : String(err) };
        }
      },
    },
    { name: "halo", version: pkg.version },
  );

  const server = Bun.serve({
    port: options.port ?? 8080,
    hostname: host,
    development: false,
    ...(options.studio === false ? {} : { routes: { "/": studioPage } }),
    async fetch(req) {
      const url = new URL(req.url);
      const path = url.pathname;
      try {
        // Approval links carry their own signature; they work without the API token.
        const approve = path.match(/^\/approve\/([\w-]+)$/);
        if (approve) {
          const runId = approve[1]!;
          if (req.method === "GET") return approvalPage(runId, url);
          if (req.method === "POST") {
            const linked = await linkedPause(runId, url);
            if (!linked) return new Response("This link is invalid, or that step was already answered.", { status: 403 });
            const form = await req.formData().catch(() => new FormData());
            const choice = String(form.get("answer") ?? "approve");
            const answer = choice === "custom" ? String(form.get("custom") ?? "") : choice;
            const outcome = await resume(runId, answer ? answerToEvent(answer) : APPROVED, undefined, linked.pauseId);
            return approvalPage(runId, url, "work" in outcome ? `Thanks. The run continues with “${answer}”.` : "This step was already answered.");
          }
        }

        // For load balancers and hosts' health checks: no token, and nothing about the pipelines.
        if (path === "/healthz" && req.method === "GET") return json({ ok: true });

        if (path === "/slack/actions" && req.method === "POST") return slackAction(req);

        const hook = path.match(/^\/hooks\/(.+)$/);
        if (hook && req.method === "POST") {
          const target = webhooks.get(hook[1]!.replace(/\/+$/, ""));
          if (!target) return json({ error: "Unknown webhook" }, 404);
          const raw = await req.text();
          if (target.secret) {
            const ghSig = req.headers.get("x-hub-signature-256");
            const ok = ghSig
              ? safeEqual(ghSig, `sha256=${createHmac("sha256", target.secret).update(raw).digest("hex")}`)
              : safeEqual(req.headers.get("x-halo-secret") ?? url.searchParams.get("secret") ?? "", target.secret);
            if (!ok) return json({ error: "Bad webhook secret or signature" }, 401);
          } else {
            // With no secret, at least keep other sites' pages (through the user's browser) out:
            // browsers send their Origin, and on loopback a foreign Host means DNS rebinding.
            // Senders reaching a public address use its name, which may not be publicUrl's.
            const refused = foreign(req, url, LOOPBACK.has(host));
            if (refused) return json({ error: refused }, 403);
          }
          let body: unknown;
          try {
            body = raw.trim() ? JSON.parse(raw) : undefined;
          } catch {
            return json({ error: "Webhook body must be JSON" }, 400);
          }
          const runId = start(target.pipeline, argsFromBody(entry(target.pipeline).decl, body), `webhook /hooks/${hook[1]}`);
          return json({ runId, status: "running" }, 202);
        }

        // Pipelines as MCP tools, for Claude, Cursor, and other agents. Same token as the API.
        if (path === "/mcp" && options.mcp !== false) {
          // The same checks as /api: no other site's pages (DNS rebinding, cross-site posts), then the token.
          const refusedMcp = crossSite(req, url);
          if (refusedMcp) return json({ error: refusedMcp }, 403);
          if (!authorized(req, url)) return json({ error: "Missing or wrong token (Authorization: Bearer <HALO_SERVE_TOKEN>)" }, 401);
          return mcp.handleHttp(req);
        }

        if (!path.startsWith("/api/")) return new Response("Not found", { status: 404 });
        const refused = crossSite(req, url);
        if (refused) return json({ error: refused }, 403);
        if (!authorized(req, url)) return json({ error: "Missing or wrong token (Authorization: Bearer <HALO_SERVE_TOKEN>)" }, 401);

        if (path === "/api/health") return json({ ok: true, pipelines: entries.size });

        if (path === "/api/evolve" || path.startsWith("/api/evolve/")) {
          const handled = await evolveRoutes(req, path, readJson);
          if (handled) return handled;
        }

        if (path === "/api/pipelines" && req.method === "GET") {
          return json(
            [...entries.values()].map((e) => ({
              name: e.name,
              file: e.file,
              params: e.decl.params,
              returnType: e.decl.returnType,
              schedules: scheduleInfo().filter((s) => s.pipeline === e.name),
              webhooks: [...webhooks].filter(([, w]) => w.pipeline === e.name).map(([p]) => `/hooks/${p}`),
            })),
          );
        }

        const startRun = path.match(/^\/api\/pipelines\/([\w]+)\/runs$/);
        if (startRun && req.method === "POST") {
          const body = ((await readJson(req)) ?? {}) as { args?: Record<string, unknown>; wait?: boolean };
          const runId = start(startRun[1]!, body.args ?? {}, "API");
          if (!body.wait) return json({ runId, status: "running" }, 202);
          const result = await settled(runId);
          return json(result ? { runId, status: result.status, output: result.output, cost: result.context.meta.cost } : { runId, status: "error" });
        }

        if (path === "/api/runs" && req.method === "GET") return json(telemetry.listRuns(Number(url.searchParams.get("limit") ?? 50)));

        const run = path.match(/^\/api\/runs\/([\w-]+)$/);
        if (run && req.method === "GET") {
          const runId = run[1]!;
          const snap = await runStore.load(runId);
          const paused = snap?.waitingFor
            ? { waitingFor: snap.waitingFor, message: snap.meta.paused?.message, stage: snap.nextStage, approveUrl: await approvalUrl(runId) }
            : undefined;
          return json({ runId, running: inflight.has(runId), paused, events: telemetry.run(runId) });
        }

        const signal = path.match(/^\/api\/runs\/([\w-]+)\/signal$/);
        if (signal && req.method === "POST") {
          const body = ((await readJson(req)) ?? {}) as { event?: string; payload?: unknown; answer?: string; wait?: boolean };
          const payload = body.payload !== undefined ? body.payload : body.answer !== undefined ? answerToEvent(body.answer) : APPROVED;
          const outcome = await resume(signal[1]!, payload, body.event);
          if (!("work" in outcome)) return json({ error: outcome.error }, outcome.status);
          if (!body.wait) return json({ runId: signal[1], status: "running" }, 202);
          const result = await outcome.work;
          return json(result ? { runId: signal[1], status: result.status, output: result.output } : { runId: signal[1], status: "error" });
        }

        return json({ error: "Not found" }, 404);
      } catch (err) {
        if (err instanceof ServeError) return json({ error: err.message }, 400);
        logger.error(`[halo] ${req.method} ${path} failed:`, err);
        return json({ error: err instanceof Error ? err.message : String(err) }, 500);
      }
    },
  });

  baseUrl = `http://${host.includes(":") ? `[${host}]` : host}:${server.port}`;
  if (!options.publicUrl && (host === "0.0.0.0" || host === "::")) {
    logger.warn(`Approval links will point at ${baseUrl}, which people can't open. Set HALO_PUBLIC_URL (or publicUrl in halo.json) to the address they reach this server at.`);
  }

  // Check schedules now (to catch up after a restart), then at the top of every minute.
  let timer: ReturnType<typeof setTimeout> | undefined;
  if (options.scheduler !== false && schedules.length) {
    tick();
    const arm = () => {
      timer = setTimeout(() => {
        tick();
        arm();
      }, 60_000 - (Date.now() % 60_000) + 50);
    };
    arm();
  }

  const watchTimers = options.scheduler === false ? [] : watches.map((w) => setInterval(() => void checkWatch(w), w.every));
  if (options.scheduler !== false) void checkWatches();

  return {
    url: baseUrl,
    port: server.port!,
    pipelines: [...entries.keys()],
    tick,
    schedules: scheduleInfo,
    checkWatches,
    start,
    settled,
    approvalUrl,
    async stop() {
      clearTimeout(timer);
      for (const t of watchTimers) clearInterval(t);
      if (lockHeldBy === lockOwner) {
        try {
          if (JSON.parse(readFileSync(lockFile, "utf8")).owner === lockOwner) rmSync(lockFile);
        } catch {}
      }
      await server.stop(true);
      await Promise.allSettled([...inflight.values()]);
      await Promise.all(runtimes.map((r) => r.close()));
      telemetry.close();
    },
  };
}

/** Read halo.json (if present) from a path or the current folder. */
/** A pipeline's description for MCP clients: its signature and where it lives. */
function describePipeline(e: Entry): string {
  const params = e.decl.params.map((p) => `${p.name}: ${p.type}`).join(", ");
  return `Halo pipeline ${e.name}(${params})${e.decl.returnType ? ` -> ${e.decl.returnType}` : ""} from ${e.file}. Runs it and returns its output.`;
}

/**
 * The address a hosting platform gives this app, from the variables it sets, for approval
 * links when neither publicUrl nor HALO_PUBLIC_URL says. Render gives a URL, Railway a
 * domain, and Fly the app's name (served at <name>.fly.dev).
 */
export function platformPublicUrl(env: Record<string, string | undefined>): string | undefined {
  if (env.RENDER_EXTERNAL_URL) return env.RENDER_EXTERNAL_URL;
  if (env.RAILWAY_PUBLIC_DOMAIN) return `https://${env.RAILWAY_PUBLIC_DOMAIN}`;
  if (env.FLY_APP_NAME) return `https://${env.FLY_APP_NAME}.fly.dev`;
  return undefined;
}

/**
 * Where `halo serve` listens, from (highest first) its flags, the environment, and halo.json.
 *
 * Hosting platforms (Render, Railway, Heroku, Cloud Run, Fly, ...) say which port to use in
 * PORT and expect the app on every interface. So PORT wins over halo.json's port, and when
 * it's set and nothing names a host, Halo listens on 0.0.0.0, which still needs a token.
 * HALO_HOST names the interface explicitly.
 */
export function listenAddress(
  flags: { port?: string; host?: string },
  config: Pick<ServeConfig, "port" | "host">,
  env: Record<string, string | undefined>,
): { port?: number; host?: string; from?: string } {
  const portFromEnv = env.PORT?.trim() || undefined;
  const raw = flags.port ?? portFromEnv ?? (config.port !== undefined ? String(config.port) : undefined);
  let port: number | undefined;
  if (raw !== undefined) {
    port = Number(raw);
    if (!/^\d+$/.test(raw.trim()) || port > 65535) {
      throw new ServeError(`${flags.port !== undefined ? "--port" : raw === portFromEnv ? "PORT" : "halo.json port"} must be a port number from 0 to 65535, not "${raw}"`);
    }
  }
  const hostFromEnv = env.HALO_HOST?.trim() || undefined;
  let host = flags.host ?? hostFromEnv ?? config.host;
  let from: string | undefined;
  if (host === undefined && flags.port === undefined && portFromEnv !== undefined) {
    host = "0.0.0.0";
    from = "PORT";
  }
  return { port, host, from };
}

export async function loadServeConfig(path?: string): Promise<ServeConfig> {
  const file = path ?? (existsSync("halo.json") ? "halo.json" : undefined);
  if (!file) return {};
  if (!existsSync(file)) throw new ServeError(`Config not found: ${file}`);
  try {
    return (await Bun.file(file).json()) as ServeConfig;
  } catch (err) {
    throw new ServeError(`${file} is not valid JSON: ${err instanceof Error ? err.message : err}`);
  }
}
