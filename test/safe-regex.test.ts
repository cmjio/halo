import { test, expect, describe, afterAll } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "../src/parser/index";
import { validate } from "../src/parser/validate";
import { PolicyEngine, type PolicyHooks } from "../src/runtime/policies";
import { HaloRuntime, useTool, type MockRequest } from "../src/runtime/runtime";
import { constrain } from "../src/runtime/tool-rules";
import { LOCAL_PROVIDERS } from "../src/runtime/providers/index";
import type { ToolCall, ToolServices } from "../src/runtime/tools";
import { canBacktrackBadly, FALLBACK_MS, safeRegex } from "../src/runtime/safe-regex";

const tmp = mkdtempSync(join(tmpdir(), "halo-safe-regex-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

/** Text that makes a backtracking engine take seconds or more on ^(?!(\w+\s?)+$). */
const EVIL = `echo ${"a".repeat(40)}; touch pwned`;
const ALLOW_WORDS = String.raw`^(?!(\w+\s?)+$)`;

const timed = <T>(f: () => T): [T, number] => {
  const t0 = performance.now();
  const r = f();
  return [r, performance.now() - t0];
};

function engine(policy: string) {
  const ast = parse(`policy G : ${policy}\nagent A [openai/gpt-4o] requires G\npipeline P(x: String) -> Result:\n  x |> A.go()`);
  expect(ast.errors).toEqual([]);
  const violations: string[] = [];
  const hooks: PolicyHooks = { spent: () => 0, onViolation: (v) => violations.push(v.message) };
  return { engine: new PolicyEngine(new Map(ast.policies.map((p) => [p.name, p]))), agent: ast.agents[0]!, hooks, violations };
}

describe("safeRegex", () => {
  test("search and whole-value modes, with JavaScript's meaning for . and \\s", () => {
    expect(safeRegex(String.raw`rm\s+-rf`, { ignoreCase: true }).test("RM -rf /")).toBe(true);
    expect(safeRegex("a.b").test("a\rb")).toBe(false);
    expect(safeRegex("a.b", { dotAll: true }).test("a\rb")).toBe(true);
    expect(safeRegex(String.raw`\d+`, { whole: true }).test("1; drop")).toBe(false);
    expect(safeRegex(String.raw`\d+`, { whole: true }).test("12")).toBe(true);
    expect(safeRegex(String.raw`(?<year>\d{4})-\d\d`).test("on 2024-01")).toBe(true);
    expect(safeRegex(String.raw`(?<=\$)\d+`).test("cost $40")).toBe(true);
    expect(safeRegex(String.raw`\p{L}+`, { whole: true }).test("héllo")).toBe(true);
    expect(safeRegex("(?i)abc").test("ABC")).toBe(true);
  });

  test("leading lookaheads run on RE2, as separate anchored checks", () => {
    const allow = safeRegex(ALLOW_WORDS, { ignoreCase: true });
    expect(allow.engine).toBe("re2");
    expect(allow.test("echo hi")).toBe(false);
    expect(allow.test("echo hi; touch pwned")).toBe(true);
    const [hit, ms] = timed(() => allow.test(EVIL));
    expect(hit).toBe(true);
    expect(ms).toBeLessThan(100);
    const notAdmin = safeRegex(String.raw`(?!admin)\w+`, { whole: true });
    expect(notAdmin.engine).toBe("re2");
    expect(notAdmin.test("admin2")).toBe(false);
    expect(notAdmin.test("bob")).toBe(true);
    // A top-level | leaves the lookahead on one branch: that isn't split, and runs bounded.
    const branch = safeRegex("^(?!a)b|c");
    expect(branch.engine).toBe("bounded");
    expect(branch.test("c")).toBe(true);
  });

  test("a pattern RE2 can't run is bounded, and undecided when it runs out of time", () => {
    const backref = safeRegex(String.raw`(a)\1`);
    expect(backref.engine).toBe("bounded");
    expect(backref.test("xaay")).toBe(true);
    expect(backref.test("xay")).toBe(false);
    const [r, ms] = timed(() => safeRegex(String.raw`^(a+)+\1$`).test(`${"a".repeat(32)}!`));
    expect(r).toBeUndefined();
    expect(ms).toBeLessThan(FALLBACK_MS + 500);
  });

  test("compiled once per pattern and options", () => {
    expect(safeRegex("abc")).toBe(safeRegex("abc"));
    expect(safeRegex("abc", { ignoreCase: true })).not.toBe(safeRegex("abc"));
  });

  test("an invalid pattern throws", () => {
    expect(() => safeRegex("(")).toThrow();
    expect(() => safeRegex("[")).toThrow();
  });

  test("canBacktrackBadly spots nested repeats", () => {
    for (const s of ["(a+)+", String.raw`(\w+\s?)+$`, "(a|ab)+", "((ab)+)+"]) expect(canBacktrackBadly(s)).toBe(true);
    for (const s of ["(abc)+", "a+b+", "[(a+)]+", String.raw`\d+(\.\d\d)?`]) expect(canBacktrackBadly(s)).toBe(false);
  });
});

describe("DenyArgs fails closed and doesn't stall", () => {
  test("the allow-list pattern that used to fail open now refuses, fast", () => {
    const { engine: e, agent, hooks, violations } = engine(`DenyArgs("Sh.run", "command", "${ALLOW_WORDS.replaceAll("\\", "\\\\")}")`);
    expect(e.checkToolCall(agent, "Sh.run", "external", { command: "echo hi" }, hooks)).toBe("allow");
    expect(() => e.checkToolCall(agent, "Sh.run", "external", { command: "echo hi; touch pwned" }, hooks)).toThrow("refused");
    const [threw, ms] = timed(() => {
      try {
        e.checkToolCall(agent, "Sh.run", "external", { command: EVIL }, hooks);
        return false;
      } catch {
        return true;
      }
    });
    expect(threw).toBe(true);
    expect(ms).toBeLessThan(500);
    expect(violations.at(-1)).toContain("matches");
  });

  test("a bounded pattern that runs out of time refuses the call", () => {
    const { engine: e, agent, hooks, violations } = engine(String.raw`DenyArgs("Sh.run", "command", "^(a+)+\\1$")`);
    const [, ms] = timed(() => expect(() => e.checkToolCall(agent, "Sh.run", "external", { command: `${"a".repeat(32)}!` }, hooks)).toThrow("refused"));
    expect(ms).toBeLessThan(FALLBACK_MS + 1000);
    expect(violations.at(-1)).toContain("could not be checked");
  });

  test("end to end: the shell command doesn't run", async () => {
    const ws = mkdtempSync(join(tmp, "ws-"));
    const seen: MockRequest[] = [];
    const mock = (req: MockRequest) => (seen.push(structuredClone(req)), (req.step ?? 1) === 1 ? [useTool("Sh.run", { command: EVIL.replace("pwned", join(ws, "pwned")) })] : "ok");
    const ast = parse(
      `policy G : DenyArgs("Sh.run", "command", "${ALLOW_WORDS.replaceAll("\\", "\\\\")}")
       tool Sh : Bash(cwd: "${ws}")
       agent A [openai/gpt-4o] equips Sh requires G
       pipeline P(x: String) -> Result:
         x |> A.go(tools: [Sh])`,
    );
    expect(ast.errors).toEqual([]);
    const rt = new HaloRuntime({ env: {}, vectorPath: ":memory:", checkpointDir: tmp, logger: { log() {}, warn() {} } }).load(ast).mockAll({ "A.go": mock });
    const t0 = performance.now();
    await rt.run("P", { x: "hi" });
    expect(performance.now() - t0).toBeLessThan(2000);
    expect(existsSync(join(ws, "pwned"))).toBe(false);
    expect(String(seen[1]!.messages!.at(-1)!.content)).toMatch(/^Refused by policy "G"/);
  });
});

describe("MatchRegex and Match don't stall, and count undecided as a violation", () => {
  test("MatchRegex with a nested repeat checks an output in linear time", () => {
    const { engine: e, agent, hooks } = engine(String.raw`MatchRegex("^(\\w+\\s?)+$")`);
    const [, ms] = timed(() => expect(() => e.checkOutput(agent, EVIL, hooks)).toThrow("does not match"));
    expect(ms).toBeLessThan(500);
    expect(e.checkOutput(agent, "all good words", hooks)).toBe("all good words");
  });

  test("MatchRegex on the bounded engine: out of time is a violation", () => {
    const { engine: e, agent, hooks } = engine(String.raw`MatchRegex("^(a+)+\\1$")`);
    expect(() => e.checkOutput(agent, `${"a".repeat(32)}!`, hooks)).toThrow("could not be checked");
  });

  test("Match on a tool", () => {
    const ast = parse(String.raw`tool T : POST("a.example.com") & Match("name", "(\\w+\\s?)+")`);
    expect(ast.errors).toEqual([]);
    const tool = ast.tools[0]!;
    const resolve = (v: any) => v.value;
    const [, ms] = timed(() => expect(() => constrain(tool, "get", { name: EVIL }, true, resolve)).toThrow("must match"));
    expect(ms).toBeLessThan(500);
    expect(constrain(tool, "get", { name: "plain words" }, true, resolve)).toEqual({ name: "plain words" });
  });
});

describe("Data.filter matches", () => {
  const services = { fetch: () => Promise.reject(new Error("no network")), env: {}, vectors: () => undefined, sql: () => undefined } as unknown as ToolServices;
  const call = (named: Record<string, unknown>): Promise<unknown> =>
    LOCAL_PROVIDERS.Data!(
      { tool: { name: "T", provider: "Data", args: [], namedArgs: {}, argList: [] }, method: "filter", positional: [], implicitInput: false, named, config: () => undefined, viaAgent: true, signal: new AbortController().signal } as unknown as ToolCall,
      services,
    ) as Promise<unknown>;

  test("a nested-repeat pattern over many rows is fast and drops nothing it shouldn't", async () => {
    const rows = Array.from({ length: 200 }, (_, i) => ({ name: i % 2 ? EVIL : "plain words" }));
    const t0 = performance.now();
    const kept = (await call({ data: rows, where: { name: { matches: String.raw`^(\w+\s?)+$` } } })) as unknown[];
    expect(performance.now() - t0).toBeLessThan(1000);
    expect(kept).toHaveLength(100);
  });

  test("a row the pattern can't be decided on is an error, not a dropped row", async () => {
    await expect(call({ data: [{ name: `${"a".repeat(32)}!` }], where: { name: { matches: String.raw`^(a+)+\1$` } } })).rejects.toThrow("took too long");
  });
});
describe("halo validate", () => {
  const diags = (src: string) => validate(parse(src));

  test("a DenyArgs pattern that can backtrack badly on the bounded engine is an error; RE2 ones are fine", () => {
    const base = `tool Sh : Bash()\nagent A [openai/gpt-4o] equips Sh requires G\npipeline P(x: String) -> Result:\n  x |> A.go()\n`;
    const d = diags(`policy G : DenyArgs("Sh.run", "command", "^(a+)+\\\\1$")\n${base}`);
    expect(d.filter((x) => x.severity === "error").map((x) => x.message).join("\n")).toContain("can take exponential time");
    const ok = diags(`policy G : DenyArgs("Sh.run", "command", "${ALLOW_WORDS.replaceAll("\\", "\\\\")}")\n${base}`);
    expect(ok.filter((x) => /regular expression|exponential|JavaScript's engine/.test(x.message))).toEqual([]);
    const warn = diags(`policy G : DenyArgs("Sh.run", "command", "rm(?!x)")\n${base}`);
    expect(warn.find((x) => x.severity === "warning" && x.message.includes("runs on JavaScript's engine"))).toBeDefined();
  });

  test("validate uses the runtime's flags and engine: (?i) and \\p{L} are valid", () => {
    const d = diags(`policy G : MatchRegex("(?i)^\\\\p{L}+$")\nagent A [openai/gpt-4o] requires G\npipeline P(x: String) -> Result:\n  x |> A.go()\n`);
    expect(d.filter((x) => x.message.includes("regular expression"))).toEqual([]);
  });
});
