import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { haloRange, MIGRATIONS, migrateProject, migrationHint, minVersion, MigrateError, type Migration } from "../src/migrate/index";
import { install as installV1 } from "../src/registry/packages";
import { readAnyLock } from "../src/registry/lockfile";
import { compare } from "../src/registry/semver";
import { TOOL_PROVIDERS } from "../src/parser/builtins";
import { initProject } from "../src/init";
import { main } from "../src/cli";
import { parse } from "../src/parser/index";
import { validate } from "../src/parser/validate";
import pkg from "../package.json";

const tmp = mkdtempSync(join(tmpdir(), "halo-migrate-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));
let n = 0;
const project = (files: Record<string, string>) => {
  const dir = join(tmp, `p${n++}`);
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(dir, path, ".."), { recursive: true });
    writeFileSync(join(dir, path), content);
  }
  mkdirSync(dir, { recursive: true });
  return dir;
};
const json = (dir: string, file = "halo.json") => JSON.parse(readFileSync(join(dir, file), "utf8"));

const PAY = `tool Ledger : POST("ledger.example.com/v1", apiKey: Env.LEDGER_KEY)
tool Issue  : POST("ledger.example.com/v1") & Fixed("path", "/issue")
tool Open   : POST("ledger.example.com/v1") & Unlocked("path")
tool Unused : POST("ledger.example.com/v1")
tool Search : GET("api.example.com")

agent Clerk [openai/gpt-4o-mini]
  equips Ledger, Issue, Open, Search

pipeline Pay(who: String) -> Result:
  who |> Clerk.pay("Pay {{who}}", tools: [Ledger])
`;

describe("halo migrate", () => {
  test("the lowest version a range accepts", () => {
    expect(minVersion("^1.3.0")).toBe("1.3.0");
    expect(minVersion(">=0.9.0")).toBe("0.9.0");
    expect(minVersion("1.2.x || ^2.1.0")).toBe("1.2.0");
    expect(minVersion("<2.0.0")).toBeUndefined();
    expect(haloRange("1.5.0-next.3")).toBe("^1.5.0");
  });

  test("every migration has its own id and names a version", () => {
    expect(new Set(MIGRATIONS.map((m) => m.id)).size).toBe(MIGRATIONS.length);
    for (const m of MIGRATIONS) expect(minVersion(m.since)).toBe(m.since);
  });

  test("a project that doesn't say its version is checked against every change", async () => {
    const dir = project({ "pipelines/pay.halo": PAY });
    const report = await migrateProject(dir, { haloVersion: "1.4.0" });
    expect(report.from).toBeUndefined();
    expect(report.results.map((r) => r.id)).toEqual(["post-path-locked"]);
    // Only the equipped POST tool with no rule for path: not the fixed, unlocked, unused or GET ones.
    expect(report.results[0]!.findings).toEqual([{ file: "pipelines/pay.halo", line: 1, message: "tool Ledger is equipped by an agent and has no rule for path" }]);
    expect(report.results[0]!.automatic).toBe(false);
    expect(report.stamp).toEqual({ after: "^1.4.0", written: false });
    // Nothing is written without --write.
    expect(existsSync(join(dir, "halo.json"))).toBe(false);
  });

  test("--write records the version, and changes older than it are not checked again", async () => {
    const dir = project({ "pay.halo": PAY, "halo.json": JSON.stringify({ files: ["."], halo: "^1.3.0", port: 9000 }) });
    expect(await migrationHint(dir, "1.4.0")).toBe("1 thing(s) in this project are affected by changes since Halo 1.3.0. Run `halo migrate` to see them.");
    const report = await migrateProject(dir, { write: true, haloVersion: "1.4.0" });
    expect(report.from).toBe("1.3.0");
    expect(report.stamp).toEqual({ before: "^1.3.0", after: "^1.4.0", written: true });
    // The rest of halo.json stays as it was, in its order.
    expect(readFileSync(join(dir, "halo.json"), "utf8")).toBe(`{\n  "files": [\n    "."\n  ],\n  "halo": "^1.4.0",\n  "port": 9000\n}\n`);
    const again = await migrateProject(dir, { write: true, haloVersion: "1.4.0" });
    expect(again.results).toEqual([]);
    expect(again.stamp).toBeUndefined();
    expect(await migrationHint(dir, "1.4.0")).toBeUndefined();
    // --from looks again from an older version.
    expect((await migrateProject(dir, { from: "1.0.0", haloVersion: "1.4.0" })).results.map((r) => r.id)).toEqual(["post-path-locked"]);
    await expect(migrateProject(dir, { from: "old" })).rejects.toThrow(MigrateError);
  });

  test("a project written for a newer Halo is told to upgrade, and nothing is changed", async () => {
    const dir = project({ "a.halo": PAY, "halo.json": JSON.stringify({ halo: "^2.0.0" }) });
    const report = await migrateProject(dir, { write: true, haloVersion: "1.4.0" });
    expect(report.needsUpgrade).toBe("^2.0.0");
    expect(report.results).toEqual([]);
    expect(json(dir).halo).toBe("^2.0.0");
    expect(await migrationHint(dir, "1.4.0")).toBe("This project is written for Halo ^2.0.0, and this is Halo 1.4.0. Run `halo upgrade`.");
    // A next build of the version it asks for runs it.
    expect((await migrateProject(dir, { haloVersion: "2.0.0-next.1" })).needsUpgrade).toBeUndefined();
    writeFileSync(join(dir, "halo.json"), JSON.stringify({ halo: "soon" }));
    await expect(migrateProject(dir)).rejects.toThrow(/not a version range/);
    expect(await migrationHint(dir)).toBeUndefined();
  });

  test("a screenshot read as base64 is listed, in files that use Chrome", async () => {
    const dir = project({
      "shots.halo": `tool Tab : Chrome()
agent Eye [anthropic/claude-haiku-4-5]
pipeline P(url: String) -> Result:
  url |> Tab.screenshot() as shot
    |> Eye.look(image: context.data.shot.base64)   // .base64 in a comment is ignored
`,
      "other.halo": `tool Api : GET("https://example.com")
pipeline Q(x: String) -> Result:
  x |> Api.get() |> System.Value(context.data.Api.get.base64)
`,
      "halo.json": JSON.stringify({ halo: "^1.5.0" }),
    });
    const report = await migrateProject(dir, { haloVersion: "1.6.0" });
    expect(report.results.map((r) => [r.id, r.findings])).toEqual([["screenshot-image", [{ file: "shots.halo", line: 5, message: "reads a screenshot's base64 or mimeType" }]]]);
    // A Halo before the change has nothing to say about it.
    expect((await migrateProject(dir, { haloVersion: "1.5.0" })).results).toEqual([]);
  });

  test("a 0.x halo.lock is rewritten by installing again", async () => {
    const dir = project({ "main.halo": "pipeline P(x: String) -> Result:\n  x |> System.Print()\n" });
    const pkgDir = join(dir, "tools/acme");
    mkdirSync(pkgDir, { recursive: true });
    const provider = { kind: "http", description: "The acme API", baseUrl: "https://api.acme.io/v1", methods: [{ name: "get", description: "Get", effect: "read", http: { method: "GET", path: "/x" } }] };
    writeFileSync(join(pkgDir, "halo-tool.json"), JSON.stringify({ name: "acme", version: "1.0.0", description: "d", providers: { Acme: provider } }));
    await installV1({ root: dir, builtins: [...TOOL_PROVIDERS] }, pkgDir);
    expect(readAnyLock(dir).version).toBe(1);

    const seen = await migrateProject(dir, { haloVersion: "1.4.0" });
    expect(seen.results.map((r) => [r.id, r.automatic, r.applied])).toEqual([["lockfile-v2", true, false]]);
    expect(seen.results[0]!.findings[0]).toEqual({ file: "halo.lock", message: "lists acme in the old format" });
    expect(readAnyLock(dir).version).toBe(1);

    const done = await migrateProject(dir, { write: true, haloVersion: "1.4.0" });
    expect(done.results[0]!.applied).toBe(true);
    expect(readAnyLock(dir).version).toBe(2);
    expect(json(dir)).toEqual({ dependencies: { acme: "./tools/acme" }, halo: "^1.4.0" });
    expect((await migrateProject(dir, { from: "0.5.0", haloVersion: "1.4.0" })).results).toEqual([]);
  });

  test("a change that can't be applied leaves the version as it was", async () => {
    const dir = project({ "a.halo": "pipeline P(x: String) -> Result:\n  x |> System.Print()\n", "halo.json": JSON.stringify({ halo: "^1.0.0" }) });
    const calls: string[] = [];
    const migrations: Migration[] = [
      { id: "b", since: "1.2.0", title: "B", detail: "b", find: () => [{ file: "a.halo", message: "b" }], apply: async () => void calls.push("b") },
      { id: "c", since: "1.3.0", title: "C", detail: "c", find: () => [{ file: "a.halo", message: "c" }], apply: async () => Promise.reject(new Error("no network")) },
      { id: "a", since: "0.9.0", title: "A", detail: "a", find: () => [{ file: "a.halo", message: "a" }], apply: async () => void calls.push("a") },
    ];
    const report = await migrateProject(dir, { write: true, haloVersion: "1.4.0", migrations });
    // Oldest first, and the one from before the project's version is skipped.
    expect(calls).toEqual(["b"]);
    expect(report.results.map((r) => [r.id, r.applied, r.error])).toEqual([["b", true, undefined], ["c", false, "no network"]]);
    expect(report.stamp).toEqual({ before: "^1.0.0", after: "^1.3.0", written: false });
    expect(json(dir).halo).toBe("^1.0.0");
  });

  test("halo init writes the version, so a new project has nothing to migrate", async () => {
    const cwd = process.cwd();
    const dir = project({});
    process.chdir(dir);
    try {
      const quiet = { log() {}, error() {} };
      expect(await initProject("plain", quiet)).toBe(0);
      expect(await initProject("inbox", quiet, "support-inbox")).toBe(0);
    } finally {
      process.chdir(cwd);
    }
    for (const name of ["plain", "inbox"]) {
      expect(json(join(dir, name)).halo).toBe(haloRange(pkg.version));
      const report = await migrateProject(join(dir, name));
      expect(report.results).toEqual([]);
      expect(report.stamp).toBeUndefined();
    }
    // The blueprint's own settings are still there.
    expect(Object.keys(json(join(dir, "inbox"))).length).toBeGreaterThan(1);
  });

  test("the command: a report, --check, --json and --write", async () => {
    const dir = project({ "pay.halo": PAY });
    const out: string[] = [];
    const log = console.log;
    console.log = (...a: unknown[]) => void out.push(a.join(" "));
    try {
      expect(await main(["migrate", dir])).toBe(0);
      expect(out.join("\n")).toContain("pay.halo:1  tool Ledger is equipped by an agent and has no rule for path");
      // The newest change this Halo has (a migration for the next release can be written before the version moves).
      const newest = MIGRATIONS.map((m) => m.since).filter((v) => compare(v, pkg.version.replace(/-.*$/, "")) <= 0).at(-1);
      expect(out.join("\n")).toContain(`record "halo": "^${newest}" in halo.json`);
      expect(await main(["migrate", dir, "--check"])).toBe(1);
      out.length = 0;
      expect(await main(["migrate", dir, "--json"])).toBe(0);
      expect(JSON.parse(out.join("\n")).results[0].id).toBe("post-path-locked");
      expect(await main(["migrate", dir, "--write"])).toBe(0);
      expect(await main(["migrate", dir, "--check"])).toBe(0);
    } finally {
      console.log = log;
    }
    expect(json(dir).halo).toMatch(/^\^\d+\.\d+\.\d+$/);
  });

  describe("1.9.0", () => {
    const OLD = `tool Code : Workspace(".")
tool Card : Vault(source: "mock", kind: "card", fields: ["number"], host: ["shop.example"])

policy Budget : maxspend(0.25) & Block(PromptInjecton)
  & AllowTools("Cod.read")
policy Wish : Require(Approver)

@retyr(2)
agent Coder [openai/gpt-4o]
  requires Budget, Wish

schema Reply {
  text: String
}

pipeline Fix(task: String) -> Result<Reply>:
  task
    |> Coder.fix("Fix it") as tests
    |? (context.data.tests != "") =>
    |<> loop(Coder, "context.data.tests != \\"ok\\" && task != 'x'", mx: 3)
`;

    test("lists every change: renames, rules nothing can check, loops, gate arrows and Result<T>", async () => {
      const dir = project({ "fix.halo": OLD, "halo.json": JSON.stringify({ halo: "^1.8.0" }) });
      const report = await migrateProject(dir, { haloVersion: "1.9.0" });
      const by = Object.fromEntries(report.results.map((r) => [r.id, r]));
      expect(Object.keys(by)).toEqual(["misspelled-names", "unknown-names", "loop-condition", "gate-arrow", "result-type-checked"]);
      expect(by["misspelled-names"]!.findings.map((f) => f.message).sort()).toEqual(["Cod → Code", "PromptInjecton → PromptInjection", "host → hosts", "maxspend → MaxSpend", "mx → max", "retyr → retry"]);
      expect(by["misspelled-names"]!.automatic).toBe(true);
      expect(by["unknown-names"]!.findings.map((f) => f.message)).toEqual([expect.stringContaining("Require(Approver) is not something it can check")]);
      expect(by["unknown-names"]!.automatic).toBe(false);
      expect(by["loop-condition"]!.findings).toEqual([{ file: "fix.halo", line: 20, message: `loop(Coder, "context.data.tests != "ok" && task != 'x'")` }]);
      expect(by["gate-arrow"]!.findings).toHaveLength(1);
      expect(by["result-type-checked"]!.findings).toEqual([{ file: "fix.halo", line: 16, message: "Fix: Result<Reply>" }]);
      // A Halo before the change has nothing to say about it.
      expect((await migrateProject(dir, { haloVersion: "1.8.1" })).results).toEqual([]);
    });

    test("--write renames, rewrites the loop and the gate, and leaves the rest to a person", async () => {
      const dir = project({ "fix.halo": OLD, "halo.json": JSON.stringify({ halo: "^1.8.0" }) });
      const report = await migrateProject(dir, { haloVersion: "1.9.0", write: true });
      expect(report.results.filter((r) => r.automatic).map((r) => [r.id, r.applied, r.error])).toEqual([
        ["misspelled-names", true, undefined],
        ["loop-condition", true, undefined],
        ["gate-arrow", true, undefined],
      ]);
      const text = readFileSync(join(dir, "fix.halo"), "utf8");
      expect(text).toContain(`policy Budget : MaxSpend(0.25) & Block(PromptInjection)\n  & AllowTools("Code.read")`);
      expect(text).toContain(`hosts: ["shop.example"]`);
      expect(text).toContain("@retry(2)");
      expect(text).toContain(`    |? (context.data.tests != "")\n`);
      expect(text).toContain(`    |<> loop(Coder, (context.data.tests != "ok" && task != 'x'), max: 3)`);
      // What's left is the rule nothing can check, which is a person's.
      const errors = validate(parse(text)).filter((d) => d.severity === "error").map((d) => d.message);
      expect(errors).toEqual([expect.stringContaining("Require(Approver)")]);
      // Running it again changes nothing.
      await migrateProject(dir, { haloVersion: "1.9.0", write: true, from: "1.8.0" });
      expect(readFileSync(join(dir, "fix.halo"), "utf8")).toBe(text);
    });
  });

  test("1.12.0: stdio MCP servers without cwd:, and MCP settings Halo doesn't read", async () => {
    const dir = project({
      "tools.halo": `tool Local : MCP("bun ./server.ts")
tool Here  : MCP("uv run server.py", cwd: ".")
tool Docs  : MCP(url: "https://docs.example/mcp")
tool Far   : MCP("https://far.example/mcp")
tool Slow  : MCP("npx -y slow-server", cwd: ".", timeout: 5)

pipeline P(x: String) -> Result:
  x |> Local.list_tools()
`,
      "halo.json": JSON.stringify({ halo: "^1.11.0" }),
    });
    const report = await migrateProject(dir, { haloVersion: "1.12.0" });
    const by = Object.fromEntries(report.results.map((r) => [r.id, r]));
    expect(Object.keys(by)).toEqual(["mcp-private-cwd", "mcp-unknown-settings"]);
    expect(by["mcp-private-cwd"]!.findings).toEqual([{ file: "tools.halo", line: 1, message: `Local ("bun ./server.ts") starts in an empty folder; add cwd: "." if it needs the project's` }]);
    expect(by["mcp-unknown-settings"]!.findings).toEqual([{ file: "tools.halo", line: 5, message: expect.stringContaining('MCP has no setting "timeout"') }]);
    expect((await migrateProject(dir, { haloVersion: "1.11.0" })).results).toEqual([]);
  });
});


describe("1.12.0", () => {
  test("Env variables a tool reads that don't look like secrets are listed: their values are masked if a service sends them back", async () => {
    const dir = project({
      "acct.halo": `tool Api : REST("api.example.com", apiKey: Env.API_KEY) & Fixed("account", Env.ACCOUNT_ID)\ntool Db : PostgreSQL("Env.DATABASE_URL")\npipeline P(x: String) -> Result:\n  x |> Api.get()\n`,
      "halo.json": JSON.stringify({ halo: "^1.11.0" }),
    });
    const report = await migrateProject(dir, { haloVersion: "1.12.0" });
    expect(report.results.map((r) => [r.id, r.findings])).toEqual([
      ["env-values-masked", [
        { file: "acct.halo", line: 1, message: "Api reads Env.ACCOUNT_ID: if a service sends its value back, the run sees [secret ACCOUNT_ID]" },
        { file: "acct.halo", line: 2, message: "Db reads Env.DATABASE_URL: if a service sends its value back, the run sees [secret DATABASE_URL]" },
      ]],
    ]);
  });

  test("Gmail and Outlook tools that sign in with clientId: are listed: their tokens go through the OAuth broker", async () => {
    const dir = project({
      "mail.halo": `tool Gmail : Email(Env.GMAIL_REFRESH_TOKEN, via: "gmail", clientId: Env.GOOGLE_CLIENT_ID, clientSecret: Env.GOOGLE_CLIENT_SECRET, user: "me@gmail.com")
tool Outlook : Email(Env.MS_CLIENT_SECRET, via: "outlook", tenant: "contoso.com", clientId: Env.MS_CLIENT_ID, user: "support@contoso.com")
tool Pasted : Email(via: "gmail", accessToken: Env.GMAIL_ACCESS_TOKEN, clientId: Env.GOOGLE_CLIENT_ID)
tool Resend : Email(Env.RESEND_API_KEY, from: "bot@example.com")
pipeline P(x: String) -> Result:
  x |> Resend.send(to: x, subject: "Hi", body: "Hello")
`,
      "halo.json": JSON.stringify({ halo: "^1.11.0" }),
    });
    const report = await migrateProject(dir, { haloVersion: "1.12.0" });
    const mail = report.results.find((r) => r.id === "mail-oauth-broker")!;
    expect(mail.findings).toEqual([
      { file: "mail.halo", line: 1, message: "Gmail (Email via gmail) signs in through the OAuth broker: a refresh token the provider rotates is kept outside the project and used next time" },
      { file: "mail.halo", line: 2, message: "Outlook (Email via outlook) signs in through the OAuth broker: a refresh token the provider rotates is kept outside the project and used next time" },
    ]);
    expect(mail.automatic).toBe(false);
  });
});
