import { test, expect, describe, afterAll } from "bun:test";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parse } from "../src/parser/index";
import { analyzePackage, checkLinked, entryPipelines, importableNames, link, type LinkOptions } from "../src/linker/index";
import { HaloRuntime, type MockRequest, type RuntimeEvent } from "../src/runtime/runtime";
import { plan } from "../src/plan";
import { qualifiedProvider, type PackageManifest, type PackageResolver, type ResolvedPackage } from "../src/registry/contract";
import { startServer } from "../src/serve/server";
import { RegistryClient } from "../src/registry/client";
import { pack } from "../src/registry/format";
import { installProject } from "../src/registry/install";
import { compile } from "../src/index";
import { getDiagnostics } from "../src/lsp/diagnostics";
import { getCompletions } from "../src/lsp/completions";
import { getHover } from "../src/lsp/hover";
import { getDefinition } from "../src/lsp/definition";

const root = resolve(`${import.meta.dir}/..`);
const FIXTURES = join(root, "test/fixtures");
const quiet = { log() {}, warn() {}, error() {} };
const tmp = mkdtempSync(join(tmpdir(), "halo-linker-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

/** A resolver over in-memory packages; enforces that a package uses only its dependencies. */
function memoryResolver(packages: Record<string, { dir: string; manifest: PackageManifest }>): PackageResolver {
  return {
    resolve(name: string, from?: ResolvedPackage) {
      if (from && !Object.hasOwn(from.manifest.dependencies ?? {}, name)) return undefined;
      const p = packages[name];
      return p ? { name, version: p.manifest.version, dir: p.dir, manifest: p.manifest } : undefined;
    },
  };
}

/** The fixture packages in test/fixtures/packages, as installed packages. */
const fixtureResolver = (): PackageResolver => {
  const pkg = (folder: string) => {
    const dir = join(FIXTURES, "packages", folder);
    return { dir, manifest: JSON.parse(readFileSync(join(dir, "halo.json"), "utf8")) as PackageManifest };
  };
  return memoryResolver({ "@acme/support-kit": pkg("acme-support-kit"), "@acme/zendesk": pkg("acme-zendesk") });
};

const diskRead = (p: string) => (existsSync(p) ? readFileSync(p, "utf8") : undefined);

/** Link `/p/main.halo` from in-memory files (paths under /p, or package folders). */
function memLink(files: Record<string, string>, options: Partial<LinkOptions> = {}) {
  return link("/p/main.halo", { readFile: (p) => files[p], ...options });
}

const errors = (l: ReturnType<typeof link>) => l.diagnostics.filter((d) => d.severity === "error").map((d) => d.message);

const manifest = (m: Partial<PackageManifest> & { name: string }): PackageManifest => ({ version: "1.0.0", description: "test", ...m }) as PackageManifest;

describe("use: parsing", () => {
  test("names, renames and model bindings", () => {
    const ast = parse(`use "@acme/kit" { A, B as C, } with models(fast: anthropic/claude-haiku-4-5, smart: "openai/gpt-5")\nuse "./x.halo" {}\nuse "stripe"`);
    expect(ast.errors).toEqual([]);
    expect(ast.uses!.map((u) => ({ source: u.source, items: u.items?.map((i) => [i.name, i.as]), models: u.models?.map((m) => [m.slot, m.model]) }))).toEqual([
      { source: "@acme/kit", items: [["A", undefined], ["B", "C"]], models: [["fast", "anthropic/claude-haiku-4-5"], ["smart", "openai/gpt-5"]] },
      { source: "./x.halo", items: [], models: undefined },
      { source: "stripe", items: undefined, models: undefined },
    ]);
    expect(ast.uses![0]!.loc).toEqual({ line: 1, column: 0 });
  });

  test("with needs models; use and with stay usable as argument names", () => {
    expect(parse(`use "@acme/kit" { A } with modles(fast: x/y)`).errors[0]).toContain(`expected "models" after "with"`);
    const ast = parse(`agent A [openai/gpt-4o]\npipeline P(x: String): x |> A.run(use: 1, with: 2) as use`);
    expect(ast.errors).toEqual([]);
    expect(ast.pipelines[0]!.pipeline[1]).toMatchObject({ namedArgs: { use: "1", with: "2" }, bind: "use" });
  });

  test("an agent's model can be a slot", () => {
    expect(parse(`agent A [models.fast, temperature: 0]`).agents[0]!.modelId).toBe("models.fast");
  });
});

describe("linking local files", () => {
  const shared = `
policy Careful : Block(PII)
agent Helper [openai/gpt-4o] requires Careful
pipeline Shout(text: String) -> String:
  text |> Helper.shout("Shout this: {{text}}")`;

  test("imported names resolve everywhere, and imported pipelines run", async () => {
    const l = memLink({
      "/p/main.halo": `use "./lib/shared.halo" { Shout, Careful, Helper as H }
agent Mine [openai/gpt-4o] requires Careful
pipeline Main(text: String) -> String:
  text |> Shout() |> H.again() |> Mine.finish()`,
      "/p/lib/shared.halo": shared,
    });
    expect(l.diagnostics).toEqual([]);
    expect(l.files.map((f) => f.path)).toEqual(["/p/main.halo", "/p/lib/shared.halo"]);
    expect(l.program.agents.find((a) => a.name === "Mine")!.requires).toEqual(["lib/shared#Careful"]);
    expect(l.names).toMatchObject({ "lib/shared#Shout": "Shout", "lib/shared#Helper": "H", "lib/shared#Careful": "Careful" });
    expect(entryPipelines(l.program).map((p) => p.name)).toEqual(["Main"]);
    expect(checkLinked(l)).toEqual([]);

    const rt = new HaloRuntime({ logger: quiet }).load(l.program);
    // Mocks use the names people see: H (as imported here) for Helper, and qualified names always work.
    rt.mockAll({ "Helper.shout": "wrong", "H.shout": (r: MockRequest) => `${String(r.input).toUpperCase()}!`, "lib/shared#Helper.again": (r: MockRequest) => `${r.input}!`, "Mine.finish": (r: MockRequest) => `${r.input} (done)` });
    const r = await rt.run("Main", { text: "hi" });
    expect(r.output).toBe("HI!! (done)");
    expect(r.context.meta.calls.map((c) => c.target)).toEqual(["H.shout", "H.again", "Mine.finish"]);
    // Results are stored under the name the pipeline wrote.
    expect(Object.keys(r.context.data)).toContain("H");
    expect(rt.listPipelines().map((p) => p.name)).toEqual(["Main"]);
  });

  test("private names in different files never collide", async () => {
    const bot = (word: string) => `agent Bot [openai/gpt-4o]\npipeline P${word}(x: String) -> String:\n  x |> Bot.say("${word}")`;
    const l = memLink({
      "/p/main.halo": `use "./a.halo" { Pa }\nuse "./b.halo" { Pb }\nagent Bot [openai/gpt-4o]\npipeline Main(x: String) -> Result:\n  x |> Pa() |> Pb() |> Bot.end()`,
      "/p/a.halo": bot("a"),
      "/p/b.halo": bot("b"),
    });
    expect(errors(l)).toEqual([]);
    expect(l.program.agents.map((a) => a.name).sort()).toEqual(["Bot", "a#Bot", "b#Bot"]);
    // Three Bots: the imported files' keep their internal names on display, so a mock can't mean two.
    expect(l.names["a#Bot"]).toBe("a#Bot");
    const rt = new HaloRuntime({ logger: quiet }).load(l.program);
    rt.mockAll({ "a#Bot.say": "A", "b#Bot.say": (r: MockRequest) => `${r.input}B`, "Bot.end": (r: MockRequest) => `${r.input}!` });
    expect((await rt.run("Main", { x: "" })).output).toBe("AB!");
  });

  test("an unknown name in another file can't reach the entry file's names", () => {
    const l = memLink({
      "/p/main.halo": `use "./lib.halo" { P }\nagent Secret [openai/gpt-4o]\npipeline Main(x: String): x |> P()`,
      "/p/lib.halo": `pipeline P(x: String): x |> Secret.go()`,
    });
    expect(l.diagnostics).toEqual([]);
    const diags = checkLinked(l);
    expect(diags).toContainEqual(expect.objectContaining({ severity: "error", file: "/p/lib.halo", line: 1, message: expect.stringContaining(`unknown callee "Secret"`) }));
  });

  test("collisions: with a local declaration, and between two imports", () => {
    const files = { "/p/a.halo": `schema Ticket { id: String }\nagent X [openai/gpt-4o]`, "/p/b.halo": `schema Ticket { id: Number }` };
    const local = memLink({ ...files, "/p/main.halo": `use "./a.halo" { Ticket }\nschema Ticket { id: String }` });
    expect(errors(local)).toEqual([`"Ticket" is imported from "./a.halo" and also declared in this file; rename the import: { Ticket as OtherTicket }`]);
    const twice = memLink({ ...files, "/p/main.halo": `use "./a.halo" { Ticket }\nuse "./b.halo" { Ticket }` });
    expect(errors(twice)).toEqual([`"Ticket" is imported from both "./a.halo" and "./b.halo"; rename one: { Ticket as OtherTicket }`]);
    expect(twice.diagnostics[0]).toMatchObject({ file: "/p/main.halo", line: 2 });
    const renamed = memLink({ ...files, "/p/main.halo": `use "./a.halo" { Ticket }\nuse "./b.halo" { Ticket as BTicket }\nuse "./a.halo" { Ticket, X }` });
    expect(errors(renamed)).toEqual([]);
  });

  test("missing files, missing names, and bad paths", () => {
    const l = memLink({
      "/p/main.halo": `use "./nope.halo" { A }\nuse "./lib.halo" { Missing }\nuse "./lib.txt" { A }\nuse "/abs.halo" { A }\nuse "Not A Name" { A }`,
      "/p/lib.halo": `agent A [openai/gpt-4o]`,
    });
    expect(errors(l)).toEqual([
      `use "./nope.halo": file not found (/p/nope.halo)`,
      `use "./lib.halo": ./lib.halo has no declaration "Missing" (it declares A)`,
      `use "./lib.txt": a path must name a .halo file`,
      `use "/abs.halo": write a relative path ("./file.halo", "../shared/file.halo") or a package name ("@acme/support-kit")`,
      `use "Not A Name": not a package name like "@acme/support-kit" or a path like "./shared.halo"`,
    ]);
  });

  test("circular uses are an error that shows the cycle", () => {
    const l = memLink({
      "/p/main.halo": `use "./a.halo" { A }`,
      "/p/a.halo": `use "./b.halo" { B }\nagent A [openai/gpt-4o]`,
      "/p/b.halo": `use "./a.halo" { A }\nagent B [openai/gpt-4o]`,
    });
    expect(errors(l)).toEqual([`use "./a.halo" makes a cycle: a.halo → b.halo → a.halo. Move what both files need into a third file`]);
    expect(l.diagnostics[0]!.file).toBe("/p/b.halo");
  });

  test("syntax errors in a used file stop the link and name the file", () => {
    const l = memLink({ "/p/main.halo": `use "./bad.halo" { A }`, "/p/bad.halo": `agent A [` });
    expect(l.ok).toBe(false);
    expect(l.program.errors[0]).toStartWith("/p/bad.halo: [1:");
    expect(() => new HaloRuntime().load(l.program)).toThrow("parse errors");
  });

  test("a use with no braces imports nothing; with models is for packages", () => {
    const l = memLink({ "/p/main.halo": `use "./lib.halo"\nuse "./lib.halo" { A } with models(fast: x/y)\npipeline P(x: String): x |> A.go()`, "/p/lib.halo": `agent A [openai/gpt-4o]` });
    expect(errors(l)).toEqual([`use "./lib.halo": with models(...) is for packages; the project's own agents get their models from halo.json "models"`]);
  });
});

describe("linking packages", () => {
  const appWith = (main: string, options: Partial<LinkOptions> = {}) => link("/app/main.halo", { readFile: (p) => (p === "/app/main.halo" ? main : diskRead(p)), resolver: fixtureResolver(), ...options });

  test("the support-app fixture links: qualified names, provider keys, model slots", () => {
    const l = link(join(FIXTURES, "projects/support-app/main.halo"), { readFile: diskRead, resolver: fixtureResolver(), projectModels: { smart: "anthropic/claude-sonnet-4-5" } });
    expect(l.diagnostics).toEqual([]);
    expect(l.packages.map((p) => p.name)).toEqual(["@acme/support-kit", "@acme/zendesk"]);
    expect(l.files.map((f) => [f.package, f.path.split("/").slice(-2).join("/"), f.exported])).toEqual([
      [undefined, "support-app/main.halo", undefined],
      ["@acme/support-kit", "lib/support.halo", true],
      ["@acme/support-kit", "lib/internal.halo", false],
    ]);
    const tool = l.program.tools.find((t) => t.name === "@acme/support-kit#Desk")!;
    expect(tool.provider).toBe(qualifiedProvider("@acme/zendesk", "Zendesk"));
    const agents = Object.fromEntries(l.program.agents.map((a) => [a.name, a]));
    expect(agents["@acme/support-kit#Triager"]).toMatchObject({ modelId: "anthropic/claude-haiku-4-5", equips: ["@acme/support-kit#Desk"], requires: ["@acme/support-kit/lib/internal#Polite"] });
    expect(agents.Writer!.modelId).toBe("anthropic/claude-sonnet-4-5");
    expect(l.program.schemas.find((s) => s.name === "@acme/support-kit#Classification")!.fields[0]).toEqual({ name: "category", type: "@acme/support-kit/lib/internal#Category" });
    expect(l.names).toMatchObject({ "@acme/support-kit#Triager": "Triager", "@acme/zendesk#Zendesk": "Zendesk", "@acme/support-kit/lib/internal#Polite": "Polite" });
    expect(l.imports.Triage).toMatchObject({ kind: "pipeline", from: "@acme/support-kit", qualified: "@acme/support-kit#Triage", line: 18 });
    expect(checkLinked(l)).toEqual([]);
  });

  test("a private name is an error naming where it is and what is exported", () => {
    const l = appWith(`use "@acme/support-kit" { Polite, Nope } with models(fast: x/y)`);
    expect(errors(l)).toEqual([
      `use "@acme/support-kit": "Polite" is private to @acme/support-kit (declared in lib/internal.halo, which isn't exported). A package exports only the declarations in its exported files: lib/support.halo`,
      `use "@acme/support-kit": @acme/support-kit doesn't export "Nope" (it exports Triage, Triager, Desk, Classification)`,
    ]);
  });

  test("a package that isn't installed", () => {
    expect(errors(appWith(`use "@acme/missing" { X }`))).toEqual([`use "@acme/missing": package @acme/missing is not installed (run halo add @acme/missing)`]);
    expect(errors(appWith(`use "stripe" { Stripe }`))).toEqual([`use "stripe": package @halo/stripe is not installed (run halo add @halo/stripe)`]);
    expect(errors(link("/app/main.halo", { readFile: () => `use "@acme/zendesk" { Zendesk }` }))).toHaveLength(1);
  });

  test("a package may only use its own dependencies", () => {
    const resolver = memoryResolver({
      "@x/a": { dir: "/pk/a", manifest: manifest({ name: "@x/a", exports: ["a.halo"] }) },
      "@x/b": { dir: "/pk/b", manifest: manifest({ name: "@x/b", exports: ["b.halo"] }) },
    });
    const files: Record<string, string> = {
      "/p/main.halo": `use "@x/a" { A }\nuse "@x/b" { B }`,
      "/pk/a/a.halo": `use "@x/b" { B }\npipeline A(x: String): x |> B()`,
      "/pk/b/b.halo": `pipeline B(x: String): x`,
    };
    const l = memLink(files, { resolver });
    expect(errors(l)).toEqual([`use "@x/b": @x/b is not in @x/a's dependencies (add it to "dependencies" in its halo.json)`]);
    expect(l.diagnostics[0]!.file).toBe("/pk/a/a.halo");
  });

  test("a package's files can't reach outside it", () => {
    const resolver = memoryResolver({ "@x/a": { dir: "/pk/a", manifest: manifest({ name: "@x/a", exports: ["a.halo"] }) } });
    const l = memLink({ "/p/main.halo": `use "@x/a" { A }`, "/pk/a/a.halo": `use "../../p/main.halo" { X }\nagent A [models.m]` }, { resolver, projectModels: { m: "x/y" } });
    expect(errors(l)).toEqual([`use "../../p/main.halo": a package can only use files inside it`]);
  });

  test("tools on a package's provider get the provider's qualified name, and run through it", async () => {
    const resolver = memoryResolver({
      "@x/desk": { dir: "/pk/desk", manifest: manifest({ name: "@x/desk", providers: { Desk: { kind: "http", baseUrl: "https://desk.example.com", methods: [{ name: "get", description: "get" }] } as never } }) },
      "@x/kit": { dir: "/pk/kit", manifest: manifest({ name: "@x/kit", exports: ["kit.halo"], dependencies: { "@x/desk": "^1.0.0" } }) },
    });
    const l = memLink(
      {
        "/p/main.halo": `use "@x/kit" { Fetch }\nuse "@x/desk" { Desk as D }\ntool Mine : D()\npipeline Main(id: String): id |> Fetch() |> Mine.get()`,
        "/pk/kit/kit.halo": `use "@x/desk" { Desk }\ntool T : Desk(region: "eu")\npipeline Fetch(id: String): id |> T.get(id: id)`,
      },
      { resolver },
    );
    expect(errors(l)).toEqual([]);
    expect(l.program.tools.map((t) => [t.name, t.provider])).toEqual([
      ["Mine", "@x/desk#Desk"],
      ["@x/kit#T", "@x/desk#Desk"],
    ]);
    expect(checkLinked(l)).toEqual([]);
    const seen: string[] = [];
    const rt = new HaloRuntime({ logger: quiet }).load(l.program);
    rt.registerToolProvider(qualifiedProvider("@x/desk", "Desk"), async (call) => (seen.push(`${call.tool.name}.${call.method}`), `ticket ${call.named.id ?? call.positional[0]}`));
    expect((await rt.run("Main", { id: "7" })).output).toBe("ticket ticket 7");
    expect(seen).toEqual(["@x/kit#T.get", "Mine.get"]);
  });

  test("two packages may both export the same name; the consumer renames one", () => {
    const resolver = memoryResolver({
      "@x/a": { dir: "/pk/a", manifest: manifest({ name: "@x/a", exports: ["m.halo"] }) },
      "@x/b": { dir: "/pk/b", manifest: manifest({ name: "@x/b", exports: ["m.halo"] }) },
    });
    const files = { "/pk/a/m.halo": `pipeline Go(x: String): x`, "/pk/b/m.halo": `pipeline Go(x: String): x` };
    expect(errors(memLink({ ...files, "/p/main.halo": `use "@x/a" { Go }\nuse "@x/b" { Go }` }, { resolver }))).toEqual([`"Go" is imported from both "@x/a" and "@x/b"; rename one: { Go as OtherGo }`]);
    const ok = memLink({ ...files, "/p/main.halo": `use "@x/a" { Go }\nuse "@x/b" { Go as GoB }` }, { resolver });
    expect(errors(ok)).toEqual([]);
    expect(ok.names).toMatchObject({ "@x/a#Go": "Go", "@x/b#Go": "GoB" });
  });
});

describe("model slots", () => {
  const resolver = () =>
    memoryResolver({
      "@x/kit": {
        dir: "/pk/kit",
        manifest: manifest({ name: "@x/kit", exports: ["kit.halo"], models: { fast: { description: "Classifies things. Needs tool calls.", suggested: "anthropic/claude-haiku-4-5" }, smart: { description: "Writes replies." } }, dependencies: { "@x/inner": "^1.0.0" } }),
      },
      "@x/inner": { dir: "/pk/inner", manifest: manifest({ name: "@x/inner", exports: ["inner.halo"], models: { fast: { description: "Inner work." } } }) },
    });
  const files = {
    "/pk/kit/kit.halo": `use "@x/inner" { Inner } with models(fast: models.smart)\nagent Quick [models.fast]\nagent Wise [models.smart]\npipeline Go(x: String): x |> Quick.a() |> Wise.b() |> Inner()`,
    "/pk/inner/inner.halo": `agent Deep [models.fast]\npipeline Inner(x: String): x |> Deep.c()`,
  };
  const models = (l: ReturnType<typeof link>) => Object.fromEntries(l.program.agents.map((a) => [a.name, a.modelId]));

  test("the use line wins, then halo.json; a binding applies only to that package's agents", () => {
    const l = memLink({ ...files, "/p/main.halo": `use "@x/kit" { Go } with models(fast: openai/gpt-5-mini)\nagent Mine [models.fast]` }, { resolver: resolver(), projectModels: { fast: "project/fast", smart: "project/smart" } });
    expect(errors(l)).toEqual([]);
    expect(models(l)).toEqual({
      Mine: "project/fast", // the project's own agents: halo.json
      "@x/kit#Quick": "openai/gpt-5-mini", // the use line
      "@x/kit#Wise": "project/smart", // not on the use line: halo.json
      "@x/inner#Deep": "project/smart", // @x/kit's use line binds inner's fast to kit's smart slot
    });
  });

  test("a slot object in halo.json uses its suggested model (a package's own tests)", () => {
    const l = memLink({ ...files, "/p/main.halo": `use "@x/kit" { Go }` }, { resolver: resolver(), projectModels: { fast: { description: "x", suggested: "s/fast" }, smart: { description: "y", suggested: "s/smart" } } });
    expect(errors(l)).toEqual([]);
    expect(models(l)["@x/kit#Quick"]).toBe("s/fast");
  });

  test("an unfilled slot is an error naming it, what it's for, and a model that works", () => {
    const l = memLink({ ...files, "/p/main.halo": `use "@x/kit" { Go } with models(smart: a/b)\nagent Mine [models.house]` }, { resolver: resolver() });
    expect(errors(l)).toEqual([
      `Agent "Mine" uses model slot "house", which has no model; add it to halo.json: "models": { "house": "<model id>" }`,
      `Agent "Quick" in @x/kit needs a model for slot "fast", and none is given. @x/kit says it classifies things. Needs tool calls. Fill it where you use the package: use "@x/kit" { ... } with models(fast: anthropic/claude-haiku-4-5), or in halo.json: "models": { "fast": "anthropic/claude-haiku-4-5" }`,
    ]);
    expect(l.diagnostics.find((d) => d.message.includes("Quick"))).toMatchObject({ file: "/pk/kit/kit.halo", line: 2 });
  });

  test("binding a slot two ways is an error; an unknown slot is a warning", () => {
    const l = memLink(
      { ...files, "/p/main.halo": `use "@x/kit" { Go } with models(fast: a/one, smart: a/b, typo: c/d)\nuse "./other.halo" { O }`, "/p/other.halo": `use "@x/kit" { Go } with models(fast: a/two)\npipeline O(x: String): x |> Go()` },
      { resolver: resolver() },
    );
    expect(errors(l)).toEqual([`@x/kit's model slot "fast" is bound to a/one in main.halo:1 and to a/two here; bind it in one place`]);
    expect(l.diagnostics.filter((d) => d.severity === "warning").map((d) => d.message)).toEqual([`with models(typo: ...): @x/kit has no model slot "typo" (it has fast, smart)`]);
  });
});

describe("display names", () => {
  test("events, recordings, errors and plans show the names people know", async () => {
    const l = memLink({
      "/p/main.halo": `use "./lib.halo" { Check }\npipeline Main(x: String): x |> Check()`,
      "/p/lib.halo": `agent Judge [openai/gpt-4o]\ntool Web : REST("api.example.com")\npipeline Check(x: String): x |> Web.get() |> Judge.rate()`,
    });
    const events: RuntimeEvent[] = [];
    const recorded: string[] = [];
    const rt = new HaloRuntime({ logger: quiet, onEvent: (e) => events.push(e), recorder: (c) => recorded.push(c.target) }).load(l.program);
    rt.mockAll({ "Web.get": "page", "Judge.rate": "5/5" });
    await rt.run("Main", { x: "a" });
    expect(recorded).toEqual(["Web.get", "Judge.rate"]);
    expect(events.filter((e) => e.type === "llm").map((e) => (e as { agent: string }).agent)).toEqual(["Judge"]);
    expect(events.filter((e) => e.type === "tool").map((e) => (e as { tool: string }).tool)).toEqual(["Web"]);
    expect(JSON.stringify(events)).not.toContain("lib#");

    const failing = new HaloRuntime({ logger: quiet }).load(l.program);
    failing.mockAll({ "Web.get": () => Promise.reject(new Error("down")) });
    await expect(failing.run("Main", { x: "a" })).rejects.toThrow("down");

    const p = plan(l.program, "Main", { providerInfo: (name) => rt.toolProviderInfo(name) });
    expect(p.steps.map((s) => s.label)).toEqual(["Check(...)", "Web.get", "Judge.rate"]);
    expect(JSON.stringify(p)).not.toContain("lib#");
  });

  test("validator messages about imported declarations use display names and point at their file", () => {
    const l = memLink({ "/p/main.halo": `use "./lib.halo" { A }\npipeline Main(x: String): x |> A.go()`, "/p/lib.halo": `agent A [openai/gpt-4o] equips Missing` });
    expect(checkLinked(l)).toEqual([expect.objectContaining({ severity: "error", file: "/p/lib.halo", line: 1, message: `Agent "A" equips undefined tool "Missing"` })]);
  });

  test("compile() reports use lines a lone file can't resolve", () => {
    const r = compile(`use "./x.halo" { A }`);
    expect(r.ok).toBe(false);
    expect(r.diagnostics[0]!.message).toContain("file not found");
  });
});

describe("analyzePackage", () => {
  const filesOf = (folder: string) => {
    const dir = join(FIXTURES, "packages", folder);
    const files: Record<string, string> = {};
    for (const f of new Bun.Glob("**/*").scanSync(dir)) files[f] = readFileSync(join(dir, f), "utf8");
    return { files, manifest: JSON.parse(files["halo.json"]!) as PackageManifest };
  };

  test("the support kit: exported names by kind, and the env its tools read", () => {
    const { files, manifest: m } = filesOf("acme-support-kit");
    const a = analyzePackage(files, m);
    expect(a.diagnostics).toEqual([]);
    expect(a.exports).toEqual({ pipelines: ["Triage"], agents: ["Triager"], tools: ["Desk"], stores: [], schemas: ["Classification"], policies: [], providers: [], skills: [] });
    expect(a).toMatchObject({ network: [], env: ["ZENDESK_SUBDOMAIN"], spawn: [], code: false });
    expect(a.effects).toEqual([{ tool: "Desk", file: "lib/support.halo", provider: "Zendesk", network: [], env: ["ZENDESK_SUBDOMAIN"], spawn: [], code: false, fromPackage: true }]);
  });

  test("the zendesk package exports its provider", () => {
    const { files, manifest: m } = filesOf("acme-zendesk");
    expect(analyzePackage(files, m).exports.providers).toEqual(["Zendesk"]);
  });

  test("built-in tools' reach, skills, and package rules", () => {
    const m = manifest({ name: "@x/k", exports: ["main.halo"], models: { fast: { description: "d" } }, skills: "skills" });
    const a = analyzePackage(
      {
        "main.halo": `use "./lib/tools.halo" { Api }\nagent A [models.fast]\nagent B [openai/gpt-4o]\nagent C [models.nope]\npipeline P(x: String): x |> Api.get()`,
        "lib/tools.halo": `tool Api : REST("https://api.example.com/v1")\ntool Sh : Bash()\ntool Gh : GitHub(Env.GH)\ntool Hook : POST(Env.HOOK_URL)\nstore Mem : KV("x")`,
        "unused.halo": `tool Far : MCP("npx some-server")`,
        "skills/triage/SKILL.md": "---\nname: triage\n---\n",
      },
      m,
    );
    expect(a.exports.skills).toEqual(["triage"]);
    expect(a.exports.agents).toEqual(["A", "B", "C"]);
    expect(a.network).toEqual(["*", "api.example.com", "api.github.com"]);
    expect(a.env).toEqual(["GH", "HOOK_URL"]);
    expect(a.spawn).toEqual(["bash"]);
    expect(a.code).toBe(true);
    expect(a.effects.find((e) => e.tool === "Mem")).toMatchObject({ local: true });
    expect(a.diagnostics.map((d) => [d.file, d.message])).toEqual([
      ["main.halo", `Agent "B" names a model (openai/gpt-4o); a package's agents use model slots, [models.<slot>], so the people using it choose their models`],
      ["main.halo", `Agent "C" uses model slot "nope", which halo.json "models" doesn't declare (add { "description": "...", "suggested": "..." })`],
    ]);
  });

  test("missing exports, undeclared dependencies, and names declared in two exported files", () => {
    const m = manifest({ name: "@x/k", exports: ["a.halo", "b.halo", "gone.halo"] });
    const a = analyzePackage({ "a.halo": `use "@x/other" { O }\npipeline P(x: String): x`, "b.halo": `pipeline P(x: String): x` }, m);
    expect(a.diagnostics.map((d) => d.message)).toEqual([
      `use "@x/other": @x/other is not in the package's dependencies`,
      `"P" is declared in two exported files (a.halo and b.halo); exported files share the package's names`,
      "exports: gone.halo is not in the package",
    ]);
  });
});

describe("importableNames", () => {
  test("lists what a file or package exports", () => {
    expect(importableNames(join(FIXTURES, "projects/support-app/main.halo"), "@acme/support-kit", { readFile: diskRead, resolver: fixtureResolver() })).toEqual([
      { name: "Triage", kind: "pipeline" },
      { name: "Triager", kind: "agent" },
      { name: "Desk", kind: "tool" },
      { name: "Classification", kind: "schema" },
    ]);
    expect(importableNames("/p/main.halo", "./lib.halo", { readFile: (p) => (p === "/p/lib.halo" ? "agent A [x/y]" : undefined) })).toEqual([{ name: "A", kind: "agent" }]);
  });
});

/**
 * A copy of the support app with its packages installed for real: both fixtures are
 * published to a folder registry, then installed (halo.lock, checksums) from it.
 */
async function installedApp(): Promise<string> {
  const dir = mkdtempSync(join(tmp, "app-"));
  cpSync(join(FIXTURES, "projects/support-app"), dir, { recursive: true });
  const registry = mkdtempSync(join(tmp, "registry-"));
  const client = new RegistryClient(registry);
  for (const folder of ["acme-zendesk", "acme-support-kit"]) await client.publish(pack(join(FIXTURES, "packages", folder)).bytes);
  await installProject({ root: dir, registry });
  return dir;
}

describe("editor support", () => {
  test("diagnostics, completions, hover and go-to-definition see imported names", async () => {
    const dir = await installedApp();
    const main = join(dir, "main.halo");
    const text = readFileSync(main, "utf8");
    expect(getDiagnostics(text, main)).toEqual([]);
    // Without the path, the use line can't be resolved: say so on it.
    expect(getDiagnostics(text)[0]!.message).toContain("is not installed");
    const typo = getDiagnostics(text.replace("{ Triage,", "{ Triag,"), main);
    expect(typo[0]).toMatchObject({ message: expect.stringContaining(`doesn't export "Triag"`), range: { start: { line: 0 } } });

    const at = (line: number, character: number) => ({ line, character });
    expect(getCompletions(`use "`, at(0, 5), main).map((c) => c.label)).toEqual(expect.arrayContaining(["@acme/support-kit", "@acme/zendesk"]));
    expect(getCompletions(`use "@acme/support-kit" { `, at(0, 26), main).map((c) => c.label)).toEqual(["Triage", "Triager", "Desk", "Classification"]);
    expect(getCompletions(`${text}\n`, at(text.split("\n").length, 0), main).map((c) => c.label)).toEqual(expect.arrayContaining(["Triage", "Classification", "Writer", "use"]));

    const hover = getHover(text, at(0, 28), main);
    expect((hover!.contents as { value: string }).value).toContain("**pipeline** `Triage(ticket: String) -> Classification`");
    expect((getHover(text, at(0, 8), main)!.contents as { value: string }).value).toContain("**@acme/support-kit** 1.2.0");

    const def = getDefinition(text, at(0, 28), main)!;
    expect(def.uri).toEndWith(".halo/packages/@acme/support-kit/lib/support.halo");
    expect(def.range.start.line).toBe(17);
    expect(getDefinition(text, at(0, 10), main)!.uri).toEndWith("support-kit/lib/support.halo");
  });
});

describe("end to end", () => {
  test("the support app runs Inbox with the fixture mocks", async () => {
    const app = join(FIXTURES, "projects/support-app");
    const config = JSON.parse(readFileSync(join(app, "halo.json"), "utf8"));
    const l = link(join(app, "main.halo"), { readFile: diskRead, resolver: fixtureResolver(), projectModels: config.models });
    expect(checkLinked(l)).toEqual([]);
    const events: RuntimeEvent[] = [];
    const rt = new HaloRuntime({ logger: quiet, onEvent: (e) => events.push(e) }).load(l.program);
    rt.mockAll(JSON.parse(readFileSync(join(app, "mocks.json"), "utf8")));
    const r = await rt.run("Inbox", { ticket: "I invited a teammate but the email never came." });
    expect(r.status).toBe("completed");
    expect(r.output).toBe("Hi! Sorry about the missing invite. Resend it from Settings, Members.");
    expect(r.context.data.triaged).toEqual({ category: { name: "account" }, urgency: "normal", summary: "Invite email never arrived." });
    expect(r.context.meta.calls.map((c) => [c.pipeline, c.target, c.model])).toEqual([
      ["Triage", "Triager.classify", "anthropic/claude-haiku-4-5"],
      ["Inbox", "Writer.prompt", "anthropic/claude-sonnet-4-5"],
    ]);
    expect(rt.listPipelines().map((p) => p.name)).toEqual(["Inbox"]);
  });

  test("the CLI runs the support app from .halo/packages", async () => {
    const dir = await installedApp();
    const cli =(...args: string[]) => {
      const p = Bun.spawnSync(["bun", join(root, "index.ts"), ...args], { cwd: dir, env: { ...Bun.env, NO_COLOR: "1" } });
      return { code: p.exitCode, out: p.stdout.toString(), err: p.stderr.toString() };
    };
    const v = cli("validate", "main.halo");
    expect(v.err).toBe("");
    expect(v.out).toContain("1 file(s), 0 error(s)");
    const r = cli("run", "main.halo", "--mocks", "mocks.json", "--arg", "ticket=Where is my invite?", "--json", "--no-telemetry");
    expect(r.err).not.toContain("Warning");
    expect(r.code).toBe(0);
    expect(JSON.parse(r.out).output).toBe("Hi! Sorry about the missing invite. Resend it from Settings, Members.");
    const p = cli("plan", "main.halo");
    expect(p.out).toContain("Triager.classify");
    expect(p.out).not.toContain("#");

    // An unfilled slot fails before anything runs.
    await Bun.write(join(dir, "main.halo"), readFileSync(join(dir, "main.halo"), "utf8").replace(" with models(fast: anthropic/claude-haiku-4-5)", ""));
    const bad = cli("validate", "main.halo");
    expect(bad.code).toBe(1);
    expect(bad.out).toContain(`needs a model for slot "fast"`);
    expect(bad.out).toContain(".halo/packages/@acme/support-kit/lib/support.halo:13");
  });

  test("halo serve: a pipeline calls a pipeline from another file through use", async () => {
    const dir = mkdtempSync(join(tmp, "serve-"));
    await Bun.write(join(dir, "lib.halo"), `agent Upper [openai/gpt-4o]\npipeline Shout(text: String) -> String:\n  text |> Upper.shout()`);
    await Bun.write(join(dir, "main.halo"), `use "./lib.halo" { Shout }\npipeline Greet(name: String) -> String:\n  name |> Shout()`);
    const s = await startServer({ files: [dir], port: 0, stateDir: join(dir, ".halo"), scheduler: false, logger: quiet, env: {}, onRuntime: (rt) => rt.mockAll({ "Upper.shout": (r: MockRequest) => `${String(r.input).toUpperCase()}!` }) });
    try {
      const list = (await (await fetch(`${s.url}/api/pipelines`)).json()) as Array<{ name: string }>;
      expect(list.map((p) => p.name).sort()).toEqual(["Greet", "Shout"]);
      const res = await fetch(`${s.url}/api/pipelines/Greet/runs`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ args: { name: "ada" }, wait: true }) });
      expect(((await res.json()) as { output: unknown }).output).toBe("ADA!");
    } finally {
      await s.stop();
    }
  });
});
