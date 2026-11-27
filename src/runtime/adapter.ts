/**
 * LLM Provider Adapters
 *
 * Each adapter handles a specific AI provider's API format,
 * authentication, and response parsing.
 */

import { mediaLabel, type MediaRef } from "./media-ref.js";

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
 * An image or document sent with a user turn. `label` is how the turn's text refers to it.
 * `data` (base64) is filled in just before the request is built; stored conversations
 * carry the reference only.
 */
export interface LLMMedia extends MediaRef {
  data?: string;
  /** Where the provider holds the file already (an upload to its own file store). */
  fileUri?: string;
}

/** Each attachment as its label followed by itself, in the provider's own form, ahead of the turn's text. */
function attachments<T>(media: LLMMedia[] | undefined, label: (text: string) => T, part: (m: LLMMedia & { data: string }) => T): T[] {
  return (media ?? []).filter((m): m is LLMMedia & { data: string } => typeof m.data === "string").flatMap((m) => [label(mediaLabel(m)), part(m)]);
}

/** Like attachments, for an API that also takes a file by reference (an upload, or a YouTube link). */
function attachmentsOrLinks<T>(media: LLMMedia[] | undefined, label: (text: string) => T, part: (m: LLMMedia) => T): T[] {
  return (media ?? []).filter((m) => typeof m.data === "string" || m.fileUri || m.url).flatMap((m) => [label(mediaLabel(m)), part(m)]);
}

const MB = 1024 * 1024;
/** Gemini names a few media types its own way. */
const GEMINI_TYPES: Record<string, string> = { "audio/mpeg": "audio/mp3", "video/quicktime": "video/mov" };
const accepts = (types: string[], bytes: number) => Object.fromEntries(types.map((t) => [t, bytes]));
const IMAGES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

/**
 * A conversation turn. An assistant turn that asked for tools carries them in
 * `toolCalls` (and `raw`, the adapter's own form of the turn, which some APIs
 * need sent back unchanged); each result is a `tool` turn.
 */
export type LLMMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string; media?: LLMMedia[] }
  | { role: "assistant"; content: string; toolCalls?: LLMToolCall[]; raw?: unknown }
  /** `media`: images and documents in the result, sent to the model in a user turn after the run of tool turns. */
  | { role: "tool"; toolCallId: string; name: string; content: string; media?: LLMMedia[] };

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
  /** What the provider says it billed for this call, in USD, when it says (OpenRouter's usage.cost). */
  cost?: number;
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

  /**
   * The media types this API reads, each with the most bytes one may be. Unset, it reads
   * none, and a call that carries an image or a document fails with a clear error.
   */
  input?: Record<string, number>;

  /**
   * For an API with its own file store: files larger than `inlineLimit` are uploaded with
   * `upload` and sent by reference, instead of inline.
   */
  inlineLimit?: number;
  upload?(file: MediaRef, bytes: Uint8Array, o: { apiKey: string; fetch: typeof fetch; signal?: AbortSignal }): Promise<string>;

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

  /**
   * The model's price in USD per 1,000 tokens (in and out), for a call with this many input
   * tokens, or undefined when the adapter doesn't know this exact model. MaxSpend uses it,
   * and refuses calls to a model without one (see prices.ts).
   */
  price?(modelId: string, inputTokens: number): { in: number; out: number } | undefined;

  /** A guess at the cost in USD, for reporting a call to a model with no price. Never used to keep MaxSpend. */
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

/**
 * A model's exact price from a table, after its provider prefix and a dated snapshot suffix
 * ("-20250929", "-2024-08-06") or "-latest" are taken off. No guessing from families: a
 * model not in the table has no price.
 */
function exactPrice(costs: Costs, model: string, prefixes: string[]): { in: number; out: number } | undefined {
  const id = stripPrefix(model, prefixes);
  const bare = id.replace(/-(\d{8}|\d{4}-\d{2}-\d{2}|latest)$/, "");
  return Object.hasOwn(costs, id) ? costs[id] : Object.hasOwn(costs, bare) ? costs[bare] : undefined;
}

const perMTok = (input: number, output: number) => ({ in: input / 1000, out: output / 1000 });

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
  /** Images, as `image_url` parts. Whether a given model reads them is the provider's to say. */
  input: Record<string, number> = accepts(IMAGES, 20 * MB);
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
        if (m.role === "user" && m.media?.length) {
          return {
            role: "user",
            content: [
              ...attachments<unknown>(
                m.media,
                (text) => ({ type: "text", text }),
                (a) => (a.$media === "image" ? { type: "image_url", image_url: { url: `data:${a.type};base64,${a.data}` } } : { type: "file", file: { filename: a.name ?? "document.pdf", file_data: `data:${a.type};base64,${a.data}` } }),
              ),
              { type: "text", text: m.content },
            ],
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

  /** A generic OpenAI-compatible server lists no prices: give them in halo.json "prices". */
  price(_modelId: string, _inputTokens?: number): { in: number; out: number } | undefined {
    return undefined;
  }

  estimateCost(_modelId: string, _inputTokens: number, _outputTokens: number): number {
    return 0;
  }
}

// ── OpenAI Adapter ─────

export class OpenAIAdapter extends OpenAICompatibleAdapter {
  constructor(options: { baseUrl?: string } = {}) {
    super({ id: "openai", prefixes: ["openai/", "oai/"], baseUrl: options.baseUrl ?? "https://api.openai.com/v1", envKeys: ["OPENAI_API_KEY"] });
    this.input = { ...accepts(IMAGES, 20 * MB), "application/pdf": 25 * MB };
  }

  override canHandle(modelId: string): boolean {
    return super.canHandle(modelId) || /^(?:gpt-|o\d|chatgpt-)/.test(modelId);
  }

  override transformRequest(req: LLMRequest): unknown {
    const body = super.transformRequest(req) as Record<string, unknown>;
    body.temperature = req.temperature ?? 0.7;
    return body;
  }

  private static costs: Costs = {
    "gpt-4o-mini": { in: 0.00015, out: 0.0006 },
    "gpt-4o": { in: 0.005, out: 0.015 },
    "gpt-4-turbo": { in: 0.01, out: 0.03 },
    "gpt-3.5-turbo": { in: 0.0015, out: 0.002 },
  };

  override price(modelId: string): { in: number; out: number } | undefined {
    return exactPrice(OpenAIAdapter.costs, modelId, this.prefixes);
  }

  override estimateCost(modelId: string, inputTokens: number, outputTokens: number): number {
    return perK(lookupCost(OpenAIAdapter.costs, stripPrefix(modelId, this.prefixes), { in: 0.01, out: 0.03 }), inputTokens, outputTokens);
  }
}

// ── Anthropic Adapter ─────

export class AnthropicAdapter implements ProviderAdapter {
  id = "anthropic";
  envKeys = ["ANTHROPIC_API_KEY"];
  // An image may be 10 MB once base64-encoded, which is 7.5 MB of bytes.
  input = { ...accepts(IMAGES, 7 * MB), "application/pdf": 25 * MB };
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

  /** USD per million tokens (input, output), from platform.claude.com/docs/en/about-claude/pricing. */
  private static costs: Costs = {
    "claude-fable-5-2": perMTok(8, 40),
    "claude-mythos-5-2": perMTok(8, 40),
    "claude-fable-5-1": perMTok(10, 50),
    "claude-mythos-5-1": perMTok(10, 50),
    "claude-fable-5": perMTok(10, 50),
    "claude-mythos-5": perMTok(10, 50),
    "claude-opus-5-5": perMTok(4, 20),
    "claude-opus-5": perMTok(5, 25),
    "claude-opus-4-8": perMTok(5, 25),
    "claude-opus-4-7": perMTok(5, 25),
    "claude-opus-4-6": perMTok(5, 25),
    "claude-opus-4-5": perMTok(5, 25),
    "claude-opus-4-1": perMTok(15, 75),
    "claude-opus-4": perMTok(15, 75),
    "claude-opus-4-0": perMTok(15, 75),
    "claude-sonnet-5-5": perMTok(2, 10),
    "claude-sonnet-5": perMTok(2, 10),
    "claude-sonnet-4-6": perMTok(3, 15),
    "claude-sonnet-4-5": perMTok(3, 15),
    "claude-sonnet-4": perMTok(3, 15),
    "claude-sonnet-4-0": perMTok(3, 15),
    "claude-haiku-4-5": perMTok(1, 5),
  };

  price(modelId: string, inputTokens: number): { in: number; out: number } | undefined {
    const id = stripPrefix(modelId, this.prefixes).replace(/-(\d{8}|latest)$/, "");
    // Haiku 5.5 is priced by the request's prompt: all its input tokens, over 100,000 or not.
    if (id === "claude-haiku-5-5") return inputTokens > 100_000 ? perMTok(0.5, 2.5) : perMTok(0.1, 0.5);
    return exactPrice(AnthropicAdapter.costs, id, []);
  }

  estimateCost(modelId: string, inputTokens: number, outputTokens: number): number {
    const known = this.price(modelId, inputTokens);
    if (known) return perK(known, inputTokens, outputTokens);
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
      last.content = [...(Array.isArray(last.content) ? last.content : [{ type: "text", text: last.content }]), ...anthropicAttachments(m.media), { type: "text", text: m.content }];
    } else if (m.role === "user" && m.media?.length) {
      out.push({ role: "user", content: [...anthropicAttachments(m.media), { type: "text", text: m.content }] });
    } else {
      out.push({ role: m.role === "assistant" ? "assistant" : "user", content: m.content });
    }
  }
  return out;
}

const anthropicAttachments = (media: LLMMedia[] | undefined) =>
  attachments<unknown>(
    media,
    (text) => ({ type: "text", text }),
    (a) => ({ type: a.$media === "image" ? "image" : "document", source: { type: "base64", media_type: a.type, data: a.data } }),
  );

// ── Google Gemini Adapter ─────

export class GoogleAdapter implements ProviderAdapter {
  id = "google";
  envKeys = ["GEMINI_API_KEY", "GOOGLE_API_KEY"];
  // Inline data shares a 20 MB request with everything else in it, base64-encoded; larger files go
  // through the Files API. A YouTube link is watched where it is.
  inlineLimit = 14 * MB;
  input = {
    ...accepts(["image/png", "image/jpeg", "image/webp"], 25 * MB),
    "application/pdf": 50 * MB,
    ...accepts(["audio/wav", "audio/mpeg", "audio/aac", "audio/ogg", "audio/flac"], 100 * MB),
    ...accepts(["video/mp4", "video/quicktime", "video/webm"], 500 * MB),
    "video/youtube": 1,
  };

  /** Upload to the Files API (a resumable upload in one go), and wait until the file can be used. */
  async upload(file: MediaRef, bytes: Uint8Array, o: { apiKey: string; fetch: typeof fetch; signal?: AbortSignal }): Promise<string> {
    const root = (this.options.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta").replace(/\/v1beta\/?$/, "");
    const type = GEMINI_TYPES[file.type] ?? file.type;
    const start = await o.fetch(`${root}/upload/v1beta/files`, {
      method: "POST",
      headers: { "x-goog-api-key": o.apiKey, "X-Goog-Upload-Protocol": "resumable", "X-Goog-Upload-Command": "start", "X-Goog-Upload-Header-Content-Length": String(bytes.length), "X-Goog-Upload-Header-Content-Type": type, "Content-Type": "application/json" },
      body: JSON.stringify({ file: { display_name: file.name ?? file.sha256.slice(0, 12) } }),
      signal: o.signal,
    });
    const to = start.headers.get("x-goog-upload-url");
    if (!start.ok || !to) throw new Error(`Uploading ${mediaLabel(file)} to Gemini failed (${start.status}): ${(await start.text()).slice(0, 300)}`);
    const sent = await o.fetch(to, { method: "POST", headers: { "Content-Length": String(bytes.length), "X-Goog-Upload-Offset": "0", "X-Goog-Upload-Command": "upload, finalize" }, body: bytes as Uint8Array<ArrayBuffer>, signal: o.signal });
    const body = (await sent.json().catch(() => ({}))) as { file?: { uri?: string; name?: string; state?: string } };
    if (!sent.ok || !body.file?.uri || !body.file.name) throw new Error(`Uploading ${mediaLabel(file)} to Gemini failed (${sent.status})`);
    // A video is processed before it can be used: wait for it (up to 10 minutes).
    let state = body.file.state;
    for (let i = 0; state === "PROCESSING" && i < 300; i++) {
      await Bun.sleep(2000);
      const got = await o.fetch(`${root}/v1beta/${body.file.name}`, { headers: { "x-goog-api-key": o.apiKey }, signal: o.signal });
      state = ((await got.json().catch(() => ({}))) as { state?: string }).state;
    }
    if (state && state !== "ACTIVE") throw new Error(`Gemini couldn't use ${mediaLabel(file)} (its file is ${state})`);
    return body.file.uri;
  }

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

  private static costs: Costs = {
    "gemini-1.5-flash": { in: 0.000075, out: 0.0003 },
    "gemini-1.5-pro": { in: 0.00125, out: 0.005 },
  };

  price(modelId: string): { in: number; out: number } | undefined {
    return exactPrice(GoogleAdapter.costs, this.modelName(modelId), []);
  }

  estimateCost(modelId: string, inputTokens: number, outputTokens: number): number {
    const model = this.modelName(modelId);
    const fallback = /flash/.test(model) ? { in: 0.0003, out: 0.0025 } : { in: 0.00125, out: 0.01 };
    return perK(lookupCost(GoogleAdapter.costs, model, fallback), inputTokens, outputTokens);
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
    } else if (m.role === "user") {
      const parts = [
        ...attachmentsOrLinks<unknown>(
          m.media,
          (text) => ({ text }),
          (a) => (a.url ? { fileData: { fileUri: a.url } } : a.fileUri ? { fileData: { fileUri: a.fileUri, mimeType: GEMINI_TYPES[a.type] ?? a.type } } : { inlineData: { mimeType: GEMINI_TYPES[a.type] ?? a.type, data: a.data } }),
        ),
        { text: m.content },
      ];
      if (out.at(-1)?.role === "user") out.at(-1)!.parts.push(...parts);
      else out.push({ role: "user", parts });
    } else {
      out.push({ role: "model", parts: [{ text: m.content }] });
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

  /** OpenRouter says what it billed in usage.cost (USD): that is the call's cost. */
  override parseResponse(json: unknown): LLMResponse {
    const parsed = super.parseResponse(json);
    const cost = (json as { usage?: { cost?: unknown } } | null)?.usage?.cost;
    return typeof cost === "number" && Number.isFinite(cost) && cost >= 0 ? { ...parsed, cost } : parsed;
  }

  override estimateCost(_modelId: string, inputTokens: number, outputTokens: number): number {
    // Varies by routed model; rough mid-tier estimate, for reporting only (no price, so MaxSpend refuses these models).
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
  input = accepts(IMAGES, 25 * MB);
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
        // Ollama takes a turn's images beside its text, so the labels go in the text, in order.
        const images = m.role === "user" ? (m.media ?? []).filter((a) => typeof a.data === "string") : [];
        if (images.length) return { role: "user", content: `${images.map((a) => mediaLabel(a)).join("\n")}\n\n${m.content}`, images: images.map((a) => a.data) };
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

  /** Local models are free: a known price of nothing, so MaxSpend lets them run. */
  price(_modelId: string): { in: number; out: number } {
    return { in: 0, out: 0 };
  }

  estimateCost(_modelId: string, _inputTokens: number, _outputTokens: number): number {
    return 0;
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
