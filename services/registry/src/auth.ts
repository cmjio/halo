/**
 * Accounts and tokens: GitHub's OAuth device flow (proxied, so the CLI only talks to the
 * registry), `halo_…` API tokens (only their sha256 is stored), and the checks every write
 * makes.
 */

import { RESERVED_SCOPES, type CreatedToken, type DeviceStart, type ScopeRole, type TokenInfo, type TokenList, type TokenResponse, type WhoAmI } from "../../../src/registry/contract.ts";
import type { Env } from "./env.ts";
import { clientIp, fail, json, now, randomToken, rateLimit, readJson, sha256Hex } from "./http.ts";

export const TOKEN_PREFIX = "halo_";
const SCOPE_NAME = /^@[a-z0-9][a-z0-9._-]{0,99}$/;

export function isScopeName(text: string): boolean {
  return SCOPE_NAME.test(text) && !text.endsWith(".");
}

export interface Caller {
  userId: number;
  login: string;
  tokenId: string;
  tokenName: string;
  readOnly: boolean;
  /** The scopes the token is limited to, or undefined for all of the user's scopes. */
  scopes?: string[];
}

interface TokenRow {
  id: string;
  name: string;
  read_only: number;
  scopes: string | null;
  user_id: number;
  login: string;
}

/** The caller, from `Authorization: Bearer halo_…`. Fails 401 when it's missing or unknown. */
export async function authenticate(req: Request, env: Env): Promise<Caller> {
  const header = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(\S+)$/i.exec(header);
  if (!m) return fail(401, "unauthorized", "Sign in first: run `halo login` (or send Authorization: Bearer <token>)");
  const hash = await sha256Hex(m[1]!);
  const row = await env.DB.prepare(
    `SELECT t.id, t.name, t.read_only, t.scopes, t.user_id, u.login FROM tokens t JOIN users u ON u.id = t.user_id WHERE t.token_hash = ?`,
  )
    .bind(hash)
    .first<TokenRow>();
  if (!row) return fail(401, "unauthorized", "That token is not valid (it may have been revoked); run `halo login`");
  return {
    userId: row.user_id,
    login: row.login,
    tokenId: row.id,
    tokenName: row.name,
    readOnly: !!row.read_only,
    scopes: row.scopes ? (JSON.parse(row.scopes) as string[]) : undefined,
  };
}

/**
 * Fails unless the token has the account's full reach: not read-only and not limited to some
 * scopes. Managing the account itself (making tokens, revoking other tokens, creating scopes)
 * needs one, so a token handed to CI for one scope can't mint, revoke or claim anything else.
 */
export function requireFullToken(caller: Caller, action: string): void {
  if (caller.readOnly) fail(403, "read_only_token", `This token is read-only; ${action} needs a full token (run \`halo login\`)`);
  if (caller.scopes) fail(403, "token_scope", `This token is limited to ${caller.scopes.join(", ")}; ${action} needs a token for the whole account (run \`halo login\`)`);
}

/** Fails unless the token may write to `scope` (not read-only, and not limited to other scopes). */
export function requireWrite(caller: Caller, scope?: string): void {
  if (caller.readOnly) fail(403, "read_only_token", "This token is read-only");
  if (scope && caller.scopes && !caller.scopes.includes(scope)) fail(403, "token_scope", `This token is limited to ${caller.scopes.join(", ")}; it can't act on ${scope}`);
}

export interface ScopeRow {
  id: number;
  name: string;
  kind: "user" | "org";
  verified_domain: string | null;
  verified_at: string | null;
}

export async function getScope(env: Env, scope: string): Promise<ScopeRow | null> {
  return env.DB.prepare(`SELECT id, name, kind, verified_domain, verified_at FROM scopes WHERE name = ?`).bind(scope).first<ScopeRow>();
}

export async function roleIn(env: Env, scopeId: number, userId: number): Promise<ScopeRole | undefined> {
  const r = await env.DB.prepare(`SELECT role FROM scope_members WHERE scope_id = ? AND user_id = ?`).bind(scopeId, userId).first<{ role: ScopeRole }>();
  return r?.role;
}

/**
 * Fails unless the caller may act on `scope` with at least `need` (publisher < owner), and the
 * token allows writes there. Returns the scope.
 */
export async function requireRole(env: Env, caller: Caller, scope: string, need: ScopeRole): Promise<ScopeRow> {
  requireWrite(caller, scope);
  const row = await getScope(env, scope);
  if (!row) return fail(404, "scope_not_found", `Scope ${scope} does not exist; create it with POST v1/scopes`);
  const role = await roleIn(env, row.id, caller.userId);
  if (!role) return fail(403, "forbidden", `@${caller.login} is not a member of ${scope}`);
  if (need === "owner" && role !== "owner") return fail(403, "forbidden", `Only owners of ${scope} can do that; @${caller.login} is a publisher`);
  return row;
}

// ── Device flow ──

interface GitHubDeviceCode {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

function clientId(env: Env): string {
  if (!env.GITHUB_CLIENT_ID) return fail(503, "not_configured", "Sign-in is not configured on this registry (GITHUB_CLIENT_ID is not set)");
  return env.GITHUB_CLIENT_ID;
}

export async function startDevice(req: Request, env: Env): Promise<Response> {
  await rateLimit(env, "login", clientIp(req));
  const res = await fetch(`${env.GITHUB_URL}/login/device/code`, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json", "user-agent": "halo-registry" },
    body: JSON.stringify({ client_id: clientId(env), scope: "" }),
  });
  const data = (await res.json().catch(() => ({}))) as Partial<GitHubDeviceCode> & { error?: string };
  if (!res.ok || !data.device_code || !data.user_code) return fail(502, "github_error", `GitHub did not start a sign-in (${data.error ?? res.status})`);
  const expiresIn = Number(data.expires_in ?? 900);
  const interval = Number(data.interval ?? 5);
  await env.DB.prepare(`INSERT OR REPLACE INTO device_codes (id, user_code, interval, expires_at, created_at) VALUES (?, ?, ?, ?, ?)`)
    .bind(await sha256Hex(data.device_code), data.user_code, interval, new Date(Date.now() + expiresIn * 1000).toISOString(), now())
    .run();
  // Old, abandoned logins.
  await env.DB.prepare(`DELETE FROM device_codes WHERE expires_at < ?`).bind(new Date(Date.now() - 3600_000).toISOString()).run();
  const body: DeviceStart = {
    device_code: data.device_code,
    user_code: data.user_code,
    verification_uri: data.verification_uri ?? `${env.GITHUB_URL}/login/device`,
    interval,
    expires_in: expiresIn,
  };
  return json(body);
}

export async function pollDevice(req: Request, env: Env): Promise<Response> {
  const { device_code } = await readJson(req);
  if (typeof device_code !== "string" || !device_code) return fail(400, "bad_request", "device_code is required");
  const id = await sha256Hex(device_code);
  const pending = await env.DB.prepare(`SELECT expires_at, interval FROM device_codes WHERE id = ?`).bind(id).first<{ expires_at: string; interval: number }>();
  if (!pending) return fail(410, "expired_token", "This sign-in is unknown or finished; run `halo login` again");
  if (pending.expires_at < now()) {
    await env.DB.prepare(`DELETE FROM device_codes WHERE id = ?`).bind(id).run();
    return fail(410, "expired_token", "This sign-in expired; run `halo login` again");
  }

  const res = await fetch(`${env.GITHUB_URL}/login/oauth/access_token`, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json", "user-agent": "halo-registry" },
    body: JSON.stringify({
      client_id: clientId(env),
      ...(env.GITHUB_CLIENT_SECRET ? { client_secret: env.GITHUB_CLIENT_SECRET } : {}),
      device_code,
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; error?: string; error_description?: string; interval?: number };
  if (data.error === "authorization_pending") return fail(428, "authorization_pending", "Waiting for you to approve the sign-in on GitHub");
  if (data.error === "slow_down") {
    const interval = Number(data.interval ?? pending.interval + 5);
    await env.DB.prepare(`UPDATE device_codes SET interval = ? WHERE id = ?`).bind(interval, id).run();
    return fail(429, "slow_down", `Polling too fast; wait ${interval}s between polls`, undefined, { "retry-after": String(interval) });
  }
  if (data.error === "expired_token" || data.error === "token_expired") {
    await env.DB.prepare(`DELETE FROM device_codes WHERE id = ?`).bind(id).run();
    return fail(410, "expired_token", "This sign-in expired; run `halo login` again");
  }
  if (data.error === "access_denied") {
    await env.DB.prepare(`DELETE FROM device_codes WHERE id = ?`).bind(id).run();
    return fail(403, "access_denied", "The sign-in was cancelled on GitHub");
  }
  if (!res.ok || !data.access_token) return fail(502, "github_error", `GitHub refused the sign-in: ${data.error_description ?? data.error ?? res.status}`);

  // Only used here to learn who signed in; never stored.
  const userRes = await fetch(`${env.GITHUB_API_URL}/user`, {
    headers: { authorization: `Bearer ${data.access_token}`, accept: "application/vnd.github+json", "user-agent": "halo-registry" },
  });
  const gh = (await userRes.json().catch(() => ({}))) as { id?: number; login?: string; name?: string | null };
  if (!userRes.ok || typeof gh.id !== "number" || typeof gh.login !== "string") return fail(502, "github_error", "Could not read your GitHub profile");
  await env.DB.prepare(`DELETE FROM device_codes WHERE id = ?`).bind(id).run();

  const login = gh.login.toLowerCase();
  const user = await upsertUser(env, gh.id, login, gh.name ?? null);
  const token = await mintToken(env, user, { name: "halo login" });
  const body: TokenResponse = { token: token.secret, login };
  return json(body);
}

async function upsertUser(env: Env, githubId: number, login: string, name: string | null): Promise<number> {
  const at = now();
  // A user is their GitHub id; the login is only a label that follows GitHub's. If another row
  // still holds this login (its owner renamed on GitHub and hasn't signed in since), that row
  // gives the login up: it becomes `<login>~<github id>` (never a valid GitHub login) until its
  // owner signs in again and gets their new one. Scopes and packages stay with the ids.
  await env.DB.batch([
    env.DB.prepare(`UPDATE users SET login = login || '~' || github_id WHERE login = ? AND github_id != ?`).bind(login, githubId),
    env.DB.prepare(
      `INSERT INTO users (github_id, login, name, created_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(github_id) DO UPDATE SET login = excluded.login, name = excluded.name`,
    ).bind(githubId, login, name, at),
  ]);
  const user = await env.DB.prepare(`SELECT id FROM users WHERE github_id = ?`).bind(githubId).first<{ id: number }>();
  const userId = user!.id;
  // Their own scope, @<login>, unless it's reserved or someone already has it.
  const scope = `@${login}`;
  if (isScopeName(scope) && !RESERVED_SCOPES.includes(scope) && !(await getScope(env, scope))) {
    await env.DB.batch([
      env.DB.prepare(`INSERT OR IGNORE INTO scopes (name, kind, created_at) VALUES (?, 'user', ?)`).bind(scope, at),
      env.DB.prepare(`INSERT OR IGNORE INTO scope_members (scope_id, user_id, role) SELECT id, ?, 'owner' FROM scopes WHERE name = ? AND kind = 'user'`).bind(userId, scope),
    ]);
  }
  return userId;
}

async function mintToken(env: Env, userId: number, opts: { name: string; readOnly?: boolean; scopes?: string[] }) {
  const secret = TOKEN_PREFIX + randomToken(32);
  const id = randomToken(9);
  const createdAt = now();
  await env.DB.prepare(`INSERT INTO tokens (id, user_id, name, token_hash, read_only, scopes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, userId, opts.name, await sha256Hex(secret), opts.readOnly ? 1 : 0, opts.scopes ? JSON.stringify(opts.scopes) : null, createdAt)
    .run();
  return { id, secret, createdAt };
}

// ── whoami and tokens ──

export async function whoami(caller: Caller, env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(`SELECT s.name AS scope, m.role FROM scope_members m JOIN scopes s ON s.id = m.scope_id WHERE m.user_id = ? ORDER BY s.name`)
    .bind(caller.userId)
    .all<{ scope: string; role: ScopeRole }>();
  const body: WhoAmI = {
    login: caller.login,
    scopes: results,
    token: { id: caller.tokenId, name: caller.tokenName, readOnly: caller.readOnly, ...(caller.scopes ? { scopes: caller.scopes } : {}) },
  };
  return json(body);
}

export async function listTokens(caller: Caller, env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(`SELECT id, name, read_only, scopes, created_at, last_used_at FROM tokens WHERE user_id = ? ORDER BY created_at`)
    .bind(caller.userId)
    .all<{ id: string; name: string; read_only: number; scopes: string | null; created_at: string; last_used_at: string | null }>();
  const tokens: TokenInfo[] = results.map((t) => ({
    id: t.id,
    name: t.name,
    readOnly: !!t.read_only,
    ...(t.scopes ? { scopes: JSON.parse(t.scopes) as string[] } : {}),
    createdAt: t.created_at,
    ...(t.last_used_at ? { lastUsedAt: t.last_used_at } : {}),
    ...(t.id === caller.tokenId ? { current: true } : {}),
  }));
  const body: TokenList = { tokens };
  return json(body);
}

export async function createToken(req: Request, caller: Caller, env: Env): Promise<Response> {
  // Only a full token makes tokens, so no token can mint one with more reach than itself.
  requireFullToken(caller, "creating tokens");
  await rateLimit(env, "token", String(caller.userId));
  const body = await readJson(req);
  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim().slice(0, 100) : "token";
  if (body.readOnly !== undefined && typeof body.readOnly !== "boolean") fail(400, "bad_request", "readOnly must be true or false");
  let scopes: string[] | undefined;
  if (body.scopes !== undefined && body.scopes !== null) {
    if (!Array.isArray(body.scopes) || !body.scopes.length || body.scopes.some((s) => typeof s !== "string" || !isScopeName(s)))
      return fail(400, "bad_request", 'scopes must be a non-empty list of scope names like "@acme"');
    scopes = [...new Set(body.scopes as string[])];
  }
  const readOnly = body.readOnly === true;
  const t = await mintToken(env, caller.userId, { name, readOnly, scopes });
  const created: CreatedToken = { id: t.id, name, token: t.secret, readOnly, ...(scopes ? { scopes } : {}), createdAt: t.createdAt };
  return json(created, 201);
}

export async function deleteToken(id: string, caller: Caller, env: Env): Promise<Response> {
  // Any token may revoke itself (logging out); revoking another one needs a full token.
  if (id !== caller.tokenId) requireFullToken(caller, "revoking other tokens");
  const res = await env.DB.prepare(`DELETE FROM tokens WHERE id = ? AND user_id = ?`).bind(id, caller.userId).run();
  if (!res.meta.changes) return fail(404, "not_found", `No token ${id}`);
  return json({ deleted: id });
}
