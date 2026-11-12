import { DiagnosticSeverity, type Diagnostic, type Range } from "vscode-languageserver";
import { relative, resolve } from "node:path";
import { parse } from "../parser/index.js";
import { validate, type Diagnostic as HaloDiagnostic } from "../parser/validate.js";
import { checkLinked, link } from "../linker/index.js";
import { linkFile } from "../linker/node.js";

/** The identifier (or token) starting at a position, used to size a diagnostic's range. */
function rangeAt(lines: string[], line: number, character: number, length?: number): Range {
  const text = lines[line] ?? "";
  const word = text.slice(character).match(/^[\w.@]+/)?.[0];
  const len = length ?? (word?.length || Math.max(1, text.length - character));
  return { start: { line, character }, end: { line, character: character + len } };
}

/** Where `token` first appears as a whole word, from `line` on (a declaration can span lines), or undefined. */
function findToken(lines: string[], line: number, character: number, token: string): Range | undefined {
  const re = new RegExp(`(?<![\\w.])${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w])`);
  for (let l = line; l < Math.min(lines.length, line + 50); l++) {
    const from = l === line ? character : 0;
    const m = re.exec((lines[l] ?? "").slice(from));
    if (m) return { start: { line: l, character: from + m.index }, end: { line: l, character: from + m.index + token.length } };
  }
  return undefined;
}

/**
 * Syntax errors plus the validator's errors and warnings (undefined names, unequipped tools, ...).
 * With the document's path, the file is linked with everything it `use`s (`overrides` holds
 * other open documents' unsaved text, by absolute path), so imported names resolve and
 * problems in `use` lines are reported. Errors in the files it uses are shown on line 1.
 */
export function getDiagnostics(sourceText: string, path?: string, overrides?: Map<string, string>): Diagnostic[] {
  const lines = sourceText.split("\n");
  const ast = parse(sourceText);
  if (ast.errors.length) {
    return ast.errors.map((err) => {
      const m = err.match(/^\[(\d+):(\d+)\] (.+?)(?: near "(.*)")?$/s);
      if (!m) return { severity: DiagnosticSeverity.Error, range: rangeAt(lines, 0, 0, 0), message: err, source: "halo" };
      const line = Number(m[1]) - 1;
      return { severity: DiagnosticSeverity.Error, range: rangeAt(lines, line, Number(m[2]), m[4]?.length || undefined), message: m[3]!, source: "halo" };
    });
  }
  let diags: HaloDiagnostic[];
  if (path) {
    const file = resolve(path);
    const linked = linkFile(file, { overrides: new Map([...(overrides ?? []), [file, sourceText]]) });
    diags = checkLinked(linked).flatMap((d): HaloDiagnostic[] => {
      if (d.file === file) return [d];
      if (d.severity !== "error") return [];
      return [{ severity: d.severity, message: `In ${relative(resolve(file, ".."), d.file)}${d.line ? `:${d.line}` : ""}: ${d.message}` }];
    });
  } else if (ast.uses?.length) {
    diags = checkLinked(link("untitled.halo", { readFile: () => undefined, source: sourceText }));
  } else {
    diags = validate(ast);
  }
  return diags.map((d) => ({
    severity: d.severity === "error" ? DiagnosticSeverity.Error : DiagnosticSeverity.Warning,
    range: d.line ? ((d.token && findToken(lines, d.line - 1, d.column ?? 0, d.token)) || rangeAt(lines, d.line - 1, d.column ?? 0)) : rangeAt(lines, 0, 0, 0),
    message: d.message,
    source: "halo",
  }));
}
