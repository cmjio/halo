/**
 * `halo serve --package [dir]`: serve a package's hosted pipelines to its consumers.
 *
 *   - Only the pipelines in halo.json `hosted.exports` are served (API and MCP); nothing else
 *     in their files is reachable.
 *   - Every call carries `Halo-Package: <name>@<version>`. No header: 400. Another package: 400.
 *     Another version: 410, so a consumer on a version this server no longer runs is told to update.
 *   - Consumers need a key. Keys are named, so the publisher can issue and revoke one per consumer
 *     and meter each one. They come from (all are merged):
 *       HALO_PACKAGE_KEYS="acme=hk_123,globex=hk_456"     (id=key, comma separated)
 *       <stateDir>/package-keys.json, or --keys <file>     { "acme": "hk_123", "globex": "sha256:<hex of the key>" }
 *     The file is re-read when it changes, so revoking a key needs no restart. A value
 *     "sha256:<hex>" stores only the key's hash.
 *   - The key is read as the package's `hosted.auth` says (Authorization: Bearer, or its header).
 *     HALO_SERVE_TOKEN, when set, is the publisher's own token: it reaches every endpoint,
 *     including GET /api/usage.
 *   - Usage is metered per key in the `hosted_usage` table of <stateDir>/telemetry.db: one row per
 *     run with its key id, pipeline, status, cost and tokens. GET /api/usage sums it per key.
 */

import { Database } from "bun:sqlite";
import { createHash, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { HOSTED_PACKAGE_HEADER, type ApiError, type PackageManifest } from "../registry/contract.js";
import { hostedSources, readManifest } from "../registry/hosted.js";
import { PackageError } from "../registry/format.js";

export const PACKAGE_KEYS_ENV = "HALO_PACKAGE_KEYS";
export const PACKAGE_KEYS_FILE = "package-keys.json";

export class PackageServeError extends Error {}

export interface ServedPackage {
  dir: string;
  manifest: PackageManifest;
  /** Hosted pipeline → its source file (absolute). */
  sources: Record<string, string>;
}

/** The package in `dir` and its hosted pipelines' source files. */
export function loadServedPackage(dir: string): ServedPackage {
  const root = resolve(dir);
  try {
    const manifest = readManifest(root);
    if (!manifest.hosted) throw new PackageServeError(`${manifest.name} has no "hosted" in halo.json: halo serve --package serves a package's hosted pipelines`);
    const { sources } = hostedSources(root, manifest);
    return { dir: root, manifest, sources: Object.fromEntries(Object.entries(sources).map(([k, v]) => [k, join(root, v)])) };
  } catch (err) {
    if (err instanceof PackageError) throw new PackageServeError(err.message);
    throw err;
  }
}

/** `id=key,id2=key2` (or `id:key`). */
export function parseKeyList(text: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (text ?? "").split(/[,\n]/)) {
    const item = part.trim();
    if (!item) continue;
    const m = item.match(/^([\w.@-]+)[=:](.+)$/);
    if (!m) throw new PackageServeError(`${PACKAGE_KEYS_ENV}: "${item.slice(0, 20)}" should be <consumer id>=<key>`);
    out[m[1]!] = m[2]!.trim();
  }
  return out;
}

const hash = (key: string) => createHash("sha256").update(key).digest("hex");

function same(a: string, b: string): boolean {
  const [x, y] = [Buffer.from(a), Buffer.from(b)];
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Consumer keys from the options, the environment and a keys file (re-read when it changes). */
export class ConsumerKeys {
  private fileKeys: Record<string, string> = {};
  private stamp = "";

  constructor(
    private fixed: Record<string, string>,
    private file: string | undefined,
  ) {
    this.reload();
  }

  private reload() {
    if (!this.file) return;
    let stamp = "missing";
    try {
      const s = statSync(this.file);
      stamp = `${s.mtimeMs}:${s.size}`;
    } catch {}
    if (stamp === this.stamp) return;
    this.stamp = stamp;
    if (stamp === "missing") {
      this.fileKeys = {};
      return;
    }
    try {
      const raw = JSON.parse(readFileSync(this.file, "utf8"));
      if (!raw || typeof raw !== "object" || Array.isArray(raw) || Object.values(raw).some((v) => typeof v !== "string")) throw new Error("expected { \"<consumer id>\": \"<key>\" }");
      this.fileKeys = raw as Record<string, string>;
    } catch (err) {
      throw new PackageServeError(`${this.file}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  all(): Record<string, string> {
    this.reload();
    return { ...this.fileKeys, ...this.fixed };
  }

  /** The id of the consumer a key belongs to. */
  idOf(key: string): string | undefined {
    if (!key) return undefined;
    const digest = `sha256:${hash(key)}`;
    for (const [id, k] of Object.entries(this.all())) if (k.startsWith("sha256:") ? same(k, digest) : same(k, key)) return id;
    return undefined;
  }

  count(): number {
    return Object.keys(this.all()).length;
  }
}

/** The key a request carries, read as the package's hosted.auth says (a Bearer token also works). */
export function keyOf(req: Request, manifest: PackageManifest): string {
  const auth = manifest.hosted?.auth;
  if (auth?.type === "header" && auth.name) {
    const v = req.headers.get(auth.name);
    if (v) return v.trim();
  }
  return req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ?? "";
}

/** Why a request's Halo-Package header is refused: the status and ApiError, or undefined when it's this package's version. */
export function checkPackageHeader(req: Request, manifest: PackageManifest, required = true): { status: number; body: ApiError } | undefined {
  const header = req.headers.get(HOSTED_PACKAGE_HEADER)?.trim();
  const want = `${manifest.name}@${manifest.version}`;
  if (!header) {
    if (!required) return undefined;
    return { status: 400, body: { error: `Missing the ${HOSTED_PACKAGE_HEADER} header: send "${HOSTED_PACKAGE_HEADER}: ${want}" (Halo sends it for you when you use the package)`, code: "missing_package_header" } };
  }
  const at = header.lastIndexOf("@");
  const name = at > 0 ? header.slice(0, at) : header;
  const version = at > 0 ? header.slice(at + 1) : "";
  if (name !== manifest.name) return { status: 400, body: { error: `This server runs ${manifest.name}, not ${name}`, code: "wrong_package" } };
  if (version !== manifest.version) {
    return { status: 410, body: { error: `${manifest.name}@${version || "?"} is no longer served here (this server runs ${want}). Run \`halo update ${manifest.name}\``, code: "version_gone" } };
  }
  return undefined;
}

export interface UsageRow {
  key: string;
  runs: number;
  failed: number;
  cost: number;
  promptTokens: number;
  completionTokens: number;
}

/** Per-key metering, in the hosted_usage table of the serve telemetry database. */
export class UsageLog {
  private db: Database;
  private insert;

  constructor(path: string) {
    this.db = new Database(path, { create: true });
    if (path !== ":memory:") this.db.run("PRAGMA journal_mode = WAL;");
    this.db.run(`CREATE TABLE IF NOT EXISTS hosted_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      at INTEGER, key_id TEXT, package TEXT, pipeline TEXT, run_id TEXT, status TEXT,
      cost REAL, prompt_tokens INTEGER, completion_tokens INTEGER, duration_ms INTEGER
    )`);
    this.db.run("CREATE INDEX IF NOT EXISTS idx_hosted_usage_key ON hosted_usage(key_id)");
    this.insert = this.db.prepare(
      "INSERT INTO hosted_usage (at, key_id, package, pipeline, run_id, status, cost, prompt_tokens, completion_tokens, duration_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    );
  }

  record(row: { key: string; pkg: string; pipeline: string; runId: string; status: string; cost: number; prompt: number; completion: number; durationMs: number }) {
    this.insert.run(Date.now(), row.key, row.pkg, row.pipeline, row.runId, row.status, row.cost, row.prompt, row.completion, row.durationMs);
  }

  /** Totals per key, optionally since a time (ms since the epoch). */
  byKey(since = 0): UsageRow[] {
    return this.db
      .query(
        `SELECT key_id AS key, COUNT(*) AS runs, SUM(status != 'completed') AS failed, COALESCE(SUM(cost), 0) AS cost,
           COALESCE(SUM(prompt_tokens), 0) AS promptTokens, COALESCE(SUM(completion_tokens), 0) AS completionTokens
         FROM hosted_usage WHERE at >= ? GROUP BY key_id ORDER BY key_id`,
      )
      .all(since) as UsageRow[];
  }

  close() {
    this.db.close();
  }
}

/** Where consumer keys come from for a served package. */
export function consumerKeys(options: { keys?: Record<string, string>; keysFile?: string; stateDir: string; env: Record<string, string | undefined> }): ConsumerKeys {
  const fixed = { ...parseKeyList(options.env[PACKAGE_KEYS_ENV]), ...(options.keys ?? {}) };
  const file = options.keysFile ? resolve(options.keysFile) : join(options.stateDir, PACKAGE_KEYS_FILE);
  if (options.keysFile && !existsSync(file)) throw new PackageServeError(`Keys file not found: ${options.keysFile}`);
  return new ConsumerKeys(fixed, file);
}
