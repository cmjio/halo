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
    expect(r.out).toMatch(/43 file\(s\), 0 error\(s\)/);
  });

  test("validate --strict fails on warnings", () => {
    expect(cli("validate", "examples/14-env-vars.halo", "--strict").code).toBe(1);
  });

  test("run --mock prints the output once", () => {
    const r = cli("run", "examples/01-hello.halo", "--arg", "name=World", "--mock");
    expect(r.code).toBe(0);
    expect(r.out.trim()).toBe("[mock Greeter.prompt] Write a warm, one-sentence 'Hello World' greeting for this person. Input: World");
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
      expect(readdirSync(join(dir, ".halo/runs"))).toEqual([`${runId}.json`]);

      const done = cliIn(dir, "resume", "flow.halo", runId, "--payload", "approve", "--mock");
      expect(done.code).toBe(0);
      expect(done.out).toBe("published\n");
      expect(readdirSync(join(dir, ".halo/runs"))).toEqual([]);
      expect(cliIn(dir, "resume", "flow.halo", runId, "--mock").err).toContain(`No paused run "${runId}"`);
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
