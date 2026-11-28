/**
 * Multi-user `halo serve` (phase 5): halo.json `users`, each with a token; runs owned by who started
 * them; only the owner (or an admin) sees and acts on a run; `as: "invoker"` connections use the
 * run's user's own tokens; /connect links bound to that user; Slack buttons acting as the mapped
 * user. Against the fake OAuth server in test/fixtures/oauth-server.ts.
 */

import { test, expect, describe, afterAll } from "bun:test";
import { createHmac } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startServer, ServeError, type HaloServer, type ServeOptions } from "../src/serve/server";
import { TokenBroker, connectionFrom, type OAuthConnection } from "../src/runtime/oauth";
import { parse } from "../src/parser/index";
import { validate } from "../src/parser/validate";
import { cmdAuth } from "../src/auth-cli";
import { startFakeOAuth, type FakeOAuth } from "./fixtures/oauth-server";

const dirs: string[] = [];
const stops: Array<() => unknown> = [];
afterAll(async () => {
  for (const s of stops) await s();
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});
const quiet = { log() {}, warn() {}, error() {} };

const TOKENS = { operator: "operator-token-0123456789", alice: "alice-token-0123456789", bob: "bob-token-0123456789", carol: "carol-token-0123456789" };
const as = (who: keyof typeof TOKENS) => ({ Authorization: `Bearer ${TOKENS[who]}` });
const env = { ALICE_TOKEN: TOKENS.alice, BOB_TOKEN: TOKENS.bob, CAROL_TOKEN: TOKENS.carol };
const USERS = { alice: { token: "Env.ALICE_TOKEN", slack: "U0ALICE" }, bob: { token: "Env.BOB_TOKEN", slack: "U0BOB" }, carol: { token: "Env.CAROL_TOKEN", admin: true } };

async function setup(extra: Partial<ServeOptions> = {}, invoker = true) {
  const fake = startFakeOAuth();
  stops.push(() => fake.stop());
  const dir = mkdtempSync(join(tmpdir(), "halo-users-"));
  dirs.push(dir);
  await Bun.write(
    join(dir, "app.halo"),
    `${fake.declaration("Acme", invoker ? `, as: "invoker"` : "")}
tool Api : REST("${fake.issuer}/api", auth: Acme)

pipeline Ask(q: String) -> Result:
  q
    |! yield(msg: "Go on?") as review

pipeline Mine(q: String) -> Result:
  q |> Api.files(q: q)

pipeline Weekly(q: String) -> Result:
  |! yield(connect: Acme, msg: "Connect your Acme account")
  |> Api.files(q: q)`,
  );
  const server: HaloServer = await startServer({ files: [join(dir, "app.halo")], root: dir, port: 0, stateDir: join(dir, ".halo"), scheduler: false, logger: quiet, env, token: TOKENS.operator, users: USERS, runtime: { broker: new TokenBroker() }, ...extra });
  stops.push(() => server.stop());
  const api = (who: keyof typeof TOKENS, path: string, init: RequestInit = {}) => fetch(`${server.url}${path}`, { ...init, headers: { ...as(who), "Content-Type": "application/json", ...(init.headers ?? {}) } });
  const start = async (who: keyof typeof TOKENS, pipeline = "Ask") => (await (await api(who, `/api/pipelines/${pipeline}/runs`, { method: "POST", body: JSON.stringify({ args: { q: "x" }, wait: true }) })).json()) as { runId: string; status: string; output?: any; error?: string };
  const settings: Record<string, unknown> = { authorizeUrl: `${fake.issuer}/authorize`, tokenUrl: `${fake.issuer}/token`, deviceUrl: `${fake.issuer}/device`, revokeUrl: `${fake.issuer}/revoke`, issuer: fake.issuer, clientId: fake.clientId, scopes: ["read"] };
  /** The connection as the runtime builds it, for a user. */
  const conn = (user: string): OAuthConnection => ({ ...connectionFrom("Acme", (k) => settings[k], dir), user });
  return { fake, dir, server, api, start, conn };
}

const runsOf = async (res: Response) => ((await res.json()) as Array<{ run_id: string; owner?: string }>).map((r) => r.run_id).sort();

describe("users and their runs", () => {
  test("each user sees only their own runs; an admin and the operator see everyone's", async () => {
    const t = await setup();
    const a = await t.start("alice");
    const b = await t.start("bob");
    expect([a.status, b.status]).toEqual(["paused", "paused"]);
    expect(await runsOf(await t.api("alice", "/api/runs"))).toEqual([a.runId]);
    expect(await runsOf(await t.api("bob", "/api/runs"))).toEqual([b.runId]);
    expect(await runsOf(await t.api("carol", "/api/runs"))).toEqual([a.runId, b.runId].sort());
    expect(await runsOf(await t.api("operator", "/api/runs"))).toEqual([a.runId, b.runId].sort());
    // Each run says who started it.
    const listed = (await (await t.api("carol", "/api/runs")).json()) as Array<{ run_id: string; owner: string }>;
    expect(Object.fromEntries(listed.map((r) => [r.run_id, r.owner]))).toEqual({ [a.runId]: "user:alice", [b.runId]: "user:bob" });
    expect(((await (await t.api("alice", `/api/runs/${a.runId}`)).json()) as { owner: string }).owner).toBe("user:alice");
    // Another's run isn't there for them.
    expect((await t.api("alice", `/api/runs/${b.runId}`)).status).toBe(404);
    expect((await t.api("carol", `/api/runs/${b.runId}`)).status).toBe(200);
    // Without a token, or with a wrong one: nothing.
    expect((await fetch(`${t.server.url}/api/runs`)).status).toBe(401);
    expect((await fetch(`${t.server.url}/api/runs`, { headers: { Authorization: "Bearer nope" } })).status).toBe(401);
    // Who am I, for Studio.
    expect(await (await t.api("alice", "/api/me")).json()).toEqual({ owner: "user:alice", admin: false, user: "alice", users: true });
  });

  test("one user can't answer or stop another's run; the owner and an admin can", async () => {
    const t = await setup();
    const a = await t.start("alice");
    const b = await t.start("bob");
    const signal = (who: keyof typeof TOKENS, runId: string) => t.api(who, `/api/runs/${runId}/signal`, { method: "POST", body: JSON.stringify({ answer: "approve", wait: true }) });
    const refused = await signal("alice", b.runId);
    expect(refused.status).toBe(403);
    expect(((await refused.json()) as { error: string }).error).toContain("only they, or an admin");
    expect((await t.api("alice", `/api/runs/${b.runId}/stop`, { method: "POST", body: "{}" })).status).toBe(403);
    expect((await t.api("alice", `/api/runs/${b.runId}/budget`, { method: "POST", body: JSON.stringify({ add: 1 }) })).status).toBe(403);
    expect((await t.api("alice", `/api/runs/${b.runId}/rewind`, { method: "POST", body: JSON.stringify({ step: 1 }) })).status).toBe(403);
    // Still waiting.
    expect(((await (await t.api("bob", `/api/runs/${b.runId}`)).json()) as { paused?: unknown }).paused).toBeDefined();
    expect(((await (await signal("bob", b.runId)).json()) as { status: string }).status).toBe("completed");
    expect(((await (await signal("carol", a.runId)).json()) as { status: string }).status).toBe("completed");
  });

  test("an idempotency key is each user's own", async () => {
    const t = await setup();
    const go = (who: keyof typeof TOKENS) => t.api(who, "/api/pipelines/Ask/runs", { method: "POST", headers: { "Idempotency-Key": "same" }, body: JSON.stringify({ args: { q: "x" } }) }).then((r) => r.json() as Promise<{ runId: string; duplicate?: boolean }>);
    const a1 = await go("alice");
    const b1 = await go("bob");
    const a2 = await go("alice");
    expect(b1.runId).not.toBe(a1.runId);
    expect(a2).toMatchObject({ runId: a1.runId, duplicate: true });
  });

  test("a webhook's run is the service's: users don't see it, admins do", async () => {
    const t = await setup();
    const runId = t.server.start("Ask", { q: "x" }, "webhook /hooks/x");
    await t.server.settled(runId);
    expect(await runsOf(await t.api("alice", "/api/runs"))).toEqual([]);
    expect(((await (await t.api("carol", `/api/runs/${runId}`)).json()) as { owner: string }).owner).toBe("service");
  });

  test("config: a user's token that names an unset variable, or repeats another, is refused", async () => {
    const t = await setup();
    const base = { files: [join(t.dir, "app.halo")], root: t.dir, port: 0, stateDir: join(t.dir, ".halo2"), scheduler: false, logger: quiet, token: TOKENS.operator };
    await expect(startServer({ ...base, env: {}, users: { alice: { token: "Env.ALICE_TOKEN" } } })).rejects.toThrow('users.alice.token "Env.ALICE_TOKEN" is empty or not set');
    await expect(startServer({ ...base, env, users: { alice: { token: "Env.ALICE_TOKEN" }, al: { token: "Env.ALICE_TOKEN" } } })).rejects.toThrow("the same as another token");
    await expect(startServer({ ...base, env, users: { operator: { token: "Env.ALICE_TOKEN" } } })).rejects.toThrow(ServeError);
    await expect(startServer({ ...base, env, users: { alice: { token: "Env.ALICE_TOKEN", slack: "alice" } } })).rejects.toThrow("Slack user id");
  });

  test("with users and no HALO_SERVE_TOKEN, serve may listen beyond loopback: the users' tokens guard it", async () => {
    const t = await setup();
    const s = await startServer({ files: [join(t.dir, "app.halo")], root: t.dir, port: 0, host: "0.0.0.0", stateDir: join(t.dir, ".halo3"), scheduler: false, logger: quiet, env, users: USERS });
    stops.push(() => s.stop());
    expect((await fetch(`http://127.0.0.1:${s.port}/api/runs`)).status).toBe(401);
    expect((await fetch(`http://127.0.0.1:${s.port}/api/runs`, { headers: as("alice") })).status).toBe(200);
    // The serve token isn't one: there is no operator here.
    expect((await fetch(`http://127.0.0.1:${s.port}/api/runs`, { headers: as("operator") })).status).toBe(401);
  });
});

describe('as: "invoker"', () => {
  test("each user's run uses that user's own token; the operator's and the service's can't", async () => {
    const t = await setup();
    const broker = new TokenBroker();
    await broker.connect(t.conn("alice"), t.fake.mint("read", "alice@example.com") as never);
    await broker.connect(t.conn("bob"), t.fake.mint("read", "bob@example.com") as never);
    const a = await t.start("alice", "Mine");
    const b = await t.start("bob", "Mine");
    expect(a.status).toBe("completed");
    expect(a.output).toMatchObject({ account: "alice@example.com" });
    expect(b.output).toMatchObject({ account: "bob@example.com" });
    // carol (an admin) has no token of her own: her run pauses for her to connect.
    expect((await t.start("carol", "Mine")).status).toBe("paused");
    // The operator's token is no person.
    const op = await t.start("operator", "Mine");
    expect(op.status).toBe("error");
    expect(op.error).toContain('acts as the person who started the run (as: "invoker"), but this run was started by the server\'s own token');
  });

  test("a connect link is offered to the run's own user only, bound to them, and stores the token under them", async () => {
    const t = await setup();
    const a = await t.start("alice", "Weekly");
    const b = await t.start("bob", "Weekly");
    expect(a.status).toBe("paused");
    const detail = async (who: keyof typeof TOKENS, runId: string) => (await (await t.api(who, `/api/runs/${runId}`)).json()) as { paused?: { connectUrl?: string; connection?: string } };
    const link = (await detail("alice", a.runId)).paused!.connectUrl!;
    expect(link).toMatch(new RegExp(`/connect/${a.runId}/Acme\\?exp=\\d+&as=user%3Aalice&sig=[0-9a-f]{32}$`));
    // An admin isn't offered a link to sign in as alice.
    expect((await detail("carol", a.runId)).paused!.connectUrl).toBeUndefined();
    // A link made for alice can't be turned into bob's: not by the name, not on bob's run.
    expect((await fetch(link.replace("as=user%3Aalice", "as=user%3Abob"), { method: "POST", redirect: "manual" })).status).toBe(403);
    expect((await fetch(link.replace(a.runId, b.runId), { method: "POST", redirect: "manual" })).status).toBe(403);
    // The page says whose it is.
    expect(await (await fetch(link)).text()).toContain("This link is for alice. The account you sign in with is the one alice's runs act as.");
    // alice goes on and signs in.
    const go = await fetch(link, { method: "POST", redirect: "manual" });
    expect(go.status).toBe(303);
    t.fake.state.account = "alice@example.com";
    const back = (await fetch(go.headers.get("location")!, { redirect: "manual" })).headers.get("location")!;
    const done = await fetch(back);
    expect(await done.text()).toContain("Signed in as alice@example.com");
    const broker = new TokenBroker();
    expect(broker.info(t.conn("alice"))?.account).toBe("alice@example.com");
    expect(broker.info(t.conn("bob"))).toBeUndefined();
    expect(broker.info(t.conn("local"))).toBeUndefined();
    for (let i = 0; i < 100 && (await detail("alice", a.runId)).paused; i++) await Bun.sleep(20);
    expect((await detail("alice", a.runId)).paused).toBeUndefined();
    // bob's run still waits for his own.
    expect((await detail("bob", b.runId)).paused?.connection).toBe("Acme");
  });

  test("a service connection on a user's run is offered to an admin, not the user", async () => {
    const t = await setup({}, false);
    const a = await t.start("alice", "Weekly");
    const get = async (who: keyof typeof TOKENS) => ((await (await t.api(who, `/api/runs/${a.runId}`)).json()) as { paused?: { connectUrl?: string } }).paused;
    expect((await get("alice"))!.connectUrl).toBeUndefined();
    const link = (await get("carol"))!.connectUrl!;
    expect(link).toContain("as=user%3Acarol");
    expect(await (await fetch(link)).text()).toContain("The account you sign in with is the one every run that uses it acts as");
    // The operator's links keep their form.
    expect((await get("operator"))!.connectUrl).toMatch(/\?exp=\d+&sig=[0-9a-f]{32}$/);
  });
});

describe("Slack", () => {
  test("a click acts as the Halo user whose slack id it is: the owner answers, others are told no", async () => {
    const posted: any[] = [];
    const replies: any[] = [];
    const fetchSpy = (async (url: string | URL | Request, init?: RequestInit) => {
      if (String(url).startsWith("https://hooks.slack.test/")) return (posted.push(JSON.parse(String(init?.body))), new Response("ok"));
      if (String(url).startsWith("https://hooks.slack.com/")) return (replies.push(JSON.parse(String(init?.body))), new Response("ok"));
      return fetch(url, init);
    }) as typeof fetch;
    const secret = "slack-secret";
    const t = await setup({ notify: { slack: "https://hooks.slack.test/T1" }, slack: { signingSecret: secret }, fetch: fetchSpy });
    const click = (value: string, id: string) => {
      const ts = Math.floor(Date.now() / 1000);
      const body = new URLSearchParams({ payload: JSON.stringify({ actions: [{ value }], user: { id, username: id.toLowerCase() }, response_url: "https://hooks.slack.com/actions/x" }) }).toString();
      const sig = `v0=${createHmac("sha256", secret).update(`v0:${ts}:${body}`).digest("hex")}`;
      return fetch(`${t.server.url}/slack/actions`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Slack-Request-Timestamp": String(ts), "X-Slack-Signature": sig }, body });
    };
    const waitFor = async (n: number, list: unknown[]) => {
      for (let i = 0; i < 100 && list.length < n; i++) await Bun.sleep(10);
    };
    const a = await t.start("alice");
    await waitFor(1, posted);
    const approve = posted[0].blocks[1].elements[0].value as string;
    // Someone whose Slack account isn't a Halo user here.
    await click(approve, "U0STRANGER");
    await waitFor(1, replies);
    expect(replies[0]).toMatchObject({ response_type: "ephemeral" });
    expect(replies[0].text).toContain("isn't linked to a Halo user");
    // bob, on alice's run.
    await click(approve, "U0BOB");
    await waitFor(2, replies);
    expect(replies[1].text).toContain("only they, or an admin");
    expect(((await (await t.api("alice", `/api/runs/${a.runId}`)).json()) as { paused?: unknown }).paused).toBeDefined();
    // alice herself.
    await click(approve, "U0ALICE");
    for (let i = 0; i < 100 && ((await (await t.api("alice", `/api/runs/${a.runId}`)).json()) as { paused?: unknown }).paused; i++) await Bun.sleep(10);
    expect(((await (await t.api("alice", `/api/runs/${a.runId}`)).json()) as { paused?: unknown }).paused).toBeUndefined();
    await waitFor(3, replies);
    expect(replies[2].text).toContain("Answered by alice");

    // A person's connection: no link in the channel, a Connect button that answers only its owner.
    const w = await t.start("alice", "Weekly");
    await waitFor(2, posted);
    expect(posted[1].text).not.toContain("Connect: ");
    const connect = posted[1].blocks[1].elements.find((e: { action_id: string }) => e.action_id === "halo_connect_user");
    expect(connect.url).toBeUndefined();
    await click(connect.value, "U0BOB");
    await waitFor(4, replies);
    expect(replies[3].text).toContain("can be connected only by the person who started it");
    expect(replies[3].text).not.toContain("/connect/");
    await click(connect.value, "U0ALICE");
    await waitFor(5, replies);
    expect(replies[4]).toMatchObject({ response_type: "ephemeral" });
    expect(replies[4].text).toContain(`/connect/${w.runId}/Acme?exp=`);
    expect(replies[4].text).toContain("as=user%3Aalice");
  });
});

describe("validate and halo auth", () => {
  test("an invoker connection in a pipeline a schedule or webhook starts is a warning", () => {
    const src = `tool G : OAuth(provider: "google", clientId: "x", as: "invoker")\ntool Drive : REST("https://www.googleapis.com/drive/v3", auth: G)\npipeline Nightly(q: String) -> Result:\n  q |> Drive.files()\npipeline Fine(q: String) -> Result:\n  q |> Drive.files()`;
    const warnings = validate(parse(src), { serviceStarted: ["Nightly"] }).filter((d) => d.severity === "warning").map((d) => d.message);
    expect(warnings).toEqual([`Pipeline "Nightly" is started by a schedule, webhook or watch (halo.json), which runs it as the service, with no person to act as; but Drive uses G, which is as: "invoker". Give it a service connection, or start it from the API or Studio as a user`]);
    expect(validate(parse(src)).filter((d) => d.message.includes("invoker"))).toEqual([]);
  });

  test("halo auth login --user signs in for that user; --user on a service connection is refused", async () => {
    const fake = startFakeOAuth({ account: "alice@example.com" });
    stops.push(() => fake.stop());
    const dir = mkdtempSync(join(tmpdir(), "halo-users-cli-"));
    dirs.push(dir);
    const file = join(dir, "app.halo");
    writeFileSync(file, `${fake.declaration("Acme", `, as: "invoker"`)}\n${fake.declaration("Shared")}\ntool Api : REST("${fake.issuer}/api", auth: Acme)\npipeline P(q: String) -> Result:\n  q |> Api.files()`);
    const out: string[] = [];
    const err: string[] = [];
    const broker = new TokenBroker();
    const browser = async (url: string) => {
      const res = await fetch(url, { redirect: "manual" });
      await fetch(res.headers.get("location")!);
      return true;
    };
    const run = (args: string[], user?: string) => cmdAuth({ positional: args, bools: new Set(), get: (k) => (k === "user" ? user : undefined) }, { project: dir, broker, browser: true, open: browser }, { out: (l) => out.push(l), err: (l) => err.push(l) });
    expect(await run(["login", "Acme", file], "alice")).toBe(0);
    expect(out.join("\n")).toContain("Connected alice@example.com for alice.");
    const settings: Record<string, unknown> = { authorizeUrl: `${fake.issuer}/authorize`, tokenUrl: `${fake.issuer}/token`, clientId: fake.clientId };
    const c = connectionFrom("Acme", (k) => settings[k], dir);
    expect(broker.info({ ...c, user: "alice" })?.account).toBe("alice@example.com");
    expect(broker.info({ ...c, user: "local" })).toBeUndefined();
    expect(await run(["login", "Shared", file], "alice")).toBe(1);
    expect(err.join("\n")).toContain('Shared is a service connection (one token every run shares); --user is for a connection declared as: "invoker"');
  });
});
