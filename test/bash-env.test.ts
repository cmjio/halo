import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HaloRuntime } from "../src/runtime/runtime";
import { parse, validate } from "../src/parser/index";
import { migrateProject } from "../src/migrate/index";
import { bashEnv } from "../src/runtime/integrations";

const quiet = { logger: { log() {}, warn() {} } };
const run = async (src: string, env?: Record<string, string | undefined>) => {
  const r = new HaloRuntime({ ...quiet, ...(env ? { env } : {}) }).load(parse(src));
  const { output } = await r.run("P", { x: "" });
  return output as { stdout: string; exitCode: number };
};
const vars = (stdout: string) => new Map(stdout.split("\n").filter(Boolean).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));

describe("Bash runs with a clean environment", () => {
  process.env.HALO_TEST_LEAK = "sk-ant-not-for-commands";
  afterAll(() => delete process.env.HALO_TEST_LEAK);

  test("a command sees the base variables, not Halo's keys", async () => {
    const out = await run(`tool Sh : Bash()\npipeline P(x: String) -> Result:\n  x |> Sh.run(command: "env")`);
    const seen = vars(out.stdout);
    expect(seen.has("HALO_TEST_LEAK")).toBe(false);
    expect(out.stdout).not.toContain("sk-ant-not-for-commands");
    expect(seen.get("PATH")).toBe(process.env.PATH);
    expect(seen.get("HOME")).toBe(process.env.HOME);
    // Nothing beyond the base list (bash adds PWD, SHLVL and _ itself).
    const allowed = new Set(["PATH", "HOME", "USER", "LOGNAME", "SHELL", "LANG", "LC_ALL", "LC_CTYPE", "TMPDIR", "TZ", "TERM", "PWD", "OLDPWD", "SHLVL", "_"]);
    expect([...seen.keys()].filter((k) => !allowed.has(k))).toEqual([]);
  });

  test("env: by name passes a variable on from the runtime's environment", async () => {
    const out = await run(`tool Sh : Bash(env: ["DATABASE_URL", "NOT_SET"])\npipeline P(x: String) -> Result:\n  x |> Sh.run(command: "env")`, { DATABASE_URL: "postgres://db" });
    const seen = vars(out.stdout);
    expect(seen.get("DATABASE_URL")).toBe("postgres://db");
    expect(seen.has("NOT_SET")).toBe(false);
    expect(seen.has("HALO_TEST_LEAK")).toBe(false);
  });

  test("env: by name reads Halo's environment when the runtime has none of its own", async () => {
    const out = await run(`tool Sh : Bash(env: ["HALO_TEST_LEAK"])\npipeline P(x: String) -> Result:\n  x |> Sh.run(command: "printf %s \\"$HALO_TEST_LEAK\\"")`);
    expect(out.stdout).toBe("sk-ant-not-for-commands");
  });

  test("env: values given as a record (from the SDK, where a declaration's config can hold one)", () => {
    const call = { tool: { name: "Sh" } as never, config: (k: string | number) => (k === "env" ? { NODE_ENV: "test", N: 3 } : undefined) };
    const env = bashEnv(call);
    expect(env.NODE_ENV).toBe("test");
    expect(env.N).toBe("3");
    expect(env.HALO_TEST_LEAK).toBeUndefined();
  });

  test("a malformed env: fails the call with TOOL_CONFIG", async () => {
    const r = new HaloRuntime(quiet).load(parse(`tool Sh : Bash(env: "DATABASE_URL")\npipeline P(x: String) -> Result:\n  x |> Sh.run(command: "true")`));
    const err = await r.run("P", { x: "" }).then(() => undefined, (e: unknown) => e);
    expect((err as { code?: string }).code).toBe("TOOL_CONFIG");
    expect(String((err as Error).message)).toContain('env: must be a list of variable names, e.g. env: ["DATABASE_URL"]');
  });
});

describe("halo validate: Bash env:", () => {
  const diags = (src: string) => validate(parse(src)).filter((d) => d.severity === "error").map((d) => d.message);

  test("Env.X in an env: list is the value, not the name", () => {
    expect(diags(`tool Sh : Bash(env: [Env.DATABASE_URL])`)).toEqual([
      'Tool "Sh": env: lists names in quotes, like env: ["DATABASE_URL"]; Env.DATABASE_URL is the value, not the name',
    ]);
  });

  test("a name that isn't a variable name", () => {
    expect(diags(`tool Sh : Bash(env: ["DATABASE-URL"])`)).toEqual(['Tool "Sh": env: "DATABASE-URL" should be an environment variable name, like DATABASE_URL']);
  });

  test("names are fine", () => {
    expect(diags(`tool A : Bash(env: ["DATABASE_URL", "PGUSER"])`)).toEqual([]);
  });
});

describe("halo migrate: bash-clean-env", () => {
  const dir = mkdtempSync(join(tmpdir(), "halo-bash-env-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  test("lists Bash tools with no env:, and the variables their commands name", async () => {
    writeFileSync(
      join(dir, "main.halo"),
      `tool Sh : Bash()
tool Ok : Bash(env: ["X"])
tool Quiet : Bash()
pipeline P(x: String) -> Result:
  x |> Sh.run(command: "psql $DATABASE_URL -c 'select 1' && echo \${API_TOKEN} $HOME")
    |> Ok.run(command: "echo $X")
    |> Quiet.run(command: "ls")
`,
    );
    writeFileSync(join(dir, "halo.json"), JSON.stringify({ halo: "^1.6.0" }));
    const report = await migrateProject(dir, { haloVersion: "1.7.0" });
    expect(report.results.map((r) => [r.id, r.automatic, r.findings])).toEqual([
      [
        "bash-clean-env",
        false,
        [
          { file: "main.halo", line: 1, message: "tool Sh has no env:, and its commands read $API_TOKEN, $DATABASE_URL" },
          { file: "main.halo", line: 3, message: "tool Quiet has no env:" },
        ],
      ],
    ]);
    // A project already on 1.7.0 isn't told again, and a Halo before the change says nothing.
    writeFileSync(join(dir, "halo.json"), JSON.stringify({ halo: "^1.7.0" }));
    expect((await migrateProject(dir, { haloVersion: "1.7.0" })).results).toEqual([]);
    writeFileSync(join(dir, "halo.json"), JSON.stringify({ halo: "^1.6.0" }));
    expect((await migrateProject(dir, { haloVersion: "1.6.0" })).results).toEqual([]);
  });
});
