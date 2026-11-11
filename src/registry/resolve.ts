/**
 * Dependency resolution: one version of each package across the whole graph.
 *
 * Each package gets the highest version that satisfies every range that asks for it
 * (prereleases only when a range names one; yanked versions only when halo.lock already
 * pins them), and whose `halo` range accepts this Halo. A locked version is kept while it
 * still satisfies everything, unless the package is being updated. When no version fits,
 * resolution fails and prints every requirement chain that asked for the package.
 */

import { existsSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve as resolvePath } from "node:path";
import { type LockfileV2, type PackageDoc, type VersionDoc } from "./contract.js";
import { compare, isValidRange, satisfies, sortDescending } from "./semver.js";
import { RegistryClient, readSource } from "./client.js";
import { isUrl, lockSource, registryFor, registryOfSource, tokenFor, type RegistrySettings } from "./config.js";
import { pack, PackageError, readPackage, sha256, type PackageData } from "./format.js";
import { normalizePackageName, parsePackageName } from "./contract.js";

export class ResolveError extends PackageError {}

/** A dependency value that isn't a range: a folder, a .halotool file, or an https URL. */
export function isLocalSpec(spec: string): boolean {
  return /^(file:|\.{1,2}\/|\/|~\/)/.test(spec) || isUrl(spec) || spec.endsWith(".halotool") || (/^[A-Za-z]:[\\/]/.test(spec) && !isValidRange(spec));
}

export interface Requirement {
  range: string;
  /** The packages between halo.json and this requirement, as name@version. Empty: halo.json itself. */
  chain: string[];
}

export const formatRequirement = (name: string, r: Requirement) => [`halo.json`, ...r.chain, `${name} ${r.range}`].join(" → ");

export interface ResolvedNode {
  name: string;
  version: string;
  /** halo.lock's source: "registry:default", "registry:<url or folder>", a path or URL. */
  source: string;
  direct: boolean;
  /** Exact versions of its dependencies. */
  dependencies: Record<string, string>;
  /** Its own dependency ranges. */
  ranges: Record<string, string>;
  requiredBy: Requirement[];
  /** Registry packages: where it comes from, and its doc. */
  registry?: RegistryClient;
  versionDoc?: VersionDoc;
  /** Folder, file and URL packages: already read. */
  local?: { bytes: Uint8Array; pkg: PackageData; sha256: string };
  /** halo.lock pins this exact version and source, so its checksum must match. */
  lockedSha?: string;
}

export interface ResolveInput {
  root: string;
  /** halo.json `dependencies`. */
  dependencies: Record<string, string>;
  registries: RegistrySettings;
  locked?: LockfileV2;
  /** Packages to re-resolve ignoring halo.lock; "all" for every one. */
  unlock?: Set<string> | "all";
  haloVersion: string;
  fetch?: typeof fetch;
  /** Reuse clients (and their cached docs) across calls. */
  clients?: Map<string, RegistryClient>;
}

export interface Resolution {
  nodes: Map<string, ResolvedNode>;
}

export function clientFor(location: string, clients: Map<string, RegistryClient>, fetchFn?: typeof fetch): RegistryClient {
  let c = clients.get(location);
  if (!c) {
    c = new RegistryClient(location, { fetch: fetchFn, token: tokenFor(location) });
    clients.set(location, c);
  }
  return c;
}

/** Read a folder (packed on the fly), a .halotool path, or a URL. `source` is how halo.lock records it. */
export async function readLocal(spec: string, root: string, fetchFn?: typeof fetch): Promise<{ bytes: Uint8Array; source: string; pkg: PackageData }> {
  const raw = spec.replace(/^file:/, "");
  if (isUrl(raw)) {
    const bytes = await readSource(raw, fetchFn);
    return { bytes, source: raw, pkg: readPackage(bytes) };
  }
  const path = resolvePath(root, raw.replace(/^~\//, `${Bun.env.HOME ?? ""}/`));
  if (!existsSync(path)) throw new ResolveError(`Not found: ${spec}`);
  const rel = relative(root, path);
  const source = !rel ? "." : !rel.startsWith("..") && !isAbsolute(rel) ? rel : path;
  if (statSync(path).isDirectory()) {
    const packed = pack(path);
    return { bytes: packed.bytes, source, pkg: packed.pkg };
  }
  const bytes = await readSource(path);
  return { bytes, source, pkg: readPackage(bytes) };
}

/** The halo.json value for a local source: "./path" style, or the URL. */
export const specOfSource = (source: string) => (isUrl(source) || isAbsolute(source) || source.startsWith(".") ? source : `./${source}`);

export async function resolveGraph(input: ResolveInput): Promise<Resolution> {
  const { root, registries, locked, haloVersion } = input;
  const clients = input.clients ?? new Map<string, RegistryClient>();
  const unlocked = (name: string) => input.unlock === "all" || !!input.unlock?.has(name);

  // Folder, file and URL dependencies are read once; their version is whatever they hold.
  const locals = new Map<string, NonNullable<ResolvedNode["local"]> & { source: string }>();
  for (const [key, spec] of Object.entries(input.dependencies)) {
    if (typeof spec !== "string") throw new ResolveError(`halo.json dependencies.${key} must be a version range or a path`);
    if (!isLocalSpec(spec)) {
      if (!isValidRange(spec)) throw new ResolveError(`halo.json dependencies.${key}: "${spec}" is not a version range (like ^1.2.0) or a path`);
      continue;
    }
    const read = await readLocal(spec, root, input.fetch);
    let pkg = read.pkg;
    // A v1 package from a file keeps its bare name, or takes the scoped one halo.json gives it.
    if (pkg.name !== key) {
      if (pkg.v1 && normalizePackageName(pkg.name) === key) pkg = { ...pkg, name: key, manifest: { ...pkg.manifest, name: key } };
      else throw new ResolveError(`halo.json dependencies.${key} points at ${spec}, which is the package ${pkg.name}`);
    }
    locals.set(key, { bytes: read.bytes, pkg, sha256: sha256(read.bytes), source: read.source });
  }

  const docOf = async (name: string, requiredBy: Requirement[]): Promise<{ doc: PackageDoc; client: RegistryClient }> => {
    // A scope's mapped registry wins; otherwise a locked package stays with the registry it came from.
    const scope = parsePackageName(name)?.scope;
    const lockedSource = locked?.packages[name]?.source;
    const fromLock = lockedSource ? registryOfSource(lockedSource, root) : undefined;
    const client = clientFor((scope && registries.scopes[scope]) || fromLock || registryFor(registries, name), clients, input.fetch);
    const doc = await client.doc(name);
    if (!doc) throw new ResolveError(`No package ${name} in ${client.base}\n  required by: ${requiredBy.map((r) => formatRequirement(name, r)).join("\n               ")}`);
    return { doc, client };
  };

  const chosen = new Map<string, ResolvedNode>();

  const pick = async (name: string, reqs: Requirement[]): Promise<ResolvedNode> => {
    const local = locals.get(name);
    const direct = Object.prototype.hasOwnProperty.call(input.dependencies, name);
    if (local) {
      const bad = reqs.filter((r) => !satisfies(local.pkg.version, r.range));
      if (bad.length) throw new ResolveError(`${name} is ${local.pkg.version} from ${local.source}, which doesn't satisfy:\n  ${bad.map((r) => formatRequirement(name, r)).join("\n  ")}`);
      checkHalo(name, local.pkg.version, local.pkg.manifest.halo, haloVersion);
      const lockedEntry = locked?.packages[name];
      return {
        name,
        version: local.pkg.version,
        source: local.source,
        direct,
        dependencies: {},
        ranges: local.pkg.manifest.dependencies ?? {},
        requiredBy: reqs,
        local,
        ...(lockedEntry && lockedEntry.source === local.source && lockedEntry.version === local.pkg.version ? { lockedSha: lockedEntry.sha256 } : {}),
      };
    }
    const { doc, client } = await docOf(name, reqs);
    const source = lockSource(client.base, root);
    const lockedEntry = locked?.packages[name];
    const lockedVersion = lockedEntry && !unlocked(name) && registryOfSource(lockedEntry.source, root) === client.base ? lockedEntry.version : undefined;
    const all = sortDescending(Object.keys(doc.versions));
    const fits = all.filter((v) => reqs.every((r) => satisfies(v, r.range)));
    const live = fits.filter((v) => !doc.versions[v]!.yanked || v === lockedVersion);
    if (!live.length) {
      const yanked = fits.length ? ` (${fits.join(", ")} ${fits.length === 1 ? "is" : "are"} yanked)` : "";
      const lines = reqs.map((r) => formatRequirement(name, r));
      throw new ResolveError(
        reqs.length > 1
          ? `No version of ${name} satisfies every requirement${yanked}:\n  ${lines.join("\n  ")}\nVersions: ${all.join(", ") || "none"}`
          : `No version of ${name} matches ${reqs[0]!.range}${yanked}\n  required by: ${lines[0]}\nVersions: ${all.join(", ") || "none"}`,
      );
    }
    const compatible = live.filter((v) => !doc.versions[v]!.halo || satisfies(haloVersion, doc.versions[v]!.halo!));
    if (!compatible.length) checkHalo(name, live[0]!, doc.versions[live[0]!]!.halo, haloVersion);
    const version = lockedVersion && compatible.includes(lockedVersion) ? lockedVersion : compatible[0]!;
    const versionDoc = doc.versions[version]!;
    return {
      name,
      version,
      source,
      direct,
      dependencies: {},
      ranges: versionDoc.dependencies ?? {},
      requiredBy: reqs,
      registry: client,
      versionDoc,
      ...(lockedEntry && lockedEntry.version === version && lockedEntry.source === source ? { lockedSha: lockedEntry.sha256 } : {}),
    };
  };

  // Settle: gather requirements from halo.json and the packages chosen so far, choose, repeat.
  for (let round = 0; ; round++) {
    if (round > 50) throw new ResolveError("Dependency resolution didn't settle after 50 rounds; the packages' ranges keep changing each other");
    const reqs = new Map<string, Requirement[]>();
    const add = (name: string, r: Requirement) => reqs.set(name, [...(reqs.get(name) ?? []), r]);
    const queue: { name: string; chain: string[] }[] = [];
    for (const [name, spec] of Object.entries(input.dependencies)) {
      add(name, { range: locals.has(name) ? "*" : spec, chain: [] });
      queue.push({ name, chain: [] });
    }
    const seen = new Set<string>();
    while (queue.length) {
      const { name, chain } = queue.shift()!;
      if (seen.has(name)) continue;
      seen.add(name);
      const node = chosen.get(name);
      if (!node) continue;
      const here = [...chain, `${name}@${node.version}`];
      for (const [dep, range] of Object.entries(node.ranges)) {
        if (dep === name) continue;
        add(dep, { range, chain: here });
        queue.push({ name: dep, chain: here });
      }
    }
    let changed = false;
    for (const name of [...chosen.keys()]) if (!reqs.has(name)) (chosen.delete(name), (changed = true));
    for (const [name, list] of reqs) {
      const node = await pick(name, list);
      const prev = chosen.get(name);
      if (!prev || prev.version !== node.version || prev.source !== node.source) changed = true;
      chosen.set(name, node);
    }
    if (!changed) break;
  }

  for (const node of chosen.values()) {
    node.dependencies = Object.fromEntries(Object.keys(node.ranges).filter((d) => chosen.has(d)).map((d) => [d, chosen.get(d)!.version]));
  }
  return { nodes: new Map([...chosen].sort(([a], [b]) => a.localeCompare(b))) };
}

function checkHalo(name: string, version: string, range: string | undefined, haloVersion: string) {
  if (range && !satisfies(haloVersion, range)) {
    throw new ResolveError(`${name}@${version} needs Halo ${range}, and this is Halo ${haloVersion}. Run \`halo upgrade\`, or depend on an older ${name}.`);
  }
}

export { compare };
