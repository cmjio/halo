/**
 * MCP authorization, the client side of the MCP specification's (2025-06-18) authorization section.
 *
 *   tool Linear : MCP(url: "https://mcp.example.com/mcp", auth: "discover", scopes: ["read"])
 *   tool Docs   : MCP(url: "https://docs.internal/mcp", auth: InternalSSO)
 *
 * `auth: "discover"` finds the server's authorization server the way the spec says:
 *
 *   1. A request without a token gets 401 and `WWW-Authenticate: Bearer resource_metadata="..."`.
 *   2. The protected resource metadata (RFC 9728) names the resource (it must be this server's URL)
 *      and its authorization servers.
 *   3. The authorization server's metadata (RFC 8414 /.well-known/oauth-authorization-server, else
 *      OpenID Connect discovery) gives its endpoints. Its `issuer` must be the URL it was fetched for.
 *   4. Without a declared clientId:, Halo registers a public client there (RFC 7591), and keeps the
 *      client id (and a secret, if one is issued) in the token store, outside the project.
 *   5. Sign-in is authorization code with PKCE, with `resource=<the MCP server's URL>` (RFC 8707) on
 *      the authorize and token requests, so the token is good for that server only.
 *
 * Discovery fetches URLs a server chose. They must be https (http only on loopback, for local
 * servers and tests), carry no credentials, follow no redirects, take at most 5 seconds and 64 KB,
 * and under `halo serve` must not reach private, link-local or metadata addresses (loopback only
 * when serve itself listens on loopback).
 */

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import pkg from "../../package.json" with { type: "json" };
import { HaloError } from "./errors.js";
import { endpointProblem } from "./oauth-presets.js";
import { AuthRequired, storeKeyOf, type DiscoveryGuard, type OAuthConnection } from "./oauth.js";
import { storeId, type McpDiscovery, type StoreKey, type TokenRecord, type TokenStore } from "./oauth-store.js";

export type { McpDiscovery } from "./oauth-store.js";

/** Discovery found something Halo won't use (a wrong issuer, a private address, no metadata). */
export class DiscoveryError extends HaloError {
  constructor(message: string) {
    super(message, { code: "AUTH_DISCOVERY" });
    this.name = "DiscoveryError";
  }
}

const MAX_BYTES = 64 * 1024;
const TIMEOUT_MS = 5_000;

/** A server URL as a resource indicator: scheme, host and path, without a trailing slash, query or fragment. */
export function canonicalResource(url: string): string {
  const u = new URL(url);
  return `${u.origin}${u.pathname.replace(/\/+$/, "")}`;
}

/** The parameters of a `WWW-Authenticate: Bearer ...` challenge (lower-cased names), or undefined if there is none. */
export function bearerChallenge(header: string | null | undefined): Record<string, string> | undefined {
  if (!header) return undefined;
  const at = header.search(/\bBearer\b/i);
  if (at < 0) return undefined;
  const out: Record<string, string> = {};
  for (const m of header.slice(at + 6).matchAll(/([A-Za-z_][\w-]*)\s*=\s*(?:"((?:[^"\\]|\\.)*)"|([^\s,"]+))/g)) {
    const k = m[1]!.toLowerCase();
    if (!Object.hasOwn(out, k)) out[k] = m[2] !== undefined ? m[2].replace(/\\(.)/g, "$1") : m[3]!;
  }
  return out;
}

// ── Where discovery may go ──

const LOOPBACK_NAMES = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/** Whether an IP address is loopback, private (RFC 1918, link-local, CGNAT, ULA, multicast, unspecified) or public. */
export function addressKind(ip: string): "loopback" | "private" | "public" {
  const a = ip.replace(/^\[|\]$/g, "").toLowerCase();
  if (isIP(a) === 4) {
    const [x, y] = a.split(".").map(Number) as [number, number];
    if (x === 127) return "loopback";
    if (x === 10 || x === 0 || (x === 172 && y >= 16 && y <= 31) || (x === 192 && y === 168) || (x === 169 && y === 254) || (x === 100 && y >= 64 && y <= 127) || x >= 224) return "private";
    return "public";
  }
  if (a === "::1") return "loopback";
  const dotted = a.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) return addressKind(dotted[1]!);
  const hex = a.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hex) {
    const n = (parseInt(hex[1]!, 16) << 16) | parseInt(hex[2]!, 16);
    return addressKind([n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join("."));
  }
  if (a === "::" || /^f[cd]/.test(a) || /^fe[89ab]/.test(a) || a.startsWith("ff")) return "private";
  return "public";
}

/** Refuse a discovery URL that isn't https (or http on loopback), carries credentials, or (under serve) reaches a private address. */
export async function checkDiscoveryUrl(url: URL, guard?: DiscoveryGuard): Promise<void> {
  const loopbackName = LOOPBACK_NAMES.has(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopbackName)) throw new DiscoveryError(`Discovery only follows https URLs, not ${url.origin}`);
  if (url.username || url.password) throw new DiscoveryError(`Discovery won't send credentials in a URL (${url.host})`);
  if (!guard?.blockPrivate) return;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  let addresses: string[];
  if (isIP(host)) addresses = [host];
  else if (host === "localhost") addresses = ["127.0.0.1"];
  else {
    try {
      addresses = (await lookup(host, { all: true })).map((a) => a.address);
    } catch {
      throw new DiscoveryError(`Discovery couldn't resolve ${host}`);
    }
  }
  for (const a of addresses) {
    const kind = addressKind(a);
    if (kind === "private" || (kind === "loopback" && !guard.allowLoopback)) {
      throw new DiscoveryError(`Discovery won't fetch ${url.origin}: it resolves to ${a}, a ${kind} address, and under halo serve a server mustn't make Halo reach inside the network`);
    }
  }
}

/** One discovery request: checked target, no credentials, no redirects, 5 seconds, 64 KB. */
async function discoveryFetch(url: string, opts: { fetch?: typeof fetch; guard?: DiscoveryGuard; signal?: AbortSignal; method?: string; body?: string }): Promise<{ status: number; ok: boolean; data?: Record<string, unknown> }> {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new DiscoveryError(`Discovery was pointed at "${url.slice(0, 200)}", which is not a URL`);
  }
  await checkDiscoveryUrl(u, opts.guard);
  const signal = opts.signal ? AbortSignal.any([opts.signal, AbortSignal.timeout(TIMEOUT_MS)]) : AbortSignal.timeout(TIMEOUT_MS);
  let res: Response;
  try {
    res = await (opts.fetch ?? fetch)(u, {
      method: opts.method ?? "GET",
      headers: { Accept: "application/json", "User-Agent": `halo/${pkg.version}`, ...(opts.body ? { "Content-Type": "application/json" } : {}) },
      ...(opts.body ? { body: opts.body } : {}),
      redirect: "manual",
      credentials: "omit",
      signal,
    });
  } catch (e) {
    if (opts.signal?.aborted) throw e;
    throw new DiscoveryError(`Discovery couldn't reach ${u.origin}: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (res.status >= 300 && res.status < 400) {
    await res.body?.cancel().catch(() => {});
    throw new DiscoveryError(`${u.origin}${u.pathname} redirected; discovery follows no redirects`);
  }
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (res.body) {
    for await (const chunk of res.body) {
      size += chunk.byteLength;
      if (size > MAX_BYTES) {
        await res.body.cancel().catch(() => {});
        throw new DiscoveryError(`${u.origin}${u.pathname} sent more than 64 KB of metadata`);
      }
      chunks.push(chunk);
    }
  }
  const text = Buffer.concat(chunks).toString("utf8");
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {}
  return { status: res.status, ok: res.ok, ...(data && typeof data === "object" && !Array.isArray(data) ? { data: data as Record<string, unknown> } : {}) };
}

const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);
const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x) : []);
const noSlash = (s: string) => s.replace(/\/+$/, "");

// ── Discovery ──

/**
 * Ask the MCP server for nothing, as a client without a token does: an initialize. Returns the
 * Bearer challenge of its 401, or undefined when it answered without asking for one.
 */
export async function probeMcp(url: string, opts: { fetch?: typeof fetch; signal?: AbortSignal } = {}): Promise<Record<string, string> | undefined> {
  const res = await (opts.fetch ?? fetch)(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 0, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "halo", version: pkg.version } } }),
    redirect: "manual",
    signal: opts.signal ?? AbortSignal.timeout(15_000),
  });
  await res.body?.cancel().catch(() => {});
  if (res.status !== 401) return undefined;
  return bearerChallenge(res.headers.get("www-authenticate")) ?? {};
}

/** The authorization server's metadata (RFC 8414, else OpenID Connect discovery), with its issuer checked. */
export async function authorizationServerMetadata(server: string, opts: { fetch?: typeof fetch; guard?: DiscoveryGuard; signal?: AbortSignal } = {}) {
  const issuer = noSlash(server);
  let u: URL;
  try {
    u = new URL(issuer);
  } catch {
    throw new DiscoveryError(`The authorization server "${server.slice(0, 200)}" is not a URL`);
  }
  const path = u.pathname.replace(/\/+$/, "");
  const candidates = [`${u.origin}/.well-known/oauth-authorization-server${path}`, `${u.origin}/.well-known/openid-configuration${path}`, ...(path ? [`${u.origin}${path}/.well-known/openid-configuration`] : [])];
  for (const at of candidates) {
    const r = await discoveryFetch(at, opts);
    if (!r.ok || !r.data) continue;
    const m = r.data;
    const named = str(m.issuer);
    // A server answering for another issuer is a mix-up (or a lookalike): never fall through to the next URL.
    if (!named || noSlash(named) !== issuer) throw new DiscoveryError(`The metadata at ${at} names issuer ${named ?? "(none)"}, not ${issuer}, the authorization server it was fetched for; refused`);
    const authorizeUrl = str(m.authorization_endpoint);
    const tokenUrl = str(m.token_endpoint);
    if (!authorizeUrl || !tokenUrl) throw new DiscoveryError(`${issuer}'s metadata has no authorization_endpoint or token_endpoint`);
    for (const [k, v] of Object.entries({ authorization_endpoint: authorizeUrl, token_endpoint: tokenUrl, registration_endpoint: str(m.registration_endpoint), revocation_endpoint: str(m.revocation_endpoint) })) {
      const problem = v ? endpointProblem(v) : undefined;
      if (problem) throw new DiscoveryError(`${issuer}'s ${k} ${problem}`);
    }
    const methods = m.code_challenge_methods_supported;
    if (Array.isArray(methods) && !methods.includes("S256")) throw new DiscoveryError(`${issuer} doesn't support PKCE with S256, which Halo always uses`);
    return { issuer, authorizeUrl, tokenUrl, registrationUrl: str(m.registration_endpoint), revokeUrl: str(m.revocation_endpoint), scopes: strings(m.scopes_supported) };
  }
  throw new DiscoveryError(`No authorization server metadata for ${issuer} (looked at ${candidates.join(", ")})`);
}

/**
 * From a 401's challenge to the authorization server's endpoints: the protected resource metadata
 * (whose `resource` must be this server's URL), then its first authorization server's metadata.
 */
export async function discoverMcp(mcpUrl: string, opts: { challenge?: Record<string, string>; scopes?: string[]; fetch?: typeof fetch; guard?: DiscoveryGuard; signal?: AbortSignal } = {}): Promise<McpDiscovery> {
  const resource = canonicalResource(mcpUrl);
  const u = new URL(resource);
  const given = opts.challenge?.resource_metadata;
  const candidates = given ? [new URL(given, mcpUrl).toString()] : [...new Set([`${u.origin}/.well-known/oauth-protected-resource${u.pathname}`, `${u.origin}/.well-known/oauth-protected-resource`])];
  let prm: Record<string, unknown> | undefined;
  let prmUrl = candidates[0]!;
  for (const at of candidates) {
    const r = await discoveryFetch(at, opts);
    if (r.ok && r.data) {
      prm = r.data;
      prmUrl = at;
      break;
    }
  }
  if (!prm) throw new DiscoveryError(`${u.host} has no protected resource metadata (RFC 9728) at ${candidates.join(" or ")}`);
  const claimed = str(prm.resource);
  const canon = claimed ? canonicalResource(claimed) : undefined;
  // The metadata must be about this server: its URL, or a parent path on the same origin.
  if (!canon || !(canon === resource || (new URL(canon).origin === u.origin && resource.startsWith(`${canon}/`)))) {
    throw new DiscoveryError(`The metadata at ${prmUrl} is for ${claimed ?? "(no resource)"}, not ${resource}; refused`);
  }
  const servers = strings(prm.authorization_servers);
  if (!servers.length) throw new DiscoveryError(`The metadata at ${prmUrl} names no authorization_servers`);
  const as = await authorizationServerMetadata(servers[0]!, opts);
  const challenged = opts.challenge?.scope ? opts.challenge.scope.split(/\s+/).filter(Boolean) : [];
  const scopes = opts.scopes?.length ? opts.scopes : challenged.length ? challenged : strings(prm.scopes_supported);
  return {
    resource,
    resourceMetadata: prmUrl,
    issuer: as.issuer,
    authorizeUrl: as.authorizeUrl,
    tokenUrl: as.tokenUrl,
    ...(as.registrationUrl ? { registrationUrl: as.registrationUrl } : {}),
    ...(as.revokeUrl ? { revokeUrl: as.revokeUrl } : {}),
    scopes,
    discoveredAt: new Date().toISOString(),
  };
}

/**
 * Register a public client (RFC 7591) for this redirect URI. Only client_id (and client_secret, if
 * the server issues one) is kept; registered redirect URIs other than the one sent are refused.
 * Nothing about the person is sent.
 */
export async function registerClient(d: McpDiscovery, redirectUri: string, opts: { fetch?: typeof fetch; guard?: DiscoveryGuard; signal?: AbortSignal } = {}): Promise<{ clientId: string; clientSecret?: string }> {
  const host = new URL(d.issuer).host;
  if (!d.registrationUrl) throw new DiscoveryError(`${host} doesn't offer dynamic client registration (RFC 7591): register an app there and give the tool clientId:`);
  const body = {
    client_name: "Halo",
    redirect_uris: [redirectUri],
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
    software_id: "halo",
    software_version: pkg.version,
    ...(d.scopes.length ? { scope: d.scopes.join(" ") } : {}),
  };
  const r = await discoveryFetch(d.registrationUrl, { ...opts, method: "POST", body: JSON.stringify(body) });
  if (!r.ok) throw new DiscoveryError(`${host} refused to register Halo as a client (${r.status}${str(r.data?.error) ? ` ${str(r.data?.error)}` : ""})`);
  const clientId = str(r.data?.client_id);
  if (!clientId) throw new DiscoveryError(`${host}'s registration answer has no client_id`);
  const uris = r.data?.redirect_uris;
  if (uris !== undefined && !(Array.isArray(uris) && uris.length === 1 && uris[0] === redirectUri)) throw new DiscoveryError(`${host} registered other redirect URIs than the one Halo sent; refused`);
  const secret = str(r.data?.client_secret);
  return { clientId, ...(secret ? { clientSecret: secret } : {}) };
}

// ── Kept in the token store ──

/** Where a discovered MCP server's discovery (and registered client) is stored, per tool, server and user. */
export function discoveryKey(name: string, mcpUrl: string, project: string, user = "local"): StoreKey {
  return { project, connection: name, tokenUrl: `mcp-discovery:${canonicalResource(mcpUrl)}`, clientId: "-", user };
}

/** What a discovered tool's declaration says for itself. */
export interface DiscoverSettings {
  clientId?: string;
  clientSecret?: string;
  scopes?: string[];
}

/** The connection a discovery gives. The declaration's clientId: wins over a registered one. */
export function connectionFromDiscovery(name: string, d: McpDiscovery, settings: DiscoverSettings, project: string, user: string, registeredSecret?: string): OAuthConnection {
  const clientId = settings.clientId ?? d.clientId;
  if (!clientId) throw new AuthRequired(name, "no client is registered at its authorization server yet");
  const secret = settings.clientId ? settings.clientSecret : registeredSecret;
  return {
    name,
    grant: "authorization_code",
    clientId,
    ...(secret ? { clientSecret: secret } : {}),
    scopes: settings.scopes?.length ? settings.scopes : d.scopes,
    authorizeUrl: d.authorizeUrl,
    tokenUrl: d.tokenUrl,
    ...(d.revokeUrl ? { revokeUrl: d.revokeUrl } : {}),
    issuer: d.issuer,
    resource: d.resource,
    project,
    user,
  };
}

/** Registered clients' secrets read from the store, by entry and discovery time (the Keychain is slow to ask each call). */
const secrets = new Map<string, string | undefined>();

/** The connection stored for a discovered tool. Throws AuthRequired when it hasn't been discovered on this machine. */
export async function discoveredConnection(store: TokenStore, a: { name: string; url: string; project: string; user?: string; settings: DiscoverSettings }): Promise<OAuthConnection> {
  const user = a.user ?? "local";
  const key = discoveryKey(a.name, a.url, a.project, user);
  const d = store.info(key)?.discovery;
  if (!d) throw new AuthRequired(a.name, "it isn't connected on this machine (its authorization server hasn't been discovered yet)");
  let secret: string | undefined;
  if (d.hasSecret && !a.settings.clientId) {
    const id = `${storeId(key)} ${d.discoveredAt}`;
    if (!secrets.has(id)) secrets.set(id, (await store.get(key))?.clientSecret);
    secret = secrets.get(id);
  }
  return connectionFromDiscovery(a.name, d, a.settings, a.project, user, secret);
}

/** Keep a discovery (and its registered client's secret) in the store. */
export async function saveDiscovery(store: TokenStore, key: StoreKey, d: McpDiscovery, clientSecret?: string): Promise<void> {
  const record: TokenRecord = { ...key, user: key.user ?? "local", grant: "authorization_code", connectedAt: d.discoveredAt, discovery: { ...d, hasSecret: !!clientSecret }, ...(clientSecret ? { clientSecret } : {}) };
  await store.put(key, record);
}

/** What a person is shown before signing in to a discovered server. */
export interface DiscoveredSignIn {
  /** The authorization server's host, where the person will sign in. */
  host: string;
  issuer: string;
  scopes: string[];
  /** Halo registers (or reuses) a client of its own there, as no clientId: is declared. */
  dynamic: boolean;
}

/**
 * Get a discovered tool ready to sign in: probe the server, discover its authorization server, show
 * the person where they'll sign in (`show`, before anything is registered), register a client when
 * the declaration has none (or reuse one registered for this redirect URI), and store the discovery.
 */
export async function prepareMcpLogin(a: {
  name: string;
  url: string;
  project: string;
  user?: string;
  settings: DiscoverSettings;
  redirectUri: string;
  store: TokenStore;
  fetch?: typeof fetch;
  guard?: DiscoveryGuard;
  signal?: AbortSignal;
  show?: (s: DiscoveredSignIn) => void | Promise<void>;
}): Promise<OAuthConnection> {
  const user = a.user ?? "local";
  const challenge = await probeMcp(a.url, a);
  const d = await discoverMcp(a.url, { ...a, challenge: challenge ?? {}, scopes: a.settings.scopes });
  const dynamic = !a.settings.clientId;
  await a.show?.({ host: new URL(d.authorizeUrl).host, issuer: d.issuer, scopes: d.scopes, dynamic });
  const key = discoveryKey(a.name, a.url, a.project, user);
  let secret: string | undefined;
  if (dynamic) {
    const prior = a.store.info(key)?.discovery;
    if (prior?.clientId && prior.dynamic && prior.issuer === d.issuer && prior.tokenUrl === d.tokenUrl && prior.redirectUris?.includes(a.redirectUri)) {
      d.clientId = prior.clientId;
      d.redirectUris = prior.redirectUris;
      if (prior.hasSecret) secret = (await a.store.get(key))?.clientSecret;
    } else {
      const reg = await registerClient(d, a.redirectUri, a);
      d.clientId = reg.clientId;
      d.redirectUris = [a.redirectUri];
      secret = reg.clientSecret;
    }
    d.dynamic = true;
  }
  await saveDiscovery(a.store, key, d, secret);
  return connectionFromDiscovery(a.name, d, a.settings, a.project, user, secret);
}

/**
 * For a declared connection on an MCP server: when the server publishes metadata, its tokens must
 * come from the declared token endpoint's origin, or nothing is signed in. Metadata that can't be
 * read is only a warning: the declaration says where to sign in.
 */
export async function checkDeclaredMcp(conn: OAuthConnection, url: string, opts: { fetch?: typeof fetch; guard?: DiscoveryGuard; signal?: AbortSignal } = {}): Promise<{ discovery?: McpDiscovery; warning?: string }> {
  let d: McpDiscovery;
  try {
    const challenge = await probeMcp(url, opts);
    if (!challenge?.resource_metadata) return {};
    d = await discoverMcp(url, { ...opts, challenge });
  } catch (e) {
    return { warning: `${conn.name}: couldn't read ${new URL(url).host}'s authorization metadata (${e instanceof Error ? e.message : String(e)})` };
  }
  const declared = new URL(conn.tokenUrl).origin;
  const found = new URL(d.tokenUrl).origin;
  if (declared !== found) throw new DiscoveryError(`${new URL(url).host}'s metadata says its tokens come from ${found}, but ${conn.name} declares tokenUrl ${conn.tokenUrl}; refused (if the server really moved, change the declaration)`);
  return { discovery: d };
}

/** The store id of a connection (for caching MCP clients per account). */
export const connectionId = (c: OAuthConnection) => storeId(storeKeyOf(c));
