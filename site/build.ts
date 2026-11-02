/**
 * Build the showcase site into site/dist:
 *
 *   1. Gather real data from the repo: the examples and their headers, the
 *      bundled registry's packages, every built-in provider's methods, a real
 *      `halo plan`, and a recorded run.
 *   2. Bundle the page and its playground, which runs Halo's own parser,
 *      validator, and planner in the browser.
 *   3. Build the docs (VitePress) under /docs/.
 *
 *   bun site/build.ts            (add --no-docs to skip the docs build)
 */

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse } from "../src/parser/index.ts";
import { formatPlan, plan } from "../src/plan.ts";
import { BUILTIN_PROVIDER_INFO } from "../src/runtime/provider-info.ts";
import { describePermissions } from "../src/registry/manifest.ts";
import pkg from "../package.json" with { type: "json" };

const root = resolve(import.meta.dir, "..");
const site = import.meta.dir;
const dist = join(site, "dist");
const gen = join(site, ".gen");

// ── Data ──

/** An example's header: the text between its first two `// ====` rules. */
function header(source: string): { title: string; about: string; run?: string } {
  const lines = source.split("\n");
  const rules = lines.flatMap((l, i) => (/^\/\/ ?=+\s*$/.test(l) ? [i] : []));
  const head = rules.length >= 2 ? lines.slice(rules[0]! + 1, rules[1]) : [];
  const text = head.map((l) => l.replace(/^\/\/ ?/, ""));
  const title = (text[0] ?? "").replace(/^(STEP \d+|FLAGSHIP|PURPOSE)\s*:\s*/i, "").trim();
  const about: string[] = [];
  let run: string[] | undefined;
  for (const l of text.slice(1)) {
    if (/^\s*(RUN|TRY)\s*:/.test(l)) run = [l.replace(/^\s*(RUN|TRY)\s*:\s*/, "")];
    else if (run && /^\s{4,}/.test(l)) run.push(l.trim());
    else if (!run) about.push(l.replace(/^(PURPOSE|Learn)\s*:\s*/i, "").trim());
  }
  return { title, about: about.join(" ").replace(/\s+/g, " ").trim(), run: run?.join(" ") };
}

const examples = readdirSync(join(root, "examples"))
  .filter((f) => /^\d+-.*\.halo$/.test(f))
  .sort()
  .map((file) => {
    const source = readFileSync(join(root, "examples", file), "utf8");
    const ast = parse(source);
    return {
      file,
      number: Number(file.split("-")[0]),
      ...header(source),
      source,
      pipelines: ast.pipelines.map((p) => p.name),
      features: {
        tools: /tools:\s*(\[|auto)/.test(source),
        policies: ast.policies.length > 0,
        loops: source.includes("|<>"),
        parallel: source.includes("|*"),
        humans: /\|!|~>/.test(source),
      },
    };
  });

const registry = JSON.parse(readFileSync(join(root, "registry/index.json"), "utf8"));
const packages = await Promise.all(Object.entries(registry.packages as Record<string, any>).map(async ([name, p]) => {
  const manifest = JSON.parse(readFileSync(join(root, "registry/src", name, "halo-tool.json"), "utf8"));
  const release = p.versions[p.latest];
  return {
    name,
    version: p.latest,
    description: p.description,
    publisher: p.publisher,
    homepage: p.homepage,
    sha256: release.sha256,
    permissions: release.permissions,
    permissionLines: describePermissions(release.permissions),
    providers: await Promise.all(
      Object.entries(manifest.providers as Record<string, any>).map(async ([provider, spec]) => {
        // A module's methods are in its code (our own first-party packages, so importing them here is fine).
        const listed = spec.kind === "module" ? ((await import(join(root, "registry/src", name, spec.entry))).info?.methods ?? []) : (spec.methods ?? []);
        return { name: provider, kind: spec.kind, methods: listed.map((m: any) => ({ name: m.name, effect: m.effect, description: m.description })) };
      }),
    ),
  };
}));

/** Built-in providers' static method lists (MCP and Chrome list theirs at run time). */
const providers = Object.fromEntries(
  Object.entries(BUILTIN_PROVIDER_INFO).map(([name, info]) => [
    name,
    { description: info.description, methods: Array.isArray(info.methods) ? info.methods.map((m) => ({ name: m.name, effect: m.effect, description: m.description })) : null },
  ]),
);

const planned = (file: string, pipeline: string) => {
  const ast = parse(readFileSync(join(root, "examples", file), "utf8"));
  return formatPlan(plan(ast, pipeline, { providerInfo: (p) => BUILTIN_PROVIDER_INFO[p] }));
};

/** Run the test suite: the site shows how many pass, and a failing suite stops the build. */
function passingTests(): number {
  if (process.argv.includes("--no-tests")) return 0;
  const run = Bun.spawnSync(["bun", "test"], { cwd: root, stdout: "pipe", stderr: "pipe", env: { ...process.env, NO_COLOR: "1" } });
  const out = run.stdout.toString() + run.stderr.toString();
  const pass = Number(out.match(/^\s*(\d+) pass/m)?.[1] ?? 0);
  const fail = Number(out.match(/^\s*(\d+) fail/m)?.[1] ?? 0);
  if (run.exitCode !== 0 || fail > 0 || !pass) {
    console.error(out.split("\n").filter((l) => /\(fail\)|error:/.test(l)).slice(0, 20).join("\n"));
    throw new Error(`The test suite failed (${fail} failing): not building the site`);
  }
  console.log(`tests: ${pass} pass`);
  return pass;
}

// ── Real CLI output, for the code and output pairs on the page ──

const SNIPPETS: Record<string, string> = {
  "hello.halo": `agent Greeter [anthropic/claude-haiku-4-5, temp: 0.7]

pipeline Hello(name: String) -> Result:
  name
    |> Greeter.greet("Write a one-line greeting for {{name}}.")
    |> System.Print()
`,
  "triage.halo": `policy Guard : AllowTools("Repo.get_issue", "Repo.comment", "Repo.add_labels")
  & ApproveTools("Repo.comment")
  & MaxSpend(0.25)

tool Repo : GitHub(Env.GITHUB_TOKEN, repo: "acme/api")

agent Triager [anthropic/claude-haiku-4-5, max_steps: 6]
  equips Repo
  requires Guard

pipeline Triage(issue: Number) -> Result:
  issue
    |> Triager.triage("Read issue #{{issue}}, label it, and draft a reply.", tools: [Repo])
`,
  "typo.halo": `agent Writer [openai/gpt-4o] requires Brand

pipeline Post(topic: String) -> Result:
  topic
    |> Writer.draft("A short post about {{topic}}") as draft
    |> Slack.post(text: "{{draft}}")
`,
};

/** Run the CLI on the snippets in a scratch folder and keep what it prints. */
function cli(...args: string[]): { cmd: string; out: string } {
  const run = Bun.spawnSync(["bun", join(root, "index.ts"), ...args], { cwd: scratch, env: { ...process.env, NO_COLOR: "1", HALO_API_KEY: "", ANTHROPIC_API_KEY: "", OPENAI_API_KEY: "", GEMINI_API_KEY: "" } });
  const out = (run.stdout.toString() + run.stderr.toString()).replaceAll(scratch + "/", "").replace(/\d+ms · /, "6ms · ").trimEnd();
  return { cmd: `halo ${args.filter((a) => a !== "--no-telemetry" && a !== "--no-record").join(" ")}`, out };
}
const scratch = join(gen, "cli");
rmSync(scratch, { recursive: true, force: true });
mkdirSync(scratch, { recursive: true });
for (const [file, text] of Object.entries(SNIPPETS)) await Bun.write(join(scratch, file), text);
const runs = {
  hello: cli("test", "hello.halo", "--arg", "name=Ada", "--no-telemetry"),
  plan: cli("plan", "triage.halo"),
  validate: cli("validate", "typo.halo"),
  help: cli("--help"),
};
rmSync(join(scratch, ".halo"), { recursive: true, force: true });

/** Every docs page and its title, for search. */
const docPages = [...new Bun.Glob("**/*.md").scanSync(join(root, "docs"))]
  .filter((f) => !f.startsWith("node_modules") && !f.includes(".vitepress"))
  .map((f) => {
    const title = readFileSync(join(root, "docs", f), "utf8").match(/^#\s+(.+)$/m)?.[1]?.replace(/`/g, "").trim();
    return { title: title ?? f, path: `/docs/${f.replace(/(^|\/)index\.md$/, "$1").replace(/\.md$/, ".html")}` };
  })
  .filter((p) => p.title);

const fixerRun = JSON.parse(readFileSync(join(site, "data/fixer-run.json"), "utf8"));

const data = {
  version: pkg.version,
  builtAt: new Date().toISOString().slice(0, 10),
  examples,
  packages,
  providers,
  plans: { research: planned("75-research-assistant.halo", "Research") },
  fixerRun,
  snippets: SNIPPETS,
  runs,
  docPages,
  counts: {
    examples: examples.length,
    // GET and SQL are other names for REST and PostgreSQL.
    providers: new Set(Object.values(BUILTIN_PROVIDER_INFO)).size,
    packages: packages.length,
    tests: passingTests(),
  },
};

mkdirSync(gen, { recursive: true });
await Bun.write(join(gen, "data.json"), JSON.stringify(data));

// ── Page ──

rmSync(dist, { recursive: true, force: true });
const built = await Bun.build({
  entrypoints: [join(site, "src/index.html"), join(site, "src/404.html")],
  outdir: dist,
  target: "browser",
  minify: true,
  sourcemap: "none",
});
if (!built.success) {
  for (const log of built.logs) console.error(log);
  process.exit(1);
}
// The package registry is served from the site: `halo add` in an installed binary reads it there.
cpSync(join(root, "registry/index.json"), join(dist, "registry/index.json"));
cpSync(join(root, "registry/packages"), join(dist, "registry/packages"), { recursive: true });
for (const extra of ["favicon.svg", "og.png", "robots.txt", "install.sh", "install.ps1"]) {
  if (existsSync(join(site, "src", extra))) cpSync(join(site, "src", extra), join(dist, extra));
}
console.log(`page: ${built.outputs.length} files`);

// ── Docs ──

if (!process.argv.includes("--no-docs")) {
  const docs = Bun.spawnSync(["bunx", "vitepress", "build", "docs"], { cwd: root, env: { ...process.env, DOCS_BASE: "/docs/" }, stdout: "inherit", stderr: "inherit" });
  if (docs.exitCode !== 0) process.exit(docs.exitCode ?? 1);
  cpSync(join(root, "docs/.vitepress/dist"), join(dist, "docs"), { recursive: true });
  console.log("docs: copied to /docs/");
}
console.log(`built ${dist}`);
