/**
 * End to end: the real `halo` CLI against the real registry Worker under `wrangler dev --local`
 * (workerd, Miniflare's D1 and R2), with a fake GitHub (device flow, /user) and DNS over HTTPS
 * served from this process through the Worker's GITHUB_URL / GITHUB_API_URL / DOH_URL vars.
 *
 * Skipped, with a message, when wrangler can't start here. Run on its own with
 * `bun run test:e2e`.
 */

import { afterAll, describe, expect, test } from "bun:test";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { LockfileV2, PackageDoc } from "../src/registry/contract";

const ROOT = resolve(import.meta.dir, "..");
const CONFIG = join(ROOT, "services/registry/wrangler.jsonc");
const FIXTURES = join(ROOT, "test/fixtures");
const tmp = mkdtempSync(join(tmpdir(), "halo-e2e-registry-"));
const STATE = join(tmp, "state");
const HOME = join(tmp, "home");

// ── A fake GitHub (device flow + /user) and DNS over HTTPS ──

const GITHUB_USER = { id: 4242, login: "Acme-Dev" };
let polls = 0;
const github = Bun.serve({
  port: 0,
  hostname: "127.0.0.1",
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/login/device/code") {
      return Response.json({ device_code: `dc-${crypto.randomUUID()}`, user_code: "WXYZ-1234", verification_uri: `${url.origin}/login/device`, expires_in: 900, interval: 0 });
    }
    if (url.pathname === "/login/oauth/access_token") {
      // The first poll waits for the user, as GitHub does; the next one is approved.
      return Response.json(polls++ % 2 === 0 ? { error: "authorization_pending" } : { access_token: "gho_fake", token_type: "bearer" });
    }
    if (url.pathname === "/api/user") {
      return req.headers.get("authorization") === "Bearer gho_fake" ? Response.json(GITHUB_USER) : new Response("no", { status: 401 });
    }
    if (url.pathname === "/dns-query") return Response.json({ Status: 0, Answer: [] });
    return new Response("not found", { status: 404 });
  },
});

// ── wrangler dev ──

async function freePort(): Promise<number> {
  const s = Bun.serve({ port: 0, fetch: () => new Response() });
  const port = s.port!;
  s.stop(true);
  return port;
}

const env = { ...Bun.env, CI: "1", WRANGLER_SEND_METRICS: "false", NO_COLOR: "1", FORCE_COLOR: "0" } as Record<string, string | undefined>;
delete env.HALO_TOKEN;
delete env.HALO_REGISTRY;
delete env.HALO_TOKEN_REGISTRY;

const port = await freePort();
const BASE = `http://127.0.0.1:${port}/`;
let wrangler: ReturnType<typeof Bun.spawn> | undefined;
let wranglerLog = "";
let skipReason: string | undefined;

async function drain(stream: ReadableStream<Uint8Array> | null | undefined) {
  if (!stream) return;
  const decoder = new TextDecoder();
  for await (const chunk of stream) wranglerLog = (wranglerLog + decoder.decode(chunk)).slice(-20_000);
}

async function startWrangler(): Promise<string | undefined> {
  const which = Bun.spawnSync(["bunx", "wrangler", "--version"], { cwd: ROOT, env, stdout: "pipe", stderr: "pipe" });
  if (which.exitCode !== 0) return `wrangler is not available (bunx wrangler --version: ${which.stderr.toString().trim().slice(0, 200)})`;
  const migrate = Bun.spawnSync(["bunx", "wrangler", "d1", "migrations", "apply", "halo-registry", "--local", "--config", CONFIG, "--persist-to", STATE], { cwd: ROOT, env, stdout: "pipe", stderr: "pipe" });
  if (migrate.exitCode !== 0) return `wrangler d1 migrations apply failed: ${(migrate.stderr.toString() || migrate.stdout.toString()).trim().slice(-500)}`;
  const gh = `http://127.0.0.1:${github.port}`;
  const vars = { GITHUB_URL: gh, GITHUB_API_URL: `${gh}/api`, DOH_URL: `${gh}/dns-query`, PUBLIC_URL: BASE.replace(/\/$/, ""), GITHUB_CLIENT_ID: "e2e-client", GITHUB_CLIENT_SECRET: "e2e-secret" };
  wrangler = Bun.spawn(
    [
      "bunx", "wrangler", "dev", "--local", "--config", CONFIG, "--persist-to", STATE,
      "--ip", "127.0.0.1", "--port", String(port), "--inspector-port", String(await freePort()),
      "--show-interactive-dev-session=false", "--log-level", "warn",
      ...Object.entries(vars).flatMap(([k, v]) => ["--var", `${k}:${v}`]),
    ],
    { cwd: ROOT, env, stdout: "pipe", stderr: "pipe" },
  );
  void drain(wrangler.stdout as ReadableStream<Uint8Array>);
  void drain(wrangler.stderr as ReadableStream<Uint8Array>);
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (wrangler.exitCode !== null) return `wrangler dev exited (${wrangler.exitCode}):\n${wranglerLog.slice(-1500)}`;
    try {
      const res = await fetch(`${BASE}v1/index.json`);
      if (res.ok) return undefined;
    } catch {
      // Not listening yet.
    }
    await Bun.sleep(250);
  }
  return `wrangler dev didn't answer on ${BASE} within 60s:\n${wranglerLog.slice(-1500)}`;
}

const started = Date.now();
skipReason = await startWrangler().catch((e: unknown) => `wrangler dev could not start: ${e instanceof Error ? e.message : String(e)}`);
if (skipReason) console.warn(`\n[e2e-registry] SKIPPED: ${skipReason}\n`);

afterAll(async () => {
  if (wrangler && wrangler.exitCode === null) {
    wrangler.kill("SIGTERM");
    await Promise.race([wrangler.exited, Bun.sleep(5000)]);
    if (wrangler.exitCode === null) wrangler.kill("SIGKILL");
  }
  github.stop(true);
  rmSync(tmp, { recursive: true, force: true });
});

// ── The CLI ──

interface Run {
  code: number;
  out: string;
  err: string;
  /** stdout and stderr together. */
  all: string;
}

async function halo(cwd: string, args: string[], extraEnv: Record<string, string> = {}): Promise<Run> {
  const p = Bun.spawn(["bun", join(ROOT, "index.ts"), ...args], {
    cwd,
    env: { ...env, HALO_HOME: HOME, HALO_REGISTRY: BASE, ...extraEnv },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [out, err] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text()]);
  const code = await p.exited;
  return { code, out, err, all: `${out}\n${err}` };
}

async function ok(cwd: string, ...args: string[]): Promise<Run> {
  const r = await halo(cwd, args);
  if (r.code !== 0) throw new Error(`halo ${args.join(" ")} failed (${r.code}):\n${r.all}\n--- wrangler ---\n${wranglerLog.slice(-2000)}`);
  return r;
}

/** A copy of a fixture package with its version (and optionally its README) changed. */
function packageCopy(fixture: string, version: string, readme?: (text: string) => string): string {
  const dir = mkdtempSync(join(tmp, `${fixture}-${version}-`));
  cpSync(join(FIXTURES, "packages", fixture), dir, { recursive: true });
  const manifest = JSON.parse(readFileSync(join(dir, "halo.json"), "utf8"));
  manifest.version = version;
  writeFileSync(join(dir, "halo.json"), JSON.stringify(manifest, null, 2));
  if (readme) writeFileSync(join(dir, "README.md"), readme(readFileSync(join(dir, "README.md"), "utf8")));
  return dir;
}

const lockOf = (dir: string) => JSON.parse(readFileSync(join(dir, "halo.lock"), "utf8")) as LockfileV2;
const doc = async (name: string) => (await (await fetch(`${BASE}v1/packages/${name}.json`)).json()) as PackageDoc;

// ── The test ──

describe.skipIf(!!skipReason)("the CLI against the registry Worker (wrangler dev)", () => {
  test(
    "login, publish, add, install, run, yank, update, deprecate, dist-tags, read-only tokens and the package page",
    async () => {
      const work = mkdtempSync(join(tmp, "work-"));

      // ── Accounts ──
      const login = await ok(work, "login");
      expect(login.all).toContain("WXYZ-1234");
      expect(login.all).toContain("logged in to");
      expect(login.all).toContain("acme-dev");
      const creds = JSON.parse(readFileSync(join(HOME, "credentials.json"), "utf8")) as Record<string, { token: string; login: string }>;
      expect(creds[BASE]?.login).toBe("acme-dev");
      expect(creds[BASE]?.token).toStartWith("halo_");

      const who = await ok(work, "whoami");
      expect(who.out).toContain("acme-dev");
      expect(who.out).toContain("@acme-dev owner");

      expect((await ok(work, "scope", "create", "@acme")).out).toContain("created @acme");

      // ── Publishing: a dependency must be there first ──
      const zendesk = join(FIXTURES, "packages/acme-zendesk");
      const kit = join(FIXTURES, "packages/acme-support-kit");
      const early = await halo(work, ["publish", kit]);
      expect(early.code).toBe(1);
      expect(early.all).toContain("@acme/zendesk: not in this registry");

      expect((await ok(work, "publish", zendesk)).out).toContain("published @acme/zendesk@1.0.0");
      const published = await ok(work, "publish", kit);
      expect(published.out).toContain("published @acme/support-kit@1.2.0");
      // The server computed the permissions: the provider's host and env, and the package's env.
      const kitDoc = await doc("@acme/support-kit");
      expect(kitDoc.versions["1.2.0"]!.exports.pipelines).toEqual(["Triage"]);
      expect(kitDoc.versions["1.2.0"]!.exports.agents).toEqual(["Triager"]);
      expect(kitDoc.versions["1.2.0"]!.permissions.env).toContain("ZENDESK_SUBDOMAIN");

      // A hard-coded model is refused by the CLI before it uploads (the Worker runs the same check).
      const hard = packageCopy("acme-support-kit", "1.2.9");
      writeFileSync(join(hard, "lib/support.halo"), readFileSync(join(hard, "lib/support.halo"), "utf8").replace("[models.fast, temp: 0]", "[openai/gpt-4o]"));
      const refused = await halo(work, ["publish", hard]);
      expect(refused.code).toBe(1);
      expect(refused.all).toContain(`hard-codes the model "openai/gpt-4o"`);

      // ── Finding packages ──
      const search = await ok(work, "search", "zendesk");
      expect(search.out).toContain("@acme/zendesk@1.0.0");
      const info = await ok(work, "info", "@acme/support-kit");
      expect(info.out).toContain("@acme/support-kit@1.2.0");
      expect(info.out).toContain("model slots");
      expect(info.out).toContain("anthropic/claude-haiku-4-5");
      expect(info.out).toContain("Triage");

      // ── Using it in an app ──
      const app = mkdtempSync(join(tmp, "app-"));
      cpSync(join(FIXTURES, "projects/support-app"), app, { recursive: true });
      const added = await ok(app, "add", "@acme/support-kit");
      expect(added.out).toContain("@acme/support-kit@1.2.0");
      expect(added.out).toContain(`use "@acme/support-kit"`);
      expect(lockOf(app).packages["@acme/support-kit"]!.version).toBe("1.2.0");
      expect(lockOf(app).packages["@acme/zendesk"]!.version).toBe("1.0.0");
      rmSync(join(app, ".halo"), { recursive: true, force: true });
      const installed = await ok(app, "install");
      expect(installed.out).toContain("@acme/zendesk@1.0.0");

      const validated = await ok(app, "validate", "main.halo");
      expect(validated.all).toContain("0 error(s), 0 warning(s)");
      const planned = await ok(app, "plan", "main.halo");
      expect(planned.out).toContain("Triager.classify");
      expect(planned.out).toContain("Writer.prompt");

      const run = await ok(app, "run", "main.halo", "--mock", "--mocks", "mocks.json", "--arg", "ticket=Where is my invite?", "--json", "--no-telemetry", "--no-record");
      const result = JSON.parse(run.out) as { status: string; output: unknown };
      expect(result.status).toBe("completed");
      expect(result.output).toBe("Hi! Sorry about the missing invite. Resend it from Settings, Members.");

      // ── Yank: a yanked version is skipped by resolution ──
      expect((await ok(work, "publish", packageCopy("acme-support-kit", "1.2.1"))).out).toContain("published @acme/support-kit@1.2.1");
      const wants121 = await ok(app, "outdated");
      expect(wants121.out).toMatch(/@acme\/support-kit\s+1\.2\.0\s+1\.2\.1\s+1\.2\.1/);
      expect((await ok(work, "yank", "@acme/support-kit@1.2.1", "--reason", "breaks triage")).out).toContain("yanked @acme/support-kit@1.2.1");
      expect((await doc("@acme/support-kit")).versions["1.2.1"]!.yanked).toBe("breaks triage");
      expect((await ok(app, "outdated")).out).toContain("Everything is up to date.");
      expect((await ok(app, "update")).out).toContain("Everything is up to date.");
      expect(lockOf(app).packages["@acme/support-kit"]!.version).toBe("1.2.0");

      // ── A new minor: outdated sees it, update moves to it ──
      const evil = "<script>alert('pwned')</script>";
      expect((await ok(work, "publish", packageCopy("acme-support-kit", "1.3.0", (t) => `${t}\n## New in 1.3\n\n${evil}\n`))).out).toContain("published @acme/support-kit@1.3.0");
      expect((await ok(app, "outdated")).out).toMatch(/@acme\/support-kit\s+1\.2\.0\s+1\.3\.0\s+1\.3\.0/);
      expect((await ok(app, "update")).out).toContain("@acme/support-kit 1.2.0 → 1.3.0");
      expect(lockOf(app).packages["@acme/support-kit"]!.version).toBe("1.3.0");
      expect((await ok(app, "run", "main.halo", "--mock", "--mocks", "mocks.json", "--arg", "ticket=x", "--json", "--no-telemetry", "--no-record")).out).toContain("Resend it from Settings");

      // ── Deprecate and dist-tags ──
      expect((await ok(work, "deprecate", "@acme/support-kit@<1.3.0", "Use", "1.3")).out).toContain("deprecated @acme/support-kit@<1.3.0: Use 1.3");
      const old = await doc("@acme/support-kit");
      expect(old.versions["1.2.0"]!.deprecated).toBe("Use 1.3");
      expect(old.versions["1.3.0"]!.deprecated).toBeUndefined();
      expect((await ok(work, "info", "@acme/support-kit@1.2.0")).out).toContain("deprecated: Use 1.3");

      await ok(work, "dist-tag", "add", "@acme/support-kit@1.2.0", "stable");
      expect((await ok(work, "dist-tag", "ls", "@acme/support-kit")).out).toContain("stable: 1.2.0");
      await ok(work, "dist-tag", "rm", "@acme/support-kit", "stable");
      const tags = await ok(work, "dist-tag", "ls", "@acme/support-kit");
      expect(tags.out).not.toContain("stable");
      expect(tags.out).toContain("latest: 1.3.0");

      // ── Tokens: a read-only token can read but not publish ──
      const created = await ok(work, "token", "create", "--name", "ci-read", "--read-only");
      const readOnly = created.out.split("\n").find((l) => l.startsWith("halo_"))!;
      expect(readOnly).toBeDefined();
      const listed = await ok(work, "token", "list");
      expect(listed.out).toContain("ci-read");
      expect(listed.out).toContain("read only");
      const roWho = await halo(work, ["whoami"], { HALO_TOKEN: readOnly, HALO_TOKEN_REGISTRY: BASE });
      expect(roWho.code).toBe(0);
      expect(roWho.out).toContain("(read only)");
      const roPublish = await halo(work, ["publish", packageCopy("acme-support-kit", "1.3.1")], { HALO_TOKEN: readOnly, HALO_TOKEN_REGISTRY: BASE });
      expect(roPublish.code).toBe(1);
      expect(roPublish.all).toContain("403");
      expect(roPublish.all).toContain("read-only");
      expect((await doc("@acme/support-kit")).versions["1.3.1"]).toBeUndefined();

      // ── Two publishes of one version at once: one wins, and the file served is the winner's ──
      const { pack } = await import("../src/registry/format");
      const a = pack(packageCopy("acme-support-kit", "1.4.0", (t) => `${t}\nA`)).bytes;
      const b = pack(packageCopy("acme-support-kit", "1.4.0", (t) => `${t}\nB`)).bytes;
      const put = (bytes: Uint8Array) =>
        fetch(`${BASE}v1/packages/@acme/support-kit`, { method: "PUT", headers: { authorization: `Bearer ${creds[BASE]!.token}`, "content-type": "application/vnd.halo.package+json" }, body: bytes });
      const raced = await Promise.all([put(a), put(b)]);
      expect(raced.map((r) => r.status).sort()).toEqual([201, 409]);
      const winner = (await raced.find((r) => r.status === 201)!.json()) as { sha256: string; url: string };
      const served = new Uint8Array(await (await fetch(`${BASE}v1/files/@acme/support-kit/1.4.0.halotool`)).arrayBuffer());
      expect(new Bun.CryptoHasher("sha256").update(served).digest("hex")).toBe(winner.sha256);
      expect((await doc("@acme/support-kit")).versions["1.4.0"]!.sha256).toBe(winner.sha256);
      // The publish response's url is the version's page.
      expect(winner.url).toBe(`${BASE}@acme/support-kit/v/1.4.0`);
      expect((await fetch(winner.url)).status).toBe(200);

      // ── A hosted package: interfaces ship, sources don't, and the page says where inputs go ──
      const hostedPub = await ok(work, "publish", join(FIXTURES, "packages/acme-hosted-replies"));
      expect(hostedPub.out).toContain("published @acme/hosted-replies@1.0.0");
      const hostedDoc = await doc("@acme/hosted-replies");
      const hv = hostedDoc.versions["1.0.0"]!;
      expect(hv.hosted).toEqual({ endpoint: "http://localhost:4573", pipelines: ["DraftReply"] });
      expect(hv.permissions.hosted).toEqual(["localhost:4573"]);
      expect(hv.permissions.env).toContain("ACME_REPLIES_KEY");
      const hostedFile = JSON.parse(await (await fetch(`${BASE}v1/files/@acme/hosted-replies/1.0.0.halotool`)).text()) as { files: Record<string, string>; hosted: Record<string, { params: unknown[] }> };
      expect(Object.keys(hostedFile.files)).not.toContain("hosted/draft.halo");
      expect(hostedFile.hosted.DraftReply!.params).toEqual([{ name: "ticket", type: "String" }, { name: "tone", type: "String" }]);
      const hostedPage = await (await fetch(`${BASE}@acme/hosted-replies`)).text();
      expect(hostedPage).toContain(`<span class="badge hosted">Hosted by localhost:4573</span>`);
      expect(hostedPage).toContain("Sends your inputs to");
      expect(hostedPage).toContain("ACME_REPLIES_KEY");

      // ── The package page ──
      expect((await fetch(`${BASE}@acme/support-kit`)).status).toBe(200);
      const pageRes = await fetch(`${BASE}@acme/support-kit/v/1.3.0`);
      expect(pageRes.status).toBe(200);
      const page = await pageRes.text();
      expect(page).toContain("@acme/support-kit");
      expect(page).toContain("ZENDESK_SUBDOMAIN");
      expect(page).toContain("models.fast");
      expect(page).toContain("New in 1.3");
      expect(page).not.toContain(evil);
      expect(page).toContain("&lt;script&gt;");
      // The version page a publish answers with exists, and the file downloads.
      expect((await fetch(`${BASE}@acme/support-kit/v/1.2.0`)).status).toBe(200);
      expect((await fetch(`${BASE}v1/files/@acme/support-kit/1.3.0.halotool`)).headers.get("etag")).toBe(`"${(await doc("@acme/support-kit")).versions["1.3.0"]!.sha256}"`);

      console.log(`[e2e-registry] wrangler start to finish: ${((Date.now() - started) / 1000).toFixed(1)}s`);
    },
    180_000,
  );
});
