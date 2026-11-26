import { SymbolKind, type DocumentHighlight, type DocumentSymbol, type Location, type Position, type Range, type TextEdit, type WorkspaceEdit } from "vscode-languageserver";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { projectRoot } from "../linker/node.js";
import { getDefinition } from "./definition.js";

export type DeclKind = "agent" | "pipeline" | "tool" | "store" | "policy" | "schema";

export interface Token {
  name: string;
  line: number;
  character: number;
}

export interface Declaration {
  name: string;
  kind: DeclKind;
  /** The name itself. */
  selection: Range;
  /** The declaration, up to the line before the next one. */
  range: Range;
  /** Schema fields, as children in the outline. */
  fields: Array<{ name: string; type: string; range: Range }>;
}

const DECL = /^(\s*)(agent|pipeline|tool|store|policy|schema)\s+([A-Za-z_]\w*)/;

/**
 * Every identifier outside comments and strings, with its position. Member names after a `.`
 * (`System.log`, `context.data.x`) are left out: they never name a declaration.
 */
export function identifiers(text: string): Token[] {
  const out: Token[] = [];
  let line = 0, col = 0;
  for (let i = 0; i < text.length; ) {
    const c = text[i]!;
    if (c === "\n") { line++; col = 0; i++; continue; }
    if (c === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") { i++; col++; }
      continue;
    }
    if (c === '"' || c === "'") {
      const triple = text.startsWith(c.repeat(3), i);
      const close = triple ? c.repeat(3) : c;
      i += close.length; col += close.length;
      while (i < text.length && !text.startsWith(close, i)) {
        if (text[i] === "\\") { i++; col++; }
        if (text[i] === "\n") {
          if (!triple) break;
          line++; col = 0; i++; continue;
        }
        i++; col++;
      }
      if (text.startsWith(close, i)) { i += close.length; col += close.length; }
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < text.length && /\w/.test(text[j]!)) j++;
      if (text[i - 1] !== ".") out.push({ name: text.slice(i, j), line, character: col });
      col += j - i; i = j;
      continue;
    }
    i++; col++;
  }
  return out;
}

/** The top-level declarations of a file, read from the text so a half-typed file still has an outline. */
export function declarations(text: string): Declaration[] {
  const lines = text.split("\n");
  const found: Declaration[] = [];
  lines.forEach((l, n) => {
    const m = DECL.exec(l);
    if (!m || m[1]!.length) return;
    const start = m[0].length - m[3]!.length;
    found.push({
      name: m[3]!,
      kind: m[2] as DeclKind,
      selection: { start: { line: n, character: start }, end: { line: n, character: start + m[3]!.length } },
      range: { start: { line: n, character: 0 }, end: { line: n, character: l.length } },
      fields: [],
    });
  });
  found.forEach((d, i) => {
    let last = (found[i + 1]?.range.start.line ?? lines.length) - 1;
    while (last > d.range.start.line && !(lines[last] ?? "").trim()) last--;
    d.range.end = { line: last, character: (lines[last] ?? "").length };
    if (d.kind !== "schema") return;
    for (let n = d.range.start.line; n <= last; n++) {
      const body = n === d.range.start.line ? (lines[n] ?? "").slice((lines[n] ?? "").indexOf("{") + 1) : lines[n] ?? "";
      const offset = (lines[n] ?? "").length - body.length;
      for (const f of body.matchAll(/([A-Za-z_]\w*)\s*:\s*([\w<>\[\], ]+?)\s*(?=[,}]|$)/g)) {
        const at = offset + f.index!;
        d.fields.push({ name: f[1]!, type: f[2]!.trim(), range: { start: { line: n, character: at }, end: { line: n, character: at + f[1]!.length } } });
      }
    }
  });
  return found;
}

const SYMBOL_KINDS: Record<DeclKind, SymbolKind> = {
  agent: SymbolKind.Class,
  pipeline: SymbolKind.Function,
  tool: SymbolKind.Interface,
  store: SymbolKind.Interface,
  policy: SymbolKind.Constant,
  schema: SymbolKind.Struct,
};

/** The outline: agents, pipelines, tools, stores, policies and schemas (with their fields). */
export function getDocumentSymbols(text: string): DocumentSymbol[] {
  return declarations(text).map((d) => ({
    name: d.name,
    detail: d.kind,
    kind: SYMBOL_KINDS[d.kind],
    range: d.range,
    selectionRange: d.selection,
    children: d.fields.map((f) => ({ name: f.name, detail: f.type, kind: SymbolKind.Field, range: f.range, selectionRange: f.range })),
  }));
}

/** Names the file imports, by local name: `use "./x.halo" { A, B as C }` gives A→A and C→B. */
function imports(text: string): Array<{ source: string; name: string; local: string; at: Token }> {
  const out: Array<{ source: string; name: string; local: string; at: Token }> = [];
  const lines = text.split("\n");
  lines.forEach((l, n) => {
    const m = /^\s*use\s+(["'])([^"']+)\1\s*\{([^}]*)\}?/.exec(l);
    if (!m) return;
    const open = l.indexOf("{");
    for (const item of m[3]!.matchAll(/([A-Za-z_]\w*)(?:\s+as\s+([A-Za-z_]\w*))?/g)) {
      const local = item[2] ?? item[1]!;
      const character = open + 1 + item.index! + (item[2] ? item[0].lastIndexOf(item[2]) : 0);
      out.push({ source: m[2]!, name: item[1]!, local, at: { name: local, line: n, character } });
    }
  });
  return out;
}

function wordAt(text: string, position: Position): Token | undefined {
  return identifiers(text).find((t) => t.line === position.line && position.character >= t.character && position.character <= t.character + t.name.length);
}

const rangeOf = (t: Token): Range => ({ start: { line: t.line, character: t.character }, end: { line: t.line, character: t.character + t.name.length } });

/** Every place `name` is used in a file, as a whole identifier outside strings and comments. */
function uses(text: string, name: string): Token[] {
  return identifiers(text).filter((t) => t.name === name);
}

/** Every use of the name under the cursor in this file, for highlighting its other occurrences. */
export function getDocumentHighlights(text: string, position: Position): DocumentHighlight[] {
  const word = wordAt(text, position);
  if (!word) return [];
  const known = declarations(text).some((d) => d.name === word.name) || imports(text).some((i) => i.local === word.name);
  if (!known) return [];
  return uses(text, word.name).map((t) => ({ range: rangeOf(t) }));
}

/** The .halo files of the project (halo.json's folder, or the file's own), skipping node_modules and dot folders. */
function projectFiles(path: string, limit = 2000): string[] {
  const root = projectRoot(path);
  const out: string[] = [];
  const walk = (dir: string) => {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (out.length >= limit) return;
      if (e.name.startsWith(".") || e.name === "node_modules" || e.name === "dist") continue;
      const full = join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith(".halo")) out.push(full);
    }
  };
  walk(root);
  return out;
}

interface Origin { file: string; name: string }

/** Where the name under the cursor is declared: this file, or the file it's imported from. */
function originOf(text: string, position: Position, path: string, overrides: Map<string, string>): Origin | undefined {
  const word = wordAt(text, position);
  if (!word) return undefined;
  const file = resolve(path);
  if (declarations(text).some((d) => d.name === word.name)) return { file, name: word.name };
  const imported = imports(text).find((i) => i.local === word.name || (i.name === word.name && i.at.line === word.line));
  if (!imported) return undefined;
  const def = getDefinition(text, { line: imported.at.line, character: imported.at.character }, file, overrides);
  if (!def || !def.uri.startsWith("file:")) return undefined;
  const target = fileURLToPath(def.uri);
  if (!target.endsWith(".halo")) return undefined;
  return { file: target, name: imported.name };
}

/** Each place the origin is used: in its own file, and in every project file that imports it (under its local name). */
function occurrences(origin: Origin, path: string, overrides: Map<string, string>, renaming = false): Map<string, Token[]> {
  const read = (f: string) => overrides.get(f) ?? (() => { try { return readFileSync(f, "utf8"); } catch { return undefined; } })();
  const found = new Map<string, Token[]>();
  const own = read(origin.file);
  if (own !== undefined) found.set(origin.file, uses(own, origin.name));
  const files = new Set([...projectFiles(path), ...overrides.keys(), resolve(path)]);
  for (const f of files) {
    if (f === origin.file) continue;
    const text = read(f);
    if (!text || !/\buse\s+["']\./.test(text)) continue;
    const tokens: Token[] = [];
    for (const i of imports(text)) {
      if (i.name !== origin.name || !i.source.startsWith(".") || resolve(f, "..", i.source) !== origin.file) continue;
      // Under an alias, the name in the `use` line is the only use of the original name; the
      // alias's own uses count as references but keep their name on a rename.
      if (i.local === i.name) tokens.push(...uses(text, i.name));
      else tokens.push(...uses(text, i.name).filter((t) => t.line === i.at.line), ...(renaming ? [] : uses(text, i.local)));
    }
    if (tokens.length) found.set(f, tokens);
  }
  return found;
}

/** Find all references: in this file, in the file it's declared in, and in every project file importing it. */
export function getReferences(text: string, position: Position, path: string, overrides: Map<string, string>, includeDeclaration = true): Location[] {
  const all = new Map([...overrides, [resolve(path), text]]);
  const origin = originOf(text, position, path, all);
  if (!origin) {
    const word = wordAt(text, position);
    return word && getDocumentHighlights(text, position).length ? uses(text, word.name).map((t) => ({ uri: pathToFileURL(path).href, range: rangeOf(t) })) : [];
  }
  const out: Location[] = [];
  const decl = declarations(all.get(origin.file) ?? (() => { try { return readFileSync(origin.file, "utf8"); } catch { return ""; } })()).find((d) => d.name === origin.name);
  for (const [file, tokens] of occurrences(origin, path, all)) {
    for (const t of tokens) {
      const isDecl = file === origin.file && decl && t.line === decl.selection.start.line && t.character === decl.selection.start.character;
      if (isDecl && !includeDeclaration) continue;
      out.push({ uri: pathToFileURL(file).href, range: rangeOf(t) });
    }
  }
  return out;
}

/** The range of the name under the cursor, when it's one Halo can rename. */
export function prepareRename(text: string, position: Position): Range | null {
  const word = wordAt(text, position);
  if (!word) return null;
  const known = declarations(text).some((d) => d.name === word.name) || imports(text).some((i) => i.local === word.name);
  return known ? rangeOf(word) : null;
}

/**
 * Rename a declaration everywhere it's used. On an `as` alias, only the alias is renamed (in
 * this file); on a declared or imported name, the declaration and every file importing it.
 */
export function getRename(text: string, position: Position, newName: string, path: string, overrides: Map<string, string>): WorkspaceEdit | null {
  if (!/^[A-Za-z_]\w*$/.test(newName)) return null;
  const word = wordAt(text, position);
  if (!word) return null;
  const alias = imports(text).find((i) => i.local === word.name && i.local !== i.name && !(i.name === word.name && i.at.line === word.line));
  const edit = (tokens: Token[]): TextEdit[] => tokens.map((t) => ({ range: rangeOf(t), newText: newName }));
  if (alias) return { changes: { [pathToFileURL(path).href]: edit(uses(text, alias.local)) } };
  const all = new Map([...overrides, [resolve(path), text]]);
  const origin = originOf(text, position, path, all);
  if (!origin) return null;
  const changes: Record<string, TextEdit[]> = {};
  for (const [file, tokens] of occurrences(origin, path, all, true)) changes[pathToFileURL(file).href] = edit(tokens);
  return { changes };
}
