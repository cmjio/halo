/** Scopes: creating org scopes, members, and DNS-verified domains. */

import { RESERVED_SCOPES, type ScopeDoc, type ScopeRole, type VerifyResponse } from "../../../src/registry/contract.ts";
import { getScope, isScopeName, requireFullToken, requireRole, type Caller, type ScopeRow } from "./auth.ts";
import type { Ctx, Env } from "./env.ts";
import { fail, HttpError, json, now, randomToken, readJson } from "./http.ts";
import { purgePackage } from "./packages.ts";

export const DEFAULT_DOH_URL = "https://cloudflare-dns.com/dns-query";
const DOMAIN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

export async function scopeDoc(env: Env, scope: string, ctx?: Ctx): Promise<ScopeDoc | undefined> {
  const row = await getScope(env, scope);
  if (!row) return undefined;
  if (ctx) recheckDomainLater(env, ctx, row);
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

export async function getScopeDoc(env: Env, scope: string, ctx?: Ctx): Promise<Response> {
  const doc = await scopeDoc(env, scope, ctx);
  if (!doc) return fail(404, "scope_not_found", `Scope ${scope} does not exist`);
  return json(doc);
}

export async function createScope(req: Request, caller: Caller, env: Env): Promise<Response> {
  requireFullToken(caller, "creating scopes");
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

/**
 * True when the target row isn't an owner, or the scope has another owner. Part of the write's
 * own WHERE, so the check and the change are one statement: two concurrent demotions or
 * removals can't both pass a check made earlier and leave the scope with no owner. Binds the
 * scope id once.
 */
const KEEPS_AN_OWNER = `(scope_members.role != 'owner' OR (SELECT COUNT(*) FROM scope_members o WHERE o.scope_id = ? AND o.role = 'owner') > 1)`;

export async function putMember(req: Request, scope: string, login: string, caller: Caller, env: Env): Promise<Response> {
  const row = await requireRole(env, caller, scope, "owner");
  const { role } = await readJson(req);
  if (role !== "owner" && role !== "publisher") return fail(400, "bad_request", "role must be owner or publisher");
  const user = await env.DB.prepare(`SELECT id FROM users WHERE login = ?`).bind(login.toLowerCase()).first<{ id: number }>();
  if (!user) return fail(404, "user_not_found", `No user @${login}; they need to run \`halo login\` once first`);
  const res =
    role === "owner"
      ? await env.DB.prepare(`INSERT INTO scope_members (scope_id, user_id, role) VALUES (?, ?, 'owner') ON CONFLICT(scope_id, user_id) DO UPDATE SET role = 'owner'`)
          .bind(row.id, user.id)
          .run()
      : await env.DB.prepare(
          `INSERT INTO scope_members (scope_id, user_id, role) VALUES (?, ?, 'publisher')
           ON CONFLICT(scope_id, user_id) DO UPDATE SET role = 'publisher' WHERE ${KEEPS_AN_OWNER}`,
        )
          .bind(row.id, user.id, row.id)
          .run();
  // No row changed: the member is the scope's last owner, and the guard refused the demotion.
  if (!res.meta.changes) lastOwner(scope);
  return json(await scopeDoc(env, scope));
}

export async function deleteMember(scope: string, login: string, caller: Caller, env: Env): Promise<Response> {
  const row = await requireRole(env, caller, scope, "owner");
  const user = await env.DB.prepare(`SELECT id FROM users WHERE login = ?`).bind(login.toLowerCase()).first<{ id: number }>();
  if (!user) return fail(404, "user_not_found", `No user @${login}`);
  const res = await env.DB.prepare(`DELETE FROM scope_members WHERE scope_id = ? AND user_id = ? AND ${KEEPS_AN_OWNER}`).bind(row.id, user.id, row.id).run();
  if (!res.meta.changes) {
    // Nothing deleted: either not a member, or the guard kept the last owner.
    const member = await env.DB.prepare(`SELECT 1 AS y FROM scope_members WHERE scope_id = ? AND user_id = ?`).bind(row.id, user.id).first();
    if (member) lastOwner(scope);
    return fail(404, "not_a_member", `@${login} is not a member of ${scope}`);
  }
  return json(await scopeDoc(env, scope));
}

function lastOwner(scope: string): never {
  return fail(409, "last_owner", `${scope} must keep at least one owner; add another owner first`);
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
    return json({ record, value, verified: false } satisfies VerifyResponse);
  }
  const verified = await txtContains(env, record, pending.value);
  if (verified) {
    await env.DB.prepare(`UPDATE scopes SET verified_domain = ?, verified_at = ? WHERE id = ?`).bind(domain, now(), row.id).run();
    await purgeScope(env, row.id);
  }
  return json({ record, value: pending.value, verified } satisfies VerifyResponse);
}

/** The badge shows on every package page and doc in the scope. */
async function purgeScope(env: Env, scopeId: number): Promise<void> {
  const { results } = await env.DB.prepare(`SELECT name FROM packages WHERE scope_id = ?`).bind(scopeId).all<{ name: string }>();
  await Promise.all(results.map((p) => purgePackage(env, p.name)));
}

async function txtContains(env: Env, name: string, value: string): Promise<boolean> {
  const url = `${env.DOH_URL || DEFAULT_DOH_URL}?name=${encodeURIComponent(name)}&type=TXT`;
  const res = await fetch(url, { headers: { accept: "application/dns-json" } });
  if (!res.ok) return fail(502, "dns_error", `DNS lookup for ${name} failed (${res.status})`);
  const data = (await res.json().catch(() => ({}))) as { Answer?: { type?: number; data?: string }[] };
  // TXT data comes quoted, possibly split into several quoted strings.
  return (data.Answer ?? []).some((a) => (a.type === undefined || a.type === 16) && typeof a.data === "string" && a.data.replace(/"\s*"/g, "").replace(/^"|"$/g, "").trim() === value);
}

// ── Re-checking verified domains ──
//
// A verified badge lasts while the TXT record does. When a scope's doc, or a package doc or page
// in it, is served and the verification is older than RECHECK_AFTER, the record is looked up
// again after the response (ctx.waitUntil): still there, the verification is renewed; gone, the
// badge is cleared (and, as docs and pages are cached by revision and verified domain, every
// colo shows it gone on its next request). A DNS failure keeps the badge and retries after
// RETRY_AFTER: a claim moves verified_at forward first, so concurrent requests check once.

export const RECHECK_AFTER_MS = 30 * 86_400_000;
const RETRY_AFTER_MS = 3_600_000;

/** Schedules a re-check when `row`'s verification is due. Cheap when it isn't: no I/O. */
export function recheckDomainLater(env: Env, ctx: Ctx, row: Pick<ScopeRow, "id" | "verified_domain" | "verified_at">): void {
  if (!row.verified_domain) return;
  const at = row.verified_at ? Date.parse(row.verified_at) : NaN;
  if (Number.isFinite(at) && Date.now() - at < RECHECK_AFTER_MS) return;
  ctx.waitUntil(
    recheckDomain(env, row.id, row.verified_domain, row.verified_at).catch((e: unknown) => {
      console.error(JSON.stringify({ message: "domain re-check failed", scopeId: row.id, domain: row.verified_domain, error: String(e) }));
    }),
  );
}

async function recheckDomain(env: Env, scopeId: number, domain: string, verifiedAt: string | null): Promise<void> {
  // Claim the check: only the request that moves verified_at goes on. Until the result is in,
  // the claim makes the next check due in RETRY_AFTER.
  const claim = new Date(Date.now() - RECHECK_AFTER_MS + RETRY_AFTER_MS).toISOString();
  const claimed = await env.DB.prepare(`UPDATE scopes SET verified_at = ? WHERE id = ? AND verified_domain = ? AND verified_at IS ?`)
    .bind(claim, scopeId, domain, verifiedAt)
    .run();
  if (!claimed.meta.changes) return;
  const pending = await env.DB.prepare(`SELECT value FROM scope_verifications WHERE scope_id = ? AND domain = ?`).bind(scopeId, domain).first<{ value: string }>();
  let present: boolean;
  if (!pending) present = false;
  else {
    try {
      present = await txtContains(env, `_halo.${domain}`, pending.value);
    } catch (e) {
      if (e instanceof HttpError) return; // DNS trouble: keep the badge, retry after the claim lapses.
      throw e;
    }
  }
  if (present) {
    await env.DB.prepare(`UPDATE scopes SET verified_at = ? WHERE id = ? AND verified_domain = ? AND verified_at = ?`).bind(now(), scopeId, domain, claim).run();
    return;
  }
  const cleared = await env.DB.prepare(`UPDATE scopes SET verified_domain = NULL, verified_at = NULL WHERE id = ? AND verified_domain = ? AND verified_at = ?`)
    .bind(scopeId, domain, claim)
    .run();
  if (cleared.meta.changes) await purgeScope(env, scopeId);
}
