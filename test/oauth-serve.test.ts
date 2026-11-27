/**
 * Connecting a paused run's OAuth connection under `halo serve`: the signed, single-use,
 * short-lived /connect link, the callback that stores the token and resumes the run, Studio's
 * API, and the Slack announcement. Against the fake server in test/fixtures/oauth-server.ts.
 */

import { test, expect, describe, afterAll } from "bun:test";
import { createHmac } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, statSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startServer, type HaloServer, type ServeOptions } from "../src/serve/server";
import { TokenBroker } from "../src/runtime/oauth";
import { startFakeOAuth, type FakeOAuth } from "./fixtures/oauth-server";

const TOKEN = "serve-token-for-tests";
const dirs: string[] = [];
const stops: Array<() => unknown> = [];
afterAll(async () => {
  for (const s of stops) await s();
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});
const quiet = { log() {}, warn() {}, error() {} };
const auth = { Authorization: `Bearer ${TOKEN}` };

async function setup(extra: Partial<ServeOptions> = {}) {
  const fake = startFakeOAuth({ account: "ops@example.com" });
  stops.push(() => fake.stop());
  const dir = mkdtempSync(join(tmpdir(), "halo-oauth-serve-"));
  dirs.push(dir);
  await Bun.write(
    join(dir, "app.halo"),
    `${fake.declaration("Acme")}
tool Api : REST("${fake.issuer}/api", auth: Acme)
pipeline Weekly(q: String) -> Result:
  |! yield(connect: Acme, msg: "Allow read access to Acme?")
  |> Api.files(q: q)`,
  );
  const server: HaloServer = await startServer({ files: [join(dir, "app.halo")], root: dir, port: 0, stateDir: join(dir, ".halo"), scheduler: false, logger: quiet, env: {}, token: TOKEN, runtime: { broker: new TokenBroker() }, ...extra });
  stops.push(() => server.stop());
  const start = async () => {
    const res = await fetch(`${server.url}/api/pipelines/Weekly/runs`, { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({ args: { q: "x" }, wait: true }) });
    return (await res.json()) as { runId: string; status: string };
  };
  const detail = async (runId: string) => (await (await fetch(`${server.url}/api/runs/${runId}`, { headers: auth })).json()) as { running: boolean; paused?: { waitingFor: string; connectUrl?: string; connection?: string; message?: string } };
  const pauseId = (runId: string) => JSON.parse(readFileSync(join(dir, ".halo", "runs", `${runId}.json`), "utf8")).meta.paused.id as string;
  return { fake, dir, server, start, detail, pauseId };
}

/** A person's browser on the provider's consent page: approve, and come back to the callback. */
async function consent(authorizeUrl: string) {
  const back = (await fetch(authorizeUrl, { redirect: "manual" })).headers.get("location")!;
  return fetch(back);
}

describe("/connect", () => {
  test("a run waiting for a connection gets a link; the callback stores the token and the run goes on", async () => {
    const t = await setup();
    const run = await t.start();
    expect(run.status).toBe("paused");
    const d = await t.detail(run.runId);
    expect(d.paused).toMatchObject({ waitingFor: "connect:Acme", connection: "Acme" });
    expect(d.paused!.message).toMatch(/^Allow read access to Acme\?/);
    const link = d.paused!.connectUrl!;
    expect(link).toMatch(new RegExp(`^${t.server.url}/connect/${run.runId}/Acme\\?exp=\\d+&sig=[0-9a-f]{32}$`));

    // Opening it shows what it does; it isn't spent by being looked at (a link preview).
    const page = await fetch(link);
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain(`Continue to ${new URL(t.fake.issuer).host}`);
    expect(html).toContain("Whoever opens this link chooses the account this run acts as");
    expect(html).toContain("only for runs this server's operator started");

    // Going on sends the person to the provider, with PKCE and state, back to /connect/callback.
    const go = await fetch(link, { method: "POST", redirect: "manual" });
    expect(go.status).toBe(303);
    const authorize = new URL(go.headers.get("location")!);
    expect(authorize.origin + authorize.pathname).toBe(`${t.fake.issuer}/authorize`);
    expect(authorize.searchParams.get("redirect_uri")).toBe(`${t.server.url}/connect/callback`);
    expect(authorize.searchParams.get("code_challenge_method")).toBe("S256");
    // The pending sign-in is kept 0600 in the state folder.
    const pending = readdirSync(join(t.dir, ".halo", "connect")).filter((f) => f !== "used.json");
    expect(pending).toHaveLength(1);
    expect(statSync(join(t.dir, ".halo", "connect", pending[0]!)).mode & 0o777).toBe(0o600);

    // Single use.
    expect((await fetch(link, { method: "POST", redirect: "manual" })).status).toBe(403);

    const done = await consent(authorize.toString());
    expect(done.status).toBe(200);
    expect(await done.text()).toContain("Connected Acme");
    // The pending state is gone; the run finishes.
    expect(readdirSync(join(t.dir, ".halo", "connect")).filter((f) => f !== "used.json")).toHaveLength(0);
    for (let i = 0; i < 100; i++) {
      const now = await t.detail(run.runId);
      if (!now.paused && !now.running) break;
      await Bun.sleep(20);
    }
    expect((await t.detail(run.runId)).paused).toBeUndefined();
    expect(t.fake.state.requests.some((r) => r.path === "/api/files")).toBe(true);
    // No token anywhere in the state folder.
    const all = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? all(join(d, e.name)) : [join(d, e.name)]));
    const text = all(join(t.dir, ".halo")).map((f) => readFileSync(f, "latin1")).join("\n");
    for (const tok of [...t.fake.accessTokens(), ...t.fake.refreshTokens()]) expect(text).not.toContain(tok);
  });

  test("refused: an expired link, an approval signature, a link for another connection, a forged state", async () => {
    const t = await setup();
    const run = await t.start();
    const pause = t.pauseId(run.runId);
    const sign = (s: string) => createHmac("sha256", TOKEN).update(s).digest("hex").slice(0, 32);
    const old = Date.now() - 1000;
    const expired = await fetch(`${t.server.url}/connect/${run.runId}/Acme?exp=${old}&sig=${sign(`connect:${run.runId}:${pause}:Acme:${old}`)}`, { method: "POST", redirect: "manual" });
    expect(expired.status).toBe(403);
    expect(await expired.text()).toContain("expired");
    // An approval link's signature is for approve:..., so it can't open a connect link.
    const exp = Date.now() + 60_000;
    expect((await fetch(`${t.server.url}/connect/${run.runId}/Acme?exp=${exp}&sig=${sign(`approve:${run.runId}:${pause}`)}`, { method: "POST", redirect: "manual" })).status).toBe(403);
    expect((await fetch(`${t.server.url}/connect/${run.runId}/Other?exp=${exp}&sig=${sign(`connect:${run.runId}:${pause}:Other:${exp}`)}`, { method: "POST", redirect: "manual" })).status).toBe(403);
    // A callback with a state nobody issued.
    const forged = await fetch(`${t.server.url}/connect/callback?code=x&state=forged`);
    expect(forged.status).toBe(403);
    // A real link, then a callback whose state was tampered with: refused, and nothing stored.
    const link = (await t.detail(run.runId)).paused!.connectUrl!;
    const go = await fetch(link, { method: "POST", redirect: "manual" });
    const back = new URL((await fetch(go.headers.get("location")!, { redirect: "manual" })).headers.get("location")!);
    back.searchParams.set("state", "tampered");
    expect((await fetch(back)).status).toBe(403);
    expect((await t.detail(run.runId)).paused?.waitingFor).toBe("connect:Acme");
  });

  test("a run the operator didn't start (a webhook's) is offered no link", async () => {
    const t = await setup();
    const runId = t.server.start("Weekly", { q: "x" }, "webhook /hooks/x");
    for (let i = 0; i < 100 && !(await t.detail(runId)).paused; i++) await Bun.sleep(10);
    const d = await t.detail(runId);
    expect(d.paused?.waitingFor).toBe("connect:Acme");
    expect(d.paused?.connectUrl).toBeUndefined();
  });

  test("the Slack announcement has a Connect button next to Approve and Reject", async () => {
    const posted: Array<{ text: string; blocks?: Array<{ elements?: Array<{ text: { text: string }; url?: string }> }> }> = [];
    const fetchSpy = (async (url: string | URL | Request, init?: RequestInit) => {
      if (String(url).startsWith("https://hooks.slack.test/")) {
        posted.push(JSON.parse(String(init?.body)));
        return new Response("ok");
      }
      return fetch(url, init);
    }) as typeof fetch;
    const t = await setup({ notify: { slack: "https://hooks.slack.test/T1" }, slack: { signingSecret: "slack-secret" }, fetch: fetchSpy });
    const run = await t.start();
    for (let i = 0; i < 100 && !posted.length; i++) await Bun.sleep(10);
    const message = posted[0]!;
    expect(message.text).toContain("Connect: ");
    const buttons = message.blocks![1]!.elements!;
    expect(buttons.map((b) => b.text.text)).toEqual(["Approve", "Reject", "Connect Acme"]);
    expect(buttons[2]!.url).toContain(`/connect/${run.runId}/Acme?exp=`);
  });
});
