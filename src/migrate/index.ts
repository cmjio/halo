/**
 * `halo migrate`: bring a project written for an older Halo up to this one.
 *
 * A project records the Halo it was written for in halo.json:
 *
 *   { "halo": "^1.4.0" }
 *
 * Every change to Halo that can alter what an existing project does ships with a migration
 * in MIGRATIONS, tagged with the version that made the change. `halo migrate` runs the ones
 * newer than the project's version (all of them when halo.json doesn't say), and shows what
 * each found. `--write` applies the ones that can be applied in code and records the new
 * version; the rest are a person's to decide, and are listed with the file and line.
 *
 * A migration finds its cases in the files themselves, so running it twice changes nothing.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { parse } from "../parser/index.js";
import type { ParseResult } from "../parser/types.js";
import { readProjectConfig, writeProjectConfig } from "../registry/config.js";
import { HALO_VERSION, installProject } from "../registry/install.js";
import { readAnyLock } from "../registry/lockfile.js";
import { compare, parseRange, parseVersion, satisfies } from "../registry/semver.js";
import { argRules } from "../runtime/tool-rules.js";

export interface ProjectFile {
  /** Relative to the project, with forward slashes. */
  path: string;
  ast: ParseResult;
}

export interface Project {
  root: string;
  /** halo.json, or {} when there is none. */
  config: Record<string, unknown>;
  /** Every .halo file outside dot-folders and node_modules. */
  files: ProjectFile[];
}

export interface Finding {
  file: string;
  line?: number;
  message: string;
}

export interface ApplyOptions {
  /** Allow packages that run their own code, as `halo install --trust` does. */
  trust?: boolean;
}

export interface Migration {
  id: string;
  /** The Halo version that made the change. */
  since: string;
  title: string;
  /** What changed, and what to do about it. */
  detail: string;
  find(project: Project): Finding[];
  /** Rewrites the project. A migration without it is a person's to act on. */
  apply?(project: Project, options: ApplyOptions): Promise<void>;
}

const names = (v: unknown[]) => v.join(", ");

export const MIGRATIONS: Migration[] = [
  {
    id: "lockfile-v2",
    since: "1.0.0",
    title: "halo.lock is in the 0.x format",
    detail: "Packages are now dependencies in halo.json, pinned by a version 2 halo.lock. This installs the same packages again and rewrites both files.",
    find(project) {
      const any = readAnyLock(project.root);
      if (any.version !== 1) return [];
      const tools = Object.keys(any.lock.tools);
      return [{ file: "halo.lock", message: tools.length ? `lists ${names(tools)} in the old format` : "is in the old format" }];
    },
    async apply(project, options) {
      await installProject({ root: project.root, trust: options.trust });
    },
  },
  {
    id: "post-path-locked",
    since: "1.4.0",
    title: "A model can no longer choose a POST tool's path",
    detail:
      'An agent that calls a POST tool reaches only the address the tool declares; a call that sets path is refused. Calls a pipeline makes itself still pass path:. If the tool has one endpoint, nothing needs to change, or write & Fixed("path", "/the/endpoint") to send a path on every call. To let the model choose again, as before 1.4.0, add & Unlocked("path").',
    find(project) {
      const equipped = new Set(project.files.flatMap((f) => f.ast.agents.flatMap((a) => a.equips ?? [])));
      const out: Finding[] = [];
      for (const file of project.files) {
        for (const tool of file.ast.tools) {
          if (tool.provider !== "POST" || !equipped.has(tool.name)) continue;
          // Any rule that names path means its author has already decided.
          const decided = (tool.rules ?? []).some((r) => r.args.some((a) => a.kind === "string" && a.value === "path"));
          if (decided || !argRules(tool).locked.has("path")) continue;
          out.push({ file: file.path, line: tool.loc?.line, message: `tool ${tool.name} is equipped by an agent and has no rule for path` });
        }
      }
      return out;
    },
  },
];

export interface MigrationResult {
  id: string;
  since: string;
  title: string;
  detail: string;
  /** Whether `--write` can apply it. */
  automatic: boolean;
  findings: Finding[];
  applied: boolean;
  /** Why applying it failed. */
  error?: string;
}

export interface MigrationReport {
  root: string;
  /** This Halo. */
  halo: string;
  /** The version the project was written for, when halo.json (or --from) says. */
  from?: string;
  /** Set when the project is for a newer Halo than this one: the range it asks for. Nothing else is checked. */
  needsUpgrade?: string;
  /** Migrations that found something, oldest first. */
  results: MigrationResult[];
  /** The `halo` range to record in halo.json, when it is behind. */
  stamp?: { before?: string; after: string; written: boolean };
}

export interface MigrateOptions extends ApplyOptions {
  /** Apply what can be applied, and record the version. */
  write?: boolean;
  /** Treat the project as written for this version, whatever halo.json says. */
  from?: string;
  haloVersion?: string;
  migrations?: Migration[];
}

export class MigrateError extends Error {}

const core = (version: string) => {
  const v = parseVersion(version);
  return v ? `${v.major}.${v.minor}.${v.patch}` : version;
};

/** The range a project written with this Halo records: "^1.4.0" for 1.4.0 and for its next and nightly builds. */
export const haloRange = (version: string = HALO_VERSION) => `^${core(version)}`;

/** The lowest version a range accepts ("^1.3.0" is 1.3.0), or undefined when it has no lower bound. */
export function minVersion(range: string): string | undefined {
  let lowest: string | undefined;
  for (const set of parseRange(range)) {
    const lower = set.filter((c) => c.op === ">=" || c.op === "=" || c.op === ">").map((c) => core(c.v.raw));
    if (!lower.length) return undefined;
    const bound = lower.sort(compare).at(-1)!;
    if (!lowest || compare(bound, lowest) < 0) lowest = bound;
  }
  return lowest;
}

export function loadProject(root: string): Project {
  root = resolve(root);
  if (!existsSync(root) || !statSync(root).isDirectory()) throw new MigrateError(`${root} is not a folder`);
  const files: ProjectFile[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith(".halo")) files.push({ path: relative(root, full).split("\\").join("/"), ast: parse(readFileSync(full, "utf8")) });
    }
  };
  walk(root);
  return { root, config: readProjectConfig(root), files };
}

/** Check a project against this Halo, and with `write`, bring it up to date. */
export async function migrateProject(root: string, options: MigrateOptions = {}): Promise<MigrationReport> {
  const halo = options.haloVersion ?? HALO_VERSION;
  const migrations = [...(options.migrations ?? MIGRATIONS)].sort((a, b) => compare(a.since, b.since));
  let project = loadProject(root);
  const report: MigrationReport = { root: project.root, halo, results: [] };

  const range = typeof project.config.halo === "string" ? project.config.halo : undefined;
  let written: string | undefined;
  if (range !== undefined) {
    try {
      written = minVersion(range);
    } catch {
      throw new MigrateError(`halo.json: "halo" is "${range}", which is not a version range (write one like "^${core(halo)}")`);
    }
    // Checked against this Halo's release, so a next or nightly build of 1.5.0 runs a project written for 1.5.0.
    if (written && !satisfies(core(halo), range) && compare(written, core(halo)) > 0) {
      report.needsUpgrade = range;
      return report;
    }
  }
  if (options.from !== undefined && !parseVersion(options.from)) throw new MigrateError(`--from takes a Halo version like 1.2.0, not "${options.from}"`);
  const from = options.from !== undefined ? core(options.from) : written;
  if (from) report.from = from;

  let failed = false;
  for (const m of migrations) {
    if (from && compare(m.since, from) <= 0) continue;
    const findings = m.find(project);
    if (!findings.length) continue;
    const result: MigrationResult = { id: m.id, since: m.since, title: m.title, detail: m.detail, automatic: !!m.apply, findings, applied: false };
    report.results.push(result);
    if (!options.write || !m.apply) continue;
    try {
      await m.apply(project, options);
      result.applied = true;
      // A later migration reads the files as this one left them.
      project = loadProject(root);
    } catch (err) {
      result.error = err instanceof Error ? err.message : String(err);
      failed = true;
    }
  }

  // The lowest Halo the project is now right for: the newest change it has been checked against.
  const newest = migrations.at(-1)?.since;
  if (newest && (!written || compare(written, newest) < 0)) {
    report.stamp = { ...(range !== undefined ? { before: range } : {}), after: `^${newest}`, written: false };
    if (options.write && !failed) {
      const config = readProjectConfig(project.root);
      writeProjectConfig(project.root, { ...config, halo: report.stamp.after });
      report.stamp.written = true;
    }
  }
  return report;
}

/**
 * What `halo validate` and `halo serve` say about a project that is behind or ahead of this
 * Halo, or undefined when there is nothing to say. Never throws: it is a hint.
 */
export async function migrationHint(root: string, haloVersion?: string): Promise<string | undefined> {
  try {
    const report = await migrateProject(root, { haloVersion });
    if (report.needsUpgrade) return `This project is written for Halo ${report.needsUpgrade}, and this is Halo ${report.halo}. Run \`halo upgrade\`.`;
    const n = report.results.reduce((sum, r) => sum + r.findings.length, 0);
    if (!n) return undefined;
    const since = report.from ? `since Halo ${report.from}` : "in newer versions of Halo";
    return `${n} thing(s) in this project are affected by changes ${since}. Run \`halo migrate\` to see them.`;
  } catch {
    return undefined;
  }
}
