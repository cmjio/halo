/**
 * The fence: does a changed pipeline reach anything the original couldn't?
 *
 * Checked from the two files alone, before anything runs. A variant is inside
 * the fence when, compared with the original, it declares the same tools and
 * policies, its plan lists no new tool effects, asks no fewer approvals, sends
 * data to no new model provider, costs no more in the worst case, and keeps the
 * pipeline's signature. `halo compare` (and later `halo evolve`) only replays a
 * variant that is inside it.
 */

import type { Agent, ParseResult, PipelineDeclaration, PipelineStage } from "./parser/types.js";
import { AdapterRegistry } from "./runtime/adapter.js";
import { plan, type Plan, type PlanOptions } from "./plan.js";

export interface FenceCheck {
  rule: string;
  ok: boolean;
  /** What the rule found, e.g. "same 4 tools" or "adds GitHubWrite.post (external)". */
  detail: string;
}

export interface FenceResult {
  inside: boolean;
  checks: FenceCheck[];
  original: Plan;
  variant: Plan;
}

export interface FenceOptions extends PlanOptions {
  /** Model patterns a variant may switch to beyond the original's providers, e.g. "anthropic/*" or "openai/gpt-4o-mini". */
  allowModels?: string[];
  /** How much the worst-case cost per run may rise: 1.0 (the default) means not at all. */
  maxCostRatio?: number;
}

const list = (xs: Iterable<string>) => [...xs].join(", ");

/** A declaration's content, without where it was written. */
function shape(x: object): string {
  return JSON.stringify(x, (k, v) => (k === "loc" ? undefined : v));
}

/** Pipelines reachable from `root`, including root. */
function reachable(ast: ParseResult, root: string): PipelineDeclaration[] {
  const byName = new Map(ast.pipelines.map((p) => [p.name, p]));
  const seen = new Map<string, PipelineDeclaration>();
  const visit = (name: string) => {
    const p = byName.get(name);
    if (!p || seen.has(name)) return;
    seen.set(name, p);
    const calls = (s: PipelineStage): string[] =>
      s.kind === "call" ? [s.callee] : s.kind === "fanout" ? s.stages.map((c) => c.callee) : s.kind === "branch" ? s.arms.map((a) => a.call.callee) : s.kind === "each" ? [s.call.callee] : [];
    for (const s of p.pipeline) calls(s).forEach(visit);
  };
  visit(root);
  return [...seen.values()];
}

/** The agents a pipeline (and what it calls) uses. */
function agentsUsed(ast: ParseResult, root: string): Agent[] {
  const agents = new Map(ast.agents.map((a) => [a.name, a]));
  const used = new Map<string, Agent>();
  const add = (callee: string) => {
    const a = agents.get(callee);
    if (a) used.set(a.name, a);
  };
  for (const p of reachable(ast, root)) {
    for (const s of p.pipeline) {
      if (s.kind === "call") add(s.callee);
      if (s.kind === "fanout") s.stages.forEach((c) => add(c.callee));
      if (s.kind === "branch") s.arms.forEach((a) => add(a.call.callee));
      if (s.kind === "each") add(s.call.callee);
      if (s.kind === "loop") add(s.target);
    }
  }
  // A @shadow candidate runs whenever its primary does.
  for (const a of ast.agents) {
    const target = a.directives?.find((d) => d.name === "shadow")?.value.trim();
    if (target && used.has(target)) used.set(a.name, a);
  }
  return [...used.values()];
}

/** Every model an agent's calls can reach: its own, and any `@shadow(provider/model)` it sends its prompts to. */
function modelsOf(ast: ParseResult, agents: Agent[]): string[] {
  const models = agents.map((a) => a.modelId);
  for (const a of ast.agents) {
    const target = a.directives?.find((d) => d.name === "shadow")?.value.trim();
    if (target?.includes("/") && agents.some((x) => x.name === a.name)) models.push(target);
  }
  return [...new Set(models)];
}

const globToRegex = (glob: string) => new RegExp(`^${glob.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`);

export function checkFence(original: ParseResult, variant: ParseResult, pipeline: string, options: FenceOptions): FenceResult {
  const checks: FenceCheck[] = [];
  const check = (rule: string, ok: boolean, detail: string) => checks.push({ rule, ok, detail });
  const a = plan(original, pipeline, options);
  const b = plan(variant, pipeline, options);

  // ── Signature: callers, webhooks and MCP clients mustn't notice ──
  const pa = original.pipelines.find((p) => p.name === pipeline)!;
  const pb = variant.pipelines.find((p) => p.name === pipeline);
  if (!pb) {
    check("signature", false, `the variant has no pipeline ${pipeline}`);
  } else {
    const sig = (p: PipelineDeclaration, ast: ParseResult) => shape({ params: p.params, returns: p.returnType, schema: ast.schemas.find((s) => s.name === p.returnType)?.fields });
    check("signature", sig(pa, original) === sig(pb, variant), sig(pa, original) === sig(pb, variant) ? `${pipeline}(${pa.params.map((p) => `${p.name}: ${p.type}`).join(", ")}) -> ${pa.returnType}, unchanged` : `changes ${pipeline}'s arguments or return type`);
  }

  // ── Tool and store declarations: the same ones, with the same arguments (and so the same secrets) ──
  const decls = (ast: ParseResult) => new Map([...ast.tools, ...ast.stores].map((t) => [t.name, shape({ provider: t.provider, args: t.argList })]));
  const da = decls(original);
  const db = decls(variant);
  const added = [...db.keys()].filter((n) => !da.has(n));
  const changed = [...db.keys()].filter((n) => da.has(n) && da.get(n) !== db.get(n));
  check(
    "tools",
    !added.length && !changed.length,
    added.length || changed.length ? [added.length ? `adds ${list(added)}` : "", changed.length ? `changes the declaration of ${list(changed)}` : ""].filter(Boolean).join("; ") : `same ${da.size} declaration(s)${[...db.keys()].length < da.size ? `, ${da.size - db.size} removed` : ""}`,
  );

  // ── Effects: everything the variant's plan can call, the original's could too ──
  const effects = (p: Plan) => new Map(p.steps.flatMap((s) => s.effects.map((e) => [`${e.target}`, e.effect] as const)));
  const ea = effects(a);
  const eb = effects(b);
  const newEffects = [...eb].filter(([t, e]) => ea.get(t) !== e).map(([t, e]) => `${t} (${e})`);
  check("effects", !newEffects.length, newEffects.length ? `adds ${list(newEffects)}` : `${eb.size} tool call(s), all in the original's plan`);

  // ── What acts on the world without asking ──
  const unasked = (p: Plan) => new Set(p.steps.flatMap((s) => s.effects.filter((e) => e.effect !== "read" && !e.approval).map((e) => e.target)));
  const ua = unasked(a);
  const newlyUnasked = [...unasked(b)].filter((t) => !ua.has(t));
  check("unasked effects", !newlyUnasked.length, newlyUnasked.length ? `${list(newlyUnasked)} would write or call out without asking` : `nothing new writes or calls out without asking`);

  // ── Approvals: every point where a person is asked is still there ──
  const humans = (p: Plan) => p.steps.filter((s) => s.kind === "human").length;
  const approvals = (p: Plan) => new Set(p.steps.flatMap((s) => s.effects.filter((e) => e.approval).map((e) => e.target)));
  const apA = approvals(a);
  const apB = approvals(b);
  const lostApproval = [...apA].filter((t) => eb.has(t) && !apB.has(t));
  const fewerHumans = humans(b) < humans(a);
  check(
    "approvals",
    !lostApproval.length && !fewerHumans,
    lostApproval.length ? `${list(lostApproval)} no longer needs approval` : fewerHumans ? `asks a person ${humans(a) - humans(b)} fewer time(s) (|! yield or ~> listen removed)` : `${humans(a)} yield/listen point(s) and ${apA.size} approval rule(s) kept`,
  );

  // ── Policies: the same declarations, and every agent still requires them ──
  const pols = (ast: ParseResult) => new Map(ast.policies.map((p) => [p.name, shape(p.rules)]));
  const polA = pols(original);
  const polB = pols(variant);
  const polChanged = [...polA.keys()].filter((n) => polB.get(n) !== polA.get(n));
  const polAdded = [...polB.keys()].filter((n) => !polA.has(n));
  const agentsA = new Map(agentsUsed(original, pipeline).map((x) => [x.name, x]));
  const agentsB = agentsUsed(variant, pipeline);
  // A policy every original agent requires is a baseline a new agent must meet too.
  const everyone = [...agentsA.values()].reduce<Set<string> | undefined>((acc, x) => {
    const r = new Set(x.requires ?? []);
    return acc ? new Set([...acc].filter((n) => r.has(n))) : r;
  }, undefined) ?? new Set<string>();
  const dropped = agentsB.flatMap((x) => {
    const need = agentsA.has(x.name) ? (agentsA.get(x.name)!.requires ?? []) : [...everyone];
    const has = new Set(x.requires ?? []);
    return need.filter((n) => !has.has(n)).map((n) => `${x.name} no longer requires ${n}`);
  });
  const polIssues = [...polChanged.map((n) => `changes or removes policy ${n}`), ...dropped];
  check("policies", !polIssues.length, polIssues.length ? polIssues.join("; ") : `${polA.size} polic${polA.size === 1 ? "y" : "ies"} unchanged and still required${polAdded.length ? ` (adds ${list(polAdded)})` : ""}`);

  // ── Equipped tools and stores: an agent sees no store it couldn't before ──
  const allEquipsA = new Set([...agentsA.values()].flatMap((x) => x.equips ?? []));
  const newEquips = agentsB.flatMap((x) => {
    const before = new Set(agentsA.get(x.name)?.equips ?? allEquipsA);
    return (x.equips ?? []).filter((e) => !before.has(e)).map((e) => `${x.name} equips ${e}`);
  });
  check("equips", !newEquips.length, newEquips.length ? list(newEquips) : "no agent equips anything new");

  // ── Models: data goes to no new provider ──
  const registry = options.adapters ?? new AdapterRegistry();
  const providerOf = (model: string) => registry.findAdapter(model)?.id ?? model.split("/")[0]!;
  const modelsA = modelsOf(original, [...agentsA.values()]);
  const modelsB = modelsOf(variant, agentsB);
  const providersA = new Set(modelsA.map(providerOf));
  const allowed = (options.allowModels ?? []).map(globToRegex);
  const newProviders = modelsB.filter((m) => !providersA.has(providerOf(m)) && !allowed.some((r) => r.test(m)));
  const switched = modelsB.filter((m) => !modelsA.includes(m));
  check("models", !newProviders.length, newProviders.length ? `sends prompts to a new provider: ${list(newProviders)}` : switched.length ? `${list(switched)}, from a provider the original already uses (${list(providersA)})` : `same model(s): ${list(modelsB)}`);

  // ── Cost: the worst case doesn't rise ──
  const ratio = options.maxCostRatio ?? 1;
  const money = (n?: number) => (n === undefined ? "unbounded" : `$${n.toFixed(4)}`);
  const bound = (p: Plan) => p.cappedAt ?? p.maxCost;
  const ca = bound(a);
  const cb = bound(b);
  const costOk = ca === undefined ? true : cb !== undefined && cb <= ca * ratio + 1e-9;
  check("cost", costOk, `worst case per run ${money(ca)} → ${money(cb)}${ca !== undefined && cb !== undefined && ratio !== 1 ? ` (allowed up to ×${ratio})` : ""}${ca === undefined ? " (the original's is unbounded, so this can't be compared)" : ""}`);

  // ── Spend limits: none raised or removed ──
  const limits = (p: Plan) => new Map(p.spendLimits.map((l) => [`${l.agent}/${l.policy}`, l.limit]));
  const la = limits(a);
  const lb = limits(b);
  const raised = [...la].filter(([k, v]) => {
    const [agent] = k.split("/");
    return agentsB.some((x) => x.name === agent) && !(lb.has(k) && lb.get(k)! <= v);
  }).map(([k]) => k);
  check("spend limits", !raised.length, raised.length ? `raises or drops MaxSpend for ${list(raised)}` : la.size ? `${la.size} MaxSpend limit(s) kept` : "no MaxSpend in either");

  // ── Unbounded fan-outs ──
  const unboundedEach = (ast: ParseResult) => reachable(ast, pipeline).flatMap((p) => p.pipeline).filter((s) => s.kind === "each" && !s.options.some((o) => o.name === "limit")).length;
  const eachA = unboundedEach(original);
  const eachB = unboundedEach(variant);
  check("bounds", eachB <= eachA, eachB > eachA ? `adds ${eachB - eachA} |* each without a limit:` : "no new unbounded |* each");

  return { inside: checks.every((c) => c.ok), checks, original: a, variant: b };
}
