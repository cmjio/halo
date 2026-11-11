/**
 * What a published package exports and can reach, computed by the server (never trusted from
 * the client).
 *
 * `analyze` is the pluggable hook. For now it derives everything from the manifest's providers
 * plus a SIMPLE REGEX SCAN of the exported .halo files. It is a stand-in: the linker's pure
 * `analyzePackage` (src/linker/) replaces it during integration, with the same signature.
 */

import type { PackageExports, PackageManifest } from "../../../src/registry/contract.ts";
import { permissionsOf, type ToolManifest } from "../../../src/registry/manifest.ts";

export interface Analysis {
  exports: PackageExports;
  network: string[];
  env: string[];
  spawn: string[];
  code: boolean;
}

/** `files` maps package paths to their UTF-8 text (binary files decode lossily; they're ignored). */
export type Analyze = (files: Record<string, string>, manifest: PackageManifest) => Analysis;

// REGEX SCAN (stand-in for the linker): top-level declarations `<kind> <Name>`.
const DECLARATION = /^[ \t]*(pipeline|agent|tool|store|schema|policy)[ \t]+([A-Za-z_][A-Za-z0-9_]*)/gm;
// REGEX SCAN (stand-in for the linker): `Env.NAME` reads in .halo source.
const ENV_READ = /\bEnv\.([A-Z_][A-Z0-9_]*)\b/g;

const KIND_TO_EXPORT = { pipeline: "pipelines", agent: "agents", tool: "tools", store: "stores", schema: "schemas", policy: "policies" } as const;

export const analyze: Analyze = (files, manifest) => {
  const exports: PackageExports = { pipelines: [], agents: [], tools: [], stores: [], schemas: [], policies: [], providers: [], skills: [] };
  const perms = permissionsOf({ providers: manifest.providers ?? {} } as ToolManifest);
  const env = new Set([...perms.env, ...(manifest.env ?? [])]);

  for (const path of manifest.exports ?? []) {
    const source = stripComments(files[path] ?? "");
    for (const m of source.matchAll(DECLARATION)) {
      const list = exports[KIND_TO_EXPORT[m[1] as keyof typeof KIND_TO_EXPORT]];
      if (!list.includes(m[2]!)) list.push(m[2]!);
    }
  }
  for (const [path, text] of Object.entries(files)) if (path.endsWith(".halo")) for (const m of stripComments(text).matchAll(ENV_READ)) env.add(m[1]!);

  exports.providers = Object.keys(manifest.providers ?? {});
  if (manifest.skills) {
    const dir = manifest.skills.replace(/\/+$/, "") + "/";
    for (const path of Object.keys(files)) {
      const m = path.startsWith(dir) ? /^([^/]+)\/SKILL\.md$/.exec(path.slice(dir.length)) : null;
      if (m && !exports.skills.includes(m[1]!)) exports.skills.push(m[1]!);
    }
  }
  for (const list of Object.values(exports)) list.sort();
  return { exports, network: perms.network.sort(), env: [...env].sort(), spawn: perms.spawn.sort(), code: perms.code };
};

/**
 * Agents with a hard-coded model instead of a slot (`agent X [models.fast]`). Packages run on
 * the consumer's keys, so the consumer picks the models; every shipped .halo file is checked.
 * REGEX SCAN (stand-in for the linker).
 */
export function hardCodedModels(files: Record<string, string>): string[] {
  const problems: string[] = [];
  for (const [path, text] of Object.entries(files)) {
    if (!path.endsWith(".halo")) continue;
    for (const m of stripComments(text).matchAll(/^[ \t]*agent[ \t]+([A-Za-z_][A-Za-z0-9_]*)[ \t]*\[[ \t]*([^\],\s]+)/gm)) {
      if (!m[2]!.startsWith("models.")) problems.push(`${path}: agent ${m[1]} hard-codes the model "${m[2]}"; use a model slot ([models.<slot>]) so the consumer picks the model`);
    }
  }
  return problems;
}

function stripComments(source: string): string {
  return source.replace(/\/\/[^\n]*/g, "");
}
