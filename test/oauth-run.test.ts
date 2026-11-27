/**
 * OAuth in runs: `auth:` on tools, a run that pauses for a connection and continues once it is
 * connected, `|! yield(connect: X)`, @checkpoint, and tokens that never reach a recording, an
 * event, a model or an error. Against the fake server in test/fixtures/oauth-server.ts.
 */

import { test, expect, describe, afterAll } from "bun:test";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "../src/parser/index";
import { validate } from "../src/parser/validate";
import { HaloRuntime, MemoryRunStore, useTool, type MockRequest, type RuntimeEvent } from "../src/runtime/runtime";
import { TokenBroker, authorizationRequest, checkRedirect, connectionFrom, type OAuthConnection } from "../src/runtime/oauth";
import { FileTokenStore, storeId } from "../src/runtime/oauth-store";
import { startFakeOAuth, type FakeOAuth } from "./fixtures/oauth-server";

const dirs: string[] = [];
const tmp = (p: string) => {
  const d = mkdtempSync(join(tmpdir(), p));
  dirs.push(d);
  return d;
};
const servers: FakeOAuth[] = [];
afterAll(() => {
  for (const s of servers) s.stop();
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});
const quiet = { log() {}, warn() {} };

function setup(body: (s: FakeOAuth) => string, opts: { mocks?: Record<string, unknown>; fake?: Parameters<typeof startFakeOAuth>[0] } = {}) {
  const s = startFakeOAuth(opts.fake);
  servers.push(s);
  const project = tmp("halo-oauth-run-");
  const src = `${s.declaration("Acme")}\ntool Api : REST("${s.issuer}/api", auth: Acme)\n${body(s)}`;
  const ast = parse(src);
  expect(ast.errors).toEqual([]);
  expect(validate(ast).filter((d) => d.severity === "error")).toEqual([]);
  const events: RuntimeEvent[] = [];
  const recorded: unknown[] = [];
  const broker = new TokenBroker();
  const runStore = new MemoryRunStore();
  const checkpointDir = tmp("halo-oauth-cp-");
  const runtime = new HaloRuntime({ env: {}, logger: quiet, projectRoot: project, broker, runStore, checkpointDir, onEvent: (e) => events.push(e), recorder: (e) => recorded.push(e) }).load(ast);
  if (opts.mocks) runtime.mockAll(opts.mocks as never);
  const settings: Record<string, unknown> = { authorizeUrl: `${s.issuer}/authorize`, tokenUrl: `${s.issuer}/token`, deviceUrl: `${s.issuer}/device`, revokeUrl: `${s.issuer}/revoke`, issuer: s.issuer, clientId: s.clientId, scopes: ["read"] };
  const conn: OAuthConnection = connectionFrom("Acme", (k) => settings[k], project);
  /** Sign in as `halo auth login Acme` would. */
  const login = async () => {
    const redirect = "http://127.0.0.1:1/callback/x";
    const req = authorizationRequest(conn, redirect);
    const back = new URL((await fetch(req.url, { redirect: "manual" })).headers.get("location")!);
    await broker.exchangeCode(conn, checkRedirect(conn, back.searchParams, req.state), req.verifier, redirect);
  };
  return { s, runtime, events, recorded, broker, conn, login, project, runStore, checkpointDir };
}

/** Every token the fake server issued, and their last 12 characters, are nowhere in `text`. */
function noTokens(s: FakeOAuth, text: string) {
  for (const t of [...s.accessTokens(), ...s.refreshTokens()]) {
    expect(text).not.toContain(t);
    expect(text).not.toContain(t.slice(-12));
  }
}

describe("auth: on REST", () => {
  test("a connected tool's requests carry its token; the run never holds it", async () => {
    const r = setup(() => `pipeline P(q: String) -> Result:\n  q |> Api.files(q: q)`);
    await r.login();
    const out = await r.runtime.run("P", { q: "1" });
    expect(out.status).toBe("completed");
    expect(out.output).toMatchObject({ ok: true, path: "/api/files", query: { q: "1" } });
    noTokens(r.s, JSON.stringify(out) + JSON.stringify(r.events) + JSON.stringify(r.recorded));
  });

  test("a service that echoes the token back shows it masked", async () => {
    const r = setup(() => `pipeline P(q: String) -> Result:\n  q |> Api.leak()`);
    await r.login();
    const out = await r.runtime.run("P", { q: "1" });
    expect(JSON.stringify(out.output)).toContain("[secret Acme access token]");
    noTokens(r.s, JSON.stringify(out) + JSON.stringify(r.events) + JSON.stringify(r.recorded));
  });

  test("a call can't choose the connection: an auth: argument is just an argument", async () => {
    const r = setup(() => `pipeline P(q: String) -> Result:\n  q |> Api.files(auth: "Other")`);
    await r.login();
    const out = await r.runtime.run("P", { q: "1" });
    expect(out.output).toMatchObject({ ok: true, query: { auth: "Other" } });
  });

  test("auth: naming something that isn't an OAuth declaration fails the call", async () => {
    const s = startFakeOAuth();
    servers.push(s);
    const ast = parse(`tool Other : Bash()\ntool Api : REST("${s.issuer}/api", auth: Other)\npipeline P(q: String) -> Result:\n  q |> Api.files()`);
    const rt = new HaloRuntime({ env: {}, logger: quiet, projectRoot: tmp("halo-oauth-x-"), broker: new TokenBroker() }).load(ast);
    await expect(rt.run("P", { q: "1" })).rejects.toThrow(/Other is not an OAuth declaration/);
  });
});

describe("a run that needs a connection pauses", () => {
  test("not connected: paused with waitingFor connect:Acme, and connecting then resuming completes it", async () => {
    const r = setup(() => `pipeline P(q: String) -> Result:\n  q |> Api.files(q: q)\n  |> System.Value("done")`);
    const paused = await r.runtime.run("P", { q: "1" });
    expect(paused.status).toBe("paused");
    expect(paused.context.meta.paused).toMatchObject({ waitingFor: "connect:Acme", stage: 1 });
    expect(paused.context.meta.paused!.message).toMatch(/halo auth login Acme/);
    // Still not connected: resuming pauses it again.
    const again = await r.runtime.signal(paused.runId, "connect:Acme", null);
    expect(again.status).toBe("paused");
    await r.login();
    const done = await r.runtime.signal(paused.runId, "connect:Acme", null);
    expect(done.status).toBe("completed");
    expect(done.output).toBe("done");
  });

  test("a revoked refresh token (invalid_grant) mid-run pauses instead of failing; the work before it is kept", async () => {
    const r = setup(() => `pipeline P(q: String) -> Result:\n  q |> Api.first() as first\n  |> Api.second()\n  |> System.Value(context.data.first.path)`);
    await r.login();
    let calls = 0;
    // The first call works; then the provider revokes the grant and the token stops working.
    const orig = r.runtime as unknown as { config: { fetch?: typeof fetch } };
    orig.config.fetch = (async (url: string | URL, init?: RequestInit) => {
      if (String(url).includes("/api/second") && calls++ === 0) {
        r.s.revokeAll();
        r.s.state.reject401 = 1;
      }
      return fetch(url, init);
    }) as typeof fetch;
    const paused = await r.runtime.run("P", { q: "1" });
    expect(paused.status).toBe("paused");
    expect(paused.context.meta.paused).toMatchObject({ waitingFor: "connect:Acme", stage: 2 });
    expect(paused.context.meta.paused!.message).toMatch(/no longer accepts its refresh token/);
    expect(r.broker.info(r.conn)?.needsLogin).toBeDefined();
    await r.login();
    const done = await r.runtime.signal(paused.runId, "connect:Acme", null);
    expect(done.status).toBe("completed");
    expect(done.output).toBe("/api/first");
    noTokens(r.s, JSON.stringify(done) + JSON.stringify(r.events) + JSON.stringify(r.recorded) + JSON.stringify(await r.runStore.load(paused.runId)));
  });

  test("inside a fan-out it pauses once, at the fan-out", async () => {
    const r = setup(() => `pipeline P(q: String) -> Result:\n  q |* { Api.a(), Api.b(), Api.c() }`);
    const paused = await r.runtime.run("P", { q: "1" });
    expect(paused.status).toBe("paused");
    expect(paused.context.meta.pauses).toBe(1);
    await r.login();
    const done = await r.runtime.signal(paused.runId, "connect:Acme", null);
    expect(done.status).toBe("completed");
    expect((done.output as unknown[]).length).toBe(3);
  });

  test("inside a called pipeline, at the caller's stage", async () => {
    const r = setup(() => `pipeline Inner(q: String) -> Result:\n  q |> Api.files()\npipeline P(q: String) -> Result:\n  q |> Inner(q)`);
    const paused = await r.runtime.run("P", { q: "1" });
    expect(paused.context.meta.paused).toMatchObject({ waitingFor: "connect:Acme", stage: 1 });
    await r.login();
    expect((await r.runtime.signal(paused.runId, "connect:Acme", null)).status).toBe("completed");
  });

  test("with @checkpoint, the checkpoint resumes after connecting", async () => {
    const r = setup(() => `@checkpoint\npipeline P(q: String) -> Result:\n  q |> System.Value("start") as start\n  |> Api.files()\n  |> System.Value(context.data.start)`);
    const paused = await r.runtime.run("P", { q: "1" });
    expect(paused.status).toBe("paused");
    const cp = readdirSync(r.checkpointDir).find((f) => f.endsWith(".json") && !f.includes(".steps"))!;
    await r.login();
    const done = await r.runtime.resume(join(r.checkpointDir, cp));
    expect(done.status).toBe("completed");
    expect(done.output).toBe("start");
    noTokens(r.s, readdirSync(r.checkpointDir).map((f) => readFileSync(join(r.checkpointDir, f), "utf8")).join("\n"));
  });

  test("an agent's tool call that needs a connection pauses the run, and resumes the conversation at that call", async () => {
    const asked: MockRequest[] = [];
    const r = setup(
      () => `agent Clerk [openai/gpt-4o] equips Api\npipeline P(task: String) -> Result:\n  task |> Clerk.work(tools: [Api])`,
      { mocks: { "Clerk.work": (req: MockRequest) => (asked.push(structuredClone(req)), req.step === 1 ? useTool("Api.get", { path: "leak" }) : "Done.") } },
    );
    const paused = await r.runtime.run("P", { task: "look" });
    expect(paused.status).toBe("paused");
    expect(paused.context.meta.paused?.waitingFor).toBe("connect:Acme");
    // The model never heard why.
    expect(asked).toHaveLength(1);
    await r.login();
    const done = await r.runtime.signal(paused.runId, "connect:Acme", null);
    expect(done.status).toBe("completed");
    expect(done.output).toBe("Done.");
    // The model was not asked again for step 1: the paused call ran, and step 2 saw its result.
    expect(asked.map((a) => a.step)).toEqual([1, 2]);
    const tool = asked[1]!.messages!.find((m) => m.role === "tool")!;
    expect(tool.content).toContain("[secret Acme access token]");
    noTokens(r.s, JSON.stringify(asked) + JSON.stringify(r.events) + JSON.stringify(r.recorded) + JSON.stringify(done));
  });
});

describe("|! yield(connect: X)", () => {
  test("goes on at once when connected, with who and never a token", async () => {
    const r = setup(() => `pipeline P(q: String) -> Result:\n  |! yield(connect: Acme, msg: "Allow read access?")\n  |> System.Value(context.data.yield)`, { fake: { account: "ada@example.com" } });
    await r.login();
    const out = await r.runtime.run("P", { q: "1" });
    expect(out.status).toBe("completed");
    expect(out.output).toEqual({ connected: true, connection: "Acme", account: "ada@example.com" });
  });

  test("pauses with its message when not connected, and checks again on resume", async () => {
    const r = setup(() => `pipeline P(q: String) -> Result:\n  |! yield(connect: Acme, msg: "Allow read access?")\n  |> Api.files()`);
    const paused = await r.runtime.run("P", { q: "1" });
    expect(paused.context.meta.paused).toMatchObject({ waitingFor: "connect:Acme", stage: 0 });
    expect(paused.context.meta.paused!.message).toMatch(/^Allow read access\?/);
    // An approval doesn't answer it.
    await expect(r.runtime.signal(paused.runId, "yield", "approve")).rejects.toThrow(/waiting for "connect:Acme"/);
    expect((await r.runtime.signal(paused.runId, "connect:Acme", null)).status).toBe("paused");
    await r.login();
    const done = await r.runtime.signal(paused.runId, "connect:Acme", null);
    expect(done.status).toBe("completed");
    expect(done.output).toMatchObject({ ok: true });
  });
});

describe("mail with a refresh token in Env goes through the broker", () => {
  test("a rotated refresh token is kept and spent next time; the one in Env stays the starting point", async () => {
    const project = tmp("halo-oauth-mail-");
    const ast = parse(`tool Mail : Email(Env.KEY, via: "gmail", clientId: Env.CLIENT, clientSecret: "shh", user: "me@gmail.com")
pipeline Note(to: String) -> Result:
  to |> Mail.send(to: to, subject: "Hi", body: "Hello")`);
    expect(validate(ast).filter((d) => d.severity === "error")).toEqual([]);
    const forms: Array<Record<string, string>> = [];
    let n = 0;
    const fetchMock = (async (url: string | URL, init?: RequestInit) => {
      if (String(url) === "https://oauth2.googleapis.com/token") {
        const form = Object.fromEntries(new URLSearchParams(String(init?.body)));
        forms.push(form);
        n++;
        // Google rotates here (as Microsoft and most OAuth 2.1 servers do), and the token lives 30 seconds.
        return Response.json({ access_token: `ya29.access-${n}`, expires_in: 30, refresh_token: `1//rotated-${n}` });
      }
      if (String(url).startsWith("https://gmail.googleapis.com/")) return Response.json({ id: "m1", auth: new Headers(init?.headers).get("authorization") });
      throw new Error(`unexpected ${url}`);
    }) as typeof fetch;
    const rt = new HaloRuntime({ env: { KEY: "1//from-env", CLIENT: "client-1" }, fetch: fetchMock, logger: quiet, projectRoot: project, broker: new TokenBroker() }).load(ast);
    expect((await rt.run("Note", { to: "ada@example.com" })).output).toMatchObject({ sent: true, id: "m1" });
    expect(forms[0]).toMatchObject({ grant_type: "refresh_token", refresh_token: "1//from-env", client_id: "client-1", client_secret: "shh" });
    // 30 seconds is inside the 60 second margin: the next send refreshes, with the rotated token.
    await rt.run("Note", { to: "ada@example.com" });
    expect(forms[1]).toMatchObject({ refresh_token: "1//rotated-1" });
    // A new runtime (a new run of halo) still has it: it was stored, not just cached.
    const rt2 = new HaloRuntime({ env: { KEY: "1//from-env", CLIENT: "client-1" }, fetch: fetchMock, logger: quiet, projectRoot: project, broker: new TokenBroker() }).load(ast);
    await rt2.run("Note", { to: "ada@example.com" });
    expect(forms[2]).toMatchObject({ refresh_token: "1//rotated-2" });
    // Someone pastes a new refresh token into Env: it wins over the rotated chain.
    const rt3 = new HaloRuntime({ env: { KEY: "1//pasted-new", CLIENT: "client-1" }, fetch: fetchMock, logger: quiet, projectRoot: project, broker: new TokenBroker() }).load(ast);
    await rt3.run("Note", { to: "ada@example.com" });
    expect(forms[3]).toMatchObject({ refresh_token: "1//pasted-new" });
    // It's keyed by this project, under the tool's name.
    const stored = await new FileTokenStore().get({ project, connection: "Mail", tokenUrl: "https://oauth2.googleapis.com/token", clientId: "client-1" });
    expect(stored?.refreshToken).toBe("1//rotated-4");
    expect(storeId({ project, connection: "Mail", tokenUrl: "https://oauth2.googleapis.com/token", clientId: "client-1" })).toHaveLength(40);
  });

  test("Email takes auth: too", async () => {
    const s = startFakeOAuth();
    servers.push(s);
    const project = tmp("halo-oauth-mail2-");
    const ast = parse(`${s.declaration("Google")}
tool Mail : Email(via: "gmail", auth: Google, user: "me@gmail.com")
pipeline Note(to: String) -> Result:
  to |> Mail.send(to: to, subject: "Hi", body: "Hello")`);
    expect(validate(ast).filter((d) => d.severity === "error")).toEqual([]);
    const broker = new TokenBroker();
    const settings: Record<string, unknown> = { authorizeUrl: `${s.issuer}/authorize`, tokenUrl: `${s.issuer}/token`, issuer: s.issuer, clientId: s.clientId, scopes: ["read"] };
    const conn = connectionFrom("Google", (k) => settings[k], project);
    const req = authorizationRequest(conn, "http://127.0.0.1:1/cb");
    const back = new URL((await fetch(req.url, { redirect: "manual" })).headers.get("location")!);
    await broker.exchangeCode(conn, checkRedirect(conn, back.searchParams, req.state), req.verifier, "http://127.0.0.1:1/cb");
    let auth: string | null = null;
    const fetchMock = (async (url: string | URL, init?: RequestInit) => {
      if (String(url).startsWith("https://gmail.googleapis.com/")) {
        auth = new Headers(init?.headers).get("authorization");
        return Response.json({ id: "m2" });
      }
      return fetch(url, init);
    }) as typeof fetch;
    const rt = new HaloRuntime({ env: {}, fetch: fetchMock, logger: quiet, projectRoot: project, broker }).load(ast);
    expect((await rt.run("Note", { to: "ada@example.com" })).output).toMatchObject({ sent: true, id: "m2" });
    expect(s.accessTokens().map((t) => `Bearer ${t}`)).toContain(auth!);
  });
});
