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

import { aKind, type MediaKind } from "./media-ref.js";
import type { PolicyDeclaration, PolicyRule, Agent } from "../parser/types.js";
import { HaloError, PolicyViolation } from "./errors.js";
import { splitToolPath } from "../linker/names.js";

export interface Violation {
  policy: string;
  rule: string;
  message: string;
  phase: "input" | "output" | "budget" | "tool";
  /** True when `@correct` sent the answer back and the agent fixed it (set after the fact). */
  corrected?: boolean;
  /** True when `@cascade` moved the call up to a bigger model because of it (set after the fact). */
  escalated?: boolean;
}

export type ToolEffectName = "read" | "write" | "external" | "wallet";

/** `Repo`, `Repo.create_pr`, `Repo.*`, `*.delete`, `*`: a tool pattern, matched against "Tool.method". */
export function toolMatches(pattern: string, target: string): boolean {
  if (pattern === "*") return true;
  // Tool names the linker qualifies (`@acme/x.y#Desk`) may hold dots: split after the `#`.
  const p = splitToolPath(pattern);
  const t = splitToolPath(target);
  if (p.method === undefined) return t.tool === p.tool;
  const glob = (g: string, star: string) => new RegExp(`^${g.split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(star)}$`);
  return glob(p.tool, "[^]*").test(t.tool) && t.method !== undefined && glob(p.method, "[^.]*").test(t.method);
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

// What a model asked to "format it differently" puts between digits: spaces, dots, dashes,
// slashes, underscores, backslashes, markdown emphasis, or an HTML tag.
const SEP = String.raw`(?:[ \t._/\\*~|-]|<\/?[a-z]{1,10}>)`;
// Digit runs are bounded by non-digits, not \b, so "SSN123-45-6789" and "card4111..." still match.
// Groups may be spread out ("1 2 3 - 4 5 - 6 7 8 9"), and nine bare digits count after "SSN".
const SSN = combine(
  pattern(new RegExp(String.raw`(?<!\d)\d(?: ?\d){2}${SEP}{1,3}\d ?\d${SEP}{1,3}\d(?: ?\d){3}(?!\d)`), "SSN"),
  pattern(/(?<=\b(?:ssn|social\s+security(?:\s+(?:number|no\.?|#))?)\W{0,10})\d{9}(?!\d)/i, "SSN"),
);
const CREDIT_CARD = pattern(new RegExp(String.raw`(?<!\d)(?:\d${SEP}{0,2}){12,18}\d(?!\d)`), "CreditCard", luhn);
// Starts only where a local part can start, and reads the domain label by label: a scan stays linear
// on long runs like "a.a.a…@----…" (the old pattern took seconds on 100 KB).
// Also the spelled-out forms a model is asked for to dodge a filter: "bob [at] example [dot] com",
// "bob @ example . com", "bob at example dot com".
const EMAIL = combine(
  pattern(/(?<![A-Za-z0-9._%+-])[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}(?![A-Za-z0-9-])/, "Email"),
  pattern(/(?<![A-Za-z0-9._%+-])[A-Za-z0-9._%+-]+(?: ?[[({] ?at ?[\])}] ?| +@ *| *@ +)(?:[A-Za-z0-9-]+(?: ?[[({] ?dot ?[\])}] ?| ?\. ?))+[A-Za-z]{2,}(?![A-Za-z0-9-])/i, "Email"),
  pattern(/(?<![A-Za-z0-9._%+-])[A-Za-z0-9._%+-]+ +at +(?:[A-Za-z0-9-]+ +dot +)+(?:com|net|org|edu|gov|io|co|uk|de|fr|ca|au|ai|dev|app|info|biz|me|us)\b/i, "Email"),
);
const PHONE = combine(
  pattern(/(?<![\w-])(?:\+?1[ .-]?)?\(?\d{3}\)?[ .-]\d{3}[ .-]\d{4}\b/, "Phone"),
  // International (E.164) numbers: "+44 20 7946 0958", "+14155551234".
  pattern(/(?<![\w+])\+(?:[ .()-]{0,2}\d){8,15}(?!\d)/, "Phone"),
  // Ten bare digits after a word that says it's a phone number.
  pattern(/(?<=\b(?:phone|tel|telephone|call|cell|mobile|text|sms|fax|whatsapp)\b[^\d\n]{0,15})(?:1[ .-]?)?\d{10}(?!\d)/i, "Phone"),
);
const API_KEY = combine(
  pattern(
    /\b(?:sk-(?:ant-|proj-)?[A-Za-z0-9_-]{20,}|(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{16,}|(?:AKIA|ASIA)[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{22,}|glpat-[A-Za-z0-9_-]{20,}|xox[abprs]-[A-Za-z0-9-]{10,}|xapp-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{35}|eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})\b/,
    "APIKey",
  ),
  pattern(/-----BEGIN [A-Z ]{0,20}PRIVATE KEY-----[\s\S]{0,10000}?-----END [A-Z ]{0,20}PRIVATE KEY-----/, "APIKey"),
);
// Dots may be "defanged" ("10[.]0[.]0[.]1") or spaced.
const OCTET = String.raw`(?:25[0-5]|2[0-4]\d|1?\d?\d)`;
const DOT = String.raw`(?: ?\. ?|\[\.\]|\(\.\)|\[dot\]|\(dot\))`;
const IP_ADDRESS = pattern(new RegExp(String.raw`(?<![\d.])(?:${OCTET}${DOT}){3}${OCTET}(?![\d]|\.\d)`, "i"), "IPAddress");

function combine(...ds: Detector[]): Detector {
  return {
    test: (t) => ds.some((d) => d.test(t)),
    redact: (t) => ds.reduce((acc, d) => d.redact!(acc), t),
  };
}

const PII = combine(SSN, CREDIT_CARD, EMAIL, PHONE);

const INSTRUCTIONS = String.raw`(?:instructions?|prompts?|rules|directions?|directives?|guidelines?|guardrails?|policies|polic(?:y|ies)|restrictions?|constraints?|programming)`;

const INJECTION: RegExp[] = [
  // "ignore all previous instructions", "disregard the rules above", "forget your guidelines"
  new RegExp(String.raw`\b(?:ignore|disregard|forget)\b[\s\S]{0,40}\b(?:previous|prior|above|earlier|preceding|all|any|your|these|those|existing|original|initial|system|developer|safety)\b[\s\S]{0,25}\b${INSTRUCTIONS}`, "i"),
  new RegExp(String.raw`\b(?:override|bypass|circumvent)\s+(?:all\s+|any\s+)?(?:of\s+)?(?:your|the\s+system|system|safety|previous|prior|developer)\s+(?:\w+\s+)?${INSTRUCTIONS}`, "i"),
  new RegExp(String.raw`\b(?:ignore|disregard|forget)\s+(?:the|my|our)\s+(?:\w+\s+)?${INSTRUCTIONS}\s+(?:above|before|given\s+(?:above|earlier|before)|you\s+(?:were|have\s+been)\s+given)`, "i"),
  /\b(?:ignore|disregard|forget)\s+(?:everything|anything|all)\s+(?:you\s+(?:were|have\s+been|'ve\s+been)\s+(?:told|given|instructed)|(?:said\s+)?(?:above|before|earlier|previously))/i,
  // "new instructions:", "updated system prompt:"
  /\b(?:new|updated|revised|real|actual|true|override)\s+(?:system\s+)?(?:instructions?|prompt|rules|directives?)\s*[:\-=]/i,
  // Chat-template and role markers that try to start a new turn.
  /<\|?\/?(?:im_start|im_end|system|assistant|developer|endoftext)\|?>|\[\/?(?:INST|SYS)\]|<<\/?SYS>>/i,
  /(?:^|\n)\s*(?:#{1,6}\s*)?(?:system|developer)\s+(?:prompt|message|override|instructions?)\s*:/i,
  // "reveal your system prompt", "print the hidden instructions"
  new RegExp(String.raw`\b(?:reveal|print|show|repeat|output|display|tell\s+me|leak|dump|recite|echo)\b[\s\S]{0,30}\b(?:system|hidden|secret|initial|original|developer)\s+(?:prompt|message|${INSTRUCTIONS})`, "i"),
  // "you are now DAN", "act as an unrestricted AI", "pretend you have no rules"
  /\byou\s+are\s+(?:now|no\s+longer)\b[\s\S]{0,40}\b(?:DAN|jailbroken|developer\s+mode|unfiltered|unrestricted|uncensored|bound|restricted|limited)\b/i,
  /\b(?:act\s+as|pretend\s+(?:to\s+be|you\s+are|you're)|roleplay\s+as)\b[\s\S]{0,40}\b(?:with(?:out)?\s+(?:no|any)\s+(?:restrictions|rules|limits|filters|guidelines)|unrestricted|unfiltered|uncensored|jailbroken)\b/i,
  /\b(?:developer|god|admin|DAN|jailbreak)\s+mode\s+(?:enabled|activated|on)\b|\benable\s+(?:developer|god|admin|DAN|jailbreak)\s+mode\b/i,
  // The same "ignore previous instructions" in a few other languages (accents are folded away before this runs).
  /\b(?:ignora|olvida)\w*\s+(?:todas?\s+)?(?:las\s+)?instrucciones\s+(?:anteriores|previas)/i,
  /\b(?:ignore|oublie)\w*\s+(?:toutes\s+)?(?:les\s+)?instructions\s+(?:precedentes|anterieures)/i,
  /\b(?:ignorier|vergiss)\w*\s+(?:alle\s+)?(?:vorherigen|bisherigen|obigen)\s+(?:anweisungen|instruktionen|regeln)/i,
  /\b(?:ignor[ea]|esque[cç]a)\w*\s+(?:todas\s+)?(?:as\s+|le\s+)?(?:instrucoes|istruzioni)\s+(?:anteriores|precedenti)/i,
];

const DESTRUCTIVE: RegExp[] = [
  // SQL
  /\b(?:DROP\s+(?:TABLE|DATABASE|SCHEMA|INDEX|VIEW|USER|ROLE|COLLECTION)|TRUNCATE(?:\s+TABLE)?\s+\w+|DELETE\s+FROM|ALTER\s+TABLE\s+\S+\s+DROP)\b/i,
  /\b(?:FLUSHALL|FLUSHDB)\b|\.(?:dropDatabase|drop)\(\s*\)|\.deleteMany\(\s*\{\s*\}\s*\)/i,
  // Shell: rm -rf in any spelling, find -delete, dd onto a device, shred, mkfs, the fork bomb
  /\brm\s+(?:-[a-z]*r[a-z]*|-[a-z]*R[a-z]*|--recursive)\b/i,
  /\bfind\b[^\n|;&]*\s-delete\b|\bdd\b[^\n|;&]*\bof=\/dev\/|>\s*\/dev\/(?:sd|nvme|hd|disk)|\bshred\s+-|\bmkfs\b|\bwipefs\b|:\(\)\s*\{\s*:\|:&\s*\};:/i,
  /\bchmod\s+-R\s+0?777\s+\/|\bchown\s+-R\b[^\n]*\s\/(?:\s|$)/i,
  // Windows
  /\b(?:format\s+[a-z]:|del\s+\/[sq]\b|rd\s+\/s\b|rmdir\s+\/s\b|Remove-Item\b[^\n]*-Recurse)/i,
  // git
  /\bgit\s+push\b[^\n;&|]*(?:\s-f\b|\s--force\b|\s--force-with-lease\b|\s\+\S)|\bgit\s+reset\s+--hard\b|\bgit\s+clean\s+-[a-z]*f|\bgit\s+branch\s+-D\b|\bgit\s+filter-branch\b/i,
  // Cloud and infrastructure
  /\bterraform\s+destroy\b|\bkubectl\s+delete\b|\bhelm\s+(?:uninstall|delete)\b|\baws\s+s3\s+(?:rm\b[^\n]*--recursive|rb\b)|\baws\s+\S+\s+delete-|\bgcloud\b[^\n]*\bdelete\b|\baz\b[^\n]*\bdelete\b|\bdocker\s+(?:system|volume)\s+prune\b/i,
];

const DETECTORS: Record<string, Detector> = {
  Profanity: { test: (t) => new RegExp(`\\b(?:${PROFANITY.join("|")})\\b`, "i").test(t) },
  DestructiveOps: { test: (t) => DESTRUCTIVE.some((re) => re.test(t)) },
  PromptInjection: { test: (t) => INJECTION.some((re) => re.test(t)) },
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
  IPAddress: "IP address detected",
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
    // A soft hyphen between digits stands for a dash; anywhere else it is invisible.
    .replace(/(?<=\d)\u00AD(?=\d)/g, "-")
    .normalize("NFKD")
    .replace(/[\p{M}\p{Cf}\u115F\u1160\u3164\uFFA0]/gu, "")
    .normalize("NFKC")
    .replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, "-")
    .replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, " ")
    .replace(/[^\x00-\x7F]/g, (c) => LOOKALIKES[c] ?? (/\p{Nd}/u.test(c) ? asciiDigit(c) : c));
}

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", commat: "@", period: ".", lowbar: "_", hyphen: "-", dash: "-",
  colon: ":", sol: "/", bsol: "\\", num: "#", plus: "+", excl: "!", quest: "?", lpar: "(", rpar: ")", lsqb: "[", rsqb: "]",
};

/** HTML entities (&#49; &#x41; &amp;) and %-escapes of printable ASCII, decoded. */
function decodeEscapes(text: string): string {
  return text
    .replace(/&#(\d{1,7});?|&#x([0-9a-f]{1,6});?|&([a-z]{2,8});/gi, (m, dec, hex, name) => {
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

/** Categories detected from words (not digits), which also read the text with letter tricks undone. */
const WORD_CATEGORIES = new Set(["PromptInjection", "DestructiveOps", "Profanity"]);

const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "@": "a", $: "s", "!": "i", "|": "l" };

/**
 * Normalized text with the tricks a model can be talked into undone, for the word categories:
 * SQL and HTML comments and tags ("DROP/**\/TABLE"), letters spread out ("I-g-n-o-r-e",
 * "i g n o r e"), and digits or symbols for letters ("1gn0re prev10us").
 */
function wordView(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->/g, " ")
    .replace(/<\/?[a-z][^<>]{0,100}>/gi, " ")
    .replace(/\b(?:[A-Za-z0-9@$][-._*~ |+]){2,}[A-Za-z0-9@$](?![A-Za-z0-9])/g, (m) => m.replace(/[-._*~ |+]/g, ""))
    .replace(/(?<=[A-Za-z])[0134578@$!|]|[0134578@$!|](?=[A-Za-z])/g, (c) => LEET[c] ?? c)
    .replace(/\s+/g, " ");
}

/** Runs of base64 or hex long enough to hide a value, each with its text when it decodes to readable text. */
function encodedRuns(text: string): Array<{ run: string; decoded: string }> {
  const out: Array<{ run: string; decoded: string }> = [];
  const readable = (s: string) => s.length >= 6 && /^[\x09\x0A\x0D\x20-\x7E\u00A0-\uFFFF]+$/.test(s) && !s.includes("\uFFFD");
  for (const m of text.matchAll(/(?<![A-Za-z0-9+/_-])(?:[A-Za-z0-9+/]{16,}={0,2}|[A-Za-z0-9_-]{16,}={0,2})(?![A-Za-z0-9+/_=-])/g)) {
    const run = m[0];
    if (/^[0-9a-f]+$/i.test(run) && run.length % 2 === 0) {
      const decoded = Buffer.from(run, "hex").toString("utf8");
      if (readable(decoded)) out.push({ run, decoded });
      continue;
    }
    // A plain word or identifier is not base64: it needs a digit, or both cases.
    if (!/\d/.test(run) && !(/[a-z]/.test(run) && /[A-Z]/.test(run))) continue;
    const decoded = Buffer.from(run.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    if (readable(decoded)) out.push({ run, decoded });
  }
  return out;
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
  /** USD added to every MaxSpend limit for this run (a person extended its budget). */
  added?(): number;
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
      const limit = Number(b.rule.args[0]) + (hooks.added?.() ?? 0);
      if (hooks.spent() >= limit) this.violate(b, `Budget exceeded: spent $${hooks.spent().toFixed(4)} of $${limit.toFixed(2)}`, "budget", hooks);
    }
  }

  /**
   * Why this agent may not be sent these images or documents, if it may not. Block and Redact
   * read text, so an agent that has either is sent no media unless a policy of its says
   * `AllowMedia(image, pdf)`: a rule like Redact(PII) must not become untrue because the
   * input was a photo. `AllowMedia` on any agent also limits it to the kinds it names.
   */
  mediaRefusal(agent: Agent, media: Array<{ $media: string; type: string }>): { rule: BoundRule; message: string } | undefined {
    if (!media.length) return undefined;
    const rules = this.rulesFor(agent);
    const allow = rules.filter((b) => b.rule.name === "AllowMedia");
    const guard = rules.find((b) => b.rule.name === "Block" || b.rule.name === "Redact");
    if (!allow.length && !guard) return undefined;
    const allowed = new Set(allow.flatMap((b) => b.rule.args.map((a) => a.toLowerCase())));
    // A file answers to its kind, its media type, and the short names people use for it (mp3, mov).
    const names = (m: { $media: string; type: string }) => {
      const sub = m.type.split("/")[1]!;
      return [m.$media, m.type, sub, ...(sub === "mpeg" ? ["mp3"] : []), ...(sub === "quicktime" ? ["mov"] : [])];
    };
    const refused = media.find((m) => !names(m).some((n) => allowed.has(n)));
    if (!refused) return undefined;
    const kind = aKind(refused.$media as MediaKind);
    const word = refused.$media === "document" ? "pdf" : refused.$media;
    if (allow.length) return { rule: allow[0]!, message: `Agent "${agent.name}" was sent ${kind}, and its policy allows only ${[...allowed].join(", ")} (AllowMedia)` };
    return { rule: guard!, message: `Agent "${agent.name}" was sent ${kind}, which ${guard!.rule.name} can't read. Add AllowMedia(${word}) to one of its policies to send it anyway` };
  }

  /** Refuse a call whose images or documents the agent's policies don't allow. */
  checkMedia(agent: Agent, media: Array<{ $media: string; type: string }>, hooks: PolicyHooks): void {
    const refusal = this.mediaRefusal(agent, media);
    if (refusal) this.violate({ ...refusal.rule, rule: { ...refusal.rule.rule, name: "AllowMedia" } }, refusal.message, "input", hooks);
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
        const pattern = args[0] ?? "";
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
        const limit = Number(args[0]) + (hooks.added?.() ?? 0);
        if (hooks.spent() > limit) this.violate(b, `Budget exceeded: spent $${hooks.spent().toFixed(4)} of $${limit.toFixed(2)}`, "budget", hooks);
      }
    }
    return out;
  }

  /** `Validate("field", "<=", context.data.x.limit)`: compare a field of the (JSON) output with a context value or literal. */
  private validateField(b: BoundRule, out: unknown, hooks: PolicyHooks) {
    const [field = "", op = "", ref = ""] = b.rule.args;
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

  /** `text` with the agent's Redact rules applied and nothing blocked: for text the agent already wrote, sent back to it. */
  redactOnly(agent: Agent, text: string): string {
    let out = text;
    for (const b of this.rulesFor(agent)) if (b.rule.name === "Redact") out = redact(out, b.rule.args);
    return out;
  }

  /**
   * The arguments of a tool call an agent chose, as its policies let them out: a tool call is
   * part of the agent's answer, so Redact masks its arguments and Block refuses it. Without
   * this, a model talked into it could put what Block stops (`rm -rf`, an injection for the
   * next agent) or Redact hides into a tool call instead of its answer.
   */
  checkToolArgs(agent: Agent, target: string, args: unknown, hooks: PolicyHooks): unknown {
    const rules = this.rulesFor(agent);
    let out = args;
    for (const b of rules) if (b.rule.name === "Redact") out = mapStrings(out, (s) => redact(s, b.rule.args));
    for (const b of rules) {
      if (b.rule.name !== "Block") continue;
      const category = this.blocks(b, scanText(out));
      if (category) this.violate(b, `${target} was refused: its arguments were blocked (${DESCRIPTIONS[category] ?? category + " detected"})`, "tool", hooks);
    }
    return out;
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
    const limit = Math.min(...this.rulesFor(agent).filter((x) => x.rule.name === "MaxSpend").map((x) => Number(x.rule.args[0]))) + (hooks.added?.() ?? 0);
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
      const parts = b.rule.args;
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
      (b) => (b.rule.name === "ApproveTools" && b.rule.args.some((p) => toolMatches(p, target))) || (b.rule.name === "ApproveEffects" && b.rule.args.includes(effect)),
    );
    return approver ? { approve: approver.policy } : "allow";
  }

  private toolRefusal(rules: BoundRule[], target: string, effect: ToolEffectName): { rule: BoundRule; message: string } | undefined {
    for (const b of rules) {
      const args = b.rule.args;
      if (b.rule.name === "AllowTools" && !args.some((p) => toolMatches(p, target))) return { rule: b, message: `${target} is not in the tools policy "${b.policy}" allows` };
      if (b.rule.name === "DenyTools" && args.some((p) => toolMatches(p, target))) return { rule: b, message: `${target} is denied by policy "${b.policy}"` };
      if (b.rule.name === "AllowEffects" && !args.includes(effect)) return { rule: b, message: `${target} has effect "${effect}", which policy "${b.policy}" doesn't allow` };
    }
    return undefined;
  }

  private blocks(b: BoundRule, text: string): string | undefined {
    return b.rule.args.find((category) => DETECTORS[category] && detects(category, text));
  }

  private block(b: BoundRule, text: string, phase: Violation["phase"], hooks: PolicyHooks) {
    const category = this.blocks(b, text);
    if (category) this.violate(b, `Content blocked: ${DESCRIPTIONS[category] ?? category + " detected"}`, phase, hooks);
  }
}

/** `text` with every category a `Redact(...)` rule names masked, as an agent's prompt would be. */
export function redact(text: string, categories: string[]): string {
  // Redact between JSON escapes, so "\n123-45-6789" in a prompt is read as a new line, not "n123…".
  return text.split(JSON_ESCAPE).map((part, i) => (i % 2 ? part : redactText(part, categories))).join("");
}

function redactText(text: string, categories: string[]): string {
  const pass = (t: string) => categories.reduce((acc, c) => DETECTORS[c]?.redact?.(acc) ?? acc, t);
  let out = pass(text);
  // Something hidden with look-alike characters: redact the normalized text instead.
  const plain = normalizeForScan(out);
  if (categories.some((c) => DETECTORS[c]?.redact && DETECTORS[c]!.test(plain))) out = pass(plain);
  // Something hidden in base64 or hex: redact the whole run.
  for (const { run, decoded } of encodedRuns(out)) {
    const hit = categories.find((c) => DETECTORS[c]?.redact && [decoded, normalizeForScan(decoded)].some((t) => DETECTORS[c]!.test(t)));
    if (hit) out = out.split(run).join(`[REDACTED:${hit}]`);
  }
  return out;
}

/** Whether a category's detector finds something in any reading of the text. */
function detects(category: string, text: string, depth = 0): boolean {
  const detector = DETECTORS[category]!;
  const plain = unescapeJson(text);
  const views = [text, normalizeForScan(text), plain, normalizeForScan(plain)];
  if (WORD_CATEGORIES.has(category)) views.push(wordView(views[3]!));
  if (views.some((t) => detector.test(t))) return true;
  // Decoded base64 or hex is read the same way, one level deep (base64 inside base64 too).
  return depth < 2 && encodedRuns(views[3]!).some(({ decoded }) => detects(category, decoded, depth + 1));
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
