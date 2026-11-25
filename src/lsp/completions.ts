import { CompletionItemKind, type CompletionItem, type Position } from "vscode-languageserver";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parse } from "../parser/index.js";
import { importableNames } from "../linker/index.js";
import { diskLinkOptions, projectRoot } from "../linker/node.js";
import { AGENT_PRESETS } from "../runtime/presets.js";
import { BLOCK_CATEGORIES, DIRECTIVES, ENFORCED_RULES, REDACT_CATEGORIES, SCHEMA_TYPES, SYSTEM_EVENTS, SYSTEM_METHODS, THREAD_METHODS, TOOL_PROVIDERS, TYPE_DESCRIPTIONS } from "../parser/builtins.js";

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
  ["context", "context.current, context.input, context.data, context.meta, context.thread"],
  ["use", "Import from a file or package: use \"./shared.halo\" { Name, Other as Alias }"],
  ["with", "Fill a package's model slots: use \"@acme/kit\" { X } with models(fast: anthropic/claude-haiku-4-5)"],
];

/**
 * Keywords and declared names, plus System methods after `System.` and directives after `@`.
 * With the document's path: `.halo` files and installed packages inside `use "..."`, the
 * names a file or package exports inside `use "..." { ... }`, and imported names everywhere.
 */
export function getCompletions(sourceText: string, position: Position, path?: string, overrides?: Map<string, string>): CompletionItem[] {
  const line = sourceText.split("\n")[position.line] ?? "";
  const before = line.slice(0, position.character);

  const useString = /^\s*use\s+(["'])([^"']*)$/.exec(before);
  if (useString) return path ? useTargets(path, useString[2]!) : [];
  const useBraces = /^\s*use\s+(["'])([^"']+)\1\s*\{[^}]*$/.exec(before);
  if (useBraces) {
    if (!path) return [];
    const file = resolve(path);
    const names = importableNames(file, useBraces[2]!, diskLinkOptions(file, { overrides: new Map([...(overrides ?? []), [file, sourceText]]) }));
    return names.map((n) => ({ label: n.name, kind: KIND_ICONS[n.kind], detail: `${n.kind} from ${useBraces[2]}` }));
  }

  if (/System\.\w*$/.test(before)) {
    return [...SYSTEM_METHODS, ...SYSTEM_EVENTS].map((m) => ({ label: m, kind: CompletionItemKind.Method, detail: `System.${m}` }));
  }
  if (/\bThread\.\w*$/.test(before)) {
    return THREAD_METHODS.map((m) => ({ label: m, kind: CompletionItemKind.Method, detail: `Thread.${m}` }));
  }
  if (/\bpreset:\s*\w*$/.test(before)) {
    return Object.values(AGENT_PRESETS).map((p) => ({ label: p.name, kind: CompletionItemKind.EnumMember, detail: p.summary, documentation: p.returns ? `Returns JSON: ${p.returns}` : undefined }));
  }
  if (/\bsandbox:\s*"?\w*$/.test(before)) {
    // Read from the text, since the line being typed usually doesn't parse yet.
    const remotes = [...sourceText.matchAll(/^\s*tool\s+(\w+)\s*:\s*Remote\b/gm)].map((m) => ({ label: m[1]!, kind: CompletionItemKind.Variable, detail: "Remote tool (shared with the pipeline)" }));
    return [
      { label: '"e2b"', kind: CompletionItemKind.EnumMember, detail: "Its own E2B sandbox for each run (E2B_API_KEY)" },
      { label: '"daytona"', kind: CompletionItemKind.EnumMember, detail: "Its own Daytona sandbox for each run (DAYTONA_API_KEY)" },
      { label: '"docker"', kind: CompletionItemKind.EnumMember, detail: "Its own Docker container on this machine for each run" },
      { label: '"auto"', kind: CompletionItemKind.EnumMember, detail: "Docker when it's running, else E2B, else Daytona" },
      ...remotes,
    ];
  }
  if (atType(sourceText, position, line, before)) {
    // Schemas are read from the text: the declaration being typed usually doesn't parse yet.
    const schemas = [...new Set([...sourceText.matchAll(/^\s*schema\s+(\w+)/gm)].map((m) => m[1]!))];
    return [
      ...SCHEMA_TYPES.map((t) => ({ label: t, kind: CompletionItemKind.TypeParameter, detail: TYPE_DESCRIPTIONS[t] })),
      ...schemas.map((s) => ({ label: s, kind: CompletionItemKind.Struct, detail: "schema" })),
    ];
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
  for (const u of ast.uses ?? []) {
    for (const i of u.items ?? []) items.push({ label: i.as ?? i.name, kind: CompletionItemKind.Reference, detail: `from ${u.source}${i.as ? ` (${i.name})` : ""}` });
  }
  return items;
}

const KIND_ICONS: Record<string, CompletionItemKind> = {
  agent: CompletionItemKind.Class,
  tool: CompletionItemKind.Interface,
  store: CompletionItemKind.Interface,
  policy: CompletionItemKind.Constant,
  pipeline: CompletionItemKind.Function,
  schema: CompletionItemKind.Struct,
  provider: CompletionItemKind.Module,
};

/** `.halo` files next to the document (and in folders under it), and installed packages, for `use "..."`. */
function useTargets(path: string, typed: string): CompletionItem[] {
  const dir = dirname(resolve(path));
  const items: CompletionItem[] = [];
  if (!typed || typed.startsWith(".")) {
    const base = typed.includes("/") ? typed.slice(0, typed.lastIndexOf("/") + 1) : "./";
    const folder = resolve(dir, base);
    try {
      for (const entry of readdirSync(folder, { withFileTypes: true })) {
        if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
        const full = join(folder, entry.name);
        if (entry.isDirectory()) items.push({ label: `${base}${entry.name}/`, kind: CompletionItemKind.Folder });
        else if (entry.name.endsWith(".halo") && full !== resolve(path)) items.push({ label: `${base}${entry.name}`, kind: CompletionItemKind.File });
      }
    } catch {}
  }
  if (!typed.startsWith(".")) {
    const packages = join(projectRoot(path), ".halo", "packages");
    try {
      for (const scope of readdirSync(packages)) {
        if (!scope.startsWith("@")) continue;
        for (const name of readdirSync(join(packages, scope))) {
          let description: string | undefined;
          try {
            description = (JSON.parse(readFileSync(join(packages, scope, name, "halo.json"), "utf8")) as { description?: string }).description;
          } catch {}
          items.push({ label: `${scope}/${name}`, kind: CompletionItemKind.Module, detail: description ?? "package" });
        }
      }
    } catch {}
  }
  return items;
}

/** Whether the cursor is where a type goes: `(x: |`, `-> |`, `Array<|`, or a field inside `schema Name { ... }`. */
function atType(sourceText: string, position: Position, line: string, before: string): boolean {
  if (/<\s*[\w, ]*$/.test(before) && /:\s*\w*<|->\s*\w*</.test(before)) return true;
  if (/^\s*pipeline\b/.test(line)) return /(?:[(,]\s*\w+\s*:|->)\s*\w*$/.test(before);
  if (!/(?:^|[{,])\s*\w+\s*:\s*\w*$/.test(before)) return false;
  const lines = sourceText.split("\n");
  const upTo = [...lines.slice(0, position.line), before].join("\n");
  const open = [...upTo.matchAll(/\bschema\s+\w+\s*\{/g)].at(-1);
  return !!open && !upTo.slice(open.index).includes("}");
}
