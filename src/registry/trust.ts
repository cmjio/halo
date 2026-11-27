/**
 * Which package checksums this machine has agreed to run code from.
 *
 * Trust lives outside every project, in the user's own config folder, keyed by the project's
 * real path. A project can't grant itself trust: a `.halo/trust.json` committed to a repo (or
 * left in one by an earlier version of Halo) is never read, so cloning a repo and opening it in an
 * editor, or running `halo test` in it, can't load code nobody here agreed to run.
 *
 *   ~/.config/halo/trust.json   (or $XDG_CONFIG_HOME/halo/trust.json, or $HALO_TRUST_FILE)
 *   { "/Users/me/app": { "@acme/clock": "<sha256>" } }
 */

import { chmodSync, existsSync, mkdirSync, readFileSync, realpathSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

/** The trust file every project on this machine shares. */
export function trustFile(): string {
  if (process.env.HALO_TRUST_FILE) return resolve(process.env.HALO_TRUST_FILE);
  const config = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
  return join(config, "halo", "trust.json");
}

/** The file Halo used to keep inside a project. It is ignored now, and never pushed. */
export const LEGACY_TRUST_FILE = ".halo/trust.json";

/** A project's key in the trust file: its real path, so a symlink or `..` names the same project. */
function projectKey(root: string): string {
  const abs = resolve(root);
  try {
    return realpathSync(abs);
  } catch {
    return abs;
  }
}

function readAll(): Record<string, Record<string, string>> {
  const path = trustFile();
  if (!existsSync(path)) return {};
  try {
    const all = JSON.parse(readFileSync(path, "utf8"));
    return all && typeof all === "object" && !Array.isArray(all) ? all : {};
  } catch {
    return {};
  }
}

/** Checksums this machine trusts to run code from, by package name, for the project at `root`. */
export function readTrust(root: string): Record<string, string> {
  const entry = readAll()[projectKey(root)];
  return entry && typeof entry === "object" ? { ...entry } : {};
}

/** Replace the project's trusted checksums. The file is written readable by this user only. */
export function writeTrust(root: string, trust: Record<string, string>): void {
  const path = trustFile();
  const all = readAll();
  const key = projectKey(root);
  if (Object.keys(trust).length) all[key] = trust;
  else delete all[key];
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(all, null, 2) + "\n", { mode: 0o600 });
  renameSync(tmp, path);
  try {
    chmodSync(path, 0o600);
  } catch {}
}

/** Whether a project still has the old in-project trust file (which no longer counts). */
export const hasLegacyTrust = (root: string) => existsSync(join(root, LEGACY_TRUST_FILE));
