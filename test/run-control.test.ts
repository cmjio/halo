import { test, expect, describe, afterAll } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "../src/parser/index";
import { HaloRuntime, RunStoppedError, type RuntimeConfig } from "../src/runtime/runtime";

const tmp = mkdtempSync(join(tmpdir(), "halo-run-control-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

// gpt-4o input is $0.005/1k, so every call costs $0.50.
const halfDollar = (delayMs = 0) =>
  (async (_u: string, init: RequestInit) => {
    if (delayMs) await new Promise((done, fail) => {
      const t = setTimeout(done, delayMs);
      init.signal?.addEventListener("abort", () => (clearTimeout(t), fail(init.signal!.reason)), { once: true });
    });
    return Response.json({ choices: [{ message: { content: "ok" } }], usage: { prompt_tokens: 100_000, completion_tokens: 0 } });
  }) as unknown as typeof fetch;

const TWO_CALLS = `policy Budget : MaxSpend(0.60)
agent M [openai/gpt-4o, max_tokens: 10]
  requires Budget

@checkpoint
pipeline S(x: String) -> Result:
  x |> M.a() |> M.b()`;

function runtime(src: string, config: RuntimeConfig = {}) {
  return new HaloRuntime({ env: { OPENAI_API_KEY: "k" }, fetch: halfDollar(), checkpointDir: join(tmp, crypto.randomUUID()), ...config }).load(parse(src));
}

describe("budget extensions", () => {
  test("a running run's budget can be raised before it runs out", async () => {
    const runId = crypto.randomUUID();
    let r: HaloRuntime;
    const events: string[] = [];
    r = runtime(TWO_CALLS, {
      onEvent: (e) => {
        if (e.type === "budget") events.push(`budget +${e.added} = ${e.budgetAdded}`);
        // After the first call, $0.50 of $0.60 is spent: a person adds a dollar.
        if (e.type === "llm" && !events.length) expect(r.extendBudget(runId, 1)).toBe(1);
      },
    });
    const result = await r.run("S", { x: "go" }, { runId });
    expect(result.status).toBe("completed");
    expect(result.context.meta.cost).toBeCloseTo(1.0);
    expect(result.context.meta.budgetAdded).toBe(1);
    expect(events).toEqual(["budget +1 = 1"]);
    expect(r.isRunning(runId)).toBe(false);
    expect(r.extendBudget(runId, 1)).toBeUndefined();
  });

  test("a run that stopped on its budget resumes from its checkpoint with more added", async () => {
    const r = runtime(TWO_CALLS);
    const runId = crypto.randomUUID();
    await expect(r.run("S", { x: "go" }, { runId })).rejects.toThrow("Budget exceeded");
    const checkpoint = join((r as unknown as { config: RuntimeConfig }).config.checkpointDir!, `S-${runId}.json`);

    // The spend carries over, so resuming without more budget fails again.
    await expect(r.resume(checkpoint)).rejects.toThrow("of $0.60");
    const resumed = await r.resume(checkpoint, { addBudget: 1 });
    expect(resumed.status).toBe("completed");
    expect(resumed.runId).toBe(runId);
    expect(resumed.context.meta.cost).toBeCloseTo(1.0);
    expect(resumed.context.meta.budgetAdded).toBe(1);

    // A rewind carries the spend and the extension.
    const again = await r.rewind(checkpoint, 1);
    expect(again.status).toBe("completed");
    expect(again.context.meta.budgetAdded).toBe(1);
    expect(again.context.meta.rewoundFrom).toEqual({ runId, step: 1 });
  });

  test("an extension must be a positive amount", async () => {
    const r = runtime(TWO_CALLS);
    const runId = crypto.randomUUID();
    await expect(r.run("S", { x: "go" }, { runId })).rejects.toThrow("Budget exceeded");
    const checkpoint = join((r as unknown as { config: RuntimeConfig }).config.checkpointDir!, `S-${runId}.json`);
    await expect(r.resume(checkpoint, { addBudget: -1 })).rejects.toThrow("positive amount");
    expect(r.spendLimits()).toEqual([0.6]);
  });
});

describe("stopping a run", () => {
  test("stop aborts the call in flight and fails the run; it can be resumed from its checkpoint", async () => {
    const r = runtime(TWO_CALLS.replace("MaxSpend(0.60)", "MaxSpend(5.00)"), { fetch: halfDollar(2_000) });
    const runId = crypto.randomUUID();
    const work = r.run("S", { x: "go" }, { runId });
    await Bun.sleep(30);
    expect(r.isRunning(runId)).toBe(true);
    expect(r.liveRun(runId)).toMatchObject({ budgetAdded: 0 });
    expect(r.stop(runId, "Stopped from Studio")).toBe(true);
    const err = await work.catch((e) => e);
    expect(err).toBeInstanceOf(RunStoppedError);
    expect(err.message).toBe("Stopped from Studio");
    expect(r.isRunning(runId)).toBe(false);
    expect(r.stop(runId)).toBe(false);
  });
});

describe("halo serve: stop, budget, resume, rewind", () => {
  const post = (url: string, body: unknown) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const quiet = { log() {}, warn() {}, error() {} };
  type Detail = { controls: { stoppable: boolean; resumable: boolean; rewindable: boolean; steps: number; stopped: boolean; budget: { limit: number; added: number; spent: number | null } | null } };

  async function serve(src: string, slowMs = 0) {
    const { startServer } = await import("../src/serve/server");
    const dir = mkdtempSync(join(tmp, "serve-"));
    await Bun.write(join(dir, "flow.halo"), src);
    return startServer({
      files: [join(dir, "flow.halo")],
      port: 0,
      stateDir: join(dir, ".halo"),
      scheduler: false,
      logger: quiet,
      env: { OPENAI_API_KEY: "k" },
      runtime: { fetch: halfDollar(slowMs), checkpointDir: join(dir, ".halo", "checkpoints") },
    });
  }

  test("a run that ran out of budget is resumed with more, and rewound to a step", async () => {
    const s = await serve(TWO_CALLS);
    try {
      const { runId } = (await (await post(`${s.url}/api/pipelines/S/runs`, { args: { x: "go" } })).json()) as { runId: string };
      await s.settled(runId);
      const before = (await (await fetch(`${s.url}/api/runs/${runId}`)).json()) as Detail;
      expect(before.controls).toMatchObject({ stoppable: false, resumable: true, rewindable: true, steps: 2, stopped: false, budget: { limit: 0.6, added: 0 } });

      expect(await (await post(`${s.url}/api/runs/${runId}/stop`, {})).json()).toEqual({ error: "This run isn't running on this server" });
      expect((await post(`${s.url}/api/runs/${runId}/budget`, { add: 1 })).status).toBe(409);
      expect((await post(`${s.url}/api/runs/${runId}/resume`, { addBudget: -2 })).status).toBe(400);

      const resumed = await (await post(`${s.url}/api/runs/${runId}/resume`, { addBudget: 1, wait: true })).json();
      expect(resumed).toMatchObject({ runId, status: "completed" });
      const after = (await (await fetch(`${s.url}/api/runs/${runId}`)).json()) as Detail;
      expect(after.controls).toMatchObject({ resumable: false, budget: { added: 1 } });
      expect((await post(`${s.url}/api/runs/${runId}/resume`, {})).status).toBe(409);

      const { steps } = (await (await fetch(`${s.url}/api/runs/${runId}/steps`)).json()) as { steps: Array<{ step: number; label: string }> };
      expect(steps.map((st) => st.label)).toEqual(["x", "M.a", "M.b"]);
      expect((await post(`${s.url}/api/runs/${runId}/rewind`, { step: 99 })).status).toBe(400);
      const rewound = (await (await post(`${s.url}/api/runs/${runId}/rewind`, { step: 2, wait: true })).json()) as { runId: string; status: string; rewoundFrom: unknown };
      expect(rewound).toMatchObject({ status: "completed", rewoundFrom: { runId, step: 2 } });
      expect(rewound.runId).not.toBe(runId);
    } finally {
      await s.stop();
    }
  });

  test("a running run's budget is raised, then it is stopped and can be resumed", async () => {
    const s = await serve(TWO_CALLS, 2_000);
    try {
      const { runId } = (await (await post(`${s.url}/api/pipelines/S/runs`, { args: { x: "go" } })).json()) as { runId: string };
      let detail: Detail;
      do {
        await Bun.sleep(10);
        detail = (await (await fetch(`${s.url}/api/runs/${runId}`)).json()) as Detail;
      } while (!detail.controls.stoppable);
      expect(detail.controls).toMatchObject({ resumable: false, budget: { limit: 0.6, added: 0 } });

      expect(await (await post(`${s.url}/api/runs/${runId}/budget`, { add: 2 })).json()).toMatchObject({ runId, added: 2 });
      expect((await post(`${s.url}/api/runs/${runId}/resume`, {})).status).toBe(409);

      expect(await (await post(`${s.url}/api/runs/${runId}/stop`, { reason: "Stopped from Studio" })).json()).toEqual({ runId, status: "stopped", resumable: true });
      const stopped = (await (await fetch(`${s.url}/api/runs/${runId}`)).json()) as Detail;
      // The extension was made mid-stage, before any checkpoint held it; it is kept for the resume.
      expect(stopped.controls).toMatchObject({ stoppable: false, resumable: true, stopped: true, budget: { added: 2 } });
    } finally {
      await s.stop();
    }
  });
});
