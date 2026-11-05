import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "../src/parser/index";
import { validate } from "../src/parser/validate";
import { HaloRuntime, useTool, type MockRequest } from "../src/runtime/runtime";
import { LOCAL_PROVIDERS, LOCAL_PROVIDER_INFO } from "../src/runtime/providers/index";
import { evaluate } from "../src/runtime/providers/calc";
import { parseSpan } from "../src/runtime/providers/clock";
import { parseStatus } from "../src/runtime/providers/git";
import { AGENT_PRESETS, applyPreset } from "../src/runtime/presets";
import { BUILTIN_SKILLS, loadSkillDir, parseFrontmatter, readSkillFile, skillCatalog } from "../src/runtime/skills";
import { plan } from "../src/plan";
import { getCompletions } from "../src/lsp/completions";
import type { ToolCall, ToolServices } from "../src/runtime/tools";

let tmp: string;
beforeAll(() => {
  tmp = mkdtempSync(join(tmpdir(), "halo-builtins-kit-"));
});
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

function makeCall(provider: string, method: string, named: Record<string, unknown> = {}, decl: Record<string | number, unknown> = {}, positional: unknown[] = [], implicitInput = false): ToolCall {
  return {
    tool: { name: "T", provider, args: [], namedArgs: {}, argList: [] },
    method,
    positional,
    implicitInput,
    named,
    config: (n) => decl[n],
    viaAgent: false,
    signal: new AbortController().signal,
  };
}

const services = (fetchImpl?: typeof fetch, env: Record<string, string> = {}): ToolServices =>
  ({ fetch: fetchImpl ?? (() => Promise.reject(new Error("no network"))), env, vectors: () => undefined, sql: () => undefined }) as unknown as ToolServices;

function call(provider: string, method: string, named: Record<string, unknown> = {}, decl: Record<string | number, unknown> = {}, svc = services()) {
  return LOCAL_PROVIDERS[provider]!(makeCall(provider, method, named, decl), svc) as Promise<any>;
}

test("every new provider describes its methods, each with an effect", async () => {
  const effects: Record<string, string> = {};
  for (const p of ["Clock", "Calc", "Data", "Git", "WebSearch", "Skills"]) {
    const info = LOCAL_PROVIDER_INFO[p]!;
    const methods = typeof info.methods === "function" ? await info.methods({ tool: {} as any, config: () => undefined, signal: new AbortController().signal }, services()) : info.methods!;
    for (const m of methods) effects[`${p}.${m.name}`] = m.effect;
  }
  expect(Object.entries(effects).filter(([, e]) => e !== "read")).toEqual([["Git.commit", "write"], ["Git.checkout", "write"]]);
  expect(Object.keys(effects)).toHaveLength(38);
});

describe("Clock", () => {
  const pinned = { now: "2026-11-05T12:00:00Z" };
  test("now in a timezone, with a pinned clock", async () => {
    const r = await call("Clock", "now", { timezone: "Asia/Kolkata" }, pinned);
    expect(r).toMatchObject({ iso: "2026-11-05T12:00:00.000Z", local: "2026-11-05T17:30:00+05:30", date: "2026-11-05", weekday: "Thursday" });
  });
  test("add durations and calendar units", async () => {
    expect((await call("Clock", "add", { duration: "-1d12h" }, pinned)).iso).toBe("2026-11-04T00:00:00.000Z");
    expect((await call("Clock", "add", { date: "2026-01-15T00:00:00Z", months: 2, days: 1 })).date).toBe("2026-03-16");
    await expect(call("Clock", "add", {})).rejects.toThrow(/needs duration/);
    await expect(call("Clock", "add", { duration: "soon" })).rejects.toThrow(/duration must be/);
  });
  test("diff and format", async () => {
    const d = await call("Clock", "diff", { from: "2026-11-01T00:00:00Z" }, pinned);
    expect(d).toMatchObject({ days: 4.5, human: "4 days 12 hours" });
    const f = await call("Clock", "format", { date: "2026-07-04T15:00:00Z", timezone: "America/New_York", style: "short" });
    expect(f.text).toContain("11:00");
  });
  test("bad input is a TOOL_ARGUMENT error", async () => {
    await expect(call("Clock", "now", { timezone: "Mars/Olympus" })).rejects.toMatchObject({ code: "TOOL_ARGUMENT" });
    await expect(call("Clock", "parse", { text: "not a date" })).rejects.toMatchObject({ code: "TOOL_ARGUMENT" });
  });
  test("parseSpan", () => {
    expect(parseSpan("1h30m")).toBe(5_400_000);
    expect(parseSpan("-2w")).toBe(-1_209_600_000);
    expect(parseSpan("2 days")).toBeNaN();
  });
});

describe("Calc", () => {
  test("arithmetic, precedence and functions", () => {
    expect(evaluate("1 + 2 * 3")).toBe(7);
    expect(evaluate("2 ^ 3 ^ 2")).toBe(512);
    expect(evaluate("-2 ^ 2")).toBe(-4);
    expect(evaluate("round(10 / 3, 2)")).toBe(3.33);
    expect(evaluate("max(1, 5, 3) + min(4, 2)")).toBe(7);
    expect(evaluate("if(a > 1, 10, 20)", { a: 2 })).toBe(10);
    expect(evaluate("1 < 2 && 2 < 1 || 1")).toBe(1);
  });
  test("vars: dotted paths, lists spread into functions, numeric strings", () => {
    expect(evaluate("sum(order.items) * (1 + tax)", { order: { items: [10, 20] }, tax: "0.5" })).toBe(45);
    expect(evaluate("total", { total: "1,250.5" })).toBe(1250.5);
  });
  test("refuses anything that isn't arithmetic", () => {
    for (const bad of ["constructor", "__proto__", "process.exit(1)", "a[0]", "1 +", "foo(1)", "1 / 0", "'x'"]) expect(() => evaluate(bad, {})).toThrow();
  });
  test("eval fixes float noise and honours precision", async () => {
    expect((await call("Calc", "eval", { expression: "0.1 + 0.2" })).result).toBe(0.3);
    expect((await call("Calc", "eval", { expression: "pi" }, { precision: 2 })).result).toBe(3.14);
    await expect(call("Calc", "eval", { expression: "nope" })).rejects.toMatchObject({ code: "TOOL_ARGUMENT" });
  });
  test("stats, percent, change", async () => {
    expect(await call("Calc", "stats", { values: [1, 2, 3, 4, 100] })).toMatchObject({ count: 5, sum: 110, mean: 22, median: 3, min: 1, max: 100 });
    expect((await call("Calc", "percent", { part: 1, whole: 8 })).percent).toBe(12.5);
    expect(await call("Calc", "change", { from: 80, to: 100 })).toMatchObject({ difference: 20, percent: 25 });
  });
});

describe("Data", () => {
  const rows = [
    { id: 1, team: "a", pts: 5, name: "Ada" },
    { id: 2, team: "b", pts: 9, name: "Bo" },
    { id: 3, team: "a", pts: 7, name: "Cy" },
  ];
  test("filter with operators, sort, limit", async () => {
    expect(await call("Data", "filter", { data: rows, where: { team: "a", pts: { ">=": 6 } } })).toEqual([rows[2]]);
    expect(await call("Data", "filter", { data: rows, where: { name: { matches: "^[ab]" } } })).toHaveLength(2);
    expect((await call("Data", "sort", { data: rows, by: "pts", desc: true })).map((r: any) => r.id)).toEqual([2, 3, 1]);
    expect(await call("Data", "limit", { data: rows, n: 1, offset: 1 })).toEqual([rows[1]]);
    await expect(call("Data", "filter", { data: rows, where: { pts: { "~": 1 } } })).rejects.toThrow(/unknown operator/);
    // Pipelines have no record literals, so where can be text (or JSON text).
    expect(await call("Data", "filter", { data: rows, where: "team == 'a' && pts > 5" })).toEqual([rows[2]]);
    expect(await call("Data", "filter", { data: rows, where: "name starts_with b && id in [1, 2]" })).toEqual([rows[1]]);
    expect(await call("Data", "find", { data: rows, where: '{"id": 3}' })).toEqual(rows[2]);
    await expect(call("Data", "filter", { data: rows, where: "pts >" })).rejects.toThrow(/can't read the condition/);
  });
  test("group, count, aggregate, unique, pick", async () => {
    expect(Object.keys(await call("Data", "group", { data: rows, by: "team" }))).toEqual(["a", "b"]);
    expect(await call("Data", "count", { data: rows, by: "team" })).toEqual({ a: 2, b: 1 });
    expect(await call("Data", "aggregate", { data: rows, field: "pts", op: "avg", by: "team" })).toEqual({ a: 6, b: 9 });
    expect(await call("Data", "aggregate", { data: rows, field: "pts", op: "max" })).toBe(9);
    expect(await call("Data", "unique", { data: rows, by: "team" })).toHaveLength(2);
    expect(await call("Data", "pick", { data: rows[0], fields: ["id", "name"] })).toEqual({ id: 1, name: "Ada" });
  });
  test("join and diff by key", async () => {
    const owners = [{ team: "a", owner: "Zed" }];
    const joined = await call("Data", "join", { left: rows, right: owners, on: "team", type: "inner" });
    expect(joined.map((r: any) => r.owner)).toEqual(["Zed", "Zed"]);
    const d = await call("Data", "diff", { before: rows, after: [{ ...rows[0], pts: 6 }, rows[1]], key: "id" });
    expect(d.count).toBe(2);
    expect(d.changes).toContainEqual({ path: "3", type: "removed", before: rows[2] });
    expect(d.changes).toContainEqual({ path: "1.pts", type: "changed", before: 5, after: 6 });
  });
  test("CSV round trip", async () => {
    const csv = await call("Data", "to_csv", { data: [{ a: 1, b: "x,y" }, { a: 2, b: 'q"' }] });
    expect(csv).toBe('a,b\n1,"x,y"\n2,"q"""\n');
    expect(await call("Data", "from_csv", { text: csv })).toEqual([{ a: "1", b: "x,y" }, { a: "2", b: 'q"' }]);
  });
  test("paths can't reach prototypes", async () => {
    expect(await call("Data", "get", { data: {}, path: "constructor.name" })).toBeNull();
    const picked = await call("Data", "pick", { data: { a: 1 }, fields: ["__proto__.x", "a"] });
    expect(picked).toEqual({ a: 1 });
    expect(({} as any).x).toBeUndefined();
  });
});

describe("Git", () => {
  let repo: string;
  const git = (args: string[]) => Bun.spawnSync(["git", "-C", repo, ...args], { env: { ...process.env, GIT_AUTHOR_NAME: "T", GIT_AUTHOR_EMAIL: "t@example.com", GIT_COMMITTER_NAME: "T", GIT_COMMITTER_EMAIL: "t@example.com" } });
  beforeAll(() => {
    repo = join(tmp, "repo");
    mkdirSync(repo);
    git(["init", "-q", "-b", "main"]);
    git(["config", "user.name", "T"]);
    git(["config", "user.email", "t@example.com"]);
    writeFileSync(join(repo, "a.txt"), "one\ntwo\n");
    git(["add", "."]);
    git(["commit", "-q", "-m", "first"]);
    writeFileSync(join(repo, "a.txt"), "one\nTWO\n");
    writeFileSync(join(repo, "b.txt"), "new\n");
  });
  const g = (method: string, named: Record<string, unknown> = {}, decl: Record<string | number, unknown> = {}) => call("Git", method, named, { 0: repo, ...decl });

  test("status, log, diff, show, grep, blame", async () => {
    const s = await g("status");
    expect(s.branch).toBe("main");
    expect(s.files).toEqual(expect.arrayContaining([{ path: "a.txt", status: "modified", staged: false }, { path: "b.txt", status: "untracked", staged: false }]));
    expect((await g("log"))[0]).toMatchObject({ subject: "first", author: "T" });
    expect((await g("diff")).diff).toContain("+TWO");
    expect((await g("show", { ref: "HEAD", path: "a.txt" })).content).toBe("one\ntwo\n");
    expect((await g("grep", { pattern: "new" })).matches).toEqual([{ path: "b.txt", line: 1, text: "new" }]);
    expect((await g("blame", { path: "a.txt", ref: "HEAD" })).lines[0]).toMatchObject({ line: 1, author: "T", text: "one" });
  });
  test("values can't become options", async () => {
    await expect(g("log", { ref: "--output=/tmp/x" })).rejects.toMatchObject({ code: "TOOL_ARGUMENT" });
    await expect(g("diff", { path: "-p" })).rejects.toMatchObject({ code: "TOOL_ARGUMENT" });
  });
  test("commit needs write: true", async () => {
    await expect(g("commit", { message: "x", all: true })).rejects.toThrow(/write: true/);
    const r = await g("commit", { message: "--amend is just text", paths: ["b.txt"] }, { write: true });
    expect(r).toMatchObject({ committed: true, files: ["b.txt"] });
    expect((await g("log", { limit: 1 }))[0].subject).toBe("--amend is just text");
    expect(await g("commit", { message: "empty" }, { write: true })).toEqual({ committed: false, reason: "nothing staged to commit" });
  });
  test("parseStatus", () => {
    expect(parseStatus("## main...origin/main [ahead 2, behind 1]\nR  old.ts -> new.ts\n")).toEqual({
      branch: "main",
      ahead: 2,
      behind: 1,
      clean: false,
      files: [{ path: "new.ts", status: "renamed", staged: true }],
    });
  });
});

describe("WebSearch", () => {
  test("picks the engine whose key is set and normalizes results", async () => {
    const seen: Request[] = [];
    const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
      seen.push(new Request(input as string, init));
      return Response.json({ web: { results: [{ title: "<b>Bun</b>", url: "https://bun.sh", description: "Fast <strong>JS</strong>", age: "2 days" }] } });
    }) as typeof fetch;
    const r = await call("WebSearch", "search", { query: "bun runtime", site: "https://bun.sh/docs", freshness: "week" }, {}, services(fetchImpl, { BRAVE_API_KEY: "k" }));
    expect(r).toEqual({ query: "site:bun.sh bun runtime", engine: "brave", results: [{ title: "Bun", url: "https://bun.sh", snippet: "Fast JS", published: "2 days" }] });
    const url = new URL(seen[0]!.url);
    expect(url.searchParams.get("freshness")).toBe("pw");
    expect(seen[0]!.headers.get("x-subscription-token")).toBe("k");
  });
  test("tavily via engine: and apiKey:", async () => {
    let body: any;
    const fetchImpl = (async (_: unknown, init?: RequestInit) => {
      body = JSON.parse(String(init!.body));
      return Response.json({ results: [{ title: "T", url: "https://x.dev", content: "c" }] });
    }) as typeof fetch;
    const r = await call("WebSearch", "search", { query: "q", limit: 3 }, { engine: "tavily", apiKey: "t" }, services(fetchImpl));
    expect(body).toMatchObject({ query: "q", max_results: 3 });
    expect(r.results).toEqual([{ title: "T", url: "https://x.dev", snippet: "c" }]);
  });
  test("no key is a clear error", async () => {
    await expect(call("WebSearch", "search", { query: "q" })).rejects.toMatchObject({ code: "MISSING_API_KEY" });
    await expect(call("WebSearch", "search", { query: "q" }, { engine: "bing" })).rejects.toMatchObject({ code: "TOOL_CONFIG" });
  });
});

describe("Skills", () => {
  let dir: string;
  beforeAll(() => {
    dir = join(tmp, "skills");
    mkdirSync(join(dir, "house-style", "refs"), { recursive: true });
    writeFileSync(join(dir, "house-style", "SKILL.md"), "---\nname: house-style\ndescription: >\n  Write in our\n  house style.\n---\n# House style\nUse British spelling.\n");
    writeFileSync(join(dir, "house-style", "refs", "words.md"), "colour, favour\n");
    writeFileSync(join(dir, "code-review.md"), "---\nname: code-review\ndescription: Our own review rules.\n---\nOnly check naming.\n");
    writeFileSync(join(dir, "README.md"), "---\nname: readme\n---\nnot a skill\n");
    writeFileSync(join(tmp, "secret.txt"), "secret");
    symlinkSync(join(tmp, "secret.txt"), join(dir, "house-style", "leak.md"));
  });

  test("built-in skills parse with names and descriptions", () => {
    expect(BUILTIN_SKILLS.map((s) => s.name).sort()).toEqual(["bug-triage", "code-review", "data-extraction", "incident-postmortem", "release-notes", "web-research", "write-tests"]);
    for (const s of BUILTIN_SKILLS) {
      expect(s.description.length).toBeGreaterThan(40);
      expect(s.instructions).not.toStartWith("---");
    }
  });
  test("frontmatter: folded blocks and quotes", () => {
    expect(parseFrontmatter('---\nname: "x"\ndescription: >\n  a\n  b\n---\nbody').fields).toEqual({ name: "x", description: "a b" });
  });
  test("folders and single files load; local skills win over built-ins", () => {
    expect(loadSkillDir(dir).map((s) => s.name)).toEqual(["code-review", "house-style"]);
    const catalog = skillCatalog([dir], true);
    expect(catalog.find((s) => s.name === "code-review")!.instructions).toBe("Only check naming.");
    expect(catalog.length).toBe(BUILTIN_SKILLS.length + 1);
    expect(skillCatalog([dir], false)).toHaveLength(2);
  });
  test("list, load and read, confined to the skill's folder", async () => {
    const decl = { 0: dir };
    expect((await call("Skills", "list", {}, decl)).map((s: any) => s.name)).toContain("web-research");
    const loaded = await call("Skills", "load", { name: "House-Style" }, decl);
    expect(loaded).toMatchObject({ name: "house-style", description: "Write in our house style.", files: ["refs/words.md"] });
    expect((await call("Skills", "read", { name: "house-style", path: "refs/words.md" }, decl)).content).toBe("colour, favour\n");
    await expect(call("Skills", "read", { name: "house-style", path: "../code-review.md" }, decl)).rejects.toThrow(/not a path inside/);
    await expect(call("Skills", "read", { name: "house-style", path: "leak.md" }, decl)).rejects.toThrow(/not a path inside/);
    await expect(call("Skills", "load", { name: "nope" }, decl)).rejects.toThrow(/no skill named "nope"/);
    expect(() => readSkillFile(BUILTIN_SKILLS[0]!, "x")).toThrow(/no other files/);
  });
  test("the load method's description carries the catalog", async () => {
    const info = LOCAL_PROVIDER_INFO.Skills!;
    const methods = await (info.methods as Function)({ tool: {}, config: (n: unknown) => (n === 0 ? dir : undefined), signal: new AbortController().signal }, services());
    const load = methods.find((m: any) => m.name === "load");
    expect(load.description).toContain("- house-style: Write in our house style.");
    expect(load.params.properties.name.enum).toContain("bug-triage");
  });
});

describe("agent presets", () => {
  const agentOf = (src: string) => parse(src).agents[0]!;

  test("a preset supplies system, settings and skills; the agent's own win", () => {
    const a = applyPreset(agentOf(`agent R [openai/gpt-4o, preset: CodeReviewer, temp: 0.5, skills: "house-style"]\n  system "Our repo uses Go."`));
    expect(a.system).toStartWith(AGENT_PRESETS.CodeReviewer!.system);
    expect(a.system).toEndWith("Our repo uses Go.");
    expect(a.params.temp).toBe("0.5");
    expect(a.params.skills).toBe("code-review, house-style");
    expect(applyPreset(agentOf(`agent R [openai/gpt-4o, preset: researcher]`)).params).toMatchObject({ max_steps: "20", tools: "auto" });
    expect(() => applyPreset(agentOf(`agent R [openai/gpt-4o, preset: Wizard]`))).toThrow(/unknown preset "Wizard"/);
  });

  test("validate reports an unknown preset; completions offer presets", () => {
    const diags = validate(parse(`agent R [openai/gpt-4o, preset: Wizard]\npipeline P(x: String) -> Result:\n  x |> R.go()`));
    expect(diags.some((d) => d.severity === "error" && /unknown preset "Wizard"/.test(d.message))).toBe(true);
    const items = getCompletions(`agent R [openai/gpt-4o, preset: `, { line: 0, character: 33 });
    expect(items.map((i) => i.label)).toContain("Judge");
  });

  test("the model gets the preset's prompt and its skills; JSON answers are parsed", async () => {
    const seen: MockRequest[] = [];
    const src = `
agent Gate [openai/gpt-4o, preset: Judge]
agent Rev [openai/gpt-4o, preset: CodeReviewer]

pipeline Check(diff: String) -> Result:
  diff
    |> Rev.review() as review
    |> Gate.grade("Is this review specific?", context.data.review) as verdict
    |? (context.data.verdict.pass == true)
`;
    const rt = new HaloRuntime({ env: {}, logger: { log() {}, warn() {} } })
      .load(parse(src))
      .mockAll({
        "Rev.review": (req: MockRequest) => (seen.push(req), '{"verdict":"approve","summary":"fine","findings":[]}'),
        "Gate.grade": (req: MockRequest) => (seen.push(req), '{"pass":true,"score":8,"reasons":[],"fixes":[]}'),
      });
    const r = await rt.run("Check", { diff: "+ let x = 1" });
    expect(r.status).toBe("completed");
    expect(seen[0]!.system).toContain('<skill name="code-review">');
    expect(seen[0]!.system).toContain("# Code review");
    expect(seen[1]!.system).toContain('"pass": boolean');
    expect(r.context.data.review).toMatchObject({ verdict: "approve" });
  });

  test("skills: on a call loads that skill, from an equipped Skills tool's folder", async () => {
    const dir = join(tmp, "call-skills");
    mkdirSync(join(dir, "tone"), { recursive: true });
    writeFileSync(join(dir, "tone", "SKILL.md"), "---\nname: tone\ndescription: Be warm.\n---\nAlways be warm.\n");
    const seen: MockRequest[] = [];
    const src = `
tool Kit : Skills("${dir}")
agent W [openai/gpt-4o, preset: Writer]
  equips Kit

pipeline Draft(topic: String) -> Result:
  topic |> W.write(skills: ["tone", "release-notes"])
`;
    const rt = new HaloRuntime({ env: {}, logger: { log() {}, warn() {} } }).load(parse(src)).mockAll({ "W.write": (req: MockRequest) => (seen.push(req), "ok") });
    await rt.run("Draft", { topic: "v2" });
    expect(seen[0]!.system).toContain("Always be warm.");
    expect(seen[0]!.system).toContain('<skill name="release-notes">');
    expect(seen[0]!.prompt).not.toContain("skills");

    const bad = new HaloRuntime({ env: {}, logger: { log() {}, warn() {} } }).load(parse(src.replace('"tone", ', '"nope", '))).mockAll({ "W.write": "ok" });
    await expect(bad.run("Draft", { topic: "v2" })).rejects.toThrow(/no skill named "nope"/);
  });

  test("an agent with a Skills tool chooses and loads a skill itself", async () => {
    const src = `
tool Kit : Skills("${join(tmp, "none")}")
agent A [openai/gpt-4o]
  equips Kit

pipeline Go(task: String) -> Result:
  task |> A.work(tools: [Kit])
`;
    const asked: MockRequest[] = [];
    const rt = new HaloRuntime({ env: {}, logger: { log() {}, warn() {} } })
      .load(parse(src))
      .mockAll({ "A.work": (req: MockRequest) => (asked.push(structuredClone(req)), req.step === 1 ? useTool("Kit.load", { name: "release-notes" }) : "Notes written.") });
    const r = await rt.run("Go", { task: "write notes" });
    expect(r.output).toBe("Notes written.");
    expect(asked[0]!.tools).toEqual(["Kit.load", "Kit.read", "Kit.list"]);
    expect(JSON.stringify(asked[1]!.messages)).toContain("# Release notes");
  });

  test("the new tools work from a pipeline", async () => {
    const src = `
tool Rows : Data()
tool Math : Calc(precision: 2)
tool Time : Clock(now: "2026-11-05T12:00:00Z")

pipeline Report(orders: Array, limit: Number) -> Result:
  orders
    |> Rows.filter(where: "status == 'paid' && total >= {{limit}}") as paid
    |> Rows.aggregate(data: context.data.paid, field: "total", op: "sum") as sum
    |> Math.eval(expression: "{{context.data.sum}} * 1.2") as gross
    |> Time.add(days: 30) as due
    |> Rows.pick(data: context.data.paid, fields: ["id"])
`;
    expect(validate(parse(src)).filter((d) => d.severity === "error")).toEqual([]);
    const orders = [{ id: 1, status: "paid", total: 50 }, { id: 2, status: "open", total: 80 }, { id: 3, status: "paid", total: 120.5 }];
    const r = await new HaloRuntime({ env: {}, logger: { log() {}, warn() {} } }).load(parse(src)).run("Report", { orders, limit: 60 });
    expect(r.output).toEqual([{ id: 3 }]);
    expect(r.context.data.gross).toEqual({ expression: "120.5 * 1.2", result: 144.6 });
    expect((r.context.data.due as any).date).toBe("2026-12-05");
  });

  test("halo plan counts a preset's max_steps and tools", () => {
    const ast = parse(`
tool Web : WebSearch()
agent R [openai/gpt-4o, preset: Researcher]
  equips Web

pipeline Ask(q: String) -> Result:
  q |> R.research()
`);
    const p = plan(ast, "Ask", { providerInfo: (name) => LOCAL_PROVIDER_INFO[name] });
    const text = JSON.stringify(p);
    expect(text).toContain("Web.search");
  });
});
