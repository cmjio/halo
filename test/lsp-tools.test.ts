import { test, expect } from "bun:test";
import { getCompletions } from "../src/lsp/completions.ts";
import { getHover } from "../src/lsp/hover.ts";
import { getDiagnostics } from "../src/lsp/diagnostics.ts";
import { callAt, getSignatureHelp } from "../src/lsp/tools.ts";
import { TOOL_PROVIDERS } from "../src/parser/builtins.ts";

const HEAD = `tool Code  : Workspace("{{workdir}}/{{component}}", write: true)
tool Docs : Workspace("./docs")
agent Fixer [anthropic/claude-haiku-4-5]

pipeline Fix(workdir: String, component: String) -> Result:
  component
    |> Fixer.review("Look")
    |> `;
const LAST = HEAD.split("\n").length - 1;
const at = (src: string) => ({ line: src.split("\n").length - 1, character: src.split("\n").at(-1)!.length });

test("a tool's methods: arguments, effect, read ones first, required arguments as tab stops", () => {
  const src = HEAD + "Code.";
  const items = getCompletions(src, at(src));
  expect(items.map((c) => c.label)).toEqual(["read", "write", "edit", "list", "glob", "search", "delete", "mkdir"]);
  const sorted = [...items].sort((a, b) => a.sortText!.localeCompare(b.sortText!)).map((c) => c.label);
  expect(sorted).toEqual(["read", "list", "glob", "search", "write", "edit", "delete", "mkdir"]);
  const edit = items.find((c) => c.label === "edit")!;
  expect(edit.labelDetails).toEqual({ detail: "(path, old, new, all?)", description: "writes" });
  expect(edit.insertText).toBe("edit(path: $1, old: $2, new: $3)");
  expect(JSON.stringify(edit.documentation)).toContain("{{workdir}}/{{component}}");
  // A call that already has its parentheses gets just the name.
  expect(getCompletions(src + "x(1)", at(src)).find((c) => c.label === "edit")!.insertText).toBe("edit");
});

test("writing methods on a Workspace without write: true are marked and sorted last", () => {
  const src = HEAD + "Docs.";
  const items = getCompletions(src, at(src));
  expect(items.find((c) => c.label === "write")!.labelDetails!.description).toBe("needs write: true");
  expect(items.find((c) => c.label === "read")!.labelDetails!.description).toBe("read");
});

test("an agent offers prompt and the method names already used on it", () => {
  const src = HEAD + "Fixer.";
  expect(getCompletions(src, at(src)).map((c) => c.label)).toEqual(["prompt", "review"]);
});

test("every built-in provider with a fixed set of methods lists them", () => {
  for (const p of TOOL_PROVIDERS) {
    const src = `tool T : ${p}("x")\n\npipeline P(a: String) -> Result:\n  a\n    |> T.`;
    const items = getCompletions(src, at(src));
    if (p === "MCP" || p === "Skills") expect(items).toEqual([]); // listed by the server / skills folder at run time
    else expect(items.length).toBeGreaterThan(0);
  }
});

test("inside the call: the arguments not given yet, and the signature", () => {
  const src = HEAD + 'Code.edit(path: "a.ts", ';
  expect(getCompletions(src, at(src)).map((c) => c.label)).toEqual(["old:", "new:", "all:"]);
  const help = getSignatureHelp(src, at(src))!;
  expect(help.signatures[0]!.label).toBe("Code.edit(path: string, old: string, new: string, all?: boolean)");
  expect(help.activeParameter).toBe(1);
  // A named argument picks its own parameter, wherever it is.
  expect(getSignatureHelp(HEAD + "Code.edit(all: ", at(HEAD + "Code.edit(all: "))!.activeParameter).toBe(3);
  expect(callAt('Code.edit(path: "a, b", old: f(1, 2), ')).toEqual({ callee: "Code", method: "edit", index: 2, named: ["path", "old"], current: undefined });
});

test("hover on a method, and a tool's methods on its name", () => {
  const src = HEAD + 'Code.edit(path: "a", old: "x", new: "y")';
  const method = JSON.stringify(getHover(src, { line: LAST, character: 13 }));
  expect(method).toContain("Code.edit(path: string, old: string, new: string, all?: boolean)");
  expect(method).toContain("Replace exact text");
  const tool = JSON.stringify(getHover(src, { line: 0, character: 6 }));
  expect(tool).toContain("mkdir(path)");
});

test("a method the provider doesn't have, and a write on a read-only Workspace, are errors", () => {
  const src = HEAD + 'Code.serch(pattern: "x")\n    |> Docs.write(path: "b", content: "c")\n    |> Code.read(path: "ok")';
  const diags = getDiagnostics(src).map((d) => [d.range.start, d.message]);
  expect(diags).toEqual([
    [{ line: LAST, character: 12 }, 'Workspace has no method "serch" (did you mean search?). Code has: read, write, edit, list, glob, search, delete, mkdir'],
    [{ line: LAST + 1, character: 12 }, "Docs is declared without write: true, so write is refused; add write: true to its declaration"],
  ]);
});

test("names inside strings and deeper members aren't completed", () => {
  expect(getCompletions('policy P : AllowTools("Code.', { line: 0, character: 28 })).toEqual([]);
  const src = HEAD + "context.data.";
  expect(getCompletions(src, at(src))).toEqual([]);
});
