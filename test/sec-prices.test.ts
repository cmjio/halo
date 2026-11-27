import { test, expect, describe } from "bun:test";
import { parse } from "../src/parser/index";
import { HaloRuntime, PolicyViolation, type RuntimeConfig, type RuntimeEvent } from "../src/runtime/runtime";
import { AnthropicAdapter, OllamaAdapter, OpenRouterAdapter } from "../src/runtime/adapter";
import { plan } from "../src/plan";

const M = 1_000_000;

describe("Anthropic prices (USD per million tokens, from the pricing page)", () => {
  const a = new AnthropicAdapter();
  const perM = (model: string, input = 1000) => {
    const p = a.price(model, input);
    return p && { input: +(p.in * 1000).toFixed(6), output: +(p.out * 1000).toFixed(6) };
  };
  const table: Array<[string, number, number]> = [
    ["claude-haiku-4-5", 1, 5],
    ["claude-sonnet-4-5", 3, 15],
    ["claude-opus-4-5", 5, 25],
    ["claude-opus-4-1", 15, 75],
    ["claude-sonnet-5-5", 2, 10],
    ["claude-opus-5-5", 4, 20],
    ["claude-fable-5-2", 8, 40],
    ["claude-mythos-5-2", 8, 40],
    ["claude-fable-5-1", 10, 50],
    ["claude-fable-5", 10, 50],
    ["claude-opus-5", 5, 25],
    ["claude-opus-4-8", 5, 25],
    ["claude-opus-4-7", 5, 25],
    ["claude-opus-4-6", 5, 25],
    ["claude-opus-4", 15, 75],
    ["claude-sonnet-5", 2, 10],
    ["claude-sonnet-4-6", 3, 15],
    ["claude-sonnet-4", 3, 15],
  ];
  for (const [model, input, output] of table) {
    test(model, () => {
      expect(perM(`anthropic/${model}`)).toEqual({ input, output });
      expect(perM(model)).toEqual({ input, output });
    });
  }

  test("a dated snapshot has its model's price", () => {
    expect(perM("anthropic/claude-sonnet-4-5-20250929")).toEqual({ input: 3, output: 15 });
  });

  test("Haiku 5.5 is priced by the prompt: up to 100,000 tokens, and over", () => {
    expect(perM("anthropic/claude-haiku-5-5", 100_000)).toEqual({ input: 0.1, output: 0.5 });
    expect(perM("anthropic/claude-haiku-5-5", 100_001)).toEqual({ input: 0.5, output: 2.5 });
  });

  test("a model not on the page has no price (no guessing from its family)", () => {
    expect(a.price("anthropic/claude-3-5-sonnet", 10)).toBeUndefined();
    expect(a.price("anthropic/claude-opus-9", 10)).toBeUndefined();
  });

  test("Fable 5.2's reported cost is its real price", async () => {
    let cost = 0;
    const fetch = (async () => Response.json({ content: [{ type: "text", text: "ok" }], usage: { input_tokens: M, output_tokens: M } })) as unknown as typeof globalThis.fetch;
    const rt = new HaloRuntime({ env: { ANTHROPIC_API_KEY: "k" }, fetch, onEvent: (e) => void (e.type === "llm" && (cost = e.cost)) }).load(parse(`agent A [anthropic/claude-fable-5-2]\npipeline S(x: String) -> Result:\n  x |> A.a()`));
    await rt.execute("S", { x: "hi" });
    expect(cost).toBeCloseTo(48, 6);
  });
});

/** A runtime over a fake provider that answers every call with `usage`, recording what it was sent. */
function fake(model: string, usage: Record<string, unknown>, extra: Partial<RuntimeConfig> = {}, policy = "MaxSpend(1.00)") {
  const sent: string[] = [];
  const events: RuntimeEvent[] = [];
  const fetch = (async (url: string) => {
    sent.push(url);
    if (url.includes("/api/chat")) return Response.json({ message: { content: "ok" }, prompt_eval_count: 10, eval_count: 10 });
    return Response.json({ choices: [{ message: { content: "ok" } }], usage });
  }) as unknown as typeof globalThis.fetch;
  const source = `${policy ? `policy Budget : ${policy}\n` : ""}agent A [${model}]\n${policy ? "  requires Budget\n" : ""}pipeline S(x: String) -> Result:\n  x |> A.a()`;
  const rt = new HaloRuntime({ env: { OPENAI_API_KEY: "k", OPENROUTER_API_KEY: "k", TOGETHER_API_KEY: "k" }, fetch, onEvent: (e) => events.push(e), logger: { log() {}, warn() {} }, ...extra }).load(parse(source));
  const llm = () => events.filter((e): e is Extract<RuntimeEvent, { type: "llm" }> => e.type === "llm");
  return { rt, sent, events, llm };
}

describe("halo.json prices", () => {
  test("a configured price wins over the adapter's table", async () => {
    const f = fake("openai/gpt-4o", { prompt_tokens: M, completion_tokens: M }, { prices: { "openai/gpt-4o": { input: 1, output: 2 } } }, "");
    await f.rt.execute("S", { x: "a" });
    expect(f.llm()[0]!.cost).toBeCloseTo(3, 6);
    expect(f.llm()[0]!.priced).toBeUndefined();
  });

  test("a configured price lets MaxSpend run a model Halo doesn't know", async () => {
    const f = fake("openrouter/openai/o1-pro", { prompt_tokens: 1000, completion_tokens: 1000 }, { prices: { "openrouter/openai/o1-pro": { input: 150, output: 600 } } }, "MaxSpend(5.00)");
    await f.rt.execute("S", { x: "a" });
    expect(f.sent).toHaveLength(1);
    expect(f.llm()[0]!.cost).toBeCloseTo(0.75, 6);
  });

  test("MaxSpend caps the reply with the configured price", async () => {
    let maxTokens = 0;
    const fetch = (async (_u: string, init: RequestInit) => {
      maxTokens = JSON.parse(String(init.body)).max_tokens;
      return Response.json({ choices: [{ message: { content: "ok" } }], usage: { prompt_tokens: 10, completion_tokens: 10 } });
    }) as unknown as typeof globalThis.fetch;
    const rt = new HaloRuntime({ env: { OPENROUTER_API_KEY: "k" }, fetch, prices: { "openrouter/x/y": { input: 0, output: 1000 } } }).load(
      parse(`policy Budget : MaxSpend(1.00)\nagent A [openrouter/x/y]\n  requires Budget\npipeline S(x: String) -> Result:\n  x |> A.a()`),
    );
    await rt.execute("S", { x: "a" });
    // $1000 per million output tokens: $1 buys 1,000 of them.
    expect(maxTokens).toBe(1000);
  });
});

describe("provider-reported cost", () => {
  test("OpenRouter's usage.cost is the call's cost", async () => {
    const f = fake("openrouter/openai/o1-pro", { prompt_tokens: 1000, completion_tokens: 1000, cost: 0.75 }, {}, "");
    await f.rt.execute("S", { x: "a" });
    expect(f.llm()[0]!.cost).toBe(0.75);
    expect(f.llm()[0]!.priced).toBeUndefined();
  });

  test("the adapter reads usage.cost", () => {
    expect(new OpenRouterAdapter().parseResponse({ choices: [{ message: { content: "x" } }], usage: { cost: 0.0123 } }).cost).toBe(0.0123);
    expect(new OpenRouterAdapter().parseResponse({ choices: [{ message: { content: "x" } }], usage: {} }).cost).toBeUndefined();
  });
});

describe("MaxSpend fails closed without a price", () => {
  test("a call to an unpriced model is refused before it is sent", async () => {
    const f = fake("openrouter/openai/o1-pro", { prompt_tokens: 10, completion_tokens: 10 });
    const err = (await f.rt.execute("S", { x: "a" }).catch((e) => e)) as Error;
    expect(err).toBeInstanceOf(PolicyViolation);
    expect((err as PolicyViolation).rule).toBe("MaxSpend");
    expect((err as PolicyViolation).policy).toBe("Budget");
    expect(err.message).toContain(`MaxSpend can't be enforced: Halo has no price for openrouter/openai/o1-pro. Add it to "prices" in halo.json`);
    expect(err.message).toContain(`{"prices": {"openrouter/openai/o1-pro": {"input": ..., "output": ...}}}`);
    expect(f.sent).toHaveLength(0);
    const v = f.events.find((e) => e.type === "violation");
    expect(v).toMatchObject({ rule: "MaxSpend", policy: "Budget", phase: "budget" });
  });

  test("so is an OpenAI model not in the table, and a flat-guess provider", async () => {
    for (const model of ["openai/o1-pro", "together/meta-llama/Llama-3-70b"]) {
      const f = fake(model, { prompt_tokens: 10, completion_tokens: 10 });
      await expect(f.rt.execute("S", { x: "a" })).rejects.toThrow(`Halo has no price for ${model}`);
      expect(f.sent).toHaveLength(0);
    }
  });

  test("without MaxSpend an unpriced model still runs, its cost marked as an estimate", async () => {
    const f = fake("openrouter/openai/o1-pro", { prompt_tokens: 1000, completion_tokens: 1000 }, {}, "");
    await f.rt.execute("S", { x: "a" });
    expect(f.sent).toHaveLength(1);
    expect(f.llm()[0]!.priced).toBe(false);
    expect(f.llm()[0]!.cost).toBeGreaterThan(0);
  });

  test("a priced model under MaxSpend runs, and isn't marked", async () => {
    const f = fake("openai/gpt-4o", { prompt_tokens: 10, completion_tokens: 10 });
    await f.rt.execute("S", { x: "a" });
    expect(f.sent).toHaveLength(1);
    expect(f.llm()[0]!.priced).toBeUndefined();
  });

  test("Ollama (local, free) is still allowed under MaxSpend", async () => {
    expect(new OllamaAdapter().price("ollama/llama3")).toEqual({ in: 0, out: 0 });
    const f = fake("ollama/llama3", {});
    await f.rt.execute("S", { x: "a" });
    expect(f.sent).toHaveLength(1);
    expect(f.llm()[0]!.cost).toBe(0);
  });
});

describe("halo plan", () => {
  const ast = parse(`policy Budget : MaxSpend(1.00)\nagent A [openrouter/openai/o1-pro]\n  requires Budget\nagent B [anthropic/claude-sonnet-4-5]\npipeline S(x: String) -> Result:\n  x |> A.a() |> B.b()`);

  test("says there's no price for an unpriced model, and leaves the worst case unknown", () => {
    const p = plan(ast, "S", { providerInfo: () => undefined });
    const a = p.steps.find((s) => s.agent === "A")!;
    expect(a.maxCost).toBeUndefined();
    expect(a.notes.join(" ")).toContain("no price for openrouter/openai/o1-pro: MaxSpend will refuse its calls");
    expect(p.steps.find((s) => s.agent === "B")!.maxCost).toBeGreaterThan(0);
    expect(p.maxCost).toBeUndefined();
    expect(p.costNote).toBe("no price for openrouter/openai/o1-pro");
  });

  test("uses halo.json prices", () => {
    const p = plan(ast, "S", { providerInfo: () => undefined, prices: { "openrouter/openai/o1-pro": { input: 150, output: 600 } } });
    expect(p.steps.find((s) => s.agent === "A")!.maxCost).toBeGreaterThan(2);
    expect(p.maxCost).toBeGreaterThan(0);
  });
});
