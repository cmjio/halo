/**
 * Policy enforcement.
 *
 * Rules run on the prompt before an agent is called (input) and on its result
 * after (output). Only deterministic rules are enforced; AI-judged rules such
 * as Tone(...) are reported by the validator and skipped here.
 */

import type { PolicyDeclaration, PolicyRule, Agent } from "../parser/types.js";
import { PolicyViolation } from "./errors.js";

export interface Violation {
  policy: string;
  rule: string;
  message: string;
  phase: "input" | "output" | "budget";
  /** True when `@correct` sent the answer back and the agent fixed it (set after the fact). */
  corrected?: boolean;
}

interface Detector {
  test(text: string): boolean;
  redact?(text: string): string;
}

const PROFANITY = ["damn", "shit", "fuck", "fucking", "bitch", "bastard", "asshole", "crap", "dick", "piss"];

function pattern(re: RegExp, label: string, validate?: (match: string) => boolean): Detector {
  const global = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  return {
    test: (text) => [...text.matchAll(global)].some((m) => !validate || validate(m[0])),
    redact: (text) => text.replace(global, (m) => (!validate || validate(m) ? `[REDACTED:${label}]` : m)),
  };
}

function luhn(digits: string): boolean {
  const d = digits.replace(/\D/g, "");
  if (d.length < 13 || d.length > 19) return false;
  let sum = 0;
  for (let i = 0; i < d.length; i++) {
    let n = Number(d[d.length - 1 - i]);
    if (i % 2 === 1) n = n * 2 > 9 ? n * 2 - 9 : n * 2;
    sum += n;
  }
  return sum % 10 === 0;
}

const SSN = pattern(/\b\d{3}-\d{2}-\d{4}\b/, "SSN");
const CREDIT_CARD = pattern(/\b(?:\d[ -]?){12,18}\d\b/, "CreditCard", luhn);
const EMAIL = pattern(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/, "Email");
const PHONE = pattern(/(?<![\w-])(?:\+?1[ .-]?)?\(?\d{3}\)?[ .-]\d{3}[ .-]\d{4}\b/, "Phone");
const API_KEY = pattern(/\b(?:sk-(?:ant-)?[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{36,}|xox[abprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{35})\b/, "APIKey");
const IP_ADDRESS = pattern(/\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/, "IPAddress");

function combine(...ds: Detector[]): Detector {
  return {
    test: (t) => ds.some((d) => d.test(t)),
    redact: (t) => ds.reduce((acc, d) => d.redact!(acc), t),
  };
}

const PII = combine(SSN, CREDIT_CARD, EMAIL, PHONE);

const DETECTORS: Record<string, Detector> = {
  Profanity: { test: (t) => new RegExp(`\\b(?:${PROFANITY.join("|")})\\b`, "i").test(t) },
  DestructiveOps: {
    test: (t) =>
      /\b(?:DROP\s+(?:TABLE|DATABASE|SCHEMA|INDEX)|TRUNCATE(?:\s+TABLE)?\s+\w|DELETE\s+FROM)\b/i.test(t) ||
      /\brm\s+-[a-z]*r[a-z]*f?\b|\bgit\s+push\s+(?:-f|--force)\b|\bmkfs\b|:\(\)\s*\{\s*:\|:&\s*\};:/i.test(t),
  },
  PromptInjection: {
    test: (t) =>
      /\b(?:ignore|disregard|forget)\b.{0,40}\b(?:previous|prior|above|earlier|all)\b.{0,20}\b(?:instructions?|prompts?|rules)\b/i.test(t) ||
      /\b(?:reveal|print|show|repeat)\b.{0,30}\bsystem prompt\b/i.test(t) ||
      /\byou are now\b.{0,30}\b(?:DAN|jailbroken|developer mode|unfiltered)\b/i.test(t),
  },
  PII,
  SSN,
  CreditCard: CREDIT_CARD,
  Email: EMAIL,
  Phone: PHONE,
  APIKey: API_KEY,
  IPAddress: IP_ADDRESS,
  Markdown: { test: (t) => /\*\*[^*\n]+\*\*|__[^_\n]+__|^#{1,6}\s|```/m.test(t) },
};

const DESCRIPTIONS: Record<string, string> = {
  Profanity: "Profanity detected",
  DestructiveOps: "Destructive operations not allowed",
  PromptInjection: "Prompt injection attempt detected",
  PII: "Personal data (PII) detected",
  SSN: "Social security number detected",
  CreditCard: "Credit card number detected",
  Email: "Email address detected",
  Phone: "Phone number detected",
  APIKey: "API key or secret detected",
  Markdown: "Markdown formatting not allowed",
};

const unquote = (s: string | undefined) => (s ?? "").replace(/^(["'])(.*)\1$/, "$2");

/** Rough XML well-formedness: one root element and balanced tags. */
function isXml(text: string): boolean {
  const t = text.trim().replace(/^<\?xml[^>]*\?>/, "").trim();
  if (!t.startsWith("<")) return false;
  const stack: string[] = [];
  for (const m of t.matchAll(/<(\/?)([A-Za-z_][\w.:-]*)[^>]*?(\/?)>/g)) {
    if (m[3]) continue;
    if (m[1]) {
      if (stack.pop() !== m[2]) return false;
    } else stack.push(m[2]!);
  }
  return stack.length === 0;
}

function compare(a: unknown, op: string, b: unknown): boolean {
  const [x, y] = [Number(a), Number(b)];
  const numeric = !Number.isNaN(x) && !Number.isNaN(y) && a !== null && b !== null && a !== "" && b !== "";
  switch (op) {
    case "==": return numeric ? x === y : String(a) === String(b);
    case "!=": return numeric ? x !== y : String(a) !== String(b);
    case "<": return numeric && x < y;
    case "<=": return numeric && x <= y;
    case ">": return numeric && x > y;
    case ">=": return numeric && x >= y;
    default: return false;
  }
}

interface BoundRule {
  policy: string;
  rule: PolicyRule;
  logViolations: boolean;
}

export interface PolicyHooks {
  /** Total spend (USD) of the current run so far. */
  spent(): number;
  onViolation(v: Violation, log: boolean): void;
  /** Resolve `context.data.x.y` (and similar) for `Validate(...)`. */
  lookup?(path: string): unknown;
}

export class PolicyEngine {
  constructor(private policies: Map<string, PolicyDeclaration>) {}

  private rulesFor(agent: Agent): BoundRule[] {
    const bound: BoundRule[] = [];
    for (const name of agent.requires ?? []) {
      const g = this.policies.get(name);
      if (!g) throw new PolicyViolation(`Agent "${agent.name}" requires undefined policy "${name}"`, name, "requires");
      const logViolations = g.rules.some((r) => r.name === "LogViolation");
      for (const rule of g.rules) bound.push({ policy: g.name, rule, logViolations });
    }
    return bound;
  }

  private violate(b: BoundRule, message: string, phase: Violation["phase"], hooks: PolicyHooks): never {
    hooks.onViolation({ policy: b.policy, rule: b.rule.name, message, phase }, b.logViolations);
    throw new PolicyViolation(message, b.policy, b.rule.name);
  }

  /** Fail before calling an agent whose budget is already spent. */
  checkBudget(agent: Agent, hooks: PolicyHooks): void {
    for (const b of this.rulesFor(agent)) {
      if (b.rule.name !== "MaxSpend") continue;
      const limit = Number(b.rule.args[0]);
      if (hooks.spent() >= limit) this.violate(b, `Budget exceeded: spent $${hooks.spent().toFixed(4)} of $${limit.toFixed(2)}`, "budget", hooks);
    }
  }

  /** Redact and screen a prompt before it is sent. Returns the (possibly redacted) text. */
  checkInput(agent: Agent, text: string, hooks: PolicyHooks): string {
    let out = text;
    const rules = this.rulesFor(agent);
    for (const b of rules) if (b.rule.name === "Redact") out = redact(out, b.rule.args);
    for (const b of rules) if (b.rule.name === "Block") this.block(b, out, "input", hooks);
    return out;
  }

  /** Redact and screen an agent's result. Returns the (possibly redacted) value. */
  checkOutput(agent: Agent, value: unknown, hooks: PolicyHooks, usage: { completionTokens?: number } = {}): unknown {
    const rules = this.rulesFor(agent);
    let out = value;
    for (const b of rules) if (b.rule.name === "Redact") out = mapStrings(out, (s) => redact(s, b.rule.args));

    const text = typeof out === "string" ? out : JSON.stringify(out) ?? "";
    for (const b of rules) {
      const { name, args } = b.rule;
      if (name === "Block") this.block(b, text, "output", hooks);
      if (name === "MaxWords") {
        const limit = Number(args[0]);
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        if (words > limit) this.violate(b, `Content exceeds max words: ${words} > ${limit}`, "output", hooks);
      }
      if (name === "MaxChars") {
        const limit = Number(args[0]);
        if (text.length > limit) this.violate(b, `Content exceeds max characters: ${text.length} > ${limit}`, "output", hooks);
      }
      if ((name === "Enforce" || name === "Require") && args.some((a) => a.toUpperCase() === "JSON") && typeof out === "string") {
        this.violate(b, `Output is not valid JSON`, "output", hooks);
      }
      if (name === "Require" && args.some((a) => a.toUpperCase() === "XML") && !isXml(text)) {
        this.violate(b, `Output is not valid XML`, "output", hooks);
      }
      if (name === "Require" && args.includes("Citation") && !/\[(?:\d+|[\w.-]+)\]/.test(text)) {
        this.violate(b, `Output has no citations like [1] or [doc_id]`, "output", hooks);
      }
      if (name === "MatchRegex") {
        const pattern = unquote(args[0]);
        if (!new RegExp(pattern).test(text)) this.violate(b, `Output does not match the pattern /${pattern}/`, "output", hooks);
      }
      if (name === "MaxTokens" && usage.completionTokens !== undefined) {
        const limit = Number(args[0]);
        if (usage.completionTokens > limit) this.violate(b, `Output used ${usage.completionTokens} tokens, more than the limit of ${limit}`, "output", hooks);
      }
      if (name === "Validate") this.validateField(b, out, hooks);
      if (name === "MaxSpend") {
        const limit = Number(args[0]);
        if (hooks.spent() > limit) this.violate(b, `Budget exceeded: spent $${hooks.spent().toFixed(4)} of $${limit.toFixed(2)}`, "budget", hooks);
      }
    }
    return out;
  }

  /** `Validate("field", "<=", context.data.x.limit)`: compare a field of the (JSON) output with a context value or literal. */
  private validateField(b: BoundRule, out: unknown, hooks: PolicyHooks) {
    const [field = "", op = "", ref = ""] = b.rule.args.map(unquote);
    const obj = typeof out === "string" ? undefined : out;
    if (!obj || typeof obj !== "object") this.violate(b, `Validate: output is not JSON, so field "${field}" can't be checked`, "output", hooks);
    const actual = field.split(".").reduce<unknown>((v, k) => (v && typeof v === "object" ? (v as Record<string, unknown>)[k] : undefined), obj);
    if (actual === undefined) this.violate(b, `Validate: output has no field "${field}"`, "output", hooks);
    const expected = /^context\./.test(ref) ? hooks.lookup?.(ref) : ref;
    if (expected === undefined) this.violate(b, `Validate: "${ref}" is not set, so "${field}" can't be checked`, "output", hooks);
    if (!compare(actual, op, expected)) {
      this.violate(b, `Validate failed: ${field} (${JSON.stringify(actual)}) ${op} ${ref} (${JSON.stringify(expected)}) is false`, "output", hooks);
    }
  }

  private block(b: BoundRule, text: string, phase: Violation["phase"], hooks: PolicyHooks) {
    for (const category of b.rule.args) {
      const detector = DETECTORS[category];
      if (detector?.test(text)) {
        this.violate(b, `Content blocked: ${DESCRIPTIONS[category] ?? category + " detected"}`, phase, hooks);
      }
    }
  }
}

function redact(text: string, categories: string[]): string {
  return categories.reduce((acc, c) => DETECTORS[c]?.redact?.(acc) ?? acc, text);
}

function mapStrings(value: unknown, fn: (s: string) => string): unknown {
  if (typeof value === "string") return fn(value);
  if (Array.isArray(value)) return value.map((v) => mapStrings(v, fn));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, mapStrings(v, fn)]));
  }
  return value;
}
