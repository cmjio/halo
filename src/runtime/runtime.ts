/**
 * Langly Runtime — executes a parsed AST.
 *
 * Execution model:
 *   1. Register all `mind` and `stream` definitions.
 *   2. Maintain a `context` object that accumulates results from each stage.
 *   3. Use adapters to call different LLM providers.
 *   4. Use router to optimize model selection based on cost/performance.
 */

import type {
  ParseResult,
  Mind,
  StreamDeclaration,
  PipelineStage,
  GuardrailDeclaration,
  ToolDeclaration,
  MemoryDeclaration,
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

// ── Runtime configuration ─────

export interface RuntimeConfig {
  /** LLM API key (env var fallback: LANGLY_API_KEY) */
  apiKey?: string;
  /** Router configuration for model selection */
  router?: RouterConfig;
}

// ── Context ─────

interface ExecutionContext {
  /** Input arguments to the stream */
  input: Record<string, unknown>;
  /** Accumulated results from each pipeline stage */
  data: Record<string, unknown>;
  /** Current pipeline result (passed to next stage) */
  current: unknown;
}

// ── Mock table ─────

interface MockTable {
  responses: Record<string, string>;
}

// ── Runtime ─────

export class LanglyRuntime {
  private minds = new Map<string, Mind>();
  private streams = new Map<string, StreamDeclaration>();
  private guardrails = new Map<string, GuardrailDeclaration>();
  private tools = new Map<string, ToolDeclaration>();
  private memories = new Map<string, MemoryDeclaration>();
  private config: RuntimeConfig;
  private mocks: MockTable | null = null;
  private adapterRegistry = new AdapterRegistry();
  private router: LLMRouter;
  private costTracker = new CostTracker();

  constructor(config: RuntimeConfig = {}) {
    this.config = config;
    this.router = new LLMRouter(config.router);
  }

  /** Load a parsed program into the runtime. */
  load(ast: ParseResult): this {
    for (const m of ast.minds) this.minds.set(m.name, m);
    for (const s of ast.streams) this.streams.set(s.name, s);
    for (const g of ast.guardrails) this.guardrails.set(g.name, g);
    for (const t of ast.tools) this.tools.set(t.name, t);
    for (const m of ast.memories) this.memories.set(m.name, m);
    return this;
  }

  /** Register a custom adapter */
  registerAdapter(adapter: ProviderAdapter): this {
    this.adapterRegistry.register(adapter);
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

  /** Execute a named stream with the provided arguments. */
  async execute(
    streamName: string,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    const stream = this.streams.get(streamName);
    if (!stream) throw new Error(`Stream "${streamName}" not found`);

    // Initialize execution context
    const ctx: ExecutionContext = {
      input: { ...args },
      data: {},
      current: Object.values(args)[0] ?? "",
    };

    // Apply stream-level directives (timeout, retry)
    const timeout = stream.directives.find(d => d.name === "timeout");
    
    const executeWithDirectives = async (): Promise<unknown> => {
      return await this.executePipeline(stream.pipeline, ctx);
    };

    let result: unknown;
    if (timeout) {
      result = await this.withTimeout(executeWithDirectives, timeout.value);
    } else {
      result = await executeWithDirectives();
    }

    return result;
  }

  /** Execute a pipeline stage by stage. */
  private async executePipeline(
    stages: PipelineStage[],
    ctx: ExecutionContext,
  ): Promise<unknown> {
    for (const stage of stages) {
      switch (stage.kind) {
        case "expression":
          ctx.current = this.resolveExpression(stage, ctx);
          break;

        case "call":
          ctx.current = await this.executeCall(stage, ctx);
          this.storeResult(ctx, stage);
          break;

        case "gate":
          if (!this.evaluateCondition(stage.condition, ctx)) {
            return ctx.current;
          }
          break;

        case "fanout":
          ctx.current = await this.executeFanout(stage, ctx);
          break;

        case "interrupt":
          ctx.current = await this.executeInterrupt(stage, ctx);
          break;

        case "listen":
          ctx.current = await this.executeListen(stage, ctx);
          break;
      }
    }
    return ctx.current;
  }

  /** Store result in context for later reference. */
  private storeResult(ctx: ExecutionContext, stage: { callee: string; method: string }): void {
    const key = `${stage.callee}.${stage.method}`;
    ctx.data[key] = ctx.current;
    ctx.data[stage.callee] = ctx.current;
  }

  /** Resolve an expression (identifier lookup in context/input). */
  private resolveExpression(
    stage: Extract<PipelineStage, { kind: "expression" }>,
    ctx: ExecutionContext,
  ): unknown {
    const value = stage.value;

    if (value in ctx.data) return ctx.data[value];
    if (value in ctx.input) return ctx.input[value];

    if (value.startsWith("context.")) {
      return this.resolveContextRef(value, ctx);
    }

    throw new Error(`Undefined variable "${value}"`);
  }

  /** Resolve a context reference like "context.data.mind.result" */
  private resolveContextRef(ref: string, ctx: ExecutionContext): unknown {
    const path = ref.replace(/^context\./, "");
    const parts = path.split(".");
    
    let current: unknown = ctx;
    for (const part of parts) {
      if (current && typeof current === "object") {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }
    return current;
  }

  /** Execute a call stage (mind method or system call). */
  private async executeCall(
    stage: Extract<PipelineStage, { kind: "call" }>,
    ctx: ExecutionContext,
  ): Promise<unknown> {
    // Built-in: System methods
    if (stage.callee === "System") {
      return this.executeSystemCall(stage, ctx);
    }

    // Check if it's a tool call
    if (this.tools.has(stage.callee)) {
      return this.executeToolCall(stage, ctx);
    }

    // LLM mind call
    const mind = this.minds.get(stage.callee);
    if (!mind) throw new Error(`Mind "${stage.callee}" not found`);

    const promptText = this.buildPrompt(stage, ctx);
    await this.applyGuardrails(mind, ctx, promptText);

    // Check mocks
    if (this.mocks) {
      const mockKey = `${stage.callee}.${stage.method}`;
      if (this.mocks.responses[mockKey] !== undefined) {
        return this.mocks.responses[mockKey];
      }
    }

    return await this.callLLM(mind, promptText, ctx);
  }

  /** Build prompt from stage args and context. */
  private buildPrompt(
    stage: Extract<PipelineStage, { kind: "call" }>,
    ctx: ExecutionContext,
  ): string {
    if (stage.namedArgs && Object.keys(stage.namedArgs).length > 0) {
      return JSON.stringify(stage.namedArgs);
    }

    if (stage.args && stage.args.length > 0) {
      const resolved = stage.args.map(arg => {
        if (typeof arg === "string" && arg.startsWith("context.")) {
          return this.resolveContextRef(arg, ctx);
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
        throw new Error(`Unknown System.${stage.method}`);
    }
  }

  /** Execute a tool call (REST, POST, VectorStore, etc.). */
  private async executeToolCall(
    stage: Extract<PipelineStage, { kind: "call" }>,
    ctx: ExecutionContext,
  ): Promise<unknown> {
    const tool = this.tools.get(stage.callee);
    if (!tool) throw new Error(`Tool "${stage.callee}" not found`);

    const provider = tool.provider;
    const toolConfig: Record<string, unknown> = {};
    if (stage.namedArgs) {
      Object.assign(toolConfig, stage.namedArgs);
    }

    if (provider.startsWith("REST(")) {
      const url = provider.match(/REST\("(.+?)"\)/)?.[1] ?? "";
      return await this.callREST(url, toolConfig, ctx);
    }

    if (provider.startsWith("POST(")) {
      const url = provider.match(/POST\("(.+?)"\)/)?.[1] ?? "";
      return await this.callPOST(url, toolConfig, ctx);
    }

    if (provider.startsWith("VectorStore(")) {
      return this.callVectorStore(tool.provider, toolConfig, ctx);
    }

    if (provider.startsWith("PostgreSQL(")) {
      return this.callPostgreSQL(tool.provider, toolConfig, ctx);
    }

    throw new Error(`Unknown tool provider: ${provider}`);
  }

  /** Call a REST API tool. */
  private async callREST(
    baseUrl: string,
    config: Record<string, unknown>,
    _ctx: ExecutionContext,
  ): Promise<unknown> {
    const apiKey = this.resolveApiKey(config);
    const url = this.buildToolUrl(baseUrl, config);
    
    const res = await Bun.fetch(url, {
      method: "GET",
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    });

    if (!res.ok) {
      throw new Error(`REST API error (${res.status}): ${await res.text()}`);
    }

    return await res.json();
  }

  /** Call a POST API tool. */
  private async callPOST(
    baseUrl: string,
    config: Record<string, unknown>,
    _ctx: ExecutionContext,
  ): Promise<unknown> {
    const apiKey = this.resolveApiKey(config);
    const url = this.buildToolUrl(baseUrl, config);
    const body = this.buildToolBody(config);
    
    const res = await Bun.fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`POST API error (${res.status}): ${await res.text()}`);
    }

    return await res.json();
  }

  /** Call a VectorStore tool (simplified). */
  private async callVectorStore(
    _provider: string,
    config: Record<string, unknown>,
    _ctx: ExecutionContext,
  ): Promise<unknown> {
    const method = config.method as string;
    if (method === "log" || method === "search") {
      return { result: `VectorStore ${method} called`, ...config };
    }
    return { result: "VectorStore operation not implemented" };
  }

  /** Call a PostgreSQL tool (simplified). */
  private async callPostgreSQL(
    _provider: string,
    _config: Record<string, unknown>,
    _ctx: ExecutionContext,
  ): Promise<unknown> {
    return { result: "PostgreSQL query not implemented" };
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

  /** Apply guardrails to a mind before calling it. */
  private async applyGuardrails(
    mind: Mind,
    ctx: ExecutionContext,
    textToCheck?: string,
  ): Promise<void> {
    if (!mind.requires) return;

    for (const guardrailName of mind.requires) {
      const guardrail = this.guardrails.get(guardrailName);
      if (!guardrail) continue;

      for (const rule of guardrail.rules) {
        await this.applyGuardrailRule(rule, ctx, textToCheck);
      }
    }
  }

  /** Apply a single guardrail rule. */
  private async applyGuardrailRule(
    rule: { name: string; args: string[] },
    ctx: ExecutionContext,
    textToCheck?: string,
  ): Promise<void> {
    const text = textToCheck ?? String(ctx.current ?? "");
    
    switch (rule.name) {
      case "Block":
        if (rule.args.includes("Profanity")) {
          if (this.containsProfanity(text)) {
            throw new Error("Content blocked: Profanity detected");
          }
        }
        if (rule.args.includes("DestructiveOps")) {
          if (this.containsDestructiveOps(text)) {
            throw new Error("Content blocked: Destructive operations not allowed");
          }
        }
        break;

      case "MaxWords":
        const maxWords = parseInt(rule.args[0] ?? "0");
        const wordCount = text.split(/\s+/).length;
        if (wordCount > maxWords) {
          throw new Error(`Content exceeds max words: ${wordCount} > ${maxWords}`);
        }
        break;

      case "Redact":
        console.log(`[Guardrail] Redacting: ${rule.args.join(", ")}`);
        break;

      case "LogViolation":
        console.log(`[Guardrail] Violation logged`);
        break;

      case "MaxSpend":
        const maxSpend = parseFloat(rule.args[0] ?? "0");
        console.log(`[Guardrail] Max spend: $${maxSpend}`);
        break;
    }
  }

  /** Check for profanity (simplified - word boundary check). */
  private containsProfanity(text: string): boolean {
    const badWords = ["damn", "shit", "fuck"];
    const lower = text.toLowerCase();
    return badWords.some(w => {
      const regex = new RegExp(`\\b${w}\\b`, 'i');
      return regex.test(lower);
    });
  }

  /** Check for destructive operations. */
  private containsDestructiveOps(text: string): boolean {
    const ops = ["DROP", "DELETE", "TRUNCATE", "rm -rf"];
    return ops.some(op => text.includes(op));
  }

  /** Evaluate a gate condition. */
  private evaluateCondition(condition: string, ctx: ExecutionContext): boolean {
    let expr = condition;
    
    // Replace context.data.* references
    expr = expr.replace(/context\.data\.(\w+)/g, (_, key) => {
      const val = ctx.data[key];
      return val !== undefined ? JSON.stringify(val) : "undefined";
    });

    // Replace input references
    expr = expr.replace(/\b(\w+)\b/g, (match) => {
      if (ctx.input[match] !== undefined) {
        return JSON.stringify(ctx.input[match]);
      }
      return match;
    });

    // Evaluate simple comparisons
    const comparison = expr.match(/^(.+?)\s*(==|!=|>|<|>=|<=)\s*(.+)$/);
    if (comparison) {
      const left = comparison[1];
      const op = comparison[2];
      const right = comparison[3];
      if (left && op && right) {
        const lval = this.parseValue(left.trim());
        const rval = this.parseValue(right.trim());
        return this.compare(lval, op, rval);
      }
    }

    const boolVal = this.parseValue(expr);
    return boolVal === true || boolVal === "true";
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
    const promises = stage.stages.map(async (subStage) => {
      if (subStage.kind === "call") {
        return await this.executeCall(subStage, ctx);
      } else if (subStage.kind === "expression") {
        return this.resolveExpression(subStage, ctx);
      }
      return undefined;
    });

    const results = await Promise.all(promises);

    stage.stages.forEach((subStage, index) => {
      if (subStage.kind === "call") {
        const key = `${subStage.callee}.${subStage.method}`;
        ctx.data[key] = results[index];
        ctx.data[subStage.callee] = results[index];
      }
    });

    return results;
  }

  /** Execute interrupt (yield for human input). */
  private async executeInterrupt(
    stage: Extract<PipelineStage, { kind: "interrupt" }>,
    ctx: ExecutionContext,
  ): Promise<unknown> {
    console.log(`[Interrupt] Yielding:`, stage.args);
    console.log(`[Interrupt] Context:`, ctx.current);
    return ctx.current;
  }

  /** Execute listener (wait for external event). */
  private async executeListen(
    stage: Extract<PipelineStage, { kind: "listen" }>,
    _ctx: ExecutionContext,
  ): Promise<unknown> {
    console.log(`[Listen] Waiting for:`, stage.target);
    return { reaction: "approved", source: stage.target };
  }

  /** Execute with timeout. */
  private async withTimeout(
    fn: () => Promise<unknown>,
    timeoutValue: string,
  ): Promise<unknown> {
    const ms = this.parseDuration(timeoutValue);
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Timeout after ${timeoutValue}`)), ms);
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
    mind: Mind,
    prompt: string,
    ctx: ExecutionContext,
  ): Promise<unknown> {
    const modelId = mind.modelId;
    const apiKey = this.config.apiKey ?? Bun.env.LANGLY_API_KEY;
    
    if (!apiKey) {
      throw new Error(`No API key set for LLM call. Set LANGLY_API_KEY or pass apiKey in RuntimeConfig.`);
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
      throw new Error(`No adapter found for model "${selectedModel}". Register an adapter with runtime.registerAdapter().`);
    }

    // Build request
    const temperature = parseFloat(String(mind.params["temp"] ?? "0.7"));
    const request: LLMRequest = {
      model: selectedModel, // Adapter's transformRequest handles ID transformation
      messages: [{ role: "user", content: prompt }],
      temperature,
      apiKey, // Pass API key for adapters that need it in the body
    };

    // Call the adapter
    const response = await this.callAdapter(adapter, request, apiKey);
    
    // Track cost
    if (response.usage) {
      const actualCost = adapter.estimateCost
        ? adapter.estimateCost(selectedModel, response.usage.promptTokens ?? 0, response.usage.completionTokens ?? 0)
        : estimatedCost;
      this.costTracker.recordUsage(selectedModel, actualCost);
    }

    return response.text;
  }

  /** Call an adapter with proper error handling. */
  private async callAdapter(
    adapter: ProviderAdapter,
    request: LLMRequest,
    apiKey: string,
  ): Promise<LLMResponse> {
    const url = adapter.getUrl(request.model);
    const headers = adapter.getHeaders(apiKey);
    const body = adapter.transformRequest(request);

    const res = await Bun.fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`LLM API error (${res.status}): ${text}`);
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

/** Parse function using ANTLR4 */
export function parse(source: string): ParseResult {
  // This is a placeholder - the actual implementation is in src/parser/index.ts
  throw new Error("Use src/parser/index.ts for parsing");
}
