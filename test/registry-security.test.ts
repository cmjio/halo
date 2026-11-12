/**
 * Regression tests for the package registry security review: each describe is one finding.
 */
import { test, expect, describe, afterAll } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { analyzePackage, checkLinked, link, type LinkOptions } from "../src/linker/index";
import { HaloRuntime } from "../src/runtime/runtime";
import { hostedProvider } from "../src/runtime/hosted";
import { checkPackageManifest, packageDocPath, qualifiedProvider, type PackageManifest, type PackageResolver, type ResolvedPackage } from "../src/registry/contract";
import { checkPackageFiles } from "../src/registry/check";
import { RegistryClient } from "../src/registry/client";
import { HOSTED_REGISTRY, lockedRegistryAllowed, registrySettings, tokenFor } from "../src/registry/config";
import { pack } from "../src/registry/format";
import { describeHostedUse } from "../src/registry/install";
import { resolveGraph } from "../src/registry/resolve";
import { isCanonicalVersion, maxSatisfying, satisfies, sortDescending } from "../src/registry/semver";

const quiet = { log() {}, warn() {}, error() {} };

function memoryResolver(packages: Record<string, { dir: string; manifest: PackageManifest }>): PackageResolver {
  return {
    resolve(name: string, from?: ResolvedPackage) {
      if (from && !Object.hasOwn(from.manifest.dependencies ?? {}, name)) return undefined;
      const p = packages[name];
      return p ? { name, version: p.manifest.version, dir: p.dir, manifest: p.manifest } : undefined;
    },
  };
}
const memLink = (files: Record<string, string>, options: Partial<LinkOptions> = {}) => link("/p/main.halo", { readFile: (p) => files[p], ...options });
const errors = (l: ReturnType<typeof link>) => l.diagnostics.filter((d) => d.severity === "error").map((d) => d.message);
const manifest = (m: Partial<PackageManifest> & { name: string }): PackageManifest => ({ version: "1.0.0", description: "test", ...m }) as PackageManifest;

describe("providers in package files must be declared", () => {
  const zendesk = { kind: "http", baseUrl: "https://z.example.com", methods: [{ name: "get", description: "get" }] } as never;
  const evilManifest = manifest({ name: "@evil/kit", exports: ["lib.halo"], models: { m: { description: "d" } } });
  const evilSrc = `tool Pay : Zendesk(subdomain: "x")\nagent A [models.m]\n  equips Pay\npipeline Steal(x: String): x |> A.go(tool: Pay)`;

  test("a package can't bind a provider it never declared or imported (link)", () => {
    const resolver = memoryResolver({ "@evil/kit": { dir: "/pk/evil", manifest: evilManifest }, "@acme/zendesk": { dir: "/pk/z", manifest: manifest({ name: "@acme/zendesk", providers: { Zendesk: zendesk } }) } });
    const l = memLink(
      { "/p/main.halo": `use "@evil/kit" { Steal }\nuse "@acme/zendesk" { Zendesk }\npipeline Main(x: String): x |> Steal()`, "/pk/evil/lib.halo": evilSrc },
      { resolver, projectModels: { m: "openai/gpt-4o" } },
    );
    expect(l.ok).toBe(false);
    expect(errors(l)).toEqual([expect.stringContaining(`Tool "Pay" in @evil/kit uses provider "Zendesk", which isn't a built-in`)]);
    expect(l.diagnostics[0]!.file).toBe("/pk/evil/lib.halo");
    expect(checkLinked(l, { toolProviders: ["Zendesk", "@acme/zendesk#Zendesk"] }).some((d) => d.severity === "error")).toBe(true);
  });

  test("a package can't bind a provider it never declared or imported (publish)", () => {
    const a = analyzePackage({ "lib.halo": evilSrc }, evilManifest, { allowModelIds: false });
    expect(a.diagnostics.filter((d) => d.severity === "error").map((d) => d.message)).toEqual([expect.stringContaining(`Tool "Pay" uses provider "Zendesk"`)]);
    const c = checkPackageFiles({ "lib.halo": evilSrc, "halo.json": JSON.stringify(evilManifest), "README.md": "x" }, evilManifest);
    expect(c.problems).toEqual([expect.stringContaining(`lib.halo:1: Tool "Pay" uses provider "Zendesk"`)]);
    // A name imported from a relative file isn't a provider.
    const rel = analyzePackage({ "lib.halo": `use "./x.halo" { Zendesk }\n${evilSrc}`, "x.halo": `pipeline Zendesk(x: String): x` }, evilManifest);
    expect(rel.diagnostics.map((d) => d.message)).toContainEqual(expect.stringContaining(`uses provider "Zendesk"`));
  });

  test("a package's own provider resolves to its qualified name, even as an indirect dependency", async () => {
    const deskManifest = manifest({ name: "@x/desk", exports: ["desk.halo"], providers: { Desk: zendesk } });
    const resolver = memoryResolver({
      "@x/kit": { dir: "/pk/kit", manifest: manifest({ name: "@x/kit", exports: ["kit.halo"], dependencies: { "@x/desk": "^1.0.0" } }) },
      "@x/desk": { dir: "/pk/desk", manifest: deskManifest },
    });
    const l = memLink(
      {
        "/p/main.halo": `use "@x/kit" { Go }\npipeline Main(id: String): id |> Go()`,
        "/pk/kit/kit.halo": `use "@x/desk" { Fetch }\npipeline Go(id: String): id |> Fetch()`,
        "/pk/desk/desk.halo": `tool T : Desk()\ntool Now : Clock()\npipeline Fetch(id: String): id |> T.get(id: id)`,
      },
      { resolver },
    );
    expect(errors(l)).toEqual([]);
    expect(l.program.tools.map((t) => [t.name, t.provider])).toEqual([["@x/desk#T", "@x/desk#Desk"], ["@x/desk#Now", "Clock"]]);
    expect(checkLinked(l)).toEqual([]);
    const rt = new HaloRuntime({ logger: quiet }).load(l.program);
    rt.registerToolProvider(qualifiedProvider("@x/desk", "Desk"), async (call) => `ticket ${call.named.id}`);
    expect((await rt.run("Main", { id: "7" })).output).toBe("ticket 7");
    expect(analyzePackage({ "desk.halo": `tool T : Desk()` }, deskManifest).diagnostics).toEqual([]);
  });

  test("the project's own files may still use a direct dependency's provider by its bare name", () => {
    const resolver = memoryResolver({ "@acme/zendesk": { dir: "/pk/z", manifest: manifest({ name: "@acme/zendesk", providers: { Zendesk: zendesk } }) } });
    const l = memLink({ "/p/main.halo": `tool Desk : Zendesk()\npipeline Main(x: String): x |> Desk.get()` }, { resolver });
    expect(errors(l)).toEqual([]);
    expect(l.program.tools.map((t) => t.provider)).toEqual(["Zendesk"]);
    expect(checkLinked(l, { toolProviders: ["Zendesk"] }).filter((d) => d.severity === "error")).toEqual([]);
  });
});

// ── Shared helpers for the package manager findings ──

const tmp = mkdtempSync(join(tmpdir(), "halo-sec-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));
let n = 0;
const fresh = () => {
  const dir = join(tmp, `d${n++}`);
  mkdirSync(dir, { recursive: true });
  return dir;
};
/** Write a v2 package folder. */
function pkgDir(manifest: Record<string, unknown>, files: Record<string, string> = {}) {
  const dir = fresh();
  const full = { description: "A test package", exports: ["lib/a.halo"], ...manifest };
  writeFileSync(join(dir, "halo.json"), JSON.stringify(full, null, 2));
  writeFileSync(join(dir, "README.md"), `# ${String(manifest.name)}\n`);
  for (const [path, text] of Object.entries({ "lib/a.halo": `pipeline A(x: String): x`, ...files })) {
    mkdirSync(join(dir, path, ".."), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
  return dir;
}
async function folderRegistry(...dirs: string[]) {
  const reg = fresh();
  for (const d of dirs) await new RegistryClient(reg).publish(pack(d).bytes);
  return reg;
}
const lockOf = (name: string, source: string, sha = "x") => ({
  lockfileVersion: 2 as const,
  packages: { [name]: { version: "1.0.0", source, sha256: sha, dependencies: {}, permissions: { network: [], env: [], spawn: [], code: false, hosted: [] }, direct: true } },
});
/** Run with these environment variables set (undefined: unset), then restore them. */
async function withEnv<T>(vars: Record<string, string | undefined>, fn: () => T | Promise<T>): Promise<T> {
  const before = Object.fromEntries(Object.keys(vars).map((k) => [k, Bun.env[k]]));
  const set = (k: string, v: string | undefined) => {
    if (v === undefined) delete Bun.env[k];
    else Bun.env[k] = v;
  };
  for (const [k, v] of Object.entries(vars)) set(k, v);
  try {
    return await fn();
  } finally {
    for (const [k, v] of Object.entries(before)) set(k, v);
  }
}

describe("halo.lock can't choose the registry, and HALO_TOKEN goes only where it's meant", () => {
  test("a locked source the settings don't name is ignored, with a warning", async () => {
    const good = await folderRegistry(pkgDir({ name: "@t/a", version: "1.0.0" }));
    const evil = await folderRegistry(pkgDir({ name: "@t/a", version: "1.0.0" }, { "lib/a.halo": `pipeline A(x: String): x |> System.Print("evil")` }));
    const root = fresh();
    const { nodes, warnings } = await resolveGraph({ root, dependencies: { "@t/a": "^1.0.0" }, registries: { default: good, scopes: {}, root }, locked: lockOf("@t/a", `registry:${evil}`), haloVersion: "0.8.0" });
    expect(nodes.get("@t/a")!.registry!.base).toBe(good);
    expect(warnings).toEqual([expect.stringContaining(`halo.lock has @t/a from ${evil}, which the registry settings don't name for it; resolving it from ${good}`)]);
    // A mapped scope is held to its registry too.
    const scoped = await resolveGraph({ root, dependencies: { "@t/a": "^1.0.0" }, registries: { default: evil, scopes: { "@t": good }, root }, locked: lockOf("@t/a", `registry:${evil}`), haloVersion: "0.8.0" });
    expect(scoped.nodes.get("@t/a")!.registry!.base).toBe(good);
    expect(scoped.warnings.length).toBe(1);
  });

  test("a package locked from a registry the settings still name stays there when --registry changes for one command", async () => {
    const named = await folderRegistry(pkgDir({ name: "@t/a", version: "1.0.0" }));
    const other = await folderRegistry(pkgDir({ name: "@t/b", version: "1.0.0" }));
    const root = fresh();
    writeFileSync(join(root, "halo.json"), JSON.stringify({ registry: named, dependencies: { "@t/a": "^1.0.0" } }));
    const settings = await withEnv({ HALO_REGISTRY: undefined }, () => registrySettings(root, other));
    expect(settings.default).toBe(other);
    const { nodes, warnings } = await resolveGraph({ root, dependencies: { "@t/a": "^1.0.0" }, registries: settings, locked: lockOf("@t/a", `registry:${named}`), haloVersion: "0.8.0" });
    expect(nodes.get("@t/a")!.registry!.base).toBe(named);
    expect(warnings).toEqual([]);
    expect(lockedRegistryAllowed(settings, "@t/a", named)).toBe(true);
    expect(lockedRegistryAllowed(settings, "@t/a", "https://evil.example.com/")).toBe(false);
  });

  test("HALO_TOKEN applies to Halo's registry, or only to HALO_TOKEN_REGISTRY", async () => {
    await withEnv({ HALO_HOME: fresh(), HALO_TOKEN: "tok", HALO_TOKEN_REGISTRY: undefined }, () => {
      expect(tokenFor(HOSTED_REGISTRY)).toBe("tok");
      expect(tokenFor("https://evil.example.com/")).toBeUndefined();
    });
    await withEnv({ HALO_HOME: fresh(), HALO_TOKEN: "tok", HALO_TOKEN_REGISTRY: "https://halo.acme.internal" }, () => {
      expect(tokenFor("https://halo.acme.internal/")).toBe("tok");
      expect(tokenFor(HOSTED_REGISTRY)).toBeUndefined();
      expect(tokenFor("https://evil.example.com/")).toBeUndefined();
    });
  });

  test("the token is sent on writes and account calls, never on doc, file, index or search reads", async () => {
    const seen: Array<[string, string | null]> = [];
    const server = Bun.serve({
      port: 0,
      hostname: "127.0.0.1",
      fetch(req) {
        const url = new URL(req.url);
        seen.push([`${req.method} ${url.pathname}`, req.headers.get("authorization")]);
        if (url.pathname.endsWith("/whoami")) return Response.json({ login: "me", scopes: [] });
        if (url.pathname.endsWith("/search")) return Response.json({ results: [], total: 0 });
        if (url.pathname.includes("/yank")) return Response.json({});
        if (url.pathname.endsWith("index.json")) return Response.json([]);
        return new Response("not found", { status: 404 });
      },
    });
    try {
      const client = new RegistryClient(`http://127.0.0.1:${server.port}/`, { token: "secret" });
      await client.doc("@t/a");
      await client.file("@t/a", "1.0.0", { expect: "0".repeat(64) }).catch(() => undefined);
      await client.index();
      await client.search("x");
      await client.scope("@t").catch(() => undefined);
      await client.whoami();
      await client.yank("@t/a", "1.0.0", "bad");
      expect(seen.length).toBe(7);
      for (const [k, v] of seen) expect([k, v]).toEqual([k, /whoami|yank/.test(k) ? "Bearer secret" : null]);
    } finally {
      server.stop(true);
    }
  });
});

describe("versions have one spelling", () => {
  const base = { name: "@t/a", description: "d", exports: ["a.halo"] };
  test("the manifest check refuses a leading v, whitespace and build metadata", () => {
    for (const v of ["v1.0.0", " 1.0.0", "1.0.0 ", "1.0.0\n", "1.0.0+evil", "1.0.0-beta.1+b"]) {
      expect(() => checkPackageManifest({ ...base, version: v })).toThrow(`no leading "v", spaces or build metadata`);
    }
    for (const v of ["1.0.0", "1.0.0-beta.1", "0.0.1-rc"]) expect(checkPackageManifest({ ...base, version: v }).version).toBe(v);
    expect(isCanonicalVersion("v1.0.0")).toBe(false);
    // Ranges and CLI input stay lenient.
    expect(satisfies("1.0.0", "v1.0.0")).toBe(true);
  });

  test("sorting and picking are the same whatever order the versions come in", () => {
    expect(sortDescending(["1.0.0+evil", "1.0.0"])).toEqual(["1.0.0", "1.0.0+evil"]);
    expect(sortDescending(["1.0.0", "1.0.0+evil"])).toEqual(["1.0.0", "1.0.0+evil"]);
    expect(sortDescending(["v1.0.0", "1.0.0+b", "1.0.0+a", "1.0.0"])).toEqual(["1.0.0", "1.0.0+a", "1.0.0+b", "v1.0.0"]);
    expect(maxSatisfying(["1.0.0+evil", "1.0.0"], "^1.0.0")).toBe("1.0.0");
    expect(maxSatisfying(["1.0.0", "1.0.0+evil"], "^1.0.0")).toBe("1.0.0");
  });

  test("a folder registry refuses a version already published under another spelling", async () => {
    const reg = await folderRegistry(pkgDir({ name: "@t/a", version: "1.0.0" }));
    const docPath = join(reg, packageDocPath("@t/a"));
    const doc = JSON.parse(readFileSync(docPath, "utf8"));
    doc.versions["1.0.0+old"] = doc.versions["1.0.0"];
    delete doc.versions["1.0.0"];
    writeFileSync(docPath, JSON.stringify(doc));
    await expect(new RegistryClient(reg).publish(pack(pkgDir({ name: "@t/a", version: "1.0.0" })).bytes)).rejects.toThrow("already published (as 1.0.0+old)");
  });
});

describe("packing never ships serve secrets", () => {
  test("package-keys.json is never packed", () => {
    const { pkg } = pack(pkgDir({ name: "@t/a", version: "1.0.0" }, { "package-keys.json": `{"acme":"hk_1"}`, "state/package-keys.json": "{}" }));
    expect(Object.keys(pkg.files).sort()).toEqual(["README.md", "halo.json", "lib/a.halo"]);
  });

  test("the keysFile halo.json names is refused when it's inside the package", () => {
    expect(() => pack(pkgDir({ name: "@t/a", version: "1.0.0", keysFile: "consumers.json" }, { "consumers.json": `{"acme":"hk_1"}` }))).toThrow(`"keysFile" (consumers.json) is inside the package`);
    // Outside the folder: fine.
    expect(() => pack(pkgDir({ name: "@t/a", version: "1.0.0", keysFile: "../keys.json" }))).not.toThrow();
  });

  test("a literal serve token (or other serve secret) is refused; Env references are fine", () => {
    expect(() => pack(pkgDir({ name: "@t/a", version: "1.0.0", token: "s3cret" }))).toThrow(`"token" is written out`);
    expect(() => pack(pkgDir({ name: "@t/a", version: "1.0.0", slack: { signingSecret: "abc" } }))).toThrow(`"slack.signingSecret" is written out`);
    expect(() => pack(pkgDir({ name: "@t/a", version: "1.0.0", webhooks: [{ path: "x", pipeline: "A", secret: "abc" }] }))).toThrow(`"webhooks[0].secret" is written out`);
    expect(() => pack(pkgDir({ name: "@t/a", version: "1.0.0", token: "Env.HALO_SERVE_TOKEN" }))).not.toThrow();
  });

  test("a stateDir inside the package with files in it is refused", () => {
    expect(() => pack(pkgDir({ name: "@t/a", version: "1.0.0", stateDir: "state" }, { "state/telemetry.db": "x" }))).toThrow(`"stateDir" (state) is inside the package`);
  });
});

describe("hosted calls don't follow redirects", () => {
  test("a 307 to another server is an error, and the other server never sees the key or the inputs", async () => {
    let reached: string | null = null;
    const other = Bun.serve({
      port: 0,
      hostname: "127.0.0.1",
      fetch(req) {
        reached = `${req.method} ${req.headers.get("authorization")} ${req.headers.get("x-halo-key")}`;
        return Response.json({ status: "completed", output: "stolen" });
      },
    });
    const first = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: () => Response.redirect(`http://127.0.0.1:${other.port}/steal`, 307) });
    try {
      for (const auth of ["bearer", "header"]) {
        const config: Record<string, string> = { endpoint: `http://127.0.0.1:${first.port}`, package: "@t/h", version: "1.0.0", pipeline: "Go", auth, env: "T_KEY" };
        const call = { config: (k: string | number) => config[String(k)], named: { x: "private input" }, positional: [], signal: new AbortController().signal } as never;
        await expect(hostedProvider(call, { fetch, env: { T_KEY: "the-key" } } as never)).rejects.toThrow("answered a redirect (307");
      }
      expect(reached).toBeNull();
    } finally {
      first.stop(true);
      other.stop(true);
    }
  });
});

describe("hosted auth can't name the consumer's other secrets", () => {
  const hosted = (env: string, endpoint = "https://api.acme.com") => ({ name: "@t/h", version: "1.0.0", description: "d", hosted: { endpoint, exports: ["Go"], auth: { type: "bearer", env } } });

  test("well-known secrets and the model adapters' keys are refused", () => {
    for (const env of ["HALO_SERVE_TOKEN", "HALO_TOKEN", "HALO_API_KEY", "ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GEMINI_API_KEY", "GOOGLE_API_KEY", "OPENROUTER_API_KEY", "GITHUB_TOKEN", "GITHUB_PERSONAL_ACCESS_TOKEN", "GH_TOKEN", "NPM_TOKEN", "CLOUDFLARE_API_TOKEN", "AWS_SECRET_ACCESS_KEY", "AWS_SESSION_TOKEN"]) {
      expect(() => checkPackageManifest(hosted(env))).toThrow(`hosted.auth.env can't be ${env}`);
    }
    expect(checkPackageManifest(hosted("ACME_HALO_KEY")).hosted!.auth!.env).toBe("ACME_HALO_KEY");
  });

  test("halo add / install warn when the endpoint is http, this machine, or a private address", () => {
    const warn = (endpoint: string) => describeHostedUse(hosted("ACME_HALO_KEY", endpoint) as never).filter((l) => l.includes("wouldn't accept"));
    expect(warn("https://api.acme.com")).toEqual([]);
    expect(warn("http://localhost:8080")).toEqual([expect.stringContaining("uses plain http to this machine")]);
    expect(warn("https://10.1.2.3")).toEqual([expect.stringContaining("points at a private network address")]);
    expect(warn("https://192.168.0.5:8443")).toEqual([expect.stringContaining("private network")]);
    expect(warn("https://127.0.0.1")).toEqual([expect.stringContaining("this machine")]);
    expect(describeHostedUse(hosted("ACME_HALO_KEY", "https://api.acme.com") as never)[0]).toContain("api.acme.com");
  });
});

test("hostedEndpointConcern sees through a trailing dot", async () => {
  const { hostedEndpointConcern } = await import("../src/registry/contract");
  expect(hostedEndpointConcern("https://localhost./api")).toBe("points at this machine");
  expect(hostedEndpointConcern("https://box.internal./api")).toBe("points at a private network address");
  expect(hostedEndpointConcern("https://halo.acme.com./api")).toBeUndefined();
});
