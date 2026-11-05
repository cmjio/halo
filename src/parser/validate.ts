/**
 * Semantic validation for a parsed Halo program.
 *
 * `parse()` only checks syntax. `validate()` checks that names resolve, that
 * agents are equipped with the tools they use, that `requires` policies exist,
 * and flags constructs the runtime cannot enforce.
 */

import type { Agent, Arg, CallStage, CondExpr, Loc, ParseResult, PipelineStage, PipelineDeclaration, SchemaDeclaration, Value } from "./types.js";
import {
  BLOCK_CATEGORIES,
  CONTEXT_NAMESPACES,
  DIRECTIVES,
  ENFORCED_RULES,
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
import { sandboxProblem } from "../runtime/sandbox-agents.js";

export interface Diagnostic {
  severity: "error" | "warning";
  message: string;
  line?: number;
  column?: number;
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

  constructor(private ast: ParseResult, private options: ValidateOptions) {
    this.agents = new Map(ast.agents.map((m) => [m.name, m]));
    this.tools = new Map([...ast.tools, ...ast.stores].map((t) => [t.name, t]));
    this.policies = new Map(ast.policies.map((g) => [g.name, g]));
    this.pipelines = new Map(ast.pipelines.map((s) => [s.name, s]));
  }

  private isDeclaredName(name: string): boolean {
    return this.agents.has(name) || this.tools.has(name) || this.policies.has(name) || this.pipelines.has(name);
  }

  private add(severity: Diagnostic["severity"], message: string, loc?: Loc) {
    this.diags.push({ severity, message, ...(loc ? { line: loc.line, column: loc.column } : {}) });
  }

  run(): Diagnostic[] {
    this.checkDuplicates();
    for (const g of this.ast.policies) this.checkPolicy(g);
    for (const t of this.tools.values()) {
      const known = includes(TOOL_PROVIDERS, t.provider) || this.options.toolProviders?.includes(t.provider);
      if (!known) this.add("warning", `Tool "${t.name}" uses unknown provider "${t.provider}" (register it with runtime.registerToolProvider)`, t.loc);
    }
    for (const m of this.ast.agents) this.checkAgent(m);
    for (const sc of this.ast.schemas) this.checkSchema(sc);
    for (const s of this.ast.pipelines) this.checkPipeline(s);
    const seen = new Set<string>();
    this.diags = this.diags.filter((d) => {
      const key = `${d.severity}|${d.line}|${d.message}`;
      return !seen.has(key) && !!seen.add(key);
    });
    return this.diags.sort((a, b) => (a.line ?? 0) - (b.line ?? 0) || (a.column ?? 0) - (b.column ?? 0));
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
      } else if (includes(TOOL_RULES, rule.name)) {
        this.checkToolRule(g, rule);
      } else if ((rule.name === "MaxWords" || rule.name === "MaxChars" || rule.name === "MaxTokens" || rule.name === "MaxSpend") && !(Number(rule.args[0]) >= 0)) {
        this.add("error", `Policy "${g.name}": ${rule.name} needs a numeric limit`, g.loc);
      }
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
      const tool = pattern.split(".")[0]!;
      if (tool !== "*" && !this.tools.has(tool)) this.add("warning", `Policy "${g.name}": ${rule.name}(${pattern}) names "${tool}", which is not a declared tool`, g.loc);
    }
  }

  private checkAgent(m: ParseResult["agents"][number]) {
    for (const r of m.requires ?? []) {
      if (!this.policies.has(r)) this.add("error", `Agent "${m.name}" requires undefined policy "${r}"`, m.loc);
    }
    for (const e of m.equips ?? []) {
      if (!this.tools.has(e)) this.add("error", `Agent "${m.name}" equips undefined tool "${e}"`, m.loc);
    }
    const sandbox = sandboxProblem(m, this.tools);
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
    }
  }

  private checkDirective(d: { name: string; value: string }, loc: Loc | undefined, on: "agent" | "pipeline") {
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
    if (d.name === "checkpoint" && on === "agent") this.add("warning", `@checkpoint only applies to pipelines`, loc);
    if (d.name === "thread" && on === "agent") this.add("warning", `@thread only applies to pipelines`, loc);
    if (d.name === "thread" && (args.length < 1 || args.length > 2)) this.add("error", `@thread needs the input that keys the thread, and optionally a thread name, e.g. @thread(user_id) or @thread(user_id, Support)`, loc);
  }

  private checkSchema(sc: SchemaDeclaration) {
    const names = new Set<string>();
    for (const f of sc.fields) {
      if (names.has(f.name)) this.add("error", `Schema "${sc.name}": duplicate field "${f.name}"`, sc.loc);
      names.add(f.name);
      for (const t of f.type.split(/[<>,\s]+/).filter(Boolean)) {
        if (!includes(SCHEMA_TYPES, t) && !this.ast.schemas.some((x) => x.name === t)) {
          this.add("warning", `Schema "${sc.name}": field "${f.name}" has unknown type "${t}" (use ${SCHEMA_TYPES.join(", ")}, or another schema)`, sc.loc);
        }
      }
    }
  }

  // ── Pipelines ──

  private checkPipeline(s: PipelineDeclaration) {
    for (const d of s.directives) this.checkDirective(d, s.loc, "pipeline");
    const thread = s.directives.find((d) => d.name === "thread");
    const keyParam = thread?.value.split(/\s*,\s*/)[0];
    if (keyParam && !s.params.some((p) => p.name === keyParam)) {
      this.add("error", `Pipeline "${s.name}": @thread(${keyParam}) keys the thread by an input, but "${keyParam}" is not a parameter`, s.loc);
    }

    const params = new Set(s.params.map((p) => p.name));
    // Names available under context.data as the pipeline progresses.
    const data = new Set<string>(params);

    s.pipeline.forEach((stage, i) => {
      // `as __proto__` would replace context.data's prototype instead of naming a result.
      for (const key of producedKeys(stage)) {
        if (UNSAFE_NAMES.has(key)) this.add("error", `Pipeline "${s.name}": "${key}" can't be used as a name (as ${key})`, stage.loc);
      }
      if (stage.kind === "expression") {
        if (stage.expr.kind === "ref" && !params.has(stage.expr.path[0]!)) {
          this.add("error", `Pipeline "${s.name}": undefined variable "${stage.expr.path[0]}"`, stage.loc);
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
        }
      }
      return;
    }
    const tool = this.tools.get(call.callee);
    if (tool) {
      if (tool.provider === "Bash") this.checkShell(call, where);
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
    else if (v.kind === "list") for (const item of v.items) this.checkValue(item, s, params, data, loc);
    else if (v.kind === "string") this.checkTemplate(v.value, s, params, data, loc);
  }

  private checkTemplate(text: string, s: PipelineDeclaration, params: Set<string>, data: Set<string>, loc?: Loc) {
    for (const [, expr] of text.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)) {
      const path = expr!.split(".");
      if (path[0] === "context") {
        this.checkContextRef(path.slice(1), s, data, loc);
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
      return [stage.target, ...(stage.bind ? [stage.bind] : [])];
    case "listen":
      return [stage.target.split(".")[0]!, ...(stage.bind ? [stage.bind] : [])];
    case "interrupt":
      return ["yield", ...(stage.bind ? [stage.bind] : [])];
    default:
      return [];
  }
}

/** A call's result is stored at `context.data.<Callee>.<method>` and `context.data.<method>`. */
function callKeys(call: CallStage): string[] {
  if (call.callee === "System" || (call.callee === "Thread" && includes(THREAD_METHODS, call.method))) return [];
  return call.method ? [call.callee, call.method] : [call.callee];
}

const UNSAFE_NAMES = new Set(["__proto__", "prototype", "constructor"]);

function validRegex(pattern: string): boolean {
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}

