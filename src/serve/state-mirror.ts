/**
 * Keeps a copy of the state folder somewhere that outlives the machine, for hosts whose
 * disk is thrown away on every deploy (containers without a volume).
 *
 *   "state": { "store": "s3://my-bucket/halo/prod" }     S3, R2, GCS, MinIO, Spaces…
 *   "state": { "store": "/mnt/shared/halo" }             a folder on a shared mount
 *
 * On start the folder is filled from the store, before anything reads it. While the
 * server runs, files that changed are copied up shortly after they change (databases at
 * most once per `every`), and once more when it stops. So paused runs, runs in progress,
 * schedule state, idempotency keys, threads and telemetry are there after a redeploy.
 *
 * It is a copy for one server at a time, not a database: two servers writing one store
 * overwrite each other's files.
 */

import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { readdir, readFile, rm, writeFile, mkdir, rename } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";

/** Where the copy is kept. Keys are paths relative to the state folder, with "/" between parts. */
export interface StateStore {
  /** A name for logs and errors, without secrets. */
  readonly label: string;
  list(): Promise<string[]>;
  get(key: string): Promise<Uint8Array | undefined>;
  put(key: string, data: Uint8Array): Promise<void>;
  delete(key: string): Promise<void>;
}

export class StateStoreError extends Error {}

/** A folder: a shared mount, or (in tests) anywhere. */
export class FolderStateStore implements StateStore {
  readonly label: string;
  constructor(readonly dir: string) {
    this.dir = resolve(dir);
    this.label = this.dir;
  }
  private path(key: string) {
    return join(this.dir, ...key.split("/"));
  }
  async list(): Promise<string[]> {
    if (!existsSync(this.dir)) return [];
    const entries = await readdir(this.dir, { recursive: true, withFileTypes: true });
    return entries.filter((e) => e.isFile() && !e.name.endsWith(".part")).map((e) => relative(this.dir, join(e.parentPath, e.name)).split(sep).join("/"));
  }
  async get(key: string) {
    try {
      return new Uint8Array(await readFile(this.path(key)));
    } catch {
      return undefined;
    }
  }
  async put(key: string, data: Uint8Array) {
    const file = this.path(key);
    await mkdir(dirname(file), { recursive: true });
    // Written beside it and renamed, so a reader never sees half a file.
    await writeFile(`${file}.part`, data);
    await rename(`${file}.part`, file);
  }
  async delete(key: string) {
    await rm(this.path(key), { force: true });
  }
}

/** A bucket on S3 or anything that speaks its API, through Bun's built-in client. */
export class S3StateStore implements StateStore {
  readonly label: string;
  private client: Bun.S3Client;
  private prefix: string;
  constructor(url: URL, env: Record<string, string | undefined>) {
    const bucket = url.hostname;
    if (!bucket) throw new StateStoreError(`"${url.href}" names no bucket (write s3://bucket/prefix)`);
    this.prefix = url.pathname.replace(/^\/+|\/+$/g, "");
    if (this.prefix) this.prefix += "/";
    const pick = (name: string) => url.searchParams.get(name) ?? undefined;
    const fromEnv = (name: string) => env[`S3_${name}`] ?? env[`AWS_${name}`];
    const accessKeyId = fromEnv("ACCESS_KEY_ID");
    const secretAccessKey = fromEnv("SECRET_ACCESS_KEY");
    if (!accessKeyId || !secretAccessKey) throw new StateStoreError(`The state store ${url.protocol}//${bucket} needs credentials: set S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY (or the AWS_ names)`);
    const endpoint = pick("endpoint") ?? fromEnv("ENDPOINT");
    this.client = new Bun.S3Client({
      bucket,
      accessKeyId,
      secretAccessKey,
      ...(fromEnv("SESSION_TOKEN") ? { sessionToken: fromEnv("SESSION_TOKEN") } : {}),
      ...(endpoint ? { endpoint } : {}),
      ...(pick("region") ?? fromEnv("REGION") ? { region: pick("region") ?? fromEnv("REGION") } : {}),
    });
    this.label = `s3://${bucket}/${this.prefix}`.replace(/\/$/, "");
  }
  async list(): Promise<string[]> {
    const keys: string[] = [];
    let startAfter: string | undefined;
    for (;;) {
      const page = await this.client.list({ prefix: this.prefix, maxKeys: 1000, ...(startAfter ? { startAfter } : {}) });
      const contents = page.contents ?? [];
      for (const o of contents) keys.push(o.key.slice(this.prefix.length));
      if (!page.isTruncated || !contents.length) return keys.filter(Boolean);
      startAfter = contents.at(-1)!.key;
    }
  }
  async get(key: string) {
    const file = this.client.file(this.prefix + key);
    try {
      return await file.bytes();
    } catch (err) {
      if ((err as { code?: string }).code === "NoSuchKey") return undefined;
      throw err;
    }
  }
  async put(key: string, data: Uint8Array) {
    await this.client.write(this.prefix + key, data);
  }
  async delete(key: string) {
    await this.client.delete(this.prefix + key);
  }
}

/** The store a `state.store` setting names. */
export function openStateStore(where: string, env: Record<string, string | undefined>): StateStore {
  if (/^s3:\/\//i.test(where)) {
    let url: URL;
    try {
      url = new URL(where);
    } catch {
      throw new StateStoreError(`"${where}" is not a store address (write s3://bucket/prefix)`);
    }
    return new S3StateStore(url, env);
  }
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(where) && !/^file:\/\//i.test(where)) {
    throw new StateStoreError(`"${where.split("://")[0]}://" is not a kind of state store Halo knows (use s3://bucket/prefix, or a folder)`);
  }
  return new FolderStateStore(where.replace(/^file:\/\//i, ""));
}

const DATABASE = /\.(db|sqlite|sqlite3)$/;
/**
 * Files that only mean something to the process that wrote them, or are part of another file.
 * Installed packages belong to the project, not to its state; and a project pushed to the same
 * store (project/…) is not state either.
 */
const SKIPPED = /(^|\/)(scheduler\.lock|[^/]*\.tmp|[^/]*\.part|[^/]*-(wal|shm|journal)|[^/]*\.taken-[^/]*)$|^(packages\/|trust\.json$)|^project\//;

export interface MirrorOptions {
  /** How often databases (and anything missed) are copied. Default 30s. */
  everyMs?: number;
  /** How soon after a change the copy starts. Default 300ms. */
  settleMs?: number;
  logger?: Pick<Console, "log" | "warn">;
}

export class StateMirror {
  /** What each file looked like when it was last copied up. */
  private copied = new Map<string, string>();
  /** Files this process removed, so a listing that still shows one doesn't bring it back. */
  private removed = new Set<string>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private interval: ReturnType<typeof setInterval> | undefined;
  private running: Promise<void> | undefined;
  private again = false;
  private lastFull = 0;
  private everyMs: number;
  private settleMs: number;
  private logger: Pick<Console, "log" | "warn">;

  constructor(readonly dir: string, readonly store: StateStore, options: MirrorOptions = {}) {
    this.dir = resolve(dir);
    this.everyMs = options.everyMs ?? 30_000;
    this.settleMs = options.settleMs ?? 300;
    this.logger = options.logger ?? console;
  }

  private path(key: string) {
    return join(this.dir, ...key.split("/"));
  }

  private localKeys(): string[] {
    if (!existsSync(this.dir)) return [];
    return (readdirSync(this.dir, { recursive: true, withFileTypes: true }) as import("node:fs").Dirent[])
      .filter((e) => e.isFile())
      .map((e) => relative(this.dir, join(e.parentPath, e.name)).split(sep).join("/"))
      .filter((key) => !SKIPPED.test(key));
  }

  /** A file's size and time; for a database, its write-ahead log's too (that is where new rows are first). */
  private signature(key: string): string | undefined {
    try {
      const s = statSync(this.path(key));
      let sig = `${s.mtimeMs}:${s.size}`;
      if (DATABASE.test(key)) {
        try {
          const wal = statSync(`${this.path(key)}-wal`);
          sig += `:${wal.mtimeMs}:${wal.size}`;
        } catch {}
      }
      return sig;
    } catch {
      return undefined;
    }
  }

  private async read(key: string): Promise<Uint8Array> {
    if (!DATABASE.test(key)) return new Uint8Array(await readFile(this.path(key)));
    // A database is copied as one consistent image, whatever is in its write-ahead log.
    const db = new Database(this.path(key), { readonly: true });
    try {
      return new Uint8Array(db.serialize());
    } finally {
      db.close();
    }
  }

  private async download(key: string): Promise<boolean> {
    const data = await this.store.get(key);
    if (!data) return false;
    const file = this.path(key);
    mkdirSync(dirname(file), { recursive: true });
    if (DATABASE.test(key)) for (const ext of ["-wal", "-shm"]) rmSync(file + ext, { force: true });
    await writeFile(`${file}.tmp`, data);
    await rename(`${file}.tmp`, file);
    const sig = this.signature(key);
    if (sig) this.copied.set(key, sig);
    return true;
  }

  /**
   * Fill the folder from the store: every file the folder doesn't have. A file that is
   * already there is kept (this disk outlived the last deploy) and copied up if it differs.
   * Returns how many files came down. Call it before anything opens the folder.
   */
  async restore(): Promise<number> {
    mkdirSync(this.dir, { recursive: true });
    let keys: string[];
    try {
      keys = await this.store.list();
    } catch (err) {
      throw new StateStoreError(`Could not read the state store ${this.store.label}: ${err instanceof Error ? err.message : err}`);
    }
    let n = 0;
    for (const key of keys) {
      if (SKIPPED.test(key) || existsSync(this.path(key))) continue;
      if (await this.download(key)) n++;
    }
    return n;
  }

  /** Bring one file down now, if the store has it and the folder doesn't (a run another server paused). */
  async pull(key: string): Promise<boolean> {
    if (existsSync(this.path(key)) || this.removed.has(key)) return false;
    try {
      return await this.download(key);
    } catch {
      return false;
    }
  }

  /** Something changed: copy it up soon. */
  touch(): void {
    if (this.timer || this.stopped) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.sync();
    }, this.settleMs);
  }

  /** Copy up what changed, and remove what was removed. `full` includes databases whatever the time. */
  sync(full = false): Promise<void> {
    if (this.running) {
      this.again = true;
      this.fullAgain ||= full;
      return this.running;
    }
    this.running = this.syncOnce(full)
      .catch((err) => this.logger.warn(`[halo] State was not copied to ${this.store.label}: ${err instanceof Error ? err.message : err}`))
      .finally(() => {
        this.running = undefined;
        if (this.again) {
          const next = this.fullAgain;
          this.again = this.fullAgain = false;
          return this.sync(next);
        }
      });
    return this.running;
  }
  private fullAgain = false;
  private stopped = false;

  private async syncOnce(full: boolean): Promise<void> {
    const databases = full || Date.now() - this.lastFull >= this.everyMs;
    if (databases) this.lastFull = Date.now();
    const local = new Set(this.localKeys());
    for (const key of local) {
      if (DATABASE.test(key) && !databases) continue;
      const sig = this.signature(key);
      if (!sig || this.copied.get(key) === sig) continue;
      let data: Uint8Array;
      try {
        data = await this.read(key);
      } catch {
        continue; // gone or being replaced: the next pass has it
      }
      await this.store.put(key, data);
      this.copied.set(key, sig);
      this.removed.delete(key);
    }
    for (const key of [...this.copied.keys()]) {
      if (local.has(key)) continue;
      this.copied.delete(key);
      this.removed.add(key);
    }
    for (const key of [...this.removed]) {
      if (local.has(key)) {
        this.removed.delete(key);
        continue;
      }
      await this.store.delete(key);
      // Kept as removed until the next full pass has seen the listing without it.
    }
    if (databases) {
      // Files another server put there since we started (a run it paused while we were coming up).
      const remote = new Set(await this.store.list());
      for (const key of remote) if (!local.has(key) && !this.removed.has(key) && !SKIPPED.test(key)) await this.download(key).catch(() => false);
      for (const key of [...this.removed]) if (!remote.has(key)) this.removed.delete(key);
    }
  }

  /** Copy on a timer as well as on touch(). */
  start(): void {
    this.interval ??= setInterval(() => void this.sync(), this.everyMs);
  }

  /** One last full copy. */
  async stop(): Promise<void> {
    this.stopped = true;
    clearTimeout(this.timer);
    this.timer = undefined;
    clearInterval(this.interval);
    this.interval = undefined;
    await this.sync(true);
  }
}
