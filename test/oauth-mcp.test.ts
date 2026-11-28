/**
 * MCP authorization (phase 4): `auth: "discover"` finds an MCP server's authorization server from
 * its 401 (RFC 9728, RFC 8414), registers a client (RFC 7591), signs in with PKCE and resource=
 * (RFC 8707), and every MCP request is signed through the broker. And a declared connection on an
 * MCP server. Against the fakes in test/fixtures/oauth-server.ts: nothing real is contacted.
 */

import { test, expect, describe, afterAll } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "../src/parser/index";
import { validate } from "../src/parser/validate";
import { formatPlan, plan } from "../src/plan";
import { BUILTIN_PROVIDER_INFO } from "../src/runtime/provider-info";
import { HaloRuntime, MemoryRunStore } from "../src/runtime/runtime";
import { TokenBroker } from "../src/runtime/oauth";
import { addressKind, bearerChallenge, checkDiscoveryUrl, discoverMcp, discoveryKey, registerClient, DiscoveryError } from "../src/runtime/mcp-auth";
import { closeMcpClients } from "../src/runtime/mcp";
import { authStatusFor, cmdAuth, type AuthDeps } from "../src/auth-cli";
import { startFakeMcp, startFakeOAuth, type FakeMcp, type FakeOAuth } from "./fixtures/oauth-server";

const dirs: string[] = [];
const stops: Array<() => unknown> = [];
afterAll(async () => {
  await closeMcpClients();
  for (const s of stops) await s();
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});
const quiet = { log() {}, warn() {} };
const PIPE = `pipeline P(q: String) -> Result:\n  q |> Linear.whoami()`;

function servers(fake?: Parameters<typeof startFakeOAuth>[0], mcp?: Parameters<typeof startFakeMcp>[1]) {
  const s = startFakeOAuth(fake);
  const m = startFakeMcp(s, mcp);
  stops.push(() => s.stop(), () => m.stop());
  return { s, m };
}

/** A project with `src`, `halo auth` against it, and a runtime for its pipelines. */
function project(src: string) {
  const dir = mkdtempSync(join(tmpdir(), "halo-oauth-mcp-"));
  dirs.push(dir);
  const file = join(dir, "app.halo");
  writeFileSync(file, src);
  const out: string[] = [];
  const err: string[] = [];
  const order: string[] = [];
  const io = { out: (l: string) => (out.push(l), order.push(`out: ${l}`)), err: (l: string) => (err.push(l), order.push(`err: ${l}`)) };
  const broker = new TokenBroker();
  const browser = async (url: string) => {
    order.push(`open: ${url}`);
    const res = await fetch(url, { redirect: "manual" });
    await fetch(res.headers.get("location")!);
    return true;
  };
  const deps: AuthDeps = { project: dir, broker, browser: true, open: browser, env: {} };
  const auth = (...args: string[]) => {
    const values = new Map<string, string>();
    const positional: string[] = [];
    const bools = new Set<string>();
    for (let i = 0; i < args.length; i++) {
      const a = args[i]!;
      if (a === "--user") values.set("user", args[++i]!);
      else if (a.startsWith("--")) bools.add(a.slice(2));
      else positional.push(a);
    }
    return cmdAuth({ positional, bools, get: (k) => values.get(k) }, deps, io);
  };
  const ast = parse(src);
  const runtime = () => new HaloRuntime({ env: {}, logger: quiet, projectRoot: dir, broker, runStore: new MemoryRunStore() }).load(ast);
  return { dir, file, out, err, order, broker, deps, auth, ast, runtime };
}

const discoverDecl = (m: FakeMcp, extra = "") => `tool Linear : MCP(url: "${m.url}", auth: "discover"${extra})\n${PIPE}`;

describe('auth: "discover"', () => {
  test("login discovers the server, says where it signs in, registers a client, and sends resource= on authorize and token", async () => {
    const { s, m } = servers();
    const p = project(discoverDecl(m, `, scopes: ["read"]`));
    expect(await p.auth("login", "Linear", p.file)).toBe(0);
    // Before the browser opens: the authorization server's host, the scopes, and that a client is registered.
    const host = new URL(s.issuer).host;
    const opened = p.order.findIndex((l) => l.startsWith("open: "));
    const said = p.order.findIndex((l) => l.includes(`signs in at ${host}`) && l.includes("asking for: read"));
    const dcr = p.order.findIndex((l) => l.includes("Halo registers itself") && l.includes("dynamic client registration"));
    expect(said).toBeGreaterThanOrEqual(0);
    expect(dcr).toBeGreaterThan(said);
    expect(opened).toBeGreaterThan(dcr);
    // One client registered, public, for the loopback redirect, with nothing about the person.
    expect(s.state.registered).toHaveLength(1);
    const reg = s.state.registered[0]!;
    expect(reg.body).toMatchObject({ token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"], client_name: "Halo" });
    expect((reg.body as { redirect_uris: string[] }).redirect_uris[0]).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/callback\//);
    // resource= names the MCP server on the authorize and the token request.
    const authorize = s.state.requests.find((r) => r.path === "/authorize")!;
    expect(authorize.query).toMatchObject({ resource: m.url, client_id: reg.clientId, code_challenge_method: "S256", scope: "read" });
    const token = s.state.requests.find((r) => r.path === "/token" && r.form?.grant_type === "authorization_code")!;
    expect(token.form).toMatchObject({ resource: m.url, client_id: reg.clientId });
    expect(p.out.join("\n")).toContain("Connected Linear. Granted: read.");

    // The discovery and the registered client are kept in the token store, not the project.
    const kept = p.broker.store.info(discoveryKey("Linear", m.url, p.dir))!.discovery!;
    expect(kept).toMatchObject({ resource: m.url, issuer: s.issuer, clientId: reg.clientId, dynamic: true, tokenUrl: `${s.issuer}/token` });

    // A run's MCP requests carry the token, and the server sees the registered client.
    const r = await p.runtime().run("P", { q: "x" });
    expect(r.status).toBe("completed");
    expect(r.output).toMatchObject({ client: reg.clientId, scope: "read" });
    const signed = m.state.requests.filter((x) => x.status === 200);
    expect(signed.map((x) => x.method)).toEqual(expect.arrayContaining(["initialize", "tools/list", "tools/call"]));
    for (const x of signed) expect(x.authorization).toMatch(/^Bearer at_/);

    // halo plan and halo auth status say where it was discovered.
    const shown = formatPlan(plan(p.ast, "P", { providerInfo: (x) => BUILTIN_PROVIDER_INFO[x], authStatus: authStatusFor(p.ast, { project: p.dir, broker: p.broker, env: {} }) }));
    expect(shown).toContain(`through Linear (oauth, discovered: ${host})`);
    expect(shown).toContain("connected");
    p.out.length = 0;
    await p.auth("status", "Linear", p.file);
    expect(p.out.join("\n")).toContain(`authorization server: ${s.issuer} (Halo registered its own client there); resource: ${m.url}`);

    // Logging out forgets the tokens and the discovery (with the registered client).
    expect(await p.auth("logout", "Linear", "--no-revoke", p.file)).toBe(0);
    expect(p.broker.store.info(discoveryKey("Linear", m.url, p.dir))).toBeUndefined();
  });

  test("before login, a run pauses for connect:Linear, and the plan says it's discovered at sign-in", async () => {
    const { m } = servers();
    const p = project(discoverDecl(m));
    const r = await p.runtime().run("P", { q: "x" });
    expect(r.status).toBe("paused");
    expect(r.context.meta.paused?.waitingFor).toBe("connect:Linear");
    const shown = formatPlan(plan(p.ast, "P", { providerInfo: (x) => BUILTIN_PROVIDER_INFO[x], authStatus: authStatusFor(p.ast, { project: p.dir, broker: p.broker, env: {} }) }));
    expect(shown).toContain("through Linear (oauth, discovered at sign-in)");
    expect(shown).toContain("not connected: halo auth login Linear");
    // Nothing was sent to the server: there was no token to send.
    expect(m.state.requests).toHaveLength(0);
  });

  test("a refused token is refreshed and the request sent once more; twice refused pauses the run", async () => {
    const { s, m } = servers();
    const p = project(discoverDecl(m));
    expect(await p.auth("login", "Linear", p.file)).toBe(0);
    const rt = p.runtime();
    const first = await rt.run("P", { q: "x" });
    expect(first.status).toBe("completed");
    const before = s.state.refreshes;
    m.state.reject401 = 1;
    const second = await rt.run("P", { q: "x" });
    expect(second.status).toBe("completed");
    expect(s.state.refreshes).toBe(before + 1);
    expect((second.output as { n: number }).n).toBeGreaterThan((first.output as { n: number }).n);
    // Refused after the refresh too: the run pauses for a person, with no third try.
    m.state.reject401 = 2;
    const sent = m.state.requests.length;
    const third = await rt.run("P", { q: "x" });
    expect(third.status).toBe("paused");
    expect(third.context.meta.paused?.waitingFor).toBe("connect:Linear");
    expect(m.state.requests.length - sent).toBe(2);
  });

  test("a server that wants more scope (403 insufficient_scope) pauses for a person to sign in again", async () => {
    const { m } = servers(undefined, { requireScope: "write" });
    const p = project(discoverDecl(m, `, scopes: ["read"]`));
    expect(await p.auth("login", "Linear", p.file)).toBe(0);
    const r = await p.runtime().run("P", { q: "x" });
    expect(r.status).toBe("paused");
    expect(r.context.meta.paused?.waitingFor).toBe("connect:Linear");
    expect(r.context.meta.paused?.message).toContain("scope: write");
  });

  test("without auth:, a 401 with a challenge says to add auth: \"discover\"", async () => {
    const { m } = servers();
    const p = project(`tool Linear : MCP(url: "${m.url}")\n${PIPE}`);
    await expect(p.runtime().run("P", { q: "x" })).rejects.toThrow(/add auth: "discover" to the tool and run halo auth login Linear/);
  });

  test("refused: an issuer that isn't the server it was fetched for, a resource that isn't this server, other redirect URIs", async () => {
    const evil = servers({ metadataIssuer: "https://accounts.example.com" });
    const p1 = project(discoverDecl(evil.m));
    expect(await p1.auth("login", "Linear", p1.file)).toBe(1);
    expect(p1.err.join("\n")).toMatch(/names issuer https:\/\/accounts\.example\.com, not http:\/\/127\.0\.0\.1:\d+, the authorization server it was fetched for; refused/);
    expect(evil.s.state.registered).toHaveLength(0);
    expect(p1.order.some((l) => l.startsWith("open: "))).toBe(false);

    const other = servers(undefined, { resource: "http://127.0.0.1:9/elsewhere" });
    const p2 = project(discoverDecl(other.m));
    expect(await p2.auth("login", "Linear", p2.file)).toBe(1);
    expect(p2.err.join("\n")).toContain("is for http://127.0.0.1:9/elsewhere, not");

    const dcr = servers({ dcrRedirectUris: ["https://attacker.example/cb"] });
    const p3 = project(discoverDecl(dcr.m));
    expect(await p3.auth("login", "Linear", p3.file)).toBe(1);
    expect(p3.err.join("\n")).toContain("registered other redirect URIs than the one Halo sent; refused");
    expect(p3.broker.store.info(discoveryKey("Linear", dcr.m.url, p3.dir))).toBeUndefined();
  });

  test("with clientId: declared, no client is registered and that client signs in", async () => {
    const { s, m } = servers();
    const p = project(discoverDecl(m, `, clientId: "${"client-1"}"`));
    expect(await p.auth("login", "Linear", p.file)).toBe(0);
    expect(s.state.registered).toHaveLength(0);
    expect(p.err.join("\n")).not.toContain("registers itself");
    const r = await p.runtime().run("P", { q: "x" });
    expect(r.output).toMatchObject({ client: "client-1" });
  });

  test("no resource_metadata in the challenge: the well-known URL is used", async () => {
    const { m } = servers(undefined, { noChallengeUrl: true });
    const p = project(discoverDecl(m));
    expect(await p.auth("login", "Linear", p.file)).toBe(0);
    expect((await p.runtime().run("P", { q: "x" })).status).toBe("completed");
  });
});

describe("under halo serve", () => {
  test("a run paused for a discovered tool is connected through /connect: discovery, registration for the callback, resource=", async () => {
    const { startServer } = await import("../src/serve/server");
    const { s, m } = servers();
    const p = project(discoverDecl(m));
    const TOKEN = "serve-token-for-mcp-tests";
    const server = await startServer({ files: [p.file], root: p.dir, port: 0, stateDir: join(p.dir, ".halo"), scheduler: false, logger: { log() {}, warn() {}, error() {} }, env: {}, token: TOKEN, runtime: { broker: p.broker } });
    stops.push(() => server.stop());
    const auth = { Authorization: `Bearer ${TOKEN}` };
    const started = (await (await fetch(`${server.url}/api/pipelines/P/runs`, { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({ args: { q: "x" }, wait: true }) })).json()) as { runId: string; status: string };
    expect(started.status).toBe("paused");
    const detail = async () => (await (await fetch(`${server.url}/api/runs/${started.runId}`, { headers: auth })).json()) as { running: boolean; paused?: { connectUrl?: string } };
    const link = (await detail()).paused!.connectUrl!;
    const page = await (await fetch(link)).text();
    expect(page).toContain(`Continue to ${new URL(s.issuer).host}`);
    expect(page).toContain("Halo registers itself there as a new client");
    // Looking registered nothing.
    expect(s.state.registered).toHaveLength(0);
    const go = await fetch(link, { method: "POST", redirect: "manual" });
    expect(go.status).toBe(303);
    expect(s.state.registered).toHaveLength(1);
    expect((s.state.registered[0]!.body as { redirect_uris: string[] }).redirect_uris).toEqual([`${server.url}/connect/callback`]);
    const authorize = new URL(go.headers.get("location")!);
    expect(authorize.searchParams.get("resource")).toBe(m.url);
    const back = (await fetch(authorize, { redirect: "manual" })).headers.get("location")!;
    expect((await fetch(back)).status).toBe(200);
    for (let i = 0; i < 100; i++) {
      const d = await detail();
      if (!d.paused && !d.running) break;
      await Bun.sleep(20);
    }
    expect((await detail()).paused).toBeUndefined();
    expect(m.state.requests.some((r) => r.method === "tools/call" && r.status === 200)).toBe(true);
  });
});

describe("a declared connection on an MCP server", () => {
  test("its tokens are sent to the server, and login checks the server's metadata names the declared token endpoint", async () => {
    const { s, m } = servers();
    const decl = `${s.declaration("Acme", `, resource: "${m.url}"`)}\ntool Linear : MCP(url: "${m.url}", auth: Acme)\n${PIPE}`;
    const p = project(decl);
    expect(validate(p.ast).filter((d) => d.severity === "error")).toEqual([]);
    expect(await p.auth("login", "Acme", p.file)).toBe(0);
    const r = await p.runtime().run("P", { q: "x" });
    expect(r.status).toBe("completed");
    expect(r.output).toMatchObject({ client: s.clientId });
  });

  test("metadata that points tokens at another origin than declared is refused", async () => {
    const { s, m } = servers({ metadataTokenUrl: "http://127.0.0.1:9/token" });
    const p = project(`${s.declaration("Acme", `, resource: "${m.url}"`)}\ntool Linear : MCP(url: "${m.url}", auth: Acme)\n${PIPE}`);
    expect(await p.auth("login", "Linear", p.file)).toBe(1);
    expect(p.err.join("\n")).toMatch(/metadata says its tokens come from http:\/\/127\.0\.0\.1:9, but Acme declares tokenUrl .*; refused/);
    expect(p.order.some((l) => l.startsWith("open: "))).toBe(false);
  });
});

describe("discovery's checks", () => {
  test("https only (http on loopback), and under serve no private, link-local or metadata addresses", async () => {
    await expect(checkDiscoveryUrl(new URL("http://metadata.example/x"))).rejects.toThrow("only follows https");
    await expect(checkDiscoveryUrl(new URL("http://127.0.0.1:1/x"))).resolves.toBeUndefined();
    const serve = { blockPrivate: true, allowLoopback: false };
    for (const u of ["https://10.0.0.1/.well-known/x", "https://169.254.169.254/latest/meta-data", "https://192.168.1.2/", "https://[fd00::1]/", "https://[::ffff:10.0.0.1]/"]) {
      await expect(checkDiscoveryUrl(new URL(u), serve)).rejects.toThrow(/a private address/);
    }
    await expect(checkDiscoveryUrl(new URL("http://127.0.0.1:1/x"), serve)).rejects.toThrow(/a loopback address/);
    await expect(checkDiscoveryUrl(new URL("http://localhost:1/x"), serve)).rejects.toThrow(/a loopback address/);
    await expect(checkDiscoveryUrl(new URL("http://127.0.0.1:1/x"), { blockPrivate: true, allowLoopback: true })).resolves.toBeUndefined();
    await expect(checkDiscoveryUrl(new URL("https://user:pw@example.com/"))).rejects.toThrow("credentials");
    expect(addressKind("8.8.8.8")).toBe("public");
    expect(addressKind("::ffff:7f00:1")).toBe("loopback");
  });

  test("a redirect in discovery is refused, and so is metadata over 64 KB", async () => {
    const bad = Bun.serve({
      port: 0,
      hostname: "127.0.0.1",
      fetch(req) {
        const u = new URL(req.url);
        if (u.pathname.startsWith("/big")) return new Response("x".repeat(70_000));
        return new Response(null, { status: 302, headers: { Location: "http://169.254.169.254/latest" } });
      },
    });
    stops.push(() => bad.stop(true));
    const base = `http://127.0.0.1:${bad.port}`;
    await expect(discoverMcp(`${base}/mcp`, { challenge: { resource_metadata: `${base}/meta` } })).rejects.toThrow("discovery follows no redirects");
    await expect(discoverMcp(`${base}/mcp`, { challenge: { resource_metadata: `${base}/big` } })).rejects.toThrow("more than 64 KB");
  });

  test("a registration endpoint that isn't there, and the challenge's parameters", async () => {
    const { s, m } = servers({ dcr: false });
    const d = await discoverMcp(m.url, { challenge: { resource_metadata: `${m.base}/.well-known/oauth-protected-resource/mcp` } });
    expect(d.registrationUrl).toBeUndefined();
    await expect(registerClient(d, "http://127.0.0.1:1/cb")).rejects.toThrow(DiscoveryError);
    await expect(registerClient(d, "http://127.0.0.1:1/cb")).rejects.toThrow("give the tool clientId:");
    expect(d.issuer).toBe(s.issuer);
    expect(bearerChallenge(`Bearer realm="x", error="insufficient_scope", scope="a b", resource_metadata="https://x/y"`)).toEqual({ realm: "x", error: "insufficient_scope", scope: "a b", resource_metadata: "https://x/y" });
    expect(bearerChallenge("Basic realm=x")).toBeUndefined();
  });

  test("no token or client secret is written to the project", async () => {
    const { s, m } = servers();
    const p = project(discoverDecl(m));
    expect(await p.auth("login", "Linear", p.file)).toBe(0);
    await p.runtime().run("P", { q: "x" });
    const text = readFileSync(p.file, "utf8") + p.out.join("\n") + p.err.join("\n");
    for (const t of [...s.accessTokens(), ...s.refreshTokens()]) expect(text).not.toContain(t);
  });
});

describe("validate", () => {
  const errors = (src: string) => validate(parse(src)).filter((d) => d.severity === "error").map((d) => d.message);
  test('auth: "discover" on an MCP url is fine; on a command, or with settings that need it, it is not', () => {
    expect(errors(`tool L : MCP(url: "https://mcp.example.com/mcp", auth: "discover", scopes: ["read"], as: "invoker")\npipeline P(q: String) -> Result:\n  q |> L.list_tools()`)).toEqual([]);
    expect(errors(`tool L : MCP("npx -y server", auth: "discover")\npipeline P(q: String) -> Result:\n  q |> L.list_tools()`)).toEqual([`Tool "L": auth: is for an MCP server reached by url:; a server run as a command signs in by itself`]);
    expect(errors(`tool L : MCP(url: "https://mcp.example.com/mcp", clientId: "x")\npipeline P(q: String) -> Result:\n  q |> L.list_tools()`)).toEqual([`Tool "L": MCP's clientId: is for auth: "discover"`]);
    expect(errors(`tool L : MCP(url: "https://mcp.example.com/mcp", auth: "discover", as: "me")\npipeline P(q: String) -> Result:\n  q |> L.list_tools()`)[0]).toContain('as: is "service"');
    expect(errors(`tool L : MCP(url: "https://mcp.example.com/mcp", auth: "discovr")\npipeline P(q: String) -> Result:\n  q |> L.list_tools()`)[0]).toContain('or auth: "discover"');
  });
});
