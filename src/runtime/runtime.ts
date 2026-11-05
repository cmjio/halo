/**
 * Halo Runtime — executes a parsed AST.
 *
 * Execution model:
 *   1. Register all declarations (agents, tools, stores, policies, pipelines).
 *   2. A pipeline runs its pipeline stage by stage. The flowing value is
 *      `context.current`; each call's result is also stored under
 *      `context.data.<Callee>.<method>` and, with `as name`, `context.data.<name>`.
 *   3. Agents call LLMs through provider adapters (optionally via the router),
 *      wrapped by policies and the @retry / @timeout / @shadow directives.
 *   4. `context.meta` records cost, tokens, and calls; `context.trace` is a
 *      SHA-256 hash chain of every stage touched.
 *   5. `|! yield` and `~> listen` ask a registered handler. With no handler,
 *      the run pauses (status "paused") and `signal(runId, ...)` resumes it.
 *   6. An agent given `tools:` chooses its own tool calls (native tool calling),
 *      each checked against its policies before it runs; a call a policy wants
 *      approved asks onInterrupt, or pauses the run (waiting for "approval").
 */

import { mkdirSync, renameSync, statSync } from "node:fs";
import { dirname } from "node:path";
import type {
  BranchStage,
  CallStage,
  CondExpr,
  Directive,
  EachStage,
  FanOutStage,
  PolicyDeclaration,
  InterruptStage,
  ListenStage,
  LoopStage,
  Agent,
  ParseResult,
  PipelineStage,
  PipelineDeclaration,
  SchemaDeclaration,
  ToolDeclaration,
  Value,
} from "../parser/types.js";
import { SYSTEM_EVENTS, includes, parseDuration } from "../parser/builtins.js";
import { render } from "../parser/index.js";
import { stageLabel } from "../parser/labels.js";
export { stageLabel };
import { producedKeys } from "../parser/validate.js";
import { AdapterRegistry, type LLMMessage, type LLMRequest, type LLMToolCall, type LLMToolSpec, type ProviderAdapter } from "./adapter.js";
import { CostTracker, LLMRouter, type RouterConfig } from "./router.js";
import { PolicyEngine, type PolicyHooks, type Violation } from "./policies.js";
import { BUILTIN_PROVIDER_INFO } from "./provider-info.js";
import { closeMcpClients } from "./mcp.js";
import { closeChromeSessions } from "./providers/chrome.js";
import { closeRemoteSessions } from "./providers/remote.js";
import { closeKvDatabases } from "./providers/index.js";
import { LocalVectorStore } from "./vectors.js";
import { applyPreset, skillNames } from "./presets.js";
import { withSandbox } from "./sandbox-agents.js";
import { findSkill, skillCatalog, skillPrompt } from "./skills.js";
import { skillSources } from "./providers/skills.js";
import { appendStep, readSteps, stateAt, stepsPathFor } from "./history.js";
import { applyOps, threadKey, ThreadStore, type ThreadContext, type ThreadOp } from "./threads.js";
import { deleteLog, logPathFor, readSnapshot, writeSnapshot } from "./snapshots.js";
import { BUILTIN_PROVIDERS, declArgs, type ProviderInfo, type ToolMethod, type ToolProvider, type ToolServices } from "./tools.js";
import { HttpError, HaloError, LoopLimitError, PolicyViolation, SchemaValidationError, SignalError, TimeoutError, isRetryable } from "./errors.js";
import { validateReturn } from "./schema.js";
import { placeholderSpots, quoteFor } from "./shell.js";
import { asNumber, asText, formatValue, getPath, hasOwnKey, humanize, interpolate, isPlainObject, isSafeKey, looseEquals, parseOutput, pick, sleep, truthy } from "./values.js";

export * from "./errors.js";
export type { Violation } from "./policies.js";
export type { ToolProvider, ToolCall, ToolServices, ProviderInfo, ToolMethod, ToolEffect, JsonSchema } from "./tools.js";

// ── Public types ─────

export interface ContextSnapshot {
  input: Record<string, unknown>;
  data: Record<string, unknown>;
  meta: RunMeta;
  trace: TraceEntry[];
  /** For a `@thread` pipeline: its thread, and its state (as saved, once the run has ended). */
  thread?: { name: string; key: string; version: number; state: Record<string, unknown> };
}

export interface InterruptRequest {
  pipeline: string;
  /** Message for the human, from `msg:`/`message:` or the first string arg. */
  message?: string;
  /** Where to ask, from `channel:`/`queue:` or a tool name arg. */
  channel?: string;
  /** List args, e.g. links or diffs to review. */
  attachments: unknown[];
  timeoutMs?: number;
  args: unknown[];
  named: Record<string, unknown>;
  current: unknown;
  context: ContextSnapshot;
}

export interface ListenRequest {
  pipeline: string;
  target: string;
  current: unknown;
  context: ContextSnapshot;
}

export interface SystemCall {
  method: string;
  args: unknown[];
  named: Record<string, unknown>;
  current: unknown;
  context: ContextSnapshot;
}

export type InterruptHandler = (req: InterruptRequest) => unknown | Promise<unknown>;
export type ListenHandler = (req: ListenRequest) => unknown | Promise<unknown>;
export type SystemHandler = (call: SystemCall) => unknown | Promise<unknown>;

export interface MockRequest {
  target: string;
  kind: "agent" | "tool" | "yield" | "listen" | "approval";
  prompt?: string;
  system?: string;
  args: unknown[];
  named: Record<string, unknown>;
  input: unknown;
  /** For an agent with tools: the "Tool.method" names it may call, the conversation so far, and the step (1, 2, ...). */
  tools?: string[];
  messages?: LLMMessage[];
  step?: number;
}

/** A mocked model turn that calls a tool: `useTool("Files.read", { path: "a.ts" })`. Return one, or a list, from a mock. */
export class ToolUse {
  constructor(readonly target: string, readonly args: Record<string, unknown> = {}) {}
}

export const useTool = (target: string, args: Record<string, unknown> = {}) => new ToolUse(target, args);

/** One answer a run got from outside: a model, a tool, a person (approving a tool call, or at a yield), or an event. */
export interface RecordedCall {
  kind: "agent" | "tool" | "approval" | "yield" | "listen";
  target: string;
  value: unknown;
  /** For a model turn that called tools: the calls. */
  toolCalls?: Array<{ name: string; args: Record<string, unknown> }>;
}

/** A canned value, or a function computing one. */
export type MockValue = unknown | ((req: MockRequest) => unknown | Promise<unknown>);

export interface CallRecord {
  pipeline: string;
  stage: number;
  target: string;
  kind: "agent" | "tool" | "shadow";
  model?: string;
  latencyMs: number;
  cost: number;
  tokens?: { prompt: number; completion: number };
  attempts: number;
  mocked: boolean;
  /** For a tool call an agent chose: that agent. */
  agent?: string;
}

export interface ShadowRecord {
  primary: string;
  shadow: string;
  output?: unknown;
  error?: string;
  latencyMs: number;
}

export interface RunMeta {
  runId: string;
  pipeline: string;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  cost: number;
  tokens: { prompt: number; completion: number };
  calls: CallRecord[];
  violations: Violation[];
  shadows: ShadowRecord[];
  halted?: { stage: number; condition: string };
  /** Set while the run waits at `|! yield` (`waitingFor: "yield"`) or `~> listen(T)` (`waitingFor: T`). */
  /** `id` is new for every pause, so an approval for one pause can't answer a later one. */
  paused?: { stage: number; waitingFor: string; message?: string; id?: string };
  /** How many times the run has paused. */
  pauses?: number;
  checkpoint?: string;
  /** For a run started from an earlier step of another (`rewind`): that run and step. */
  rewoundFrom?: { runId: string; step: number };
}

export interface TraceEntry {
  index: number;
  stage: PipelineStage["kind"];
  label: string;
  at: string;
  /** SHA-256 of the stage's output value. */
  outputHash: string;
  /** SHA-256 over (prev, index, stage, label, at, outputHash). */
  hash: string;
  prev: string;
}

export interface RunResult {
  output: unknown;
  /** halted: a gate closed. paused: waiting for `signal(runId, ...)`. */
  status: "completed" | "halted" | "paused";
  runId: string;
  context: ContextSnapshot;
}

/** Everything needed to continue a run later: a @checkpoint file or a paused run. */
export interface RunSnapshot {
  version: 1;
  pipeline: string;
  /** Stage to run next; for a paused run, the yield/listen stage waiting for its response. */
  nextStage: number;
  waitingFor?: string;
  input: Record<string, unknown>;
  data: Record<string, unknown>;
  meta: RunMeta;
  trace: TraceEntry[];
  current: unknown;
  /** Loop iteration counts, so a pause can't reset a loop's `max`. */
  loops?: Record<number, number>;
  loopFeedback?: ExecutionContext["loopFeedback"];
  /** An agent's tool conversation, kept while the run waits for a person to approve one of its calls. */
  sessions?: Record<number, AgentSession>;
  /** A `@thread` run's thread: what it loaded and the changes it hasn't saved yet. */
  thread?: ThreadContext;
}

/** Where an agent's tool conversation stopped to wait for approval: its turns so far and the calls still to run (the first is the one waiting). */
export interface AgentSession {
  messages: LLMMessage[];
  pending: LLMToolCall[];
  step: number;
}

/** Where paused runs are kept until `signal()` resumes them. */
export interface RunStore {
  save(runId: string, snapshot: RunSnapshot): void | Promise<void>;
  load(runId: string): RunSnapshot | undefined | Promise<RunSnapshot | undefined>;
  delete(runId: string): void | Promise<void>;
  /**
   * Remove and return a run in one step, so only one of several concurrent
   * resumes can claim it. Stores without it fall back to load + delete, which
   * is only safe within one process.
   */
  take?(runId: string): RunSnapshot | undefined | Promise<RunSnapshot | undefined>;
  /** A resumed run has ended (it didn't pause again): drop anything kept for its next pause. */
  finished?(runId: string): void | Promise<void>;
}

/** Keeps paused runs in this process (the default). */
export class MemoryRunStore implements RunStore {
  private runs = new Map<string, string>();
  save(runId: string, snapshot: RunSnapshot) {
    this.runs.set(runId, JSON.stringify(snapshot));
  }
  load(runId: string) {
    const json = this.runs.get(runId);
    return json === undefined ? undefined : (JSON.parse(json) as RunSnapshot);
  }
  delete(runId: string) {
    this.runs.delete(runId);
  }
  take(runId: string) {
    const snap = this.load(runId);
    this.runs.delete(runId);
    return snap;
  }
}

/** Keeps paused runs as JSON files, so another process (or `halo resume`) can continue them. */
/**
 * Keeps paused runs as files (see snapshots.ts: a small core file plus an append-only
 * log, so pausing a long run again only writes what's new). A snapshot this process
 * saved is reused while its file is unchanged, so resuming doesn't re-read its history.
 */
export class FileRunStore implements RunStore {
  private saved = new Map<string, { snapshot: RunSnapshot; version: string }>();
  constructor(readonly dir = ".halo/runs") {}
  private path(runId: string) {
    if (!/^[\w-]+$/.test(runId)) throw new SignalError(`Invalid run id "${runId}"`, "RUN_NOT_FOUND");
    return `${this.dir}/${runId}.json`;
  }
  private version(file: string): string | undefined {
    try {
      const s = statSync(file);
      return `${s.mtimeMs}:${s.size}`;
    } catch {
      return undefined;
    }
  }
  private async read(runId: string, file: string): Promise<RunSnapshot | undefined> {
    const cached = this.saved.get(runId);
    if (cached && cached.version === this.version(file)) return cached.snapshot;
    return readSnapshot(file, logPathFor(this.path(runId)));
  }
  async save(runId: string, snapshot: RunSnapshot) {
    const file = this.path(runId);
    await writeSnapshot(file, snapshot);
    this.saved.set(runId, { snapshot, version: this.version(file)! });
  }
  async load(runId: string) {
    return this.read(runId, this.path(runId));
  }
  async delete(runId: string) {
    this.saved.delete(runId);
    await Bun.file(this.path(runId)).delete().catch(() => {});
    await deleteLog(logPathFor(this.path(runId)));
  }
  /** Atomic across processes: renaming the core file claims it; a second claimer finds it gone. The log stays for the next pause. */
  async take(runId: string) {
    const claimed = `${this.path(runId)}.taken-${crypto.randomUUID()}`;
    try {
      renameSync(this.path(runId), claimed);
    } catch {
      return undefined;
    }
    try {
      return await this.read(runId, claimed);
    } finally {
      this.saved.delete(runId);
      await Bun.file(claimed).delete().catch(() => {});
    }
  }
  async finished(runId: string) {
    await deleteLog(logPathFor(this.path(runId)));
  }
}

export type RuntimeEvent =
  | { type: "run"; pipeline: string; runId: string; status: "start" | "completed" | "halted" | "paused" | "error"; output?: unknown; error?: string; durationMs?: number; cost?: number }
  | { type: "stage"; pipeline: string; runId: string; index: number; kind: PipelineStage["kind"]; label: string; status: "start" | "end"; value?: unknown; durationMs?: number }
  | { type: "llm"; pipeline: string; runId: string; agent: string; model: string; system?: string; prompt: string; output: unknown; latencyMs: number; cost: number; tokens?: { prompt: number; completion: number }; mocked: boolean }
  | { type: "tool"; pipeline: string; runId: string; tool: string; method: string; output: unknown; latencyMs: number; mocked: boolean }
  /** A tool call an agent chose, and what happened to it: run, approved and run, declined by a person, refused by a policy, or failed. */
  | { type: "agent_tool"; pipeline: string; runId: string; agent: string; target: string; args: unknown; decision: "allowed" | "approved" | "declined" | "refused" | "error"; detail?: string }
  | { type: "retry"; runId: string; target: string; attempt: number; error: string; delayMs: number }
  | { type: "shadow"; runId: string; record: ShadowRecord }
  | { type: "halt"; runId: string; pipeline: string; index: number; condition: string }
  /** A branch stage chose an arm (`arm` is its index; -1 when none matched). */
  | { type: "branch"; runId: string; pipeline: string; index: number; arm: number; condition?: string }
  /** A loop's condition held, so the run jumps back to `to` (the agent's earlier stage). */
  | { type: "loop"; runId: string; pipeline: string; index: number; to: number; iteration: number; condition: string }
  /** An output policy rejected an agent's answer and `@correct` asked it to try again. */
  | { type: "correction"; runId: string; pipeline: string; target: string; attempt: number; error: string }
  /** Text from a model, in order (the whole answer as one chunk unless the adapter streams). */
  | { type: "token"; runId: string; pipeline: string; target: string; text: string }
  | { type: "paused"; pipeline: string; runId: string; index: number; waitingFor: string }
  | { type: "checkpoint"; runId: string; path: string }
  | ({ type: "violation"; runId: string } & Violation);

export interface RuntimeConfig {
  /** API key used for any provider without a more specific key. */
  apiKey?: string;
  /** Per-provider keys, by adapter id (e.g. { anthropic: "...", openai: "..." }). */
  apiKeys?: Record<string, string>;
  /** Environment for `Env.*` and provider keys. Defaults to Bun.env. */
  env?: Record<string, string | undefined>;
  /** Router configuration for model selection */
  router?: RouterConfig;
  /** fetch implementation (for tests or proxies). */
  fetch?: typeof fetch;
  /** SQLite file for VectorStore tools. Defaults to .halo/vectors.sqlite */
  vectorPath?: string;
  /** SQLite file for `@thread` state. Defaults to .halo/threads.sqlite */
  threadPath?: string;
  /** Directory for @checkpoint snapshots. Defaults to .halo/checkpoints */
  checkpointDir?: string;
  /** Where paused runs wait for `signal()`. Defaults to an in-memory store. */
  runStore?: RunStore;
  onInterrupt?: InterruptHandler;
  onListen?: ListenHandler;
  /** Receives System.Publish / Distribute / ResolveIncident / TriggerWebhook / Notify. */
  onSystemEvent?: (call: SystemCall) => unknown | Promise<unknown>;
  /** Observe execution (stages, LLM calls, retries, ...). */
  onEvent?: (event: RuntimeEvent) => void;
  /** Receives every model answer, tool result, and approval as it happened (unredacted), so the run can be replayed. */
  recorder?: (entry: RecordedCall) => void;
  logger?: Pick<Console, "log" | "warn">;
}

// ── Internals ─────

interface ExecutionContext {
  pipeline: PipelineDeclaration;
  input: Record<string, unknown>;
  data: Record<string, unknown>;
  meta: RunMeta;
  trace: TraceEntry[];
  current: unknown;
  stageIndex: number;
  depth: number;
  signal: AbortSignal;
  shadowTasks: Promise<void>[];
  /** How many times each loop stage (by index) has jumped back. */
  loops: Record<number, number>;
  /** Set while a loop sends the run back: the stage being retried and what the check saw. */
  loopFeedback?: { stage: number; condition: string; value: unknown; iteration: number; previous?: unknown };
  /** The last answer of each agent stage (by index), so a loop retry can show the agent what it tried. */
  answers?: Record<number, unknown>;
  /** Agent tool conversations waiting for approval, by stage index (see AgentSession). */
  sessions?: Record<number, AgentSession>;
  /** A person's answer to the approval a stage paused for, by stage index. */
  approvals?: Record<number, unknown>;
  /** The calling pipeline's context, for a called pipeline. */
  parent?: ExecutionContext;
  /** When this pipeline's @timeout runs out (ms since epoch). */
  deadline?: number;
  /** A `@thread` run's thread (shared by the pipelines it calls). */
  thread?: ThreadContext;
}

/** Thrown inside a run to pause it at a yield/listen with no handler. */
class Pause {
  constructor(readonly waitingFor: string, readonly message?: string) {}
}

interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

/** One request in an agent's tool conversation. */
interface Turn {
  messages: LLMMessage[];
  tools: LLMToolSpec[];
  /** "none" asks for an answer without more tool calls (the last step). */
  toolChoice?: "auto" | "none";
  /** The "Tool.method" names offered, for mocks. */
  targets: string[];
  step: number;
  /** What this turn adds to the conversation, for telemetry (not the whole conversation every step). */
  shown: string;
}

/** The tools an agent may choose from on one call, by the function name the model uses and by "Tool.method". */
interface ToolKit {
  specs: LLMToolSpec[];
  /** The "Tool.method" names offered (methods its policies hide aren't). */
  offered: string[];
  byName: Map<string, { tool: ToolDeclaration; method: ToolMethod; target: string }>;
}

/** Named args on an agent call that configure the request rather than the prompt. */
/**
 * Which of a tool call's arguments are shell commands, whose {{placeholders}} are quoted
 * for the spot they fill: every argument of Bash, and Remote's `command`.
 */
function shellArgs(provider: string | undefined): (name: string | undefined) => boolean {
  if (provider === "Bash") return () => true;
  if (provider === "Remote") return (name) => name === "command";
  return () => false;
}

const LLM_OPTION_KEYS = new Set(["max_tokens", "temperature", "temp", "top_p", "system", "tools", "max_steps", "tool_result_chars", "skills"]);
const DEFAULT_MAX_STEPS = 10;
const DEFAULT_TOOL_RESULT_CHARS = 16_000;

/** Why a person declined, when they said: `{ reason }`, or what they typed beyond a plain "no". */
function declineReason(answer: unknown): string {
  const said = isPlainObject(answer) ? (answer.reason ?? answer.comment ?? answer.text) : answer;
  if (typeof said !== "string") return "";
  const text = said.trim();
  return text && !/^(?:n|no|nope|reject|rejected|deny|denied|decline|declined)$/i.test(text) ? `: ${text.slice(0, 500)}` : "";
}

/** A person's answer that approves something: "approve", "yes", `{ approved: true }`, ... */
function isApproval(answer: unknown): boolean {
  if (answer === true) return true;
  if (typeof answer === "string") return /^\s*(?:y|yes|approve|approved|allow|ok|okay)\s*$/i.test(answer);
  if (isPlainObject(answer)) return answer.approved === true || answer.action === "approve" || answer.status === "approved";
  return false;
}
const MAX_STREAM_DEPTH = 16;
const MAX_PIPELINE_CALLS = 100_000;
const GENESIS = "0".repeat(64);

function sha256(...parts: string[]): string {
  const h = new Bun.CryptoHasher("sha256");
  for (const p of parts) h.update(p);
  return h.digest("hex");
}

function safeJson(v: unknown): string {
  try {
    return JSON.stringify(v) ?? "undefined";
  } catch {
    return String(v);
  }
}

function copy<T>(v: T): T {
  try {
    return structuredClone(v);
  } catch {
    return JSON.parse(formatValue(v));
  }
}

/** The start of a long text, marked where it was cut. */
function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max)}\n[... ${text.length - max} more characters]`;
}

/** The reply length assumed for a call that sets none (Anthropic's adapter sends this by default). */
const DEFAULT_MAX_TOKENS = 4096;

/** A high estimate of a text's tokens: about 3 characters each for ASCII, one each for anything else (CJK and the like). */
function estimateTokens(text: string): number {
  let ascii = 0;
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) < 128) ascii++;
  return Math.ceil(ascii / 3) + (text.length - ascii);
}

/**
 * Run parallel branches under their own signal. The first failure stops the others, and
 * waits for them to wind down, so the calls they already sent count in the run's cost
 * before it reports (and runaway branches don't keep going in the background).
 */
async function branches<T>(signal: AbortSignal, start: (signal: AbortSignal) => Promise<T>[]): Promise<T[]> {
  const controller = childSignal(signal);
  try {
    const work = start(controller.signal).map((p) => p.catch((err: unknown) => (controller.abort(err), Promise.reject(err))));
    const settled = await Promise.allSettled(work);
    const failure = settled.find((r): r is PromiseRejectedResult => r.status === "rejected");
    if (failure) throw failure.reason;
    return settled.map((r) => (r as PromiseFulfilledResult<T>).value);
  } finally {
    controller.abort(DONE);
  }
}

function raceAbort<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  work.catch(() => {}); // the loser of the race must not surface as an unhandled rejection
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
    work.then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
  });
}

/**
 * A controller that aborts when `parent` does. Abort it when its work is done: that also
 * detaches it from the parent, which otherwise collects one listener per call for the
 * whole run (and makes every later listener slower to add).
 */
function childSignal(parent: AbortSignal): AbortController {
  const c = new AbortController();
  if (parent.aborted) c.abort(parent.reason);
  else {
    const onAbort = () => c.abort(parent.reason);
    parent.addEventListener("abort", onAbort, { once: true });
    c.signal.addEventListener("abort", () => parent.removeEventListener("abort", onAbort), { once: true });
  }
  return c;
}

const DONE = new HaloError("Done");

function directiveArgs(d: Directive | undefined): string[] {
  return d?.value ? d.value.split(/\s*,\s*/) : [];
}

function findDirective(list: Directive[] | undefined, name: string): Directive | undefined {
  return list?.find((d) => d.name === name);
}

/** Check that a trace is an unbroken hash chain. */
export function verifyTrace(trace: TraceEntry[]): boolean {
  let prev = GENESIS;
  for (const t of trace) {
    if (t.prev !== prev || t.hash !== sha256(t.prev, String(t.index), t.stage, t.label, t.at, t.outputHash)) return false;
    prev = t.hash;
  }
  return true;
}

// ── Runtime ─────

export class HaloRuntime {
  private agents = new Map<string, Agent>();
  private pipelines = new Map<string, PipelineDeclaration>();
  private policies = new Map<string, PolicyDeclaration>();
  private tools = new Map<string, ToolDeclaration>();
  private schemas = new Map<string, SchemaDeclaration>();
  private listeners = new Set<(event: RuntimeEvent) => void>();
  /** Runs being claimed right now (guards stores without an atomic take). */
  private resuming = new Set<string>();
  private guard = new PolicyEngine(this.policies);
  private shadowMinds = new Map<string, Agent[]>();
  private shadowModels = new Map<string, string[]>();

  private config: RuntimeConfig;
  private mocks: Record<string, MockValue> | null = null;
  private adapterRegistry = new AdapterRegistry();
  private router: LLMRouter;
  private routerEnabled: boolean;
  private costTracker = new CostTracker();
  /**
   * Per run (keyed by the top pipeline's meta): estimates of model calls in flight, plus
   * costs in sub-pipelines not yet added to the top, so MaxSpend holds across parallel calls.
   */
  private unsettled = new WeakMap<RunMeta, number>();
  /** Sub-pipeline calls per run, to stop runaway recursion. */
  private pipelineCalls = new WeakMap<RunMeta, number>();
  /** Model calls in flight per run, and calls waiting under MaxSpend for one of them to settle. */
  private inflight = new WeakMap<RunMeta, { calls: number; waiting: Array<() => void> }>();
  private providers = new Map<string, ToolProvider>(Object.entries(BUILTIN_PROVIDERS));
  private providerInfo = new Map<string, ProviderInfo>(Object.entries(BUILTIN_PROVIDER_INFO));
  private systems = new Map<string, SystemHandler>();
  private vectorStore?: LocalVectorStore;
  private threadStore?: ThreadStore;
  private sqlPool = new Map<string, InstanceType<typeof Bun.SQL>>();
  private runStore: RunStore;

  constructor(config: RuntimeConfig = {}) {
    this.config = config;
    this.runStore = config.runStore ?? new MemoryRunStore();
    this.router = new LLMRouter(config.router);
    this.routerEnabled = config.router !== undefined;
  }

  private get env(): Record<string, string | undefined> {
    return this.config.env ?? Bun.env;
  }

  private get logger(): Pick<Console, "log" | "warn"> {
    return this.config.logger ?? console;
  }

  private get fetch(): typeof fetch {
    return this.config.fetch ?? fetch;
  }

  // ── Setup ──

  /** Load a parsed program into the runtime. */
  load(ast: ParseResult): this {
    if (ast.errors.length > 0) throw new HaloError(`Cannot load a program with parse errors:\n  ${ast.errors.join("\n  ")}`);
    for (const s of ast.pipelines) {
      for (const stage of s.pipeline) {
        const unsafe = producedKeys(stage).find((k) => !isSafeKey(k));
        if (unsafe) throw new HaloError(`Pipeline "${s.name}": "${unsafe}" can't be used as a name (as ${unsafe})`, { code: "UNSAFE_NAME" });
      }
      this.pipelines.set(s.name, s);
    }
    for (const g of ast.policies) this.policies.set(g.name, g);
    for (const t of [...ast.tools, ...ast.stores]) this.tools.set(t.name, t);
    const declared = new Map(this.tools);
    for (const m of ast.agents) {
      let agent: Agent;
      try {
        agent = applyPreset(m);
      } catch (err) {
        throw new HaloError((err as Error).message, { code: "UNKNOWN_PRESET" });
      }
      try {
        const sandboxed = withSandbox(agent, declared);
        agent = sandboxed.agent;
        if (sandboxed.tool) this.tools.set(sandboxed.tool.name, sandboxed.tool);
      } catch (err) {
        throw new HaloError((err as Error).message, { code: "BAD_SANDBOX" });
      }
      this.agents.set(m.name, agent);
    }
    for (const sc of ast.schemas) this.schemas.set(sc.name, sc);
    this.indexShadows();
    return this;
  }

  /**
   * `@shadow(Primary) agent Candidate` runs Candidate alongside every Primary call.
   * `@shadow(openai/gpt-4o) agent M` runs the same prompt on that model alongside M.
   */
  private indexShadows(): void {
    this.shadowMinds.clear();
    this.shadowModels.clear();
    for (const m of this.agents.values()) {
      const target = findDirective(m.directives, "shadow")?.value;
      if (!target || target === m.name) continue;
      if (this.agents.has(target)) this.shadowMinds.set(target, [...(this.shadowMinds.get(target) ?? []), m]);
      else if (/[-/]/.test(target)) this.shadowModels.set(m.name, [...(this.shadowModels.get(m.name) ?? []), target]);
    }
  }

  /** Register a custom adapter */
  registerAdapter(adapter: ProviderAdapter): this {
    this.adapterRegistry.register(adapter);
    return this;
  }

  /** Register a tool provider, usable as `tool Name : <name>(...)`. */
  /** Register a tool provider. With `info` (its methods, their arguments and effects), agents can choose to call its tools. */
  registerToolProvider(name: string, provider: ToolProvider, info?: ProviderInfo): this {
    this.providers.set(name, provider);
    if (info) this.providerInfo.set(name, info);
    return this;
  }

  /** What a provider's methods do, if it says (for `halo plan` and agents' tool lists). */
  toolProviderInfo(name: string): ProviderInfo | undefined {
    return this.providerInfo.get(name);
  }

  /** Names of every registered tool provider. */
  toolProviderNames(): string[] {
    return [...this.providers.keys()];
  }

  /** Register a `System.<name>(...)` method. A non-undefined return value replaces the pipeline value. */
  registerSystem(name: string, handler: SystemHandler): this {
    this.systems.set(name, handler);
    return this;
  }

  /** Handle `|! yield(...)` (human-in-the-loop). */
  onInterrupt(handler: InterruptHandler): this {
    this.config.onInterrupt = handler;
    return this;
  }

  /** Handle `~> listen(...)` (external events). */
  onListen(handler: ListenHandler): this {
    this.config.onListen = handler;
    return this;
  }

  /** Set the router configuration */
  setRouterConfig(config: RouterConfig): this {
    this.router = new LLMRouter(config);
    this.routerEnabled = true;
    return this;
  }

  /**
   * Install mock responses — for testing. Keys are `Callee.method` or `Callee`
   * for agents and tools, `*` for any agent, `yield` for interrupts, and the
   * listen target (e.g. `Slack.Reaction`) for listeners.
   */
  mockAll(responses: Record<string, MockValue>): this {
    this.mocks = { ...(this.mocks ?? {}), ...responses };
    return this;
  }

  /** Get cost tracker for usage tracking. */
  getCostTracker(): CostTracker {
    return this.costTracker;
  }

  /** Release database handles. */
  /** Release databases, and stop MCP servers this process started (they are shared by every runtime in it). */
  async close(): Promise<void> {
    await Promise.all([closeMcpClients(), closeChromeSessions(), closeRemoteSessions()]);
    closeKvDatabases();
    this.vectorStore?.close();
    this.vectorStore = undefined;
    this.threadStore?.close();
    this.threadStore = undefined;
    await Promise.all([...this.sqlPool.values()].map((db) => db.close()));
    this.sqlPool.clear();
  }

  // ── Execution ──

  /** Execute a named pipeline with the provided arguments and return its output. */
  async execute(pipelineName: string, args: Record<string, unknown>): Promise<unknown> {
    return (await this.run(pipelineName, args)).output;
  }

  /** Execute a named pipeline and return its output, status, and full context. */
  async run(pipelineName: string, args: Record<string, unknown> = {}, options: { signal?: AbortSignal; runId?: string } = {}): Promise<RunResult> {
    const pipeline = this.pipelines.get(pipelineName);
    if (!pipeline) throw new HaloError(`Pipeline "${pipelineName}" not found`, { code: "PIPELINE_NOT_FOUND" });
    const ctx = this.newContext(pipeline, args, 0, options.signal);
    if (options.runId) ctx.meta.runId = options.runId;
    return this.runTop(ctx, 0);
  }

  /** The pipelines this runtime has loaded. */
  listPipelines(): PipelineDeclaration[] {
    return [...this.pipelines.values()];
  }

  /**
   * Run a pipeline and yield its events as they happen: stages, model output
   * (`token`), tool calls, and finally `done` (or `error`).
   */
  async *stream(pipelineName: string, args: Record<string, unknown> = {}): AsyncGenerator<RuntimeEvent | { type: "done"; result: RunResult } | { type: "error"; error: Error }> {
    const pipeline = this.pipelines.get(pipelineName);
    if (!pipeline) throw new HaloError(`Pipeline "${pipelineName}" not found`, { code: "PIPELINE_NOT_FOUND" });
    const ctx = this.newContext(pipeline, args, 0);
    const queue: Array<RuntimeEvent | { type: "done"; result: RunResult } | { type: "error"; error: Error }> = [];
    let wake: (() => void) | undefined;
    const push = (e: (typeof queue)[number]) => {
      queue.push(e);
      wake?.();
    };
    // Only this run's events (other runs may share the runtime).
    const listener = (e: RuntimeEvent) => e.runId === ctx.meta.runId && push(e);
    this.listeners.add(listener);
    let finished = false;
    this.runTop(ctx, 0).then(
      (result) => push({ type: "done", result }),
      (error: unknown) => push({ type: "error", error: error instanceof Error ? error : new Error(String(error)) }),
    ).finally(() => (finished = true));
    try {
      while (true) {
        while (queue.length) {
          const e = queue.shift()!;
          yield e;
          if (e.type === "done" || e.type === "error") return;
        }
        if (finished && !queue.length) return;
        await new Promise<void>((r) => (wake = r));
        wake = undefined;
      }
    } finally {
      this.listeners.delete(listener);
    }
  }

  /** Continue a run from a @checkpoint file. */
  async resume(checkpointPath: string): Promise<RunResult> {
    const cp = await readSnapshot(checkpointPath);
    if (!cp) throw new HaloError(`No checkpoint at ${checkpointPath}`);
    // A run that ended has saved its thread changes already; only later ones are new.
    if (cp.thread && this.threads().savedBy(cp.thread.name, cp.thread.key, cp.meta.runId)) cp.thread.saved = cp.thread.ops.length;
    return this.runTop(this.restore(cp), cp.nextStage);
  }

  /**
   * Go back to a step of a @checkpoint run and continue from there, as a new run.
   * The new run starts with the state, trace, calls and cost the old one had after
   * that step (and, with @checkpoint, the history up to it). The old run is untouched.
   * Every stage after the step runs again: models, tools and approvals.
   */
  async rewind(checkpointPath: string, step: number, options: { runId?: string } = {}): Promise<RunResult> {
    const cp = await readSnapshot(checkpointPath);
    if (!cp) throw new HaloError(`No checkpoint at ${checkpointPath}`);
    const steps = await readSteps(stepsPathFor(checkpointPath));
    const at = stateAt(steps, step);
    const s = at.step;
    const runId = options.runId ?? crypto.randomUUID();
    const snap: RunSnapshot = {
      version: 1,
      pipeline: cp.pipeline,
      nextStage: s.next,
      input: cp.input,
      data: at.data,
      current: at.current,
      trace: cp.trace.slice(0, s.step),
      loops: s.loops ?? {},
      loopFeedback: s.loopFeedback,
      meta: {
        runId,
        pipeline: cp.pipeline,
        startedAt: new Date().toISOString(),
        cost: s.cost,
        tokens: s.tokens,
        calls: cp.meta.calls.slice(0, s.calls),
        violations: [],
        shadows: [],
        rewoundFrom: { runId: cp.meta.runId, step: s.step },
      },
    };
    if (cp.thread) {
      // The thread as the old run saw it at that step. Its changes so far are saved already if the old run ended.
      const ops = cp.thread.ops.slice(0, s.thread ?? 0);
      const saved = this.threads().savedBy(cp.thread.name, cp.thread.key, cp.meta.runId) ? ops.length : 0;
      snap.thread = { ...cp.thread, ops, state: applyOps(cp.thread.base, ops), saved };
    }
    const ctx = this.restore(snap);
    // The new run's history begins with the steps it shares with the old one.
    const path = this.checkpointPath(ctx);
    if (path) {
      mkdirSync(dirname(path), { recursive: true });
      await Bun.write(stepsPathFor(path), steps.slice(0, steps.indexOf(s) + 1).map((x) => JSON.stringify(x) + "\n").join(""));
    }
    return this.runTop(ctx, s.next);
  }

  /**
   * Resume a paused run. `event` is "yield" for a run paused at `|! yield(...)`,
   * or the listen target (e.g. "Slack.Reaction") for `~> listen(...)`; `payload`
   * becomes the response (`context.data.yield`, the listen target, and any `as` binding).
   */
  async signal(runId: string, event: string, payload: unknown, options: { pauseId?: string } = {}): Promise<RunResult> {
    return (await this.resumePaused(runId, event, payload, options)).result;
  }

  /**
   * Claim a paused run and start it again. Resolves as soon as the run is
   * claimed (`result` settles when it next completes, halts, or pauses), and
   * throws SignalError if it isn't paused, is waiting for something else, or
   * was already claimed by a concurrent resume. Exactly one resume wins.
   * With `pauseId`, only that particular pause can be answered.
   */
  async resumePaused(runId: string, event: string, payload: unknown, options: { pauseId?: string } = {}): Promise<{ pipeline: string; result: Promise<RunResult> }> {
    if (this.resuming.has(runId)) throw new SignalError(`No paused run "${runId}"`, "RUN_NOT_FOUND");
    this.resuming.add(runId);
    try {
      const snap = this.runStore.take ? await this.runStore.take(runId) : await this.runStore.load(runId);
      if (!snap || snap.waitingFor === undefined) throw new SignalError(`No paused run "${runId}"`, "RUN_NOT_FOUND");
      const problem =
        snap.waitingFor !== event
          ? new SignalError(`Run ${runId} is waiting for "${snap.waitingFor}", not "${event}"`, "SIGNAL_MISMATCH")
          : options.pauseId !== undefined && options.pauseId !== snap.meta.paused?.id
            ? new SignalError(`Run ${runId} is no longer waiting for that response`, "RUN_NOT_FOUND")
            : undefined;
      if (problem) {
        if (this.runStore.take) await this.runStore.save(runId, snap); // put it back untouched
        throw problem;
      }
      if (!this.runStore.take) await this.runStore.delete(runId);
      const ctx = this.restore(snap);
      const stage = ctx.pipeline.pipeline[snap.nextStage];
      const done = async (r: RunResult) => (r.status !== "paused" && (await this.runStore.finished?.(runId)), r);
      const failed = async (err: unknown) => {
        await this.runStore.finished?.(runId);
        throw err;
      };
      // An agent waiting for approval of a tool call: its stage runs again, picking up its conversation with the answer.
      if (snap.waitingFor === "approval") {
        if (stage?.kind !== "call" || !snap.sessions?.[snap.nextStage]) throw new SignalError(`Run ${runId} is not waiting for an approval`, "RUN_NOT_FOUND");
        ctx.approvals = { [snap.nextStage]: payload };
        return { pipeline: snap.pipeline, result: this.runTop(ctx, snap.nextStage).then(done, failed) };
      }
      if (stage?.kind !== "interrupt" && stage?.kind !== "listen") throw new SignalError(`Run ${runId} is not paused at a yield or listen`, "RUN_NOT_FOUND");
      ctx.stageIndex = snap.nextStage;
      this.config.recorder?.({ kind: stage.kind === "interrupt" ? "yield" : "listen", target: snap.waitingFor, value: payload });
      this.deliver(stage, ctx, payload, snap.waitingFor);
      this.appendTrace(ctx, snap.nextStage, stage, stageLabel(stage));
      // The paused stage is done now that it has its response.
      this.emit({ type: "stage", pipeline: ctx.pipeline.name, runId, index: snap.nextStage, kind: stage.kind, label: stageLabel(stage), status: "end", value: ctx.current, durationMs: 0 });
      // Once it ends without pausing again, the store can drop what it kept for the next pause.
      const result = this.runTop(ctx, snap.nextStage + 1).then(done, failed);
      return { pipeline: snap.pipeline, result };
    } finally {
      this.resuming.delete(runId);
    }
  }

  private restore(snap: RunSnapshot): ExecutionContext {
    const pipeline = this.pipelines.get(snap.pipeline);
    if (!pipeline) throw new HaloError(`Saved run is for pipeline "${snap.pipeline}", which is not loaded`);
    const ctx = this.newContext(pipeline, snap.input, 0);
    Object.assign(ctx, { data: snap.data, trace: snap.trace, current: snap.current, loops: snap.loops ?? {}, loopFeedback: snap.loopFeedback, sessions: snap.sessions, thread: snap.thread });
    ctx.meta = { ...snap.meta, halted: undefined, paused: undefined, finishedAt: undefined, durationMs: undefined };
    return ctx;
  }

  /** Run a top-level pipeline from `start`, reporting run events and checking the declared output schema. */
  private async runTop(ctx: ExecutionContext, start: number): Promise<RunResult> {
    const base = { pipeline: ctx.pipeline.name, runId: ctx.meta.runId };
    this.emit({ type: "run", ...base, status: "start" });
    try {
      ctx.thread ??= this.openThread(ctx);
      const result = await this.runFrom(ctx, start);
      // A run that ended (not one that paused) saves what it changed in its thread.
      if (ctx.thread && result.status !== "paused") result.context.thread = this.saveThread(ctx.thread, ctx.meta.runId);
      // A browser or sandbox the run opened stays open only while the run may still need it.
      if (result.status !== "paused") await Promise.all([closeChromeSessions(ctx.meta.runId), closeRemoteSessions(ctx.meta.runId)]);
      this.emit({ type: "run", ...base, status: result.status, output: result.output, durationMs: ctx.meta.durationMs, cost: ctx.meta.cost });
      return result;
    } catch (err) {
      await Promise.all([closeChromeSessions(ctx.meta.runId), closeRemoteSessions(ctx.meta.runId)]);
      this.emit({ type: "run", ...base, status: "error", error: err instanceof Error ? err.message : String(err), cost: ctx.meta.cost });
      throw err;
    }
  }

  private newContext(pipeline: PipelineDeclaration, args: Record<string, unknown>, depth: number, signal?: AbortSignal): ExecutionContext {
    const first = pipeline.params[0];
    return {
      loops: {},
      pipeline,
      input: { ...args },
      data: { ...args },
      meta: {
        runId: crypto.randomUUID(),
        pipeline: pipeline.name,
        startedAt: new Date().toISOString(),
        cost: 0,
        tokens: { prompt: 0, completion: 0 },
        calls: [],
        violations: [],
        shadows: [],
      },
      trace: [],
      current: first && Object.hasOwn(args, first.name) ? args[first.name] : Object.values(args)[0],
      stageIndex: 0,
      depth,
      signal: signal ?? new AbortController().signal,
      shadowTasks: [],
    };
  }

  private snapshot(ctx: ExecutionContext): ContextSnapshot {
    const t = ctx.thread;
    return { input: ctx.input, data: ctx.data, meta: ctx.meta, trace: ctx.trace, ...(t ? { thread: { name: t.name, key: t.key, version: t.version, state: t.state } } : {}) };
  }

  /** The built-in `Thread`, unless the file declares its own (e.g. `tool Thread : MCP(...)`). */
  private isThreadCall(callee: string): boolean {
    return callee === "Thread" && !this.isDeclared("Thread");
  }

  private threads(): ThreadStore {
    return (this.threadStore ??= new ThreadStore(this.config.threadPath ?? ".halo/threads.sqlite"));
  }

  /** Load the thread a `@thread(param)` pipeline's run belongs to. */
  private openThread(ctx: ExecutionContext): ThreadContext | undefined {
    const d = findDirective(ctx.pipeline.directives, "thread");
    if (!d || ctx.depth > 0) return undefined;
    const [param = "", name = ctx.pipeline.name] = d.value.split(/\s*,\s*/);
    return this.threads().open(name, threadKey(ctx.input[param], param, ctx.pipeline.name));
  }

  /** Save a run's thread changes onto the thread as it is now; returns what the run's result shows. */
  private saveThread(t: ThreadContext, runId: string): NonNullable<ContextSnapshot["thread"]> {
    const ops = t.ops.slice(t.saved ?? 0);
    if (!ops.length) return { name: t.name, key: t.key, version: t.version, state: t.state };
    const saved = this.threads().commit(t.name, t.key, ops, runId);
    return { name: t.name, key: t.key, version: saved.version, state: saved.state };
  }

  /** `Thread.set(field: value)`, `Thread.append(field: value, keep: n)`, `Thread.clear("field")`: change the run's thread. */
  private threadCall(stage: CallStage, ctx: ExecutionContext): unknown {
    let top = ctx;
    while (top.parent) top = top.parent;
    const t = ctx.thread ?? top.thread;
    if (!t) throw new HaloError(`Thread.${stage.method} needs a thread: add @thread(<input>) to the pipeline that runs`);
    const { positional, named } = this.resolveArgs(stage, ctx);
    for (const k of Object.keys(named)) if (!isSafeKey(k)) throw new HaloError(`"${k}" can't be used as a name in context.thread`, { code: "UNSAFE_NAME" });
    let op: ThreadOp;
    switch (stage.method) {
      case "set":
        op = { op: "set", fields: named };
        break;
      case "append": {
        const { keep, ...fields } = named;
        const n = keep === undefined ? undefined : asNumber(keep);
        if (n !== undefined && !(Number.isInteger(n) && n >= 0)) throw new HaloError(`Thread.append's keep: is how many items to keep, e.g. keep: 20`);
        op = { op: "append", fields, ...(n !== undefined ? { keep: n } : {}) };
        break;
      }
      case "clear":
        op = { op: "clear", ...(positional.length ? { names: positional.map(asText) } : {}) };
        break;
      default:
        throw new HaloError(`Unknown Thread method "${stage.method}" (use set, append or clear)`);
    }
    t.ops.push(op);
    t.state = applyOps(t.state, [op]);
    return ctx.current;
  }

  private async runFrom(ctx: ExecutionContext, start: number): Promise<RunResult> {
    const timeout = findDirective(ctx.pipeline.directives, "timeout");
    const timeoutMs = timeout ? parseDuration(timeout.value) : NaN;
    const controller = childSignal(ctx.signal);
    ctx.signal = controller.signal;
    if (timeoutMs > 0) ctx.deadline = Date.now() + timeoutMs;
    const timer =
      timeoutMs > 0
        ? setTimeout(() => controller.abort(new TimeoutError(`Pipeline "${ctx.pipeline.name}" timed out after ${timeout!.value}`)), timeoutMs)
        : undefined;

    const t0 = performance.now();
    try {
      const status = await raceAbort(this.executePipeline(ctx, start), controller.signal);
      await Promise.allSettled(ctx.shadowTasks);
      ctx.meta.finishedAt = new Date().toISOString();
      ctx.meta.durationMs = Math.round(performance.now() - t0);
      if (status === "completed") ctx.current = this.checkSchema(ctx.pipeline, ctx.current);
      return { output: ctx.current, status, runId: ctx.meta.runId, context: this.snapshot(ctx) };
    } finally {
      clearTimeout(timer);
      controller.abort(new HaloError("Run finished"));
    }
  }

  private async executePipeline(ctx: ExecutionContext, start: number): Promise<RunResult["status"]> {
    try {
      return await this.executeStages(ctx, start);
    } catch (err) {
      if (!(err instanceof Pause)) throw err;
      // No handler for this yield/listen: save the run so signal() can continue it.
      const i = ctx.stageIndex;
      ctx.meta.paused = { stage: i, waitingFor: err.waitingFor, message: err.message, id: crypto.randomUUID() };
      ctx.meta.pauses = (ctx.meta.pauses ?? 0) + 1;
      await this.runStore.save(ctx.meta.runId, this.toSnapshot(ctx, i, err.waitingFor));
      this.emit({ type: "paused", pipeline: ctx.pipeline.name, runId: ctx.meta.runId, index: i, waitingFor: err.waitingFor });
      return "paused";
    }
  }

  private toSnapshot(ctx: ExecutionContext, nextStage: number, waitingFor?: string): RunSnapshot {
    const { input, data, meta, trace, current, loops, loopFeedback, sessions } = ctx;
    return {
      version: 1,
      pipeline: ctx.pipeline.name,
      nextStage,
      ...(waitingFor !== undefined ? { waitingFor } : {}),
      input,
      data,
      meta,
      trace,
      current,
      loops,
      loopFeedback,
      ...(sessions && Object.keys(sessions).length ? { sessions } : {}),
      ...(ctx.thread ? { thread: ctx.thread } : {}),
    };
  }

  private async executeStages(ctx: ExecutionContext, start: number): Promise<RunResult["status"]> {
    const { pipeline, name } = ctx.pipeline;
    for (let i = start; i < pipeline.length; i++) {
      // A stopped run (timeout, a failed sibling branch) starts no more stages. The deadline is
      // checked directly too: work that never waits on I/O (mocks, cached calls) can starve the timer.
      if (ctx.signal.aborted) throw ctx.signal.reason;
      for (let c: ExecutionContext | undefined = ctx; c; c = c.parent) {
        if (c.deadline !== undefined && Date.now() > c.deadline) throw new TimeoutError(`Pipeline "${c.pipeline.name}" timed out after ${findDirective(c.pipeline.directives, "timeout")!.value}`);
      }
      const stage = pipeline[i]!;
      const label = stageLabel(stage);
      const t0 = performance.now();
      ctx.stageIndex = i;
      this.emit({ type: "stage", pipeline: name, runId: ctx.meta.runId, index: i, kind: stage.kind, label, status: "start" });

      switch (stage.kind) {
        case "expression":
          ctx.current = this.evalHead(stage.expr, ctx);
          break;
        case "call":
          ctx.current = await this.callStage(stage, ctx);
          break;
        case "fanout":
          ctx.current = await this.fanout(stage, ctx);
          break;
        case "branch":
          ctx.current = await this.branch(stage, ctx);
          break;
        case "each":
          ctx.current = await this.each(stage, ctx);
          break;
        case "gate":
          if (!truthy(this.evalCond(stage.expr, ctx))) {
            ctx.meta.halted = { stage: i, condition: stage.condition };
            this.appendTrace(ctx, i, stage, label);
            this.emit({ type: "halt", pipeline: name, runId: ctx.meta.runId, index: i, condition: stage.condition });
            // Resuming re-evaluates the gate.
            await this.writeCheckpoint(ctx, i);
            return "halted";
          }
          break;
        case "interrupt":
          await this.interrupt(stage, ctx);
          break;
        case "listen":
          await this.listen(stage, ctx);
          break;
        case "loop": {
          const to = this.loopBack(stage, ctx, i);
          if (to !== undefined) {
            this.appendTrace(ctx, i, stage, label);
            i = to - 1; // the for loop's i++ lands on `to`
            continue;
          }
          break;
        }
      }

      this.appendTrace(ctx, i, stage, label);
      this.emit({ type: "stage", pipeline: name, runId: ctx.meta.runId, index: i, kind: stage.kind, label, status: "end", value: ctx.current, durationMs: Math.round(performance.now() - t0) });
      await this.writeCheckpoint(ctx, i + 1);
    }
    return "completed";
  }

  private appendTrace(ctx: ExecutionContext, index: number, stage: PipelineStage, label: string): void {
    const prev = ctx.trace.at(-1)?.hash ?? GENESIS;
    const at = new Date().toISOString();
    const outputHash = sha256(safeJson(ctx.current));
    ctx.trace.push({ index, stage: stage.kind, label, at, outputHash, prev, hash: sha256(prev, String(index), stage.kind, label, at, outputHash) });
  }

  /** Where a run's @checkpoint goes; undefined when it doesn't keep one. */
  private checkpointPath(ctx: ExecutionContext): string | undefined {
    if (!findDirective(ctx.pipeline.directives, "checkpoint") || ctx.depth > 0) return undefined;
    return `${this.config.checkpointDir ?? ".halo/checkpoints"}/${ctx.pipeline.name}-${ctx.meta.runId}.json`;
  }

  private async writeCheckpoint(ctx: ExecutionContext, nextStage: number): Promise<void> {
    const path = this.checkpointPath(ctx);
    if (!path) return;
    ctx.meta.checkpoint = path;
    // Appends to the checkpoint's log, so checkpointing every stage of a long run stays cheap.
    const snap = this.toSnapshot(ctx, nextStage);
    await writeSnapshot(path, snap);
    // And keeps every step, for halo history.
    await appendStep(path, snap);
    this.emit({ type: "checkpoint", runId: ctx.meta.runId, path });
  }

  private emit(event: RuntimeEvent): void {
    this.config.onEvent?.(event);
    for (const l of this.listeners) l(event);
  }

  /**
   * `|<> loop(Agent, "cond", max: n)`: while the condition holds, jump back to the
   * agent's most recent stage so it can try again with the current value (e.g. a
   * failing build's output). Returns the stage to jump to, or undefined to go on.
   */
  private loopBack(stage: LoopStage, ctx: ExecutionContext, index: number): number | undefined {
    if (!stage.expr) throw new HaloError(`loop condition "${stage.condition}" is not valid: ${stage.conditionErrors?.join("; ")}`);
    const done = ctx.loops[index] ?? 0;
    const holds = truthy(this.evalCond(stage.expr, ctx));
    if (!holds) {
      if (stage.bind) ctx.data[stage.bind] = done;
      delete ctx.loops[index];
      ctx.loopFeedback = undefined;
      return undefined;
    }
    const max = Number(this.resolveArgs({ argList: stage.options }, ctx).named.max ?? 3);
    if (!Number.isInteger(max) || max < 1) throw new HaloError(`loop(${stage.target}): max must be a whole number of at least 1`, { code: "LOOP_MAX" });
    if (done >= max) {
      throw new LoopLimitError(`loop(${stage.target}) gave up after ${max} ${max === 1 ? "try" : "tries"}: "${stage.condition}" is still true`);
    }
    const to = ctx.pipeline.pipeline.findLastIndex((s, j) => j < index && s.kind === "call" && s.callee === stage.target);
    if (to < 0) throw new HaloError(`loop(${stage.target}, ...) needs an earlier ${stage.target} stage to go back to`, { code: "LOOP_TARGET_NOT_FOUND" });
    ctx.loops[index] = done + 1;
    ctx.loopFeedback = { stage: to, condition: stage.condition, value: ctx.current, iteration: done + 1, previous: ctx.answers?.[to] };
    ctx.data.loop = { target: stage.target, iteration: done + 1, condition: stage.condition };
    this.emit({ type: "loop", pipeline: ctx.pipeline.name, runId: ctx.meta.runId, index, to, iteration: done + 1, condition: stage.condition });
    return to;
  }

  /** Validate (and parse) a pipeline's output against its `-> Type`: a declared schema or a built-in type. */
  private checkSchema(pipeline: PipelineDeclaration, output: unknown): unknown {
    return validateReturn(pipeline.returnType, output, (name) => this.schemas.get(name));
  }

  // ── Values ──

  private evalHead(expr: Value, ctx: ExecutionContext): unknown {
    if (expr.kind === "ref") {
      const [root, ...rest] = expr.path as [string, ...string[]];
      if (hasOwnKey(ctx.input, root)) return getPath(ctx.input[root], rest);
      if (hasOwnKey(ctx.data, root)) return getPath(ctx.data[root], rest);
      throw new HaloError(`Undefined variable "${root}"`);
    }
    return this.resolveValue(expr, ctx);
  }

  private contextPath(path: string[], ctx: ExecutionContext): unknown {
    const [ns, ...rest] = path;
    // A whole container is copied: stored back into context.data, the original would contain itself.
    if (ns === undefined) return copy(this.snapshot(ctx));
    let top = ctx;
    while (top.parent) top = top.parent;
    const roots: Record<string, unknown> = { data: ctx.data, input: ctx.input, meta: ctx.meta, trace: ctx.trace, current: ctx.current, thread: (ctx.thread ?? top.thread)?.state };
    return rest.length || ns === "current" ? getPath(roots[ns], rest) : copy(roots[ns]);
  }

  /** Resolve a `{{path}}` placeholder or bare name against the context. */
  private lookup(path: string[], ctx: ExecutionContext): unknown {
    const [root, ...rest] = path as [string, ...string[]];
    if (root === "context") return this.contextPath(rest, ctx);
    if (root === "current") return getPath(ctx.current, rest);
    if (hasOwnKey(ctx.data, root)) return getPath(ctx.data[root], rest);
    if (hasOwnKey(ctx.input, root)) return getPath(ctx.input[root], rest);
    return undefined;
  }

  private template(text: string, ctx: ExecutionContext, format?: (v: unknown, offset: number) => string) {
    // Env.* is deliberately not resolvable here, so secrets never reach prompts.
    return interpolate(text, (path) => (path[0] === "Env" ? undefined : this.lookup(path, ctx)), format);
  }

  private resolveValue(v: Value, ctx: ExecutionContext, opts: { allowEnv?: boolean; owner?: string; shell?: boolean; encode?: (v: unknown) => string } = {}): unknown {
    switch (v.kind) {
      case "string": {
        // In a tool declaration, "Env.NAME" (as a string) reads that environment variable.
        if (opts.allowEnv && /^Env\.\w+$/.test(v.value)) return this.resolveValue({ kind: "ref", path: v.value.split(".") }, ctx, opts);
        if (opts.shell) {
          // Each placeholder is escaped for where it sits in the command (a bare word, "...", '...', a heredoc).
          const spots = placeholderSpots(v.value);
          return this.template(v.value, ctx, (x, at) => quoteFor(spots.get(at), formatValue(x))).text;
        }
        return this.template(v.value, ctx, opts.encode).text;
      }
      case "number": return v.value;
      case "bool": return v.value;
      case "null": return null;
      case "duration": return v.raw;
      case "model": return v.value;
      case "context": return this.contextPath(v.path, ctx);
      case "list": return v.items.map((item) => this.resolveValue(item, ctx, opts));
      case "ref": {
        const [root, ...rest] = v.path as [string, ...string[]];
        if (root === "Env") {
          const name = rest.join(".");
          if (!opts.allowEnv) throw new HaloError(`Env.${name} can only be used in tool declarations`);
          const value = this.env[name];
          if (value === undefined) throw new HaloError(`Environment variable ${name} is not set (needed by "${opts.owner}")`);
          return value;
        }
        if (hasOwnKey(ctx.input, root)) return getPath(ctx.input[root], rest);
        // A declared name refers to the declaration itself (e.g. `history: PastCases`);
        // its results are read explicitly via context.data.<Name>.
        if (this.isDeclared(root)) return v.path.join(".");
        if (hasOwnKey(ctx.data, root)) return getPath(ctx.data[root], rest);
        // Anything else is a symbol, e.g. `channel: Slack`.
        return v.path.join(".");
      }
    }
  }

  private isDeclared(name: string): boolean {
    return this.tools.has(name) || this.agents.has(name) || this.pipelines.has(name) || this.policies.has(name);
  }

  private resolveArgs(stage: { argList: CallStage["argList"] }, ctx: ExecutionContext, opts: { shell?: (name: string | undefined) => boolean; skip?: Set<string> } = {}) {
    const positional: unknown[] = [];
    const named: Record<string, unknown> = {};
    for (const a of stage.argList) {
      if (a.name && opts.skip?.has(a.name)) continue;
      const value = this.resolveValue(a.value, ctx, { shell: opts.shell?.(a.name) ?? false });
      if (a.name) named[a.name] = value;
      else positional.push(value);
    }
    return { positional, named };
  }

  private evalCond(c: CondExpr, ctx: ExecutionContext): unknown {
    switch (c.kind) {
      case "or": return c.terms.some((t) => truthy(this.evalCond(t, ctx)));
      case "and": return c.terms.every((t) => truthy(this.evalCond(t, ctx)));
      case "not": return !truthy(this.evalCond(c.expr, ctx));
      case "value": return this.resolveValue(c.value, ctx);
      case "compare": {
        const l = this.evalCond(c.left, ctx);
        const r = this.evalCond(c.right, ctx);
        if (c.op === "==") return looseEquals(l, r);
        if (c.op === "!=") return !looseEquals(l, r);
        const [a, b] = [asNumber(l), asNumber(r)];
        if (l === null || l === undefined || r === null || r === undefined || Number.isNaN(a) || Number.isNaN(b)) return false;
        return c.op === ">" ? a > b : c.op === "<" ? a < b : c.op === ">=" ? a >= b : a <= b;
      }
    }
  }

  // ── Calls ──

  private async callStage(stage: CallStage, ctx: ExecutionContext): Promise<unknown> {
    const value = await this.dispatchCall(stage, ctx);
    if (stage.callee !== "System" && !this.isThreadCall(stage.callee)) this.store(ctx, stage.callee, stage.method, value);
    if (stage.bind) ctx.data[stage.bind] = value;
    return value;
  }

  /** Store a result at context.data.<callee>.<method> (or context.data.<callee> for pipeline calls). */
  private store(ctx: ExecutionContext, callee: string, method: string, value: unknown): void {
    for (const key of [callee, ...method.split(".")]) {
      if (!isSafeKey(key)) throw new HaloError(`"${key}" can't be used as a name in context.data`, { code: "UNSAFE_NAME" });
    }
    if (!method) {
      ctx.data[callee] = value;
      return;
    }
    const slot = ctx.data[callee];
    if (isPlainObject(slot)) slot[method] = value;
    else ctx.data[callee] = { [method]: value };
    // Also by method name alone (`context.data.triage`), unless that would hide an input.
    if (!Object.hasOwn(ctx.input, method) && !this.isDeclared(method)) ctx.data[method] = value;
  }

  private dispatchCall(stage: CallStage, ctx: ExecutionContext): Promise<unknown> {
    if (stage.callee === "System") return this.systemCall(stage, ctx);
    if (this.isThreadCall(stage.callee)) return Promise.resolve().then(() => this.threadCall(stage, ctx));
    const agent = this.agents.get(stage.callee);
    const tool = this.tools.get(stage.callee);
    if (!stage.method || (stage.implicit && !agent && this.pipelines.has(stage.callee))) return this.pipelineCall(stage, ctx);
    if (tool) {
      // Values inserted into a shell command are shell-quoted, so they can't run as commands.
      const { positional, named } = this.resolveArgs(stage, ctx, { shell: shellArgs(tool.provider) });
      return this.toolCall(tool, stage.method, positional, named, ctx, false);
    }
    if (agent) return this.agentCall(agent, stage, ctx);
    return Promise.reject(new HaloError(`Unknown callee "${stage.callee}": not an agent, tool, store, or pipeline`));
  }

  private mockFor(...keys: string[]): ((req: MockRequest) => Promise<unknown>) | undefined {
    if (!this.mocks) return undefined;
    const key = keys.find((k) => Object.hasOwn(this.mocks!, k));
    if (key === undefined) return undefined;
    const mock = this.mocks[key];
    return async (req) => (typeof mock === "function" ? await (mock as (r: MockRequest) => unknown)(req) : mock);
  }

  private retryPolicy(ctx: ExecutionContext, agent?: Agent): { retries: number; delayMs: number } {
    const d = findDirective(agent?.directives, "retry") ?? findDirective(ctx.pipeline.directives, "retry");
    const [count, delay] = directiveArgs(d);
    return { retries: Number(count ?? 0) || 0, delayMs: delay ? parseDuration(delay) || 0 : 0 };
  }

  /** Run `fn` under the @retry policy and an agent's @timeout. */
  private async withPolicies<T>(ctx: ExecutionContext, target: string, agent: Agent | undefined, fn: (signal: AbortSignal) => Promise<T>): Promise<{ result: T; attempts: number }> {
    const { retries, delayMs } = this.retryPolicy(ctx, agent);
    const timeout = findDirective(agent?.directives, "timeout");
    const timeoutMs = timeout ? parseDuration(timeout.value) : NaN;

    for (let attempt = 1; ; attempt++) {
      const controller = childSignal(ctx.signal);
      const timer = timeoutMs > 0 ? setTimeout(() => controller.abort(new TimeoutError(`${target} timed out after ${timeout!.value}`)), timeoutMs) : undefined;
      try {
        return { result: await raceAbort(fn(controller.signal), controller.signal), attempts: attempt };
      } catch (err) {
        if (ctx.signal.aborted || attempt > retries || !isRetryable(err)) throw err;
        this.emit({ type: "retry", runId: ctx.meta.runId, target, attempt, error: err instanceof Error ? err.message : String(err), delayMs });
        await sleep(delayMs, ctx.signal);
      } finally {
        clearTimeout(timer);
        controller.abort(DONE);
      }
    }
  }

  /** Spend of the whole run so far, counting calls in flight at their estimate. */
  private spent(ctx: ExecutionContext): number {
    const top = this.topMeta(ctx);
    return top.cost + (this.unsettled.get(top) ?? 0);
  }

  private topMeta(ctx: ExecutionContext): RunMeta {
    while (ctx.parent) ctx = ctx.parent;
    return ctx.meta;
  }

  private unsettle(ctx: ExecutionContext, amount: number): void {
    const top = this.topMeta(ctx);
    this.unsettled.set(top, (this.unsettled.get(top) ?? 0) + amount);
  }

  /** The most a call can cost: its prompt plus a full reply. */
  private estimateCall(model: string, prompt: string, system: string | undefined, options: LLMOptions): number {
    const adapter = this.adapterRegistry.findAdapter(model);
    return adapter?.estimateCost?.(model, estimateTokens(prompt + (system ?? "")), options.maxTokens ?? DEFAULT_MAX_TOKENS) ?? 0;
  }

  /**
   * Reserve a call's estimate. Under MaxSpend, its reply is capped so the whole call fits in
   * what is left of the budget (counting calls in flight), and that cap is always sent: a
   * provider with no default limit could otherwise bill a long reply past it. The check and
   * the reservation happen in one step, so parallel calls see each other.
   */
  private reserveCall(agent: Agent, model: string, prompt: string, system: string | undefined, options: LLMOptions, ctx: ExecutionContext): Promise<{ options: LLMOptions; reserve: number }> {
    const take = (fitted: LLMOptions) => {
      const reserve = this.estimateCall(model, prompt, system, fitted);
      this.unsettle(ctx, reserve);
      this.flight(ctx).calls++;
      return { options: fitted, reserve };
    };
    // Waiters are woken one at a time: one that goes ahead (or is refused) wakes the next, and
    // one that has to wait again goes back to the front, so a settle costs one check, not one per waiter.
    const wakeNext = () => this.flight(ctx).waiting.shift()?.();
    const attempt = (woken: boolean): { options: LLMOptions; reserve: number } | Promise<{ options: LLMOptions; reserve: number }> => {
      let fitted;
      try {
        fitted = this.fitBudget(agent, model, prompt, system, options, ctx, woken);
      } catch (err) {
        if (woken) wakeNext();
        throw err;
      }
      if (fitted instanceof Promise) return fitted.then(() => attempt(true));
      const taken = take(fitted);
      if (woken) wakeNext();
      return taken;
    };
    return Promise.resolve(attempt(false));
  }

  /** The options a call fits the budget with, or a promise to wait on (for a call in flight) before trying again. */
  private fitBudget(agent: Agent, model: string, prompt: string, system: string | undefined, options: LLMOptions, ctx: ExecutionContext, again = false): LLMOptions | Promise<void> {
    const limit = this.guard.spendLimit(agent);
    const adapter = this.adapterRegistry.findAdapter(model);
    if (limit === undefined || !adapter?.estimateCost) return options;
    const input = adapter.estimateCost(model, estimateTokens(prompt + (system ?? "")), 0);
    const perToken = adapter.estimateCost(model, 0, 1_000_000) / 1_000_000;
    const wanted = options.maxTokens ?? DEFAULT_MAX_TOKENS;
    const flight = this.flight(ctx);
    const room = limit - this.spent(ctx) - input;
    const cap = perToken > 0 ? Math.min(wanted, Math.floor(room / perToken)) : wanted;
    if (room > 0 && cap >= wanted) return { ...options, maxTokens: wanted };
    // Calls in flight hold their full estimate; most settle for less, so wait for one before shrinking or refusing.
    if (flight.calls > 0) {
      return raceAbort(new Promise<void>((done) => (again ? flight.waiting.unshift(done) : flight.waiting.push(done))), ctx.signal);
    }
    if (room <= 0 || cap < 1) this.guard.refuseOverBudget(agent, this.guardHooks(ctx));
    return { ...options, maxTokens: cap };
  }

  private flight(ctx: ExecutionContext) {
    const top = this.topMeta(ctx);
    let f = this.inflight.get(top);
    if (!f) this.inflight.set(top, (f = { calls: 0, waiting: [] }));
    return f;
  }

  private guardHooks(ctx: ExecutionContext): PolicyHooks {
    return {
      spent: () => this.spent(ctx),
      lookup: (path) => this.lookup(path.split("."), ctx),
      onViolation: (v, log) => {
        ctx.meta.violations.push(v);
        this.emit({ type: "violation", runId: ctx.meta.runId, ...v });
        if (log) this.logger.warn(`[Policy] ${v.policy}/${v.rule}: ${v.message}`);
      },
    };
  }

  private async agentCall(agent: Agent, stage: CallStage, ctx: ExecutionContext): Promise<unknown> {
    const target = `${agent.name}.${stage.method}`;
    const instructions: string[] = [];
    const inputs: unknown[] = [];
    const params: Record<string, unknown> = {};
    const callOptions: Record<string, unknown> = {};
    let templated = false;
    const toolArg = stage.argList.find((a) => a.name === "tool");
    const toolName = toolArg ? (toolArg.value.kind === "ref" ? toolArg.value.path.join(".") : String(this.resolveValue(toolArg.value, ctx))) : undefined;
    const shellArg = shellArgs(toolName === undefined ? undefined : this.tools.get(toolName)?.provider);

    for (const a of stage.argList) {
      if (a.name === "tool") {
        continue;
      } else if (a.name && LLM_OPTION_KEYS.has(a.name)) {
        callOptions[a.name] = this.resolveValue(a.value, ctx);
      } else if (!a.name && a.value.kind === "string") {
        const t = this.template(a.value.value, ctx);
        templated ||= t.used;
        instructions.push(t.text);
      } else if (a.name) {
        params[a.name] = this.resolveValue(a.value, ctx, { shell: shellArg(a.name) });
      } else {
        const value = this.resolveValue(a.value, ctx, { shell: shellArg(a.name) });
        if (value !== undefined) inputs.push(value);
      }
    }

    // `Agent.method(tool: T, ...)`: call the (equipped) tool, then let the agent work on its result.
    let toolResult: unknown;
    if (toolName !== undefined) {
      const tool = this.tools.get(toolName);
      if (!tool) throw new HaloError(`${target} uses undefined tool "${toolName}"`);
      if (!agent.equips?.includes(toolName)) throw new HaloError(`Agent "${agent.name}" is not equipped with tool "${toolName}" (add \`equips ${toolName}\`)`);
      toolResult = await this.toolCall(tool, stage.method, inputs, params, ctx, true);
      this.store(ctx, toolName, stage.method, toolResult);
    }

    const parts: PromptParts = {
      method: stage.method,
      instructions,
      inputs,
      params,
      tool: toolName !== undefined ? { name: toolName, result: toolResult } : undefined,
      current: !templated && inputs.length === 0 ? ctx.current : undefined,
    };
    const memory = await this.equippedContext(agent, toolName, parts, ctx);
    // On a loop retry, always show the agent what the check found, even if its
    // instructions are templated (which otherwise leaves the pipeline value out).
    const retry = ctx.loopFeedback?.stage === ctx.stageIndex ? ctx.loopFeedback : undefined;
    // It also sees its own last answer, so it knows what didn't work instead of repeating it.
    const feedback = retry
      ? [
          ...(retry.previous === undefined ? [] : [{ source: "your previous attempt", label: `Your answer on attempt ${retry.iteration}, which didn't pass the check (it may be cut short)`, text: clip(formatValue(retry.previous), 6000) }]),
          { source: "the check", label: `Attempt ${retry.iteration} was sent back because "${retry.condition}" held`, text: formatValue(retry.value) },
        ]
      : [];
    const prompt = buildPrompt({ ...parts, context: [...feedback, ...memory.context] });
    if (!prompt.trim()) throw new HaloError(`${target} has an empty prompt (its arguments and the pipeline value are all empty)`);
    const system = this.withSkills(agent, String(callOptions.system ?? agent.system ?? agent.params.system ?? agent.params.role ?? "") || undefined, callOptions, ctx);
    const options = llmOptions(agent.params, callOptions);

    const hooks = this.guardHooks(ctx);
    this.guard.checkBudget(agent, hooks);
    const user = this.guard.checkInput(agent, prompt, hooks);

    // An agent with tools holds a conversation: it calls tools until it answers. A run paused
    // for approval of one of its calls picks that conversation up where it stopped.
    const toolNames = this.toolset(agent, stage, callOptions);
    const session = ctx.sessions?.[ctx.stageIndex];
    if (session) delete ctx.sessions![ctx.stageIndex];
    const kit = toolNames.length ? await this.toolKit(agent, toolNames, ctx) : undefined;
    const conversation: LLMMessage[] | undefined = kit ? (session?.messages ?? [...(system ? [{ role: "system" as const, content: system }] : []), { role: "user", content: user }]) : undefined;
    const steps = { done: session?.step ?? 0, pending: session?.pending };

    if (!session) this.startShadows(agent, stage.method, user, system, options, ctx);
    const corrections = this.correctLimit(ctx, agent);
    let ask = user;
    for (let attempt = 0; ; attempt++) {
      const { value, tokens } = kit
        ? await this.converse(agent, target, stage, ctx, kit, conversation!, steps, system, options, callOptions)
        : await this.complete(agent, agent.modelId, target, [target, agent.name, "*"], ask, system, options, stage, ctx);
      try {
        const checked = this.guard.checkOutput(agent, value, hooks, { completionTokens: tokens?.completion });
        await memory.remember?.(checked);
        (ctx.answers ??= {})[ctx.stageIndex] = checked;
        return checked;
      } catch (err) {
        // @correct(n): show the model what the policy rejected and let it try again.
        if (!(err instanceof PolicyViolation) || attempt >= corrections) throw err;
        // The audit trail keeps the violation, marked as one the agent was asked to fix.
        const v = ctx.meta.violations.findLast((x) => x.policy === err.policy && x.rule === err.rule && !x.corrected);
        if (v) v.corrected = true;
        this.emit({ type: "correction", pipeline: ctx.pipeline.name, runId: ctx.meta.runId, target, attempt: attempt + 1, error: err.message });
        ask = `${user}\n\nYour previous answer was rejected by policy "${err.policy}": ${err.message}\nAnswer again, fixing that problem.\n\nPrevious answer:\n${formatValue(value)}`;
        // A conversation with tools continues: the agent keeps what its tools told it.
        conversation?.push({ role: "user", content: `Your answer was rejected by policy "${err.policy}": ${err.message}\nAnswer again, fixing that problem.` });
      }
    }
  }

  /**
   * `skills:` on the call (or else the agent): those skills' instructions, added to the system prompt.
   * Skills are looked up in the folders of the Skills tools the agent equips (else ./skills), then
   * in Halo's built-in skills.
   */
  private withSkills(agent: Agent, system: string | undefined, callOptions: Record<string, unknown>, ctx: ExecutionContext): string | undefined {
    const names = skillNames(callOptions.skills ?? agent.params.skills);
    if (!names.length || (names.length === 1 && names[0] === "none")) return system;
    const dirs: string[] = [];
    let builtin = true;
    const kits = (agent.equips ?? []).map((n) => this.tools.get(n)).filter((t) => t?.provider === "Skills");
    for (const tool of kits) {
      const src = skillSources(this.toolConfig(tool!, ctx).config);
      dirs.push(...src.dirs);
      builtin &&= src.builtin;
    }
    const catalog = skillCatalog(kits.length ? dirs : ["skills"], builtin);
    const skills = names.map((n) => {
      const skill = findSkill(catalog, n);
      if (!skill) throw new HaloError(`${agent.name}: no skill named "${n}" (there are: ${catalog.map((s) => s.name).join(", ") || "none"})`, { code: "UNKNOWN_SKILL" });
      return skill;
    });
    const block = `Skills: follow the instructions of a skill whenever the task is the kind it covers.\n\n${skillPrompt(skills)}`;
    return system ? `${system}\n\n${block}` : block;
  }

  /**
   * The tools an agent may choose to call on this call: `tools: [Shell, Files]` on the call, or
   * `tools: auto` on the agent or the call (everything it equips, except stores it reads as context).
   * `tools: none` turns them off for one call. Each must be equipped.
   */
  private toolset(agent: Agent, stage: CallStage, callOptions: Record<string, unknown>): string[] {
    const arg = stage.argList.find((a) => a.name === "tools");
    const value = arg ? (arg.value.kind === "list" ? arg.value.items : [arg.value]) : undefined;
    const named = value?.map((v) => (v.kind === "ref" ? v.path.join(".") : v.kind === "string" ? v.value : formatValue(callOptions.tools)));
    const choice = named ?? (agent.params.tools ? [agent.params.tools] : []);
    if (choice.length === 1 && (choice[0] === "none" || choice[0] === "false")) return [];
    const names =
      choice.length === 1 && (choice[0] === "auto" || choice[0] === "all")
        ? (agent.equips ?? []).filter((n) => {
            const t = this.tools.get(n);
            return t && t.provider !== "VectorStore" && t.provider !== "File";
          })
        : choice;
    for (const n of names) {
      if (!this.tools.has(n)) throw new HaloError(`${agent.name}.${stage.method}: tools: names "${n}", which is not a declared tool`);
      if (!agent.equips?.includes(n)) throw new HaloError(`Agent "${agent.name}" is not equipped with tool "${n}" (add \`equips ${n}\`)`);
    }
    return names;
  }

  /** The methods of these tools the agent's policies let it see, described for the model. */
  private async toolKit(agent: Agent, names: string[], ctx: ExecutionContext): Promise<ToolKit> {
    const kit: ToolKit = { specs: [], offered: [], byName: new Map() };
    for (const name of names) {
      const tool = this.tools.get(name)!;
      const info = this.providerInfo.get(tool.provider);
      const methods = Array.isArray(info?.methods)
        ? info.methods
        : info?.methods
          ? await info.methods({ tool, config: this.toolConfig(tool, ctx).config, signal: ctx.signal }, this.toolServices())
          : undefined;
      if (!methods?.length) {
        throw new HaloError(`Tool "${name}" (${tool.provider}) doesn't describe its methods, so an agent can't choose to call it; register the provider with its info (registerToolProvider(name, provider, info))`, { code: "TOOL_CONFIG" });
      }
      for (const method of methods) {
        const target = `${name}.${method.name}`;
        // Function names allow letters, digits, _ and - (64 at most), so "Repo.create_pr" becomes "Repo__create_pr".
        let fn = `${name}__${method.name}`.replace(/[^\w-]/g, "_").slice(0, 64);
        for (let i = 2; kit.byName.has(fn); i++) fn = `${fn.slice(0, 60)}_${i}`;
        const entry = { tool, method, target };
        kit.byName.set(fn, entry);
        kit.byName.set(target, entry);
        // A method its policies hide isn't offered; a model that calls it anyway is refused by checkToolCall.
        if (!this.guard.toolVisible(agent, target, method.effect)) continue;
        kit.offered.push(target);
        const about = info?.description ? `${name} (${info.description}): ${method.description}` : `${name}: ${method.description}`;
        kit.specs.push({ name: fn, description: about.slice(0, 1024), parameters: method.params ?? { type: "object", properties: {} } });
      }
    }
    if (!kit.specs.length) throw new HaloError(`Agent "${agent.name}" has tools, but its policies allow none of their methods`, { code: "TOOL_CONFIG" });
    return kit;
  }

  /**
   * Hold an agent's tool conversation: ask the model, run the tools it calls (each checked
   * against its policies), give it the results, and repeat until it answers. After
   * `max_steps` requests that called tools, the next one asks for an answer without tools.
   */
  private async converse(
    agent: Agent,
    target: string,
    stage: CallStage,
    ctx: ExecutionContext,
    kit: ToolKit,
    messages: LLMMessage[],
    steps: { done: number; pending?: LLMToolCall[] },
    system: string | undefined,
    options: LLMOptions,
    callOptions: Record<string, unknown>,
  ): Promise<{ value: unknown; tokens?: { prompt: number; completion: number } }> {
    const maxSteps = Number(callOptions.max_steps ?? agent.params.max_steps ?? DEFAULT_MAX_STEPS);
    const resultChars = Number(callOptions.tool_result_chars ?? agent.params.tool_result_chars ?? DEFAULT_TOOL_RESULT_CHARS);
    const hooks = this.guardHooks(ctx);
    const tokens = { prompt: 0, completion: 0 };
    let shownFrom = messages.length - 1;
    for (;;) {
      // Calls left over from a turn that stopped for approval run first.
      if (steps.pending?.length) {
        const calls = steps.pending;
        steps.pending = undefined;
        await this.runToolCalls(agent, kit, calls, messages, steps, ctx, hooks, resultChars);
      }
      const last = steps.done >= maxSteps;
      if (last) messages.push({ role: "user", content: `You have used all ${maxSteps} tool steps. Answer now, without calling tools.` });
      const shown = messages.slice(Math.max(0, shownFrom)).map((m) => (m.role === "tool" ? `[${m.name} result]\n${m.content}` : m.content)).join("\n\n");
      const turn: Turn = { messages, tools: kit.specs, toolChoice: last ? "none" : "auto", targets: kit.offered, step: steps.done + 1, shown };
      const estimate = messages.map((m) => m.content).join("\n") + JSON.stringify(kit.specs);
      const r = await this.complete(agent, agent.modelId, target, [target, agent.name, "*"], estimate, system, options, stage, ctx, "agent", turn);
      if (r.tokens) (tokens.prompt += r.tokens.prompt), (tokens.completion += r.tokens.completion);
      shownFrom = messages.length;
      if (!r.toolCalls?.length || last) {
        messages.push({ role: "assistant", content: typeof r.text === "string" ? r.text : formatValue(r.value) });
        // MaxTokens is about one answer: the last one.
        return { value: r.value, tokens: r.tokens };
      }
      messages.push({ role: "assistant", content: r.text ?? "", toolCalls: r.toolCalls, raw: r.rawMessage });
      steps.done++;
      await this.runToolCalls(agent, kit, r.toolCalls, messages, steps, ctx, hooks, resultChars);
    }
  }

  /** Run a turn's tool calls in order, adding each result to the conversation. */
  private async runToolCalls(agent: Agent, kit: ToolKit, calls: LLMToolCall[], messages: LLMMessage[], steps: { done: number }, ctx: ExecutionContext, hooks: PolicyHooks, resultChars: number): Promise<void> {
    for (let i = 0; i < calls.length; i++) {
      const call = calls[i]!;
      let content: string;
      try {
        content = await this.agentTool(agent, kit, call, ctx, hooks, resultChars);
      } catch (err) {
        if (err instanceof Pause && err.waitingFor === "approval") {
          // Keep the conversation and the calls still to run, so approving picks up right here.
          (ctx.sessions ??= {})[ctx.stageIndex] = { messages: copy(messages), pending: calls.slice(i), step: steps.done };
        }
        throw err;
      }
      messages.push({ role: "tool", toolCallId: call.id, name: call.name, content });
    }
  }

  /** Run one tool call an agent asked for, and say what happened in words the model can act on. */
  private async agentTool(agent: Agent, kit: ToolKit, call: LLMToolCall, ctx: ExecutionContext, hooks: PolicyHooks, resultChars: number): Promise<string> {
    const entry = kit.byName.get(call.name);
    const report = (decision: Extract<RuntimeEvent, { type: "agent_tool" }>["decision"], detail?: string) =>
      this.emit({ type: "agent_tool", pipeline: ctx.pipeline.name, runId: ctx.meta.runId, agent: agent.name, target: entry?.target ?? call.name, args: this.guard.forLog(agent, call.args), decision, detail });
    if (!entry) {
      report("error", "no such tool");
      return `Error: there is no tool named "${call.name}". You can call: ${kit.specs.map((spec) => spec.name).join(", ")}.`;
    }
    let check: ReturnType<PolicyEngine["checkToolCall"]>;
    try {
      check = this.guard.checkToolCall(agent, entry.target, entry.method.effect, call.args, hooks);
    } catch (err) {
      if (!(err instanceof PolicyViolation)) throw err;
      report("refused", err.message);
      return `Refused by policy "${err.policy}": ${err.message}. Don't try this call again.`;
    }
    let decision: "allowed" | "approved" = "allowed";
    if (check !== "allow") {
      const answer = await this.approval(agent, entry.target, call.args, check.approve, ctx);
      if (!isApproval(answer)) {
        const reason = declineReason(answer);
        report("declined", reason.slice(2) || undefined);
        return `A person declined this call${reason}. Don't try it again; finish without it, or say what you need.`;
      }
      decision = "approved";
    }
    let result: unknown;
    try {
      result = await this.toolCall(entry.tool, entry.method.name, [], call.args, ctx, true, agent.name);
    } catch (err) {
      if (ctx.signal.aborted || err instanceof Pause) throw err;
      const message = err instanceof Error ? err.message : String(err);
      report("error", message);
      return `Error: ${message}`;
    }
    report(decision);
    const text = clip(typeof result === "string" ? result : (JSON.stringify(result) ?? "null"), resultChars);
    // A tool result is input to the model: the agent's input policies redact or withhold it.
    try {
      return this.guard.checkInput(agent, text, hooks);
    } catch (err) {
      if (!(err instanceof PolicyViolation)) throw err;
      return `[withheld: this result was blocked by policy "${err.policy}": ${err.message}]`;
    }
  }

  /**
   * Ask a person whether an agent may make a tool call: onInterrupt (the CLI asks in the
   * terminal), else pause the run until `signal(runId, "approval", answer)`. The answer to
   * a paused run is waiting in ctx.approvals when the stage runs again.
   */
  private async approval(agent: Agent, target: string, args: unknown, policy: string, ctx: ExecutionContext): Promise<unknown> {
    const message = `Allow ${agent.name} to call ${target} with ${clip(formatValue(this.guard.forLog(agent, args)), 2000)}? (policy ${policy})`;
    if (ctx.approvals && Object.hasOwn(ctx.approvals, ctx.stageIndex)) {
      const answer = ctx.approvals[ctx.stageIndex];
      delete ctx.approvals[ctx.stageIndex];
      this.config.recorder?.({ kind: "approval", target, value: answer });
      return answer;
    }
    const mock = this.mockFor(target + "?", "approval");
    const req: InterruptRequest = { pipeline: ctx.pipeline.name, message, channel: "approval", attachments: [args], args: [], named: { target, args, policy, agent: agent.name }, current: ctx.current, context: this.snapshot(ctx) };
    const recorded = (answer: unknown) => (this.config.recorder?.({ kind: "approval", target, value: answer }), answer);
    if (mock) return recorded(await mock({ target, kind: "approval", prompt: message, args: [args], named: req.named, input: ctx.current }));
    if (this.config.onInterrupt) return recorded(await raceAbort(Promise.resolve(this.config.onInterrupt(req)), ctx.signal));
    // Only a top-level stage that is itself the agent call can stop and pick up again.
    const stage = ctx.pipeline.pipeline[ctx.stageIndex];
    const own = stage?.kind === "call" && stage.callee === agent.name;
    if (ctx.depth > 0 || !own) {
      throw new HaloError(`${agent.name} needs approval to call ${target} (policy ${policy}), but this stage can't pause (it's inside a called pipeline, fan-out, each, or branch); register runtime.onInterrupt(...)`, { code: "APPROVAL_NEEDED" });
    }
    throw new Pause("approval", message);
  }

  /** `@correct(n)` on the agent, else on the pipeline: how many times a policy-rejected answer may be retried. */
  private correctLimit(ctx: ExecutionContext, agent: Agent): number {
    const d = findDirective(agent.directives, "correct") ?? findDirective(ctx.pipeline.directives, "correct");
    if (!d) return 0;
    const n = Number(directiveArgs(d)[0] ?? 1);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  /**
   * Context an agent gets from what it `equips`, beyond explicit `tool:` calls:
   *   - a VectorStore: the closest stored entries to this call's input
   *   - a File store: the recent conversation, which this call is appended to
   */
  private async equippedContext(agent: Agent, explicitTool: string | undefined, parts: PromptParts, ctx: ExecutionContext) {
    const context: PromptParts["context"] = [];
    const histories: ToolDeclaration[] = [];
    const query = [...parts.instructions, ...parts.inputs.map(formatValue), parts.current === undefined ? "" : formatValue(parts.current)].join("\n").trim();
    for (const name of agent.equips ?? []) {
      const tool = this.tools.get(name);
      if (!tool || name === explicitTool) continue;
      if (tool.provider === "VectorStore" && query && !this.mockFor(`${name}.search`, name)) {
        const hits = (await this.toolCall(tool, "search", [query], { limit: 3, min_score: 0.1 }, ctx, true)) as Array<{ content: unknown }>;
        if (hits.length) context.push({ source: name, text: hits.map((h) => `- ${formatValue(h.content)}`).join("\n") });
      } else if (tool.provider === "File") {
        histories.push(tool);
        const history = await this.toolCall(tool, "read", [], {}, ctx, true);
        if (typeof history === "string" && history.trim()) context.push({ source: name, text: history, label: "Conversation so far" });
      }
    }
    // The history records what was asked (this call's input), not the full built prompt.
    const remember = histories.length
      ? async (answer: unknown) => {
          for (const h of histories) await this.toolCall(h, "append", [`User: ${query}\nAssistant: ${formatValue(answer)}`], {}, ctx, true);
        }
      : undefined;
    return { context, remember };
  }

  /** Send a prompt to a model (or its mock), with retry/timeout, and record the call. */
  private async complete(
    agent: Agent,
    model: string,
    target: string,
    mockKeys: string[],
    prompt: string,
    system: string | undefined,
    options: LLMOptions,
    stage: CallStage | undefined,
    ctx: ExecutionContext,
    kind: CallRecord["kind"] = "agent",
    turn?: Turn,
  ): Promise<{ value: unknown; text?: string; tokens?: { prompt: number; completion: number }; toolCalls?: LLMToolCall[]; rawMessage?: unknown }> {
    const t0 = performance.now();
    const mock = this.mockFor(...mockKeys);
    const flight = this.flight(ctx);
    let reserve = 0;
    if (mock) flight.calls++;
    else ({ options, reserve } = await this.reserveCall(agent, model, prompt, system, options, ctx));
    let outcome;
    try {
      outcome = await this.withPolicies(ctx, target, agent, async (signal) => {
        if (mock) {
          const { positional, named } = stage ? this.resolveArgs(stage, ctx, { skip: LLM_OPTION_KEYS }) : { positional: [], named: {} };
          const req: MockRequest = { target, kind: "agent", prompt: turn ? turn.shown : prompt, system, args: positional, named, input: ctx.current };
          if (turn) Object.assign(req, { tools: turn.targets, messages: turn.messages, step: turn.step });
          const value = await mock(req);
          // A mock that calls tools returns useTool(...) (or a list of them).
          const uses = (Array.isArray(value) ? value : [value]).filter((v): v is ToolUse => v instanceof ToolUse);
          if (turn && uses.length) {
            const toolCalls = uses.map((u, i) => ({ id: `mock_${turn.step}_${i}`, name: u.target, args: u.args }));
            return { value: "" as unknown, model, cost: 0, tokens: undefined, mocked: true, toolCalls, rawMessage: undefined };
          }
          return { value, model, cost: 0, tokens: undefined, mocked: true, toolCalls: undefined, rawMessage: undefined };
        }
        const r = await this.callLLM(model, prompt, system, options, signal, turn);
        return { value: r.text as unknown, model: r.model, cost: r.cost, tokens: r.tokens, mocked: false, toolCalls: r.toolCalls, rawMessage: r.rawMessage };
      });
    } catch (err) {
      // A call cut off mid-flight (another branch failed, or a timeout) may still be billed:
      // count it at its estimate, so the run's cost doesn't leave it out.
      if (reserve && ctx.signal.aborted) {
        ctx.meta.cost += reserve;
        if (ctx.parent) this.unsettle(ctx, reserve);
      }
      throw err;
    } finally {
      this.unsettle(ctx, -reserve);
      flight.calls--;
      flight.waiting.shift()?.();
    }
    const { result, attempts } = outcome;

    const latencyMs = Math.round(performance.now() - t0);
    ctx.meta.cost += result.cost;
    if (ctx.parent) this.unsettle(ctx, result.cost);
    if (result.tokens) {
      ctx.meta.tokens.prompt += result.tokens.prompt;
      ctx.meta.tokens.completion += result.tokens.completion;
    }
    ctx.meta.calls.push({ pipeline: ctx.pipeline.name, stage: ctx.stageIndex, target, kind, model: result.model, latencyMs, cost: result.cost, tokens: result.tokens, attempts, mocked: result.mocked });
    const value = typeof result.value === "string" ? parseOutput(result.value) : result.value;
    const toolCalls = result.toolCalls;
    if (kind !== "shadow") this.config.recorder?.({ kind: "agent", target, value: result.value, ...(toolCalls?.length ? { toolCalls: toolCalls.map((c) => ({ name: c.name, args: c.args })) } : {}) });
    if (kind !== "shadow") {
      // Telemetry keeps what the agent's policies let out: redacted, or withheld if blocked.
      const shown = this.guard.forLog(agent, value);
      const text = shown === value ? result.value : formatValue(shown);
      if (typeof result.value === "string" && result.value) this.emit({ type: "token", pipeline: ctx.pipeline.name, runId: ctx.meta.runId, target, text: typeof text === "string" ? text : formatValue(text) });
      const output = toolCalls?.length ? { ...(result.value ? { text: shown } : {}), toolCalls: toolCalls.map((c) => ({ name: c.name, args: this.guard.forLog(agent, c.args) })) } : shown;
      this.emit({ type: "llm", pipeline: ctx.pipeline.name, runId: ctx.meta.runId, agent: agent.name, model: result.model, system, prompt: turn ? turn.shown : prompt, output, latencyMs, cost: result.cost, tokens: result.tokens, mocked: result.mocked });
    }
    return { value, text: typeof result.value === "string" ? result.value : undefined, tokens: result.tokens, toolCalls, rawMessage: result.rawMessage };
  }

  private startShadows(primary: Agent, method: string, prompt: string, system: string | undefined, options: LLMOptions, ctx: ExecutionContext): void {
    const runs: Array<{ shadow: string; agent: Agent; model: string; mockKeys: string[] }> = [
      ...(this.shadowMinds.get(primary.name) ?? []).map((m) => ({ shadow: m.name, agent: m, model: m.modelId, mockKeys: [`${m.name}.${method}`, m.name, "*"] })),
      ...(this.shadowModels.get(primary.name) ?? []).map((model) => ({ shadow: model, agent: primary, model, mockKeys: [`${primary.name}@${model}`] })),
    ];
    for (const run of runs) {
      const t0 = performance.now();
      const label = `${run.shadow}.${method}`;
      const task = this.complete(run.agent, run.model, label, run.mockKeys, prompt, system, { ...llmOptions(run.agent.params, {}), ...options }, undefined, ctx, "shadow").then(
        ({ value }) => ({ primary: primary.name, shadow: run.shadow, output: this.guard.forLog(primary, this.guard.forLog(run.agent, value)), latencyMs: Math.round(performance.now() - t0) }),
        (err: unknown) => ({ primary: primary.name, shadow: run.shadow, error: err instanceof Error ? err.message : String(err), latencyMs: Math.round(performance.now() - t0) }),
      );
      ctx.shadowTasks.push(
        task.then((record: ShadowRecord) => {
          ctx.meta.shadows.push(record);
          this.emit({ type: "shadow", runId: ctx.meta.runId, record });
          this.logger.log(`[Shadow] ${run.shadow} ${record.error ? "failed: " + record.error : "output: " + formatValue(record.output)}`);
        }),
      );
    }
  }

  private apiKeyFor(adapter: ProviderAdapter): string | undefined {
    const fromEnv = adapter.envKeys?.map((k) => this.env[k]).find(Boolean);
    return this.config.apiKeys?.[adapter.id] ?? fromEnv ?? this.config.apiKey ?? this.env.HALO_API_KEY ?? undefined;
  }

  private isModelAvailable(modelId: string): boolean {
    const adapter = this.adapterRegistry.findAdapter(modelId);
    return !!adapter && (adapter.requiresApiKey === false || !!this.apiKeyFor(adapter));
  }

  /** Call an LLM through its adapter (and the router, when configured). */
  private async callLLM(requestedModel: string, prompt: string, system: string | undefined, options: LLMOptions, signal: AbortSignal, turn?: Turn) {
    let model = requestedModel;
    if (this.routerEnabled) {
      try {
        const routed = await this.router.route(model, Math.ceil(prompt.length / 4), options.maxTokens ?? 1024, undefined, (id) => this.isModelAvailable(id));
        model = routed.model;
        this.logger.log(`[Router] ${routed.reason}`);
      } catch (e) {
        this.logger.warn(`[Router] Failed to route, using ${model}: ${e instanceof Error ? e.message : e}`);
      }
    }

    const adapter = this.adapterRegistry.findAdapter(model);
    if (!adapter) throw new HaloError(`No adapter found for model "${model}". Register an adapter with runtime.registerAdapter().`);
    const apiKey = this.apiKeyFor(adapter);
    if (adapter.requiresApiKey !== false && !apiKey) {
      const vars = [...(adapter.envKeys ?? []), "HALO_API_KEY"].join(" or ");
      throw new HaloError(`No API key set for ${adapter.id} (model "${model}"). Set ${vars}, or pass apiKey in RuntimeConfig.`);
    }

    if (turn?.tools.length && adapter.supportsTools === false) {
      throw new HaloError(`${adapter.id} models can't call tools (model "${model}"); give this agent a model that can, or remove its tools`, { code: "TOOL_CONFIG" });
    }
    const request: LLMRequest = {
      model,
      messages: turn ? turn.messages : [...(system ? [{ role: "system" as const, content: system }] : []), { role: "user" as const, content: prompt }],
      tools: turn?.tools,
      toolChoice: turn?.toolChoice,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      topP: options.topP,
    };

    const res = await this.fetch(adapter.getUrl(model), {
      method: "POST",
      headers: adapter.getHeaders(apiKey ?? ""),
      body: JSON.stringify(adapter.transformRequest(request)),
      signal,
    });
    if (!res.ok) {
      const body = await res.text();
      throw new HttpError(`LLM API error from ${adapter.id} (${res.status}): ${body.slice(0, 500)}`, res.status, body);
    }
    const parsed = adapter.parseResponse(await res.json());
    const tokens = { prompt: parsed.usage?.promptTokens ?? 0, completion: parsed.usage?.completionTokens ?? 0 };
    const cost = adapter.estimateCost?.(model, tokens.prompt, tokens.completion) ?? 0;
    this.costTracker.recordUsage(model, cost);
    return { text: parsed.text, model, cost, tokens, toolCalls: parsed.toolCalls, rawMessage: parsed.rawMessage };
  }

  private toolServices(): ToolServices {
    return {
      fetch: this.fetch,
      env: this.env,
      vectors: () => (this.vectorStore ??= new LocalVectorStore(this.config.vectorPath ?? ".halo/vectors.sqlite")),
      sql: (url) => {
        let db = this.sqlPool.get(url);
        if (!db) this.sqlPool.set(url, (db = new Bun.SQL(url)));
        return db;
      },
    };
  }

  /** A tool declaration's own args, resolved when read (so an unused key is never needed). */
  private toolConfig(tool: ToolDeclaration, ctx: ExecutionContext) {
    const decl = declArgs(tool);
    // HTTP tools' URLs get their {{...}} values URL-encoded, so a value can't add path or query parts.
    const isHttp = tool.provider === "REST" || tool.provider === "GET" || tool.provider === "POST";
    const config = (key: string | number) => {
      const v = typeof key === "number" ? decl.positional[key] : decl.named[key];
      const encode = key === 0 && isHttp ? (x: unknown) => encodeURIComponent(formatValue(x)) : undefined;
      return v === undefined ? undefined : this.resolveValue(v, ctx, { allowEnv: true, owner: tool.name, encode });
    };
    const first = decl.positional[0];
    return { config, template0: first?.kind === "string" ? first.value : undefined };
  }

  /** Call a tool. `chosenBy` names the agent that chose the call: its arguments are all it gets (never the pipeline value). */
  private async toolCall(tool: ToolDeclaration, method: string, positional: unknown[], named: Record<string, unknown>, ctx: ExecutionContext, viaAgent: boolean, chosenBy?: string): Promise<unknown> {
    const target = `${tool.name}.${method}`;
    const implicitInput = chosenBy === undefined && !positional.length && ctx.current !== undefined;
    const args = implicitInput ? [ctx.current] : positional;
    const { config, template0 } = this.toolConfig(tool, ctx);

    const t0 = performance.now();
    const mock = this.mockFor(target, tool.name);
    const provider = this.providers.get(tool.provider);
    if (!mock && !provider) throw new HaloError(`Unknown tool provider "${tool.provider}" for tool "${tool.name}" (register it with runtime.registerToolProvider)`);

    const { result, attempts } = await this.withPolicies(ctx, target, undefined, async (signal) =>
      mock
        ? { value: await mock({ target, kind: "tool", args, named, input: ctx.current }), mocked: true }
        : { value: await provider!({ tool, method, positional: args, implicitInput, named, config, template0, viaAgent, signal, runId: this.topMeta(ctx).runId, pauses: this.topMeta(ctx).pauses ?? 0 }, this.toolServices()), mocked: false },
    );

    const latencyMs = Math.round(performance.now() - t0);
    this.config.recorder?.({ kind: "tool", target, value: result.value });
    ctx.meta.calls.push({ pipeline: ctx.pipeline.name, stage: ctx.stageIndex, target, kind: "tool", latencyMs, cost: 0, attempts, mocked: result.mocked, ...(chosenBy ? { agent: chosenBy } : {}) });
    // A result an agent chose to fetch is logged as its policies let it out (as the agent itself sees it).
    const chooser = chosenBy ? this.agents.get(chosenBy) : undefined;
    const output = chooser ? this.guard.forLog(chooser, result.value) : result.value;
    this.emit({ type: "tool", pipeline: ctx.pipeline.name, runId: ctx.meta.runId, tool: tool.name, method, output, latencyMs, mocked: result.mocked });
    return result.value;
  }

  private async systemCall(stage: CallStage, ctx: ExecutionContext): Promise<unknown> {
    const { positional, named } = this.resolveArgs(stage, ctx);
    const call: SystemCall = { method: stage.method, args: positional, named, current: ctx.current, context: this.snapshot(ctx) };

    const custom = this.systems.get(stage.method);
    if (custom) {
      const r = await custom(call);
      return r === undefined ? ctx.current : r;
    }

    switch (stage.method) {
      case "Print":
        console.log(...(positional.length ? positional : [ctx.current]));
        return ctx.current;
      case "Log":
        this.logger.log(`[${ctx.pipeline.name}]`, ...(positional.length ? positional : [ctx.current]));
        return ctx.current;
      case "Sleep": {
        const ms = parseDuration(asText(positional[0] ?? ""));
        if (!(ms >= 0)) throw new HaloError(`System.Sleep needs a duration, e.g. System.Sleep(2s)`);
        await sleep(ms, ctx.signal);
        return ctx.current;
      }
      case "Fail":
        throw new HaloError(asText(positional[0] ?? named.message ?? `Pipeline "${ctx.pipeline.name}" failed`));
      case "Value":
        // Make a value the flowing value, e.g. to end a pipeline with a result
        // computed earlier: |> System.Value(context.data.review)
        if (stage.argList.length !== 1) throw new HaloError(`System.Value takes exactly one value, e.g. System.Value(context.data.review)`);
        return positional.length ? positional[0] : named[Object.keys(named)[0]!];
      case "Pick": {
        const fields = named.fields ?? positional.slice(1);
        if (!Array.isArray(fields) || !fields.length) throw new HaloError(`System.Pick needs fields, e.g. System.Pick(context.data.x, fields: ["id", "user.login"])`);
        const maxChars = named.maxChars === undefined ? Infinity : asNumber(named.maxChars);
        const source = positional.length ? positional[0] : ctx.current;
        // Picking "fields" of plain values does nothing: say how to take items instead.
        if (Array.isArray(source) && source.some((v) => v === null || typeof v !== "object")) {
          throw new HaloError(`System.Pick keeps fields of objects, but this list holds plain values (${formatValue(source.slice(0, 3)).replace(/\s+/g, " ")}...). To take the first items, use |* each(x in list, limit: 5) or list.0`);
        }
        return pick(source, fields.map(asText), maxChars);
      }
    }

    if (includes(SYSTEM_EVENTS, stage.method)) {
      if (this.config.onSystemEvent) {
        const r = await this.config.onSystemEvent(call);
        return r === undefined ? ctx.current : r;
      }
      this.logger.log(`[System.${stage.method}]`, ...(positional.length ? positional : [ctx.current]), ...(Object.keys(named).length ? [named] : []));
      return ctx.current;
    }
    throw new HaloError(`Unknown System.${stage.method}`);
  }

  private async pipelineCall(stage: CallStage, ctx: ExecutionContext): Promise<unknown> {
    const target = this.pipelines.get(stage.callee);
    if (!target) throw new HaloError(`Pipeline "${stage.callee}" not found`);
    if (ctx.depth + 1 >= MAX_STREAM_DEPTH) throw new HaloError(`Pipeline calls are nested more than ${MAX_STREAM_DEPTH} deep (calling "${stage.callee}"); a pipeline that calls itself needs a way to stop`);
    // Recursion inside a fan-out or each multiplies at every level (3 branches, 16 deep, is 43 million runs).
    const top = this.topMeta(ctx);
    const calls = (this.pipelineCalls.get(top) ?? 0) + 1;
    this.pipelineCalls.set(top, calls);
    if (calls > MAX_PIPELINE_CALLS) throw new HaloError(`More than ${MAX_PIPELINE_CALLS} pipeline calls in one run (calling "${stage.callee}"); is a pipeline calling itself from |* or each?`);
    // Mocked or cached work can finish without ever yielding; let timers (@timeout) run now and then.
    if (calls % 1000 === 0) await new Promise((done) => setImmediate(done));

    const { positional, named } = this.resolveArgs(stage, ctx);
    const args: Record<string, unknown> = {};
    target.params.forEach((p, i) => {
      if (Object.hasOwn(named, p.name)) args[p.name] = named[p.name];
      else if (i < positional.length) args[p.name] = positional[i];
    });
    if (stage.argList.length === 0 && target.params[0]) args[target.params[0].name] = ctx.current;

    const child = this.newContext(target, args, ctx.depth + 1, ctx.signal);
    child.meta.runId = ctx.meta.runId;
    child.parent = ctx;
    const result = await this.runFrom(child, 0);
    ctx.meta.cost += child.meta.cost;
    if (!ctx.parent) this.unsettle(ctx, -child.meta.cost);
    ctx.meta.tokens.prompt += child.meta.tokens.prompt;
    ctx.meta.tokens.completion += child.meta.tokens.completion;
    // A loop, not push(...list): a sub-pipeline with a million calls would overflow the call stack.
    for (const list of ["calls", "violations", "shadows"] as const) for (const item of child.meta[list]) (ctx.meta[list] as unknown[]).push(item);
    return result.output;
  }

  private async fanout(stage: FanOutStage, ctx: ExecutionContext): Promise<unknown[]> {
    const results = await branches(ctx.signal, (signal) => stage.stages.map((sub) => this.callStage(sub, { ...ctx, signal })));
    if (stage.bind) ctx.data[stage.bind] = results;
    return results;
  }

  private async branch(stage: BranchStage, ctx: ExecutionContext): Promise<unknown> {
    const arm = stage.arms.findIndex((a) => !a.expr || truthy(this.evalCond(a.expr, ctx)));
    this.emit({ type: "branch", pipeline: ctx.pipeline.name, runId: ctx.meta.runId, index: ctx.stageIndex, arm, condition: stage.arms[arm]?.condition });
    // No matching arm and no else: the value passes through unchanged.
    const value = arm < 0 ? ctx.current : await this.callStage(stage.arms[arm]!.call, ctx);
    if (stage.bind) ctx.data[stage.bind] = value;
    return value;
  }

  private async each(stage: EachStage, ctx: ExecutionContext): Promise<unknown[]> {
    const value = this.resolveValue(stage.list, ctx);
    if (!Array.isArray(value)) {
      throw new HaloError(`each(${stage.item} in ${render(stage.list)}) needs a list, got ${value === undefined ? "nothing" : typeof value}`);
    }
    let list: unknown[] = value;
    const options = this.resolveArgs({ argList: stage.options }, ctx).named;
    const concurrency = Math.max(1, Number(options.concurrency ?? 4) || 1);
    // `limit: n` takes only the first n items.
    if (options.limit !== undefined) {
      const n = Number(options.limit);
      if (!Number.isInteger(n) || n < 0) throw new HaloError(`each(...) limit must be a whole number, got ${formatValue(options.limit)}`);
      list = list.slice(0, n);
    }
    const { callee, method } = stage.call;

    const results: unknown[] = new Array(list.length);
    let next = 0;
    let failed = false;
    const worker = async (signal: AbortSignal) => {
      while (next < list.length && !failed) {
        const i = next++;
        // Each iteration sees the item under its own name and as the flowing value.
        const data: Record<string, unknown> = { ...ctx.data, [stage.item]: list[i], index: i };
        if (isPlainObject(data[callee])) data[callee] = { ...(data[callee] as object) };
        try {
          results[i] = await this.callStage(stage.call, { ...ctx, data, current: list[i], signal });
        } catch (err) {
          failed = true;
          throw err;
        }
      }
    };
    await branches(ctx.signal, (signal) => Array.from({ length: Math.min(concurrency, list.length) }, () => worker(signal)));

    if (callee !== "System" && !this.isThreadCall(callee)) this.store(ctx, callee, method, results);
    if (stage.bind) ctx.data[stage.bind] = results;
    return results;
  }

  // ── Human-in-the-loop ──

  private async interrupt(stage: InterruptStage, ctx: ExecutionContext): Promise<void> {
    const { positional, named } = this.resolveArgs(stage, ctx);
    const req: InterruptRequest = { pipeline: ctx.pipeline.name, attachments: [], args: positional, named, current: ctx.current, context: this.snapshot(ctx) };

    const messages: string[] = [];
    stage.argList.forEach((a) => {
      if (a.name) return;
      const value = this.resolveValue(a.value, ctx);
      if (a.value.kind === "duration") req.timeoutMs = a.value.ms;
      else if (a.value.kind === "list") req.attachments.push(...(value as unknown[]));
      else if (a.value.kind === "ref" && this.tools.has(a.value.path.join("."))) req.channel ??= a.value.path.join(".");
      else messages.push(formatValue(value));
    });
    const msg = named.msg ?? named.message;
    req.message = msg !== undefined ? formatValue(msg) : messages.length ? messages.join("\n") : undefined;
    const channel = named.channel ?? named.queue;
    if (channel !== undefined) req.channel = formatValue(channel);
    if (named.timeout !== undefined) req.timeoutMs = parseDuration(String(named.timeout)) || undefined;
    if (Array.isArray(named.attachments)) req.attachments.push(...named.attachments);

    const mock = this.mockFor("yield");
    const handler: InterruptHandler | undefined = mock
      ? () => mock({ target: "yield", kind: "yield", args: positional, named, input: ctx.current })
      : this.config.onInterrupt;
    if (!handler) {
      if (ctx.depth > 0) {
        throw new HaloError(`Pipeline "${ctx.pipeline.name}" reached |! yield(...) inside a called pipeline, which can't pause; register runtime.onInterrupt(...) (or use the CLI in a terminal)`);
      }
      throw new Pause("yield", req.message);
    }

    let work = Promise.resolve(handler(req));
    if (req.timeoutMs) {
      const controller = childSignal(ctx.signal);
      const timer = setTimeout(() => controller.abort(new TimeoutError(`No response to |! yield(...) within ${req.timeoutMs}ms`)), req.timeoutMs);
      work = raceAbort(work, controller.signal).finally(() => (clearTimeout(timer), controller.abort(DONE)));
    }
    const answer = await work;
    this.config.recorder?.({ kind: "yield", target: "yield", value: answer });
    this.deliver(stage, ctx, answer, "yield");
  }

  /** Store a human's (or event source's) response for a yield or listen stage. */
  private deliver(stage: InterruptStage | ListenStage, ctx: ExecutionContext, response: unknown, target: string): void {
    if (stage.kind === "interrupt") {
      ctx.data.yield = response;
    } else {
      const [root, ...rest] = target.split(".");
      if (!root || !isSafeKey(root)) throw new HaloError(`"${target}" can't be used as a listen target`, { code: "UNSAFE_NAME" });
      if (rest.length) this.store(ctx, root, rest.join("."), response);
      else ctx.data[root] = response;
    }
    if (stage.bind) ctx.data[stage.bind] = response;
  }

  private async listen(stage: ListenStage, ctx: ExecutionContext): Promise<void> {
    const target = stage.targetValue.kind === "context" ? formatValue(this.resolveValue(stage.targetValue, ctx)) : stage.target;
    // A target computed from data must name something listenable: not empty, no prototype keys.
    if (!target || target.split(".").some((part) => !part || !isSafeKey(part))) {
      throw new HaloError(`~> listen(${stage.target}) resolved to "${target}", which is not a valid event name`, { code: "UNSAFE_NAME" });
    }
    const mock = this.mockFor(target);
    const handler: ListenHandler | undefined = mock
      ? () => mock({ target, kind: "listen", args: [], named: {}, input: ctx.current })
      : this.config.onListen;
    if (!handler) {
      if (ctx.depth > 0) {
        throw new HaloError(`Pipeline "${ctx.pipeline.name}" reached ~> listen(${target}) inside a called pipeline, which can't pause; register runtime.onListen(...)`);
      }
      throw new Pause(target);
    }
    const event = await raceAbort(Promise.resolve(handler({ pipeline: ctx.pipeline.name, target, current: ctx.current, context: this.snapshot(ctx) })), ctx.signal);
    this.config.recorder?.({ kind: "listen", target, value: event });
    this.deliver(stage, ctx, event, target);
  }
}

// ── Prompt construction ─────

function llmOptions(params: Record<string, string>, call: Record<string, unknown>): LLMOptions {
  const num = (v: unknown) => (v === undefined || v === "" ? undefined : Number(v));
  return {
    temperature: num(call.temperature ?? call.temp ?? params.temperature ?? params.temp),
    maxTokens: num(call.max_tokens ?? params.max_tokens),
    topP: num(call.top_p ?? params.top_p),
  };
}

export interface PromptParts {
  method: string;
  instructions: string[];
  inputs: unknown[];
  params: Record<string, unknown>;
  tool?: { name: string; result: unknown };
  /** The pipeline value, when it should be included as the input. */
  current: unknown;
  /** Retrieved context from equipped stores. */
  context?: Array<{ source: string; text: string; label?: string }>;
}

/**
 * Compose the user message for an agent call:
 *   Task (from the method name, unless it's `prompt`), the instruction strings,
 *   the input (pipeline value or explicit positional values), any tool result,
 *   and named args as parameters.
 */
export function buildPrompt(p: PromptParts): string {
  const sections: string[] = [];
  const hasCurrent = p.current !== undefined && p.current !== "";
  if (p.method !== "prompt") sections.push(`Task: ${humanize(p.method)}`);
  if (p.instructions.length) sections.push(p.instructions.join("\n\n"));
  if (hasCurrent) {
    if (!sections.length && !p.inputs.length && !p.tool && !Object.keys(p.params).length) return formatValue(p.current);
    sections.push(`Input:\n${formatValue(p.current)}`);
  }
  if (p.inputs.length === 1) sections.push(`Input:\n${formatValue(p.inputs[0])}`);
  else if (p.inputs.length > 1) sections.push(`Inputs:\n${p.inputs.map((v, i) => `${i + 1}. ${formatValue(v)}`).join("\n")}`);
  if (p.tool) sections.push(`Result from tool ${p.tool.name}:\n${formatValue(p.tool.result)}`);
  for (const c of p.context ?? []) sections.push(`${c.label ?? "Relevant context"} (from ${c.source}):\n${c.text}`);
  const params = Object.entries(p.params);
  if (params.length) sections.push(`Parameters:\n${params.map(([k, v]) => `- ${k}: ${formatValue(v)}`).join("\n")}`);
  return sections.join("\n\n");
}
