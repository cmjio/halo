/**
 * LLM Provider Adapters
 *
 * Each adapter handles a specific AI provider's API format,
 * authentication, and response parsing.
 */

// ── Adapter Interface ─────

export interface LLMRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stream?: boolean;
  [key: string]: unknown;
}

export interface LLMResponse {
  text: string;
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
      messages: req.messages,
      temperature: req.temperature,
      max_tokens: req.maxTokens,
      top_p: req.topP,
      stream: req.stream,
    });
  }

  parseResponse(json: unknown): LLMResponse {
    const response = json as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };

    return {
      text: response.choices?.[0]?.message?.content ?? "",
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
      messages: req.messages
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content })),
      max_tokens: req.maxTokens ?? 4096,
      temperature: req.temperature,
      top_p: req.topP,
      stream: req.stream,
    });
  }

  parseResponse(json: unknown): LLMResponse {
    const response = json as {
      content?: Array<{ type?: string; text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
    };

    return {
      text: (response.content ?? []).filter((c) => c.type === undefined || c.type === "text").map((c) => c.text ?? "").join(""),
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
      contents: req.messages
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
      generationConfig: compact({
        temperature: req.temperature,
        maxOutputTokens: req.maxTokens,
        topP: req.topP,
      }),
    });
  }

  parseResponse(json: unknown): LLMResponse {
    const response = json as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
    };

    return {
      text: (response.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join(""),
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
      messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
      options: compact({
        temperature: req.temperature ?? 0.7,
        num_predict: req.maxTokens,
        top_p: req.topP,
      }),
      stream: false,
    };
  }

  parseResponse(json: unknown): LLMResponse {
    const response = json as { message?: { content?: string }; prompt_eval_count?: number; eval_count?: number };

    return {
      text: response.message?.content ?? "",
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
