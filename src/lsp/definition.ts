import type { Location, Position } from "vscode-languageserver";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parse } from "../parser/index.js";
import type { Loc } from "../parser/types.js";
import { normalizePackageName } from "../registry/contract.js";
import { linkFile } from "../linker/node.js";
import { useSourceAt } from "./hover.js";

const at = (file: string, line = 1, column = 0): Location => {
  const pos = { line: Math.max(0, line - 1), character: column };
  return { uri: pathToFileURL(file).href, range: { start: pos, end: pos } };
};

function wordAt(line: string, character: number): string {
  let start = character;
  while (start > 0 && /\w/.test(line.charAt(start - 1))) start--;
  let end = character;
  while (end < line.length && /\w/.test(line.charAt(end))) end++;
  return line.slice(start, end);
}

/**
 * Go to definition: a name declared in this file, a name it imports (into the other file or
 * the installed package under .halo/packages), or the file or package a `use` line names.
 */
export function getDefinition(sourceText: string, position: Position, path: string, overrides?: Map<string, string>): Location | null {
  const file = resolve(path);
  const line = sourceText.split("\n")[position.line] ?? "";
  const ast = parse(sourceText);
  const linkIt = () => linkFile(file, { overrides: new Map([...(overrides ?? []), [file, sourceText]]) });

  const src = useSourceAt(line, position.character);
  if (src !== undefined) {
    if (src.startsWith("./") || src.startsWith("../")) return at(resolve(file, "..", src));
    const pkg = linkIt().packages.find((p) => p.name === normalizePackageName(src));
    if (!pkg) return null;
    const first = pkg.manifest.exports?.[0];
    return at(first ? join(pkg.dir, first) : join(pkg.dir, "halo.json"));
  }

  const word = wordAt(line, position.character);
  if (!word) return null;
  const own = [...ast.agents, ...ast.tools, ...ast.stores, ...ast.policies, ...ast.pipelines, ...ast.schemas].find((d) => d.name === word) as { loc?: Loc } | undefined;
  if (own?.loc) return at(file, own.loc.line, own.loc.column);
  const imported = ast.uses?.flatMap((u) => u.items ?? []).find((i) => (i.as ?? i.name) === word);
  if (!imported) return null;
  const target = linkIt().imports[word];
  if (!target?.file) return null;
  return at(target.file, target.line, target.column);
}
