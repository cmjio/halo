/**
 * A small OAuth authorization server (and a resource API) on Bun.serve, for tests. Nothing here
 * talks to a real provider.
 *
 *   GET  /authorize      approves at once: redirects to redirect_uri with code, state (and iss)
 *   POST /token          authorization_code (+PKCE), refresh_token (rotating, with reuse detection),
 *                        client_credentials, device_code (pending, slow_down, then tokens)
 *   POST /device         device_authorization
 *   POST /revoke         revocation
 *   GET|POST /api/*      a resource that wants a live access token
 */

import { createHash, randomBytes } from "node:crypto";

export interface FakeOAuthOptions {
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
  const codes = new Map<string, { challenge: string; method: string; redirect: string; scope: string; used: boolean }>();
  const access = new Map<string, { until: number; scope: string }>();
  /** refresh token -> family; a used one stays here, marked spent. */
  const refresh = new Map<string, { family: string; spent: boolean; scope: string }>();
  const revokedFamilies = new Set<string>();
  const devices = new Map<string, { polls: number; scope: string; slowed: boolean }>();
  const state = {
    requests: [] as Array<{ path: string; method: string; form?: Record<string, string>; authorization?: string | null }>,
    /** How many times a spent refresh token was presented (theft detection would fire). */
    reuse: 0,
    refreshes: 0,
    /** Answer the next token request with this error instead. */
    failNext: undefined as undefined | { status: number; error: string },
    /** Answer resource requests 401 this many more times. */
    reject401: 0,
    expiresIn: opts.expiresIn ?? 3600,
  };

  const issue = (scope: string, family?: string) => {
    const a = tok("at");
    access.set(a, { until: Date.now() + state.expiresIn * 1000, scope });
    const out: Record<string, unknown> = { access_token: a, token_type: "Bearer", expires_in: state.expiresIn, scope: opts.grantScopes ?? scope };
    if (family !== undefined) {
      const r = tok("rt");
      refresh.set(r, { family, spent: false, scope });
      out.refresh_token = r;
    }
    if (opts.account) {
      const b = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
      out.id_token = `${b({ alg: "none" })}.${b({ iss: issuer, aud: clientId, sub: "u1", email: opts.account })}.`;
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
      state.requests.push({ path: url.pathname, method: req.method, ...(form ? { form } : {}), authorization: req.headers.get("authorization") });

      if (url.pathname === "/authorize") {
        const p = url.searchParams;
        if (p.get("client_id") !== clientId) return new Response("unknown client", { status: 400 });
        const code = tok("code");
        codes.set(code, { challenge: p.get("code_challenge") ?? "", method: p.get("code_challenge_method") ?? "", redirect: p.get("redirect_uri") ?? "", scope: p.get("scope") ?? "", used: false });
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
        if (form.client_id !== clientId) return err(401, "invalid_client");
        const confidential = form.client_secret !== undefined;
        if (confidential && form.client_secret !== clientSecret) return err(401, "invalid_client");
        switch (form.grant_type) {
          case "authorization_code": {
            const c = codes.get(form.code ?? "");
            if (!c || c.used) return err(400, "invalid_grant", "unknown or used code");
            c.used = true;
            if (c.redirect !== form.redirect_uri) return err(400, "invalid_grant", "redirect_uri mismatch");
            const challenge = createHash("sha256").update(form.code_verifier ?? "").digest("base64url");
            if (c.method !== "S256" || challenge !== c.challenge) return err(400, "invalid_grant", "PKCE verifier mismatch");
            return Response.json(issue(c.scope, tok("fam")));
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
            if (opts.rotate === false) {
              const out = issue(r.scope);
              return Response.json(out);
            }
            r.spent = true;
            return Response.json(issue(r.scope, r.family));
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
        return Response.json({ ok: true, path: url.pathname, query: Object.fromEntries(url.searchParams), scope: live.scope });
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
