/** Scopes: creating org scopes, members, and DNS-verified domains. */

import { RESERVED_SCOPES, type ScopeDoc, type ScopeRole } from "../../../src/registry/contract.ts";
import { getScope, isScopeName, requireRole, requireWrite, type Caller } from "./auth.ts";
import type { Env } from "./env.ts";
import { fail, json, now, randomToken, readJson } from "./http.ts";
import { purgePackage } from "./packages.ts";

export const DEFAULT_DOH_URL = "https://cloudflare-dns.com/dns-query";
const DOMAIN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

export async function scopeDoc(env: Env, scope: string): Promise<ScopeDoc | undefined> {
  const row = await getScope(env, scope);
  if (!row) return undefined;
  const [members, packages] = await Promise.all([
    env.DB.prepare(`SELECT u.login, m.role FROM scope_members m JOIN users u ON u.id = m.user_id WHERE m.scope_id = ? ORDER BY m.role, u.login`)
      .bind(row.id)
      .all<{ login: string; role: ScopeRole }>(),
    env.DB.prepare(`SELECT name FROM packages WHERE scope_id = ? ORDER BY name`).bind(row.id).all<{ name: string }>(),
  ]);
  return {
    scope: row.name,
    kind: row.kind,
    ...(row.verified_domain ? { verified: row.verified_domain } : {}),
    members: members.results,
    packages: packages.results.map((p) => p.name),
  };
}

export async function getScopeDoc(env: Env, scope: string): Promise<Response> {
  const doc = await scopeDoc(env, scope);
  if (!doc) return fail(404, "scope_not_found", `Scope ${scope} does not exist`);
  return json(doc);
}

export async function createScope(req: Request, caller: Caller, env: Env): Promise<Response> {
  requireWrite(caller);
  const { scope } = await readJson(req);
  if (typeof scope !== "string" || !isScopeName(scope)) return fail(400, "invalid_scope", `scope must look like "@acme": lowercase letters, digits, -, . and _`);
  if (RESERVED_SCOPES.includes(scope)) return fail(403, "reserved_scope", `${scope} is reserved; it's released to its verified owner on request`);
  if (await getScope(env, scope)) return fail(409, "scope_exists", `${scope} is already taken`);
  try {
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO scopes (name, kind, created_at) VALUES (?, 'org', ?)`).bind(scope, now()),
      env.DB.prepare(`INSERT INTO scope_members (scope_id, user_id, role) SELECT id, ?, 'owner' FROM scopes WHERE name = ?`).bind(caller.userId, scope),
    ]);
  } catch (e) {
    if (/UNIQUE/i.test(String(e))) return fail(409, "scope_exists", `${scope} is already taken`);
    throw e;
  }
  return json(await scopeDoc(env, scope), 201);
}

export async function putMember(req: Request, scope: string, login: string, caller: Caller, env: Env): Promise<Response> {
  const row = await requireRole(env, caller, scope, "owner");
  const { role } = await readJson(req);
  if (role !== "owner" && role !== "publisher") return fail(400, "bad_request", "role must be owner or publisher");
  const user = await env.DB.prepare(`SELECT id FROM users WHERE login = ?`).bind(login.toLowerCase()).first<{ id: number }>();
  if (!user) return fail(404, "user_not_found", `No user @${login}; they need to run \`halo login\` once first`);
  if (role === "publisher") await ensureAnotherOwner(env, row.id, user.id, scope);
  await env.DB.prepare(`INSERT INTO scope_members (scope_id, user_id, role) VALUES (?, ?, ?) ON CONFLICT(scope_id, user_id) DO UPDATE SET role = excluded.role`)
    .bind(row.id, user.id, role)
    .run();
  return json(await scopeDoc(env, scope));
}

export async function deleteMember(scope: string, login: string, caller: Caller, env: Env): Promise<Response> {
  const row = await requireRole(env, caller, scope, "owner");
  const user = await env.DB.prepare(`SELECT id FROM users WHERE login = ?`).bind(login.toLowerCase()).first<{ id: number }>();
  if (!user) return fail(404, "user_not_found", `No user @${login}`);
  await ensureAnotherOwner(env, row.id, user.id, scope);
  const res = await env.DB.prepare(`DELETE FROM scope_members WHERE scope_id = ? AND user_id = ?`).bind(row.id, user.id).run();
  if (!res.meta.changes) return fail(404, "not_a_member", `@${login} is not a member of ${scope}`);
  return json(await scopeDoc(env, scope));
}

/** Fails if `userId` is the scope's only owner (so removing or demoting them would orphan it). */
async function ensureAnotherOwner(env: Env, scopeId: number, userId: number, scope: string): Promise<void> {
  const others = await env.DB.prepare(`SELECT COUNT(*) AS n FROM scope_members WHERE scope_id = ? AND role = 'owner' AND user_id != ?`)
    .bind(scopeId, userId)
    .first<{ n: number }>();
  const isOwner = await env.DB.prepare(`SELECT 1 AS y FROM scope_members WHERE scope_id = ? AND user_id = ? AND role = 'owner'`).bind(scopeId, userId).first();
  if (isOwner && !others?.n) fail(409, "last_owner", `${scope} must keep at least one owner; add another owner first`);
}

/**
 * The first call for a domain returns the TXT record to add. Later calls look it up through
 * DNS over HTTPS and, when it's there, mark the scope verified.
 */
export async function verifyScope(req: Request, scope: string, caller: Caller, env: Env): Promise<Response> {
  const row = await requireRole(env, caller, scope, "owner");
  const { domain: raw } = await readJson(req);
  const domain = typeof raw === "string" ? raw.trim().toLowerCase().replace(/\.$/, "") : "";
  if (!DOMAIN.test(domain)) return fail(400, "invalid_domain", "domain must be a domain name like acme.com");
  const record = `_halo.${domain}`;

  let pending = await env.DB.prepare(`SELECT value FROM scope_verifications WHERE scope_id = ? AND domain = ?`).bind(row.id, domain).first<{ value: string }>();
  if (!pending) {
    const value = `halo-verify=${randomToken(18)}`;
    await env.DB.prepare(`INSERT INTO scope_verifications (scope_id, domain, value, created_at) VALUES (?, ?, ?, ?)`).bind(row.id, domain, value, now()).run();
    return json({ record, value, verified: false });
  }
  const verified = await txtContains(env, record, pending.value);
  if (verified) {
    await env.DB.prepare(`UPDATE scopes SET verified_domain = ?, verified_at = ? WHERE id = ?`).bind(domain, now(), row.id).run();
    // The badge shows on every package page and doc in the scope.
    const { results } = await env.DB.prepare(`SELECT name FROM packages WHERE scope_id = ?`).bind(row.id).all<{ name: string }>();
    await Promise.all(results.map((p) => purgePackage(env, p.name)));
  }
  return json({ record, value: pending.value, verified });
}

async function txtContains(env: Env, name: string, value: string): Promise<boolean> {
  const url = `${env.DOH_URL || DEFAULT_DOH_URL}?name=${encodeURIComponent(name)}&type=TXT`;
  const res = await fetch(url, { headers: { accept: "application/dns-json" } });
  if (!res.ok) return fail(502, "dns_error", `DNS lookup for ${name} failed (${res.status})`);
  const data = (await res.json().catch(() => ({}))) as { Answer?: { type?: number; data?: string }[] };
  // TXT data comes quoted, possibly split into several quoted strings.
  return (data.Answer ?? []).some((a) => (a.type === undefined || a.type === 16) && typeof a.data === "string" && a.data.replace(/"\s*"/g, "").replace(/^"|"$/g, "").trim() === value);
}
