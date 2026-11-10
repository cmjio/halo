import { test, expect, describe, afterAll } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parse } from "../src/parser/index";
import { HaloRuntime, type RuntimeConfig } from "../src/runtime/runtime";
import { readRecording, Recorder, type Recording } from "../src/runtime/replay";
import { compareRuns, recordingsFor, type Judge } from "../src/compare";
import { startServer } from "../src/serve/server";
import { checkExpectations, expectationsOf } from "../src/expect";
import { evolve, haloProposer, parseProposal, redactionsOf, scoreOf, splitRuns, writeEvolveDir, type EvolveRecord, type Proposer } from "../src/evolve";
import { diffStat, unifiedDiff } from "../src/diff";
import { AGENT_PRESETS } from "../src/runtime/presets";
import { validate } from "../src/parser/validate";

const root = resolve(`${import.meta.dir}/..`);
const tmp = mkdtempSync(join(tmpdir(), "halo-evolve-"));
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

const original = (dir: string, model = "openai/gpt-4o") => `// A one-line brief from notes.
policy Safe : Redact(Email) & MaxSpend(0.50)
tool Notes : Workspace("${dir}")
agent Reader [${model}, temp: 0]
  requires Safe
agent Writer [${model}, temp: 0.4]
  requires Safe

pipeline Brief(topic: String) -> Result:
  topic
    |> Notes.read(path: "notes.md") as notes
    |> Reader.summarize("Summarize these notes about {{topic}}: {{notes}}") as summary
    |> Writer.write("Write one line about {{topic}} from: {{summary}}")
`;

const answers = (p: string) => (p.includes("Summarize") ? "notes say alpha" : p.includes("vivid") ? "A vivid line." : p.includes("one line") ? "A line." : "?");

async function record(src: string, dir: string, topic: string): Promise<Recording> {
  const runId = crypto.randomUUID();
  const recorder = new Recorder(dir, runId);
  recorder.start("Brief", { topic });
  const r = await runtime({ fetch: fakeOpenAI(answers).fetch, recorder: recorder.record }).load(parse(src)).run("Brief", { topic }, { runId });
  recorder.finish({ status: r.status, output: r.output });
  return readRecording(dir, runId);
}

async function recordings(src: string, n: number, recDir = mkdtempSync(join(tmp, "rec-"))) {
  const recs: Recording[] = [];
  // Every topic carries an email address, which the file's Redact(Email) policy must hide from the proposer.
  for (let i = 0; i < n; i++) recs.push(await record(src, recDir, `topic ${i} for ana${i}@example.com`));
  return recs;
}

/** A judge that prefers whichever output contains `prefer`. */
const prefers = (prefer: string): Judge => async ({ first, second }) => ({
  better: String(first).includes(prefer) ? "1" : String(second).includes(prefer) ? "2" : "tie",
  reason: `the one with "${prefer}"`,
  cost: 0.001,
});

/** A proposer that answers from a script, in order, and keeps every brief it got. */
function scripted(answers: string[]): Proposer & { briefs: string[] } {
  const briefs: string[] = [];
  const fn = (async (brief: string) => {
    briefs.push(brief);
    const text = answers[briefs.length - 1] ?? "Rationale: nothing more\n```halo\n\n```";
    return { text, cost: 0.01 };
  }) as Proposer & { briefs: string[] };
  fn.briefs = briefs;
  return fn;
}

const answer = (rationale: string, src: string) => `Rationale: ${rationale}\n\`\`\`halo\n${src}\n\`\`\``;
const providerInfo = (p: string) => new HaloRuntime({ logger: quiet }).toolProviderInfo(p);

describe("unifiedDiff", () => {
  test("shows changed lines with context, and nothing for equal texts", () => {
    const a = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"].join("\n");
    const b = a.replace("two", "TWO").replace("nine", "nine\nnine and a half");
    const d = unifiedDiff(a, b, { a: "a/x", b: "b/x" }, 1);
    expect(d).toBe(["--- a/x", "+++ b/x", "@@ -1,3 +1,3 @@", " one", "-two", "+TWO", " three", "@@ -9,2 +9,3 @@", " nine", "+nine and a half", " ten", "\\ No newline at end of file", ""].join("\n"));
    expect(unifiedDiff(a, a, { a: "a", b: "b" })).toBe("");
    expect(diffStat(a, b)).toEqual({ added: 2, removed: 1 });
  });

  test("agrees with diff -u on what changed", () => {
    const a = original("/tmp/x");
    const b = a.replace("Write one line", "Write one vivid line").replace("temp: 0]", "temp: 0.1]");
    const ours = unifiedDiff(a, b, { a: "a", b: "b" }).split("\n").filter((l) => /^[-+][^-+]/.test(l)).sort();
    const pa = join(tmp, "da.txt");
    const pb = join(tmp, "db.txt");
    writeFileSync(pa, a);
    writeFileSync(pb, b);
    const theirs = Bun.spawnSync(["diff", "-u", pa, pb]).stdout.toString().split("\n").filter((l) => /^[-+][^-+]/.test(l)).sort();
    expect(ours).toEqual(theirs);
  });

  test("is a patch git apply accepts, with or without a final newline", () => {
    const cwd = mkdtempSync(join(tmp, "patch-"));
    Bun.spawnSync(["git", "init", "-q"], { cwd });
    const a = readFileSync(join(root, "examples/engineering/github-triage.halo"), "utf8");
    const edits: Array<(l: string[]) => void> = [(l) => l.push("// end"), (l) => l.splice(l.length - 1, 0, "// end"), (l) => l.splice(0, 1), (l) => l.splice(10, 2, "// one", "// two", "// three")];
    for (const edit of edits) {
      const lines = a.split("\n");
      edit(lines);
      const b = lines.join("\n");
      writeFileSync(join(cwd, "f.halo"), a);
      writeFileSync(join(cwd, "p.diff"), unifiedDiff(a, b, { a: "a/f.halo", b: "b/f.halo" }));
      const p = Bun.spawnSync(["git", "apply", "p.diff"], { cwd });
      expect(p.stderr.toString()).toBe("");
      expect(readFileSync(join(cwd, "f.halo"), "utf8")).toBe(b);
    }
  });
});

describe("evolve: pieces", () => {
  test("the split is seeded, disjoint and keeps at least one run on each side", () => {
    const runs = Array.from({ length: 12 }, (_, i) => i);
    const a = splitRuns(runs, 0.33, 7);
    expect(a.holdout).toHaveLength(4);
    expect([...a.holdout, ...a.proposal].sort((x, y) => x - y)).toEqual(runs);
    expect(splitRuns(runs, 0.33, 7)).toEqual(a);
    expect(splitRuns(runs, 0.33, 8).holdout).not.toEqual(a.holdout);
    expect(splitRuns([1, 2], 0.5, 1).holdout).toHaveLength(0);
    expect(splitRuns([1, 2, 3], 0.01, 1).holdout).toHaveLength(1);
    expect(splitRuns([1, 2, 3], 0.99, 1).proposal).toHaveLength(1);
  });

  test("reads the rationale and the file from a proposer's answer", () => {
    expect(parseProposal("Some thinking.\nRationale: tighter prompt\n```halo\nagent A [x/y]\n```\n")).toEqual({ rationale: "tighter prompt", source: "agent A [x/y]" });
    expect(parseProposal("```\npipeline P() -> R:\n  x\n```").source).toBe("pipeline P() -> R:\n  x");
    expect(parseProposal("I can't.").source).toBeUndefined();
  });

  test("the Evolver preset exists and its proposer program is valid Halo", () => {
    expect(AGENT_PRESETS.Evolver!.system).toContain("```halo");
    expect(validate(parse(`agent E [openai/gpt-4o, preset: Evolver]\npipeline P(b: String) -> Result:\n  b |> E.propose()\n`)).filter((d) => d.severity === "error")).toEqual([]);
    expect(redactionsOf(parse(original("/tmp/x")))).toEqual(["Email"]);
  });

  test("haloProposer sends the brief through an Evolver agent and returns its answer and cost", async () => {
    const live = fakeOpenAI(() => answer("x", "agent A [openai/gpt-4o]"));
    const propose = haloProposer("openai/gpt-4o", () => runtime({ fetch: live.fetch }));
    const r = await propose("Improve {{this}} file");
    expect(r.text).toContain("Rationale: x");
    expect(r.cost).toBeGreaterThan(0);
    // The system prompt is the preset's; the brief arrives as data, its {{...}} untouched.
    expect(live.prompts[0]).toContain("You improve Halo programs");
    expect(live.prompts[0]).toContain("Improve {{this}} file");
  });
});

describe("evolve", () => {
  test("throws away what's invalid, outside or repeated, replays the rest, and checks the best on held-out runs", async () => {
    const dir = workspace();
    const src = original(dir);
    const recs = await recordings(src, 9);
    const vivid = src.replace("Write one line", "Write one vivid line");
    const proposer = scripted([
      // Round 1
      answer("let the writer save its line", src.replace(`Workspace("${dir}")`, `Workspace("${dir}", write: true)`)),
      answer("vivid lines read better", vivid),
      answer("vivid lines read better", vivid.replace("    |> Writer.write", "    |> Nobody.write")),
      answer("same thing", src),
      // Round 2, from the winner of round 1
      answer("the cheaper model writes as well", vivid.replace("agent Writer [openai/gpt-4o,", "agent Writer [openai/gpt-4o-mini,")),
      "I won't answer in the right shape.",
      "still no file",
    ]);
    const live = fakeOpenAI(answers);
    const events: string[] = [];
    const r = await evolve({
      source: src,
      pipeline: "Brief",
      recordings: recs,
      runtime: () => runtime({ fetch: live.fetch }),
      propose: proposer,
      judge: prefers("vivid"),
      variants: 3,
      rounds: 2,
      budget: 5,
      seed: 3,
      fence: { providerInfo },
      onEvent: (e) => events.push(e.type === "variant" ? `${e.variant.id}:${e.variant.status}` : e.type === "round" ? `round ${e.round} from ${e.parent}` : e.type),
    });

    expect(r.split.holdout).toHaveLength(3);
    expect(r.split.proposal).toHaveLength(6);
    const byId = Object.fromEntries(r.variants.map((v) => [v.id, v]));
    // v1 widens a tool: outside, never replayed.
    expect(byId.v1!.status).toBe("outside");
    expect(byId.v1!.problems.join()).toContain("tools");
    // v2 wins every proposal run.
    expect(byId.v2!.status).toBe("scored");
    expect(byId.v2!.score).toMatchObject({ won: 6, lost: 0, winRate: 1 });
    // v3 called an undefined agent; its repair (the original file) validates, but changes nothing.
    expect(byId.v3!.status).toBe("duplicate");
    expect(proposer.briefs[3]).toContain("Your last answer was rejected");
    expect(proposer.briefs[3]).toMatch(/Nobody/);
    // Round 2 proposes from v2 and its children are named after it.
    expect(events).toContain("round 2 from v2");
    expect(byId["v2.1"]!.status).toBe("scored");
    expect(byId["v2.1"]!.score!.costPerRun!).toBeLessThan(byId.v2!.score!.costPerRun!);
    expect(byId["v2.2"]!.status).toBe("invalid");
    expect(byId["v2.2"]!.problems).toEqual(["the answer had no ```halo block"]);

    // v2.1 is cheaper at the same win rate, so it dominates v2 on the Pareto front.
    expect(r.finalists).toEqual(["v2.1"]);
    expect(byId["v2.1"]!.holdoutScore).toMatchObject({ won: 3, lost: 0 });
    expect(r.winner).toBe("v2.1");
    expect(r.verdict).toContain("beat the original on 3 held-out run(s)");

    // The proposer saw the fence verdict for v1 and the scores of v2, and never the raw email address.
    const round2 = proposer.briefs.find((b) => b.includes("Propose rewrite 1 of 3") && b.includes("variant v2"))!;
    expect(round2).toContain("outside the fence, thrown away: tools");
    expect(round2).toContain("won 6 · tied 0 · lost 0");
    for (const b of proposer.briefs) expect(b).not.toContain("@example.com");
    expect(proposer.briefs.some((b) => b.includes("[REDACTED:"))).toBe(true);
    // Spend: 9 proposals + live writer calls + judging, all counted.
    expect(r.spent).toBeGreaterThan(0.07);
  });

  test("no winner when nothing beats the original, and the budget stops it early", async () => {
    const dir = workspace();
    const src = original(dir);
    const recs = await recordings(src, 6);
    const worse = src.replace("Write one line", "Write one dull line");
    const r = await evolve({ source: src, pipeline: "Brief", recordings: recs, runtime: () => runtime({ fetch: fakeOpenAI(() => "A dull line.").fetch }), propose: scripted([answer("dull", worse)]), judge: prefers("A line."), variants: 1, rounds: 1, budget: 5, fence: { providerInfo } });
    expect(r.variants[0]!.score!.lost).toBeGreaterThan(0);
    expect(r.winner).toBeUndefined();
    expect(r.verdict).toContain("No variant was at least as good");

    const broke = await evolve({ source: src, pipeline: "Brief", recordings: recs, runtime: () => runtime({ fetch: fakeOpenAI(answers).fetch }), propose: scripted([answer("vivid", src.replace("one line", "one vivid line")), answer("again", src.replace("one line", "one vivid, short line"))]), judge: prefers("vivid"), variants: 3, rounds: 3, budget: 0.015, fence: { providerInfo } });
    expect(broke.stoppedForBudget).toBe(true);
    expect(broke.variants.length).toBeLessThan(3);
  });

  test("a variant that now halts loses those runs", () => {
    const counts = { same: 1, better: 1, worse: 0, tie: 0, "now halts": 2, "no longer halts": 0, "both halt": 0, "now pauses": 0, "now fails": 0, diverged: 0, skipped: 0 };
    const s = scoreOf({ pipeline: "P", runs: Array(4).fill({}), counts, won: 1, tied: 1, lost: 0, spent: 0 });
    expect(s).toMatchObject({ won: 1, tied: 1, lost: 2, scored: 4, winRate: 0.375 });
  });
});

describe("@expect", () => {
  const withExpect = (dir: string, ...conds: string[]) => original(dir).replace("pipeline Brief", `@expect(${conds.map((c) => JSON.stringify(c)).join(", ")})\npipeline Brief`);

  test("keeps each condition, commas and all, and validate checks them", () => {
    const ast = parse(withExpect("/tmp/x", "output != null", "topic != \"a, b\""));
    expect(expectationsOf(ast, "Brief").map((e) => e.text)).toEqual(["output != null", 'topic != "a, b"']);
    const errors = (src: string) => validate(parse(src)).filter((d) => d.severity === "error").map((d) => d.message);
    expect(errors(withExpect("/tmp/x", "output.length <= 80"))).toEqual([]);
    expect(errors(withExpect("/tmp/x", "output >=")).join()).toContain(`@expect condition "output >=" is not valid`);
    expect(errors(original("/tmp/x").replace("pipeline Brief", "@expect\npipeline Brief")).join()).toContain("@expect needs at least one condition");
  });

  test("checks the output and the inputs", () => {
    const exps = expectationsOf(parse(withExpect("/tmp/x", "output.labels.length <= 2", "output.summary != null", "input.topic == topic")), "Brief");
    expect(checkExpectations(exps, { labels: ["a"], summary: "s" }, { topic: "t" }).map((r) => r.ok)).toEqual([true, true, true]);
    expect(checkExpectations(exps, { labels: ["a", "b", "c"] }, { topic: "t" }).map((r) => r.ok)).toEqual([false, false, true]);
  });

  test("compare holds a variant to the original's expectations, without the judge", async () => {
    const dir = workspace();
    const src = withExpect(dir, "output.length <= 12");
    const recs = await recordings(src, 3);
    let judged = 0;
    const judge: Judge = async () => (judged++, { better: "2", reason: "longer is better", cost: 0 });
    // The variant drops the @expect and writes longer lines: it still loses on the original's check.
    const variant = parse(original(dir).replace("Write one line", "Write one vivid line"));
    const r = await compareRuns({ original: parse(src), variant, pipeline: "Brief", recordings: recs, runtime: () => runtime({ fetch: fakeOpenAI(() => "A very long and vivid line indeed.").fetch }), judge });
    expect(r.lost).toBe(3);
    expect(judged).toBe(0);
    expect(r.runs[0]!.verdict!.reason).toContain("breaks @expect: output.length <= 12");
  });

  test("halo test fails on a broken expectation, but not on placeholder mocks", async () => {
    const cwd = mkdtempSync(join(tmp, "expect-"));
    writeFileSync(join(cwd, "b.halo"), withExpect(workspace(), "output.length <= 12"));
    const run = (...args: string[]) => Bun.spawnSync(["bun", join(root, "index.ts"), "test", "b.halo", "--arg", "topic=x", ...args], { cwd, env: { ...Bun.env, NO_COLOR: "1" } });
    const placeholder = run();
    expect(placeholder.exitCode).toBe(0);
    expect(placeholder.stderr.toString()).toContain("isn't enforced");
    writeFileSync(join(cwd, "short.json"), JSON.stringify({ "Writer.write": "Short." }));
    const ok = run("--mocks", "short.json");
    expect(ok.stderr.toString()).toContain("✓ @expect output.length <= 12");
    expect(ok.exitCode).toBe(0);
    writeFileSync(join(cwd, "long.json"), JSON.stringify({ "Writer.write": "A much longer line than allowed." }));
    const bad = run("--mocks", "long.json");
    expect(bad.stderr.toString()).toContain("✗ @expect output.length <= 12");
    expect(bad.exitCode).toBe(1);
  });
});

describe("halo serve: recordings and /api/evolve", () => {
  test("records served runs, evolves from them in the background, and applies the winner", async () => {
    const dir = workspace();
    const proj = mkdtempSync(join(tmp, "serve-"));
    const src = original(dir);
    const file = join(proj, "brief.halo");
    writeFileSync(file, src);
    const vivid = src.replace("Write one line", "Write one vivid line");
    // One fake OpenAI for the served pipeline, the proposer and the judge.
    const fetch = fakeOpenAI((p) => {
      if (p.includes("You improve Halo programs")) return answer("vivid lines read better", vivid);
      if (p.includes("You compare two outputs")) return JSON.stringify({ better: /output_1: [^\n]*vivid/.test(p) ? "1" : "2", reason: "the vivid one" });
      return answers(p);
    }).fetch;
    const s = await startServer({ files: [file], port: 0, root: proj, stateDir: join(proj, ".halo"), scheduler: false, studio: false, logger: { ...quiet, error() {} }, env: { OPENAI_API_KEY: "k" }, runtime: { fetch }, recordings: { serve: true } });
    const api = (path: string, init?: RequestInit) => globalThis.fetch(`${s.url}${path}`, { ...init, headers: { "Content-Type": "application/json" } }).then(async (r) => ({ status: r.status, body: (await r.json()) as any }));
    try {
      for (let i = 0; i < 6; i++) {
        const r = await api("/api/pipelines/Brief/runs", { method: "POST", body: JSON.stringify({ args: { topic: `t${i}` }, wait: true }) });
        expect(r.body.status).toBe("completed");
      }
      // Each served run left a recording with its model answers, as halo run does.
      const recDir = join(proj, ".halo/recordings");
      const recs = recordingsFor(recDir, "Brief", 50);
      expect(recs).toHaveLength(6);
      expect(recs[0]!.calls.filter((c) => c.kind === "agent" && c.fingerprint)).toHaveLength(2);
      expect(recs[0]!.calls.filter((c) => c.kind === "tool")).toHaveLength(1);

      expect((await api("/api/evolve", { method: "POST", body: JSON.stringify({ pipeline: "Brief" }) })).body.error).toContain("evolve needs at least 10");
      expect((await api("/api/evolve", { method: "POST", body: JSON.stringify({ pipeline: "Brief", variants: 99 }) })).status).toBe(400);
      const started = await api("/api/evolve", { method: "POST", body: JSON.stringify({ pipeline: "Brief", variants: 1, rounds: 1, minRuns: 5 }) });
      expect(started.status).toBe(202);
      const id = started.body.id as string;
      let detail: any;
      for (let i = 0; i < 200; i++) {
        detail = (await api(`/api/evolve/${id}`)).body;
        if (detail.status !== "running") break;
        await Bun.sleep(25);
      }
      expect(detail.status).toBe("done");
      expect(detail.record.winner).toBe("v1");
      expect(detail.diffs.v1).toContain("+    |> Writer.write(\"Write one vivid line");
      expect(detail.log.join("\n")).toContain("Round 1");
      const listed = (await api("/api/evolve")).body as Array<{ id: string; winner?: string }>;
      expect(listed.find((x) => x.id === id)?.winner).toBe("v1");

      // Path tricks don't reach outside the evolve folder.
      expect((await api("/api/evolve/..")).status).toBe(404);
      expect((await api(`/api/evolve/${id}/apply`, { method: "POST", body: JSON.stringify({ variant: "../x" }) })).body.error).toContain("not a variant id");

      const applied = await api(`/api/evolve/${id}/apply`, { method: "POST", body: "{}" });
      expect(applied.body.applied).toBe("v1");
      expect(applied.body.note).toContain("restart halo serve");
      expect(readFileSync(file, "utf8")).toBe(vivid);
      // A second apply sees the file changed since, and refuses.
      expect((await api(`/api/evolve/${id}/apply`, { method: "POST", body: "{}" })).status).toBe(409);
    } finally {
      await s.stop();
    }
  }, 30_000);
});

describe("halo evolve (CLI)", () => {
  async function cli(cwd: string, env: Record<string, string>, ...args: string[]) {
    const p = Bun.spawn(["bun", join(root, "index.ts"), ...args], { cwd, env: { ...Bun.env, NO_COLOR: "1", OPENAI_API_KEY: "", HALO_API_KEY: "", ...env }, stdout: "pipe", stderr: "pipe" });
    const [out, err, code] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text(), p.exited]);
    return { code, out, err };
  }

  test("evolves against a model server, writes the folder, and apply writes the winner", async () => {
    const cwd = mkdtempSync(join(tmp, "cli-"));
    const dir = workspace();
    const model = "ollama/llama3";
    const src = original(dir, model);
    writeFileSync(join(cwd, "brief.halo"), src);
    const vivid = src.replace("Write one line", "Write one vivid line");

    // A fake Ollama: the pipeline's agents, the proposer and the judge, told apart by their system prompts.
    let proposals = 0;
    const server = Bun.serve({
      port: 0,
      async fetch(req) {
        const body = (await req.json()) as { messages: Array<{ role: string; content: string }> };
        const all = body.messages.map((m) => m.content).join("\n");
        let content: string;
        if (all.includes("You improve Halo programs")) content = ++proposals === 1 ? answer("vivid lines read better", vivid) : answer("same again", vivid);
        else if (all.includes("You compare two outputs")) {
          const o1 = all.match(/output_1: ([^\n]*)/)?.[1] ?? "";
          content = JSON.stringify({ better: o1.includes("vivid") ? "1" : "2", reason: "the vivid one" });
        } else content = answers(all);
        return Response.json({ message: { role: "assistant", content }, done: true, prompt_eval_count: 10, eval_count: 5 });
      },
    });
    try {
      const env = { OLLAMA_HOST: `http://localhost:${server.port}` };
      // Too few runs: refused before anything is spent.
      const few = await cli(cwd, env, "evolve", "brief.halo");
      expect(few.code).toBe(1);
      expect(few.err).toContain("evolve needs at least 10");

      for (let i = 0; i < 6; i++) {
        const r = await cli(cwd, env, "run", "brief.halo", "--arg", `topic=t${i}`);
        expect(r.code).toBe(0);
      }
      const r = await cli(cwd, env, "evolve", "brief.halo", "--min-runs", "5", "--variants", "2", "--rounds", "1", "--out", "out");
      expect(r.err).toContain("Evolving Brief in brief.halo");
      expect(r.err).toContain("v1");
      expect(r.err).toContain("duplicate");
      expect(r.err).toContain("Verdict");
      expect(r.code).toBe(0);
      expect(r.err).toContain("Apply with: halo evolve apply out v1");

      const record = JSON.parse(readFileSync(join(cwd, "out/evolve.json"), "utf8")) as EvolveRecord;
      expect(record.winner).toBe("v1");
      expect(record.file).toBe("brief.halo");
      expect(record.models).toEqual({ proposer: model, judge: model });
      expect(readFileSync(join(cwd, "out/variants/v1.diff"), "utf8")).toContain("+    |> Writer.write(\"Write one vivid line");
      expect(readFileSync(join(cwd, "out/report.md"), "utf8")).toContain("**winner**");
      expect(existsSync(join(cwd, "out/holdout-v1.md"))).toBe(true);
      expect(readFileSync(join(cwd, "out/scores.jsonl"), "utf8").trim().split("\n").length).toBeGreaterThan(3);
      // Nothing changed until apply.
      expect(readFileSync(join(cwd, "brief.halo"), "utf8")).toBe(src);

      // --pr: a branch with one commit, pushed, and gh asked to open it; the working copy stays as it was.
      const remote = mkdtempSync(join(tmp, "remote-"));
      Bun.spawnSync(["git", "init", "-q", "--bare"], { cwd: remote });
      const gitEnv = { GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.com", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.com", GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "commit.gpgsign", GIT_CONFIG_VALUE_0: "false" };
      const g = (...args: string[]) => {
        const p = Bun.spawnSync(["git", ...args], { cwd, env: { ...Bun.env, ...gitEnv } });
        if (p.exitCode !== 0) throw new Error(p.stderr.toString());
        return p.stdout.toString().trim();
      };
      g("init", "-q", "-b", "main");
      writeFileSync(join(cwd, ".gitignore"), ".halo/\nout/\nbin/\n");
      g("add", "brief.halo", ".gitignore");
      g("commit", "-q", "-m", "first");
      g("remote", "add", "origin", remote);
      const bin = join(cwd, "bin");
      Bun.spawnSync(["mkdir", "-p", bin]);
      writeFileSync(join(bin, "gh"), `#!/bin/sh\nif [ "$1" = "--version" ]; then echo gh; exit 0; fi\necho "$@" > "${cwd}/gh-args"\ncat > "${cwd}/gh-body"\necho https://github.com/acme/brief/pull/7\n`, { mode: 0o755 });
      const prEnv = { ...env, ...gitEnv, PATH: `${bin}:${Bun.env.PATH}` };
      const pr = await cli(cwd, prEnv, "evolve", "apply", "out", "--pr");
      expect(pr.err).toBe("");
      expect(pr.code).toBe(0);
      expect(pr.out).toContain("opened a pull request with v1: https://github.com/acme/brief/pull/7");
      expect(g("rev-parse", "--abbrev-ref", "HEAD")).toBe("main");
      expect(readFileSync(join(cwd, "brief.halo"), "utf8")).toBe(src);
      const branch = g("--git-dir", remote, "branch", "--format=%(refname:short)").split("\n").find((b) => b.startsWith("halo-evolve/"))!;
      expect(branch).toBe("halo-evolve/out-v1");
      expect(g("--git-dir", remote, "show", `${branch}:brief.halo`)).toBe(vivid.trimEnd());
      expect(readFileSync(join(cwd, "gh-args"), "utf8")).toContain("pr create --head halo-evolve/out-v1 --base main");
      const body = readFileSync(join(cwd, "gh-body"), "utf8");
      expect(body).toContain("reaches nothing the original couldn't");
      expect(body).toContain("+    |> Writer.write(\"Write one vivid line");
      // Summaries only: no recorded inputs or outputs.
      expect(body).not.toContain("A line.");
      expect(body).not.toContain("t0");
      // A file with uncommitted changes is refused.
      writeFileSync(join(cwd, "brief.halo"), src + "// wip\n");
      g("add", "brief.halo");
      g("commit", "-q", "-m", "wip");
      writeFileSync(join(cwd, "brief.halo"), src);
      expect((await cli(cwd, prEnv, "evolve", "apply", "out", "--pr")).err).toContain("uncommitted changes");
      g("commit", "-q", "-am", "back");

      // apply refuses a variant that was thrown away, and a file that changed since; then writes the winner.
      expect((await cli(cwd, env, "evolve", "apply", "out", "v2")).err).toContain("no change");
      writeFileSync(join(cwd, "brief.halo"), src + "\n// edited\n");
      const stale = await cli(cwd, env, "evolve", "apply", "out");
      expect(stale.code).toBe(1);
      expect(stale.err).toContain("changed since it was evolved");
      writeFileSync(join(cwd, "brief.halo"), src);
      const applied = await cli(cwd, env, "evolve", "apply", "out");
      expect(applied.code).toBe(0);
      expect(applied.out).toContain("wrote v1 over brief.halo");
      expect(readFileSync(join(cwd, "brief.halo"), "utf8")).toBe(vivid);
    } finally {
      server.stop(true);
    }
  }, 60_000);
});
