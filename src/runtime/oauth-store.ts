/**
 * Where OAuth tokens live: outside every project, never under .halo.
 *
 *   ~/.config/halo/credentials.json   (or $XDG_CONFIG_HOME/halo/..., or $HALO_CREDENTIALS_FILE)
 *
 * The file is 0600 in a 0700 folder. On macOS the tokens themselves go in the Keychain (service
 * "halo-oauth") and the file keeps only what `halo auth list` and `halo plan` show: who, which
 * scopes, until when. Elsewhere, or when HALO_CREDENTIALS_FILE or HALO_CREDENTIALS_STORE=file says
 * so, the file keeps the tokens too.
 *
 * An entry is keyed by the project's real path, the connection's name, its token URL and its client
 * id, and the Halo user (always "local" until `halo serve` knows people), like the trust file:
 * one repo can't use a connection another repo made by declaring the same name, and a declaration
 * that changes its token URL is a different connection with nothing stored.
 */

import { createHash } from "node:crypto";
import { chmodSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, realpathSync, renameSync, statSync, unlinkSync, writeFileSync, writeSync, fsyncSync } from "node:fs";
import { homedir, hostname } from "node:os";
import { dirname, join, resolve } from "node:path";

/** What identifies one stored connection. */
export interface StoreKey {
  /** The project's folder (its real path is used). */
  project: string;
  /** The OAuth declaration's (or the package tool's) name. */
  connection: string;
  tokenUrl: string;
  clientId: string;
  /** Whose token this is. "local" for the person at this machine; `halo serve` with identity will key by person. */
  user?: string;
}

/** One stored connection. The tokens are the only secrets in it. */
export interface TokenRecord {
  project: string;
  connection: string;
  tokenUrl: string;
  clientId: string;
  user: string;
  grant: string;
  provider?: string;
  /** The scopes the server granted, when it said (else the ones asked for). */
  scopes?: string[];
  /** Who signed in, when the token response or an ID token said. */
  account?: string;
  connectedAt: string;
  /** When the access token expires (ms since epoch). */
  expiresAt?: number;
  accessToken?: string;
  refreshToken?: string;
  /** sha256 of a refresh token the declaration itself gave (mail's Env.X), so a new one there wins over the rotated one kept here. */
  seed?: string;
  /** The URL to revoke at on logout, as it was when the token was stored. */
  revokeUrl?: string;
  /** Set when a refresh was refused (invalid_grant): the connection needs signing in again. */
  needsLogin?: string;
  /**
   * For an MCP server's discovered authorization (`auth: "discover"`): where its authorization
   * server is, and the client Halo registered there. Not a secret; a registered client's secret is
   * kept in `clientSecret`, with the other secrets.
   */
  discovery?: McpDiscovery;
  /** A dynamically registered client's secret, when the authorization server issued one. */
  clientSecret?: string;
}

/** What discovery found for an MCP server (RFC 9728, RFC 8414), and the client registered there (RFC 7591). */
export interface McpDiscovery {
  /** The MCP server's URL, normalized: what `resource=` names (RFC 8707). */
  resource: string;
  /** The protected resource metadata it came from. */
  resourceMetadata: string;
  issuer: string;
  authorizeUrl: string;
  tokenUrl: string;
  registrationUrl?: string;
  revokeUrl?: string;
  /** The scopes to ask for: the declaration's, else the server's challenge, else its scopes_supported. */
  scopes: string[];
  /** The client id Halo registered (dynamic client registration), when the declaration gives none. */
  clientId?: string;
  /** The redirect URIs that client was registered with. */
  redirectUris?: string[];
  /** Whether the client was registered by Halo (so no person chose its publisher). */
  dynamic?: boolean;
  /** Whether a client secret was issued (kept with the secrets). */
  hasSecret?: boolean;
  discoveredAt: string;
}

/** A record without its secrets: what lists and plans show. */
export type TokenInfo = Omit<TokenRecord, "accessToken" | "refreshToken" | "seed" | "clientSecret">;

export interface TokenStore {
  readonly kind: "file" | "keychain";
  /** Where the index lives (for messages). */
  readonly path: string;
  get(key: StoreKey): Promise<TokenRecord | undefined>;
  put(key: StoreKey, record: TokenRecord): Promise<void>;
  delete(key: StoreKey): Promise<boolean>;
  /** Every stored connection, without secrets; for one project when given. */
  list(project?: string): TokenInfo[];
  /** The entry without secrets, read without unlocking anything (for plan and status). */
  info(key: StoreKey): TokenInfo | undefined;
  /** Run `fn` holding this key's lock, across this process and others. */
  lock<T>(key: StoreKey, fn: () => Promise<T>): Promise<T>;
}

/** The credentials file every project on this machine shares. */
export function credentialsFile(): string {
  if (process.env.HALO_CREDENTIALS_FILE) return resolve(process.env.HALO_CREDENTIALS_FILE);
  const config = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
  return join(config, "halo", "credentials.json");
}

/** A project's real path, so a symlink or `..` names the same project. */
export function projectPath(root: string): string {
  const abs = resolve(root);
  try {
    return realpathSync(abs);
  } catch {
    return abs;
  }
}

/** The id an entry is stored under: a hash of what identifies it. */
export function storeId(key: StoreKey): string {
  const parts = [projectPath(key.project), key.connection, key.tokenUrl, key.clientId, key.user ?? "local"];
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 40);
}

const SECRET_FIELDS = ["accessToken", "refreshToken", "seed", "clientSecret"] as const;
const withoutSecrets = (r: TokenRecord): TokenInfo => {
  const out = { ...r } as Partial<TokenRecord>;
  for (const f of SECRET_FIELDS) delete out[f];
  return out as TokenInfo;
};

// ── Locks ──

const chains = new Map<string, Promise<unknown>>();

/** One holder at a time in this process, in order. */
async function inProcess<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const before = chains.get(name) ?? Promise.resolve();
  let release!: () => void;
  const mine = new Promise<void>((r) => (release = r));
  const tail = before.then(() => mine);
  chains.set(name, tail);
  await before.catch(() => {});
  try {
    return await fn();
  } finally {
    release();
    if (chains.get(name) === tail) chains.delete(name);
  }
}

const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "EPERM";
  }
};

/** A lock file taken with O_EXCL, holding pid, host and start time. Stale after 30 seconds, or when its process is gone. */
export async function withFileLock<T>(path: string, fn: () => Promise<T>, opts: { staleMs?: number; waitMs?: number } = {}): Promise<T> {
  return inProcess(path, async () => {
    const staleMs = opts.staleMs ?? 30_000;
    const deadline = Date.now() + (opts.waitMs ?? 60_000);
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    for (;;) {
      try {
        const fd = openSync(path, "wx", 0o600);
        writeSync(fd, JSON.stringify({ pid: process.pid, host: hostname(), at: Date.now() }));
        closeSync(fd);
        break;
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
        try {
          const held = JSON.parse(readFileSync(path, "utf8")) as { pid?: number; host?: string; at?: number };
          const old = Date.now() - (held.at ?? statSync(path).mtimeMs) > staleMs;
          const gone = held.host === hostname() && typeof held.pid === "number" && !alive(held.pid);
          if (old || gone) {
            unlinkSync(path);
            continue;
          }
        } catch {
          // Half-written by its holder, or just removed: look again.
        }
        if (Date.now() > deadline) throw new Error(`Timed out waiting for the lock ${path}`);
        await new Promise((r) => setTimeout(r, 25));
      }
    }
    try {
      return await fn();
    } finally {
      try {
        unlinkSync(path);
      } catch {}
    }
  });
}

// ── The index file ──

interface FileShape {
  version: 1;
  entries: Record<string, TokenRecord>;
}

function readFile(path: string): FileShape {
  if (!existsSync(path)) return { version: 1, entries: {} };
  try {
    const st = statSync(path);
    // A file another user owns could have been planted: its tokens would be someone else's choice.
    if (typeof process.getuid === "function" && st.uid !== process.getuid()) throw new Error(`${path} belongs to another user; Halo won't read tokens from it`);
    const data = JSON.parse(readFileSync(path, "utf8"));
    return data && typeof data === "object" && data.entries && typeof data.entries === "object" ? { version: 1, entries: data.entries } : { version: 1, entries: {} };
  } catch (e) {
    if (e instanceof Error && /another user/.test(e.message)) throw e;
    return { version: 1, entries: {} };
  }
}

/** Replace the file in one step: a temp file, fsync, rename. */
function writeFileAtomic(path: string, data: FileShape): void {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  try {
    chmodSync(dirname(path), 0o700);
  } catch {}
  const tmp = `${path}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  const fd = openSync(tmp, "w", 0o600);
  try {
    writeSync(fd, JSON.stringify(data, null, 2) + "\n");
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  renameSync(tmp, path);
  try {
    chmodSync(path, 0o600);
  } catch {}
}

/** Change the index under its own lock, so two processes writing different entries don't lose one. */
async function updateIndex(path: string, change: (data: FileShape) => void): Promise<void> {
  await withFileLock(`${path}.lock`, async () => {
    const data = readFile(path);
    change(data);
    writeFileAtomic(path, data);
  });
}

abstract class IndexedStore {
  abstract readonly kind: "file" | "keychain";
  /** `path` fixes the file; without it, the store follows HALO_CREDENTIALS_FILE as it is when used. */
  constructor(private readonly fixed?: string) {}

  get path(): string {
    return this.fixed ?? credentialsFile();
  }

  list(project?: string): TokenInfo[] {
    const want = project === undefined ? undefined : projectPath(project);
    return Object.values(readFile(this.path).entries)
      .filter((r) => want === undefined || r.project === want)
      .map(withoutSecrets);
  }

  info(key: StoreKey): TokenInfo | undefined {
    const r = readFile(this.path).entries[storeId(key)];
    return r ? withoutSecrets(r) : undefined;
  }

  lock<T>(key: StoreKey, fn: () => Promise<T>): Promise<T> {
    return withFileLock(`${this.path}.${storeId(key)}.lock`, fn);
  }
}

/** Tokens in the 0600 file itself. */
export class FileTokenStore extends IndexedStore implements TokenStore {
  readonly kind = "file" as const;

  async get(key: StoreKey): Promise<TokenRecord | undefined> {
    const r = readFile(this.path).entries[storeId(key)];
    return r ? { ...r } : undefined;
  }

  async put(key: StoreKey, record: TokenRecord): Promise<void> {
    await updateIndex(this.path, (d) => void (d.entries[storeId(key)] = { ...record, project: projectPath(key.project) }));
  }

  async delete(key: StoreKey): Promise<boolean> {
    let had = false;
    await updateIndex(this.path, (d) => {
      const id = storeId(key);
      had = Object.hasOwn(d.entries, id);
      delete d.entries[id];
    });
    return had;
  }
}

// ── The macOS Keychain ──

export const KEYCHAIN_OAUTH_SERVICE = "halo-oauth";

/** Quote a word for `security -i`, which reads \" and \\ inside double quotes. */
const q = (s: string) => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

const toolEnv = () => ({ PATH: process.env.PATH ?? "/usr/bin:/bin", HOME: process.env.HOME ?? "" });

/** Run `security -i` with the commands, values included, on its standard input, never its command line. */
async function securityInput(commands: string): Promise<{ ok: boolean; err: string }> {
  const proc = Bun.spawn(["security", "-i"], { stdin: "pipe", stdout: "pipe", stderr: "pipe", env: toolEnv() });
  proc.stdin.write(commands);
  await proc.stdin.end();
  const [out, err, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
  return { ok: code === 0 && !/error|failed|could not/i.test(out + err), err: (err || out).trim() };
}

/**
 * The tokens as one Keychain item. `security -i` reads 4095 bytes a line, so a pair too long for
 * one line keeps the refresh token only (the access token is fetched again when needed).
 */
export function keychainLine(id: string, secrets: { a?: string; r?: string; s?: string; c?: string }): string | undefined {
  const line = (v: object) => `add-generic-password -U -s ${q(KEYCHAIN_OAUTH_SERVICE)} -a ${q(id)} -l ${q("Halo OAuth connection")} -T "" -w ${q(JSON.stringify(v))}\n`;
  for (const v of [secrets, { r: secrets.r, s: secrets.s, c: secrets.c }]) {
    const l = line(v);
    if (Buffer.byteLength(l) < 4000 && !/[\u0000-\u0009\u000b-\u001f\u007f]/.test(l) && l.indexOf("\n") === l.length - 1) return l;
  }
  return undefined;
}

/** Tokens in the Keychain; the file keeps the rest. */
export class KeychainTokenStore extends IndexedStore implements TokenStore {
  readonly kind = "keychain" as const;

  async get(key: StoreKey): Promise<TokenRecord | undefined> {
    const id = storeId(key);
    const r = readFile(this.path).entries[id];
    if (!r) return undefined;
    const proc = Bun.spawn(["security", "find-generic-password", "-s", KEYCHAIN_OAUTH_SERVICE, "-a", id, "-w"], { stdout: "pipe", stderr: "pipe", env: toolEnv() });
    const [out, code] = await Promise.all([new Response(proc.stdout).text(), proc.exited]);
    if (code !== 0) return { ...r };
    try {
      const s = JSON.parse(out.trim()) as { a?: string; r?: string; s?: string; c?: string };
      return { ...r, ...(s.a ? { accessToken: s.a } : { expiresAt: undefined }), ...(s.r ? { refreshToken: s.r } : {}), ...(s.s ? { seed: s.s } : {}), ...(s.c ? { clientSecret: s.c } : {}) };
    } catch {
      return { ...r };
    }
  }

  async put(key: StoreKey, record: TokenRecord): Promise<void> {
    const id = storeId(key);
    const line = keychainLine(id, { a: record.accessToken, r: record.refreshToken, s: record.seed, c: record.clientSecret });
    if (!line) throw new Error("This token is too long to keep in the Keychain; set HALO_CREDENTIALS_STORE=file to keep it in a 0600 file instead");
    const r = await securityInput(line);
    if (!r.ok) throw new Error(`The Keychain refused the token: ${r.err}`);
    // A pair too long for one line kept only the refresh token: the index mustn't promise an access token.
    const kept = line.includes('\\"a\\"');
    await updateIndex(this.path, (d) => void (d.entries[id] = { ...withoutSecrets(record), project: projectPath(key.project), ...(kept ? {} : { expiresAt: undefined }) } as TokenRecord));
  }

  async delete(key: StoreKey): Promise<boolean> {
    const id = storeId(key);
    await securityInput(`delete-generic-password -s ${q(KEYCHAIN_OAUTH_SERVICE)} -a ${q(id)}\n`);
    let had = false;
    await updateIndex(this.path, (d) => {
      had = Object.hasOwn(d.entries, id);
      delete d.entries[id];
    });
    return had;
  }
}

/**
 * The store this machine uses: the file when HALO_CREDENTIALS_FILE or HALO_CREDENTIALS_STORE=file
 * says so (tests always do), the Keychain on macOS, else the file.
 */
export function defaultTokenStore(): TokenStore {
  const choice = process.env.HALO_CREDENTIALS_STORE;
  if (process.env.HALO_CREDENTIALS_FILE || choice === "file") return new FileTokenStore();
  if (choice === "keychain" || (process.platform === "darwin" && existsSync("/usr/bin/security"))) return new KeychainTokenStore();
  return new FileTokenStore();
}
