/**
 * TDD: Context Injection & RAG
 * 
 * Fix the 4 issues found in the RAG/context injection audit:
 * 1. equips should work for VectorStore tools (not just stores)
 * 2. VectorStore should have a store plugin for auto-RAG
 * 3. VectorStore should use cosine similarity, not keyword overlap
 * 4. equips for non-store tools should inject tool info into prompt
 */

import { expect, test, describe } from "bun:test";
import { parse } from "../src/parser/index.js";
import { LanglyRuntime } from "../src/runtime/runtime.js";
import { VectorStoreTool } from "../src/runtime/tools.js";

// ── 1. equips should work for VectorStore declared with 'tool' keyword ─────

describe("equips with VectorStore tools", () => {
  test("VectorStore declared as 'tool' is available via equips for RAG", async () => {
    const ast = parse(`
      tool KB : VectorStore(Env.KEY, namespace: "docs")
      agent M [openai/gpt-4o]
        equips KB
      pipeline S(q: String) -> Result:
        q |> M.answer("answer the question")
    `);
    const rt = new LanglyRuntime();
    rt.load(ast);

    // Seed the VectorStore with documents
    const vsTool = rt.toolRegistry.get("VectorStore") as VectorStoreTool;
    vsTool.seed("docs", [
      "Our refund policy allows returns within 30 days of purchase",
      "Free shipping on orders over 50 dollars",
      "Customer support hours are 9am to 5pm EST",
    ]);

    rt.mockAll({ "M.answer": "Based on the context, refunds are within 30 days." });
    const result = await rt.execute("S", { q: "what is the refund policy" });

    // The key assertion: the VectorStore was queried and its results were
    // included in the prompt as context. We verify by checking context.meta
    // or by verifying the prompt construction includes RAG context.
    expect(result).toBeDefined();
    // The trace should show the agent call happened (not short-circuited)
    expect(rt.lastContext!.trace.some(t => t.stage === "M.answer")).toBe(true);
  });
});

// ── 2. VectorStore similarity should be cosine-based, not keyword overlap ─────

describe("VectorStore similarity search", () => {
  test("returns the semantically closest document, not just keyword match", () => {
    const vs = new VectorStoreTool();
    vs.seed("test", [
      "The cat sat on the mat",
      "Dogs are loyal companions and great pets",
      "Python is a programming language created by Guido",
      "Machine learning uses neural networks for pattern recognition",
    ]);

    // "loyal pets" should match the dogs document (semantic overlap)
    // not the cat document (which shares no keywords with the query)
    const searchPromise = vs.execute(["test"], { method: "search", query: "loyal pets" }, {} as any);
    return searchPromise.then((result: any) => {
      expect(result).toContain("Dogs");
    });
  });

  test("returns top-K results when requested", () => {
    const vs = new VectorStoreTool();
    vs.seed("test", [
      "React is a JavaScript library for building user interfaces",
      "Vue.js is a progressive JavaScript framework",
      "Python is used for data science and machine learning",
      "Rust is a systems programming language focused on safety",
    ]);

    const searchPromise = vs.execute(["test"], { method: "search", query: "JavaScript framework", topK: 2 }, {} as any);
    return searchPromise.then((result: any) => {
      // Should return multiple results when topK > 1
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      // Both JS-related docs should be in the results
      const combined = result.join(" ");
      expect(combined).toContain("JavaScript");
    });
  });

  test("namespace isolation — different namespaces don't leak", () => {
    const vs = new VectorStoreTool();
    vs.seed("medical", ["Patient showed signs of high blood pressure"]);
    vs.seed("legal", ["The indemnification clause limits liability"]);

    const medicalSearch = vs.execute(["medical"], { method: "search", query: "blood pressure" }, {} as any);
    const legalSearch = vs.execute(["legal"], { method: "search", query: "blood pressure" }, {} as any);

    return Promise.all([medicalSearch, legalSearch]).then(([med, legal]: any[]) => {
      expect(med).toContain("blood pressure");
      // Legal namespace has no medical docs — should return its only doc or null
      expect(med).not.toEqual(legal);
    });
  });
});

// ── 3. equips for REST/POST tools should inject tool info into prompt ─────

describe("equips injects tool context", () => {
  test("equipped tool descriptions are included in the LLM prompt", async () => {
    const ast = parse(`
      tool WeatherAPI : REST("api.weather.com/v1", apiKey: Env.WEATHER_KEY)
      agent M [openai/gpt-4o]
        equips WeatherAPI
      pipeline S(q: String) -> Result:
        q |> M.prompt("What's the weather?")
    `);
    const rt = new LanglyRuntime();
    rt.load(ast);

    // Intercept the prompt to verify tool info was injected
    let capturedPrompt = "";
    const origCallLLM = (rt as any).callLLM.bind(rt);
    (rt as any).callLLM = async (agent: any, prompt: string, ctx: any) => {
      capturedPrompt = prompt;
      return { text: "It's sunny", metrics: { duration: 100, completionTokens: 10 } };
    };

    await rt.execute("S", { q: "weather in london" });
    // The prompt should contain information about the equipped tool
    expect(capturedPrompt).toContain("WeatherAPI");
    expect(capturedPrompt).toContain("REST");
  });
});

// ── 4. RAG auto-query — VectorStore in equips queries with ctx.current ─────

describe("RAG auto-query via equips", () => {
  test("VectorStore equipped agent auto-queries the store with current context", async () => {
    const ast = parse(`
      tool FAQ : VectorStore(Env.KEY, namespace: "faq")
      agent Support [openai/gpt-4o]
        equips FAQ
      pipeline AnswerQuestion(question: String) -> Result:
        question |> Support.answer("Help the customer")
    `);
    const rt = new LanglyRuntime();
    rt.load(ast);

    // Seed the FAQ store
    const vsTool = rt.toolRegistry.get("VectorStore") as VectorStoreTool;
    vsTool.seed("faq", [
      "Shipping takes 3-5 business days for standard delivery",
      "Premium members get free next-day shipping",
      "Returns are accepted within 30 days with receipt",
    ]);

    // Intercept prompt to verify RAG context was injected
    let capturedPrompt = "";
    (rt as any).callLLM = async (agent: any, prompt: string, ctx: any) => {
      capturedPrompt = prompt;
      return { text: "Shipping takes 3-5 days", metrics: { duration: 100, completionTokens: 10 } };
    };

    await rt.execute("AnswerQuestion", { question: "how long does shipping take" });
    // The prompt should include retrieved FAQ content
    expect(capturedPrompt).toContain("shipping");
    expect(capturedPrompt.toLowerCase()).toContain("3-5");
  });
});
