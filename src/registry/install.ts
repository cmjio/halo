/**
 * Installing a project's packages: resolve halo.json's dependencies (keeping what halo.lock
 * pins), download and verify each package, gate the ones that run code on --trust, unpack
 * them into .halo/packages/@scope/name/, and write halo.lock v2.
 *
 * A v1 halo.lock (`tools`) is migrated: its packages become halo.json dependencies (bare
 * names from the default registry become @halo/<name>), and .halo/tools is removed.
 */

import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { hostedEndpointConcern, normalizePackageName, PACKAGES_DIR, type LockfileV2, type LockPackage, type PackagePermissions } from "./contract.js";
import { DEFAULT_REGISTRY, readProjectConfig, registryOfSource, registrySettings, writeProjectConfig, type RegistrySettings } from "./config.js";
import { PackageError, permissionsOfPackage, readPackage, sha256, totalPermissions, type PackageData } from "./format.js";
import { PACKAGE_FILE, packageDir, readAnyLock, readTrust, writeLockV2, writeTrust } from "./lockfile.js";
import { clientFor, resolveGraph, specOfSource, type ResolvedNode } from "./resolve.js";
import { RegistryClient } from "./client.js";
import { describePermissions, hostOf } from "./manifest.js";
import type { PackageManifest } from "./contract.js";
import pkgJson from "../../package.json" with { type: "json" };

export const HALO_VERSION: string = pkgJson.version;

export interface InstalledPackage {
  name: string;
  version: string;
  source: string;
  sha256: string;
  direct: boolean;
  permissions: PackagePermissions;
  dependencies: Record<string, string>;
  /** What pulled it in: "halo.json" and/or the packages that depend on it. */
  addedBy: string[];
  /** Not installed before (or a different version). */
  changed: boolean;
  pkg: PackageData;
}

export interface InstallReport {
  packages: InstalledPackage[];
  removed: string[];
  /** A v1 halo.lock was migrated. */
  migrated: string[];
  total: PackagePermissions;
  /** Things the user should know (halo.lock entries that were ignored, hosted endpoints that aren't public https). */
  warnings: string[];
}

export interface InstallOptions {
  root: string;
  /** Allow packages that run their own code (module providers, stdio MCP servers). */
  trust?: boolean;
  /** --registry: the default registry for this run. */
  registry?: string;
  /** Re-resolve these packages (or all) ignoring halo.lock. */
  unlock?: Set<string> | "all";
  haloVersion?: string;
  fetch?: typeof fetch;
  /** Don't change anything on disk: resolve, download and check only. */
  dryRun?: boolean;
  clients?: Map<string, RegistryClient>;
}

/** Turn a v1 halo.lock into halo.json dependencies. Returns the migrated names (as they were in the v1 lock). */
async function migrateV1(root: string, tools: Record<string, { version: string; source: string }>, settings: RegistrySettings, options: InstallOptions): Promise<{ deps: Record<string, string>; migrated: string[] }> {
  const deps: Record<string, string> = {};
  const clients = options.clients ?? new Map();
  for (const [name, entry] of Object.entries(tools)) {
    const reg = /^registry:(.*)#([^#@]+)@(.+)$/.exec(entry.source);
    if (reg) {
      const location = registryOfSource(entry.source, root)!;
      if (reg[1] === "default" || location === DEFAULT_REGISTRY) {
        deps[normalizePackageName(name)] = `^${entry.version}`;
      } else {
        // An old v1 registry index: pin the exact file it lists for that version.
        const client = clientFor(location, clients, options.fetch);
        const doc = await client.doc(name);
        const file = doc?.versions[entry.version]?.file;
        if (!file) throw new PackageError(`Migrating halo.lock: ${name}@${entry.version} is no longer in ${location}`);
        deps[name] = specOfSource(file);
      }
    } else {
      deps[name] = specOfSource(entry.source);
    }
  }
  return { deps, migrated: Object.keys(tools) };
}

function extract(dir: string, pkg: PackageData, bytes: Uint8Array) {
  rmSync(dir, { recursive: true, force: true });
  for (const [path, data] of Object.entries(pkg.files)) {
    const target = join(dir, path);
    if (relative(dir, target).startsWith("..")) throw new PackageError(`Unsafe path in package: ${path}`);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, Buffer.from(data, "base64"));
  }
  writeFileSync(join(dir, PACKAGE_FILE), bytes);
}

async function fetchNode(node: ResolvedNode, root: string): Promise<{ bytes: Uint8Array; digest: string }> {
  if (node.local) {
    return { bytes: node.local.bytes, digest: node.local.sha256 };
  }
  const client = node.registry!;
  // Already installed at the expected checksum: no download.
  const expect = node.lockedSha;
  const installed = join(packageDir(root, node.name), PACKAGE_FILE);
  if (expect && expect === node.versionDoc?.sha256 && existsSync(installed)) {
    const bytes = new Uint8Array(await Bun.file(installed).arrayBuffer());
    if (sha256(bytes) === expect) return { bytes, digest: expect };
  }
  const bytes = await client.file(node.name, node.version, { expect });
  return { bytes, digest: sha256(bytes) };
}

/** Resolve, download, verify, gate, unpack, and write halo.lock. */
export async function installProject(options: InstallOptions): Promise<InstallReport> {
  const { root } = options;
  const haloVersion = options.haloVersion ?? HALO_VERSION;
  const settings = registrySettings(root, options.registry);
  const config = readProjectConfig(root);
  const deps: Record<string, string> = { ...(config.dependencies ?? {}) };
  const any = readAnyLock(root);
  const clients = options.clients ?? new Map<string, RegistryClient>();

  let migrated: string[] = [];
  if (any.version === 1) {
    const m = await migrateV1(root, any.lock.tools, settings, { ...options, clients });
    for (const [name, spec] of Object.entries(m.deps)) if (!(name in deps)) deps[name] = spec;
    migrated = m.migrated;
  }
  const locked: LockfileV2 = any.version === 2 ? any.lock : { lockfileVersion: 2, packages: {} };

  const { nodes, warnings } = await resolveGraph({ root, dependencies: deps, registries: settings, locked, unlock: options.unlock, haloVersion, fetch: options.fetch, clients });

  // Download and check everything before changing anything.
  const trust = readTrust(root);
  const results: InstalledPackage[] = [];
  const blobs = new Map<string, Uint8Array>();
  for (const node of nodes.values()) {
    const { bytes, digest } = await fetchNode(node, root);
    if (node.lockedSha && node.local && node.lockedSha !== digest && /^https?:/.test(node.source)) {
      throw new PackageError(`${node.name} from ${node.source} doesn't match halo.lock (expected ${node.lockedSha.slice(0, 12)}…, got ${digest.slice(0, 12)}…); not installing`);
    }
    let pkg = node.local?.pkg ?? readPackage(bytes, { rename: node.name });
    if (pkg.name !== node.name || pkg.version !== node.version) {
      throw new PackageError(`${node.source} served ${pkg.name}@${pkg.version} for ${node.name}@${node.version}; not installing`);
    }
    const permissions = permissionsOfPackage(pkg);
    const previous = locked.packages[node.name];
    results.push({
      name: node.name,
      version: node.version,
      source: node.source,
      sha256: digest,
      direct: node.direct,
      permissions,
      dependencies: node.dependencies,
      addedBy: [],
      changed: !previous || previous.version !== node.version || previous.sha256 !== digest,
      pkg,
    });
    blobs.set(node.name, bytes);
  }
  for (const r of results) {
    if (r.direct) r.addedBy.push("halo.json");
    for (const other of results) if (other.dependencies[r.name]) r.addedBy.push(`${other.name}@${other.version}`);
  }

  const untrusted = results.filter((r) => r.permissions.code && !options.trust && trust[r.name] !== r.sha256);
  if (untrusted.length) {
    const lines = untrusted.map((r) => `  ${r.name}@${r.version} ${r.permissions.spawn.length ? `starts ${r.permissions.spawn.join("; ")}` : "loads its own module"}${r.direct ? "" : ` (added by ${r.addedBy.join(", ")})`}`);
    throw new PackageError(`${untrusted.length === 1 ? "This package runs" : "These packages run"} its own code:\n${lines.join("\n")}\nCheck them, then run again with --trust.`);
  }

  const removed = Object.keys(locked.packages).filter((n) => !nodes.has(n));
  const report: InstallReport = { packages: results, removed, migrated, total: totalPermissions(results.map((r) => r.permissions)), warnings };
  if (options.dryRun) return report;

  for (const r of results) extract(packageDir(root, r.name), r.pkg, blobs.get(r.name)!);
  for (const name of removed) rmSync(packageDir(root, name), { recursive: true, force: true });

  const lock: LockfileV2 = { lockfileVersion: 2, packages: {} };
  for (const r of results) {
    const entry: LockPackage = { version: r.version, source: r.source, sha256: r.sha256, dependencies: r.dependencies, permissions: r.permissions, direct: r.direct };
    lock.packages[r.name] = entry;
  }
  writeLockV2(root, lock);

  for (const r of results) {
    if (r.permissions.code) {
      if (options.trust) trust[r.name] = r.sha256;
    } else delete trust[r.name];
  }
  for (const name of [...removed, ...migrated]) if (!lock.packages[name]) delete trust[name];
  if (Object.keys(trust).length || existsSync(join(root, ".halo/trust.json"))) writeTrust(root, trust);

  if (migrated.length) {
    const next = { ...readProjectConfig(root) } as Record<string, unknown>;
    next.dependencies = deps;
    writeProjectConfig(root, next);
    rmSync(join(root, ".halo/tools"), { recursive: true, force: true });
  }
  return report;
}

/** Add or change halo.json dependencies, then install. Rolls halo.json back if installing fails. */
export async function addDependencies(options: InstallOptions & { add?: Record<string, string>; remove?: string[] }): Promise<InstallReport> {
  const { root } = options;
  const before = existsSync(join(root, "halo.json")) ? await Bun.file(join(root, "halo.json")).text() : undefined;
  const config = readProjectConfig(root) as Record<string, unknown> & { dependencies?: Record<string, string> };
  const deps = { ...(config.dependencies ?? {}) };
  for (const [name, spec] of Object.entries(options.add ?? {})) deps[name] = spec;
  for (const name of options.remove ?? []) delete deps[name];
  config.dependencies = Object.fromEntries(Object.entries(deps).sort(([a], [b]) => a.localeCompare(b)));
  writeProjectConfig(root, config);
  try {
    return await installProject({ ...options, unlock: options.unlock ?? new Set(Object.keys(options.add ?? {})) });
  } catch (err) {
    if (before === undefined) rmSync(join(root, "halo.json"), { force: true });
    else writeFileSync(join(root, "halo.json"), before);
    throw err;
  }
}

/** The install summary: each package's permissions, who added it, and the totals. */
export function describeInstall(report: InstallReport): string[] {
  const lines: string[] = [];
  for (const r of report.packages) {
    lines.push(`${r.name}@${r.version}${r.direct ? "" : ` (added by ${r.addedBy.join(", ")})`}`);
    for (const l of describeOwn(r.permissions)) lines.push(`    ${l}`);
    for (const l of describeHostedUse(r.pkg.manifest)) lines.push(`    ${l}`);
  }
  if (report.packages.length > 1) {
    lines.push("total:");
    for (const l of describeOwn(report.total)) lines.push(`    ${l}`);
  }
  return lines;
}

export function describeOwn(p: PackagePermissions): string[] {
  return [...describePermissions(p), ...(p.hosted?.length ? [`sends your inputs to: ${p.hosted.join(", ")}`] : [])];
}

/**
 * The plain-words disclosure for a package with hosted pipelines: they run on the publisher's
 * server, so calling them sends your inputs there, with a key read from an env variable.
 */
export function describeHostedUse(manifest: PackageManifest): string[] {
  const h = manifest.hosted;
  if (!h) return [];
  const host = hostOf(h.endpoint);
  const names = h.exports.join(", ");
  const key = h.auth ? ` and reads ${h.auth.env} (the key ${manifest.name}'s publisher issues you)` : "";
  const lines = [`hosted: ${names} ${h.exports.length === 1 ? "runs" : "run"} on ${host}, not on this machine. This package sends your inputs to ${host}${key}`];
  const concern = hostedEndpointConcern(h.endpoint);
  // The public registry refuses these endpoints; a folder or private registry may not.
  if (concern) lines.push(`hosted: the endpoint ${h.endpoint} ${concern}, which the public registry wouldn't accept. Check you trust where ${manifest.name} came from`);
  return lines;
}

export { PACKAGES_DIR };
