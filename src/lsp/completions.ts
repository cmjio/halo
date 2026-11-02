import { CompletionItemKind, type CompletionItem, type Position } from "vscode-languageserver";
import { parse } from "../parser/index.js";
import { BLOCK_CATEGORIES, DIRECTIVES, ENFORCED_RULES, REDACT_CATEGORIES, SYSTEM_EVENTS, SYSTEM_METHODS, TOOL_PROVIDERS } from "../parser/builtins.js";

const KEYWORDS: Array<[string, string]> = [
  ["agent", "Declare an agent: agent Name [model, temp: 0.2]"],
  ["pipeline", "Declare a pipeline: pipeline Name(arg: Type) -> Type:"],
  ["tool", "Declare a tool: tool Name : Provider(...)"],
  ["store", "Declare a store: store Name : VectorStore(namespace: \"x\")"],
  ["policy", "Declare a policy: policy Name : Rule(...) & Rule(...)"],
  ["schema", "Declare an output schema: schema Name { field: Type }"],
  ["equips", "Give an agent tools it may use"],
  ["requires", "Bind policies to an agent"],
  ["system", "An agent's system prompt"],
  ["yield", "|! yield(...): ask a human"],
  ["listen", "~> listen(Source.Event): wait for an event"],
  ["loop", "|<> loop(Agent, \"condition\"): retry the agent while the condition holds"],
  ["each", "|* each(item in list) => Call(): one call per item"],
  ["else", "The fallback arm of a branch"],
  ["as", "Bind a result: ... as name → context.data.name"],
  ["context", "context.current, context.input, context.data, context.meta"],
];

/** Keywords and declared names, plus System methods after `System.` and directives after `@`. */
export function getCompletions(sourceText: string, position: Position): CompletionItem[] {
  const line = sourceText.split("\n")[position.line] ?? "";
  const before = line.slice(0, position.character);

  if (/System\.\w*$/.test(before)) {
    return [...SYSTEM_METHODS, ...SYSTEM_EVENTS].map((m) => ({ label: m, kind: CompletionItemKind.Method, detail: `System.${m}` }));
  }
  if (/@\w*$/.test(before)) return DIRECTIVES.map((d) => ({ label: d, kind: CompletionItemKind.Keyword, detail: `@${d}` }));
  if (/:\s*\w*$/.test(before) && /^\s*(tool|store)\b/.test(line)) {
    return TOOL_PROVIDERS.map((p) => ({ label: p, kind: CompletionItemKind.Class, detail: "Tool provider" }));
  }
  if (/\b(Block|Redact)\(\s*\w*$/.test(before)) {
    const list = /Block\(\s*\w*$/.test(before) ? BLOCK_CATEGORIES : REDACT_CATEGORIES;
    return list.map((c) => ({ label: c, kind: CompletionItemKind.EnumMember }));
  }
  if (/^\s*policy\b/.test(line)) return ENFORCED_RULES.map((r) => ({ label: r, kind: CompletionItemKind.Function, detail: "Policy rule" }));

  const items: CompletionItem[] = KEYWORDS.map(([label, detail]) => ({ label, kind: CompletionItemKind.Keyword, detail }));
  const ast = parse(sourceText);
  for (const a of ast.agents) items.push({ label: a.name, kind: CompletionItemKind.Class, detail: `agent [${a.modelId}]` });
  for (const t of [...ast.tools, ...ast.stores]) items.push({ label: t.name, kind: CompletionItemKind.Interface, detail: `tool : ${t.provider}` });
  for (const p of ast.policies) items.push({ label: p.name, kind: CompletionItemKind.Constant, detail: "policy" });
  for (const p of ast.pipelines) items.push({ label: p.name, kind: CompletionItemKind.Function, detail: `pipeline (${p.params.map((x) => x.name).join(", ")})` });
  for (const s of ast.schemas) items.push({ label: s.name, kind: CompletionItemKind.Struct, detail: "schema" });
  return items;
}
