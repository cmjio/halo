/**
 * Build halolang.com into site/dist. The site is the VitePress docs, at the root.
 *
 *   1. Gather real data from the repo: the examples, the bundled registry's packages,
 *      every built-in provider's methods, real CLI output, and a recorded run.
 *   2. Write it where the docs read it: docs/.vitepress/generated/ (data for the theme's
 *      components, and code groups of real output to include) and docs/examples/ (a page
 *      per example).
 *   3. Build the docs, then add the package registry.
 *
 *   bun site/build.ts                 everything (runs the test suite first)
 *   bun site/build.ts --generate      only step 2 (bun run docs:dev runs this first)
 *   bun site/build.ts --no-tests      skip the test suite
 */

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse } from "../src/parser/index.ts";
import { formatPlan, plan } from "../src/plan.ts";
import { BUILTIN_PROVIDER_INFO } from "../src/runtime/provider-info.ts";
import { describePermissions } from "../src/registry/manifest.ts";
import pkg from "../package.json" with { type: "json" };
import { SECTIONS, exampleFiles } from "../examples/catalog.ts";
import { icon } from "./src/icons.ts";

const root = resolve(import.meta.dir, "..");
const site = import.meta.dir;
const dist = join(site, "dist");
const gen = join(site, ".gen");

// ── Data ──

/**
 * An example's header: the text between its first two `// ====` rules, or, when that's
 * just a title in its own box, the title plus the text in the box after it.
 */
function header(source: string): { title: string; about: string; run?: string } {
  const lines = source.split("\n");
  const rules = lines.flatMap((l, i) => (/^\/\/ ?=+\s*$/.test(l) ? [i] : []));
  let head = rules.length >= 2 ? lines.slice(rules[0]! + 1, rules[1]) : [];
  if (head.length === 1 && rules.length >= 3) head = [...head, ...lines.slice(rules[1]! + 1, rules[2])];
  const text = head.map((l) => l.replace(/^\/\/ ?/, ""));
  const title = (text[0] ?? "").replace(/^(STEP \d+|CASEBOOK \d+|FLAGSHIP|PURPOSE)\s*:\s*/i, "").trim();
  const about: string[] = [];
  let run: string[] | undefined;
  for (const l of text.slice(1)) {
    if (/^\s*(RUN|TRY)\s*:/.test(l)) run = [l.replace(/^\s*(RUN|TRY)\s*:\s*/, "")];
    else if (run && /^\s{4,}/.test(l)) run.push(l.trim());
    else if (!run) about.push(l.replace(/^(PURPOSE|Learn|Why)\s*:\s*/i, "").trim());
  }
  // A RUN block is shell commands, one per line (continuation lines end with \).
  return { title, about: about.join(" ").replace(/\s+/g, " ").trim(), run: run?.join("\n") };
}

/** Every example, section by section (examples/catalog.ts says which folders, in which order). */
const allExamples = exampleFiles().map((file) => {
  const name = file.split("/").pop()!;
  const source = readFileSync(join(root, "examples", file), "utf8");
  const ast = parse(source);
  return {
    file,
    name,
    section: file.split("/")[0]!,
    // Only learn/'s files are numbered: it's the one folder meant to be read in order.
    number: /^\d+-/.test(name) ? Number(name.split("-")[0]) : undefined,
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
const examples = allExamples;
/** Old example URLs (before the examples were grouped by domain) and the name each one has now. */
const renamed: Record<string, string> = JSON.parse(readFileSync(join(site, "data/renamed-examples.json"), "utf8"));

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
  if (process.argv.includes("--no-tests") || process.argv.includes("--generate")) return 0;
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
  // The playground can open any of them, and groups them by section.
  examples: allExamples,
  sections: SECTIONS,
  renamed,
  packages,
  providers,
  plans: { research: planned("data-research/research-assistant.halo", "Research") },
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

// ── What the docs read ──

const generated = join(root, "docs/.vitepress/generated");
const examplesDir = join(root, "docs/examples");
rmSync(generated, { recursive: true, force: true });
rmSync(examplesDir, { recursive: true, force: true });
mkdirSync(generated, { recursive: true });
mkdirSync(examplesDir, { recursive: true });
await Bun.write(join(generated, "data.json"), JSON.stringify(data));
// Everything but the example sources, for the components on ordinary pages.
await Bun.write(join(generated, "lite.json"), JSON.stringify({ ...data, examples: [], snippets: {}, runs: {}, docPages: [] }));

/** Text that goes into markdown outside a code block: Vue reads {{ }} there, so escape it. */
const md = (text: string) => text.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]!).replace(/\{\{/g, "&#123;&#123;").replace(/\}\}/g, "&#125;&#125;");
const fence = (lang: string, label: string, body: string) => `\`\`\`${lang}${label ? ` [${label}]` : ""}\n${body.replace(/\n+$/, "")}\n\`\`\`\n`;
const shell = (r: { cmd: string; out: string }) => `$ ${r.cmd}\n${r.out}`;

// The home page's tabs: a file, and what the CLI says about it.
await Bun.write(
  join(generated, "hero.md"),
  `::: code-group\n\n${fence("halo", "triage.halo", SNIPPETS["triage.halo"]!)}\n${fence("txt", "$ halo plan", shell(runs.plan))}\n${fence("halo", "typo.halo", SNIPPETS["typo.halo"]!)}\n${fence("txt", "$ halo validate", shell(runs.validate))}\n${fence("halo", "hello.halo", SNIPPETS["hello.halo"]!)}\n${fence("txt", "$ halo test", shell(runs.hello))}\n:::\n`,
);
await Bun.write(join(generated, "help.md"), fence("txt", "", `$ halo --help\n${runs.help.out.trim()}`));
await Bun.write(join(generated, "plan-research.md"), fence("txt", "", `$ halo plan examples/data-research/research-assistant.halo\n${data.plans.research}`));

// A page per example, and the list of them.
// File names are unique across folders, so /examples/software-team stays put whichever folder the file is in.
const slug = (file: string) => file.split("/").pop()!.replace(/\.halo$/, "");
const tags = (f: Record<string, boolean>) =>
  Object.entries({ tools: "tools:", policies: "policies", loops: "|<> loops", parallel: "|* parallel", humans: "|! people" })
    .filter(([k]) => f[k])
    // Labels go in table cells too, where a bare | would end the cell.
    .map(([, label]) => `<span class="tag">${md(label).replace(/\|/g, "&#124;")}</span>`)
    .join(" ");
for (const e of examples) {
  const title = e.title || e.file;
  await Bun.write(
    join(examplesDir, `${slug(e.file)}.md`),
    `---\ntitle: ${JSON.stringify(`${e.file} · ${title}`)}\n---\n\n# ${md(title)}\n\n<p class="ex-meta"><code>examples/${e.file}</code> ${tags(e.features)}</p>\n\n${e.about ? `${md(e.about)}\n\n` : ""}<p class="ex-actions"><a href="/playground?example=${encodeURIComponent(slug(e.file))}">Open in the playground and play with it →</a></p>\n\n${e.run ? fence("bash", "", e.run) + "\n" : ""}${fence("halo", e.file, e.source)}`,
  );
}
const num = (e: (typeof examples)[number]) => (e.number !== undefined ? `<code>${String(e.number).padStart(2, "0")}</code> ` : "");
const sectionMd = SECTIONS.map((s) => {
  const list = examples.filter((e) => e.section === s.folder);
  const rows = list.map((e) => `| ${num(e)}[${md(e.title || e.name).replace(/\|/g, "\\|")}](/examples/${slug(e.file)}) | ${tags(e.features)} |`);
  return `## ${icon(s.icon)} ${s.title}\n\n${md(s.blurb)} <span class="ex-folder"><code>examples/${s.folder}/</code></span>\n\n| Example | |\n|---|---|\n${rows.join("\n")}\n`;
}).join("\n");
await Bun.write(
  join(examplesDir, "index.md"),
  `---\ntitle: Examples\n---\n\n# Examples\n\n${examples.length} working examples. Start with [Learn](#learn), which teaches one idea per file in order; every other section is a domain, from engineering and support to healthcare and dinner plans. Many are agent designs from real work: a system prompt, the tools the agent gets, and what it may do freely, must confirm, or must never do, with the rules that have to hold enforced by policies and gates rather than by the prompt. Where the servers they call are fictional, \`halo plan\` shows what a run would do, offline.\n\nThe test suite validates and runs every one. Each page has the full source; open any of them in the [playground](/playground) and change it.\n\n${sectionMd}`,
);
// The sidebar: one group per section, collapsed except Learn.
const sidebar = SECTIONS.map((s) => ({
  text: `${icon(s.icon)} ${s.title}`,
  collapsed: s.folder !== "learn",
  items: examples
    .filter((e) => e.section === s.folder)
    .map((e) => ({ text: `${e.number !== undefined ? `${String(e.number).padStart(2, "0")} ` : ""}${e.title || e.name}`, link: `/examples/${slug(e.file)}` })),
}));
await Bun.write(join(generated, "examples-sidebar.json"), JSON.stringify(sidebar));

if (process.argv.includes("--generate")) {
  console.log(`generated docs/.vitepress/generated and ${examples.length} example pages`);
  process.exit(0);
}

// ── Build ──

const docs = Bun.spawnSync(["bunx", "vitepress", "build", "docs"], { cwd: root, stdout: "inherit", stderr: "inherit" });
if (docs.exitCode !== 0) process.exit(docs.exitCode ?? 1);
rmSync(dist, { recursive: true, force: true });
cpSync(join(root, "docs/.vitepress/dist"), dist, { recursive: true });
// The package registry is served from the site: `halo add` in an installed binary reads it there.
cpSync(join(root, "registry/index.json"), join(dist, "registry/index.json"));
cpSync(join(root, "registry/packages"), join(dist, "registry/packages"), { recursive: true });
console.log(`built ${dist}`);
