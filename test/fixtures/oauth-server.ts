/**
 * A small OAuth authorization server (and a resource API) on Bun.serve, for tests. Nothing here
 * talks to a real provider.
 *
 *   GET  /authorize      approves at once: redirects to redirect_uri with code, state (and iss)
 *   POST /token          authorization_code (+PKCE), refresh_token (rotating, with reuse detection),
 *                        client_credentials, device_code (pending, slow_down, then tokens)
 *   POST /device         device_authorization
 *   POST /revoke         revocation
 *   POST /register       dynamic client registration (RFC 7591)
 *   GET  /.well-known/oauth-authorization-server   its metadata (RFC 8414)
 *   GET|POST /api/*      a resource that wants a live access token
 *
 * `startFakeMcp` is an MCP server over Streamable HTTP that wants this server's tokens (with
 * `resource=` naming it), answering 401 with a `resource_metadata` challenge (RFC 9728) without one.
 */

import { createHash, randomBytes } from "node:crypto";

export interface FakeOAuthOptions {
  /** Serve RFC 8414 metadata (default true). */
  metadata?: boolean;
  /** The issuer the metadata names (default: the server's own URL; something else is a mix-up). */
  metadataIssuer?: string;
  /** Offer dynamic client registration at /register (default true). */
  dcr?: boolean;
  /** Answer a registration with these redirect_uris instead of the ones sent. */
  dcrRedirectUris?: string[];
  /** A token_endpoint for the metadata other than its own /token. */
  metadataTokenUrl?: string;
  clientId?: string;
  clientSecret?: string;
  /** Seconds an access token lives (default 3600). */
  expiresIn?: number;
  /** Rotate refresh tokens (default true). */
  rotate?: boolean;
  /** Send iss on the authorize redirect (default true), or this value instead of the issuer. */
  iss?: boolean | string;
  /** How many device polls answer authorization_pending before slow_down, then tokens. */
  devicePending?: number;
  /** Milliseconds the refresh grant takes (to line up concurrent refreshes). */
  refreshDelayMs?: number;
  /** Add an id_token for this account. */
  account?: string;
  /** Scopes the server grants (default: what was asked). */
  grantScopes?: string;
}

const tok = (p: string) => `${p}_${randomBytes(18).toString("base64url")}`;

export function startFakeOAuth(opts: FakeOAuthOptions = {}) {
  const clientId = opts.clientId ?? "client-1";
  const clientSecret = opts.clientSecret ?? "secret-1";
  /** Known clients: the declared one, and any registered (RFC 7591). */
  const clients = new Map<string, { secret?: string; redirectUris?: string[] }>([[clientId, { secret: clientSecret }]]);
  const codes = new Map<string, { challenge: string; method: string; redirect: string; scope: string; used: boolean; resource?: string; client: string; account?: string }>();
  const access = new Map<string, { until: number; scope: string; resource?: string; client: string; n: number; account?: string }>();
  /** refresh token -> family; a used one stays here, marked spent. */
  const refresh = new Map<string, { family: string; spent: boolean; scope: string; resource?: string; client: string; account?: string }>();
  let issued = 0;
  const revokedFamilies = new Set<string>();
  const devices = new Map<string, { polls: number; scope: string; slowed: boolean }>();
  const state = {
    requests: [] as Array<{ path: string; method: string; form?: Record<string, string>; json?: unknown; query?: Record<string, string>; authorization?: string | null }>,
    /** How many times a spent refresh token was presented (theft detection would fire). */
    reuse: 0,
    refreshes: 0,
    /** Answer the next token request with this error instead. */
    failNext: undefined as undefined | { status: number; error: string },
    /** Answer resource requests 401 this many more times. */
    reject401: 0,
    expiresIn: opts.expiresIn ?? 3600,
    /** Clients registered at /register, with what was sent. */
    registered: [] as Array<{ clientId: string; body: unknown }>,
    /** Who the next sign-in at /authorize is (default: opts.account). */
    account: undefined as string | undefined,
  };

  const issue = (scope: string, family?: string, extra: { resource?: string; client?: string; account?: string } = {}) => {
    const a = tok("at");
    const client = extra.client ?? clientId;
    const account = extra.account ?? opts.account;
    access.set(a, { until: Date.now() + state.expiresIn * 1000, scope, client, n: ++issued, ...(extra.resource ? { resource: extra.resource } : {}), ...(account ? { account } : {}) });
    const out: Record<string, unknown> = { access_token: a, token_type: "Bearer", expires_in: state.expiresIn, scope: opts.grantScopes ?? scope };
    if (family !== undefined) {
      const r = tok("rt");
      refresh.set(r, { family, spent: false, scope, client, ...(extra.resource ? { resource: extra.resource } : {}), ...(account ? { account } : {}) });
      out.refresh_token = r;
    }
    if (account) {
      const b = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
      out.id_token = `${b({ alg: "none" })}.${b({ iss: issuer, aud: client, sub: account, email: account })}.`;
    }
    return out;
  };
  const err = (status: number, error: string, description?: string) => Response.json({ error, ...(description ? { error_description: description } : {}) }, { status });

  let issuer = "";
  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    async fetch(req): Promise<Response> {
      const url = new URL(req.url);
      const form = req.method === "POST" && (req.headers.get("content-type") ?? "").includes("form") ? Object.fromEntries(new URLSearchParams(await req.text())) : undefined;
      const json = req.method === "POST" && (req.headers.get("content-type") ?? "").includes("json") ? await req.json().catch(() => undefined) : undefined;
      state.requests.push({ path: url.pathname, method: req.method, ...(form ? { form } : {}), ...(json ? { json } : {}), ...(url.search ? { query: Object.fromEntries(url.searchParams) } : {}), authorization: req.headers.get("authorization") });

      if (url.pathname === "/.well-known/oauth-authorization-server" && opts.metadata !== false) {
        return Response.json({
          issuer: opts.metadataIssuer ?? issuer,
          authorization_endpoint: `${issuer}/authorize`,
          token_endpoint: opts.metadataTokenUrl ?? `${issuer}/token`,
          revocation_endpoint: `${issuer}/revoke`,
          ...(opts.dcr !== false ? { registration_endpoint: `${issuer}/register` } : {}),
          code_challenge_methods_supported: ["S256"],
          scopes_supported: ["read", "write"],
        });
      }

      if (url.pathname === "/register" && req.method === "POST" && opts.dcr !== false) {
        const body = (json ?? {}) as { redirect_uris?: string[]; token_endpoint_auth_method?: string };
        const id = tok("dyn");
        const uris = body.redirect_uris ?? [];
        clients.set(id, { redirectUris: uris });
        state.registered.push({ clientId: id, body });
        return Response.json({ client_id: id, redirect_uris: opts.dcrRedirectUris ?? uris, token_endpoint_auth_method: "none" }, { status: 201 });
      }

      if (url.pathname === "/authorize") {
        const p = url.searchParams;
        const client = clients.get(p.get("client_id") ?? "");
        if (!client) return new Response("unknown client", { status: 400 });
        if (client.redirectUris && !client.redirectUris.includes(p.get("redirect_uri") ?? "")) return new Response("unregistered redirect_uri", { status: 400 });
        const code = tok("code");
        codes.set(code, { challenge: p.get("code_challenge") ?? "", method: p.get("code_challenge_method") ?? "", redirect: p.get("redirect_uri") ?? "", scope: p.get("scope") ?? "", used: false, client: p.get("client_id")!, ...(p.get("resource") ? { resource: p.get("resource")! } : {}), ...(state.account ? { account: state.account } : {}) });
        const back = new URL(p.get("redirect_uri")!);
        back.searchParams.set("code", code);
        back.searchParams.set("state", p.get("state") ?? "");
        if (opts.iss !== false) back.searchParams.set("iss", typeof opts.iss === "string" ? opts.iss : issuer);
        return new Response(null, { status: 302, headers: { Location: back.toString() } });
      }

      if (url.pathname === "/device" && form) {
        if (form.client_id !== clientId) return err(401, "invalid_client");
        const device = tok("dc");
        devices.set(device, { polls: 0, scope: form.scope ?? "", slowed: false });
        return Response.json({ device_code: device, user_code: "WDJB-MJHT", verification_uri: `${issuer}/activate`, interval: 1, expires_in: 600 });
      }

      if (url.pathname === "/revoke" && form) {
        const r = refresh.get(form.token ?? "");
        if (r) revokedFamilies.add(r.family);
        access.delete(form.token ?? "");
        return new Response(null, { status: 200 });
      }

      if (url.pathname === "/token" && form) {
        if (state.failNext) {
          const f = state.failNext;
          state.failNext = undefined;
          return err(f.status, f.error, "the fake server was told to refuse");
        }
        const client = clients.get(form.client_id ?? "");
        if (!client) return err(401, "invalid_client");
        const confidential = form.client_secret !== undefined;
        if (confidential && form.client_secret !== client.secret) return err(401, "invalid_client");
        switch (form.grant_type) {
          case "authorization_code": {
            const c = codes.get(form.code ?? "");
            if (!c || c.used) return err(400, "invalid_grant", "unknown or used code");
            c.used = true;
            if (c.client !== form.client_id) return err(400, "invalid_grant", "code issued to another client");
            if (c.redirect !== form.redirect_uri) return err(400, "invalid_grant", "redirect_uri mismatch");
            const challenge = createHash("sha256").update(form.code_verifier ?? "").digest("base64url");
            if (c.method !== "S256" || challenge !== c.challenge) return err(400, "invalid_grant", "PKCE verifier mismatch");
            // RFC 8707: the token is for the resource the authorize request named (and the token request repeats).
            if (c.resource !== form.resource) return err(400, "invalid_target", "resource differs from the authorize request's");
            return Response.json(issue(c.scope, tok("fam"), { client: c.client, ...(c.resource ? { resource: c.resource } : {}), ...(c.account ? { account: c.account } : {}) }));
          }
          case "refresh_token": {
            state.refreshes++;
            if (opts.refreshDelayMs) await Bun.sleep(opts.refreshDelayMs);
            const r = refresh.get(form.refresh_token ?? "");
            if (!r || revokedFamilies.has(r.family)) return err(400, "invalid_grant", "unknown or revoked refresh token");
            if (r.spent) {
              // Reuse of a rotated token looks like theft: the whole grant goes.
              state.reuse++;
              revokedFamilies.add(r.family);
              return err(400, "invalid_grant", "refresh token reused");
            }
            const same = { client: r.client, ...(r.resource ? { resource: r.resource } : {}), ...(r.account ? { account: r.account } : {}) };
            if (opts.rotate === false) {
              const out = issue(r.scope, undefined, same);
              return Response.json(out);
            }
            r.spent = true;
            return Response.json(issue(r.scope, r.family, same));
          }
          case "client_credentials":
            if (!confidential) return err(401, "invalid_client", "client credentials need a secret");
            return Response.json(issue(form.scope ?? ""));
          case "urn:ietf:params:oauth:grant-type:device_code": {
            const d = devices.get(form.device_code ?? "");
            if (!d) return err(400, "invalid_grant");
            d.polls++;
            if (d.polls <= (opts.devicePending ?? 1)) return err(400, "authorization_pending");
            if (!d.slowed) {
              d.slowed = true;
              return err(400, "slow_down");
            }
            devices.delete(form.device_code!);
            return Response.json(issue(d.scope, tok("fam")));
          }
          default:
            return err(400, "unsupported_grant_type");
        }
      }

      if (url.pathname.startsWith("/api/")) {
        const auth = req.headers.get("authorization") ?? "";
        const t = auth.replace(/^Bearer /, "");
        const live = access.get(t);
        if (state.reject401 > 0) {
          state.reject401--;
          return new Response("expired", { status: 401 });
        }
        if (!live || live.until < Date.now()) return new Response("bad token", { status: 401 });
        if (url.pathname === "/api/redirect-away") return new Response(null, { status: 302, headers: { Location: url.searchParams.get("to")! } });
        if (url.pathname === "/api/redirect-here") return new Response(null, { status: 302, headers: { Location: "/api/echo?moved=1" } });
        // A careless service that echoes the token back.
        if (url.pathname === "/api/leak") return Response.json({ echoed: auth });
        return Response.json({ ok: true, path: url.pathname, query: Object.fromEntries(url.searchParams), scope: live.scope, ...(live.account ? { account: live.account } : {}) });
      }
      return new Response("not found", { status: 404 });
    },
  });
  issuer = `http://127.0.0.1:${server.port}`;
  return {
    issuer,
    url: issuer,
    clientId,
    clientSecret,
    state,
    /** What an access token is good for, if it is live: its scope, client, resource and account. */
    introspect(token: string) {
      const a = access.get(token);
      return a && a.until >= Date.now() ? a : undefined;
    },
    /** Tokens as a sign-in would give them (with a refresh token), for seeding a store. */
    mint(scope = "read", account?: string) {
      return issue(scope, tok("fam"), account ? { account } : {}) as { access_token: string; refresh_token: string; expires_in: number; token_type: string; scope: string };
    },
    /** Expire an access token now (so the next use is refused and refreshed). */
    expire(token: string) {
      const a = access.get(token);
      if (a) a.until = 0;
    },
    /** Revoke every refresh token (as a provider does when a person removes the app's access). */
    revokeAll() {
      for (const r of refresh.values()) revokedFamilies.add(r.family);
    },
    /** Every access token issued and still known. */
    accessTokens: () => [...access.keys()],
    refreshTokens: () => [...refresh.keys()],
    /** An OAuth declaration for this server. */
    declaration(name = "Acme", extra = "") {
      return `tool ${name} : OAuth(authorizeUrl: "${issuer}/authorize", tokenUrl: "${issuer}/token", deviceUrl: "${issuer}/device", revokeUrl: "${issuer}/revoke", issuer: "${issuer}", clientId: "${clientId}", scopes: ["read"]${extra})`;
    },
    stop: () => server.stop(true),
  };
}

export type FakeOAuth = ReturnType<typeof startFakeOAuth>;

export interface FakeMcpOptions {
  /** The resource its metadata claims (default: its own /mcp URL). */
  resource?: string;
  /** The authorization servers its metadata names (default: the fake OAuth server's issuer). */
  authorizationServers?: string[];
  /** Leave resource_metadata out of the 401's challenge (clients then look at the well-known URL). */
  noChallengeUrl?: boolean;
  /** Point the challenge's resource_metadata here instead. */
  resourceMetadataUrl?: string;
  /** A scope a tools/call needs; a token without it gets 403 insufficient_scope. */
  requireScope?: string;
}

/**
 * An MCP server over Streamable HTTP that only answers with a live token from `auth` issued for its
 * own URL (resource=). Without one: 401 and `WWW-Authenticate: Bearer resource_metadata="..."`. Its
 * one tool, `whoami`, says which account and client the token is for.
 */
export function startFakeMcp(auth: FakeOAuth, opts: FakeMcpOptions = {}) {
  const state = {
    requests: [] as Array<{ method?: string; authorization: string | null; status: number }>,
    /** Refuse the next this-many requests that carry a good token (as if it were revoked or expired). */
    reject401: 0,
  };
  let base = "";
  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    async fetch(req): Promise<Response> {
      const url = new URL(req.url);
      if (url.pathname === "/.well-known/oauth-protected-resource/mcp" || url.pathname === "/.well-known/oauth-protected-resource") {
        return Response.json({ resource: opts.resource ?? `${base}/mcp`, authorization_servers: opts.authorizationServers ?? [auth.issuer], scopes_supported: ["read", "write"], bearer_methods_supported: ["header"] });
      }
      if (url.pathname !== "/mcp") return new Response("not found", { status: 404 });
      if (req.method === "DELETE") return new Response(null, { status: 204 });
      const msg = (await req.json().catch(() => ({}))) as { id?: number; method?: string };
      const authorization = req.headers.get("authorization");
      const live = auth.introspect(authorization?.replace(/^Bearer /, "") ?? "");
      let ok = !!live && live.resource === `${base}/mcp`;
      if (ok && state.reject401 > 0) {
        state.reject401--;
        ok = false;
      }
      if (!ok) {
        state.requests.push({ method: msg.method, authorization, status: 401 });
        const meta = opts.resourceMetadataUrl ?? `${base}/.well-known/oauth-protected-resource/mcp`;
        return new Response(JSON.stringify({ error: "invalid_token" }), { status: 401, headers: { "Content-Type": "application/json", "WWW-Authenticate": `Bearer realm="mcp"${opts.noChallengeUrl ? "" : `, resource_metadata="${meta}"`}` } });
      }
      if (msg.method === "tools/call" && opts.requireScope && !live!.scope.split(/\s+/).includes(opts.requireScope)) {
        state.requests.push({ method: msg.method, authorization, status: 403 });
        return new Response("", { status: 403, headers: { "WWW-Authenticate": `Bearer error="insufficient_scope", scope="${opts.requireScope}"` } });
      }
      state.requests.push({ method: msg.method, authorization, status: 200 });
      if (msg.id === undefined) return new Response(null, { status: 202 });
      const result =
        msg.method === "initialize"
          ? { protocolVersion: "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "fake-mcp", version: "1" } }
          : msg.method === "tools/list"
            ? { tools: [{ name: "whoami", description: "Who the token is for", inputSchema: { type: "object", properties: {} }, annotations: { readOnlyHint: true } }] }
            : msg.method === "tools/call"
              ? { content: [{ type: "text", text: JSON.stringify({ account: live!.account ?? null, client: live!.client, scope: live!.scope, n: live!.n }) }] }
              : undefined;
      return Response.json(result === undefined ? { jsonrpc: "2.0", id: msg.id, error: { code: -32601, message: "no such method" } } : { jsonrpc: "2.0", id: msg.id, result }, { headers: { "Mcp-Session-Id": "s1" } });
    },
  });
  base = `http://127.0.0.1:${server.port}`;
  return { url: `${base}/mcp`, base, state, stop: () => server.stop(true) };
}

export type FakeMcp = ReturnType<typeof startFakeMcp>;
