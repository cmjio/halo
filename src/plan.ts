/**
 * `halo plan`: what a pipeline could do, before it runs.
 *
 * Walks a pipeline's stages without running anything and lists every model call
 * (with its worst-case cost), every tool call and what it can change (read, write,
 * or external), which tools each agent may choose to call under its policies,
 * which calls need a person's approval, and the spend limits that apply.
 */

import { applyPreset } from "./runtime/presets.js";
import { withSandbox } from "./runtime/sandbox-agents.js";
import type { Agent, CallStage, ParseResult, PipelineDeclaration, PipelineStage } from "./parser/types.js";
import { AdapterRegistry } from "./runtime/adapter.js";
import { costAt, priceOf, type Prices } from "./runtime/prices.js";
import { toolMatches } from "./runtime/policies.js";
import type { ProviderInfo, ToolEffect, ToolMethod } from "./runtime/tools.js";
import { stageLabel } from "./parser/labels.js";
import { displayText } from "./linker/names.js";
import { HOSTED_PROVIDER } from "./linker/hosted.js";
import { walletNames } from "./runtime/wallet-rules.js";
import type { ToolDeclaration, Value } from "./parser/types.js";
import { backendOf, parseSshTarget } from "./runtime/providers/remote-target.js";

/** A declaration's setting as written: literals as themselves, a list item by item, a name as its text. */
function literalArg(tool: Pick<ToolDeclaration, "argList">, name: string | number): unknown {
  const lit = (v: Value): unknown => (v.kind === "string" || v.kind === "number" || v.kind === "bool" ? v.value : v.kind === "list" ? v.items.map(lit) : v.kind === "ref" ? v.path.join(".") : v.kind === "null" ? null : v.kind);
  const v = typeof name === "number" ? tool.argList.filter((x) => !x.name)[name]?.value : tool.argList.find((x) => x.name === name)?.value;
  return v === undefined ? undefined : lit(v);
}

/** What a Remote tool reaches: for SSH, the host, login, port, key and how its host key is checked. */
export function remoteSummary(tool: Pick<ToolDeclaration, "argList" | "provider">): string | undefined {
  if (tool.provider !== "Remote") return undefined;
  const spec = literalArg(tool, 0);
  const backend = backendOf(spec);
  if (!backend) return undefined;
  if (backend !== "ssh") return `Remote: ${backend === "auto" ? "a sandbox (Docker if it's running, else E2B, else Daytona)" : `a ${backend} sandbox`}, made for the run and deleted after`;
  let t: ReturnType<typeof parseSshTarget>;
  try {
    t = parseSshTarget(spec as string);
  } catch (e) {
    return `Remote over SSH: ${(e as Error).message}`;
  }
  const key = literalArg(tool, "key");
  const pins = literalArg(tool, "hostKey");
  const known = literalArg(tool, "knownHosts");
  const hostKey = pins
    ? `pinned (${Array.isArray(pins) ? pins.length : 1} key${Array.isArray(pins) && pins.length > 1 ? "s" : ""})`
    : typeof known === "string"
      ? `checked against ${known} only`
      : literalArg(tool, "accept_new_hosts") === true
        ? "trusted the first time (accept_new_hosts), then checked"
        : "must already be in known_hosts";
  return [
    `Remote over SSH to ${t.host}`,
    `user ${t.user ?? "from ~/.ssh/config, else yours"}`,
    `port ${t.port ?? "from ~/.ssh/config, else 22"}`,
    `key ${typeof key === "string" ? key : "from your ssh agent and ~/.ssh/config"}`,
    `host key ${hostKey}`,
  ].join(", ");
}

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

/** What this machine has stored for a connection (never a token), as `halo plan` shows it. */
export interface AuthStatus {
  connected: boolean;
  account?: string;
  /** When the access token expires (ms since epoch). */
  expiresAt?: number;
  /** Whether a refresh token is kept (so an expired access token renews itself). */
  refreshable?: boolean;
  /** The scopes the server granted. */
  scopes?: string[];
  /** Why it needs signing in again (a revoked grant). */
  needsLogin?: string;
  /** For an MCP tool with `auth: "discover"`: the host of the authorization server discovered for it. */
  server?: string;
}

/** An OAuth connection the pipeline's tools use. */
export interface PlanAuth {
  connection: string;
  grant: string;
  scopes: string[];
  /** The tools that act through it. */
  tools: string[];
  status: "connected" | "not connected" | "needs login" | "service" | "unknown";
  account?: string;
  expiresAt?: number;
  refreshable?: boolean;
  /** Granted scopes beyond the declared ones. */
  wider?: string[];
  /** An MCP tool with `auth: "discover"`: its authorization server's host once discovered, "" until then. */
  discovered?: string;
}

export interface Plan {
  pipeline: string;
  steps: PlanStep[];
  /** The OAuth connections its tools use, and whether this machine is connected. */
  auth: PlanAuth[];
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
  /** halo.json "prices" (USD per million tokens, by model), which win over the adapters' tables. */
  prices?: Prices;
  /** What this machine has stored for an OAuth connection (the CLI reads its token index; nothing is unlocked or asked). */
  authStatus?(connection: string): AuthStatus | undefined;
  /** For "expires in": now, in ms. */
  now?: number;
}

/** Scopes that ask for a refresh token or an identity, not access: never "wider than declared". */
const IDENTITY_SCOPES = new Set(["openid", "offline_access", "profile", "email"]);

const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_MAX_STEPS = 10;
/** A guess at prompt size when the input isn't known: the written instructions plus this many tokens. */
const ASSUMED_INPUT_TOKENS = 2000;

export function plan(ast: ParseResult, pipelineName: string, options: PlanOptions): Plan {
  const adapters = options.adapters ?? new AdapterRegistry();
  const pipelines = new Map(ast.pipelines.map((p) => [p.name, p]));
  // A preset's settings (max_steps, tools: auto) count; an unknown preset is validate's to report.
  const tools = new Map([...ast.tools, ...ast.stores].map((t) => [t.name, t]));
  const declared = new Map(tools);
  const policies = new Map(ast.policies.map((p) => [p.name, p]));
  const agents = new Map(ast.agents.map((a) => {
    let agent = a;
    try {
      agent = applyPreset(a);
    } catch {}
    // A sandbox: is a tool the agent may call; a bad one is validate's to report.
    try {
      const sandboxed = withSandbox(agent, declared, policies);
      if (sandboxed.tool) tools.set(sandboxed.tool.name, sandboxed.tool);
      agent = sandboxed.agent;
    } catch {}
    return [a.name, agent];
  }));
  const steps: PlanStep[] = [];
  let unbounded = false;

  const rulesOf = (agent: Agent) => (agent.requires ?? []).flatMap((name) => (policies.get(name)?.rules ?? []).map((r) => ({ policy: name, name: r.name, args: r.args.map((a) => a.replace(/^(["'])(.*)\1$/, "$2")) })));

  const methodsOf = (toolName: string): ToolMethod[] | undefined => {
    const tool = tools.get(toolName);
    const info = tool ? options.providerInfo(tool.provider) : undefined;
    // Methods that depend on the declaration's settings (Chrome's evaluate, its wallet, Remote over SSH), from the settings as written.
    if (tool && info?.methodsFor) return info.methodsFor((k) => literalArg(tool, k));
    if (Array.isArray(info?.methods)) return info.methods;
    return undefined;
  };
  /** The wallet items a browser asks a person about before typing: every secret item, and any that doesn't say ask: false. */
  const walletAsks = (toolName: string): string[] => {
    const tool = tools.get(toolName);
    return (tool ? (walletNames(tool) ?? []) : []).filter((n) => {
      const v = tools.get(n);
      return v?.provider === "Vault" && (literalArg(v, "kind") === "card" || literalArg(v, "secret") === true || literalArg(v, "ask") !== false);
    });
  };
  const effectOf = (toolName: string, method: string): ToolEffect | "unknown" => methodsOf(toolName)?.find((m) => m.name === method)?.effect ?? "unknown";

  // ── OAuth: which connection each tool acts through, and whether this machine has it ──
  const auths = new Map<string, PlanAuth>();
  const authOf = (toolName: string): PlanAuth | undefined => {
    const tool = tools.get(toolName);
    if (!tool) return undefined;
    const written = tool.argList.find((a) => a.name === "auth")?.value;
    const named = written?.kind === "ref" ? written.path.join(".") : written?.kind === "string" ? written.value : undefined;
    let connection: string;
    let grant = "authorization_code";
    let scopes: string[] = [];
    let discovered: string | undefined;
    if (named === "discover" && tool.provider === "MCP" && written?.kind === "string") {
      // The server's own sign-in, found from its 401: the tool is its own connection.
      connection = tool.name;
      const s = literalArg(tool, "scopes");
      scopes = Array.isArray(s) ? s.map(String) : typeof s === "string" ? s.split(/[\s,]+/).filter(Boolean) : [];
      discovered = options.authStatus?.(connection)?.server ?? "";
    } else if (named !== undefined) {
      const decl = tools.get(named);
      if (decl?.provider !== "OAuth") return undefined;
      connection = named;
      grant = String(literalArg(decl, "grant") ?? grant);
      const s = literalArg(decl, "scopes");
      scopes = Array.isArray(s) ? s.map(String) : typeof s === "string" ? s.split(/[\s,]+/).filter(Boolean) : [];
    } else {
      // A package tool whose manifest says "type": "oauth" is its own connection.
      const info = options.providerInfo(tool.provider);
      if (!info?.oauth) return undefined;
      connection = tool.name;
      try {
        const c = info.oauth(tool.name, (k) => literalArg(tool, k) ?? (k === "clientId" ? "(client id)" : undefined), {}, "/");
        grant = c.grant;
        scopes = c.scopes;
      } catch {}
    }
    let entry = auths.get(connection);
    if (!entry) {
      const st = options.authStatus?.(connection);
      const wider = st?.scopes?.filter((x) => !scopes.includes(x) && !IDENTITY_SCOPES.has(x));
      entry = {
        connection,
        grant,
        scopes,
        tools: [],
        status: grant === "client_credentials" ? "service" : !options.authStatus ? "unknown" : st?.needsLogin ? "needs login" : st?.connected ? "connected" : "not connected",
        ...(st?.account ? { account: st.account } : {}),
        ...(st?.expiresAt ? { expiresAt: st.expiresAt } : {}),
        ...(st?.refreshable !== undefined ? { refreshable: st.refreshable } : {}),
        ...(wider?.length ? { wider } : {}),
        ...(discovered !== undefined ? { discovered } : {}),
      };
      auths.set(connection, entry);
    }
    if (!entry.tools.includes(toolName)) entry.tools.push(toolName);
    return entry;
  };
  const authNote = (toolName: string): string[] => {
    const a = authOf(toolName);
    if (!a) return [];
    return [`auth: ${a.connection} (${authKind(a)})${a.scopes.length ? ` [${a.scopes.join(", ")}]` : ""}${a.status === "unknown" ? "" : ` · ${authState(a, options.now ?? Date.now())}`}`];
  };

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
    if (effect === "wallet") {
      const asks = walletAsks(target.split(".")[0]!);
      if (asks.length) approval ??= `the wallet, for ${asks.join(", ")}`;
    }
    // hand_over is itself a question to a person.
    if (target.endsWith(".hand_over") && effect !== "unknown") approval ??= "hand_over asks a person";
    return { hidden, approval };
  };

  const callCost = (agent: Agent, stage: CallStage, turns: number) => {
    const adapter = adapters.findAdapter(agent.modelId);
    const written = stage.argList.map((a) => (a.value.kind === "string" ? a.value.value : "")).join(" ") + (agent.system ?? "");
    const maxTokens = Number(stage.namedArgs.max_tokens ?? agent.params.max_tokens ?? DEFAULT_MAX_TOKENS);
    const input = Math.ceil(written.length / 3) + ASSUMED_INPUT_TOKENS;
    // Each turn of a tool conversation resends the conversation so far: count it growing by a reply per turn.
    let total = 0;
    // Only an exact price counts (a model's price can depend on the prompt's size).
    for (let t = 0; t < turns; t++) {
      const price = priceOf(agent.modelId, input + t * maxTokens, adapter, options.prices);
      if (!price) return undefined;
      total += costAt(price, input + t * maxTokens, maxTokens);
    }
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
    if (stage.callee === "Thread" && !agents.has("Thread") && !tools.has("Thread") && !pipelines.has("Thread")) {
      steps.push({ at, label: target, kind: "control", times, effects: [], notes: ["changes the thread's state, saved when the run ends"] });
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
      if (tool.provider === HOSTED_PROVIDER) {
        // A package's hosted pipeline: one external call to the publisher's server.
        const arg = (name: string) => tool.argList.find((a) => a.name === name)?.value;
        const text = (name: string) => ((v) => (v?.kind === "string" ? v.value : ""))(arg(name));
        const host = text("endpoint").replace(/^[a-z]+:\/\//i, "").split("/")[0];
        steps.push({ at, label: target, kind: "tool", times, effects: [{ target, effect: "external" }], notes: [`hosted by ${text("package")}: sends its inputs to ${host}${text("env") ? ` (key from ${text("env")})` : ""}`] });
        return;
      }
      const unknownWhy = !methodsOf(tool.name) ? " (its server says what this does only at run time: effect unknown)" : " (effect not described)";
      steps.push({ at, label: target, kind: "tool", times, effects: [{ target, effect }], notes: [remoteSummary(tool) ?? `${tool.provider}${effect === "unknown" ? unknownWhy : ""}`, ...authNote(tool.name)] });
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
        const remote = tools.get(name);
        const summary = remote ? remoteSummary(remote) : undefined;
        if (summary) step.notes.push(`${name}: ${summary}`);
        step.notes.push(...authNote(name));
        const methods = methodsOf(name);
        if (!methods) {
          // A rule that approves every method of the tool still applies, whatever they turn out to be.
          const approval = rulesOf(agent).find((r) => r.name === "ApproveTools" && r.args.some((p) => toolMatches(p, `${name}.*`)))?.policy;
          step.effects.push({ target: `${name}.*`, effect: "unknown", approval, via: agent.name });
          step.notes.push(`${name}'s methods, and what they do, are unknown until its server is asked at run time`);
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
      if (step.maxCost === undefined) step.notes.push(`no price for ${agent.modelId}${rulesOf(agent).some((r) => r.name === "MaxSpend") ? ": MaxSpend will refuse its calls (add it to \"prices\" in halo.json)" : ` (add it to "prices" in halo.json)`}`);
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
  // A model with no price makes the worst case unknown: leaving it out would understate it.
  const unpriced = [...new Set(steps.filter((s) => (s.kind === "model" || s.kind === "agent-tools") && s.maxCost === undefined).map((s) => s.model!))];
  const maxCost = unbounded || unpriced.length ? undefined : costs.reduce((sum, s) => sum + s.maxCost! * multiplier(s.times), 0);
  const spendLimits = [...agents.values()].flatMap((a) => rulesOf(a).filter((r) => r.name === "MaxSpend").map((r) => ({ agent: a.name, policy: r.policy, limit: Number(r.args[0]) })));
  // MaxSpend counts the whole run's spend, so the highest limit among the calling agents bounds it.
  const callers = new Set(steps.filter((s) => s.agent).map((s) => s.agent!));
  const limitOf = (name: string) => Math.min(...spendLimits.filter((l) => l.agent === name).map((l) => l.limit));
  const cappedAt = callers.size && [...callers].every((a) => Number.isFinite(limitOf(a))) ? Math.max(...[...callers].map(limitOf)) : undefined;
  // A linked program's imported pipelines, agents and tools have internal names: show the names people know.
  const show = (s: string) => displayText(ast.names, s);
  return {
    pipeline: show(pipelineName),
    steps: steps.map((s) => ({
      ...s,
      label: show(s.label),
      ...(s.agent ? { agent: show(s.agent) } : {}),
      effects: s.effects.map((e) => ({ ...e, target: show(e.target), ...(e.via ? { via: show(e.via) } : {}), ...(e.approval ? { approval: show(e.approval) } : {}) })),
      notes: s.notes.map(show),
    })),
    auth: [...auths.values()].map((a) => ({ ...a, connection: show(a.connection), tools: a.tools.map(show) })),
    maxCost,
    cappedAt,
    costNote: unbounded ? "depends on how many items `each` gets" : unpriced.length ? `no price for ${unpriced.join(", ")}` : undefined,
    spendLimits: spendLimits.map((l) => ({ ...l, agent: show(l.agent), policy: show(l.policy) })),
  };
}

/** "in 41 min", "in 3 h", "2 days ago". */
function relative(ms: number, now: number): string {
  const d = ms - now;
  const a = Math.abs(d);
  const text = a < 90_000 ? `${Math.round(a / 1000)} s` : a < 90 * 60_000 ? `${Math.round(a / 60_000)} min` : a < 36 * 3_600_000 ? `${Math.round(a / 3_600_000)} h` : `${Math.round(a / 86_400_000)} days`;
  return d >= 0 ? `in ${text}` : `${text} ago`;
}

/** How a connection signs in: `oauth, authorization_code`, or for an MCP server's own, `oauth, discovered: auth.example.com`. */
export function authKind(a: PlanAuth): string {
  if (a.discovered === undefined) return `oauth, ${a.grant}`;
  return `oauth, ${a.discovered ? `discovered: ${a.discovered}` : "discovered at sign-in"}`;
}

/** A connection's state in words: `connected as ada@example.com, token expires in 41 min` or `not connected: halo auth login Google`. */
export function authState(a: PlanAuth, now = Date.now()): string {
  switch (a.status) {
    case "service":
      return "client credentials (no login)";
    case "not connected":
      return `not connected: halo auth login ${a.connection}`;
    case "needs login":
      return `needs signing in again: halo auth login ${a.connection}`;
    case "unknown":
      return "";
    case "connected": {
      const who = a.account ? ` as ${a.account}` : "";
      const until = a.expiresAt ? `, access token ${a.expiresAt > now ? "expires" : "expired"} ${relative(a.expiresAt, now)}${a.refreshable ? " (refresh token kept)" : ""}` : a.refreshable ? ", refresh token kept" : "";
      return `connected${who}${until}`;
    }
  }
}

/** The plan as text for the terminal. */
export function formatPlan(p: Plan, color: { bold(s: string): string; dim(s: string): string; red(s: string): string; yellow(s: string): string } = { bold: (s) => s, dim: (s) => s, red: (s) => s, yellow: (s) => s }): string {
  const lines: string[] = [color.bold(`Plan for ${p.pipeline}`), ""];
  const tag = (e: string) => (e === "external" ? color.red("external") : e === "wallet" ? color.red("wallet") : e === "write" ? color.yellow("write") : e === "read" ? "read" : color.dim("unknown"));
  for (const s of p.steps) {
    const cost = s.maxCost !== undefined ? color.dim(` ≤ $${s.maxCost.toFixed(4)}`) : s.kind === "model" || s.kind === "agent-tools" ? color.yellow(" no price") : "";
    lines.push(`  ${s.at.padEnd(6)} ${s.label}${s.model ? color.dim(` [${s.model}]`) : ""}${s.times ? color.dim(` (${s.times})`) : ""}${cost}`);
    for (const e of s.effects) lines.push(`         ${e.via ? "may call" : "calls"} ${e.target}: ${tag(e.effect)}${e.approval ? color.yellow(` · needs approval (${e.approval})`) : ""}`);
    for (const n of s.notes) lines.push(color.dim(`         ${n}`));
  }
  const all = p.steps.flatMap((s) => s.effects);
  const ext = [...new Set(all.filter((e) => (e.effect === "external" || e.effect === "wallet") && !e.approval).map((e) => e.target))];
  const approved = [...new Set(all.filter((e) => e.approval).map((e) => e.target))];
  const unknown = [...new Set(all.filter((e) => e.effect === "unknown").map((e) => e.target))];
  // A call whose effect is unknown may act on the world: it is never counted as nothing.
  const unknownUnasked = [...new Set(all.filter((e) => e.effect === "unknown" && !e.approval).map((e) => e.target))];
  const acts = [...(ext.length ? [color.red(ext.join(", "))] : []), ...(unknownUnasked.length ? [`maybe ${unknownUnasked.join(", ")} (effect unknown)`] : [])];
  lines.push("");
  lines.push(`${color.bold("Acts on the world without asking:")} ${acts.length ? acts.join("; ") : "nothing"}`);
  lines.push(`${color.bold("Needs a person's approval:")} ${approved.length ? approved.join(", ") : "nothing"}`);
  if (unknown.length) lines.push(`${color.bold("Effects unknown:")} ${unknown.join(", ")}`);
  for (const a of p.auth ?? []) {
    const state = authState(a);
    lines.push(`${color.bold("Acts as:")} ${a.tools.join(", ")} through ${a.connection} (${authKind(a)})${a.scopes.length ? ` [${a.scopes.join(", ")}]` : ""}${state ? `: ${a.status === "connected" || a.status === "service" ? state : color.yellow(state)}` : ""}`);
    if (a.wider?.length) lines.push(color.yellow(`  warning: ${a.connection} was granted more than it declares: ${a.wider.join(", ")}`));
  }
  const capped = p.cappedAt !== undefined && (p.maxCost === undefined || p.cappedAt < p.maxCost) ? `, but MaxSpend stops the run at $${p.cappedAt.toFixed(2)}` : "";
  lines.push(`${color.bold("Worst-case model cost:")} ${p.maxCost !== undefined ? `$${p.maxCost.toFixed(4)}` : p.costNote?.startsWith("no price") ? "unknown" : "unbounded"}${capped}${p.costNote ? color.dim(` (${p.costNote})`) : ""}`);
  for (const l of p.spendLimits) lines.push(`${color.bold("Spend limit:")} ${l.agent} stops once the run has spent $${l.limit.toFixed(2)} (policy ${l.policy})`);
  return lines.join("\n");
}
