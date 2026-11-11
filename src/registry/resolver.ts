// STUB: replaced by the package manager workstream
//
// Finds installed packages for the linker: `.halo/packages/@scope/name/halo.json` under the
// project root. No lockfile or checksum verification here; the real resolver does both.

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { PACKAGES_DIR, PROJECT_FILE, parsePackageName, type PackageManifest, type PackageResolver, type ResolvedPackage } from "./contract.js";

export function installedResolver(root: string): PackageResolver {
  const base = resolve(root, PACKAGES_DIR);
  const cache = new Map<string, ResolvedPackage | undefined>();
  return {
    resolve(name: string, from?: ResolvedPackage): ResolvedPackage | undefined {
      // A package may only use its own declared dependencies.
      if (from && !Object.hasOwn(from.manifest.dependencies ?? {}, name)) return undefined;
      if (cache.has(name)) return cache.get(name);
      let found: ResolvedPackage | undefined;
      const parsed = parsePackageName(name);
      const dir = parsed ? join(base, parsed.scope, parsed.name) : undefined;
      const file = dir ? join(dir, PROJECT_FILE) : undefined;
      if (dir && file && existsSync(file)) {
        try {
          const manifest = JSON.parse(readFileSync(file, "utf8")) as PackageManifest;
          found = { name, version: manifest.version, dir, manifest };
        } catch {
          found = undefined;
        }
      }
      cache.set(name, found);
      return found;
    },
  };
}
