/**
 * Embedding clients for VectorStore's `embeddings:` option.
 *
 *   openai/text-embedding-3-small        POST {base}/embeddings          OPENAI_API_KEY
 *   google/gemini-embedding-001          POST models/{m}:batchEmbedContents  GEMINI_API_KEY / GOOGLE_API_KEY
 *   ollama/nomic-embed-text              POST {OLLAMA_HOST}/api/embed     (no key)
 *   anything/else + embeddingsUrl:       OpenAI-compatible POST {embeddingsUrl}/embeddings
 *
 * Requests are batched, vectors are L2-normalized (so cosine = dot), and embeddings of
 * identical text are cached per process (bounded, least recently used first out).
 */

import { HaloError, HttpError } from "./errors.js";

/** "document" for stored text, "query" for a search. Only some providers (Google) embed them differently. */
export type EmbedPurpose = "document" | "query";

export interface EmbeddingClient {
  /** The model as written, e.g. "openai/text-embedding-3-small". Stored with each vector. */
  readonly model: string;
  embed(texts: string[], options?: { purpose?: EmbedPurpose; signal?: AbortSignal }): Promise<Float32Array[]>;
}

export interface EmbeddingOptions {
  /** `embeddings:` — "provider/model". */
  model: string;
  /** `apiKey:` — overrides the provider's env var. */
  apiKey?: string;
  /** `embeddingsUrl:` — base URL of the API (for OpenAI-compatible servers, or another Ollama/OpenAI host). */
  baseUrl?: string;
  /** `dimensions:` — ask the model for shorter vectors (OpenAI text-embedding-3, Gemini). */
  dimensions?: number;
  fetch: typeof fetch;
  env?: Record<string, string | undefined>;
}

const BATCH = { openai: 256, google: 100, ollama: 64 } as const;

/** True for `embeddings:` values that mean the built-in hashed bag-of-words vectors. */
export function isHashed(model: unknown): boolean {
  return model === undefined || model === null || model === "" || model === "hashed" || model === "local";
}

// ---------------------------------------------------------------------------
// Process-wide cache

const CACHE_MAX = 20_000;
const cache = new Map<string, Float32Array>();

function cacheGet(key: string): Float32Array | undefined {
  const v = cache.get(key);
  if (v) {
    cache.delete(key);
    cache.set(key, v);
  }
  return v;
}

function cachePut(key: string, v: Float32Array) {
  cache.set(key, v);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!);
}

/** Empty the embedding cache (for tests). */
export function clearEmbeddingCache() {
  cache.clear();
}

export function normalize(v: Float32Array): Float32Array {
  let n = 0;
  for (let i = 0; i < v.length; i++) n += v[i]! * v[i]!;
  n = Math.sqrt(n);
  if (n > 0 && Math.abs(n - 1) > 1e-6) for (let i = 0; i < v.length; i++) v[i]! /= n;
  return v;
}

// ---------------------------------------------------------------------------

type Protocol = "openai" | "google" | "ollama";

function withScheme(url: string): string {
  return (/^https?:\/\//.test(url) ? url : `http://${url}`).replace(/\/+$/, "");
}

export function createEmbeddingClient(options: EmbeddingOptions): EmbeddingClient {
  const spec = options.model.trim();
  const slash = spec.indexOf("/");
  if (slash <= 0 || slash === spec.length - 1) throw new HaloError(`embeddings: "${spec}" should be "provider/model", e.g. "openai/text-embedding-3-small"`, { code: "TOOL_ARGUMENT" });
  const provider = spec.slice(0, slash).toLowerCase();
  const name = spec.slice(slash + 1);
  const env = options.env ?? process.env;
  const { fetch, dimensions } = options;
  if (dimensions !== undefined && !(Number.isInteger(dimensions) && dimensions > 0)) throw new HaloError(`dimensions: must be a positive integer`, { code: "TOOL_ARGUMENT" });

  let protocol: Protocol;
  let base: string;
  let key: string | undefined = options.apiKey || undefined;
  if (provider === "google" || provider === "gemini") {
    protocol = "google";
    base = options.baseUrl ? withScheme(options.baseUrl) : "https://generativelanguage.googleapis.com/v1beta";
    key ??= env.GEMINI_API_KEY || env.GOOGLE_API_KEY;
    if (!key) throw new HaloError(`embeddings "${spec}" needs an API key: set GEMINI_API_KEY (or GOOGLE_API_KEY), or pass apiKey:`, { code: "MISSING_API_KEY" });
  } else if (provider === "ollama") {
    protocol = "ollama";
    base = withScheme(options.baseUrl || env.OLLAMA_HOST || "http://localhost:11434");
  } else if (provider === "openai" || options.baseUrl) {
    protocol = "openai";
    base = options.baseUrl ? withScheme(options.baseUrl) : "https://api.openai.com/v1";
    if (provider === "openai") key ??= env.OPENAI_API_KEY;
    if (!key && !options.baseUrl) throw new HaloError(`embeddings "${spec}" needs an API key: set OPENAI_API_KEY, or pass apiKey:`, { code: "MISSING_API_KEY" });
  } else {
    throw new HaloError(`embeddings: unknown provider "${provider}" in "${spec}" (use openai/, google/, ollama/, or give embeddingsUrl: for an OpenAI-compatible API)`, { code: "TOOL_ARGUMENT" });
  }

  async function post(url: string, headers: Record<string, string>, body: unknown, signal?: AbortSignal): Promise<any> {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body), signal });
    const text = await res.text();
    if (!res.ok) throw new HttpError(`Embedding request to ${spec} failed (${res.status}): ${text.slice(0, 500)}`, res.status, text);
    try {
      return JSON.parse(text);
    } catch {
      throw new HaloError(`Embedding response from ${spec} is not JSON: ${text.slice(0, 200)}`);
    }
  }

  async function request(batch: string[], purpose: EmbedPurpose, signal?: AbortSignal): Promise<number[][]> {
    if (protocol === "openai") {
      const json = await post(`${base}/embeddings`, key ? { Authorization: `Bearer ${key}` } : {}, { model: name, input: batch, encoding_format: "float", ...(dimensions ? { dimensions } : {}) }, signal);
      const data = (json?.data ?? []) as Array<{ index?: number; embedding: number[] }>;
      return data.map((d, i) => ({ i: d.index ?? i, e: d.embedding })).sort((a, b) => a.i - b.i).map((d) => d.e);
    }
    if (protocol === "google") {
      const json = await post(
        `${base}/models/${encodeURIComponent(name)}:batchEmbedContents`,
        { "x-goog-api-key": key! },
        {
          requests: batch.map((text) => ({
            model: `models/${name}`,
            content: { parts: [{ text }] },
            taskType: purpose === "query" ? "RETRIEVAL_QUERY" : "RETRIEVAL_DOCUMENT",
            ...(dimensions ? { outputDimensionality: dimensions } : {}),
          })),
        },
        signal,
      );
      return ((json?.embeddings ?? []) as Array<{ values: number[] }>).map((e) => e.values);
    }
    const json = await post(`${base}/api/embed`, key ? { Authorization: `Bearer ${key}` } : {}, { model: name, input: batch, ...(dimensions ? { dimensions } : {}) }, signal);
    return (json?.embeddings ?? []) as number[][];
  }

  // Google embeds queries and documents differently; the others don't, so they share cache entries.
  const keyPrefix = `${protocol}\0${base}\0${name}\0${dimensions ?? ""}\0`;
  return {
    model: spec,
    async embed(texts, { purpose = "document", signal } = {}) {
      const prefix = protocol === "google" ? `${keyPrefix}${purpose}\0` : keyPrefix;
      const out: Array<Float32Array | undefined> = texts.map((t) => cacheGet(prefix + t));
      // Each distinct uncached text once.
      const pending = [...new Set(texts.filter((_, i) => !out[i]))];
      const size = BATCH[protocol];
      const fresh = new Map<string, Float32Array>();
      for (let i = 0; i < pending.length; i += size) {
        const batch = pending.slice(i, i + size);
        const vectors = await request(batch, purpose, signal);
        if (vectors.length !== batch.length || vectors.some((v) => !Array.isArray(v) || !v.length)) {
          throw new HaloError(`Embedding response from ${spec} has ${vectors.length} vectors for ${batch.length} inputs`);
        }
        batch.forEach((t, j) => {
          const v = normalize(Float32Array.from(vectors[j]!));
          fresh.set(t, v);
          cachePut(prefix + t, v);
        });
      }
      return texts.map((t, i) => out[i] ?? fresh.get(t)!);
    },
  };
}
