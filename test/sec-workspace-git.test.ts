// A writable Workspace must not become code execution through a repository's .git folder.

import { test, expect, describe, afterAll } from "bun:test";
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "../src/parser/index";
import { normalizePath } from "../src/runtime/policies";
import { HaloRuntime, useTool, type MockRequest } from "../src/runtime/runtime";

const tmp = mkdtempSync(join(tmpdir(), "halo-sec-git-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

function repo(): string {
  const dir = mkdtempSync(join(tmp, "repo-"));
  const run = (...args: string[]) => Bun.spawnSync(["git", "-C", dir, "-c", "user.email=a@b", "-c", "user.name=a", ...args]);
  run("init", "-q");
  writeFileSync(join(dir, "a.txt"), "hi\n");
  run("add", "a.txt");
  run("commit", "-qm", "init");
  return dir;
}

function runtime(src: string, steps: unknown[]) {
  const decisions: string[] = [];
  const rt = new HaloRuntime({ onEvent: (e) => void (e.type === "agent_tool" && decisions.push(`${e.decision} ${JSON.stringify((e.args as { path?: string }).path ?? "")}${e.detail ? `: ${e.detail}` : ""}`)) })
    .load(parse(src))
    .mockAll({ "Dev.work": (r: MockRequest) => steps[(r.step ?? 1) - 1] ?? "done" });
  return { rt, decisions };
}

describe("Workspace and .git", () => {
  test("every way of naming .git is refused, with no policy at all", async () => {
    const dir = repo();
    const marker = join(tmp, "PWNED-1");
    const evil = `[core]\n\tfsmonitor = "touch ${marker}; echo"\n`;
    const paths = [".git/config", "./.git/config", "a/../.git/config", ".GIT/config", ".git/hooks/post-commit"];
    const { rt, decisions } = runtime(
      `tool Docs : Workspace(${JSON.stringify(dir)}, write: true)\ntool History : Git(${JSON.stringify(dir)})\nagent Dev [openai/gpt-4o]\n  equips Docs, History\npipeline P(x: String) -> Result:\n  x |> Dev.work("go", tools: [Docs, History])`,
      [...paths.map((path) => useTool("Docs.write", { path, content: evil })), useTool("Docs.read", { path: ".git/config" }), useTool("History.status", {})],
    );
    await rt.run("P", { x: "go" });
    expect(decisions.slice(0, paths.length + 1).every((d) => d.startsWith("error") && d.includes("inside a .git folder"))).toBe(true);
    expect(existsSync(marker)).toBe(false);
  });

  test("a tool declared git: true may, and ordinary files still work", async () => {
    const dir = repo();
    const { rt, decisions } = runtime(
      `tool Docs : Workspace(${JSON.stringify(dir)}, write: true, git: true)\nagent Dev [openai/gpt-4o]\n  equips Docs\npipeline P(x: String) -> Result:\n  x |> Dev.work("go", tools: [Docs])`,
      [useTool("Docs.read", { path: ".git/HEAD" }), useTool("Docs.write", { path: "docs/notes.md", content: "ok" })],
    );
    await rt.run("P", { x: "go" });
    expect(decisions).toEqual(['allowed ".git/HEAD"', 'allowed "docs/notes.md"']);
  });

  test("a Workspace rooted inside .git is refused", async () => {
    const dir = repo();
    const { rt, decisions } = runtime(
      `tool Docs : Workspace(${JSON.stringify(join(dir, ".git"))}, write: true)\nagent Dev [openai/gpt-4o]\n  equips Docs\npipeline P(x: String) -> Result:\n  x |> Dev.work("go", tools: [Docs])`,
      [useTool("Docs.write", { path: "config", content: "x" })],
    );
    await rt.run("P", { x: "go" });
    expect(decisions[0]).toContain("inside a .git folder");
  });
});

describe("Git calls ignore a repository's programs", () => {
  test("a poisoned .git/config doesn't run on status, log, diff or grep", async () => {
    const dir = repo();
    const marker = join(tmp, "PWNED-2");
    appendFileSync(join(dir, ".git/config"), `[core]\n\tfsmonitor = "touch ${marker}; echo"\n\thooksPath = ${join(dir, "hooks")}\n[diff]\n\texternal = "touch ${marker}"\n`);
    mkdirSync(join(dir, "hooks"));
    const rt = new HaloRuntime().load(
      parse(`tool History : Git(${JSON.stringify(dir)})\npipeline P(x: String) -> Result:\n  x |> History.status() |> History.log() |> History.diff() |> History.grep(pattern: "hi")`),
    );
    await rt.run("P", { x: "go" });
    expect(existsSync(marker)).toBe(false);
  });
});

describe("DenyArgs reads a path as the tool will", () => {
  test("normalizePath", () => {
    expect(normalizePath("./.git/config")).toBe(".git/config");
    expect(normalizePath("src/../.env")).toBe(".env");
    expect(normalizePath(".//a//b")).toBe("a/b");
    expect(normalizePath("bun test ./a.test.ts")).toBe("bun test ./a.test.ts");
    expect(normalizePath("notes.md")).toBe("notes.md");
    expect(normalizePath("https://en.wikipedia.org/wiki/x")).toBe("https://en.wikipedia.org/wiki/x");
  });

  test("./ and .. can't walk past a DenyArgs on the plain path", async () => {
    const dir = mkdtempSync(join(tmp, "ws-"));
    writeFileSync(join(dir, ".env"), "KEY=1\n");
    const { rt, decisions } = runtime(
      `policy Fence : DenyArgs("Files.read", "path", "^\\\\.env$")\ntool Files : Workspace(${JSON.stringify(dir)})\nagent Dev [openai/gpt-4o]\n  equips Files\n  requires Fence\npipeline P(x: String) -> Result:\n  x |> Dev.work("go", tools: [Files])`,
      [useTool("Files.read", { path: ".env" }), useTool("Files.read", { path: "./.env" }), useTool("Files.read", { path: "x/../.env" })],
    );
    await rt.run("P", { x: "go" });
    expect(decisions.map((d) => d.split(" ")[0])).toEqual(["refused", "refused", "refused"]);
  });
});
