import { test, expect, describe, afterAll } from "bun:test";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parse } from "../src/parser/index";
import { HaloRuntime, type RuntimeConfig } from "../src/runtime/runtime";
import { newReplayStats, readRecording, recordedCost, Recorder, replayMocks, type Recording } from "../src/runtime/replay";
import { checkFence } from "../src/fence";
import { compareReport, compareRuns, defaultJudgeModel, haloJudge, recordingsFor, type Judge } from "../src/compare";

const root = resolve(`${import.meta.dir}/..`);
const tmp = mkdtempSync(join(tmpdir(), "halo-compare-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const quiet = { log() {}, warn() {} };

/** A fake OpenAI API: answers each request with `answer(prompt)`, and keeps what it was asked. */
function fakeOpenAI(answer: (prompt: string) => string) {
  const prompts: string[] = [];
  const fetch = (async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    const prompt = body.messages.map((m: { content: string }) => m.content).join("\n");
    prompts.push(prompt);
    return Response.json({ choices: [{ message: { content: answer(prompt) } }], usage: { prompt_tokens: 1000, completion_tokens: 100 } });
  }) as unknown as typeof globalThis.fetch;
  return { fetch, prompts };
}

const runtime = (config: RuntimeConfig = {}) => new HaloRuntime({ env: { OPENAI_API_KEY: "k" }, logger: quiet, threadPath: ":memory:", ...config });

function workspace() {
  const dir = mkdtempSync(join(tmp, "ws-"));
  writeFileSync(join(dir, "notes.md"), "alpha beta");
  return dir;
}

const original = (dir: string) => `
policy Safe : Redact(APIKey) & MaxSpend(0.50)
tool Notes : Workspace("${dir}")
agent Reader [openai/gpt-4o, temp: 0]
  requires Safe
agent Writer [openai/gpt-4o, temp: 0.4]
  requires Safe

pipeline Brief(topic: String) -> Result:
  topic
    |> Notes.read(path: "notes.md") as notes
    |> Reader.summarize("Summarize these notes about {{topic}}: {{notes}}") as summary
    |> Writer.write("Write one line about {{topic}} from: {{summary}}")
`;

/** Runs `src` for real against the fake API, and keeps a recording. */
async function record(src: string, dir: string, topic: string, answer: (p: string) => string): Promise<Recording> {
  const runId = crypto.randomUUID();
  const recorder = new Recorder(dir, runId);
  const { fetch } = fakeOpenAI(answer);
  recorder.start("Brief", { topic });
  const r = await runtime({ fetch, recorder: recorder.record }).load(parse(src)).run("Brief", { topic }, { runId });
  recorder.finish({ status: r.status, output: r.output });
  return readRecording(dir, runId);
}

const answers = (p: string) => (p.includes("Summarize") ? "notes say alpha" : p.includes("one line") ? "A line." : "?");

describe("replay --live-changed", () => {
  test("recordings keep each model request's fingerprint and cost", async () => {
    const dir = workspace();
    const rec = await record(original(dir), mkdtempSync(join(tmp, "rec-")), "tides", answers);
    const agents = rec.calls.filter((c) => c.kind === "agent");
    expect(agents).toHaveLength(2);
    expect(agents.every((c) => typeof c.fingerprint === "string" && c.fingerprint.length === 64)).toBe(true);
    // gpt-4o: 1000 prompt tokens and 100 completion tokens, per call.
    expect(recordedCost(rec)).toBeCloseTo(2 * (0.005 + 0.0015), 6);
  });

  test("an unchanged pipeline reuses every answer; a changed stage alone goes live", async () => {
    const dir = workspace();
    const src = original(dir);
    const rec = await record(src, mkdtempSync(join(tmp, "rec-")), "tides", answers);

    const same = fakeOpenAI(() => "live!");
    const stats = newReplayStats();
    const again = await runtime({ fetch: same.fetch }).load(parse(src)).mockAll(replayMocks(rec, { liveChanged: true, tools: ["Notes"], stats })).run("Brief", { topic: "tides" });
    expect(again.output).toBe("A line.");
    expect(same.prompts).toHaveLength(0);
    expect(stats).toMatchObject({ reused: 2, live: 0, mismatches: 0 });

    // Only the Writer's prompt changes: the Reader's answer is reused, the Writer is asked for real.
    const changed = src.replace("Write one line about", "Write one short line about");
    const live = fakeOpenAI(() => "A shorter line.");
    const stats2 = newReplayStats();
    const r = await runtime({ fetch: live.fetch }).load(parse(changed)).mockAll(replayMocks(rec, { liveChanged: true, tools: ["Notes"], stats: stats2 })).run("Brief", { topic: "tides" });
    expect(r.output).toBe("A shorter line.");
    expect(live.prompts).toHaveLength(1);
    expect(live.prompts[0]).toContain("notes say alpha");
    expect(stats2).toMatchObject({ reused: 1, live: 1, mismatches: 0 });
    expect(stats2.reusedCost).toBeCloseTo(0.0065, 6);
  });

  test("a changed upstream answer makes the stages after it go live too", async () => {
    const dir = workspace();
    const src = original(dir);
    const rec = await record(src, mkdtempSync(join(tmp, "rec-")), "tides", answers);
    const changed = src.replace("Summarize these notes", "Summarize, briefly, these notes");
    const live = fakeOpenAI((p) => (p.includes("Summarize") ? "different summary" : "A new line."));
    const stats = newReplayStats();
    const r = await runtime({ fetch: live.fetch }).load(parse(changed)).mockAll(replayMocks(rec, { liveChanged: true, tools: ["Notes"], stats })).run("Brief", { topic: "tides" });
    expect(r.output).toBe("A new line.");
    expect(stats).toMatchObject({ reused: 0, live: 2 });
  });

  test("a recording without fingerprints goes live, and says so", async () => {
    const dir = workspace();
    const rec = await record(original(dir), mkdtempSync(join(tmp, "rec-")), "tides", answers);
    const old = { ...rec, calls: rec.calls.map(({ fingerprint: _, cost: __, ...c }) => c) };
    expect(recordedCost(old)).toBeUndefined();
    const live = fakeOpenAI(answers);
    const stats = newReplayStats();
    await runtime({ fetch: live.fetch }).load(parse(original(dir))).mockAll(replayMocks(old, { liveChanged: true, tools: ["Notes"], stats })).run("Brief", { topic: "tides" });
    expect(stats.unfingerprinted).toBe(2);
    expect(stats.live).toBe(2);
  });
});

describe("the fence", () => {
  const dir = "/tmp/never-read";
  const base = original(dir);
  const fence = (variant: string, options = {}) => checkFence(parse(base), parse(variant), "Brief", { providerInfo: (p) => new HaloRuntime({ logger: quiet }).toolProviderInfo(p), ...options });
  const failed = (variant: string, options = {}) => fence(variant, options).checks.filter((c) => !c.ok).map((c) => c.rule);

  test("a prompt change, or a cheaper model from the same provider, is inside", () => {
    expect(fence(base).inside).toBe(true);
    expect(fence(base.replace("Write one line", "Write a single line")).inside).toBe(true);
    const cheaper = fence(base.replace("agent Writer [openai/gpt-4o,", "agent Writer [openai/gpt-4o-mini,"));
    expect(cheaper.inside).toBe(true);
    expect(cheaper.checks.find((c) => c.rule === "models")!.detail).toContain("gpt-4o-mini");
  });

  test("a new tool, a new effect, or a new provider is outside", () => {
    expect(failed(base.replace(`tool Notes : Workspace("${dir}")`, `tool Notes : Workspace("${dir}")\ntool Out : Slack(channel: "#x")`).replace(`|> Writer.write`, `|> Out.post(text: "hi")\n    |> Writer.write`))).toContain("tools");
    expect(failed(base.replace(`Workspace("${dir}")`, `Workspace("${dir}", write: true)`))).toContain("tools");
    expect(failed(base.replace("agent Writer [openai/gpt-4o,", "agent Writer [anthropic/claude-haiku-4-5,"))).toEqual(["models"]);
    // Unless that model is allowed.
    expect(fence(base.replace("agent Writer [openai/gpt-4o,", "agent Writer [anthropic/claude-haiku-4-5,"), { allowModels: ["anthropic/*"] }).inside).toBe(true);
  });

  test("weaker policies, fewer approvals, or a changed signature are outside", () => {
    expect(failed(base.replace("agent Writer [openai/gpt-4o, temp: 0.4]\n  requires Safe", "agent Writer [openai/gpt-4o, temp: 0.4]"))).toContain("policies");
    expect(failed(base.replace("MaxSpend(0.50)", "MaxSpend(5.00)"))).toEqual(expect.arrayContaining(["policies", "spend limits"]));
    const withYield = base.replace("|> Writer.write", `|! yield(msg: "ok?")\n    |> Writer.write`);
    expect(checkFence(parse(withYield), parse(base), "Brief", { providerInfo: () => undefined }).checks.find((c) => c.rule === "approvals")!.ok).toBe(false);
    expect(failed(base.replace("Brief(topic: String)", "Brief(topic: String, tone: String)"))).toContain("signature");
  });

  test("a new agent must require the policies every original agent did", () => {
    const extra = base.replace("pipeline Brief", "agent Checker [openai/gpt-4o-mini]\n\npipeline Brief").replace(`|> Writer.write("Write one line about {{topic}} from: {{summary}}")`, `|> Writer.write("Write one line about {{topic}} from: {{summary}}")\n    |> Checker.check()`);
    expect(failed(extra)).toContain("policies");
    expect(fence(extra.replace("agent Checker [openai/gpt-4o-mini]", "agent Checker [openai/gpt-4o-mini]\n  requires Safe")).inside).toBe(true);
  });

  test("a higher worst-case cost is outside unless the ratio allows it", () => {
    const pricier = base.replace("agent Writer [openai/gpt-4o, temp: 0.4]", "agent Writer [openai/gpt-4o, temp: 0.4, max_tokens: 16000]").replace("MaxSpend(0.50)", "MaxSpend(0.50)");
    // MaxSpend caps both at $0.50, so the bound doesn't move; without a cap it would.
    expect(fence(pricier).inside).toBe(true);
    const uncapped = (s: string) => s.replace(" & MaxSpend(0.50)", "");
    const r = checkFence(parse(uncapped(base)), parse(uncapped(pricier)), "Brief", { providerInfo: () => undefined });
    expect(r.checks.find((c) => c.rule === "cost")!.ok).toBe(false);
    expect(checkFence(parse(uncapped(base)), parse(uncapped(pricier)), "Brief", { providerInfo: () => undefined, maxCostRatio: 10 }).inside).toBe(true);
  });
});

describe("compareRuns", () => {
  /** A judge that prefers whichever output contains `prefer`. */
  const prefers = (prefer: string): Judge => async ({ first, second }) => ({
    better: String(first).includes(prefer) ? "1" : String(second).includes(prefer) ? "2" : "tie",
    reason: `the one with "${prefer}"`,
    cost: 0.001,
  });

  async function setup(n: number) {
    const dir = workspace();
    const recDir = mkdtempSync(join(tmp, "rec-"));
    const recs: Recording[] = [];
    for (let i = 0; i < n; i++) recs.push(await record(original(dir), recDir, `topic ${i}`, answers));
    return { dir, recDir, recs };
  }

  test("counts same, better and worse, whichever order the judge saw", async () => {
    const { dir, recs } = await setup(6);
    const variant = parse(original(dir).replace("Write one line", "Write one vivid line"));
    const live = fakeOpenAI(() => "A vivid line.");
    const better = await compareRuns({ original: parse(original(dir)), variant, pipeline: "Brief", recordings: recs, runtime: () => runtime({ fetch: live.fetch }), judge: prefers("vivid") });
    expect(better.counts.better).toBe(6);
    expect(better.won).toBe(6);
    expect(live.prompts).toHaveLength(6);
    const worse = await compareRuns({ original: parse(original(dir)), variant, pipeline: "Brief", recordings: recs, runtime: () => runtime({ fetch: live.fetch }), judge: prefers("A line.") });
    expect(worse.lost).toBe(6);
    // Costs: the original's from the recording, the variant's as live + reused.
    expect(better.originalCostPerRun).toBeCloseTo(0.013, 6);
    expect(better.variantCostPerRun).toBeCloseTo(0.013, 6);
    expect(better.spent).toBeCloseTo(6 * 0.0065 + 6 * 0.001, 6);

    const unchanged = await compareRuns({ original: parse(original(dir)), variant: parse(original(dir)), pipeline: "Brief", recordings: recs, runtime: () => runtime({ fetch: live.fetch }), judge: prefers("vivid") });
    expect(unchanged.counts.same).toBe(6);
    expect(unchanged.spent).toBe(0);
  });

  test("a variant that needs something the recording lacks is diverged, not scored", async () => {
    const { dir, recs } = await setup(2);
    const variant = parse(original(dir).replace(`|> Writer.write`, `|> Notes.read(path: "other.md")\n    |> Writer.write`));
    const r = await compareRuns({ original: parse(original(dir)), variant, pipeline: "Brief", recordings: recs, runtime: () => runtime({ fetch: fakeOpenAI(() => "x").fetch }), judge: prefers("x") });
    expect(r.counts.diverged).toBe(2);
    expect(r.won + r.lost).toBe(0);
    // And the variant's read never ran: the folder has no other.md, and nothing failed for real.
    expect(existsSync(join(dir, "other.md"))).toBe(false);
  });

  test("a missing key stops the comparison instead of failing every run", async () => {
    const { dir, recs } = await setup(2);
    const variant = parse(original(dir).replace("Write one line", "Write one vivid line"));
    const keyless = () => new HaloRuntime({ env: {}, logger: quiet, threadPath: ":memory:" });
    await expect(compareRuns({ original: parse(original(dir)), variant, pipeline: "Brief", recordings: recs, runtime: keyless })).rejects.toThrow(/No API key set for openai.*A changed stage calls its model for real/);
    // A variant whose model calls are all reused needs no key.
    const same = await compareRuns({ original: parse(original(dir)), variant: parse(original(dir)), pipeline: "Brief", recordings: recs, runtime: keyless });
    expect(same.counts.same).toBe(2);
  });

  test("a gate that now stops real inputs is reported as now halts", async () => {
    const { dir, recs } = await setup(2);
    const variant = parse(original(dir).replace(`|> Writer.write`, `|? (context.data.summary == "never")\n    |> Writer.write`));
    const r = await compareRuns({ original: parse(original(dir)), variant, pipeline: "Brief", recordings: recs, runtime: () => runtime(), judge: prefers("x") });
    expect(r.counts["now halts"]).toBe(2);
  });

  test("stops starting runs once the budget is spent", async () => {
    const { dir, recs } = await setup(3);
    const variant = parse(original(dir).replace("Write one line", "Write one vivid line"));
    const r = await compareRuns({ original: parse(original(dir)), variant, pipeline: "Brief", recordings: recs, runtime: () => runtime({ fetch: fakeOpenAI(() => "vivid").fetch }), judge: prefers("vivid"), budget: 0.005 });
    // The first run (with its judging) spends $0.0075, so the other two never start.
    expect(r.counts.better).toBe(1);
    expect(r.counts.skipped).toBe(2);
    const report = compareReport(r, { original: "a.halo", variant: "b.halo" }, [{ rule: "tools", ok: true, detail: "same" }]);
    expect(report).toContain("Won 1 · tied 0 · lost 0");
    expect(report).toContain("unredacted");
  });

  test("the Halo judge reads its answer, and recordings are found newest first", async () => {
    const { recDir, recs } = await setup(3);
    const found = recordingsFor(recDir, "Brief", 2);
    expect(found).toHaveLength(2);
    expect(found[0]!.startedAt >= found[1]!.startedAt).toBe(true);
    expect(recordingsFor(recDir, "Other")).toHaveLength(0);
    expect(recs).toHaveLength(3);

    const judged = fakeOpenAI((p) => (p.includes("output_1: B") ? '{"better": "1", "reason": "B is clearer"}' : '{"better": "tie", "reason": "same"}'));
    const judge = haloJudge("openai/gpt-4o", () => runtime({ fetch: judged.fetch }));
    const v = await judge({ input: { topic: "x" }, criteria: "clear", first: "B", second: "A" });
    expect(v).toMatchObject({ better: "1", reason: "B is clearer" });
    expect(v.cost).toBeGreaterThan(0);
    expect(judged.prompts[0]).toContain("criteria: clear");
    expect(defaultJudgeModel(parse("agent A [openai/gpt-4o-mini]\nagent B [openai/gpt-4o]\npipeline P(x: String) -> Result:\n  x |> A.go() |> B.go()"))).toBe("openai/gpt-4o");
  });
});

describe("compareRuns: a stale tool result", () => {
  const prefers = (prefer: string): Judge => async ({ first, second }) => ({
    better: String(first).includes(prefer) ? "1" : String(second).includes(prefer) ? "2" : "tie",
    reason: `the one with "${prefer}"`,
    cost: 0.001,
  });

  // Ends by saving what it wrote, like the triage example's TriageLog.log: the output is the save's result.
  const saving = (dir: string) =>
    original(dir)
      .replace(`tool Notes : Workspace("${dir}")`, `tool Notes : Workspace("${dir}")\ntool Out : Workspace("${dir}", write: true)`)
      .replace(`|> Writer.write("Write one line about {{topic}} from: {{summary}}")`, `|> Writer.write("Write one line about {{topic}} from: {{summary}}") as line\n    |> Out.write(path: "out.md", content: context.data.line)`);

  async function setup(n: number) {
    const dir = workspace();
    const recDir = mkdtempSync(join(tmp, "rec-"));
    const recs: Recording[] = [];
    for (let i = 0; i < n; i++) recs.push(await record(saving(dir), recDir, `topic ${i}`, answers));
    return { dir, recs };
  }

  test("recordings keep each tool call's fingerprint", async () => {
    const { recs } = await setup(1);
    const tools = recs[0]!.calls.filter((c) => c.kind === "tool");
    expect(tools.map((c) => c.target)).toEqual(["Notes.read", "Out.write"]);
    expect(tools.every((c) => typeof c.fingerprint === "string" && c.fingerprint.length === 64)).toBe(true);
  });

  test("an output built on a stale result is compared on the last model answer instead", async () => {
    const { dir, recs } = await setup(3);
    const variant = parse(saving(dir).replace("Write one line", "Write one vivid line"));
    const live = fakeOpenAI(() => "A vivid line.");
    const r = await compareRuns({ original: parse(saving(dir)), variant, pipeline: "Brief", recordings: recs, runtime: () => runtime({ fetch: live.fetch }), judge: prefers("vivid") });
    // Before the fix, the replayed Out.write result made every run "same".
    expect(r.counts.better).toBe(3);
    expect(r.runs[0]!.judgedOn).toEqual({ target: "Writer.write", original: "A line.", variant: "A vivid line." });
    expect(r.runs[0]!.note).toContain("Out.write");
    expect(r.runs[0]!.variant!.stats.staleTools).toEqual(["Out.write"]);
    const report = compareReport(r, { original: "a.halo", variant: "b.halo" }, []);
    expect(report).toContain("Variant's Writer.write answer");
    expect(report).toContain("A vivid line.");
    // The replay wrote nothing: out.md still holds the last recorded run's line.
    expect(await Bun.file(join(dir, "out.md")).text()).toBe("A line.");
  });

  test("an unchanged pipeline has no stale results and stays same", async () => {
    const { dir, recs } = await setup(2);
    const r = await compareRuns({ original: parse(saving(dir)), variant: parse(saving(dir)), pipeline: "Brief", recordings: recs, runtime: () => runtime(), judge: prefers("x") });
    expect(r.counts.same).toBe(2);
    expect(r.runs.every((x) => !x.judgedOn && x.variant!.stats.staleTools.length === 0)).toBe(true);
  });

  test("a stale result that went into the last answer makes the run diverged, not scored", async () => {
    const { dir, recs } = await setup(2);
    // The read asks for another file, answered with the recorded notes.md: everything after it is built on that.
    const variant = parse(saving(dir).replace(`Notes.read(path: "notes.md")`, `Notes.read(path: "other.md")`));
    const r = await compareRuns({ original: parse(saving(dir)), variant, pipeline: "Brief", recordings: recs, runtime: () => runtime({ fetch: fakeOpenAI(() => "x").fetch }), judge: prefers("x") });
    expect(r.counts.diverged).toBe(2);
    expect(r.runs[0]!.note).toContain("Notes.read got a changed input before Writer.write answered");
  });

  test("tool results recorded before tool fingerprints are counted", async () => {
    const { dir, recs } = await setup(1);
    const old = recs.map((rec) => ({ ...rec, calls: rec.calls.map((c) => (c.kind === "tool" ? { ...c, fingerprint: undefined } : c)) }));
    const r = await compareRuns({ original: parse(saving(dir)), variant: parse(saving(dir)), pipeline: "Brief", recordings: old, runtime: () => runtime() });
    expect(r.runs[0]!.variant!.stats.uncheckedTools).toBe(2);
  });
});

describe("halo compare (CLI)", () => {
  function cliIn(cwd: string, ...args: string[]) {
    const p = Bun.spawnSync(["bun", join(root, "index.ts"), ...args], { cwd, env: { ...Bun.env, NO_COLOR: "1", OPENAI_API_KEY: "", HALO_API_KEY: "" } });
    return { code: p.exitCode, out: p.stdout.toString(), err: p.stderr.toString() };
  }

  test("refuses a variant outside the fence, and compares one inside it offline", async () => {
    const cwd = mkdtempSync(join(tmp, "cli-"));
    const dir = workspace();
    writeFileSync(join(cwd, "a.halo"), original(dir));
    writeFileSync(join(cwd, "wider.halo"), original(dir).replace(`Workspace("${dir}")`, `Workspace("${dir}", write: true)`));
    const out = cliIn(cwd, "compare", "a.halo", "wider.halo");
    expect(out.code).toBe(1);
    expect(out.err).toContain("✗ tools");
    expect(out.err).toContain("outside the fence");

    // Two recorded runs, then a variant that only changes a non-model stage: nothing goes live, so no key is needed.
    for (const topic of ["one", "two"]) await record(original(dir), join(cwd, ".halo/recordings"), topic, answers);
    writeFileSync(join(cwd, "b.halo"), original(dir).replace(`|> Writer.write("Write one line about {{topic}} from: {{summary}}")`, `|> Writer.write("Write one line about {{topic}} from: {{summary}}")\n    |> System.Value("Same line, every time.")`));
    const r = cliIn(cwd, "compare", "a.halo", "b.halo", "--no-judge", "--report", "report.md");
    expect(r.err).toContain("✓ b.halo reaches nothing a.halo couldn't");
    expect(r.err).toContain("on 2 recorded run(s) of Brief");
    expect(r.err).toContain("Won 0 · tied 2 · lost 0");
    expect(r.code).toBe(0);
    expect(await Bun.file(join(cwd, "report.md")).text()).toContain("Same line, every time.");
  }, 30_000);

  test("--from compares a file with itself at a git revision", async () => {
    const cwd = mkdtempSync(join(tmp, "git-"));
    const dir = workspace();
    const git = (...args: string[]) => {
      const p = Bun.spawnSync(["git", "-c", "user.name=t", "-c", "user.email=t@example.com", "-c", "commit.gpgsign=false", ...args], { cwd });
      if (p.exitCode !== 0) throw new Error(p.stderr.toString());
    };
    git("init", "-q");
    writeFileSync(join(cwd, "brief.halo"), original(dir));
    git("add", "brief.halo");
    git("commit", "-q", "-m", "first");
    for (const topic of ["one", "two"]) await record(original(dir), join(cwd, ".halo/recordings"), topic, answers);

    // The working copy changes a non-model stage; the committed version is the original.
    writeFileSync(join(cwd, "brief.halo"), original(dir).replace(`|> Writer.write("Write one line about {{topic}} from: {{summary}}")`, `|> Writer.write("Write one line about {{topic}} from: {{summary}}")\n    |> System.Value("Changed.")`));
    const r = cliIn(cwd, "compare", "brief.halo", "--from", "HEAD", "--no-judge");
    expect(r.err).toContain("✓ brief.halo reaches nothing brief.halo@HEAD couldn't");
    expect(r.err).toContain("Won 0 · tied 2 · lost 0");
    expect(r.code).toBe(0);

    // A wider working copy is refused, the same as two files.
    writeFileSync(join(cwd, "brief.halo"), original(dir).replace(`Workspace("${dir}")`, `Workspace("${dir}", write: true)`));
    expect(cliIn(cwd, "compare", "brief.halo", "--from", "HEAD").code).toBe(1);

    const bad = cliIn(cwd, "compare", "brief.halo", "--from", "no-such-branch");
    expect(bad.code).toBe(1);
    expect(bad.err).toContain("Can't read brief.halo at no-such-branch");
    expect(cliIn(cwd, "compare", "brief.halo", "--from", "--help").err).toContain("--from needs a git revision");
    expect(cliIn(cwd, "compare", "brief.halo", "other.halo", "--from", "HEAD").err).toContain("Usage: halo compare");
  }, 30_000);
});
