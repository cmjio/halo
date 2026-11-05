/**
 * Skills: a library of instructions an agent can look up and load when a task needs one.
 *
 *   tool Playbook : Skills("./skills")              your skills, then Halo's built-in ones
 *   tool Playbook : Skills("./skills", builtin: false)
 *     list()   load(name)   read(name, path)
 *
 * Given to an agent with `tools: [Playbook]`, the agent sees every skill's name and
 * description and loads the full instructions only for the ones it needs. To always
 * give an agent a skill, use `skills:` instead (on the agent or the call).
 */

import { HaloError } from "../errors.js";
import { findSkill, readSkillFile, skillCatalog, skillFiles, type Skill } from "../skills.js";
import type { JsonSchema, ProviderInfo, ToolCall, ToolInfoContext, ToolMethod, ToolProvider } from "../tools.js";
import { need, unknownMethod } from "./common.js";

const METHODS = ["list", "load", "read"];

/** The folders and built-in setting of a Skills tool, from its declaration. */
export function skillSources(config: (name: string | number) => unknown): { dirs: string[]; builtin: boolean } {
  const first = config(0) ?? config("path");
  const dirs = (Array.isArray(first) ? first : first === undefined || first === null ? ["skills"] : [first]).map(String);
  return { dirs, builtin: config("builtin") !== false };
}

export function catalogFor(config: (name: string | number) => unknown): Skill[] {
  const { dirs, builtin } = skillSources(config);
  return skillCatalog(dirs, builtin);
}

function lookup(call: ToolCall, catalog: Skill[], name: unknown): Skill {
  const n = need(call, "name", name);
  const skill = findSkill(catalog, n);
  if (!skill) throw new HaloError(`${call.tool.name}: no skill named "${n}" (there are: ${catalog.map((s) => s.name).join(", ") || "none"})`, { code: "TOOL_ARGUMENT" });
  return skill;
}

export const skills: ToolProvider = async (call) => {
  const catalog = catalogFor(call.config);
  const n = call.named;
  switch (call.method) {
    case "list":
      return catalog.map((s) => ({ name: s.name, description: s.description, source: s.source }));
    case "load":
    case "get":
    case "use": {
      const skill = lookup(call, catalog, n.name ?? n.skill ?? (call.implicitInput ? undefined : call.positional[0]));
      return { name: skill.name, description: skill.description, instructions: skill.instructions, files: skillFiles(skill) };
    }
    case "read": {
      const skill = lookup(call, catalog, n.name ?? n.skill);
      const path = need(call, "path", n.path);
      try {
        return { name: skill.name, path, content: readSkillFile(skill, path) };
      } catch (err) {
        throw new HaloError(`${call.tool.name}.read: ${(err as Error).message}`, { code: "TOOL_ARGUMENT" });
      }
    }
    default:
      return unknownMethod(call, METHODS);
  }
};

const obj = (properties: Record<string, JsonSchema>, required: string[] = []): JsonSchema => ({ type: "object", properties, required, additionalProperties: false });

/** Methods, with `load`'s description carrying the catalog so the model knows what it can load. */
async function methods(ctx: ToolInfoContext): Promise<ToolMethod[]> {
  const catalog = catalogFor(ctx.config);
  const list = catalog.map((s) => `- ${s.name}: ${s.description}`).join("\n").slice(0, 6000);
  const names = catalog.map((s) => s.name);
  return [
    {
      name: "load",
      description: `Load a skill's full instructions before doing a task it covers, then follow them. Returns { name, instructions, files }. Available skills:\n${list || "(none)"}`,
      params: obj({ name: { type: "string", description: "The skill's name.", ...(names.length && names.length <= 100 ? { enum: names } : {}) } }, ["name"]),
      effect: "read",
    },
    {
      name: "read",
      description: "Read one of a skill's supporting files (listed in load's `files`), such as a template or a reference.",
      params: obj({ name: { type: "string", description: "The skill's name." }, path: { type: "string", description: "The file's path inside the skill." } }, ["name", "path"]),
      effect: "read",
    },
    { name: "list", description: "List every skill's name and description.", params: obj({}), effect: "read" },
  ];
}

export const SKILLS_INFO: ProviderInfo = {
  description: "A library of skills: instructions for specific kinds of task",
  methods,
};
