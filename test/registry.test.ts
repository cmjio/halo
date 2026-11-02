import { test, expect, describe, afterAll } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parse } from "../src/parser/index";
import { HaloRuntime, useTool, type MockRequest } from "../src/runtime/runtime";
import { TOOL_PROVIDERS } from "../src/parser/builtins";
import { checkManifest, ManifestError, permissionsOf } from "../src/registry/manifest";
import { DEFAULT_REGISTRY, install, installFromLock, loadInstalled, pack, publish, readLock, search, uninstall } from "../src/registry/packages";
import { plan } from "../src/plan";

const tmp = mkdtempSync(join(tmpdir(), "halo-registry-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));
const builtins = [...TOOL_PROVIDERS];
let n = 0;
const fresh = () => {
  const dir = join(tmp, `p${n++}`);
  mkdirSync(dir, { recursive: true });
  return dir;
};

function writePackage(dir: string, manifest: object, files: Record<string, string> = {}) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "halo-tool.json"), JSON.stringify(manifest));
  for (const [path, text] of Object.entries(files)) writeFileSync(join(dir, path), text);
  return dir;
}

const apiPackage = (base: string, version = "1.0.0") => ({
  name: "acme",
  version,
  description: "Acme widgets",
  providers: {
    Acme: {
      kind: "http",
      description: "The Acme API",
      baseUrl: base,
      auth: { type: "bearer", env: "ACME_KEY" },
      body: "form",
      headers: { "Acme-Version": "2" },
      methods: [
        { name: "get_widget", description: "Get a widget", effect: "read", http: { method: "GET", path: "/widgets/{id}" } },
        { name: "make_widget", description: "Make a widget", effect: "external", http: { method: "POST", path: "/widgets" } },
      ],
    },
  },
});

describe("manifests", () => {
  test("problems are listed together", () => {
    try {
      checkManifest({ name: "Bad Name", version: "1", description: "", providers: { lower: { kind: "http", description: "x", baseUrl: "http://example.com", methods: [{ name: "Get", description: "", effect: "maybe", http: { method: "GET", path: "../x" } }] } } });
      throw new Error("expected an error");
    } catch (err) {
      expect(err).toBeInstanceOf(ManifestError);
      const text = (err as Error).message;
      for (const part of ["name must be", "version must", "description is required", "start with a capital", "https URL", "snake_case", "effect must be", "http.path"]) expect(text).toContain(part);
    }
  });

  test("a provider can't take a built-in's name", () => {
    expect(() => checkManifest({ ...apiPackage("https://x.example"), providers: { Bash: apiPackage("https://x.example").providers.Acme } }, builtins)).toThrow(/already a provider/);
  });

  test("permissions name hosts, env vars, commands, and whether code runs", () => {
    expect(permissionsOf(checkManifest(apiPackage("https://{{site}}.acme.io/api")))).toEqual({ network: ["*.acme.io"], env: ["ACME_KEY"], spawn: [], code: false });
    const mcp = checkManifest({ name: "m", version: "1.0.0", description: "d", providers: { M: { kind: "mcp", description: "d", command: "npx srv", env: ["TOKEN"] } } });
    expect(permissionsOf(mcp)).toEqual({ network: [], env: ["TOKEN"], spawn: ["npx srv"], code: true });
  });
});

describe("registries and installs", () => {
  test("pack, publish, search, install, and load from a local registry", async () => {
    const reg = join(fresh(), "index.json");
    const src = writePackage(join(fresh(), "acme"), apiPackage("https://api.acme.io/v1"));
    const out = join(fresh(), "acme-1.0.0.halotool");
    writeFileSync(out, pack(src).bytes);
    publish(out, reg);
    expect(() => publish(out, reg)).toThrow(/already published/);
    expect((await search(reg, "widget")).map((p) => p.name)).toEqual(["acme"]);

    const root = fresh();
    const r = await install({ root, builtins }, "acme", { registry: reg });
    expect(r).toMatchObject({ name: "acme", version: "1.0.0", providers: ["Acme"] });
    expect(readLock(root).tools.acme!.source).toBe(`registry:${reg}#acme@1.0.0`);
    // The registry that ships with Halo is named, not pathed, so the lock works anywhere.
    await install({ root, builtins }, "stripe");
    expect(readLock(root).tools.stripe!.source).toBe("registry:default#stripe@1.0.0");
    const loaded = await loadInstalled(root);
    expect(loaded.map((p) => p.name)).toEqual(["Acme", "Stripe"]);
    expect(uninstall(root, "acme")).toBe(true);
    expect(Object.keys(readLock(root).tools)).toEqual(["stripe"]);
  });

  test("a download that doesn't match the registry's checksum is refused", async () => {
    const regDir = fresh();
    const reg = join(regDir, "index.json");
    const out = join(fresh(), "acme.halotool");
    writeFileSync(out, pack(writePackage(join(fresh(), "acme"), apiPackage("https://api.acme.io"))).bytes);
    publish(out, reg);
    // Someone swaps the file on the server.
    writeFileSync(join(regDir, "packages/acme-1.0.0.halotool"), pack(writePackage(join(fresh(), "acme"), { ...apiPackage("https://evil.example"), version: "1.0.0" })).bytes);
    await expect(install({ root: fresh(), builtins }, "acme", { registry: reg })).rejects.toThrow(/checksum mismatch/);
  });

  test("installed files that change are caught when they load", async () => {
    const root = fresh();
    await install({ root, builtins }, writePackage(join(fresh(), "acme"), apiPackage("https://api.acme.io")));
    writeFileSync(join(root, ".halo/tools/acme/package.halotool"), "tampered");
    await expect(loadInstalled(root)).rejects.toThrow(/doesn't match halo.lock/);
    // halo install restores it from where it came from, at the pinned checksum.
    await installFromLock({ root, builtins });
    expect((await loadInstalled(root)).map((p) => p.name)).toEqual(["Acme"]);
  });

  test("a package that runs code needs --trust, and stays untrusted in the lock without it", async () => {
    const dir = writePackage(join(fresh(), "clock"), { name: "clock", version: "1.0.0", description: "d", providers: { Clock: { kind: "module", description: "d", entry: "index.ts" } } }, {
      "index.ts": `export const provider = async (call) => ({ method: call.method, zone: call.named.zone }); export const info = { methods: [{ name: "now", description: "now", effect: "read" }] };`,
    });
    const root = fresh();
    await expect(install({ root, builtins }, dir)).rejects.toThrow(/--trust/);
    await install({ root, builtins }, dir, { trust: true });
    const [p] = await loadInstalled(root);
    const rt = new HaloRuntime({ env: {}, logger: { log() {}, warn() {} } }).load(parse(`tool C : Clock()\npipeline P(x: String) -> Result:\n  x |> C.now(zone: "UTC")`));
    rt.registerToolProvider(p!.name, p!.provider, p!.info);
    expect(await rt.execute("P", { x: "" })).toEqual({ method: "now", zone: "UTC" });
    // Trust belongs to this machine and that exact checksum: a lock can't grant it.
    expect(JSON.stringify(readLock(root))).not.toContain("trust");
    const other = fresh();
    writeFileSync(join(other, "halo.lock"), readFileSync(join(root, "halo.lock")));
    await expect(installFromLock({ root: other, builtins })).rejects.toThrow(/halo install --trust/);
    await installFromLock({ root: other, builtins }, { trust: true });
    expect((await loadInstalled(other)).map((p) => p.name)).toEqual(["Clock"]);
    rmSync(join(other, ".halo/trust.json"));
    await expect(loadInstalled(other)).rejects.toThrow(/hasn't trusted this version/);
  });

  test("two packages can't provide the same name", async () => {
    const root = fresh();
    await install({ root, builtins }, writePackage(join(fresh(), "a"), apiPackage("https://a.example")));
    await expect(install({ root, builtins }, writePackage(join(fresh(), "b"), { ...apiPackage("https://b.example"), name: "acme-two" }))).rejects.toThrow(/already a provider/);
  });

  test("the bundled registry's packages are all valid", async () => {
    const found = await search(DEFAULT_REGISTRY);
    expect(found.map((p) => p.name).sort()).toEqual(["cloudflare", "github-mcp", "jira", "notion", "sentry", "stripe", "world-time"]);
    for (const p of found) await install({ root: fresh(), builtins }, p.name, { registry: DEFAULT_REGISTRY, trust: true });
  });
});

describe("http packages on the wire", () => {
  test("paths, auth, fixed headers, form bodies, and the base URL boundary", async () => {
    const seen: Array<{ method: string; url: string; headers: Headers; body: string }> = [];
    const server = Bun.serve({
      port: 0,
      async fetch(req) {
        seen.push({ method: req.method, url: req.url, headers: req.headers, body: await req.text() });
        return Response.json({ ok: true, url: new URL(req.url).pathname });
      },
    });
    try {
      const root = fresh();
      await install({ root, builtins }, writePackage(join(fresh(), "acme"), apiPackage(`http://localhost:${server.port}/v1`)));
      const [p] = await loadInstalled(root);
      const rt = new HaloRuntime({ env: { ACME_KEY: "sk_test" }, logger: { log() {}, warn() {} } }).load(
        parse(`tool A : Acme()\npipeline P(x: String) -> Result:\n  x |> A.get_widget(id: "a/../b") as got |> A.make_widget(name: "Gear", tags: ["x", "y"], meta: context.data.got)`),
      );
      rt.registerToolProvider(p!.name, p!.provider, p!.info);
      await rt.run("P", { x: "" });
      expect(seen[0]!.method).toBe("GET");
      // A path parameter is one URL segment: it can't climb out of /widgets/.
      expect(new URL(seen[0]!.url).pathname).toBe("/v1/widgets/a%2F..%2Fb");
      expect(seen[0]!.headers.get("authorization")).toBe("Bearer sk_test");
      expect(seen[0]!.headers.get("acme-version")).toBe("2");
      expect(seen[1]!.method).toBe("POST");
      expect(seen[1]!.body).toBe("name=Gear&tags%5B0%5D=x&tags%5B1%5D=y&meta%5Bok%5D=true&meta%5Burl%5D=%2Fv1%2Fwidgets%2Fa%252F..%252Fb");
    } finally {
      server.stop(true);
    }
  });

  test("a {{site}} base URL is filled from the declaration only, and checked", async () => {
    const fetched: string[] = [];
    const root = fresh();
    await install({ root, builtins }, writePackage(join(fresh(), "acme"), apiPackage("https://{{site}}.acme.io/api")));
    const [p] = await loadInstalled(root);
    const make = (decl: string) => {
      const rt = new HaloRuntime({ env: { ACME_KEY: "k" }, fetch: (async (u: URL) => (fetched.push(String(u)), Response.json({}))) as unknown as typeof fetch, logger: { log() {}, warn() {} } }).load(
        parse(`tool A : Acme(${decl})\npipeline P(x: String) -> Result:\n  x |> A.get_widget(id: "1")`),
      );
      rt.registerToolProvider(p!.name, p!.provider, p!.info);
      return rt;
    };
    await make(`site: "tenant"`).run("P", { x: "" });
    expect(fetched[0]).toBe("https://tenant.acme.io/api/widgets/1");
    await expect(make(`site: "evil.com/x"`).run("P", { x: "" })).rejects.toThrow(/can only contain/);
    await expect(make("").run("P", { x: "" })).rejects.toThrow(/needs site:/);
  });

  test("agents see a package's methods, and plan shows their effects", async () => {
    const root = fresh();
    await install({ root, builtins }, writePackage(join(fresh(), "acme"), apiPackage("https://api.acme.io")));
    const [p] = await loadInstalled(root);
    const src = `policy G : ApproveEffects(external)\ntool A : Acme()\nagent Ag [openai/gpt-4o] equips A requires G\npipeline P(x: String) -> Result:\n  x |> Ag.go(tools: [A])`;
    const offered: string[][] = [];
    const rt = new HaloRuntime({ env: {}, logger: { log() {}, warn() {} } })
      .load(parse(src))
      .mockAll({ "Ag.go": (r: MockRequest) => (offered.push(r.tools!), r.step === 1 ? useTool("A.get_widget", { id: "1" }) : "done"), "A.get_widget": { id: "1" } });
    rt.registerToolProvider(p!.name, p!.provider, p!.info);
    expect(await rt.execute("P", { x: "" })).toBe("done");
    expect(offered[0]).toEqual(["A.get_widget", "A.make_widget"]);
    const shown = plan(parse(src), "P", { providerInfo: (n) => rt.toolProviderInfo(n) });
    expect(shown.steps[0]!.effects).toEqual([
      { target: "A.get_widget", effect: "read", approval: undefined, via: "Ag" },
      { target: "A.make_widget", effect: "external", approval: "G", via: "Ag" },
    ]);
  });

  test("an mcp package's server can't be repointed by the declaration", async () => {
    const fixture = resolve(import.meta.dir, "fixtures/mcp-echo-server.ts");
    const root = fresh();
    await install({ root, builtins }, writePackage(join(fresh(), "echo"), { name: "echo", version: "1.0.0", description: "d", providers: { Echo: { kind: "mcp", description: "d", command: `bun ${fixture}` } } }), { trust: true });
    const [p] = await loadInstalled(root);
    const rt = new HaloRuntime({ env: {}, logger: { log() {}, warn() {} } }).load(parse(`tool E : Echo("bash -c whoami")\npipeline P(x: String) -> Result:\n  x |> E.echo(text: "hi")`));
    rt.registerToolProvider(p!.name, p!.provider, p!.info);
    try {
      expect(JSON.stringify(await rt.execute("P", { x: "" }))).toContain("hi");
    } finally {
      await rt.close();
    }
  });
});
