import { MarkupKind, type Hover, type Position } from "vscode-languageserver";
import { parse } from "../parser/index.js";
import { findPreset } from "../runtime/presets.js";
import { SCHEMA_TYPES, TYPE_DESCRIPTIONS, includes } from "../parser/builtins.js";

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

/** Describe the declaration (or operator) under the cursor. */
export function getHover(sourceText: string, position: Position): Hover | null {
  const word = wordAt(sourceText.split("\n")[position.line] ?? "", position.character);
  if (!word) return null;
  const md = (value: string): Hover => ({ contents: { kind: MarkupKind.Markdown, value } });
  if (OPERATORS[word]) return md(OPERATORS[word]);

  const ast = parse(sourceText);
  const agent = ast.agents.find((a) => a.name === word);
  if (agent) {
    const lines = [`**agent ${agent.name}** — \`${agent.modelId}\``];
    const params = Object.entries(agent.params).map(([k, v]) => `${k}: ${v}`);
    if (params.length) lines.push(params.join(", "));
    const preset = agent.params.preset ? findPreset(agent.params.preset) : undefined;
    if (preset) lines.push(`Preset **${preset.name}**: ${preset.summary}${preset.returns ? `. Returns \`${preset.returns}\`` : ""}${preset.skills?.length ? `. Skills: ${preset.skills.join(", ")}` : ""}`);
    if (agent.system) lines.push(`> ${agent.system.split("\n").join("\n> ")}`);
    if (agent.equips?.length) lines.push(`equips ${agent.equips.join(", ")}`);
    if (agent.requires?.length) lines.push(`requires ${agent.requires.join(", ")}`);
    return md(lines.join("\n\n"));
  }
  const tool = [...ast.tools, ...ast.stores].find((t) => t.name === word);
  if (tool) return md(`**tool ${tool.name}** : \`${tool.provider}(${[...tool.args, ...Object.entries(tool.namedArgs).map(([k, v]) => `${k}: ${v}`)].join(", ")})\``);
  const policy = ast.policies.find((p) => p.name === word);
  if (policy) return md(`**policy ${policy.name}**\n\n${policy.rules.map((r) => `- \`${r.name}(${r.args.join(", ")})\``).join("\n")}`);
  const pipeline = ast.pipelines.find((p) => p.name === word);
  if (pipeline) {
    const sig = `${pipeline.name}(${pipeline.params.map((p) => `${p.name}: ${p.type}`).join(", ")})${pipeline.returnType ? ` -> ${pipeline.returnType}` : ""}`;
    return md(`**pipeline** \`${sig}\` — ${pipeline.pipeline.length} stage(s)`);
  }
  const schema = ast.schemas.find((s) => s.name === word);
  if (schema) return md(`**schema ${schema.name}**\n\n${schema.fields.map((f) => `- ${f.name}: \`${f.type}\``).join("\n")}`);
  if (includes(SCHEMA_TYPES, word)) return md(`**${word}** (built-in type): ${TYPE_DESCRIPTIONS[word]}`);
  return null;
}
