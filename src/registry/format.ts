/**
 * Package files: packing a folder into one `.halotool` file, and reading one back.
 *
 *   v2 (`halo-package/2`): a folder with a halo.json that has `name` and `version`, and a README.md.
 *   v1 (`halo-tool/1`):    a folder with a halo-tool.json declaring providers. Still packed and read.
 *
 * Reading always gives a `PackageData` with a v2-shaped manifest, so the rest of the package
 * manager (resolution, installs, the resolver) handles one shape.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Glob } from "bun";
import {
  checkPackageManifest,
  hostedInterfaceProblems,
  MAX_PACKAGE_BYTES,
  MAX_PACKAGE_WIRE_BYTES,
  PACK_EXCLUDE,
  PACKAGE_FORMAT_V2,
  PROJECT_FILE,
  README_FILE,
  type HostedPipelineInterface,
  type PackageExports,
  type PackageFileV2,
  type PackageManifest,
  type PackagePermissions,
} from "./contract.js";
import { checkManifest, MANIFEST_FILE, permissionsOf, safeRelative, type ToolManifest } from "./manifest.js";
import { checkPackageFiles, linkerAnalyzer, type ExportAnalyzer, type PackageCheck } from "./check.js";

export const PACKAGE_FORMAT_V1 = "halo-tool/1";
export { PACKAGE_FORMAT_V2 };

export class PackageError extends Error {}

export const sha256 = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");

/** A package file, read and checked. v1 packages come back with a v2-shaped manifest. */
export interface PackageData {
  format: typeof PACKAGE_FORMAT_V1 | typeof PACKAGE_FORMAT_V2;
  /** The name it installs under: the manifest's (scoped for v2; a v1 package's bare name unless renamed). */
  name: string;
  version: string;
  manifest: PackageManifest;
  /** Every file, base64, as stored in the package. */
  files: Record<string, string>;
  hosted?: Record<string, HostedPipelineInterface>;
  /** The original halo-tool.json, for v1 packages. */
  v1?: ToolManifest;
}

// ── Packing ──

/** Which kind of package a folder holds, if any. */
export function packageKind(dir: string): 1 | 2 | undefined {
  const v2 = join(dir, PROJECT_FILE);
  if (existsSync(v2)) {
    try {
      const raw = JSON.parse(readFileSync(v2, "utf8"));
      if (raw && typeof raw === "object" && "name" in raw && "version" in raw) return 2;
    } catch {
      // Not JSON: fall through, and let pack report it.
      return 2;
    }
  }
  if (existsSync(join(dir, MANIFEST_FILE))) return 1;
  return undefined;
}

function collect(dir: string, exclude: RegExp[]): Record<string, string> {
  const files: Record<string, string> = {};
  let total = 0;
  for (const path of [...new Glob("**/*").scanSync({ cwd: dir, dot: false, onlyFiles: true })].sort()) {
    const rel = path.split("\\").join("/");
    if (exclude.some((re) => re.test(rel))) continue;
    const data = readFileSync(join(dir, rel));
    total += data.length;
    if (total > MAX_PACKAGE_BYTES) throw new PackageError(`${dir} is over ${MAX_PACKAGE_BYTES / 1024 / 1024}MB`);
    files[rel] = data.toString("base64");
  }
  return files;
}

export interface Packed {
  bytes: Uint8Array;
  sha256: string;
  pkg: PackageData;
}

/**
 * Bundle a package folder (v2 halo.json, or v1 halo-tool.json) into one .halotool file's bytes.
 * A hosted package is refused: its hosted sources must stay out and its interfaces go in, which
 * is `packWithHosted` (src/registry/hosted.ts), what `halo pack` and `halo publish` run.
 */
export function pack(dir: string): Packed {
  const packed = packFiles(dir);
  if (packed.pkg.manifest.hosted) {
    throw new PackageError(`${packed.pkg.name} has "hosted": pack it with \`halo pack\` or \`halo publish\` (packWithHosted), which leave its hosted sources out and write their interfaces`);
  }
  return packed;
}

/** Every file of a package folder, packed as is: no hosted handling (packWithHosted builds on it). */
export function packFiles(dir: string): Packed {
  const kind = packageKind(dir);
  if (!kind) throw new PackageError(`No package in ${dir}: it needs a ${PROJECT_FILE} with "name" and "version" (or a v1 ${MANIFEST_FILE})`);
  if (kind === 1) {
    const manifest = checkManifest(JSON.parse(readFileSync(join(dir, MANIFEST_FILE), "utf8")));
    const files = collect(dir, [/^node_modules\//, /\.halotool$/]);
    for (const [name, p] of Object.entries(manifest.providers)) {
      if (p.kind === "module" && !files[p.entry]) throw new PackageError(`Provider ${name}'s entry ${p.entry} is not in ${dir}`);
    }
    const bytes = new TextEncoder().encode(JSON.stringify({ format: PACKAGE_FORMAT_V1, manifest, files }));
    return { bytes, sha256: sha256(bytes), pkg: fromV1(manifest, files) };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(join(dir, PROJECT_FILE), "utf8"));
  } catch (err) {
    throw new PackageError(`${join(dir, PROJECT_FILE)} is not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
  const files = collect(dir, PACK_EXCLUDE);
  const manifest = checkPackageManifest(raw, { files: Object.keys(files) });
  checkContents(manifest, files, dir);
  const file: PackageFileV2 = { format: PACKAGE_FORMAT_V2, manifest, files };
  const bytes = new TextEncoder().encode(JSON.stringify(file));
  if (bytes.length > MAX_PACKAGE_WIRE_BYTES) throw new PackageError(`${dir} packs to ${bytes.length} bytes, over the ${MAX_PACKAGE_WIRE_BYTES / 1024 / 1024}MB a registry accepts`);
  return { bytes, sha256: sha256(bytes), pkg: { format: PACKAGE_FORMAT_V2, name: manifest.name, version: manifest.version, manifest, files } };
}

function checkContents(m: PackageManifest, files: Record<string, string>, where: string) {
  for (const [name, p] of Object.entries(m.providers ?? {})) {
    if (p.kind === "module" && !files[p.entry]) throw new PackageError(`Provider ${name}'s entry ${p.entry} is not in ${where}`);
  }
  const readme = files[README_FILE];
  if (readme && Buffer.from(readme, "base64").length > 256 * 1024) throw new PackageError(`${README_FILE} is over 256KB`);
}

// ── Reading ──

/** A v1 manifest as a v2 one. Its name stays bare unless `name` renames it (e.g. `@halo/stripe`). */
export function fromV1(v1: ToolManifest, files: Record<string, string>, name = v1.name): PackageData {
  const manifest: PackageManifest = {
    name,
    version: v1.version,
    description: v1.description,
    ...(v1.license ? { license: v1.license } : {}),
    ...(v1.homepage ? { homepage: v1.homepage } : {}),
    providers: v1.providers,
  };
  return { format: PACKAGE_FORMAT_V1, name, version: v1.version, manifest, files, v1 };
}

/**
 * Read a package file (v2 or v1) and check it. The manifest that counts is the one inside the
 * files (what gets installed), not the copy beside them. `rename` gives a v1 package its v2 name.
 */
export function readPackage(bytes: Uint8Array, options: { reservedProviders?: Iterable<string>; rename?: string } = {}): PackageData {
  if (bytes.length > MAX_PACKAGE_WIRE_BYTES) throw new PackageError(`Package file is over ${MAX_PACKAGE_WIRE_BYTES / 1024 / 1024}MB`);
  let raw: { format?: string; files?: Record<string, string>; hosted?: Record<string, HostedPipelineInterface> };
  try {
    raw = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new PackageError("Not a Halo package (not JSON)");
  }
  if (!raw || typeof raw !== "object" || !raw.files || typeof raw.files !== "object") throw new PackageError("Not a Halo package (no files)");
  for (const path of Object.keys(raw.files)) if (!safeRelative(path)) throw new PackageError(`Package has an unsafe file path: ${path}`);
  const text = (path: string) => Buffer.from(raw.files![path]!, "base64").toString("utf8");
  if (raw.format === PACKAGE_FORMAT_V1) {
    if (!raw.files[MANIFEST_FILE]) throw new PackageError(`Package has no ${MANIFEST_FILE}`);
    const v1 = checkManifest(JSON.parse(text(MANIFEST_FILE)), options.reservedProviders);
    return fromV1(v1, raw.files, options.rename ?? v1.name);
  }
  if (raw.format !== PACKAGE_FORMAT_V2) throw new PackageError(`Not a Halo package (format is ${JSON.stringify(raw.format)}, not ${PACKAGE_FORMAT_V2} or ${PACKAGE_FORMAT_V1})`);
  if (!raw.files[PROJECT_FILE]) throw new PackageError(`Package has no ${PROJECT_FILE}`);
  const manifest = checkPackageManifest(JSON.parse(text(PROJECT_FILE)), { files: Object.keys(raw.files), reservedProviders: options.reservedProviders });
  checkContents(manifest, raw.files, `${manifest.name}@${manifest.version}`);
  if (raw.hosted !== undefined) {
    if (!raw.hosted || typeof raw.hosted !== "object" || Array.isArray(raw.hosted)) throw new PackageError(`${manifest.name}@${manifest.version}: "hosted" must map pipeline names to interfaces`);
    const problems = Object.entries(raw.hosted).flatMap(([name, i]) => hostedInterfaceProblems(name, i));
    if (problems.length) throw new PackageError(`${manifest.name}@${manifest.version} has bad hosted interfaces:\n  - ${problems.join("\n  - ")}`);
  }
  return { format: PACKAGE_FORMAT_V2, name: manifest.name, version: manifest.version, manifest, files: raw.files, ...(raw.hosted ? { hosted: raw.hosted } : {}) };
}

export const fileText = (pkg: PackageData, path: string) => (pkg.files[path] === undefined ? undefined : Buffer.from(pkg.files[path]!, "base64").toString("utf8"));

// ── What a package exports and can reach ──

export type { ExportAnalyzer, ExportReach } from "./check.js";

let analyzer: ExportAnalyzer = linkerAnalyzer;
const checks = new WeakMap<PackageData, { analyzer: ExportAnalyzer; check: PackageCheck }>();

/**
 * Replace the analyzer for package exports (tests use stand-ins). The default is the linker's
 * analyzePackage; pass undefined to restore it.
 */
export function setExportAnalyzer(fn: ExportAnalyzer | undefined) {
  analyzer = fn ?? linkerAnalyzer;
}

/** The package's text files (what the analyzer reads). */
export function packageTexts(pkg: PackageData): Record<string, string> {
  const texts: Record<string, string> = {};
  for (const path of Object.keys(pkg.files)) if (/\.(halo|json|md)$/.test(path)) texts[path] = fileText(pkg, path)!;
  return texts;
}

/** Exports, permissions and publish problems of a package: the same check the registry service runs (check.ts). */
export function checkPackage(pkg: PackageData): PackageCheck {
  const known = checks.get(pkg);
  if (known && known.analyzer === analyzer) return known.check;
  const check = checkPackageFiles(packageTexts(pkg), pkg.manifest, { hosted: pkg.hosted, analyze: analyzer });
  checks.set(pkg, { analyzer, check });
  return check;
}

/** A package's own permissions: its providers, its env, its hosted endpoints, and its exports' reach. */
export function permissionsOfPackage(pkg: PackageData): PackagePermissions {
  if (pkg.format !== PACKAGE_FORMAT_V2) {
    const p = permissionsOf({ providers: pkg.manifest.providers ?? {} } as ToolManifest);
    return { ...p, env: union(p.env, pkg.manifest.env ?? []), hosted: [] };
  }
  return checkPackage(pkg).permissions;
}

const union = (...lists: string[][]) => [...new Set(lists.flat())];

/** Everything several packages may do together. */
export function totalPermissions(list: PackagePermissions[]): PackagePermissions {
  return {
    network: union(...list.map((p) => p.network)),
    env: union(...list.map((p) => p.env)),
    spawn: union(...list.map((p) => p.spawn)),
    code: list.some((p) => p.code),
    hosted: union(...list.map((p) => p.hosted ?? [])),
  };
}

/** What a package exports (v1 packages: their providers). */
export function exportsOf(pkg: PackageData): PackageExports {
  if (pkg.format !== PACKAGE_FORMAT_V2) return { pipelines: [], agents: [], tools: [], stores: [], schemas: [], policies: [], providers: Object.keys(pkg.manifest.providers ?? {}), skills: [] };
  return checkPackage(pkg).exports;
}

/**
 * Why a package can't be published (empty when it can): the linker's error diagnostics
 * (syntax errors, hard-coded model ids in any shipped file, undeclared model slots,
 * names declared twice in exported files, `use` outside the package or its dependencies), a
 * missing README, and the hosted rules (interfaces, hosted sources left out). The registry
 * service refuses the same.
 */
export function publishProblems(pkg: PackageData): string[] {
  if (pkg.format !== PACKAGE_FORMAT_V2) return [];
  return checkPackage(pkg).problems;
}
