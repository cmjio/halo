import { test, expect, describe, beforeEach, afterAll } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "../src/parser/index";
import { HaloRuntime, type RuntimeConfig } from "../src/runtime/runtime";
import { clearEmbeddingCache, createEmbeddingClient } from "../src/runtime/embeddings";
import { LocalVectorStore } from "../src/runtime/vectors";
import { PgVectorStore, validateTableName } from "../src/runtime/pgvectors";

const tmp = mkdtempSync(join(tmpdir(), "halo-vec-emb-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));
beforeEach(() => clearEmbeddingCache());

/** A tiny "semantic" model: one dimension per topic, so texts about the same thing are close without sharing words. */
const TOPICS = [
  ["refund", "money", "charge", "invoice", "billing", "paid", "price"],
  ["crash", "error", "bug", "broken", "freez", "blank"],
  ["login", "password", "sign", "account"],
  ["pizza", "pasta", "food", "dinner", "lunch"],
];
function fakeVector(text: string, dims = TOPICS.length + 1): number[] {
  const t = text.toLowerCase();
  const v = TOPICS.map((words) => words.filter((w) => t.includes(w)).length * 3);
  v.push(0.5); // shared bias, so nothing is a zero vector
  while (v.length < dims) v.push(0);
  return v.slice(0, dims);
}

interface Req {
  url: string;
  headers: Record<string, string>;
  body: any;
}

/** A fetch that answers OpenAI, Google and Ollama embedding requests, and records them. */
function fakeFetch(dims?: number) {
  const calls: Req[] = [];
  const f = (async (input: any, init: any) => {
    const url = String(input);
    const body = JSON.parse(init.body);
    calls.push({ url, headers: init.headers, body });
    let json: unknown;
    if (url.includes(":batchEmbedContents")) json = { embeddings: body.requests.map((r: any) => ({ values: fakeVector(r.content.parts[0].text, dims) })) };
    else if (url.endsWith("/api/embed")) json = { embeddings: body.input.map((t: string) => fakeVector(t, dims)) };
    else if (url.endsWith("/embeddings"))
      // Out of order on purpose: the client must sort by index.
      json = { data: body.input.map((t: string, index: number) => ({ index, embedding: fakeVector(t, body.dimensions ?? dims) })).reverse() };
    else return new Response("not found", { status: 404 });
    return new Response(JSON.stringify(json), { headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
  return { fetch: f, calls };
}

describe("embedding clients", () => {
  test("OpenAI: request shape, batching, normalization, ordering", async () => {
    const { fetch, calls } = fakeFetch();
    const c = createEmbeddingClient({ model: "openai/text-embedding-3-small", fetch, env: { OPENAI_API_KEY: "sk-env" } });
    const texts = Array.from({ length: 300 }, (_, i) => `refund ${i}`);
    const out = await c.embed(texts);
    expect(calls).toHaveLength(2);
    expect(calls[0]!.url).toBe("https://api.openai.com/v1/embeddings");
    expect(calls[0]!.headers.Authorization).toBe("Bearer sk-env");
    expect(calls[0]!.body).toMatchObject({ model: "text-embedding-3-small", encoding_format: "float" });
    expect(calls[0]!.body.input).toHaveLength(256);
    expect(calls[1]!.body.input).toHaveLength(44);
    expect(out).toHaveLength(300);
    for (const v of [out[0]!, out[299]!]) expect(Math.hypot(...v)).toBeCloseTo(1, 5);
    // Reversed in the response, but returned in input order.
    const pizza = await c.embed(["refund please", "pizza for dinner"]);
    expect(pizza[0]![0]!).toBeGreaterThan(pizza[0]![3]!);
    expect(pizza[1]![3]!).toBeGreaterThan(pizza[1]![0]!);
  });

  test("apiKey: overrides the env var; dimensions: is sent", async () => {
    const { fetch, calls } = fakeFetch();
    const c = createEmbeddingClient({ model: "openai/text-embedding-3-large", apiKey: "sk-arg", dimensions: 8, fetch, env: { OPENAI_API_KEY: "sk-env" } });
    const [v] = await c.embed(["x"]);
    expect(calls[0]!.headers.Authorization).toBe("Bearer sk-arg");
    expect(calls[0]!.body.dimensions).toBe(8);
    expect(v).toHaveLength(8);
  });

  test("identical texts are embedded once, within and across calls", async () => {
    const { fetch, calls } = fakeFetch();
    const c = createEmbeddingClient({ model: "openai/text-embedding-3-small", fetch, env: { OPENAI_API_KEY: "k" } });
    const a = await c.embed(["same", "same", "other"]);
    expect(calls[0]!.body.input).toEqual(["same", "other"]);
    expect(a[0]).toBe(a[1]!);
    // Another client for the same model shares the cache.
    const c2 = createEmbeddingClient({ model: "openai/text-embedding-3-small", fetch, env: { OPENAI_API_KEY: "k" } });
    await c2.embed(["other", "same"]);
    expect(calls).toHaveLength(1);
    await c2.embed(["new", "same"]);
    expect(calls).toHaveLength(2);
    expect(calls[1]!.body.input).toEqual(["new"]);
  });

  test("Google: batchEmbedContents with task types and the API key header", async () => {
    const { fetch, calls } = fakeFetch();
    const c = createEmbeddingClient({ model: "google/gemini-embedding-001", fetch, env: { GOOGLE_API_KEY: "g-key" } });
    await c.embed(Array.from({ length: 150 }, (_, i) => `t${i}`));
    expect(calls).toHaveLength(2);
    expect(calls[0]!.url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents");
    expect(calls[0]!.headers["x-goog-api-key"]).toBe("g-key");
    expect(calls[0]!.body.requests).toHaveLength(100);
    expect(calls[0]!.body.requests[0]).toEqual({ model: "models/gemini-embedding-001", content: { parts: [{ text: "t0" }] }, taskType: "RETRIEVAL_DOCUMENT" });
    // Queries are embedded (and cached) separately from documents.
    await c.embed(["t0"], { purpose: "query" });
    expect(calls).toHaveLength(3);
    expect(calls[2]!.body.requests[0].taskType).toBe("RETRIEVAL_QUERY");
    // GEMINI_API_KEY wins over GOOGLE_API_KEY.
    const c2 = createEmbeddingClient({ model: "google/text-embedding-004", fetch, env: { GEMINI_API_KEY: "gem", GOOGLE_API_KEY: "goo" } });
    await c2.embed(["z"]);
    expect(calls[3]!.headers["x-goog-api-key"]).toBe("gem");
    expect(calls[3]!.url).toContain("/models/text-embedding-004:batchEmbedContents");
  });

  test("Ollama: /api/embed at OLLAMA_HOST, no key needed", async () => {
    const { fetch, calls } = fakeFetch();
    const c = createEmbeddingClient({ model: "ollama/nomic-embed-text", fetch, env: { OLLAMA_HOST: "gpu-box:11434" } });
    await c.embed(["a", "b"]);
    expect(calls[0]!.url).toBe("http://gpu-box:11434/api/embed");
    expect(calls[0]!.body).toEqual({ model: "nomic-embed-text", input: ["a", "b"] });
    expect(calls[0]!.headers.Authorization).toBeUndefined();
    const d = createEmbeddingClient({ model: "ollama/nomic-embed-text", fetch, env: {} });
    await d.embed(["c"]);
    expect(calls[1]!.url).toBe("http://localhost:11434/api/embed");
  });

  test("any OpenAI-compatible API via embeddingsUrl", async () => {
    const { fetch, calls } = fakeFetch();
    const c = createEmbeddingClient({ model: "together/BAAI/bge-base-en-v1.5", baseUrl: "https://api.together.xyz/v1/", apiKey: "tk", fetch, env: {} });
    await c.embed(["q"]);
    expect(calls[0]!.url).toBe("https://api.together.xyz/v1/embeddings");
    expect(calls[0]!.body.model).toBe("BAAI/bge-base-en-v1.5");
    expect(calls[0]!.headers.Authorization).toBe("Bearer tk");
  });

  test("clear errors: missing key, unknown provider, HTTP failure", async () => {
    const { fetch } = fakeFetch();
    expect(() => createEmbeddingClient({ model: "openai/text-embedding-3-small", fetch, env: {} })).toThrow("set OPENAI_API_KEY");
    expect(() => createEmbeddingClient({ model: "google/gemini-embedding-001", fetch, env: {} })).toThrow("GEMINI_API_KEY");
    expect(() => createEmbeddingClient({ model: "acme/embed", fetch, env: {} })).toThrow('unknown provider "acme"');
    expect(() => createEmbeddingClient({ model: "nomodel", fetch, env: {} })).toThrow('"provider/model"');
    const failing = (async () => new Response("rate limited", { status: 429 })) as unknown as typeof fetch;
    const c = createEmbeddingClient({ model: "openai/text-embedding-3-small", fetch: failing, env: { OPENAI_API_KEY: "k" } });
    await expect(c.embed(["x"])).rejects.toThrow("failed (429): rate limited");
  });
});

describe("dense LocalVectorStore", () => {
  const MODEL = "test/topics";
  const vec = (t: string, dims?: number) => {
    const v = Float32Array.from(fakeVector(t, dims));
    const n = Math.hypot(...v);
    return { model: MODEL, vector: v.map((x) => x / n) };
  };

  test("ranks by meaning, with tags, excludeTags, minScore, order and limit", () => {
    const s = new LocalVectorStore(":memory:");
    const docs: Array<[string, string[]]> = [
      ["customer was charged twice", ["billing"]],
      ["app crashes on startup", ["bug"]],
      ["cannot sign in after password change", ["bug", "auth"]],
      ["invoice shows the wrong price", ["billing", "urgent"]],
      ["team pizza dinner on friday", ["social"]],
    ];
    for (const [d, t] of docs) s.insert("ns", d, t, { src: "test" }, vec(d));
    const q = vec("I want my money back");
    const hits = s.search("ns", "I want my money back", { limit: 2 }, q);
    expect(hits.map((h) => h.content)).toEqual(["customer was charged twice", "invoice shows the wrong price"]);
    expect(hits[0]!.metadata).toEqual({ src: "test" });
    expect(hits[0]!.score).toBeGreaterThan(0.9);
    expect(s.search("ns", "", { limit: 10, tags: ["billing", "urgent"] }, q).map((h) => h.content)).toEqual(["invoice shows the wrong price"]);
    expect(s.search("ns", "", { limit: 10, excludeTags: ["billing", "social"] }, q).map((h) => h.content).sort()).toEqual(["app crashes on startup", "cannot sign in after password change"]);
    expect(s.search("ns", "", { limit: 10, minScore: 0.5 }, q)).toHaveLength(2);
    expect(s.search("ns", "", { limit: 2, order: "recent" }, q).map((h) => h.content)).toEqual(["team pizza dinner on friday", "invoice shows the wrong price"]);
    expect(s.search("ns", "", { limit: 0 }, q)).toEqual([]);
    expect(s.search("empty", "", {}, q)).toEqual([]);
    // Equal scores: the earlier entry first.
    s.insert("tie", "a pizza", [], {}, vec("pizza"));
    s.insert("tie", "b pizza", [], {}, vec("pizza"));
    expect(s.search("tie", "", { limit: 1 }, vec("pizza"))[0]!.content).toBe("a pizza");
    s.close();
  });

  test("refuses to mix models or dimensions in a namespace", () => {
    const s = new LocalVectorStore(":memory:");
    s.insert("dense", "refund", [], {}, vec("refund"));
    expect(() => s.insert("dense", "x", [], {}, { model: "other/model", vector: vec("x").vector })).toThrow('namespace "dense" holds test/topics embeddings (5 dims), but this store uses other/model (5 dims)');
    expect(() => s.insert("dense", "x", [], {}, vec("x", 8))).toThrow("(8 dims)");
    expect(() => s.insert("dense", "hashed")).toThrow("this store uses hashed (512 dims)");
    expect(() => s.search("dense", "refund")).toThrow("holds test/topics embeddings");
    s.insert("plain", "hashed entry");
    expect(() => s.search("plain", "q", {}, vec("q"))).toThrow('namespace "plain" holds hashed embeddings (512 dims)');
    expect(s.search("plain", "hashed entry")[0]!.content).toBe("hashed entry");
    // Emptying a namespace frees it for another model.
    expect(s.delete("dense", { tags: [] })).toBe(1);
    s.insert("dense", "x", [], {}, vec("x", 8));
    expect(s.count("dense")).toBe(1);
    s.close();
  });

  test("keeps up with rows added or deleted by another process, and survives reopening", () => {
    const path = join(tmp, "dense.sqlite");
    const a = new LocalVectorStore(path);
    const b = new LocalVectorStore(path);
    a.insert("ns", "refund for a broken blender", ["billing"], {}, vec("refund for a broken blender"));
    a.insert("ns", "the app crashes on login", ["bug"], {}, vec("the app crashes on login"));
    expect(b.search("ns", "", {}, vec("money"))[0]!.content).toBe("refund for a broken blender");
    for (let i = 0; i < 100; i++) a.insert("ns", `pizza ${i}`, ["food"], {}, vec(`pizza ${i}`));
    expect(b.search("ns", "", { limit: 3 }, vec("lunch food")).every((h) => h.tags[0] === "food")).toBe(true);
    expect(a.delete("ns", { tags: ["food"] })).toBe(100);
    a.insert("ns", "password reset never arrives", ["bug"], {}, vec("password reset never arrives"));
    expect(b.search("ns", "", { limit: 10, minScore: -1 }, vec("x")).map((h) => h.content).sort()).toEqual(["password reset never arrives", "refund for a broken blender", "the app crashes on login"]);
    a.close();
    b.close();
    const c = new LocalVectorStore(path);
    expect(c.search("ns", "", { limit: 1 }, vec("sign in to my account"))[0]!.content).toBe("password reset never arrives");
    c.close();
  });

  test("a 20k x 256 namespace searches quickly", () => {
    const s = new LocalVectorStore(":memory:");
    const dims = 256;
    let seed = 1;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
    const tx = (s as any).db.transaction(() => {
      for (let i = 0; i < 20_000; i++) {
        const v = Float32Array.from({ length: dims }, rand);
        const n = Math.hypot(...v);
        s.insert("big", `doc ${i}`, i % 2 ? ["odd"] : [], {}, { model: "m/x", vector: v.map((x) => x / n) });
      }
    });
    tx();
    const q = { model: "m/x", vector: Float32Array.from({ length: dims }, rand) };
    s.search("big", "", {}, q); // builds the matrix
    const t0 = performance.now();
    const hits = s.search("big", "", { limit: 10, tags: ["odd"], minScore: -1 }, q);
    const ms = performance.now() - t0;
    expect(hits).toHaveLength(10);
    expect(hits.every((h) => h.tags[0] === "odd")).toBe(true);
    for (let i = 1; i < hits.length; i++) expect(hits[i - 1]!.score).toBeGreaterThanOrEqual(hits[i]!.score);
    expect(ms).toBeLessThan(200);
    s.close();
  });
});

describe("VectorStore tool with embeddings:", () => {
  function rt(src: string, config: RuntimeConfig = {}) {
    const ast = parse(src);
    expect(ast.errors).toEqual([]);
    return new HaloRuntime({ env: {}, vectorPath: ":memory:", checkpointDir: tmp, logger: { log() {}, warn() {} }, ...config }).load(ast);
  }

  test("logs and searches with model embeddings through services.fetch", async () => {
    const { fetch, calls } = fakeFetch();
    const r = rt(
      `store Notes : VectorStore(namespace: "kb", embeddings: "openai/text-embedding-3-small", apiKey: "sk-test")
pipeline Remember(fact: String) -> Result:
  fact |> Notes.log(content: fact, tags: ["faq"])
pipeline Lookup(q: String) -> Result:
  q |> Notes.search(query: q, limit: 1)
pipeline Billing(q: String) -> Result:
  q |> Notes.search(query: q, limit: 5, exclude_tags: ["faq"])`,
      { fetch },
    );
    for (const fact of ["refunds take five days", "the app crashes when offline", "pizza night is friday"]) {
      expect(await r.execute("Remember", { fact })).toMatchObject({ stored: true, content: fact });
    }
    const found = await r.execute("Lookup", { q: "where is my money" });
    expect((found as any[]).map((h) => h.content)).toEqual(["refunds take five days"]);
    expect(calls.every((c) => c.url === "https://api.openai.com/v1/embeddings" && c.headers.Authorization === "Bearer sk-test")).toBe(true);
    expect(calls).toHaveLength(4);
    expect(await r.execute("Billing", { q: "where is my money" })).toEqual([]);
    // Same query again: cached, no request.
    await r.execute("Lookup", { q: "where is my money" });
    expect(calls).toHaveLength(4);
  });

  test("a namespace can't switch models", async () => {
    const { fetch } = fakeFetch();
    const r = rt(
      `store A : VectorStore(namespace: "shared")
store B : VectorStore(namespace: "shared", embeddings: "ollama/nomic-embed-text")
pipeline PutA(x: String) -> Result:
  x |> A.log(content: x)
pipeline PutB(x: String) -> Result:
  x |> B.log(content: x)`,
      { fetch },
    );
    expect(await r.execute("PutA", { x: "hello" })).toMatchObject({ stored: true });
    await expect(r.execute("PutB", { x: "hello" })).rejects.toThrow('namespace "shared" holds hashed embeddings (512 dims), but this store uses ollama/nomic-embed-text');
  });
});

describe("pgvector", () => {
  test("validates table names", () => {
    expect(validateTableName("halo_vectors").quoted).toBe('"halo_vectors"');
    expect(validateTableName("app.memories")).toEqual({ quoted: '"app"."memories"', base: "memories" });
    for (const bad of ["x; DROP TABLE y", 'a"b', "a.b.c", "1abc", ""]) expect(() => validateTableName(bad)).toThrow("not a valid table name");
  });

  const url = process.env.TEST_DATABASE_URL;
  test.skipIf(!url)("stores and searches in Postgres (TEST_DATABASE_URL)", async () => {
    const sql = new Bun.SQL(url!);
    const table = `halo_vectors_test_${process.pid}`;
    try {
      const s = new PgVectorStore(sql, table);
      const v = (t: string, model = "test/topics") => {
        const raw = Float32Array.from(fakeVector(t));
        const n = Math.hypot(...raw);
        return { model, vector: raw.map((x) => x / n) };
      };
      for (const [d, tags] of [
        ["customer was charged twice", ["billing"]],
        ["app crashes on startup", ["bug"]],
        ["invoice shows the wrong price", ["billing", "urgent"]],
      ] as Array<[string, string[]]>) {
        await s.insert("ns", d, tags, { k: 1 }, v(d));
      }
      expect(await s.count("ns")).toBe(3);
      const q = v("money back");
      const hits = await s.search("ns", "", { limit: 2 }, q);
      expect(hits.map((h) => h.content).sort()).toEqual(["customer was charged twice", "invoice shows the wrong price"]);
      expect(hits[0]!.metadata).toEqual({ k: 1 });
      expect((await s.search("ns", "", { limit: 5, tags: ["urgent"] }, q)).map((h) => h.content)).toEqual(["invoice shows the wrong price"]);
      expect((await s.search("ns", "", { limit: 5, excludeTags: ["billing"] }, q)).map((h) => h.content)).toEqual(["app crashes on startup"]);
      expect((await s.search("ns", "", { limit: 1, order: "recent", minScore: -1 }, q))[0]!.content).toBe("invoice shows the wrong price");
      await expect(s.insert("ns", "x", [], {}, v("x", "other/model"))).rejects.toThrow("holds test/topics embeddings");
      expect(await s.delete("ns", { tags: ["billing"] })).toBe(2);
      expect(await s.count("ns")).toBe(1);
    } finally {
      await sql.unsafe(`DROP TABLE IF EXISTS "${table}"`);
      await sql.close();
    }
  });
});
