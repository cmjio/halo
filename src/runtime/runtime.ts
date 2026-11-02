/**
 * Langly Runtime — executes a parsed AST.
 *
 * Execution model:
 *   1. Register all `agent` and `pipeline` definitions.
 *   2. Maintain a `context` object that accumulates results from each stage.
 *   3. Use adapters to call different LLM providers.
 *   4. Use router to optimize model selection based on cost/performance.
 */

import {
  LanglyError,
  PipelineNotFoundError,
  AgentNotFoundError,
  ToolNotFoundError,
  AdapterNotFoundError,
  PolicyViolation,
  SchemaValidationError,
  TimeoutError as LanglyTimeoutError,
  ApiKeyMissingError,
  ToolExecutionError,
  ProviderNotFoundError,
  UndefinedVariableError,
  SignalMismatchError,
  LoopTargetError,
  MaxDepthExceededError,
} from "../errors.js";

import type {
  ParseResult,
  Agent,
  PipelineDeclaration,
  PipelineStage,
  PolicyDeclaration,
  ToolDeclaration,
  StoreDeclaration,
  LoopStage,
} from "../parser/types.js";

import {
  AdapterRegistry,
  type ProviderAdapter,
  type LLMRequest,
  type LLMResponse,
} from "./adapter.js";

import {
  LLMRouter,
  CostTracker,
  type RouterConfig,
} from "./router.js";

import { TelemetryDispatcher, SQLiteTelemetrySink, TelemetryEvent } from "./telemetry.js";

import {
  ToolRegistry,
  RestTool,
  PostTool,
  PostgreSQLTool,
  VectorStoreTool,
  SlackTool,
  EmailTool,
  GitHubTool,
  BashTool,
  FigmaTool,
  LinearTool,
  BrowserTool,
  SearchTool
} from "./tools.js";

import {
  PolicyRegistry,
  BlockPlugin,
  MaxWordsPlugin,
  MaxTokensPlugin,
  MaxLatencyPlugin,
  RedactPlugin,
  LogViolationPlugin,
  RequirePlugin,
  MatchRegexPlugin,
  ValidatePlugin,
  createMaxSpendPlugin,
  type PolicyPlugin,
  type PolicyPhase,
} from "./policies.js";

import {
  StoreRegistry,
  FileStorePlugin,
  type StorePlugin
} from "./store.js";

// ── Runtime configuration ─────

export interface RuntimeConfig {
  /** LLM API key (env var fallback: LANGLY_API_KEY) */
  apiKey?: string;
  /** Router configuration for model selection */
  router?: RouterConfig;
}

// ── Pipeline Events ─────

export type StreamEvent =
  | { type: "token"; text: string; stage: string }
  | { type: "stage_start"; stage: string }
  | { type: "stage_complete"; stage: string; result?: unknown }
  | { type: "done"; result: unknown }
  | { type: "error"; error: Error };

// ── Persistence ─────
export class SuspendedRun {
  constructor(public runId: string, public state?: any) {}
}

export interface ExecutionStore {
  save(runId: string, context: ExecutionContext): Promise<void>;
  load(runId: string): Promise<ExecutionContext | null>;
}

export class InMemoryExecutionStore implements ExecutionStore {
  private runs = new Map<string, ExecutionContext>();
  async save(runId: string, context: ExecutionContext) { this.runs.set(runId, context); }
  async load(runId: string) { return this.runs.get(runId) ?? null; }
}

/** Durable SQLite-backed execution store. Survives process restarts. */
export class SQLiteExecutionStore implements ExecutionStore {
  private db: import("bun:sqlite").Database;
  private insertStmt: any;
  private selectStmt: any;

  constructor(dbPath: string = ".langly.db") {
    const { Database } = require("bun:sqlite") as typeof import("bun:sqlite");
    this.db = new Database(dbPath);
    this.db.run(`
      CREATE TABLE IF NOT EXISTS execution_runs (
        run_id TEXT PRIMARY KEY,
        context_json TEXT NOT NULL,
        status TEXT DEFAULT 'suspended',
        created_at INTEGER DEFAULT (unixepoch()),
        updated_at INTEGER DEFAULT (unixepoch())
      )
    `);
    this.insertStmt = this.db.prepare(`
      INSERT OR REPLACE INTO execution_runs (run_id, context_json, updated_at)
      VALUES (?, ?, unixepoch())
    `);
    this.selectStmt = this.db.prepare(`SELECT context_json FROM execution_runs WHERE run_id = ?`);
  }

  async save(runId: string, context: ExecutionContext): Promise<void> {
    // Strip non-serializable fields before persisting
    const serializable = { ...context, _streamSink: undefined };
    this.insertStmt.run(runId, JSON.stringify(serializable));
  }

  async load(runId: string): Promise<ExecutionContext | null> {
    const row = this.selectStmt.get(runId) as { context_json: string } | undefined;
    if (!row) return null;
    return JSON.parse(row.context_json) as ExecutionContext;
  }

  close(): void {
    this.db.close();
  }
}

// ── Context ─────

export interface ExecutionContext {
  /** Input arguments to the pipeline */
  input: Record<string, unknown>;
  /** Accumulated results from each pipeline stage */
  data: Record<string, unknown>;
  /** Current pipeline result (passed to next stage) */
  current: unknown;
  /** System metadata (token usage, latency, cost) */
  meta: {
    totalCost: number;
    totalTokens: number;
    lastLatency: number;
    stageCount: number;
    calls: Array<{ model: string; tokens: number; cost: number; latency: number }>;
  };
  /** Execution trace — ordered list of stages executed */
  trace: Array<{ stage: string; timestamp: number; result?: string }>;
  /** Unique ID for the run */
  runId?: string;
  /** Internal depth counter to prevent infinite loops */
  _callDepth?: number;
  /** Index of the current pipeline stage */
  stageIndex?: number;
  /** Name of the pipeline being executed */
  streamName?: string;
  /** The specific signal event name the pipeline is waiting for (if suspended by listen) */
  targetSignal?: string;
  /** Internal: pipeline event sink for streaming mode. Not part of the public API. */
  _streamSink?: StreamEvent[];
}

// ── Mock table ─────

interface MockTable {
  responses: Record<string, string>;
}

// ── Runtime ─────

export class LanglyRuntime {
  private agents = new Map<string, Agent>();
  private pipelines = new Map<string, PipelineDeclaration>();
  private policies = new Map<string, PolicyDeclaration>();
  private tools = new Map<string, ToolDeclaration>();
  private stores = new Map<string, StoreDeclaration>();
  private schemas = new Map<string, any>();
  private config: RuntimeConfig;
  private mocks: MockTable | null = null;
  private adapterRegistry = new AdapterRegistry();
  private costTracker = new CostTracker();
  private store: ExecutionStore = new InMemoryExecutionStore();
  public toolRegistry = new ToolRegistry();
  public guardrailRegistry = new PolicyRegistry();
  public memoryRegistry = new StoreRegistry();
  public router: LLMRouter;
  public telemetry = new TelemetryDispatcher();

  public lastContext?: ExecutionContext;

  /** Load-time validation warnings (non-fatal). */
  public warnings: string[] = [];

  /** Optional callback for shadow agent failures. Set this to opt into shadow error alerting. */
  public onShadowError?: (agentName: string, error: Error) => void;

  setExecutionStore(store: ExecutionStore): this {
    this.store = store;
    return this;
  }

  constructor(config: RuntimeConfig = {}) {
    this.config = config;
    this.router = new LLMRouter(config.router);

    // Register built-in tools
    this.toolRegistry
      .register(new RestTool())
      .register(new PostTool())
      .register(new PostgreSQLTool())
      .register(new VectorStoreTool())
      .register(new SlackTool())
      .register(new EmailTool())
      .register(new GitHubTool())
      .register(new BashTool())
      .register(new FigmaTool())
      .register(new LinearTool())
      .register(new BrowserTool())
      .register(new SearchTool());

    // Register built-in policies
    this.guardrailRegistry
      .register(new BlockPlugin())
      .register(new MaxWordsPlugin())
      .register(new MaxTokensPlugin())
      .register(new MaxLatencyPlugin())
      .register(new RedactPlugin())
      .register(new LogViolationPlugin())
      .register(new RequirePlugin())
      .register(new MatchRegexPlugin())
      .register(new ValidatePlugin())
      .register(createMaxSpendPlugin(() => this.costTracker.getTotalCost()));

    // Register built-in store providers
    this.memoryRegistry
      .register(new FileStorePlugin());

    // Add default SQLite sink
    this.telemetry.addSink(new SQLiteTelemetrySink());
  }

  /** Load a parsed program into the runtime. */
  load(ast: ParseResult): this {
    for (const m of ast.agents) this.agents.set(m.name, m);
    for (const s of ast.pipelines) this.pipelines.set(s.name, s);
    for (const g of ast.policies) this.policies.set(g.name, g);
    for (const t of ast.tools) this.tools.set(t.name, t);
    for (const m of ast.stores) this.stores.set(m.name, m);
    if (ast.schemas) {
      for (const s of ast.schemas) this.schemas.set(s.name, s);
    }

    // Load-time validation (non-fatal warnings)
    this.warnings = [];
    for (const s of ast.pipelines) {
      if (s.returnType && s.returnType !== "Result" && s.returnType !== "String" && s.returnType !== "Number" && s.returnType !== "Boolean") {
        if (!this.schemas.has(s.returnType)) {
          this.warnings.push(`Pipeline "${s.name}" returns "${s.returnType}" but no schema "${s.returnType}" is declared`);
        }
      }
    }
    for (const m of ast.agents) {
      if (m.directives) {
        for (const d of m.directives) {
          if (d.name === "shadow") {
            const shadowName = d.value.replace(/^["'(]|["')]$/g, "");
            if (!this.agents.has(shadowName)) {
              this.warnings.push(`Agent "${m.name}" has @shadow(${shadowName}) but agent "${shadowName}" is not declared`);
            }
          }
        }
      }
    }

    return this;
  }

  /** Register a custom adapter */
  registerAdapter(adapter: ProviderAdapter): this {
    this.adapterRegistry.register(adapter);
    return this;
  }

  /** Register a custom policy plugin */
  registerGuardrail(plugin: PolicyPlugin): this {
    this.guardrailRegistry.register(plugin);
    return this;
  }

  /** Set the router configuration */
  setRouterConfig(config: RouterConfig): this {
    this.router = new LLMRouter(config);
    return this;
  }

  /** Install mock responses — ONLY for testing. */
  mockAll(responses: Record<string, string>): this {
    this.mocks = { responses };
    return this;
  }

  /** Execute a named pipeline with the provided arguments. */
  async execute(
    streamName: string,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    const pipeline = this.pipelines.get(streamName);
    if (!pipeline) throw new PipelineNotFoundError(streamName);

    // Initialize execution context
    const ctx: ExecutionContext = {
      input: { ...args },
      data: {},
      current: Object.values(args)[0] ?? "",
      meta: { totalCost: 0, totalTokens: 0, lastLatency: 0, stageCount: 0, calls: [] },
      trace: [],
      runId: crypto.randomUUID(),
      stageIndex: 0,
      streamName,
    };
    this.lastContext = ctx;
    
    this.telemetry.record({ runId: ctx.runId!, timestamp: Date.now(), type: "stream_start", stage: streamName, payload: args });

    // Apply pipeline-level directives (timeout, retry)
    const timeout = pipeline.directives.find(d => d.name === "timeout");
    
    let executeWithDirectives = async (): Promise<unknown> => {
      return await this.executePipeline(pipeline.pipeline, ctx);
    };

    const retry = pipeline.directives.find(d => d.name === "retry");
    if (retry) {
      const argsStr = retry.value.replace(/^\(|\)$/g, "");
      const [r, d] = argsStr.split(",").map(s => s.trim());
      const maxRetries = parseInt(r ?? "0");
      const delay = this.parseDuration(d ?? "0");
      const baseExecute = executeWithDirectives;
      executeWithDirectives = async () => {
        let lastError;
        for (let i = 0; i < maxRetries; i++) {
          try {
            return await baseExecute();
          } catch (err: any) {
            lastError = err;
            // Don't retry deterministic failures — they won't improve on retry
            if (
              err instanceof PolicyViolation ||
              err instanceof SchemaValidationError ||
              err instanceof PipelineNotFoundError ||
              err instanceof AgentNotFoundError ||
              err instanceof ToolNotFoundError ||
              err instanceof AdapterNotFoundError ||
              err instanceof ApiKeyMissingError ||
              err instanceof UndefinedVariableError ||
              err instanceof LoopTargetError
            ) {
              throw err;
            }
            if (i < maxRetries - 1) {
              await new Promise(r => setTimeout(r, delay));
            }
          }
        }
        throw lastError;
      };
    }

    let result: unknown;
    try {
      if (timeout) {
        result = await this.withTimeout(executeWithDirectives, timeout.value);
      } else {
        result = await executeWithDirectives();
      }

      if (pipeline.returnType && this.schemas.has(pipeline.returnType)) {
        result = this.validateStruct(result, this.schemas.get(pipeline.returnType));
      }

      this.telemetry.record({ runId: ctx.runId!, timestamp: Date.now(), type: "stream_end", stage: streamName, payload: result });
      return result;
    } catch (err: any) {
      this.telemetry.record({ runId: ctx.runId!, timestamp: Date.now(), type: "error", stage: streamName, payload: err.stack || err.message });
      throw err;
    }
  }

  /** Pipeline a named pipeline, yielding events as they happen. */
  async *pipeline(
    streamName: string,
    args: Record<string, unknown>,
  ): AsyncGenerator<StreamEvent> {
    const pipelineDecl = this.pipelines.get(streamName);
    if (!pipelineDecl) throw new PipelineNotFoundError(streamName);

    const ctx: ExecutionContext = {
      input: { ...args },
      data: {},
      current: Object.values(args)[0] ?? "",
      meta: { totalCost: 0, totalTokens: 0, lastLatency: 0, stageCount: 0, calls: [] },
      trace: [],
      runId: crypto.randomUUID(),
      stageIndex: 0,
      streamName,
      _streamSink: [],
    };
    this.lastContext = ctx;

    // Event-driven notification: the sink signals the consumer when events arrive.
    // This replaces the CPU-burning 1ms polling loop.
    let notifyResolve: (() => void) | null = null;
    const originalPush = ctx._streamSink!.push.bind(ctx._streamSink!);
    ctx._streamSink!.push = (...items: StreamEvent[]) => {
      const result = originalPush(...items);
      if (notifyResolve) {
        const resolve = notifyResolve;
        notifyResolve = null;
        resolve();
      }
      return result;
    };

    const waitForEvent = (): Promise<void> =>
      new Promise(resolve => { notifyResolve = resolve; });

    // Run pipeline in background
    let pipelineDone = false;
    let pipelineError: Error | null = null;
    let pipelineResult: unknown;

    this.executePipeline(pipelineDecl.pipeline, ctx)
      .then(result => {
        pipelineResult = result;
        pipelineDone = true;
        // Wake up the consumer if it's waiting
        if (notifyResolve) notifyResolve();
      })
      .catch(err => {
        pipelineError = err;
        pipelineDone = true;
        if (notifyResolve) notifyResolve();
      });

    // Yield events as they arrive — no busy-waiting
    while (!pipelineDone) {
      while (ctx._streamSink!.length > 0) {
        yield ctx._streamSink!.shift()!;
      }
      if (!pipelineDone) {
        await waitForEvent();
      }
    }

    // Drain any remaining events
    while (ctx._streamSink!.length > 0) {
      yield ctx._streamSink!.shift()!;
    }

    // Validate schema if needed
    if (!pipelineError && pipelineDecl.returnType && this.schemas.has(pipelineDecl.returnType)) {
      try {
        pipelineResult = this.validateStruct(pipelineResult, this.schemas.get(pipelineDecl.returnType));
      } catch (err: any) {
        pipelineError = err;
      }
    }

    if (pipelineError) {
      yield { type: "error", error: pipelineError };
    } else {
      yield { type: "done", result: pipelineResult };
    }
  }

  private validateStruct(data: unknown, schemaDecl: any): unknown {
    let parsedData = data;
    if (typeof data === "string") {
      try {
        parsedData = JSON.parse(data);
      } catch (e) {
        throw new SchemaValidationError(schemaDecl.name, "Output is not valid JSON");
      }
    }

    if (!parsedData || typeof parsedData !== "object") {
      throw new SchemaValidationError(schemaDecl.name, `expected object matching '${schemaDecl.name}'`);
    }

    for (const field of schemaDecl.fields) {
      if (!(field.name in (parsedData as Record<string, unknown>))) {
        throw new SchemaValidationError(schemaDecl.name, `missing field '${field.name}' in '${schemaDecl.name}'`);
      }

      const val = (parsedData as Record<string, unknown>)[field.name];
      const typeStr = field.type;

      let valid = false;
      if (typeStr === "String") valid = typeof val === "string";
      else if (typeStr === "Number") valid = typeof val === "number";
      else if (typeStr === "Boolean") valid = typeof val === "boolean";
      else if (typeStr === "Array") valid = Array.isArray(val);
      else {
        // If it's a nested schema, we could recursively validate, but for now we just allow object
        valid = typeof val === "object" && val !== null;
      }

      if (!valid) {
        throw new SchemaValidationError(schemaDecl.name, `expected type '${typeStr}' for field '${field.name}'`);
      }
    }

    return parsedData;
  }

  /** Signal a suspended execution to resume. */
  async signal(runId: string, eventName: string, payload: unknown): Promise<unknown> {
    const ctx = await this.store.load(runId);
    if (!ctx) throw new LanglyError(`Run ${runId} not found`, "RUN_NOT_FOUND");
    if (!ctx.streamName) throw new LanglyError("Pipeline name missing in context", "INVALID_CONTEXT");
    
    // Verify signal matches
    if (ctx.targetSignal && ctx.targetSignal !== eventName) {
      // If it's a generic "resume" signal and we didn't specify a strict target, we could allow it,
      // but the listen node sets a strict target.
      if (eventName !== "resume" || ctx.targetSignal !== "resume") {
        throw new SignalMismatchError(ctx.targetSignal!, eventName);
      }
    }

    const pipeline = this.pipelines.get(ctx.streamName);
    if (!pipeline) throw new PipelineNotFoundError(ctx.streamName!);

    ctx.current = payload;
    ctx.stageIndex = (ctx.stageIndex ?? 0) + 1;
    // Clear the target signal so it doesn't block future yields
    ctx.targetSignal = undefined;
    
    this.lastContext = ctx;

    return await this.executePipeline(pipeline.pipeline, ctx);
  }

  /** Execute a pipeline stage by stage. */
  private async executePipeline(
    stages: PipelineStage[],
    ctx: ExecutionContext,
  ): Promise<unknown> {
    ctx._callDepth = (ctx._callDepth ?? 0) + 1;
    if (ctx._callDepth > 50) throw new MaxDepthExceededError(50);

    while (ctx.stageIndex !== undefined && ctx.stageIndex < stages.length) {
      const stage = stages[ctx.stageIndex];
      if (!stage) break;
      switch (stage.kind) {
        case "expression": {
          const exprName = `expression:${stage.value}`;
          if (ctx._streamSink) ctx._streamSink.push({ type: "stage_start", stage: exprName });
          ctx.current = this.resolveExpression(stage, ctx);
          // Store expression value in context.data so context.data.<name> works
          if (stage.value && !stage.value.startsWith('"') && !stage.value.startsWith("'") && !stage.value.startsWith("context.")) {
            ctx.data[stage.value] = ctx.current;
          }
          ctx.trace.push({ stage: exprName, timestamp: Date.now() });
          if (ctx._streamSink) ctx._streamSink.push({ type: "stage_complete", stage: exprName, result: ctx.current });
          break;
        }

        case "call": {
          const callName = `${stage.callee}.${stage.method}`;
          if (ctx._streamSink) ctx._streamSink.push({ type: "stage_start", stage: callName });
          ctx.current = await this.executeCall(stage, ctx);
          this.storeResult(ctx, stage);
          ctx.trace.push({ stage: callName, timestamp: Date.now() });
          if (ctx._streamSink) ctx._streamSink.push({ type: "stage_complete", stage: callName, result: ctx.current });
          break;
        }

        case "gate":
          if (!this.evaluateCondition(stage.condition, ctx)) {
            ctx.trace.push({ stage: `gate:${stage.condition}:false`, timestamp: Date.now() });
            return ctx.current;
          }
          ctx.trace.push({ stage: `gate:${stage.condition}:true`, timestamp: Date.now() });
          break;

        case "fanout": {
          if (ctx._streamSink) ctx._streamSink.push({ type: "stage_start", stage: "fanout" });
          ctx.current = await this.executeFanout(stage, ctx);
          ctx.trace.push({ stage: `fanout`, timestamp: Date.now() });
          if (ctx._streamSink) ctx._streamSink.push({ type: "stage_complete", stage: "fanout", result: ctx.current });
          break;
        }

        case "interrupt":
          ctx.current = await this.executeInterrupt(stage, ctx);
          ctx.trace.push({ stage: `interrupt`, timestamp: Date.now() });
          break;

        case "listen":
          ctx.current = await this.executeListen(stage, ctx);
          ctx.trace.push({ stage: `listen:${stage.target}`, timestamp: Date.now() });
          break;

        case "loop": {
          const loopStage = stage as LoopStage;
          if (this.evaluateCondition(loopStage.condition, ctx)) {
            const targetIndex = stages.findIndex(s => s.kind === "call" && s.callee === loopStage.target);
            if (targetIndex !== -1) {
              ctx.stageIndex = targetIndex - 1;
            } else {
              throw new LoopTargetError(loopStage.target);
            }
          }
          ctx.trace.push({ stage: `loop:${loopStage.target}`, timestamp: Date.now() });
          break;
        }
      }

      if (ctx.current instanceof SuspendedRun) {
        await this.store.save(ctx.runId!, ctx);
        return ctx.current;
      }

      if (ctx.streamName) {
        const pipeline = this.pipelines.get(ctx.streamName);
        if (pipeline && pipeline.directives.some(d => d.name === "checkpoint")) {
          await this.store.save(ctx.runId!, ctx);
        }
      }

      ctx.stageIndex++;
    }
    return ctx.current;
  }

  /** Store result in context for later reference. */
  private storeResult(ctx: ExecutionContext, stage: { callee: string; method: string }): void {
    const key = `${stage.callee}.${stage.method}`;
    ctx.data[key] = ctx.current;
    ctx.data[stage.callee] = ctx.current;
    // Also store by method name for friendlier access (e.g., context.data.brief)
    ctx.data[stage.method] = ctx.current;
  }

  /** Resolve an expression (identifier lookup in context/input). */
  private resolveExpression(
    stage: Extract<PipelineStage, { kind: "expression" }>,
    ctx: ExecutionContext,
  ): unknown {
    const value = stage.value;

    if (value.startsWith('"') && value.endsWith('"')) {
      return value.slice(1, -1);
    }
    if (value.startsWith("'") && value.endsWith("'")) {
      return value.slice(1, -1);
    }

    if (value in ctx.data) return ctx.data[value];
    if (value in ctx.input) return ctx.input[value];

    if (value.startsWith("context.")) {
      return this.resolveContextRef(value, ctx);
    }

    throw new UndefinedVariableError(value);
  }

  /** Resolve a context reference like "context.data.agent.result" */
  private resolveContextRef(ref: string, ctx: ExecutionContext): unknown {
    const path = ref.replace(/^context\./, "");
    const parts = path.split(".");
    
    let current: unknown = ctx;
    for (const part of parts) {
      if (current && typeof current === "object") {
        current = (current as Record<string, unknown>)[part];
      } else if (typeof current === "string") {
        // Auto-parse JSON strings for deep traversal
        try {
          const parsed = JSON.parse(current);
          if (parsed && typeof parsed === "object") {
            current = (parsed as Record<string, unknown>)[part];
          } else {
            return undefined;
          }
        } catch {
          return undefined;
        }
      } else {
        return undefined;
      }
    }
    return current;
  }

  /** Execute a call stage (agent method or system call). */
  private async executeCall(
    stage: Extract<PipelineStage, { kind: "call" }>,
    ctx: ExecutionContext,
  ): Promise<unknown> {
    ctx._callDepth = (ctx._callDepth ?? 0) + 1;
    if (ctx._callDepth > 50) throw new MaxDepthExceededError(50);


    // Built-in: System methods
    if (stage.callee === "System") {
      return this.executeSystemCall(stage, ctx);
    }

    // Check if it's a direct tool call
    if (this.tools.has(stage.callee)) {
      return this.executeToolCall(stage, ctx);
    }

    const stageName = `${stage.callee}.${stage.method}`;
    this.telemetry.record({ runId: ctx.runId!, timestamp: Date.now(), type: "node_start", stage: stageName, payload: ctx.current });
    const startTime = Date.now();

    // Check if it's a Agent delegating to a tool (e.g. Analyst.fetch(tool: WeatherAPI))
    // In mock mode, skip tool routing — the mock is for the agent.method key
    if (stage.namedArgs?.tool && typeof stage.namedArgs.tool === "string") {
      const mockKey = `${stage.callee}.${stage.method}`;
      if (this.mocks?.responses[mockKey] !== undefined) {
        // Mock mode: fall through to the LLM agent call path which handles mocks
      } else if (this.tools.has(stage.namedArgs.tool)) {
        // Production mode: call the tool first, then pass result to the agent
        const toolName = stage.namedArgs.tool;
        const toolStage = { ...stage, callee: toolName };
        this.telemetry.record({ runId: ctx.runId!, timestamp: Date.now(), type: "tool_call", stage: toolName, payload: toolStage.namedArgs });
        const toolResult = await this.executeToolCall(toolStage, ctx);
        // Inject tool result into context so the agent can reference it
        ctx.data[`${toolName}_result`] = toolResult;
        // Now fall through to the LLM agent call with tool data in context
      }
    }

    // LLM agent call
    const agent = this.agents.get(stage.callee);
    if (!agent) throw new AgentNotFoundError(stage.callee);

    const promptText = this.buildPrompt(stage, ctx);

    // Auto-load store context
    let memoryContext = "";
    const loadedMemories: { decl: any; plugin: StorePlugin; config: Record<string, unknown> }[] = [];
    
    if (agent.equips) {
      for (const eq of agent.equips) {
        let handled = false;
        const storeDecl = this.stores.get(eq);
        if (storeDecl) {
          const plugin = this.memoryRegistry.get(storeDecl.provider);
          if (plugin) {
            // Store config resolution
            const memConfig: Record<string, unknown> = {};
            if (storeDecl.args) {
              storeDecl.args.forEach((a, i) => memConfig[`arg${i}`] = a);
            }
            const history = await plugin.load(ctx, memConfig);
            if (history) memoryContext += `\n[Historical Context from ${eq}]\n${history}\n[/Historical Context]\n\n`;
            
            loadedMemories.push({ decl: storeDecl, plugin, config: memConfig });
            handled = true;
          }
        }

        if (!handled) {
          const toolDecl = this.tools.get(eq);
          if (toolDecl) {
            if (toolDecl.provider === "VectorStore") {
              const vsTool = this.toolRegistry.get("VectorStore") as any;
              if (vsTool && typeof vsTool.search === "function") {
                let namespace = "default";
                if (toolDecl.args) {
                  for (const arg of toolDecl.args) {
                    if (typeof arg === "string" && arg.startsWith("namespace:")) {
                      namespace = arg.split(":", 2)[1]?.trim().replace(/^["']|["']$/g, '') || "default";
                    }
                  }
                }
                const query = String(ctx.current ?? "");
                const results = vsTool.search(namespace, query, 3);
                if (results && results.length > 0) {
                  memoryContext += `\n[Retrieved Context from ${eq}]\n${results.join("\n---\n")}\n[/Retrieved Context]\n\n`;
                }
              }
            } else {
              // Inject info for other tools
              const toolInfo = `Tool: ${eq}\nProvider: ${toolDecl.provider}\nDescription: Available for use via tool: ${eq} in named arguments.`;
              memoryContext += `\n[Equipped Tool Info: ${eq}]\n${toolInfo}\n[/Equipped Tool Info]\n\n`;
            }
          }
        }
      }
    }

    let fullPromptText = memoryContext + promptText;

    // ── Input Guardrails: scrub/block the prompt BEFORE it hits the LLM ──
    fullPromptText = await this.applyGuardrails(agent, ctx, fullPromptText, undefined, "input");
    ctx.trace.push({ stage: `input_guardrail:${stage.callee}.${stage.method}`, timestamp: Date.now() });

    // Dispatch shadow agents asynchronously
    const shadowDirectives = agent.directives?.filter(d => d.name === "shadow") ?? [];
    for (const shadowDir of shadowDirectives) {
      const shadowAgentName = shadowDir.value.replace(/^["'(]|["')]$/g, "");
      const shadowAgent = this.agents.get(shadowAgentName);
      if (shadowAgent) {
        this.callLLM(shadowAgent, fullPromptText, ctx).then(shadowResult => {
          console.log(`[Shadow] ${shadowAgentName} returned:`, shadowResult);
        }).catch(err => {
          if (this.onShadowError) {
            this.onShadowError(shadowAgentName, err);
          } else {
            console.error(`[Shadow] ${shadowAgentName} failed:`, err);
          }
        });
      }
    }

    // Determine self-correction budget from @correct(N) directive
    const correctDirective = agent.directives?.find(d => d.name === "correct");
    const maxCorrections = correctDirective
      ? parseInt(correctDirective.value.replace(/^[("']|[)"']$/g, ""), 10)
      : 0;

    // Check mocks
    let responseText: unknown;
    if (this.mocks) {
      const mockKey = `${stage.callee}.${stage.method}`;
      if (this.mocks.responses[mockKey] !== undefined) {
        const mockResponse = this.mocks.responses[mockKey];
        // Simulate token streaming for mock mode
        if (ctx._streamSink) {
          const stageName = `${stage.callee}.${stage.method}`;
          const words = mockResponse.split(/(?<=\s)/);
          for (const word of words) {
            ctx._streamSink.push({ type: "token", text: word, stage: stageName });
          }
        }
        responseText = mockResponse;
      }
    }

    let metrics: { duration: number; completionTokens: number } | undefined;

    if (responseText === undefined) {
      const result = await this.callLLM(agent, fullPromptText, ctx) as { text: string, metrics: any };
      responseText = result.text;
      metrics = result.metrics;
    }

    // Auto-save store interaction
    for (const loaded of loadedMemories) {
      await loaded.plugin.save(ctx, `User: ${promptText}\nAssistant: ${responseText}`, loaded.config);
    }

    // ── Output Guardrails with Self-Correction Loop ──
    let correctionAttempts = 0;
    let lastViolation: PolicyViolation | null = null;

    while (true) {
      try {
        responseText = await this.applyGuardrails(agent, ctx, String(responseText), metrics, "output");
        break; // Guardrails passed
      } catch (err: unknown) {
        if (!(err instanceof PolicyViolation) || correctionAttempts >= maxCorrections) {
          throw err; // Not a policy violation, or exhausted correction budget
        }

        // Self-correction: retry the agent call with the violation feedback
        correctionAttempts++;
        lastViolation = err;
        ctx.trace.push({
          stage: `correction_attempt:${stage.callee}.${stage.method}:${correctionAttempts}`,
          timestamp: Date.now(),
          result: err.message,
        });

        this.telemetry.record({
          runId: ctx.runId!,
          timestamp: Date.now(),
          type: "node_start",
          stage: `${stageName}:correction:${correctionAttempts}`,
          payload: { violation: err.message, attempt: correctionAttempts },
        });

        // Append the violation feedback to the prompt so the LLM can correct
        const correctionPrompt = `${fullPromptText}\n\n[CORRECTION REQUIRED] Your previous response was rejected by a policy:\n"${err.message}"\nPlease fix your response to comply with this constraint.`;

        if (this.mocks) {
          // In mock mode, the mock always returns the same thing — can't self-correct
          // Just rethrow after logging the attempt
          throw err;
        }

        const correctionResult = await this.callLLM(agent, correctionPrompt, ctx) as { text: string, metrics: any };
        responseText = correctionResult.text;
        metrics = correctionResult.metrics;
      }
    }

    const durationMs = Date.now() - startTime;
    this.telemetry.record({ 
      runId: ctx.runId!, 
      timestamp: Date.now(), 
      type: "node_end", 
      stage: stageName, 
      payload: responseText,
      metrics: { durationMs, tokens: metrics?.completionTokens }
    });

    return responseText;
  }

  private interpolate(str: string, ctx: ExecutionContext): string {
    const regex = new RegExp("\\{\\{context\\.([a-zA-Z0-9_.]+)\\}\\}", "g");
    return str.replace(regex, (match, path) => {
      const val = this.resolveContextRef(`context.${path}`, ctx);
      return val !== undefined ? String(val) : match;
    });
  }

  /** Build prompt from stage args and context. */
  private buildPrompt(
    stage: Extract<PipelineStage, { kind: "call" }>,
    ctx: ExecutionContext,
  ): string {
    if (stage.namedArgs && Object.keys(stage.namedArgs).length > 0) {
      const interpolatedArgs: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(stage.namedArgs)) {
        interpolatedArgs[k] = typeof v === "string" ? this.interpolate(v, ctx) : v;
      }
      return JSON.stringify(interpolatedArgs);
    }

    if (stage.args && stage.args.length > 0) {
      const resolved = stage.args.map(arg => {
        if (typeof arg === "string") {
          if (arg.startsWith("context.")) return this.resolveContextRef(arg, ctx);
          return this.interpolate(arg, ctx);
        }
        return arg;
      });
      return resolved.join(" ");
    }

    return String(ctx.current ?? "");
  }

  /** Execute a System built-in call. */
  private executeSystemCall(
    stage: Extract<PipelineStage, { kind: "call" }>,
    ctx: ExecutionContext,
  ): unknown {
    switch (stage.method) {
      case "Print":
        console.log(ctx.current);
        return ctx.current;

      case "ResolveIncident":
        console.log("Resolved:", ctx.current);
        return ctx.current;

      default:
        throw new LanglyError(`Unknown System.${stage.method}`, "UNKNOWN_SYSTEM_METHOD");
    }
  }

  /** Execute a tool call via the registry. */
  private async executeToolCall(
    stage: Extract<PipelineStage, { kind: "call" }>,
    ctx: ExecutionContext,
  ): Promise<unknown> {
    const tool = this.tools.get(stage.callee);
    if (!tool) throw new ToolNotFoundError(stage.callee);

    const provider = tool.provider;
    const toolConfig: Record<string, unknown> = {};

    // Helper to resolve Env variables
    const resolveEnv = (val: unknown) => {
      if (typeof val === "string" && val.startsWith("Env.")) {
        return Bun.env[val.replace("Env.", "")] ?? "";
      }
      return val;
    };

    // 1. Resolve arguments from the tool declaration itself
    if (tool.args) {
      tool.args.forEach((arg, i) => {
        toolConfig[`arg${i}`] = resolveEnv(arg);
      });
      // Also provide the raw args array in config if tools expect it (like RestTool expects url in args[0])
      toolConfig.__args = tool.args.map(resolveEnv);
    }
    if (tool.namedArgs) {
      for (const [k, v] of Object.entries(tool.namedArgs)) {
        toolConfig[k] = resolveEnv(v);
      }
    }

    // 2. Override with arguments from the pipeline stage call
    if (stage.namedArgs) {
      for (const [k, v] of Object.entries(stage.namedArgs)) {
         toolConfig[k] = typeof v === "string" ? resolveEnv(this.interpolate(v, ctx)) : v;
      }
    }

    const toolPlugin = this.toolRegistry.get(provider);
    if (!toolPlugin) throw new ProviderNotFoundError(provider);

    // If __args exists, use it, otherwise use the declaration args directly
    const execArgs = (toolConfig.__args as string[]) ?? tool.args.map(a => String(resolveEnv(a)));
    return await toolPlugin.execute(execArgs, toolConfig, ctx);
  }

  /** Resolve API key from config or env. */
  private resolveApiKey(config: Record<string, unknown>): string | undefined {
    const keyName = config.apiKey as string;
    if (keyName?.startsWith("Env.")) {
      const envVar = keyName.replace("Env.", "");
      return Bun.env[envVar];
    }
    return this.config.apiKey ?? Bun.env.LANGLY_API_KEY;
  }

  /** Build URL for tool calls. */
  private buildToolUrl(baseUrl: string, config: Record<string, unknown>): string {
    let url = baseUrl;
    for (const [key, value] of Object.entries(config)) {
      if (key !== "apiKey" && key !== "method") {
        url = url.replace(`{{${key}}}`, String(value));
      }
    }
    return url.startsWith("http") ? url : `https://${url}`;
  }

  /** Build request body for tool calls. */
  private buildToolBody(config: Record<string, unknown>): Record<string, unknown> {
    const body: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(config)) {
      if (key !== "apiKey" && key !== "method") {
        body[key] = value;
      }
    }
    return body;
  }

  /**
   * Apply policies to text, filtered by execution phase.
   * - "input": runs policies with phase "input" or "both" (before LLM)
   * - "output": runs policies with phase "output" or "both" (after LLM)
   */
  private async applyGuardrails(
    agent: Agent,
    ctx: ExecutionContext,
    textToCheck: string,
    metrics?: { duration: number; completionTokens: number },
    phase: "input" | "output" = "output",
  ): Promise<string> {
    if (!agent.requires) return textToCheck;

    let currentText = textToCheck;
    for (const guardrailName of agent.requires) {
      const policy = this.policies.get(guardrailName);
      if (!policy) continue;

      for (const rule of policy.rules) {
        // Check if this plugin should run in the current phase
        const plugin = this.guardrailRegistry.get(rule.name);
        if (plugin) {
          const pluginPhase = plugin.phase ?? "output";
          const shouldRun =
            pluginPhase === "both" ||
            pluginPhase === phase;
          if (!shouldRun) continue;
        }

        currentText = await this.applyGuardrailRule(rule, ctx, currentText, metrics);
      }
    }
    return currentText;
  }

  /** Apply a single policy rule. */
  private async applyGuardrailRule(
    rule: { name: string; args: string[] },
    ctx: ExecutionContext,
    textToCheck: string,
    metrics?: { duration: number; completionTokens: number }
  ): Promise<string> {
    const plugin = this.guardrailRegistry.get(rule.name);
    if (!plugin) {
      console.warn(`[Policy] Unknown rule: ${rule.name}`);
      return textToCheck;
    }
    
    const result = await plugin.apply(textToCheck, rule.args, ctx, metrics);
    return result;
  }

  /** Evaluate a gate condition. */
  private evaluateCondition(condition: string, ctx: ExecutionContext): boolean {
    const comparison = condition.match(/^(.+?)\s*(==|!=|>|<|>=|<=)\s*(.+)$/);
    if (comparison) {
      const left = this.resolveConditionValue(comparison[1] ?? "", ctx);
      const op = comparison[2] ?? "==";
      const right = this.resolveConditionValue(comparison[3] ?? "", ctx);
      return this.compare(left, op, right);
    }
    
    const val = this.resolveConditionValue(condition, ctx);
    return val === true || val === "true";
  }

  private resolveConditionValue(expr: string, ctx: ExecutionContext): unknown {
    expr = expr.trim();
    if (expr.startsWith("context.")) {
      return this.resolveContextRef(expr, ctx);
    }
    // Also support checking raw input directly if not prefixed with context.input
    if (ctx.input[expr] !== undefined) {
      return ctx.input[expr];
    }
    return this.parseValue(expr);
  }

  /** Parse a value from string. */
  private parseValue(s: string): unknown {
    s = s.replace(/^["']|["']$/g, "");
    if (s === "true") return true;
    if (s === "false") return false;
    if (s === "undefined") return undefined;
    if (!isNaN(Number(s))) return Number(s);
    return s;
  }

  /** Compare two values. */
  private compare(l: unknown, op: string, r: unknown): boolean {
    switch (op) {
      case "==": return l == r;
      case "!=": return l != r;
      case ">": return Number(l) > Number(r);
      case "<": return Number(l) < Number(r);
      case ">=": return Number(l) >= Number(r);
      case "<=": return Number(l) <= Number(r);
      default: return false;
    }
  }

  /** Execute fan-out (parallel execution). */
  private async executeFanout(
    stage: Extract<PipelineStage, { kind: "fanout" }>,
    ctx: ExecutionContext,
  ): Promise<unknown> {
    const results: unknown[] = [];
    const maxConcurrent = 5;
    // Collect per-branch data writes so we can merge them back safely
    const branchDataSets: Record<string, unknown>[] = [];
    
    for (let i = 0; i < stage.stages.length; i += maxConcurrent) {
      const chunk = stage.stages.slice(i, i + maxConcurrent);
      const chunkPromises = chunk.map(async (subStage) => {
        // Clone context for each branch to prevent shared-state race conditions.
        // Each branch gets its own `data` object and `meta`, but reads from
        // the same snapshot of `input` and `current`.
        const branchCtx: ExecutionContext = {
          input: ctx.input,               // read-only snapshot — safe to share
          data: { ...ctx.data },           // shallow clone — branch writes here
          current: ctx.current,            // read-only starting value
          meta: { ...ctx.meta, calls: [...ctx.meta.calls] },
          trace: [...ctx.trace],
          runId: ctx.runId,
          _callDepth: ctx._callDepth,
          stageIndex: ctx.stageIndex,
          streamName: ctx.streamName,
          _streamSink: ctx._streamSink,    // shared sink is fine — events are append-only
        };

        let result: unknown;
        if (subStage.kind === "call") {
          result = await this.executeCall(subStage, branchCtx);
        } else if (subStage.kind === "expression") {
          result = this.resolveExpression(subStage, branchCtx);
        }

        // Collect the branch's data writes and meta for merging
        branchDataSets.push(branchCtx.data);
        // Merge cost/token metrics back to parent
        ctx.meta.totalCost += branchCtx.meta.totalCost - ctx.meta.totalCost;
        ctx.meta.totalTokens += branchCtx.meta.totalTokens - ctx.meta.totalTokens;
        ctx.meta.calls.push(...branchCtx.meta.calls.slice(ctx.meta.calls.length));
        ctx.trace.push(...branchCtx.trace.slice(ctx.trace.length));

        return result;
      });
      
      const chunkResults = await Promise.all(chunkPromises);
      results.push(...chunkResults);
    }

    // Track method names to detect duplicates
    const methodCounts = new Map<string, number>();
    stage.stages.forEach((subStage) => {
      if (subStage.kind === "call") {
        const key = `${subStage.callee}.${subStage.method}`;
        methodCounts.set(key, (methodCounts.get(key) ?? 0) + 1);
      }
    });

    // Merge branch results into the parent context
    stage.stages.forEach((subStage, index) => {
      if (subStage.kind === "call") {
        const baseKey = `${subStage.callee}.${subStage.method}`;
        // Always store with index suffix
        ctx.data[`${baseKey}_${index}`] = results[index];
        // Also store without index if method name is unique in this fan-out
        if (methodCounts.get(baseKey) === 1) {
          ctx.data[baseKey] = results[index];
          ctx.data[subStage.callee] = results[index];
          ctx.data[subStage.method] = results[index];
        }
      }
    });

    // Also merge any data keys that branches wrote (e.g. storeResult writes)
    for (const branchData of branchDataSets) {
      for (const [key, value] of Object.entries(branchData)) {
        if (!(key in ctx.data)) {
          ctx.data[key] = value;
        }
      }
    }

    return results;
  }

  /** Execute interrupt (yield for human input). */
  private async executeInterrupt(
    stage: Extract<PipelineStage, { kind: "interrupt" }>,
    ctx: ExecutionContext,
  ): Promise<unknown> {
    console.log(`[Interrupt] Yielding:`, stage.args);
    console.log(`[Interrupt] Context:`, ctx.current);
    ctx.targetSignal = "resume"; // Internal generic yield
    return new SuspendedRun(ctx.runId!, stage.args);
  }

  /** Execute listener (wait for external event). */
  private async executeListen(
    stage: Extract<PipelineStage, { kind: "listen" }>,
    ctx: ExecutionContext,
  ): Promise<unknown> {
    console.log(`[Listen] Waiting for:`, stage.target);
    const target = stage.target.replace(/^["']|["']$/g, "");
    ctx.targetSignal = target;
    return new SuspendedRun(ctx.runId!, { target });
  }

  /** Execute with timeout. */
  private async withTimeout(
    fn: () => Promise<unknown>,
    timeoutValue: string,
  ): Promise<unknown> {
    const ms = this.parseDuration(timeoutValue);
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new LanglyTimeoutError(timeoutValue)), ms);
    });
    return Promise.race([fn(), timeout]);
  }

  /** Parse duration string like "5m", "30s", "1h" to milliseconds. */
  private parseDuration(d: string): number {
    const match = d.match(/^(\d+)([smhd])$/);
    if (!match || match.length < 3) return 0;
    const num = match[1];
    const unit = match[2];
    if (!num || !unit) return 0;
    const n = parseInt(num);
    switch (unit) {
      case "s": return n * 1000;
      case "m": return n * 60 * 1000;
      case "h": return n * 60 * 60 * 1000;
      case "d": return n * 24 * 60 * 60 * 1000;
      default: return 0;
    }
  }

  /** Call LLM using adapter system with router. */
  private async callLLM(
    agent: Agent,
    prompt: string,
    ctx: ExecutionContext,
  ): Promise<unknown> {
    const modelId = agent.modelId;
    const apiKey = this.config.apiKey ?? Bun.env.LANGLY_API_KEY;
    
    if (!apiKey) {
      throw new ApiKeyMissingError();
    }

    // Use router to select best model (if routing is configured)
    let selectedModel = modelId;
    let estimatedCost = 0;
    
    if (this.config.router) {
      try {
        const routingResult = await this.router.route(
          modelId,
          JSON.stringify(ctx.input).length, // Approximate input tokens
          4096, // Estimated output tokens
        );
        selectedModel = routingResult.model;
        estimatedCost = routingResult.estimatedCost;
        console.log(`[Router] ${routingResult.reason}`);
      } catch (e) {
        console.log(`[Router] Failed to route, using original model: ${e}`);
      }
    }

    // Find the adapter for this model
    const adapter = this.adapterRegistry.findAdapter(selectedModel);
    if (!adapter) {
      throw new AdapterNotFoundError(selectedModel);
    }

    // Build request
    const temperature = parseFloat(String(agent.params["temp"] ?? "0.7"));
    const maxTokens = agent.params["max_tokens"] ? parseInt(agent.params["max_tokens"]) : undefined;
    const topP = agent.params["top_p"] ? parseFloat(agent.params["top_p"]) : undefined;

    // Build messages: prepend system prompt if agent declares one
    const messages: Array<{ role: string; content: string }> = [];
    if (agent.system) {
      messages.push({ role: "system", content: agent.system });
    }
    messages.push({ role: "user", content: prompt });

    const request: LLMRequest = {
      model: selectedModel, // Adapter's transformRequest handles ID transformation
      messages,
      temperature,
      maxTokens,
      topP,
      apiKey, // Pass API key for adapters that need it in the body
    };

    // Call the adapter
    const startTime = Date.now();
    const response = await this.callAdapter(adapter, request, apiKey, ctx);
    const duration = Date.now() - startTime;
    
    // Track cost
    if (response.usage) {
      const actualCost = adapter.estimateCost
        ? adapter.estimateCost(selectedModel, response.usage.promptTokens ?? 0, response.usage.completionTokens ?? 0)
        : estimatedCost;
      this.costTracker.recordUsage(selectedModel, actualCost);
    }

    // Populate context.meta with call metrics
    const callCost = response.usage
      ? (adapter.estimateCost
          ? adapter.estimateCost(selectedModel, response.usage.promptTokens ?? 0, response.usage.completionTokens ?? 0)
          : estimatedCost)
      : 0;
    const callTokens = (response.usage?.promptTokens ?? 0) + (response.usage?.completionTokens ?? 0);
    ctx.meta.totalCost += callCost;
    ctx.meta.totalTokens += callTokens;
    ctx.meta.lastLatency = duration;
    ctx.meta.stageCount++;
    ctx.meta.calls.push({ model: selectedModel, tokens: callTokens, cost: callCost, latency: duration });

    return { 
      text: response.text, 
      metrics: { duration, completionTokens: response.usage?.completionTokens ?? 0 } 
    };
  }

  /** Call an adapter with proper error handling. */
  private async callAdapter(
    adapter: ProviderAdapter,
    request: LLMRequest,
    apiKey: string,
    ctx?: ExecutionContext,
  ): Promise<LLMResponse> {
    if (ctx && ctx._streamSink && adapter.parseStreamChunk) {
      request.pipeline = true;
    }

    const url = adapter.getUrlWithApiKey
      ? adapter.getUrlWithApiKey(request.model, apiKey)
      : adapter.getUrl(request.model);
    const headers = adapter.getHeaders(apiKey);
    const body = adapter.transformRequest(request);

    const res = await Bun.fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new LanglyError(`LLM API error (${res.status}): ${text}`, "LLM_API_ERROR");
    }

    if (request.pipeline && res.body && adapter.parseStreamChunk) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let fullText = "";
      let buffer = "";
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            const token = adapter.parseStreamChunk(data);
            if (token) {
              fullText += token;
              if (ctx?._streamSink) {
                ctx._streamSink.push({ type: "token", text: token, stage: ctx.streamName ?? "unknown" });
              }
            }
          }
        }
      }
      return { text: fullText, raw: null };
    }

    const json = await res.json();
    return adapter.parseResponse(json);
  }

  /** Get cost tracker for usage tracking. */
  getCostTracker(): CostTracker {
    return this.costTracker;
  }
}

/** CollectingErrorListener for ANTLR4 */
class CollectingErrorListener {
  errors: string[] = [];
  syntaxError(
    _recognizer: unknown,
    offendingSymbol: unknown,
    line: number,
    charPositionInLine: number,
    msg: string,
    _e: unknown,
  ): void {
    const symbol = offendingSymbol as { text?: string };
    const tokenText = symbol?.text ?? "<missing>";
    this.errors.push(`[${line}:${charPositionInLine}] ${msg} near "${tokenText}"`);
  }
  reportAmbiguity(..._args: unknown[]): void {}
  reportAttemptingFullContext(..._args: unknown[]): void {}
  reportContextSensitivity(..._args: unknown[]): void {}
}

