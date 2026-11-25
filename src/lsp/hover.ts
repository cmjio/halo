import { MarkupKind, type Hover, type Position } from "vscode-languageserver";
import { resolve } from "node:path";
import { parse } from "../parser/index.js";
import type { ParseResult } from "../parser/types.js";
import { findPreset } from "../runtime/presets.js";
import { SCHEMA_TYPES, TYPE_DESCRIPTIONS, includes } from "../parser/builtins.js";
import { displayText } from "../linker/index.js";
import { linkFile } from "../linker/node.js";
import { normalizePackageName } from "../registry/contract.js";

const OPERATORS: Record<string, string> = {
  "|>": "**Pipe**: run a call on the current value.",
  "|?": "**Gate** `|? (cond)`: stop the run unless the condition holds.  \n**Branch** `|? { (cond) => A(), else => B() }`: run the first matching arm.",
  "|!": "**Interrupt** `|! yield(...)`: ask a human. With no handler, the run pauses until `signal()` / `halo resume`.",
  "|*": "**Fan-out** `|* { A(), B() }`: run calls in parallel.  \n**Each** `|* each(item in list) => Call()`: one call per item.",
  "~>": "**Listen** `~> listen(Source.Event)`: wait for an external event.",
  "|<>": "**Loop** `|<> loop(Agent, \"cond\", max: 3)`: while the condition holds, go back to the agent's stage.",
};

function wordAt(line: string, character: number): string {
  const op = line.slice(Math.max(0, character - 2), character + 3).match(/\|<>|\|>|\|\?|\|!|\|\*|~>/);
  if (op) return op[0];
  let start = character;
  while (start > 0 && /\w/.test(line.charAt(start - 1))) start--;
  let end = character;
  while (end < line.length && /\w/.test(line.charAt(end))) end++;
  return line.slice(start, end);
}

/** The string of a `use "..."` line when the cursor is on it. */
export function useSourceAt(line: string, character: number): string | undefined {
  const m = /^\s*use\s+(["'])(.*?)\1/.exec(line);
  if (!m) return undefined;
  const start = m[0].length - m[2]!.length - 1;
  return character >= start - 1 && character <= m[0].length ? m[2] : undefined;
}

/** Markdown describing the declaration called `name` in `ast`, or undefined. */
function describe(ast: ParseResult, name: string, show: (s: string) => string = (s) => s): string | undefined {
  const agent = ast.agents.find((a) => a.name === name);
  if (agent) {
    const lines = [`**agent ${show(agent.name)}** — \`${agent.modelId}\``];
    const params = Object.entries(agent.params).map(([k, v]) => `${k}: ${show(v)}`);
    if (params.length) lines.push(params.join(", "));
    const preset = agent.params.preset ? findPreset(agent.params.preset) : undefined;
    if (preset) lines.push(`Preset **${preset.name}**: ${preset.summary}${preset.returns ? `. Returns \`${preset.returns}\`` : ""}${preset.skills?.length ? `. Skills: ${preset.skills.join(", ")}` : ""}`);
    if (agent.system) lines.push(`> ${agent.system.split("\n").join("\n> ")}`);
    if (agent.equips?.length) lines.push(`equips ${agent.equips.map(show).join(", ")}`);
    if (agent.requires?.length) lines.push(`requires ${agent.requires.map(show).join(", ")}`);
    return lines.join("\n\n");
  }
  const tool = [...ast.tools, ...ast.stores].find((t) => t.name === name);
  if (tool) return `**tool ${show(tool.name)}** : \`${show(tool.provider)}(${[...tool.args, ...Object.entries(tool.namedArgs).map(([k, v]) => `${k}: ${v}`)].join(", ")})\``;
  const policy = ast.policies.find((p) => p.name === name);
  if (policy) return `**policy ${show(policy.name)}**\n\n${policy.rules.map((r) => `- \`${r.name}(${r.args.map(show).join(", ")})\``).join("\n")}`;
  const pipeline = ast.pipelines.find((p) => p.name === name);
  if (pipeline) {
    const sig = `${show(pipeline.name)}(${pipeline.params.map((p) => `${p.name}: ${show(p.type)}`).join(", ")})${pipeline.returnType ? ` -> ${show(pipeline.returnType)}` : ""}`;
    return `**pipeline** \`${sig}\` — ${pipeline.pipeline.length} stage(s)`;
  }
  const schema = ast.schemas.find((s) => s.name === name);
  if (schema) return `**schema ${show(schema.name)}**\n\n${schema.fields.map((f) => `- ${f.name}: \`${show(f.type)}\``).join("\n")}`;
  return undefined;
}

/**
 * Describe the declaration (or operator) under the cursor. With the document's path, imported
 * names are described from the file or package they come from, and a `use` line's package
 * shows its version and description.
 */
export function getHover(sourceText: string, position: Position, path?: string, overrides?: Map<string, string>): Hover | null {
  const line = sourceText.split("\n")[position.line] ?? "";
  const md = (value: string): Hover => ({ contents: { kind: MarkupKind.Markdown, value } });
  const src = useSourceAt(line, position.character);
  if (src !== undefined && path && !src.startsWith(".")) {
    const linked = linkFile(path, { overrides: new Map([...(overrides ?? []), [resolve(path), sourceText]]) });
    const pkg = linked.packages.find((p) => p.name === normalizePackageName(src));
    if (pkg) {
      const slots = Object.entries(pkg.manifest.models ?? {}).map(([k, v]) => `- \`models.${k}\`: ${v.description}${v.suggested ? ` (suggested: \`${v.suggested}\`)` : ""}`);
      return md([`**${pkg.name}** ${pkg.version}`, pkg.manifest.description, ...(slots.length ? ["Model slots:", slots.join("\n")] : [])].join("\n\n"));
    }
    return null;
  }
  const word = wordAt(line, position.character);
  if (!word) return null;
  if (OPERATORS[word]) return md(OPERATORS[word]);

  const ast = parse(sourceText);
  const own = describe(ast, word);
  if (own) return md(own);
  if (path && ast.uses?.some((u) => u.items?.some((i) => (i.as ?? i.name) === word))) {
    const linked = linkFile(path, { overrides: new Map([...(overrides ?? []), [resolve(path), sourceText]]) });
    const imported = linked.imports[word];
    if (imported) {
      const show = (s: string) => displayText(linked.names, s);
      const about = imported.kind === "provider" ? `**provider ${imported.name}** (tool provider)` : describe(linked.program, imported.qualified, show);
      if (about) return md(`${about}\n\nfrom \`${imported.from}\`${imported.name !== word ? ` (as ${word})` : ""}`);
    }
  }
  if (includes(SCHEMA_TYPES, word)) return md(`**${word}** (built-in type): ${TYPE_DESCRIPTIONS[word]}`);
  return null;
}
