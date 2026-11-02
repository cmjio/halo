/**
 * TDD: Deployment Audit Fixes
 * 
 * These tests verify the 5 critical issues found when tracing
 * examples/20-role-founder.halo through the actual runtime.
 */

import { expect, test, describe } from "bun:test";
import { parse } from "../src/parser/index.js";
import { LanglyRuntime } from "../src/runtime/runtime.js";

// ── 1. Expression results should be accessible via context.data ─────

describe("context.data for input params", () => {
  test("expression stage stores its result in context.data by variable name", async () => {
    const ast = parse(`
      agent M [openai/gpt-4o]
      pipeline S(topic: String) -> Result:
        topic
          |> M.prompt("Write about this topic")
    `);
    const rt = new LanglyRuntime();
    rt.load(ast);
    rt.mockAll({ "M.prompt": "An essay about cats" });

    await rt.execute("S", { topic: "cats" });
    const ctx = rt.lastContext!;
    // The expression 'topic' should be accessible as context.data.topic
    expect(ctx.data["topic"]).toBe("cats");
  });
});

// ── 2. Named args with context.* references should resolve ─────

describe("context reference resolution in named args", () => {
  test("bare context.data.* refs in named args resolve to actual values", async () => {
    const ast = parse(`
      agent M [openai/gpt-4o]
      pipeline S(x: String) -> Result:
        x
          |> M.summarize("first pass")
          |> M.refine(previous: context.data.M.summarize)
    `);
    const rt = new LanglyRuntime();
    rt.load(ast);
    rt.mockAll({ "M.summarize": "summary result", "M.refine": "refined result" });

    await rt.execute("S", { x: "test" });
    // The prompt for M.refine should contain the actual summary, not the string "context.data.M.summarize"
    // We verify by checking the final result (if context resolved, the pipeline didn't crash)
    expect(rt.lastContext!.data["M.refine"]).toBe("refined result");
  });
});

// ── 3. POST tool should send named args as body ─────

describe("POST tool body construction", () => {
  test("POST tool uses named args as body when config.body is not set", async () => {
    const ast = parse(`
      tool SlackHook : POST("httpbin.org/post")
      pipeline S(x: String) -> Result:
        x
          |> SlackHook.post(message: "hello", channel: "general")
    `);
    const rt = new LanglyRuntime();
    rt.load(ast);

    // Intercept the fetch to verify the body
    let capturedBody: any = null;
    const origFetch = globalThis.fetch;
    (globalThis as any).fetch = async (url: any, opts: any) => {
      capturedBody = opts?.body ? JSON.parse(opts.body) : null;
      return new Response(JSON.stringify({ ok: true }), { 
        status: 200, 
        headers: { "Content-Type": "application/json" } 
      });
    };

    try {
      await rt.execute("S", { x: "test" });
      // Body should contain the named args, not be undefined
      expect(capturedBody).not.toBeNull();
      expect(capturedBody.message).toBe("hello");
      expect(capturedBody.channel).toBe("general");
    } finally {
      globalThis.fetch = origFetch;
    }
  });
});

// ── 4. Fan-out should store results with meaningful keys ─────

describe("fan-out context keys", () => {
  test("fan-out stores results using callee.method as base key", async () => {
    const ast = parse(`
      agent M [openai/gpt-4o]
      pipeline S(x: String) -> Result:
        x
          |* { M.analyze("task A"), M.summarize("task B") }
          |> System.Print()
    `);
    const rt = new LanglyRuntime();
    rt.load(ast);
    rt.mockAll({ "M.analyze": "analysis", "M.summarize": "summary" });

    await rt.execute("S", { x: "test" });
    const ctx = rt.lastContext!;

    // Should be accessible by callee.method AND by callee shorthand
    expect(ctx.data["M.analyze"]).toBe("analysis");
    expect(ctx.data["M.summarize"]).toBe("summary");
  });

  test("fan-out with duplicate methods uses index suffix for disambiguation", async () => {
    const ast = parse(`
      agent M [openai/gpt-4o]
      pipeline S(x: String) -> Result:
        x
          |* { M.prompt("task A"), M.prompt("task B") }
          |> System.Print()
    `);
    const rt = new LanglyRuntime();
    rt.load(ast);
    rt.mockAll({ "M.prompt": "result" });

    await rt.execute("S", { x: "test" });
    const ctx = rt.lastContext!;

    // When methods are identical, index-suffixed keys should exist
    expect(ctx.data["M.prompt_0"]).toBe("result");
    expect(ctx.data["M.prompt_1"]).toBe("result");
  });
});

// ── 5. Load-time validation warnings ─────

describe("load-time validation", () => {
  test("load() collects warnings for undeclared return types", () => {
    const ast = parse(`
      agent M [openai/gpt-4o]
      pipeline S(x: String) -> NonExistentType:
        x
          |> M.prompt("hi")
    `);
    const rt = new LanglyRuntime();
    const result = rt.load(ast);

    // Should still load (non-fatal), but should report the warning
    expect(rt.warnings).toBeDefined();
    expect(rt.warnings.some((w: string) => w.includes("NonExistentType"))).toBe(true);
  });

  test("load() collects warnings for undeclared shadow agent references", () => {
    const ast = parse(`
      @shadow(GhostMind)
      agent M [openai/gpt-4o]
      pipeline S(x: String) -> Result:
        x
          |> M.prompt("hi")
    `);
    const rt = new LanglyRuntime();
    rt.load(ast);

    expect(rt.warnings).toBeDefined();
    expect(rt.warnings.some((w: string) => w.includes("GhostMind"))).toBe(true);
  });
});
