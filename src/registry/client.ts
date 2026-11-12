/**
 * The registry client: the HTTP API in contract.ts, a static registry folder (the same GET
 * paths as files), or a v1 `index.json` (read only, for old registries and lockfiles).
 *
 * Every downloaded package file is checked against the sha256 in its package doc. Plain http
 * is refused except on localhost.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  API_PREFIX,
  INDEX_PATH,
  PACKAGE_MEDIA_TYPE,
  packageApiPath,
  packageDocPath,
  packageFilePath,
  parsePackageName,
  README_FILE,
  type ApiError,
  type CreatedToken,
  type CreateTokenRequest,
  type DeprecateResponse,
  type DeviceStart,
  type DistTagsResponse,
  type PackageDoc,
  type PackageStats,
  packageStatsPath,
  type PackageSummary,
  type PublishResponse,
  type ScopeDoc,
  type ScopeRole,
  type SearchResponse,
  type TokenInfo,
  type TokenList,
  type TokenResponse,
  type VerifyResponse,
  type VersionDoc,
  type YankResponse,
  type WhoAmI,
} from "./contract.js";
import { compare, isPrerelease, isValidVersion, satisfies, sortDescending } from "./semver.js";
import { exportsOf, fileText, PackageError, permissionsOfPackage, readPackage, sha256, type PackageData } from "./format.js";
import { isUrl, normalizeRegistry } from "./config.js";

export class RegistryError extends PackageError {
  constructor(
    message: string,
    readonly status?: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

export type RegistryKind = "http" | "folder" | "legacy";

export type { TokenInfo };

export interface RegistryClientOptions {
  fetch?: typeof fetch;
  /** Bearer token for writes (and reads, for private registries). */
  token?: string;
}

const LOCAL_HTTP = /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/i;

/** Refuse plain http except on localhost. */
export function checkTransport(url: string) {
  if (/^http:/i.test(url) && !LOCAL_HTTP.test(url)) throw new RegistryError(`Refusing to use plain http: ${url} (use https)`);
}

/** Read a .halotool from a path or https URL. */
export async function readSource(source: string, fetchFn: typeof fetch = fetch): Promise<Uint8Array> {
  if (isUrl(source)) {
    checkTransport(source);
    const res = await fetchFn(source);
    if (!res.ok) throw new RegistryError(`Could not download ${source} (${res.status})`, res.status);
    return new Uint8Array(await res.arrayBuffer());
  }
  const path = source.replace(/^file:\/\//, "");
  if (!existsSync(path)) throw new RegistryError(`Not found: ${source}`);
  return readFileSync(path);
}

interface LegacyIndex {
  format: "halo-registry/1";
  packages: Record<string, { description: string; publisher?: string; homepage?: string; latest: string; versions: Record<string, { file: string; sha256: string; providers: string[]; permissions: { network: string[]; env: string[]; spawn: string[]; code: boolean }; publishedAt?: string }> }>;
}

export class RegistryClient {
  readonly kind: RegistryKind;
  /** Normalized: a URL ending in "/", an absolute folder, or (legacy) the index file. */
  readonly base: string;
  private readonly fetchFn: typeof fetch;
  private token?: string;
  private docs = new Map<string, Promise<PackageDoc | undefined>>();

  constructor(location: string, options: RegistryClientOptions = {}) {
    this.base = normalizeRegistry(location);
    this.kind = this.base.endsWith(".json") ? "legacy" : isUrl(this.base) ? "http" : "folder";
    if (this.kind === "http") checkTransport(this.base);
    this.fetchFn = options.fetch ?? fetch;
    this.token = options.token;
  }

  setToken(token: string | undefined) {
    this.token = token;
  }

  toString() {
    return this.base;
  }

  // ── Transport ──

  private url(path: string): string {
    return new URL(path, this.base).href;
  }

  private async request(method: string, path: string, body?: unknown, extra: { contentType?: string; auth?: boolean } = {}): Promise<Response> {
    if (this.kind !== "http") throw new RegistryError(`${this.base} is a static registry; this needs a registry service (an https URL)`);
    const headers: Record<string, string> = { Accept: "application/json" };
    // The token goes only to the calls that need it (writes, whoami, tokens), never to
    // public reads (docs, package files, the index, search).
    if (extra.auth && this.token) headers.Authorization = `Bearer ${this.token}`;
    else if (extra.auth) throw new RegistryError(`Not logged in to ${this.base}: run \`halo login${this.base === "https://registry.halolang.com/" ? "" : ` --registry ${this.base}`}\`, or set HALO_TOKEN`);
    let payload: Uint8Array<ArrayBuffer> | string | undefined;
    if (body instanceof Uint8Array) {
      payload = body as Uint8Array<ArrayBuffer>;
      headers["Content-Type"] = extra.contentType ?? "application/octet-stream";
    } else if (body !== undefined) {
      payload = JSON.stringify(body);
      headers["Content-Type"] = "application/json";
    }
    return this.fetchFn(this.url(path), { method, headers, body: payload });
  }

  private async fail(res: Response, what: string): Promise<never> {
    let err: Partial<ApiError> = {};
    try {
      err = (await res.json()) as ApiError;
    } catch {
      // Not JSON.
    }
    const detail = err.error ?? res.statusText ?? "";
    const problems = err.problems?.length ? `\n  - ${err.problems.join("\n  - ")}` : "";
    throw new RegistryError(`${what} failed (${res.status}${detail ? `: ${detail}` : ""})${problems}`, res.status, err.code);
  }

  /** A JSON call to the service. 2xx → the parsed body. */
  async call<T>(method: string, path: string, body?: unknown, what = `${method} ${path}`, auth = method !== "GET"): Promise<T> {
    const res = await this.request(method, path, body, { auth });
    if (!res.ok) await this.fail(res, what);
    const text = await res.text();
    return (text ? JSON.parse(text) : {}) as T;
  }

  /** A GET path's bytes (http or folder), or undefined when it isn't there. */
  private async getBytes(path: string): Promise<Uint8Array | undefined> {
    if (this.kind === "folder") {
      const file = join(this.base, path);
      return existsSync(file) ? readFileSync(file) : undefined;
    }
    const res = await this.request("GET", path);
    if (res.status === 404 || res.status === 410) return undefined;
    if (!res.ok) await this.fail(res, `GET ${this.url(path)}`);
    return new Uint8Array(await res.arrayBuffer());
  }

  private async getJson<T>(path: string): Promise<T | undefined> {
    const bytes = await this.getBytes(path);
    if (!bytes) return undefined;
    try {
      return JSON.parse(new TextDecoder().decode(bytes)) as T;
    } catch {
      throw new RegistryError(`${this.kind === "folder" ? join(this.base, path) : this.url(path)} is not JSON`);
    }
  }

  // ── Reading ──

  private legacyIndex?: Promise<LegacyIndex>;
  private async legacy(): Promise<LegacyIndex> {
    this.legacyIndex ??= readSource(this.base, this.fetchFn).then((bytes) => {
      const data = JSON.parse(new TextDecoder().decode(bytes)) as LegacyIndex;
      if (data?.format !== "halo-registry/1" || typeof data.packages !== "object") throw new RegistryError(`${this.base} is not a Halo registry index`);
      return data;
    });
    return this.legacyIndex;
  }

  private legacyFile(file: string): string {
    if (isUrl(file)) return file;
    if (isUrl(this.base)) return new URL(file, this.base).href;
    return resolve(dirname(this.base), file);
  }

  /** A package's doc: every version, dist-tags, the README. Undefined when there's no such package. */
  doc(name: string): Promise<PackageDoc | undefined> {
    let p = this.docs.get(name);
    if (!p) {
      p = this.fetchDoc(name);
      this.docs.set(name, p);
    }
    return p;
  }

  private async fetchDoc(name: string): Promise<PackageDoc | undefined> {
    if (this.kind === "legacy") {
      const reg = await this.legacy();
      // v1 names are bare; the first-party ones are @halo/<name> now.
      const entry = reg.packages[name] ?? (name.startsWith("@halo/") ? reg.packages[name.slice(6)] : undefined);
      if (!entry) return undefined;
      const versions: Record<string, VersionDoc> = {};
      for (const [v, r] of Object.entries(entry.versions)) {
        versions[v] = {
          version: v,
          sha256: r.sha256,
          size: 0,
          file: this.legacyFile(r.file),
          publishedAt: r.publishedAt ?? "",
          dependencies: {},
          exports: { pipelines: [], agents: [], tools: [], stores: [], schemas: [], policies: [], providers: r.providers, skills: [] },
          models: {},
          permissions: { ...r.permissions, hosted: [] },
        };
      }
      return { name, description: entry.description, distTags: { latest: entry.latest }, versions, ...(entry.homepage ? { homepage: entry.homepage } : {}), updatedAt: "" };
    }
    if (!parsePackageName(name)) throw new RegistryError(`"${name}" is not a scoped package name like @acme/support-kit${name.includes("/") ? "" : ` (did you mean @halo/${name}?)`}`);
    return this.getJson<PackageDoc>(packageDocPath(name));
  }

  /** Forget cached docs (after a write). */
  refresh(name?: string) {
    if (name) this.docs.delete(name);
    else this.docs.clear();
  }

  /** Download a version's package file and check it against the doc's sha256 (and `expect`, e.g. halo.lock's). */
  async file(name: string, version: string, options: { expect?: string } = {}): Promise<Uint8Array> {
    const doc = await this.doc(name);
    const v = doc?.versions[version];
    if (!v) {
      if (!options.expect) throw new RegistryError(`${name}@${version} is not in ${this.base}`);
      // Not listed any more: try where it would be, and hold it to the lock's checksum.
    }
    const want = v?.sha256 ?? options.expect!;
    if (options.expect && v && v.sha256 !== options.expect) {
      throw new RegistryError(`${name}@${version}: the registry's checksum (${v.sha256.slice(0, 12)}…) differs from halo.lock's (${options.expect.slice(0, 12)}…). The package changed after it was locked; not installing.`);
    }
    const file = v?.file ?? packageFilePath(name, version);
    let bytes: Uint8Array | undefined;
    if (this.kind === "legacy" || isUrl(file)) bytes = await readSource(this.kind === "legacy" ? this.legacyFile(file) : file, this.fetchFn);
    else bytes = await this.getBytes(file);
    if (!bytes) throw new RegistryError(`${name}@${version}: ${file} is missing from ${this.base}`);
    const got = sha256(bytes);
    if (got !== want) throw new RegistryError(`${name}@${version}: checksum mismatch (expected ${want.slice(0, 12)}…, got ${got.slice(0, 12)}…). The download changed; not installing.`);
    return bytes;
  }

  /** Every package (static registries; the service serves it too). */
  async index(): Promise<PackageSummary[]> {
    if (this.kind === "legacy") {
      const reg = await this.legacy();
      return Object.entries(reg.packages).map(([name, p]) => ({ name, description: p.description, latest: p.latest, updatedAt: "" }));
    }
    return (await this.getJson<PackageSummary[]>(INDEX_PATH)) ?? [];
  }

  /** Downloads and dependents (registry services only). */
  stats(name: string, days?: number): Promise<PackageStats> {
    return this.call<PackageStats>("GET", packageStatsPath(name, days), undefined, `Reading stats for ${name}`, false);
  }

  async search(query = "", options: { limit?: number; offset?: number } = {}): Promise<SearchResponse> {
    if (this.kind === "http") {
      const params = new URLSearchParams({ q: query });
      if (options.limit !== undefined) params.set("limit", String(options.limit));
      if (options.offset !== undefined) params.set("offset", String(options.offset));
      return this.call<SearchResponse>("GET", `${API_PREFIX}/search?${params}`, undefined, "search");
    }
    const q = query.toLowerCase().trim();
    const words = q.split(/\s+/).filter(Boolean);
    const all = await this.index();
    const results = all.filter((p) => words.every((w) => [p.name, p.description, ...(p.keywords ?? [])].some((s) => s.toLowerCase().includes(w)))).sort((a, b) => a.name.localeCompare(b.name));
    const start = options.offset ?? 0;
    return { results: results.slice(start, options.limit !== undefined ? start + options.limit : undefined), total: results.length };
  }

  // ── Writing ──

  /** Publish a package file: PUT to the service, or write the static layout into a folder. */
  async publish(bytes: Uint8Array, options: { publishedBy?: string } = {}): Promise<PublishResponse> {
    const pkg = readPackage(bytes);
    if (!parsePackageName(pkg.name)) throw new RegistryError(`${pkg.name} is a v1 package with a bare name; move it to a halo.json with a scoped name like @you/${pkg.name}`);
    this.refresh(pkg.name);
    if (this.kind === "folder") return publishToFolder(this.base, bytes, pkg, options.publishedBy);
    if (this.kind === "legacy") throw new RegistryError(`${this.base} is a v1 registry index; publish to a folder or a registry service`);
    const res = await this.request("PUT", packageApiPath(pkg.name), bytes, { contentType: PACKAGE_MEDIA_TYPE, auth: true });
    if (!res.ok) await this.fail(res, `Publishing ${pkg.name}@${pkg.version}`);
    return (await res.json()) as PublishResponse;
  }

  async yank(name: string, version: string, reason = ""): Promise<void> {
    this.refresh(name);
    if (this.kind === "folder") return editFolderDoc(this.base, name, (doc) => {
      const v = mustVersion(doc, version);
      v.yanked = reason || "yanked";
    });
    await this.call<YankResponse>("POST", `${packageApiPath(name)}/versions/${version}/yank`, { reason }, `Yanking ${name}@${version}`);
  }

  async unyank(name: string, version: string): Promise<void> {
    this.refresh(name);
    if (this.kind === "folder") return editFolderDoc(this.base, name, (doc) => void delete mustVersion(doc, version).yanked);
    await this.call<YankResponse>("DELETE", `${packageApiPath(name)}/versions/${version}/yank`, undefined, `Unyanking ${name}@${version}`);
  }

  /** Mark every version in `range` deprecated (an empty message clears it). */
  async deprecate(name: string, range: string, message: string): Promise<void> {
    this.refresh(name);
    if (this.kind === "folder") return editFolderDoc(this.base, name, (doc) => {
      const hit = Object.values(doc.versions).filter((v) => satisfies(v.version, range) || satisfiesLoose(v.version, range));
      if (!hit.length) throw new RegistryError(`No version of ${name} matches ${range}`);
      for (const v of hit) {
        if (message) v.deprecated = message;
        else delete v.deprecated;
      }
    });
    await this.call<DeprecateResponse>("POST", `${packageApiPath(name)}/deprecate`, { range, message }, `Deprecating ${name}@${range}`);
  }

  async setDistTag(name: string, tag: string, version: string): Promise<void> {
    this.refresh(name);
    if (this.kind === "folder") return editFolderDoc(this.base, name, (doc) => {
      mustVersion(doc, version);
      doc.distTags[tag] = version;
    });
    await this.call<DistTagsResponse>("PUT", `${packageApiPath(name)}/dist-tags/${encodeURIComponent(tag)}`, { version }, `Tagging ${name}@${version} as ${tag}`);
  }

  async removeDistTag(name: string, tag: string): Promise<void> {
    if (tag === "latest") throw new RegistryError(`"latest" can't be removed; point it at another version with halo dist-tag add`);
    this.refresh(name);
    if (this.kind === "folder") return editFolderDoc(this.base, name, (doc) => {
      if (!doc.distTags[tag]) throw new RegistryError(`${name} has no "${tag}" tag`);
      delete doc.distTags[tag];
    });
    await this.call<DistTagsResponse>("DELETE", `${packageApiPath(name)}/dist-tags/${encodeURIComponent(tag)}`, undefined, `Removing ${name}'s ${tag} tag`);
  }

  // ── Accounts (the service only) ──

  deviceStart(): Promise<DeviceStart> {
    return this.call<DeviceStart>("POST", `${API_PREFIX}/auth/device`, {}, "Starting login", false);
  }

  /** One poll: the token, or why not yet. */
  async deviceToken(deviceCode: string): Promise<{ token?: TokenResponse; wait?: "pending" | "slow_down"; expired?: boolean }> {
    const res = await this.request("POST", `${API_PREFIX}/auth/device/token`, { device_code: deviceCode });
    if (res.status === 428) return { wait: "pending" };
    if (res.status === 429) return { wait: "slow_down" };
    if (res.status === 410) return { expired: true };
    if (!res.ok) await this.fail(res, "Login");
    return { token: (await res.json()) as TokenResponse };
  }

  whoami(): Promise<WhoAmI> {
    return this.call<WhoAmI>("GET", `${API_PREFIX}/whoami`, undefined, "whoami", true);
  }

  async listTokens(): Promise<TokenInfo[]> {
    const body = await this.call<TokenList>("GET", `${API_PREFIX}/tokens`, undefined, "Listing tokens", true);
    return body.tokens ?? [];
  }

  createToken(options: CreateTokenRequest): Promise<CreatedToken> {
    return this.call("POST", `${API_PREFIX}/tokens`, options, "Creating a token");
  }

  async revokeToken(id: string): Promise<void> {
    await this.call("DELETE", `${API_PREFIX}/tokens/${encodeURIComponent(id)}`, undefined, `Revoking token ${id}`);
  }

  async createScope(scope: string): Promise<void> {
    await this.call("POST", `${API_PREFIX}/scopes`, { scope }, `Creating ${scope}`);
  }

  scope(scope: string): Promise<ScopeDoc> {
    return this.call<ScopeDoc>("GET", `${API_PREFIX}/scopes/${scope}`, undefined, `Reading ${scope}`, false);
  }

  async setMember(scope: string, login: string, role: ScopeRole): Promise<void> {
    await this.call("PUT", `${API_PREFIX}/scopes/${scope}/members/${encodeURIComponent(login)}`, { role }, `Adding ${login} to ${scope}`);
  }

  async removeMember(scope: string, login: string): Promise<void> {
    await this.call("DELETE", `${API_PREFIX}/scopes/${scope}/members/${encodeURIComponent(login)}`, undefined, `Removing ${login} from ${scope}`);
  }

  verifyScope(scope: string, domain: string): Promise<VerifyResponse> {
    return this.call("POST", `${API_PREFIX}/scopes/${scope}/verify`, { domain }, `Verifying ${scope}`);
  }
}

/** A deprecate range also catches prereleases of the versions it covers. */
function satisfiesLoose(version: string, range: string): boolean {
  return satisfies(version.replace(/-.*$/, ""), range);
}

function mustVersion(doc: PackageDoc, version: string): VersionDoc {
  const v = doc.versions[version];
  if (!v) throw new RegistryError(`${doc.name} has no version ${version} (versions: ${sortDescending(Object.keys(doc.versions)).join(", ")})`);
  return v;
}

// ── Static registry folders ──

function readJson<T>(path: string): T | undefined {
  return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as T) : undefined;
}

function writeJson(path: string, data: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
}

/** The latest stable version, or the highest prerelease when there's no stable one. Yanked versions only as a last resort. */
function pickLatest(doc: PackageDoc): string {
  const all = sortDescending(Object.keys(doc.versions));
  const live = all.filter((v) => !doc.versions[v]!.yanked);
  return live.find((v) => !isPrerelease(v)) ?? live[0] ?? all[0]!;
}

function summaryOf(doc: PackageDoc): PackageSummary {
  return { name: doc.name, description: doc.description, latest: doc.distTags.latest, ...(doc.keywords?.length ? { keywords: doc.keywords } : {}), ...(doc.verified ? { verified: doc.verified } : {}), updatedAt: doc.updatedAt };
}

function writeIndex(base: string, doc: PackageDoc) {
  const path = join(base, INDEX_PATH);
  const index = (readJson<PackageSummary[]>(path) ?? []).filter((p) => p.name !== doc.name);
  index.push(summaryOf(doc));
  index.sort((a, b) => a.name.localeCompare(b.name));
  writeJson(path, index);
}

/** The version doc a registry stores for a package file. */
export function versionDocOf(pkg: PackageData, bytes: Uint8Array, publishedBy?: string): VersionDoc {
  const m = pkg.manifest;
  return {
    version: pkg.version,
    sha256: sha256(bytes),
    size: bytes.length,
    file: packageFilePath(pkg.name, pkg.version),
    publishedAt: new Date().toISOString(),
    ...(publishedBy ? { publishedBy } : {}),
    dependencies: m.dependencies ?? {},
    ...(m.halo ? { halo: m.halo } : {}),
    exports: exportsOf(pkg),
    models: m.models ?? {},
    permissions: permissionsOfPackage(pkg),
    ...(m.hosted ? { hosted: { endpoint: m.hosted.endpoint, pipelines: m.hosted.exports } } : {}),
  };
}

function publishToFolder(base: string, bytes: Uint8Array, pkg: PackageData, publishedBy?: string): PublishResponse {
  const m = pkg.manifest;
  const docPath = join(base, packageDocPath(pkg.name));
  const existing = readJson<PackageDoc>(docPath);
  // By precedence, not by spelling: an older doc may hold "v1.0.0" or "1.0.0+x" for 1.0.0.
  const same = Object.keys(existing?.versions ?? {}).find((v) => v === pkg.version || (isValidVersion(v) && compare(v, pkg.version) === 0));
  if (same) throw new RegistryError(`${pkg.name}@${pkg.version} is already published${same === pkg.version ? "" : ` (as ${same})`}; bump the version`);
  const filePath = join(base, packageFilePath(pkg.name, pkg.version));
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, bytes);
  const version = versionDocOf(pkg, bytes, publishedBy);
  const doc: PackageDoc = existing ?? { name: pkg.name, description: m.description, distTags: { latest: pkg.version }, versions: {}, updatedAt: version.publishedAt };
  doc.versions[pkg.version] = version;
  const latest = pickLatest(doc);
  doc.distTags.latest = latest;
  // The package's metadata and README follow its latest version.
  if (latest === pkg.version) {
    doc.description = m.description;
    for (const key of ["keywords", "license", "repository", "homepage"] as const) {
      if (m[key] !== undefined) (doc as unknown as Record<string, unknown>)[key] = m[key];
      else delete doc[key];
    }
    const readme = fileText(pkg, README_FILE);
    if (readme !== undefined) doc.readme = readme;
  }
  doc.updatedAt = version.publishedAt;
  writeJson(docPath, doc);
  writeIndex(base, doc);
  return { name: pkg.name, version: pkg.version, sha256: version.sha256, url: version.file };
}

function editFolderDoc(base: string, name: string, edit: (doc: PackageDoc) => void) {
  const path = join(base, packageDocPath(name));
  const doc = readJson<PackageDoc>(path);
  if (!doc) throw new RegistryError(`No package ${name} in ${base}`);
  edit(doc);
  // A moved latest tag stays where it was put; otherwise latest skips yanked versions.
  if (doc.versions[doc.distTags.latest]?.yanked) doc.distTags.latest = pickLatest(doc);
  doc.updatedAt = new Date().toISOString();
  writeJson(path, doc);
  writeIndex(base, doc);
}

/** The highest version first, for display. */
export const versionsOf = (doc: PackageDoc) => sortDescending(Object.keys(doc.versions));
export { compare };
