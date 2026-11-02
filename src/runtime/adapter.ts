/**
 * LLM Provider Adapters
 *
 * Each adapter handles a specific AI provider's API format,
 * authentication, and response parsing.
 */

// ── Adapter Interface ─────

/** A tool the model may call, by a name made of letters, digits, `_` and `-`. */
export interface LLMToolSpec {
  name: string;
  description: string;
  /** JSON Schema of its arguments (an object). */
  parameters: Record<string, unknown>;
}

/** A call the model asked for. `id` pairs it with its result. */
export interface LLMToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

/**
 * A conversation turn. An assistant turn that asked for tools carries them in
 * `toolCalls` (and `raw`, the adapter's own form of the turn, which some APIs
 * need sent back unchanged); each result is a `tool` turn.
 */
export type LLMMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string; toolCalls?: LLMToolCall[]; raw?: unknown }
  | { role: "tool"; toolCallId: string; name: string; content: string };

export interface LLMRequest {
  model: string;
  messages: LLMMessage[];
  /** Tools the model may call. */
  tools?: LLMToolSpec[];
  /** "none" asks for an answer without tool calls (the tools stay declared, since the conversation already used them). */
  toolChoice?: "auto" | "none";
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stream?: boolean;
  [key: string]: unknown;
}

export interface LLMResponse {
  text: string;
  /** Tools the model asked to call before answering. */
  toolCalls?: LLMToolCall[];
  /** The assistant turn in the adapter's own form, sent back as is on the next request. */
  rawMessage?: unknown;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  raw?: unknown;
}

export interface ModelInfo {
  id: string;
  name: string;
  costPer1kTokens?: { input: number; output: number };
  contextWindow?: number;
  supportsStreaming?: boolean;
}

export interface ProviderAdapter {
  /** Unique provider ID */
  id: string;

  /** Environment variables checked (in order) for this provider's API key. */
  envKeys?: string[];

  /** False for providers that need no key (e.g. local Ollama). Defaults to true. */
  requiresApiKey?: boolean;

  /** False when the API can't call tools (agents with `tools:` then fail with a clear error). Defaults to true. */
  supportsTools?: boolean;

  /** Check if this adapter can handle the given model ID */
  canHandle(modelId: string): boolean;

  /** Build the API URL for the request */
  getUrl(modelId: string): string;

  /** Build request headers */
  getHeaders(apiKey: string): Record<string, string>;

  /** Transform Halo request to provider-specific format */
  transformRequest(req: LLMRequest): unknown;

  /** Parse provider response to standard format */
  parseResponse(response: unknown): LLMResponse;

  /** Estimate cost in USD for a request (used for cost tracking and MaxSpend) */
  estimateCost?(modelId: string, inputTokens: number, outputTokens: number): number;

  /** List available models (optional) */
  listModels?(): Promise<ModelInfo[]>;
}

type Costs = Record<string, { in: number; out: number }>;

function lookupCost(costs: Costs, model: string, fallback: { in: number; out: number }): { in: number; out: number } {
  if (costs[model]) return costs[model];
  // Match dated or suffixed variants, e.g. "gpt-4o-2024-08-06" → "gpt-4o".
  const prefix = Object.keys(costs)
    .filter((k) => model.startsWith(k))
    .sort((a, b) => b.length - a.length)[0];
  return prefix ? costs[prefix]! : fallback;
}

function perK(cost: { in: number; out: number }, inputTokens: number, outputTokens: number): number {
  return (inputTokens / 1000) * cost.in + (outputTokens / 1000) * cost.out;
}

function stripPrefix(model: string, prefixes: string[]): string {
  for (const p of prefixes) if (model.startsWith(p)) return model.slice(p.length);
  return model;
}

/** Tool arguments arrive as a JSON string from most APIs; a model that writes bad JSON gets an empty object plus the text. */
function parseArgs(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw !== "string" || !raw.trim()) return {};
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" && !Array.isArray(v) ? v : { value: v };
  } catch {
    return { _unparsed: raw };
  }
}

let callIds = 0;
const newCallId = () => `call_${Date.now().toString(36)}_${(callIds++).toString(36)}`;

/** Drop undefined fields so providers don't reject `null`/missing params. */
function compact<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

// ── OpenAI-compatible base ─────

export interface OpenAICompatibleOptions {
  id: string;
  prefixes: string[];
  baseUrl: string;
  envKeys?: string[];
  requiresApiKey?: boolean;
  headers?: Record<string, string>;
}

/** Any provider exposing the OpenAI `/chat/completions` API (Groq, vLLM, LM Studio, ...). */
export class OpenAICompatibleAdapter implements ProviderAdapter {
  id: string;
  envKeys?: string[];
  requiresApiKey?: boolean;
  protected prefixes: string[];
  protected baseUrl: string;
  protected extraHeaders: Record<string, string>;

  constructor(options: OpenAICompatibleOptions) {
    this.id = options.id;
    this.prefixes = options.prefixes;
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.envKeys = options.envKeys;
    this.requiresApiKey = options.requiresApiKey;
    this.extraHeaders = options.headers ?? {};
  }

  canHandle(modelId: string): boolean {
    return this.prefixes.some((p) => modelId.startsWith(p));
  }

  getUrl(_modelId: string): string {
    return `${this.baseUrl}/chat/completions`;
  }

  getHeaders(apiKey: string): Record<string, string> {
    return {
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      "Content-Type": "application/json",
      ...this.extraHeaders,
    };
  }

  transformRequest(req: LLMRequest): unknown {
    return compact({
      model: stripPrefix(req.model, this.prefixes),
      messages: req.messages.map((m) => {
        if (m.role === "tool") return { role: "tool", tool_call_id: m.toolCallId, content: m.content };
        if (m.role === "assistant" && m.toolCalls?.length) {
          return {
            role: "assistant",
            content: m.content || null,
            tool_calls: m.toolCalls.map((c) => ({ id: c.id, type: "function", function: { name: c.name, arguments: JSON.stringify(c.args) } })),
          };
        }
        return { role: m.role, content: m.content };
      }),
      tools: req.tools?.length ? req.tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } })) : undefined,
      tool_choice: req.tools?.length && req.toolChoice === "none" ? "none" : undefined,
      temperature: req.temperature,
      max_tokens: req.maxTokens,
      top_p: req.topP,
      stream: req.stream,
    });
  }

  parseResponse(json: unknown): LLMResponse {
    const response = json as {
      choices?: Array<{ message?: { content?: string | null; tool_calls?: Array<{ id?: string; function?: { name?: string; arguments?: unknown } }> } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };
    const calls = response.choices?.[0]?.message?.tool_calls ?? [];

    return {
      text: response.choices?.[0]?.message?.content ?? "",
      toolCalls: calls.length ? calls.map((c) => ({ id: c.id ?? newCallId(), name: c.function?.name ?? "", args: parseArgs(c.function?.arguments) })) : undefined,
      usage: {
        promptTokens: response.usage?.prompt_tokens,
        completionTokens: response.usage?.completion_tokens,
        totalTokens: response.usage?.total_tokens,
      },
      raw: json,
    };
  }

  estimateCost(_modelId: string, _inputTokens: number, _outputTokens: number): number {
    return 0;
  }
}

// ── OpenAI Adapter ─────

export class OpenAIAdapter extends OpenAICompatibleAdapter {
  constructor(options: { baseUrl?: string } = {}) {
    super({ id: "openai", prefixes: ["openai/", "oai/"], baseUrl: options.baseUrl ?? "https://api.openai.com/v1", envKeys: ["OPENAI_API_KEY"] });
  }

  override canHandle(modelId: string): boolean {
    return super.canHandle(modelId) || /^(?:gpt-|o\d|chatgpt-)/.test(modelId);
  }

  override transformRequest(req: LLMRequest): unknown {
    const body = super.transformRequest(req) as Record<string, unknown>;
    body.temperature = req.temperature ?? 0.7;
    return body;
  }

  override estimateCost(modelId: string, inputTokens: number, outputTokens: number): number {
    const costs: Costs = {
      "gpt-4o-mini": { in: 0.00015, out: 0.0006 },
      "gpt-4o": { in: 0.005, out: 0.015 },
      "gpt-4-turbo": { in: 0.01, out: 0.03 },
      "gpt-3.5-turbo": { in: 0.0015, out: 0.002 },
    };
    return perK(lookupCost(costs, stripPrefix(modelId, this.prefixes), { in: 0.01, out: 0.03 }), inputTokens, outputTokens);
  }
}

// ── Anthropic Adapter ─────

export class AnthropicAdapter implements ProviderAdapter {
  id = "anthropic";
  envKeys = ["ANTHROPIC_API_KEY"];
  private prefixes = ["anthropic/", "claude/"];

  constructor(private options: { baseUrl?: string } = {}) {}

  canHandle(modelId: string): boolean {
    return this.prefixes.some((p) => modelId.startsWith(p)) || modelId.startsWith("claude-");
  }

  getUrl(_modelId: string): string {
    return `${this.options.baseUrl ?? "https://api.anthropic.com"}/v1/messages`;
  }

  getHeaders(apiKey: string): Record<string, string> {
    return {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    };
  }

  transformRequest(req: LLMRequest): unknown {
    const system = req.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
    return compact({
      model: stripPrefix(req.model, this.prefixes),
      system: system || undefined,
      messages: anthropicMessages(req.messages),
      tools: req.tools?.length ? req.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters })) : undefined,
      tool_choice: req.tools?.length && req.toolChoice === "none" ? { type: "none" } : undefined,
      max_tokens: req.maxTokens ?? 4096,
      temperature: req.temperature,
      top_p: req.topP,
      stream: req.stream,
    });
  }

  parseResponse(json: unknown): LLMResponse {
    const response = json as {
      content?: Array<{ type?: string; text?: string; id?: string; name?: string; input?: unknown }>;
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const uses = (response.content ?? []).filter((c) => c.type === "tool_use");

    return {
      text: (response.content ?? []).filter((c) => c.type === undefined || c.type === "text").map((c) => c.text ?? "").join(""),
      toolCalls: uses.length ? uses.map((c) => ({ id: c.id ?? newCallId(), name: c.name ?? "", args: parseArgs(c.input) })) : undefined,
      rawMessage: uses.length ? response.content : undefined,
      usage: {
        promptTokens: response.usage?.input_tokens,
        completionTokens: response.usage?.output_tokens,
      },
      raw: json,
    };
  }

  estimateCost(modelId: string, inputTokens: number, outputTokens: number): number {
    const model = stripPrefix(modelId, this.prefixes);
    const family = /opus/.test(model) ? { in: 0.015, out: 0.075 } : /haiku/.test(model) ? { in: 0.0008, out: 0.004 } : { in: 0.003, out: 0.015 };
    return perK(family, inputTokens, outputTokens);
  }
}

/** Anthropic wants tool results as user turns of `tool_result` blocks, with a run of them merged into one turn. */
function anthropicMessages(messages: LLMMessage[]): unknown[] {
  const out: Array<{ role: string; content: unknown }> = [];
  for (const m of messages) {
    if (m.role === "system") continue;
    if (m.role === "tool") {
      const block = { type: "tool_result", tool_use_id: m.toolCallId, content: m.content };
      const last = out.at(-1);
      if (last?.role === "user" && Array.isArray(last.content) && (last.content as Array<{ type?: string }>).every((b) => b.type === "tool_result")) (last.content as unknown[]).push(block);
      else out.push({ role: "user", content: [block] });
    } else if (m.role === "assistant" && m.toolCalls?.length) {
      const blocks = Array.isArray(m.raw)
        ? m.raw
        : [...(m.content ? [{ type: "text", text: m.content }] : []), ...m.toolCalls.map((c) => ({ type: "tool_use", id: c.id, name: c.name, input: c.args }))];
      out.push({ role: "assistant", content: blocks });
    } else if (m.role === "user" && out.at(-1)?.role === "user") {
      // Turns must alternate: a note after tool results joins their turn.
      const last = out.at(-1)!;
      last.content = [...(Array.isArray(last.content) ? last.content : [{ type: "text", text: last.content }]), { type: "text", text: m.content }];
    } else {
      out.push({ role: m.role === "assistant" ? "assistant" : "user", content: m.content });
    }
  }
  return out;
}

// ── Google Gemini Adapter ─────

export class GoogleAdapter implements ProviderAdapter {
  id = "google";
  envKeys = ["GEMINI_API_KEY", "GOOGLE_API_KEY"];

  constructor(private options: { baseUrl?: string } = {}) {}

  canHandle(modelId: string): boolean {
    return modelId.startsWith("google/") || modelId.startsWith("gemini/") || modelId.startsWith("gemini-");
  }

  private modelName(modelId: string): string {
    return stripPrefix(modelId, ["google/", "gemini/"]);
  }

  getUrl(modelId: string): string {
    const base = this.options.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta";
    return `${base}/models/${this.modelName(modelId)}:generateContent`;
  }

  getHeaders(apiKey: string): Record<string, string> {
    return { "Content-Type": "application/json", "x-goog-api-key": apiKey };
  }

  transformRequest(req: LLMRequest): unknown {
    const system = req.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
    return compact({
      systemInstruction: system ? { parts: [{ text: system }] } : undefined,
      contents: googleContents(req.messages),
      tools: req.tools?.length ? [{ functionDeclarations: req.tools.map((t) => ({ name: t.name, description: t.description, parameters: geminiSchema(t.parameters) })) }] : undefined,
      toolConfig: req.tools?.length && req.toolChoice === "none" ? { functionCallingConfig: { mode: "NONE" } } : undefined,
      generationConfig: compact({
        temperature: req.temperature,
        maxOutputTokens: req.maxTokens,
        topP: req.topP,
      }),
    });
  }

  parseResponse(json: unknown): LLMResponse {
    const response = json as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean; functionCall?: { id?: string; name?: string; args?: unknown } }> } }>;
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
    };
    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const calls = parts.filter((p) => p.functionCall);

    return {
      text: parts.filter((p) => !p.functionCall && !p.thought).map((p) => p.text ?? "").join(""),
      toolCalls: calls.length ? calls.map((p) => ({ id: p.functionCall!.id ?? newCallId(), name: p.functionCall!.name ?? "", args: parseArgs(p.functionCall!.args) })) : undefined,
      // Gemini signs its function calls (thoughtSignature) and wants the parts back exactly.
      rawMessage: calls.length ? parts : undefined,
      usage: {
        promptTokens: response.usageMetadata?.promptTokenCount,
        completionTokens: response.usageMetadata?.candidatesTokenCount,
        totalTokens: response.usageMetadata?.totalTokenCount,
      },
      raw: json,
    };
  }

  estimateCost(modelId: string, inputTokens: number, outputTokens: number): number {
    const costs: Costs = {
      "gemini-1.5-flash": { in: 0.000075, out: 0.0003 },
      "gemini-1.5-pro": { in: 0.00125, out: 0.005 },
    };
    const model = this.modelName(modelId);
    const fallback = /flash/.test(model) ? { in: 0.0003, out: 0.0025 } : { in: 0.00125, out: 0.01 };
    return perK(lookupCost(costs, model, fallback), inputTokens, outputTokens);
  }
}

function googleContents(messages: LLMMessage[]): unknown[] {
  const out: Array<{ role: string; parts: unknown[] }> = [];
  for (const m of messages) {
    if (m.role === "system") continue;
    if (m.role === "tool") {
      const part = { functionResponse: { id: m.toolCallId, name: m.name, response: { result: m.content } } };
      const last = out.at(-1);
      if (last?.role === "user" && last.parts.every((p) => (p as { functionResponse?: unknown }).functionResponse)) last.parts.push(part);
      else out.push({ role: "user", parts: [part] });
    } else if (m.role === "assistant" && m.toolCalls?.length) {
      const parts = Array.isArray(m.raw) ? m.raw : [...(m.content ? [{ text: m.content }] : []), ...m.toolCalls.map((c) => ({ functionCall: { id: c.id, name: c.name, args: c.args } }))];
      out.push({ role: "model", parts });
    } else if (m.role === "user" && out.at(-1)?.role === "user") {
      out.at(-1)!.parts.push({ text: m.content });
    } else {
      out.push({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] });
    }
  }
  return out;
}

/** Gemini accepts a subset of JSON Schema (an OpenAPI 3.0 form): keep only what it reads. */
function geminiSchema(schema: unknown): unknown {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) return schema;
  const s = schema as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  let type = s.type;
  if (Array.isArray(type)) {
    const real = type.filter((t) => t !== "null");
    if (real.length < type.length) out.nullable = true;
    type = real[0];
  }
  if (type) out.type = type;
  for (const k of ["description", "enum", "format", "required", "minimum", "maximum", "minItems", "maxItems"]) if (s[k] !== undefined) out[k] = s[k];
  if (s.items) out.items = geminiSchema(s.items);
  if (s.properties && typeof s.properties === "object") {
    out.properties = Object.fromEntries(Object.entries(s.properties as Record<string, unknown>).map(([k, v]) => [k, geminiSchema(v)]));
  }
  if (out.type === "object" && !out.properties) out.properties = {};
  return out;
}

// ── OpenRouter Adapter ─────

export class OpenRouterAdapter extends OpenAICompatibleAdapter {
  constructor(options: { baseUrl?: string } = {}) {
    super({
      id: "openrouter",
      prefixes: ["openrouter/", "or/"],
      baseUrl: options.baseUrl ?? "https://openrouter.ai/api/v1",
      envKeys: ["OPENROUTER_API_KEY"],
      headers: { "HTTP-Referer": "https://halo.ai", "X-Title": "Halo" },
    });
  }

  override estimateCost(_modelId: string, inputTokens: number, outputTokens: number): number {
    // Varies by routed model; rough mid-tier estimate.
    return perK({ in: 0.003, out: 0.015 }, inputTokens, outputTokens);
  }
}

// ── Together AI Adapter ─────

export class TogetherAdapter extends OpenAICompatibleAdapter {
  constructor(options: { baseUrl?: string } = {}) {
    super({ id: "together", prefixes: ["together/", "tog/"], baseUrl: options.baseUrl ?? "https://api.together.xyz/v1", envKeys: ["TOGETHER_API_KEY"] });
  }

  override estimateCost(_modelId: string, inputTokens: number, outputTokens: number): number {
    return perK({ in: 0.0002, out: 0.0002 }, inputTokens, outputTokens);
  }
}

// ── Replicate Adapter ─────

export class ReplicateAdapter implements ProviderAdapter {
  id = "replicate";
  supportsTools = false;
  envKeys = ["REPLICATE_API_TOKEN", "REPLICATE_API_KEY"];
  private prefixes = ["replicate/", "rep/"];

  canHandle(modelId: string): boolean {
    return this.prefixes.some((p) => modelId.startsWith(p));
  }

  getUrl(modelId: string): string {
    return `https://api.replicate.com/v1/models/${stripPrefix(modelId, this.prefixes)}/predictions`;
  }

  getHeaders(apiKey: string): Record<string, string> {
    return {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      // Block until the prediction finishes (up to 60s) instead of returning "starting".
      Prefer: "wait",
    };
  }

  transformRequest(req: LLMRequest): unknown {
    const system = req.messages.find((m) => m.role === "system")?.content;
    const prompt = req.messages.filter((m) => m.role !== "system").map((m) => m.content).join("\n\n");
    return {
      input: compact({
        prompt,
        system_prompt: system,
        temperature: req.temperature ?? 0.7,
        max_new_tokens: req.maxTokens ?? 4096,
      }),
    };
  }

  parseResponse(json: unknown): LLMResponse {
    const response = json as { status?: string; error?: unknown; output?: string | string[] | Array<{ text?: string }> };
    if (response.error) throw new Error(`Replicate prediction failed: ${JSON.stringify(response.error)}`);

    let text: string;
    if (typeof response.output === "string") text = response.output;
    else if (Array.isArray(response.output)) text = response.output.map((o) => (typeof o === "string" ? o : o.text ?? "")).join("");
    else if (response.status && response.status !== "succeeded") throw new Error(`Replicate prediction did not finish (status: ${response.status})`);
    else text = JSON.stringify(response.output ?? "");

    return { text, raw: json };
  }

  estimateCost(_modelId: string, _inputTokens: number, outputTokens: number): number {
    return (outputTokens / 1000) * 0.001; // Rough estimate
  }
}

// ── Ollama (Local) Adapter ─────

export class OllamaAdapter implements ProviderAdapter {
  id = "ollama";
  requiresApiKey = false;
  private prefixes = ["ollama/", "local/"];

  constructor(private options: { baseUrl?: string } = {}) {}

  canHandle(modelId: string): boolean {
    return this.prefixes.some((p) => modelId.startsWith(p));
  }

  getUrl(_modelId: string): string {
    const host = this.options.baseUrl ?? Bun.env.OLLAMA_HOST ?? "http://localhost:11434";
    return `${/^https?:\/\//.test(host) ? host : "http://" + host}/api/chat`;
  }

  getHeaders(_apiKey: string): Record<string, string> {
    return { "Content-Type": "application/json" };
  }

  transformRequest(req: LLMRequest): unknown {
    return {
      model: stripPrefix(req.model, this.prefixes),
      messages: req.messages.map((m) => {
        if (m.role === "tool") return { role: "tool", content: m.content, tool_name: m.name };
        if (m.role === "assistant" && m.toolCalls?.length) {
          return { role: "assistant", content: m.content, tool_calls: m.toolCalls.map((c) => ({ function: { name: c.name, arguments: c.args } })) };
        }
        return { role: m.role, content: m.content };
      }),
      tools: req.tools?.length ? req.tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } })) : undefined,
      options: compact({
        temperature: req.temperature ?? 0.7,
        num_predict: req.maxTokens,
        top_p: req.topP,
      }),
      stream: false,
    };
  }

  parseResponse(json: unknown): LLMResponse {
    const response = json as {
      message?: { content?: string; tool_calls?: Array<{ function?: { name?: string; arguments?: unknown } }> };
      prompt_eval_count?: number;
      eval_count?: number;
    };
    const calls = response.message?.tool_calls ?? [];

    return {
      text: response.message?.content ?? "",
      toolCalls: calls.length ? calls.map((c) => ({ id: newCallId(), name: c.function?.name ?? "", args: parseArgs(c.function?.arguments) })) : undefined,
      usage: { promptTokens: response.prompt_eval_count, completionTokens: response.eval_count },
      raw: json,
    };
  }

  estimateCost(_modelId: string, _inputTokens: number, _outputTokens: number): number {
    return 0; // Local models are free!
  }
}

// ── Adapter Registry ─────

export function defaultAdapters(): ProviderAdapter[] {
  return [
    new OpenAIAdapter(),
    new AnthropicAdapter(),
    new GoogleAdapter(),
    new OpenRouterAdapter(),
    new TogetherAdapter(),
    new ReplicateAdapter(),
    new OllamaAdapter(),
  ];
}

export class AdapterRegistry {
  private adapters: ProviderAdapter[] = [];

  constructor(customAdapters?: ProviderAdapter[]) {
    this.adapters = [...defaultAdapters(), ...(customAdapters ?? [])];
  }

  /** Find the adapter that can handle the given model ID. Later registrations win. */
  findAdapter(modelId: string): ProviderAdapter | undefined {
    return this.adapters.findLast((a) => a.canHandle(modelId));
  }

  /** Get all registered adapters */
  getAll(): ProviderAdapter[] {
    return [...this.adapters];
  }

  /** Register a custom adapter. It takes precedence over earlier adapters for the models it handles. */
  register(adapter: ProviderAdapter): void {
    this.adapters = this.adapters.filter((a) => a.id !== adapter.id);
    this.adapters.push(adapter);
  }
}
