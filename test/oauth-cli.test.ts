/**
 * `halo auth`, the loopback listener, and what validate and plan say about OAuth. Against the fake
 * server in test/fixtures/oauth-server.ts; the browser is a function that follows the redirect.
 */

import { test, expect, describe, afterAll } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "../src/parser/index";
import { validate } from "../src/parser/validate";
import { formatPlan, plan } from "../src/plan";
import { BUILTIN_PROVIDER_INFO } from "../src/runtime/provider-info";
import { authStatusFor, cmdAuth, type AuthDeps } from "../src/auth-cli";
import { startLoopback } from "../src/runtime/oauth-login";
import { TokenBroker } from "../src/runtime/oauth";
import { startFakeOAuth, type FakeOAuth } from "./fixtures/oauth-server";

const dirs: string[] = [];
const servers: FakeOAuth[] = [];
afterAll(() => {
  for (const s of servers) s.stop();
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

function project(src: (s: FakeOAuth) => string, fake?: Parameters<typeof startFakeOAuth>[0]) {
  const s = startFakeOAuth(fake);
  servers.push(s);
  const dir = mkdtempSync(join(tmpdir(), "halo-auth-cli-"));
  dirs.push(dir);
  const file = join(dir, "app.halo");
  writeFileSync(file, src(s));
  const out: string[] = [];
  const err: string[] = [];
  const io = { out: (l: string) => out.push(l), err: (l: string) => err.push(l) };
  const broker = new TokenBroker();
  /** A browser that approves at once: follows the provider's redirect back to the loopback. */
  const browser = async (url: string) => {
    const res = await fetch(url, { redirect: "manual" });
    await fetch(res.headers.get("location")!);
    return true;
  };
  const deps: AuthDeps = { project: dir, broker, browser: true, open: browser, sleep: async () => {} };
  const auth = (...args: string[]) => cmdAuth({ positional: args.filter((a) => !a.startsWith("--")), bools: new Set(args.filter((a) => a.startsWith("--")).map((a) => a.slice(2))), get: () => undefined }, deps, io);
  return { s, dir, file, out, err, broker, deps, auth };
}

const PIPE = `pipeline P(q: String) -> Result:\n  q |> Api.files()`;

describe("halo auth", () => {
  test("login opens the browser, takes the redirect on the loopback, and stores the tokens; status and list say so", async () => {
    const p = project((s) => `${s.declaration("Acme")}\ntool Api : REST("${s.issuer}/api", auth: Acme)\n${PIPE}`, { account: "ada@example.com" });
    expect(await p.auth("login", "Acme", p.file)).toBe(0);
    expect(p.out.join("\n")).toContain("Connected ada@example.com. Granted: read.");
    expect(p.err.join("\n")).toContain(`Opening ${new URL(p.s.issuer).host} to connect Acme (1 scope)`);
    p.out.length = 0;
    await p.auth("status", "Acme", p.file);
    const status = p.out.join("\n");
    expect(status).toMatch(/Acme\s+authorization_code\s+connected as ada@example.com, access token expires in 60 min/);
    expect(status).toContain("used by Api");
    expect(status).toContain("scopes granted: read");
    p.out.length = 0;
    await p.auth("list", p.file);
    expect(p.out.join("\n")).toMatch(/Acme\s+authorization_code\s+connected as ada@example.com/);
    // No token in what it printed.
    for (const t of [...p.s.accessTokens(), ...p.s.refreshTokens()]) expect(p.out.join("\n") + p.err.join("\n")).not.toContain(t);
  });

  test("with no browser it prints the link to open", async () => {
    const p = project((s) => `${s.declaration("Acme")}\n${PIPE.replace("Api.files()", "System.Value(1)")}`);
    p.deps.browser = false;
    p.deps.open = async () => {
      throw new Error("must not open");
    };
    const running = p.auth("login", "Acme", "--no-browser", p.file);
    // Wait for the link, then open it as a person would.
    let link: string | undefined;
    for (let i = 0; i < 100 && !link; i++) {
      await Bun.sleep(10);
      link = p.out.join("\n").match(/(http:\/\/127\.0\.0\.1:\d+\/authorize\S+)/)?.[1];
    }
    expect(link).toBeDefined();
    const res = await fetch(link!, { redirect: "manual" });
    await fetch(res.headers.get("location")!);
    expect(await running).toBe(0);
    expect(p.broker.store.list(p.dir).map((r) => r.connection)).toEqual(["Acme"]);
  });

  test("a redirect with the wrong state is refused, and nothing is stored", async () => {
    const p = project((s) => `${s.declaration("Acme")}\n${PIPE.replace("Api.files()", "System.Value(1)")}`);
    p.deps.open = async (url) => {
      const res = await fetch(url, { redirect: "manual" });
      const back = new URL(res.headers.get("location")!);
      back.searchParams.set("state", "forged");
      await fetch(back);
      return true;
    };
    expect(await p.auth("login", "Acme", p.file)).toBe(1);
    expect(p.err.join("\n")).toMatch(/state doesn't match/);
    expect(p.broker.store.list(p.dir)).toEqual([]);
  });

  test("--device prints the code and the address, and polls until approved", async () => {
    const p = project((s) => `${s.declaration("Acme")}\n${PIPE.replace("Api.files()", "System.Value(1)")}`, { devicePending: 1 });
    expect(await p.auth("login", "Acme", "--device", p.file)).toBe(0);
    const text = p.out.join("\n");
    expect(text).toContain(`open ${p.s.issuer}/activate`);
    expect(text).toContain("WDJB-MJHT");
    expect(text).toContain("Connected Acme.");
  });

  test("client credentials need no login", async () => {
    const p = project((s) => `tool Svc : OAuth(tokenUrl: "${s.issuer}/token", grant: "client_credentials", clientId: "${s.clientId}", clientSecret: Env.SVC_SECRET)\n${PIPE.replace("Api.files()", "System.Value(1)")}`);
    p.deps.env = { SVC_SECRET: p.s.clientSecret };
    expect(await p.auth("login", "Svc", p.file)).toBe(0);
    expect(p.out.join("\n")).toContain("no login needed");
  });

  test("an Env setting that isn't set is named", async () => {
    const p = project((s) => `tool Svc : OAuth(tokenUrl: "${s.issuer}/token", grant: "client_credentials", clientId: "x", clientSecret: Env.MISSING_SECRET)\n${PIPE.replace("Api.files()", "System.Value(1)")}`);
    p.deps.env = {};
    expect(await p.auth("login", "Svc", p.file)).toBe(1);
    expect(p.err.join("\n")).toContain("Env.MISSING_SECRET, which is not set");
  });

  test("logout revokes at the provider and forgets it", async () => {
    const p = project((s) => `${s.declaration("Acme")}\n${PIPE.replace("Api.files()", "System.Value(1)")}`);
    await p.auth("login", "Acme", p.file);
    p.out.length = 0;
    expect(await p.auth("logout", "Acme", p.file)).toBe(0);
    expect(p.out.join("\n")).toContain("Disconnected Acme (and revoked it at");
    expect(p.s.state.requests.at(-1)?.path).toBe("/revoke");
    expect(p.broker.store.list(p.dir)).toEqual([]);
  });

  test("an unknown connection says which there are", async () => {
    const p = project((s) => `${s.declaration("Acme")}\n${PIPE.replace("Api.files()", "System.Value(1)")}`);
    expect(await p.auth("login", "Nope", p.file)).toBe(1);
    expect(p.err.join("\n")).toContain("No OAuth connection named Nope");
    expect(p.err.join("\n")).toContain("there is Acme");
  });
});

describe("the loopback listener", () => {
  test("takes exactly one request on its path: others get 400, a second gets nothing", async () => {
    const loop = startLoopback({ timeoutMs: 5000 });
    const u = new URL(loop.redirectUri);
    expect(u.hostname).toBe("127.0.0.1");
    expect((await fetch(`${u.origin}/callback/wrong?code=x&state=y`)).status).toBe(400);
    // A Host other than 127.0.0.1:<port> (a rebinding page) is refused too.
    expect((await fetch(`${loop.redirectUri}?code=x`, { headers: { Host: "evil.example" } })).status).toBe(400);
    const first = await fetch(`${loop.redirectUri}?code=c1&state=s1`);
    expect(first.status).toBe(200);
    expect((await loop.result).get("code")).toBe("c1");
    const second = await fetch(`${loop.redirectUri}?code=c2&state=s1`).then((r) => r.status, () => "refused");
    expect([410, "refused"]).toContain(second);
  });

  test("gives up after its time", async () => {
    const loop = startLoopback({ timeoutMs: 30 });
    await expect(loop.result).rejects.toThrow(/Nobody signed in/);
  });
});

describe("halo validate", () => {
  const errors = (src: string) => validate(parse(src)).filter((d) => d.severity === "error").map((d) => d.message);
  const all = (src: string) => validate(parse(src)).map((d) => `${d.severity}: ${d.message}`);

  test("a good declaration and its tools pass", () => {
    expect(errors(`tool Google : OAuth(provider: "google", clientId: Env.GOOGLE_CLIENT_ID, scopes: ["https://www.googleapis.com/auth/drive.readonly"])
tool Drive : REST("https://www.googleapis.com/drive/v3", auth: Google)
tool Mail : Email(via: "gmail", auth: Google, user: "me@gmail.com")
pipeline P(q: String) -> Result:
  |! yield(connect: Google, msg: "Allow read access to your Drive?")
  |> Drive.files(q: q)`)).toEqual([]);
  });

  test("unknown provider, missing clientId, unknown grant, a setting it doesn't have", () => {
    const e = errors(`tool G : OAuth(provider: "gooogle", grant: "password", scope: ["x"])`);
    expect(e.some((m) => m.includes(`provider "gooogle" is not one Halo knows; did you mean "google"?`))).toBe(true);
    expect(e.some((m) => m.includes("needs clientId:"))).toBe(true);
    expect(e.some((m) => m.includes(`grant "password" is not a grant Halo has`))).toBe(true);
    expect(e.some((m) => m.includes(`has no setting "scope"; did you mean scopes?`))).toBe(true);
  });

  test("endpoints and what each grant needs", () => {
    const e = errors(`tool G : OAuth(tokenUrl: "http://auth.example.com/token", clientId: "x")
tool S : OAuth(provider: "slack", grant: "device", clientId: "x")
tool C : OAuth(provider: "microsoft", tenant: "contoso.com", grant: "client_credentials", clientId: "x")`);
    expect(e.some((m) => m.includes(`"G": tokenUrl must be https`))).toBe(true);
    expect(e.some((m) => m.includes(`"G" needs authorizeUrl:`))).toBe(true);
    expect(e.some((m) => m.includes(`"S" needs deviceUrl: for the device grant (slack has none Halo knows)`))).toBe(true);
    expect(e.some((m) => m.includes(`"C" needs clientSecret:`))).toBe(true);
  });

  test("auth: must name an OAuth declaration, on a tool that can use it, and not with apiKey:", () => {
    const e = errors(`tool G : OAuth(provider: "github", clientId: "x")
tool Sh : Bash()
tool A : REST("https://api.example.com", auth: Sh)
tool B : REST("https://api.example.com", auth: Nope)
tool C : REST("https://api.example.com", auth: G, apiKey: Env.KEY)
tool D : Bash(auth: G)
tool E : REST("https://api.example.com", auth: Env.TOKEN)
tool F : Email(Env.KEY, auth: G, from: "a@b.co")
agent X [openai/gpt-4o] equips G
pipeline P(q: String) -> Result:
  |! yield(connect: Sh)
  |> G.get()`);
    expect(e).toContain(`Tool "A": auth: Sh is a Bash tool, not an OAuth declaration`);
    expect(e.some((m) => m.startsWith(`Tool "B": auth: Nope is not an OAuth declaration`))).toBe(true);
    expect(e).toContain(`Tool "C" takes auth: or apiKey:, not both`);
    expect(e.some((m) => m.startsWith(`Tool "D": Bash can't use auth:`))).toBe(true);
    expect(e.some((m) => m.startsWith(`Tool "E": auth: names an OAuth declaration, not Env.TOKEN`))).toBe(true);
    expect(e.some((m) => m.startsWith(`Tool "F": Email(via: "resend") signs in with a key`))).toBe(true);
    expect(e.some((m) => m.startsWith(`Agent "X" equips G, an OAuth connection`))).toBe(true);
    expect(e.some((m) => m.includes(`yield(connect: Sh) names an OAuth declaration; Sh is a Bash tool`))).toBe(true);
    expect(e.some((m) => m.includes(`G is an OAuth connection, not a tool to call`))).toBe(true);
  });

  test("a client secret written in the file is a warning", () => {
    expect(all(`tool G : OAuth(provider: "google", clientId: "x", clientSecret: "abc123")`)).toContain(`warning: OAuth connection "G": clientSecret is written in the file; read it from the environment (clientSecret: Env.G_CLIENT_SECRET)`);
  });
});

describe("halo plan", () => {
  const info = (p: string) => BUILTIN_PROVIDER_INFO[p];

  test("each tool with auth shows its connection, grant, scopes, and whether this machine is connected", async () => {
    const p = project((s) => `${s.declaration("Acme")}\ntool Api : REST("${s.issuer}/api", auth: Acme)\n${PIPE}`, { grantScopes: "read write" });
    const ast = parse(await Bun.file(p.file).text());
    const before = plan(ast, "P", { providerInfo: info, authStatus: authStatusFor(ast, { project: p.dir, broker: p.broker }) });
    const note = before.steps.find((s) => s.label === "Api.files")!.notes.join("\n");
    expect(note).toContain("auth: Acme (oauth, authorization_code) [read] · not connected: halo auth login Acme");
    expect(before.auth).toEqual([{ connection: "Acme", grant: "authorization_code", scopes: ["read"], tools: ["Api"], status: "not connected" }]);

    await p.auth("login", "Acme", p.file);
    // The server granted more than was asked: login says so, and so does plan.
    expect(p.err.join("\n")).toContain("warning: Acme was granted more than it declares: write");
    const now = Date.now();
    const after = plan(ast, "P", { providerInfo: info, authStatus: authStatusFor(ast, { project: p.dir, broker: p.broker }), now });
    expect(after.auth[0]).toMatchObject({ status: "connected", wider: ["write"] });
    const text = formatPlan(after);
    expect(text).toMatch(/auth: Acme \(oauth, authorization_code\) \[read\] · connected, access token expires in (59|60) min/);
    expect(text).toContain("Acts as: Api through Acme (oauth, authorization_code) [read]: connected");
    expect(text).toContain("warning: Acme was granted more than it declares: write");
    for (const t of [...p.s.accessTokens(), ...p.s.refreshTokens()]) expect(JSON.stringify(after) + text).not.toContain(t);
  });

  test("an agent's tools with auth are shown too; client credentials need no login", () => {
    const ast = parse(`tool Graph : OAuth(provider: "microsoft", tenant: "contoso.com", grant: "client_credentials", clientId: "x", clientSecret: Env.S, scopes: ["https://graph.microsoft.com/.default"])
tool Sites : REST("https://graph.microsoft.com/v1.0/sites", auth: Graph)
agent A [openai/gpt-4o] equips Sites
pipeline P(q: String) -> Result:
  q |> A.work(tools: [Sites])`);
    const pl = plan(ast, "P", { providerInfo: info, authStatus: () => undefined });
    expect(pl.steps[0]!.notes.join("\n")).toContain("auth: Graph (oauth, client_credentials) [https://graph.microsoft.com/.default] · client credentials (no login)");
  });
});
