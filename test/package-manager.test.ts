/**
 * The v2 package manager: package files, static and HTTP registries, resolution, halo.lock v2,
 * installs, trust, the linker's resolver, provider loading, and the CLI end to end.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { packageApiPath, packageDocPath, packageFilePath, INDEX_PATH, type PackageDoc, type PackageSummary } from "../src/registry/contract";
import { exportsOf, pack, packFiles, PackageError, permissionsOfPackage, publishProblems, readPackage, setExportAnalyzer, sha256 } from "../src/registry/format";
import { RegistryClient, versionDocOf } from "../src/registry/client";
import { resolveGraph, ResolveError } from "../src/registry/resolve";
import { installProject } from "../src/registry/install";
import { readAnyLock, readLockV2 } from "../src/registry/lockfile";
import { installedProviderNames, installedResolver, loadPackageProviders } from "../src/registry/resolver";
import { install as installV1 } from "../src/registry/packages";
import { DEFAULT_REGISTRY } from "../src/registry/config";
import { TOOL_PROVIDERS } from "../src/parser/builtins";

const repo = resolve(import.meta.dir, "..");
const fixtures = join(import.meta.dir, "fixtures/packages");
const tmp = mkdtempSync(join(tmpdir(), "halo-pm-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));
let n = 0;
const fresh = () => {
  const dir = join(tmp, `d${n++}`);
  mkdirSync(dir, { recursive: true });
  return dir;
};

const http = (name: string, host: string, extra: object = {}) => ({
  kind: "http",
  description: `The ${name} API`,
  baseUrl: `https://${host}/v1`,
  auth: { type: "bearer", env: `${name.toUpperCase()}_KEY` },
  methods: [{ name: "get_thing", description: "Get a thing", effect: "read", http: { method: "GET", path: "/things/{id}" } }],
  ...extra,
});

/** Write a v2 package folder. */
function v2(manifest: Record<string, unknown>, files: Record<string, string> = {}, dir = fresh()) {
  const full = { description: "A test package", ...manifest };
  if (!("exports" in full) && !("providers" in full) && !("hosted" in full)) Object.assign(full, { providers: { [`P${n}`]: http("p", "api.example.com") } });
  writeFileSync(join(dir, "halo.json"), JSON.stringify(full, null, 2));
  if (!("README.md" in files)) writeFileSync(join(dir, "README.md"), `# ${String(manifest.name)}\n`);
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(dir, path, ".."), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
  return dir;
}

/** A folder registry with these packages published. */
async function folderRegistry(...dirs: string[]) {
  const reg = fresh();
  const client = new RegistryClient(reg);
  for (const d of dirs) await client.publish(pack(d).bytes);
  return reg;
}

function project(deps: Record<string, string>, extra: Record<string, unknown> = {}) {
  const root = fresh();
  writeFileSync(join(root, "halo.json"), JSON.stringify({ dependencies: deps, ...extra }, null, 2));
  return root;
}

const settings = (reg: string, root: string) => ({ default: reg, scopes: {}, root });

describe("package files", () => {
  test("v2 packs halo.json, the README and the files, and leaves out local state", () => {
    const dir = v2({ name: "@t/kit", version: "1.0.0", exports: ["lib/a.halo"] }, { "lib/a.halo": "pipeline A(x: String) -> Result:\n  x |> System.Print(\"hi\")\n", "node_modules/x/index.js": "x", "halo.lock": "{}", ".env": "SECRET=1", "old.halotool": "x" });
    const { pkg, bytes, sha256: digest } = pack(dir);
    expect(pkg.format).toBe("halo-package/2");
    expect(Object.keys(pkg.files).sort()).toEqual(["README.md", "halo.json", "lib/a.halo"]);
    expect(digest).toBe(sha256(bytes));
    const back = readPackage(bytes);
    expect(back.name).toBe("@t/kit");
    expect(exportsOf(back).pipelines).toEqual(["A"]);
  });

  test("the shared fixtures pack", () => {
    const zendesk = pack(join(fixtures, "acme-zendesk")).pkg;
    expect(zendesk.name).toBe("@acme/zendesk");
    expect(permissionsOfPackage(zendesk)).toEqual({ network: ["*.zendesk.com"], env: ["ZENDESK_TOKEN"], spawn: [], code: false, hosted: [] });
    const kit = pack(join(fixtures, "acme-support-kit")).pkg;
    expect(kit.manifest.dependencies).toEqual({ "@acme/zendesk": "^1.0.0" });
    expect(permissionsOfPackage(kit).env).toEqual(["ZENDESK_SUBDOMAIN"]);
  });

  test("v1 halo-tool.json packages still pack, and read with a v2-shaped manifest", () => {
    const dir = fresh();
    writeFileSync(join(dir, "halo-tool.json"), JSON.stringify({ name: "acme", version: "1.0.0", description: "d", providers: { Acme: http("acme", "api.acme.io") } }));
    const { bytes, pkg } = pack(dir);
    expect(JSON.parse(new TextDecoder().decode(bytes)).format).toBe("halo-tool/1");
    expect(pkg.name).toBe("acme");
    expect(readPackage(bytes, { rename: "@halo/acme" }).manifest).toMatchObject({ name: "@halo/acme", version: "1.0.0", providers: { Acme: { kind: "http" } } });
  });

  test("manifest problems are listed together, and the README is required", () => {
    const dir = fresh();
    writeFileSync(join(dir, "halo.json"), JSON.stringify({ name: "bad name", version: "1", description: "", dependencies: { stripe: "nope" } }));
    let text = "";
    try {
      pack(dir);
    } catch (err) {
      text = (err as Error).message;
    }
    for (const part of ["scoped name", "semver", "description is required", "not a scoped package name", "not a version range", "must export something", "README.md is required"]) expect(text).toContain(part);
  });

  test("hosted endpoints and exports' reach count as permissions; the analyzer hook adds the exports' reach", () => {
    const dir = v2({ name: "@t/hosted", version: "1.0.0", hosted: { endpoint: "https://halo.acme.com", auth: { type: "bearer", env: "ACME_HALO_KEY" }, exports: ["Triage"] } });
    // pack() refuses a hosted package (halo pack / publish use packWithHosted); packFiles packs it as is.
    expect(() => pack(dir)).toThrow(/pack it with `halo pack` or `halo publish`/);
    const pkg = packFiles(dir).pkg;
    expect(permissionsOfPackage(pkg)).toEqual({ network: ["halo.acme.com"], env: ["ACME_HALO_KEY"], spawn: [], code: false, hosted: ["halo.acme.com"] });
    expect(exportsOf(pkg).pipelines).toEqual(["Triage"]);
    setExportAnalyzer((files, manifest) => ({ network: ["api.tools.example"], env: ["TOOL_KEY"], spawn: [], code: false, exports: { agents: [`${manifest.name}-agent`] } }));
    try {
      expect(permissionsOfPackage(pkg).network).toEqual(["api.tools.example", "halo.acme.com"]);
      expect(exportsOf(pkg).agents).toEqual(["@t/hosted-agent"]);
    } finally {
      setExportAnalyzer(undefined);
    }
  });

  test("bad package files are refused", () => {
    expect(() => readPackage(new TextEncoder().encode("nope"))).toThrow(/not JSON/);
    expect(() => readPackage(new TextEncoder().encode(JSON.stringify({ format: "zip/9", files: {} })))).toThrow(/format/);
    expect(() => readPackage(new TextEncoder().encode(JSON.stringify({ format: "halo-package/2", files: { "../x": "" } })))).toThrow(/unsafe file path/);
    const big = v2({ name: "@t/big", version: "1.0.0" }, { "blob.bin": "x".repeat(5 * 1024 * 1024 + 10) });
    expect(() => pack(big)).toThrow(/over 5MB/);
  });

  test("publish checks: a package that isn't hosted can't hard-code a model", () => {
    const bad = pack(v2({ name: "@t/m", version: "1.0.0", exports: ["lib/a.halo"] }, { "lib/a.halo": "agent A [openai/gpt-4o]\npipeline P(x: String) -> Result:\n  x |> A.prompt(\"hi\")\n" })).pkg;
    expect(publishProblems(bad).join("\n")).toContain(`hard-codes the model "openai/gpt-4o"`);
    const good = pack(v2({ name: "@t/m", version: "1.0.0", exports: ["lib/a.halo"], models: { fast: { description: "d" } } }, { "lib/a.halo": "agent A [models.fast]\npipeline P(x: String) -> Result:\n  x |> A.prompt(\"hi\")\n" })).pkg;
    expect(publishProblems(good)).toEqual([]);
  });

  test("publish checks are the linker's: syntax errors, undeclared slots, uses outside the package, and models named in shipped files fail", () => {
    const problems = (files: Record<string, string>, extra: Record<string, unknown> = {}) =>
      publishProblems(packFiles(v2({ name: "@t/c", version: "1.0.0", exports: ["lib/a.halo"], models: { fast: { description: "d" } }, ...extra }, files)).pkg);
    expect(problems({ "lib/a.halo": "pipeline P(x: String) ->\n" }).join("\n")).toContain("lib/a.halo:");
    expect(problems({ "lib/a.halo": "agent A [models.smart]\n" }).join("\n")).toContain(`uses model slot "smart", which halo.json "models" doesn't declare`);
    expect(problems({ "lib/a.halo": `use "../../outside.halo" { X }\n` }).join("\n")).toContain("a package can only use files inside it");
    expect(problems({ "lib/a.halo": `use "@t/other" { X }\n` }).join("\n")).toContain("@t/other is not in the package's dependencies");
    // A private file counts too: every agent in the package runs on the consumer's keys.
    expect(problems({ "lib/a.halo": "agent A [models.fast]\n", "lib/private.halo": "agent B [openai/gpt-4o]\n" }).join("\n")).toContain(`lib/private.halo:1: Agent "B" hard-codes the model "openai/gpt-4o"`);
    // In a hosted package too: shipped files run on the consumer's keys (only hosted sources, which don't ship, may name models).
    const hosted = { hosted: { endpoint: "https://halo.acme.com", auth: { type: "bearer", env: "K" }, exports: ["P"] } };
    const hostedProblems = problems({ "lib/a.halo": "agent B [openai/gpt-4o]\n", "hosted/p.halo": "pipeline P(x: String):\n  x |> System.Print(\"hi\")\n" }, hosted).join("\n");
    expect(hostedProblems).toContain(`Agent "B" hard-codes the model "openai/gpt-4o"`);
    expect(hostedProblems).toContain("hosted: no interface for P");
    expect(hostedProblems).toContain("hosted/p.halo isn't reached by exports, so it would be a hosted source");
  });

  test("hosted interfaces carry the pipeline's tool effects, and readPackage checks their shape", async () => {
    const { packWithHosted } = await import("../src/registry/hosted");
    const dir = v2(
      { name: "@t/h", version: "1.0.0", exports: ["lib/a.halo"], hosted: { endpoint: "https://halo.t.com", auth: { type: "bearer", env: "T_KEY" }, exports: ["Save"] } },
      { "lib/a.halo": "schema Note {\n  text: String,\n}\n", "hosted/save.halo": `tool Notes : Workspace("/tmp", write: true)\npipeline Save(text: String) -> Result:\n  text |> Notes.write(path: "n.md", content: text)\n` },
    );
    const packed = packWithHosted(dir);
    expect(packed.pkg.hosted!.Save!.effects).toEqual([{ target: "Notes.write", effect: "write" }]);
    expect(Object.keys(packed.pkg.files)).not.toContain("hosted/save.halo");
    expect(readPackage(packed.bytes).hosted!.Save!.effects).toEqual([{ target: "Notes.write", effect: "write" }]);
    expect(publishProblems(packed.pkg)).toEqual([]);
    const file = JSON.parse(new TextDecoder().decode(packed.bytes));
    file.hosted.Save.params = [{ name: 1 }];
    file.hosted.Save.effects = "write";
    expect(() => readPackage(new TextEncoder().encode(JSON.stringify(file)))).toThrow(/params must be a list of \{ name, type \} strings[\s\S]*effects must be a list/);
  });

  test("the client and the registry Worker run the same check", async () => {
    const { checkPackageFiles } = await import("../src/registry/check");
    const pkg = pack(v2({ name: "@t/c", version: "1.0.0", exports: ["lib/a.halo"] }, { "lib/a.halo": "agent A [openai/gpt-4o]\n" })).pkg;
    const texts = Object.fromEntries(Object.entries(pkg.files).map(([k, v]) => [k, Buffer.from(v, "base64").toString("utf8")]));
    const shared = checkPackageFiles(texts, pkg.manifest);
    expect(publishProblems(pkg)).toEqual(shared.problems);
    expect(permissionsOfPackage(pkg)).toEqual(shared.permissions);
    expect(exportsOf(pkg)).toEqual(shared.exports);
    const worker = await Bun.file(join(import.meta.dir, "../services/registry/src/packages.ts")).text();
    expect(worker).toContain("checkPackageFiles(");
  });

  test("a package just under the 5MB raw cap packs and reads back, though base64 makes the file bigger", () => {
    const dir = v2({ name: "@t/near", version: "1.0.0" }, { "data/blob.txt": "x".repeat(5 * 1024 * 1024 - 64 * 1024) });
    const packed = pack(dir);
    expect(packed.bytes.length).toBeGreaterThan(5 * 1024 * 1024);
    expect(readPackage(packed.bytes).name).toBe("@t/near");
  });
});

describe("static folder registries", () => {
  test("publish writes the v1 layout; latest skips prereleases; republishing is refused", async () => {
    const reg = fresh();
    const client = new RegistryClient(reg);
    for (const v of ["1.0.0", "1.1.0", "2.0.0-beta.1"]) await client.publish(pack(v2({ name: "@t/a", version: v, keywords: ["widgets"] })).bytes);
    await expect(client.publish(pack(v2({ name: "@t/a", version: "1.1.0" })).bytes)).rejects.toThrow(/already published/);
    const doc = JSON.parse(readFileSync(join(reg, packageDocPath("@t/a")), "utf8")) as PackageDoc;
    expect(doc.distTags.latest).toBe("1.1.0");
    expect(doc.readme).toBe("# @t/a\n");
    expect(existsSync(join(reg, packageFilePath("@t/a", "2.0.0-beta.1")))).toBe(true);
    expect(doc.versions["1.0.0"]!.sha256).toBe(sha256(readFileSync(join(reg, doc.versions["1.0.0"]!.file))));
    const index = JSON.parse(readFileSync(join(reg, INDEX_PATH), "utf8")) as PackageSummary[];
    expect(index.map((p) => [p.name, p.latest])).toEqual([["@t/a", "1.1.0"]]);
    expect((await client.search("widget")).results.map((p) => p.name)).toEqual(["@t/a"]);
    expect((await client.search("nothing-like-it")).total).toBe(0);
  });

  test("yank, unyank, deprecate and dist-tags edit the docs", async () => {
    const reg = await folderRegistry(v2({ name: "@t/a", version: "1.0.0" }), v2({ name: "@t/a", version: "1.1.0" }));
    const client = new RegistryClient(reg);
    await client.yank("@t/a", "1.1.0", "broken");
    let doc = (await client.doc("@t/a"))!;
    expect(doc.versions["1.1.0"]!.yanked).toBe("broken");
    expect(doc.distTags.latest).toBe("1.0.0");
    await client.unyank("@t/a", "1.1.0");
    await client.deprecate("@t/a", "<1.1.0", "Use 1.1");
    await client.setDistTag("@t/a", "next", "1.1.0");
    doc = (await client.doc("@t/a"))!;
    expect(doc.versions["1.1.0"]!.yanked).toBeUndefined();
    expect(doc.versions["1.0.0"]!.deprecated).toBe("Use 1.1");
    expect(doc.distTags.next).toBe("1.1.0");
    await client.removeDistTag("@t/a", "next");
    expect((await client.doc("@t/a"))!.distTags.next).toBeUndefined();
    await expect(client.removeDistTag("@t/a", "latest")).rejects.toThrow(/can't be removed/);
  });

  test("a file that doesn't match the doc's checksum is refused", async () => {
    const reg = await folderRegistry(v2({ name: "@t/a", version: "1.0.0" }));
    writeFileSync(join(reg, packageFilePath("@t/a", "1.0.0")), pack(v2({ name: "@t/a", version: "1.0.0", description: "evil" })).bytes);
    const root = project({ "@t/a": "^1.0.0" });
    await expect(installProject({ root, registry: reg })).rejects.toThrow(/checksum mismatch/);
    expect(existsSync(join(root, "halo.lock"))).toBe(false);
  });

  test("plain http is refused except on localhost", () => {
    expect(() => new RegistryClient("http://registry.example.com")).toThrow(/plain http/);
    expect(new RegistryClient("http://localhost:1234").kind).toBe("http");
  });
});

// ── A fake of the registry service (only the routes the client uses) ──

function fakeRegistry() {
  const docs = new Map<string, PackageDoc>();
  const files = new Map<string, Uint8Array>();
  const calls: string[] = [];
  let polls = 0;
  const TOKEN = "halo_test_token";
  const server = Bun.serve({
    port: 0,
    async fetch(req): Promise<Response> {
      const url = new URL(req.url);
      const path = url.pathname.slice(1);
      calls.push(`${req.method} ${path}`);
      const authed = req.headers.get("authorization") === `Bearer ${TOKEN}`;
      const err = (status: number, error: string, code = "error") => Response.json({ error, code }, { status });
      let m: RegExpExecArray | null;
      if (req.method === "POST" && path === "v1/auth/device") return Response.json({ device_code: "dev-1", user_code: "ABCD-EFGH", verification_uri: `${url.origin}/device`, interval: 0, expires_in: 30 });
      if (req.method === "POST" && path === "v1/auth/device/token") {
        const body = (await req.json()) as { device_code: string };
        if (body.device_code !== "dev-1") return err(400, "bad code");
        return polls++ === 0 ? err(428, "authorization_pending", "authorization_pending") : Response.json({ token: TOKEN, login: "octo" });
      }
      if (path === "v1/whoami") return authed ? Response.json({ login: "octo", scopes: [{ scope: "@octo", role: "owner" }], token: { id: "t1", name: "cli", readOnly: false } }) : err(401, "Not logged in");
      if (req.method === "GET" && path === INDEX_PATH) return Response.json([...docs.values()].map((d) => ({ name: d.name, description: d.description, latest: d.distTags.latest, updatedAt: d.updatedAt })));
      if (req.method === "GET" && path === "v1/search") {
        const q = url.searchParams.get("q") ?? "";
        const results = [...docs.values()].filter((d) => d.name.includes(q) || d.description.includes(q)).map((d) => ({ name: d.name, description: d.description, latest: d.distTags.latest, updatedAt: d.updatedAt, downloads: 7 }));
        return Response.json({ results, total: results.length });
      }
      if (req.method === "GET" && (m = /^v1\/packages\/(@[^/]+\/[^/]+)\.json$/.exec(path))) {
        const doc = docs.get(decodeURIComponent(m[1]!));
        return doc ? Response.json(doc) : err(404, "Not found");
      }
      if (req.method === "GET" && path.startsWith("v1/files/")) {
        const f = files.get(decodeURIComponent(path));
        return f ? new Response(f) : err(404, "Not found");
      }
      if ((m = /^v1\/packages\/(@[^/]+\/[^/]+)(\/.*)?$/.exec(decodeURIComponent(path)))) {
        if (!authed) return err(401, "Not logged in");
        const name = m[1]!;
        const rest = m[2] ?? "";
        if (req.method === "PUT" && !rest) {
          if (req.headers.get("content-type") !== "application/vnd.halo.package+json") return err(415, "wrong type");
          const bytes = new Uint8Array(await req.arrayBuffer());
          const pkg = readPackage(bytes);
          if (pkg.name !== name) return err(400, "name mismatch");
          const doc = docs.get(name) ?? { name, description: pkg.manifest.description, distTags: { latest: pkg.version }, versions: {}, updatedAt: "" };
          if (doc.versions[pkg.version]) return err(409, `${name}@${pkg.version} already exists`, "version_exists");
          const v = versionDocOf(pkg, bytes, "octo");
          doc.versions[pkg.version] = v;
          doc.distTags.latest = pkg.version;
          docs.set(name, doc);
          files.set(v.file, bytes);
          return Response.json({ name, version: pkg.version, sha256: v.sha256, url: v.file }, { status: 201 });
        }
        const doc = docs.get(name);
        if (!doc) return err(404, "Not found");
        if ((m = /^\/versions\/([^/]+)\/yank$/.exec(rest))) {
          const v = doc.versions[m[1]!];
          if (!v) return err(404, "No such version");
          if (req.method === "POST") v.yanked = ((await req.json()) as { reason: string }).reason || "yanked";
          else delete v.yanked;
          return Response.json({ ok: true });
        }
        if (rest === "/deprecate" && req.method === "POST") {
          const body = (await req.json()) as { range: string; message: string };
          for (const v of Object.values(doc.versions)) if (Bun.semver.satisfies(v.version, body.range)) v.deprecated = body.message;
          return Response.json({ ok: true });
        }
        if ((m = /^\/dist-tags\/([^/]+)$/.exec(rest)) && req.method === "PUT") {
          doc.distTags[m[1]!] = ((await req.json()) as { version: string }).version;
          return Response.json({ ok: true });
        }
      }
      return err(404, `No route ${req.method} ${path}`);
    },
  });
  return { server, docs, files, calls, TOKEN, url: `http://localhost:${server.port}/` };
}

async function cli(cwd: string, args: string[], env: Record<string, string> = {}) {
  const p = Bun.spawn(["bun", join(repo, "index.ts"), ...args], {
    cwd,
    env: { ...Bun.env, NO_COLOR: "1", HALO_REGISTRY: "", HALO_TOKEN: "", HALO_HOME: join(tmp, "home"), ...env },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [out, err, code] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text(), p.exited]);
  return { code, out, err };
}

describe("the HTTP registry client", () => {
  test("publish, read, download, yank and deprecate against the API", async () => {
    const fake = fakeRegistry();
    try {
      const anon = new RegistryClient(fake.url);
      const bytes = pack(v2({ name: "@octo/kit", version: "1.0.0" })).bytes;
      await expect(anon.publish(bytes)).rejects.toThrow(/Not logged in/);
      const client = new RegistryClient(fake.url, { token: fake.TOKEN });
      const r = await client.publish(bytes);
      expect(r).toMatchObject({ name: "@octo/kit", version: "1.0.0", sha256: sha256(bytes) });
      expect(fake.calls).toContain(`PUT ${packageApiPath("@octo/kit")}`);
      await expect(client.publish(bytes)).rejects.toThrow(/409.*already exists/);
      expect(await client.file("@octo/kit", "1.0.0")).toEqual(bytes);
      await client.yank("@octo/kit", "1.0.0", "oops");
      client.refresh();
      expect((await client.doc("@octo/kit"))!.versions["1.0.0"]!.yanked).toBe("oops");
      await client.unyank("@octo/kit", "1.0.0");
      await client.deprecate("@octo/kit", "*", "Use @octo/kit2");
      await client.setDistTag("@octo/kit", "beta", "1.0.0");
      client.refresh();
      const doc = (await client.doc("@octo/kit"))!;
      expect(doc.versions["1.0.0"]!.deprecated).toBe("Use @octo/kit2");
      expect(doc.distTags.beta).toBe("1.0.0");
      expect((await client.search("kit")).results[0]).toMatchObject({ name: "@octo/kit", downloads: 7 });
      expect((await client.whoami()).login).toBe("octo");
      expect(await client.doc("@octo/missing")).toBeUndefined();
      // A doc that lies about the file's checksum is caught.
      fake.files.set(packageFilePath("@octo/kit", "1.0.0"), new TextEncoder().encode("swapped"));
      await expect(new RegistryClient(fake.url).file("@octo/kit", "1.0.0")).rejects.toThrow(/checksum mismatch/);
    } finally {
      fake.server.stop(true);
    }
  });

  test("halo login (device flow), whoami, publish and add through the CLI", async () => {
    const fake = fakeRegistry();
    const home = fresh();
    try {
      const pkgDir = v2({ name: "@octo/greeter", version: "1.2.0", exports: ["lib/main.halo"], models: { main: { description: "Writes greetings", suggested: "anthropic/claude-haiku-4-5" } } }, {
        "lib/main.halo": "agent Greeter [models.main]\npipeline Greet(name: String) -> Result:\n  name |> Greeter.prompt(\"Greet {{name}}\")\n",
      });
      const env = { HALO_HOME: home };
      const out = await cli(pkgDir, ["publish", "--registry", fake.url], env);
      expect(out.code).toBe(1);
      expect(out.err).toContain("Not logged in");

      const login = await cli(pkgDir, ["login", "--registry", fake.url], env);
      expect(login.err).toBe("");
      expect(login.out).toContain("ABCD-EFGH");
      expect(login.out).toContain("logged in to");
      const creds = join(home, "credentials.json");
      expect(statSync(creds).mode & 0o777).toBe(0o600);
      expect(JSON.parse(readFileSync(creds, "utf8"))[fake.url]).toEqual({ token: fake.TOKEN, login: "octo" });

      expect((await cli(pkgDir, ["whoami", "--registry", fake.url], env)).out).toContain("@octo owner");
      const dry = await cli(pkgDir, ["publish", "--dry-run", "--registry", fake.url], env);
      expect(dry.out).toContain("Dry run: not published");
      expect(dry.out).toContain("model slots: main");
      const pub = await cli(pkgDir, ["publish", "--registry", fake.url], env);
      expect(pub.err).toBe("");
      expect(pub.out).toContain(`published @octo/greeter@1.2.0 to ${fake.url}`);

      const app = project({}, { registries: { "@octo": fake.url } });
      const add = await cli(app, ["add", "@octo/greeter"], env);
      expect(add.err).toBe("");
      expect(add.out).toContain(`use "@octo/greeter" { Greet, Greeter } with models(main: anthropic/claude-haiku-4-5)`);
      expect(JSON.parse(readFileSync(join(app, "halo.json"), "utf8")).dependencies).toEqual({ "@octo/greeter": "^1.2.0" });
      expect(readLockV2(app).packages["@octo/greeter"]!.source).toBe(`registry:${fake.url}`);

      expect((await cli(app, ["yank", "@octo/greeter@1.2.0", "--reason", "bad", "--registry", fake.url], env)).out).toContain("yanked @octo/greeter@1.2.0");
      expect(fake.docs.get("@octo/greeter")!.versions["1.2.0"]!.yanked).toBe("bad");
      // A yanked version that halo.lock pins still installs.
      rmSync(join(app, ".halo"), { recursive: true, force: true });
      expect((await cli(app, ["install"], env)).code).toBe(0);
      expect(existsSync(join(app, ".halo/packages/@octo/greeter/lib/main.halo"))).toBe(true);

      expect((await cli(app, ["logout", "--registry", fake.url], env)).out).toContain("logged out");
      expect(JSON.parse(readFileSync(creds, "utf8"))[fake.url]).toBeUndefined();
      // HALO_TOKEN works without logging in, for Halo's registry or the one HALO_TOKEN_REGISTRY names.
      expect((await cli(app, ["whoami", "--registry", fake.url], { ...env, HALO_TOKEN: fake.TOKEN, HALO_TOKEN_REGISTRY: fake.url })).out).toContain("octo");
      expect((await cli(app, ["whoami", "--registry", fake.url], { ...env, HALO_TOKEN: fake.TOKEN })).out).not.toContain("octo");
    } finally {
      fake.server.stop(true);
    }
  }, 30_000);
});

describe("resolution", () => {
  async function graph(reg: string, deps: Record<string, string>, extra: Partial<Parameters<typeof resolveGraph>[0]> = {}) {
    const root = fresh();
    const { nodes } = await resolveGraph({ root, dependencies: deps, registries: settings(reg, root), haloVersion: "0.8.0", ...extra });
    return Object.fromEntries([...nodes].map(([k, v]) => [k, v.version]));
  }

  test("the highest version in range; prereleases only when the range names one", async () => {
    const reg = await folderRegistry(...["1.0.0", "1.1.0", "1.2.0-beta.1", "2.0.0"].map((v) => v2({ name: "@t/a", version: v })));
    expect(await graph(reg, { "@t/a": "^1.0.0" })).toEqual({ "@t/a": "1.1.0" });
    expect(await graph(reg, { "@t/a": "^1.2.0-beta.0" })).toEqual({ "@t/a": "1.2.0-beta.1" });
    expect(await graph(reg, { "@t/a": "*" })).toEqual({ "@t/a": "2.0.0" });
    await expect(graph(reg, { "@t/a": "^3.0.0" })).rejects.toThrow(/No version of @t\/a matches \^3.0.0/);
    await expect(graph(reg, { "@t/missing": "^1.0.0" })).rejects.toThrow(/No package @t\/missing/);
  });

  test("one version per package: the highest that satisfies every range", async () => {
    const reg = await folderRegistry(
      ...["1.0.0", "1.2.0", "1.3.0", "1.9.0"].map((v) => v2({ name: "@t/b", version: v })),
      v2({ name: "@t/a", version: "1.0.0", dependencies: { "@t/b": "~1.2.0" } }),
    );
    expect(await graph(reg, { "@t/a": "^1.0.0", "@t/b": "^1.0.0" })).toEqual({ "@t/a": "1.0.0", "@t/b": "1.2.0" });
  });

  test("a conflict prints both requirement chains", async () => {
    const reg = await folderRegistry(
      v2({ name: "@t/c", version: "1.0.0" }),
      v2({ name: "@t/c", version: "2.0.0" }),
      v2({ name: "@t/b", version: "1.0.0", dependencies: { "@t/c": "^2.0.0" } }),
      v2({ name: "@t/a", version: "1.0.0", dependencies: { "@t/b": "^1.0.0" } }),
    );
    const err = await graph(reg, { "@t/a": "^1.0.0", "@t/c": "^1.0.0" }).catch((e: Error) => e);
    expect(err).toBeInstanceOf(ResolveError);
    expect((err as Error).message).toContain("No version of @t/c satisfies every requirement");
    expect((err as Error).message).toContain("halo.json → @t/c ^1.0.0");
    expect((err as Error).message).toContain("halo.json → @t/a@1.0.0 → @t/b@1.0.0 → @t/c ^2.0.0");
  });

  test("yanked versions are skipped, unless halo.lock already pins them", async () => {
    const reg = await folderRegistry(v2({ name: "@t/a", version: "1.0.0" }), v2({ name: "@t/a", version: "1.1.0" }));
    await new RegistryClient(reg).yank("@t/a", "1.1.0", "broken");
    expect(await graph(reg, { "@t/a": "^1.0.0" })).toEqual({ "@t/a": "1.0.0" });
    const locked = { lockfileVersion: 2 as const, packages: { "@t/a": { version: "1.1.0", source: `registry:${reg}`, sha256: "x", dependencies: {}, permissions: { network: [], env: [], spawn: [], code: false, hosted: [] }, direct: true } } };
    expect(await graph(reg, { "@t/a": "^1.0.0" }, { locked })).toEqual({ "@t/a": "1.1.0" });
    // ...but updating moves off it.
    expect(await graph(reg, { "@t/a": "^1.0.0" }, { locked, unlock: "all" })).toEqual({ "@t/a": "1.0.0" });
    await expect(graph(reg, { "@t/a": "1.1.0" })).rejects.toThrow(/is yanked/);
  });

  test("a package's halo range is checked against this Halo", async () => {
    const reg = await folderRegistry(v2({ name: "@t/a", version: "1.0.0", halo: ">=0.5.0" }), v2({ name: "@t/a", version: "2.0.0", halo: ">=0.9.0" }));
    // The newest one this Halo can run.
    expect(await graph(reg, { "@t/a": "*" })).toEqual({ "@t/a": "1.0.0" });
    await expect(graph(reg, { "@t/a": "^2.0.0" })).rejects.toThrow("@t/a@2.0.0 needs Halo >=0.9.0, and this is Halo 0.8.0");
  });
});

describe("installing", () => {
  test("the fixtures install into .halo/packages, with halo.lock v2 recording the graph", async () => {
    const reg = await folderRegistry(join(fixtures, "acme-zendesk"), join(fixtures, "acme-support-kit"));
    const root = project({ "@acme/support-kit": "^1.2.0" });
    const report = await installProject({ root, registry: reg });
    expect(report.packages.map((p) => [p.name, p.version, p.addedBy])).toEqual([
      ["@acme/support-kit", "1.2.0", ["halo.json"]],
      ["@acme/zendesk", "1.0.0", ["@acme/support-kit@1.2.0"]],
    ]);
    expect(report.total).toEqual({ network: ["*.zendesk.com"], env: ["ZENDESK_SUBDOMAIN", "ZENDESK_TOKEN"], spawn: [], code: false, hosted: [] });
    const lock = readAnyLock(root);
    expect(lock.version).toBe(2);
    const packages = readLockV2(root).packages;
    expect(packages["@acme/support-kit"]).toMatchObject({ version: "1.2.0", direct: true, dependencies: { "@acme/zendesk": "1.0.0" } });
    expect(packages["@acme/zendesk"]).toMatchObject({ version: "1.0.0", direct: false, source: expect.stringMatching(/^registry:/) });
    expect(readFileSync(join(root, ".halo/packages/@acme/support-kit/lib/support.halo"), "utf8")).toContain("pipeline Triage");
    expect(existsSync(join(root, ".halo/packages/@acme/zendesk/package.halotool"))).toBe(true);
  });

  test("installedResolver: the project uses only its direct dependencies, a package only its own", async () => {
    const reg = await folderRegistry(join(fixtures, "acme-zendesk"), join(fixtures, "acme-support-kit"));
    const root = project({ "@acme/support-kit": "^1.2.0" });
    await installProject({ root, registry: reg });
    const resolver = installedResolver(root);
    const kit = resolver.resolve("@acme/support-kit")!;
    expect(kit).toMatchObject({ name: "@acme/support-kit", version: "1.2.0", dir: join(root, ".halo/packages/@acme/support-kit") });
    expect(kit.manifest.exports).toEqual(["lib/support.halo"]);
    expect(resolver.resolve("@acme/zendesk")).toBeUndefined();
    const zendesk = resolver.resolve("@acme/zendesk", kit)!;
    expect(zendesk.manifest.providers?.Zendesk?.kind).toBe("http");
    expect(resolver.resolve("@acme/support-kit", zendesk)).toBeUndefined();
    expect(resolver.resolve("@acme/nothing")).toBeUndefined();
    // Tampering is caught when the linker resolves.
    writeFileSync(join(root, ".halo/packages/@acme/support-kit/package.halotool"), "tampered");
    expect(() => installedResolver(root).resolve("@acme/support-kit")).toThrow(/doesn't match halo.lock/);
  });

  test("halo install puts back what halo.lock pins; changed files are caught and rewritten", async () => {
    const reg = await folderRegistry(v2({ name: "@t/a", version: "1.0.0", providers: { Acme: http("acme", "api.acme.io") } }));
    const root = project({ "@t/a": "^1.0.0" });
    await installProject({ root, registry: reg });
    // An edited unpacked file is rewritten from the verified package before it's used.
    writeFileSync(join(root, ".halo/packages/@t/a/halo.json"), "{}");
    expect((await loadPackageProviders(root)).map((p) => p.name)).toEqual(["@t/a#Acme", "Acme"]);
    expect(JSON.parse(readFileSync(join(root, ".halo/packages/@t/a/halo.json"), "utf8")).name).toBe("@t/a");
    writeFileSync(join(root, ".halo/packages/@t/a/package.halotool"), "tampered");
    await expect(loadPackageProviders(root)).rejects.toThrow(/doesn't match halo.lock/);
    await installProject({ root, registry: reg });
    expect((await loadPackageProviders(root)).length).toBe(2);
    // A newer version doesn't move a locked install.
    await new RegistryClient(reg).publish(pack(v2({ name: "@t/a", version: "1.1.0", providers: { Acme: http("acme", "api.acme.io") } })).bytes);
    await installProject({ root, registry: reg });
    expect(readLockV2(root).packages["@t/a"]!.version).toBe("1.0.0");
    await installProject({ root, registry: reg, unlock: "all" });
    expect(readLockV2(root).packages["@t/a"]!.version).toBe("1.1.0");
  });

  test("a registry whose checksum changed after locking is refused", async () => {
    const reg = await folderRegistry(v2({ name: "@t/a", version: "1.0.0" }));
    const root = project({ "@t/a": "^1.0.0" });
    await installProject({ root, registry: reg });
    // Someone republishes 1.0.0 with different bytes (and a matching doc).
    const docPath = join(reg, packageDocPath("@t/a"));
    const evil = pack(v2({ name: "@t/a", version: "1.0.0", description: "evil" })).bytes;
    writeFileSync(join(reg, packageFilePath("@t/a", "1.0.0")), evil);
    const doc = JSON.parse(readFileSync(docPath, "utf8"));
    doc.versions["1.0.0"].sha256 = sha256(evil);
    writeFileSync(docPath, JSON.stringify(doc));
    rmSync(join(root, ".halo"), { recursive: true });
    await expect(installProject({ root, registry: reg })).rejects.toThrow(/differs from halo.lock/);
  });

  test("packages that run code need --trust; trust is per machine and per checksum, never in the lock", async () => {
    const mod = v2({ name: "@t/clock", version: "1.0.0", providers: { Ticker: { kind: "module", description: "d", entry: "index.ts" } } }, {
      "index.ts": `export const provider = async (call) => ({ method: call.method }); export const info = { methods: [{ name: "now", description: "now", effect: "read" }] };`,
    });
    const reg = await folderRegistry(mod, v2({ name: "@t/app-kit", version: "1.0.0", dependencies: { "@t/clock": "^1.0.0" } }));
    const root = project({ "@t/app-kit": "^1.0.0" });
    await expect(installProject({ root, registry: reg })).rejects.toThrow(/@t\/clock@1.0.0 loads its own module \(added by @t\/app-kit@1.0.0\)/);
    expect(existsSync(join(root, "halo.lock"))).toBe(false);
    await installProject({ root, registry: reg, trust: true });
    expect(JSON.stringify(readLockV2(root))).not.toContain("trust");
    expect(readLockV2(root).packages["@t/clock"]!.permissions.code).toBe(true);
    // Only a direct dependency's providers get bare names.
    expect((await loadPackageProviders(root)).map((p) => p.name).filter((p) => p.includes("Ticker"))).toEqual(["@t/clock#Ticker"]);
    // Already trusted at this checksum: no --trust needed again.
    await installProject({ root, registry: reg });
    const other = fresh();
    writeFileSync(join(other, "halo.json"), readFileSync(join(root, "halo.json")));
    writeFileSync(join(other, "halo.lock"), readFileSync(join(root, "halo.lock")));
    await expect(installProject({ root: other, registry: reg })).rejects.toThrow(/--trust/);
    await installProject({ root: other, registry: reg, trust: true });
    rmSync(join(other, ".halo/trust.json"));
    await expect(loadPackageProviders(other)).rejects.toThrow(/hasn't trusted this version/);
  });

  test("providers load under qualified names, and bare names only when unambiguous", async () => {
    const reg = await folderRegistry(
      v2({ name: "@one/a", version: "1.0.0", providers: { Client: http("one", "api.one.io"), OneOnly: http("one", "api.one.io") } }),
      v2({ name: "@two/b", version: "1.0.0", providers: { Client: http("two", "api.two.io"), Bash: http("two", "api.two.io") } }),
    );
    const root = project({ "@one/a": "^1.0.0", "@two/b": "^1.0.0" });
    await installProject({ root, registry: reg });
    const names = (await loadPackageProviders(root)).map((p) => p.name).sort();
    expect(names).toEqual(["@one/a#Client", "@one/a#OneOnly", "@two/b#Bash", "@two/b#Client", "OneOnly"]);
    expect(installedProviderNames(root).sort()).toEqual(names);
    expect(TOOL_PROVIDERS).toContain("Bash");
  });

  test("folder and file dependencies, and a halo.json scope map", async () => {
    const reg = await folderRegistry(v2({ name: "@acme/dep", version: "1.0.0" }));
    const local = v2({ name: "@me/local", version: "0.3.0", dependencies: { "@acme/dep": "^1.0.0" } });
    const root = project({ "@me/local": local }, { registries: { "@acme": reg } });
    // The default registry is empty: @acme comes from the scope's registry.
    const report = await installProject({ root, registry: fresh() });
    expect(report.packages.map((p) => `${p.name}@${p.version}`)).toEqual(["@acme/dep@1.0.0", "@me/local@0.3.0"]);
    expect(readLockV2(root).packages["@me/local"]!.source).toBe(local);
    await expect(installProject({ root: project({ "@other/name": local }) })).rejects.toThrow(/which is the package @me\/local/);
  });

  test("a v1 halo.lock migrates on the next install", async () => {
    const root = fresh();
    const v1dir = join(root, "tools/acme");
    mkdirSync(v1dir, { recursive: true });
    writeFileSync(join(v1dir, "halo-tool.json"), JSON.stringify({ name: "acme", version: "1.0.0", description: "d", providers: { Acme: http("acme", "api.acme.io") } }));
    await installV1({ root, builtins: [...TOOL_PROVIDERS] }, v1dir);
    expect((await loadPackageProviders(root)).map((p) => p.name)).toEqual(["Acme"]);
    // A first-party package from v1's default registry.
    const lock = JSON.parse(readFileSync(join(root, "halo.lock"), "utf8"));
    lock.tools.stripe = { version: "1.0.0", source: "registry:default#stripe@1.0.0", sha256: "old", providers: ["Stripe"], permissions: { network: ["api.stripe.com"], env: ["STRIPE_API_KEY"], spawn: [], code: false } };
    writeFileSync(join(root, "halo.lock"), JSON.stringify(lock));

    const report = await installProject({ root });
    expect(report.migrated.sort()).toEqual(["acme", "stripe"]);
    expect(JSON.parse(readFileSync(join(root, "halo.json"), "utf8")).dependencies).toEqual({ "@halo/stripe": "^1.0.0", acme: "./tools/acme" });
    const packages = readLockV2(root).packages;
    expect(Object.keys(packages)).toEqual(["@halo/stripe", "acme"]);
    expect(packages["@halo/stripe"]!.source).toBe("registry:default");
    expect(packages.acme!.source).toBe("tools/acme");
    expect(existsSync(join(root, ".halo/tools"))).toBe(false);
    expect((await loadPackageProviders(root)).map((p) => p.name).sort()).toEqual(["@halo/stripe#Stripe", "Acme", "Stripe", "acme#Acme"]);
  });

  test("the bundled registry's packages are all valid v2 packages", async () => {
    const client = new RegistryClient(DEFAULT_REGISTRY);
    const index = await client.index();
    expect(index.map((p) => p.name)).toEqual(["@halo/cloudflare", "@halo/github-mcp", "@halo/jira", "@halo/notion", "@halo/sentry", "@halo/stripe", "@halo/world-time"]);
    const root = project(Object.fromEntries(index.map((p) => [p.name, `^${p.latest}`])));
    const report = await installProject({ root, trust: true });
    expect(report.packages.length).toBe(7);
    for (const p of index) expect((await client.doc(p.name))!.readme).toContain(`# ${p.name}`);
  });
});

describe("the package CLI", () => {
  test("add, info, search, outdated, update and remove against the bundled and a folder registry", async () => {
    const app = fresh();
    const add = await cli(app, ["add", "stripe"]);
    expect(add.err).toBe("");
    expect(add.out).toContain("✓ @halo/stripe@1.0.0");
    expect(add.out).toContain(`use "@halo/stripe" { Stripe }`);
    expect(JSON.parse(readFileSync(join(app, "halo.json"), "utf8")).dependencies).toEqual({ "@halo/stripe": "^1.0.0" });
    expect((await cli(app, ["add", "world-time"])).err).toContain("--trust");
    expect((await cli(app, ["info", "stripe"])).out).toContain("STRIPE_API_KEY");
    const search = await cli(app, ["search", "payments"]);
    expect(search.out).toContain("@halo/stripe@1.0.0 (installed 1.0.0)");
    expect((await cli(app, ["tools", "--json"])).out).toContain(`"name": "Stripe"`);

    const reg = await folderRegistry(v2({ name: "@t/a", version: "1.0.0" }), v2({ name: "@t/a", version: "1.1.0" }), v2({ name: "@t/a", version: "2.0.0" }));
    const r = ["--registry", reg];
    expect((await cli(app, ["add", "@t/a@~1.0.0", ...r])).code).toBe(0);
    const outdated = await cli(app, ["outdated", ...r]);
    expect(outdated.out).toMatch(/@t\/a\s+1\.0\.0\s+1\.0\.0\s+2\.0\.0/);
    const update = await cli(app, ["update", "@t/a", "--latest", ...r]);
    expect(update.out).toContain("@t/a 1.0.0 → 2.0.0");
    expect(JSON.parse(readFileSync(join(app, "halo.json"), "utf8")).dependencies["@t/a"]).toBe("^2.0.0");
    expect((await cli(app, ["remove", "@t/a", ...r])).out).toContain("removed @t/a");
    expect(Object.keys(readLockV2(app).packages)).toEqual(["@halo/stripe"]);
    expect((await cli(app, ["remove", "nothing"])).err).toContain("not in halo.json");
  });

  test("init --package, pack, publish to a folder, then add it with its use line", async () => {
    const dir = join(fresh(), "greeter");
    const init = await cli(join(dir, ".."), ["init", "--package", "greeter", "--name", "@me/greeter"]);
    expect(init.err).toBe("");
    for (const f of ["halo.json", "README.md", "lib/main.halo"]) expect(existsSync(join(dir, f))).toBe(true);
    const packed = await cli(dir, ["pack", "--out", "dist"]);
    expect(packed.out).toContain("me-greeter-0.1.0.halotool");
    const reg = fresh();
    const dry = await cli(dir, ["publish", "--dry-run", "--registry", reg]);
    expect(dry.out).toContain("Dry run");
    expect(existsSync(join(reg, INDEX_PATH))).toBe(false);
    const pub = await cli(dir, ["publish", "--registry", reg]);
    expect(pub.err).toBe("");
    expect(existsSync(join(reg, packageFilePath("@me/greeter", "0.1.0")))).toBe(true);
    expect((await cli(dir, ["publish", "--registry", reg])).err).toContain("already published");
    const info = await cli(dir, ["info", "@me/greeter", "--registry", reg]);
    expect(info.out).toContain("model slots");
    expect(info.out).toContain("pipelines  Answer");

    const app = fresh();
    const add = await cli(app, ["add", "@me/greeter", "--registry", reg]);
    expect(add.out).toContain(`use "@me/greeter" { Answer, Helper } with models(main: anthropic/claude-haiku-4-5)`);
    expect((await cli(app, ["deprecate", "@me/greeter@<1", "Use", "2.x", "--registry", reg])).out).toContain("deprecated @me/greeter@<1: Use 2.x");
    expect((await cli(app, ["install", "--registry", reg])).out).toContain("deprecated: Use 2.x");
    expect((await cli(app, ["dist-tag", "add", "@me/greeter@0.1.0", "beta", "--registry", reg])).code).toBe(0);
    expect((await cli(app, ["dist-tag", "ls", "@me/greeter", "--registry", reg])).out).toContain("beta: 0.1.0");
  }, 30_000);

  test("a hard-coded model stops publish", async () => {
    const dir = v2({ name: "@me/bad", version: "1.0.0", exports: ["lib/a.halo"] }, { "lib/a.halo": "agent A [openai/gpt-4o]\npipeline P(x: String) -> Result:\n  x |> A.prompt(\"hi\")\n" });
    const r = await cli(dir, ["publish", "--registry", fresh()]);
    expect(r.code).toBe(1);
    expect(r.err).toContain("hard-codes the model");
  });

  test("validate and run see installed providers through the new lock", async () => {
    const app = fresh();
    await cli(app, ["add", "stripe"]);
    writeFileSync(join(app, "pay.halo"), `tool Pay : Stripe()\npipeline P(x: String) -> Result:\n  x |> Pay.get_balance()\n`);
    const v = await cli(app, ["validate", "pay.halo"]);
    expect(v.out).toContain("0 error(s)");
  });
});

void PackageError;
