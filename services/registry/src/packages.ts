/** Packages: reading docs, the index and search, downloads, publishing, yank, deprecate and dist-tags. */

import {
  checkPackageManifest,
  ManifestError,
  MAX_PACKAGE_BYTES,
  MAX_PACKAGE_WIRE_BYTES,
  MAX_README_BYTES,
  PACK_EXCLUDE,
  PACKAGE_FORMAT_V2,
  PACKAGE_MEDIA_TYPE,
  packageFilePath,
  parsePackageName,
  PROJECT_FILE,
  README_FILE,
  type HostedPipelineInterface,
  type HostedSpec,
  type DeprecateResponse,
  type DistTagsResponse,
  type ModelSlot,
  type PackageDoc,
  type PackageExports,
  type PackageFileV2,
  type PackageManifest,
  type PackagePermissions,
  type PackageSummary,
  type PublishResponse,
  type SearchResponse,
  type VersionDoc,
  type YankResponse,
} from "../../../src/registry/contract.ts";
import { checkPackageFiles, type ExportAnalyzer } from "../../../src/registry/check.ts";
import { safeRelative } from "../../../src/registry/manifest.ts";
import { compare, isPrerelease, isValidRange, isValidVersion, maxSatisfying, satisfies, sortDescending } from "../../../src/registry/semver.ts";
import { requireRole, type Caller } from "./auth.ts";
import { hostedEndpointProblem } from "./endpoints.ts";
import { recheckDomainLater } from "./scopes.ts";
import { allowLocalHostedEndpoints, type Ctx, type Env } from "./env.ts";
import { cached, CORS_HEADERS, fail, fromBase64, json, now, purge, rateLimit, readCapped, readJson, sha256Hex } from "./http.ts";

/**
 * R2 key of a package file: content-addressed under its version, written once, never
 * overwritten. Two publishes of one version that race write different keys (or the same
 * bytes to the same key), so the loser of the D1 insert can never replace the winner's file.
 * Downloads find the key through the sha256 D1 recorded.
 */
export const fileKey = (name: string, version: string, sha256: string) => `files/${name}/${version}/${sha256}.halotool`;

const TAG = /^[a-z][a-z0-9._-]{0,63}$/;

// ── Reading ──

interface PackageRow {
  id: number;
  name: string;
  description: string;
  keywords: string;
  license: string | null;
  repository: string | null;
  homepage: string | null;
  updated_at: string;
  verified_domain: string | null;
}

interface VersionRow {
  version: string;
  manifest: string;
  readme: string;
  exports: string;
  permissions: string;
  models: string;
  dependencies: string;
  halo: string | null;
  sha256: string;
  size: number;
  published_by: string | null;
  published_at: string;
  yanked: string | null;
  deprecated: string | null;
  hosted: string | null;
}

interface HostedRow {
  endpoint: string;
  auth?: HostedSpec["auth"];
  pipelines: string[];
  interfaces: Record<string, HostedPipelineInterface>;
}

async function packageRow(env: Env, name: string): Promise<PackageRow | null> {
  return env.DB.prepare(
    `SELECT p.id, p.name, p.description, p.keywords, p.license, p.repository, p.homepage, p.updated_at, s.verified_domain
     FROM packages p JOIN scopes s ON s.id = p.scope_id WHERE p.name = ?`,
  )
    .bind(name)
    .first<PackageRow>();
}

export interface PackageView {
  doc: PackageDoc;
  /** Raw version rows' extras the pages want. */
  hosted: Record<string, HostedRow | undefined>;
  /** Each version's README (the doc carries only the latest's). */
  readmes: Record<string, string>;
  downloads: number;
  scopeKind: "user" | "org";
}

export async function loadPackage(env: Env, name: string): Promise<PackageView | undefined> {
  const pkg = await packageRow(env, name);
  if (!pkg) return undefined;
  const [versions, tags, downloads, scope] = await Promise.all([
    env.DB.prepare(
      `SELECT v.version, v.manifest, v.readme, v.exports, v.permissions, v.models, v.dependencies, v.halo, v.sha256, v.size,
              u.login AS published_by, v.published_at, v.yanked, v.deprecated, v.hosted
       FROM versions v LEFT JOIN users u ON u.id = v.published_by WHERE v.package_id = ?`,
    )
      .bind(pkg.id)
      .all<VersionRow>(),
    env.DB.prepare(`SELECT tag, version FROM dist_tags WHERE package_id = ?`).bind(pkg.id).all<{ tag: string; version: string }>(),
    env.DB.prepare(`SELECT COALESCE(SUM(count), 0) AS n FROM downloads_daily WHERE package_id = ?`).bind(pkg.id).first<{ n: number }>(),
    env.DB.prepare(`SELECT s.kind FROM scopes s JOIN packages p ON p.scope_id = s.id WHERE p.id = ?`).bind(pkg.id).first<{ kind: "user" | "org" }>(),
  ]);
  const distTags = Object.fromEntries(tags.results.map((t) => [t.tag, t.version])) as PackageDoc["distTags"];
  const out: Record<string, VersionDoc> = {};
  const hosted: Record<string, HostedRow | undefined> = {};
  for (const v of sortDescending(versions.results.map((r) => r.version))) {
    const r = versions.results.find((x) => x.version === v)!;
    const h = r.hosted ? (JSON.parse(r.hosted) as HostedRow) : undefined;
    hosted[v] = h;
    out[v] = {
      version: v,
      sha256: r.sha256,
      size: r.size,
      file: packageFilePath(name, v),
      publishedAt: r.published_at,
      ...(r.published_by ? { publishedBy: r.published_by } : {}),
      ...(r.yanked !== null ? { yanked: r.yanked } : {}),
      ...(r.deprecated !== null ? { deprecated: r.deprecated } : {}),
      dependencies: JSON.parse(r.dependencies) as Record<string, string>,
      ...(r.halo ? { halo: r.halo } : {}),
      exports: JSON.parse(r.exports) as PackageExports,
      models: JSON.parse(r.models) as Record<string, ModelSlot>,
      permissions: JSON.parse(r.permissions) as PackagePermissions,
      ...(h ? { hosted: { endpoint: h.endpoint, pipelines: h.pipelines } } : {}),
    };
  }
  const latestRow = versions.results.find((r) => r.version === distTags.latest);
  const keywords = JSON.parse(pkg.keywords) as string[];
  const doc: PackageDoc = {
    name: pkg.name,
    description: pkg.description,
    distTags,
    versions: out,
    ...(keywords.length ? { keywords } : {}),
    ...(pkg.license ? { license: pkg.license } : {}),
    ...(pkg.repository ? { repository: pkg.repository } : {}),
    ...(pkg.homepage ? { homepage: pkg.homepage } : {}),
    ...(latestRow ? { readme: latestRow.readme } : {}),
    ...(pkg.verified_domain ? { verified: pkg.verified_domain } : {}),
    updatedAt: pkg.updated_at,
  };
  const readmes = Object.fromEntries(versions.results.map((r) => [r.version, r.readme]));
  return { doc, hosted, readmes, downloads: downloads?.n ?? 0, scopeKind: scope?.kind ?? "user" };
}

/**
 * What a package's cached doc and pages are keyed by: its revision and its scope's verified
 * domain (one indexed read). Also schedules the scope's domain re-check when it's due.
 * Undefined when there's no such package.
 */
export async function packageRevision(env: Env, name: string, ctx?: Ctx): Promise<string | undefined> {
  const row = await env.DB.prepare(
    `SELECT p.revision, s.id, s.verified_domain, s.verified_at FROM packages p JOIN scopes s ON s.id = p.scope_id WHERE p.name = ?`,
  )
    .bind(name)
    .first<{ revision: number; id: number; verified_domain: string | null; verified_at: string | null }>();
  if (!row) return undefined;
  if (ctx) recheckDomainLater(env, ctx, row);
  return `${row.revision}.${row.verified_domain ?? ""}`;
}

export async function getDoc(env: Env, name: string, ctx?: Ctx): Promise<Response> {
  const revision = await packageRevision(env, name, ctx);
  if (revision === undefined) return fail(404, "not_found", `No package ${name}`);
  return cached(
    env,
    `v1/packages/${name}.json`,
    async () => {
      const view = await loadPackage(env, name);
      if (!view) return fail(404, "not_found", `No package ${name}`);
      return json(view.doc);
    },
    { revision },
  );
}

interface SummaryRow {
  id: number;
  name: string;
  description: string;
  keywords: string;
  updated_at: string;
  verified_domain: string | null;
  latest: string | null;
  downloads: number;
}

const SUMMARY_SELECT = `SELECT p.id, p.name, p.description, p.keywords, p.updated_at, s.verified_domain,
  (SELECT version FROM dist_tags d WHERE d.package_id = p.id AND d.tag = 'latest') AS latest,
  (SELECT COALESCE(SUM(count), 0) FROM downloads_daily dl WHERE dl.package_id = p.id) AS downloads
  FROM packages p JOIN scopes s ON s.id = p.scope_id`;

function toSummary(r: SummaryRow): PackageSummary {
  const keywords = JSON.parse(r.keywords) as string[];
  return {
    name: r.name,
    description: r.description,
    latest: r.latest ?? "",
    ...(keywords.length ? { keywords } : {}),
    ...(r.verified_domain ? { verified: r.verified_domain } : {}),
    downloads: r.downloads,
    updatedAt: r.updated_at,
  };
}

export async function getIndex(env: Env): Promise<Response> {
  return cached(env, "v1/index.json", async () => {
    const { results } = await env.DB.prepare(`${SUMMARY_SELECT} ORDER BY p.name`).all<SummaryRow>();
    return json(results.map(toSummary));
  });
}

export async function recentPackages(env: Env, limit = 20): Promise<PackageSummary[]> {
  const { results } = await env.DB.prepare(`${SUMMARY_SELECT} ORDER BY p.updated_at DESC LIMIT ?`).bind(limit).all<SummaryRow>();
  return results.map(toSummary);
}

/** FTS5 query from free text: every word must match (as a prefix), so "zen desk" finds "zendesk-desk". */
function ftsQuery(q: string): string | undefined {
  const words = q.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  if (!words.length) return undefined;
  return words.slice(0, 10).map((w) => `"${w}"*`).join(" ");
}

export async function searchPackages(env: Env, q: string, limit: number, offset: number): Promise<SearchResponse> {
  const match = ftsQuery(q);
  if (!match) {
    const [rows, total] = await Promise.all([
      env.DB.prepare(`${SUMMARY_SELECT} ORDER BY downloads DESC, p.updated_at DESC LIMIT ? OFFSET ?`).bind(limit, offset).all<SummaryRow>(),
      env.DB.prepare(`SELECT COUNT(*) AS n FROM packages`).first<{ n: number }>(),
    ]);
    return { results: rows.results.map(toSummary), total: total?.n ?? 0 };
  }
  const exact = q.trim().toLowerCase();
  // bm25 weights: name, description, keywords, readme. Lower is better. An exact name wins.
  const [rows, total] = await Promise.all([
    env.DB.prepare(
      `WITH hits AS (SELECT rowid AS id, bm25(packages_fts, 10.0, 4.0, 6.0, 1.0) AS rank FROM packages_fts WHERE packages_fts MATCH ?)
       SELECT * FROM (${SUMMARY_SELECT}) AS s JOIN hits h ON h.id = s.id
       ORDER BY (s.name = ? OR s.name = '@' || ?) DESC, h.rank, s.downloads DESC LIMIT ? OFFSET ?`,
    )
      .bind(match, exact, exact, limit, offset)
      .all<SummaryRow>(),
    env.DB.prepare(`SELECT COUNT(*) AS n FROM packages_fts WHERE packages_fts MATCH ?`).bind(match).first<{ n: number }>(),
  ]);
  return { results: rows.results.map(toSummary), total: total?.n ?? 0 };
}

export async function search(url: URL, env: Env): Promise<Response> {
  const q = url.searchParams.get("q") ?? "";
  const limit = clampInt(url.searchParams.get("limit"), 20, 1, 100);
  const offset = clampInt(url.searchParams.get("offset"), 0, 0, 10_000);
  return json(await searchPackages(env, q, limit, offset));
}

function clampInt(text: string | null, fallback: number, min: number, max: number): number {
  const n = text === null || text === "" ? NaN : Number(text);
  return Number.isInteger(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

export async function getFile(req: Request, env: Env, ctx: Ctx, name: string, version: string): Promise<Response> {
  const row = await env.DB.prepare(`SELECT v.sha256 FROM versions v JOIN packages p ON p.id = v.package_id WHERE p.name = ? AND v.version = ?`)
    .bind(name, version)
    .first<{ sha256: string }>();
  const obj = row ? await env.PACKAGES.get(fileKey(name, version, row.sha256)) : null;
  if (!obj) return fail(404, "not_found", `No file for ${name}@${version}`);
  const sha = obj.customMetadata?.sha256;
  const etag = sha ? `"${sha}"` : obj.httpEtag;
  const headers: Record<string, string> = {
    ...CORS_HEADERS,
    "content-type": PACKAGE_MEDIA_TYPE,
    "cache-control": "public, max-age=31536000, immutable",
    etag,
    ...(sha ? { "x-halo-sha256": sha } : {}),
  };
  if (req.headers.get("if-none-match") === etag) {
    await obj.body.cancel();
    return new Response(null, { status: 304, headers });
  }
  if (req.method === "HEAD") {
    await obj.body.cancel();
    return new Response(null, { status: 200, headers: { ...headers, "content-length": String(obj.size) } });
  }
  ctx.waitUntil(countDownload(env, name, version));
  return new Response(obj.body, { status: 200, headers: { ...headers, "content-length": String(obj.size) } });
}

async function countDownload(env: Env, name: string, version: string): Promise<void> {
  try {
    await env.DB.prepare(
      `INSERT INTO downloads_daily (package_id, version, day, count) SELECT id, ?, ?, 1 FROM packages WHERE name = ?
       ON CONFLICT(package_id, version, day) DO UPDATE SET count = count + 1`,
    )
      .bind(version, new Date().toISOString().slice(0, 10), name)
      .run();
  } catch (e) {
    console.error(JSON.stringify({ message: "download count failed", name, version, error: String(e) }));
  }
}

// ── After a write ──

/**
 * Call after every write that changes what a package's doc or pages show. Bumps its revision,
 * so its docs and pages get new cache keys in every colo, then purges this colo's cache: the
 * index, the home page, and the package's entries under the revision it just left. The bump
 * comes after the write (never before), so nothing older than the write is ever cached under
 * the new revision.
 */
export async function purgePackage(env: Env, name: string): Promise<void> {
  const pkg = await env.DB.prepare(
    `UPDATE packages SET revision = revision + 1 WHERE name = ?
     RETURNING id, revision - 1 AS previous, (SELECT verified_domain FROM scopes s WHERE s.id = packages.scope_id) AS verified_domain`,
  )
    .bind(name)
    .first<{ id: number; previous: number; verified_domain: string | null }>();
  const paths = [`v1/packages/${name}.json`, name];
  if (pkg) {
    const { results } = await env.DB.prepare(`SELECT version FROM versions WHERE package_id = ?`).bind(pkg.id).all<{ version: string }>();
    paths.push(...results.map((v) => `${name}/v/${v.version}`));
  }
  const previous = pkg ? `${pkg.previous}.${pkg.verified_domain ?? ""}` : undefined;
  await Promise.all([purge(env, ["", "v1/index.json"]), purge(env, paths), ...(previous !== undefined ? [purge(env, paths, previous)] : [])]);
}

// ── Publishing ──

function problemsOf(e: ManifestError): string[] {
  return e.message
    .split("\n")
    .slice(1)
    .map((l) => l.replace(/^\s*-\s*/, ""))
    .filter(Boolean);
}

export async function publish(req: Request, env: Env, caller: Caller, name: string, analyze?: ExportAnalyzer): Promise<Response> {
  const parsed = parsePackageName(name)!;
  const scope = await requireRole(env, caller, parsed.scope, "publisher");
  await rateLimit(env, "publish", String(caller.userId));

  const type = (req.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
  if (type !== PACKAGE_MEDIA_TYPE) return fail(415, "unsupported_media_type", `Send the package file with Content-Type: ${PACKAGE_MEDIA_TYPE}`);
  const bytes = await readCapped(req, MAX_PACKAGE_WIRE_BYTES);

  let pkg: PackageFileV2;
  try {
    pkg = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as PackageFileV2;
  } catch {
    return fail(400, "invalid_package", "The body is not a Halo package file (not JSON)");
  }
  if (!pkg || typeof pkg !== "object") return fail(400, "invalid_package", "The body is not a Halo package file");
  const format = (pkg as { format?: unknown }).format;
  if (format === "halo-tool/1") return fail(400, "unsupported_format", `This is a v1 tool package (halo-tool/1). Move halo-tool.json into a v2 ${PROJECT_FILE} and pack it again`);
  if (format !== PACKAGE_FORMAT_V2) return fail(400, "invalid_package", `Not a Halo package file (format must be ${PACKAGE_FORMAT_V2})`);
  if (!pkg.files || typeof pkg.files !== "object" || Array.isArray(pkg.files)) return fail(400, "invalid_package", "The package file has no files");

  // Paths and contents.
  const pathProblems: string[] = [];
  const raw: Record<string, Uint8Array> = {};
  for (const [path, b64] of Object.entries(pkg.files)) {
    if (!safeRelative(path)) pathProblems.push(`unsafe file path: ${JSON.stringify(path)} (paths are relative, with no "..", backslashes or drive letters)`);
    else if (PACK_EXCLUDE.some((re) => re.test(path))) pathProblems.push(`${path} must not be published (local state or secrets)`);
    const data = fromBase64(b64);
    if (!data) pathProblems.push(`${path} is not base64`);
    else raw[path] = data;
  }
  if (pathProblems.length) return fail(400, "invalid_package", "The package has bad files", pathProblems);
  const rawTotal = Object.values(raw).reduce((n, d) => n + d.byteLength, 0);
  if (rawTotal > MAX_PACKAGE_BYTES) return fail(413, "too_large", `The package's files come to ${rawTotal} bytes, over ${MAX_PACKAGE_BYTES / 1024 / 1024}MB`);
  const text: Record<string, string> = {};
  const decoder = new TextDecoder();
  for (const [path, data] of Object.entries(raw)) text[path] = decoder.decode(data);

  // The manifest that counts is the halo.json in the files: it's what gets installed.
  if (text[PROJECT_FILE] === undefined) return fail(400, "invalid_manifest", `The package has no ${PROJECT_FILE}`, [`${PROJECT_FILE} is missing`]);
  let rawManifest: unknown;
  try {
    rawManifest = JSON.parse(text[PROJECT_FILE]!);
  } catch {
    return fail(400, "invalid_manifest", `${PROJECT_FILE} is not valid JSON`, [`${PROJECT_FILE} is not valid JSON`]);
  }
  let manifest: PackageManifest;
  try {
    manifest = checkPackageManifest(rawManifest, { files: Object.keys(raw) });
  } catch (e) {
    if (e instanceof ManifestError) return fail(400, "invalid_manifest", e.message.split("\n")[0]!, problemsOf(e).length ? problemsOf(e) : [e.message]);
    throw e;
  }
  if (manifest.name !== name) return fail(400, "name_mismatch", `${PROJECT_FILE} names ${manifest.name}, but this is the URL for ${name}`);
  const version = manifest.version;
  if (raw[README_FILE]!.byteLength > MAX_README_BYTES) return fail(400, "readme_too_large", `${README_FILE} is over ${MAX_README_BYTES / 1024}KB`);

  // The same check `halo publish` runs (src/registry/check.ts): the linker's analysis of the
  // .halo files (syntax, hard-coded models, model slots, exported names, uses), the README,
  // hosted interfaces; and the exports and permissions, computed here, never trusted from the client.
  const hosted = manifest.hosted;
  const check = checkPackageFiles(text, manifest, { hosted: pkg.hosted, analyze });
  if (check.problems.length) return fail(400, "invalid_package", "The package has problems", check.problems);
  // The shared check allows http://localhost for local development; the public registry wants
  // a public https host (src/endpoints.ts), unless this is a local registry.
  const endpointProblem = hosted && !allowLocalHostedEndpoints(env) ? hostedEndpointProblem(hosted.endpoint) : undefined;
  if (endpointProblem) return fail(400, "invalid_package", "The package has problems", [endpointProblem]);

  // The version must be new, and every dependency must exist here.
  const pkgRow = await env.DB.prepare(`SELECT id FROM packages WHERE name = ?`).bind(name).first<{ id: number }>();
  if (pkgRow) {
    const existing = await env.DB.prepare(`SELECT 1 AS y FROM versions WHERE package_id = ? AND version = ?`).bind(pkgRow.id, version).first();
    if (existing) return fail(409, "version_exists", `${name}@${version} is already published; versions can't be replaced. Bump the version`);
  }
  const missing: string[] = [];
  for (const [dep, range] of Object.entries(manifest.dependencies ?? {})) {
    const { results } = await env.DB.prepare(`SELECT v.version FROM versions v JOIN packages p ON p.id = v.package_id WHERE p.name = ? AND v.yanked IS NULL`)
      .bind(dep)
      .all<{ version: string }>();
    if (!results.length) missing.push(`${dep}: not in this registry`);
    else if (!maxSatisfying(results.map((r) => r.version), range)) missing.push(`${dep}: no version matches ${range} (have ${sortDescending(results.map((r) => r.version)).slice(0, 5).join(", ")})`);
  }
  if (missing.length) return fail(400, "missing_dependencies", "Some dependencies can't be resolved in this registry", missing);

  const exportsDoc: PackageExports = check.exports;
  const permissions: PackagePermissions = check.permissions;
  const hostedRow: HostedRow | undefined = hosted
    ? { endpoint: hosted.endpoint, ...(hosted.auth ? { auth: hosted.auth } : {}), pipelines: hosted.exports, interfaces: Object.fromEntries(hosted.exports.map((p) => [p, pkg.hosted![p]!])) }
    : undefined;

  // Does it become `latest`? Not a prerelease, nor lower than the current latest.
  const current = pkgRow ? await env.DB.prepare(`SELECT version FROM dist_tags WHERE package_id = ? AND tag = 'latest'`).bind(pkgRow.id).first<{ version: string }>() : null;
  const cur = current?.version;
  const becomesLatest = !cur || (!isPrerelease(version) && (isPrerelease(cur) || compare(version, cur) > 0));

  // The file goes in first, at a key no other publish of different bytes can write (fileKey),
  // and becomes reachable only once the D1 insert below records its sha256.
  const sha256 = await sha256Hex(bytes);
  const key = fileKey(name, version, sha256);
  await env.PACKAGES.put(key, bytes, { httpMetadata: { contentType: PACKAGE_MEDIA_TYPE }, customMetadata: { sha256, version, publishedBy: caller.login } });

  const at = now();
  const readme = text[README_FILE]!;
  const keywords = JSON.stringify(manifest.keywords ?? []);
  const db = env.DB;
  const statements = [
    becomesLatest
      ? db
          .prepare(
            `INSERT INTO packages (scope_id, name, description, keywords, license, repository, homepage, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(name) DO UPDATE SET description = excluded.description, keywords = excluded.keywords, license = excluded.license,
               repository = excluded.repository, homepage = excluded.homepage, updated_at = excluded.updated_at`,
          )
          .bind(scope.id, name, manifest.description, keywords, manifest.license ?? null, manifest.repository ?? null, manifest.homepage ?? null, at, at)
      : db.prepare(`UPDATE packages SET updated_at = ? WHERE name = ?`).bind(at, name),
    db
      .prepare(
        `INSERT INTO versions (package_id, version, manifest, readme, exports, permissions, models, dependencies, halo, sha256, size, published_by, published_at, hosted)
         VALUES ((SELECT id FROM packages WHERE name = ?), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        name,
        version,
        JSON.stringify(manifest),
        readme,
        JSON.stringify(exportsDoc),
        JSON.stringify(permissions),
        JSON.stringify(manifest.models ?? {}),
        JSON.stringify(manifest.dependencies ?? {}),
        manifest.halo ?? null,
        sha256,
        bytes.byteLength,
        caller.userId,
        at,
        hostedRow ? JSON.stringify(hostedRow) : null,
      ),
  ];
  if (becomesLatest) {
    statements.push(
      db
        .prepare(`INSERT INTO dist_tags (package_id, tag, version) VALUES ((SELECT id FROM packages WHERE name = ?), 'latest', ?) ON CONFLICT(package_id, tag) DO UPDATE SET version = excluded.version`)
        .bind(name, version),
      db.prepare(`DELETE FROM packages_fts WHERE rowid = (SELECT id FROM packages WHERE name = ?)`).bind(name),
      db
        .prepare(`INSERT INTO packages_fts (rowid, name, description, keywords, readme) VALUES ((SELECT id FROM packages WHERE name = ?), ?, ?, ?, ?)`)
        .bind(name, name.replace(/[@/]/g, " "), manifest.description, (manifest.keywords ?? []).join(" "), readme),
    );
  }
  try {
    await db.batch(statements);
  } catch (e) {
    // Lost (or failed) the insert: drop our file unless the winner published the same bytes.
    const winner = await db
      .prepare(`SELECT v.sha256 FROM versions v JOIN packages p ON p.id = v.package_id WHERE p.name = ? AND v.version = ?`)
      .bind(name, version)
      .first<{ sha256: string }>()
      .catch(() => null);
    if (winner?.sha256 !== sha256) await env.PACKAGES.delete(key).catch(() => undefined);
    // Two publishes of one version raced; the unique (package, version) let only one in.
    if (/UNIQUE/i.test(String(e))) return fail(409, "version_exists", `${name}@${version} is already published`);
    throw e;
  }
  await purgePackage(env, name);
  const body: PublishResponse = { name, version, sha256, url: `${env.PUBLIC_URL.replace(/\/+$/, "")}/${name}/v/${version}` };
  return json(body, 201);
}

// ── Yank, deprecate, dist-tags ──

async function versionsOf(env: Env, packageId: number): Promise<{ version: string; yanked: string | null }[]> {
  return (await env.DB.prepare(`SELECT version, yanked FROM versions WHERE package_id = ?`).bind(packageId).all<{ version: string; yanked: string | null }>()).results;
}

async function ownedPackage(env: Env, caller: Caller, name: string): Promise<{ id: number }> {
  await requireRole(env, caller, parsePackageName(name)!.scope, "publisher");
  const pkg = await env.DB.prepare(`SELECT id FROM packages WHERE name = ?`).bind(name).first<{ id: number }>();
  if (!pkg) return fail(404, "not_found", `No package ${name}`);
  return pkg;
}

/** The best `latest`: the highest stable unyanked version, else the highest unyanked one. */
function bestLatest(versions: { version: string; yanked: string | null }[]): string | undefined {
  const live = versions.filter((v) => v.yanked === null).map((v) => v.version);
  return sortDescending(live.filter((v) => !isPrerelease(v)))[0] ?? sortDescending(live)[0];
}

export async function yank(req: Request, env: Env, caller: Caller, name: string, version: string, on: boolean): Promise<Response> {
  const pkg = await ownedPackage(env, caller, name);
  const body = on ? await readJson(req) : {};
  const reason = typeof body.reason === "string" && body.reason.trim() ? body.reason.trim().slice(0, 500) : "No reason given";
  const res = await env.DB.prepare(`UPDATE versions SET yanked = ? WHERE package_id = ? AND version = ?`)
    .bind(on ? reason : null, pkg.id, version)
    .run();
  if (!res.meta.changes) return fail(404, "not_found", `No version ${name}@${version}`);
  // Keep `latest` pointing at something installable.
  const versions = await versionsOf(env, pkg.id);
  const latest = (await env.DB.prepare(`SELECT version FROM dist_tags WHERE package_id = ? AND tag = 'latest'`).bind(pkg.id).first<{ version: string }>())?.version;
  const best = bestLatest(versions);
  const latestDead = !latest || versions.find((v) => v.version === latest)?.yanked !== null;
  const unyankedBetter = !on && best === version && latest !== version && (latestDead || isPrerelease(latest!) || compare(version, latest!) > 0);
  if (best && ((on && latest === version) || unyankedBetter)) await setTag(env, pkg.id, name, "latest", best);
  await env.DB.prepare(`UPDATE packages SET updated_at = ? WHERE id = ?`).bind(now(), pkg.id).run();
  await purgePackage(env, name);
  const out: YankResponse = { name, version, yanked: on ? reason : null };
  return json(out);
}

export async function deprecate(req: Request, env: Env, caller: Caller, name: string): Promise<Response> {
  const pkg = await ownedPackage(env, caller, name);
  const { range, message } = await readJson(req);
  if (typeof range !== "string" || !isValidRange(range)) return fail(400, "bad_request", `range must be a version range, like "<2.0.0"`);
  if (message !== undefined && typeof message !== "string") return fail(400, "bad_request", "message must be a string (empty clears)");
  const text = typeof message === "string" && message.trim() ? message.trim().slice(0, 1000) : null;
  const matched = (await versionsOf(env, pkg.id)).map((v) => v.version).filter((v) => satisfies(v, range) || (isPrerelease(v) && satisfiesIgnoringPrerelease(v, range)));
  if (!matched.length) return fail(404, "no_matching_versions", `No version of ${name} matches ${range}`);
  await env.DB.batch(matched.map((v) => env.DB.prepare(`UPDATE versions SET deprecated = ? WHERE package_id = ? AND version = ?`).bind(text, pkg.id, v)));
  await purgePackage(env, name);
  const out: DeprecateResponse = { name, versions: sortDescending(matched), deprecated: text };
  return json(out);
}

/** A prerelease matches a deprecation range by its release version too (`<2.0.0` covers 1.5.0-beta). */
function satisfiesIgnoringPrerelease(v: string, range: string): boolean {
  return satisfies(v.replace(/[-+].*$/, ""), range);
}

async function setTag(env: Env, packageId: number, name: string, tag: string, version: string): Promise<void> {
  const statements = [
    env.DB.prepare(`INSERT INTO dist_tags (package_id, tag, version) VALUES (?, ?, ?) ON CONFLICT(package_id, tag) DO UPDATE SET version = excluded.version`).bind(packageId, tag, version),
  ];
  if (tag === "latest") {
    // The package's description and search entry follow `latest`.
    const v = await env.DB.prepare(`SELECT manifest, readme FROM versions WHERE package_id = ? AND version = ?`).bind(packageId, version).first<{ manifest: string; readme: string }>();
    const m = JSON.parse(v!.manifest) as PackageManifest;
    statements.push(
      env.DB.prepare(`UPDATE packages SET description = ?, keywords = ?, license = ?, repository = ?, homepage = ? WHERE id = ?`).bind(
        m.description,
        JSON.stringify(m.keywords ?? []),
        m.license ?? null,
        m.repository ?? null,
        m.homepage ?? null,
        packageId,
      ),
      env.DB.prepare(`DELETE FROM packages_fts WHERE rowid = ?`).bind(packageId),
      env.DB.prepare(`INSERT INTO packages_fts (rowid, name, description, keywords, readme) VALUES (?, ?, ?, ?, ?)`).bind(
        packageId,
        name.replace(/[@/]/g, " "),
        m.description,
        (m.keywords ?? []).join(" "),
        v!.readme,
      ),
    );
  }
  await env.DB.batch(statements);
}

export async function putDistTag(req: Request, env: Env, caller: Caller, name: string, tag: string): Promise<Response> {
  const pkg = await ownedPackage(env, caller, name);
  if (!TAG.test(tag) || (tag !== "latest" && (isValidVersion(tag) || isValidRange(tag)))) return fail(400, "invalid_tag", `"${tag}" can't be a dist-tag: use lowercase letters, digits, ., - and _, and nothing that reads as a version or range`);
  const { version } = await readJson(req);
  if (typeof version !== "string" || !isValidVersion(version)) return fail(400, "bad_request", "version must be a published version");
  const row = (await versionsOf(env, pkg.id)).find((v) => v.version === version);
  if (!row) return fail(404, "not_found", `No version ${name}@${version}`);
  if (tag === "latest" && row.yanked !== null) return fail(400, "yanked", `${name}@${version} is yanked; it can't be latest`);
  await setTag(env, pkg.id, name, tag, version);
  await purgePackage(env, name);
  const out: DistTagsResponse = { name, distTags: await tagsOf(env, pkg.id) };
  return json(out);
}

export async function deleteDistTag(env: Env, caller: Caller, name: string, tag: string): Promise<Response> {
  const pkg = await ownedPackage(env, caller, name);
  if (tag === "latest") return fail(400, "latest_required", "The latest tag can't be removed; point it at another version instead");
  const res = await env.DB.prepare(`DELETE FROM dist_tags WHERE package_id = ? AND tag = ?`).bind(pkg.id, tag).run();
  if (!res.meta.changes) return fail(404, "not_found", `${name} has no tag ${tag}`);
  await purgePackage(env, name);
  const out: DistTagsResponse = { name, distTags: await tagsOf(env, pkg.id) };
  return json(out);
}

async function tagsOf(env: Env, packageId: number): Promise<Record<string, string>> {
  const { results } = await env.DB.prepare(`SELECT tag, version FROM dist_tags WHERE package_id = ?`).bind(packageId).all<{ tag: string; version: string }>();
  return Object.fromEntries(results.map((t) => [t.tag, t.version]));
}
