/**
 * Hosted exports end to end: the fixture @acme/hosted-replies is published to a folder
 * registry (interfaces in, hosted source out), served with `halo serve --package` in
 * process with two consumer keys, installed into a second project, linked and run.
 */

import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { checkLinked, link } from "../src/linker/index";
import { linkFile } from "../src/linker/node";
import { HaloRuntime, type MockRequest } from "../src/runtime/runtime";
import { formatPlan, plan } from "../src/plan";
import { startServer, type HaloServer } from "../src/serve/server";
import { runPackageCommand } from "../src/registry/cli";
import { installProject, describeInstall } from "../src/registry/install";
import { packWithHosted, pausePath } from "../src/registry/hosted";
import { readPackage, PackageError } from "../src/registry/format";
import { HOSTED_PACKAGE_HEADER, type LockfileV2, type PackageFileV2, type PackageManifest } from "../src/registry/contract";
import { parseKeyList } from "../src/serve/package";

const root = resolve(`${import.meta.dir}/..`);
const FIXTURE = join(root, "test/fixtures/packages/acme-hosted-replies");
const quiet = { log() {}, warn() {}, error() {} };
const tmp = mkdtempSync(join(tmpdir(), "halo-hosted-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const PKG = "@acme/hosted-replies";
const KEYS = { acme: "key-acme-123", globex: "key-globex-456" };

/** A copy of the fixture whose endpoint is this test's server. */
function packageCopy(port: number, edit?: (m: PackageManifest) => void): string {
  const dir = mkdtempSync(join(tmp, "pkg-"));
  cpSync(FIXTURE, dir, { recursive: true });
  const m = JSON.parse(readFileSync(join(dir, "halo.json"), "utf8")) as PackageManifest;
  m.hosted!.endpoint = `http://localhost:${port}`;
  edit?.(m);
  writeFileSync(join(dir, "halo.json"), JSON.stringify(m, null, 2));
  return dir;
}

/** A hosted package in a temp folder from files. */
function hostedPackage(files: Record<string, string>, hostedExports = ["Draft"]): string {
  const dir = mkdtempSync(join(tmp, "pause-"));
  const manifest = {
    name: "@acme/pausing",
    version: "1.0.0",
    description: "test",
    exports: ["lib/main.halo"],
    hosted: { endpoint: "http://localhost:1", auth: { type: "bearer", env: "K" }, exports: hostedExports },
  };
  for (const [path, text] of Object.entries({ "halo.json": JSON.stringify(manifest), "README.md": "# p\n", "lib/main.halo": "schema S {\n  a: String,\n}\n", ...files })) {
    mkdirSync(join(dir, path, ".."), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
  return dir;
}

const drafted = (ticket: string, tone: string) => ({ reply: { text: `Sorry about "${ticket}"`, tone }, confidence: 0.9 });

let server: HaloServer;
let pkgDir: string;
let registry: string;
let app: string;
let endpoint: string;
const published: string[] = [];

beforeAll(async () => {
  // The publisher's server first (port 0), so the package can name its address.
  const placeholder = packageCopy(4573);
  server = await startServer({
    package: placeholder,
    port: 0,
    packageKeys: KEYS,
    stateDir: join(tmp, "publisher-state"),
    env: {},
    logger: quiet,
    scheduler: false,
    onRuntime: (rt) =>
      rt.mockAll({
        "Drafter.draft": (req: MockRequest) => {
          const prompt = req.prompt ?? "";
          const tone = /Draft a (\w+) reply/.exec(prompt)?.[1] ?? "?";
          const ticket = /ticket: (.*)$/s.exec(prompt)?.[1] ?? "?";
          return JSON.stringify(drafted(ticket, tone));
        },
      }),
  });
  endpoint = server.url.replace("127.0.0.1", "localhost");
  pkgDir = packageCopy(server.port);

  registry = mkdtempSync(join(tmp, "registry-"));
  const code = await runPackageCommand("publish", [pkgDir, "--registry", registry], { cwd: tmp, log: (l) => published.push(l) });
  expect(code).toBe(0);

  app = mkdtempSync(join(tmp, "app-"));
  writeFileSync(join(app, "halo.json"), JSON.stringify({ models: { fast: "anthropic/claude-haiku-4-5" } }));
  writeFileSync(
    join(app, "main.halo"),
    `use "${PKG}" { DraftReply, Tag, Draft }\n\npipeline Answer(ticket: String) -> Draft:\n  ticket |> DraftReply(ticket: ticket, tone: "warm") as draft\n`,
  );
});

afterAll(async () => {
  await server?.stop();
});

describe("publishing a hosted package", () => {
  test("the package file has the interface and not the hosted source", () => {
    const file = join(registry, "v1/files/@acme/hosted-replies/1.0.0.halotool");
    const raw = JSON.parse(readFileSync(file, "utf8")) as PackageFileV2;
    expect(Object.keys(raw.files).sort()).toEqual(["README.md", "halo.json", "lib/replies.halo"]);
    const all = Object.values(raw.files).map((b) => Buffer.from(b, "base64").toString("utf8")).join("\n");
    expect(all).not.toContain("pipeline DraftReply");
    expect(all).not.toContain("claude-sonnet-4-5");
    expect(raw.hosted).toEqual({
      DraftReply: {
        description: "Drafts a reply to a support ticket in the tone you ask for.",
        params: [
          { name: "ticket", type: "String" },
          { name: "tone", type: "String" },
        ],
        returns: "Draft",
        schemas: { Draft: { reply: "Reply", confidence: "Number" }, Reply: { text: "String", tone: "String" } },
      },
    });
    expect(readPackage(readFileSync(file)).hosted?.DraftReply?.returns).toBe("Draft");
    // The registry's doc lists the hosted pipeline and its host.
    const doc = JSON.parse(readFileSync(join(registry, "v1/packages/@acme/hosted-replies.json"), "utf8"));
    expect(doc.versions["1.0.0"].hosted).toEqual({ endpoint: `http://localhost:${server.port}`, pipelines: ["DraftReply"] });
    expect(doc.versions["1.0.0"].permissions.hosted).toEqual([`localhost:${server.port}`]);
  });

  test("publish --dry-run shows the interfaces and the host", async () => {
    const lines: string[] = [];
    expect(await runPackageCommand("publish", [pkgDir, "--registry", mkdtempSync(join(tmp, "dry-")), "--dry-run"], { cwd: tmp, log: (l) => lines.push(l) })).toBe(0);
    const out = lines.join("\n");
    expect(out).toContain(`hosted on localhost:${server.port} (http://localhost:${server.port}; consumers send Authorization: Bearer $ACME_REPLIES_KEY)`);
    expect(out).toContain("DraftReply(ticket: String, tone: String) -> Draft  // Drafts a reply");
    expect(out).toContain("schema Draft { reply: Reply, confidence: Number }");
    expect(out).toContain("Dry run");
    expect(published.join("\n")).toContain("published @acme/hosted-replies@1.0.0");
  });

  test("a hosted pipeline that can pause is refused, by publish and by serve", async () => {
    const yielding = hostedPackage({
      "hosted/draft.halo": `agent A [openai/gpt-4o]\n\npipeline Review(x: String) -> Result:\n  x |! yield("ok?")\n\npipeline Draft(x: String) -> Result:\n  x |> A.run("hi") |> Review()\n`,
    });
    expect(() => packWithHosted(yielding)).toThrow(/hosted pipeline Draft can pause \(Draft → Review → \|! yield\)/);
    await expect(startServer({ package: yielding, port: 0, packageKeys: KEYS, stateDir: join(tmp, "s1"), env: {}, logger: quiet, scheduler: false })).rejects.toThrow(/can pause/);

    const listening = hostedPackage({ "hosted/draft.halo": `pipeline Draft(x: String) -> Result:\n  x ~> listen(Payment)\n` });
    expect(() => packWithHosted(listening)).toThrow(/~> listen\(Payment\)/);

    const approving = hostedPackage({
      "hosted/draft.halo": `tool Sh : Bash()\npolicy Ask : ApproveTools(Sh)\nagent A [openai/gpt-4o]\n  equips Sh\n  requires Ask\n\npipeline Draft(x: String) -> Result:\n  x |> A.run("hi", tools: [Sh])\n`,
    });
    expect(() => packWithHosted(approving)).toThrow(/policy Ask asks for approval/);
  });

  test("a hosted pipeline whose source would ship is refused", () => {
    const shipped = hostedPackage({ "lib/main.halo": `pipeline Draft(x: String) -> Result:\n  x |> System.Value(x)\n` });
    expect(() => packWithHosted(shipped)).toThrow(PackageError);
    expect(() => packWithHosted(shipped)).toThrow(/declared in lib\/main\.halo, which ships to consumers/);
    const missing = hostedPackage({});
    expect(() => packWithHosted(missing)).toThrow(/isn't declared in any \.halo file/);
  });

  test("pausePath follows calls", () => {
    const l = link("/p/main.halo", { readFile: (p) => (p === "/p/main.halo" ? `pipeline A(x: String):\n  x |> B()\n\npipeline B(x: String):\n  x |> System.Value(x)\n` : undefined) });
    expect(pausePath(l.program, "A")).toBeUndefined();
  });
});

describe("consuming a hosted pipeline", () => {
  let lockText = "";
  let addOut = "";

  beforeAll(async () => {
    const lines: string[] = [];
    expect(await runPackageCommand("add", [PKG, "--registry", registry], { cwd: app, log: (l) => lines.push(l) })).toBe(0);
    addOut = lines.join("\n");
    lockText = readFileSync(join(app, "halo.lock"), "utf8");
  });

  test("halo add says plainly where inputs go and which key it reads; the lockfile records it", async () => {
    expect(addOut).toContain(`hosted: DraftReply runs on localhost:${server.port}, not on this machine. This package sends your inputs to localhost:${server.port} and reads ACME_REPLIES_KEY`);
    const lock = JSON.parse(lockText) as LockfileV2;
    expect(lock.packages[PKG]!.permissions.hosted).toEqual([`localhost:${server.port}`]);
    expect(lock.packages[PKG]!.permissions.env).toContain("ACME_REPLIES_KEY");
    // halo install says it too.
    const report = await installProject({ root: app, registry });
    expect(describeInstall(report).join("\n")).toContain(`This package sends your inputs to localhost:${server.port}`);
    // halo info, from the registry's doc.
    const info: string[] = [];
    expect(await runPackageCommand("info", [PKG, "--registry", registry], { cwd: app, log: (l) => info.push(l) })).toBe(0);
    expect(info.join("\n")).toContain(`This package sends your inputs to localhost:${server.port} and reads ACME_REPLIES_KEY`);
  });

  test("the installed resolver gives the linker the interfaces; the call goes to the publisher", async () => {
    const linked = linkFile(join(app, "main.halo"));
    expect(checkLinked(linked)).toEqual([]);
    expect(linked.imports.DraftReply).toMatchObject({ kind: "pipeline", from: PKG });
    expect(linked.imports.Draft).toMatchObject({ kind: "schema" });

    const requests: Array<{ url: string; headers: Headers; body: unknown }> = [];
    const spy = (async (input: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(input), headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) });
      return fetch(input, init);
    }) as typeof fetch;
    const events: string[] = [];
    const rt = new HaloRuntime({ logger: quiet, env: { ACME_REPLIES_KEY: KEYS.acme }, fetch: spy, onEvent: (e) => e.type === "tool" && events.push(`${rt.displayName(e.tool)}.${e.method}`) }).load(linked.program);
    const r = await rt.run("Answer", { ticket: "My invite never came" });
    expect(r.status).toBe("completed");
    expect(r.output).toEqual(drafted("My invite never came", "warm"));
    expect(r.context.data.draft).toEqual(drafted("My invite never came", "warm"));

    expect(requests).toHaveLength(1);
    const req = requests[0]!;
    expect(req.url).toBe(`http://localhost:${server.port}/api/pipelines/DraftReply/runs`);
    expect(req.headers.get(HOSTED_PACKAGE_HEADER)).toBe(`${PKG}@1.0.0`);
    expect(req.headers.get("authorization")).toBe(`Bearer ${KEYS.acme}`);
    expect(req.body).toEqual({ args: { ticket: "My invite never came", tone: "warm" }, wait: true });
    // A tool call, as people name it.
    expect(r.context.meta.calls.map((c) => [c.kind, c.target])).toEqual([["tool", "DraftReply.run"]]);
    expect(events).toEqual(["DraftReply.run"]);

    // A second consumer; usage is counted per key.
    const rt2 = new HaloRuntime({ logger: quiet, env: { ACME_REPLIES_KEY: KEYS.globex } }).load(linked.program);
    expect((await rt2.run("Answer", { ticket: "Refund?" })).status).toBe("completed");
    expect((await rt2.run("Answer", { ticket: "Refund again?" })).status).toBe("completed");
    const usage = server.usage();
    expect(usage.map((u) => [u.key, u.runs, u.failed])).toEqual([
      ["acme", 1, 0],
      ["globex", 2, 0],
    ]);
  });

  test("a wrong key, a missing key, and a version the server no longer runs", async () => {
    const linked = linkFile(join(app, "main.halo"));
    const wrong = new HaloRuntime({ logger: quiet, env: { ACME_REPLIES_KEY: "nope" } }).load(linked.program);
    await expect(wrong.run("Answer", { ticket: "x" })).rejects.toThrow(`refused the key in ACME_REPLIES_KEY (401)`);

    const none = new HaloRuntime({ logger: quiet, env: {} }).load(linked.program);
    await expect(none.run("Answer", { ticket: "x" })).rejects.toThrow(/set ACME_REPLIES_KEY/);

    // The consumer has 0.9.0 installed; the server runs 1.0.0.
    const old = { ...JSON.parse(readFileSync(join(pkgDir, "halo.json"), "utf8")), version: "0.9.0" } as PackageManifest;
    const hosted = JSON.parse(readFileSync(join(registry, "v1/files/@acme/hosted-replies/1.0.0.halotool"), "utf8")).hosted;
    const l = link("/c/main.halo", {
      readFile: (p) => (p === "/c/main.halo" ? `use "${PKG}" { DraftReply }\n\npipeline Go(t: String):\n  t |> DraftReply(ticket: t, tone: "calm")\n` : undefined),
      resolver: { resolve: (name) => (name === PKG ? { name, version: "0.9.0", dir: "/nowhere", manifest: { ...old, exports: [] }, hosted } : undefined) },
    });
    expect(checkLinked(l).filter((d) => d.severity === "error")).toEqual([]);
    const gone = new HaloRuntime({ logger: quiet, env: { ACME_REPLIES_KEY: KEYS.acme } }).load(l.program);
    const err = await gone.run("Go", { t: "x" }).catch((e: Error) => e);
    expect(String(err)).toContain(`no longer serves ${PKG}@0.9.0`);
    expect(String(err)).toContain(`halo update ${PKG}`);
    expect((err as { status?: number }).status).toBe(410);
  });

  test("the server's answers: 401, 400, 410, 404, and only hosted pipelines", async () => {
    const post = (path: string, headers: Record<string, string>, body: unknown = { args: { ticket: "t", tone: "warm" }, wait: true }) =>
      fetch(`${endpoint}${path}`, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
    const auth = { Authorization: `Bearer ${KEYS.acme}` };
    const header = { [HOSTED_PACKAGE_HEADER]: `${PKG}@1.0.0` };

    expect((await post("/api/pipelines/DraftReply/runs", header)).status).toBe(401);
    expect((await post("/api/pipelines/DraftReply/runs", { ...header, Authorization: "Bearer nope" })).status).toBe(401);

    const noHeader = await post("/api/pipelines/DraftReply/runs", auth);
    expect(noHeader.status).toBe(400);
    expect(await noHeader.json()).toMatchObject({ code: "missing_package_header" });

    const old = await post("/api/pipelines/DraftReply/runs", { ...auth, [HOSTED_PACKAGE_HEADER]: `${PKG}@0.9.0` });
    expect(old.status).toBe(410);
    expect(await old.json()).toMatchObject({ code: "version_gone", error: expect.stringContaining("no longer served") });

    expect((await post("/api/pipelines/DraftReply/runs", { ...auth, [HOSTED_PACKAGE_HEADER]: "@other/pkg@1.0.0" })).status).toBe(400);

    // Internal is in the same file but not in hosted.exports.
    expect((await post("/api/pipelines/Internal/runs", { ...auth, ...header }, { args: { note: "x" }, wait: true })).status).toBe(404);
    const list = await fetch(`${endpoint}/api/pipelines`, { headers: auth });
    expect(((await list.json()) as Array<{ name: string }>).map((p) => p.name)).toEqual(["DraftReply"]);
    expect(server.pipelines).toEqual(["DraftReply"]);

    // A consumer key runs pipelines and nothing else.
    expect((await fetch(`${endpoint}/api/runs`, { headers: auth })).status).toBe(403);
    expect((await fetch(`${endpoint}/api/usage`, { headers: auth })).status).toBe(403);

    const ok = await post("/api/pipelines/DraftReply/runs", { ...auth, ...header });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ status: "completed", output: drafted("t", "warm") });

    // Missing arguments are the caller's mistake.
    const bad = await post("/api/pipelines/DraftReply/runs", { ...auth, ...header }, { args: { ticket: "t" }, wait: true });
    expect(bad.status).toBe(400);
  });

  test("mocks work offline, by the pipeline's name", async () => {
    const linked = linkFile(join(app, "main.halo"));
    const offline = (() => Promise.reject(new Error("offline"))) as unknown as typeof fetch;
    for (const key of ["DraftReply", "DraftReply.run"]) {
      const rt = new HaloRuntime({ logger: quiet, env: {}, fetch: offline }).load(linked.program);
      rt.mockAll({ [key]: (req: MockRequest) => drafted(String(req.named.ticket), String(req.named.tone)) });
      const r = await rt.run("Answer", { ticket: "offline" });
      expect(r.output).toEqual(drafted("offline", "warm"));
      expect(r.context.meta.calls[0]).toMatchObject({ target: "DraftReply.run", mocked: true });
    }
  });

  test("halo plan shows one external call to the publisher's host", () => {
    const linked = linkFile(join(app, "main.halo"));
    const rt = new HaloRuntime({ logger: quiet });
    const p = plan(linked.program, "Answer", { providerInfo: (provider) => rt.toolProviderInfo(provider) });
    expect(p.steps.map((s) => [s.at, s.label, s.kind])).toEqual([
      ["1", "DraftReply(...)", "pipeline"],
      ["1.0", "DraftReply.run", "tool"],
    ]);
    expect(p.steps[1]!.effects).toEqual([{ target: "DraftReply.run", effect: "external" }]);
    const text = formatPlan(p);
    expect(text).toContain(`hosted by ${PKG}: sends its inputs to localhost:${server.port} (key from ACME_REPLIES_KEY)`);
    expect(text).toContain("Acts on the world without asking: DraftReply.run");
    expect(text).not.toContain("#");
  });

  test("arguments are checked against the interface when linking", () => {
    const check = (call: string) => {
      writeFileSync(join(app, "bad.halo"), `use "${PKG}" { DraftReply }\n\npipeline Go(t: String):\n  t |> ${call}\n`);
      return checkLinked(linkFile(join(app, "bad.halo"))).filter((d) => d.severity === "error").map((d) => d.message);
    };
    expect(check(`DraftReply(ticket: t, tone: "warm")`)).toEqual([]);
    expect(check(`DraftReply(ticket: t, mood: "warm")`)).toEqual([
      `Pipeline "Go": DraftReply has no parameter "mood": DraftReply(ticket: String, tone: String)`,
      `Pipeline "Go": DraftReply(...) needs "tone": DraftReply(ticket: String, tone: String) runs on the publisher's server, which refuses a call without them`,
    ]);
    expect(check(`DraftReply(t, "a", "b")`)[0]).toContain("DraftReply takes 2 arguments, but 3 are given");
    expect(check(`DraftReply(ticket: 3, tone: "warm")`)[0]).toContain(`passes an Integer to "ticket", which is a String`);
    rmSync(join(app, "bad.halo"));
  });

  test("halo validate and halo plan from the CLI", () => {
    const cli = (...args: string[]) => {
      const p = Bun.spawnSync(["bun", join(root, "index.ts"), ...args], { cwd: app, env: { ...Bun.env, NO_COLOR: "1" } });
      return { code: p.exitCode, out: p.stdout.toString(), err: p.stderr.toString() };
    };
    const v = cli("validate", "main.halo");
    expect(v.err).toBe("");
    expect(v.out).toContain("0 error(s)");
    const p = cli("plan", "main.halo");
    expect(p.out).toContain("calls DraftReply.run: external");
    expect(p.out).not.toContain("#");
  }, 30_000);
});

describe("serving a package", () => {
  test("refuses to start without consumer keys, or for a package that isn't hosted", async () => {
    await expect(startServer({ package: pkgDir, port: 0, stateDir: join(tmp, "nokeys"), env: {}, logger: quiet, scheduler: false })).rejects.toThrow(/no consumer keys/);
    await expect(startServer({ package: join(root, "test/fixtures/packages/acme-support-kit"), port: 0, packageKeys: KEYS, stateDir: join(tmp, "nothosted"), env: {}, logger: quiet, scheduler: false })).rejects.toThrow(/has no "hosted"/);
  });

  test("keys from HALO_PACKAGE_KEYS and a keys file (hashes too), re-read when it changes", async () => {
    expect(parseKeyList("a=1, b:2")).toEqual({ a: "1", b: "2" });
    expect(() => parseKeyList("oops")).toThrow(/<consumer id>=<key>/);
    const stateDir = mkdtempSync(join(tmp, "keys-"));
    const hash = new Bun.CryptoHasher("sha256").update("file-key").digest("hex");
    writeFileSync(join(stateDir, "package-keys.json"), JSON.stringify({ initech: `sha256:${hash}` }));
    const s = await startServer({ package: pkgDir, port: 0, stateDir, env: { HALO_PACKAGE_KEYS: "umbrella=env-key" }, logger: quiet, scheduler: false, onRuntime: (rt) => rt.mockAll({ "Drafter.draft": JSON.stringify(drafted("a", "b")) }) });
    try {
      const call = (key: string) =>
        fetch(`${s.url}/api/pipelines/DraftReply/runs`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, [HOSTED_PACKAGE_HEADER]: `${PKG}@1.0.0` },
          body: JSON.stringify({ args: { ticket: "a", tone: "b" }, wait: true }),
        });
      expect((await call("env-key")).status).toBe(200);
      expect((await call("file-key")).status).toBe(200);
      // Revoke initech without a restart.
      writeFileSync(join(stateDir, "package-keys.json"), JSON.stringify({ other: "x-key-longer" }));
      expect((await call("file-key")).status).toBe(401);
      // MCP: only the hosted pipelines, metered per key too.
      const rpc = (body: unknown, key: string) =>
        fetch(`${s.url}/mcp`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", Authorization: `Bearer ${key}` }, body: JSON.stringify(body) });
      expect((await rpc({ jsonrpc: "2.0", id: 1, method: "tools/list" }, "nope")).status).toBe(401);
      const list = (await (await rpc({ jsonrpc: "2.0", id: 1, method: "tools/list" }, "env-key")).json()) as { result: { tools: Array<{ name: string }> } };
      expect(list.result.tools.map((t) => t.name)).toEqual(["DraftReply"]);
      const mcpCall = (await (await rpc({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "DraftReply", arguments: { ticket: "a", tone: "b" } } }, "env-key")).json()) as { result: { content: unknown } };
      expect(JSON.stringify(mcpCall.result.content)).toContain("Sorry about");
      expect(s.usage().map((u) => [u.key, u.runs])).toEqual([
        ["initech", 1],
        ["umbrella", 2],
      ]);
      // The usage is in the telemetry database, for the publisher's own queries.
      const { Database } = await import("bun:sqlite");
      const db = new Database(join(stateDir, "telemetry.db"), { readonly: true });
      expect(db.query("SELECT key_id, pipeline, status FROM hosted_usage ORDER BY id").all()).toEqual([
        { key_id: "umbrella", pipeline: "DraftReply", status: "completed" },
        { key_id: "initech", pipeline: "DraftReply", status: "completed" },
        { key_id: "umbrella", pipeline: "DraftReply", status: "completed" },
      ]);
      db.close();
    } finally {
      await s.stop();
    }
  });

  test("the publisher's token reads usage over HTTP", async () => {
    const stateDir = mkdtempSync(join(tmp, "owner-"));
    const s = await startServer({ package: pkgDir, port: 0, stateDir, token: "owner-token", packageKeys: KEYS, env: {}, logger: quiet, scheduler: false });
    try {
      const res = await fetch(`${s.url}/api/usage`, { headers: { Authorization: "Bearer owner-token" } });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual([]);
    } finally {
      await s.stop();
    }
  });
});
