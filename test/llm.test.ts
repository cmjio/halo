import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import { parse } from "../src/parser/index";
import { HaloRuntime } from "../src/runtime/runtime";
import { AnthropicAdapter, GoogleAdapter, OpenAIAdapter, OllamaAdapter } from "../src/runtime/adapter";

// A local server speaking the OpenAI, Anthropic, Gemini, and Ollama wire formats.
interface Seen {
  path: string;
  headers: Record<string, string>;
  body: any;
}
let seen: Seen[] = [];
let server: ReturnType<typeof Bun.serve>;
let base: string;
let failNext = 0;

beforeAll(() => {
  server = Bun.serve({
    port: 0,
    async fetch(req) {
      const url = new URL(req.url);
      const body: any = await req.json();
      seen.push({ path: url.pathname, headers: Object.fromEntries(req.headers), body });
      if (failNext > 0) {
        failNext--;
        return new Response("overloaded", { status: 529 });
      }
      const prompt = JSON.stringify(body);
      if (url.pathname === "/v1/chat/completions") {
        return Response.json({ choices: [{ message: { content: `openai:${body.messages.at(-1).content}` } }], usage: { prompt_tokens: 1000, completion_tokens: 500 } });
      }
      if (url.pathname === "/v1/messages") {
        return Response.json({ content: [{ type: "text", text: `anthropic:${body.messages.at(-1).content}` }], usage: { input_tokens: 10, output_tokens: 5 } });
      }
      if (url.pathname.includes(":generateContent")) {
        return Response.json({ candidates: [{ content: { parts: [{ text: `gemini:${body.contents.at(-1).parts[0].text}` }] } }], usageMetadata: { promptTokenCount: 7, candidatesTokenCount: 3 } });
      }
      if (url.pathname === "/api/chat") {
        return Response.json({ message: { content: '{"answer": 42}' } });
      }
      return new Response(`unexpected ${url.pathname} ${prompt}`, { status: 404 });
    },
  });
  base = `http://localhost:${server.port}`;
});

afterAll(() => server.stop(true));

function runtime(src: string, config: ConstructorParameters<typeof HaloRuntime>[0] = {}) {
  seen = [];
  const rt = new HaloRuntime({ env: {}, logger: { log() {}, warn() {} }, ...config })
    .registerAdapter(new OpenAIAdapter({ baseUrl: `${base}/v1` }))
    .registerAdapter(new AnthropicAdapter({ baseUrl: base }))
    .registerAdapter(new GoogleAdapter({ baseUrl: `${base}/v1beta` }))
    .registerAdapter(new OllamaAdapter({ baseUrl: base }));
  return rt.load(parse(src));
}

describe("LLM calls over HTTP", () => {
  test("OpenAI: sends model, temperature, system prompt; tracks tokens and cost", async () => {
    const rt = runtime(
      `agent M [openai/gpt-4o, temp: 0.2, system: "Be terse."]
       pipeline S(name: String) -> Result:
         name |> M.prompt("Greet {{name}}.")`,
      { env: { OPENAI_API_KEY: "sk-test" } },
    );
    const result = await rt.run("S", { name: "Ana" });
    expect(result.output).toBe("openai:Greet Ana.");
    const req = seen[0]!;
    expect(req.headers.authorization).toBe("Bearer sk-test");
    expect(req.body).toEqual({ model: "gpt-4o", temperature: 0.2, messages: [{ role: "system", content: "Be terse." }, { role: "user", content: "Greet Ana." }] });
    expect(result.context.meta.tokens).toEqual({ prompt: 1000, completion: 500 });
    expect(result.context.meta.cost).toBeCloseTo(0.0125, 6);
    expect(rt.getCostTracker().getTotalCost()).toBeCloseTo(0.0125, 6);
  });

  test("Anthropic: the user message is sent (not dropped) and system is top-level", async () => {
    const rt = runtime(
      `agent C [anthropic/claude-sonnet-4, system: "You are kind."]
       pipeline S(x: String) -> Result:
         x |> C.prompt("Say hi")`,
      { env: { ANTHROPIC_API_KEY: "ak" } },
    );
    expect(await rt.execute("S", { x: "Bob" })).toBe("anthropic:Say hi\n\nInput:\nBob");
    expect(seen[0]!.headers["x-api-key"]).toBe("ak");
    expect(seen[0]!.body).toEqual({ model: "claude-sonnet-4", system: "You are kind.", messages: [{ role: "user", content: "Say hi\n\nInput:\nBob" }], max_tokens: 4096 });
  });

  test("Gemini: key goes in the x-goog-api-key header, never the body", async () => {
    const rt = runtime(
      `agent G [gemini-3-1-pro]
       pipeline S(x: String) -> Result:
         x |> G.prompt()`,
      { env: { GEMINI_API_KEY: "gk" } },
    );
    expect(await rt.execute("S", { x: "ping" })).toBe("gemini:ping");
    expect(seen[0]!.path).toBe("/v1beta/models/gemini-3-1-pro:generateContent");
    expect(seen[0]!.headers["x-goog-api-key"]).toBe("gk");
    expect(JSON.stringify(seen[0]!.body)).not.toContain("gk");
  });

  test("Ollama: needs no key; JSON responses are parsed into objects", async () => {
    const rt = runtime(
      `agent L [ollama/llama3.1]
       pipeline S(q: String) -> Result:
         q |> L.answer() as reply
           |? (context.data.reply.answer == 42)
           |> System.Log("ok")`,
    );
    const result = await rt.run("S", { q: "meaning of life?" });
    expect(result.status).toBe("completed");
    expect(result.output).toEqual({ answer: 42 });
    expect(seen[0]!.body.messages[0].content).toBe("Task: answer\n\nInput:\nmeaning of life?");
  });

  test("each provider uses its own env key; a missing key names the variable to set", async () => {
    const rt = runtime(
      `agent A [openai/gpt-4o-mini]
       agent B [anthropic/claude-sonnet-4]
       pipeline S(x: String) -> Result:
         x |> A.prompt() |> B.prompt()`,
      { env: { OPENAI_API_KEY: "sk-only-openai" } },
    );
    await expect(rt.execute("S", { x: "hi" })).rejects.toThrow("No API key set for anthropic (model \"anthropic/claude-sonnet-4\"). Set ANTHROPIC_API_KEY or HALO_API_KEY");
    expect(seen).toHaveLength(1);
    expect(seen[0]!.headers.authorization).toBe("Bearer sk-only-openai");
  });

  test("@retry retries 5xx responses and records the attempts", async () => {
    const rt = runtime(
      `agent M [openai/gpt-4o-mini]
       @retry(2, 1ms)
       pipeline S(x: String) -> Result:
         x |> M.prompt()`,
      { env: { OPENAI_API_KEY: "k" } },
    );
    failNext = 2;
    const result = await rt.run("S", { x: "hi" });
    expect(result.output).toBe("openai:hi");
    expect(seen).toHaveLength(3);
    expect(result.context.meta.calls[0]!.attempts).toBe(3);
  });

  test("errors that are not transient are not retried", async () => {
    let calls = 0;
    const rt = runtime(`agent M [openai/gpt-4o-mini]\n@retry(5, 1ms)\npipeline S(x: String) -> Result:\n  x |> M.prompt()`, {
      env: { OPENAI_API_KEY: "k" },
      fetch: (async () => (calls++, new Response("bad request", { status: 400 }))) as unknown as typeof fetch,
    });
    await expect(rt.execute("S", { x: "hi" })).rejects.toThrow("LLM API error from openai (400): bad request");
    expect(calls).toBe(1);
  });

  test("router picks the cheapest available model under cost-optimized strategy", async () => {
    const rt = runtime(
      `agent M [openai/gpt-4o]
       pipeline S(x: String) -> Result:
         x |> M.prompt()`,
      { env: { OPENAI_API_KEY: "k" }, router: { strategy: "cost-optimized", preferredProviders: ["openai"] } },
    );
    await rt.execute("S", { x: "hi" });
    expect(seen[0]!.body.model).toBe("gpt-4o-mini");
  });
});
