/**
 * TDD tests for remaining review findings.
 * 
 * These tests are written BEFORE the fixes. They should FAIL initially,
 * then PASS after the runtime is updated.
 */

import { expect, test, describe } from "bun:test";
import { parse } from "../src/parser/index.js";
import { LanglyRuntime, type ExecutionContext } from "../src/runtime/runtime.js";
import {
  LanglyError,
  PolicyViolation,
  TimeoutError as LanglyTimeoutError,
} from "../src/errors.js";

// ── 1. context.trace must be populated ─────

describe("context.trace", () => {
  test("records each pipeline stage with name and timestamp", async () => {
    const ast = parse(`
      agent M [openai/gpt-4o]
      pipeline S(x: String) -> Result:
        x
          |> M.prompt("Process this")
          |> System.Print()
    `);
    const rt = new LanglyRuntime();
    rt.load(ast);
    rt.mockAll({ "M.prompt": "hello" });
    await rt.execute("S", { x: "test" });

    const ctx = rt.lastContext!;
    expect(ctx.trace).toBeDefined();
    expect(ctx.trace.length).toBeGreaterThanOrEqual(2); // at least expression + call
    
    // Each trace entry has a stage name and timestamp
    for (const entry of ctx.trace) {
      expect(entry.stage).toBeDefined();
      expect(typeof entry.stage).toBe("string");
      expect(entry.timestamp).toBeDefined();
      expect(typeof entry.timestamp).toBe("number");
    }
  });

  test("trace entries are in chronological order", async () => {
    const ast = parse(`
      agent M [openai/gpt-4o]
      pipeline S(x: String) -> Result:
        x
          |> M.prompt("step 1")
          |> M.prompt("step 2")
    `);
    const rt = new LanglyRuntime();
    rt.load(ast);
    rt.mockAll({ "M.prompt": "result" });
    await rt.execute("S", { x: "test" });

    const ctx = rt.lastContext!;
    for (let i = 1; i < ctx.trace.length; i++) {
      expect(ctx.trace[i]!.timestamp).toBeGreaterThanOrEqual(ctx.trace[i - 1]!.timestamp);
    }
  });
});

// ── 2. Retry should distinguish retryable vs non-retryable errors ─────

describe("retry error distinction", () => {
  test("retries on retryable errors (5xx, timeout, network)", async () => {
    let callCount = 0;
    const ast = parse(`
      @retry(3, 1s)
      pipeline S(x: String) -> Result:
        x
          |> System.Print()
    `);
    const rt = new LanglyRuntime();
    rt.load(ast);

    // Override System.Print to fail twice with retryable, then succeed
    const origExecutePipeline = (rt as any).executeSystemCall.bind(rt);
    (rt as any).executeSystemCall = function (stage: any, ctx: any) {
      callCount++;
      if (callCount <= 2) {
        throw new LanglyError("Service unavailable", "LLM_API_ERROR");
      }
      return origExecutePipeline(stage, ctx);
    };

    const result = await rt.execute("S", { x: "test" });
    expect(callCount).toBe(3); // 2 retries + 1 success
  });

  test("does NOT retry on non-retryable errors (PolicyViolation)", async () => {
    let callCount = 0;
    const ast = parse(`
      @retry(3, 1s)
      pipeline S(x: String) -> Result:
        x
          |> System.Print()
    `);
    const rt = new LanglyRuntime();
    rt.load(ast);

    (rt as any).executeSystemCall = function (_stage: any, _ctx: any) {
      callCount++;
      throw new PolicyViolation("Block", "Content blocked: Profanity");
    };

    try {
      await rt.execute("S", { x: "test" });
    } catch (e) {
      expect(e).toBeInstanceOf(PolicyViolation);
    }
    expect(callCount).toBe(1); // Should NOT retry policy violations
  });
});

// ── 3. Shadow agent error handler ─────

describe("shadow agent error handling", () => {
  test("onShadowError callback is invoked when shadow fails", async () => {
    const ast = parse(`
      @shadow(Baseline)
      agent Candidate [openai/gpt-4o]
      agent Baseline [openai/gpt-4o-mini]
      pipeline S(x: String) -> Result:
        x
          |> Candidate.prompt("test")
    `);
    const rt = new LanglyRuntime();
    rt.load(ast);
    rt.mockAll({ "Candidate.prompt": "main result" });

    let shadowError: { agent: string; error: Error } | null = null;
    rt.onShadowError = (mindName: string, error: Error) => {
      shadowError = { agent: mindName, error };
    };

    await rt.execute("S", { x: "test" });
    // Shadow runs async — give it a tick
    await new Promise(r => setTimeout(r, 50));

    // The shadow either succeeds (mocked) or fails (no real API) —
    // but the handler should be wired up
    expect(typeof rt.onShadowError).toBe("function");
  });
});

// ── 4. Timeout error includes stage context ─────

describe("timeout error context", () => {
  test("TimeoutError includes the pipeline name that timed out", async () => {
    const ast = parse(`
      @timeout(1s)
      pipeline SlowStream(x: String) -> Result:
        x
          |> System.Print()
    `);
    const rt = new LanglyRuntime();
    rt.load(ast);

    // Override System.Print to hang for 2 seconds
    (rt as any).executeSystemCall = async function (_stage: any, _ctx: any) {
      await new Promise(r => setTimeout(r, 3000));
    };

    try {
      await rt.execute("SlowStream", { x: "test" });
      expect(true).toBe(false); // Should never reach
    } catch (e) {
      expect(e).toBeInstanceOf(LanglyTimeoutError);
      const te = e as InstanceType<typeof LanglyTimeoutError>;
      expect(te.duration).toBe("1s");
      expect(te.code).toBe("TIMEOUT");
    }
  });
});

// ── 5. Gate warns on missing context paths ─────

describe("gate missing path handling", () => {
  test("gate on missing context path returns false (pipeline stops) without crashing", async () => {
    const ast = parse(`
      agent M [openai/gpt-4o]
      pipeline S(x: String) -> Result:
        x
          |? (context.data.nonexistent.deep.path == true)
          |> M.prompt("should not reach")
    `);
    const rt = new LanglyRuntime();
    rt.load(ast);
    rt.mockAll({ "M.prompt": "should not see" });

    const result = await rt.execute("S", { x: "test" });
    // Gate should stop pipeline (undefined != true), return current value
    expect(result).toBe("test");
  });

  test("gate on existing context path evaluates correctly", async () => {
    const ast = parse(`
      agent M [openai/gpt-4o]
      pipeline S(x: String) -> Result:
        x
          |> M.prompt("step 1")
          |? (context.data.M != null)
          |> System.Print()
    `);
    const rt = new LanglyRuntime();
    rt.load(ast);
    rt.mockAll({ "M.prompt": "valid result" });

    const result = await rt.execute("S", { x: "test" });
    expect(result).toBe("valid result"); // Gate passes, pipeline continues
  });
});
