/**
 * The package commands: halo add, install, remove, outdated, update, search, info, pack,
 * publish, yank, unyank, deprecate, dist-tag, owner, scope, login, logout, whoami, token,
 * and init --package. src/cli.ts dispatches here with the command's raw arguments.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { isPackageName, normalizePackageName, parsePackageName, PROJECT_FILE, README_FILE, type PackageDoc, type PackageStats, type ScopeRole } from "./contract.js";
import { defaultRangeFor, isValidRange, isValidVersion } from "./semver.js";
import { BUNDLED_REGISTRY, HOSTED_REGISTRY, readProjectConfig, registryFor, registrySettings, removeCredential, saveCredential, tokenFor, type RegistrySettings } from "./config.js";
import { RegistryClient, RegistryError, versionsOf } from "./client.js";
import { exportsOf, PackageError, permissionsOfPackage, publishProblems, readPackage, sha256, type PackageData } from "./format.js";
import { describeHosted, packWithHosted } from "./hosted.js";
import { addDependencies, describeHostedUse, describeInstall, describeOwn, HALO_VERSION, installProject, type InstallReport } from "./install.js";
import { readAnyLock, readLockV2 } from "./lockfile.js";
import { isLocalSpec, readLocal, specOfSource } from "./resolve.js";
import { publish as publishV1, uninstall as uninstallV1 } from "./packages.js";
import { hostOf, ManifestError } from "./manifest.js";

/** Commands this module handles (`init` only with --package). */
export const PACKAGE_COMMANDS = ["add", "install", "remove", "uninstall", "outdated", "update", "search", "info", "stats", "pack", "publish", "yank", "unyank", "deprecate", "dist-tag", "owner", "scope", "login", "logout", "whoami", "token"] as const;

export const PACKAGE_HELP = `PACKAGES:
  halo add <name[@range]> ...           Add packages to halo.json and install them (bare names are
                                        @halo/<name>; also a folder, .halotool file or https URL)
  halo install [--trust]                Install what halo.json and halo.lock pin (--trust: allow
                                        packages that run code; trust is never read from the lock)
  halo remove <name> ...                Remove packages
  halo outdated                         Newer versions, within and beyond your ranges
  halo update [name ...] [--latest]     Move to the newest versions your ranges allow (--latest:
                                        also beyond them, rewriting the ranges)
  halo search [query]                   Find packages in the registry
  halo info <name>                      Versions, exports, model slots, permissions and README
  halo stats <name|@scope> [--days n]   Downloads (by day and version) and the packages that depend
                                        on yours, with the chain through which they do
  halo tools [--json]                   List every tool provider and its methods
  halo agents [--json]                  List the built-in agent presets (agent X [model, preset: Name])
  halo skills [name] [--dir skills]     List skills (yours and built-in), or print one
  halo init --package [dir]             Start a package: halo.json, README.md, lib/main.halo
  halo pack [dir] [--out <folder>]      Bundle a package folder into a .halotool file
  halo publish [dir|file] [--dry-run]   Check, pack and publish (--registry <url or folder>)
  halo yank <name>@<version> [--reason <text>]   Hide a version from resolution; locks keep it
  halo unyank <name>@<version>
  halo deprecate <name>@<range> <message>        Warn on install ("" clears it)
  halo dist-tag add <name>@<version> <tag> | rm <name> <tag> | ls <name>
  halo owner add|rm <name|@scope> <login> [--role owner|publisher] | ls <name|@scope>
  halo scope create <@scope> | verify <@scope> <domain>
  halo login | logout | whoami          Sign in to the registry (device code; HALO_TOKEN overrides, for Halo's registry or HALO_TOKEN_REGISTRY)
  halo token create [--name n] [--read-only] [--scope @s] | list | revoke <id>
  Registry: --registry, then HALO_REGISTRY, then "registry" in halo.json; scopes map with
  "registries": { "@acme": "https://..." } in halo.json.`;

// ── Output ──

const useColor = process.stdout.isTTY && !Bun.env.NO_COLOR;
const paint = (code: number) => (s: string) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const red = paint(31);
const yellow = paint(33);
const green = paint(32);
const dim = paint(2);
const bold = paint(1);

class UsageError extends Error {}
const fail = (message: string): never => {
  throw new UsageError(message);
};

// ── Flags ──

interface Flags {
  positional: string[];
  values: Map<string, string[]>;
  bools: Set<string>;
}

const BOOLS = new Set(["trust", "dry-run", "json", "package", "read-only", "latest", "yes", "force", "help"]);

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { positional: [], values: new Map(), bools: new Set() };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (!arg.startsWith("--") || arg === "--") {
      flags.positional.push(arg);
      continue;
    }
    const [key, inline] = arg.slice(2).split(/=(.*)/s, 2) as [string, string | undefined];
    if (BOOLS.has(key)) {
      flags.bools.add(key);
      continue;
    }
    const value = inline ?? argv[++i];
    if (value === undefined) fail(`--${key} needs a value`);
    flags.values.set(key, [...(flags.values.get(key) ?? []), value!]);
  }
  return flags;
}

const last = (flags: Flags, key: string) => flags.values.get(key)?.at(-1);

export interface PackageCommandOptions {
  cwd?: string;
  fetch?: typeof fetch;
  /** Where output goes (default: console). */
  log?: (line: string) => void;
}

interface Ctx {
  root: string;
  flags: Flags;
  fetch?: typeof fetch;
  log: (line: string) => void;
  settings: () => RegistrySettings;
  /** The registry for a package (its scope's, or the default), with its token. */
  clientFor: (name: string) => RegistryClient;
  /** The default registry (or --registry), with its token. */
  defaultClient: () => RegistryClient;
  /** The registry service for account commands: --registry or the default, never the bundled folder. */
  serviceClient: () => RegistryClient;
}

/** Run a package command. Returns the exit code; errors are printed, not thrown. */
export async function runPackageCommand(command: string, argv: string[], options: PackageCommandOptions = {}): Promise<number> {
  const root = options.cwd ?? process.cwd();
  const log = options.log ?? ((line: string) => console.log(line));
  try {
    const flags = parseFlags(argv);
    const flag = last(flags, "registry");
    let settings: RegistrySettings | undefined;
    const ctx: Ctx = {
      root,
      flags,
      fetch: options.fetch,
      log,
      settings: () => (settings ??= registrySettings(root, flag)),
      clientFor: (name) => {
        const loc = flag ? ctx.settings().default : registryFor(ctx.settings(), name);
        return new RegistryClient(loc, { fetch: options.fetch, token: tokenFor(loc) });
      },
      defaultClient: () => new RegistryClient(ctx.settings().default, { fetch: options.fetch, token: tokenFor(ctx.settings().default) }),
      serviceClient: () => {
        const loc = ctx.settings().default === BUNDLED_REGISTRY && !flag ? HOSTED_REGISTRY : ctx.settings().default;
        return new RegistryClient(loc, { fetch: options.fetch, token: tokenFor(loc) });
      },
    };
    switch (command) {
      case "add":
        return await cmdAdd(ctx);
      case "install":
        return await cmdInstall(ctx);
      case "remove":
      case "uninstall":
        return await cmdRemove(ctx);
      case "outdated":
        return await cmdOutdated(ctx);
      case "update":
        return await cmdUpdate(ctx);
      case "search":
        return await cmdSearch(ctx);
      case "info":
        return await cmdInfo(ctx);
      case "stats":
        return await cmdStats(ctx);
      case "init":
        return cmdInitPackage(ctx);
      case "pack":
        return cmdPack(ctx);
      case "publish":
        return await cmdPublish(ctx);
      case "yank":
      case "unyank":
        return await cmdYank(ctx, command === "unyank");
      case "deprecate":
        return await cmdDeprecate(ctx);
      case "dist-tag":
        return await cmdDistTag(ctx);
      case "owner":
        return await cmdOwner(ctx);
      case "scope":
        return await cmdScope(ctx);
      case "login":
        return await cmdLogin(ctx);
      case "logout":
        return cmdLogout(ctx);
      case "whoami":
        return await cmdWhoami(ctx);
      case "token":
        return await cmdToken(ctx);
      default:
        return fail(`Unknown package command: ${command}`);
    }
  } catch (err) {
    const known = err instanceof UsageError || err instanceof PackageError || err instanceof ManifestError || err instanceof RegistryError;
    console.error(red(`Error: ${err instanceof Error ? err.message : String(err)}`));
    if (!known && err instanceof Error && Bun.env.HALO_DEBUG) console.error(err.stack);
    return 1;
  }
}

// ── Names ──

/** `@acme/kit@^1.2`, `stripe@1.0.0`, `stripe` → name (bare → @halo/) and the part after the @. */
export function splitSpec(spec: string): { name: string; rest?: string } {
  const at = spec.indexOf("@", spec.startsWith("@") ? 1 : 0);
  const name = at > 0 ? spec.slice(0, at) : spec;
  const rest = at > 0 ? spec.slice(at + 1) : undefined;
  return { name: normalizePackageName(name), rest: rest === "" ? undefined : rest };
}

function mustName(name: string): string {
  if (!isPackageName(name)) fail(`"${name}" is not a package name like @acme/support-kit`);
  return name;
}

// ── Installing ──

function printReport(ctx: Ctx, report: InstallReport, only?: Set<string>) {
  for (const w of report.warnings ?? []) ctx.log(yellow(`! ${w}`));
  if (report.migrated.length) ctx.log(`${yellow("!")} migrated halo.lock to v2 (${report.migrated.join(", ")} → halo.json dependencies)`);
  for (const r of report.packages) {
    if (only && !only.has(r.name)) continue;
    ctx.log(`${green("✓")} ${bold(`${r.name}@${r.version}`)}${r.direct ? "" : dim(` (added by ${r.addedBy.join(", ")})`)}`);
    for (const line of describeOwn(r.permissions)) ctx.log(dim(`    ${line}`));
    // Not dimmed: hosted pipelines send the consumer's data to someone else's server.
    for (const line of describeHostedUse(r.pkg.manifest)) ctx.log(yellow(`  ! ${line}`));
  }
  const shown = report.packages.filter((r) => !only || only.has(r.name));
  if (report.packages.length > 1 && shown.length !== 1) {
    ctx.log(dim(`  all ${report.packages.length} packages together:`));
    for (const line of describeOwn(report.total)) ctx.log(dim(`    ${line}`));
  }
  for (const name of report.removed) ctx.log(`${dim("-")} ${name}`);
  for (const r of report.packages) {
    const deprecated = r.pkg && deprecationOf(r);
    if (deprecated) ctx.log(yellow(`! ${r.name}@${r.version} is deprecated: ${deprecated}`));
  }
}

const deprecations = new Map<string, string>();
const deprecationOf = (r: { name: string; version: string }) => deprecations.get(`${r.name}@${r.version}`);

/** The example `use` line for a package: its exports and model slots. */
export function useLine(pkg: PackageData): string[] {
  const e = exportsOf(pkg);
  const names = [...e.pipelines, ...e.agents, ...e.schemas, ...e.tools, ...e.policies, ...e.stores, ...e.providers];
  const shown = names.length ? `{ ${names.slice(0, 5).join(", ")}${names.length > 5 ? ", …" : ""} }` : "{ … }";
  const slots = Object.entries(pkg.manifest.models ?? {});
  const models = slots.length ? ` with models(${slots.map(([slot, s]) => `${slot}: ${s.suggested ?? "<model id>"}`).join(", ")})` : "";
  const lines = [`use "${pkg.name}" ${shown}${models}`];
  for (const p of e.providers) lines.push(`tool X : ${p}(...)`);
  return lines;
}

async function cmdAdd(ctx: Ctx): Promise<number> {
  const specs = ctx.flags.positional;
  if (!specs.length) fail("Usage: halo add <name[@range]> ... [--trust] (or a folder, .halotool file, or https URL)");
  const add: Record<string, string> = {};
  for (const spec of specs) {
    if (isLocalSpec(spec)) {
      const read = await readLocal(spec, ctx.root, ctx.fetch);
      add[read.pkg.name] = specOfSource(read.source);
      continue;
    }
    const { name, rest } = splitSpec(spec);
    mustName(name);
    if (rest !== undefined) {
      if (!isValidRange(rest)) fail(`"${rest}" is not a version or range (try ${name}@^1.2.0)`);
      add[name] = rest;
      continue;
    }
    const client = ctx.clientFor(name);
    const doc = await client.doc(name);
    if (!doc) fail(`No package ${name} in ${client.base}`);
    add[name] = defaultRangeFor(doc!.distTags.latest);
  }
  const report = await addDependencies({ root: ctx.root, add, trust: ctx.flags.bools.has("trust"), registry: last(ctx.flags, "registry"), fetch: ctx.fetch });
  await noteDeprecations(ctx, report);
  printReport(ctx, report, new Set(report.packages.filter((r) => r.changed || r.name in add).map((r) => r.name)));
  for (const name of Object.keys(add)) {
    const r = report.packages.find((p) => p.name === name);
    if (!r) continue;
    ctx.log(dim(`\n  ${name} ${add[name]} is in halo.json. Use it:`));
    for (const line of useLine(r.pkg)) ctx.log(`    ${line}`);
  }
  return 0;
}

/** Look up deprecation notices for the installed registry packages (best effort). */
async function noteDeprecations(ctx: Ctx, report: InstallReport) {
  for (const r of report.packages) {
    if (!r.source.startsWith("registry:")) continue;
    try {
      const doc = await ctx.clientFor(r.name).doc(r.name);
      const d = doc?.versions[r.version]?.deprecated;
      if (d) deprecations.set(`${r.name}@${r.version}`, d);
    } catch {
      // Notices are a courtesy.
    }
  }
}

async function cmdInstall(ctx: Ctx): Promise<number> {
  const report = await installProject({ root: ctx.root, trust: ctx.flags.bools.has("trust"), registry: last(ctx.flags, "registry"), fetch: ctx.fetch });
  if (!report.packages.length && !report.removed.length) {
    ctx.log(`Nothing to install (${PROJECT_FILE} has no dependencies).`);
    return 0;
  }
  await noteDeprecations(ctx, report);
  printReport(ctx, report);
  return 0;
}

async function cmdRemove(ctx: Ctx): Promise<number> {
  const names = ctx.flags.positional;
  if (!names.length) fail("Usage: halo remove <name> ...");
  const any = readAnyLock(ctx.root);
  if (any.version === 1) {
    for (const name of names) {
      if (!uninstallV1(ctx.root, name)) fail(`"${name}" is not installed`);
      ctx.log(`${green("✓")} removed ${name}`);
    }
    return 0;
  }
  const deps = readProjectConfig(ctx.root).dependencies ?? {};
  const remove = names.map((n) => (n in deps ? n : normalizePackageName(n)));
  for (const [i, name] of remove.entries()) if (!(name in deps)) fail(`"${names[i]}" is not in ${PROJECT_FILE} dependencies`);
  const report = await addDependencies({ root: ctx.root, remove, registry: last(ctx.flags, "registry"), fetch: ctx.fetch, unlock: new Set() });
  for (const name of remove) ctx.log(`${green("✓")} removed ${name}`);
  for (const name of report.removed.filter((n) => !remove.includes(n))) ctx.log(dim(`  - ${name} (no longer needed)`));
  return 0;
}

async function cmdOutdated(ctx: Ctx): Promise<number> {
  const lock = readLockV2(ctx.root);
  const wanted = await installProject({ root: ctx.root, unlock: "all", dryRun: true, registry: last(ctx.flags, "registry"), fetch: ctx.fetch, trust: true });
  const rows: { name: string; current: string; wanted: string; latest: string; direct: boolean }[] = [];
  for (const r of wanted.packages) {
    if (!r.source.startsWith("registry:")) continue;
    const doc = await ctx.clientFor(r.name).doc(r.name);
    const latest = doc?.distTags.latest ?? r.version;
    const current = lock.packages[r.name]?.version ?? "-";
    if (current !== r.version || latest !== current) rows.push({ name: r.name, current, wanted: r.version, latest, direct: r.direct });
  }
  if (ctx.flags.bools.has("json")) {
    ctx.log(JSON.stringify(rows, null, 2));
    return 0;
  }
  if (!rows.length) {
    ctx.log("Everything is up to date.");
    return 0;
  }
  const w = Math.max(7, ...rows.map((r) => r.name.length));
  ctx.log(bold(`${"Package".padEnd(w)}  ${"Current".padEnd(9)}  ${"Wanted".padEnd(9)}  Latest`));
  for (const r of rows) ctx.log(`${r.name.padEnd(w)}  ${r.current.padEnd(9)}  ${(r.wanted === r.current ? r.wanted : green(r.wanted)).padEnd(9)}  ${r.latest === r.wanted ? r.latest : yellow(r.latest)}${r.direct ? "" : dim(" (dependency)")}`);
  ctx.log(dim(`\nhalo update moves to Wanted; halo update --latest also moves past your ranges to Latest.`));
  return 0;
}

async function cmdUpdate(ctx: Ctx): Promise<number> {
  const deps = readProjectConfig(ctx.root).dependencies ?? {};
  const names = ctx.flags.positional.map((n) => (n in deps ? n : normalizePackageName(n)));
  const before = readLockV2(ctx.root);
  const add: Record<string, string> = {};
  if (ctx.flags.bools.has("latest")) {
    for (const name of names.length ? names : Object.keys(deps)) {
      if (!(name in deps)) fail(`"${name}" is not in ${PROJECT_FILE} dependencies`);
      if (isLocalSpec(deps[name]!)) continue;
      const doc = await ctx.clientFor(name).doc(name);
      if (doc) add[name] = defaultRangeFor(doc.distTags.latest);
    }
  }
  const report = await addDependencies({ root: ctx.root, add, unlock: names.length ? new Set(names) : "all", trust: ctx.flags.bools.has("trust"), registry: last(ctx.flags, "registry"), fetch: ctx.fetch });
  let changed = 0;
  for (const r of report.packages) {
    const was = before.packages[r.name]?.version;
    if (was === r.version) continue;
    changed++;
    ctx.log(`${green("✓")} ${bold(r.name)} ${was ? `${was} → ` : ""}${r.version}${add[r.name] ? dim(` (halo.json: ${add[r.name]})`) : ""}`);
  }
  for (const name of report.removed) ctx.log(`${dim("-")} ${name}`);
  if (!changed && !report.removed.length) ctx.log("Everything is up to date.");
  return 0;
}

// ── Finding packages ──

async function cmdSearch(ctx: Ctx): Promise<number> {
  const client = ctx.defaultClient();
  const found = await client.search(ctx.flags.positional.join(" "), { limit: Number(last(ctx.flags, "limit") ?? 50) });
  if (ctx.flags.bools.has("json")) {
    ctx.log(JSON.stringify(found, null, 2));
    return 0;
  }
  const lock = readLockV2(ctx.root);
  if (!found.results.length) ctx.log("No packages found.");
  for (const p of found.results) {
    const have = lock.packages[p.name];
    ctx.log(`${bold(p.name)}@${p.latest}${have ? green(` (installed ${have.version})`) : ""}  ${p.description}`);
    const extra = [p.verified ? `verified: ${p.verified}` : "", p.keywords?.length ? p.keywords.join(", ") : "", p.downloads !== undefined ? `${p.downloads} downloads` : ""].filter(Boolean);
    if (extra.length) ctx.log(dim(`    ${extra.join(" · ")}`));
  }
  if (found.total > found.results.length) ctx.log(dim(`\n${found.results.length} of ${found.total} shown`));
  return 0;
}

async function cmdInfo(ctx: Ctx): Promise<number> {
  const spec = ctx.flags.positional[0];
  if (!spec) fail("Usage: halo info <name>[@version]");
  const { name, rest } = splitSpec(spec!);
  mustName(name);
  const client = ctx.clientFor(name);
  const doc = await client.doc(name);
  if (!doc) fail(`No package ${name} in ${client.base}`);
  if (ctx.flags.bools.has("json")) {
    ctx.log(JSON.stringify(doc, null, 2));
    return 0;
  }
  printInfo(ctx, doc!, rest);
  return 0;
}

function printInfo(ctx: Ctx, doc: PackageDoc, wantVersion?: string) {
  const version = wantVersion ?? doc.distTags.latest;
  const v = doc.versions[version];
  if (!v) fail(`${doc.name} has no version ${version} (versions: ${versionsOf(doc).join(", ")})`);
  ctx.log(`${bold(`${doc.name}@${version}`)}  ${doc.description}${doc.verified ? green(` (verified: ${doc.verified})`) : ""}`);
  const meta = [doc.license, doc.repository, doc.homepage].filter(Boolean);
  if (meta.length) ctx.log(dim(`  ${meta.join(" · ")}`));
  if (v!.yanked) ctx.log(red(`  yanked: ${v!.yanked}`));
  if (v!.deprecated) ctx.log(yellow(`  deprecated: ${v!.deprecated}`));
  const versions = versionsOf(doc).map((x) => (doc.versions[x]!.yanked ? dim(`${x} (yanked)`) : x));
  ctx.log(`\n${bold("versions")}  ${versions.slice(0, 12).join(", ")}${versions.length > 12 ? `, … (${versions.length})` : ""}`);
  ctx.log(`${bold("dist-tags")} ${Object.entries(doc.distTags).map(([t, x]) => `${t}: ${x}`).join(", ")}`);
  if (v!.halo) ctx.log(`${bold("halo")}      ${v!.halo}`);
  const e = v!.exports;
  const kinds = (Object.entries(e) as [string, string[]][]).filter(([, list]) => list?.length);
  if (kinds.length) {
    ctx.log(`\n${bold("exports")}`);
    for (const [kind, list] of kinds) ctx.log(`  ${kind.padEnd(10)} ${list.join(", ")}`);
  }
  const slots = Object.entries(v!.models ?? {});
  if (slots.length) {
    ctx.log(`\n${bold("model slots")} ${dim("(you fill these: use … with models(slot: <model id>))")}`);
    for (const [slot, s] of slots) ctx.log(`  ${slot.padEnd(10)} ${s.description}${s.suggested ? dim(` (suggested: ${s.suggested})`) : ""}`);
  }
  if (v!.hosted) {
    const host = hostOf(v!.hosted.endpoint);
    ctx.log(`\n${bold("hosted")}    ${v!.hosted.pipelines.join(", ")} run on ${v!.hosted.endpoint}, not on your machine`);
    ctx.log(yellow(`  This package sends your inputs to ${host}${v!.permissions.env.length ? ` and reads ${v!.permissions.env.join(", ")}` : ""}`));
  }
  const deps = Object.entries(v!.dependencies ?? {});
  if (deps.length) ctx.log(`\n${bold("dependencies")}\n${deps.map(([d, r]) => `  ${d} ${r}`).join("\n")}`);
  ctx.log(`\n${bold("permissions")}`);
  for (const line of describeOwn(v!.permissions)) ctx.log(`  ${line}`);
  if (doc.readme) {
    const lines = doc.readme.trim().split("\n");
    ctx.log(`\n${bold(README_FILE)}`);
    for (const line of lines.slice(0, 16)) ctx.log(dim(`  ${line}`));
    if (lines.length > 16) ctx.log(dim(`  … (${lines.length - 16} more lines)`));
  }
}

// ── Stats ──

const num = (n: number) => n.toLocaleString("en-US");
const SPARK = "▁▂▃▄▅▆▇█";

/** One bar per day, scaled to the busiest day; days with no downloads are a dim ▁. */
export function sparkline(counts: number[]): string {
  const max = Math.max(0, ...counts);
  return counts.map((c) => (c && max ? SPARK[Math.min(SPARK.length - 1, Math.ceil((c / max) * SPARK.length) - 1)]! : dim(SPARK[0]!))).join("");
}

async function cmdStats(ctx: Ctx): Promise<number> {
  const target = ctx.flags.positional[0];
  if (!target) fail("Usage: halo stats <name|@scope> [--days n] [--json]");
  const daysFlag = last(ctx.flags, "days");
  const days = daysFlag === undefined ? undefined : Number(daysFlag);
  if (days !== undefined && !(Number.isInteger(days) && days >= 1 && days <= 365)) fail("--days is a whole number from 1 to 365");
  const json = ctx.flags.bools.has("json");

  if (!target!.includes("/")) {
    // A whole scope: one line per package, busiest first.
    const scope = scopeOf(target!);
    const client = ctx.serviceClient();
    const doc = await client.scope(scope);
    const all = await Promise.all(doc.packages.map((n) => client.stats(n, days)));
    if (json) {
      ctx.log(JSON.stringify(all, null, 2));
      return 0;
    }
    if (!all.length) {
      ctx.log(`${scope} has no packages yet.`);
      return 0;
    }
    all.sort((a, b) => b.downloads.period - a.downloads.period || a.name.localeCompare(b.name));
    const window = all[0]!.days;
    const width = Math.max(...all.map((s) => s.name.length));
    ctx.log(dim(`${"package".padEnd(width)}  ${`${window}d`.padStart(8)}  ${"total".padStart(9)}  dependents (direct/all)`));
    for (const s of all) {
      ctx.log(`${bold(s.name.padEnd(width))}  ${num(s.downloads.period).padStart(8)}  ${num(s.downloads.total).padStart(9)}  ${s.dependents.direct}/${s.dependents.transitive}  ${sparkline(s.downloads.daily.map((d) => d.count))}`);
    }
    const sum = (f: (s: PackageStats) => number) => num(all.reduce((n, s) => n + f(s), 0));
    ctx.log(dim(`${"all".padEnd(width)}  ${sum((s) => s.downloads.period).padStart(8)}  ${sum((s) => s.downloads.total).padStart(9)}`));
    return 0;
  }

  const { name } = splitSpec(target!);
  mustName(name);
  const s = await ctx.clientFor(name).stats(name, days);
  if (json) {
    ctx.log(JSON.stringify(s, null, 2));
    return 0;
  }
  printStats(ctx, s);
  return 0;
}

function printStats(ctx: Ctx, s: PackageStats) {
  const d = s.downloads;
  ctx.log(`${bold(s.name)}${s.latest ? `@${s.latest}` : ""}`);
  ctx.log(`\n${bold("downloads")} ${num(d.last7)} last 7 days · ${num(d.last30)} last 30 days · ${num(d.total)} all time`);
  const first = d.daily[0]?.day ?? "";
  const lastDay = d.daily.at(-1)?.day ?? "";
  ctx.log(`  ${sparkline(d.daily.map((x) => x.count))}  ${dim(`${first} → ${lastDay}, ${num(d.period)} in ${s.days} day${s.days === 1 ? "" : "s"}`)}`);
  if (d.versions.length) {
    const width = Math.max(7, ...d.versions.map((v) => v.version.length));
    ctx.log(`\n${bold("by version")}`);
    ctx.log(dim(`  ${"version".padEnd(width)}  ${`${s.days}d`.padStart(8)}  ${"total".padStart(9)}`));
    for (const v of d.versions.slice(0, 15)) ctx.log(`  ${(v.version === s.latest ? green(v.version.padEnd(width)) : v.version.padEnd(width))}  ${num(v.period).padStart(8)}  ${num(v.total).padStart(9)}`);
    if (d.versions.length > 15) ctx.log(dim(`  … ${d.versions.length - 15} older versions`));
  }

  const t = s.dependents;
  ctx.log(`\n${bold("dependents")} ${t.direct} direct · ${t.transitive} in all ${dim("(counting each package's latest version)")}`);
  if (!t.transitive) {
    ctx.log(dim("  No packages depend on this one yet."));
    return;
  }
  for (const p of t.packages) {
    if (p.depth === 1) {
      const stale = p.onLatest === false ? yellow(` (${p.range} excludes ${s.latest})`) : "";
      ctx.log(`  ${p.name}@${p.version}  ${dim(p.range ?? "")}${stale}`);
    } else {
      ctx.log(`  ${p.name}@${p.version}  ${dim(`via ${p.chain.slice(1, -1).join(" → ")}`)}`);
    }
  }
  if (t.transitive > t.packages.length) ctx.log(dim(`  … ${t.transitive - t.packages.length} more`));
}

// ── Making packages ──

function cmdInitPackage(ctx: Ctx): number {
  const dir = resolve(ctx.root, ctx.flags.positional[0] ?? ".");
  const name = last(ctx.flags, "name") ?? `@my-scope/${basename(dir).toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^[^a-z0-9]+/, "") || "my-package"}`;
  mustName(name);
  for (const f of [PROJECT_FILE, README_FILE, "lib/main.halo"]) if (existsSync(join(dir, f))) fail(`${join(ctx.flags.positional[0] ?? ".", f)} already exists`);
  mkdirSync(join(dir, "lib"), { recursive: true });
  const [major, minor] = HALO_VERSION.split(".");
  // On a next or nightly Halo (1.2.0-next.1), ">=1.2.0" would shut out the very Halo writing it; "-0" lets 1.2.0's prereleases in.
  const floor = `${major}.${minor}.0${HALO_VERSION.includes("-") ? "-0" : ""}`;
  const manifest = {
    name,
    version: "0.1.0",
    description: "What this package does, in one line",
    license: "MIT",
    keywords: [],
    halo: `>=${floor}`,
    exports: ["lib/main.halo"],
    models: { main: { description: "Answers questions. Any chat model works.", suggested: "anthropic/claude-haiku-4-5" } },
    dependencies: {},
  };
  writeFileSync(join(dir, PROJECT_FILE), JSON.stringify(manifest, null, 2) + "\n");
  writeFileSync(
    join(dir, README_FILE),
    `# ${name}\n\nWhat this package does, and what it needs.\n\n\`\`\`halo\nuse "${name}" { Answer } with models(main: anthropic/claude-haiku-4-5)\n\npipeline Ask(question: String):\n  question |> Answer()\n\`\`\`\n\n## Model slots\n\n- \`main\`: answers questions. Any chat model works.\n`,
  );
  writeFileSync(
    join(dir, "lib/main.halo"),
    `// Everything declared here is exported: halo.json lists this file in "exports".\n// The agent's model is a slot (models.main): whoever uses the package picks the model and pays for it.\n\nagent Helper [models.main, temperature: 0]\n  system "You answer questions briefly and plainly."\n\npipeline Answer(question: String) -> Result:\n  question |> Helper.prompt("Answer briefly: {{question}}")\n`,
  );
  ctx.log(`${green("✓")} ${name}: ${PROJECT_FILE}, ${README_FILE}, lib/main.halo`);
  ctx.log(dim(`  Set "name" to your scope (halo whoami shows it), then: halo publish --dry-run`));
  return 0;
}

function fileName(name: string, version: string) {
  return `${name.replace(/^@/, "").replace("/", "-")}-${version}.halotool`;
}

function cmdPack(ctx: Ctx): number {
  const dir = resolve(ctx.root, ctx.flags.positional[0] ?? ".");
  // A hosted package leaves out its hosted sources and carries their interfaces instead.
  const { bytes, sha256: digest, pkg } = packWithHosted(dir);
  const outDir = resolve(ctx.root, last(ctx.flags, "out") ?? ".");
  mkdirSync(outDir, { recursive: true });
  const out = join(outDir, fileName(pkg.name, pkg.version));
  writeFileSync(out, bytes);
  ctx.log(`${green("✓")} ${out} ${dim(`(${bytes.length} bytes, sha256 ${digest})`)}`);
  for (const line of describeOwn(permissionsOfPackage(pkg))) ctx.log(dim(`    ${line}`));
  for (const line of describeHosted(pkg.manifest, pkg.hosted)) ctx.log(dim(`    ${line}`));
  for (const p of publishProblems(pkg)) ctx.log(yellow(`! ${p}`));
  return 0;
}

async function cmdPublish(ctx: Ctx): Promise<number> {
  const target = resolve(ctx.root, ctx.flags.positional[0] ?? ".");
  const flag = last(ctx.flags, "registry");
  let bytes: Uint8Array;
  let pkg: PackageData;
  if (target.endsWith(".halotool")) {
    bytes = readFileSync(target);
    pkg = readPackage(bytes);
  } else {
    // A hosted package: its hosted pipelines are linked, checked (no pauses) and published as interfaces only.
    const packed = packWithHosted(target);
    bytes = packed.bytes;
    pkg = packed.pkg;
  }
  // v1: a registry index.json on disk, as before.
  if (flag?.endsWith(".json")) {
    let file = target;
    let tmp: string | undefined;
    if (!target.endsWith(".halotool")) {
      tmp = mkdtempSync(join(tmpdir(), "halo-publish-"));
      file = join(tmp, fileName(pkg.name, pkg.version));
      writeFileSync(file, bytes);
    }
    try {
      if (ctx.flags.bools.has("dry-run")) return (ctx.log(`Dry run: ${pkg.name}@${pkg.version} would go to ${flag}`), 0);
      const r = publishV1(file, resolve(ctx.root, flag));
      ctx.log(`${green("✓")} published ${r.name}@${r.version} to ${flag} (${r.file})`);
      return 0;
    } finally {
      if (tmp) rmSync(tmp, { recursive: true, force: true });
    }
  }
  if (!parsePackageName(pkg.name)) fail(`${pkg.name} is a v1 package (halo-tool.json) with a bare name. Registries need a scoped name: move it to a halo.json with "name": "@you/${pkg.name}" and a ${README_FILE}`);
  // The registry's own check (src/registry/check.ts), hosted rules included.
  const problems = publishProblems(pkg);
  if (problems.length) fail(`${pkg.name}@${pkg.version} can't be published:\n  - ${problems.join("\n  - ")}`);

  const settings = ctx.settings();
  const location = flag ? settings.default : registryFor(settings, pkg.name);
  if (location === BUNDLED_REGISTRY && !flag) fail(`Pass --registry <https URL or folder> (the default here is this checkout's bundled registry; registry/build.ts publishes to it)`);
  const client = new RegistryClient(location, { fetch: ctx.fetch, token: tokenFor(location) });

  const e = exportsOf(pkg);
  ctx.log(`${bold(`${pkg.name}@${pkg.version}`)} ${dim(`(${Object.keys(pkg.files).length} files, ${bytes.length} bytes, sha256 ${sha256(bytes)})`)}`);
  const names = (Object.entries(e) as [string, string[]][]).filter(([, l]) => l.length).map(([k, l]) => `${k}: ${l.join(", ")}`);
  if (names.length) ctx.log(dim(`    exports ${names.join(" · ")}`));
  const slots = Object.keys(pkg.manifest.models ?? {});
  if (slots.length) ctx.log(dim(`    model slots: ${slots.join(", ")}`));
  for (const line of describeOwn(permissionsOfPackage(pkg))) ctx.log(dim(`    ${line}`));
  for (const line of describeHosted(pkg.manifest, pkg.hosted)) ctx.log(`    ${line}`);
  if (ctx.flags.bools.has("dry-run")) {
    ctx.log(`Dry run: not published to ${client.base}`);
    return 0;
  }
  const r = await client.publish(bytes);
  ctx.log(`${green("✓")} published ${r.name}@${r.version} to ${client.base}`);
  return 0;
}

// ── Managing published packages ──

async function cmdYank(ctx: Ctx, undo: boolean): Promise<number> {
  const spec = ctx.flags.positional[0];
  const { name, rest } = splitSpec(spec ?? "");
  if (!spec || !rest || !isValidVersion(rest)) fail(`Usage: halo ${undo ? "unyank" : "yank"} <name>@<version>${undo ? "" : " [--reason <text>]"}`);
  mustName(name);
  const client = ctx.clientFor(name);
  if (undo) await client.unyank(name, rest!);
  else await client.yank(name, rest!, last(ctx.flags, "reason") ?? "");
  ctx.log(`${green("✓")} ${undo ? "unyanked" : "yanked"} ${name}@${rest}${undo ? "" : dim(" (halo.lock files that pin it still install it)")}`);
  return 0;
}

async function cmdDeprecate(ctx: Ctx): Promise<number> {
  const [spec, ...words] = ctx.flags.positional;
  const { name, rest } = splitSpec(spec ?? "");
  if (!spec || words.length === 0) fail(`Usage: halo deprecate <name>@<range> <message>  ("" as the message clears it)`);
  mustName(name);
  const range = rest ?? "*";
  if (!isValidRange(range)) fail(`"${range}" is not a version range`);
  const message = words.join(" ");
  await ctx.clientFor(name).deprecate(name, range, message);
  ctx.log(`${green("✓")} ${message ? `deprecated ${name}@${range}: ${message}` : `cleared the deprecation of ${name}@${range}`}`);
  return 0;
}

async function cmdDistTag(ctx: Ctx): Promise<number> {
  const [sub, spec, tag] = ctx.flags.positional;
  const usage = "Usage: halo dist-tag add <name>@<version> <tag> | rm <name> <tag> | ls <name>";
  if (!sub || !spec) fail(usage);
  const { name, rest } = splitSpec(spec!);
  mustName(name);
  const client = ctx.clientFor(name);
  if (sub === "ls") {
    const doc = await client.doc(name);
    if (!doc) fail(`No package ${name} in ${client.base}`);
    for (const [t, v] of Object.entries(doc!.distTags)) ctx.log(`${t}: ${v}`);
    return 0;
  }
  if (sub === "add") {
    if (!rest || !isValidVersion(rest) || !tag) fail(usage);
    await client.setDistTag(name, tag!, rest!);
    ctx.log(`${green("✓")} ${name} ${tag} → ${rest}`);
    return 0;
  }
  if (sub === "rm") {
    if (!tag) fail(usage);
    await client.removeDistTag(name, tag!);
    ctx.log(`${green("✓")} removed ${name}'s ${tag} tag`);
    return 0;
  }
  return fail(usage);
}

function scopeOf(text: string): string {
  const p = parsePackageName(text);
  if (p) return p.scope;
  if (/^@[a-z0-9][a-z0-9._-]*$/.test(text)) return text;
  return fail(`"${text}" is not a scope (@acme) or a package name (@acme/kit)`);
}

async function cmdOwner(ctx: Ctx): Promise<number> {
  const [sub, target, login] = ctx.flags.positional;
  const usage = "Usage: halo owner add|rm <name|@scope> <login> [--role owner|publisher] | ls <name|@scope>";
  if (!sub || !target) fail(usage);
  const scope = scopeOf(target!);
  const client = parsePackageName(target!) ? ctx.clientFor(target!) : ctx.serviceClient();
  if (sub === "ls") {
    const doc = await client.scope(scope);
    for (const m of doc.members) ctx.log(`${m.login} ${dim(m.role)}`);
    return 0;
  }
  if (!login) fail(usage);
  if (sub === "add") {
    const role = (last(ctx.flags, "role") ?? "publisher") as ScopeRole;
    if (role !== "owner" && role !== "publisher") fail(`--role is owner or publisher`);
    await client.setMember(scope, login!, role);
    ctx.log(`${green("✓")} ${login} is now ${role === "owner" ? "an owner" : "a publisher"} of ${scope}`);
    return 0;
  }
  if (sub === "rm") {
    await client.removeMember(scope, login!);
    ctx.log(`${green("✓")} removed ${login} from ${scope}`);
    return 0;
  }
  return fail(usage);
}

async function cmdScope(ctx: Ctx): Promise<number> {
  const [sub, scopeText, domain] = ctx.flags.positional;
  const usage = "Usage: halo scope create <@scope> | verify <@scope> <domain>";
  if (!sub || !scopeText) fail(usage);
  const scope = scopeOf(scopeText!);
  const client = ctx.serviceClient();
  if (sub === "create") {
    await client.createScope(scope);
    ctx.log(`${green("✓")} created ${scope}; you own it`);
    return 0;
  }
  if (sub === "verify") {
    if (!domain) fail(usage);
    const r = await client.verifyScope(scope, domain!);
    if (r.verified) ctx.log(`${green("✓")} ${scope} is verified as ${domain}`);
    else ctx.log(`Add this DNS TXT record, then run this command again:\n  ${r.record}  TXT  "${r.value}"`);
    return 0;
  }
  return fail(usage);
}

// ── Accounts ──

async function cmdLogin(ctx: Ctx): Promise<number> {
  const client = ctx.serviceClient();
  client.setToken(undefined);
  const start = await client.deviceStart();
  ctx.log(`Open ${bold(start.verification_uri)} and enter the code ${bold(start.user_code)}`);
  ctx.log(dim("Waiting for you to approve…"));
  let interval = Math.max(0, start.interval ?? 5);
  const deadline = Date.now() + (start.expires_in ?? 900) * 1000;
  while (Date.now() < deadline) {
    await Bun.sleep(interval * 1000);
    const r = await client.deviceToken(start.device_code);
    if (r.token) {
      saveCredential(client.base, { token: r.token.token, login: r.token.login });
      ctx.log(`${green("✓")} logged in to ${client.base} as ${bold(r.token.login)}`);
      return 0;
    }
    if (r.expired) break;
    if (r.wait === "slow_down") interval += 5;
  }
  return fail("The login code expired; run halo login again");
}

function cmdLogout(ctx: Ctx): number {
  const client = ctx.serviceClient();
  if (removeCredential(client.base)) ctx.log(`${green("✓")} logged out of ${client.base}`);
  else ctx.log(`Not logged in to ${client.base}.`);
  if (Bun.env.HALO_TOKEN) ctx.log(dim("HALO_TOKEN is still set in your environment."));
  return 0;
}

async function cmdWhoami(ctx: Ctx): Promise<number> {
  const me = await ctx.serviceClient().whoami();
  if (ctx.flags.bools.has("json")) {
    ctx.log(JSON.stringify(me, null, 2));
    return 0;
  }
  ctx.log(bold(me.login));
  for (const s of me.scopes) ctx.log(`  ${s.scope} ${dim(s.role)}`);
  ctx.log(dim(`  token: ${me.token.name}${me.token.readOnly ? " (read only)" : ""}${me.token.scopes?.length ? ` · scopes ${me.token.scopes.join(", ")}` : ""}`));
  return 0;
}

async function cmdToken(ctx: Ctx): Promise<number> {
  const [sub, id] = ctx.flags.positional;
  const client = ctx.serviceClient();
  if (sub === "create") {
    const t = await client.createToken({ name: last(ctx.flags, "name") ?? "halo cli", readOnly: ctx.flags.bools.has("read-only") || undefined, scopes: ctx.flags.values.get("scope") });
    ctx.log(`${green("✓")} created token ${t.id}${t.name ? ` (${t.name})` : ""}. It is shown once:`);
    ctx.log(t.token);
    return 0;
  }
  if (sub === "list") {
    const tokens = await client.listTokens();
    if (ctx.flags.bools.has("json")) return (ctx.log(JSON.stringify(tokens, null, 2)), 0);
    if (!tokens.length) ctx.log("No tokens.");
    for (const t of tokens) ctx.log(`${t.id}  ${t.name ?? ""}${t.readOnly ? dim(" read only") : ""}${t.scopes?.length ? dim(` ${t.scopes.join(", ")}`) : ""}${t.lastUsedAt ? dim(` · last used ${t.lastUsedAt}`) : ""}`);
    return 0;
  }
  if (sub === "revoke") {
    if (!id) fail("Usage: halo token revoke <id>");
    await client.revokeToken(id!);
    ctx.log(`${green("✓")} revoked ${id}`);
    return 0;
  }
  return fail("Usage: halo token create [--name n] [--read-only] [--scope @s] | list | revoke <id>");
}
