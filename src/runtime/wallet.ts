/**
 * The wallet: card and personal details a browser agent can type but never read.
 *
 *   tool Card : Vault(source: "keychain", kind: "card", fields: ["number", "expiry", "cvc", "name"],
 *                     hosts: ["www.britishairways.com"], pay_via: ["js.stripe.com"])
 *   tool Me   : Vault(source: "keychain", fields: ["full_name", "email", "phone"], hosts: ["www.britishairways.com"])
 *   tool Web  : Chrome(headless: false, allow: ["www.britishairways.com"], wallet: [Card, Me])
 *
 * Each Vault declaration is one item. Its values stay in the source (the macOS Keychain, 1Password,
 * the environment, or fixed test values) and are read only when Chrome types them into an element
 * that passed every check (see providers/chrome.ts). Nothing here returns a value to a caller other
 * than the browser: Vault's only method, `list`, describes the items.
 *
 * This module has no browser in it: the item model, refs ("Card.number", "Card.expiry:MM/YY"),
 * host rules, the sources, masking of typed values, and card hints.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { HaloError } from "./errors.js";
import { cardHint, walletItem, type WalletItem } from "./wallet-rules.js";
import type { ProviderInfo, ToolProvider } from "./tools.js";

export * from "./wallet-rules.js";

// ── Sources ──

/** Test values for source: "mock": a Stripe test card, and plain stand-ins. */
export const MOCK_VALUES: Record<string, string> = {
  number: "4242424242424242",
  expiry: "12/34",
  cvc: "123",
  name: "Test Cardholder",
  full_name: "Test Person",
  given_name: "Test",
  first_name: "Test",
  family_name: "Person",
  last_name: "Person",
  email: "test@example.com",
  phone: "+15555550100",
  tel: "+15555550100",
  address: "1 Test Street",
  address_line1: "1 Test Street",
  city: "Testville",
  postcode: "TE5 7ST",
  postal_code: "TE5 7ST",
  zip: "94016",
  country: "United Kingdom",
  passport_no: "X1234567T",
};

/** HALO_WALLET_<ITEM>_<FIELD>, for source: "env". */
export const envName = (account: string, field: string) => `HALO_WALLET_${account.replace(/[^A-Za-z0-9]/g, "_").toUpperCase()}_${field.toUpperCase()}`;

/**
 * Values for source: "env", taken out of the environment when a runtime starts (captureWalletEnv), so
 * nothing that reads the environment later (a shell, a package, Env.X) can see them.
 */
const captured = new Map<string, string>();

/**
 * Move every HALO_WALLET_* variable out of `env` into the wallet, and wipe it from the process's own
 * environment block too: deleting from process.env leaves the bytes the process started with, which
 * `ps eww` (and /proc/<pid>/environ on Linux) shows to any program running as the same user.
 * Safe to call more than once.
 */
export function captureWalletEnv(env: Record<string, string | undefined>): void {
  for (const name of Object.keys(env)) {
    if (!name.startsWith("HALO_WALLET_")) continue;
    const v = env[name];
    if (typeof v === "string") captured.set(name, v);
    if (env === process.env) wipeNative(name);
    delete env[name];
  }
  if (env === process.env) hideSecretsFromProc();
}

/** Variables that hold credentials: provider keys, tokens, passwords. */
export const SECRET_ENV = /(KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIALS?)$/i;
let procHidden = false;

/**
 * Linux keeps the environment a process started with in its own memory, and serves it to any program
 * running as the same user at /proc/<pid>/environ (which `ps eww` reads). Bun copies the environment at
 * startup, so wiping what getenv points to doesn't reach that block. Here the block is found from
 * /proc/self/stat (env_start, env_end) and every HALO_WALLET_ value and credential in it is zeroed in
 * place. Credentials Halo still needs (a provider's key) stay in process.env first: setting them again
 * stores a fresh copy outside the block. Best effort: on any failure the block is left as it was.
 */
function hideSecretsFromProc(): void {
  if (procHidden || process.platform !== "linux") return;
  procHidden = true;
  try {
    const { readFileSync } = require("node:fs") as typeof import("node:fs");
    const stat = readFileSync("/proc/self/stat", "utf8");
    const fields = stat.slice(stat.lastIndexOf(")") + 2).split(" "); // fields[0] is field 3 (state)
    const start = Number(fields[50 - 3]), end = Number(fields[51 - 3]);
    if (!(start > 0 && end > start && end - start < 1 << 20)) return;
    const keep: Record<string, string> = {};
    for (const [k, v] of Object.entries(process.env)) if (SECRET_ENV.test(k) && typeof v === "string") keep[k] = v;
    const ffi = require("bun:ffi") as typeof import("bun:ffi");
    const block = new Uint8Array(ffi.toArrayBuffer(start as never, 0, end - start));
    // The block is NUL-separated NAME=value strings.
    let i = 0;
    while (i < block.length) {
      let j = i;
      while (j < block.length && block[j] !== 0) j++;
      const eq = block.indexOf(61 /* = */, i);
      if (eq > i && eq < j) {
        const name = Buffer.from(block.subarray(i, eq)).toString("latin1");
        if (name.startsWith("HALO_WALLET_") || SECRET_ENV.test(name)) block.fill(0, eq + 1, j);
      }
      i = j + 1;
    }
    for (const [k, v] of Object.entries(keep)) process.env[k] = v;
  } catch {
    // leave it: the wallet's own values were already moved out of process.env
  }
}

let libc: { getenv(name: Buffer): number | null } | null | undefined;

/** Overwrite a variable's value in the process's native environment (getenv points into it) with zeros. */
function wipeNative(name: string): void {
  try {
    if (libc === undefined) {
      if (process.platform !== "darwin" && process.platform !== "linux") libc = null;
      else {
        const ffi = require("bun:ffi") as typeof import("bun:ffi");
        const lib = ffi.dlopen(process.platform === "darwin" ? "/usr/lib/libSystem.B.dylib" : "libc.so.6", { getenv: { args: [ffi.FFIType.cstring], returns: ffi.FFIType.ptr } });
        libc = { getenv: (n) => lib.symbols.getenv(n) as number | null };
        wipeWith = (p) => {
          const len = new ffi.CString(p as never).length;
          if (len > 0) new Uint8Array(ffi.toArrayBuffer(p as never, 0, len)).fill(0);
        };
      }
    }
    if (!libc) return;
    const p = libc.getenv(Buffer.from(`${name}\0`));
    if (p) wipeWith(p);
  } catch {
    libc = null;
  }
}
let wipeWith: (p: number) => void = () => {};

/** For tests: forget captured values. */
export function resetWalletEnv(): void {
  captured.clear();
}

/**
 * The .env file in `dir` that holds HALO_WALLET_ values, if any. Bun loads .env files into the
 * environment, and a file tool can read them, so wallet values don't belong there.
 */
export function dotenvWithWallet(dir: string): string | undefined {
  let names: string[];
  try {
    names = readdirSync(dir).filter((n) => /^\.env(\..+)?$/.test(n)).sort();
  } catch {
    return undefined;
  }
  for (const n of names) {
    try {
      if (/^\s*(export\s+)?HALO_WALLET_/m.test(readFileSync(join(dir, n), "utf8"))) return n;
    } catch {}
  }
  return undefined;
}

/** The Keychain service every wallet value is stored under. */
export const KEYCHAIN_SERVICE = "halo-wallet";

/** The Keychain account (or 1Password field path) for one field. */
export const accountName = (item: Pick<WalletItem, "account">, field: string) => `${item.account}.${field}`;

/** A clean environment for `security` and `op`: they get what they need to run, not Halo's keys. */
function toolEnv(environ: Record<string, string | undefined>, extra: (n: string) => boolean = () => false): Record<string, string> {
  const env: Record<string, string> = {};
  for (const n of ["PATH", "HOME", "USER", "LOGNAME", "TMPDIR", "LANG"]) if (process.env[n] !== undefined) env[n] = process.env[n]!;
  for (const [n, v] of Object.entries(environ)) if (v !== undefined && extra(n)) env[n] = v;
  return env;
}

async function runQuiet(argv: string[], env: Record<string, string>, signal?: AbortSignal): Promise<{ code: number; out: string; err: string }> {
  const proc = Bun.spawn(argv, { env, stdin: "ignore", stdout: "pipe", stderr: "pipe", ...(signal ? { signal } : {}) });
  const [out, err, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
  return { code, out, err };
}

/** Hooks for tests: replace how the Keychain and 1Password are reached. */
export interface WalletBackends {
  keychain?(account: string, opts: { reveal: boolean }): Promise<string | undefined>;
  onePassword?(path: string): Promise<string | undefined>;
}
let backends: WalletBackends = {};
export function setWalletBackends(b: WalletBackends): void {
  backends = b;
}

/**
 * Read one field's value from its source, for typing it right away. The caller must not keep it
 * beyond the browser session that types it, log it, or return it.
 */
export async function readWalletValue(item: WalletItem, field: string, opts: { environ?: Record<string, string | undefined>; signal?: AbortSignal } = {}): Promise<string> {
  if (!item.fields.some((f) => f.name === field)) throw new HaloError(`${item.name} has no field "${field}" (it has ${item.fields.map((f) => f.name).join(", ")})`, { code: "TOOL_ARGUMENT" });
  const missing = (where: string) => new HaloError(`${item.name}.${field} is not set ${where}`, { code: "WALLET_MISSING" });
  switch (item.source) {
    case "mock":
      return MOCK_VALUES[field] ?? `test-${field}`;
    case "env": {
      const name = envName(item.account, field);
      const v = captured.get(name);
      if (v === undefined || v === "") throw missing(`(set ${name} in Halo's environment before it starts)`);
      return v;
    }
    case "keychain": {
      const account = accountName(item, field);
      if (backends.keychain) {
        const v = await backends.keychain(account, { reveal: true });
        if (v === undefined) throw missing(`in the Keychain (run: halo wallet add ${item.name} ${field})`);
        return v;
      }
      if (process.platform !== "darwin") throw new HaloError(`${item.name}: source "keychain" is the macOS Keychain; on this system use "1password" or "env"`, { code: "TOOL_CONFIG" });
      // -w prints the value; with no trusted apps on the item, macOS asks the person first.
      const r = await runQuiet(["security", "find-generic-password", "-s", KEYCHAIN_SERVICE, "-a", account, "-w"], toolEnv({}), opts.signal);
      if (r.code === 44) throw missing(`in the Keychain (run: halo wallet add ${item.name} ${field})`);
      if (r.code !== 0) throw new HaloError(`${item.name}.${field}: the Keychain refused (${r.err.trim() || `exit ${r.code}`}); was the macOS prompt denied?`, { code: "WALLET_DENIED" });
      return r.out.replace(/\n$/, "");
    }
    case "1password": {
      const path = `op://${item.vault}/${item.account}/${field}`;
      if (backends.onePassword) {
        const v = await backends.onePassword(path);
        if (v === undefined) throw missing(`in 1Password (${path})`);
        return v;
      }
      if (!Bun.which("op")) throw new HaloError(`${item.name}: source "1password" needs the 1Password CLI (op) on PATH`, { code: "TOOL_CONFIG" });
      const r = await runQuiet(["op", "read", "--no-newline", path], toolEnv(opts.environ ?? process.env, (n) => n.startsWith("OP_")), opts.signal);
      if (r.code !== 0) {
        if (/isn't an item|could not find|not found/i.test(r.err)) throw missing(`in 1Password (${path})`);
        throw new HaloError(`${item.name}.${field}: 1Password refused (${r.err.trim().split("\n")[0] || `exit ${r.code}`})`, { code: "WALLET_DENIED" });
      }
      return r.out;
    }
  }
}

/** The comment `halo wallet add` stores with a Keychain item: its hint ("Visa ending 4242"), never the value. */
export function keychainComment(attributes: string): string | undefined {
  const m = attributes.match(/"icmt"<blob>="((?:[^"\\]|\\.)*)"/);
  return m ? m[1]!.replace(/\\(.)/g, "$1") : undefined;
}

/**
 * Whether a field is set, and its stored hint, without reading its value: the Keychain looks up the
 * item's attributes and never decrypts it (so macOS doesn't ask); 1Password can't tell without reading.
 */
export async function walletFieldInfo(item: WalletItem, field: string): Promise<{ set?: boolean; hint?: string }> {
  switch (item.source) {
    case "mock":
      return { set: true, ...(field === "number" && item.kind === "card" ? { hint: cardHint(MOCK_VALUES.number!) } : {}) };
    case "env": {
      const v = captured.get(envName(item.account, field));
      return { set: !!v, ...(v && field === "number" && item.kind === "card" ? { hint: cardHint(v) } : {}) };
    }
    case "keychain": {
      const account = accountName(item, field);
      if (backends.keychain) return { set: (await backends.keychain(account, { reveal: false })) !== undefined };
      if (process.platform !== "darwin") return {};
      const r = await runQuiet(["security", "find-generic-password", "-s", KEYCHAIN_SERVICE, "-a", account], toolEnv({}));
      if (r.code !== 0) return { set: false };
      const hint = keychainComment(r.out);
      return { set: true, ...(hint ? { hint } : {}) };
    }
    case "1password":
      return {};
  }
}

/** What Vault.list says about an item: names, hint and hosts, never a value. */
export async function describeItem(item: WalletItem): Promise<Record<string, unknown>> {
  const info = await Promise.all(item.fields.map((f) => walletFieldInfo(item, f.name).catch(() => ({}) as { set?: boolean; hint?: string })));
  const missing = item.fields.filter((_, i) => info[i]!.set === false).map((f) => f.name);
  const hint = item.hint ?? (item.kind === "card" ? info[item.fields.findIndex((f) => f.name === "number")]?.hint : undefined);
  return {
    item: item.name,
    secret: item.secret,
    fields: item.fields.map((f) => f.name),
    ...(hint ? { hint } : {}),
    hosts: item.hosts,
    ...(item.payVia.length ? { pay_via: item.payVia } : {}),
    asks: item.ask,
    ...(missing.length ? { missing } : {}),
    use: `Type a field with the browser's fill_secrets(fields: { "<css selector>": "${item.name}.${item.fields[0]?.name}" }). You never see the values.`,
  };
}

// ── Masking what comes back ──
//
// Masking is a best effort, and is the whole protection only for personal items: a secret item
// locks the browser once it's typed (see Chrome's fill_secrets), because a page can re-encode a
// value in more ways than any mask can follow.

/** Values shorter than this aren't masked as text (they would match everywhere). */
export const MASK_MIN = 6;
/** For a number this long or longer, any run of this many of its digits, in order, is masked too (a phone in national format). */
export const DIGIT_RUN = 8;

/**
 * The matcher's normalizer, as source, so Halo and Halo's isolated world in a page run the same code.
 * It returns the normalized string with, for each of its characters, where it came from in the
 * original: [norm, starts, ends]. Digits of every script become 0-9; compatibility forms (full-width,
 * mathematical) are folded (NFKC); zero-width, formatting and combining characters are dropped; every
 * kind of space becomes " ".
 */
export const NORMALIZE_SOURCE = `function (s) {
  const ZERO = [0x660, 0x6F0, 0x7C0, 0x966, 0x9E6, 0xA66, 0xAE6, 0xB66, 0xBE6, 0xC66, 0xCE6, 0xD66, 0xDE6, 0xE50, 0xED0, 0xF20, 0x1040, 0x1090, 0x17E0, 0x1810, 0x1946, 0x19D0, 0x1A80, 0x1A90, 0x1B50, 0x1BB0, 0x1C40, 0x1C50, 0xA620, 0xA8D0, 0xA900, 0xA9D0, 0xA9F0, 0xAA50, 0xABF0, 0x104A0, 0x11066];
  const drop = /^[\\u00AD\\u034F\\u061C\\u115F\\u1160\\u17B4\\u17B5\\u180B-\\u180F\\u200B-\\u200F\\u202A-\\u202E\\u2060-\\u206F\\u3164\\uFE00-\\uFE0F\\uFEFF\\uFFA0]$|^\\p{M}$/u;
  let norm = "";
  const starts = [], ends = [];
  let i = 0;
  for (const ch of s) {
    const at = i;
    i += ch.length;
    // Printable ASCII is itself: the fast path, so a large page normalizes quickly.
    const code = ch.charCodeAt(0);
    if (code >= 0x21 && code <= 0x7e) { norm += ch; starts.push(at); ends.push(i); continue; }
    if (code === 0x20 || code === 0x09 || code === 0x0a || code === 0x0d) { norm += " "; starts.push(at); ends.push(i); continue; }
    if (drop.test(ch)) continue;
    const cp = ch.codePointAt(0);
    let n = null;
    for (const z of ZERO) if (cp >= z && cp < z + 10) { n = String(cp - z); break; }
    if (n === null) n = ch.normalize("NFKC");
    if (/^\\s+$/u.test(n)) n = " ";
    for (const c of n) { if (drop.test(c)) continue; norm += c; starts.push(at); ends.push(i); }
  }
  return [norm, starts, ends];
}`;

/**
 * The digit matcher, as source (shared with the page, like NORMALIZE_SOURCE). In normalized text, it
 * finds runs of digits with at most 8 gap units between them (a gap unit is one other character, or
 * a whole <tag> when tags is true), and in each run every stretch of at least minRun digits (or the
 * whole value, for a shorter one) that appears, in order, in one of the typed numbers. One pass, no
 * regular expression, so a hostile page can't make it slow. Returns [start, end, number index].
 */
export const DIGITS_SOURCE = `function (norm, numbers, minRun, tags) {
  const out = [];
  let run = [];
  let gap = 0;
  const match = (pos) => {
    if (pos.length < 6) return;
    const s = pos.map((p) => norm[p]).join("");
    numbers.forEach((d, idx) => {
      if (d.length <= minRun) {
        for (let k = s.indexOf(d); k >= 0; k = s.indexOf(d, k + 1)) out.push([pos[k], pos[k + d.length - 1] + 1, idx]);
        return;
      }
      const grams = new Set();
      for (let a = 0; a + minRun <= d.length; a++) grams.add(d.slice(a, a + minRun));
      let k = 0;
      while (k + minRun <= s.length) {
        if (!grams.has(s.slice(k, k + minRun))) { k++; continue; }
        // The longest stretch starting here or a few digits on: a digit just before a number (a "2" in
        // "Paid 2", then the number) isn't taken as part of it when the number itself is longer.
        const reach = (from) => { if (!grams.has(s.slice(from, from + minRun))) return 0; let e = from + minRun; while (e < s.length && d.includes(s.slice(from, e + 1))) e++; return e - from; };
        let best = k, len = reach(k);
        for (let j = 1; j <= 4 && k + j + minRun <= s.length; j++) { const l = reach(k + j); if (l > len) { best = k + j; len = l; } }
        out.push([pos[best], pos[best + len - 1] + 1, idx]);
        k = best + len;
      }
    });
  };
  // Where the next ">" is, found once and moved forward (looking it up for every "<" would be quadratic).
  let gt = -2;
  for (let i = 0; i < norm.length; ) {
    const c = norm.charCodeAt(i);
    if (c >= 48 && c <= 57) { if (gap > 8) { match(run); run = []; } run.push(i); gap = 0; i++; continue; }
    // A tag with no digits in it is markup between digits (a <span> per group): one gap unit. A tag with digits is read as text.
    if (tags && c === 60 && gt !== -1) { if (gt < i) gt = norm.indexOf(">", i); const j = gt; if (j > i && j - i <= 1000 && !/[0-9]/.test(norm.slice(i, j))) { gap++; i = j + 1; if (gap > 8 && run.length) { match(run); run = []; } continue; } }
    gap++; i++;
    if (gap > 8 && run.length) { match(run); run = []; }
  }
  match(run);
  return out;
}`;

type Normalize = (s: string) => [string, number[], number[]];
type Digits = (norm: string, numbers: string[], minRun: number, tags: boolean) => Array<[number, number, number]>;
const findDigits = new Function(`return (${DIGITS_SOURCE})`)() as Digits;
const normalize = new Function(`return (${NORMALIZE_SOURCE})`)() as Normalize;

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** How a typed value is matched: by its digits (mostly a number), or as text; undefined when it's too short to mask. */
function valueMatcher(value: string): { digits: string } | { text: string } | undefined {
  const [v] = normalize(value.trim());
  if (v.length < MASK_MIN) return undefined;
  const digits = v.replace(/[^0-9]/g, "");
  // A value that is mostly digits (a card or passport number, a phone) is matched by its digits.
  if (digits.length >= MASK_MIN && digits.length >= v.replace(/\s/g, "").length * 0.6) return { digits };
  // Words match with any spacing between them, or none (a name split over two elements).
  return { text: v.split(/\s+/).filter(Boolean).map(escape).join("\\s*") };
}

/** The matchers for a set of values: what the page's redaction pass and Halo's mask both use. */
export interface Matchers {
  /** Typed numbers, with their refs. */
  numbers: Array<[string, string]>;
  /** Text values as regex sources over normalized text, longest first, with their refs. */
  texts: Array<[string, string]>;
  minRun: number;
}

/** Undo HTML entities and percent-encoding, keeping where each character came from: what a page's markup or a URL hides a value in. */
function decode(s: string): [string, number[], number[]] {
  let out = "";
  const starts: number[] = [];
  const ends: number[] = [];
  const named: Record<string, string> = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", shy: "­", zwsp: "​", zwnj: "‌", zwj: "‍", thinsp: " ", ensp: " ", emsp: " ", hyphen: "‐", dash: "‐", ndash: "–", mdash: "—" };
  const re = /&(#x[0-9a-f]+|#[0-9]+|[a-z]+);|(?:%[0-9a-f]{2})+/gi;
  let last = 0;
  const push = (text: string, a: number, b: number) => {
    for (const c of text) {
      out += c;
      starts.push(a);
      ends.push(b);
    }
  };
  for (let m = re.exec(s); m; m = re.exec(s)) {
    for (let j = last; j < m.index; j++) push(s[j]!, j, j + 1);
    let text: string | undefined;
    if (m[1] !== undefined) {
      const e = m[1].toLowerCase();
      const cp = e.startsWith("#x") ? parseInt(e.slice(2), 16) : e.startsWith("#") ? parseInt(e.slice(1), 10) : undefined;
      text = cp !== undefined ? (cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : undefined) : named[e];
    } else {
      try {
        text = decodeURIComponent(m[0]);
      } catch {
        text = undefined;
      }
    }
    if (text === undefined) push(m[0], m.index, m.index + m[0].length);
    else push(text, m.index, m.index + m[0].length);
    last = m.index + m[0].length;
  }
  for (let j = last; j < s.length; j++) push(s[j]!, j, j + 1);
  return [out, starts, ends];
}

/** Typed values a session holds, by ref name, compiled once. */
export class TypedValues {
  private byRef = new Map<string, string>();
  private compiled?: { matchers: Matchers; texts: Array<[string, RegExp]> };

  add(ref: string, value: string): void {
    this.byRef.set(ref, value);
    this.compiled = undefined;
  }

  get size(): number {
    return this.byRef.size;
  }

  refs(): string[] {
    return [...this.byRef.keys()];
  }

  clear(): void {
    this.byRef.clear();
    this.compiled = undefined;
  }

  private compile() {
    if (this.compiled) return this.compiled;
    const numbers: Array<[string, string]> = [];
    const texts: Array<[string, string, number]> = [];
    for (const [ref, value] of this.byRef) {
      const m = valueMatcher(value);
      if (!m) continue;
      if ("digits" in m) numbers.push([ref, m.digits]);
      else texts.push([ref, m.text, value.length]);
    }
    // Longest first, so a value that starts another can't leave its tail behind.
    numbers.sort((x, y) => y[1].length - x[1].length);
    texts.sort((x, y) => y[2] - x[2]);
    const matchers: Matchers = { numbers, texts: texts.map(([ref, src]) => [ref, src]), minRun: DIGIT_RUN };
    this.compiled = { matchers, texts: matchers.texts.map(([ref, src]) => [ref, new RegExp(src, "giu")]) };
    return this.compiled;
  }

  /** What the page's redaction pass needs (see Chrome's REDACT). Only ever sent to Halo's own isolated world. */
  matchers(): Matchers {
    return this.compile().matchers;
  }

  /** Where typed values are in `text`: [start, end, ref] in the original string, after decoding and normalizing. */
  private ranges(text: string): Array<[number, number, string]> {
    if (!text || !this.byRef.size) return [];
    const { matchers, texts } = this.compile();
    if (!matchers.numbers.length && !texts.length) return [];
    const [decoded, ds, de] = decode(text);
    const [norm, ns, ne] = normalize(decoded);
    const found: Array<[number, number, string]> = [];
    const orig = (a: number, b: number, ref: string) => found.push([ds[ns[a]!]!, de[ne[b - 1]! - 1]!, ref]);
    for (const [a, b, i] of findDigits(norm, matchers.numbers.map(([, d]) => d), matchers.minRun, true)) orig(a, b, matchers.numbers[i]![0]);
    for (const [ref, re] of texts) {
      re.lastIndex = 0;
      for (let m = re.exec(norm); m; m = re.exec(norm)) {
        if (!m[0].length) {
          re.lastIndex++;
          continue;
        }
        orig(m.index, m.index + m[0].length, ref);
      }
    }
    return found.sort((x, y) => x[0] - y[0] || y[1] - x[1]);
  }

  /** Replace every typed value in `text` with [wallet Item.field]. */
  mask(text: string): string {
    const ranges = this.ranges(text);
    if (!ranges.length) return text;
    let out = "";
    let at = 0;
    for (const [a, b, ref] of ranges) {
      if (b <= at) continue;
      out += text.slice(at, Math.max(a, at)) + (a >= at ? `[wallet ${ref}]` : "");
      at = b;
    }
    return out + text.slice(at);
  }

  /** The ref of a typed value found in `text`, if any. */
  found(text: string): string | undefined {
    return this.ranges(text)[0]?.[2];
  }

  /** Mask every string in a value (keys too). */
  maskDeep<T>(value: T): T {
    if (!this.byRef.size) return value;
    if (typeof value === "string") return this.mask(value) as T;
    if (Array.isArray(value)) return value.map((v) => this.maskDeep(v)) as T;
    if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [this.mask(k), this.maskDeep(v)])) as T;
    }
    return value;
  }
}

// ── The Vault tool ──

/** Vault's one method describes the item. Values are typed by Chrome(wallet: [...]), never returned. */
export const vaultProvider: ToolProvider = async (call) => {
  if (call.method !== "list") {
    throw new HaloError(
      `${call.tool.name} (Vault) has one method, list. Its values are never returned: a browser with wallet: [${call.tool.name}] types them with fill_secrets`,
      { code: "TOOL_METHOD" },
    );
  }
  return [await describeItem(walletItem(call.tool.name, call.config))];
};

export const VAULT_INFO: ProviderInfo = {
  description: "A wallet item (a card, or personal details). You never see its values: a browser declared with this wallet types them into a page with fill_secrets.",
  methods: [
    {
      name: "list",
      description: "Describe the item: its fields, a hint (like \"Visa ending 4242\"), where it may be typed, and which fields aren't set. Never returns a value.",
      params: { type: "object", properties: {} },
      effect: "read",
    },
  ],
};
