/**
 * Picks a VectorStore tool's backend and embedder from its declaration args:
 *
 *   VectorStore(namespace: "x")                                    local SQLite, hashed vectors
 *   VectorStore(embeddings: "openai/text-embedding-3-small")       local SQLite, model vectors
 *   VectorStore(url: Env.DATABASE_URL, embeddings: "...", table:)  Postgres + pgvector
 *
 * Other args: `apiKey:` (else the provider's env var), `embeddingsUrl:` (an OpenAI-compatible
 * base URL, or another Ollama host), `dimensions:` (shorter vectors, where the model allows).
 */

import { HaloError } from "./errors.js";
import { createEmbeddingClient, isHashed, type EmbedPurpose } from "./embeddings.js";
import { PgVectorStore } from "./pgvectors.js";
import type { ToolCall, ToolServices } from "./tools.js";
import { asText, embed, HASHED_MODEL, type ModelVector, type VectorBackend } from "./vectors.js";

export interface ResolvedVectorStore {
  store: VectorBackend;
  /** True for hashed vectors (which also embed an entry's tags, as the local store always has). */
  hashed: boolean;
  /** The vector to store or search with, or undefined for the local store's built-in hashed vectors. */
  vector(text: unknown, purpose: EmbedPurpose): Promise<ModelVector | undefined>;
}

const optString = (v: unknown, name: string): string | undefined => {
  if (v === undefined || v === null || v === "") return undefined;
  if (typeof v !== "string") throw new HaloError(`VectorStore ${name}: must be a string`, { code: "TOOL_ARGUMENT" });
  return v;
};

export function resolveVectorStore(call: ToolCall, services: ToolServices): ResolvedVectorStore {
  const model = call.config("embeddings");
  const url = optString(call.config("url"), "url");
  let embedder: ResolvedVectorStore["vector"];
  if (isHashed(model)) {
    // Hashed: the local store embeds by itself; Postgres needs the vector passed in.
    embedder = async (text) => (url ? { model: HASHED_MODEL, vector: embed(asText(text)) } : undefined);
  } else {
    const dims = call.config("dimensions");
    const client = createEmbeddingClient({
      model: optString(model, "embeddings")!,
      apiKey: optString(call.config("apiKey"), "apiKey"),
      baseUrl: optString(call.config("embeddingsUrl"), "embeddingsUrl"),
      dimensions: dims === undefined ? undefined : Number(dims),
      fetch: services.fetch,
      env: services.env,
    });
    embedder = async (text, purpose) => ({ model: client.model, vector: (await client.embed([asText(text)], { purpose, signal: call.signal }))[0]! });
  }
  const store: VectorBackend = url ? new PgVectorStore(services.sql(url), optString(call.config("table"), "table")) : services.vectors();
  return { store, hashed: isHashed(model), vector: embedder };
}
