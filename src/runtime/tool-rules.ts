/**
 * Rules on a tool's arguments, written on its declaration:
 *
 *   tool Ledger : POST("ledger.example.com/v1/prizes/issue", apiKey: Env.LEDGER_KEY)
 *     & Fixed("currency", "USD")
 *     & Match("amount", "\\d+(\\.\\d\\d)?")
 *     & Locked("memo")
 *
 *   - Fixed(arg, value): every call sends this value. A model isn't shown the argument.
 *   - Match(arg, regex): the whole value must match. A missing argument counts as "".
 *   - Locked(arg, ...): a model may not set these (a pipeline still can), and isn't shown them.
 *   - Unlocked(arg, ...): undo a default lock. A POST tool's `path` is locked by default.
 *
 * Fixed and Match hold for every caller, pipelines included. They apply to the named
 * argument on each of the tool's methods.
 */

import type { ToolDeclaration, Value } from "../parser/types.js";
import { HaloError } from "./errors.js";
import type { JsonSchema } from "./tools.js";
import { safeRegex, type SafeRegex } from "./safe-regex.js";

export const TOOL_ARG_RULES = ["Fixed", "Match", "Locked", "Unlocked"] as const;

/** Arguments a model may not set unless the tool says `Unlocked(...)`, by provider. */
export const DEFAULT_LOCKED: Record<string, string[]> = {
  // A POST tool is bound to the address it declares; the path under it is the author's to choose.
  // `query:` is a raw query string: a model could put any parameter in it, past Locked, Fixed and Match.
  POST: ["path", "query"],
  GET: ["query"],
  REST: ["query"],
};

export interface ArgRules {
  fixed: Map<string, Value>;
  match: Map<string, { source: string; re: SafeRegex }[]>;
  locked: Set<string>;
}

/** A call a tool's own rules don't allow. */
export class ToolRuleViolation extends HaloError {
  constructor(message: string, readonly tool: string, readonly rule: string) {
    super(message, { code: "TOOL_ARGUMENT" });
    this.name = "ToolRuleViolation";
  }
}

const text = (v: Value | undefined): string | undefined => (v?.kind === "string" ? v.value : v?.kind === "ref" ? v.path.join(".") : undefined);

/** A Match pattern covers the whole value, so `\d+` can't be satisfied by "1; drop table". */
export const wholeValue = (source: string) => safeRegex(source, { whole: true, dotAll: true });

const cache = new WeakMap<ToolDeclaration, ArgRules>();

export function argRules(tool: ToolDeclaration): ArgRules {
  const known = cache.get(tool);
  if (known) return known;
  const rules: ArgRules = { fixed: new Map(), match: new Map(), locked: new Set(DEFAULT_LOCKED[tool.provider] ?? []) };
  for (const rule of tool.rules ?? []) {
    const name = text(rule.args[0]);
    if (rule.name === "Fixed" && name !== undefined && rule.args[1]) rules.fixed.set(name, rule.args[1]);
    else if (rule.name === "Match" && name !== undefined) {
      const source = text(rule.args[1]) ?? "";
      let re: SafeRegex;
      try {
        re = wholeValue(source);
      } catch {
        throw new HaloError(`Tool "${tool.name}": Match("${name}", ${JSON.stringify(source)}) is not a valid regular expression`, { code: "TOOL_CONFIG" });
      }
      rules.match.set(name, [...(rules.match.get(name) ?? []), { source, re }]);
    } else if (rule.name === "Locked") for (const a of rule.args) text(a) !== undefined && rules.locked.add(text(a)!);
  }
  // Unlocked is read last, so it undoes a default wherever it is written.
  for (const rule of tool.rules ?? []) if (rule.name === "Unlocked") for (const a of rule.args) rules.locked.delete(text(a) ?? "");
  cache.set(tool, rules);
  return rules;
}

export const hasRules = (rules: ArgRules) => rules.fixed.size > 0 || rules.match.size > 0 || rules.locked.size > 0;

const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);
const shown = (v: unknown) => (typeof v === "string" ? v : (JSON.stringify(v) ?? String(v)));

/**
 * A call's named arguments as the tool's rules leave them: fixed values filled in, the rest
 * checked. Throws ToolRuleViolation for a call the rules don't allow. `byModel` is true when
 * an agent chose the call.
 */
export function constrain(tool: ToolDeclaration, method: string, named: Record<string, unknown>, byModel: boolean, resolve: (v: Value) => unknown): Record<string, unknown> {
  const rules = argRules(tool);
  if (!hasRules(rules)) return named;
  const target = `${tool.name}.${method}`;
  const out = { ...named };
  if (byModel) {
    for (const name of rules.locked) {
      if (Object.hasOwn(named, name) && !rules.fixed.has(name)) {
        const how = (tool.rules ?? []).some((r) => r.name === "Locked" && r.args.some((a) => text(a) === name)) ? `Locked("${name}")` : `a ${tool.provider} tool's ${name} is the pipeline's to set; declare the tool with & Unlocked("${name}") to let a model choose it`;
        throw new ToolRuleViolation(`${target} was refused: a model can't set ${name} (${how})`, tool.name, "Locked");
      }
    }
  }
  for (const [name, value] of rules.fixed) {
    const fixed = resolve(value);
    if (Object.hasOwn(named, name) && !same(named[name], fixed)) {
      throw new ToolRuleViolation(`${target} was refused: ${name} is fixed by the tool (Fixed("${name}", …)) and can't be set to ${shown(named[name]).slice(0, 80)}`, tool.name, "Fixed");
    }
    out[name] = fixed;
  }
  // A raw query string can't set an argument the rules govern, whoever writes it: the URL and the
  // body are often merged by the server, so `query: "amount=99999"` would get past Match("amount").
  if (typeof out.query === "string" && out.query) {
    for (const key of new Set(new URLSearchParams(out.query).keys())) {
      if (rules.fixed.has(key) || rules.match.has(key) || (byModel && rules.locked.has(key))) {
        throw new ToolRuleViolation(`${target} was refused: ${key} can't be set through query: (the tool has a rule for ${key}); pass it as its own argument`, tool.name, rules.fixed.has(key) ? "Fixed" : rules.match.has(key) ? "Match" : "Locked");
      }
    }
  }
  for (const [name, patterns] of rules.match) {
    // A missing argument is checked as "", so a pattern that needs something also needs the argument.
    const value = out[name] === undefined || out[name] === null ? "" : shown(out[name]);
    for (const { source, re } of patterns) {
      // A value the pattern can't be decided on (it ran out of time) is refused, like one that doesn't match.
      const matched = re.test(value);
      if (matched === undefined) {
        throw new ToolRuleViolation(`${target} was refused: ${name} (${value.slice(0, 80)}) could not be checked against /${source}/ in time (Match on the tool)`, tool.name, "Match");
      }
      if (!matched) {
        throw new ToolRuleViolation(`${target} was refused: ${name} ${value === "" ? "is missing or empty, and" : `(${value.slice(0, 80)})`} must match /${source}/ (Match on the tool)`, tool.name, "Match");
      }
    }
  }
  return out;
}

/** A method's arguments as a model should see them: without the ones it can't set, with the patterns the rest must match. */
export function shownParams(tool: ToolDeclaration, params: JsonSchema | undefined): JsonSchema {
  const schema = params ?? { type: "object", properties: {} };
  const rules = argRules(tool);
  if (!hasRules(rules)) return schema;
  const hidden = (name: string) => rules.fixed.has(name) || rules.locked.has(name);
  const properties: Record<string, JsonSchema> = {};
  for (const [name, prop] of Object.entries(schema.properties ?? {})) if (!hidden(name)) properties[name] = prop;
  for (const [name, patterns] of rules.match) {
    if (hidden(name)) continue;
    const prop = properties[name] ?? { type: "string" };
    const note = `Must match ${patterns.map((p) => `/${p.source}/`).join(" and ")}.`;
    properties[name] = { ...prop, description: prop.description ? `${prop.description} ${note}` : note, ...(patterns.length === 1 && (prop.type ?? "string") === "string" ? { pattern: `^(?:${patterns[0]!.source})$` } : {}) };
  }
  const out: JsonSchema = { ...schema, properties };
  if (schema.required) out.required = schema.required.filter((name) => !hidden(name));
  return out;
}
