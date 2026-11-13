/**
 * Semantic validation for a parsed Halo program.
 *
 * `parse()` only checks syntax. `validate()` checks that names resolve, that
 * agents are equipped with the tools they use, that `requires` policies exist,
 * and flags constructs the runtime cannot enforce.
 *
 * Types are checked where they are written down: every type name must be a
 * built-in or a declared schema, a field read from a schema-typed parameter
 * must be one of the schema's fields, and a value passed to a pipeline must
 * match the parameter's type when the validator can tell what it is (a literal,
 * or another parameter). Model answers can't be known ahead of time, so the
 * runtime checks a pipeline's output against its return type.
 */

import type { Agent, Arg, CallStage, CondExpr, Loc, ParseResult, PipelineStage, PipelineDeclaration, SchemaDeclaration, Value } from "./types.js";
import {
  BLOCK_CATEGORIES,
  CONTEXT_NAMESPACES,
  DIRECTIVES,
  ENFORCED_RULES,
  HOST_PATTERN,
  RESERVED_SECRET,
  SECRET_NAME,
  scopePath,
  REDACT_CATEGORIES,
  REQUIRE_CHECKS,
  SCHEMA_TYPES,
  SYSTEM_EVENTS,
  SYSTEM_METHODS,
  THREAD_METHODS,
  TOOL_PROVIDERS,
  UNENFORCED_RULES,
  TOOL_RULES,
  TOOL_EFFECTS,
  includes,
  parseDuration,
} from "./builtins.js";
import { PRESET_NAMES, findPreset } from "../runtime/presets.js";
import { sandboxChoice, sandboxProblem } from "../runtime/sandbox-agents.js";
import { PARAMETERISED_SQL_PROVIDERS, sqlArgProblem } from "./sql.js";
import { parseCondition } from "./index.js";
import { splitToolPath } from "../linker/names.js";

export interface Diagnostic {
  severity: "error" | "warning";
  message: string;
  line?: number;
  column?: number;
  /** The text the problem is about (a type or field name), on or after `line`, so editors can underline it. */
  token?: string;
  /** The file it's in, for a linked program (from the declaration's `loc.file`). */
  file?: string;
}

export interface ValidateOptions {
  /** Extra tool providers registered at runtime (suppresses "unknown provider" warnings). */
  toolProviders?: string[];
  /** Extra System methods registered at runtime. */
  systemMethods?: string[];
  /** Model prefixes that have an adapter; when given, agents with no matching adapter are flagged. */
  canHandleModel?: (modelId: string) => boolean;
}

export function validate(ast: ParseResult, options: ValidateOptions = {}): Diagnostic[] {
  return new Validator(ast, options).run();
}

class Validator {
  private diags: Diagnostic[] = [];
  private agents: Map<string, ParseResult["agents"][number]>;
  private tools: Map<string, ParseResult["tools"][number]>;
  private policies: Map<string, ParseResult["policies"][number]>;
  private pipelines: Map<string, PipelineDeclaration>;
  private schemas: Map<string, SchemaDeclaration>;

  constructor(private ast: ParseResult, private options: ValidateOptions) {
    this.agents = new Map(ast.agents.map((m) => [m.name, m]));
    this.tools = new Map([...ast.tools, ...ast.stores].map((t) => [t.name, t]));
    this.policies = new Map(ast.policies.map((g) => [g.name, g]));
    this.pipelines = new Map(ast.pipelines.map((s) => [s.name, s]));
    this.schemas = new Map(ast.schemas.map((sc) => [sc.name, sc]));
    // `sandbox: "docker"` (etc.) makes a tool named <Agent>Sandbox, which policies may name.
    for (const a of ast.agents) {
      const choice = sandboxChoice(a);
      if (choice.kind === "service") this.sandboxTools.add(choice.tool);
    }
  }

  private sandboxTools = new Set<string>();

  private isDeclaredName(name: string): boolean {
    return this.agents.has(name) || this.tools.has(name) || this.policies.has(name) || this.pipelines.has(name);
  }

  private add(severity: Diagnostic["severity"], message: string, loc?: Loc, token?: string) {
    this.diags.push({ severity, message, ...(loc ? { line: loc.line, column: loc.column } : {}), ...(token ? { token } : {}), ...(loc?.file ? { file: loc.file } : {}) });
  }

  run(): Diagnostic[] {
    this.checkDuplicates();
    for (const g of this.ast.policies) this.checkPolicy(g);
    for (const t of this.tools.values()) {
      const known = includes(TOOL_PROVIDERS, t.provider) || this.options.toolProviders?.includes(t.provider);
      if (!known) this.add("warning", `Tool "${t.name}" uses unknown provider "${t.provider}" (register it with runtime.registerToolProvider)`, t.loc);
      if (t.provider === "SQLite") this.checkSqliteTool(t);
      if (t.provider === "Remote") this.checkRemoteSecrets(t);
    }
    for (const m of this.ast.agents) this.checkAgent(m);
    for (const sc of this.ast.schemas) this.checkSchema(sc);
    for (const s of this.ast.pipelines) this.checkPipeline(s);
    const seen = new Set<string>();
    this.diags = this.diags.filter((d) => {
      const key = `${d.severity}|${d.file ?? ""}|${d.line}|${d.message}`;
      return !seen.has(key) && !!seen.add(key);
    });
    return this.diags.sort((a, b) => (a.line ?? 0) - (b.line ?? 0) || (a.column ?? 0) - (b.column ?? 0));
  }

  /** A SQLite database file is relative to the project folder and stays inside it. */
  private checkSqliteTool(t: { name: string; argList: Arg[]; loc?: Loc }) {
    const path = t.argList.find((a) => !a.name)?.value ?? t.argList.find((a) => a.name === "path")?.value;
    if (path?.kind !== "string" || path.value === ":memory:") return;
    const p = path.value;
    // Walk the segments (no node:path: the validator also runs in the browser playground).
    let depth = 0;
    const climbs = p.split(/[\\/]/).some((seg) => (depth += seg === ".." ? -1 : seg === "." || seg === "" ? 0 : 1) < 0);
    if (/^([\\/~]|[a-zA-Z]:)/.test(p) || climbs) {
      this.add("error", `Tool "${t.name}": SQLite database "${p}" must be a path inside the project folder (relative, not climbing out with ..)`, t.loc);
    }
  }

  private checkDuplicates() {
    const seen = new Map<string, string>();
    const decls: Array<[string, string, Loc | undefined]> = [
      ...this.ast.policies.map((d) => ["policy", d.name, d.loc] as [string, string, Loc | undefined]),
      ...this.ast.tools.map((d) => ["tool", d.name, d.loc] as [string, string, Loc | undefined]),
      ...this.ast.stores.map((d) => ["store", d.name, d.loc] as [string, string, Loc | undefined]),
      ...this.ast.schemas.map((d) => ["schema", d.name, d.loc] as [string, string, Loc | undefined]),
      ...this.ast.agents.map((d) => ["agent", d.name, d.loc] as [string, string, Loc | undefined]),
      ...this.ast.pipelines.map((d) => ["pipeline", d.name, d.loc] as [string, string, Loc | undefined]),
    ];
    for (const [kind, name, loc] of decls) {
      if (name === "System" || name === "Env") this.add("error", `"${name}" is reserved and cannot be declared`, loc);
      const prev = seen.get(name);
      if (prev) this.add("error", `Duplicate declaration "${name}" (already declared as ${prev})`, loc);
      else seen.set(name, kind);
    }
  }

  private checkPolicy(g: ParseResult["policies"][number]) {
    for (const rule of g.rules) {
      if (includes(UNENFORCED_RULES, rule.name)) {
        this.add("warning", `Policy "${g.name}": ${rule.name}(...) is not enforced by the runtime yet`, g.loc);
      } else if (!includes(ENFORCED_RULES, rule.name)) {
        this.add("warning", `Policy "${g.name}": unknown rule ${rule.name}(...) is ignored`, g.loc);
      } else if (rule.name === "Block" || rule.name === "Redact") {
        const known: readonly string[] = rule.name === "Block" ? BLOCK_CATEGORIES : REDACT_CATEGORIES;
        for (const cat of rule.args) {
          if (!known.includes(cat)) this.add("warning", `Policy "${g.name}": ${rule.name}(${cat}) is not a detectable category and is not enforced`, g.loc);
        }
      } else if (rule.name === "Require" && !rule.args.every((a) => includes(REQUIRE_CHECKS, a))) {
        this.add("warning", `Policy "${g.name}": Require(${rule.args.join(", ")}) is not enforced; only Require(${REQUIRE_CHECKS.join(" | ")}) is checked`, g.loc);
      } else if (rule.name === "Validate" && rule.args.length !== 3) {
        this.add("error", `Policy "${g.name}": Validate needs a field, an operator, and a value, e.g. Validate("amount", "<=", "context.data.limit")`, g.loc);
      } else if (rule.name === "Enforce" && !rule.args.every((a) => a.toUpperCase() === "JSON")) {
        this.add("warning", `Policy "${g.name}": Enforce(${rule.args.join(", ")}) is not enforced; only Enforce(JSON) is checked`, g.loc);
      } else if (rule.name === "MatchRegex" && !validRegex(rule.args[0] ?? "")) {
        this.add("error", `Policy "${g.name}": MatchRegex(${rule.args[0] ?? ""}) is not a valid regular expression`, g.loc);
      } else if (rule.name === "AllowHosts") {
        if (!rule.args.length) this.add("error", `Policy "${g.name}": AllowHosts(...) needs at least one host, e.g. AllowHosts("pypi.org", "*.pythonhosted.org")`, g.loc);
        for (const h of rule.args) if (!HOST_PATTERN.test(h)) this.add("error", `Policy "${g.name}": AllowHosts(${h}) is not a host name like "pypi.org" or "*.pythonhosted.org"`, g.loc);
      } else if (rule.name === "AllowFiles") {
        if (!rule.args.length) this.add("error", `Policy "${g.name}": AllowFiles(...) needs at least one folder or file, e.g. AllowFiles("src/billing", "test/billing")`, g.loc);
        for (const f of rule.args) if (scopePath(f) === undefined) this.add("error", `Policy "${g.name}": AllowFiles(${f}) should be a path inside the project, like "src/billing" (no leading /, no ..)`, g.loc);
      } else if (rule.name === "AllowSecrets") {
        if (!rule.args.length) this.add("error", `Policy "${g.name}": AllowSecrets(...) needs at least one name, e.g. AllowSecrets("STRIPE_TEST_KEY")`, g.loc);
        for (const n of rule.args) {
          if (!SECRET_NAME.test(n)) this.add("error", `Policy "${g.name}": AllowSecrets(${n}) should be an environment variable name, like STRIPE_TEST_KEY`, g.loc);
          else if (RESERVED_SECRET.test(n)) this.add("error", `Policy "${g.name}": AllowSecrets(${n}): ${n} can't be a secret; it changes how the sandbox or Docker itself runs`, g.loc);
        }
      } else if (includes(TOOL_RULES, rule.name)) {
        this.checkToolRule(g, rule);
      } else if ((rule.name === "MaxWords" || rule.name === "MaxChars" || rule.name === "MaxTokens" || rule.name === "MaxSpend") && !(Number(rule.args[0]) >= 0)) {
        this.add("error", `Policy "${g.name}": ${rule.name} needs a numeric limit`, g.loc);
      }
    }
  }

  /** A Remote's secrets: names environment variables; Env.X there would hand over the value itself. */
  private checkRemoteSecrets(t: ParseResult["tools"][number]) {
    const arg = t.argList.find((a) => a.name === "secrets");
    if (!arg) return;
    const items = arg.value.kind === "list" ? arg.value.items : [arg.value];
    for (const v of items) {
      if (v.kind !== "string") this.add("error", `Tool "${t.name}": secrets: lists names in quotes, like secrets: ["STRIPE_TEST_KEY"]; ${v.kind === "ref" && v.path[0] === "Env" ? `Env.${v.path.slice(1).join(".")} is the value, not the name` : "each entry is a string"}`, t.loc);
      else if (!SECRET_NAME.test(v.value)) this.add("error", `Tool "${t.name}": secrets: "${v.value}" should be an environment variable name, like STRIPE_TEST_KEY`, t.loc);
      else if (RESERVED_SECRET.test(v.value)) this.add("error", `Tool "${t.name}": secrets: ${v.value} can't be a secret; it changes how the sandbox or Docker itself runs`, t.loc);
    }
  }

  /** Tool rules name tools by pattern ("Repo", "Repo.create_pr", "Repo.*") or effects (read, write, external). */
  private checkToolRule(g: ParseResult["policies"][number], rule: { name: string; args: string[] }) {
    const args = rule.args;
    if (!args.length) return this.add("error", `Policy "${g.name}": ${rule.name}(...) needs at least one ${rule.name.endsWith("Effects") ? "effect" : "tool"}`, g.loc);
    if (rule.name === "AllowEffects" || rule.name === "ApproveEffects") {
      for (const e of args) if (!includes(TOOL_EFFECTS, e)) this.add("error", `Policy "${g.name}": ${rule.name}(${e}): effects are ${TOOL_EFFECTS.join(", ")}`, g.loc);
      return;
    }
    if (rule.name === "DenyArgs") {
      if (args.length !== 2 && args.length !== 3) this.add("error", `Policy "${g.name}": DenyArgs needs a tool pattern, optionally an argument name, and a regular expression, e.g. DenyArgs("Shell.run", "command", "rm\\s+-rf")`, g.loc);
      else if (!validRegex(args.at(-1)!)) this.add("error", `Policy "${g.name}": DenyArgs(${rule.args.at(-1)}) is not a valid regular expression`, g.loc);
    }
    const patterns = rule.name === "DenyArgs" ? args.slice(0, 1) : args;
    for (const pattern of patterns) {
      const tool = splitToolPath(pattern).tool;
      if (tool !== "*" && !this.tools.has(tool) && !this.sandboxTools.has(tool)) this.add("warning", `Policy "${g.name}": ${rule.name}(${pattern}) names "${tool}", which is not a declared tool`, g.loc);
    }
  }

  private checkAgent(m: ParseResult["agents"][number]) {
    for (const r of m.requires ?? []) {
      if (!this.policies.has(r)) this.add("error", `Agent "${m.name}" requires undefined policy "${r}"`, m.loc);
    }
    for (const e of m.equips ?? []) {
      if (!this.tools.has(e)) this.add("error", `Agent "${m.name}" equips undefined tool "${e}"`, m.loc);
    }
    const sandbox = sandboxProblem(m, this.tools, this.policies);
    if (sandbox) this.add("error", sandbox, m.loc);
    if (m.params.preset !== undefined && !findPreset(m.params.preset)) {
      this.add("error", `Agent "${m.name}": unknown preset "${m.params.preset}" (use ${PRESET_NAMES.join(", ")})`, m.loc);
    }
    if (this.options.canHandleModel && !this.options.canHandleModel(m.modelId)) {
      this.add("warning", `Agent "${m.name}": no adapter handles model "${m.modelId}"`, m.loc);
    }
    for (const d of m.directives ?? []) {
      this.checkDirective(d, m.loc, "agent");
      if (d.name === "shadow") {
        const target = d.value;
        if (target === m.name) this.add("error", `Agent "${m.name}" cannot shadow itself`, m.loc);
        else if (!this.agents.has(target) && !/[-/]/.test(target)) {
          this.add("warning", `@shadow(${target}) on "${m.name}": "${target}" is not a defined agent or model, so it will never run`, m.loc);
        }
      }
      if (d.name === "cascade") {
        const seen = new Set([m.modelId]);
        for (const target of d.value ? d.value.split(/\s*,\s*/).filter(Boolean) : []) {
          const model = this.agents.get(target)?.modelId ?? target;
          if (!this.agents.has(target) && !/[-/]/.test(target)) {
            this.add("error", `@cascade(${d.value}) on "${m.name}": "${target}" is not a model id or a defined agent`, m.loc);
          } else if (seen.has(model)) {
            this.add("warning", `@cascade on "${m.name}": "${model}" is already ${model === m.modelId ? "the agent's own model" : "earlier in the cascade"}, so it adds nothing`, m.loc);
          } else if (this.options.canHandleModel && !this.options.canHandleModel(model)) {
            this.add("warning", `@cascade on "${m.name}": no adapter handles model "${model}"`, m.loc);
          }
          seen.add(model);
        }
      }
    }
  }

  private checkDirective(d: { name: string; value: string; args?: string[] }, loc: Loc | undefined, on: "agent" | "pipeline") {
    if (!includes(DIRECTIVES, d.name)) {
      this.add("warning", `Unknown directive @${d.name} is ignored`, loc);
      return;
    }
    const args = d.value ? d.value.split(/\s*,\s*/) : [];
    if (d.name === "timeout" && !(args.length === 1 && parseDuration(args[0]!) > 0)) {
      this.add("error", `@timeout needs one duration, e.g. @timeout(30s)`, loc);
    }
    if (d.name === "retry") {
      const [count, delay] = args;
      if (!count || !/^\d+$/.test(count) || (delay !== undefined && !(parseDuration(delay) >= 0))) {
        this.add("error", `@retry needs a count and optional delay, e.g. @retry(3, 2s)`, loc);
      }
    }
    if (d.name === "shadow" && args.length !== 1) this.add("error", `@shadow needs exactly one target`, loc);
    if (d.name === "shadow" && on === "pipeline") this.add("warning", `@shadow only applies to agents`, loc);
    if (d.name === "cascade" && !args.length) this.add("error", `@cascade needs at least one model to move up to, e.g. @cascade(anthropic/claude-opus-4-5)`, loc);
    if (d.name === "cascade" && on === "pipeline") this.add("warning", `@cascade only applies to agents`, loc);
    if (d.name === "checkpoint" && on === "agent") this.add("warning", `@checkpoint only applies to pipelines`, loc);
    if (d.name === "thread" && on === "agent") this.add("warning", `@thread only applies to pipelines`, loc);
    if (d.name === "expect") {
      if (on === "agent") this.add("warning", `@expect only applies to pipelines`, loc);
      if (!d.args?.length) this.add("error", `@expect needs at least one condition, e.g. @expect("output.labels.length <= 3")`, loc);
      for (const text of d.args ?? []) {
        const parsed = parseCondition(text);
        if (parsed.errors.length) this.add("error", `@expect condition "${text}" is not valid: ${parsed.errors.join("; ")}`, loc);
      }
    }
    if (d.name === "thread" && (args.length < 1 || args.length > 2)) this.add("error", `@thread needs the input that keys the thread, and optionally a thread name, e.g. @thread(user_id) or @thread(user_id, Support)`, loc);
  }

  private checkSchema(sc: SchemaDeclaration) {
    const names = new Set<string>();
    for (const f of sc.fields) {
      if (names.has(f.name)) this.add("error", `Schema "${sc.name}": duplicate field "${f.name}"`, sc.loc);
      names.add(f.name);
      this.checkTypeName(f.type, `Schema "${sc.name}": field "${f.name}"`, sc.loc);
    }
  }

  /**
   * Every name in a written type (`Array<Profile>`) should be a built-in type or a declared schema.
   * A near miss of one (`Numbr`, `Profil`) is an error. Any other name is a warning: it documents
   * the value but isn't checked, as `Report` or `GitHub.PullRequest` often do.
   */
  private checkTypeName(type: string, what: string, loc?: Loc) {
    const known = [...SCHEMA_TYPES, ...this.schemas.keys()];
    for (const t of type.split(/[<>,\s]+/).filter(Boolean)) {
      if (known.includes(t)) continue;
      const near = known.find((k) => nearMiss(t, k));
      if (near) this.add("error", `${what}: "${t}" is not a type; did you mean "${near}"?`, loc, t);
      else this.add("warning", `${what}: "${t}" is not a declared schema, so it isn't checked (declare \`schema ${t} { ... }\`, or use ${SCHEMA_TYPES.join(", ")})`, loc, t);
    }
  }

  // ── Types of values in a pipeline ──

  /** The declared type of `path` read from a parameter (`p`, `p.address.city`), or undefined if it isn't a parameter. Reports fields the schema doesn't have. */
  private paramPathType(path: string[], s: PipelineDeclaration, loc?: Loc, report = true): string | undefined {
    const param = s.params.find((p) => p.name === path[0]);
    if (!param) return undefined;
    let type = param.type;
    for (const [i, field] of path.slice(1).entries()) {
      const schema = this.schemas.get(baseType(type));
      if (!schema) return ""; // not a schema (Object, Any, ...): fields aren't known
      const f = schema.fields.find((x) => x.name === field);
      if (!f) {
        if (!report) return "";
        const read = path.slice(0, i + 2).join(".");
        this.add("error", `Pipeline "${s.name}": ${read}: "${field}" is not a field of ${schema.name} (it has ${schema.fields.map((x) => x.name).join(", ") || "no fields"})`, loc, read);
        return "";
      }
      type = f.type;
    }
    return type;
  }

  /** The type of a value as written, when the validator can tell: a literal, or a parameter (`p.age`, `context.input.p.age`). */
  private valueType(v: Value, s: PipelineDeclaration): string {
    switch (v.kind) {
      case "string":
        return "String";
      case "number":
        return Number.isInteger(v.value) ? "Integer" : "Number";
      case "bool":
        return "Boolean";
      case "list":
        return "List";
      case "ref":
        return this.paramPathType(v.path, s, undefined, false) ?? "";
      case "context":
        return v.path[0] === "input" ? (this.paramPathType(v.path.slice(1), s, undefined, false) ?? "") : "";
      default:
        return "";
    }
  }

  /** A pipeline call's arguments against the callee's parameter types. */
  private checkCallTypes(call: CallStage, callee: PipelineDeclaration, s: PipelineDeclaration) {
    const positional = call.argList.filter((a) => !a.name);
    for (const arg of call.argList) {
      const param = arg.name ? callee.params.find((p) => p.name === arg.name) : callee.params[positional.indexOf(arg)];
      if (!param) continue;
      const given = this.valueType(arg.value, s);
      const fraction = arg.value.kind === "number" && !Number.isInteger(arg.value.value) && baseType(param.type) === "Integer";
      if (fraction || !this.assignable(given, param.type)) {
        this.add("error", `Pipeline "${s.name}": ${callee.name}(...) passes ${article(baseType(given))} to "${param.name}", which is ${article(baseType(param.type))}`, call.loc, arg.name ? `${arg.name}:` : undefined);
      }
    }
  }

  /** Whether a value of type `from` can go where `to` is declared. Unknown or unchecked types always can. */
  private assignable(from: string, to: string): boolean {
    const a = kindOf(baseType(from), this.schemas);
    const b = kindOf(baseType(to), this.schemas);
    if (a === "any" || b === "any") return true;
    if (a === b) return a !== "schema" || baseType(from) === baseType(to);
    // A Number may hold a whole number; only a written 1.5 is known not to (see checkCallTypes).
    if ((a === "integer" && b === "number") || (a === "number" && b === "integer")) return true;
    if (a === "schema" && b === "object") return true;
    if (a === "object" && b === "schema") return true;
    return false;
  }

  // ── Pipelines ──

  private checkPipeline(s: PipelineDeclaration) {
    for (const d of s.directives) this.checkDirective(d, s.loc, "pipeline");
    const thread = s.directives.find((d) => d.name === "thread");
    const keyParam = thread?.value.split(/\s*,\s*/)[0];
    if (keyParam && !s.params.some((p) => p.name === keyParam)) {
      this.add("error", `Pipeline "${s.name}": @thread(${keyParam}) keys the thread by an input, but "${keyParam}" is not a parameter`, s.loc);
    }

    for (const p of s.params) if (p.type) this.checkTypeName(p.type, `Pipeline "${s.name}": parameter "${p.name}"`, s.loc);
    if (s.returnType) this.checkTypeName(s.returnType, `Pipeline "${s.name}": return type`, s.loc);

    const params = new Set(s.params.map((p) => p.name));
    // Names available under context.data as the pipeline progresses.
    const data = new Set<string>(params);

    s.pipeline.forEach((stage, i) => {
      // `as __proto__` would replace context.data's prototype instead of naming a result.
      for (const key of producedKeys(stage)) {
        if (UNSAFE_NAMES.has(key)) this.add("error", `Pipeline "${s.name}": "${key}" can't be used as a name (as ${key})`, stage.loc);
      }
      // `as msg` on a parameter would hide it in {{msg}} but not in a bare `msg` argument, so it is refused.
      for (const key of boundNames(stage)) {
        if (params.has(key)) this.add("error", `Pipeline "${s.name}": \`as ${key}\` reuses the parameter name "${key}"; pick a new name`, stage.loc);
      }
      if (stage.kind === "expression") {
        if (stage.expr.kind === "ref" && !params.has(stage.expr.path[0]!)) {
          this.add("error", `Pipeline "${s.name}": undefined variable "${stage.expr.path[0]}"`, stage.loc);
        } else if (stage.expr.kind === "ref") {
          this.paramPathType(stage.expr.path, s, stage.loc);
        } else if (stage.expr.kind === "context") {
          this.checkContextRef(stage.expr.path, s, data, stage.loc);
        }
        if (i !== 0) this.add("error", `Pipeline "${s.name}": an expression can only start a pipeline`, stage.loc);
        return;
      }
      if (stage.kind === "loop" && this.agents.has(stage.target) && !s.pipeline.slice(0, i).some((x) => x.kind === "call" && x.callee === stage.target)) {
        this.add("error", `Pipeline "${s.name}": loop(${stage.target}, ...) needs an earlier ${stage.target} stage to go back to`, stage.loc);
      }
      this.checkStage(stage, s, params, data);
      for (const key of producedKeys(stage)) data.add(key);
    });
  }

  private checkStage(stage: Exclude<PipelineStage, { kind: "expression" }>, s: PipelineDeclaration, params: Set<string>, data: Set<string>) {
    switch (stage.kind) {
      case "call":
        this.checkCall(stage, s, params, data);
        break;
      case "fanout":
        for (const sub of stage.stages) this.checkCall(sub, s, params, data);
        break;
      case "branch":
        stage.arms.forEach((arm, i) => {
          if (arm.expr) this.checkCond(arm.expr, s, params, data, stage.loc);
          else if (i !== stage.arms.length - 1) this.add("error", `Pipeline "${s.name}": the else arm must come last in a branch`, arm.call.loc);
          this.checkCall(arm.call, s, params, data);
        });
        break;
      case "each": {
        this.checkValue(stage.list, s, params, data, stage.loc);
        if (params.has(stage.item) || this.isDeclaredName(stage.item)) {
          this.add("error", `Pipeline "${s.name}": each(${stage.item} in ...) reuses the name "${stage.item}"; pick a new loop variable`, stage.loc);
        }
        for (const o of stage.options) {
          if (o.name !== "concurrency" && o.name !== "limit") this.add("warning", `Pipeline "${s.name}": each(...) has no option "${o.name ?? "(positional)"}" (use concurrency: n or limit: n)`, stage.loc);
        }
        // The loop variable and its index are visible only inside the call.
        this.checkCall(stage.call, s, params, new Set([...data, stage.item, "index"]));
        break;
      }
      case "gate":
        this.checkCond(stage.expr, s, params, data, stage.loc);
        break;
      case "loop":
        if (!this.agents.has(stage.target)) this.add("error", `Pipeline "${s.name}": loop(${stage.target}, ...) needs an agent to retry with, but "${stage.target}" is not an agent`, stage.loc);
        for (const e of stage.conditionErrors ?? []) this.add("error", `Pipeline "${s.name}": loop condition "${stage.condition}" is not valid: ${e}`, stage.loc);
        if (stage.expr) this.checkCond(stage.expr, s, params, data, stage.loc);
        for (const o of stage.options) {
          if (o.name !== "max") this.add("warning", `Pipeline "${s.name}": loop(...) has no option "${o.name ?? "(positional)"}" (only max: n)`, stage.loc);
          else if (o.value.kind !== "number" ? ["string", "bool", "null", "list"].includes(o.value.kind) : !Number.isInteger(o.value.value) || o.value.value < 1) {
            this.add("error", `Pipeline "${s.name}": loop(${stage.target}, ...) max must be a whole number of at least 1`, stage.loc);
          }
        }
        break;
      case "interrupt":
        this.checkArgs(stage.argList, s, params, data, stage.loc);
        break;
      case "listen":
        if (stage.targetValue.kind === "context") this.checkContextRef(stage.targetValue.path, s, data, stage.loc);
        break;
    }
  }

  private checkCall(call: CallStage, s: PipelineDeclaration, params: Set<string>, data: Set<string>) {
    const where = `Pipeline "${s.name}"`;
    const target = `${call.callee}${call.method ? "." + call.method : ""}`;
    // An agent's `tools: [A, B]` names tools, not values.
    const isAgent = this.agents.has(call.callee);
    this.checkArgs(isAgent ? call.argList.filter((a) => a.name !== "tools") : call.argList, s, params, data, call.loc);

    if (call.callee === "System") {
      const known = includes(SYSTEM_METHODS, call.method) || includes(SYSTEM_EVENTS, call.method) || this.options.systemMethods?.includes(call.method);
      if (!known) this.add("error", `${where}: unknown System method "${call.method}"`, call.loc);
      else this.checkSystem(call, where);
      return;
    }
    // A declared `Thread` (a tool, say) takes the name over from the built-in.
    if (call.callee === "Thread" && !this.declared("Thread")) {
      if (!includes(THREAD_METHODS, call.method)) this.add("error", `${where}: unknown Thread method "${call.method}" (use ${THREAD_METHODS.join(", ")})`, call.loc);
      else if (call.method !== "clear" && !call.argList.some((a) => a.name && a.name !== "keep")) {
        this.add("error", `${where}: Thread.${call.method} takes fields by name, e.g. Thread.${call.method}(${call.method === "set" ? "summary: context.data.summary" : "messages: context.data.reply, keep: 20"})`, call.loc);
      } else if (call.method !== "append" && call.argList.some((a) => a.name === "keep")) this.add("warning", `${where}: keep: only applies to Thread.append`, call.loc);
      this.needsThread(s, `Thread.${call.method}`, call.loc);
      return;
    }
    if (!call.method) {
      const callee = this.pipelines.get(call.callee);
      if (!callee) this.add("error", `${where}: "${call.callee}(...)" is not a defined pipeline`, call.loc);
      else {
        if (call.callee === s.name) this.add("warning", `${where}: calls itself recursively`, call.loc);
        // With no arguments, the flowing value fills the first parameter.
        const positional = call.argList.filter((a) => !a.name).length;
        const missing = callee.params.filter((p, i) => (call.argList.length ? i >= positional : i > 0) && !call.argList.some((a) => a.name === p.name));
        if (missing.length) this.add("warning", `${where}: ${call.callee}(...) is called without ${missing.map((p) => `"${p.name}"`).join(", ")}`, call.loc);
        this.checkCallTypes(call, callee, s);
      }
      return;
    }

    const agent = this.agents.get(call.callee);
    if (agent) {
      this.checkToolset(agent, call, where);
      const toolArg = call.argList.find((a) => a.name === "tool");
      if (toolArg) {
        const toolName = toolArg.value.kind === "ref" ? toolArg.value.path.join(".") : undefined;
        if (!toolName || !this.tools.has(toolName)) {
          this.add("error", `${where}: ${target} uses undefined tool "${toolName ?? "?"}"`, call.loc);
        } else if (!agent.equips?.includes(toolName)) {
          this.add("error", `${where}: agent "${agent.name}" is not equipped with tool "${toolName}" (add \`equips ${toolName}\`)`, call.loc);
        } else if (PARAMETERISED_SQL_PROVIDERS.has(this.tools.get(toolName)!.provider)) {
          this.checkSql(this.tools.get(toolName)!, call, where, false);
        }
      }
      return;
    }
    const tool = this.tools.get(call.callee);
    if (tool) {
      if (tool.provider === "Bash") this.checkShell(call, where);
      if (PARAMETERISED_SQL_PROVIDERS.has(tool.provider)) this.checkSql(tool, call, where, true);
      return;
    }
    if (call.implicit && this.pipelines.has(call.callee)) return;
    this.add("error", `${where}: unknown callee "${call.callee}" in ${target}(...)`, call.loc);
  }

  /** `tools: [A, B]` on an agent call (or `tools: auto` on the agent): each must be a declared tool the agent equips. */
  private checkToolset(agent: Agent, call: CallStage, where: string) {
    const arg = call.argList.find((a) => a.name === "tools");
    if (!arg) return;
    const items = arg.value.kind === "list" ? arg.value.items : [arg.value];
    for (const v of items) {
      const name = v.kind === "ref" ? v.path.join(".") : v.kind === "string" ? v.value : undefined;
      if (name === "auto" || name === "all" || name === "none") continue;
      if (!name || !this.tools.has(name)) this.add("error", `${where}: ${agent.name}.${call.method} has tools: naming "${name ?? "?"}", which is not a declared tool`, call.loc);
      else if (!agent.equips?.includes(name)) this.add("error", `${where}: agent "${agent.name}" is not equipped with tool "${name}" (add \`equips ${name}\`)`, call.loc);
    }
    const steps = call.argList.find((a) => a.name === "max_steps");
    if (steps && !(steps.value.kind === "number" && steps.value.value >= 0)) this.add("error", `${where}: max_steps needs a number`, call.loc);
  }

  /** A SQLite call: parameterised SQL only, and execute only on a tool declared with write: true. */
  private checkSql(tool: { name: string; argList: Arg[] }, call: CallStage, where: string, positional: boolean) {
    const problem = sqlArgProblem(call.argList, positional);
    if (problem) this.add("error", `${where}: ${call.callee}.${call.method}: ${problem}`, call.loc);
    const write = tool.argList.find((a) => a.name === "write")?.value;
    if (call.method === "execute" && !(write?.kind === "bool" && write.value)) {
      this.add("error", `${where}: ${call.callee}.execute changes the database, but tool "${tool.name}" isn't declared with write: true`, call.loc);
    }
  }

  /**
   * The runtime escapes each {{placeholder}} in a Bash command for where it sits,
   * so the shell reads the value as data. Warn where nothing can: a command that
   * isn't written out, or one that runs a value as code.
   */
  private checkShell(call: CallStage, where: string) {
    const arg = call.argList.find((a) => a.name === "command");
    if (!arg) return;
    const target = `${call.callee}.${call.method}`;
    const warn = (why: string) => this.add("warning", `${where}: ${target} ${why}`, call.loc);
    if (arg.value.kind !== "string") {
      warn("runs a command that isn't written in the pipeline, so nothing in it is quoted; write the command as a string with {{placeholders}}");
      return;
    }
    const cmd = arg.value.value;
    if (/\b(?:eval|(?:ba|z|da)?sh\s+-c)\s+\{\{/.test(cmd) || /\{\{[^}]*\}\}[^\n;&]*\|\s*(?:ba|z|da)?sh\b/.test(cmd)) warn("runs a {{placeholder}}'s value as shell code (eval, sh -c, or | sh); pass it as data instead");
  }

  /** System calls whose arguments are wrong in a way the runtime would only find when it gets there. */
  private checkSystem(call: CallStage, where: string) {
    const positional = call.argList.filter((a) => !a.name);
    if (call.method === "Value" && call.argList.length !== 1) this.add("error", `${where}: System.Value takes exactly one value, e.g. System.Value(context.data.review)`, call.loc);
    if (call.method === "Pick" && !call.argList.some((a) => a.name === "fields") && positional.length < 2) {
      this.add("error", `${where}: System.Pick needs fields, e.g. System.Pick(context.data.x, fields: ["id", "user.login"])`, call.loc);
    }
    const first = positional[0]?.value;
    if (call.method === "Sleep" && (!first || ((first.kind === "string" || first.kind === "duration") && !(parseDuration(first.kind === "string" ? first.value : first.raw) >= 0)))) {
      this.add("error", `${where}: System.Sleep needs a duration, e.g. System.Sleep(2s)`, call.loc);
    }
  }

  private checkArgs(args: Arg[], s: PipelineDeclaration, params: Set<string>, data: Set<string>, loc?: Loc) {
    for (const a of args) this.checkValue(a.value, s, params, data, loc);
  }

  private checkValue(v: Value, s: PipelineDeclaration, params: Set<string>, data: Set<string>, loc?: Loc) {
    if (v.kind === "context") this.checkContextRef(v.path, s, data, loc);
    else if (v.kind === "ref") this.paramPathType(v.path, s, loc);
    else if (v.kind === "list") for (const item of v.items) this.checkValue(item, s, params, data, loc);
    else if (v.kind === "string") this.checkTemplate(v.value, s, params, data, loc);
  }

  private checkTemplate(text: string, s: PipelineDeclaration, params: Set<string>, data: Set<string>, loc?: Loc) {
    for (const [, expr] of text.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)) {
      const path = expr!.split(".");
      if (path[0] === "context") {
        this.checkContextRef(path.slice(1), s, data, loc);
      } else if (params.has(path[0]!)) {
        this.paramPathType(path, s, loc);
      } else if (path[0] !== "current" && !params.has(path[0]!) && !data.has(path[0]!) && path[0] !== "Env") {
        this.add("warning", `Pipeline "${s.name}": template {{${expr}}} does not match a parameter or an earlier result`, loc);
      }
    }
  }

  private checkCond(c: CondExpr, s: PipelineDeclaration, params: Set<string>, data: Set<string>, loc?: Loc) {
    switch (c.kind) {
      case "or":
      case "and":
        for (const t of c.terms) this.checkCond(t, s, params, data, loc);
        break;
      case "not":
        this.checkCond(c.expr, s, params, data, loc);
        break;
      case "compare":
        this.checkCond(c.left, s, params, data, loc);
        this.checkCond(c.right, s, params, data, loc);
        break;
      case "value":
        if (c.value.kind === "context") this.checkContextRef(c.value.path, s, data, loc);
        else if (c.value.kind === "ref" && c.value.path[0] === "Env") {
          this.add("error", `Pipeline "${s.name}": ${c.value.path.join(".")} can only be used in tool declarations, not in a condition`, loc);
        } else if (c.value.kind === "ref" && !params.has(c.value.path[0]!) && !data.has(c.value.path[0]!)) {
          this.add("warning", `Pipeline "${s.name}": "${c.value.path.join(".")}" in a gate is not a parameter or result; it compares as a string`, loc);
        } else if (c.value.kind === "ref") {
          this.paramPathType(c.value.path, s, loc);
        }
        break;
    }
  }

  private declared(name: string): boolean {
    return [this.ast.tools, this.ast.stores, this.ast.agents, this.ast.pipelines].some((list) => list.some((d) => d.name === name));
  }

  /** Thread state belongs to a `@thread` pipeline's run, which shares it with the pipelines it calls. */
  private needsThread(s: PipelineDeclaration, what: string, loc?: Loc) {
    if (s.directives.some((d) => d.name === "thread")) return;
    if (this.ast.pipelines.some((p) => p.directives.some((d) => d.name === "thread"))) return;
    this.add("error", `Pipeline "${s.name}": ${what} needs a thread; add @thread(<input>) to the pipeline, e.g. @thread(user_id)`, loc);
  }

  private checkContextRef(path: string[], s: PipelineDeclaration, data: Set<string>, loc?: Loc) {
    const [ns, key] = path;
    if (ns === undefined) return;
    if (!includes(CONTEXT_NAMESPACES, ns)) {
      this.add("warning", `Pipeline "${s.name}": context.${ns} is not a context namespace (use ${CONTEXT_NAMESPACES.map((n) => "context." + n).join(", ")})`, loc);
      return;
    }
    if (ns === "thread") this.needsThread(s, "context.thread", loc);
    if (key === undefined) return;
    if (ns === "data" && !data.has(key)) {
      this.add("warning", `Pipeline "${s.name}": context.data.${key} is never set before it is read (bind a result with \`as ${key}\`)`, loc);
    }
    if (ns === "input" && !s.params.some((p) => p.name === key)) {
      this.add("warning", `Pipeline "${s.name}": context.input.${key} is not a parameter of this pipeline`, loc);
    } else if (ns === "input") {
      this.paramPathType(path.slice(1), s, loc);
    }
  }
}

/** Keys a stage writes under `context.data`. */
export function producedKeys(stage: PipelineStage): string[] {
  switch (stage.kind) {
    case "call":
      return [...callKeys(stage), ...(stage.bind ? [stage.bind] : [])];
    case "fanout":
      return [...stage.stages.flatMap((s) => [...callKeys(s), ...(s.bind ? [s.bind] : [])]), ...(stage.bind ? [stage.bind] : [])];
    case "branch":
      return [...stage.arms.flatMap((a) => callKeys(a.call)), ...(stage.bind ? [stage.bind] : [])];
    case "each":
      return [...callKeys(stage.call), ...(stage.bind ? [stage.bind] : [])];
    case "loop":
      return [stage.alias ?? stage.target, ...(stage.bind ? [stage.bind] : [])];
    case "listen":
      return [stage.target.split(".")[0]!, ...(stage.bind ? [stage.bind] : [])];
    case "interrupt":
      return ["yield", ...(stage.bind ? [stage.bind] : [])];
    default:
      return [];
  }
}

/** Names a stage binds with `as`, including on fanout items. */
function boundNames(stage: PipelineStage): string[] {
  const inner = stage.kind === "fanout" ? stage.stages.flatMap((s) => (s.bind ? [s.bind] : [])) : [];
  return [...inner, ...("bind" in stage && stage.bind ? [stage.bind] : [])];
}

/** A call's result is stored at `context.data.<Callee>.<method>` and `context.data.<method>`. */
function callKeys(call: CallStage): string[] {
  if (call.callee === "System" || (call.callee === "Thread" && includes(THREAD_METHODS, call.method))) return [];
  const callee = call.alias ?? call.callee;
  return call.method ? [callee, call.method] : [callee];
}

const UNSAFE_NAMES = new Set(["__proto__", "prototype", "constructor"]);

/** `Array<String>` → `Array` */
function baseType(type: string): string {
  const lt = type.indexOf("<");
  return (lt < 0 ? type : type.slice(0, lt)).trim();
}

type Kind = "string" | "number" | "integer" | "boolean" | "list" | "object" | "schema" | "any";

/** What a type name accepts, folding aliases (List = Array, JSON = Map = Object). Unknown and unchecked types are "any". */
function kindOf(base: string, schemas: Map<string, SchemaDeclaration>): Kind {
  switch (base) {
    case "String":
      return "string";
    case "Number":
      return "number";
    case "Integer":
      return "integer";
    case "Boolean":
      return "boolean";
    case "Array":
    case "List":
      return "list";
    case "Object":
    case "JSON":
    case "Map":
      return "object";
  }
  return schemas.has(base) ? "schema" : "any";
}

/** A likely typo: the same name in another case, or within an edit or two (one for short names). */
function nearMiss(written: string, known: string): boolean {
  if (written.toLowerCase() === known.toLowerCase()) return true;
  const limit = Math.min(written.length, known.length) <= 4 ? 1 : 2;
  if (Math.abs(written.length - known.length) > limit) return false;
  let prev = Array.from({ length: known.length + 1 }, (_, j) => j);
  for (let i = 1; i <= written.length; i++) {
    const row = [i];
    for (let j = 1; j <= known.length; j++) {
      row[j] = Math.min(prev[j]! + 1, row[j - 1]! + 1, prev[j - 1]! + (written[i - 1] === known[j - 1] ? 0 : 1));
    }
    prev = row;
  }
  return prev[known.length]! <= limit;
}

function article(type: string): string {
  return `${/^[AEIOU]/.test(type) ? "an" : "a"} ${type}`;
}

function validRegex(pattern: string): boolean {
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}

