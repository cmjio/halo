/**
 * Which registry a package comes from, and the tokens for registries you've logged in to.
 *
 *   default registry:  --registry, then HALO_REGISTRY, then halo.json "registry", then Halo's own
 *   by scope:          halo.json "registries": { "@acme": "https://halo.acme.internal" }
 *   tokens:            HALO_TOKEN, then ~/.halo/credentials.json (by registry; mode 0600)
 */

import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import { INDEX_PATH, parsePackageName, PROJECT_FILE, type ProjectPackageConfig } from "./contract.js";

/** The hosted registry: what an installed `halo` binary uses. */
export const HOSTED_REGISTRY = "https://registry.halolang.com/";
/** The static registry in a checkout of Halo (the first-party @halo packages). */
export const BUNDLED_REGISTRY = resolve(import.meta.dir, "../../registry");
/** The registry Halo uses by default: the bundled folder in a checkout, else the hosted service. */
export const DEFAULT_REGISTRY = existsSync(join(BUNDLED_REGISTRY, INDEX_PATH)) ? BUNDLED_REGISTRY : HOSTED_REGISTRY;

export const isUrl = (s: string) => /^https?:\/\//i.test(s);

/** A registry location, normalized: URLs end in "/", folders are absolute (relative to `root`). */
export function normalizeRegistry(location: string, root = process.cwd()): string {
  if (isUrl(location)) return location.endsWith("/") || location.endsWith(".json") ? location : `${location}/`;
  const path = location.replace(/^file:\/\//, "");
  return isAbsolute(path) ? path : resolve(root, path);
}

/** halo.json, as far as packages care. Missing file → {}. */
export function readProjectConfig(root: string): ProjectPackageConfig & Record<string, unknown> {
  const path = join(root, PROJECT_FILE);
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    throw new Error(`${path} is not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** Write halo.json back, keeping its other fields and their order. */
export function writeProjectConfig(root: string, config: Record<string, unknown>) {
  writeFileSync(join(root, PROJECT_FILE), JSON.stringify(config, null, 2) + "\n");
}

export interface RegistrySettings {
  /** The default registry, normalized. */
  default: string;
  /** Registries by scope, normalized. */
  scopes: Record<string, string>;
  root: string;
}

export function registrySettings(root: string, flag?: string): RegistrySettings {
  const config = readProjectConfig(root);
  const chosen = flag ?? (Bun.env.HALO_REGISTRY || undefined) ?? config.registry ?? DEFAULT_REGISTRY;
  const scopes: Record<string, string> = {};
  for (const [scope, loc] of Object.entries(config.registries ?? {})) if (typeof loc === "string") scopes[scope] = normalizeRegistry(loc, root);
  return { default: normalizeRegistry(chosen, root), scopes, root };
}

/** The registry a package comes from: its scope's, else the default. */
export function registryFor(settings: RegistrySettings, name: string): string {
  const scope = parsePackageName(name)?.scope;
  return (scope && settings.scopes[scope]) || settings.default;
}

const isDefault = (location: string) => location === DEFAULT_REGISTRY || location === HOSTED_REGISTRY || location === BUNDLED_REGISTRY;

/** How halo.lock names a registry: "registry:default" for Halo's own (so the lock works anywhere). */
export function lockSource(location: string, root: string): string {
  if (isDefault(location)) return "registry:default";
  if (isUrl(location)) return `registry:${location}`;
  const rel = relative(root, location);
  if (rel === "") return "registry:.";
  return `registry:${!rel.startsWith("..") && !isAbsolute(rel) ? rel : location}`;
}

/** The registry a lock source names, or undefined when the source isn't a registry. */
export function registryOfSource(source: string, root: string): string | undefined {
  if (!source.startsWith("registry:")) return undefined;
  const rest = source.slice("registry:".length);
  // v1 lock sources carry "#name@version".
  const loc = rest.replace(/#[^#]*$/, "");
  return loc === "default" ? DEFAULT_REGISTRY : normalizeRegistry(loc, root);
}

// ── Credentials ──

export const haloHome = () => Bun.env.HALO_HOME || join(homedir(), ".halo");
const credentialsPath = () => join(haloHome(), "credentials.json");

export interface Credential {
  token: string;
  login?: string;
}

export function readCredentials(): Record<string, Credential> {
  const path = credentialsPath();
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return {};
  }
}

function writeCredentials(creds: Record<string, Credential>) {
  mkdirSync(haloHome(), { recursive: true, mode: 0o700 });
  const path = credentialsPath();
  writeFileSync(path, JSON.stringify(creds, null, 2) + "\n", { mode: 0o600 });
  chmodSync(path, 0o600);
}

export function saveCredential(registry: string, cred: Credential) {
  const creds = readCredentials();
  creds[registry] = cred;
  writeCredentials(creds);
}

export function removeCredential(registry: string): boolean {
  const creds = readCredentials();
  if (!creds[registry]) return false;
  delete creds[registry];
  writeCredentials(creds);
  return true;
}

/** The token for a registry: HALO_TOKEN wins, then what `halo login` saved. */
export function tokenFor(registry: string): string | undefined {
  return Bun.env.HALO_TOKEN || readCredentials()[registry]?.token;
}
