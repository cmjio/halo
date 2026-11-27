/**
 * What the editor knows about calling tools and agents: `Code.` lists the methods of Code's
 * provider (with their arguments, effect and description), `Code.edit(` offers the arguments
 * still missing and a signature, hovering on `Code.edit` describes it, and a method the
 * provider doesn't have is flagged. Methods come from the same descriptions agents and
 * `halo plan` use (BUILTIN_PROVIDER_INFO), plus those of installed packages' providers.
 */
import { CompletionItemKind, DiagnosticSeverity, InsertTextFormat, MarkupKind, type CompletionItem, type Diagnostic, type Hover, type Position, type SignatureHelp } from "vscode-languageserver";
import { resolve } from "node:path";
import { parse } from "../parser/index.js";
import type { Arg, ToolDeclaration, Value } from "../parser/types.js";
import { BUILTIN_PROVIDER_INFO } from "../runtime/provider-info.js";
import type { JsonSchema, ProviderInfo, ToolMethod } from "../runtime/tools.js";
import { linkFile } from "../linker/node.js";

/** Provider descriptions beyond the built-in ones (installed packages), by provider name. */
export type ProviderLookup = (provider: string) => ProviderInfo | undefined;

const builtin: ProviderLookup = (p) => BUILTIN_PROVIDER_INFO[p];

/** A tool as declared (here or in a file this one uses): its name, provider and settings. */
export interface ToolRef {
  name: string;
  provider: string;
  /** A setting by name (`write`), or the first positional argument as 0, as written. */
  config(key: string | number): unknown;
  /** The first argument as written, for the root of a Workspace, a URL, a path. */
  target?: string;
}

const literal = (v: Value | undefined): unknown =>
  v === undefined ? undefined : v.kind === "string" || v.kind === "number" || v.kind === "bool" ? v.value : v.kind === "list" ? v.items.map(literal) : v.kind === "null" ? null : v.kind === "ref" ? v.path.join(".") : v.kind;

function fromDeclaration(t: Pick<ToolDeclaration, "name" | "provider" | "argList">): ToolRef {
  const positional = t.argList.filter((a: Arg) => !a.name);
  const first = positional[0]?.value;
  return {
    name: t.name,
    provider: t.provider,
    config: (key) => literal(typeof key === "number" ? positional[key]?.value : t.argList.find((a: Arg) => a.name === key)?.value),
    target: first?.kind === "string" ? first.value : undefined,
  };
}

/**
 * The tools a file can call, by name: its own declarations (read from the text when the file
 * doesn't parse, as while typing) and, with its path, the tools it imports.
 */
export function toolsOf(text: string, path?: string, overrides?: Map<string, string>): Map<string, ToolRef> {
  const out = new Map<string, ToolRef>();
  const ast = parse(text);
  if (!ast.errors.length) {
    for (const t of [...ast.tools, ...ast.stores]) out.set(t.name, fromDeclaration(t));
  } else {
    for (const m of text.matchAll(/^(?:tool|store)\s+([A-Za-z_]\w*)\s*:\s*([\w@/.-]+)\s*(\(([^\n]*)\))?/gm)) {
      const args = m[4] ?? "";
      out.set(m[1]!, {
        name: m[1]!,
        provider: m[2]!,
        config: (key) => {
          if (key === 0) return /^\s*"([^"]*)"/.exec(args)?.[1];
          const v = new RegExp(`\\b${key}\\s*:\\s*("([^"]*)"|true|false|-?[\\d.]+)`).exec(args);
          return v ? (v[2] ?? (v[1] === "true" ? true : v[1] === "false" ? false : Number(v[1]))) : undefined;
        },
        target: /^\s*"([^"]*)"/.exec(args)?.[1],
      });
    }
  }
  if (path && /^\s*use\s/m.test(text)) {
    try {
      const file = resolve(path);
      const linked = linkFile(file, { overrides: new Map([...(overrides ?? []), [file, text]]) });
      for (const [local, imp] of Object.entries(linked.imports)) {
        if (out.has(local) || (imp.kind !== "tool" && imp.kind !== "store")) continue;
        const decl = [...linked.program.tools, ...linked.program.stores].find((t) => t.name === imp.qualified);
        if (decl) out.set(local, { ...fromDeclaration(decl), name: local });
      }
    } catch {}
  }
  return out;
}

/** The methods a tool has, if its provider lists them without asking a server. */
export function methodsOf(tool: ToolRef, lookup: ProviderLookup = builtin): ToolMethod[] | undefined {
  const info = lookup(tool.provider) ?? builtin(tool.provider);
  if (info?.methodsFor) return info.methodsFor((k) => tool.config(k));
  if (Array.isArray(info?.methods)) return info.methods;
  return undefined;
}

interface Param {
  name: string;
  type: string;
  required: boolean;
  description?: string;
}

function typeName(s: JsonSchema | undefined): string {
  if (!s) return "any";
  const t = (s as { type?: string | string[] }).type;
  const e = (s as { enum?: unknown[] }).enum;
  if (e?.length) return e.map((x) => JSON.stringify(x)).join(" | ");
  if (Array.isArray(t)) return t.join(" | ");
  if (t === "array") return `${typeName((s as { items?: JsonSchema }).items)}[]`;
  return t ?? "any";
}

export function paramsOf(method: ToolMethod): Param[] {
  const schema = method.params as { properties?: Record<string, JsonSchema>; required?: string[] } | undefined;
  const required = new Set(schema?.required ?? []);
  const params = Object.entries(schema?.properties ?? {}).map(([name, s]) => ({ name, type: typeName(s), required: required.has(name), description: (s as { description?: string }).description }));
  // Required first, each group in the order the provider lists them.
  return [...params.filter((p) => p.required), ...params.filter((p) => !p.required)];
}

/** Workspace's writing methods need `write: true` on the declaration; the runtime refuses them otherwise. (SQLite's execute is checked by halo validate.) */
function blocked(tool: ToolRef, method: ToolMethod): string | undefined {
  if (tool.provider === "Workspace" && method.effect === "write" && tool.config("write") !== true) return "needs write: true";
  return undefined;
}

const EFFECTS: Record<string, string> = {
  read: "read",
  write: "writes",
  external: "sends",
  wallet: "uses the wallet",
};

const short = (method: ToolMethod) => `(${paramsOf(method).map((p) => `${p.name}${p.required ? "" : "?"}`).join(", ")})`;
const signature = (method: ToolMethod) => `${method.name}(${paramsOf(method).map((p) => `${p.name}${p.required ? "" : "?"}: ${p.type}`).join(", ")})`;

function methodDoc(tool: ToolRef, method: ToolMethod): string {
  const lines = [`**${tool.name}.${method.name}** — ${tool.provider} · ${EFFECTS[method.effect] ?? method.effect}`, "```halo\n" + `${tool.name}.${signature(method)}` + "\n```", method.description];
  const params = paramsOf(method);
  if (params.length) lines.push(params.map((p) => `- \`${p.name}\`${p.required ? "" : " (optional)"}: ${p.description ?? p.type}`).join("\n"));
  if (tool.target !== undefined) lines.push(`${tool.provider === "Workspace" ? "Root" : "On"}: \`${tool.target}\``);
  const why = blocked(tool, method);
  if (why) lines.push(`**Refused**: ${tool.name} is declared without \`write: true\`.`);
  return lines.join("\n\n");
}

/** Method names this file already calls on `name`, for agents (any method name works on an agent; it says what the call is for). */
function agentMethodsUsed(text: string, name: string): string[] {
  return [...new Set([...text.matchAll(new RegExp(`\\b${name}\\.([A-Za-z_]\\w*)\\s*\\(`, "g"))].map((m) => m[1]!))].filter((m) => m !== "prompt");
}

const agentsOf = (text: string) => new Set([...text.matchAll(/^agent\s+([A-Za-z_]\w*)/gm)].map((m) => m[1]!));

/**
 * Completions after `Name.`: a tool's methods, or an agent's. `after` is the rest of the line,
 * so a call that already has its parentheses doesn't get a second pair. Undefined when `Name`
 * is neither, so the caller can try other completions.
 */
export function memberCompletions(text: string, name: string, after: string, path?: string, overrides?: Map<string, string>, lookup?: ProviderLookup): CompletionItem[] | undefined {
  const hasParens = /^\w*\s*\(/.test(after);
  if (agentsOf(text).has(name)) {
    const used = agentMethodsUsed(text, name);
    const item = (label: string, i: number, documentation: string): CompletionItem => ({
      label,
      kind: CompletionItemKind.Method,
      labelDetails: { detail: '("...")', description: "model call" },
      detail: `${name}.${label}("...")`,
      documentation: { kind: MarkupKind.Markdown, value: documentation },
      sortText: String(i).padStart(3, "0"),
      insertText: hasParens ? label : `${label}("$1")`,
      insertTextFormat: InsertTextFormat.Snippet,
    });
    return [
      item("prompt", 0, `Call **${name}** with a prompt. \`{{name}}\` fills in a value.\n\nAny other method name works too, and says what the call is for: \`${name}.review(...)\`, \`${name}.decide(...)\`.`),
      ...used.map((m, i) => item(m, i + 1, `Call **${name}**, labelled \`${m}\` (used elsewhere in this file).`)),
    ];
  }
  const tool = toolsOf(text, path, overrides).get(name);
  if (!tool) return undefined;
  const methods = methodsOf(tool, lookup);
  if (!methods) return [];
  // Read methods first, then the ones that change something; a refused one last.
  const rank = (m: ToolMethod) => (blocked(tool, m) ? 2 : m.effect === "read" ? 0 : 1);
  return methods.map((m, i) => {
    const required = paramsOf(m).filter((p) => p.required);
    const snippet = required.length ? `${m.name}(${required.map((p, j) => `${p.name}: $${j + 1}`).join(", ")})` : `${m.name}($1)`;
    const why = blocked(tool, m);
    return {
      label: m.name,
      kind: CompletionItemKind.Method,
      labelDetails: { detail: short(m), description: why ?? EFFECTS[m.effect] ?? m.effect },
      detail: `${tool.name}.${signature(m)}`,
      documentation: { kind: MarkupKind.Markdown, value: methodDoc(tool, m) },
      sortText: `${rank(m)}${String(i).padStart(3, "0")}`,
      insertText: hasParens ? m.name : snippet,
      insertTextFormat: InsertTextFormat.Snippet,
    };
  });
}

/** The call the cursor is inside: `Code.edit(path: "a", |`, with the argument index and names already given. */
export function callAt(before: string): { callee: string; method: string; index: number; named: string[]; current?: string } | undefined {
  let depth = 0;
  for (let i = before.length - 1; i >= 0; i--) {
    const c = before[i];
    if (c === '"' || c === "'") {
      // Skip back over a string.
      const q = c;
      i--;
      while (i >= 0 && !(before[i] === q && before[i - 1] !== "\\")) i--;
      continue;
    }
    if (c === ")" || c === "]" || c === "}") depth++;
    else if (c === "(" || c === "[" || c === "{") {
      if (depth) { depth--; continue; }
      if (c !== "(") return undefined;
      const m = /([A-Za-z_]\w*)\.([A-Za-z_]\w*)\s*$/.exec(before.slice(0, i));
      if (!m) return undefined;
      const args = topLevelArgs(before.slice(i + 1));
      const named = args.map((a) => /^\s*([A-Za-z_]\w*)\s*:/.exec(a)?.[1]).filter((n): n is string => !!n);
      return { callee: m[1]!, method: m[2]!, index: args.length - 1, named, current: /^\s*([A-Za-z_]\w*)\s*:/.exec(args.at(-1) ?? "")?.[1] };
    }
  }
  return undefined;
}

function topLevelArgs(s: string): string[] {
  const out: string[] = [""];
  let depth = 0;
  let quote: string | undefined;
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (quote) {
      if (c === "\\") { out[out.length - 1] += c + (s[++i] ?? ""); continue; }
      if (c === quote) quote = undefined;
    } else if (c === '"' || c === "'") quote = c;
    else if ("([{".includes(c)) depth++;
    else if (")]}".includes(c)) depth--;
    else if (c === "," && !depth) { out.push(""); continue; }
    out[out.length - 1] += c;
  }
  return out;
}

function methodFor(text: string, callee: string, method: string, path?: string, overrides?: Map<string, string>, lookup?: ProviderLookup) {
  const tool = toolsOf(text, path, overrides).get(callee);
  const m = tool && methodsOf(tool, lookup)?.find((x) => x.name === method);
  return tool && m ? { tool, method: m } : undefined;
}

/** Inside `Code.edit(`, the arguments not given yet, as `name: ` (required ones first). */
export function argumentCompletions(text: string, before: string, path?: string, overrides?: Map<string, string>, lookup?: ProviderLookup): CompletionItem[] | undefined {
  const call = callAt(before);
  if (!call || !/(^|[(,]\s*)[A-Za-z_]*$/.test(before)) return undefined;
  const found = methodFor(text, call.callee, call.method, path, overrides, lookup);
  if (!found) return undefined;
  return paramsOf(found.method)
    .filter((p) => !call.named.includes(p.name))
    .map((p, i) => ({
      label: `${p.name}:`,
      kind: CompletionItemKind.Property,
      labelDetails: { detail: ` ${p.type}`, description: p.required ? "required" : "optional" },
      documentation: p.description,
      sortText: `${p.required ? 0 : 1}${String(i).padStart(3, "0")}`,
      insertText: `${p.name}: `,
    }));
}

/** The signature of the tool method the cursor is in, with the argument being typed highlighted. */
export function getSignatureHelp(text: string, position: Position, path?: string, overrides?: Map<string, string>, lookup?: ProviderLookup): SignatureHelp | null {
  const before = (text.split("\n")[position.line] ?? "").slice(0, position.character);
  const call = callAt(before);
  if (!call) return null;
  const found = methodFor(text, call.callee, call.method, path, overrides, lookup);
  if (!found) return null;
  const params = paramsOf(found.method);
  let label = `${found.tool.name}.${found.method.name}(`;
  const parameters = params.map((p, i) => {
    const part = `${p.name}${p.required ? "" : "?"}: ${p.type}`;
    const start = label.length;
    label += part + (i < params.length - 1 ? ", " : "");
    return { label: [start, start + part.length] as [number, number], documentation: p.description };
  });
  label += ")";
  // A named argument picks its own parameter; a positional one goes by position.
  const named = call.current ? params.findIndex((p) => p.name === call.current) : -1;
  const activeParameter = named >= 0 ? named : Math.min(call.index, Math.max(0, params.length - 1));
  return {
    signatures: [{ label, documentation: { kind: MarkupKind.Markdown, value: `${found.method.description}\n\n${EFFECTS[found.method.effect] ?? found.method.effect}` }, parameters }],
    activeSignature: 0,
    activeParameter,
  };
}

/** Hover on the method of `Code.edit`. */
export function methodHover(text: string, line: string, character: number, path?: string, overrides?: Map<string, string>, lookup?: ProviderLookup): Hover | null {
  for (const m of line.matchAll(/\b([A-Za-z_]\w*)\.([A-Za-z_]\w*)/g)) {
    const start = m.index! + m[1]!.length + 1;
    if (character < start || character > start + m[2]!.length) continue;
    const found = methodFor(text, m[1]!, m[2]!, path, overrides, lookup);
    if (found) return { contents: { kind: MarkupKind.Markdown, value: methodDoc(found.tool, found.method) } };
  }
  return null;
}

/** A short list of a tool's methods, for hovering on the tool's name. */
export function methodList(tool: ToolRef, lookup?: ProviderLookup): string | undefined {
  const methods = methodsOf(tool, lookup);
  if (!methods?.length) {
    const info = lookup?.(tool.provider) ?? builtin(tool.provider);
    return typeof info?.methods === "function" ? `Its methods come from ${tool.provider === "MCP" ? "the MCP server" : tool.provider === "Skills" ? "the skills folder" : "the provider"} when a run starts, so the editor can't list them.` : undefined;
  }
  return methods.map((m) => `- \`${m.name}${short(m)}\` · ${blocked(tool, m) ?? EFFECTS[m.effect] ?? m.effect}`).join("\n");
}

/** Text with strings and comments blanked (same length), so code can be searched by position. */
export function codeOnly(text: string): string {
  let out = "";
  for (let i = 0; i < text.length; ) {
    const c = text[i]!;
    if (c === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") { out += " "; i++; }
      continue;
    }
    if (c === '"' || c === "'") {
      const close = text.startsWith(c.repeat(3), i) ? c.repeat(3) : c;
      out += close; i += close.length;
      while (i < text.length && !text.startsWith(close, i)) {
        if (text[i] === "\n" && close.length === 1) break;
        if (text[i] === "\\") { out += " "; i++; }
        out += text[i] === "\n" ? "\n" : " "; i++;
      }
      if (text.startsWith(close, i)) { out += close; i += close.length; }
      continue;
    }
    out += c; i++;
  }
  return out;
}

function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length]![b.length]!;
}

/** Calls of a method the tool's provider doesn't have, and writing calls on a read-only Workspace. */
export function toolCallDiagnostics(text: string, path?: string, overrides?: Map<string, string>, lookup?: ProviderLookup): Diagnostic[] {
  const tools = toolsOf(text, path, overrides);
  if (!tools.size) return [];
  const out: Diagnostic[] = [];
  const lines = codeOnly(text).split("\n");
  lines.forEach((l, n) => {
    if (/^\s*(tool|store|policy|use)\b/.test(l)) return;
    for (const m of l.matchAll(/(?<![\w.])([A-Za-z_]\w*)\.([A-Za-z_]\w*)\s*\(/g)) {
      const tool = tools.get(m[1]!);
      const methods = tool && methodsOf(tool, lookup);
      if (!tool || !methods?.length) continue;
      const start = m.index! + m[1]!.length + 1;
      const range = { start: { line: n, character: start }, end: { line: n, character: start + m[2]!.length } };
      const method = methods.find((x) => x.name === m[2]);
      if (!method) {
        const near = methods.map((x) => [x.name, distance(x.name, m[2]!)] as const).sort((a, b) => a[1] - b[1])[0];
        const hint = near && near[1] <= Math.max(2, Math.floor(m[2]!.length / 2)) ? ` (did you mean ${near[0]}?)` : "";
        out.push({ severity: DiagnosticSeverity.Error, range, message: `${tool.provider} has no method "${m[2]}"${hint}. ${tool.name} has: ${methods.map((x) => x.name).join(", ")}`, source: "halo" });
        continue;
      }
      if (blocked(tool, method)) out.push({ severity: DiagnosticSeverity.Error, range, message: `${tool.name} is declared without write: true, so ${method.name} is refused; add write: true to its declaration`, source: "halo" });
    }
  });
  return out;
}
