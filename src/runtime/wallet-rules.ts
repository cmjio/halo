/**
 * The wallet's rules, with no I/O in them: items, refs and formats, host rules, card hints, and
 * policy patterns. `halo validate` uses these too, and runs in the browser playground, so nothing
 * here may reach the file system, the environment, or a process. See wallet.ts for the rest.
 */

import { HaloError } from "./errors.js";
import type { ToolDeclaration } from "../parser/types.js";

// ── Items ──

export type WalletSource = "keychain" | "1password" | "env" | "mock";
export const WALLET_SOURCES: readonly WalletSource[] = ["keychain", "1password", "env", "mock"];

export interface WalletField {
  name: string;
  /** The `autocomplete` token an element for this field carries (cc-number, email…), when there is a standard one. */
  token?: string;
}

export interface WalletItem {
  /** The Vault declaration's name, which is how refs and policies name the item ("Card.number", AllowWallet("Card")). */
  name: string;
  /** The name the source stores it under (`item:`, default the declaration's name). */
  account: string;
  source: WalletSource;
  /** 1Password vault (`vault:`). */
  vault?: string;
  kind: "card" | "other";
  /** Card and identity numbers: every fill asks, exact hosts only, frames sealed whole. */
  secret: boolean;
  fields: WalletField[];
  /** Hosts of the top page (and of frames) the item may be typed on. */
  hosts: string[];
  /** Payment-frame hosts, which count only as frames inside a page on `hosts`. */
  payVia: string[];
  /** Whether filling a personal item asks first (always true for a secret item). */
  ask: boolean;
  hint?: string;
  /** May be used under `halo serve` / `halo mcp`. */
  serve: boolean;
}

/** Standard autocomplete tokens, by field name: for a card, and for anything else. */
export const CARD_TOKENS: Record<string, string> = { number: "cc-number", expiry: "cc-exp", cvc: "cc-csc", name: "cc-name" };
export const PERSONAL_TOKENS: Record<string, string> = {
  full_name: "name",
  name: "name",
  given_name: "given-name",
  first_name: "given-name",
  family_name: "family-name",
  last_name: "family-name",
  email: "email",
  phone: "tel",
  tel: "tel",
  address: "street-address",
  address_line1: "address-line1",
  address_line2: "address-line2",
  city: "address-level2",
  region: "address-level1",
  postcode: "postal-code",
  postal_code: "postal-code",
  zip: "postal-code",
  country: "country-name",
  organization: "organization",
  birthday: "bday",
};

/** Every token an element might carry that names a kind of detail (used to tell when an element is for something else). */
export const KNOWN_TOKENS = new Set([
  ...Object.values(CARD_TOKENS),
  ...Object.values(PERSONAL_TOKENS),
  "cc-given-name", "cc-family-name", "cc-exp-month", "cc-exp-year", "cc-type", "country", "username", "new-password",
  "current-password", "one-time-code", "url", "photo", "sex", "language", "bday-day", "bday-month", "bday-year",
  "tel-national", "tel-country-code", "address-line3", "honorific-prefix", "honorific-suffix", "additional-name", "nickname",
  "organization-title", "transaction-amount", "transaction-currency",
]);

/** Tokens that are the same detail in another shape (cc-exp vs cc-exp-month) count as agreeing. */
const TOKEN_FAMILIES: Record<string, string[]> = {
  "cc-exp": ["cc-exp", "cc-exp-month", "cc-exp-year"],
  "cc-name": ["cc-name", "cc-given-name", "cc-family-name", "name"],
  name: ["name", "cc-name", "given-name", "family-name"],
  tel: ["tel", "tel-national"],
  "street-address": ["street-address", "address-line1"],
  "country-name": ["country-name", "country"],
  bday: ["bday", "bday-day", "bday-month", "bday-year"],
};

/** Whether an element's autocomplete tokens agree with a field's own token. */
export function tokenAgrees(fieldToken: string | undefined, elementTokens: string[]): boolean {
  // Section and shipping/billing prefixes ("section-x billing cc-number") are context, not the detail.
  const named = elementTokens.map((t) => t.toLowerCase()).filter((t) => KNOWN_TOKENS.has(t));
  if (!named.length) return true; // no token, or only "on"/"off": nothing disagrees
  if (!fieldToken) return false; // the element is for a known detail, and this field isn't it
  const family = TOKEN_FAMILIES[fieldToken] ?? [fieldToken];
  return named.some((t) => family.includes(t));
}

// ── Hosts ──

/** A host pattern matches a host: exact, or `*.example.com` for its subdomains (not example.com itself), as Chrome(allow:) does. */
export function hostMatches(host: string, pattern: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  const p = pattern.toLowerCase();
  return p.startsWith("*.") ? h.endsWith(p.slice(1)) && h.length > p.length - 1 : h === p;
}

/** Whether two host patterns allow a host in common (so an item's hosts can't reach a user-content or payment host). */
export function hostCovers(a: string, b: string): boolean {
  const A = a.toLowerCase();
  const B = b.toLowerCase();
  const wa = A.startsWith("*.");
  const wb = B.startsWith("*.");
  if (!wa && !wb) return A === B;
  if (!wa) return hostMatches(A, B);
  if (!wb) return hostMatches(B, A);
  const [s, t] = [A.slice(2), B.slice(2)];
  return s === t || s.endsWith(`.${t}`) || t.endsWith(`.${s}`);
}

/**
 * Hosts where anyone can publish a page: an attacker's page there could embed a real payment frame
 * tied to the attacker's account. An item's hosts: can't name or cover one.
 */
export const USER_CONTENT_HOSTS = [
  "sites.google.com", "docs.google.com", "drive.google.com", "script.google.com", "forms.gle", "forms.office.com",
  "*.github.io", "gist.github.com", "raw.githubusercontent.com", "*.githubusercontent.com", "*.gitlab.io", "*.bitbucket.io",
  "*.pages.dev", "*.workers.dev", "*.r2.dev", "*.vercel.app", "*.netlify.app", "*.web.app", "*.firebaseapp.com",
  "*.herokuapp.com", "*.glitch.me", "*.repl.co", "*.replit.app", "*.replit.dev", "*.onrender.com", "*.fly.dev",
  "*.azurewebsites.net", "*.azurestaticapps.net", "*.cloudfront.net", "*.amazonaws.com", "*.appspot.com",
  "*.ngrok.io", "*.ngrok-free.app", "*.ngrok.app", "*.trycloudflare.com", "*.loca.lt", "*.surge.sh",
  "*.myshopify.com", "*.wixsite.com", "*.squarespace.com", "*.square.site", "*.webflow.io", "*.weebly.com",
  "*.wordpress.com", "*.blogspot.com", "*.tumblr.com", "*.notion.site", "*.carrd.co", "*.framer.website",
  "*.framer.app", "*.typeform.com", "*.jotform.com", "*.substack.com", "*.medium.com", "*.gumroad.com",
  "codepen.io", "cdpn.io", "jsfiddle.net", "*.csb.app", "*.stackblitz.io", "*.webcontainer.io",
] as const;

/** Payment-frame hosts: they serve every merchant's card frames, so they go in pay_via:, never in hosts:. */
export const PAYMENT_HOSTS = [
  "js.stripe.com", "checkout.stripe.com", "m.stripe.network", "*.stripe.network", "*.adyen.com", "*.adyenpayments.com",
  "*.braintreegateway.com", "*.braintree-api.com", "*.checkout.com", "*.squareup.com", "*.squarecdn.com",
  "*.paypal.com", "*.paypalobjects.com", "*.klarna.com", "*.klarnaservices.com", "*.worldpay.com", "*.authorize.net",
  "*.recurly.com", "*.chargebee.com", "*.paddle.com", "*.mollie.com", "*.razorpay.com", "*.gocardless.com",
] as const;

/** A host name or `*.` pattern: letters, digits and hyphens, at least one dot. */
const HOST_NAME = /^(\*\.)?([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]([a-z0-9-]*[a-z0-9])?$/i;

/** This machine: localhost, its subdomains, and 127.x.x.x. Allowed in hosts: for testing against a local server, and the only hosts that may use plain http. */
export const isLoopback = (host: string) => /^(localhost|([a-z0-9-]+\.)+localhost|127(\.\d{1,3}){3}|\[?::1\]?)$/i.test(host);

/** Two-label public suffixes, for showing a host's registrable domain (www.britishairways.co.uk → britishairways.co.uk). */
const TWO_LABEL_SUFFIXES = new Set([
  "co.uk", "org.uk", "ac.uk", "gov.uk", "me.uk", "ltd.uk", "plc.uk", "com.au", "net.au", "org.au", "co.nz", "org.nz",
  "co.jp", "ne.jp", "or.jp", "com.br", "com.mx", "com.ar", "co.in", "co.za", "com.sg", "com.hk", "com.tr", "co.kr",
  "com.cn", "com.tw", "co.il", "com.my", "co.id", "com.ph", "com.vn", "com.sa", "com.eg", "com.ng", "co.ke",
]);

/** A host's registrable domain, best effort: the last two labels, or three under a known two-label suffix. */
export function registrableDomain(host: string): string {
  const labels = host.toLowerCase().replace(/\.$/, "").split(".");
  if (labels.length <= 2 || /^\d+$/.test(labels.at(-1)!)) return labels.join(".");
  const two = labels.slice(-2).join(".");
  return TWO_LABEL_SUFFIXES.has(two) ? labels.slice(-3).join(".") : two;
}

// ── Reading a declaration ──

type Config = (name: string | number) => unknown;

const FIELD = /^[a-z][a-z0-9_]*$/;
const TOKEN = /^[a-z][a-z0-9-]*$/;

function strings(v: unknown, what: string, tool: string): string[] {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v) || v.some((x) => typeof x !== "string")) throw new HaloError(`Tool "${tool}": ${what} is a list of strings`, { code: "TOOL_CONFIG" });
  return (v as string[]).map((x) => x.trim()).filter(Boolean);
}

/** Problems with a Vault declaration's settings, as messages (shared by the runtime and `halo validate`). */
export function walletItemProblems(name: string, get: (key: string) => unknown): string[] {
  const out: string[] = [];
  const source = get("source");
  if (source === undefined) out.push(`source: is required ("keychain", "1password", "env" or "mock")`);
  else if (typeof source !== "string" || !WALLET_SOURCES.includes(source as WalletSource)) out.push(`source: is "keychain", "1password", "env" or "mock", not ${JSON.stringify(source)}`);
  if (source === "1password" && typeof get("vault") !== "string") out.push(`source: "1password" needs vault:, the 1Password vault the item is in`);
  const kind = get("kind");
  if (kind !== undefined && kind !== "card" && kind !== "other") out.push(`kind: is "card" or "other"`);
  const fieldsRaw = get("fields");
  if (!Array.isArray(fieldsRaw) || !fieldsRaw.length) out.push(`fields: lists the item's fields, e.g. fields: ["number", "expiry", "cvc", "name"]`);
  else {
    const seen = new Set<string>();
    for (const f of fieldsRaw) {
      if (typeof f !== "string") {
        out.push(`fields: lists names in quotes`);
        continue;
      }
      const [field, token, extra] = f.split(":");
      if (extra !== undefined || !FIELD.test(field ?? "")) out.push(`fields: "${f}" should be a lowercase name, optionally with its autocomplete token, like "number" or "passport_no:off"`);
      else if (token !== undefined && !TOKEN.test(token)) out.push(`fields: "${f}": "${token}" is not an autocomplete token`);
      else if (seen.has(field!)) out.push(`fields: "${field}" is listed twice`);
      seen.add(field!);
    }
  }
  const secret = kind === "card" ? get("secret") !== false : get("secret") === true;
  if (kind === "card" && get("secret") === false) out.push(`a card is always secret; remove secret: false`);
  const hosts = get("hosts");
  const hostList = Array.isArray(hosts) ? hosts.filter((h): h is string => typeof h === "string").map((h) => h.toLowerCase()) : [];
  if (!Array.isArray(hosts) || !hostList.length) out.push(`hosts: is required: the sites the item may be typed on, e.g. hosts: ["www.example.com"]`);
  const payVia = get("pay_via");
  const payList = Array.isArray(payVia) ? payVia.filter((h): h is string => typeof h === "string").map((h) => h.toLowerCase()) : [];
  if (payVia !== undefined && !Array.isArray(payVia)) out.push(`pay_via: is a list of payment-frame hosts, e.g. pay_via: ["js.stripe.com"]`);
  for (const [setting, list] of [["hosts", hostList], ["pay_via", payList]] as const) {
    for (const h of list) {
      if (!HOST_NAME.test(h) && !isLoopback(h)) {
        out.push(`${setting}: "${h}" is not a host name like "www.example.com"${setting === "hosts" ? "" : ' or "*.adyen.com"'}`);
        continue;
      }
      if (secret && h.startsWith("*.")) out.push(`${setting}: "${h}": a secret item takes exact hosts, not *. patterns (name each host it may be typed on)`);
      const ugc = USER_CONTENT_HOSTS.find((u) => hostCovers(h, u));
      if (ugc) out.push(`${setting}: "${h}" ${h === ugc ? "is" : `covers ${ugc}, which is`} a host where anyone can publish a page, so a page there could collect the item`);
      if (setting === "hosts") {
        const pay = PAYMENT_HOSTS.find((p) => hostCovers(h, p) || hostCovers(p, h));
        if (pay) out.push(`hosts: "${h}" is a payment provider's host; it serves every merchant's frames, so put it in pay_via: (it then counts only inside a page on hosts:)`);
      }
    }
  }
  if (payList.length && !secret) out.push(`pay_via: is for secret items (cards and identity numbers)`);
  if (secret && get("ask") === false) out.push(`ask: false isn't allowed on a secret item: typing it always asks`);
  for (const key of ["ask", "secret", "serve"]) {
    const v = get(key);
    if (v !== undefined && typeof v !== "boolean") out.push(`${key}: is true or false`);
  }
  const item = get("item");
  if (item !== undefined && (typeof item !== "string" || !/^[A-Za-z0-9_.-]+$/.test(item))) out.push(`item: is the name the source stores it under, letters, digits, ".", "_" and "-"`);
  const hint = get("hint");
  if (hint !== undefined && typeof hint !== "string") out.push(`hint: is a string`);
  return out;
}

/** The item a Vault declaration describes (its config already resolved), or a TOOL_CONFIG error. */
export function walletItem(name: string, config: Config): WalletItem {
  const get = (k: string) => config(k);
  const problems = walletItemProblems(name, get);
  if (problems.length) throw new HaloError(`Tool "${name}" (Vault): ${problems[0]}${problems.length > 1 ? ` (and ${problems.length - 1} more; run halo validate)` : ""}`, { code: "TOOL_CONFIG" });
  const kind = get("kind") === "card" ? "card" : "other";
  const secret = kind === "card" || get("secret") === true;
  const defaults = kind === "card" ? CARD_TOKENS : PERSONAL_TOKENS;
  const fields = strings(get("fields"), "fields:", name).map((f): WalletField => {
    const [field, token] = f.split(":") as [string, string | undefined];
    const t = token === undefined ? defaults[field] : token === "off" ? undefined : token;
    return { name: field, ...(t ? { token: t } : {}) };
  });
  return {
    name,
    account: typeof get("item") === "string" ? (get("item") as string) : name,
    source: get("source") as WalletSource,
    ...(typeof get("vault") === "string" ? { vault: get("vault") as string } : {}),
    kind,
    secret,
    fields,
    hosts: strings(get("hosts"), "hosts:", name).map((h) => h.toLowerCase()),
    payVia: strings(get("pay_via"), "pay_via:", name).map((h) => h.toLowerCase()),
    ask: secret || get("ask") !== false,
    ...(typeof get("hint") === "string" ? { hint: get("hint") as string } : {}),
    serve: get("serve") === true,
  };
}

// ── Refs ──

export interface WalletRef {
  item: string;
  field: string;
  /** "MM/YY", "MM", "YYYY"… for expiry; "1-4" for part of a number. */
  format?: string;
  /** The ref as written. */
  raw: string;
}

export const EXPIRY_FORMATS = ["MM/YY", "MM/YYYY", "MM-YY", "MMYY", "MM", "M", "YY", "YYYY"] as const;

/** Parse "Card.number", "Card.expiry:MM/YY", "Card.number:5-8". */
export function parseRef(raw: unknown): WalletRef {
  if (typeof raw !== "string") throw new HaloError(`A wallet ref is a string like "Card.number"`, { code: "TOOL_ARGUMENT" });
  const m = raw.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\.([a-z][a-z0-9_]*)(?::(.+))?$/);
  if (!m) throw new HaloError(`"${raw}" is not a wallet ref; write the item and field, like "Card.number" (or "Card.expiry:MM/YY")`, { code: "TOOL_ARGUMENT" });
  return { item: m[1]!, field: m[2]!, ...(m[3] !== undefined ? { format: m[3] } : {}), raw: raw.trim() };
}

/** "Card.number" without any format: what masks, logs and approvals name. */
export const refName = (r: { item: string; field: string }) => `${r.item}.${r.field}`;

/** Check a ref's format against its field; the format error, if any. */
export function formatProblem(ref: WalletRef): string | undefined {
  if (ref.format === undefined) return undefined;
  if (ref.field === "expiry" || ref.field.endsWith("_expiry") || ref.field.startsWith("expiry")) {
    return (EXPIRY_FORMATS as readonly string[]).includes(ref.format) ? undefined : `"${ref.raw}": an expiry format is one of ${EXPIRY_FORMATS.join(", ")}`;
  }
  const part = ref.format.match(/^(\d+)-(\d+)$/);
  if (!part) return `"${ref.raw}": ${ref.field} takes a part of its digits, like ":1-4"`;
  const [a, b] = [Number(part[1]), Number(part[2])];
  return a >= 1 && b >= a ? undefined : `"${ref.raw}": a part counts digits from 1, like ":1-4" or ":5-8"`;
}

/** Apply a ref's format to a value (never logged; the caller types the result). */
export function formatValue(ref: WalletRef, value: string): string {
  if (ref.format === undefined) return value;
  const part = ref.format.match(/^(\d+)-(\d+)$/);
  if (part) {
    const digits = value.replace(/\D/g, "");
    const [a, b] = [Number(part[1]), Number(part[2])];
    if (b > digits.length) throw new HaloError(`${refName(ref)} has ${digits.length} digits, so ":${ref.format}" is out of range`, { code: "TOOL_ARGUMENT" });
    return digits.slice(a - 1, b);
  }
  const exp = parseExpiry(value);
  if (!exp) throw new HaloError(`${refName(ref)} isn't stored as an expiry date (MM/YY, MM/YYYY or YYYY-MM), so it can't be formatted as ${ref.format}`, { code: "TOOL_ARGUMENT" });
  const mm = String(exp.month).padStart(2, "0");
  const yyyy = String(exp.year);
  const yy = yyyy.slice(-2);
  switch (ref.format) {
    case "MM/YY": return `${mm}/${yy}`;
    case "MM/YYYY": return `${mm}/${yyyy}`;
    case "MM-YY": return `${mm}-${yy}`;
    case "MMYY": return `${mm}${yy}`;
    case "MM": return mm;
    case "M": return String(exp.month);
    case "YY": return yy;
    case "YYYY": return yyyy;
  }
  throw new HaloError(`"${ref.raw}": unknown expiry format`, { code: "TOOL_ARGUMENT" });
}

/** Parse an expiry stored as MM/YY, MM/YYYY, MM-YY, MMYY or YYYY-MM. */
export function parseExpiry(value: string): { month: number; year: number } | undefined {
  const v = value.trim();
  let m = v.match(/^(\d{1,2})\s*[/-]\s*(\d{2}|\d{4})$/);
  let month: number;
  let year: number;
  if (m) [month, year] = [Number(m[1]), Number(m[2])];
  else if ((m = v.match(/^(\d{4})-(\d{1,2})$/))) [year, month] = [Number(m[1]), Number(m[2])];
  else if ((m = v.match(/^(\d{2})(\d{2})$/))) [month, year] = [Number(m[1]), Number(m[2])];
  else return undefined;
  if (year < 100) year += 2000;
  return month >= 1 && month <= 12 ? { month, year } : undefined;
}

// ── Card hints ──

const BRANDS: Array<[string, RegExp]> = [
  ["American Express", /^3[47]/],
  ["Visa", /^4/],
  ["Mastercard", /^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/],
  ["Discover", /^(6011|65|64[4-9])/],
  ["Diners Club", /^3(0[0-5]|[689])/],
  ["JCB", /^35(2[89]|[3-8])/],
  ["UnionPay", /^62/],
  ["Maestro", /^(5018|5020|5038|6304|6759|676[1-3])/],
];

/** "Visa ending 4242", from a card number. */
export function cardHint(number: string): string {
  const digits = number.replace(/\D/g, "");
  const brand = BRANDS.find(([, re]) => re.test(digits))?.[0] ?? "Card";
  return `${brand} ending ${digits.slice(-4)}`;
}

/** Luhn check, so a mistyped stored number is caught before a checkout rejects it. */
export function luhn(number: string): boolean {
  const d = number.replace(/\D/g, "");
  if (d.length < 12 || d.length > 19) return false;
  let sum = 0;
  for (let i = 0; i < d.length; i++) {
    let n = Number(d[d.length - 1 - i]);
    if (i % 2) n = n * 2 > 9 ? n * 2 - 9 : n * 2;
    sum += n;
  }
  return sum % 10 === 0;
}

// ── Policies ──

/** Whether an AllowWallet / ApproveWallet pattern ("Card", "Card.number", "Card.*", "*") covers a ref. */
export function walletPatternMatches(pattern: string, ref: { item: string; field: string }): boolean {
  if (pattern === "*") return true;
  const [item, field] = pattern.split(".");
  if (item !== ref.item) return false;
  return field === undefined || field === "*" || field === ref.field;
}

export const WALLET_PATTERN = /^(\*|[A-Za-z_][A-Za-z0-9_]*(\.(\*|[a-z][a-z0-9_]*))?)$/;

/** What an agent's policies let it do with the wallet; undefined when a pipeline (not an agent) makes the call. */
export interface WalletLimits {
  /** Each AllowWallet rule's patterns. An agent with none may use no ref; with several, each must allow it. */
  allow: string[][];
  /** ApproveWallet patterns: ask for these even where the item says ask: false. */
  approve: string[];
  /** The policy that asked for approval of the call itself (ApproveTools / ApproveEffects), folded into the wallet's own approval. */
  policyApproval?: string;
  /** The agent making the call. */
  agent?: string;
}

/** Whether a declaration is a Vault. */
export const isVault = (t: Pick<ToolDeclaration, "provider">) => t.provider === "Vault";


// ── A program with a wallet ──

type ToolDecl = Pick<ToolDeclaration, "name" | "provider" | "argList">;

const argOf = (t: ToolDecl, name: string | number) =>
  typeof name === "number" ? t.argList.filter((a) => !a.name)[name]?.value : t.argList.find((a) => a.name === name)?.value;
const literal = (v: ReturnType<typeof argOf>): unknown => (v?.kind === "string" || v?.kind === "bool" || v?.kind === "number" ? v.value : undefined);

/** The Vault names a Chrome declaration's `wallet:` lists (refs or strings), or undefined when it has none. */
export function walletNames(t: ToolDecl): string[] | undefined {
  if (t.provider !== "Chrome") return undefined;
  const v = argOf(t, "wallet");
  if (!v) return undefined;
  const items = v.kind === "list" ? v.items : [v];
  return items.map((i) => (i.kind === "ref" ? i.path.join(".") : i.kind === "string" ? i.value : "?"));
}

/**
 * Why a tool can't be in a program with a wallet: it runs commands or code as you (so it could read
 * the Keychain, 1Password or the environment directly), or reads or writes files the wallet relies
 * on. Undefined when it can be.
 */
export function walletUnsafeTool(t: ToolDecl): string | undefined {
  // A folder setting must be written out, and inside the project; anything else (Env.X, ../, /, ~) can't be checked here.
  const outside = (v: ReturnType<typeof argOf>): boolean => {
    if (v === undefined) return false;
    if (v.kind !== "string") return true;
    const p = v.value;
    return /^([\\/~]|[a-zA-Z]:)/.test(p) || p.split(/[\\/]/).includes("..");
  };
  switch (t.provider) {
    case "Bash":
      return "runs shell commands as you";
    case "Code":
      return "runs code as you";
    case "Git":
      return "runs git, which runs the repository's hooks and configured commands as you";
    case "Remote": {
      const spec = String(literal(argOf(t, 0)) ?? "").trim().toLowerCase();
      if (!["docker", "e2b", "daytona", "auto"].includes(spec)) return "runs commands on a machine over SSH";
      for (const k of ["from", "root"]) if (outside(argOf(t, k))) return `copies files from outside the project (${k}:)`;
      return undefined;
    }
    case "Workspace": {
      if (literal(argOf(t, "write")) !== undefined && literal(argOf(t, "write")) !== false) return "can change files (write:)";
      if (outside(argOf(t, 0)) || outside(argOf(t, "root"))) return "reads files outside the project";
      return undefined;
    }
    case "MCP": {
      // Remote only when the address is written out as an http(s) URL; an unset or null url: falls back to a local command.
      const url = argOf(t, "url");
      const first = argOf(t, 0);
      const isUrl = (v: ReturnType<typeof argOf>) => v?.kind === "string" && /^https?:\/\//i.test(v.value.trim());
      if (isUrl(url) || (url === undefined && isUrl(first))) return undefined;
      if (literal(argOf(t, "wallet_safe")) === true) return undefined;
      return "starts a local MCP server, which could be steered into running commands (if it can't, declare it with wallet_safe: true)";
    }
    default:
      return undefined;
  }
}

/** The first reason a program's tools can't hold a wallet, or undefined. */
export function walletProgramProblem(tools: Iterable<ToolDecl>): string | undefined {
  const all = [...tools];
  const browser = all.find((t) => walletNames(t));
  if (!browser) return undefined;
  for (const t of all) {
    const why = walletUnsafeTool(t);
    if (why) return `Tool "${t.name}" ${why}, so it can't be in the same program as a wallet (${browser.name} has wallet:). Put the work that needs it in a separate .halo file`;
  }
  return undefined;
}

type PolicyLike = { rules: Array<{ name: string; args: string[] }> };

/**
 * What an agent's policies let it do with a wallet. Every AllowWallet rule must allow a ref (several
 * policies narrow, as AllowSecrets does); ApproveWallet rules add up.
 */
export function walletLimits(requires: string[] | undefined, policies: Map<string, PolicyLike> | undefined): { allow: string[][]; approve: string[] } {
  const allow: string[][] = [];
  const approve: string[] = [];
  for (const name of requires ?? []) {
    for (const rule of policies?.get(name)?.rules ?? []) {
      if (rule.name === "AllowWallet") allow.push(rule.args);
      if (rule.name === "ApproveWallet") approve.push(...rule.args);
    }
  }
  return { allow, approve };
}

/** Whether limits allow a ref: an agent needs an AllowWallet rule, and every one must cover it. */
export function walletAllows(limits: Pick<WalletLimits, "allow">, ref: { item: string; field: string }): boolean {
  return limits.allow.length > 0 && limits.allow.every((rule) => rule.some((p) => walletPatternMatches(p, ref)));
}
