import { test, expect, describe, afterAll } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parse } from "../src/parser/index";
import { HaloRuntime, type RuntimeConfig } from "../src/runtime/runtime";
import { readRecording, Recorder, type Recording } from "../src/runtime/replay";
import type { Judge } from "../src/compare";
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
    const a = readFileSync(join(root, "examples/50-github-triage.halo"), "utf8");
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
