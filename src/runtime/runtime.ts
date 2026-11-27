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

import { appendFileSync, mkdirSync, realpathSync, renameSync, statSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
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
import { displayText, isQualified } from "../linker/names.js";
import { AdapterRegistry, type LLMMedia, type LLMMessage, type LLMRequest, type LLMToolCall, type LLMToolSpec, type ProviderAdapter } from "./adapter.js";
import { adoptMedia, collectMedia, dataUriBytes, fetchMedia, filesFromLabels, isMediaRef, youtubeRef, MEDIA_TYPES, MediaBytes, MediaError, megabytes, mediaLabel, mediaTokens, MemoryBlobStore, mint, type BlobStore, type MediaKind, type MediaRef } from "./media.js";
import { CostTracker, LLMRouter, type RouterConfig } from "./router.js";
import { PolicyEngine, type PolicyHooks, type Violation } from "./policies.js";
import { costAt, missingPriceMessage, priceOf, type Prices } from "./prices.js";
import { BUILTIN_PROVIDER_INFO } from "./provider-info.js";
import { closeMcpClients } from "./mcp.js";
import { closeChromeSessions } from "./providers/chrome.js";
import { closeRemoteSessions, endRemoteBranches, seedRemoteSessions, snapshotRemoteSessions, suspendRemoteSessions } from "./providers/remote.js";
import { closeKvDatabases, closeSqliteDatabases } from "./providers/index.js";
import { PARAMETERISED_SQL_PROVIDERS, sqlArgProblem } from "../parser/sql.js";
import { LocalVectorStore } from "./vectors.js";
import { applyPreset, skillNames } from "./presets.js";
import { withSandbox } from "./sandbox-agents.js";
import { findSkill, skillCatalog, skillPrompt } from "./skills.js";
import { skillSources } from "./providers/skills.js";
import { appendStep, readSteps, stateAt, stepsPathFor } from "./history.js";
import { applyOps, threadKey, ThreadStore, type ThreadContext, type ThreadOp } from "./threads.js";
import { deleteLog, logPathFor, readSnapshot, writeSnapshot } from "./snapshots.js";
import { constrain, shownParams, ToolRuleViolation } from "./tool-rules.js";
import { BUILTIN_PROVIDERS, declArgs, type ProviderInfo, type ToolApprovalRequest, type ToolMethod, type ToolProvider, type ToolServices, type WalletEvent } from "./tools.js";
import { captureWalletEnv, dotenvWithWallet, walletItem, walletLimits, walletNames, walletProgramProblem, type WalletItem, type WalletLimits } from "./wallet.js";
import { HOSTED_PROVIDER, HOSTED_PROVIDER_INFO, hostedProvider } from "./hosted.js";
import { MEDIA_INFO, MEDIA_PROVIDER, MEDIA_TOOL, mediaProvider, type Transcriber } from "./providers/media-files.js";
import { clock, isService, TRANSCRIBE_KEYS, TRANSCRIBE_SERVICES, transcriptionCost, transcriptText } from "./providers/transcribe.js";
import { aKind, kinds } from "./media-ref.js";
import { SecretRegistry } from "./secret-mask.js";
import { authName, connectEvent, connectionFrom, defaultBroker, isAuthRequired, type OAuthConnection, type TokenBroker } from "./oauth.js";
import { HttpError, HaloError, LoopLimitError, PolicyViolation, RunStoppedError, SchemaValidationError, SignalError, TimeoutError, isRetryable } from "./errors.js";
import { validateReturn } from "./schema.js";
import { placeholderSpots, quoteFor } from "./shell.js";
import { asNumber, asText, compactJson, declineReason, formatValue, isApproval, getPath, hasOwnKey, humanize, interpolate, isPlainObject, isSafeKey, looseEquals, parseOutput, pick, sleep, truthy } from "./values.js";

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
  /** The images and documents sent with the prompt (in a tool conversation, each is on its message). */
  media?: MediaRef[];
  /**
   * For an agent: the model asked for, and a hash of the whole request (model, prompt or conversation, settings).
   * For a tool: a hash of the call (target and arguments). Two calls with the same fingerprint asked the same thing.
   */
  model?: string;
  fingerprint?: string;
}

/**
 * A mock function can carry `live(req)`: when it returns true, that call goes to the model for real instead.
 * `halo replay --live-changed` uses it to call only the models whose requests changed.
 */
export type LiveCheck = (req: MockRequest) => boolean;

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
  /** The request's fingerprint (see MockRequest), for a model answer or a tool result; and what a model call cost in USD. */
  fingerprint?: string;
  cost?: number;
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
  /** False when Halo had no price for the model, so `cost` is a rough estimate. */
  priced?: false;
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
  /**
   * What makes this run's tool calls safe to repeat: the key the run was started with, else its
   * run id. Each call's own key is derived from it (see `ToolCall.idempotencyKey`).
   */
  idempotencyKey?: string;
  /** A rehearsal: models and tools answered from mocks, so nothing was sent anywhere. */
  dryRun?: boolean;
  /** The images and documents this run was given or made: the only ones it may send to a model or a tool. */
  media?: MediaRef[];
  pipeline: string;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  cost: number;
  tokens: { prompt: number; completion: number };
  calls: CallRecord[];
  violations: Violation[];
  shadows: ShadowRecord[];
  /** Each time `@cascade` moved a call up to a bigger model. */
  escalations?: EscalationRecord[];
  halted?: { stage: number; condition: string };
  /** Set while the run waits at `|! yield` (`waitingFor: "yield"`) or `~> listen(T)` (`waitingFor: T`). */
  /** `id` is new for every pause, so an approval for one pause can't answer a later one. */
  paused?: { stage: number; waitingFor: string; message?: string; id?: string; key?: string };
  /** How many times the run has paused. */
  pauses?: number;
  checkpoint?: string;
  /** For a run started from an earlier step of another (`rewind`): that run and step. */
  rewoundFrom?: { runId: string; step: number };
  /** How many times the run was picked up again after the process running it died. */
  resumes?: number;
  /** USD a person added to every MaxSpend limit for this run (`extendBudget`). Kept through checkpoints, resumes and rewinds. */
  budgetAdded?: number;
  /**
   * Who started the run, when the host says: `halo serve` sets "operator" (its token holder, through
   * the API, Studio or its own schedules) or "consumer:<name>". Until serve knows people, a connect
   * link (`/connect/...`) is offered only for an operator's runs.
   */
  owner?: string;
}

export interface TraceEntry {
  index: number;
  stage: PipelineStage["kind"];
  label: string;
  at: string;
  /** SHA-256 of the stage's output value. */
  outputHash: string;
  /** SHA-256 over what the stage's tool calls did (each call's target, arguments and result), when it made any. */
  effectsHash?: string;
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
  /** Snapshots of the run's Docker sandboxes (tool → image), so rewind and resume start from the same files. */
  sandboxes?: Record<string, string>;
}

/** Where an agent's tool conversation stopped to wait for approval: its turns so far and the calls still to run (the first is the one waiting). */
export interface AgentSession {
  messages: LLMMessage[];
  pending: LLMToolCall[];
  step: number;
  /** Under `@cascade`, which model of the cascade was answering (0 is the agent's own). */
  tier?: number;
}

/** `@cascade` moved an agent call up to the next model. */
export interface EscalationRecord {
  target: string;
  from: string;
  to: string;
  /** What the lower model's call ran into: an error, a policy rejection, or a schema miss. */
  error: string;
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
  | { type: "run"; pipeline: string; runId: string; status: "start" | "completed" | "halted" | "paused" | "error"; output?: unknown; error?: string; durationMs?: number; cost?: number; stopped?: true }
  | { type: "stage"; pipeline: string; runId: string; index: number; kind: PipelineStage["kind"]; label: string; status: "start" | "end"; value?: unknown; durationMs?: number }
  | { type: "llm"; pipeline: string; runId: string; agent: string; model: string; system?: string; prompt: string; media?: MediaRef[]; output: unknown; latencyMs: number; cost: number; tokens?: { prompt: number; completion: number }; mocked: boolean; priced?: false }
  | { type: "tool"; pipeline: string; runId: string; tool: string; method: string; output: unknown; latencyMs: number; mocked: boolean; sent?: MediaRef[] }
  /** A tool call still running said how far it has got (an MCP server's notifications/progress). */
  | { type: "tool_progress"; pipeline: string; runId: string; tool: string; method: string; progress: number; total?: number; message?: string }
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
  /** `@cascade`: the call failed or its answer was rejected on `from`, so it is asked again on `to`. */
  | { type: "escalate"; runId: string; pipeline: string; target: string; from: string; to: string; error: string }
  /** Text from a model, in order (the whole answer as one chunk unless the adapter streams). */
  | { type: "token"; runId: string; pipeline: string; target: string; text: string }
  | { type: "paused"; pipeline: string; runId: string; index: number; waitingFor: string }
  /** A wallet value was typed, refused, declined, or a submission after one was approved (never the value). */
  | ({ type: "wallet"; pipeline: string; runId: string; at: string } & WalletEvent)
  | { type: "checkpoint"; runId: string; path: string }
  /** A person added `added` USD to every MaxSpend limit of a running run (`budgetAdded` in all). */
  | { type: "budget"; runId: string; added: number; budgetAdded: number; spent: number }
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
  /** Where the bytes of images and documents are kept, by hash. Defaults to an in-memory store. */
  blobs?: BlobStore;
  /**
   * How the runtime turns files into what a model can read (halo.json "media"). `transcribe`:
   * the service that transcribes audio sent to a model that can't take audio ("openai" or
   * "gemini"; default whichever has a key), with `transcribeModel`, and `baseUrl` for a proxy.
   */
  media?: { transcribe?: string; transcribeModel?: string; baseUrl?: string };
  /**
   * Where each running run's state is kept after every stage, until the run ends or pauses.
   * A run found there later was cut short (the process died); `continueRun` picks it up at
   * the stage it was on. Unset, nothing is kept.
   */
  progressStore?: RunStore;
  onInterrupt?: InterruptHandler;
  onListen?: ListenHandler;
  /** Receives System.Publish / Distribute / ResolveIncident / TriggerWebhook / Notify. */
  onSystemEvent?: (call: SystemCall) => unknown | Promise<unknown>;
  /** Observe execution (stages, LLM calls, retries, ...). */
  onEvent?: (event: RuntimeEvent) => void;
  /** Receives every model answer, tool result, and approval as it happened (unredacted), so the run can be replayed. */
  recorder?: (entry: RecordedCall) => void;
  logger?: Pick<Console, "log" | "warn">;
  /**
   * Set by `halo serve` and `halo mcp`: the runtime serves pipelines to others. A wallet item is
   * refused there unless its Vault says serve: true.
   */
  serving?: boolean;
  /** Append each wallet event (never a value) to this file as a JSON line, e.g. ".halo/wallet.log". */
  walletLog?: string;
  /**
   * Model prices in USD per million tokens, by model as written in the .halo file (halo.json
   * "prices"), e.g. { "vllm/my-model": { input: 0, output: 0 } }. They win over
   * the adapters' own tables. Under MaxSpend, a call to a model with no price is refused.
   */
  prices?: Prices;
  /** The OAuth token broker (default: the one this process shares). */
  broker?: TokenBroker;
  /** The project whose OAuth connections the runs use (their tokens are kept for it). Default: the working directory. */
  projectRoot?: string;
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
  /** What each of those answers approved (the paused request's key), so it releases only that request. */
  approvalKeys?: Record<number, string | undefined>;
  /** The calling pipeline's context, for a called pipeline. */
  parent?: ExecutionContext;
  /** When this pipeline's @timeout runs out (ms since epoch). */
  deadline?: number;
  /** A `@thread` run's thread (shared by the pipelines it calls). */
  thread?: ThreadContext;
  /** Inside a fan-out: which branch ("3.0", "3.0/5.2"…), so each can fork its own sandbox. */
  branch?: string;
  /** Hashes of what the current stage's tool calls did, for its trace entry. */
  effects?: string[];
}

/** Thrown inside a run to pause it at a yield/listen with no handler. */
class Pause {
  /** `key`, for an approval: what is being approved (see ToolApprovalRequest.key). */
  constructor(readonly waitingFor: string, readonly message?: string, readonly key?: string) {}
}

interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  /** Images and documents sent with the prompt. */
  media?: MediaRef[];
}

/** What an `Image` or `Document` argument may be, beyond its bytes or a `data:` URI (see `HaloRuntime.run`). */
export type MediaTrust = "urls" | "trusted" | "files";

/** What a call's images and documents add to its prompt, in tokens (a high estimate). */
const mediaAllowance = (media: MediaRef[] | undefined) => (media ?? []).reduce((sum, m) => sum + mediaTokens(m), 0);

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

const MAX_STREAM_DEPTH = 16;
const MAX_PIPELINE_CALLS = 100_000;
const GENESIS = "0".repeat(64);

function sha256(...parts: string[]): string {
  const h = new Bun.CryptoHasher("sha256");
  for (const p of parts) h.update(p);
  return h.digest("hex");
}

/** A hash of everything a model request asks: the model, the prompt (or the conversation so far and the tools offered), and its settings. */
function requestFingerprint(model: string, prompt: string, system: string | undefined, options: LLMOptions, turn?: Turn): string {
  // Tool call ids and the adapter's raw turns differ between a run and its replay, so they don't count.
  const messages = turn?.messages.map((m) =>
    m.role === "assistant"
      ? { role: m.role, content: m.content, calls: m.toolCalls?.map((c) => [c.name, c.args]) }
      : m.role === "tool"
        ? { role: m.role, name: m.name, content: m.content, ...(m.media?.length ? { media: m.media.map((x) => x.sha256) } : {}) }
        : m.role === "user" && m.media?.length
          ? { role: m.role, content: m.content, media: m.media.map((x) => x.sha256) }
          : m,
  );
  // A call with no media hashes exactly as it did before media existed, so old recordings still match.
  const asked = turn ? { messages, tools: turn.targets, toolChoice: turn.toolChoice } : { system, prompt, ...(options.media?.length ? { media: options.media.map((m) => m.sha256) } : {}) };
  return sha256(safeJson({ model, ...asked, temperature: options.temperature, maxTokens: options.maxTokens, topP: options.topP }));
}

/** A tool call's fingerprint: what it was asked to do (its target and arguments). */
function toolFingerprint(target: string, args: unknown[], named: Record<string, unknown>): string {
  return sha256(safeJson({ target, args, named }));
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

/** A budget extension: a positive, finite number of USD. */
function checkedBudget(usd: number): number {
  if (typeof usd !== "number" || !Number.isFinite(usd) || usd <= 0) throw new HaloError(`A budget extension must be a positive amount of USD (got ${usd})`, { code: "BUDGET_EXTENSION" });
  return usd;
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
    if (t.prev !== prev || t.hash !== sha256(t.prev, String(t.index), t.stage, t.label, t.at, t.outputHash, ...(t.effectsHash ? [t.effectsHash] : []))) return false;
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
  /** Runs this runtime is running now, so `stop` and `extendBudget` can reach them. */
  private live = new Map<string, { ctx: ExecutionContext; stopper: AbortController }>();
  /** Runs being claimed right now (guards stores without an atomic take). */
  private resuming = new Set<string>();
  private guard = new PolicyEngine(this.policies);
  private shadowMinds = new Map<string, Agent[]>();
  private shadowModels = new Map<string, string[]>();
  /** Qualified internal names (from the linker) → the names people see. */
  private names: Record<string, string> = {};

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
  // Packages' hosted pipelines (the linker's stubs) call the publisher's server through halo#hosted.
  private providers = new Map<string, ToolProvider>([...Object.entries(BUILTIN_PROVIDERS), [HOSTED_PROVIDER, hostedProvider], [MEDIA_PROVIDER, mediaProvider(() => this.transcriber())]]);
  private providerInfo = new Map<string, ProviderInfo>([...Object.entries(BUILTIN_PROVIDER_INFO), [HOSTED_PROVIDER, HOSTED_PROVIDER_INFO], [MEDIA_PROVIDER, MEDIA_INFO]]);
  private systems = new Map<string, SystemHandler>();
  private vectorStore?: LocalVectorStore;
  private threadStore?: ThreadStore;
  private sqlPool = new Map<string, InstanceType<typeof Bun.SQL>>();
  /**
   * The values this runtime read from its environment (Env.NAME, provider keys), by name, so a
   * service that echoes one back (an error page quoting the Authorization header) can't hand it
   * to the model, the terminal, telemetry or a recording: tool results and errors are masked.
   */
  private readonly envSecrets = new SecretRegistry();
  private runStore: RunStore;
  private blobs: BlobStore;

  constructor(config: RuntimeConfig = {}) {
    this.config = config;
    this.runStore = config.runStore ?? new MemoryRunStore();
    this.blobs = config.blobs ?? new MemoryBlobStore();
    this.router = new LLMRouter(config.router);
    this.routerEnabled = config.router !== undefined;
    // Wallet values in the environment move into the wallet now, before anything can read them.
    captureWalletEnv(process.env);
    if (this.env !== process.env) captureWalletEnv(this.env);
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
    if (ast.names && Object.keys(ast.names).length) this.names = { ...this.names, ...ast.names };
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
        const sandboxed = withSandbox(agent, declared, this.policies);
        agent = sandboxed.agent;
        if (sandboxed.tool) this.tools.set(sandboxed.tool.name, sandboxed.tool);
      } catch (err) {
        throw new HaloError((err as Error).message, { code: "BAD_SANDBOX" });
      }
      this.agents.set(m.name, agent);
    }
    for (const sc of ast.schemas) this.schemas.set(sc.name, sc);
    this.indexShadows();
    // A program with a wallet has no tool that runs commands as you, whether or not a run ever uses the browser.
    const walletProblem = walletProgramProblem(this.tools.values());
    if (walletProblem) throw new HaloError(walletProblem, { code: "TOOL_CONFIG" });
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
    // halo#hosted is internal: only the linker's hosted-pipeline stubs use it.
    return [...this.providers.keys()].filter((n) => n !== HOSTED_PROVIDER);
  }

  /** Register a `System.<name>(...)` method. A non-undefined return value replaces the pipeline value. */
  registerSystem(name: string, handler: SystemHandler): this {
    this.systems.set(name, handler);
    return this;
  }

  /** Get every answer a run gets from outside (model answers, tool results, approvals), as a recording keeps them: unredacted. */
  recordTo(recorder: (entry: RecordedCall) => void): this {
    this.config.recorder = recorder;
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
    closeSqliteDatabases();
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
  /**
   * `media` says what an `Image` or `Document` argument may be beyond its bytes, a Blob, or a
   * `data:` URI: "urls" also fetches an https URL (from a public address only); "trusted" also
   * accepts references a run made before (a replay of recorded arguments); "files" allows all
   * of that and a path on this machine (the CLI: the person's own machine).
   */
  async run(pipelineName: string, args: Record<string, unknown> = {}, options: { signal?: AbortSignal; runId?: string; idempotencyKey?: string; dryRun?: boolean; media?: MediaTrust; owner?: string } = {}): Promise<RunResult> {
    const pipeline = this.pipelines.get(pipelineName);
    if (!pipeline) throw new HaloError(`Pipeline "${pipelineName}" not found`, { code: "PIPELINE_NOT_FOUND" });
    const ctx = this.newContext(pipeline, args, 0, options.signal);
    if (options.runId) ctx.meta.runId = options.runId;
    if (options.idempotencyKey) ctx.meta.idempotencyKey = options.idempotencyKey;
    if (options.dryRun) ctx.meta.dryRun = true;
    if (options.owner) ctx.meta.owner = options.owner;
    this.walletFolders(ctx);
    await this.adoptArgs(ctx, options.media);
    return this.runTop(ctx, 0);
  }

  /** Store bytes as a media value of this run. */
  private async mintFor(ctx: ExecutionContext, bytes: Uint8Array, info: { name?: string; want?: MediaKind } = {}): Promise<MediaRef> {
    const ref = await mint(this.blobs, bytes, info);
    this.admit(ctx, ref);
    return ref;
  }

  private admit(ctx: ExecutionContext, ref: MediaRef) {
    const known = (this.topMeta(ctx).media ??= []);
    if (!known.some((m) => m.sha256 === ref.sha256)) known.push(ref);
  }

  /** Whether this run was given or made the file with this hash. */
  private holds(ctx: ExecutionContext, sha256: string): boolean {
    return !!this.topMeta(ctx).media?.some((m) => m.sha256 === sha256);
  }

  /** The kind of media a declared type holds (`Image`, `Array<Document>`), unless the program has its own schema of that name. */
  private mediaKindOf(type: string): MediaKind | undefined {
    const base = /^(?:Array|List)<\s*(\w+)\s*>$/.exec(type)?.[1] ?? type;
    return this.schemas.has(base) ? undefined : MEDIA_TYPES[base];
  }

  /** Turn the arguments given for `Image` and `Document` parameters into media values. */
  private async adoptArgs(ctx: ExecutionContext, trust?: MediaTrust): Promise<void> {
    for (const p of ctx.pipeline.params) {
      const kind = this.mediaKindOf(p.type);
      if (!kind || !Object.hasOwn(ctx.input, p.name)) continue;
      const given = ctx.input[p.name];
      const what = `${this.displayName(ctx.pipeline.name)}: "${p.name}"`;
      const many = /^(?:Array|List)</.test(p.type);
      if (many && given !== undefined && given !== null && !Array.isArray(given)) throw new MediaError(`${what} takes a list of ${kind}s`, "MEDIA_INPUT");
      const adopted = Array.isArray(given) && many ? await Promise.all(given.map((v) => this.adoptValue(v, kind, what, ctx, trust))) : await this.adoptValue(given, kind, what, ctx, trust);
      if (ctx.current === given) ctx.current = adopted;
      ctx.input[p.name] = adopted;
      ctx.data[p.name] = adopted;
    }
    if (trust === "trusted" || trust === "files") for (const ref of collectMedia(ctx.input)) this.admit(ctx, ref);
    // Files the host handed over as bytes (an email's attachments, say) become media values wherever they are.
    for (const [k, v] of Object.entries(ctx.input)) {
      const adopted = await adoptMedia(v, (bytes, name) => this.mintFor(ctx, bytes, { name }), { shapes: false });
      if (adopted === v) continue;
      if (ctx.current === v) ctx.current = adopted;
      ctx.input[k] = adopted;
      ctx.data[k] = adopted;
    }
  }

  private async adoptValue(v: unknown, kind: MediaKind, what: string, ctx: ExecutionContext, trust?: MediaTrust): Promise<unknown> {
    if (v === undefined || v === null) return v;
    const a = aKind(kind);
    if (v instanceof MediaBytes) return this.mintFor(ctx, v.bytes, { name: v.name, want: kind });
    if (v instanceof Uint8Array || v instanceof ArrayBuffer) return this.mintFor(ctx, v instanceof Uint8Array ? v : new Uint8Array(v), { want: kind });
    if (v instanceof Blob) return this.mintFor(ctx, new Uint8Array(await v.arrayBuffer()), { name: (v as Blob & { name?: string }).name, want: kind });
    if (isMediaRef(v)) {
      if (trust !== "trusted" && trust !== "files" && !this.holds(ctx, v.sha256)) throw new MediaError(`${what} was given a reference to a file, not the file. Send ${a} itself (its bytes, or a data: URI)`, "MEDIA_INPUT");
      if (v.$media !== kind) throw new MediaError(`${what} takes ${a}, and was given ${mediaLabel(v)}`, "MEDIA_TYPE");
      return v;
    }
    if (typeof v === "string") {
      // A YouTube link is a video Gemini can watch from where it is: held as the link, not as bytes.
      const youtube = kind === "video" ? youtubeRef(v) : undefined;
      if (youtube) {
        this.admit(ctx, youtube);
        return youtube;
      }
      const inline = dataUriBytes(v);
      if (inline) return this.mintFor(ctx, inline, { want: kind });
      if ((trust === "urls" || trust === "files") && /^https?:\/\//i.test(v)) {
        const got = await fetchMedia(v, { fetch: this.fetch, signal: ctx.signal });
        return this.mintFor(ctx, got.bytes, { name: got.name, want: kind });
      }
      if (trust === "files") {
        const file = Bun.file(v);
        if (!(await file.exists())) throw new MediaError(`${what}: no file at ${v.slice(0, 200)}`, "MEDIA_INPUT");
        if (file.size > 64 * 1024 * 1024) throw new MediaError(`${what}: ${v.slice(0, 200)} is ${megabytes(file.size)}, too large to send to a model`, "MEDIA_TOO_LARGE");
        return this.mintFor(ctx, new Uint8Array(await file.arrayBuffer()), { name: v, want: kind });
      }
    }
    throw new MediaError(`${what} takes ${a}: its bytes, or a data: URI${trust === "urls" || trust === "files" ? ", or an https URL" : ""}${trust === "files" ? ", or a path to a file" : ""}`, "MEDIA_INPUT");
  }

  /**
   * The files a model call carries, and the documents it reads as text instead: each one a
   * model can't take as a file is turned into its text by a recorded `Media.text` step (once per
   * file per run). A deck's PDF (when LibreOffice made one) and an email's attachments go as files.
   */
  private async filesForPrompt(agent: Agent, target: string, ctx: ExecutionContext, ...values: unknown[]): Promise<{ media: MediaRef[]; documents: Array<{ source: string; label: string; text: string }> }> {
    const media: MediaRef[] = [];
    const documents: Array<{ source: string; label: string; text: string }> = [];
    // A deck's PDF is sent only where every model the call may use reads PDFs, and the agent's policies allow it.
    const takesPdf = this.cascadeTiers(agent).every((m) => this.adapterRegistry.findAdapter(m)?.input?.["application/pdf"] !== undefined);
    const add = (m: MediaRef) => media.some((x) => x.sha256 === m.sha256) || media.push(m);
    // Whether every model the call may use takes this file as it is.
    const direct = (m: MediaRef) =>
      this.cascadeTiers(agent).every((model) => {
        const limit = this.adapterRegistry.findAdapter(model)?.input?.[m.type];
        return limit !== undefined && m.size <= limit;
      });
    for (const m of this.mediaFor(ctx, target, ...values)) {
      if (m.$media === "audio") {
        if (direct(m)) {
          add(m);
          continue;
        }
        // A model that can't take audio gets its transcript: a recorded step, priced first against the agent's budget.
        const cache = (this.documentTexts.get(this.topMeta(ctx)) ?? this.documentTexts.set(this.topMeta(ctx), new Map()).get(this.topMeta(ctx))!);
        let heard = cache.get(m.sha256);
        if (!heard) {
          const t = this.transcriber();
          const limit = this.limitFor(agent, ctx);
          if (!("missing" in t) && limit !== undefined && this.spent(ctx) + transcriptionCost(m, t.model ?? "") > limit) this.guard.refuseOverBudget(agent, this.guardHooks(ctx));
          cache.set(m.sha256, (heard = (await this.toolCall(MEDIA_TOOL, "transcript", [m], {}, ctx, false)) as { text?: unknown }));
        }
        documents.push({ source: mediaLabel(m), label: "The transcript", text: transcriptText(heard as { text?: unknown; segments?: unknown }) });
        continue;
      }
      if (m.$media === "video") {
        if (direct(m)) {
          add(m);
          continue;
        }
        if (m.url) throw new MediaError(`${target}: ${mediaLabel(m)} is a YouTube link, and only Gemini models watch those (Halo doesn't download YouTube videos). Give the agent a Gemini model`, "MEDIA_UNSUPPORTED");
        // A model that can't watch video gets its transcript and a frame every few seconds: a recorded step.
        const cache = (this.documentTexts.get(this.topMeta(ctx)) ?? this.documentTexts.set(this.topMeta(ctx), new Map()).get(this.topMeta(ctx))!);
        let seen = cache.get(m.sha256) as { duration?: number; transcript?: { text?: unknown; segments?: unknown }; noTranscript?: string; frames?: Array<{ at: number; image: unknown }> } | undefined;
        if (!seen) {
          const t = this.transcriber();
          const limit = this.limitFor(agent, ctx);
          if (!("missing" in t) && limit !== undefined && this.spent(ctx) + transcriptionCost(m, t.model ?? "") > limit) this.guard.refuseOverBudget(agent, this.guardHooks(ctx));
          seen = (await this.toolCall(MEDIA_TOOL, "digest", [m], {}, ctx, false)) as typeof seen;
          cache.set(m.sha256, seen as never);
        }
        const frames = (seen?.frames ?? []).filter((f): f is { at: number; image: MediaRef } => isMediaRef(f.image));
        const refused = frames.length ? this.guard.mediaRefusal(agent, [frames[0]!.image]) : undefined;
        const lines = [
          ...(seen?.duration ? [`It is ${clock(seen.duration)} long.`] : []),
          seen?.transcript ? `What is said:\n${transcriptText(seen.transcript) || "(nothing)"}` : `No transcript: ${seen?.noTranscript ?? "none was made"}.`,
          refused ? `Its frames were not shown: ${refused.message}` : `Frames:\n${frames.map((f) => `${mediaLabel(f.image)} at ${clock(f.at)}`).join("\n")}`,
        ];
        documents.push({ source: mediaLabel(m), label: "What the video shows", text: lines.join("\n\n") });
        if (!refused) for (const f of frames) add(f.image);
        continue;
      }
      if (m.$media !== "document" || !m.format || m.format === "pdf") {
        add(m);
        continue;
      }
      const cache = (this.documentTexts.get(this.topMeta(ctx)) ?? this.documentTexts.set(this.topMeta(ctx), new Map()).get(this.topMeta(ctx))!);
      let read = cache.get(m.sha256);
      if (!read) cache.set(m.sha256, (read = (await this.toolCall(MEDIA_TOOL, "text", [m], {}, ctx, false)) as { text?: unknown; rendition?: unknown; attachments?: unknown }));
      documents.push({ source: mediaLabel(m), label: "The text", text: typeof read.text === "string" ? read.text : formatValue(read.text) });
      if (isMediaRef(read.rendition) && takesPdf && !this.guard.mediaRefusal(agent, [read.rendition])) add(read.rendition);
      // An email's images and PDFs go with it, unless the agent's policies don't allow them (then its text says so).
      for (const a of Array.isArray(read.attachments) ? read.attachments.filter(isMediaRef) : []) {
        if (a.$media === "document" && a.format && a.format !== "pdf") continue; // read as text only when passed on by itself
        const refused = this.guard.mediaRefusal(agent, [a]);
        if (refused) documents.at(-1)!.text += `\n${mediaLabel(a)} was not shown: ${refused.message}`;
        else add(a);
      }
    }
    return { media, documents };
  }

  /** The service that transcribes audio for a model that can't take it: the one configured, else whichever has a key. */
  private transcriber(): Transcriber {
    const asked = this.config.media?.transcribe;
    if (asked !== undefined && !isService(asked)) return { missing: `media.transcribe is "${asked}"; use ${TRANSCRIBE_SERVICES.join(" or ")}` };
    const keyOf = (s: "openai" | "gemini") => this.config.apiKeys?.[s === "gemini" ? "google" : s] ?? TRANSCRIBE_KEYS[s].map((k) => this.env[k]).find(Boolean);
    const service = asked ?? TRANSCRIBE_SERVICES.find((s) => keyOf(s));
    if (!service) return { missing: `Audio can't be sent to this model, so Halo transcribes it first, and that needs ${TRANSCRIBE_KEYS.openai.join("")} or ${TRANSCRIBE_KEYS.gemini.join(" or ")} (or "media": { "transcribe": ... } in halo.json). Or give the agent a Gemini model, which takes audio` };
    const apiKey = keyOf(service);
    if (!apiKey) return { missing: `media.transcribe is ${service}, and ${TRANSCRIBE_KEYS[service].join(" or ")} is not set` };
    return { service, apiKey, model: this.config.media?.transcribeModel, baseUrl: this.config.media?.baseUrl };
  }

  /** The text each document a run holds was read as, by hash, so a run reads each once. */
  private documentTexts = new WeakMap<RunMeta, Map<string, { text?: unknown; rendition?: unknown; attachments?: unknown }>>();

  /** The media among `values` that a model call will carry. One this run never made is refused. */
  private mediaFor(ctx: ExecutionContext, target: string, ...values: unknown[]): MediaRef[] {
    const media = collectMedia(...values);
    for (const m of media) {
      if (!this.holds(ctx, m.sha256)) throw new MediaError(`${target}: ${mediaLabel(m)} is not a file this run was given or made, so it can't be sent to a model`, "MEDIA_UNKNOWN");
    }
    return media;
  }

  /** The pipelines this runtime has loaded, as entry points: not those a linked program imported (they're callable from these). */
  listPipelines(): PipelineDeclaration[] {
    return [...this.pipelines.values()].filter((p) => !isQualified(p.name));
  }

  /** A name or message with the linker's internal names replaced by the names people see. */
  displayName(text: string): string {
    return displayText(this.names, text);
  }

  /**
   * Run a pipeline and yield its events as they happen: stages, model output
   * (`token`), tool calls, and finally `done` (or `error`).
   */
  async *stream(pipelineName: string, args: Record<string, unknown> = {}): AsyncGenerator<RuntimeEvent | { type: "done"; result: RunResult } | { type: "error"; error: Error }> {
    const pipeline = this.pipelines.get(pipelineName);
    if (!pipeline) throw new HaloError(`Pipeline "${pipelineName}" not found`, { code: "PIPELINE_NOT_FOUND" });
    const ctx = this.newContext(pipeline, args, 0);
    await this.adoptArgs(ctx);
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

  /**
   * Continue a run from a @checkpoint file. `addBudget` (USD) raises every MaxSpend limit
   * for this run on top of what was added before, for a run that stopped on its budget.
   */
  async resume(checkpointPath: string, options: { signal?: AbortSignal; addBudget?: number } = {}): Promise<RunResult> {
    const cp = await readSnapshot(checkpointPath);
    if (!cp) throw new HaloError(`No checkpoint at ${checkpointPath}`);
    // A run that ended has saved its thread changes already; only later ones are new.
    if (cp.thread && this.threads().savedBy(cp.thread.name, cp.thread.key, cp.meta.runId)) cp.thread.saved = cp.thread.ops.length;
    const ctx = this.restore(cp, options.signal);
    if (options.addBudget) ctx.meta.budgetAdded = (ctx.meta.budgetAdded ?? 0) + checkedBudget(options.addBudget);
    return this.runTop(ctx, cp.nextStage);
  }

  /**
   * Pick up a run that was cut short, from the state `progressStore` last kept for it. The
   * stage it was on runs again from its start: its tool calls carry the same idempotency
   * keys as before, so a tool that honours them does nothing twice.
   */
  async continueRun(snapshot: RunSnapshot): Promise<RunResult> {
    if (snapshot.waitingFor !== undefined) throw new HaloError(`Run ${snapshot.meta.runId} is paused, not cut short: answer it with signal()`);
    if (snapshot.thread && this.threads().savedBy(snapshot.thread.name, snapshot.thread.key, snapshot.meta.runId)) snapshot.thread.saved = snapshot.thread.ops.length;
    const ctx = this.restore(snapshot);
    ctx.meta.resumes = (snapshot.meta.resumes ?? 0) + 1;
    return this.runTop(ctx, snapshot.nextStage);
  }

  /**
   * Go back to a step of a @checkpoint run and continue from there, as a new run.
   * The new run starts with the state, trace, calls and cost the old one had after
   * that step (and, with @checkpoint, the history up to it). The old run is untouched.
   * Every stage after the step runs again: models, tools and approvals.
   */
  async rewind(checkpointPath: string, step: number, options: { runId?: string; signal?: AbortSignal; addBudget?: number } = {}): Promise<RunResult> {
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
        // It carries the old run's spend, so it carries what a person added to its budget too.
        ...(cp.meta.budgetAdded || options.addBudget ? { budgetAdded: (cp.meta.budgetAdded ?? 0) + (options.addBudget ? checkedBudget(options.addBudget) : 0) } : {}),
        // The same key as the run it came from, so a call it already made isn't made a second time.
        idempotencyKey: cp.meta.idempotencyKey ?? cp.meta.runId,
      },
    };
    if (cp.thread) {
      // The thread as the old run saw it at that step. Its changes so far are saved already if the old run ended.
      const ops = cp.thread.ops.slice(0, s.thread ?? 0);
      const saved = this.threads().savedBy(cp.thread.name, cp.thread.key, cp.meta.runId) ? ops.length : 0;
      snap.thread = { ...cp.thread, ops, state: applyOps(cp.thread.base, ops), saved };
    }
    const ctx = this.restore(snap, options.signal);
    // Its sandboxes start from the files they had after that step.
    seedRemoteSessions(runId, at.sandboxes);
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
      // Waiting for a connection: the stage that needed it runs again (an agent picks up its
      // conversation at the call that needed it; a yield(connect:) checks the connection again,
      // and pauses again if it still isn't there). The payload is not used.
      if (snap.waitingFor.startsWith("connect:")) {
        return { pipeline: snap.pipeline, result: this.runTop(ctx, snap.nextStage).then(done, failed) };
      }
      // An agent waiting for approval of a tool call: its stage runs again, picking up its conversation with the answer.
      // A tool stage waiting for its provider's approval (a wallet fill the pipeline makes itself) runs again too.
      if (snap.waitingFor === "approval") {
        const toolStage = stage?.kind === "call" && this.tools.has(stage.callee) && snap.meta.paused?.key !== undefined;
        if (stage?.kind !== "call" || (!snap.sessions?.[snap.nextStage] && !toolStage)) throw new SignalError(`Run ${runId} is not waiting for an approval`, "RUN_NOT_FOUND");
        ctx.approvals = { [snap.nextStage]: payload };
        ctx.approvalKeys = { [snap.nextStage]: snap.meta.paused?.key };
        return { pipeline: snap.pipeline, result: this.runTop(ctx, snap.nextStage).then(done, failed) };
      }
      if (stage?.kind !== "interrupt" && stage?.kind !== "listen") throw new SignalError(`Run ${runId} is not paused at a yield or listen`, "RUN_NOT_FOUND");
      ctx.stageIndex = snap.nextStage;
      this.record({ kind: stage.kind === "interrupt" ? "yield" : "listen", target: snap.waitingFor, value: payload });
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

  private restore(snap: RunSnapshot, signal?: AbortSignal): ExecutionContext {
    const pipeline = this.pipelines.get(snap.pipeline);
    if (!pipeline) throw new HaloError(`Saved run is for pipeline "${snap.pipeline}", which is not loaded`);
    const ctx = this.newContext(pipeline, snap.input, 0, signal);
    Object.assign(ctx, { data: snap.data, trace: snap.trace, current: snap.current, loops: snap.loops ?? {}, loopFeedback: snap.loopFeedback, sessions: snap.sessions, thread: snap.thread });
    ctx.meta = { ...snap.meta, halted: undefined, paused: undefined, finishedAt: undefined, durationMs: undefined };
    seedRemoteSessions(ctx.meta.runId, snap.sandboxes);
    return ctx;
  }

  /** Run a top-level pipeline from `start`, reporting run events and checking the declared output schema. */
  private async runTop(ctx: ExecutionContext, start: number): Promise<RunResult> {
    const base = { pipeline: ctx.pipeline.name, runId: ctx.meta.runId };
    // `stop(runId)` aborts the run as well as whatever signal the caller passed.
    const stopper = new AbortController();
    ctx.signal = AbortSignal.any([ctx.signal, stopper.signal]);
    const live = { ctx, stopper };
    this.live.set(ctx.meta.runId, live);
    this.emit({ type: "run", ...base, status: "start" });
    try {
      ctx.thread ??= this.openThread(ctx);
      // Files an earlier run kept in the thread are this run's to use.
      if (ctx.thread) for (const ref of collectMedia(ctx.thread.state)) this.admit(ctx, ref);
      await this.saveProgress(ctx, start);
      const result = await this.runFrom(ctx, start);
      // Ended, or paused (and so in the run store): there is nothing left to pick up.
      await this.config.progressStore?.delete(ctx.meta.runId);
      // A run that ended (not one that paused) saves what it changed in its thread.
      if (ctx.thread && result.status !== "paused") result.context.thread = this.saveThread(ctx.thread, ctx.meta.runId);
      // A browser or sandbox the run opened stays open only while the run may still need it.
      if (result.status !== "paused") await Promise.all([closeChromeSessions(ctx.meta.runId), closeRemoteSessions(ctx.meta.runId)]);
      this.emit({ type: "run", ...base, status: result.status, output: result.output, durationMs: ctx.meta.durationMs, cost: ctx.meta.cost });
      return result;
    } catch (err) {
      await Promise.all([closeChromeSessions(ctx.meta.runId), closeRemoteSessions(ctx.meta.runId)]);
      await Promise.resolve(this.config.progressStore?.delete(ctx.meta.runId)).catch(() => {});
      await this.keepBudgetAdded(ctx).catch(() => {});
      // Errors name things as people know them, not by the linker's internal names.
      if (err instanceof Error && err.message.includes("#")) {
        try {
          err.message = this.displayName(err.message);
        } catch {}
      }
      this.emit({ type: "run", ...base, status: "error", error: err instanceof Error ? err.message : String(err), cost: ctx.meta.cost, ...(err instanceof RunStoppedError ? { stopped: true as const } : {}) });
      throw err;
    } finally {
      if (this.live.get(ctx.meta.runId) === live) this.live.delete(ctx.meta.runId);
    }
  }

  /**
   * A budget raised part-way through a stage isn't in the checkpoint until the next stage saves
   * one. A run that fails or is stopped first writes it there, so resuming it keeps the extension.
   */
  private async keepBudgetAdded(ctx: ExecutionContext): Promise<void> {
    const path = this.checkpointPath(ctx);
    if (!path || !ctx.meta.budgetAdded) return;
    const file = Bun.file(path);
    if (!(await file.exists())) return;
    const core = (await file.json()) as { meta?: { budgetAdded?: number } };
    if (!core.meta || core.meta.budgetAdded === ctx.meta.budgetAdded) return;
    core.meta.budgetAdded = ctx.meta.budgetAdded;
    await Bun.write(path, JSON.stringify(core));
  }

  /** Whether this runtime is running `runId` right now (not paused, not finished). */
  isRunning(runId: string): boolean {
    return this.live.has(runId);
  }

  /** A running run's spend so far and what has been added to its budget, or undefined if it isn't running here. */
  liveRun(runId: string): { cost: number; tokens: RunMeta["tokens"]; budgetAdded: number } | undefined {
    const ctx = this.live.get(runId)?.ctx;
    if (!ctx) return undefined;
    return { cost: this.spent(ctx), tokens: { ...ctx.meta.tokens }, budgetAdded: ctx.meta.budgetAdded ?? 0 };
  }

  /**
   * Stop a running run: the stage it is on is aborted and the run fails with a RunStoppedError.
   * With @checkpoint it can be continued later from its last finished stage. False if it isn't running here.
   */
  stop(runId: string, reason = "Stopped"): boolean {
    const live = this.live.get(runId);
    if (!live) return false;
    live.stopper.abort(new RunStoppedError(reason));
    return true;
  }

  /**
   * Raise every MaxSpend limit of a running run by `usd`, from its next model call on. The
   * extension is saved with the run, so a checkpoint, resume or rewind keeps it. Returns the
   * total added so far, or undefined if the run isn't running here.
   */
  extendBudget(runId: string, usd: number): number | undefined {
    const ctx = this.live.get(runId)?.ctx;
    if (!ctx) return undefined;
    ctx.meta.budgetAdded = (ctx.meta.budgetAdded ?? 0) + checkedBudget(usd);
    // Calls waiting for room in the budget may fit now.
    const flight = this.inflight.get(ctx.meta);
    flight?.waiting.shift()?.();
    this.emit({ type: "budget", runId, added: usd, budgetAdded: ctx.meta.budgetAdded, spent: this.spent(ctx) });
    return ctx.meta.budgetAdded;
  }

  /** The MaxSpend limits of the loaded agents, lowest first (before anything a person adds to a run). */
  spendLimits(): number[] {
    const limits = new Set<number>();
    for (const agent of this.agents.values()) {
      const l = this.guard.spendLimit(agent);
      if (l !== undefined) limits.add(l);
    }
    return [...limits].sort((a, b) => a - b);
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
    } catch (caught) {
      let err = caught;
      // A connection that needs a person (not connected, or its grant was revoked) pauses the run
      // at the top-level stage it reached, instead of failing it; connecting and resuming runs that
      // stage again, its tool calls with the same idempotency keys.
      if (isAuthRequired(err) && ctx.depth === 0 && !ctx.signal.aborted) err = new Pause(connectEvent(err.connection), err.message);
      if (!(err instanceof Pause)) throw err;
      // No handler for this yield/listen: save the run so signal() can continue it.
      const i = ctx.stageIndex;
      ctx.meta.paused = { stage: i, waitingFor: err.waitingFor, message: err.message, id: crypto.randomUUID(), ...(err.key !== undefined ? { key: err.key } : {}) };
      ctx.meta.pauses = (ctx.meta.pauses ?? 0) + 1;
      const snap = this.toSnapshot(ctx, i, err.waitingFor);
      // A pause can last days: its Docker sandboxes are saved and stopped, and started again on resume.
      const sandboxes = await suspendRemoteSessions(ctx.meta.runId);
      if (Object.keys(sandboxes).length) snap.sandboxes = sandboxes;
      await this.runStore.save(ctx.meta.runId, snap);
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
      // One list per stage, made before any branch copies the context, so every branch adds to it.
      ctx.effects = [];
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
    // What the stage's tool calls did is in the chain too, so a trace vouches for actions, not just answers.
    const effects = ctx.effects?.length ? sha256(...[...ctx.effects].sort()) : undefined;
    ctx.effects = [];
    const hash = sha256(prev, String(index), stage.kind, label, at, outputHash, ...(effects ? [effects] : []));
    ctx.trace.push({ index, stage: stage.kind, label, at, outputHash, ...(effects ? { effectsHash: effects } : {}), prev, hash });
  }

  /** Where a run's @checkpoint goes; undefined when it doesn't keep one. */
  private checkpointPath(ctx: ExecutionContext): string | undefined {
    if (!findDirective(ctx.pipeline.directives, "checkpoint") || ctx.depth > 0) return undefined;
    return `${this.config.checkpointDir ?? ".halo/checkpoints"}/${ctx.pipeline.name}-${ctx.meta.runId}.json`;
  }

  /** Keep a top-level run's state as it is before `nextStage`, for `continueRun` after a restart. */
  private async saveProgress(ctx: ExecutionContext, nextStage: number): Promise<void> {
    if (ctx.depth > 0 || !this.config.progressStore) return;
    await this.config.progressStore.save(ctx.meta.runId, this.toSnapshot(ctx, nextStage));
  }

  private async writeCheckpoint(ctx: ExecutionContext, nextStage: number): Promise<void> {
    await this.saveProgress(ctx, nextStage);
    const path = this.checkpointPath(ctx);
    if (!path) return;
    ctx.meta.checkpoint = path;
    // Appends to the checkpoint's log, so checkpointing every stage of a long run stays cheap.
    const snap = this.toSnapshot(ctx, nextStage);
    // Sandboxes that changed are saved too, so `halo rewind` to this step gets their files back.
    const sandboxes = await snapshotRemoteSessions(ctx.meta.runId);
    if (Object.keys(sandboxes).length) snap.sandboxes = sandboxes;
    await writeSnapshot(path, snap);
    // And keeps every step, for halo history.
    await appendStep(path, snap);
    this.emit({ type: "checkpoint", runId: ctx.meta.runId, path });
  }

  private emit(event: RuntimeEvent): void {
    if (Object.keys(this.names).length) event = this.displayEvent(event);
    this.config.onEvent?.(event);
    for (const l of this.listeners) l(event);
  }

  /** An event with display names in the fields that name things (never in prompts or outputs). */
  private displayEvent(event: RuntimeEvent): RuntimeEvent {
    const out: Record<string, unknown> = { ...event };
    for (const key of ["pipeline", "agent", "tool", "target", "label", "error", "policy", "primary", "shadow"]) {
      if (typeof out[key] === "string") out[key] = this.displayName(out[key] as string);
    }
    if (out.record && typeof out.record === "object") out.record = this.displayEvent(out.record as RuntimeEvent);
    return out as RuntimeEvent;
  }

  /** Record an answer from outside, under its display name. */
  private record(entry: RecordedCall): void {
    this.config.recorder?.({ ...entry, target: this.displayName(entry.target) });
  }

  /**
   * `|<> loop(Agent, (cond), max: n)`: while the condition holds, jump back to the
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
      throw new LoopLimitError(`loop(${stage.target}) gave up after ${max} ${max === 1 ? "try" : "tries"}: (${stage.condition}) is still true`);
    }
    const to = ctx.pipeline.pipeline.findLastIndex((s, j) => j < index && s.kind === "call" && s.callee === stage.target);
    if (to < 0) throw new HaloError(`loop(${stage.target}, ...) needs an earlier ${stage.target} stage to go back to`, { code: "LOOP_TARGET_NOT_FOUND" });
    // Going back would type (and maybe pay) again: refused, as halo validate refuses it.
    const again = ctx.pipeline.pipeline.slice(to, index).find((st) => st.kind === "call" && this.usesWallet(st.callee));
    if (again) throw new HaloError(`loop(${stage.target}, ...) would run ${(again as CallStage).callee} again, which uses a wallet`, { code: "WALLET_REPEAT" });
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
          this.envSecrets.add(name, value);
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
    // Stored under the name the pipeline wrote (a linked program's callee may be an internal name).
    if (stage.callee !== "System" && !this.isThreadCall(stage.callee)) this.store(ctx, stage.alias ?? stage.callee, stage.method, value);
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

  /** A SQLite call's SQL must be written out, with values in params: (validate says so too; this covers the SDK). */
  private checkSql(tool: ToolDeclaration, stage: CallStage, positional: boolean): void {
    if (!PARAMETERISED_SQL_PROVIDERS.has(tool.provider)) return;
    const problem = sqlArgProblem(stage.argList, positional);
    if (problem) throw new HaloError(`${tool.name}.${stage.method}: ${problem}`, { code: "TOOL_ARGUMENT" });
  }

  private dispatchCall(stage: CallStage, ctx: ExecutionContext): Promise<unknown> {
    if (stage.callee === "System") return this.systemCall(stage, ctx);
    if (this.isThreadCall(stage.callee)) return Promise.resolve().then(() => this.threadCall(stage, ctx));
    const agent = this.agents.get(stage.callee);
    const tool = this.tools.get(stage.callee);
    if (!stage.method || (stage.implicit && !agent && this.pipelines.has(stage.callee))) return this.pipelineCall(stage, ctx);
    if (tool) {
      this.checkSql(tool, stage, true);
      // Values inserted into a shell command are shell-quoted, so they can't run as commands.
      const { positional, named } = this.resolveArgs(stage, ctx, { shell: shellArgs(tool.provider) });
      return this.toolCall(tool, stage.method, positional, named, ctx, false);
    }
    if (agent) return this.agentCall(agent, stage, ctx);
    return Promise.reject(new HaloError(`Unknown callee "${stage.callee}": not an agent, tool, store, or pipeline`));
  }

  private mockFor(...keys: string[]): ((req: MockRequest) => Promise<unknown>) | undefined {
    const mock = this.rawMock(...keys);
    if (mock === undefined) return undefined;
    return async (req) => (typeof mock === "function" ? await (mock as (r: MockRequest) => unknown)(req) : mock);
  }

  /** The mock installed for the first of `keys` that has one, as given to mockAll. */
  private rawMock(...keys: string[]): MockValue | undefined {
    if (!this.mocks) return undefined;
    // Mocks name things as people see them ("Triager.classify"), or by their internal names.
    const key = keys.flatMap((k) => [k, this.displayName(k)]).find((k) => Object.hasOwn(this.mocks!, k));
    return key === undefined ? undefined : this.mocks[key];
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
    const input = estimateTokens(prompt + (system ?? "")) + mediaAllowance(options.media);
    const output = options.maxTokens ?? DEFAULT_MAX_TOKENS;
    const price = this.priceFor(model, input, adapter);
    return price ? costAt(price, input, output) : (adapter?.estimateCost?.(model, input, output) ?? 0);
  }

  /** A model's exact price (halo.json "prices" first, then its adapter's table), or undefined. */
  private priceFor(model: string, inputTokens: number, adapter = this.adapterRegistry.findAdapter(model)) {
    return priceOf(model, inputTokens, adapter, this.config.prices);
  }

  /** Refuse a call under MaxSpend to a model Halo has no price for: the limit couldn't be kept. */
  private refuseUnpriced(agent: Agent, model: string, ctx: ExecutionContext): never {
    const hooks = this.guardHooks(ctx);
    // The MaxSpend rule's policy (and whether it logs), as the guard reports it.
    let policy = "MaxSpend";
    let log = false;
    try {
      this.guard.refuseOverBudget(agent, { ...hooks, onViolation: (v, l) => ((policy = v.policy), (log = !!l)) });
    } catch {
      // Only its policy name was wanted.
    }
    const message = missingPriceMessage(model);
    hooks.onViolation({ policy, rule: "MaxSpend", message, phase: "budget" }, log);
    throw new PolicyViolation(message, policy, "MaxSpend");
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
    const limit = this.limitFor(agent, ctx);
    const adapter = this.adapterRegistry.findAdapter(model);
    // No adapter: the call fails with that error before anything is sent.
    if (limit === undefined || !adapter) return options;
    const inputTokens = estimateTokens(prompt + (system ?? "")) + mediaAllowance(options.media);
    const price = this.priceFor(model, inputTokens, adapter);
    if (!price) this.refuseUnpriced(agent, model, ctx);
    const input = costAt(price, inputTokens, 0);
    const perToken = price.out / 1000;
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

  /** The lowest MaxSpend limit on an agent, plus whatever a person added to this run's budget. */
  private limitFor(agent: Agent, ctx: ExecutionContext): number | undefined {
    const limit = this.guard.spendLimit(agent);
    return limit === undefined ? undefined : limit + (this.topMeta(ctx).budgetAdded ?? 0);
  }

  private guardHooks(ctx: ExecutionContext): PolicyHooks {
    return {
      spent: () => this.spent(ctx),
      added: () => this.topMeta(ctx).budgetAdded ?? 0,
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
    // What the {{placeholders}} in the instructions resolved to: an image named there is sent with the prompt.
    const placed: unknown[] = [];
    const toolArg = stage.argList.find((a) => a.name === "tool");
    const toolName = toolArg ? (toolArg.value.kind === "ref" ? toolArg.value.path.join(".") : String(this.resolveValue(toolArg.value, ctx))) : undefined;
    const shellArg = shellArgs(toolName === undefined ? undefined : this.tools.get(toolName)?.provider);

    for (const a of stage.argList) {
      if (a.name === "tool") {
        continue;
      } else if (a.name && LLM_OPTION_KEYS.has(a.name)) {
        callOptions[a.name] = this.resolveValue(a.value, ctx);
      } else if (!a.name && a.value.kind === "string") {
        const t = this.template(a.value.value, ctx, (v) => (placed.push(v), formatValue(v)));
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
      this.checkSql(tool, stage, false);
      toolResult = await this.toolCall(tool, stage.method, inputs, params, ctx, true);
      this.store(ctx, this.displayName(toolName), stage.method, toolResult);
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
    // Images and documents among what the prompt was built from go with it; the prompt names each by its label.
    // A document a model can't take as a file (Word, a deck, an email, CSV, text) goes as its text, in the
    // prompt, where the agent's Redact and Block rules read it.
    const { media, documents } = await this.filesForPrompt(agent, target, ctx, parts.current, inputs, params, toolResult, placed, retry?.value);
    const prompt = buildPrompt({ ...parts, context: [...feedback, ...documents, ...memory.context] });
    if (!prompt.trim()) throw new HaloError(`${target} has an empty prompt (its arguments and the pipeline value are all empty)`);
    const hooks = this.guardHooks(ctx);
    // A `system:` given on the call can carry pipeline data ("Reply to {{email}}"), so the input
    // policies read it like the prompt. The agent's own `system` is the author's text and is sent as written.
    const callSystem = callOptions.system === undefined ? undefined : this.guard.checkInput(agent, String(callOptions.system), hooks);
    const system = this.withSkills(agent, String(callSystem ?? agent.system ?? agent.params.system ?? agent.params.role ?? "") || undefined, callOptions, ctx);
    const options: LLMOptions = { ...llmOptions(agent.params, callOptions), ...(media.length ? { media } : {}) };

    this.guard.checkBudget(agent, hooks);
    this.guard.checkMedia(agent, media, hooks);
    const user = this.guard.checkInput(agent, prompt, hooks);

    // An agent with tools holds a conversation: it calls tools until it answers. A run paused
    // for approval of one of its calls picks that conversation up where it stopped.
    const toolNames = this.toolset(agent, stage, callOptions);
    const session = ctx.sessions?.[ctx.stageIndex];
    if (session) delete ctx.sessions![ctx.stageIndex];
    const kit = toolNames.length ? await this.toolKit(agent, toolNames, ctx) : undefined;
    const opening = (): LLMMessage[] => [...(system ? [{ role: "system" as const, content: system }] : []), { role: "user", content: user, ...(media.length ? { media } : {}) }];
    let conversation: LLMMessage[] | undefined = kit ? (session?.messages ?? opening()) : undefined;
    let steps: { done: number; pending?: LLMToolCall[] } = { done: session?.step ?? 0, pending: session?.pending };

    if (!session) this.startShadows(agent, stage.method, user, system, options, ctx);
    const corrections = this.correctLimit(ctx, agent);
    // @cascade(m2, m3, ...): the agent's own model first, then each bigger one in turn when a call fails,
    // an output policy rejects the answer (after any @correct tries), or the answer misses the pipeline's schema.
    const tiers = this.cascadeTiers(agent);
    // The answer becomes the pipeline's output: under a cascade, hold it to the declared `-> Type` here, while a bigger model can still try.
    const last = ctx.pipeline.pipeline.at(-1) === stage;
    for (let tier = Math.min(session?.tier ?? 0, tiers.length - 1); ; tier++) {
      const model = tiers[tier]!;
      // `Agent@model` (or `Agent.method@model`) mocks one model of the cascade; otherwise the agent's own mock answers.
      const mockKeys = tier === 0 ? [target, agent.name, "*"] : [`${target}@${model}`, `${agent.name}@${model}`, target, agent.name, "*"];
      let ask = user;
      try {
        for (let attempt = 0; ; attempt++) {
          const { value, tokens } = kit
            ? await this.converse(agent, model, mockKeys, target, stage, ctx, kit, conversation!, steps, system, options, callOptions)
            : await this.complete(agent, model, target, mockKeys, ask, system, options, stage, ctx);
          try {
            const checked = this.guard.checkOutput(agent, value, hooks, { completionTokens: tokens?.completion });
            if (last && tier < tiers.length - 1) this.checkSchema(ctx.pipeline, checked);
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
            // The rejected answer goes back as input: redacted, and withheld if a Block rule would stop it.
            const previous = formatValue(this.guard.forLog(agent, value));
            ask = `${user}\n\nYour previous answer was rejected by policy "${err.policy}": ${err.message}\nAnswer again, fixing that problem.\n\nPrevious answer:\n${previous}`;
            // A conversation with tools continues: the agent keeps what its tools told it.
            conversation?.push({ role: "user", content: `Your answer was rejected by policy "${err.policy}": ${err.message}\nAnswer again, fixing that problem.` });
          }
        }
      } catch (err) {
        // A run paused for approval mid-conversation resumes on the model that was answering.
        if (err instanceof Pause || isAuthRequired(err)) {
          const paused = ctx.sessions?.[ctx.stageIndex];
          if (paused && tier > 0) paused.tier = tier;
          throw err;
        }
        if (tier >= tiers.length - 1 || !this.escalates(err, ctx)) throw err;
        const next = tiers[tier + 1]!;
        const error = err instanceof Error ? err.message : String(err);
        if (err instanceof PolicyViolation) {
          const v = ctx.meta.violations.findLast((x) => x.policy === err.policy && x.rule === err.rule && !x.corrected && !x.escalated);
          if (v) v.escalated = true;
        }
        (ctx.meta.escalations ??= []).push({ target, from: model, to: next, error });
        this.emit({ type: "escalate", pipeline: ctx.pipeline.name, runId: ctx.meta.runId, target, from: model, to: next, error });
        this.logger.log(`[Cascade] ${target}: ${model} -> ${next} (${error})`);
        // The next model starts the conversation over: it sees the task, not the lower model's tool calls.
        if (kit) {
          conversation = opening();
          steps = { done: 0, pending: undefined };
        }
      }
    }
  }

  /** The models an agent's calls go through: its own, then each `@cascade` model, in order. */
  private cascadeTiers(agent: Agent): string[] {
    const more = directiveArgs(findDirective(agent.directives, "cascade")).filter(Boolean);
    return [agent.modelId, ...more.map((m) => this.agents.get(m)?.modelId ?? m)];
  }

  /** Whether `@cascade` should try a bigger model after this failure. A spent budget, a stopped run, or a loop limit never moves up. */
  private escalates(err: unknown, ctx: ExecutionContext): boolean {
    if (ctx.signal.aborted || err instanceof Pause || err instanceof LoopLimitError || isAuthRequired(err)) return false;
    if (err instanceof PolicyViolation && err.rule === "MaxSpend") return false;
    return true;
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
          ? await info.methods({ tool, config: this.toolConfig(tool, ctx).config, signal: ctx.signal }, this.toolServices(ctx))
          : undefined;
      if (!methods?.length) {
        throw new HaloError(`Tool "${name}" (${tool.provider}) doesn't describe its methods, so an agent can't choose to call it; register the provider with its info (registerToolProvider(name, provider, info))`, { code: "TOOL_CONFIG" });
      }
      for (const method of methods) {
        const target = `${name}.${method.name}`;
        // Function names allow letters, digits, _ and - (64 at most), so "Repo.create_pr" becomes "Repo__create_pr".
        const shown = this.displayName(name);
        let fn = `${shown}__${method.name}`.replace(/[^\w-]/g, "_").slice(0, 64);
        for (let i = 2; kit.byName.has(fn); i++) fn = `${fn.slice(0, 60)}_${i}`;
        const entry = { tool, method, target };
        kit.byName.set(fn, entry);
        kit.byName.set(target, entry);
        if (shown !== name) kit.byName.set(`${shown}.${method.name}`, entry);
        // A method its policies hide isn't offered; a model that calls it anyway is refused by checkToolCall.
        if (!this.guard.toolVisible(agent, target, method.effect)) continue;
        kit.offered.push(this.displayName(target));
        const about = info?.description ? `${shown} (${info.description}): ${method.description}` : `${shown}: ${method.description}`;
        kit.specs.push({ name: fn, description: about.slice(0, 1024), parameters: shownParams(tool, method.params) });
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
    model: string,
    mockKeys: string[],
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
      // Every image in the conversation is sent again with each request, so each counts toward its cost.
      const carried = messages.flatMap((m) => (m.role === "user" || m.role === "tool" ? (m.media ?? []) : []));
      const r = await this.complete(agent, model, target, mockKeys, estimate, system, { ...options, media: carried.length ? carried : undefined }, stage, ctx, "agent", turn);
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
      const media: MediaRef[] = [];
      try {
        content = await this.agentTool(agent, kit, call, ctx, hooks, resultChars, media);
      } catch (err) {
        // Keep the conversation and the calls still to run, so approving (or connecting) picks up right here.
        const connecting = isAuthRequired(err) && ctx.depth === 0 && !ctx.branch;
        if ((err instanceof Pause && err.waitingFor === "approval") || connecting) {
          (ctx.sessions ??= {})[ctx.stageIndex] = { messages: copy(messages), pending: calls.slice(i), step: steps.done };
        }
        throw err;
      }
      messages.push({ role: "tool", toolCallId: call.id, name: call.name, content, ...(media.length ? { media } : {}) });
    }
  }

  /** Run one tool call an agent asked for, and say what happened in words the model can act on. */
  private async agentTool(agent: Agent, kit: ToolKit, call: LLMToolCall, ctx: ExecutionContext, hooks: PolicyHooks, resultChars: number, media: MediaRef[] = []): Promise<string> {
    const entry = kit.byName.get(call.name);
    const report = (decision: Extract<RuntimeEvent, { type: "agent_tool" }>["decision"], detail?: string) =>
      this.emit({ type: "agent_tool", pipeline: ctx.pipeline.name, runId: ctx.meta.runId, agent: agent.name, target: entry?.target ?? call.name, args: this.guard.forLog(agent, call.args), decision, detail });
    if (!entry) {
      report("error", "no such tool");
      return `Error: there is no tool named "${call.name}". You can call: ${kit.specs.map((spec) => spec.name).join(", ")}.`;
    }
    let check: ReturnType<PolicyEngine["checkToolCall"]>;
    let args: unknown;
    try {
      check = this.guard.checkToolCall(agent, entry.target, entry.method.effect, call.args, hooks);
      // The call is part of the agent's answer: its Redact rules mask the arguments and its Block rules refuse them.
      args = this.guard.checkToolArgs(agent, entry.target, call.args, hooks);
    } catch (err) {
      if (!(err instanceof PolicyViolation)) throw err;
      report("refused", err.message);
      return `Refused by policy "${err.policy}": ${err.message}. Don't try this call again.`;
    }
    // A file the agent names by its label (or short id) is that file, if the run holds it.
    try {
      args = filesFromLabels(args, this.topMeta(ctx).media ?? []);
    } catch (err) {
      if (!(err instanceof MediaError)) throw err;
      report("refused", err.message);
      return `Refused: ${err.message}.`;
    }
    // The tool's own rules (Fixed, Match, Locked) hold whatever the agent's policies say.
    try {
      args = constrain(entry.tool, entry.method.name, isPlainObject(args) ? args : {}, true, (v) => this.resolveValue(v, ctx, { allowEnv: true, owner: entry.tool.name }));
    } catch (err) {
      if (!(err instanceof ToolRuleViolation)) throw err;
      const v: Violation = { policy: entry.tool.name, rule: err.rule, message: err.message, phase: "tool" };
      ctx.meta.violations.push(v);
      this.emit({ type: "violation", runId: ctx.meta.runId, ...v });
      report("refused", err.message);
      return `Refused by the tool's rules: ${err.message}. Don't try this call again.`;
    }
    let decision: "allowed" | "approved" = "allowed";
    // A browser with a wallet asks a person itself, about exactly the element and page it checked:
    // a policy's approval is folded into that question, so the person is asked once, after the checks.
    const wallet: WalletLimits | undefined = walletNames(entry.tool)
      ? { ...walletLimits(agent.requires, this.policies), agent: agent.name, ...(check !== "allow" ? { policyApproval: check.approve } : {}) }
      : undefined;
    if (check !== "allow" && !wallet) {
      const answer = await this.approval(agent, entry.target, args, check.approve, ctx);
      if (!isApproval(answer)) {
        const reason = declineReason(answer);
        report("declined", reason.slice(2) || undefined);
        return `A person declined this call${reason}. Don't try it again; finish without it, or say what you need.`;
      }
      decision = "approved";
    }
    let result: unknown;
    try {
      result = await this.toolCall(entry.tool, entry.method.name, [], args as Record<string, unknown>, ctx, true, agent.name, wallet);
    } catch (err) {
      // A connection that needs a person pauses the run; the model never sees why.
      if (ctx.signal.aborted || err instanceof Pause || isAuthRequired(err)) throw err;
      // A wallet value may have gone somewhere it shouldn't: the run stops, rather than the model carrying on.
      if (err instanceof HaloError && err.code === "WALLET_INCIDENT") throw err;
      const message = err instanceof Error ? err.message : String(err);
      if (err instanceof HaloError && err.code === "APPROVAL_DECLINED") {
        report("declined", message);
        return `${message}. Don't try it again; finish without it, or say what you need.`;
      }
      report("error", message);
      return `Error: ${message}`;
    }
    if (wallet?.policyApproval) decision = "approved";
    report(decision);
    result = this.withoutGuardedMatches(agent, result);
    // Images and documents in the result go to the model with it, if the agent's policies allow them.
    const files = collectMedia(result).filter((m) => this.holds(ctx, m.sha256));
    const refused = this.guard.mediaRefusal(agent, files);
    if (!refused) media.push(...files);
    const text = clip(typeof result === "string" ? result : compactJson(result), resultChars) + (refused ? `\n[not shown: ${refused.message}]` : "");
    // A tool result is input to the model: the agent's input policies redact or withhold it.
    try {
      return this.guard.checkInput(agent, text, hooks);
    } catch (err) {
      if (!(err instanceof PolicyViolation)) throw err;
      return `[withheld: this result was blocked by policy "${err.policy}": ${err.message}]`;
    }
  }

  /**
   * A search result (`{ matches: [{ text }] }`, from Workspace.search or Git.grep) without the
   * lines the agent's Redact or Block rules would touch. Showing such a line redacted still says it
   * matched, and a model can rebuild a secret from match / no match one character at a time.
   */
  private withoutGuardedMatches(agent: Agent, result: unknown): unknown {
    if (!isPlainObject(result) || !Array.isArray(result.matches) || !this.guard.hasContentRules(agent)) return result;
    const matches = result.matches as unknown[];
    const kept = matches.filter((m) => !(isPlainObject(m) && typeof m.text === "string" && this.guard.guardsText(agent, m.text)));
    if (kept.length === matches.length) return result;
    return { ...result, matches: kept };
  }

  /**
   * Ask a person whether an agent may make a tool call: onInterrupt (the CLI asks in the
   * terminal), else pause the run until `signal(runId, "approval", answer)`. The answer to
   * a paused run is waiting in ctx.approvals when the stage runs again.
   */
  private async approval(agent: Agent, target: string, args: unknown, policy: string, ctx: ExecutionContext): Promise<unknown> {
    const message = `Allow ${agent.name} to call ${target} with ${clip(formatValue(this.guard.forLog(agent, args)), 2000)}? (policy ${policy})`;
    const key = `tool:${target}:${sha256(safeJson(args)).slice(0, 16)}`;
    return this.ask(ctx, { target, key, message, attachments: [args], named: { target, args, policy, agent: agent.name } }, agent.name, `${agent.name} needs approval to call ${target} (policy ${policy})`);
  }

  /**
   * Put a question to a person: the answer already given to this exact request when the run paused
   * (by key), a mock, onInterrupt, or a pause. Only a top-level stage that is itself the call (an
   * agent stage, or a tool stage for a provider's own question) can stop and pick up again.
   */
  private async ask(
    ctx: ExecutionContext,
    req: { target: string; key: string; message: string; attachments: unknown[]; named: Record<string, unknown>; wallet?: { mock: boolean } },
    owner: string,
    needs: string,
  ): Promise<unknown> {
    const recorded = (answer: unknown) => (this.record({ kind: "approval", target: req.target, value: answer }), answer);
    const i = ctx.stageIndex;
    if (ctx.approvals && Object.hasOwn(ctx.approvals, i)) {
      // An answer releases only the request it was given to (a pause from before keys existed had none).
      const k = ctx.approvalKeys?.[i];
      if (k === undefined || k === req.key) {
        const answer = ctx.approvals[i];
        delete ctx.approvals[i];
        if (ctx.approvalKeys) delete ctx.approvalKeys[i];
        return recorded(answer);
      }
    }
    const named = { ...req.named, ...(req.wallet ? { wallet: req.wallet } : {}) };
    const mock = this.mockFor(req.target + "?", "approval");
    // A wallet approval is a person's: a mock answers it only for the mock source.
    if (mock && (!req.wallet || req.wallet.mock)) return recorded(await mock({ target: req.target, kind: "approval", prompt: req.message, args: req.attachments, named, input: ctx.current }));
    const interrupt: InterruptRequest = { pipeline: ctx.pipeline.name, message: req.message, channel: "approval", attachments: req.attachments, args: [], named, current: ctx.current, context: this.snapshot(ctx) };
    if (this.config.onInterrupt) return recorded(await raceAbort(Promise.resolve(this.config.onInterrupt(interrupt)), ctx.signal));
    const stage = ctx.pipeline.pipeline[i];
    const own = stage?.kind === "call" && stage.callee === owner;
    if (ctx.depth > 0 || !own || ctx.branch) {
      throw new HaloError(`${needs}, but this stage can't pause (it's inside a called pipeline, fan-out, each, or branch); register runtime.onInterrupt(...)`, { code: "APPROVAL_NEEDED" });
    }
    throw new Pause("approval", req.message, req.key);
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
      // A mocked store is skipped (a canned answer isn't a list of hits), except under replay, which answers the search the run made.
      const storeMock = this.rawMock(`${name}.search`, name);
      if (tool.provider === "VectorStore" && query && (storeMock === undefined || (typeof storeMock === "function" && (storeMock as { replay?: boolean }).replay))) {
        const found = await this.toolCall(tool, "search", [query], { limit: 3, min_score: 0.1 }, ctx, true);
        const hits = Array.isArray(found) ? (found as Array<{ content: unknown }>) : [];
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
    const fingerprint = requestFingerprint(model, prompt, system, options, turn);
    const raw = this.rawMock(...mockKeys);
    let mock = this.mockFor(...mockKeys);
    let req: MockRequest | undefined;
    const mockRequest = (): MockRequest => {
      if (req) return req;
      const { positional, named } = stage ? this.resolveArgs(stage, ctx, { skip: LLM_OPTION_KEYS }) : { positional: [], named: {} };
      req = { target, kind: "agent", prompt: turn ? turn.shown : prompt, system, args: positional, named, input: ctx.current, model, fingerprint };
      if (options.media?.length) req.media = options.media;
      if (turn) Object.assign(req, { tools: turn.targets, messages: turn.messages, step: turn.step });
      return req;
    };
    // A mock can send this call to the model for real (replay --live-changed, for a request that changed).
    const live = typeof raw === "function" ? (raw as { live?: LiveCheck }).live : undefined;
    if (mock && live?.(mockRequest())) mock = undefined;
    const flight = this.flight(ctx);
    let reserve = 0;
    if (mock) flight.calls++;
    else ({ options, reserve } = await this.reserveCall(agent, model, prompt, system, options, ctx));
    let outcome;
    try {
      outcome = await this.withPolicies(ctx, target, agent, async (signal) => {
        if (mock) {
          const value = await mock(mockRequest());
          // A mock that calls tools returns useTool(...) (or a list of them).
          const uses = (Array.isArray(value) ? value : [value]).filter((v): v is ToolUse => v instanceof ToolUse);
          if (turn && uses.length) {
            const toolCalls = uses.map((u, i) => ({ id: `mock_${turn.step}_${i}`, name: u.target, args: u.args }));
            return { value: "" as unknown, model, cost: 0, tokens: undefined, mocked: true, toolCalls, rawMessage: undefined };
          }
          return { value, model, cost: 0, tokens: undefined, mocked: true, toolCalls: undefined, rawMessage: undefined };
        }
        const r = await this.callLLM(model, prompt, system, options, signal, turn);
        return { value: r.text as unknown, model: r.model, cost: r.cost, tokens: r.tokens, mocked: false, toolCalls: r.toolCalls, rawMessage: r.rawMessage, priced: r.priced };
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
    // A call to a model with no price was counted at a rough estimate: say so.
    const unpriced = (result as { priced?: false }).priced === false ? { priced: false as const } : {};
    ctx.meta.cost += result.cost;
    if (ctx.parent) this.unsettle(ctx, result.cost);
    if (result.tokens) {
      ctx.meta.tokens.prompt += result.tokens.prompt;
      ctx.meta.tokens.completion += result.tokens.completion;
    }
    ctx.meta.calls.push({ pipeline: this.displayName(ctx.pipeline.name), stage: ctx.stageIndex, target: this.displayName(target), kind, model: result.model, latencyMs, cost: result.cost, tokens: result.tokens, attempts, mocked: result.mocked, ...unpriced });
    const value = typeof result.value === "string" ? parseOutput(result.value) : result.value;
    const toolCalls = result.toolCalls;
    if (kind !== "shadow") this.record({ kind: "agent", target, value: result.value, ...(toolCalls?.length ? { toolCalls: toolCalls.map((c) => ({ name: c.name, args: c.args })) } : {}), fingerprint, cost: result.cost });
    if (kind !== "shadow") {
      // Telemetry keeps what the agent's policies let out: redacted, or withheld if blocked.
      const shown = this.guard.forLog(agent, value);
      const text = shown === value ? result.value : formatValue(shown);
      if (typeof result.value === "string" && result.value) this.emit({ type: "token", pipeline: ctx.pipeline.name, runId: ctx.meta.runId, target, text: typeof text === "string" ? text : formatValue(text) });
      const output = toolCalls?.length ? { ...(result.value ? { text: shown } : {}), toolCalls: toolCalls.map((c) => ({ name: c.name, args: this.guard.forLog(agent, c.args) })) } : shown;
      this.emit({ type: "llm", pipeline: ctx.pipeline.name, runId: ctx.meta.runId, agent: agent.name, model: result.model, system, prompt: turn ? turn.shown : prompt, ...(options.media?.length ? { media: options.media } : {}), output, latencyMs, cost: result.cost, tokens: result.tokens, mocked: result.mocked, ...unpriced });
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
      // A shadow agent also gets its own policies' redactions on top of the primary's.
      const shadowPrompt = run.agent === primary ? prompt : this.guard.redactOnly(run.agent, prompt);
      // A shadow agent with its own Block or Redact rules sees media only if its policies allow it.
      const refused = run.agent !== primary && options.media?.length ? this.guard.mediaRefusal(run.agent, options.media) : undefined;
      const task = (refused ? Promise.reject(new Error(refused.message)) : this.complete(run.agent, run.model, label, run.mockKeys, shadowPrompt, system, { ...llmOptions(run.agent.params, {}), ...options }, undefined, ctx, "shadow")).then(
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
    const envKey = adapter.envKeys?.find((k) => this.env[k]);
    const fromEnv = envKey ? this.env[envKey] : undefined;
    const key = this.config.apiKeys?.[adapter.id] ?? fromEnv ?? this.config.apiKey ?? this.env.HALO_API_KEY ?? undefined;
    // An error body that quotes the key back is masked like a tool's.
    if (key) this.envSecrets.add(key === fromEnv && envKey ? envKey : `${adapter.id.toUpperCase()}_API_KEY`, key);
    return key;
  }

  /** Whether a model has an adapter and the key it needs. */
  canCallModel(modelId: string): boolean {
    return this.isModelAvailable(modelId);
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
        const routed = await this.router.route(model, Math.ceil(prompt.length / 4) + mediaAllowance(options.media), options.maxTokens ?? 1024, undefined, (id) => this.isModelAvailable(id));
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
      throw new HaloError(`No API key set for ${adapter.id} (model "${model}"). Set ${vars}, or pass apiKey in RuntimeConfig.`, { code: "NO_API_KEY" });
    }

    if (turn?.tools.length && adapter.supportsTools === false) {
      throw new HaloError(`${adapter.id} models can't call tools (model "${model}"); give this agent a model that can, or remove its tools`, { code: "TOOL_CONFIG" });
    }
    const request: LLMRequest = {
      model,
      messages: await this.withMedia(adapter, model, turn ? turn.messages : [...(system ? [{ role: "system" as const, content: system }] : []), { role: "user" as const, content: prompt, ...(options.media?.length ? { media: options.media } : {}) }], apiKey, signal),
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
      throw this.envSecrets.maskError(new HttpError(`LLM API error from ${adapter.id} (${res.status}): ${body.slice(0, 500)}`, res.status, body));
    }
    const parsed = adapter.parseResponse(await res.json());
    const tokens = { prompt: parsed.usage?.promptTokens ?? 0, completion: parsed.usage?.completionTokens ?? 0 };
    // What the provider says it billed, else the model's price, else (no price) a rough estimate.
    const price = parsed.cost === undefined ? this.priceFor(model, tokens.prompt, adapter) : undefined;
    const priced = parsed.cost !== undefined || !!price;
    const cost = parsed.cost ?? (price ? costAt(price, tokens.prompt, tokens.completion) : (adapter.estimateCost?.(model, tokens.prompt, tokens.completion) ?? 0));
    this.costTracker.recordUsage(model, cost);
    return { text: parsed.text, model, cost, tokens, toolCalls: parsed.toolCalls, rawMessage: parsed.rawMessage, ...(priced ? {} : { priced: false as const }) };
  }

  /**
   * The messages with each image and document's bytes attached, for the request being built.
   * This is the only place bytes are read: a mocked or replayed call never needs them.
   */
  /** Files uploaded to a provider's own store, by provider and hash, so a file goes up once (they are kept about two days). */
  private uploads = new Map<string, { uri: string; at: number }>();

  private async withMedia(adapter: ProviderAdapter, model: string, messages: LLMMessage[], apiKey?: string, signal?: AbortSignal): Promise<LLMMessage[]> {
    if (!messages.some((m) => (m.role === "user" || m.role === "tool") && m.media?.length)) return messages;
    // Most APIs take files only in user turns: a run of tool results is followed by one user turn with theirs.
    const moved: LLMMessage[] = [];
    for (const [i, m] of messages.entries()) {
      moved.push(m.role === "tool" && m.media ? { ...m, media: undefined } : m);
      if (m.role !== "tool" || messages[i + 1]?.role === "tool") continue;
      let from = i;
      while (messages[from - 1]?.role === "tool") from--;
      const files = collectMedia(messages.slice(from, i + 1).map((x) => (x.role === "tool" ? x.media : undefined))) as LLMMedia[];
      if (files.length) moved.push({ role: "user", content: `The tool results above refer to ${files.length === 1 ? "this file" : "these files"}.`, media: files });
    }
    messages = moved;
    const loaded = new Map<string, string>();
    const load = async (m: MediaRef): Promise<LLMMedia> => {
      const kind = kinds(m.$media);
      const limit = adapter.input?.[m.type];
      if (limit === undefined) {
        const reads = Object.keys(adapter.input ?? {});
        throw new MediaError(`${adapter.id} models can't be sent ${reads.length ? `${m.type} ${kind}` : kind} (model "${model}", ${mediaLabel(m)})${reads.length ? `; it takes ${reads.join(", ")}` : ""}. Give this agent a model that reads them`, "MEDIA_UNSUPPORTED");
      }
      if (m.size > limit) throw new MediaError(`${mediaLabel(m)} is ${megabytes(m.size)}; ${adapter.id} takes ${kind} up to ${megabytes(limit)}`, "MEDIA_TOO_LARGE");
      // A link (YouTube) is sent as it is.
      if (m.url) return { ...m };
      // Too large to send inline: uploaded to the provider's own store, once, and sent by reference.
      if (adapter.upload && adapter.inlineLimit !== undefined && m.size > adapter.inlineLimit) {
        const key = `${adapter.id}:${m.sha256}`;
        const kept = this.uploads.get(key);
        if (kept && Date.now() - kept.at < 40 * 3600_000) return { ...m, fileUri: kept.uri };
        const bytes = await this.blobs.get(m.sha256);
        if (!bytes) throw new MediaError(`The bytes of ${mediaLabel(m)} are not on this machine, so it can't be sent to ${model}`, "MEDIA_MISSING");
        const uri = await adapter.upload(m, bytes, { apiKey: apiKey ?? "", fetch: this.fetch, signal });
        this.uploads.set(key, { uri, at: Date.now() });
        return { ...m, fileUri: uri };
      }
      let data = loaded.get(m.sha256);
      if (data === undefined) {
        const bytes = await this.blobs.get(m.sha256);
        if (!bytes) throw new MediaError(`The bytes of ${mediaLabel(m)} are not on this machine, so it can't be sent to ${model}`, "MEDIA_MISSING");
        loaded.set(m.sha256, (data = Buffer.from(bytes).toString("base64")));
      }
      return { ...m, data };
    };
    return Promise.all(messages.map(async (m) => (m.role === "user" && m.media?.length ? { ...m, media: await Promise.all(m.media.map(load)) } : m)));
  }

  /** The wallet items a browser's `wallet:` names, checked against the program and where it runs. */
  private walletItems(names: string[], ctx: ExecutionContext): WalletItem[] {
    const problem = walletProgramProblem(this.tools.values());
    if (problem) throw new HaloError(problem, { code: "TOOL_CONFIG" });
    this.walletFolders(ctx);
    return names.map((name) => {
      const t = this.tools.get(name);
      if (!t || t.provider !== "Vault") throw new HaloError(`wallet: "${name}" is not a Vault tool declared in this program`, { code: "TOOL_CONFIG" });
      const item = walletItem(name, this.toolConfig(t, ctx).config);
      if (this.config.serving && !item.serve) {
        throw new HaloError(`${name} can't be used while Halo serves pipelines to others (halo serve, halo mcp): anyone who can start a run could use it. Declare it with serve: true if that's intended`, { code: "TOOL_CONFIG" });
      }
      if (item.source === "env") {
        const file = dotenvWithWallet(process.cwd());
        if (file) throw new HaloError(`${file} holds HALO_WALLET_ values. Bun loads it, and file tools can read it: set them in the environment Halo starts with instead`, { code: "TOOL_CONFIG" });
      }
      return item;
    });
  }

  /**
   * A program with a wallet: a folder a tool reaches (Workspace, a sandbox's from:) must really be
   * inside the project, even when it's written as "./docs" and is a link. Checked before every run.
   */
  private walletFolders(ctx: ExecutionContext): void {
    if (![...this.tools.values()].some((t) => walletNames(t))) return;
    // A folder written as "./docs" can still be a link out of the project: check where it really is.
    const project = realpathSync(process.cwd());
    for (const t of this.tools.values()) {
      const keys: Array<string | number> = t.provider === "Workspace" ? [0, "root"] : t.provider === "Remote" ? ["from", "root"] : [];
      for (const k of keys) {
        const v = this.toolConfig(t, ctx).config(k) ?? (t.provider === "Workspace" && k === 0 ? "." : undefined);
        if (typeof v !== "string") continue;
        let real: string;
        try {
          real = realpathSync(resolve(project, v));
        } catch {
          continue;
        }
        if (real !== project && !real.startsWith(project + sep)) {
          throw new HaloError(`Tool "${t.name}" reaches ${real}, outside the project, so it can't be in the same program as a wallet`, { code: "TOOL_CONFIG" });
        }
      }
    }
  }

  /** Whether a call's callee can type from a wallet: a browser with one, an agent that equips one, or a pipeline that uses either. */
  private usesWallet(callee: string, seen = new Set<string>()): boolean {
    const tool = this.tools.get(callee);
    if (tool) return !!walletNames(tool);
    const agent = this.agents.get(callee);
    if (agent) return (agent.equips ?? []).some((e) => { const t = this.tools.get(e); return !!t && !!walletNames(t); });
    const p = this.pipelines.get(callee);
    if (!p || seen.has(callee)) return false;
    seen.add(callee);
    return p.pipeline.some((st) => (st.kind === "call" ? [st] : st.kind === "fanout" ? st.stages : st.kind === "each" ? [st.call] : st.kind === "branch" ? st.arms.map((a) => a.call) : []).some((c) => this.usesWallet(c.callee, seen)));
  }

  /** Report a wallet event: telemetry, and the audit log when there is one. */
  private walletEvent(ctx: ExecutionContext, e: WalletEvent): void {
    const at = new Date().toISOString();
    this.emit({ type: "wallet", pipeline: ctx.pipeline.name, runId: ctx.meta.runId, at, ...e });
    const path = this.config.walletLog;
    if (!path) return;
    try {
      mkdirSync(dirname(path), { recursive: true });
      appendFileSync(path, `${JSON.stringify({ at, run: ctx.meta.runId, pipeline: ctx.pipeline.name, ...e })}\n`, { mode: 0o600 });
    } catch (err) {
      this.logger.warn(`Could not write the wallet log ${path}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private toolServices(ctx: ExecutionContext, tool?: ToolDeclaration, chosenBy?: string, method?: string): ToolServices {
    return {
      fetch: this.fetch,
      env: this.env,
      serving: this.config.serving === true,
      wallet: (names) => this.walletItems(names, ctx),
      approve: (req: ToolApprovalRequest) => {
        if (!tool) throw new HaloError("approve() is for a tool call", { code: "TOOL_CONFIG" });
        const target = method ? `${tool.name}.${method}` : tool.name;
        // The stage that can pause for it is the agent's, when an agent chose the call; else the tool stage itself.
        return this.ask(ctx, { target, key: req.key, message: req.message, attachments: [], named: req.named, ...(req.wallet ? { wallet: req.wallet } : {}) }, chosenBy ?? tool.name, `${tool.name} needs a person's approval`);
      },
      walletEvent: (e: WalletEvent) => this.walletEvent(ctx, e),
      oauth: {
        broker: this.broker,
        project: this.projectRoot,
        connection: (t) => this.connectionFor(t, ctx),
        // A token is masked wherever the run's output goes, like a key read from Env.
        secret: (name, value) => this.envSecrets.add(name, value),
      },
      progress: (p) => {
        if (tool) this.emit({ type: "tool_progress", pipeline: ctx.pipeline.name, runId: ctx.meta.runId, tool: tool.name, method: method ?? "", ...p });
      },
      spend: (usd) => {
        if (!(usd > 0)) return;
        ctx.meta.cost += usd;
        if (ctx.parent) this.unsettle(ctx, usd);
      },
      media: async (ref) => {
        const label = isMediaRef(ref) ? mediaLabel(ref) : `#${String(ref.sha256).slice(0, 6)}`;
        if (!this.holds(ctx, ref.sha256)) throw new MediaError(`${label} is not a file this run was given or made`, "MEDIA_UNKNOWN");
        const bytes = await this.blobs.get(ref.sha256);
        if (!bytes) throw new MediaError(`The bytes of ${label} are not on this machine`, "MEDIA_MISSING");
        return bytes;
      },
      vectors: () => (this.vectorStore ??= new LocalVectorStore(this.config.vectorPath ?? ".halo/vectors.sqlite")),
      sql: (url) => {
        let db = this.sqlPool.get(url);
        if (!db) this.sqlPool.set(url, (db = new Bun.SQL(url)));
        return db;
      },
    };
  }

  private get broker(): TokenBroker {
    return this.config.broker ?? defaultBroker();
  }

  private get projectRoot(): string {
    return this.config.projectRoot ?? process.cwd();
  }

  /**
   * The OAuth connection a tool's `auth:` names, built from that `OAuth(...)` declaration (its Env
   * settings read now, so a resumed run sees today's values). Undefined for a tool without `auth:`.
   */
  private connectionFor(tool: ToolDeclaration, ctx: ExecutionContext): OAuthConnection | undefined {
    const name = authName(tool);
    if (name === undefined) return undefined;
    return this.oauthConnection(name, ctx, tool.name);
  }

  /** The connection an `OAuth(...)` declaration describes, by its name. */
  private oauthConnection(name: string, ctx: ExecutionContext, user?: string): OAuthConnection {
    const decl = this.tools.get(name);
    if (!decl || decl.provider !== "OAuth") {
      throw new HaloError(`${user ? `Tool "${this.displayName(user)}": auth: ` : ""}${this.displayName(name)} is not an OAuth declaration (declare it with tool ${this.displayName(name)} : OAuth(provider: ..., clientId: ...))`, { code: "TOOL_CONFIG" });
    }
    const { config } = this.toolConfig(decl, ctx);
    return connectionFrom(this.displayName(name), (k) => config(k), this.projectRoot);
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

  /**
   * A provider's result (or error) with every environment value the runtime read masked, before
   * a retry event, the model, a recording or the terminal sees it. Masked inside the retry loop,
   * so even the retry events carry no secret.
   */
  private async unechoed<T>(call: () => Promise<T>): Promise<T> {
    try {
      return this.envSecrets.maskDeep(await call());
    } catch (e) {
      throw this.envSecrets.maskError(e);
    }
  }

  /** Call a tool. `chosenBy` names the agent that chose the call: its arguments are all it gets (never the pipeline value). */
  private async toolCall(tool: ToolDeclaration, method: string, positional: unknown[], named: Record<string, unknown>, ctx: ExecutionContext, viaAgent: boolean, chosenBy?: string, wallet?: WalletLimits): Promise<unknown> {
    const target = `${tool.name}.${method}`;
    // A call an agent chose was checked against the tool's rules before anyone was asked to approve it.
    if (chosenBy === undefined) named = constrain(tool, method, named, false, (v) => this.resolveValue(v, ctx, { allowEnv: true, owner: tool.name }));
    const implicitInput = chosenBy === undefined && !positional.length && ctx.current !== undefined;
    const args = implicitInput ? [ctx.current] : positional;
    const { config, template0 } = this.toolConfig(tool, ctx);

    const t0 = performance.now();
    const fingerprint = toolFingerprint(target, args, named);
    const top = this.topMeta(ctx);
    // The same call, with the same arguments, at the same step of the same run always gets the same key,
    // whether it is a retry, a stage run again after a restart, or a model asking twice.
    const idempotencyKey = `halo_${sha256(top.idempotencyKey ?? top.runId, ctx.pipeline.name, String(ctx.stageIndex), fingerprint).slice(0, 40)}`;
    const mock = this.mockFor(target, tool.name);
    const provider = this.providers.get(tool.provider);
    if (!mock && !provider) throw new HaloError(`Unknown tool provider "${tool.provider}" for tool "${tool.name}" (register it with runtime.registerToolProvider)`);

    const { result, attempts } = await this.withPolicies(ctx, target, undefined, async (signal) =>
      mock
        ? { value: await mock({ target, kind: "tool", args, named, input: ctx.current, fingerprint }), mocked: true }
        : {
            value: await this.unechoed(() =>
              provider!(
                { tool, method, positional: args, implicitInput, named, config, template0, viaAgent, signal, runId: top.runId, branch: ctx.branch, pauses: top.pauses ?? 0, idempotencyKey, ...(wallet ? { wallet } : {}) },
                this.toolServices(ctx, tool, chosenBy, method),
              ),
            ),
            mocked: false,
          },
    );
    // Files in the result are stored and replaced by references, before anything records or hashes it.
    result.value = await adoptMedia(result.value, (bytes, name) => this.mintFor(ctx, bytes, { name }));
    // A mock (and a replay, which answers from a recording) is the author's own: its references are this run's.
    if (result.mocked) for (const ref of collectMedia(result.value)) this.admit(ctx, ref);
    (ctx.effects ??= []).push(sha256(target, fingerprint, safeJson(result.value)));
    // A sandbox's egress allowlist refused hosts: a policy violation, like a refused tool call.
    const blocked = tool.provider === "Remote" && isPlainObject(result.value) ? (result.value as { blocked?: unknown }).blocked : undefined;
    if (Array.isArray(blocked)) {
      for (const host of blocked) {
        const v: Violation = { policy: tool.name, rule: "AllowHosts", message: `${tool.name} tried to reach ${String(host)}, which is not an allowed host`, phase: "tool" };
        ctx.meta.violations.push(v);
        this.emit({ type: "violation", runId: ctx.meta.runId, ...v });
      }
    }

    const latencyMs = Math.round(performance.now() - t0);
    // A result an agent chose to fetch is logged as its policies let it out (as the agent itself sees it).
    const chooser = chosenBy ? this.agents.get(chosenBy) : undefined;
    const output = chooser ? this.guard.forLog(chooser, result.value) : result.value;
    // The recording keeps it the same way: the model only ever saw it through those policies, so a
    // replay (which applies them again) gives it the same text, and no raw secret sits in .halo.
    this.record({ kind: "tool", target, value: output, fingerprint });
    ctx.meta.calls.push({ pipeline: this.displayName(ctx.pipeline.name), stage: ctx.stageIndex, target: this.displayName(target), kind: "tool", latencyMs, cost: 0, attempts, mocked: result.mocked, ...(chosenBy ? { agent: this.displayName(chosenBy) } : {}) });
    // The files the call sent, so Studio can show what left the run.
    const sent = collectMedia(args, named);
    this.emit({ type: "tool", pipeline: ctx.pipeline.name, runId: ctx.meta.runId, tool: tool.name, method, output, latencyMs, mocked: result.mocked, ...(sent.length ? { sent } : {}) });
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
    child.branch = ctx.branch;
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
    const keys = stage.stages.map((_, i) => this.branchKey(ctx, i));
    try {
      const results = await branches(ctx.signal, (signal) => stage.stages.map((sub, i) => this.callStage(sub, { ...ctx, signal, branch: keys[i] })));
      if (stage.bind) ctx.data[stage.bind] = results;
      return results;
    } finally {
      await endRemoteBranches(this.topMeta(ctx).runId, keys);
    }
  }

  /** Branch `i` of the fan-out at the current stage: unique within the run, nested under the branch it's in. */
  private branchKey(ctx: ExecutionContext, i: number): string {
    return `${ctx.branch ? `${ctx.branch}/` : ""}${ctx.depth ? `${ctx.pipeline.name}:` : ""}${ctx.stageIndex}.${i}`;
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
          results[i] = await this.callStage(stage.call, { ...ctx, data, current: list[i], signal, branch: this.branchKey(ctx, i) });
        } catch (err) {
          failed = true;
          throw err;
        }
      }
    };
    try {
      await branches(ctx.signal, (signal) => Array.from({ length: Math.min(concurrency, list.length) }, () => worker(signal)));
    } finally {
      await endRemoteBranches(this.topMeta(ctx).runId, list.map((_, i) => this.branchKey(ctx, i)));
    }

    if (callee !== "System" && !this.isThreadCall(callee)) this.store(ctx, callee, method, results);
    if (stage.bind) ctx.data[stage.bind] = results;
    return results;
  }

  // ── Human-in-the-loop ──

  private async interrupt(stage: InterruptStage, ctx: ExecutionContext): Promise<void> {
    const connect = stage.argList.find((a) => a.name === "connect");
    if (connect) return this.connectStage(stage, connect.value, ctx);
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
    this.record({ kind: "yield", target: "yield", value: answer });
    this.deliver(stage, ctx, answer, "yield");
  }

  /**
   * `|! yield(connect: Google, msg: "...")`: go on at once if Google's connection works (a token
   * can be had, refreshing if need be), else pause with `waitingFor: "connect:Google"` until someone
   * connects it and resumes the run, which checks again. The response is `{ connected, account }`,
   * never a token.
   */
  private async connectStage(stage: InterruptStage, value: Value, ctx: ExecutionContext): Promise<void> {
    const name = value.kind === "ref" ? value.path.join(".") : value.kind === "string" ? value.value : "";
    const msgArg = stage.argList.find((a) => a.name === "msg" || a.name === "message");
    const msg = msgArg ? formatValue(this.resolveValue(msgArg.value, ctx)) : undefined;
    const mock = this.mockFor("yield");
    if (mock) {
      const answer = await mock({ target: "yield", kind: "yield", args: [], named: { connect: this.displayName(name), ...(msg ? { msg } : {}) }, input: ctx.current });
      this.record({ kind: "yield", target: "yield", value: answer });
      return this.deliver(stage, ctx, answer, "yield");
    }
    const conn = this.oauthConnection(name, ctx);
    try {
      await this.broker.token(conn, { fetch: this.fetch, signal: ctx.signal });
    } catch (err) {
      if (!isAuthRequired(err)) throw err;
      if (ctx.depth > 0) throw new HaloError(`Pipeline "${ctx.pipeline.name}" reached |! yield(connect: ${conn.name}) inside a called pipeline, which can't pause; connect it first with halo auth login ${conn.name}`);
      throw new Pause(connectEvent(conn.name), msg ? `${msg} (${err.message})` : err.message);
    }
    const account = this.broker.info(conn)?.account;
    this.deliver(stage, ctx, { connected: true, connection: conn.name, ...(account ? { account } : {}) }, "yield");
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
    this.record({ kind: "listen", target, value: event });
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
