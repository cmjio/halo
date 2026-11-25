/**
 * v1 tool packages (halo-tool.json, `halo-tool/1`, halo.lock `tools`, .halo/tools), kept so
 * Halo 0.8 lockfiles and registries keep working. New code uses the v2 package manager:
 * format.ts, client.ts, resolve.ts, install.ts, resolver.ts and cli.ts in this folder.
 *
 * Packing, publishing, installing, and loading tool packages.
 *
 *   halo pack ./my-tool            → my-tool-1.0.0.halotool (one file: manifest + files)
 *   halo publish my-tool-1.0.0.halotool --registry ./registry/index.json
 *   halo add stripe                → installs from the registry into .halo/tools/stripe,
 *                                    pinned (version + sha256) in halo.lock
 *   halo install                   → reinstalls everything halo.lock pins
 *
 * A registry is a static JSON index (a file or any https URL) listing each
 * package's versions, where to download them, and their sha256. Downloads are
 * checked against it, and installed packages are checked against halo.lock
 * every time they load.
 *
 * Trust (letting a package run its own code) is never read from halo.lock, which
 * is shared and can be edited in a pull request: it is recorded on this machine,
 * in .halo/trust.json, for the exact checksum that was trusted.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { Glob } from "bun";
import { checkManifest, MANIFEST_FILE, ManifestError, permissionsOf, safeRelative, type Permissions, type ToolManifest } from "./manifest.js";
import { httpProvider, mcpPackageProvider, moduleProvider, type BuiltProvider } from "./providers.js";

export const PACKAGE_FORMAT = "halo-tool/1";
export const REGISTRY_FORMAT = "halo-registry/1";
export const LOCK_FILE = "halo.lock";
export const TOOLS_DIR = ".halo/tools";
export const TRUST_FILE = ".halo/trust.json";
/** The public registry of first-party packages, published with the site. */
export const HOSTED_REGISTRY = "https://halolang.com/registry/index.json";
const BUNDLED_REGISTRY = resolve(import.meta.dir, "../../registry/index.json");
/**
 * The registry Halo uses by default: the copy in a checkout of Halo, or the hosted one for
 * an installed `halo` binary (which carries no registry files).
 */
export const DEFAULT_REGISTRY = existsSync(BUNDLED_REGISTRY) ? BUNDLED_REGISTRY : HOSTED_REGISTRY;
const MAX_PACKAGE_BYTES = 5 * 1024 * 1024;

export class PackageError extends Error {}

export interface ToolPackage {
  format: typeof PACKAGE_FORMAT;
  manifest: ToolManifest;
  /** Every file in the package (including halo-tool.json), base64. */
  files: Record<string, string>;
}

export interface RegistryIndex {
  format: typeof REGISTRY_FORMAT;
  packages: Record<
    string,
    {
      description: string;
      publisher?: string;
      homepage?: string;
      latest: string;
      versions: Record<string, { file: string; sha256: string; providers: string[]; permissions: Permissions; publishedAt?: string }>;
    }
  >;
}

export interface LockEntry {
  version: string;
  /** Where it came from: "registry:<index or default>#name@version", a .halotool URL or path, or a folder (paths relative to the project). */
  source: string;
  sha256: string;
  providers: string[];
  /** What it can do; `permissions.code` means installing it needs --trust. */
  permissions: Permissions;
}

export interface Lockfile {
  tools: Record<string, LockEntry>;
}

export const sha256 = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");

// ── Packing ──

/** Bundle a package folder into one .halotool file's bytes. */
export function pack(dir: string): { bytes: Uint8Array; manifest: ToolManifest; sha256: string } {
  const manifestPath = join(dir, MANIFEST_FILE);
  if (!existsSync(manifestPath)) throw new PackageError(`No ${MANIFEST_FILE} in ${dir}`);
  const manifest = checkManifest(JSON.parse(readFileSync(manifestPath, "utf8")));
  const files: Record<string, string> = {};
  let total = 0;
  for (const path of new Glob("**/*").scanSync({ cwd: dir, dot: false, onlyFiles: true })) {
    const rel = path.split("\\").join("/");
    if (rel.startsWith("node_modules/") || rel.endsWith(".halotool")) continue;
    const data = readFileSync(join(dir, rel));
    total += data.length;
    if (total > MAX_PACKAGE_BYTES) throw new PackageError(`${dir} is over ${MAX_PACKAGE_BYTES / 1024 / 1024}MB`);
    files[rel] = data.toString("base64");
  }
  for (const [name, p] of Object.entries(manifest.providers)) {
    if (p.kind === "module" && !files[p.entry]) throw new PackageError(`Provider ${name}'s entry ${p.entry} is not in ${dir}`);
  }
  const pkg: ToolPackage = { format: PACKAGE_FORMAT, manifest, files };
  const bytes = new TextEncoder().encode(JSON.stringify(pkg));
  return { bytes, manifest, sha256: sha256(bytes) };
}

export function readPackage(bytes: Uint8Array, reserved: Iterable<string> = []): ToolPackage {
  if (bytes.length > MAX_PACKAGE_BYTES * 1.5) throw new PackageError("Package is too large");
  let pkg: ToolPackage;
  try {
    pkg = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new PackageError("Not a Halo tool package (not JSON)");
  }
  if (pkg?.format !== PACKAGE_FORMAT || !pkg.files || typeof pkg.files !== "object") throw new PackageError(`Not a Halo tool package (format is not ${PACKAGE_FORMAT})`);
  for (const path of Object.keys(pkg.files)) if (!safeRelative(path)) throw new PackageError(`Package has an unsafe file path: ${path}`);
  // The manifest that counts is the one in the files, which is what gets installed.
  const inner = pkg.files[MANIFEST_FILE];
  if (!inner) throw new PackageError(`Package has no ${MANIFEST_FILE}`);
  pkg.manifest = checkManifest(JSON.parse(Buffer.from(inner, "base64").toString("utf8")), reserved);
  return pkg;
}

// ── Registries ──

async function readSource(source: string, fetchFn: typeof fetch = fetch): Promise<Uint8Array> {
  if (/^https?:\/\//i.test(source)) {
    if (/^http:/i.test(source) && !/^http:\/\/(localhost|127\.0\.0\.1|\[::1\])[:/]/i.test(source)) throw new PackageError(`Refusing to download over plain http: ${source}`);
    const res = await fetchFn(source);
    if (!res.ok) throw new PackageError(`Could not download ${source} (${res.status})`);
    return new Uint8Array(await res.arrayBuffer());
  }
  const path = source.replace(/^file:\/\//, "");
  if (!existsSync(path)) throw new PackageError(`Not found: ${source}`);
  return readFileSync(path);
}

export async function readRegistry(index: string, fetchFn?: typeof fetch): Promise<RegistryIndex> {
  const data = JSON.parse(new TextDecoder().decode(await readSource(index, fetchFn))) as RegistryIndex;
  if (data?.format !== REGISTRY_FORMAT || typeof data.packages !== "object") throw new PackageError(`${index} is not a Halo tool registry (format ${REGISTRY_FORMAT})`);
  return data;
}

/** Where a registry entry's file lives: absolute, or relative to the index. */
function resolveFrom(index: string, file: string): string {
  if (/^https?:\/\//i.test(file)) return file;
  if (/^https?:\/\//i.test(index)) return new URL(file, index).href;
  return resolve(dirname(index.replace(/^file:\/\//, "")), file);
}

export async function search(index: string, query = "", fetchFn?: typeof fetch) {
  const reg = await readRegistry(index, fetchFn);
  const q = query.toLowerCase();
  return Object.entries(reg.packages)
    .filter(([name, p]) => !q || name.includes(q) || p.description.toLowerCase().includes(q) || (p.publisher ?? "").toLowerCase().includes(q))
    .map(([name, p]) => ({ name, ...p, latestVersion: p.versions[p.latest]! }));
}

/** Add a packed package to a registry index on disk, copying it next to the index. */
export function publish(packageFile: string, index: string): { name: string; version: string; file: string } {
  const bytes = readFileSync(packageFile);
  const pkg = readPackage(bytes);
  const m = pkg.manifest;
  const reg: RegistryIndex = existsSync(index) ? JSON.parse(readFileSync(index, "utf8")) : { format: REGISTRY_FORMAT, packages: {} };
  const entry = (reg.packages[m.name] ??= { description: m.description, latest: m.version, versions: {} });
  if (entry.versions[m.version]) throw new PackageError(`${m.name}@${m.version} is already published; bump the version`);
  const file = `packages/${m.name}-${m.version}.halotool`;
  mkdirSync(join(dirname(index), "packages"), { recursive: true });
  writeFileSync(join(dirname(index), file), bytes);
  Object.assign(entry, { description: m.description, publisher: m.publisher, homepage: m.homepage });
  entry.versions[m.version] = { file, sha256: sha256(bytes), providers: Object.keys(m.providers), permissions: permissionsOf(m), publishedAt: new Date().toISOString() };
  if (compareVersions(m.version, entry.latest) >= 0) entry.latest = m.version;
  writeFileSync(index, JSON.stringify(reg, null, 2) + "\n");
  return { name: m.name, version: m.version, file };
}

export function compareVersions(a: string, b: string): number {
  const [x, y] = [a, b].map((v) => v.split("-")[0]!.split(".").map(Number));
  for (let i = 0; i < 3; i++) if (x![i] !== y![i]) return x![i]! - y![i]!;
  return a.includes("-") === b.includes("-") ? 0 : a.includes("-") ? -1 : 1;
}

// ── Installing ──

export interface Project {
  /** The project folder: halo.lock and .halo/tools live here. */
  root: string;
  /** Provider names that exist without packages (built-ins). */
  builtins: string[];
  fetch?: typeof fetch;
}

export function readLock(root: string): Lockfile {
  const path = join(root, LOCK_FILE);
  if (!existsSync(path)) return { tools: {} };
  const lock = JSON.parse(readFileSync(path, "utf8")) as Lockfile;
  return { tools: lock.tools ?? {} };
}

/** Checksums this machine trusts to run their code, by package name. */
function readTrust(root: string): Record<string, string> {
  const path = join(root, TRUST_FILE);
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {};
}

function writeTrust(root: string, trust: Record<string, string>) {
  mkdirSync(join(root, ".halo"), { recursive: true });
  writeFileSync(join(root, TRUST_FILE), JSON.stringify(trust, null, 2) + "\n");
}

/** A registry as halo.lock names it: "default" for the one that ships with Halo, so the lock works on any machine. */
const isDefault = (index: string) => index === DEFAULT_REGISTRY || index === HOSTED_REGISTRY || (!/^https?:/.test(index) && resolve(index) === BUNDLED_REGISTRY);
const registryName = (index: string) => (isDefault(index) ? "default" : index);
const registryPath = (name: string) => (name === "default" ? DEFAULT_REGISTRY : name);

function writeLock(root: string, lock: Lockfile) {
  const sorted = Object.fromEntries(Object.entries(lock.tools).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(join(root, LOCK_FILE), JSON.stringify({ tools: sorted }, null, 2) + "\n");
}

export interface InstallResult {
  name: string;
  version: string;
  providers: string[];
  permissions: Permissions;
  source: string;
}

/**
 * Install a package: a registry name (`stripe`, `stripe@1.2.0`), a .halotool file or
 * https URL, or a package folder. A package that runs its own code needs `trust`.
 */
export async function install(project: Project, spec: string, options: { registry?: string; trust?: boolean; expectSha?: string } = {}): Promise<InstallResult> {
  const located = await locate(spec, options.registry ?? DEFAULT_REGISTRY, project.fetch);
  const { bytes, expected } = located;
  // A local file or folder inside the project is recorded relative to it.
  const source = !/^(registry:|https?:)/.test(located.source) && !relative(project.root, located.source).startsWith("..") ? relative(project.root, located.source) || "." : located.source;
  const digest = sha256(bytes);
  const want = options.expectSha ?? expected;
  if (want && want !== digest) throw new PackageError(`${spec}: checksum mismatch (expected ${want.slice(0, 12)}…, got ${digest.slice(0, 12)}…). The download changed; not installing.`);
  const lock = readLock(project.root);
  const peek = readPackage(bytes);
  // A package's providers can't take a built-in's name, or another installed package's.
  const reserved = [...project.builtins, ...Object.entries(lock.tools).filter(([n]) => n !== peek.manifest.name).flatMap(([, e]) => e.providers)];
  const pkg = readPackage(bytes, reserved);
  const m = pkg.manifest;
  const permissions = permissionsOf(m);
  if (permissions.code && !options.trust) {
    throw new PackageError(`${m.name} runs its own code (${permissions.spawn.length ? `starts ${permissions.spawn.join("; ")}` : "a module provider"}). Install it with --trust if you trust ${m.publisher ?? "its publisher"}.`);
  }
  const dir = join(project.root, TOOLS_DIR, m.name);
  rmSync(dir, { recursive: true, force: true });
  for (const [path, data] of Object.entries(pkg.files)) {
    const target = join(dir, path);
    if (relative(dir, target).startsWith("..")) throw new PackageError(`Unsafe path in package: ${path}`);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, Buffer.from(data, "base64"));
  }
  writeFileSync(join(dir, "package.halotool"), bytes);
  lock.tools[m.name] = { version: m.version, source, sha256: digest, providers: Object.keys(m.providers), permissions };
  writeLock(project.root, lock);
  const trust = readTrust(project.root);
  if (permissions.code) trust[m.name] = digest;
  else delete trust[m.name];
  writeTrust(project.root, trust);
  return { name: m.name, version: m.version, providers: Object.keys(m.providers), permissions, source };
}

async function locate(spec: string, registry: string, fetchFn?: typeof fetch): Promise<{ bytes: Uint8Array; source: string; expected?: string }> {
  if (/^https?:\/\//i.test(spec) || spec.endsWith(".halotool")) {
    const source = /^https?:\/\//i.test(spec) ? spec : resolve(spec);
    return { bytes: await readSource(source, fetchFn), source };
  }
  if (existsSync(spec) && existsSync(join(spec, MANIFEST_FILE))) {
    const source = resolve(spec);
    return { bytes: pack(source).bytes, source };
  }
  const at = spec.lastIndexOf("@");
  const [name, version] = at > 0 ? [spec.slice(0, at), spec.slice(at + 1)] : [spec, undefined];
  const reg = await readRegistry(registry, fetchFn);
  const entry = reg.packages[name];
  if (!entry) throw new PackageError(`No package "${name}" in ${registry}${existsSync(spec) ? ` (and ${spec} has no ${MANIFEST_FILE})` : ""}`);
  const v = version ?? entry.latest;
  const release = entry.versions[v];
  if (!release) throw new PackageError(`${name} has no version ${v} (versions: ${Object.keys(entry.versions).join(", ")})`);
  return { bytes: await readSource(resolveFrom(registry, release.file), fetchFn), source: `registry:${registryName(registry)}#${name}@${v}`, expected: release.sha256 };
}

export function uninstall(root: string, name: string): boolean {
  const lock = readLock(root);
  if (!lock.tools[name]) return false;
  delete lock.tools[name];
  writeLock(root, lock);
  rmSync(join(root, TOOLS_DIR, name), { recursive: true, force: true });
  const trust = readTrust(root);
  if (trust[name]) {
    delete trust[name];
    writeTrust(root, trust);
  }
  return true;
}

/**
 * Reinstall everything halo.lock pins, at the pinned checksums. Packages that run their
 * own code need `trust` (halo install --trust), whatever the lock says.
 */
export async function installFromLock(project: Project, options: { trust?: boolean } = {}): Promise<InstallResult[]> {
  const lock = readLock(project.root);
  const needTrust = Object.entries(lock.tools).filter(([, e]) => e.permissions?.code).map(([n]) => n);
  if (needTrust.length && !options.trust) {
    throw new PackageError(`${needTrust.join(", ")} ${needTrust.length === 1 ? "runs its" : "run their"} own code; check ${LOCK_FILE}, then run \`halo install --trust\``);
  }
  const done: InstallResult[] = [];
  for (const [name, entry] of Object.entries(lock.tools)) {
    const reg = entry.source.match(/^registry:(.*)#([^#@]+)@(.+)$/);
    const spec = reg ? `${reg[2]}@${reg[3]}` : /^https?:/.test(entry.source) ? entry.source : resolve(project.root, entry.source);
    done.push(await install(project, spec, { registry: reg ? registryPath(reg[1]!) : undefined, trust: options.trust, expectSha: entry.sha256 }));
    if (done.at(-1)!.name !== name) throw new PackageError(`${entry.source} is now "${done.at(-1)!.name}", not "${name}"`);
  }
  return done;
}

// ── Loading ──

export interface LoadedProvider extends BuiltProvider {
  name: string;
  packageName: string;
}

/**
 * The providers of every package halo.lock pins, each checked against its pinned
 * checksum. Module providers load only for packages installed with --trust.
 */
export async function loadInstalled(root: string): Promise<LoadedProvider[]> {
  const lock = readLock(root);
  const trust = readTrust(root);
  const out: LoadedProvider[] = [];
  for (const [name, entry] of Object.entries(lock.tools)) {
    const dir = join(root, TOOLS_DIR, name);
    const file = join(dir, "package.halotool");
    if (!existsSync(file)) throw new PackageError(`Tool package "${name}" is in ${LOCK_FILE} but not installed; run \`halo install\``);
    const bytes = readFileSync(file);
    if (sha256(bytes) !== entry.sha256) throw new PackageError(`Tool package "${name}" doesn't match ${LOCK_FILE} (its files changed); run \`halo install\``);
    const pkg = readPackage(bytes);
    // What runs is what was checked: the files are rewritten from the verified package.
    for (const [path, data] of Object.entries(pkg.files)) {
      const target = join(dir, path);
      const content = Buffer.from(data, "base64");
      if (!existsSync(target) || !readFileSync(target).equals(content)) {
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, content);
      }
    }
    for (const [providerName, spec] of Object.entries(pkg.manifest.providers)) {
      let built: BuiltProvider;
      if (spec.kind === "http") built = httpProvider(providerName, spec);
      else if (spec.kind === "mcp") {
        if (spec.command && trust[name] !== entry.sha256) throw new PackageError(`Tool package "${name}" starts a command, and this machine hasn't trusted this version; run \`halo add ${name} --trust\` (or halo install --trust)`);
        built = mcpPackageProvider(spec);
      } else {
        if (trust[name] !== entry.sha256) throw new PackageError(`Tool package "${name}" runs its own code, and this machine hasn't trusted this version; run \`halo add ${name} --trust\` (or halo install --trust)`);
        built = await moduleProvider(join(dir, spec.entry), providerName, spec);
      }
      out.push({ name: providerName, packageName: name, ...built });
    }
  }
  return out;
}

export { ManifestError };
