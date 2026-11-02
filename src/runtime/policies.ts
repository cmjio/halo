/**
 * Policy enforcement.
 *
 * Rules run on the prompt before an agent is called (input) and on its result
 * after (output). Only deterministic rules are enforced; AI-judged rules such
 * as Tone(...) are reported by the validator and skipped here.
 *
 * Tool rules (AllowTools, DenyTools, AllowEffects, ApproveTools, ApproveEffects,
 * DenyArgs) run on the tool calls an agent chooses, before they run.
 */

import type { PolicyDeclaration, PolicyRule, Agent } from "../parser/types.js";
import { HaloError, PolicyViolation } from "./errors.js";

export interface Violation {
  policy: string;
  rule: string;
  message: string;
  phase: "input" | "output" | "budget" | "tool";
  /** True when `@correct` sent the answer back and the agent fixed it (set after the fact). */
  corrected?: boolean;
}

export type ToolEffectName = "read" | "write" | "external";

/** `Repo`, `Repo.create_pr`, `Repo.*`, `*.delete`, `*`: a tool pattern, matched against "Tool.method". */
export function toolMatches(pattern: string, target: string): boolean {
  if (pattern === "*") return true;
  if (!pattern.includes(".")) return target.split(".")[0] === pattern;
  const re = new RegExp(`^${pattern.split("*").map((p) => p.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join("[^.]*")}$`);
  return re.test(target);
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

// Digit runs are bounded by non-digits, not \b, so "SSN123-45-6789" and "card4111..." still match.
const SSN = pattern(/(?<!\d)\d{3}[- .]\d{2}[- .]\d{4}(?!\d)/, "SSN");
const CREDIT_CARD = pattern(/(?<!\d)(?:\d[ .-]?){12,18}\d(?!\d)/, "CreditCard", luhn);
// Starts only where a local part can start, and reads the domain label by label: a scan stays linear
// on long runs like "a.a.a…@----…" (the old pattern took seconds on 100 KB).
const EMAIL = pattern(/(?<![A-Za-z0-9._%+-])[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}(?![A-Za-z0-9-])/, "Email");
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
      /\b(?:ignore|disregard|forget)\b[\s\S]{0,40}\b(?:previous|prior|above|earlier|all)\b[\s\S]{0,20}\b(?:instructions?|prompts?|rules)\b/i.test(t) ||
      /\b(?:reveal|print|show|repeat)\b[\s\S]{0,30}\bsystem\s+prompt\b/i.test(t) ||
      /\byou\s+are\s+now\b[\s\S]{0,30}\b(?:DAN|jailbroken|developer\s+mode|unfiltered)\b/i.test(t),
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

/** Cyrillic and Greek letters that look like Latin ones. */
const LOOKALIKES: Record<string, string> = Object.fromEntries(
  [..."аaеeоoрpсcуyхxіiјjѕsԁdһhӏlАAВBЕEКKМMНHОOРPСCТTХXІIЈJЅSαaοoιiκkνvρpτtυuχxΑAΒBΕEΖZΗHΙIΚKΜMΝNΟOΡPΤTΥYΧX"].flatMap((c, i, all) => (i % 2 ? [] : [[c, all[i + 1]!]])),
);

/** A digit in any script (Arabic-Indic, Devanagari, ...) as its ASCII digit. */
function asciiDigit(d: string): string {
  let zero = d.codePointAt(0)!;
  while (/\p{Nd}/u.test(String.fromCodePoint(zero - 1)) && d.codePointAt(0)! - zero < 9) zero--;
  return String((d.codePointAt(0)! - zero) % 10);
}

/**
 * Text as the detectors read it: compatibility forms folded (fullwidth digits, ligatures),
 * accents and invisible characters (zero-width, bidi, tag, variation selectors, fillers)
 * removed, digits in any script made ASCII, Cyrillic and Greek look-alikes made Latin,
 * dash and space look-alikes made plain, and HTML and %-escapes decoded, so none of them
 * can be used to slip past Block or Redact.
 */
export function normalizeForScan(text: string): string {
  return decodeEscapes(text)
    .normalize("NFKD")
    .replace(/[\p{M}\p{Cf}\u115F\u1160\u3164\uFFA0]/gu, "")
    .normalize("NFKC")
    .replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, "-")
    .replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, " ")
    .replace(/[^\x00-\x7F]/g, (c) => LOOKALIKES[c] ?? (/\p{Nd}/u.test(c) ? asciiDigit(c) : c));
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/** HTML entities (&#49; &#x41; &amp;) and %-escapes of printable ASCII, decoded. */
function decodeEscapes(text: string): string {
  return text
    .replace(/&#(\d{1,7});|&#x([0-9a-f]{1,6});|&(amp|lt|gt|quot|apos|nbsp);/gi, (m, dec, hex, name) => {
      const cp = dec ? Number(dec) : hex ? parseInt(hex, 16) : undefined;
      if (cp === undefined) return ENTITIES[name.toLowerCase()] ?? m;
      return cp <= 0x10ffff ? String.fromCodePoint(cp) : m;
    })
    .replace(/%([2-7][0-9a-f])/gi, (m, h) => (parseInt(h, 16) < 0x7f ? String.fromCharCode(parseInt(h, 16)) : m));
}

const JSON_ESCAPE = /(\\(?:u[0-9a-fA-F]{4}|["\\/bfnrt]))/;

/** A JSON-escaped string's text: an object in a prompt reads "ssn:\n123…", where the n would hide what follows. */
function unescapeJson(text: string): string {
  return text.replace(new RegExp(JSON_ESCAPE.source, "g"), (e) =>
    e[1] === "u" ? String.fromCharCode(parseInt(e.slice(2), 16)) : ({ b: "\b", f: "\f", n: "\n", r: "\r", t: "\t" } as Record<string, string>)[e[1]!] ?? e[1]!,
  );
}

/** All the text in a value, for Block: strings, numbers and keys, each on its own line. */
function scanText(value: unknown): string {
  const parts: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === "string") parts.push(v);
    else if (typeof v === "number" || typeof v === "bigint") parts.push(String(v));
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) (parts.push(k), walk(x));
  };
  shallowEnough(() => walk(value));
  return parts.join("\n");
}

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Every string or number inside an argument value, each on its own. */
function argValues(value: unknown): string[] {
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === "string") out.push(v);
    else if (typeof v === "number" || typeof v === "boolean") out.push(String(v));
    else if (Array.isArray(v)) v.forEach(walk);
    else if (isRecord(v)) Object.values(v).forEach(walk);
  };
  shallowEnough(() => walk(value));
  return out;
}

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

/** A number, or a string that is one ("42", " 3.5 "); not booleans, lists, or blanks, which Number() would also accept. */
function asNumber(v: unknown): number | undefined {
  if (typeof v === "number") return Number.isNaN(v) ? undefined : v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  return undefined;
}

function compare(a: unknown, op: string, b: unknown): boolean {
  const [x, y] = [asNumber(a), asNumber(b)];
  const numeric = x !== undefined && y !== undefined;
  const same = numeric ? x === y : typeof a === "string" && typeof b === "string" ? a === b : JSON.stringify(a) === JSON.stringify(b);
  switch (op) {
    case "==": return same;
    case "!=": return !same;
    case "<": return numeric && x! < y!;
    case "<=": return numeric && x! <= y!;
    case ">": return numeric && x! > y!;
    case ">=": return numeric && x! >= y!;
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
    // An agent held to JSON that wraps its answer in prose or a code fence still gave JSON.
    const wantsJson = rules.some((b) => (b.rule.name === "Enforce" || b.rule.name === "Require") && b.rule.args.some((a) => a.toUpperCase() === "JSON"));
    if (wantsJson && typeof out === "string") out = extractJson(out) ?? out;
    for (const b of rules) if (b.rule.name === "Redact") out = mapStrings(out, (s) => redact(s, b.rule.args));

    const text = typeof out === "string" ? out : JSON.stringify(out) ?? "";
    for (const b of rules) {
      const { name, args } = b.rule;
      if (name === "Block") this.block(b, scanText(out), "output", hooks);
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
        let re: RegExp;
        try {
          re = new RegExp(pattern);
        } catch {
          throw new PolicyViolation(`Policy "${b.policy}": MatchRegex(${args[0]}) is not a valid regular expression`, b.policy, name);
        }
        if (!re.test(text)) this.violate(b, `Output does not match the pattern /${pattern}/`, "output", hooks);
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

  /**
   * What an agent's output may show in logs and telemetry: redacted like the output itself,
   * or withheld when a Block rule would stop it.
   */
  forLog(agent: Agent, value: unknown): unknown {
    const rules = this.rulesFor(agent);
    let out = value;
    for (const b of rules) if (b.rule.name === "Redact") out = mapStrings(out, (s) => redact(s, b.rule.args));
    const blocked = rules.find((b) => b.rule.name === "Block" && this.blocks(b, scanText(out)));
    return blocked ? `[withheld: blocked by policy ${blocked.policy}]` : out;
  }

  /** The lowest MaxSpend limit on an agent, if it has one. */
  spendLimit(agent: Agent): number | undefined {
    const limits = this.rulesFor(agent).filter((b) => b.rule.name === "MaxSpend").map((b) => Number(b.rule.args[0]));
    return limits.length ? Math.min(...limits) : undefined;
  }

  /** Fail a call that can't fit in what is left of the agent's budget. */
  refuseOverBudget(agent: Agent, hooks: PolicyHooks): never {
    const b = this.rulesFor(agent).find((x) => x.rule.name === "MaxSpend")!;
    const limit = Number(b.rule.args[0]);
    this.violate(b, `Budget exceeded: spent $${hooks.spent().toFixed(4)} of $${limit.toFixed(2)}, with no room left for another call`, "budget", hooks);
  }

  /**
   * Whether an agent may see a tool method at all: AllowTools / AllowEffects (each rule must
   * allow it, so several policies narrow what's allowed) and DenyTools. Hidden methods are
   * never offered to the model; a call to one anyway is refused by checkToolCall.
   */
  toolVisible(agent: Agent, target: string, effect: ToolEffectName): boolean {
    return this.toolRefusal(this.rulesFor(agent), target, effect) === undefined;
  }

  /**
   * Check a tool call an agent asked for, before it runs. Returns "allow", or the policy that
   * wants a human to approve it first; a refused call records a violation and throws.
   */
  checkToolCall(agent: Agent, target: string, effect: ToolEffectName, args: unknown, hooks: PolicyHooks): "allow" | { approve: string } {
    const rules = this.rulesFor(agent);
    const refusal = this.toolRefusal(rules, target, effect);
    if (refusal) this.violate(refusal.rule, refusal.message, "tool", hooks);
    for (const b of rules) {
      if (b.rule.name !== "DenyArgs") continue;
      // DenyArgs(tool, regex) checks every argument's value; DenyArgs(tool, "name", regex) checks one argument.
      const parts = b.rule.args.map(unquote);
      const [pattern = "*", field, regex = ""] = parts.length >= 3 ? parts : [parts[0], undefined, parts[1]];
      if (!toolMatches(pattern, target)) continue;
      let re: RegExp;
      try {
        re = new RegExp(regex, "i");
      } catch {
        throw new PolicyViolation(`Policy "${b.policy}": DenyArgs(${b.rule.args.join(", ")}) is not a valid regular expression`, b.policy, "DenyArgs");
      }
      const values = argValues(field === undefined ? args : isRecord(args) ? args[field] : undefined);
      // A missing argument is checked as "", so an allow-list pattern like ^(?!bun test) also refuses its absence.
      if (field !== undefined && !values.length) values.push("");
      const hit = values.find((v) => [v, normalizeForScan(v), unescapeJson(v)].some((t) => re.test(t)));
      if (hit !== undefined) this.violate(b, `${target} was refused: ${field ? `its ${field}` : "an argument"} matches /${regex}/`, "tool", hooks);
    }
    const approver = rules.find(
      (b) => (b.rule.name === "ApproveTools" && b.rule.args.some((p) => toolMatches(unquote(p), target))) || (b.rule.name === "ApproveEffects" && b.rule.args.map(unquote).includes(effect)),
    );
    return approver ? { approve: approver.policy } : "allow";
  }

  private toolRefusal(rules: BoundRule[], target: string, effect: ToolEffectName): { rule: BoundRule; message: string } | undefined {
    for (const b of rules) {
      const args = b.rule.args.map(unquote);
      if (b.rule.name === "AllowTools" && !args.some((p) => toolMatches(p, target))) return { rule: b, message: `${target} is not in the tools policy "${b.policy}" allows` };
      if (b.rule.name === "DenyTools" && args.some((p) => toolMatches(p, target))) return { rule: b, message: `${target} is denied by policy "${b.policy}"` };
      if (b.rule.name === "AllowEffects" && !args.includes(effect)) return { rule: b, message: `${target} has effect "${effect}", which policy "${b.policy}" doesn't allow` };
    }
    return undefined;
  }

  private blocks(b: BoundRule, text: string): string | undefined {
    const plain = unescapeJson(text);
    return b.rule.args.find((category) => {
      const detector = DETECTORS[category];
      return detector && [text, normalizeForScan(text), plain, normalizeForScan(plain)].some((t) => detector.test(t));
    });
  }

  private block(b: BoundRule, text: string, phase: Violation["phase"], hooks: PolicyHooks) {
    const category = this.blocks(b, text);
    if (category) this.violate(b, `Content blocked: ${DESCRIPTIONS[category] ?? category + " detected"}`, phase, hooks);
  }
}

function redact(text: string, categories: string[]): string {
  // Redact between JSON escapes, so "\n123-45-6789" in a prompt is read as a new line, not "n123…".
  return text.split(JSON_ESCAPE).map((part, i) => (i % 2 ? part : redactText(part, categories))).join("");
}

function redactText(text: string, categories: string[]): string {
  const pass = (t: string) => categories.reduce((acc, c) => DETECTORS[c]?.redact?.(acc) ?? acc, t);
  const out = pass(text);
  // Something hidden with look-alike characters: redact the normalized text instead.
  const plain = normalizeForScan(out);
  return categories.some((c) => DETECTORS[c]?.redact && DETECTORS[c]!.test(plain)) ? pass(plain) : out;
}

function mapStrings(value: unknown, fn: (s: string) => string): unknown {
  return shallowEnough(() => mapStringsDeep(value, fn));
}

/** Walking a value thousands of levels deep overflows the stack; fail with a clear error instead. */
function shallowEnough<T>(walk: () => T): T {
  try {
    return walk();
  } catch (err) {
    if (err instanceof RangeError) throw new HaloError("A value is nested too deeply to check against policies (thousands of levels of lists or objects)", { code: "VALUE_TOO_DEEP" });
    throw err;
  }
}

function mapStringsDeep(value: unknown, fn: (s: string) => string): unknown {
  if (typeof value === "string") return fn(value);
  // A card number sent as a number is still a card number.
  if (typeof value === "number" && Number.isFinite(value)) {
    const text = String(value);
    const out = fn(text);
    return out === text ? value : out;
  }
  if (Array.isArray(value)) return value.map((v) => mapStringsDeep(v, fn));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [fn(k), mapStringsDeep(v, fn)]));
  }
  return value;
}

/**
 * The JSON object or list inside a reply like "Here is the fix: ```json {...} ```" or
 * "Looking at this... {...}": the last ```json fence that parses, else the longest
 * span from an opening { or [ to the reply's last matching bracket that parses.
 */
export function extractJson(text: string): object | undefined {
  const fences = [...text.matchAll(/```(?:json)?[ \t]*\n([\s\S]*?)\n[ \t]*```/g)].reverse();
  for (const f of fences) {
    const parsed = tryJson(f[1]!.trim());
    if (parsed) return parsed;
  }
  const ends = { "{": text.lastIndexOf("}"), "[": text.lastIndexOf("]") };
  let tries = 0;
  for (let i = 0; i < text.length && tries < 50; i++) {
    const c = text[i];
    if ((c !== "{" && c !== "[") || ends[c] < i) continue;
    tries++;
    const parsed = tryJson(text.slice(i, ends[c] + 1));
    if (parsed) return parsed;
  }
  return undefined;
}

function tryJson(text: string): object | undefined {
  try {
    const v: unknown = JSON.parse(text);
    return v && typeof v === "object" ? v : undefined;
  } catch {
    return undefined;
  }
}
