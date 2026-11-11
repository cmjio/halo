/**
 * What a package exports, and what its .halo-declared tools can reach. Computed at publish
 * time and shown on the package's page and at install. Pure and in memory (the registry
 * Worker runs it too).
 *
 * Tools in the files the package's exports reach are counted: for built-in providers, their
 * hosts, commands and code; for every tool, the Env variables its declaration reads. Tools on
 * the package's own providers (halo.json `providers`) or a dependency's are marked `fromPackage`:
 * the package manager adds what those reach (permissionsOf in src/registry/manifest.ts).
 *
 * It also checks the package's rules: every agent in any .halo file uses a declared model slot
 * (unless the package is hosted), exported files don't declare the same name twice, and `use`
 * only names files inside the package or packages in its dependencies.
 */

import { parse } from "../parser/index.js";
import type { Arg, Loc, ParseResult, ToolDeclaration } from "../parser/types.js";
import { normalizePackageName, type PackageExports, type PackageManifest } from "../registry/contract.js";
import type { LinkDiagnostic } from "./index.js";
import { dirnameOf, joinPath, normalizePath } from "./paths.js";

/** What one tool can reach. `network` holds hosts; `*` means any host (a URL chosen at run time). */
export interface ToolEffectSummary {
  /** The tool's name, and the file it's declared in. */
  tool: string;
  file: string;
  provider: string;
  network: string[];
  env: string[];
  spawn: string[];
  code: boolean;
  /** Reads or writes local files or databases (SQLite, KV, File, Workspace, VectorStore). */
  local?: boolean;
  /** No description of this provider: its reach isn't known. */
  unknown?: boolean;
  /** The provider comes from a package (this one's halo.json, or a dependency): its reach is the package manager's to add. */
  fromPackage?: boolean;
}

export interface PackageAnalysis {
  exports: PackageExports;
  network: string[];
  env: string[];
  spawn: string[];
  code: boolean;
  effects: ToolEffectSummary[];
  /** Problems: syntax errors, missing files, names declared twice in exported files, hard-coded models, undeclared model slots. */
  diagnostics: LinkDiagnostic[];
}

export interface AnalyzeOptions {
  /** Treat hard-coded model ids as allowed (a hosted package's agents run on the publisher's keys). Default: manifest.hosted is set. */
  allowModelIds?: boolean;
}

/** Fixed hosts and default token variables of the built-in providers that call a service. */
const SERVICES: Record<string, { host: string; env?: string }> = {
  Slack: { host: "slack.com", env: "SLACK_BOT_TOKEN" },
  Email: { host: "api.resend.com", env: "RESEND_API_KEY" },
  GitHub: { host: "api.github.com", env: "GITHUB_TOKEN" },
  Linear: { host: "api.linear.app", env: "LINEAR_TOKEN" },
  Figma: { host: "api.figma.com", env: "FIGMA_TOKEN" },
};
const URL_PROVIDERS = new Set(["REST", "GET", "POST"]);
const LOCAL = new Set(["VectorStore", "KV", "SQLite", "File", "Workspace", "Documents"]);
const PURE = new Set(["Clock", "Calc", "Data", "Skills"]);

/** Analyze a package from its files (relative path → text) and its halo.json. */
export function analyzePackage(files: Record<string, string>, manifest: PackageManifest, options: AnalyzeOptions = {}): PackageAnalysis {
  const diagnostics: LinkDiagnostic[] = [];
  const report = (severity: "error" | "warning", file: string, message: string, loc?: Loc) =>
    diagnostics.push({ severity, message, file, ...(loc ? { line: loc.line, column: loc.column } : {}) });
  const parsed = new Map<string, ParseResult>();
  const read = (path: string): ParseResult | undefined => {
    if (parsed.has(path)) return parsed.get(path);
    const text = files[path];
    if (text === undefined) return undefined;
    const ast = parse(text);
    parsed.set(path, ast);
    for (const e of ast.errors) {
      const m = e.match(/^\[(\d+):(\d+)\] (.*)$/s);
      report("error", path, m ? m[3]! : e, m ? { line: Number(m[1]), column: Number(m[2]) } : undefined);
    }
    return ast;
  };

  // Exported files, then every file they reach through relative `use`s.
  const exports: PackageExports = { pipelines: [], agents: [], tools: [], stores: [], schemas: [], policies: [], providers: [], skills: [] };
  const declaredIn = new Map<string, string>();
  const reachable: string[] = [];
  const visit = (path: string, from?: { file: string; loc?: Loc }) => {
    if (reachable.includes(path)) return;
    const ast = read(path);
    if (!ast) {
      if (from) report("error", from.file, `use "${path}": file not found in the package`, from.loc);
      else report("error", "halo.json", `exports: ${path} is not in the package`);
      return;
    }
    reachable.push(path);
    for (const use of ast.uses ?? []) {
      if (use.source.startsWith("./") || use.source.startsWith("../")) {
        const target = joinPath(dirnameOf(path), use.source);
        if (target.startsWith("../")) report("error", path, `use "${use.source}": a package can only use files inside it`, use.loc);
        else visit(target, { file: path, loc: use.loc });
      } else {
        const dep = normalizePackageName(use.source);
        if (dep === manifest.name) report("error", path, `use "${use.source}": a package can't use itself; use its files by relative path`, use.loc);
        else if (!Object.hasOwn(manifest.dependencies ?? {}, dep)) report("error", path, `use "${use.source}": ${dep} is not in the package's dependencies`, use.loc);
      }
    }
  };
  for (const file of manifest.exports ?? []) {
    const path = normalizePath(file);
    visit(path);
    const ast = parsed.get(path);
    if (!ast) continue;
    const add = (list: string[], decls: Array<{ name: string; loc?: Loc }>) => {
      for (const d of decls) {
        const prev = declaredIn.get(d.name);
        if (prev && prev !== path) report("error", path, `"${d.name}" is declared in two exported files (${prev} and ${path}); exported files share the package's names`, d.loc);
        else if (!prev) {
          declaredIn.set(d.name, path);
          list.push(d.name);
        }
      }
    };
    add(exports.pipelines, ast.pipelines);
    add(exports.agents, ast.agents);
    add(exports.tools, ast.tools);
    add(exports.stores, ast.stores);
    add(exports.schemas, ast.schemas);
    add(exports.policies, ast.policies);
  }
  exports.providers = Object.keys(manifest.providers ?? {});
  if (manifest.skills) {
    const dir = normalizePath(manifest.skills.replace(/\/+$/, ""));
    exports.skills = [...new Set(Object.keys(files).flatMap((f) => {
      const m = normalizePath(f).match(/^(.*)\/([^/]+)\/SKILL\.md$/);
      return m && m[1] === dir ? [m[2]!] : [];
    }))].sort();
  }

  // Models: every agent in every .halo file uses a declared slot (unless the package is hosted).
  const allowIds = options.allowModelIds ?? !!manifest.hosted;
  for (const path of Object.keys(files).filter((f) => f.endsWith(".halo")).sort()) {
    const ast = read(normalizePath(path));
    for (const agent of ast?.agents ?? []) {
      if (agent.modelId.startsWith("models.")) {
        const slot = agent.modelId.slice("models.".length);
        if (!Object.hasOwn(manifest.models ?? {}, slot)) report("error", path, `Agent "${agent.name}" uses model slot "${slot}", which halo.json "models" doesn't declare (add { "description": "...", "suggested": "..." })`, agent.loc);
      } else if (!allowIds) {
        report("error", path, `Agent "${agent.name}" hard-codes the model "${agent.modelId}"; a package's agents use model slots, [models.<slot>], so the people using it choose (and pay for) their models`, agent.loc);
      }
    }
  }

  // Reach of the tools in the files that can run.
  const effects: ToolEffectSummary[] = [];
  for (const path of reachable) {
    const ast = parsed.get(path)!;
    const imported = new Set((ast.uses ?? []).flatMap((u) => (u.items ?? []).map((i) => i.as ?? i.name)));
    for (const t of [...ast.tools, ...ast.stores]) {
      // A provider from a package (its own or a dependency) is the package manager's to describe;
      // the Env variables the tool's declaration reads still count.
      const fromPackage = imported.has(t.provider) || Object.hasOwn(manifest.providers ?? {}, t.provider);
      const e = toolEffect(t, path);
      effects.push(fromPackage ? { tool: e.tool, file: e.file, provider: e.provider, network: [], env: e.env, spawn: [], code: false, fromPackage: true } : e);
    }
  }
  const union = (key: "network" | "env" | "spawn") => [...new Set(effects.flatMap((e) => e[key]))].sort();
  return {
    exports,
    network: union("network"),
    env: union("env"),
    spawn: union("spawn"),
    code: effects.some((e) => e.code),
    effects,
    diagnostics,
  };
}

/** What a tool declared with a built-in provider can reach. */
export function toolEffect(t: ToolDeclaration, file: string): ToolEffectSummary {
  const e: ToolEffectSummary = { tool: t.name, file, provider: t.provider, network: [], env: [], spawn: [], code: false };
  const envRefs = (args: Arg[]) => {
    for (const a of args) {
      const v = a.value;
      if (v.kind === "ref" && v.path[0] === "Env" && v.path[1]) e.env.push(v.path[1]);
      if (v.kind === "string") for (const m of v.value.matchAll(/\bEnv\.([A-Z_][A-Z0-9_]*)/g)) e.env.push(m[1]!);
    }
  };
  envRefs(t.argList);
  const first = t.argList.find((a) => !a.name)?.value;
  const named = (key: string) => t.argList.find((a) => a.name === key)?.value;
  const hostOf = (v: (typeof t.argList)[number]["value"] | undefined) => {
    if (v?.kind !== "string" || v.value.startsWith("Env.")) return "*";
    const url = /^[a-z]+:\/\//i.test(v.value) ? v.value : `https://${v.value}`;
    const authority = url.replace(/^[a-z]+:\/\//i, "").split(/[/?#]/)[0] ?? "";
    if (!authority || authority.includes("{{")) return "*";
    try {
      return new URL(url.replace(/\{\{[^}]*\}\}/g, "x")).hostname;
    } catch {
      return "*";
    }
  };
  const p = t.provider;
  if (URL_PROVIDERS.has(p)) e.network.push(hostOf(named("url") ?? first));
  else if (SERVICES[p]) {
    e.network.push(SERVICES[p].host);
    if (!e.env.length && SERVICES[p].env) e.env.push(SERVICES[p].env!);
  } else if (p === "MCP") {
    const url = named("url") ?? (first?.kind === "string" && /^https?:\/\//i.test(first.value) ? first : undefined);
    if (url) e.network.push(hostOf(url));
    else {
      const cmd = named("command") ?? first;
      e.spawn.push(cmd?.kind === "string" ? cmd.value : "(command set at run time)");
      e.code = true;
    }
  } else if (p === "Bash") {
    e.spawn.push("bash");
    e.code = true;
  } else if (p === "Code") e.code = true;
  else if (p === "Git") e.spawn.push("git");
  else if (p === "Chrome" || p === "Browser") {
    e.network.push("*");
    e.spawn.push("chrome");
  } else if (p === "WebSearch") e.network.push("*");
  else if (p === "Remote") {
    const host = named("host") ?? first;
    e.network.push(host?.kind === "string" ? host.value : "*");
    e.code = true;
  } else if (p === "PostgreSQL" || p === "SQL") e.network.push("*");
  else if (LOCAL.has(p)) e.local = true;
  else if (!PURE.has(p)) e.unknown = true;
  e.env = [...new Set(e.env)];
  return e;
}
