/**
 * halo.lock (v2: `lockfileVersion: 2`, `packages`; v1: `tools`) and .halo/trust.json.
 *
 * Trust is never read from the lockfile: it is this machine's record of the exact checksums
 * it agreed to run code from.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { LOCK_FILE, PACKAGES_DIR, type LockfileV2 } from "./contract.js";
import type { Lockfile } from "./packages.js";

export const TRUST_FILE = ".halo/trust.json";

export type AnyLock = { version: 2; lock: LockfileV2 } | { version: 1; lock: Lockfile } | { version: 0 };

export function readAnyLock(root: string): AnyLock {
  const path = join(root, LOCK_FILE);
  if (!existsSync(path)) return { version: 0 };
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    throw new Error(`${path} is not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (raw?.lockfileVersion === 2) return { version: 2, lock: { lockfileVersion: 2, packages: (raw.packages as LockfileV2["packages"]) ?? {} } };
  if (raw?.tools && typeof raw.tools === "object") return { version: 1, lock: { tools: raw.tools as Lockfile["tools"] } };
  if (raw?.lockfileVersion !== undefined) throw new Error(`${path} has lockfileVersion ${String(raw.lockfileVersion)}; this Halo reads versions 1 and 2. Run \`halo upgrade\``);
  return { version: 0 };
}

/** halo.lock as v2; a v1 or missing lock reads as empty (installing migrates v1). */
export function readLockV2(root: string): LockfileV2 {
  const any = readAnyLock(root);
  return any.version === 2 ? any.lock : { lockfileVersion: 2, packages: {} };
}

export function writeLockV2(root: string, lock: LockfileV2) {
  const packages = Object.fromEntries(
    Object.entries(lock.packages)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, p]) => [name, { ...p, dependencies: Object.fromEntries(Object.entries(p.dependencies).sort(([a], [b]) => a.localeCompare(b))) }]),
  );
  writeFileSync(join(root, LOCK_FILE), JSON.stringify({ lockfileVersion: 2, packages }, null, 2) + "\n");
}

/** Where an installed package lives: .halo/packages/@scope/name (or .halo/packages/<name> for a v1 bare name). */
export const packageDir = (root: string, name: string) => join(root, PACKAGES_DIR, ...name.split("/"));
export const PACKAGE_FILE = "package.halotool";

/** Checksums this machine trusts to run their code, by package name. */
export function readTrust(root: string): Record<string, string> {
  const path = join(root, TRUST_FILE);
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return {};
  }
}

export function writeTrust(root: string, trust: Record<string, string>) {
  mkdirSync(join(root, ".halo"), { recursive: true });
  writeFileSync(join(root, TRUST_FILE), JSON.stringify(trust, null, 2) + "\n");
}
