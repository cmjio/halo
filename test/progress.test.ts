import { test, expect } from "bun:test";
import { Progress, progressWanted } from "../src/progress.ts";

function fakeStream(columns = 80) {
  const out: string[] = [];
  return { out, stream: { columns, isTTY: true, write: (s: string) => (out.push(s), true) } as unknown as NodeJS.WriteStream };
}

const base = { runId: "r" } as const;

test("the line shows the stage, what's happening in it, time and cost", () => {
  let now = 0;
  const { stream } = fakeStream();
  const p = new Progress({ stages: { Triage: 4, Fix: 2 }, stream, color: false, now: () => now });
  p.start();
  try {
    expect(p.line()).toBe("starting · 0.0s");
    p.event({ ...base, type: "stage", pipeline: "Triage", index: 1, kind: "call", label: "Triager.prompt", status: "start" });
    p.event({ ...base, type: "token", pipeline: "Triage", target: "Triager", text: "The bug is in " });
    now = 4100;
    expect(p.line()).toBe("Triage · 2/4 Triager.prompt · Triager writing, 4 words · 4.1s");
    p.event({ ...base, type: "llm", pipeline: "Triage", agent: "Triager", model: "m", prompt: "", output: "", latencyMs: 3900, cost: 0.0031, mocked: false });
    expect(p.line()).toBe("Triage · 2/4 Triager.prompt · Triager answered in 3.9s · 4.1s · $0.0031");
    // A pipeline the stage calls shows inside it, and drops off when its caller moves on.
    p.event({ ...base, type: "stage", pipeline: "Fix", index: 0, kind: "call", label: "Coder.prompt", status: "start" });
    expect(p.line()).toStartWith("Triage › Fix · 1/2 Coder.prompt");
    p.event({ ...base, type: "stage", pipeline: "Triage", index: 2, kind: "call", label: "Repo.comment", status: "start" });
    now = 75_000;
    expect(p.line()).toBe("Triage · 3/4 Repo.comment · 1m15s · $0.0031");
  } finally {
    p.stop();
  }
});

test("the line fits the terminal", () => {
  const { stream } = fakeStream(30);
  const p = new Progress({ stages: {}, stream, color: false, now: () => 0 });
  p.event({ ...base, type: "stage", pipeline: "AVeryLongPipelineName", index: 0, kind: "call", label: "SomeAgent.prompt", status: "start" });
  expect(p.line().length).toBeLessThanOrEqual(27);
  expect(p.line()).toEndWith("…");
});

test("other output clears the line first, and hold() keeps it away", async () => {
  const { out, stream } = fakeStream();
  const p = new Progress({ stages: {}, stream, color: false, now: () => 0 });
  const logged: unknown[] = [];
  const realLog = console.log;
  console.log = (...a: unknown[]) => logged.push(a);
  try {
    p.start();
    expect(out.at(-1)).toContain("starting");
    console.log("hello");
    expect(out.at(-1)).toBe("\r\x1b[2K");
    expect(logged).toEqual([["hello"]]);
    out.length = 0;
    await p.hold(async () => {
      await Bun.sleep(200);
    });
    expect(out.filter((s) => s.includes("starting"))).toEqual([]);
  } finally {
    p.stop();
    console.log = realLog;
  }
  console.log = realLog;
});

test("stop() puts console and the streams back", () => {
  const log = console.log, write = process.stdout.write;
  const { stream } = fakeStream();
  const p = new Progress({ stages: {}, stream, color: false }).start();
  expect(console.log).not.toBe(log);
  p.stop();
  expect(console.log).toBe(log);
  expect(process.stdout.write).toBe(write);
});

test("progress is only wanted on a terminal outside CI", () => {
  expect(progressWanted({}, { isTTY: true })).toBe(true);
  expect(progressWanted({}, { isTTY: false })).toBe(false);
  expect(progressWanted({ CI: "true" }, { isTTY: true })).toBe(false);
  expect(progressWanted({ HALO_NO_PROGRESS: "1" }, { isTTY: true })).toBe(false);
  expect(progressWanted({ TERM: "dumb" }, { isTTY: true })).toBe(false);
});
