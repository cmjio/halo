/**
 * LLM Provider Adapters
 * 
 * Each adapter handles a specific AI provider's API format,
 * authentication, and response parsing.
 */

import type { RuntimeConfig } from "./runtime";

// ── Adapter Interface ─────

export interface LLMRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  pipeline?: boolean;
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
  
  /** Check if this adapter can handle the given model ID */
  canHandle(modelId: string): boolean;
  
  /** Build the API URL for the request */
  getUrl(modelId: string): string;

  /** Build the API URL with API key embedded (for query-param auth providers like Google) */
  getUrlWithApiKey?(modelId: string, apiKey: string): string;
  
  /** Build request headers */
  getHeaders(apiKey: string): Record<string, string>;
  
  /** Transform Langly request to provider-specific format */
  transformRequest(req: LLMRequest): unknown;
  
  /** Parse provider response to standard format */
  parseResponse(response: unknown): LLMResponse;
  
  /** Estimate cost for a request (optional, for cost routing) */
  estimateCost(modelId: string, inputTokens: number, outputTokens: number): number;
  
  /** Parse a single SSE pipeline chunk (optional) */
  parseStreamChunk?(chunk: string): string | null;
  
  /** List available models (optional) */
  listModels?(): Promise<ModelInfo[]>;
}

// ── OpenAI Adapter ─────

export class OpenAIAdapter implements ProviderAdapter {
  id = "openai";
  
  canHandle(modelId: string): boolean {
    return modelId.startsWith("openai/") || modelId.startsWith("oai/");
  }
  
  getUrl(_modelId: string): string {
    return "https://api.openai.com/v1/chat/completions";
  }
  
  getHeaders(apiKey: string): Record<string, string> {
    return {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };
  }
  
  transformRequest(req: LLMRequest): unknown {
    return {
      model: req.model.replace(/^(openai\/|oai\/)/, ""),
      messages: req.messages,
      temperature: req.temperature ?? 0.7,
      max_tokens: req.maxTokens,
      top_p: req.topP,
      pipeline: req.pipeline,
    };
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
  
  parseStreamChunk(chunk: string): string | null {
    if (chunk === "[DONE]") return null;
    try {
      const data = JSON.parse(chunk);
      return data.choices?.[0]?.delta?.content ?? null;
    } catch {
      return null;
    }
  }
  
  estimateCost(modelId: string, inputTokens: number, outputTokens: number): number {
    const costs: Record<string, { in: number; out: number }> = {
      "gpt-4o": { in: 0.005, out: 0.015 },
      "gpt-4o-mini": { in: 0.00015, out: 0.0006 },
      "gpt-4-turbo": { in: 0.01, out: 0.03 },
      "gpt-3.5-turbo": { in: 0.0015, out: 0.002 },
    };
    
    const model = modelId.replace(/^(openai\/|oai\/)/, "");
    const cost = costs[model] ?? { in: 0.01, out: 0.03 };
    return (inputTokens / 1000) * cost.in + (outputTokens / 1000) * cost.out;
  }
}

// ── Anthropic Adapter ─────

export class AnthropicAdapter implements ProviderAdapter {
  id = "anthropic";
  
  canHandle(modelId: string): boolean {
    return modelId.startsWith("anthropic/") || modelId.startsWith("claude/");
  }
  
  getUrl(_modelId: string): string {
    return "https://api.anthropic.com/v1/messages";
  }
  
  getHeaders(apiKey: string): Record<string, string> {
    return {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    };
  }
  
  transformRequest(req: LLMRequest): unknown {
    const model = req.model.replace(/^(anthropic\/|claude\/)/, "");

    // Separate system messages from conversation messages.
    // Claude Messages API: system is a top-level string field,
    // messages array must alternate user/assistant and start with user.
    let systemPrompt: string | undefined;
    const conversationMessages: Array<{ role: string; content: string }> = [];

    for (const m of req.messages) {
      if (m.role === "system") {
        // Concatenate multiple system messages (rare but possible)
        systemPrompt = systemPrompt ? `${systemPrompt}\n\n${m.content}` : m.content;
      } else {
        conversationMessages.push({
          role: m.role === "user" ? "user" : "assistant",
          content: m.content,
        });
      }
    }

    // If the runtime sent a single user message with no explicit system,
    // ensure we still have at least one user message in the array.
    if (conversationMessages.length === 0 && systemPrompt) {
      // The only message was tagged "system" — Langly runtime sends
      // user prompts as role:"user", so this means someone explicitly
      // set a system prompt with no user content. Treat the system
      // prompt as the user message to avoid an empty messages array.
      conversationMessages.push({ role: "user", content: systemPrompt });
      systemPrompt = undefined;
    }

    const body: Record<string, unknown> = {
      model,
      messages: conversationMessages,
      max_tokens: req.maxTokens ?? 4096,
      temperature: req.temperature ?? 0.7,
    };

    if (systemPrompt) body.system = systemPrompt;
    if (req.topP !== undefined) body.top_p = req.topP;
    if (req.pipeline) body.pipeline = true;

    return body;
  }
  
  parseResponse(json: unknown): LLMResponse {
    const response = json as {
      content?: Array<{ text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    
    return {
      text: response.content?.[0]?.text ?? "",
      usage: {
        promptTokens: response.usage?.input_tokens,
        completionTokens: response.usage?.output_tokens,
      },
      raw: json,
    };
  }
  
  parseStreamChunk(chunk: string): string | null {
    if (chunk === "[DONE]" || chunk.trim() === "") return null;
    try {
      const data = JSON.parse(chunk);
      // Claude streaming uses content_block_delta events
      if (data.type === "content_block_delta") {
        return data.delta?.text ?? null;
      }
      return null;
    } catch {
      return null;
    }
  }

  estimateCost(modelId: string, inputTokens: number, outputTokens: number): number {
    const costs: Record<string, { in: number; out: number }> = {
      "claude-3-opus-20240229": { in: 0.015, out: 0.075 },
      "claude-3-sonnet-20240229": { in: 0.003, out: 0.015 },
      "claude-3-haiku-20240307": { in: 0.00025, out: 0.00125 },
      "claude-3-5-sonnet-20240620": { in: 0.003, out: 0.015 },
      "claude-sonnet-4-20250514": { in: 0.003, out: 0.015 },
    };
    
    const model = modelId.replace(/^(anthropic\/|claude\/)/, "");
    const cost = costs[model] ?? { in: 0.003, out: 0.015 };
    return (inputTokens / 1000) * cost.in + (outputTokens / 1000) * cost.out;
  }
}

// ── Google Gemini Adapter ─────

export class GoogleAdapter implements ProviderAdapter {
  id = "google";
  
  canHandle(modelId: string): boolean {
    return modelId.startsWith("google/") || modelId.startsWith("gemini/") || modelId.startsWith("gemini-");
  }
  
  getUrl(modelId: string): string {
    const modelName = modelId
      .replace(/^(google\/|gemini\/)/, "")
      .replace(/^gemini-/, "gemini-");
    // API key is appended as a query parameter by the runtime's callAdapter
    // via getUrlWithAuth(). Base URL has no key.
    return `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;
  }

  /** Google uses query-param auth, not header auth. Override getUrl at call time. */
  getUrlWithApiKey(modelId: string, apiKey: string): string {
    const base = this.getUrl(modelId);
    return `${base}?key=${encodeURIComponent(apiKey)}`;
  }
  
  getHeaders(_apiKey: string): Record<string, string> {
    return { "Content-Type": "application/json" };
  }
  
  transformRequest(req: LLMRequest): unknown {
    // Separate system instructions from conversation messages.
    // Gemini API supports a top-level systemInstruction field.
    let systemInstruction: string | undefined;
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    for (const m of req.messages) {
      if (m.role === "system") {
        systemInstruction = systemInstruction
          ? `${systemInstruction}\n\n${m.content}`
          : m.content;
      } else {
        contents.push({
          role: m.role === "user" ? "user" : "model",
          parts: [{ text: m.content }],
        });
      }
    }

    // If everything was system messages, move them to user
    if (contents.length === 0 && systemInstruction) {
      contents.push({ role: "user", parts: [{ text: systemInstruction }] });
      systemInstruction = undefined;
    }

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: req.temperature,
        maxOutputTokens: req.maxTokens,
        topP: req.topP,
      },
    };

    if (systemInstruction) {
      body.systemInstruction = { parts: [{ text: systemInstruction }] };
    }
    
    return body;
  }
  
  parseResponse(json: unknown): LLMResponse {
    const response = json as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };
    
    return {
      text: response.candidates?.[0]?.content?.parts?.[0]?.text ?? "",
      raw: json,
    };
  }
  
  estimateCost(modelId: string, inputTokens: number, outputTokens: number): number {
    const costs: Record<string, { in: number; out: number }> = {
      "gemini-1.5-pro": { in: 0.00125, out: 0.005 },
      "gemini-1.5-flash": { in: 0.000075, out: 0.0003 },
      "gemini-2.0-flash": { in: 0.0001, out: 0.0004 },
      "gemini-2.5-pro": { in: 0.00125, out: 0.01 },
      "gemini-2.5-flash": { in: 0.00015, out: 0.0006 },
    };
    const model = modelId.replace(/^(google\/|gemini\/)/, "");
    const cost = costs[model] ?? { in: 0.001, out: 0.004 };
    return (inputTokens / 1000) * cost.in + (outputTokens / 1000) * cost.out;
  }
}

// ── OpenRouter Adapter ─────

export class OpenRouterAdapter implements ProviderAdapter {
  id = "openrouter";
  
  canHandle(modelId: string): boolean {
    return modelId.startsWith("openrouter/") || modelId.startsWith("or/");
  }
  
  getUrl(_modelId: string): string {
    return "https://openrouter.ai/api/v1/chat/completions";
  }
  
  getHeaders(apiKey: string): Record<string, string> {
    return {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://langly.ai",
      "X-Title": "Langly",
    };
  }
  
  transformRequest(req: LLMRequest): unknown {
    return {
      model: req.model.replace(/^(openrouter\/|or\/)/, ""),
      messages: req.messages,
      temperature: req.temperature ?? 0.7,
      max_tokens: req.maxTokens,
      top_p: req.topP,
      pipeline: req.pipeline,
    };
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
  
  estimateCost(modelId: string, inputTokens: number, outputTokens: number): number {
    // OpenRouter shows cost in response headers, but we can estimate
    // Format: openrouter/anthropic/claude-3-opus
    return 0.005; // Placeholder - actual cost varies by model
  }
}

// ── Together AI Adapter ─────

export class TogetherAdapter implements ProviderAdapter {
  id = "together";
  
  canHandle(modelId: string): boolean {
    return modelId.startsWith("together/") || modelId.startsWith("tog/");
  }
  
  getUrl(_modelId: string): string {
    return "https://api.together.xyz/v1/chat/completions";
  }
  
  getHeaders(apiKey: string): Record<string, string> {
    return {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };
  }
  
  transformRequest(req: LLMRequest): unknown {
    return {
      model: req.model.replace(/^(together\/|tog\/)/, ""),
      messages: req.messages,
      temperature: req.temperature ?? 0.7,
      max_tokens: req.maxTokens,
      top_p: req.topP,
      pipeline: req.pipeline,
    };
  }
  
  parseResponse(json: unknown): LLMResponse {
    const response = json as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    
    return {
      text: response.choices?.[0]?.message?.content ?? "",
      usage: {
        promptTokens: response.usage?.prompt_tokens,
        completionTokens: response.usage?.completion_tokens,
      },
      raw: json,
    };
  }
  
  estimateCost(_modelId: string, inputTokens: number, outputTokens: number): number {
    return 0.001; // Together AI is generally cheaper
  }
}

// ── Replicate Adapter ─────

export class ReplicateAdapter implements ProviderAdapter {
  id = "replicate";
  
  canHandle(modelId: string): boolean {
    return modelId.startsWith("replicate/") || modelId.startsWith("rep/");
  }
  
  getUrl(modelId: string): string {
    const model = modelId.replace(/^(replicate\/|rep\/)/, "");
    return `https://api.replicate.com/v1/models/${model}/predictions`;
  }
  
  getHeaders(apiKey: string): Record<string, string> {
    return {
      "Authorization": `Token ${apiKey}`,
      "Content-Type": "application/json",
    };
  }
  
  transformRequest(req: LLMRequest): unknown {
    const model = req.model.replace(/^(replicate\/|rep\/)/, "");
    const lastMessage = req.messages[req.messages.length - 1];
    
    return {
      version: model,
      input: {
        prompt: lastMessage?.content,
        temperature: req.temperature ?? 0.7,
        max_new_tokens: req.maxTokens ?? 4096,
      },
    };
  }
  
  parseResponse(json: unknown): LLMResponse {
    const response = json as {
      output?: string | Array<{ text?: string }>;
    };
    
    let text: string;
    if (typeof response.output === "string") {
      text = response.output;
    } else if (Array.isArray(response.output)) {
      text = response.output.map(o => o.text ?? "").join("");
    } else {
      text = JSON.stringify(response.output);
    }
    
    return {
      text,
      raw: json,
    };
  }
  
  estimateCost(_modelId: string, _inputTokens: number, outputTokens: number): number {
    return (outputTokens / 1000) * 0.001; // Rough estimate
  }
}

// ── Ollama (Local) Adapter ─────

export class OllamaAdapter implements ProviderAdapter {
  id = "ollama";
  
  canHandle(modelId: string): boolean {
    return modelId.startsWith("ollama/") || modelId.startsWith("local/");
  }
  
  getUrl(_modelId: string): string {
    return "http://localhost:11434/api/chat";
  }
  
  getHeaders(_apiKey: string): Record<string, string> {
    return { "Content-Type": "application/json" };
  }
  
  transformRequest(req: LLMRequest): unknown {
    const model = req.model.replace(/^(ollama\/|local\/)/, "");
    return {
      model,
      messages: req.messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      options: {
        temperature: req.temperature ?? 0.7,
        num_predict: req.maxTokens,
        top_p: req.topP,
      },
      pipeline: false,
    };
  }
  
  parseResponse(json: unknown): LLMResponse {
    const response = json as {
      message?: { content?: string };
    };
    
    return {
      text: response.message?.content ?? "",
      raw: json,
    };
  }
  
  estimateCost(_modelId: string, _inputTokens: number, _outputTokens: number): number {
    return 0; // Local models are free!
  }
}

// ── Adapter Registry ─────

const defaultAdapters: ProviderAdapter[] = [
  new OpenAIAdapter(),
  new AnthropicAdapter(),
  new GoogleAdapter(),
  new OpenRouterAdapter(),
  new TogetherAdapter(),
  new ReplicateAdapter(),
  new OllamaAdapter(),
];

export class AdapterRegistry {
  private adapters: ProviderAdapter[] = [];
  
  constructor(customAdapters?: ProviderAdapter[]) {
    this.adapters = [...defaultAdapters, ...(customAdapters ?? [])];
  }
  
  /** Find the adapter that can handle the given model ID */
  findAdapter(modelId: string): ProviderAdapter | undefined {
    return this.adapters.find(a => a.canHandle(modelId));
  }
  
  /** Get all registered adapters */
  getAll(): ProviderAdapter[] {
    return [...this.adapters];
  }
  
  /** Register a custom adapter */
  register(adapter: ProviderAdapter): void {
    this.adapters.push(adapter);
  }
}
