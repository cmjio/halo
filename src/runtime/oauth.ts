/**
 * The token broker: the one place a tool gets an OAuth access token from.
 *
 *   tool Google : OAuth(provider: "google", clientId: Env.GOOGLE_CLIENT_ID, scopes: ["..."])
 *   tool Drive  : REST("https://www.googleapis.com/drive/v3", auth: Google)
 *
 * A provider never holds a token. It asks the broker to make a request (`authFetch`): the broker
 * adds the Authorization header, only for the tool's own origin, and follows only same-origin
 * redirects with it. Access tokens are cached in memory until 60 seconds before they expire, then
 * refreshed. A 401 refreshes once and sends the request once more; another 401, or a refresh the
 * server refuses (invalid_grant), is AUTH_REQUIRED, which pauses the run until someone connects.
 *
 * Refresh tokens are kept in the token store (oauth-store.ts). A rotated refresh token replaces the
 * old one before the new access token is used, under a lock that other processes respect too, and
 * the store is read again inside the lock, so two refreshes at once never spend one token twice.
 *
 * Token endpoint bodies are never shown: only their `error` and `error_description`.
 */

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { ToolDeclaration, Value } from "../parser/types.js";
import { HaloError } from "./errors.js";
import { endpointProblem, OAUTH_GRANTS, OAUTH_PRESETS, type OAuthGrant } from "./oauth-presets.js";
import { defaultTokenStore, type StoreKey, type TokenInfo, type TokenRecord, type TokenStore } from "./oauth-store.js";
import type { ToolCall, ToolServices } from "./tools.js";

/** One OAuth connection: a client, a grant, scopes, and (once connected) an account. */
export interface OAuthConnection {
  /** The declaration's name (or the package tool's), e.g. "Google". */
  name: string;
  provider?: string;
  grant: OAuthGrant;
  clientId: string;
  clientSecret?: string;
  scopes: string[];
  authorizeUrl?: string;
  tokenUrl: string;
  deviceUrl?: string;
  revokeUrl?: string;
  issuer?: string;
  audience?: string;
  resource?: string;
  /** The project the tokens are kept for. */
  project: string;
  /** Whose tokens: "local" until `halo serve` knows people. */
  user?: string;
  /**
   * A refresh token the declaration gives itself (Email's `refreshToken:` or first argument). It is
   * the starting point: a rotated one is kept in the store, and a new value here wins over it.
   */
  refreshToken?: string;
  /** Extra form fields for token requests (e.g. Graph's `.default` scope for client credentials). */
  tokenParams?: Record<string, string>;
}

/** A connection that isn't connected, or whose grant the server no longer accepts. Pauses the run. */
export class AuthRequired extends HaloError {
  constructor(readonly connection: string, readonly reason: string) {
    super(`${connection} needs signing in: ${reason}. Connect it with: halo auth login ${connection}`, { code: "AUTH_REQUIRED" });
    this.name = "AuthRequired";
  }
}

export const isAuthRequired = (e: unknown): e is AuthRequired => e instanceof AuthRequired || (e instanceof HaloError && e.code === "AUTH_REQUIRED" && typeof (e as { connection?: unknown }).connection === "string");

/** What a run pauses with when a connection is needed: `connect:Google`. */
export const connectEvent = (connection: string) => `connect:${connection}`;

/** A usable access token. */
export interface AccessToken {
  accessToken: string;
  tokenType: string;
  expiresAt?: number;
}

/** The fields of a token endpoint's answer Halo reads. */
export interface TokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  id_token?: string;
  [k: string]: unknown;
}

const SKEW_MS = 60_000;

// ── Connections from declarations ──

const text = (v: unknown): string | undefined => (typeof v === "string" && v ? v : typeof v === "number" ? String(v) : undefined);

/**
 * The connection an `OAuth(...)` declaration describes. `get` reads one of its settings, resolved
 * (Env.X read from the environment).
 */
export function connectionFrom(name: string, get: (setting: string) => unknown, project: string): OAuthConnection {
  const bad = (msg: string): never => {
    throw new HaloError(`OAuth connection "${name}": ${msg}`, { code: "TOOL_CONFIG" });
  };
  const provider = text(get("provider"))?.toLowerCase();
  if (provider !== undefined && !Object.hasOwn(OAUTH_PRESETS, provider)) bad(`provider "${provider}" is not one Halo knows (${Object.keys(OAUTH_PRESETS).join(", ")}); give authorizeUrl: and tokenUrl: instead`);
  const preset = provider ? OAUTH_PRESETS[provider]!(text(get("tenant"))) : {};
  const grant = (text(get("grant")) ?? "authorization_code") as OAuthGrant;
  if (!OAUTH_GRANTS.includes(grant)) bad(`grant "${grant}" is not one of ${OAUTH_GRANTS.join(", ")}`);
  const clientId = text(get("clientId")) ?? bad(`needs clientId: (your app's client id, e.g. clientId: Env.${name.toUpperCase()}_CLIENT_ID)`);
  const scopesRaw = get("scopes");
  const scopes = Array.isArray(scopesRaw) ? scopesRaw.map(String) : typeof scopesRaw === "string" && scopesRaw ? scopesRaw.split(/[\s,]+/).filter(Boolean) : [];
  const url = (setting: string, fallback?: string) => {
    const v = text(get(setting)) ?? fallback;
    if (v !== undefined) {
      const problem = endpointProblem(v);
      if (problem) bad(`${setting} ${problem}`);
    }
    return v;
  };
  const conn: OAuthConnection = {
    name,
    ...(provider ? { provider } : {}),
    grant,
    clientId,
    ...(text(get("clientSecret")) ? { clientSecret: text(get("clientSecret")) } : {}),
    scopes,
    tokenUrl: url("tokenUrl", preset.tokenUrl) ?? bad("needs tokenUrl: (or a provider: Halo knows)"),
    project,
  };
  const authorizeUrl = url("authorizeUrl", preset.authorizeUrl);
  const deviceUrl = url("deviceUrl", preset.deviceUrl);
  const revokeUrl = url("revokeUrl", preset.revokeUrl);
  const issuer = text(get("issuer")) ?? preset.issuer;
  if (authorizeUrl) conn.authorizeUrl = authorizeUrl;
  if (deviceUrl) conn.deviceUrl = deviceUrl;
  if (revokeUrl) conn.revokeUrl = revokeUrl;
  if (issuer) conn.issuer = issuer;
  for (const k of ["audience", "resource"] as const) if (text(get(k))) conn[k] = text(get(k));
  if (grant === "authorization_code" && !conn.authorizeUrl) bad("needs authorizeUrl: for the authorization_code grant (or a provider: Halo knows)");
  if (grant === "device" && !conn.deviceUrl) bad("needs deviceUrl: for the device grant (or a provider: Halo knows that has one)");
  if (grant === "client_credentials" && !conn.clientSecret) bad("needs clientSecret: for the client_credentials grant");
  return conn;
}

/** A declaration's setting as written, with Env.X read from `env` (for the CLI, which runs nothing). */
export function literalSetting(decl: ToolDeclaration, env: Record<string, string | undefined>): (setting: string) => unknown {
  const lit = (v: Value): unknown => {
    switch (v.kind) {
      case "string":
        return /^Env\.\w+$/.test(v.value) ? env[v.value.slice(4)] : v.value;
      case "number":
      case "bool":
        return v.value;
      case "list":
        return v.items.map(lit);
      case "ref":
        return v.path[0] === "Env" ? env[v.path.slice(1).join(".")] : v.path.join(".");
      default:
        return undefined;
    }
  };
  return (setting) => {
    const a = decl.argList.find((x) => x.name === setting);
    return a ? lit(a.value) : undefined;
  };
}

/** The name a tool's `auth:` gives, as written. */
export function authName(tool: Pick<ToolDeclaration, "argList">): string | undefined {
  const v = tool.argList.find((a) => a.name === "auth")?.value;
  if (!v) return undefined;
  if (v.kind === "ref") return v.path.join(".");
  if (v.kind === "string") return v.value;
  return undefined;
}

export const storeKeyOf = (c: OAuthConnection): StoreKey => ({ project: c.project, connection: c.name, tokenUrl: c.tokenUrl, clientId: c.clientId, user: c.user ?? "local" });

// ── PKCE and state ──

const b64url = (b: Uint8Array | Buffer) => Buffer.from(b).toString("base64url");

/** A PKCE verifier (43 characters of base64url) and its S256 challenge. */
export function pkcePair(): { verifier: string; challenge: string } {
  const verifier = b64url(randomBytes(32));
  return { verifier, challenge: pkceChallenge(verifier) };
}

export const pkceChallenge = (verifier: string) => b64url(createHash("sha256").update(verifier).digest());

/** 32 random bytes, for `state`. */
export const randomState = () => b64url(randomBytes(32));

/** Compare two strings in constant time. */
export function sameSecret(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** The URL a person is sent to to sign in, with a fresh state and PKCE verifier to keep. */
export function authorizationRequest(conn: OAuthConnection, redirectUri: string): { url: string; state: string; verifier: string } {
  if (!conn.authorizeUrl) throw new HaloError(`OAuth connection "${conn.name}" has no authorizeUrl`, { code: "TOOL_CONFIG" });
  const { verifier, challenge } = pkcePair();
  const state = randomState();
  const url = new URL(conn.authorizeUrl);
  const p = url.searchParams;
  p.set("response_type", "code");
  p.set("client_id", conn.clientId);
  p.set("redirect_uri", redirectUri);
  if (conn.scopes.length) p.set("scope", conn.scopes.join(conn.provider === "slack" ? "," : " "));
  p.set("state", state);
  p.set("code_challenge", challenge);
  p.set("code_challenge_method", "S256");
  if (conn.resource) p.set("resource", conn.resource);
  if (conn.audience) p.set("audience", conn.audience);
  // Google gives a refresh token only when asked for offline access, and again only with consent.
  if (conn.provider === "google") {
    p.set("access_type", "offline");
    p.set("prompt", "consent");
  }
  return { url: url.toString(), state, verifier };
}

/** The issuer a redirect's `iss` must name: the declared one, else the authorize URL's origin. */
export function expectedIssuer(conn: OAuthConnection): string | undefined {
  const raw = conn.issuer ?? (conn.authorizeUrl ? new URL(conn.authorizeUrl).origin : undefined);
  return raw?.replace(/\/+$/, "");
}

/**
 * Check a redirect back from the provider: the state matches (constant time), `iss` names the
 * expected issuer when the server sent one (RFC 9207), and there is a code. Returns the code.
 */
export function checkRedirect(conn: OAuthConnection, params: URLSearchParams, state: string): string {
  const got = params.get("state") ?? "";
  if (!sameSecret(got, state)) throw new HaloError("The sign-in answer's state doesn't match the one Halo sent; nothing was stored", { code: "AUTH_STATE" });
  const iss = params.get("iss");
  if (iss !== null && iss.replace(/\/+$/, "") !== expectedIssuer(conn)) throw new HaloError(`The sign-in answer came from issuer ${iss}, not ${expectedIssuer(conn)}; nothing was stored`, { code: "AUTH_ISSUER" });
  const error = params.get("error");
  if (error) throw new HaloError(`Sign-in was refused: ${error}${params.get("error_description") ? ` (${params.get("error_description")!.slice(0, 200)})` : ""}`, { code: "AUTH_DENIED" });
  const code = params.get("code");
  if (!code) throw new HaloError("The sign-in answer has no code", { code: "AUTH_DENIED" });
  return code;
}

// ── Token endpoint requests ──

/** A token endpoint's answer: refused (with its error code), or tokens. Bodies are never quoted. */
class TokenEndpointError extends HaloError {
  constructor(readonly error: string, description: string | undefined, readonly status: number, label: string) {
    super(`${label}: the token endpoint answered ${status ? `${status} ` : ""}${error}${description ? ` (${description.slice(0, 200)})` : ""}`, { code: status >= 500 || status === 429 || status === 0 ? "HTTP_ERROR" : "AUTH_REFUSED", retryable: status >= 500 || status === 429 || status === 0 });
    this.name = "TokenEndpointError";
  }
}

async function postForm(conn: OAuthConnection, url: string, form: Record<string, string>, fetchImpl: typeof fetch, signal: AbortSignal | undefined, label: string): Promise<Record<string, unknown>> {
  const body = new URLSearchParams({ ...form, client_id: conn.clientId, ...(conn.clientSecret ? { client_secret: conn.clientSecret } : {}) });
  let res: Response;
  try {
    res = await fetchImpl(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, body: body.toString(), signal, redirect: "manual" });
  } catch (e) {
    if (signal?.aborted) throw e;
    throw new TokenEndpointError("unreachable", e instanceof Error ? e.message : String(e), 0, label);
  }
  const raw = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    // GitHub answers a form unless asked for JSON; some servers do anyway.
    data = Object.fromEntries(new URLSearchParams(raw));
  }
  // GitHub and Slack say no with a 200 and an `error` (Slack: ok: false).
  const err = typeof data.error === "string" ? data.error : data.ok === false ? "refused" : !res.ok ? `http_${res.status}` : undefined;
  if (err) throw new TokenEndpointError(err, typeof data.error_description === "string" ? data.error_description : undefined, res.ok ? 400 : res.status, label);
  return data;
}

function asTokens(data: Record<string, unknown>, label: string): TokenResponse {
  // Slack's v2 answer keeps a user token under authed_user when no bot token was asked for.
  const user = data.authed_user as Record<string, unknown> | undefined;
  const flat = typeof data.access_token !== "string" && user && typeof user.access_token === "string" ? { ...data, ...user } : data;
  if (typeof flat.access_token !== "string" || !flat.access_token) throw new HaloError(`${label}: the token endpoint returned no access token`, { code: "AUTH_REFUSED" });
  return flat as TokenResponse;
}

/** Read a JWT's claims (not its signature: the token came straight from the token endpoint over TLS). */
export function jwtClaims(jwt: string): Record<string, unknown> | undefined {
  const part = jwt.split(".")[1];
  if (!part) return undefined;
  try {
    return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
  } catch {
    return undefined;
  }
}

/** Who signed in, from the ID token (checked against this client and issuer) or the token answer. */
export function accountOf(conn: OAuthConnection, t: TokenResponse): string | undefined {
  if (typeof t.id_token === "string") {
    const c = jwtClaims(t.id_token);
    if (!c) throw new HaloError(`${conn.name}: the ID token can't be read; nothing was stored`, { code: "AUTH_REFUSED" });
    const aud = Array.isArray(c.aud) ? c.aud : [c.aud];
    if (!aud.includes(conn.clientId)) throw new HaloError(`${conn.name}: the ID token is for another client; nothing was stored`, { code: "AUTH_REFUSED" });
    if (conn.issuer && typeof c.iss === "string" && c.iss.replace(/\/+$/, "") !== conn.issuer.replace(/\/+$/, "")) throw new HaloError(`${conn.name}: the ID token comes from ${c.iss}, not ${conn.issuer}; nothing was stored`, { code: "AUTH_REFUSED" });
    for (const k of ["email", "preferred_username", "upn", "name", "sub"]) if (typeof c[k] === "string" && c[k]) return c[k] as string;
  }
  const team = t.team as { name?: unknown } | undefined;
  if (team && typeof team.name === "string") return team.name;
  return undefined;
}

const grantedScopes = (conn: OAuthConnection, t: TokenResponse) => (typeof t.scope === "string" && t.scope.trim() ? t.scope.split(/[\s,]+/).filter(Boolean) : conn.scopes);

// ── The broker ──

export interface BrokerOptions {
  store?: TokenStore;
  /** For the token endpoint (default: the caller's fetch, else the global one). */
  fetch?: typeof fetch;
  now?: () => number;
}

interface Cached {
  token: AccessToken;
  /** The record's refresh token when this was cached, to tell whether another process rotated it. */
  refresh?: string;
}

export class TokenBroker {
  private cache = new Map<string, Cached>();
  private refreshing = new Map<string, Promise<AccessToken>>();

  constructor(private readonly opts: BrokerOptions = {}) {}

  get store(): TokenStore {
    return this.opts.store ?? defaultTokenStore();
  }

  private now(): number {
    return this.opts.now?.() ?? Date.now();
  }

  private id(conn: OAuthConnection): string {
    const k = storeKeyOf(conn);
    return JSON.stringify([k.project, k.connection, k.tokenUrl, k.clientId, k.user]);
  }

  private fresh(t: AccessToken | undefined, minValidMs = SKEW_MS): t is AccessToken {
    return !!t && (t.expiresAt === undefined || t.expiresAt - this.now() > minValidMs);
  }

  /** Forget the cached access token (after logout, or in tests). */
  forget(conn?: OAuthConnection): void {
    if (conn) this.cache.delete(this.id(conn));
    else this.cache.clear();
  }

  /** What is stored for a connection, without its secrets and without unlocking anything. */
  info(conn: OAuthConnection): TokenInfo | undefined {
    return this.store.info(storeKeyOf(conn));
  }

  /**
   * A valid access token: cached, else from the store, else refreshed (or, for client credentials,
   * asked for). `rejected` is a token a server just refused with 401: a fresh one is fetched even if
   * it hasn't expired. Throws AuthRequired when there is nothing to refresh with, or the grant is gone.
   */
  async token(conn: OAuthConnection, opts: { fetch?: typeof fetch; signal?: AbortSignal; rejected?: string; minValidMs?: number } = {}): Promise<AccessToken> {
    const id = this.id(conn);
    const cached = this.cache.get(id);
    if (this.fresh(cached?.token, opts.minValidMs) && cached!.token.accessToken !== opts.rejected) return cached!.token;
    // One refresh per connection at a time in this process; the others wait for its result.
    const running = this.refreshing.get(id);
    if (running) {
      const t = await running;
      if (t.accessToken !== opts.rejected) return t;
    }
    const work = this.store.lock(storeKeyOf(conn), () => this.refreshLocked(conn, opts));
    this.refreshing.set(id, work);
    try {
      return await work;
    } finally {
      if (this.refreshing.get(id) === work) this.refreshing.delete(id);
    }
  }

  private async refreshLocked(conn: OAuthConnection, opts: { fetch?: typeof fetch; signal?: AbortSignal; rejected?: string; minValidMs?: number }): Promise<AccessToken> {
    const key = storeKeyOf(conn);
    const fetchImpl = this.opts.fetch ?? opts.fetch ?? fetch;
    // Read again inside the lock: another process may have refreshed (and rotated) already.
    const rec = await this.store.get(key);
    const stored: AccessToken | undefined = rec?.accessToken ? { accessToken: rec.accessToken, tokenType: "Bearer", expiresAt: rec.expiresAt } : undefined;
    if (this.fresh(stored, opts.minValidMs) && stored.accessToken !== opts.rejected && !rec?.needsLogin) {
      this.cache.set(this.id(conn), { token: stored, refresh: rec?.refreshToken });
      return stored;
    }
    const label = `${conn.name} sign-in`;
    if (conn.grant === "client_credentials") {
      const data = await postForm(conn, conn.tokenUrl, { grant_type: "client_credentials", ...(conn.scopes.length ? { scope: conn.scopes.join(" ") } : {}), ...(conn.resource ? { resource: conn.resource } : {}), ...(conn.audience ? { audience: conn.audience } : {}), ...(conn.tokenParams ?? {}) }, fetchImpl, opts.signal, label);
      const t = asTokens(data, label);
      return this.keep(conn, t, rec, undefined);
    }
    // The refresh token to spend: the one the store keeps (rotated since, or from a login), unless
    // the declaration gives one that isn't where that chain started (a person pasted a new one).
    const seed = conn.refreshToken ? sha(conn.refreshToken) : undefined;
    let refresh: string | undefined;
    if (rec?.refreshToken && !rec.needsLogin && (!seed || rec.seed === seed || rec.seed === undefined)) refresh = rec.refreshToken;
    else if (conn.refreshToken && !(rec?.needsLogin && rec.seed === seed)) refresh = conn.refreshToken;
    if (!refresh) {
      throw new AuthRequired(conn.name, rec?.needsLogin ? rec.needsLogin : rec ? "its token expired and there is no refresh token to renew it with" : "it isn't connected on this machine");
    }
    let data: Record<string, unknown>;
    try {
      data = await postForm(conn, conn.tokenUrl, { grant_type: "refresh_token", refresh_token: refresh, ...(conn.scopes.length && conn.provider !== "slack" && conn.provider !== "github" ? { scope: conn.scopes.join(" ") } : {}), ...(conn.tokenParams ?? {}) }, fetchImpl, opts.signal, label);
    } catch (e) {
      if (e instanceof TokenEndpointError && (e.error === "invalid_grant" || e.error === "invalid_token" || e.error === "token_revoked")) {
        const why = "the server no longer accepts its refresh token (revoked or expired)";
        // Keep who and what, drop the dead tokens, and remember it needs a person.
        const base: TokenRecord = rec ?? { ...key, user: key.user ?? "local", grant: conn.grant, connectedAt: new Date().toISOString() } as TokenRecord;
        const { accessToken: _a, refreshToken: _r, ...rest } = base;
        await this.store.put(key, { ...rest, needsLogin: why, expiresAt: undefined, ...(seed ? { seed } : {}) });
        this.cache.delete(this.id(conn));
        throw new AuthRequired(conn.name, why);
      }
      throw e;
    }
    const t = asTokens(data, label);
    return this.keep(conn, t, rec, refresh, seed);
  }

  /** Store a token answer (its rotated refresh token first), then cache and return the access token. */
  private async keep(conn: OAuthConnection, t: TokenResponse, rec: TokenRecord | undefined, spent: string | undefined, seed?: string): Promise<AccessToken> {
    const key = storeKeyOf(conn);
    const token: AccessToken = { accessToken: t.access_token, tokenType: bearer(t.token_type), ...(Number(t.expires_in) > 0 ? { expiresAt: this.now() + Number(t.expires_in) * 1000 } : {}) };
    const refresh = typeof t.refresh_token === "string" && t.refresh_token ? t.refresh_token : spent;
    const record: TokenRecord = {
      ...(rec ?? {}),
      ...key,
      user: key.user ?? "local",
      project: key.project,
      grant: conn.grant,
      ...(conn.provider ? { provider: conn.provider } : {}),
      scopes: typeof t.scope === "string" && t.scope.trim() ? grantedScopes(conn, t) : (rec?.scopes ?? conn.scopes),
      connectedAt: rec?.connectedAt ?? new Date().toISOString(),
      accessToken: token.accessToken,
      expiresAt: token.expiresAt,
      ...(refresh ? { refreshToken: refresh } : {}),
      ...(seed !== undefined ? { seed } : rec?.seed !== undefined ? { seed: rec.seed } : {}),
      ...(conn.revokeUrl ? { revokeUrl: conn.revokeUrl } : {}),
    };
    delete record.needsLogin;
    if (!record.refreshToken) delete record.refreshToken;
    try {
      await this.store.put(key, record);
    } catch (e) {
      if (refresh && refresh !== spent) {
        throw new HaloError(`${conn.name}: the server sent a new refresh token (the old one no longer works) and it couldn't be stored (${e instanceof Error ? e.message : e}); sign in again with halo auth login ${conn.name}`, { code: "AUTH_STORE" });
      }
      throw e;
    }
    this.cache.set(this.id(conn), { token, refresh });
    return token;
  }

  /**
   * Store what a sign-in returned (an authorization code or device grant). Returns who signed in
   * and which scopes were granted.
   */
  async connect(conn: OAuthConnection, t: TokenResponse): Promise<{ account?: string; scopes: string[]; expiresAt?: number }> {
    const account = accountOf(conn, t);
    const key = storeKeyOf(conn);
    return this.store.lock(key, async () => {
      const token = await this.keep(conn, t, { ...key, user: key.user ?? "local", grant: conn.grant, connectedAt: new Date().toISOString(), ...(account ? { account } : {}) } as TokenRecord, undefined);
      return { ...(account ? { account } : {}), scopes: grantedScopes(conn, t), ...(token.expiresAt ? { expiresAt: token.expiresAt } : {}) };
    });
  }

  /** Exchange an authorization code (with its PKCE verifier) and store the tokens. */
  async exchangeCode(conn: OAuthConnection, code: string, verifier: string, redirectUri: string, opts: { fetch?: typeof fetch; signal?: AbortSignal } = {}) {
    const data = await postForm(conn, conn.tokenUrl, { grant_type: "authorization_code", code, code_verifier: verifier, redirect_uri: redirectUri, ...(conn.resource ? { resource: conn.resource } : {}) }, this.opts.fetch ?? opts.fetch ?? fetch, opts.signal, `${conn.name} sign-in`);
    return this.connect(conn, asTokens(data, `${conn.name} sign-in`));
  }

  /** Revoke at the provider (when it has a revoke URL) and delete what is stored. */
  async logout(conn: OAuthConnection, opts: { fetch?: typeof fetch; revoke?: boolean } = {}): Promise<{ deleted: boolean; revoked: boolean }> {
    const key = storeKeyOf(conn);
    return this.store.lock(key, async () => {
      const rec = await this.store.get(key);
      let revoked = false;
      const url = rec?.revokeUrl ?? conn.revokeUrl;
      const token = rec?.refreshToken ?? rec?.accessToken;
      if (opts.revoke !== false && url && token) {
        try {
          await postForm(conn, url, { token, token_type_hint: rec?.refreshToken ? "refresh_token" : "access_token" }, this.opts.fetch ?? opts.fetch ?? fetch, AbortSignal.timeout(15_000), `${conn.name} revoke`);
          revoked = true;
        } catch {
          // Deleting it here still stops this machine using it.
        }
      }
      const deleted = await this.store.delete(key);
      this.cache.delete(this.id(conn));
      return { deleted, revoked };
    });
  }

  /**
   * A request with the connection's token, to one of `origins` only. Redirects are followed by
   * hand: with the token to the same origins, without it anywhere else. A 401 gets a fresh token
   * and one more try; a second 401 is AUTH_REQUIRED (for a person's connection) or the response.
   */
  async fetch(conn: OAuthConnection, url: string | URL, init: RequestInit, opts: { origins: string[]; fetch?: typeof fetch; signal?: AbortSignal; onSecret?: (name: string, value: string) => void }): Promise<Response> {
    const target = new URL(String(url));
    if (!opts.origins.includes(target.origin)) {
      throw new HaloError(`${conn.name}'s token is only sent to ${opts.origins.join(", ")}, not ${target.origin}`, { code: "AUTH_ORIGIN" });
    }
    const fetchImpl = opts.fetch ?? fetch;
    const reveal = (t: AccessToken) => {
      opts.onSecret?.(`${conn.name} access token`, t.accessToken);
      return t;
    };
    let token = reveal(await this.token(conn, { fetch: fetchImpl, signal: opts.signal ?? init.signal ?? undefined }));
    this.revealRefresh(conn, opts.onSecret);
    let res = await this.send(target, init, token, opts.origins, fetchImpl);
    if (res.status !== 401) return res;
    await res.body?.cancel().catch(() => {});
    token = reveal(await this.token(conn, { fetch: fetchImpl, signal: opts.signal ?? init.signal ?? undefined, rejected: token.accessToken }));
    this.revealRefresh(conn, opts.onSecret);
    res = await this.send(target, init, token, opts.origins, fetchImpl);
    if (res.status === 401 && conn.grant !== "client_credentials") {
      await res.body?.cancel().catch(() => {});
      this.cache.delete(this.id(conn));
      throw new AuthRequired(conn.name, `${target.origin} refused its token twice`);
    }
    return res;
  }

  private revealRefresh(conn: OAuthConnection, onSecret?: (name: string, value: string) => void) {
    const r = this.cache.get(this.id(conn))?.refresh;
    if (r && onSecret) onSecret(`${conn.name} refresh token`, r);
  }

  private async send(url: URL, init: RequestInit, token: AccessToken, origins: string[], fetchImpl: typeof fetch): Promise<Response> {
    let current = url;
    let method = (init.method ?? "GET").toUpperCase();
    let body = init.body;
    for (let hop = 0; ; hop++) {
      const headers = new Headers(init.headers);
      headers.delete("authorization");
      if (origins.includes(current.origin)) headers.set("Authorization", `${token.tokenType} ${token.accessToken}`);
      const res = await fetchImpl(current, { ...init, method, body, headers, redirect: "manual" });
      const location = res.headers.get("location");
      if (res.status < 300 || res.status >= 400 || !location || hop >= 5) return res;
      await res.body?.cancel().catch(() => {});
      current = new URL(location, current);
      if (current.protocol !== "https:" && current.protocol !== "http:") return res;
      if (res.status === 303 || ((res.status === 301 || res.status === 302) && method === "POST")) {
        method = "GET";
        body = undefined;
      }
    }
  }
}

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const bearer = (t: unknown) => (typeof t === "string" && t.toLowerCase() !== "bearer" && /^[A-Za-z][\w-]*$/.test(t) ? t : "Bearer");

// ── Device flow (RFC 8628) ──

export interface DeviceStart {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete?: string;
  interval: number;
  expiresAt: number;
}

export async function startDevice(conn: OAuthConnection, opts: { fetch?: typeof fetch; signal?: AbortSignal } = {}): Promise<DeviceStart> {
  if (!conn.deviceUrl) throw new HaloError(`${conn.name} has no deviceUrl, so it can't sign in with a code`, { code: "TOOL_CONFIG" });
  const d = await postForm(conn, conn.deviceUrl, { ...(conn.scopes.length ? { scope: conn.scopes.join(" ") } : {}), ...(conn.resource ? { resource: conn.resource } : {}) }, opts.fetch ?? fetch, opts.signal, `${conn.name} device sign-in`);
  const s = (k: string) => (typeof d[k] === "string" ? (d[k] as string) : undefined);
  const deviceCode = s("device_code");
  const userCode = s("user_code");
  const verificationUri = s("verification_uri") ?? s("verification_url");
  if (!deviceCode || !userCode || !verificationUri) throw new HaloError(`${conn.name}: the device endpoint's answer is missing device_code, user_code or verification_uri`, { code: "AUTH_REFUSED" });
  return { deviceCode, userCode, verificationUri, ...(s("verification_uri_complete") ? { verificationUriComplete: s("verification_uri_complete") } : {}), interval: Math.max(1, Number(d.interval) || 5), expiresAt: Date.now() + (Number(d.expires_in) || 900) * 1000 };
}

/** Poll until the person approves (or the code expires), backing off on slow_down. Stores the tokens. */
export async function pollDevice(broker: TokenBroker, conn: OAuthConnection, start: DeviceStart, opts: { fetch?: typeof fetch; signal?: AbortSignal; sleep?: (ms: number) => Promise<void> } = {}) {
  const sleep = opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  let interval = start.interval * 1000;
  const label = `${conn.name} device sign-in`;
  for (;;) {
    if (opts.signal?.aborted) throw opts.signal.reason;
    if (Date.now() > start.expiresAt) throw new HaloError(`${label}: the code expired before it was approved`, { code: "AUTH_DENIED" });
    await sleep(interval);
    try {
      const data = await postForm(conn, conn.tokenUrl, { grant_type: "urn:ietf:params:oauth:grant-type:device_code", device_code: start.deviceCode }, opts.fetch ?? fetch, opts.signal, label);
      return broker.connect(conn, asTokens(data, label));
    } catch (e) {
      if (!(e instanceof TokenEndpointError)) throw e;
      if (e.error === "authorization_pending") continue;
      if (e.error === "slow_down") {
        interval += 5000;
        continue;
      }
      throw e;
    }
  }
}

// ── For tool providers ──

let shared: TokenBroker | undefined;

/** The broker every runtime in this process shares, so a refresh in one is seen by the others. */
export function defaultBroker(): TokenBroker {
  return (shared ??= new TokenBroker());
}

/** What the runtime gives providers for `auth:`. Never a token. */
export interface ToolAuth {
  broker: TokenBroker;
  /** The connection a tool's `auth:` names, resolved; undefined when it has none. Throws for one that isn't an OAuth declaration. */
  connection(tool: ToolDeclaration): OAuthConnection | undefined;
  /** The folder its tokens are kept for. */
  project: string;
  /** Hand a token value to the run's secret masking. */
  secret(name: string, value: string): void;
}

/**
 * A fetch that signs requests with the tool's OAuth connection, for `origins` only; undefined when
 * the tool has no `auth:` (then the provider uses its own key). `conn` gives the connection
 * directly (mail's settings), instead of the tool's `auth:`.
 */
export function authFetch(call: Pick<ToolCall, "tool" | "signal">, services: Pick<ToolServices, "fetch" | "oauth">, origins: string | string[], conn?: OAuthConnection): ((url: string | URL, init?: RequestInit) => Promise<Response>) | undefined {
  const auth = services.oauth;
  const connection = conn ?? auth?.connection(call.tool);
  if (!connection) return undefined;
  const broker = auth?.broker ?? defaultBroker();
  const list = (Array.isArray(origins) ? origins : [origins]).map((o) => new URL(o).origin);
  return (url, init = {}) => broker.fetch(connection, url, { ...init, signal: init.signal ?? call.signal }, { origins: list, fetch: services.fetch, signal: call.signal, onSecret: auth?.secret });
}
