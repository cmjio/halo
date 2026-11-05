import { test, expect, describe, afterAll } from "bun:test";
import { Database } from "bun:sqlite";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(`${import.meta.dir}/..`);
// Runs happen in a scratch directory, so .halo/ (telemetry, paused runs) never lands in the repo.
const work = mkdtempSync(join(tmpdir(), "halo-cli-"));
afterAll(() => rmSync(work, { recursive: true, force: true }));

function cliIn(cwd: string, ...args: string[]) {
  const argv = args.map((a) => (a.startsWith("examples/") || a === "examples" ? join(root, a) : a));
  const p = Bun.spawnSync(["bun", join(root, "index.ts"), ...argv], { cwd, env: { ...Bun.env, NO_COLOR: "1", HALO_API_KEY: "", GEMINI_API_KEY: "", GOOGLE_API_KEY: "" } });
  return { code: p.exitCode, out: p.stdout.toString(), err: p.stderr.toString() };
}

const cli = (...args: string[]) => cliIn(work, ...args);

describe("CLI", () => {
  test("validate examples/ succeeds", () => {
    const r = cli("validate", "examples/");
    expect(r.code).toBe(0);
    const count = [...new Bun.Glob("**/*.halo").scanSync(join(root, "examples"))].length;
    expect(r.out).toContain(`${count} file(s), 0 error(s)`);
  });

  test("validate --strict fails on warnings", () => {
    expect(cli("validate", "examples/14-env-vars.halo", "--strict").code).toBe(1);
  });

  test("run --mock prints the output once", () => {
    const r = cli("run", "examples/01-hello.halo", "--arg", "name=World", "--mock");
    expect(r.code).toBe(0);
    expect(r.out.trim()).toBe("[mock Greeter.prompt] Write a warm, one-sentence 'Hello World' greeting for this person. Input: World");
  });

  test("history lists a @checkpoint run's steps, and rewind continues from one after a yes for its writes", async () => {
    const dir = mkdtempSync(join(work, "rewind-"));
    await Bun.write(
      join(dir, "p.halo"),
      `agent M [openai/gpt-4o]
tool Out : File("out.txt")
@checkpoint
pipeline S(x: String) -> Result:
  x |> M.draft() as draft |> Out.append(entry: context.data.draft)`,
    );
    const run = cliIn(dir, "run", "p.halo", "--arg", "x=doc", "--mock", "--json");
    expect(run.code).toBe(0);
    const runId = JSON.parse(run.out).runId;

    const history = cliIn(dir, "history", runId);
    expect(history.code).toBe(0);
    expect(history.out).toMatch(/1 .* stage 0 +x/);
    expect(history.out).toMatch(/3 .* stage 2 +Out\.append/);
    expect(JSON.parse(cliIn(dir, "history", runId, "--step", "2", "--json").out).data.draft).toContain("mock M.draft");

    // Going back past the write needs a yes (or --mock).
    const refused = cliIn(dir, "rewind", "p.halo", runId, "--step", "2");
    expect(refused.code).toBe(1);
    expect(refused.err).toContain("stage 2 Out.append: write");
    expect(refused.err).toContain("Pass --yes");
    const rewound = cliIn(dir, "rewind", "p.halo", runId, "--step", "2", "--yes", "--json");
    expect(rewound.code).toBe(0);
    expect(JSON.parse(rewound.out).context.meta.rewoundFrom).toEqual({ runId, step: 2 });
    expect(rewound.err).toContain(`Rewound from run ${runId} at step 2`);
    expect(cliIn(dir, "history", "no-such-run").err).toContain("No step history for run no-such-run");
  });

  test("threads and thread show what @thread runs kept, and a reset wants --yes", async () => {
    const dir = mkdtempSync(join(work, "threads-"));
    await Bun.write(join(dir, "t.halo"), `@thread(user_id)\npipeline Visit(user_id: String, page: String) -> Result:\n  page |> Thread.append(pages: page) |> System.Value(context.thread.pages)`);
    expect(cliIn(dir, "threads").out).toContain("No threads yet");
    expect(cliIn(dir, "run", "t.halo", "--arg", "user_id=ana", "--arg", "page=home").code).toBe(0);
    const second = cliIn(dir, "run", "t.halo", "--arg", "user_id=ana", "--arg", "page=pricing", "--json");
    expect(JSON.parse(second.out).output).toEqual(["home", "pricing"]);
    // A mock run never touches real threads.
    expect(cliIn(dir, "run", "t.halo", "--arg", "user_id=ana", "--arg", "page=mock", "--mock").code).toBe(0);

    const list = cliIn(dir, "threads");
    expect(list.out).toMatch(/Visit ana .*v2 · 2 run\(s\).*pages/);
    const shown = JSON.parse(cliIn(dir, "thread", "Visit", "ana", "--json").out);
    expect(shown.thread.state).toEqual({ pages: ["home", "pricing"] });
    expect(shown.log.map((e: { version: number }) => e.version)).toEqual([2, 1]);

    const refused = cliIn(dir, "thread", "Visit", "ana", "--reset");
    expect(refused.code).toBe(1);
    expect(refused.err).toContain("Pass --yes to delete it");
    expect(cliIn(dir, "thread", "Visit", "ana", "--reset", "--yes").out).toContain("Reset thread Visit ana (it was v2)");
    expect(cliIn(dir, "thread", "Visit", "ana").out).toContain("reset (no state)");
    expect(JSON.parse(cliIn(dir, "run", "t.halo", "--arg", "user_id=ana", "--arg", "page=again", "--json").out).output).toEqual(["again"]);
  });

  test("run --json returns the full result", () => {
    const r = cli("run", "examples/06-gates.halo", "--args", '{"name":"Ana","lang":"en"}', "--mock", "--json");
    const result = JSON.parse(r.out);
    expect(result.status).toBe("halted");
    expect(result.context.meta.halted.condition).toBe('lang != "en"');
    expect(r.err).toContain("Halted at stage 2");
  });

  test("missing arguments are explained", () => {
    const r = cli("run", "examples/03-tools.halo", "--mock");
    expect(r.code).toBe(1);
    expect(r.err).toContain("Missing argument(s) for MultiLangHello(name: String, lang: String): name, lang");
  });

  test("multiple pipelines need --pipeline", () => {
    const r = cli("run", "examples/10-named-args.halo", "--mock");
    expect(r.code).toBe(1);
    expect(r.err).toContain("pick one with --pipeline (GreetPerson, Summarize)");
  });

  test("a real run without keys fails with the variable to set", () => {
    const r = cli("run", "examples/01-hello.halo", "--arg", "name=World");
    expect(r.code).toBe(1);
    expect(r.err).toContain("Set GEMINI_API_KEY or GOOGLE_API_KEY or HALO_API_KEY");
  });

  test("debug traces each stage", () => {
    const r = cli("debug", "examples/05-fanout.halo", "--arg", "name=Ana", "--mock");
    expect(r.code).toBe(0);
    expect(r.err).toContain("▶ [1] |* { Greeter.prompt, Greeter.prompt }");
  });

  test("parse prints the AST", () => {
    const ast = JSON.parse(cli("parse", "examples/01-hello.halo").out);
    expect(ast.agents[0].name).toBe("Greeter");
  });

  test("init creates a project that validates and runs offline with `halo test`", () => {
    const dir = mkdtempSync(join(tmpdir(), "halo-init-"));
    try {
      const r = cliIn(dir, "init", "demo");
      expect(r.code).toBe(0);
      expect(readdirSync(join(dir, "demo")).sort()).toEqual([".env.example", ".gitignore", "README.md", "main.halo"]);
      expect(cliIn(dir, "init", "demo").err).toContain(`"demo" already exists`);
      const project = join(dir, "demo");
      expect(cliIn(project, "validate", ".").out).toContain("1 file(s), 0 error(s), 0 warning(s)");
      const run = cliIn(project, "test", "main.halo", "--arg", "topic=tides");
      expect(run.code).toBe(0);
      expect(run.out).toContain("[mock Writer.explain]");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("without a terminal, a yield pauses the run; `halo resume` continues it", async () => {
    const dir = mkdtempSync(join(tmpdir(), "halo-pause-"));
    try {
      await Bun.write(
        join(dir, "flow.halo"),
        `agent W [openai/gpt-4o]
pipeline Approve(doc: String) -> Result:
  doc
    |> W.draft("Draft {{doc}}") as draft
    |! yield(msg: "Publish this draft?") as review
    |? (context.data.review.approved == true)
    |> System.Print("published")`,
      );
      const paused = cliIn(dir, "run", "flow.halo", "--mock", "--arg", "doc=memo");
      expect(paused.code).toBe(0);
      expect(paused.err).toContain("⏸ Paused at stage 2 |! yield, waiting for a human response: Publish this draft?");
      const runId = paused.err.match(/halo resume flow\.halo ([\w-]+)/)![1]!;
      expect(readdirSync(join(dir, ".halo/runs")).sort()).toEqual([`${runId}.json`, `${runId}.log.jsonl`]);

      const done = cliIn(dir, "resume", "flow.halo", runId, "--payload", "approve", "--mock");
      expect(done.code).toBe(0);
      expect(done.out).toBe("published\n");
      expect(readdirSync(join(dir, ".halo/runs"))).toEqual([]);
      expect(cliIn(dir, "resume", "flow.halo", runId, "--mock").err).toContain(`No paused run "${runId}"`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("a violation that @correct fixes is shown as a correction; one it can't fix as a failure", async () => {
    const dir = mkdtempSync(join(tmpdir(), "halo-correct-"));
    try {
      await Bun.write(join(dir, "flow.halo"), `policy Tiny : MaxWords(2)\n@correct(1)\nagent W [openai/gpt-4o]\n  requires Tiny\npipeline P(x: String) -> Result:\n  x |> W.write()`);
      const r = cliIn(dir, "test", "flow.halo", "--arg", "x=hi", "--no-telemetry");
      // The mock always answers with more than 2 words: corrected once, then it fails
      expect(r.err).toContain("✎ W.write: Content exceeds max words");
      expect(r.err).toContain("asked to fix it (attempt 2)");
      expect(r.err.match(/⛔ Tiny\/MaxWords/g)).toHaveLength(1);
      expect(r.code).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("runs are recorded for Halo Studio unless --no-telemetry", () => {
    const dir = mkdtempSync(join(tmpdir(), "halo-telemetry-"));
    try {
      cliIn(dir, "run", "examples/01-hello.halo", "--arg", "name=World", "--mock", "--no-telemetry");
      expect(existsSync(join(dir, ".halo/telemetry.db"))).toBe(false);
      cliIn(dir, "run", "examples/01-hello.halo", "--arg", "name=World", "--mock");
      const db = new Database(join(dir, ".halo/telemetry.db"));
      const types = db.query("SELECT type FROM telemetry ORDER BY id").all().map((r: any) => r.type);
      db.close();
      expect(types[0]).toBe("stream_start");
      expect(types).toContain("llm_call");
      expect(types.at(-1)).toBe("stream_end");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("the package entry point does not run the CLI when imported", async () => {
    const mod = await import("../index.ts");
    expect(typeof mod.parse).toBe("function");
    expect(typeof mod.HaloRuntime).toBe("function");
  });
});

describe("halo serve on a hosting platform", () => {
  async function serveWith(env: Record<string, string>) {
    const dir = mkdtempSync(join(work, "paas-"));
    await Bun.write(join(dir, "flow.halo"), `agent A [ollama/llama3.2]\npipeline P(x: String) -> Result:\n  x |> A.say()\n`);
    const p = Bun.spawn(["bun", join(root, "index.ts"), "serve", "--no-studio"], {
      cwd: dir,
      env: { ...Bun.env, NO_COLOR: "1", HALO_SERVE_TOKEN: "", HALO_HOST: "", PORT: "", ...env },
      stdout: "pipe",
      stderr: "pipe",
    });
    return p;
  }

  test("PORT without a token refuses to start, and says why", async () => {
    const p = await serveWith({ PORT: "0" });
    expect(await p.exited).toBe(1);
    const err = await new Response(p.stderr).text();
    expect(err).toContain("Refusing to listen on 0.0.0.0 without a token");
    expect(err).toContain("PORT is set");
  });

  test("PORT with a token listens on every interface, at that port", async () => {
    const port = 20000 + Math.floor(Math.random() * 20000);
    const p = await serveWith({ PORT: String(port), HALO_SERVE_TOKEN: "tok" });
    try {
      const reader = p.stdout.getReader();
      let out = "";
      while (!out.includes("API")) {
        const { value, done } = await reader.read();
        if (done) break;
        out += new TextDecoder().decode(value);
      }
      expect(out).toContain(`at http://0.0.0.0:${port}`);
      const res = await fetch(`http://127.0.0.1:${port}/api/pipelines`, { headers: { Authorization: "Bearer tok" } });
      expect(res.status).toBe(200);
    } finally {
      p.kill();
      await p.exited;
    }
  });
});
