/**
 * The OAuth token broker, the token store and the grants, against a fake authorization server
 * (test/fixtures/oauth-server.ts). Tokens go to the file store HALO_CREDENTIALS_FILE names (set by
 * test/setup.ts): never the Keychain, never a real provider.
 */

import { test, expect, describe, afterAll, beforeEach } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startFakeOAuth } from "./fixtures/oauth-server";
import { AuthRequired, TokenBroker, authorizationRequest, checkRedirect, connectionFrom, pkceChallenge, pkcePair, pollDevice, startDevice, storeKeyOf, type OAuthConnection } from "../src/runtime/oauth";
import { FileTokenStore, credentialsFile, storeId } from "../src/runtime/oauth-store";

const dirs: string[] = [];
const tmp = (p: string) => {
  const d = mkdtempSync(join(tmpdir(), p));
  dirs.push(d);
  return d;
};
const servers: Array<{ stop(): void }> = [];
afterAll(() => {
  for (const s of servers) s.stop();
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

function server(opts: Parameters<typeof startFakeOAuth>[0] = {}) {
  const s = startFakeOAuth(opts);
  servers.push(s);
  return s;
}

function conn(s: ReturnType<typeof startFakeOAuth>, extra: Record<string, unknown> = {}): OAuthConnection {
  const settings: Record<string, unknown> = { authorizeUrl: `${s.issuer}/authorize`, tokenUrl: `${s.issuer}/token`, deviceUrl: `${s.issuer}/device`, revokeUrl: `${s.issuer}/revoke`, issuer: s.issuer, clientId: s.clientId, scopes: ["read"], ...extra };
  return connectionFrom("Acme", (k) => settings[k], tmp("halo-oauth-project-"));
}

/** Sign in with the authorization code grant against the fake server, as halo auth login does. */
async function login(broker: TokenBroker, c: OAuthConnection) {
  const redirect = "http://127.0.0.1:1/callback/x";
  const req = authorizationRequest(c, redirect);
  const res = await fetch(req.url, { redirect: "manual" });
  const back = new URL(res.headers.get("location")!);
  const code = checkRedirect(c, back.searchParams, req.state);
  return broker.exchangeCode(c, code, req.verifier, redirect);
}

describe("PKCE and state", () => {
  test("the S256 challenge is RFC 7636's", () => {
    expect(pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
    const { verifier, challenge } = pkcePair();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(challenge).toBe(pkceChallenge(verifier));
    expect(pkcePair().verifier).not.toBe(verifier);
  });

  test("the authorize URL carries the challenge, never the verifier", () => {
    const s = server();
    const c = conn(s);
    const req = authorizationRequest(c, "http://127.0.0.1:9/cb");
    const u = new URL(req.url);
    expect(u.searchParams.get("code_challenge")).toBe(pkceChallenge(req.verifier));
    expect(u.searchParams.get("code_challenge_method")).toBe("S256");
    expect(u.searchParams.get("state")).toBe(req.state);
    expect(req.url).not.toContain(req.verifier);
  });

  test("a redirect with another state, or from another issuer, is refused", async () => {
    const s = server();
    const c = conn(s);
    expect(() => checkRedirect(c, new URLSearchParams({ code: "x", state: "nope" }), "expected")).toThrow(/state doesn't match/);
    expect(() => checkRedirect(c, new URLSearchParams({ code: "x", state: "s", iss: "https://evil.example" }), "s")).toThrow(/issuer/);
    expect(checkRedirect(c, new URLSearchParams({ code: "x", state: "s", iss: s.issuer }), "s")).toBe("x");
    // No iss sent: nothing to check.
    expect(checkRedirect(c, new URLSearchParams({ code: "x", state: "s" }), "s")).toBe("x");
  });

  test("a code exchanged with the wrong verifier is refused by the server, and nothing is stored", async () => {
    const s = server();
    const c = conn(s);
    const broker = new TokenBroker();
    const redirect = "http://127.0.0.1:1/cb";
    const req = authorizationRequest(c, redirect);
    const back = new URL((await fetch(req.url, { redirect: "manual" })).headers.get("location")!);
    await expect(broker.exchangeCode(c, back.searchParams.get("code")!, pkcePair().verifier, redirect)).rejects.toThrow(/invalid_grant/);
    expect(broker.info(c)).toBeUndefined();
  });
});

describe("grants", () => {
  test("authorization code with PKCE: tokens stored in a 0600 file, account from the ID token", async () => {
    const s = server({ account: "ada@example.com" });
    const c = conn(s);
    const broker = new TokenBroker();
    const got = await login(broker, c);
    expect(got.account).toBe("ada@example.com");
    expect(got.scopes).toEqual(["read"]);
    const info = broker.info(c)!;
    expect(info).toMatchObject({ connection: "Acme", grant: "authorization_code", account: "ada@example.com", scopes: ["read"] });
    expect((info as Record<string, unknown>).refreshToken).toBeUndefined();
    const file = credentialsFile();
    expect(statSync(file).mode & 0o777).toBe(0o600);
    expect(statSync(join(file, "..")).mode & 0o777).toBe(0o700);
    // The token is usable at once, without a refresh.
    const t = await broker.token(c);
    expect(s.accessTokens()).toContain(t.accessToken);
    expect(s.state.refreshes).toBe(0);
  });

  test("client credentials: no login, cached until near expiry", async () => {
    const s = server();
    const c = conn(s, { grant: "client_credentials", clientSecret: s.clientSecret, authorizeUrl: undefined });
    const broker = new TokenBroker();
    const a = await broker.token(c);
    const b = await broker.token(c);
    expect(a.accessToken).toBe(b.accessToken);
    expect(s.state.requests.filter((r) => r.path === "/token")).toHaveLength(1);
    expect(s.state.requests[0]!.form).toMatchObject({ grant_type: "client_credentials", client_id: s.clientId, client_secret: s.clientSecret, scope: "read" });
  });

  test("client credentials need a secret", () => {
    const s = server();
    expect(() => conn(s, { grant: "client_credentials" })).toThrow(/clientSecret/);
  });

  test("device flow: waits through authorization_pending, backs off on slow_down, then stores the tokens", async () => {
    const s = server({ devicePending: 2 });
    const c = conn(s, { grant: "device" });
    const broker = new TokenBroker();
    const start = await startDevice(c);
    expect(start).toMatchObject({ userCode: "WDJB-MJHT", verificationUri: `${s.issuer}/activate`, interval: 1 });
    const waits: number[] = [];
    await pollDevice(broker, c, start, { sleep: async (ms) => void waits.push(ms) });
    // Two pending answers at the server's interval, then slow_down adds 5 seconds.
    expect(waits).toEqual([1000, 1000, 1000, 6000]);
    expect(broker.info(c)?.grant).toBe("device");
    expect(s.accessTokens()).toContain((await broker.token(c)).accessToken);
  });
});

describe("refresh", () => {
  test("refreshes ahead of expiry (60 seconds before), and keeps the rotated refresh token", async () => {
    const s = server();
    const c = conn(s);
    let now = Date.now();
    const broker = new TokenBroker({ now: () => now });
    await login(broker, c);
    const store = new FileTokenStore();
    const first = (await store.get(storeKeyOf(c)))!;
    // Still 61 seconds left: no refresh.
    now += (3600 - 61) * 1000;
    expect((await broker.token(c)).accessToken).toBe(first.accessToken!);
    expect(s.state.refreshes).toBe(0);
    // 59 seconds left: refreshed now, before it expires.
    now += 2000;
    const t = await broker.token(c);
    expect(s.state.refreshes).toBe(1);
    expect(t.accessToken).not.toBe(first.accessToken);
    const after = (await store.get(storeKeyOf(c)))!;
    expect(after.refreshToken).not.toBe(first.refreshToken);
    expect(after.accessToken).toBe(t.accessToken);
    // The next refresh spends the rotated one: the server never sees the old one again.
    now += 3600 * 1000;
    await broker.token(c);
    expect(s.state.refreshes).toBe(2);
    expect(s.state.reuse).toBe(0);
  });

  test("two brokers refreshing at once (two runs) refresh once and never reuse a rotated token", async () => {
    const s = server({ refreshDelayMs: 150 });
    const c = conn(s);
    let now = Date.now();
    const clock = () => now;
    await login(new TokenBroker({ now: clock }), c);
    now += 3600 * 1000;
    const [a, b] = await Promise.all([new TokenBroker({ now: clock }).token(c), new TokenBroker({ now: clock }).token(c)]);
    expect(a.accessToken).toBe(b.accessToken);
    expect(s.state.refreshes).toBe(1);
    expect(s.state.reuse).toBe(0);
  });

  test("another process refreshing at the same moment waits on the lock file, then uses what it stored", async () => {
    const s = server({ refreshDelayMs: 300 });
    const c = conn(s);
    s.state.expiresIn = 30; // under the 60 second margin: every use refreshes unless another just did
    await login(new TokenBroker(), c);
    s.state.expiresIn = 3600;
    const script = join(tmp("halo-oauth-child-"), "child.ts");
    await Bun.write(
      script,
      `import { TokenBroker, connectionFrom } from ${JSON.stringify(join(import.meta.dir, "../src/runtime/oauth.ts"))};
const settings = ${JSON.stringify({ authorizeUrl: c.authorizeUrl, tokenUrl: c.tokenUrl, issuer: c.issuer, clientId: c.clientId, scopes: c.scopes })};
const c = connectionFrom("Acme", (k) => settings[k], ${JSON.stringify(c.project)});
const t = await new TokenBroker().token(c);
console.log(t.accessToken);`,
    );
    const child = Bun.spawn(["bun", script], { stdout: "pipe", stderr: "pipe", env: { ...process.env } });
    // Let the child take the lock first, then ask here too.
    await Bun.sleep(150);
    const mine = await new TokenBroker().token(c);
    const [out, err, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
    expect(err).toBe("");
    expect(code).toBe(0);
    expect(out.trim()).toBe(mine.accessToken);
    expect(s.state.refreshes).toBe(1);
    expect(s.state.reuse).toBe(0);
  });

  test("a revoked grant (invalid_grant) is AUTH_REQUIRED, and the connection is marked as needing a login", async () => {
    const s = server();
    const c = conn(s);
    let now = Date.now();
    const broker = new TokenBroker({ now: () => now });
    await login(broker, c);
    s.revokeAll();
    now += 3600 * 1000;
    const err = await broker.token(c).catch((e) => e);
    expect(err).toBeInstanceOf(AuthRequired);
    expect(err.code).toBe("AUTH_REQUIRED");
    expect(err.connection).toBe("Acme");
    expect(err.message).toMatch(/halo auth login Acme/);
    expect(broker.info(c)?.needsLogin).toMatch(/no longer accepts/);
    // The dead tokens are gone from the store.
    const raw = await new FileTokenStore().get(storeKeyOf(c));
    expect(raw?.refreshToken).toBeUndefined();
    // And it isn't tried again until someone signs in.
    const before = s.state.refreshes;
    await expect(broker.token(c)).rejects.toThrow(AuthRequired);
    expect(s.state.refreshes).toBe(before);
    await login(broker, c);
    expect(broker.info(c)?.needsLogin).toBeUndefined();
  });

  test("not connected at all is AUTH_REQUIRED", async () => {
    const s = server();
    await expect(new TokenBroker().token(conn(s))).rejects.toThrow(/isn't connected on this machine/);
  });

  test("a 5xx from the token endpoint is a retryable error, not AUTH_REQUIRED", async () => {
    const s = server();
    const c = conn(s);
    let now = Date.now();
    const broker = new TokenBroker({ now: () => now });
    await login(broker, c);
    now += 3600 * 1000;
    s.state.failNext = { status: 503, error: "temporarily_unavailable" };
    const err = await broker.token(c).catch((e) => e);
    expect(err).not.toBeInstanceOf(AuthRequired);
    expect(err.retryable).toBe(true);
    // Its body is never quoted, only error and error_description.
    expect(err.message).toMatch(/503 temporarily_unavailable/);
  });
});

describe("requests", () => {
  let s: ReturnType<typeof startFakeOAuth>;
  let c: OAuthConnection;
  let broker: TokenBroker;
  beforeEach(async () => {
    s = server();
    c = conn(s);
    broker = new TokenBroker();
    await login(broker, c);
  });
  const api = (path: string) => `${s.issuer}/api${path}`;

  test("adds the token for the tool's origin", async () => {
    const res = await broker.fetch(c, api("/files?q=1"), {}, { origins: [s.issuer] });
    expect(await res.json()).toMatchObject({ ok: true, path: "/api/files", query: { q: "1" } });
  });

  test("a 401 refreshes once and retries once; a second 401 is AUTH_REQUIRED, with no third request", async () => {
    s.state.reject401 = 1;
    const ok = await broker.fetch(c, api("/x"), {}, { origins: [s.issuer] });
    expect(ok.status).toBe(200);
    expect(s.state.refreshes).toBe(1);
    expect(s.state.requests.filter((r) => r.path === "/api/x")).toHaveLength(2);

    s.state.reject401 = 5;
    await expect(broker.fetch(c, api("/y"), {}, { origins: [s.issuer] })).rejects.toThrow(AuthRequired);
    expect(s.state.requests.filter((r) => r.path === "/api/y")).toHaveLength(2);
    expect(s.state.refreshes).toBe(2);
  });

  test("refuses another origin, and drops the token on a redirect to one", async () => {
    await expect(broker.fetch(c, "https://evil.example/steal", {}, { origins: [s.issuer] })).rejects.toThrow(/only sent to/);
    const seen: Array<string | null> = [];
    const other = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: (req) => (seen.push(req.headers.get("authorization")), new Response("elsewhere")) });
    try {
      const res = await broker.fetch(c, api(`/redirect-away?to=${encodeURIComponent(`http://127.0.0.1:${other.port}/landing`)}`), {}, { origins: [s.issuer] });
      expect(await res.text()).toBe("elsewhere");
      expect(seen).toEqual([null]);
    } finally {
      other.stop(true);
    }
    // A redirect on the same origin keeps it.
    const same = await broker.fetch(c, api("/redirect-here"), {}, { origins: [s.issuer] });
    expect(await same.json()).toMatchObject({ ok: true, query: { moved: "1" } });
  });

  test("a header the caller set is replaced, never sent alongside", async () => {
    await broker.fetch(c, api("/h"), { headers: { Authorization: "Bearer from-the-model" } }, { origins: [s.issuer] });
    const sent = s.state.requests.findLast((r) => r.path === "/api/h")!;
    expect(sent.authorization).not.toContain("from-the-model");
  });

  test("hands every token it uses to the secret masking", async () => {
    const secrets = new Map<string, string>();
    await broker.fetch(c, api("/z"), {}, { origins: [s.issuer], onSecret: (n, v) => secrets.set(n, v) });
    const stored = (await new FileTokenStore().get(storeKeyOf(c)))!;
    expect(secrets.get("Acme access token")).toBe(stored.accessToken!);
    expect(secrets.get("Acme refresh token")).toBe(stored.refreshToken!);
  });

  test("logout revokes at the provider and deletes the entry", async () => {
    const out = await broker.logout(c);
    expect(out).toEqual({ deleted: true, revoked: true });
    expect(s.state.requests.at(-1)).toMatchObject({ path: "/revoke" });
    expect(broker.info(c)).toBeUndefined();
    await expect(broker.token(c)).rejects.toThrow(AuthRequired);
  });
});

describe("the store", () => {
  test("is keyed by the project's real path, the connection, the token URL and the client", () => {
    const base = { project: "/a", connection: "Google", tokenUrl: "https://t", clientId: "c" };
    const ids = new Set([storeId(base), storeId({ ...base, project: "/b" }), storeId({ ...base, connection: "G2" }), storeId({ ...base, tokenUrl: "https://u" }), storeId({ ...base, clientId: "d" }), storeId({ ...base, user: "ada" })]);
    expect(ids.size).toBe(6);
    expect(storeId({ ...base, user: "local" })).toBe(storeId(base));
  });

  test("never lives under the project", async () => {
    expect(credentialsFile()).toBe(process.env.HALO_CREDENTIALS_FILE!);
    const s = server();
    const c = conn(s);
    await login(new TokenBroker(), c);
    expect(readFileSync(credentialsFile(), "utf8")).toContain(c.project.split("/").pop()!);
  });
});
