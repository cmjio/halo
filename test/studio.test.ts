// Studio's trace: how a run's flat telemetry rows become the steps on its timeline.

import { test, expect, describe } from "bun:test";
import { axisTicks, buildTrace, tickLabel, type TelemetryEvent } from "../studio/src/trace";
import { cronInWords, duration, money } from "../studio/src/format";

let nextId = 1;
const T0 = 1_000_000;
/** A telemetry row `at` ms into the run. */
const ev = (at: number, type: string, stage: string, payload?: unknown, duration_ms?: number, tokens?: number): TelemetryEvent => ({
  id: nextId++,
  run_id: "r",
  timestamp: T0 + at,
  type,
  stage,
  payload: payload === undefined ? null : JSON.stringify(payload),
  duration_ms: duration_ms ?? null,
  tokens: tokens ?? null,
});
const idle = { running: false, paused: false };
const labels = (spans: Array<{ label: string }>) => spans.map((s) => s.label);

describe("Studio trace", () => {
  test("a stage that made one call is shown as that call", () => {
    const t = buildTrace(
      [
        ev(0, "stream_start", "Go"),
        ev(10, "node_start", "0: city"),
        ev(11, "node_end", "0: city", "belfast", 1),
        ev(11, "node_start", "1: Api.features"),
        ev(149, "tool_call", "Api.features", { output: "<html>", mocked: false }, 133),
        ev(151, "node_end", "1: Api.features", "<html>", 139),
        ev(151, "node_start", "2: Helper.prompt"),
        ev(8587, "llm_call", "Helper via anthropic/claude-haiku-4-5", { system: "s", prompt: "p", output: "o", cost: 0.012 }, 8430, 12071),
        ev(8590, "node_end", "2: Helper.prompt", { links: [] }, 8439),
        ev(8593, "stream_end", "Go", { status: "completed", output: { links: [] }, cost: 0.0122 }, 8582),
      ],
      idle,
    );
    expect(t.status).toBe("completed");
    expect(t.pipeline).toBe("Go");
    expect(labels(t.spans)).toEqual(["city", "Api.features", "Helper.prompt"]);
    expect(t.spans.map((s) => s.kind)).toEqual(["stage", "tool", "model"]);
    const helper = t.spans[2]!;
    expect(helper).toMatchObject({ model: "anthropic/claude-haiku-4-5", tokens: 12071, cost: 0.012, duration: 8439, status: "done", children: [] });
    expect(helper.call?.type).toBe("llm_call");
    expect(helper.result?.type).toBe("node_end");
    expect(t).toMatchObject({ tokens: 12071, modelCalls: 1, toolCalls: 1, cost: 0.0122, hasOutput: true, active: 8593 });
  });

  test("the branches of a fan-out sit inside its stage, each with its own call", () => {
    const t = buildTrace(
      [
        ev(0, "stream_start", "Build"),
        ev(1, "node_start", "0: |* each(m in mods) => BuildModule"),
        ev(2, "node_start", "0: m"),
        ev(3, "node_end", "0: m", "a", 1),
        ev(4, "node_start", "0: m"),
        ev(5, "node_end", "0: m", "b", 1),
        ev(6, "node_start", "1: Coder.implement"),
        ev(7, "node_start", "1: Coder.implement"),
        ev(900, "llm_call", "Coder via anthropic/claude-sonnet-4-5", { prompt: "a", output: "A", cost: 0.1 }, 890, 100),
        ev(903, "node_end", "1: Coder.implement", "A", 897),
        ev(1500, "llm_call", "Coder via anthropic/claude-sonnet-4-5", { prompt: "b", output: "B", cost: 0.2 }, 1490, 200),
        ev(1503, "node_end", "1: Coder.implement", "B", 1496),
        ev(1505, "node_end", "0: |* each(m in mods) => BuildModule", ["A", "B"], 1504),
        ev(1506, "stream_end", "Build", { status: "completed", output: ["A", "B"] }, 1506),
      ],
      idle,
    );
    expect(t.spans).toHaveLength(1);
    const each = t.spans[0]!;
    expect(each.kind).toBe("stage");
    expect(labels(each.children)).toEqual(["m", "m", "Coder.implement", "Coder.implement"]);
    expect(each.children.slice(2).map((c) => [c.kind, c.tokens, c.duration])).toEqual([
      ["model", 100, 897],
      ["model", 200, 1496],
    ]);
    // No end-of-run cost was recorded, so the calls' costs are added up.
    expect(t.cost).toBeCloseTo(0.3);
    expect(t.tokens).toBe(300);
  });

  test("an agent that made several calls keeps them as separate rows under its stage", () => {
    const t = buildTrace(
      [
        ev(0, "stream_start", "P"),
        ev(1, "node_start", "0: Agent.work"),
        ev(100, "llm_call", "Agent via m/x", { prompt: "1", output: "use tool" }, 90, 10),
        ev(150, "tool_call", "Web.search", { output: "hits" }, 40),
        ev(300, "llm_call", "Agent via m/x", { prompt: "2", output: "done" }, 140, 20),
        ev(301, "node_end", "0: Agent.work", "done", 300),
        ev(302, "stream_end", "P", { status: "completed", output: "done" }, 302),
      ],
      idle,
    );
    const stage = t.spans[0]!;
    expect(stage.kind).toBe("stage");
    expect(stage.children.map((c) => c.kind)).toEqual(["model", "tool", "model"]);
    expect(t.modelCalls).toBe(2);
  });

  test("a failed run marks the step it stopped in", () => {
    const t = buildTrace(
      [ev(0, "stream_start", "Go"), ev(84, "node_start", "0: city"), ev(88, "node_end", "0: city", "belfast", 4), ev(89, "node_start", "1: Api.search"), ev(888, "error", "Go", { error: "GET failed (404)", cost: 0 })],
      idle,
    );
    expect(t.status).toBe("failed");
    expect(t.error).toBe("GET failed (404)");
    expect(t.spans.map((s) => s.status)).toEqual(["done", "error"]);
    expect(t.spans[1]!.end).toBe(T0 + 888);
  });

  test("when a run fails inside nested steps, only the innermost and its top-level step are marked", () => {
    const t = buildTrace(
      [
        ev(0, "stream_start", "Fix"),
        ev(1, "node_start", "0: |? { tests fail }"),
        ev(2, "node_start", "0: |<> loop(Fixer)"),
        ev(3, "node_start", "0: |<> loop(Fixer)"),
        ev(900, "error", "Fix", { error: "loop(Fixer) gave up after 5 tries" }),
      ],
      idle,
    );
    expect(t.spans[0]!.status).toBe("error");
    expect(t.spans[0]!.children.map((c) => c.status)).toEqual(["unfinished", "error"]);
  });

  test("time spent waiting for an answer is left off the timeline", () => {
    const hour = 3_600_000;
    const events = [
      ev(0, "stream_start", "Review"),
      ev(1, "node_start", "0: Shell.run"),
      ev(1000, "tool_call", "Shell.run", { output: "draft" }, 990),
      ev(1001, "node_end", "0: Shell.run", "draft", 1000),
      ev(1002, "node_start", "1: |! yield"),
      // The runtime reports a pause twice.
      ev(1003, "stream_end", "Review", { status: "paused" }),
      ev(1003, "stream_end", "Review", { status: "paused", waitingFor: "yield" }),
    ];
    const waiting = buildTrace(events, { running: false, paused: true }, T0 + hour);
    expect(waiting.status).toBe("waiting");
    expect(waiting.pauses).toEqual([{ start: T0 + 1003, end: null, waitingFor: "yield" }]);
    expect(waiting.spans[1]!.status).toBe("waiting");
    expect(waiting.active).toBe(1003);

    const resumed = buildTrace(
      [
        ...events,
        ev(hour, "stream_start", "Review"),
        ev(hour + 1, "node_end", "1: |! yield", { approved: true }, 0),
        ev(hour + 2, "node_start", "2: Shell.run"),
        ev(hour + 500, "tool_call", "Shell.run", { output: "published" }, 495),
        ev(hour + 501, "node_end", "2: Shell.run", "published", 499),
        ev(hour + 502, "stream_end", "Review", { status: "completed", output: "published" }, 1500),
      ],
      idle,
    );
    expect(resumed.status).toBe("completed");
    expect(resumed.pauses).toEqual([{ start: T0 + 1003, end: T0 + hour, waitingFor: "yield" }]);
    expect(labels(resumed.spans)).toEqual(["Shell.run", "|! yield", "Shell.run"]);
    // An hour passed, but only a second and a half of it was work.
    expect(resumed.active).toBe(1003 + 502);
    expect(resumed.at(T0 + hour + 2)).toBe(1005);
  });

  test("a run with no end is running if it is tracked or recent, and unfinished otherwise", () => {
    const events = [ev(0, "stream_start", "Slow"), ev(1, "node_start", "0: Shell.run")];
    const tracked = buildTrace(events, { running: true, paused: false }, T0 + 3_600_000);
    expect(tracked.status).toBe("running");
    expect(tracked.spans[0]).toMatchObject({ status: "running", end: T0 + 3_600_000, duration: null });
    // Started from the CLI a moment ago: the server isn't running it, but it is still going.
    expect(buildTrace(events, idle, T0 + 30_000).status).toBe("running");
    const stale = buildTrace(events, idle, T0 + 3_600_000);
    expect(stale.status).toBe("unfinished");
    expect(stale.spans[0]).toMatchObject({ status: "unfinished", end: T0 + 1 });
  });

  test("survives rows it can't pair up or parse", () => {
    const t = buildTrace([ev(0, "stream_start", "P"), ev(50, "node_end", "0: lost", "v", 40), { ...ev(60, "llm_call", "A via m", undefined, 5), payload: '{"output": "cut off' }, ev(70, "stream_end", "P", { status: "halted" }, 70)], idle);
    expect(t.status).toBe("halted");
    expect(t.hasOutput).toBe(false);
    expect(labels(t.spans)).toEqual(["lost", "A"]);
    expect(buildTrace([], idle, T0)).toMatchObject({ spans: [], pipeline: null, active: 0 });
  });

  test("axis ticks are round and few", () => {
    expect(axisTicks(8593)).toEqual([0, 2000, 4000, 6000, 8000]);
    expect(axisTicks(287_000)).toEqual([0, 60_000, 120_000, 180_000, 240_000]);
    expect(axisTicks(0)).toEqual([0]);
    expect([500, 2000, 2500, 60_000, 90_000, 7_200_000].map(tickLabel)).toEqual(["500ms", "2s", "2.5s", "1m", "1m 30s", "2h"]);
  });
});

describe("Studio formatting", () => {
  test("durations and money", () => {
    expect([12, 999, 8593, 42_000, 287_000, 7_500_000].map((n) => duration(n))).toEqual(["12ms", "999ms", "8.6s", "42s", "4m 47s", "2h 5m"]);
    expect([0, 0.00001, 0.0121976, 0.25, 12.5].map((n) => money(n))).toEqual(["$0", "<$0.0001", "$0.0122", "$0.25", "$12.50"]);
  });

  test("common schedules are said in words; the rest are shown as written", () => {
    expect(cronInWords("30 8 * * *")).toBe("Every day at 08:30");
    expect(cronInWords("0 9 * * 1-5")).toBe("Weekdays at 09:00");
    expect(cronInWords("0 9 * * mon-fri")).toBe("Weekdays at 09:00");
    expect(cronInWords("*/15 * * * *")).toBe("Every 15 minutes");
    expect(cronInWords("5 * * * *")).toBe("Every hour at :05");
    expect(cronInWords("0 12 * * 0")).toBe("Every Sunday at 12:00");
    expect(cronInWords("0 0 1 * *")).toBe("Day 1 of every month at 00:00");
    expect(cronInWords("30 8 1,15 jan *")).toBe("30 8 1,15 jan *");
  });
});
