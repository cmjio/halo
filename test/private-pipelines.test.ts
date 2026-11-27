// @private: a pipeline only its own file's pipelines can call. Not served, not imported, not run directly.

import { test, expect, describe, afterAll } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parse } from "../src/parser/index";
import { validate } from "../src/parser/validate";
import { checkLinked, entryPipelines, isPrivate } from "../src/linker/index";
import { linkFile } from "../src/linker/node";
import { HaloRuntime } from "../src/runtime/runtime";
import { startServer } from "../src/serve/server";

const repo = resolve(import.meta.dir, "..");
const tmp = mkdtempSync(join(tmpdir(), "halo-private-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));
const quiet = { log() {}, warn() {}, error() {} };

const FACTORY = `agent W [openai/gpt-4o]

@private
pipeline Build(pkg: String) -> Result:
  pkg |> W.build("Build {{pkg}}")

pipeline Factory(brief: String) -> Result:
  brief |> Build(brief) as built |> W.review(context.data.built)
`;

function project(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmp, "p-"));
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
  return dir;
}

async function cli(cwd: string, args: string[]) {
  const p = Bun.spawn(["bun", join(repo, "index.ts"), ...args], { cwd, env: { ...Bun.env, NO_COLOR: "1" }, stdout: "pipe", stderr: "pipe" });
  const [out, err, code] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text(), p.exited]);
  return { code, out, err };
}

describe("@private in the validator", () => {
  const messages = (src: string) => validate(parse(src)).map((d) => `${d.severity}: ${d.message}`);

  test("a private pipeline its file calls is fine", () => {
    expect(messages(FACTORY).filter((m) => m.includes("private"))).toEqual([]);
  });

  test("one nothing calls is a warning; on an agent, or with arguments, it's an error", () => {
    expect(messages(`agent W [openai/gpt-4o]\n@private\npipeline Lonely(x: String) -> Result:\n  x |> W.a()`)).toContain('warning: Pipeline "Lonely" is @private and nothing in this file calls it, so it can never run');
    expect(messages(`@private\nagent W [openai/gpt-4o]\npipeline P(x: String) -> Result:\n  x |> W.a()`)).toContain("error: @private only applies to pipelines");
    expect(messages(`agent W [openai/gpt-4o]\n@private(yes)\npipeline H(x: String) -> Result:\n  x |> W.a()\npipeline P(x: String) -> Result:\n  x |> H(x)`)).toContain("error: @private takes no arguments");
    expect(messages(`agent W [openai/gpt-4o]\n@privat\npipeline H(x: String) -> Result:\n  x |> W.a()`).some((m) => m.includes("did you mean @private"))).toBe(true);
  });
});

describe("@private in the linker", () => {
  test("it isn't an entry point, but the runtime still runs it when its file calls it", async () => {
    const ast = parse(FACTORY);
    expect(entryPipelines(ast).map((p) => p.name)).toEqual(["Factory"]);
    expect(entryPipelines(ast, { includePrivate: true }).map((p) => p.name)).toEqual(["Build", "Factory"]);
    expect(isPrivate(ast.pipelines[0]!)).toBe(true);
    const calls: string[] = [];
    const rt = new HaloRuntime().load(ast).mockAll({ "W.build": (r: { prompt: string }) => (calls.push("build"), "built"), "W.review": "ok" });
    expect(await rt.execute("Factory", { brief: "x" })).toBe("ok");
    expect(calls).toEqual(["build"]);
  });

  test("another file can't import it, but can import a public pipeline that calls it", async () => {
    const dir = project({
      "lib.halo": FACTORY,
      "bad.halo": `use "./lib.halo" { Build }\npipeline Main(x: String) -> Result:\n  x |> Build(x)\n`,
      "good.halo": `use "./lib.halo" { Factory }\npipeline Main(x: String) -> Result:\n  x |> Factory(x)\n`,
    });
    const bad = checkLinked(linkFile(join(dir, "bad.halo"))).filter((d) => d.severity === "error").map((d) => d.message);
    expect(bad.some((m) => m.includes('pipeline "Build" is @private to lib.halo'))).toBe(true);
    const linked = linkFile(join(dir, "good.halo"));
    expect(checkLinked(linked).filter((d) => d.severity === "error")).toEqual([]);
    const rt = new HaloRuntime().load(linked.program).mockAll({ "W.build": "built", "W.review": "ok" });
    expect(await rt.execute("Main", { x: "go" })).toBe("ok");
  });
});

describe("@private on the command line", () => {
  test("halo run can't start at it; halo test can; the default entry ignores it", async () => {
    const dir = project({ "f.halo": FACTORY });
    const run = await cli(dir, ["run", "f.halo", "--pipeline", "Build", "--arg", "pkg=x"]);
    expect(run.code).not.toBe(0);
    expect(run.err).toContain('Pipeline "Build" is @private');
    const t = await cli(dir, ["test", "f.halo", "--pipeline", "Build", "--arg", "pkg=x"]);
    expect(t.code).toBe(0);
    const def = await cli(dir, ["test", "f.halo", "--arg", "brief=x"]);
    expect(def.code).toBe(0);
    expect(def.err + def.out).not.toContain("pick one with --pipeline");
  }, 30_000);
});

describe("@private in halo serve", () => {
  test("no API route or listing, and a trigger that names it stops the server", async () => {
    const dir = project({ "f.halo": FACTORY });
    const base = { files: [join(dir, "f.halo")], port: 0, stateDir: join(dir, ".halo"), scheduler: false, logger: quiet, env: {} };
    const s = await startServer({ ...base, onRuntime: (rt) => rt.mockAll({ "W.build": "built", "W.review": "ok" }) });
    try {
      const list = (await (await fetch(`${s.url}/api/pipelines`)).json()) as Array<{ name: string }>;
      expect(list.map((p) => p.name)).toEqual(["Factory"]);
      const res = await fetch(`${s.url}/api/pipelines/Build/runs`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ args: { pkg: "x" } }) });
      expect(res.status).toBe(400);
      expect(((await res.json()) as { error: string }).error).toContain("is @private");
      const ok = await fetch(`${s.url}/api/pipelines/Factory/runs`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ args: { brief: "x" }, wait: true }) });
      expect(await ok.json()).toMatchObject({ status: "completed", output: "ok" });
    } finally {
      await s.stop();
    }
    await expect(startServer({ ...base, stateDir: join(dir, ".halo2"), schedules: [{ pipeline: "Build", cron: "0 9 * * *", args: { pkg: "x" } }] })).rejects.toThrow("is @private");
  });
});
