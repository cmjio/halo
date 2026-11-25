/**
 * `halo wallet`: put values into a wallet's source, see which are set, and read the audit log.
 *
 *   halo wallet add Card number      a hidden prompt; stored in the macOS Keychain
 *   halo wallet list                 every Vault in the project: fields set or missing, hints; never values
 *   halo wallet remove Card [field]
 *   halo wallet check [files]        the wallet's declarations, the program around it, and which fields are set
 *   halo wallet log [-n 50]          what was typed, refused or approved, and where (never values)
 *
 * A value is read at Halo's own hidden prompt (or from stdin with --stdin), checked (a card number's
 * Luhn digit, an expiry's shape), and handed to `security` on its standard input, so it never
 * appears on a command line or in the shell's history. The Keychain item trusts no app (-T ""), so
 * macOS asks before anything reads it, Halo included.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { parse } from "./parser/index.js";
import type { ToolDeclaration, Value } from "./parser/types.js";
import { validate } from "./parser/validate.js";
import {
  accountName,
  cardHint,
  envName,
  KEYCHAIN_SERVICE,
  luhn,
  parseExpiry,
  walletFieldInfo,
  walletItem,
  walletItemProblems,
  type WalletItem,
} from "./runtime/wallet.js";

export interface WalletFlags {
  positional: string[];
  bools: Set<string>;
  get(name: string): string | undefined;
}

interface Io {
  out(line: string): void;
  err(line: string): void;
}

export class WalletCliError extends Error {}

function fail(msg: string): never {
  throw new WalletCliError(msg);
}

/** Every .halo file under `dir`, outside dot-folders and node_modules. */
function haloFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.name.startsWith(".") || e.name === "node_modules") continue;
      const full = join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.isFile() && e.name.endsWith(".halo")) out.push(full);
    }
  };
  walk(dir);
  return out.sort();
}

function filesFrom(args: string[]): string[] {
  if (!args.length) return haloFiles(process.cwd());
  return args.flatMap((a) => {
    const p = resolve(a);
    if (!existsSync(p)) fail(`${a} doesn't exist`);
    return statSync(p).isDirectory() ? haloFiles(p) : [p];
  });
}

const literal = (v: Value | undefined): unknown =>
  v === undefined ? undefined : v.kind === "string" || v.kind === "number" || v.kind === "bool" ? v.value : v.kind === "list" ? v.items.map((i) => literal(i)) : v.kind === "null" ? null : undefined;

interface Found {
  item: WalletItem;
  file: string;
}

/** The Vaults declared in these files, read from the declarations as written. */
function vaults(files: string[]): { found: Found[]; problems: string[] } {
  const found: Found[] = [];
  const problems: string[] = [];
  for (const file of files) {
    const ast = parse(readFileSync(file, "utf8"));
    for (const t of ast.tools as ToolDeclaration[]) {
      if (t.provider !== "Vault") continue;
      const get = (k: string) => literal(t.argList.find((a) => a.name === k)?.value);
      const p = walletItemProblems(t.name, get);
      const where = relative(process.cwd(), file) || file;
      if (p.length) {
        problems.push(`${where}: ${t.name}: ${p[0]}`);
        continue;
      }
      found.push({ item: walletItem(t.name, (k) => get(String(k))), file: where });
    }
  }
  return { found, problems };
}

function findItem(name: string | undefined, files: string[]): Found {
  if (!name) fail("Name the wallet item, as declared: halo wallet add <Item> <field>");
  const { found, problems } = vaults(files);
  const matches = found.filter((f) => f.item.name === name);
  if (!matches.length) {
    const p = problems.find((x) => x.includes(`: ${name}: `));
    fail(p ?? `No Vault named ${name} in ${files.length === 1 ? files[0] : "this project"}${found.length ? ` (there is ${found.map((f) => f.item.name).join(", ")})` : ""}`);
  }
  const accounts = new Set(matches.map((m) => `${m.item.source}:${m.item.account}`));
  if (accounts.size > 1) fail(`${name} is declared in ${matches.map((m) => m.file).join(" and ")} with different sources or item: names; pass the file with --file`);
  return matches[0]!;
}

/** Read a line without echoing it. */
async function readHidden(prompt: string, io: Io): Promise<string> {
  const stdin = process.stdin;
  if (!stdin.isTTY) fail("There is no terminal to type the value into; pipe it in with --stdin instead");
  io.err(prompt);
  stdin.setRawMode(true);
  stdin.resume();
  let value = "";
  try {
    for await (const chunk of stdin) {
      for (const ch of String(chunk)) {
        if (ch === "\r" || ch === "\n") return value;
        if (ch === "\u0003") fail("Cancelled");
        if (ch === "\u007f" || ch === "\b") value = value.slice(0, -1);
        else if (ch >= " ") value += ch;
      }
    }
    return value;
  } finally {
    stdin.setRawMode(false);
    stdin.pause();
  }
}

async function readValue(flags: WalletFlags, label: string, io: Io): Promise<string> {
  if (flags.bools.has("stdin")) {
    const text = await new Response(Bun.stdin.stream()).text();
    return text.replace(/\r?\n$/, "");
  }
  const a = await readHidden(`${label} (not shown): `, io);
  const b = await readHidden(`Again, to check: `, io);
  if (a !== b) fail("The two entries differ; nothing was stored");
  return a;
}

/** Quote a word for `security -i`, which reads \" and \\ inside double quotes. */
const q = (s: string) => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

async function security(commands: string): Promise<{ code: number; err: string }> {
  // The commands, values included, go on security's standard input, never on its command line.
  const proc = Bun.spawn(["security", "-i"], { stdin: "pipe", stdout: "pipe", stderr: "pipe", env: { PATH: process.env.PATH ?? "/usr/bin:/bin", HOME: process.env.HOME ?? "" } });
  proc.stdin.write(commands);
  await proc.stdin.end();
  const [out, err, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
  // security -i keeps going after a failed command; its error text is the signal.
  const failed = /error|failed|could not/i.test(out + err);
  return { code: code || (failed ? 1 : 0), err: (err || out).trim() };
}

/**
 * The one line `security -i` is given to store a value. security reads its commands 4095 bytes at a
 * time, so a line any longer would run its tail as a command of its own: refused (exported for tests).
 */
export function keychainAddLine(account: string, value: string, hint?: string): string {
  const line = `add-generic-password -U -s ${q(KEYCHAIN_SERVICE)} -a ${q(account)} -l ${q(`Halo wallet: ${account}`)} -T "" ${hint ? `-j ${q(hint)} ` : ""}-w ${q(value)}\n`;
  if (Buffer.byteLength(line) >= 4000 || /[\u0000-\u0009\u000b-\u001f\u007f]/.test(line) || line.indexOf("\n") !== line.length - 1) fail("That value can't be stored safely (too long, or a control character); nothing was stored");
  return line;
}

/** Check a value before it's stored, and the hint to keep with it (exported for tests). */
export function checkValue(item: WalletItem, field: string, value: string, force: boolean): string | undefined {
  if (!value) fail("The value is empty; nothing was stored");
  // security -i reads its commands a line (and 4095 bytes) at a time: a long value could spill into a second command.
  if (value.length > 1024) fail("A wallet value is at most 1024 characters; nothing was stored");
  if (/[\u0000-\u001f\u007f]/.test(value)) fail("A wallet value is one line of text, with no control characters; nothing was stored");
  if (item.kind === "card" && field === "number") {
    if (!luhn(value) && !force) fail("That isn't a valid card number (its check digit is wrong); nothing was stored. --force stores it anyway");
    return cardHint(value);
  }
  if (field === "expiry" && !parseExpiry(value) && !force) fail("Store an expiry as MM/YY, MM/YYYY or YYYY-MM; nothing was stored. --force stores it anyway");
  if (item.kind === "card" && field === "cvc" && !/^\d{3,4}$/.test(value) && !force) fail("A CVC is 3 or 4 digits; nothing was stored. --force stores it anyway");
  return undefined;
}

async function add(flags: WalletFlags, io: Io): Promise<number> {
  const [, name, field] = flags.positional;
  const { item, file } = findItem(name, filesFrom(flags.get("file") ? [flags.get("file")!] : []));
  if (!field) fail(`Name the field: halo wallet add ${item.name} <${item.fields.map((f) => f.name).join("|")}>`);
  if (!item.fields.some((f) => f.name === field)) fail(`${item.name} (${file}) has no field "${field}"; it has ${item.fields.map((f) => f.name).join(", ")}`);
  switch (item.source) {
    case "mock":
      io.out(`${item.name} uses the mock source: its values are built-in test values, so there's nothing to store.`);
      return 0;
    case "env":
      io.out(`${item.name} reads ${envName(item.account, field)} from the environment Halo starts with. Set it there (not in a .env file, which Halo refuses for wallet values).`);
      return 0;
    case "1password":
      io.out(`${item.name} reads op://${item.vault}/${item.account}/${field}. Add the field in 1Password.`);
      return 0;
    case "keychain": {
      if (process.platform !== "darwin") fail(`The keychain source is the macOS Keychain; on this system use "1password" or "env"`);
      let value = await readValue(flags, `${item.name}.${field}`, io);
      const hint = checkValue(item, field, value, flags.bools.has("force"));
      const account = accountName(item, field);
      const r = await security(keychainAddLine(account, value, hint));
      const said = r.err.split(value).join("…");
      value = "";
      if (r.code !== 0) fail(`The Keychain didn't store it: ${said || `exit ${r.code}`}`);
      io.out(`Stored ${item.name}.${field} in the Keychain${hint ? ` (${hint})` : ""}. macOS will ask before anything reads it.`);
      return 0;
    }
  }
}

async function remove(flags: WalletFlags, io: Io): Promise<number> {
  const [, name, field] = flags.positional;
  const { item } = findItem(name, filesFrom(flags.get("file") ? [flags.get("file")!] : []));
  if (item.source !== "keychain") fail(`${item.name} uses the ${item.source} source; remove its values there`);
  const fields = field ? [field] : item.fields.map((f) => f.name);
  for (const f of fields) {
    const r = await security(`delete-generic-password -s ${q(KEYCHAIN_SERVICE)} -a ${q(accountName(item, f))}\n`);
    io.out(r.code === 0 ? `Removed ${item.name}.${f}` : `${item.name}.${f} wasn't in the Keychain`);
  }
  return 0;
}

async function list(flags: WalletFlags, io: Io): Promise<number> {
  const { found, problems } = vaults(filesFrom(flags.positional.slice(1)));
  const rows = await Promise.all(
    found.map(async ({ item, file }) => {
      const info = await Promise.all(item.fields.map((f) => walletFieldInfo(item, f.name).catch(() => ({}) as { set?: boolean; hint?: string })));
      const hint = item.hint ?? info[item.fields.findIndex((f) => f.name === "number")]?.hint;
      return { item: item.name, file, source: item.source, secret: item.secret, ...(hint ? { hint } : {}), hosts: item.hosts, ...(item.payVia.length ? { pay_via: item.payVia } : {}), fields: Object.fromEntries(item.fields.map((f, i) => [f.name, info[i]!.set === undefined ? "unknown" : info[i]!.set ? "set" : "missing"])) };
    }),
  );
  if (flags.bools.has("json")) {
    io.out(JSON.stringify({ items: rows, problems }, null, 2));
    return problems.length ? 1 : 0;
  }
  if (!rows.length && !problems.length) io.out("No Vault declarations here.");
  for (const r of rows) {
    io.out(`${r.item}  ${r.source}${r.secret ? ", secret" : ""}${r.hint ? `, ${r.hint}` : ""}  (${r.file})`);
    io.out(`  fields  ${Object.entries(r.fields).map(([f, s]) => `${f}${s === "set" ? "" : ` (${s})`}`).join(", ")}`);
    io.out(`  hosts   ${r.hosts.join(", ")}${r.pay_via ? `; payment frames ${r.pay_via.join(", ")}` : ""}`);
  }
  for (const p of problems) io.err(`! ${p}`);
  return problems.length ? 1 : 0;
}

async function check(flags: WalletFlags, io: Io): Promise<number> {
  const files = filesFrom(flags.positional.slice(1));
  let bad = 0;
  for (const file of files) {
    const ast = parse(readFileSync(file, "utf8"));
    if (!ast.tools.some((t) => t.provider === "Vault" || t.argList.some((a) => a.name === "wallet"))) continue;
    const where = relative(process.cwd(), file) || file;
    const diags = validate(ast).filter((d) => d.severity === "error");
    for (const d of diags) io.err(`${where}:${d.line ?? 0}: ${d.message}`);
    bad += diags.length;
    for (const { item } of vaults([file]).found) {
      for (const f of item.fields) {
        const info = await walletFieldInfo(item, f.name).catch(() => ({}) as { set?: boolean });
        if (info.set === false) {
          bad++;
          io.err(`${where}: ${item.name}.${f.name} is not set${item.source === "keychain" ? ` (halo wallet add ${item.name} ${f.name})` : item.source === "env" ? ` (${envName(item.account, f.name)})` : ""}`);
        }
      }
    }
    if (!diags.length) io.out(`${where}: the wallet's declarations are fine`);
  }
  return bad ? 1 : 0;
}

function log(flags: WalletFlags, io: Io): number {
  const path = flags.get("log") ?? join(flags.get("dir") ?? ".halo", "wallet.log");
  if (!existsSync(path)) {
    io.out(`No wallet log at ${path} yet.`);
    return 0;
  }
  const n = Number(flags.get("n") ?? 50);
  const lines = readFileSync(path, "utf8").split("\n").filter(Boolean).slice(-Math.max(1, n));
  if (flags.bools.has("json")) {
    io.out(`[${lines.join(",")}]`);
    return 0;
  }
  for (const line of lines) {
    try {
      const e = JSON.parse(line);
      const where = (e.chain ?? []).map((l: { host: string }) => l.host).join(" › ");
      io.out(`${e.at}  ${String(e.outcome).padEnd(15)} ${e.tool}.${e.method}  ${(e.refs ?? []).join(", ")}  ${where}${e.agent ? `  by ${e.agent}` : ""}${e.detail ? `  (${e.detail})` : ""}`);
    } catch {
      io.out(line);
    }
  }
  return 0;
}

export const WALLET_HELP = `halo wallet: values a browser agent can type but never read

  halo wallet add <Item> <field>     Store a value in the Keychain, typed at a hidden prompt
                                     (--stdin to pipe it in, --file <f.halo> to say which declaration,
                                     --force to skip the card checks)
  halo wallet list [files]           Each Vault: its source, which fields are set, its hint (--json)
  halo wallet remove <Item> [field]  Remove a value (or all of an item's) from the Keychain
  halo wallet check [files]          The wallet's declarations, the program around them, and missing fields
  halo wallet log [-n 50]            The audit log: what was typed, refused or approved, and where (--json)`;

export async function cmdWallet(flags: WalletFlags, io: Io = { out: (l) => console.log(l), err: (l) => console.error(l) }): Promise<number> {
  try {
    switch (flags.positional[0]) {
      case "add":
        return await add(flags, io);
      case "remove":
        return await remove(flags, io);
      case "list":
      case undefined:
        return await list(flags, io);
      case "check":
        return await check(flags, io);
      case "log":
        return log(flags, io);
      default:
        io.out(WALLET_HELP);
        return flags.positional[0] === "help" ? 0 : 1;
    }
  } catch (err) {
    if (err instanceof WalletCliError) {
      io.err(`Error: ${err.message}`);
      return 1;
    }
    throw err;
  }
}
