/**
 * Installed packages, as the linker and the runtime see them.
 *
 *   installedResolver(root)      the PackageResolver the linker uses for `use "@scope/name"`
 *   loadPackageProviders(root)   every installed package's tool providers, ready to register
 *   installedProviderNames(root) the same names without loading anything (for validate)
 *
 * Everything here reads .halo/packages and checks it against halo.lock first: a package whose
 * package.halotool doesn't match the pinned sha256 stops with a message to run `halo install`,
 * and the unpacked files are rewritten from the verified package before anything uses them.
 * A v1 halo.lock (`tools`) still loads through the v1 loader.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { LOCK_FILE, qualifiedProvider, type LockfileV2, type PackageResolver, type ResolvedPackage } from "./contract.js";
import { PackageError, readPackage, sha256, type PackageData } from "./format.js";
import { PACKAGE_FILE, packageDir, readAnyLock, readTrust } from "./lockfile.js";
import { loadInstalled, type LoadedProvider } from "./packages.js";
import { httpProvider, mcpPackageProvider, moduleProvider, type BuiltProvider } from "./providers.js";
import { TOOL_PROVIDERS } from "../parser/builtins.js";

export type { LoadedProvider };

interface Verified {
  pkg: PackageData;
  dir: string;
  sha256: string;
}

/** Read an installed package, check it against halo.lock, and rewrite its files from the verified copy. */
export function verifyInstalled(root: string, name: string, lock: LockfileV2): Verified {
  const entry = lock.packages[name];
  if (!entry) throw new PackageError(`${name} is not in ${LOCK_FILE}; run \`halo add ${name}\``);
  const dir = packageDir(root, name);
  const file = join(dir, PACKAGE_FILE);
  if (!existsSync(file)) throw new PackageError(`Package ${name} is in ${LOCK_FILE} but not installed; run \`halo install\``);
  const bytes = readFileSync(file);
  if (sha256(bytes) !== entry.sha256) throw new PackageError(`Package ${name} doesn't match ${LOCK_FILE} (its files changed); run \`halo install\``);
  const pkg = readPackage(bytes, { rename: name });
  if (pkg.name !== name || pkg.version !== entry.version) throw new PackageError(`Package ${name} in .halo/packages is ${pkg.name}@${pkg.version}, but ${LOCK_FILE} pins ${entry.version}; run \`halo install\``);
  // What runs is what was checked.
  for (const [path, data] of Object.entries(pkg.files)) {
    const target = join(dir, path);
    const content = Buffer.from(data, "base64");
    if (!existsSync(target) || !readFileSync(target).equals(content)) {
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, content);
    }
  }
  return { pkg, dir, sha256: entry.sha256 };
}

/**
 * The linker's view of installed packages. The project may `use` only its direct dependencies,
 * and a package only the dependencies its halo.lock entry records. Packages are verified the
 * first time they're resolved.
 */
export function installedResolver(root: string): PackageResolver {
  const any = readAnyLock(root);
  const lock: LockfileV2 = any.version === 2 ? any.lock : { lockfileVersion: 2, packages: {} };
  const cache = new Map<string, ResolvedPackage>();
  return {
    resolve(name: string, from?: ResolvedPackage): ResolvedPackage | undefined {
      const entry = lock.packages[name];
      if (!entry) return undefined;
      if (from) {
        const parent = lock.packages[from.name];
        if (!parent || !Object.prototype.hasOwnProperty.call(parent.dependencies, name)) return undefined;
      } else if (!entry.direct) return undefined;
      let hit = cache.get(name);
      if (!hit) {
        const v = verifyInstalled(root, name, lock);
        hit = { name, version: v.pkg.version, dir: v.dir, manifest: v.pkg.manifest, ...(v.pkg.hosted ? { hosted: v.pkg.hosted } : {}) };
        cache.set(name, hit);
      }
      return hit;
    },
  };
}

async function buildProvider(name: string, providerName: string, spec: NonNullable<PackageData["manifest"]["providers"]>[string], dir: string, trusted: boolean): Promise<BuiltProvider> {
  if (spec.kind === "http") return httpProvider(providerName, spec);
  if (spec.kind === "mcp") {
    if (spec.command && !trusted) throw new PackageError(`Package ${name} starts a command, and this machine hasn't trusted this version; run \`halo install --trust\``);
    return mcpPackageProvider(spec);
  }
  if (!trusted) throw new PackageError(`Package ${name} runs its own code, and this machine hasn't trusted this version; run \`halo install --trust\``);
  return moduleProvider(join(dir, spec.entry), providerName, spec);
}

/**
 * Every installed package's providers, registered as `@scope/name#Provider`, and also under the
 * bare provider name for direct dependencies when no other direct dependency (or built-in)
 * has that name, so `tool Pay : Stripe()` keeps working. Module providers and stdio MCP
 * servers load only for packages this machine trusted (.halo/trust.json, by checksum).
 */
export async function loadPackageProviders(root: string): Promise<LoadedProvider[]> {
  const any = readAnyLock(root);
  if (any.version === 1) return loadInstalled(root);
  if (any.version === 0) return [];
  const lock = any.lock;
  const trust = readTrust(root);
  const verified = Object.keys(lock.packages).map((name) => [name, verifyInstalled(root, name, lock)] as const);
  const owners = new Map<string, Set<string>>();
  for (const [name, v] of verified) {
    if (!lock.packages[name]!.direct) continue;
    for (const p of Object.keys(v.pkg.manifest.providers ?? {})) owners.set(p, (owners.get(p) ?? new Set()).add(name));
  }
  const bare = unambiguous(owners);
  const out: LoadedProvider[] = [];
  for (const [name, v] of verified) {
    for (const [providerName, spec] of Object.entries(v.pkg.manifest.providers ?? {})) {
      const built = await buildProvider(name, providerName, spec, v.dir, trust[name] === v.sha256);
      out.push({ name: qualifiedProvider(name, providerName), packageName: name, ...built });
      if (bare.get(providerName) === name) out.push({ name: providerName, packageName: name, ...built });
    }
  }
  return out;
}

/** Provider name → the one direct dependency that may use it bare. Names two packages (or a built-in) share are left out. */
function unambiguous(owners: Map<string, Set<string>>): Map<string, string> {
  const builtins = new Set<string>(TOOL_PROVIDERS);
  const out = new Map<string, string>();
  for (const [p, set] of owners) if (set.size === 1 && !builtins.has(p)) out.set(p, [...set][0]!);
  return out;
}

const providerCache = new Map<string, string[]>();

/** The provider names an installed package declares (read from its package file, unverified: names only). */
function providerNamesOf(root: string, name: string, entry: LockfileV2["packages"][string]): string[] {
  const key = `${root}\0${name}\0${entry.sha256}`;
  const hit = providerCache.get(key);
  if (hit) return hit;
  let names: string[] = [];
  const file = join(packageDir(root, name), PACKAGE_FILE);
  if (existsSync(file)) {
    try {
      const raw = JSON.parse(readFileSync(file, "utf8"));
      const inner = raw?.files?.["halo.json"] ?? raw?.files?.["halo-tool.json"];
      if (inner) names = Object.keys(JSON.parse(Buffer.from(inner, "base64").toString("utf8")).providers ?? {});
    } catch {
      names = [];
    }
  }
  providerCache.set(key, names);
  return names;
}

/**
 * The provider names `validate` should accept, without loading any package code: qualified
 * names for every installed package, and bare names as loadPackageProviders registers them.
 */
export function installedProviderNames(root: string): string[] {
  const any = readAnyLock(root);
  if (any.version === 1) return Object.values(any.lock.tools).flatMap((t) => t.providers);
  if (any.version === 0) return [];
  const lock = any.lock;
  const out: string[] = [];
  const owners = new Map<string, Set<string>>();
  for (const [name, entry] of Object.entries(lock.packages)) {
    for (const p of providerNamesOf(root, name, entry)) {
      out.push(qualifiedProvider(name, p));
      if (entry.direct) owners.set(p, (owners.get(p) ?? new Set()).add(name));
    }
  }
  return [...out, ...unambiguous(owners).keys()];
}
