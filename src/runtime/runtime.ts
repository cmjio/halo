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
 */

import { mkdirSync } from "node:fs";
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
import { AdapterRegistry, type LLMRequest, type ProviderAdapter } from "./adapter.js";
import { CostTracker, LLMRouter, type RouterConfig } from "./router.js";
import { PolicyEngine, type PolicyHooks, type Violation } from "./policies.js";
import { LocalVectorStore } from "./vectors.js";
import { BUILTIN_PROVIDERS, declArgs, type ToolProvider, type ToolServices } from "./tools.js";
import { HttpError, HaloError, LoopLimitError, PolicyViolation, SchemaValidationError, SignalError, TimeoutError, isRetryable } from "./errors.js";
import { validateSchema } from "./schema.js";
import { shellQuote } from "./integrations.js";
import { formatValue, getPath, humanize, interpolate, isPlainObject, looseEquals, parseOutput, pick, sleep, truthy } from "./values.js";

export * from "./errors.js";
export type { Violation } from "./policies.js";
export type { ToolProvider, ToolCall, ToolServices } from "./tools.js";

// ── Public types ─────

export interface ContextSnapshot {
  input: Record<string, unknown>;
  data: Record<string, unknown>;
  meta: RunMeta;
  trace: TraceEntry[];
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
  kind: "agent" | "tool" | "yield" | "listen";
  prompt?: string;
  system?: string;
  args: unknown[];
  named: Record<string, unknown>;
  input: unknown;
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
  paused?: { stage: number; waitingFor: string; message?: string };
  checkpoint?: string;
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
}

/** Where paused runs are kept until `signal()` resumes them. */
export interface RunStore {
  save(runId: string, snapshot: RunSnapshot): void | Promise<void>;
  load(runId: string): RunSnapshot | undefined | Promise<RunSnapshot | undefined>;
  delete(runId: string): void | Promise<void>;
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
}

/** Keeps paused runs as JSON files, so another process (or `halo resume`) can continue them. */
export class FileRunStore implements RunStore {
  constructor(readonly dir = ".halo/runs") {}
  private path(runId: string) {
    if (!/^[\w-]+$/.test(runId)) throw new SignalError(`Invalid run id "${runId}"`, "RUN_NOT_FOUND");
    return `${this.dir}/${runId}.json`;
  }
  async save(runId: string, snapshot: RunSnapshot) {
    mkdirSync(this.dir, { recursive: true });
    await Bun.write(this.path(runId), JSON.stringify(snapshot, null, 2));
  }
  async load(runId: string) {
    const file = Bun.file(this.path(runId));
    return (await file.exists()) ? ((await file.json()) as RunSnapshot) : undefined;
  }
  async delete(runId: string) {
    await Bun.file(this.path(runId)).delete().catch(() => {});
  }
}

export type RuntimeEvent =
  | { type: "run"; pipeline: string; runId: string; status: "start" | "completed" | "halted" | "paused" | "error"; output?: unknown; error?: string; durationMs?: number; cost?: number }
  | { type: "stage"; pipeline: string; runId: string; index: number; kind: PipelineStage["kind"]; label: string; status: "start" | "end"; value?: unknown; durationMs?: number }
  | { type: "llm"; pipeline: string; runId: string; agent: string; model: string; system?: string; prompt: string; output: unknown; latencyMs: number; cost: number; tokens?: { prompt: number; completion: number }; mocked: boolean }
  | { type: "tool"; pipeline: string; runId: string; tool: string; method: string; output: unknown; latencyMs: number; mocked: boolean }
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
  loopFeedback?: { stage: number; condition: string; value: unknown; iteration: number };
  /** The calling pipeline's context, for a called pipeline. */
  parent?: ExecutionContext;
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

/** Named args on an agent call that configure the request rather than the prompt. */
const LLM_OPTION_KEYS = new Set(["max_tokens", "temperature", "temp", "top_p", "system"]);
const MAX_STREAM_DEPTH = 16;
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

function raceAbort<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  work.catch(() => {}); // the loser of the race must not surface as an unhandled rejection
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
    work.then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
  });
}

function childSignal(parent: AbortSignal): AbortController {
  const c = new AbortController();
  if (parent.aborted) c.abort(parent.reason);
  else parent.addEventListener("abort", () => c.abort(parent.reason), { once: true });
  return c;
}

function directiveArgs(d: Directive | undefined): string[] {
  return d?.value ? d.value.split(/\s*,\s*/) : [];
}

function findDirective(list: Directive[] | undefined, name: string): Directive | undefined {
  return list?.find((d) => d.name === name);
}

export function stageLabel(stage: PipelineStage): string {
  switch (stage.kind) {
    case "expression": return stage.value;
    case "call": return stage.method ? `${stage.callee}.${stage.method}` : stage.callee;
    case "gate": return `|? (${stage.condition})`;
    case "fanout": return `|* { ${stage.stages.map(stageLabel).join(", ")} }`;
    case "branch": return `|? { ${stage.arms.map((a) => `${a.condition === undefined ? "else" : `(${a.condition})`} => ${stageLabel(a.call)}`).join(", ")} }`;
    case "each": return `|* each(${stage.item} in ${render(stage.list)}) => ${stageLabel(stage.call)}`;
    case "interrupt": return "|! yield";
    case "listen": return `~> listen(${stage.target})`;
    case "loop": return `|<> loop(${stage.target}, "${stage.condition}")`;
  }
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
  private guard = new PolicyEngine(this.policies);
  private shadowMinds = new Map<string, Agent[]>();
  private shadowModels = new Map<string, string[]>();

  private config: RuntimeConfig;
  private mocks: Record<string, MockValue> | null = null;
  private adapterRegistry = new AdapterRegistry();
  private router: LLMRouter;
  private routerEnabled: boolean;
  private costTracker = new CostTracker();
  private providers = new Map<string, ToolProvider>(Object.entries(BUILTIN_PROVIDERS));
  private systems = new Map<string, SystemHandler>();
  private vectorStore?: LocalVectorStore;
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
    for (const m of ast.agents) this.agents.set(m.name, m);
    for (const s of ast.pipelines) this.pipelines.set(s.name, s);
    for (const g of ast.policies) this.policies.set(g.name, g);
    for (const t of [...ast.tools, ...ast.stores]) this.tools.set(t.name, t);
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
  registerToolProvider(name: string, provider: ToolProvider): this {
    this.providers.set(name, provider);
    return this;
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
  async close(): Promise<void> {
    this.vectorStore?.close();
    this.vectorStore = undefined;
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
    const cp = (await Bun.file(checkpointPath).json()) as RunSnapshot;
    return this.runTop(this.restore(cp), cp.nextStage);
  }

  /**
   * Resume a paused run. `event` is "yield" for a run paused at `|! yield(...)`,
   * or the listen target (e.g. "Slack.Reaction") for `~> listen(...)`; `payload`
   * becomes the response (`context.data.yield`, the listen target, and any `as` binding).
   */
  async signal(runId: string, event: string, payload: unknown): Promise<RunResult> {
    const snap = await this.runStore.load(runId);
    if (!snap?.waitingFor) throw new SignalError(`No paused run "${runId}"`, "RUN_NOT_FOUND");
    if (snap.waitingFor !== event) {
      throw new SignalError(`Run ${runId} is waiting for "${snap.waitingFor}", not "${event}"`, "SIGNAL_MISMATCH");
    }
    const ctx = this.restore(snap);
    const stage = ctx.pipeline.pipeline[snap.nextStage];
    if (stage?.kind !== "interrupt" && stage?.kind !== "listen") throw new SignalError(`Run ${runId} is not paused at a yield or listen`, "RUN_NOT_FOUND");
    await this.runStore.delete(runId);
    ctx.stageIndex = snap.nextStage;
    this.deliver(stage, ctx, payload, snap.waitingFor);
    this.appendTrace(ctx, snap.nextStage, stage, stageLabel(stage));
    // The paused stage is done now that it has its response.
    this.emit({ type: "stage", pipeline: ctx.pipeline.name, runId, index: snap.nextStage, kind: stage.kind, label: stageLabel(stage), status: "end", value: ctx.current, durationMs: 0 });
    return this.runTop(ctx, snap.nextStage + 1);
  }

  private restore(snap: RunSnapshot): ExecutionContext {
    const pipeline = this.pipelines.get(snap.pipeline);
    if (!pipeline) throw new HaloError(`Saved run is for pipeline "${snap.pipeline}", which is not loaded`);
    const ctx = this.newContext(pipeline, snap.input, 0);
    Object.assign(ctx, { data: snap.data, trace: snap.trace, current: snap.current });
    ctx.meta = { ...snap.meta, halted: undefined, paused: undefined, finishedAt: undefined, durationMs: undefined };
    return ctx;
  }

  /** Run a top-level pipeline from `start`, reporting run events and checking the declared output schema. */
  private async runTop(ctx: ExecutionContext, start: number): Promise<RunResult> {
    const base = { pipeline: ctx.pipeline.name, runId: ctx.meta.runId };
    this.emit({ type: "run", ...base, status: "start" });
    try {
      const result = await this.runFrom(ctx, start);
      this.emit({ type: "run", ...base, status: result.status, output: result.output, durationMs: ctx.meta.durationMs, cost: ctx.meta.cost });
      return result;
    } catch (err) {
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
      current: first && first.name in args ? args[first.name] : Object.values(args)[0],
      stageIndex: 0,
      depth,
      signal: signal ?? new AbortController().signal,
      shadowTasks: [],
    };
  }

  private snapshot(ctx: ExecutionContext): ContextSnapshot {
    return { input: ctx.input, data: ctx.data, meta: ctx.meta, trace: ctx.trace };
  }

  private async runFrom(ctx: ExecutionContext, start: number): Promise<RunResult> {
    const timeout = findDirective(ctx.pipeline.directives, "timeout");
    const timeoutMs = timeout ? parseDuration(timeout.value) : NaN;
    const controller = childSignal(ctx.signal);
    ctx.signal = controller.signal;
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
      ctx.meta.paused = { stage: i, waitingFor: err.waitingFor, message: err.message };
      await this.runStore.save(ctx.meta.runId, this.toSnapshot(ctx, i, err.waitingFor));
      this.emit({ type: "paused", pipeline: ctx.pipeline.name, runId: ctx.meta.runId, index: i, waitingFor: err.waitingFor });
      return "paused";
    }
  }

  private toSnapshot(ctx: ExecutionContext, nextStage: number, waitingFor?: string): RunSnapshot {
    const { input, data, meta, trace, current } = ctx;
    return { version: 1, pipeline: ctx.pipeline.name, nextStage, ...(waitingFor ? { waitingFor } : {}), input, data, meta, trace, current };
  }

  private async executeStages(ctx: ExecutionContext, start: number): Promise<RunResult["status"]> {
    const { pipeline, name } = ctx.pipeline;
    for (let i = start; i < pipeline.length; i++) {
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

  private async writeCheckpoint(ctx: ExecutionContext, nextStage: number): Promise<void> {
    if (!findDirective(ctx.pipeline.directives, "checkpoint") || ctx.depth > 0) return;
    const path = `${this.config.checkpointDir ?? ".halo/checkpoints"}/${ctx.pipeline.name}-${ctx.meta.runId}.json`;
    ctx.meta.checkpoint = path;
    mkdirSync(dirname(path), { recursive: true });
    await Bun.write(path, JSON.stringify(this.toSnapshot(ctx, nextStage), null, 2));
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
    if (done >= max) {
      throw new LoopLimitError(`loop(${stage.target}) gave up after ${max} ${max === 1 ? "try" : "tries"}: "${stage.condition}" is still true`);
    }
    const to = ctx.pipeline.pipeline.findLastIndex((s, j) => j < index && s.kind === "call" && s.callee === stage.target);
    if (to < 0) throw new HaloError(`loop(${stage.target}, ...) needs an earlier ${stage.target} stage to go back to`, { code: "LOOP_TARGET_NOT_FOUND" });
    ctx.loops[index] = done + 1;
    ctx.loopFeedback = { stage: to, condition: stage.condition, value: ctx.current, iteration: done + 1 };
    ctx.data.loop = { target: stage.target, iteration: done + 1, condition: stage.condition };
    this.emit({ type: "loop", pipeline: ctx.pipeline.name, runId: ctx.meta.runId, index, to, iteration: done + 1, condition: stage.condition });
    return to;
  }

  /** Validate (and parse) a pipeline's output when its `-> Type` names a declared schema. */
  private checkSchema(pipeline: PipelineDeclaration, output: unknown): unknown {
    const schema = this.schemas.get(pipeline.returnType);
    if (!schema) return output;
    return validateSchema(schema, output, (name) => this.schemas.get(name));
  }

  // ── Values ──

  private evalHead(expr: Value, ctx: ExecutionContext): unknown {
    if (expr.kind === "ref") {
      const [root, ...rest] = expr.path as [string, ...string[]];
      if (root in ctx.input) return getPath(ctx.input[root], rest);
      if (root in ctx.data) return getPath(ctx.data[root], rest);
      throw new HaloError(`Undefined variable "${root}"`);
    }
    return this.resolveValue(expr, ctx);
  }

  private contextPath(path: string[], ctx: ExecutionContext): unknown {
    const [ns, ...rest] = path;
    if (ns === undefined) return this.snapshot(ctx);
    const roots: Record<string, unknown> = { data: ctx.data, input: ctx.input, meta: ctx.meta, trace: ctx.trace, current: ctx.current };
    return getPath(roots[ns], rest);
  }

  /** Resolve a `{{path}}` placeholder or bare name against the context. */
  private lookup(path: string[], ctx: ExecutionContext): unknown {
    const [root, ...rest] = path as [string, ...string[]];
    if (root === "context") return this.contextPath(rest, ctx);
    if (root === "current") return getPath(ctx.current, rest);
    if (root in ctx.data) return getPath(ctx.data[root], rest);
    if (root in ctx.input) return getPath(ctx.input[root], rest);
    return undefined;
  }

  private template(text: string, ctx: ExecutionContext, format?: (v: unknown) => string) {
    // Env.* is deliberately not resolvable here, so secrets never reach prompts.
    return interpolate(text, (path) => (path[0] === "Env" ? undefined : this.lookup(path, ctx)), format);
  }

  private resolveValue(v: Value, ctx: ExecutionContext, opts: { allowEnv?: boolean; owner?: string; shell?: boolean } = {}): unknown {
    switch (v.kind) {
      case "string": {
        // In a tool declaration, "Env.NAME" (as a string) reads that environment variable.
        if (opts.allowEnv && /^Env\.\w+$/.test(v.value)) return this.resolveValue({ kind: "ref", path: v.value.split(".") }, ctx, opts);
        return this.template(v.value, ctx, opts.shell ? (x) => shellQuote(formatValue(x)) : undefined).text;
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
        if (root in ctx.input) return getPath(ctx.input[root], rest);
        // A declared name refers to the declaration itself (e.g. `history: PastCases`);
        // its results are read explicitly via context.data.<Name>.
        if (this.isDeclared(root)) return v.path.join(".");
        if (root in ctx.data) return getPath(ctx.data[root], rest);
        // Anything else is a symbol, e.g. `channel: Slack`.
        return v.path.join(".");
      }
    }
  }

  private isDeclared(name: string): boolean {
    return this.tools.has(name) || this.agents.has(name) || this.pipelines.has(name) || this.policies.has(name);
  }

  private resolveArgs(stage: { argList: CallStage["argList"] }, ctx: ExecutionContext, opts: { shell?: boolean } = {}) {
    const positional: unknown[] = [];
    const named: Record<string, unknown> = {};
    for (const a of stage.argList) {
      const value = this.resolveValue(a.value, ctx, opts);
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
        const [a, b] = [Number(l), Number(r)];
        if (l === null || l === undefined || r === null || r === undefined || Number.isNaN(a) || Number.isNaN(b)) return false;
        return c.op === ">" ? a > b : c.op === "<" ? a < b : c.op === ">=" ? a >= b : a <= b;
      }
    }
  }

  // ── Calls ──

  private async callStage(stage: CallStage, ctx: ExecutionContext): Promise<unknown> {
    const value = await this.dispatchCall(stage, ctx);
    if (stage.callee !== "System") this.store(ctx, stage.callee, stage.method, value);
    if (stage.bind) ctx.data[stage.bind] = value;
    return value;
  }

  /** Store a result at context.data.<callee>.<method> (or context.data.<callee> for pipeline calls). */
  private store(ctx: ExecutionContext, callee: string, method: string, value: unknown): void {
    if (!method) {
      ctx.data[callee] = value;
      return;
    }
    const slot = ctx.data[callee];
    if (isPlainObject(slot)) slot[method] = value;
    else ctx.data[callee] = { [method]: value };
    // Also by method name alone (`context.data.triage`), unless that would hide an input.
    if (!(method in ctx.input) && !this.isDeclared(method)) ctx.data[method] = value;
  }

  private dispatchCall(stage: CallStage, ctx: ExecutionContext): Promise<unknown> {
    if (stage.callee === "System") return this.systemCall(stage, ctx);
    const agent = this.agents.get(stage.callee);
    const tool = this.tools.get(stage.callee);
    if (!stage.method || (stage.implicit && !agent && this.pipelines.has(stage.callee))) return this.pipelineCall(stage, ctx);
    if (tool) {
      // Values inserted into a Bash command are shell-quoted, so they can't run as commands.
      const { positional, named } = this.resolveArgs(stage, ctx, { shell: tool.provider === "Bash" });
      return this.toolCall(tool, stage.method, positional, named, ctx, false);
    }
    if (agent) return this.agentCall(agent, stage, ctx);
    return Promise.reject(new HaloError(`Unknown callee "${stage.callee}": not an agent, tool, store, or pipeline`));
  }

  private mockFor(...keys: string[]): ((req: MockRequest) => Promise<unknown>) | undefined {
    if (!this.mocks) return undefined;
    const key = keys.find((k) => k in this.mocks!);
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
      }
    }
  }

  /** Spend of the whole run: this pipeline plus the callers waiting on it. */
  private spent(ctx: ExecutionContext): number {
    return ctx.meta.cost + (ctx.parent ? this.spent(ctx.parent) : 0);
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
    const shell = toolName !== undefined && this.tools.get(toolName)?.provider === "Bash";

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
        params[a.name] = this.resolveValue(a.value, ctx, { shell });
      } else {
        const value = this.resolveValue(a.value, ctx, { shell });
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
    const feedback = retry
      ? [{ source: "the check", label: `Attempt ${retry.iteration} was sent back because "${retry.condition}" held`, text: formatValue(retry.value) }]
      : [];
    const prompt = buildPrompt({ ...parts, context: [...feedback, ...memory.context] });
    if (!prompt.trim()) throw new HaloError(`${target} has an empty prompt (its arguments and the pipeline value are all empty)`);
    const system = String(callOptions.system ?? agent.system ?? agent.params.system ?? agent.params.role ?? "") || undefined;
    const options = llmOptions(agent.params, callOptions);

    const hooks = this.guardHooks(ctx);
    this.guard.checkBudget(agent, hooks);
    const user = this.guard.checkInput(agent, prompt, hooks);

    this.startShadows(agent, stage.method, user, system, options, ctx);
    const corrections = this.correctLimit(ctx, agent);
    let ask = user;
    for (let attempt = 0; ; attempt++) {
      const { value, tokens } = await this.complete(agent, agent.modelId, target, [target, agent.name, "*"], ask, system, options, stage, ctx);
      try {
        const checked = this.guard.checkOutput(agent, value, hooks, { completionTokens: tokens?.completion });
        await memory.remember?.(checked);
        return checked;
      } catch (err) {
        // @correct(n): show the model what the policy rejected and let it try again.
        if (!(err instanceof PolicyViolation) || attempt >= corrections) throw err;
        // The audit trail keeps the violation, marked as one the agent was asked to fix.
        const v = ctx.meta.violations.findLast((x) => x.policy === err.policy && x.rule === err.rule && !x.corrected);
        if (v) v.corrected = true;
        this.emit({ type: "correction", pipeline: ctx.pipeline.name, runId: ctx.meta.runId, target, attempt: attempt + 1, error: err.message });
        ask = `${user}\n\nYour previous answer was rejected by policy "${err.policy}": ${err.message}\nAnswer again, fixing that problem.\n\nPrevious answer:\n${formatValue(value)}`;
      }
    }
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
  ): Promise<{ value: unknown; tokens?: { prompt: number; completion: number } }> {
    const t0 = performance.now();
    const mock = this.mockFor(...mockKeys);
    const { result, attempts } = await this.withPolicies(ctx, target, agent, async (signal) => {
      if (mock) {
        const { positional, named } = stage ? this.resolveArgs(stage, ctx) : { positional: [], named: {} };
        return { value: await mock({ target, kind: "agent", prompt, system, args: positional, named, input: ctx.current }), model, cost: 0, tokens: undefined, mocked: true };
      }
      const r = await this.callLLM(model, prompt, system, options, signal);
      return { value: r.text as unknown, model: r.model, cost: r.cost, tokens: r.tokens, mocked: false };
    });

    const latencyMs = Math.round(performance.now() - t0);
    ctx.meta.cost += result.cost;
    if (result.tokens) {
      ctx.meta.tokens.prompt += result.tokens.prompt;
      ctx.meta.tokens.completion += result.tokens.completion;
    }
    ctx.meta.calls.push({ pipeline: ctx.pipeline.name, stage: ctx.stageIndex, target, kind, model: result.model, latencyMs, cost: result.cost, tokens: result.tokens, attempts, mocked: result.mocked });
    const value = typeof result.value === "string" ? parseOutput(result.value) : result.value;
    if (kind !== "shadow") {
      if (typeof result.value === "string") this.emit({ type: "token", pipeline: ctx.pipeline.name, runId: ctx.meta.runId, target, text: result.value });
      this.emit({ type: "llm", pipeline: ctx.pipeline.name, runId: ctx.meta.runId, agent: agent.name, model: result.model, system, prompt, output: value, latencyMs, cost: result.cost, tokens: result.tokens, mocked: result.mocked });
    }
    return { value, tokens: result.tokens };
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
        ({ value: output }) => ({ primary: primary.name, shadow: run.shadow, output, latencyMs: Math.round(performance.now() - t0) }),
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
  private async callLLM(requestedModel: string, prompt: string, system: string | undefined, options: LLMOptions, signal: AbortSignal) {
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

    const request: LLMRequest = {
      model,
      messages: [...(system ? [{ role: "system", content: system }] : []), { role: "user", content: prompt }],
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
    return { text: parsed.text, model, cost, tokens };
  }

  private toolServices(): ToolServices {
    return {
      fetch: this.fetch,
      vectors: () => (this.vectorStore ??= new LocalVectorStore(this.config.vectorPath ?? ".halo/vectors.sqlite")),
      sql: (url) => {
        let db = this.sqlPool.get(url);
        if (!db) this.sqlPool.set(url, (db = new Bun.SQL(url)));
        return db;
      },
    };
  }

  private async toolCall(tool: ToolDeclaration, method: string, positional: unknown[], named: Record<string, unknown>, ctx: ExecutionContext, viaAgent: boolean): Promise<unknown> {
    const target = `${tool.name}.${method}`;
    const args = positional.length || ctx.current === undefined ? positional : [ctx.current];
    const decl = declArgs(tool);
    const config = (key: string | number) => {
      const v = typeof key === "number" ? decl.positional[key] : decl.named[key];
      return v === undefined ? undefined : this.resolveValue(v, ctx, { allowEnv: true, owner: tool.name });
    };

    const t0 = performance.now();
    const mock = this.mockFor(target, tool.name);
    const provider = this.providers.get(tool.provider);
    if (!mock && !provider) throw new HaloError(`Unknown tool provider "${tool.provider}" for tool "${tool.name}" (register it with runtime.registerToolProvider)`);

    const { result, attempts } = await this.withPolicies(ctx, target, undefined, async (signal) =>
      mock
        ? { value: await mock({ target, kind: "tool", args, named, input: ctx.current }), mocked: true }
        : { value: await provider!({ tool, method, positional: args, named, config, viaAgent, signal }, this.toolServices()), mocked: false },
    );

    const latencyMs = Math.round(performance.now() - t0);
    ctx.meta.calls.push({ pipeline: ctx.pipeline.name, stage: ctx.stageIndex, target, kind: "tool", latencyMs, cost: 0, attempts, mocked: result.mocked });
    this.emit({ type: "tool", pipeline: ctx.pipeline.name, runId: ctx.meta.runId, tool: tool.name, method, output: result.value, latencyMs, mocked: result.mocked });
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
        const ms = parseDuration(String(positional[0] ?? ""));
        if (!(ms >= 0)) throw new HaloError(`System.Sleep needs a duration, e.g. System.Sleep(2s)`);
        await sleep(ms, ctx.signal);
        return ctx.current;
      }
      case "Fail":
        throw new HaloError(String(positional[0] ?? named.message ?? `Pipeline "${ctx.pipeline.name}" failed`));
      case "Value":
        // Make a value the flowing value, e.g. to end a pipeline with a result
        // computed earlier: |> System.Value(context.data.review)
        if (stage.argList.length !== 1) throw new HaloError(`System.Value takes exactly one value, e.g. System.Value(context.data.review)`);
        return positional.length ? positional[0] : named[Object.keys(named)[0]!];
      case "Pick": {
        const fields = named.fields ?? positional.slice(1);
        if (!Array.isArray(fields) || !fields.length) throw new HaloError(`System.Pick needs fields, e.g. System.Pick(context.data.x, fields: ["id", "user.login"])`);
        const maxChars = named.maxChars === undefined ? Infinity : Number(named.maxChars);
        return pick(positional.length ? positional[0] : ctx.current, fields.map(String), maxChars);
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
    if (ctx.depth + 1 >= MAX_STREAM_DEPTH) throw new HaloError(`Pipeline call depth exceeded ${MAX_STREAM_DEPTH} (recursive "${stage.callee}"?)`);

    const { positional, named } = this.resolveArgs(stage, ctx);
    const args: Record<string, unknown> = {};
    target.params.forEach((p, i) => {
      if (p.name in named) args[p.name] = named[p.name];
      else if (i < positional.length) args[p.name] = positional[i];
    });
    if (stage.argList.length === 0 && target.params[0]) args[target.params[0].name] = ctx.current;

    const child = this.newContext(target, args, ctx.depth + 1, ctx.signal);
    child.meta.runId = ctx.meta.runId;
    child.parent = ctx;
    const result = await this.runFrom(child, 0);
    ctx.meta.cost += child.meta.cost;
    ctx.meta.tokens.prompt += child.meta.tokens.prompt;
    ctx.meta.tokens.completion += child.meta.tokens.completion;
    ctx.meta.calls.push(...child.meta.calls);
    ctx.meta.violations.push(...child.meta.violations);
    ctx.meta.shadows.push(...child.meta.shadows);
    return result.output;
  }

  private async fanout(stage: FanOutStage, ctx: ExecutionContext): Promise<unknown[]> {
    const results = await Promise.all(stage.stages.map((sub) => this.callStage(sub, ctx)));
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
    const list = this.resolveValue(stage.list, ctx);
    if (!Array.isArray(list)) {
      throw new HaloError(`each(${stage.item} in ${render(stage.list)}) needs a list, got ${list === undefined ? "nothing" : typeof list}`);
    }
    const options = this.resolveArgs({ argList: stage.options }, ctx).named;
    const concurrency = Math.max(1, Number(options.concurrency ?? 4) || 1);
    const { callee, method } = stage.call;

    const results: unknown[] = new Array(list.length);
    let next = 0;
    const worker = async () => {
      while (next < list.length) {
        const i = next++;
        // Each iteration sees the item under its own name and as the flowing value.
        const data: Record<string, unknown> = { ...ctx.data, [stage.item]: list[i], index: i };
        if (isPlainObject(data[callee])) data[callee] = { ...(data[callee] as object) };
        results[i] = await this.callStage(stage.call, { ...ctx, data, current: list[i] });
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, list.length) }, worker));

    if (callee !== "System") this.store(ctx, callee, method, results);
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
      work = raceAbort(work, controller.signal).finally(() => clearTimeout(timer));
    }
    this.deliver(stage, ctx, await work, "yield");
  }

  /** Store a human's (or event source's) response for a yield or listen stage. */
  private deliver(stage: InterruptStage | ListenStage, ctx: ExecutionContext, response: unknown, target: string): void {
    if (stage.kind === "interrupt") {
      ctx.data.yield = response;
    } else {
      const [root, ...rest] = target.split(".");
      if (rest.length) this.store(ctx, root!, rest.join("."), response);
      else ctx.data[root!] = response;
    }
    if (stage.bind) ctx.data[stage.bind] = response;
  }

  private async listen(stage: ListenStage, ctx: ExecutionContext): Promise<void> {
    const target = stage.targetValue.kind === "context" ? formatValue(this.resolveValue(stage.targetValue, ctx)) : stage.target;
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
