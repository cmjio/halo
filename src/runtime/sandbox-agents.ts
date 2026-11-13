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
 * `sandbox: "auto"` uses Docker when it's running, else E2B, else Daytona. A policy with
 * `AllowHosts("pypi.org", ...)` that the agent requires becomes its sandbox's egress allowlist
 * (`hosts:`), which Docker sandboxes enforce.
 */

import type { Agent, PolicyDeclaration, ToolDeclaration } from "../parser/types.js";

export const SANDBOX_SERVICES = ["e2b", "daytona", "docker", "auto"];

/** The hosts an agent's policies allow its sandbox to reach (AllowHosts), or undefined when none say. */
export function allowedHosts(agent: Agent, policies?: Map<string, PolicyDeclaration>): string[] | undefined {
  if (!policies) return undefined;
  let hosts: string[] | undefined;
  for (const name of agent.requires ?? []) {
    for (const rule of policies.get(name)?.rules ?? []) {
      // Several AllowHosts narrow: a host must be allowed by each of them.
      if (rule.name === "AllowHosts") hosts = hosts ? hosts.filter((h) => rule.args.includes(h)) : [...rule.args];
    }
  }
  return hosts;
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
  const hosts = allowedHosts(agent, policies);
  if (choice.kind === "service") {
    if (tools.has(choice.tool)) return `Agent "${agent.name}": sandbox: "${choice.service}" makes a tool named "${choice.tool}", but a tool of that name is already declared`;
    if (hosts && (choice.service === "e2b" || choice.service === "daytona")) return `Agent "${agent.name}": AllowHosts is enforced by Docker sandboxes; use sandbox: "docker" (or "auto"), or drop AllowHosts`;
    return undefined;
  }
  if (hosts && choice.kind === "tool") return `Agent "${agent.name}": AllowHosts limits a sandbox the agent owns (sandbox: "docker" or "auto"); for the shared tool ${choice.tool}, put hosts: [...] on its declaration`;
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

  const hosts = allowedHosts(agent, policies);
  const declared: ToolDeclaration | undefined =
    choice.kind === "service"
      ? {
          name: choice.tool,
          provider: "Remote",
          args: [`"${choice.service}"`],
          namedArgs: hosts ? { hosts: `[${hosts.join(", ")}]` } : {},
          argList: [{ value: { kind: "string", value: choice.service } }, ...(hosts ? [{ name: "hosts", value: { kind: "list" as const, items: hosts.map((h) => ({ kind: "string" as const, value: h })) } }] : [])],
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
