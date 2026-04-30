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
  
  /** Check if this adapter can handle the given model ID */
  canHandle(modelId: string): boolean;
  
  /** Build the API URL for the request */
  getUrl(modelId: string): string;
  
  /** Build request headers */
  getHeaders(apiKey: string): Record<string, string>;
  
  /** Transform Langly request to provider-specific format */
  transformRequest(req: LLMRequest): unknown;
  
  /** Parse provider response to standard format */
  parseResponse(response: unknown): LLMResponse;
  
  /** Estimate cost for a request (optional, for cost routing) */
  estimateCost(modelId: string, inputTokens: number, outputTokens: number): number;
  
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
      stream: req.stream,
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
    const lastMessage = req.messages[req.messages.length - 1];
    
    return {
      model,
      messages: req.messages.slice(0, -1).map(m => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.content,
      })),
      system: req.messages[0]?.role === "system" ? req.messages[0].content : undefined,
      prompt: lastMessage?.content, // Legacy
      max_tokens: req.maxTokens ?? 4096,
      temperature: req.temperature ?? 0.7,
      top_p: req.topP,
      stream: req.stream,
    };
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
  
  estimateCost(modelId: string, inputTokens: number, outputTokens: number): number {
    const costs: Record<string, { in: number; out: number }> = {
      "claude-3-opus-20240229": { in: 0.015, out: 0.075 },
      "claude-3-sonnet-20240229": { in: 0.003, out: 0.015 },
      "claude-3-haiku-20240307": { in: 0.00025, out: 0.00125 },
      "claude-3-5-sonnet-20240620": { in: 0.003, out: 0.015 },
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
    return `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;
  }
  
  getHeaders(_apiKey: string): Record<string, string> {
    return { "Content-Type": "application/json" };
  }
  
  transformRequest(req: LLMRequest): unknown {
    const apiKey = req["apiKey"] as string | undefined;
    const model = req.model
      .replace(/^(google\/|gemini\/)/, "")
      .replace(/^gemini-/, "gemini-");
    
    const body: Record<string, unknown> = {
      contents: req.messages.map(m => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.content }],
      })),
      generationConfig: {
        temperature: req.temperature,
        maxOutputTokens: req.maxTokens,
        topP: req.topP,
      },
    };
    
    if (apiKey) {
      body["key"] = apiKey;
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
  
  estimateCost(_modelId: string, _inputTokens: number, _outputTokens: number): number {
    // Google doesn't publish per-token costs - use approximate
    return 0.001; // Placeholder
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
      stream: req.stream,
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
      stream: req.stream,
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
      stream: false,
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
