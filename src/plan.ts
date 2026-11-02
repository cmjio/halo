/**
 * `halo plan`: what a pipeline could do, before it runs.
 *
 * Walks a pipeline's stages without running anything and lists every model call
 * (with its worst-case cost), every tool call and what it can change (read, write,
 * or external), which tools each agent may choose to call under its policies,
 * which calls need a person's approval, and the spend limits that apply.
 */

import type { Agent, CallStage, ParseResult, PipelineDeclaration, PipelineStage } from "./parser/types.js";
import { AdapterRegistry } from "./runtime/adapter.js";
import { toolMatches } from "./runtime/policies.js";
import type { ProviderInfo, ToolEffect, ToolMethod } from "./runtime/tools.js";
import { stageLabel } from "./parser/labels.js";

export interface PlanStep {
  /** e.g. "3" or "3.1" for a stage inside a called pipeline. */
  at: string;
  label: string;
  kind: "model" | "tool" | "agent-tools" | "control" | "human" | "pipeline";
  /** The agent making the model call. */
  agent?: string;
  /** How many times it can run (loops, each), when more than once. */
  times?: string;
  model?: string;
  /** Worst-case cost of one run of this step, in USD (model calls). */
  maxCost?: number;
  /** Tool calls this step can make: directly, or chosen by the agent. */
  effects: Array<{ target: string; effect: ToolEffect | "unknown"; approval?: string; via?: string }>;
  notes: string[];
}

export interface Plan {
  pipeline: string;
  steps: PlanStep[];
  /** Worst case for the whole run; undefined when it depends on input size (each over a list). */
  maxCost?: number;
  costNote?: string;
  /** When every agent that calls a model has a MaxSpend, the run can't spend more than the highest one. */
  cappedAt?: number;
  spendLimits: Array<{ agent: string; policy: string; limit: number }>;
}

export interface PlanOptions {
  providerInfo(provider: string): ProviderInfo | undefined;
  adapters?: AdapterRegistry;
}

const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_MAX_STEPS = 10;
/** A guess at prompt size when the input isn't known: the written instructions plus this many tokens. */
const ASSUMED_INPUT_TOKENS = 2000;

export function plan(ast: ParseResult, pipelineName: string, options: PlanOptions): Plan {
  const adapters = options.adapters ?? new AdapterRegistry();
  const pipelines = new Map(ast.pipelines.map((p) => [p.name, p]));
  const agents = new Map(ast.agents.map((a) => [a.name, a]));
  const tools = new Map([...ast.tools, ...ast.stores].map((t) => [t.name, t]));
  const policies = new Map(ast.policies.map((p) => [p.name, p]));
  const steps: PlanStep[] = [];
  let unbounded = false;

  const rulesOf = (agent: Agent) => (agent.requires ?? []).flatMap((name) => (policies.get(name)?.rules ?? []).map((r) => ({ policy: name, name: r.name, args: r.args.map((a) => a.replace(/^(["'])(.*)\1$/, "$2")) })));

  const methodsOf = (toolName: string): ToolMethod[] | undefined => {
    const tool = tools.get(toolName);
    const info = tool ? options.providerInfo(tool.provider) : undefined;
    return Array.isArray(info?.methods) ? info.methods : undefined;
  };
  const effectOf = (toolName: string, method: string): ToolEffect | "unknown" => methodsOf(toolName)?.find((m) => m.name === method)?.effect ?? "unknown";

  /** Would a policy hide or deny this call; would it need approval? */
  const decide = (agent: Agent, target: string, effect: ToolEffect | "unknown") => {
    let hidden = false;
    let approval: string | undefined;
    for (const r of rulesOf(agent)) {
      if (r.name === "AllowTools" && !r.args.some((p) => toolMatches(p, target))) hidden = true;
      if (r.name === "DenyTools" && r.args.some((p) => toolMatches(p, target))) hidden = true;
      if (r.name === "AllowEffects" && effect !== "unknown" && !r.args.includes(effect)) hidden = true;
      if ((r.name === "ApproveTools" && r.args.some((p) => toolMatches(p, target))) || (r.name === "ApproveEffects" && r.args.includes(effect))) approval ??= r.policy;
    }
    return { hidden, approval };
  };

  const callCost = (agent: Agent, stage: CallStage, turns: number) => {
    const adapter = adapters.findAdapter(agent.modelId);
    if (!adapter?.estimateCost) return undefined;
    const written = stage.argList.map((a) => (a.value.kind === "string" ? a.value.value : "")).join(" ") + (agent.system ?? "");
    const maxTokens = Number(stage.namedArgs.max_tokens ?? agent.params.max_tokens ?? DEFAULT_MAX_TOKENS);
    const input = Math.ceil(written.length / 3) + ASSUMED_INPUT_TOKENS;
    // Each turn of a tool conversation resends the conversation so far: count it growing by a reply per turn.
    let total = 0;
    for (let t = 0; t < turns; t++) total += adapter.estimateCost(agent.modelId, input + t * maxTokens, maxTokens);
    return total;
  };

  const toolsetOf = (agent: Agent, stage: CallStage): string[] => {
    const arg = stage.argList.find((a) => a.name === "tools");
    const named = arg ? (arg.value.kind === "list" ? arg.value.items : [arg.value]).map((v) => (v.kind === "ref" ? v.path.join(".") : v.kind === "string" ? v.value : "")) : agent.params.tools ? [agent.params.tools] : [];
    if (named.length === 1 && (named[0] === "none" || named[0] === "false")) return [];
    if (named.length === 1 && (named[0] === "auto" || named[0] === "all")) {
      return (agent.equips ?? []).filter((n) => tools.get(n) && !["VectorStore", "File"].includes(tools.get(n)!.provider));
    }
    return named;
  };

  const callStep = (stage: CallStage, at: string, times: string | undefined, depth: number, seen: Set<string>) => {
    const target = `${stage.callee}${stage.method ? "." + stage.method : ""}`;
    if (stage.callee === "System") {
      steps.push({ at, label: target, kind: "control", times, effects: [], notes: [] });
      return;
    }
    const agent = agents.get(stage.callee);
    const tool = tools.get(stage.callee);
    if (!stage.method || (stage.implicit && !agent && pipelines.has(stage.callee))) {
      const callee = pipelines.get(stage.callee);
      steps.push({ at, label: `${stage.callee}(...)`, kind: "pipeline", times, effects: [], notes: callee ? [] : ["not a defined pipeline"] });
      if (callee && !seen.has(callee.name)) walk(callee, `${at}.`, times, depth + 1, new Set([...seen, callee.name]));
      return;
    }
    if (tool) {
      const effect = effectOf(tool.name, stage.method);
      steps.push({ at, label: target, kind: "tool", times, effects: [{ target, effect }], notes: [`${tool.provider}${effect === "unknown" ? " (effect not described)" : ""}`] });
      return;
    }
    if (agent) {
      const toolset = toolsetOf(agent, stage);
      const maxSteps = Number(stage.namedArgs.max_steps ?? agent.params.max_steps ?? DEFAULT_MAX_STEPS);
      const step: PlanStep = { at, label: target, kind: toolset.length ? "agent-tools" : "model", agent: agent.name, times, model: agent.modelId, effects: [], notes: [] };
      const explicit = stage.argList.find((a) => a.name === "tool");
      if (explicit?.value.kind === "ref") {
        const name = explicit.value.path.join(".");
        step.effects.push({ target: `${name}.${stage.method}`, effect: effectOf(name, stage.method) });
      }
      for (const name of toolset) {
        const methods = methodsOf(name);
        if (!methods) {
          step.effects.push({ target: `${name}.*`, effect: "unknown", via: agent.name });
          step.notes.push(`${name}'s methods are listed by its server at run time`);
          continue;
        }
        for (const m of methods) {
          const t = `${name}.${m.name}`;
          const { hidden, approval } = decide(agent, t, m.effect);
          if (!hidden) step.effects.push({ target: t, effect: m.effect, approval, via: agent.name });
        }
      }
      if (toolset.length) step.notes.push(`chooses its own calls, up to ${maxSteps} steps`);
      step.maxCost = callCost(agent, stage, toolset.length ? maxSteps + 1 : 1);
      steps.push(step);
      return;
    }
    steps.push({ at, label: target, kind: "control", times, effects: [], notes: ["unknown callee"] });
  };

  const walk = (p: PipelineDeclaration, prefix: string, times: string | undefined, depth: number, seen: Set<string>) => {
    if (depth > 8) return;
    // A loop sends the run back to its agent's stage: everything from there to the loop can run `max` times.
    const repeats = new Map<number, string>();
    p.pipeline.forEach((stage, i) => {
      if (stage.kind !== "loop") return;
      const max = Number(stage.options.find((o) => o.name === "max")?.value.kind === "number" ? (stage.options.find((o) => o.name === "max")!.value as { value: number }).value : 3);
      const from = p.pipeline.findLastIndex((s, j) => j < i && s.kind === "call" && s.callee === stage.target);
      for (let j = Math.max(0, from); j < i; j++) repeats.set(j, `×${max}`);
    });
    p.pipeline.forEach((stage: PipelineStage, i) => {
      const at = `${prefix}${i}`;
      const t = [times, repeats.get(i)].filter(Boolean).join(" ") || undefined;
      switch (stage.kind) {
        case "expression":
          return;
        case "call":
          return callStep(stage, at, t, depth, seen);
        case "fanout":
          return stage.stages.forEach((s, k) => callStep(s, `${at}.${k + 1}`, t, depth, seen));
        case "branch":
          return stage.arms.forEach((arm, k) => callStep(arm.call, `${at}.${k + 1}`, [t, arm.condition ? `if ${arm.condition}` : "else"].filter(Boolean).join(" "), depth, seen));
        case "each":
          unbounded = true;
          return callStep(stage.call, at, [t, `× each ${stage.item}`].filter(Boolean).join(" "), depth, seen);
        case "interrupt":
          return void steps.push({ at, label: stageLabel(stage), kind: "human", times: t, effects: [], notes: ["waits for a person"] });
        case "listen":
          return void steps.push({ at, label: stageLabel(stage), kind: "human", times: t, effects: [], notes: [`waits for ${stage.target}`] });
        default:
          return void steps.push({ at, label: stageLabel(stage), kind: "control", times: t, effects: [], notes: [] });
      }
    });
  };

  const root = pipelines.get(pipelineName);
  if (!root) throw new Error(`No pipeline "${pipelineName}"`);
  walk(root, "", undefined, 0, new Set([root.name]));

  const multiplier = (times?: string) => (times?.match(/×(\d+)/g) ?? []).reduce((n, m) => n * Number(m.slice(1)), 1);
  const costs = steps.filter((s) => s.maxCost !== undefined);
  const maxCost = unbounded ? undefined : costs.reduce((sum, s) => sum + s.maxCost! * multiplier(s.times), 0);
  const spendLimits = [...agents.values()].flatMap((a) => rulesOf(a).filter((r) => r.name === "MaxSpend").map((r) => ({ agent: a.name, policy: r.policy, limit: Number(r.args[0]) })));
  // MaxSpend counts the whole run's spend, so the highest limit among the calling agents bounds it.
  const callers = new Set(steps.filter((s) => s.agent).map((s) => s.agent!));
  const limitOf = (name: string) => Math.min(...spendLimits.filter((l) => l.agent === name).map((l) => l.limit));
  const cappedAt = callers.size && [...callers].every((a) => Number.isFinite(limitOf(a))) ? Math.max(...[...callers].map(limitOf)) : undefined;
  return {
    pipeline: pipelineName,
    steps,
    maxCost,
    cappedAt,
    costNote: unbounded ? "depends on how many items `each` gets" : costs.length < steps.filter((s) => s.kind === "model" || s.kind === "agent-tools").length ? "some models have no price list" : undefined,
    spendLimits,
  };
}

/** The plan as text for the terminal. */
export function formatPlan(p: Plan, color: { bold(s: string): string; dim(s: string): string; red(s: string): string; yellow(s: string): string } = { bold: (s) => s, dim: (s) => s, red: (s) => s, yellow: (s) => s }): string {
  const lines: string[] = [color.bold(`Plan for ${p.pipeline}`), ""];
  const tag = (e: string) => (e === "external" ? color.red("external") : e === "write" ? color.yellow("write") : e === "read" ? "read" : color.dim("unknown"));
  for (const s of p.steps) {
    const cost = s.maxCost !== undefined ? color.dim(` ≤ $${s.maxCost.toFixed(4)}`) : "";
    lines.push(`  ${s.at.padEnd(6)} ${s.label}${s.model ? color.dim(` [${s.model}]`) : ""}${s.times ? color.dim(` (${s.times})`) : ""}${cost}`);
    for (const e of s.effects) lines.push(`         ${e.via ? "may call" : "calls"} ${e.target}: ${tag(e.effect)}${e.approval ? color.yellow(` · needs approval (${e.approval})`) : ""}`);
    for (const n of s.notes) lines.push(color.dim(`         ${n}`));
  }
  const all = p.steps.flatMap((s) => s.effects);
  const ext = [...new Set(all.filter((e) => e.effect === "external" && !e.approval).map((e) => e.target))];
  const approved = [...new Set(all.filter((e) => e.approval).map((e) => e.target))];
  const unknown = [...new Set(all.filter((e) => e.effect === "unknown").map((e) => e.target))];
  lines.push("");
  lines.push(`${color.bold("Acts on the world without asking:")} ${ext.length ? color.red(ext.join(", ")) : "nothing"}`);
  lines.push(`${color.bold("Needs a person's approval:")} ${approved.length ? approved.join(", ") : "nothing"}`);
  if (unknown.length) lines.push(`${color.bold("Effects not described:")} ${unknown.join(", ")}`);
  const capped = p.cappedAt !== undefined && (p.maxCost === undefined || p.cappedAt < p.maxCost) ? `, but MaxSpend stops the run at $${p.cappedAt.toFixed(2)}` : "";
  lines.push(`${color.bold("Worst-case model cost:")} ${p.maxCost !== undefined ? `$${p.maxCost.toFixed(4)}` : "unbounded"}${capped}${p.costNote ? color.dim(` (${p.costNote})`) : ""}`);
  for (const l of p.spendLimits) lines.push(`${color.bold("Spend limit:")} ${l.agent} stops once the run has spent $${l.limit.toFixed(2)} (policy ${l.policy})`);
  return lines.join("\n");
}
