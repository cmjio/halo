/**
 * `halo auth`: connect a tool to an account, once, for every run in this project.
 *
 *   halo auth login  <Connection> [--device] [--no-browser] [file.halo]
 *   halo auth logout <Connection> [--no-revoke] [file.halo]
 *   halo auth list   [file.halo]
 *   halo auth status [<Connection>] [file.halo]
 *
 * A connection is an `OAuth(...)` declaration (or a package tool whose manifest says "type":
 * "oauth"). Its tokens are kept outside the project (see runtime/oauth-store.ts), for the project in
 * the current folder: run halo auth from where you run halo run.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { parse } from "./parser/index.js";
import type { ParseResult, ToolDeclaration } from "./parser/types.js";
import { authName, authorizationRequest, checkRedirect, connectionFrom as connectionFromSettings, defaultBroker, literalSetting, pollDevice, startDevice, type OAuthConnection, type TokenBroker } from "./runtime/oauth.js";
import { hasBrowser, openBrowser, startLoopback } from "./runtime/oauth-login.js";
import type { TokenInfo } from "./runtime/oauth-store.js";
import type { ProviderInfo } from "./runtime/tools.js";
import { authState, type AuthStatus, type PlanAuth } from "./plan.js";

export interface AuthFlags {
  positional: string[];
  bools: Set<string>;
  get(name: string): string | undefined;
}

export interface AuthIo {
  out(line: string): void;
  err(line: string): void;
}

/** What `halo auth` works with; tests replace the parts that reach out. */
export interface AuthDeps {
  broker?: TokenBroker;
  env?: Record<string, string | undefined>;
  /** The project tokens are kept for (default: the current folder). */
  project?: string;
  /** Installed packages' providers, for package tools that are their own connection. */
  providerInfo?: (provider: string) => ProviderInfo | undefined;
  /** Open the browser (default: the system's opener). */
  open?: (url: string) => Promise<boolean>;
  /** Whether there is a browser to open (default: guessed from the environment). */
  browser?: boolean;
  /** How long to wait for the person (default 5 minutes). */
  timeoutMs?: number;
  /** Device flow polling's wait (tests make it instant). */
  sleep?: (ms: number) => Promise<void>;
}

export class AuthCliError extends Error {}

const fail = (msg: string): never => {
  throw new AuthCliError(msg);
};

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

const isPath = (a: string) => a.endsWith(".halo") || a.includes("/") || (existsSync(a) && statSync(a).isDirectory());

function filesFrom(args: string[], root: string): string[] {
  if (!args.length) return haloFiles(root);
  return args.flatMap((a) => {
    const p = resolve(a);
    if (!existsSync(p)) fail(`${a} doesn't exist`);
    return statSync(p).isDirectory() ? haloFiles(p) : [p];
  });
}

/** A connection declared in a program, and the tools that act through it. */
export interface Declared {
  name: string;
  file?: string;
  conn?: OAuthConnection;
  /** Why it can't be built (a missing Env value, an unknown provider). */
  problem?: string;
  tools: string[];
}

/** The OAuth connections a program declares, built from the settings as written (Env read now). */
export function connectionsOf(ast: Pick<ParseResult, "tools">, opts: { env?: Record<string, string | undefined>; project: string; providerInfo?: (provider: string) => ProviderInfo | undefined; file?: string }): Declared[] {
  const env = opts.env ?? process.env;
  const out = new Map<string, Declared>();
  const tools = ast.tools as ToolDeclaration[];
  const build = (name: string, make: () => OAuthConnection): Declared => {
    try {
      return { name, ...(opts.file ? { file: opts.file } : {}), conn: make(), tools: [] };
    } catch (e) {
      return { name, ...(opts.file ? { file: opts.file } : {}), problem: e instanceof Error ? e.message : String(e), tools: [] };
    }
  };
  for (const t of tools) {
    if (t.provider === "OAuth") {
      out.set(t.name, build(t.name, () => connectionFromDecl(t, env, opts.project)));
      continue;
    }
    const info = opts.providerInfo?.(t.provider);
    if (info?.oauth && authName(t) === undefined) out.set(t.name, { ...build(t.name, () => info.oauth!(t.name, literalSetting(t, env), env, opts.project)), tools: [t.name] });
  }
  for (const t of tools) {
    const n = authName(t);
    if (n !== undefined) out.get(n)?.tools.push(t.name);
  }
  return [...out.values()];
}

function connectionFromDecl(t: ToolDeclaration, env: Record<string, string | undefined>, project: string): OAuthConnection {
  const get = literalSetting(t, env);
  // An Env setting that isn't set: say which.
  for (const a of t.argList) {
    const v = a.value;
    const name = v.kind === "ref" && v.path[0] === "Env" ? v.path.slice(1).join(".") : v.kind === "string" && /^Env\.\w+$/.test(v.value) ? v.value.slice(4) : undefined;
    if (name && env[name] === undefined) throw new AuthCliError(`${t.name}'s ${a.name}: reads Env.${name}, which is not set`);
  }
  // Built the same way as the runtime builds it, so the tokens are found under the same key.
  return connectionFromSettings(t.name, get, project);
}


/** What this machine has for each connection, for `halo plan` (reads the index only: nothing is unlocked). */
export function authStatusFor(ast: Pick<ParseResult, "tools">, opts: { env?: Record<string, string | undefined>; project: string; providerInfo?: (provider: string) => ProviderInfo | undefined; broker?: TokenBroker }): (connection: string) => AuthStatus | undefined {
  const declared = new Map(connectionsOf(ast, opts).map((d) => [d.name, d]));
  const broker = opts.broker ?? defaultBroker();
  return (name) => {
    const d = declared.get(name);
    if (!d?.conn) return undefined;
    return statusOf(broker.info(d.conn));
  };
}

function statusOf(info: TokenInfo | undefined): AuthStatus | undefined {
  if (!info) return { connected: false };
  return {
    connected: !info.needsLogin,
    ...(info.account ? { account: info.account } : {}),
    ...(info.expiresAt ? { expiresAt: info.expiresAt } : {}),
    ...(info.scopes ? { scopes: info.scopes } : {}),
    ...(info.needsLogin ? { needsLogin: info.needsLogin } : {}),
    // The index doesn't say whether a refresh token is kept; a grant that isn't client credentials keeps one when the server gave one.
  };
}

function find(name: string | undefined, files: string[], deps: AuthDeps, root: string): Declared & { conn: OAuthConnection } {
  if (!name) fail("Name the connection, as declared: halo auth login <Connection>");
  const all = files.flatMap((f) => connectionsOf(parse(readFileSync(f, "utf8")), { env: deps.env, project: root, providerInfo: deps.providerInfo, file: relative(process.cwd(), f) || f }));
  const hits = all.filter((d) => d.name === name);
  if (!hits.length) {
    const names = [...new Set(all.map((d) => d.name))];
    fail(`No OAuth connection named ${name} in ${files.length === 1 ? files[0] : "this project"}${names.length ? ` (there is ${names.join(", ")})` : " (declare one: tool " + name + ' : OAuth(provider: "google", clientId: Env.GOOGLE_CLIENT_ID, scopes: [...]))'}`);
  }
  const hit = hits.find((d) => d.conn) ?? hits[0]!;
  if (!hit.conn) fail(`${name}: ${hit.problem}`);
  const keys = new Set(hits.filter((d) => d.conn).map((d) => `${d.conn!.tokenUrl} ${d.conn!.clientId}`));
  if (keys.size > 1) fail(`${name} is declared in ${hits.map((h) => h.file).join(" and ")} with different endpoints or clients; pass the file`);
  return hit as Declared & { conn: OAuthConnection };
}

const host = (url?: string) => (url ? new URL(url).host : "");

function wider(conn: OAuthConnection, granted: string[]): string[] {
  return granted.filter((s) => !conn.scopes.includes(s) && !["openid", "offline_access", "profile", "email"].includes(s));
}

async function login(flags: AuthFlags, deps: AuthDeps, io: AuthIo, root: string): Promise<number> {
  const [, name, ...rest] = flags.positional;
  const { conn } = find(name, filesFrom(rest, root), deps, root);
  const broker = deps.broker ?? defaultBroker();
  const done = (r: { account?: string; scopes: string[] }) => {
    io.out(`Connected ${r.account ?? conn.name}. Granted: ${r.scopes.join(", ") || "(no scopes listed)"}.`);
    const extra = wider(conn, r.scopes);
    if (extra.length) io.err(`warning: ${conn.name} was granted more than it declares: ${extra.join(", ")}`);
    return 0;
  };
  if (conn.grant === "client_credentials") {
    // Nothing to sign in to: check the client works.
    await broker.token(conn);
    io.out(`${conn.name} uses client credentials: no login needed. Its client works (a token was issued by ${host(conn.tokenUrl)}).`);
    return 0;
  }
  const browser = !flags.bools.has("no-browser") && (deps.browser ?? hasBrowser(deps.env ?? process.env));
  if (flags.bools.has("device") || conn.grant === "device" || (!browser && !conn.authorizeUrl)) {
    if (!conn.deviceUrl) fail(`${conn.name} has no deviceUrl, so it can't sign in with a code${conn.authorizeUrl ? "; drop --device to sign in in a browser" : ""}`);
    const start = await startDevice(conn);
    io.out(`To connect ${conn.name}, open ${start.verificationUriComplete ?? start.verificationUri} on any device and enter the code:\n\n    ${start.userCode}\n`);
    io.err(`Waiting for you to approve it (the code expires in ${Math.round((start.expiresAt - Date.now()) / 60_000)} minutes)...`);
    return done(await pollDevice(broker, conn, start, { sleep: deps.sleep }));
  }
  if (!conn.authorizeUrl) fail(`${conn.name} has no authorizeUrl`);
  const loop = startLoopback({ timeoutMs: deps.timeoutMs });
  try {
    const req = authorizationRequest(conn, loop.redirectUri);
    io.err(`Opening ${host(conn.authorizeUrl)} to connect ${conn.name}${conn.scopes.length ? ` (${conn.scopes.length} scope${conn.scopes.length === 1 ? "" : "s"})` : ""}...`);
    const opened = browser && (await (deps.open ?? openBrowser)(req.url));
    if (!opened) io.out(`Open this link to sign in${browser ? " (the browser couldn't be opened)" : ""}:\n\n  ${req.url}\n`);
    const params = await loop.result;
    const code = checkRedirect(conn, params, req.state);
    return done(await broker.exchangeCode(conn, code, req.verifier, loop.redirectUri));
  } finally {
    loop.close();
  }
}

async function logout(flags: AuthFlags, deps: AuthDeps, io: AuthIo, root: string): Promise<number> {
  const [, name, ...rest] = flags.positional;
  const { conn } = find(name, filesFrom(rest, root), deps, root);
  const out = await (deps.broker ?? defaultBroker()).logout(conn, { revoke: !flags.bools.has("no-revoke") });
  if (!out.deleted) io.out(`${conn.name} wasn't connected on this machine.`);
  else io.out(`Disconnected ${conn.name}${out.revoked ? ` (and revoked it at ${host(conn.revokeUrl)})` : conn.revokeUrl && !flags.bools.has("no-revoke") ? " (the provider didn't confirm the revocation)" : ""}.`);
  return 0;
}

function describe(d: Declared, broker: TokenBroker): string {
  if (!d.conn) return `${d.name.padEnd(16)} ${d.problem}`;
  const info = broker.info(d.conn);
  const st = statusOf(info);
  const a: PlanAuth = { connection: d.name, grant: d.conn.grant, scopes: d.conn.scopes, tools: d.tools, status: d.conn.grant === "client_credentials" ? "service" : st?.needsLogin ? "needs login" : st?.connected ? "connected" : "not connected", ...(st?.account ? { account: st.account } : {}), ...(st?.expiresAt ? { expiresAt: st.expiresAt } : {}) };
  const used = d.tools.length ? `  used by ${d.tools.join(", ")}` : "";
  return `${d.name.padEnd(16)} ${d.conn.grant.padEnd(19)} ${authState(a)}${used}`;
}

async function list(flags: AuthFlags, deps: AuthDeps, io: AuthIo, root: string): Promise<number> {
  const files = filesFrom(flags.positional.slice(1), root);
  const broker = deps.broker ?? defaultBroker();
  const all = files.flatMap((f) => connectionsOf(parse(readFileSync(f, "utf8")), { env: deps.env, project: root, providerInfo: deps.providerInfo, file: f }));
  const seen = new Set<string>();
  const unique = all.filter((d) => !seen.has(d.name) && !!seen.add(d.name));
  if (!unique.length) io.out("No OAuth connections are declared here.");
  for (const d of unique) io.out(describe(d, broker));
  // Connections stored for this project that nothing here declares any more.
  const stale = broker.store.list(root).filter((r) => !seen.has(r.connection));
  for (const r of stale) io.out(`${r.connection.padEnd(16)} stored, but not declared here any more (halo auth logout needs its declaration; or delete it from ${broker.store.path})`);
  return 0;
}

async function status(flags: AuthFlags, deps: AuthDeps, io: AuthIo, root: string): Promise<number> {
  const args = flags.positional.slice(1);
  const name = args[0] && !isPath(args[0]) ? args.shift() : undefined;
  if (!name) return list({ ...flags, positional: ["list", ...args] }, deps, io, root);
  const d = find(name, filesFrom(args, root), deps, root);
  const broker = deps.broker ?? defaultBroker();
  const info = broker.info(d.conn);
  io.out(describe(d, broker));
  if (info) {
    io.out(`  scopes granted: ${info.scopes?.join(", ") || "(not said)"}`);
    if (d.conn.scopes.length) io.out(`  scopes declared: ${d.conn.scopes.join(", ")}`);
    const extra = wider(d.conn, info.scopes ?? []);
    if (extra.length) io.out(`  warning: granted more than declared: ${extra.join(", ")}`);
    if (info.account) io.out(`  account: ${info.account}`);
    if (info.expiresAt) io.out(`  access token expires: ${new Date(info.expiresAt).toISOString()}`);
    io.out(`  connected: ${info.connectedAt}`);
    if (info.needsLogin) io.out(`  ${info.needsLogin}: halo auth login ${d.name}`);
  }
  io.out(`  tokens kept in: ${broker.store.kind === "keychain" ? "the macOS Keychain (index: " + broker.store.path + ")" : broker.store.path}`);
  return 0;
}

export const AUTH_HELP = `halo auth login <Connection> [--device] [--no-browser] [file.halo]
                                        Connect an OAuth declaration to an account: opens the
                                        browser (or, with --device or no browser, prints a code)
halo auth logout <Connection> [--no-revoke]   Revoke it at the provider and forget it
halo auth list [file.halo]              Every connection and whether this machine is connected
halo auth status [<Connection>]         Its account, scopes and expiry`;

export async function cmdAuth(flags: AuthFlags, deps: AuthDeps = {}, io: AuthIo = { out: (l) => console.log(l), err: (l) => console.error(l) }): Promise<number> {
  const root = deps.project ?? process.cwd();
  try {
    switch (flags.positional[0]) {
      case "login":
        return await login(flags, deps, io, root);
      case "logout":
        return await logout(flags, deps, io, root);
      case "list":
      case undefined:
        return await list(flags, deps, io, root);
      case "status":
        return await status(flags, deps, io, root);
      default:
        fail(`Unknown: halo auth ${flags.positional[0]} (use login, logout, list or status)`);
    }
  } catch (e) {
    io.err(`Error: ${e instanceof Error ? e.message : String(e)}`);
    return 1;
  }
  return 0;
}
