/**
 * Sandbox agents: `sandbox:` in an agent's brackets gives it a computer of its own.
 *
 *   agent Dev [anthropic/claude-sonnet-4-5, preset: Coder, sandbox: "e2b"]       its own sandbox
 *   agent Dev [anthropic/claude-sonnet-4-5, sandbox: Lab]                         a Remote tool you declared
 *
 * With "e2b", "daytona" or "docker", the agent gets a Remote tool named `<Agent>Sandbox`: a fresh sandbox
 * for each run, shared by that agent's calls in the run, deleted when the run ends. Naming a
 * declared Remote tool equips that tool instead, so a pipeline can put files in the same sandbox
 * before the agent works and take results out after (sandboxes are per tool and run).
 *
 * Either way the agent may call it without `tools:` on each call (`tools: auto`, unless the
 * agent says otherwise), and its system prompt says the sandbox is there.
 *
 * `sandbox: "auto"` uses Docker when it's running, else E2B, else Daytona. Policies the agent
 * requires limit its own sandbox:
 *   AllowHosts("pypi.org", ...)    the hosts it may reach (hosts:; Docker only)
 *   AllowFiles("src/billing", ...) the project files it starts with and may write back (from: ".", files:)
 *   AllowSecrets("STRIPE_KEY", ...) the environment variables its commands get (secrets:; Docker only)
 */

import type { Agent, PolicyDeclaration, ToolDeclaration, Value } from "../parser/types.js";
import { scopePath } from "../parser/builtins.js";

export const SANDBOX_SERVICES = ["e2b", "daytona", "docker", "auto"];

/** Whether every host `inner` matches is also matched by `outer` ("api.stripe.com" is within "*.stripe.com"). */
export function hostWithin(inner: string, outer: string): boolean {
  const a = inner.toLowerCase();
  const b = outer.toLowerCase();
  if (!b.startsWith("*.")) return a === b;
  const base = b.slice(2);
  const name = a.startsWith("*.") ? a.slice(2) : a;
  return name === base || name.endsWith("." + base);
}

/** The hosts both lists allow, by pattern: ["*.stripe.com"] and ["api.stripe.com", "pypi.org"] give ["api.stripe.com"]. */
export function intersectHosts(a: string[], b: string[]): string[] {
  const both = [...a.filter((x) => b.some((y) => hostWithin(x, y))), ...b.filter((y) => a.some((x) => hostWithin(y, x)))];
  // Drop any that another kept pattern already covers.
  return [...new Set(both.map((h) => h.toLowerCase()))].filter((h, _, all) => !all.some((o) => o !== h && hostWithin(h, o)));
}

/** The paths both lists allow: ["src"] and ["src/billing", "docs"] give ["src/billing"]. */
export function intersectFiles(a: string[], b: string[]): string[] {
  const within = (x: string, y: string) => y === "." || x === y || x.startsWith(y + "/");
  const both = [...a.filter((x) => b.some((y) => within(x, y))), ...b.filter((y) => a.some((x) => within(y, x)))];
  return [...new Set(both)].filter((p, _, all) => !all.some((o) => o !== p && within(p, o)));
}

/** What an agent's policies limit its own sandbox to; each is undefined when no policy says. */
export interface SandboxLimits {
  /** AllowHosts: the hosts it may reach. */
  hosts?: string[];
  /** AllowFiles: the project's folders and files it starts with, and may write back. */
  files?: string[];
  /** AllowSecrets: the environment variables put into its commands. */
  secrets?: string[];
}

/**
 * The limits an agent's policies put on its sandbox. Several policies narrow: a host, a path or a
 * secret must be allowed by each rule that names that kind.
 */
export function sandboxLimits(agent: Agent, policies?: Map<string, PolicyDeclaration>): SandboxLimits {
  const out: SandboxLimits = {};
  if (!policies) return out;
  for (const name of agent.requires ?? []) {
    for (const rule of policies.get(name)?.rules ?? []) {
      if (rule.name === "AllowHosts") out.hosts = out.hosts ? intersectHosts(out.hosts, rule.args) : [...new Set(rule.args.map((h) => h.toLowerCase()))];
      if (rule.name === "AllowFiles") {
        const paths = rule.args.map((p) => scopePath(p)).filter((p): p is string => p !== undefined);
        out.files = out.files ? intersectFiles(out.files, paths) : intersectFiles(paths, paths);
      }
      if (rule.name === "AllowSecrets") out.secrets = out.secrets ? out.secrets.filter((n) => rule.args.includes(n)) : [...new Set(rule.args)];
    }
  }
  return out;
}

/** The hosts an agent's policies allow its sandbox to reach (AllowHosts), or undefined when none say. */
export function allowedHosts(agent: Agent, policies?: Map<string, PolicyDeclaration>): string[] | undefined {
  return sandboxLimits(agent, policies).hosts;
}

/** What `sandbox:` on an agent names. */
export type SandboxChoice = { kind: "none" } | { kind: "service"; service: string; tool: string } | { kind: "tool"; tool: string };

export function sandboxChoice(agent: Agent): SandboxChoice {
  const raw = agent.params.sandbox?.trim();
  if (!raw || raw === "none" || raw === "false") return { kind: "none" };
  const service = raw.toLowerCase();
  if (SANDBOX_SERVICES.includes(service)) return { kind: "service", service, tool: `${agent.name}Sandbox` };
  return { kind: "tool", tool: raw };
}

/** The reason `sandbox:` can't be used, or undefined when it can. */
export function sandboxProblem(agent: Agent, tools: Map<string, ToolDeclaration>, policies?: Map<string, PolicyDeclaration>): string | undefined {
  const choice = sandboxChoice(agent);
  const limits = sandboxLimits(agent, policies);
  const named = (["hosts", "files", "secrets"] as const).filter((k) => limits[k] !== undefined);
  const rule = (k: string) => `Allow${k[0]!.toUpperCase()}${k.slice(1)}`;
  if (choice.kind === "service") {
    if (tools.has(choice.tool)) return `Agent "${agent.name}": sandbox: "${choice.service}" makes a tool named "${choice.tool}", but a tool of that name is already declared`;
    const dockerOnly = named.filter((k) => k !== "files");
    if (dockerOnly.length && (choice.service === "e2b" || choice.service === "daytona")) {
      return `Agent "${agent.name}": ${dockerOnly.map(rule).join(" and ")} ${dockerOnly.length > 1 ? "are" : "is"} enforced by Docker sandboxes; use sandbox: "docker" (or "auto"), or drop ${dockerOnly.length > 1 ? "them" : "it"}`;
    }
    return undefined;
  }
  if (named.length && choice.kind === "tool") {
    return `Agent "${agent.name}": ${named.map(rule).join(", ")} limit${named.length > 1 ? "" : "s"} a sandbox the agent owns (sandbox: "docker" or "auto"); for the shared tool ${choice.tool}, put ${named.map((k) => `${k}: [...]`).join(", ")} on its declaration`;
  }
  if (choice.kind === "tool") {
    const tool = tools.get(choice.tool);
    if (!tool) return `Agent "${agent.name}": sandbox: ${choice.tool} is not "e2b", "daytona", "docker", "auto" or a declared Remote tool`;
    if (tool.provider !== "Remote") return `Agent "${agent.name}": sandbox: ${choice.tool} is a ${tool.provider} tool; it must be a Remote tool`;
  }
  return undefined;
}

function note(tool: string, service: string | undefined): string {
  const where = service ? `a fresh Linux sandbox${service === "auto" ? "" : ` (${service})`} that is yours for this run and deleted after it` : "a remote computer";
  return `You have ${where}: the ${tool} tool. Run shell commands there with ${tool}.run, and read, write and list files with ${tool}.read, ${tool}.write and ${tool}.list. Do the work there: write the code or files, run them, and check the result before you answer. Paths are relative to your home folder there.`;
}

/**
 * The agent with its sandbox: the tool equipped (and, for a service, declared), `tools: auto`
 * unless the agent chose its tools, and a note in its system prompt. Throws on a bad `sandbox:`.
 */
export function withSandbox(agent: Agent, tools: Map<string, ToolDeclaration>, policies?: Map<string, PolicyDeclaration>): { agent: Agent; tool?: ToolDeclaration } {
  const choice = sandboxChoice(agent);
  if (choice.kind === "none") return { agent };
  const problem = sandboxProblem(agent, tools, policies);
  if (problem) throw new Error(problem);

  const limits = sandboxLimits(agent, policies);
  const list = (items: string[]): Value => ({ kind: "list", items: items.map((v) => ({ kind: "string", value: v })) });
  const extra: [string, Value][] = [];
  if (limits.hosts) extra.push(["hosts", list(limits.hosts)]);
  // AllowFiles: the sandbox starts with those files from the project, and only they come back.
  if (limits.files) extra.push(["from", { kind: "string", value: "." }], ["files", list(limits.files)]);
  if (limits.secrets) extra.push(["secrets", list(limits.secrets)]);
  const declared: ToolDeclaration | undefined =
    choice.kind === "service"
      ? {
          name: choice.tool,
          provider: "Remote",
          args: [`"${choice.service}"`],
          namedArgs: Object.fromEntries(extra.map(([k, v]) => [k, v.kind === "list" ? `[${v.items.map((i) => (i as { value: string }).value).join(", ")}]` : `"${(v as { value: string }).value}"`])),
          argList: [{ value: { kind: "string", value: choice.service } }, ...extra.map(([name, value]) => ({ name, value }))],
          loc: agent.loc,
        }
      : undefined;
  const equips = agent.equips?.includes(choice.tool) ? agent.equips : [...(agent.equips ?? []), choice.tool];
  const params = agent.params.tools === undefined ? { ...agent.params, tools: "auto" } : agent.params;
  const text = note(choice.tool, choice.kind === "service" ? choice.service : undefined);
  // The runtime reads the system prompt from `system "..."`, else from system: or role: in the brackets.
  const own = agent.system ?? agent.params.system ?? agent.params.role;
  return { agent: { ...agent, equips, params, system: own ? `${own}\n\n${text}` : text }, tool: declared };
}
