/**
 * The linker: loads a program and everything it `use`s into one ParseResult.
 *
 *   const linked = link("main.halo", { readFile, resolver, projectModels });
 *   new HaloRuntime().load(linked.program);
 *
 * It parses the entry file, follows its `use` lines (relative .halo files and installed
 * packages), checks what each line imports, and merges every declaration into one program.
 * Declarations from files other than the entry file get qualified internal names (see
 * names.ts), and every reference to them is rewritten, so private names from different
 * files and packages never collide. Agents whose model is `models.<slot>` get a real model
 * id from the `use ... with models(...)` line that imported their package, then from the
 * project's halo.json `models`.
 *
 * `link` is synchronous and pure: files come from `readFile` and packages from a
 * PackageResolver, so it runs anywhere (the CLI, the LSP, the registry Worker).
 */

import { parse, render } from "../parser/index.js";
import { validate, type Diagnostic, type ValidateOptions } from "../parser/validate.js";
import { TOOL_RULES, includes } from "../parser/builtins.js";
import type { Agent, Arg, CallStage, Loc, ParseResult, PipelineDeclaration, PipelineStage, PolicyDeclaration, SchemaDeclaration, ToolDeclaration, UseDeclaration, Value } from "../parser/types.js";
import { normalizePackageName, parsePackageName, qualifiedProvider, type ModelSlot, type PackageResolver, type ResolvedPackage } from "../registry/contract.js";
import { displayText, isQualified } from "./names.js";
import { dirnameOf, isInside, joinPath, normalizePath, relativePath } from "./paths.js";

export { bareName, displayName, displayText, isQualified } from "./names.js";
export { analyzePackage, type PackageAnalysis, type ToolEffectSummary } from "./analyze.js";

export interface LinkOptions {
  /** A file's text, or undefined when it doesn't exist. Paths are POSIX, as joined from the entry path. */
  readFile(path: string): string | undefined;
  /** Finds installed packages. Without one, any package `use` is an error. */
  resolver?: PackageResolver;
  /**
   * halo.json `models`: slot → model id, or a slot object ({ description, suggested }), whose
   * `suggested` model is used. A package's own halo.json has the second form, so its tests run.
   */
  projectModels?: Record<string, string | ModelSlot>;
  /** The project folder, for the internal names of other project files. Default: the entry file's folder. */
  root?: string;
  /** The entry file's text, when it isn't saved yet (an editor buffer). */
  source?: string;
}

export interface LinkDiagnostic extends Diagnostic {
  /** The file the problem is in (as passed to readFile). */
  file: string;
}

export interface LinkedFile {
  path: string;
  /** The package the file belongs to; undefined for the project's own files. */
  package?: string;
  /** For a package file: whether it is one of the package's exports. */
  exported?: boolean;
}

export interface LinkedProgram {
  /** The entry file's path. */
  entry: string;
  /**
   * Every declaration, merged. The entry file's keep their names; the rest are qualified.
   * `program.names` maps qualified names to display names; `program.uses` are the entry file's.
   * `program.errors` holds syntax errors from any file (prefixed with the file when it isn't the entry).
   */
  program: ParseResult;
  /** Problems found while linking (missing files, unknown imports, collisions, unfilled model slots). */
  diagnostics: LinkDiagnostic[];
  /** Every file loaded, entry first. */
  files: LinkedFile[];
  /** Every package loaded. */
  packages: ResolvedPackage[];
  /** Qualified internal name → display name (same object as program.names). */
  names: Record<string, string>;
  /** The names the entry file imports, by local name: what each is and where it's declared (for editors). */
  imports: Record<string, ImportedName>;
  /** False when there are syntax errors or link errors. */
  ok: boolean;
}

export interface ImportedName {
  /** The name it's declared as (before any `as`). */
  name: string;
  /** Its internal name in the linked program. */
  qualified: string;
  kind: Kind;
  /** The `use` line's string: "./shared.halo" or "@acme/support-kit". */
  from: string;
  /** Where it's declared (a package provider: the package's halo.json). */
  file?: string;
  line?: number;
  column?: number;
}

export type Kind = "pipeline" | "agent" | "tool" | "store" | "schema" | "policy" | "provider";

interface Sym {
  qualified: string;
  kind: Kind;
  name: string;
  /** Where it was declared, for messages. */
  file?: string;
  loc?: Loc;
}

interface Unit {
  path: string;
  pkg?: ResolvedPackage;
  /** Path relative to the package folder (or the project root). */
  rel: string;
  /** Prefix for qualified names; null for the entry file. */
  prefix: string | null;
  exported: boolean;
  ast: ParseResult;
  own: Map<string, Sym>;
  imports: Map<string, Sym & { from: string }>;
}

interface PackageState {
  resolved: ResolvedPackage;
  exports: Map<string, Sym>;
  units: Unit[];
}

interface Binding {
  model: string;
  unit: Unit;
  loc?: Loc;
}

const isRelative = (s: string) => s.startsWith("./") || s.startsWith("../");

/** Link an entry file and everything it uses. See the module comment. */
export function link(entry: string, options: LinkOptions): LinkedProgram {
  return new Linker(entry, options).run();
}

/** The names `use "<source>" { ... }` in the file `from` could import, with their kinds (for editors). */
export function importableNames(from: string, source: string, options: LinkOptions): Array<{ name: string; kind: Kind }> {
  return new Linker(from, options).importable(source);
}

/** The pipelines that are the program's entry points: the entry file's own (not imported ones). */
export function entryPipelines(program: ParseResult): PipelineDeclaration[] {
  return program.pipelines.filter((p) => !isQualified(p.name));
}

/**
 * Everything wrong with a linked program: syntax errors, link errors, and the validator's
 * diagnostics, each with the file it's in and with display names in its message. Warnings
 * from installed packages are left out (they're the publisher's to fix); errors are kept.
 */
export function checkLinked(linked: LinkedProgram, options: ValidateOptions = {}): LinkDiagnostic[] {
  const out: LinkDiagnostic[] = [...linked.diagnostics];
  if (linked.program.errors.length) return out;
  const providers = linked.packages.flatMap((p) => Object.keys(p.manifest.providers ?? {}).map((name) => qualifiedProvider(p.name, name)));
  const packageFiles = new Set(linked.files.filter((f) => f.package).map((f) => f.path));
  const diags = validate(linked.program, { ...options, toolProviders: [...(options.toolProviders ?? []), ...providers] });
  for (const d of diags) {
    const file = d.file ?? linked.entry;
    if (d.severity === "warning" && packageFiles.has(file)) continue;
    out.push({ ...d, message: displayText(linked.names, d.message), ...(d.token ? { token: displayText(linked.names, d.token) } : {}), file });
  }
  return out;
}

class Linker {
  private units = new Map<string, Unit>();
  private order: Unit[] = [];
  private loading: string[] = [];
  private packages = new Map<string, PackageState | null>();
  private bindings = new Map<string, Map<string, Binding>>();
  private diagnostics: LinkDiagnostic[] = [];
  private syntaxErrors: string[] = [];
  private root: string;
  private entry: string;
  /** Qualified name → the local name the entry file imported it as. */
  private entryAliases = new Map<string, string>();
  private phantoms = new Map<string, string>();

  constructor(entry: string, private options: LinkOptions) {
    this.entry = normalizePath(entry);
    this.root = normalizePath(options.root ?? dirnameOf(this.entry));
  }

  private report(severity: Diagnostic["severity"], file: string, message: string, loc?: Loc): void {
    this.diagnostics.push({ severity, message, file, ...(loc ? { line: loc.line, column: loc.column } : {}) });
  }

  run(): LinkedProgram {
    const source = this.options.source ?? this.options.readFile(this.entry);
    if (source === undefined) {
      this.report("error", this.entry, `File not found: ${this.entry}`);
    } else {
      this.load(this.entry, undefined, relativePath(this.root, this.entry), source);
    }
    const program = this.merge();
    const files: LinkedFile[] = this.order.map((u) => ({ path: u.path, ...(u.pkg ? { package: u.pkg.name, exported: u.exported } : {}) }));
    const packages = [...this.packages.values()].filter((p): p is PackageState => !!p).map((p) => p.resolved);
    const ok = !program.errors.length && !this.diagnostics.some((d) => d.severity === "error");
    const imports: Record<string, ImportedName> = {};
    for (const [local, s] of this.units.get(this.entry)?.imports ?? []) {
      imports[local] = { name: s.name, qualified: s.qualified, kind: s.kind, from: s.from, ...(s.file ? { file: s.file } : {}), ...(s.loc ? { line: s.loc.line, column: s.loc.column } : {}) };
    }
    return { entry: this.entry, program, diagnostics: this.diagnostics, files, packages, names: program.names!, imports, ok };
  }

  /** What `use "<src>" { ... }` in the entry file could import (for editors' completions). */
  importable(src: string): Array<{ name: string; kind: Kind }> {
    const unit: Unit = { path: this.entry, rel: relativePath(this.root, this.entry), prefix: null, exported: false, ast: parse(""), own: new Map(), imports: new Map() };
    this.units.set(this.entry, unit);
    let syms: Iterable<Sym> = [];
    if (isRelative(src)) {
      const target = joinPath(dirnameOf(this.entry), src);
      const t = target === this.entry ? undefined : this.load(target, undefined, relativePath(this.root, target));
      syms = t?.own.values() ?? [];
    } else if (parsePackageName(normalizePackageName(src))) {
      syms = this.loadPackage(normalizePackageName(src), unit, { source: src })?.exports.values() ?? [];
    }
    return [...syms].map((s) => ({ name: s.name, kind: s.kind }));
  }

  // ── Loading ──

  private load(path: string, pkg: ResolvedPackage | undefined, rel: string, text?: string): Unit | undefined {
    const known = this.units.get(path);
    if (known) return known;
    const source = text ?? this.options.readFile(path);
    if (source === undefined) return undefined;
    const ast = parse(source);
    const isEntry = path === this.entry && !pkg;
    const exported = !!pkg && (pkg.manifest.exports ?? []).some((e) => normalizePath(e) === normalizePath(rel));
    const stem = normalizePath(rel).replace(/\.halo$/, "");
    const prefix = isEntry ? null : pkg ? (exported ? pkg.name : `${pkg.name}/${stem}`) : stem;
    const unit: Unit = { path, pkg, rel, prefix, exported, ast, own: new Map(), imports: new Map() };
    this.units.set(path, unit);
    this.order.push(unit);
    if (ast.errors.length) {
      for (const e of ast.errors) this.syntaxErrors.push(isEntry ? e : `${path}: ${e}`);
      for (const e of ast.errors) {
        const m = e.match(/^\[(\d+):(\d+)\] (.*)$/s);
        this.report("error", path, m ? m[3]! : e, m ? { line: Number(m[1]), column: Number(m[2]) } : undefined);
      }
      return unit;
    }
    const declare = (kind: Kind, list: Array<{ name: string; loc?: Loc }>) => {
      for (const d of list) if (!unit.own.has(d.name)) unit.own.set(d.name, { qualified: this.qualify(unit, d.name), kind, name: d.name, file: path, loc: d.loc });
    };
    declare("pipeline", ast.pipelines);
    declare("agent", ast.agents);
    declare("tool", ast.tools);
    declare("store", ast.stores);
    declare("schema", ast.schemas);
    declare("policy", ast.policies);
    this.loading.push(path);
    for (const use of ast.uses ?? []) this.use(unit, use);
    this.loading.pop();
    return unit;
  }

  private qualify(unit: Unit, name: string): string {
    return unit.prefix === null ? name : `${unit.prefix}#${name}`;
  }

  private use(unit: Unit, use: UseDeclaration): void {
    const src = use.source;
    const where = (m: string) => this.report("error", unit.path, m, use.loc);
    let importable: Map<string, Sym>;
    let missing: (name: string) => string;
    if (isRelative(src)) {
      if (!src.endsWith(".halo")) return where(`use "${src}": a path must name a .halo file`);
      if (use.models?.length) where(`use "${src}": with models(...) is for packages; the project's own agents get their models from halo.json "models"`);
      const target = joinPath(dirnameOf(unit.path), src);
      if (unit.pkg && !isInside(unit.pkg.dir, target)) return where(`use "${src}": a package can only use files inside it`);
      const cycle = this.loading.indexOf(target);
      if (cycle >= 0) {
        const chain = [...this.loading.slice(cycle), target].map((p) => this.label(p));
        return where(`use "${src}" makes a cycle: ${chain.join(" → ")}. Move what both files need into a third file`);
      }
      const rel = unit.pkg ? relativePath(unit.pkg.dir, target) : relativePath(this.root, target);
      const t = this.load(target, unit.pkg, rel);
      if (!t) return where(`use "${src}": file not found (${target})`);
      importable = t.own;
      missing = (name) => `use "${src}": ${src} has no declaration "${name}"${t.own.size ? ` (it declares ${[...t.own.keys()].join(", ")})` : ""}`;
    } else if (src.startsWith("/") || src.startsWith(".")) {
      return where(`use "${src}": write a relative path ("./file.halo", "../shared/file.halo") or a package name ("@acme/support-kit")`);
    } else {
      const name = normalizePackageName(src);
      if (!parsePackageName(name)) return where(`use "${src}": not a package name like "@acme/support-kit" or a path like "./shared.halo"`);
      if (unit.pkg?.name === name) return where(`use "${src}": a package can't use itself; use its files by relative path`);
      if (unit.pkg && !Object.hasOwn(unit.pkg.manifest.dependencies ?? {}, name)) {
        return where(`use "${src}": ${name} is not in ${unit.pkg.name}'s dependencies (add it to "dependencies" in its halo.json)`);
      }
      const state = this.loadPackage(name, unit, use);
      if (!state) return;
      for (const b of use.models ?? []) this.bind(name, b.slot, b.model, unit, b.loc ?? use.loc, state.resolved);
      importable = state.exports;
      missing = (n) => this.privateMessage(src, state, n);
    }
    for (const item of use.items ?? []) {
      const loc = item.loc ?? use.loc;
      const sym = importable.get(item.name);
      if (!sym) {
        this.report("error", unit.path, missing(item.name), loc);
        continue;
      }
      const local = item.as ?? item.name;
      const own = unit.own.get(local);
      if (own) {
        this.report("error", unit.path, `"${local}" is imported from "${src}" and also declared in this file; rename the import: { ${item.name} as Other${item.name} }`, loc);
        continue;
      }
      const prev = unit.imports.get(local);
      if (prev && prev.qualified !== sym.qualified) {
        this.report("error", unit.path, `"${local}" is imported from both "${prev.from}" and "${src}"; rename one: { ${item.name} as Other${item.name} }`, loc);
        continue;
      }
      unit.imports.set(local, { ...sym, from: src });
      if (unit.prefix === null && sym.qualified !== local) this.entryAliases.set(sym.qualified, local);
    }
  }

  /** Why a name isn't importable from a package: private (and where it is), or not there at all. */
  private privateMessage(src: string, state: PackageState, name: string): string {
    const pkg = state.resolved;
    const exportsList = (pkg.manifest.exports ?? []).join(", ") || "none";
    const privateUnit = state.units.find((u) => !u.exported && u.own.has(name));
    if (privateUnit) {
      return `use "${src}": "${name}" is private to ${pkg.name} (declared in ${privateUnit.rel}, which isn't exported). A package exports only the declarations in its exported files: ${exportsList}`;
    }
    const names = [...state.exports.keys()];
    return `use "${src}": ${pkg.name} doesn't export "${name}"${names.length ? ` (it exports ${names.join(", ")})` : ""}`;
  }

  private loadPackage(name: string, unit: Unit, use: UseDeclaration): PackageState | undefined {
    if (this.packages.has(name)) {
      const known = this.packages.get(name);
      if (known === null) this.report("error", unit.path, `use "${use.source}": ${name} is used again while it is still loading (packages that use each other make a cycle)`, use.loc);
      return known ?? undefined;
    }
    const resolved = this.options.resolver?.resolve(name, unit.pkg);
    if (!resolved) {
      const fix = unit.pkg ? `it is a dependency of ${unit.pkg.name}; run halo install` : `run halo add ${name}`;
      this.report("error", unit.path, `use "${use.source}": package ${name} is not installed (${fix})`, use.loc);
      return undefined;
    }
    this.packages.set(name, null);
    const state: PackageState = { resolved, exports: new Map(), units: [] };
    const manifestPath = joinPath(resolved.dir, "halo.json");
    for (const file of resolved.manifest.exports ?? []) {
      const path = joinPath(resolved.dir, file);
      const u = this.load(path, resolved, normalizePath(file));
      if (!u) {
        this.report("error", manifestPath, `${name}: exported file ${file} is missing from the installed package`);
        continue;
      }
      for (const sym of u.own.values()) {
        const prev = state.exports.get(sym.name);
        if (prev && prev.qualified === sym.qualified && prev.file !== sym.file) {
          this.report("error", u.path, `${name}: "${sym.name}" is declared in two exported files (${this.label(prev.file!)} and ${this.label(u.path)}); exported files share the package's names`, sym.loc);
        } else if (!prev) state.exports.set(sym.name, sym);
      }
    }
    for (const provider of Object.keys(resolved.manifest.providers ?? {})) {
      if (state.exports.has(provider)) {
        this.report("error", manifestPath, `${name}: "${provider}" is both a provider and a declaration in an exported file`);
        continue;
      }
      state.exports.set(provider, { qualified: qualifiedProvider(name, provider), kind: "provider", name: provider, file: manifestPath });
    }
    state.units = this.order.filter((u) => u.pkg?.name === name);
    this.packages.set(name, state);
    return state;
  }

  private bind(pkgName: string, slot: string, model: string, unit: Unit, loc: Loc | undefined, pkg: ResolvedPackage): void {
    const slots = pkg.manifest.models ?? {};
    if (!Object.hasOwn(slots, slot)) {
      const have = Object.keys(slots);
      this.report("warning", unit.path, `with models(${slot}: ...): ${pkgName} has no model slot "${slot}"${have.length ? ` (it has ${have.join(", ")})` : " (it has none)"}`, loc);
    }
    const map = this.bindings.get(pkgName) ?? new Map<string, Binding>();
    this.bindings.set(pkgName, map);
    const prev = map.get(slot);
    if (prev && prev.model !== model) {
      this.report("error", unit.path, `${pkgName}'s model slot "${slot}" is bound to ${prev.model} in ${this.label(prev.unit.path)}${prev.loc ? `:${prev.loc.line}` : ""} and to ${model} here; bind it in one place`, loc);
      return;
    }
    if (!prev) map.set(slot, { model, unit, loc });
  }

  private label(path: string): string {
    const u = this.units.get(path);
    if (u?.pkg) return `${u.pkg.name}/${u.rel}`;
    return relativePath(this.root, path);
  }

  // ── Resolving names ──

  /** A name as written in `unit`, as the merged program knows it. */
  private resolve(unit: Unit, name: string): string {
    const own = unit.own.get(name) ?? unit.imports.get(name);
    if (own) return own.qualified;
    // A name this file doesn't declare or import is left alone: a built-in (System, Bash, String),
    // or a mistake validate reports. In another file it must not reach the entry file's names.
    if (unit.prefix !== null && this.entryNames().has(name)) {
      const phantom = `${unit.prefix}#${name}`;
      this.phantoms.set(phantom, name);
      return phantom;
    }
    return name;
  }

  private entryNamesCache?: Set<string>;
  private entryNames(): Set<string> {
    return (this.entryNamesCache ??= new Set(this.units.get(this.entry)?.own.keys() ?? []));
  }

  private known(unit: Unit, name: string): boolean {
    return unit.own.has(name) || unit.imports.has(name);
  }

  private resolveProvider(unit: Unit, name: string): string {
    const sym = unit.imports.get(name);
    if (sym) return sym.qualified;
    return name;
  }

  private resolveType(unit: Unit, type: string): string {
    return type.replace(/[A-Za-z_][\w.]*/g, (t) => (this.known(unit, t) ? this.resolve(unit, t) : t));
  }

  /** A ref value whose first part is a declared name (`tools: [Desk]`, `yield(Slack)`) names that declaration. */
  private resolveValue(unit: Unit, v: Value): Value {
    if (v.kind === "ref" && this.known(unit, v.path[0]!)) return { ...v, path: [this.resolve(unit, v.path[0]!), ...v.path.slice(1)] };
    if (v.kind === "list") return { ...v, items: v.items.map((i) => this.resolveValue(unit, i)) };
    return v;
  }

  private resolveArgs<T extends { argList: Arg[]; args?: string[]; namedArgs?: Record<string, string> }>(unit: Unit, x: T): T {
    const argList = x.argList.map((a) => ({ ...a, value: this.resolveValue(unit, a.value) }));
    const out = { ...x, argList };
    if (x.args) out.args = argList.filter((a) => !a.name).map((a) => render(a.value));
    if (x.namedArgs) out.namedArgs = Object.fromEntries(argList.filter((a) => a.name).map((a) => [a.name!, render(a.value)]));
    return out;
  }

  // ── Model slots ──

  private slotModel(unit: Unit, slot: string, depth = 0): string | undefined {
    if (depth > 8) return undefined;
    if (unit.pkg) {
      const b = this.bindings.get(unit.pkg.name)?.get(slot);
      if (b) return b.model.startsWith("models.") ? this.slotModel(b.unit, b.model.slice("models.".length), depth + 1) : b.model;
    }
    const project = this.options.projectModels?.[slot];
    if (typeof project === "string") return project;
    if (project && typeof project === "object" && typeof project.suggested === "string") return project.suggested;
    return undefined;
  }

  private agentModel(unit: Unit, agent: Agent): string {
    if (!agent.modelId.startsWith("models.")) return agent.modelId;
    const slot = agent.modelId.slice("models.".length);
    const model = this.slotModel(unit, slot);
    if (model) return model;
    if (unit.pkg) {
      const spec = unit.pkg.manifest.models?.[slot];
      const about = spec ? ` ${unit.pkg.name} says it ${spec.description.replace(/^./, (c) => c.toLowerCase()).replace(/\.$/, "")}.` : "";
      const suggested = spec?.suggested ?? "<model id>";
      this.report(
        "error",
        unit.path,
        `Agent "${agent.name}" in ${unit.pkg.name} needs a model for slot "${slot}", and none is given.${about} Fill it where you use the package: use "${unit.pkg.name}" { ... } with models(${slot}: ${suggested}), or in halo.json: "models": { "${slot}": "${suggested}" }`,
        agent.loc,
      );
    } else {
      this.report("error", unit.path, `Agent "${agent.name}" uses model slot "${slot}", which has no model; add it to halo.json: "models": { "${slot}": "<model id>" }`, agent.loc);
    }
    return agent.modelId;
  }

  // ── Rewriting ──

  private merge(): ParseResult {
    const program: ParseResult = { policies: [], tools: [], stores: [], schemas: [], agents: [], pipelines: [], errors: this.syntaxErrors, uses: this.units.get(this.entry)?.ast.uses ?? [] };
    if (this.syntaxErrors.length) {
      program.names = {};
      return program;
    }
    for (const unit of this.order) {
      const ast = unit.ast;
      const file = unit.path;
      program.policies.push(...ast.policies.map((p) => withFile(this.policy(unit, p), file)));
      program.tools.push(...ast.tools.map((t) => withFile(this.tool(unit, t), file)));
      program.stores.push(...ast.stores.map((t) => withFile(this.tool(unit, t), file)));
      program.schemas.push(...ast.schemas.map((s) => withFile(this.schema(unit, s), file)));
      program.agents.push(...ast.agents.map((a) => withFile(this.agent(unit, a), file)));
      program.pipelines.push(...ast.pipelines.map((p) => withFile(this.pipeline(unit, p), file)));
    }
    program.names = this.displayNames();
    return program;
  }

  private policy(unit: Unit, p: PolicyDeclaration): PolicyDeclaration {
    const rules = p.rules.map((r) => {
      if (!includes(TOOL_RULES, r.name) || r.name.endsWith("Effects")) return r;
      const patterns = r.name === "DenyArgs" ? 1 : r.args.length;
      return { ...r, args: r.args.map((a, i) => (i < patterns ? this.resolvePattern(unit, a) : a)) };
    });
    return { ...p, name: this.resolve(unit, p.name), rules, rawRules: rules.map((r) => `${r.name}(${r.args.join(", ")})`) };
  }

  /** `Desk`, `Desk.get_ticket`, `Desk.*`: a tool pattern in a policy. */
  private resolvePattern(unit: Unit, pattern: string): string {
    const dot = pattern.indexOf(".");
    const root = dot < 0 ? pattern : pattern.slice(0, dot);
    return this.known(unit, root) ? this.resolve(unit, root) + (dot < 0 ? "" : pattern.slice(dot)) : pattern;
  }

  private tool(unit: Unit, t: ToolDeclaration): ToolDeclaration {
    return { ...this.resolveArgs(unit, t), name: this.resolve(unit, t.name), provider: this.resolveProvider(unit, t.provider) };
  }

  private schema(unit: Unit, s: SchemaDeclaration): SchemaDeclaration {
    return { ...s, name: this.resolve(unit, s.name), fields: s.fields.map((f) => ({ ...f, type: this.resolveType(unit, f.type) })) };
  }

  private agent(unit: Unit, a: Agent): Agent {
    const params = Object.fromEntries(Object.entries(a.params).map(([k, v]) => [k, /^[A-Za-z_]\w*$/.test(v) && this.known(unit, v) ? this.resolve(unit, v) : v]));
    const out: Agent = { ...a, name: this.resolve(unit, a.name), modelId: this.agentModel(unit, a), params };
    if (a.equips) out.equips = a.equips.map((n) => this.resolve(unit, n));
    if (a.requires) out.requires = a.requires.map((n) => this.resolve(unit, n));
    if (a.directives) out.directives = a.directives.map((d) => this.directive(unit, d));
    return out;
  }

  private directive(unit: Unit, d: NonNullable<Agent["directives"]>[number]) {
    if (d.name !== "shadow" && d.name !== "cascade") return d;
    const parts = d.value ? d.value.split(/\s*,\s*/) : [];
    return { ...d, value: parts.map((p) => (this.known(unit, p) ? this.resolve(unit, p) : p)).join(", ") };
  }

  private pipeline(unit: Unit, p: PipelineDeclaration): PipelineDeclaration {
    return {
      ...p,
      name: this.resolve(unit, p.name),
      params: p.params.map((x) => ({ ...x, type: this.resolveType(unit, x.type) })),
      returnType: this.resolveType(unit, p.returnType),
      pipeline: p.pipeline.map((s) => this.stage(unit, s)),
    };
  }

  private call(unit: Unit, c: CallStage): CallStage {
    const out = this.resolveArgs(unit, c);
    const isBuiltin = c.callee === "System" || (c.callee === "Thread" && !this.known(unit, "Thread"));
    const callee = isBuiltin ? c.callee : this.resolve(unit, c.callee);
    return callee === c.callee ? out : { ...out, callee, alias: c.alias ?? c.callee };
  }

  private stage(unit: Unit, s: PipelineStage): PipelineStage {
    switch (s.kind) {
      case "expression":
        return { ...s, expr: this.resolveValue(unit, s.expr) };
      case "call":
        return this.call(unit, s);
      case "fanout":
        return { ...s, stages: s.stages.map((c) => this.call(unit, c)) };
      case "branch":
        return { ...s, arms: s.arms.map((a) => ({ ...a, call: this.call(unit, a.call) })) };
      case "each":
        return { ...s, list: this.resolveValue(unit, s.list), call: this.call(unit, s.call) };
      case "interrupt":
        return this.resolveArgs(unit, s);
      case "loop": {
        const target = this.resolve(unit, s.target);
        return target === s.target ? s : { ...s, target, alias: s.target };
      }
      default:
        return s;
    }
  }

  // ── Display names ──

  /**
   * What people see for each qualified name: the name the entry file imported it as, else its
   * own name. When two things would show the same name (or one an entry file name), they keep
   * their qualified names, so a mock or a message can't mean two things.
   */
  private displayNames(): Record<string, string> {
    const wanted = new Map<string, string>();
    for (const unit of this.order) {
      if (unit.prefix === null) continue;
      for (const sym of unit.own.values()) wanted.set(sym.qualified, this.entryAliases.get(sym.qualified) ?? sym.name);
    }
    for (const state of this.packages.values()) {
      for (const sym of state?.exports.values() ?? []) if (sym.kind === "provider") wanted.set(sym.qualified, this.entryAliases.get(sym.qualified) ?? sym.name);
    }
    const count = new Map<string, number>();
    for (const name of this.entryNames()) count.set(name, 1);
    for (const d of wanted.values()) count.set(d, (count.get(d) ?? 0) + 1);
    const names: Record<string, string> = {};
    for (const [q, d] of wanted) names[q] = count.get(d)! > 1 ? q : d;
    for (const [q, d] of this.phantoms) names[q] = d;
    return names;
  }
}

/** Set `loc.file` on a declaration and everything in it that has a location. */
function withFile<T>(decl: T, file: string): T {
  const visit = (x: unknown): unknown => {
    if (Array.isArray(x)) return x.map(visit);
    if (!x || typeof x !== "object") return x;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(x)) out[k] = k === "loc" && v && typeof v === "object" ? { ...(v as Loc), file } : visit(v);
    return out;
  };
  return visit(decl) as T;
}
