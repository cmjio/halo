import { test, expect, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { declarations, getDocumentHighlights, getDocumentSymbols, getReferences, getRename, identifiers, prepareRename } from "../src/lsp/symbols.ts";
import { getCompletions } from "../src/lsp/completions.ts";
import { getHover } from "../src/lsp/hover.ts";
import { getDiagnostics } from "../src/lsp/diagnostics.ts";

const SHARED = `agent Writer [anthropic/claude-haiku-4-5]
  system "You write. Writer is your name."
`;
const MAIN = `use "./shared.halo" { Writer }

schema Reply {
  text: String, score: Number
}

// Writer drafts, then polishes
pipeline Main(input: String) -> Result:
  input
    |> Writer.prompt("Hi {{input}}") as draft
    |> Writer.prompt("Polish {{draft}}")
`;
const ALIASED = `use "./shared.halo" { Writer as Pen }

pipeline Other(input: String) -> Result:
  input
    |> Pen.prompt("Hi")
`;

let dir: string;
const file = (name: string) => join(dir, name);
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "halo-lsp-"));
  writeFileSync(file("halo.json"), "{}");
  writeFileSync(file("shared.halo"), SHARED);
  writeFileSync(file("main.halo"), MAIN);
  writeFileSync(file("other.halo"), ALIASED);
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const where = (locs: Array<{ uri: string; range: { start: { line: number; character: number } } }>) =>
  locs.map((l) => `${l.uri.split("/").pop()}:${l.range.start.line}:${l.range.start.character}`).sort();

test("identifiers skip strings, comments and member names", () => {
  const names = identifiers(MAIN).map((t) => t.name);
  expect(names.filter((n) => n === "Writer")).toHaveLength(3); // the use line and two calls, not the comment
  expect(names).not.toContain("Hi");
  expect(names).not.toContain("prompt");
  expect(identifiers(`agent A [m]\n  system """\n  A is here\n  """\nagent B [m]`).map((t) => t.name)).toEqual(["agent", "A", "m", "system", "agent", "B", "m"]);
});

test("the outline lists declarations, with schema fields", () => {
  expect(getDocumentSymbols(MAIN).map((s) => [s.name, s.detail, s.children?.map((c) => c.name)])).toEqual([
    ["Reply", "schema", ["text", "score"]],
    ["Main", "pipeline", []],
  ]);
  const [main] = declarations(MAIN).filter((d) => d.kind === "pipeline");
  expect(main!.range.end.line).toBe(10);
});

test("references follow use lines into the declaring file and every importer", () => {
  const refs = getReferences(MAIN, { line: 9, character: 8 }, file("main.halo"), new Map());
  expect(where(refs)).toEqual(["main.halo:0:22", "main.halo:10:7", "main.halo:9:7", "other.halo:0:22", "other.halo:0:32", "other.halo:4:7", "shared.halo:0:6"]);
  const fromDecl = getReferences(SHARED, { line: 0, character: 7 }, file("shared.halo"), new Map(), false);
  expect(where(fromDecl)).not.toContain("shared.halo:0:6");
  expect(fromDecl).toHaveLength(6);
});

test("rename changes the declaration and its importers, but not an alias", () => {
  const edit = getRename(MAIN, { line: 9, character: 8 }, "Author", file("main.halo"), new Map())!;
  const changed = Object.fromEntries(Object.entries(edit.changes!).map(([uri, edits]) => [uri.split("/").pop(), edits.map((e) => `${e.range.start.line}:${e.range.start.character}`)]));
  expect(changed).toEqual({ "shared.halo": ["0:6"], "main.halo": ["0:22", "9:7", "10:7"], "other.halo": ["0:22"] });
  // Renaming the alias renames only the alias, in its own file.
  const alias = getRename(ALIASED, { line: 4, character: 8 }, "Quill", file("other.halo"), new Map())!;
  expect(Object.keys(alias.changes!)).toEqual([pathToFileURL(file("other.halo")).href]);
  expect(alias.changes![pathToFileURL(file("other.halo")).href]!.map((e) => e.range.start)).toEqual([{ line: 0, character: 32 }, { line: 4, character: 7 }]);
  expect(getRename(MAIN, { line: 9, character: 8 }, "not valid", file("main.halo"), new Map())).toBeNull();
  expect(prepareRename(MAIN, { line: 8, character: 3 })).toBeNull(); // `input` isn't a declaration
});

test("highlights mark the other uses of a declared name", () => {
  expect(getDocumentHighlights(MAIN, { line: 10, character: 9 })).toHaveLength(3);
  expect(getDocumentHighlights(MAIN, { line: 2, character: 0 })).toEqual([]); // the keyword `schema`
});

test("completion offers declaration templates, context fields and agent methods", () => {
  const atStart = getCompletions("", { line: 0, character: 0 });
  expect(atStart.find((c) => c.label === "agent …")?.insertText).toContain("${1:Name}");
  expect(getCompletions("x\n  context.", { line: 1, character: 10 }).map((c) => c.label)).toEqual(["current", "input", "data", "meta", "thread"]);
  const src = "agent Bot [anthropic/claude-haiku-4-5]\n  Bot.";
  expect(getCompletions(src, { line: 1, character: 6 }).map((c) => c.label)).toEqual(["prompt"]);
  expect(getCompletions('policy P : AllowTools("Repo.', { line: 0, character: 28 })).toEqual([]);
});

test("hover explains keywords", () => {
  const hover = getHover(MAIN, { line: 7, character: 3 });
  expect(JSON.stringify(hover)).toContain("(keyword)");
});

test("a diagnostic about a name sits under that name", () => {
  const broken = MAIN.replace('|> Writer.prompt("Polish', '|> Writrr.prompt("Polish');
  const d = getDiagnostics(broken, file("main.halo")).find((x) => x.message.includes("Writrr"))!;
  expect(d.range.start).toEqual({ line: 10, character: 7 });
});

test("halo lsp answers over stdio", async () => {
  const proc = Bun.spawn(["bun", join(import.meta.dir, "..", "index.ts"), "lsp", "--stdio"], { stdin: "pipe", stdout: "pipe", stderr: "ignore" });
  const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { processId: null, rootUri: null, capabilities: {} } });
  proc.stdin.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
  proc.stdin.flush();
  let out = "";
  for await (const chunk of proc.stdout) {
    out += new TextDecoder().decode(chunk);
    if (out.includes("renameProvider")) break;
  }
  proc.kill();
  expect(out).toContain('"referencesProvider":true');
  expect(out).toContain('"documentSymbolProvider":true');
}, 20000);
