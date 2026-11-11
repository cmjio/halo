/**
 * What a package exports, what it can reach, and what stops it being published, computed
 * from its files. The CLI (`halo pack`, `halo publish`, static registries) and the registry
 * Worker (services/registry) both call `checkPackageFiles`, so the client refuses exactly
 * what the server refuses, and both compute the same permissions.
 *
 * Pure: no Node, Bun or Workers APIs (the Worker bundles it).
 */

import { analyzePackage } from "../linker/analyze.js";
import { dirnameOf, joinPath, normalizePath } from "../linker/paths.js";
import { parse } from "../parser/index.js";
import { hostedInterfaceProblems, README_FILE, type HostedPipelineInterface, type PackageExports, type PackageManifest, type PackagePermissions } from "./contract.js";
import { hostOf, permissionsOf, type Permissions, type ToolManifest } from "./manifest.js";

/** What a package's .halo files declare and reach (the linker's analyzePackage, or a stand-in in tests). */
export interface ExportReach extends Permissions {
  exports?: Partial<PackageExports>;
  /** Problems that stop it being published: "file:line: message". */
  problems?: string[];
}

/** `files` maps each path in the package to its text (only .halo, .json and .md are needed). */
export type ExportAnalyzer = (files: Record<string, string>, manifest: PackageManifest) => ExportReach;

/**
 * The default analyzer: the linker's analyzePackage, with its error diagnostics as problems.
 * Every .halo file in a package file runs on the consumer's machine and keys, so none may name
 * a model, hosted package or not: a hosted package's own sources (which may) never ship.
 */
export const linkerAnalyzer: ExportAnalyzer = (files, manifest) => {
  const a = analyzePackage(files, manifest, { allowModelIds: false });
  const problems = a.diagnostics.filter((d) => d.severity === "error").map((d) => `${d.file}${d.line ? `:${d.line}` : ""}: ${d.message}`);
  return { network: a.network, env: a.env, spawn: a.spawn, code: a.code, exports: a.exports, problems };
};

export interface PackageCheck {
  exports: PackageExports;
  permissions: PackagePermissions;
  /** Why it can't be published; empty when it can. */
  problems: string[];
}

const union = (...lists: string[][]) => [...new Set(lists.flat())];

/**
 * Check a v2 package's contents. `files` holds the package's text files; `hosted` the hosted
 * pipeline interfaces shipped beside them (PackageFileV2.hosted).
 */
export function checkPackageFiles(
  files: Record<string, string>,
  manifest: PackageManifest,
  options: { hosted?: Record<string, HostedPipelineInterface>; analyze?: ExportAnalyzer } = {},
): PackageCheck {
  const reach = (options.analyze ?? linkerAnalyzer)(files, manifest);
  const exports: PackageExports = { pipelines: [], agents: [], tools: [], stores: [], schemas: [], policies: [], providers: Object.keys(manifest.providers ?? {}), skills: [] };
  if (manifest.skills) {
    const base = manifest.skills.replace(/\/+$/, "") + "/";
    exports.skills = [...new Set(Object.keys(files).filter((p) => p.startsWith(base) && p.endsWith("/SKILL.md")).map((p) => p.slice(base.length).split("/")[0]!))];
  }
  for (const key of Object.keys(exports) as (keyof PackageExports)[]) exports[key] = union(exports[key], reach.exports?.[key] ?? []);
  const h = manifest.hosted;
  if (h) exports.pipelines = union(exports.pipelines, h.exports);
  for (const key of Object.keys(exports) as (keyof PackageExports)[]) exports[key].sort();

  const providers = permissionsOf({ providers: manifest.providers ?? {} } as ToolManifest);
  const hostedHosts = h ? [hostOf(h.endpoint)] : [];
  const permissions: PackagePermissions = {
    network: union(providers.network, reach.network, hostedHosts).sort(),
    env: union(providers.env, manifest.env ?? [], reach.env, h?.auth ? [h.auth.env] : []).sort(),
    spawn: union(providers.spawn, reach.spawn).sort(),
    code: providers.code || reach.code,
    hosted: hostedHosts,
  };

  const problems = [...(reach.problems ?? [])];
  if (files[README_FILE] === undefined) problems.push(`${README_FILE} is required: it's the package's page in the registry`);
  problems.push(...hostedProblems(files, manifest, options.hosted));
  return { exports, permissions, problems };
}

/** The .halo files `exports` reach through relative `use` lines. `text` reads a file (relative path). */
export function reachableFromExports(manifest: PackageManifest, text: (path: string) => string | undefined): string[] {
  const seen: string[] = [];
  const visit = (path: string) => {
    if (seen.includes(path)) return;
    const source = text(path);
    if (source === undefined) return;
    seen.push(path);
    for (const use of parse(source).uses ?? []) {
      if (!use.source.startsWith("./") && !use.source.startsWith("../")) continue;
      const target = joinPath(dirnameOf(path), use.source);
      if (!target.startsWith("../")) visit(target);
    }
  };
  for (const e of manifest.exports ?? []) visit(normalizePath(e));
  return seen;
}

/**
 * A hosted package's file holds interfaces, not hosted sources: every hosted pipeline has a
 * well-formed interface, every .halo file is reached by `exports` (anything else would be a
 * hosted source shipped by mistake), and no shipped file declares a hosted pipeline.
 */
export function hostedProblems(files: Record<string, string>, manifest: PackageManifest, hosted: Record<string, HostedPipelineInterface> | undefined): string[] {
  const h = manifest.hosted;
  if (!h) return hosted && Object.keys(hosted).length ? ["hosted interfaces are only for packages with \"hosted\" in halo.json"] : [];
  const problems: string[] = [];
  for (const name of h.exports) {
    if (!hosted?.[name]) problems.push(`hosted: no interface for ${name}; pack it with halo pack or halo publish from the package folder`);
    else problems.push(...hostedInterfaceProblems(name, hosted[name]));
  }
  for (const name of Object.keys(hosted ?? {})) if (!h.exports.includes(name)) problems.push(`hosted: an interface for ${name}, which isn't in hosted.exports`);
  const shipped = reachableFromExports(manifest, (p) => files[p]);
  for (const p of Object.keys(files).filter((f) => f.endsWith(".halo") && !shipped.includes(f)).sort()) {
    problems.push(`${p} isn't reached by exports, so it would be a hosted source; hosted sources must not be in the package`);
  }
  for (const p of shipped) {
    for (const n of parse(files[p]!).pipelines.map((d) => d.name).filter((n) => h.exports.includes(n))) problems.push(`${p} declares hosted pipeline ${n}; its source must not be in the package`);
  }
  return problems;
}
