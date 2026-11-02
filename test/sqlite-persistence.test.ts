import { describe, test, expect, afterEach } from "bun:test";
import { parse } from "../src/parser/index.js";
import { LanglyRuntime, SQLiteExecutionStore, SuspendedRun } from "../src/runtime/runtime.js";
import { unlinkSync, existsSync } from "fs";

const TEST_DB = "test-persistence.db";

afterEach(() => {
  // Cleanup test DB
  if (existsSync(TEST_DB)) {
    try { unlinkSync(TEST_DB); } catch {}
  }
});

describe("SQLite Execution Store", () => {

  test("saves and loads execution context", async () => {
    const store = new SQLiteExecutionStore(TEST_DB);
    const ctx = {
      input: { claim: "water damage" },
      data: { "ClaimsBot.verify": { max_payout: 5000 } },
      current: "pending",
      meta: { totalCost: 0.004, totalTokens: 150, lastLatency: 230, stageCount: 2, calls: [] },
      trace: [{ stage: "ClaimsBot.verify", timestamp: Date.now() }],
      runId: "run-123",
      stageIndex: 2,
      streamName: "ProcessClaim",
      targetSignal: "AdjusterSlack.Reaction",
    };

    await store.save("run-123", ctx);
    const loaded = await store.load("run-123");

    expect(loaded).not.toBeNull();
    expect(loaded!.input).toEqual({ claim: "water damage" });
    expect(loaded!.data["ClaimsBot.verify"]).toEqual({ max_payout: 5000 });
    expect(loaded!.meta.totalCost).toBe(0.004);
    expect(loaded!.stageIndex).toBe(2);
    expect(loaded!.targetSignal).toBe("AdjusterSlack.Reaction");
    expect(loaded!.streamName).toBe("ProcessClaim");

    store.close();
  });

  test("returns null for unknown run IDs", async () => {
    const store = new SQLiteExecutionStore(TEST_DB);
    const loaded = await store.load("nonexistent-run");
    expect(loaded).toBeNull();
    store.close();
  });

  test("overwrites context on re-save", async () => {
    const store = new SQLiteExecutionStore(TEST_DB);
    const ctx1 = {
      input: { x: 1 },
      data: {},
      current: "v1",
      meta: { totalCost: 0, totalTokens: 0, lastLatency: 0, stageCount: 0, calls: [] },
      trace: [],
      runId: "run-overwrite",
      stageIndex: 1,
      streamName: "Test",
    };

    await store.save("run-overwrite", ctx1);

    const ctx2 = { ...ctx1, current: "v2", stageIndex: 3 };
    await store.save("run-overwrite", ctx2);

    const loaded = await store.load("run-overwrite");
    expect(loaded!.current).toBe("v2");
    expect(loaded!.stageIndex).toBe(3);

    store.close();
  });

  test("runtime suspend/resume round-trips through SQLite store", async () => {
    const source = `
agent Bot [openai/gpt-4o-mini, temp: 0.5]

pipeline Approval(request: String) -> Result:
  request
    |> Bot.analyze("Analyze this request")
    ~> listen(Bot.Decision)
    |> Bot.finalize("Finalize based on decision")
`;
    const ast = parse(source);
    const store = new SQLiteExecutionStore(TEST_DB);
    const runtime = new LanglyRuntime();
    runtime.load(ast);
    runtime.setExecutionStore(store);
    runtime.mockAll({
      "Bot.analyze": "Analysis complete: looks good",
      "Bot.finalize": "Approved and finalized",
    });

    // Execute — should suspend at yield
    const result = await runtime.execute("Approval", { request: "Expense report $500" });
    expect(result).toBeInstanceOf(SuspendedRun);

    const suspendedRun = result as SuspendedRun;
    const runId = suspendedRun.runId;

    // Verify state was persisted
    const savedCtx = await store.load(runId);
    expect(savedCtx).not.toBeNull();
    expect(savedCtx!.data["Bot.analyze"]).toBe("Analysis complete: looks good");

    // Simulate: process restarts, new runtime instance
    const runtime2 = new LanglyRuntime();
    runtime2.load(ast);
    runtime2.setExecutionStore(store);
    runtime2.mockAll({
      "Bot.analyze": "Analysis complete: looks good",
      "Bot.finalize": "Approved and finalized",
    });

    // Signal the suspended run with human decision
    const finalResult = await runtime2.signal(runId, "Bot.Decision", { approved: true });
    expect(String(finalResult)).toBe("Approved and finalized");

    store.close();
  });
});
