/**
 * TDD: Streaming Support
 * 
 * RED phase — these tests define the streaming contract.
 * The same .halo file runs in both batch (execute) and streaming (pipeline) mode.
 */

import { expect, test, describe } from "bun:test";
import { parse } from "../src/parser/index.js";
import { LanglyRuntime } from "../src/runtime/runtime.js";
import type { StreamEvent } from "../src/runtime/runtime.js";

describe("Streaming", () => {

  // ── Core Contract ─────

  test("pipeline() returns an async generator", async () => {
    const ast = parse(`
      agent M [openai/gpt-4o]
      pipeline S(x: String) -> Result:
        x
          |> M.prompt("hi")
          |> System.Print()
    `);
    const rt = new LanglyRuntime();
    rt.load(ast);
    rt.mockAll({ "M.prompt": "hello world" });

    const gen = rt.pipeline("S", { x: "test" });
    expect(gen[Symbol.asyncIterator]).toBeDefined();
  });

  test("pipeline() emits token events from mocked LLM calls", async () => {
    const ast = parse(`
      agent M [openai/gpt-4o]
      pipeline S(x: String) -> Result:
        x
          |> M.prompt("hi")
    `);
    const rt = new LanglyRuntime();
    rt.load(ast);
    rt.mockAll({ "M.prompt": "hello world" });

    const events: StreamEvent[] = [];
    for await (const event of rt.pipeline("S", { x: "test" })) {
      events.push(event);
    }

    // Must have at least one token event and a done event
    const tokenEvents = events.filter(e => e.type === "token");
    const doneEvents = events.filter(e => e.type === "done");
    expect(tokenEvents.length).toBeGreaterThan(0);
    expect(doneEvents.length).toBe(1);
  });

  test("token events carry text and stage name", async () => {
    const ast = parse(`
      agent M [openai/gpt-4o]
      pipeline S(x: String) -> Result:
        x
          |> M.prompt("hi")
    `);
    const rt = new LanglyRuntime();
    rt.load(ast);
    rt.mockAll({ "M.prompt": "hello" });

    const tokens: StreamEvent[] = [];
    for await (const event of rt.pipeline("S", { x: "test" })) {
      if (event.type === "token") tokens.push(event);
    }

    expect(tokens.length).toBeGreaterThan(0);
    const first = tokens[0]!;
    expect(first.type).toBe("token");
    if (first.type === "token") {
      expect(typeof first.text).toBe("string");
      expect(typeof first.stage).toBe("string");
      expect(first.stage).toContain("M.prompt");
    }
  });

  test("concatenated tokens equal the full response", async () => {
    const ast = parse(`
      agent M [openai/gpt-4o]
      pipeline S(x: String) -> Result:
        x
          |> M.prompt("hi")
    `);
    const rt = new LanglyRuntime();
    rt.load(ast);
    rt.mockAll({ "M.prompt": "hello world" });

    let assembled = "";
    for await (const event of rt.pipeline("S", { x: "test" })) {
      if (event.type === "token") assembled += event.text;
    }

    expect(assembled).toBe("hello world");
  });

  // ── Stage Lifecycle Events ─────

  test("emits stage_start and stage_complete for each pipeline stage", async () => {
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

    const events: StreamEvent[] = [];
    for await (const event of rt.pipeline("S", { x: "test" })) {
      events.push(event);
    }

    const starts = events.filter(e => e.type === "stage_start");
    const completes = events.filter(e => e.type === "stage_complete");

    // expression + 2 calls = at least 3 stages
    expect(starts.length).toBeGreaterThanOrEqual(3);
    expect(completes.length).toBeGreaterThanOrEqual(3);
  });

  // ── Done event carries final result ─────

  test("done event carries the final result", async () => {
    const ast = parse(`
      agent M [openai/gpt-4o]
      pipeline S(x: String) -> Result:
        x
          |> M.prompt("hi")
    `);
    const rt = new LanglyRuntime();
    rt.load(ast);
    rt.mockAll({ "M.prompt": "final answer" });

    let doneEvent: StreamEvent | null = null;
    for await (const event of rt.pipeline("S", { x: "test" })) {
      if (event.type === "done") doneEvent = event;
    }

    expect(doneEvent).not.toBeNull();
    expect(doneEvent!.result).toBe("final answer");
  });

  // ── Equivalence: pipeline() and execute() produce the same result ─────

  test("pipeline() and execute() produce identical final results", async () => {
    const ast = parse(`
      agent M [openai/gpt-4o]
      pipeline S(x: String) -> Result:
        x
          |> M.prompt("Process: {{x}}")
          |> System.Print()
    `);

    // Run with execute()
    const rt1 = new LanglyRuntime();
    rt1.load(ast);
    rt1.mockAll({ "M.prompt": "batch result" });
    const batchResult = await rt1.execute("S", { x: "test" });

    // Run with pipeline()
    const rt2 = new LanglyRuntime();
    rt2.load(ast);
    rt2.mockAll({ "M.prompt": "batch result" });
    let streamResult: unknown;
    for await (const event of rt2.pipeline("S", { x: "test" })) {
      if (event.type === "done") streamResult = event.result;
    }

    expect(streamResult).toEqual(batchResult);
  });

  // ── Error propagation ─────

  test("pipeline() propagates errors from the pipeline", async () => {
    const ast = parse(`
      agent M [openai/gpt-4o]
      pipeline S(x: String) -> Result:
        x
          |> NonExistent.prompt("hi")
    `);
    const rt = new LanglyRuntime();
    rt.load(ast);

    const events: StreamEvent[] = [];
    for await (const event of rt.pipeline("S", { x: "test" })) {
      events.push(event);
    }

    const errorEvents = events.filter(e => e.type === "error");
    expect(errorEvents.length).toBe(1);
    expect(errorEvents[0]!.error).toBeDefined();
  });

  // ── Fan-out streaming ─────

  test("fan-out stages emit tokens from parallel calls", async () => {
    const ast = parse(`
      agent M [openai/gpt-4o]
      pipeline S(x: String) -> Result:
        x
          |* { M.prompt("task A"), M.prompt("task B") }
    `);
    const rt = new LanglyRuntime();
    rt.load(ast);
    rt.mockAll({ "M.prompt": "parallel result" });

    const events: StreamEvent[] = [];
    for await (const event of rt.pipeline("S", { x: "test" })) {
      events.push(event);
    }

    const tokens = events.filter(e => e.type === "token");
    const done = events.filter(e => e.type === "done");
    expect(tokens.length).toBeGreaterThan(0);
    expect(done.length).toBe(1);
  });
});
