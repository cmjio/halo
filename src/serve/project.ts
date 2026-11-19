/**
 * A project kept in a store, so a server can run it without an image being built for it.
 *
 *   halo push --to s3://my-bucket/halo/app      from your machine or CI: no Docker
 *   HALO_PROJECT=s3://my-bucket/halo/app        on the stock image: `halo serve` pulls it
 *
 * `halo push` uploads the project's files (each once, by its hash), a manifest that lists
 * them, and a pointer to that manifest. `halo serve` pulls what the pointer names before it
 * starts, and when the pointer moves it stops taking runs, pulls, and starts again: a
 * deploy needs no new container, and the server always knows which version it is running.
 */

import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import type { StateStore } from "./state-mirror.js";

export class ProjectError extends Error {}

export interface ProjectManifest {
  /** A hash of the files: the same project is the same version, whoever pushes it. */
  version: string;
  at: string;
  /** The halo that pushed it. */
  halo: string;
  files: Record<string, { sha256: string; size: number; executable?: boolean }>;
}

/** What `project/current.json` holds. */
interface Pointer {
  version: string;
  at: string;
  previous?: string;
}

const CURRENT = "project/current.json";
const manifestKey = (version: string) => `project/versions/${version}.json`;
const blobKey = (sha: string) => `project/blobs/${sha}`;
/** Written into the folder a project was pulled to: which version it holds, and the files that came with it. */
export const PULLED_FILE = ".halo-project.json";

/** Never pushed, whatever git says: secrets, state, and what a build makes. Installed packages and their trust file are the exception inside .halo. */
const NEVER = /(^|\/)(\.git|node_modules|\.DS_Store)(\/|$)|(^|\/)\.env(\.[^/]*)?$|(^|\/)\.halo-project\.json$/;
const inState = (path: string) => /^\.halo\//.test(path) && !/^\.halo\/(packages\/|trust\.json$)/.test(path);

const sha256 = (data: Uint8Array | string) => createHash("sha256").update(data).digest("hex");
const posix = (p: string) => p.split(sep).join("/");

function safePath(path: string): boolean {
  return !!path && !path.startsWith("/") && !/^[a-zA-Z]:/.test(path) && !path.split("/").some((part) => part === ".." || part === "" || part === ".") && !NEVER.test(path) && !inState(path);
}

/** The files a push sends: what git tracks or would track, else everything outside dot-folders; plus installed packages. */
export function projectFiles(root: string): string[] {
  root = resolve(root);
  const out = new Set<string>();
  const git = Bun.spawnSync(["git", "-C", root, "ls-files", "-co", "--exclude-standard", "-z"], { stdout: "pipe", stderr: "ignore" });
  const inRepo = git.exitCode === 0 && Bun.spawnSync(["git", "-C", root, "rev-parse", "--show-toplevel"], { stdout: "pipe", stderr: "ignore" }).exitCode === 0;
  const walk = (dir: string, dots: boolean) => {
    if (!existsSync(dir)) return;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (!dots && e.name.startsWith(".")) continue;
      const full = join(dir, e.name);
      if (e.isDirectory()) walk(full, dots);
      else if (e.isFile()) out.add(posix(relative(root, full)));
    }
  };
  if (inRepo) for (const f of git.stdout.toString().split("\0")) f && existsSync(join(root, f)) && statSync(join(root, f)).isFile() && out.add(f);
  else walk(root, false);
  // Installed tool packages are ignored by git, but the server needs them as they were checked here.
  walk(join(root, ".halo", "packages"), true);
  if (existsSync(join(root, ".halo", "trust.json"))) out.add(".halo/trust.json");
  return [...out].filter(safePath).sort();
}

export interface PushResult {
  version: string;
  files: number;
  uploaded: number;
  bytes: number;
  /** False when this version was already the current one. */
  changed: boolean;
}

/** Upload the project at `root` and make it the current version. */
export async function pushProject(root: string, store: StateStore, halo: string, options: { keep?: number } = {}): Promise<PushResult> {
  root = resolve(root);
  const paths = projectFiles(root);
  if (!paths.some((p) => p.endsWith(".halo"))) throw new ProjectError(`No .halo files in ${root}: there is nothing to push`);
  const files: ProjectManifest["files"] = {};
  const data = new Map<string, Uint8Array>();
  let bytes = 0;
  for (const path of paths) {
    const full = join(root, ...path.split("/"));
    const content = new Uint8Array(readFileSync(full));
    const sha = sha256(content);
    files[path] = { sha256: sha, size: content.length, ...(statSync(full).mode & 0o111 ? { executable: true } : {}) };
    data.set(sha, content);
    bytes += content.length;
  }
  const version = sha256(JSON.stringify(files)).slice(0, 12);
  const have = new Set(await store.list());
  let uploaded = 0;
  for (const [sha, content] of data) {
    if (have.has(blobKey(sha))) continue;
    await store.put(blobKey(sha), content);
    uploaded++;
  }
  const at = new Date().toISOString();
  const manifest: ProjectManifest = { version, at, halo, files };
  await store.put(manifestKey(version), new TextEncoder().encode(JSON.stringify(manifest)));
  const before = await currentProject(store);
  const changed = before?.version !== version;
  // The pointer moves last: a server never sees a version whose files aren't all there.
  if (changed) await store.put(CURRENT, new TextEncoder().encode(JSON.stringify({ version, at, previous: before?.version } satisfies Pointer)));

  // Old versions go, and then the files only they used.
  const keep = Math.max(2, options.keep ?? 5);
  const versions: ProjectManifest[] = [];
  for (const key of have) {
    if (!/^project\/versions\/[0-9a-f]+\.json$/.test(key) || key === manifestKey(version)) continue;
    const m = await readJson<ProjectManifest>(store, key);
    if (m) versions.push(m);
  }
  versions.sort((a, b) => b.at.localeCompare(a.at));
  const kept = [manifest, ...versions.slice(0, keep - 1)];
  const used = new Set(kept.flatMap((m) => Object.values(m.files).map((f) => f.sha256)));
  for (const m of versions.slice(keep - 1)) await store.delete(manifestKey(m.version));
  for (const key of have) {
    const blob = key.match(/^project\/blobs\/([0-9a-f]+)$/);
    if (blob && !used.has(blob[1]!)) await store.delete(key);
  }
  return { version, files: paths.length, uploaded, bytes, changed };
}

async function readJson<T>(store: StateStore, key: string): Promise<T | undefined> {
  const raw = await store.get(key);
  if (!raw) return undefined;
  try {
    return JSON.parse(new TextDecoder().decode(raw)) as T;
  } catch {
    throw new ProjectError(`${store.label}/${key} is not valid JSON`);
  }
}

/** The version a store says to run, if anything was pushed. */
export async function currentProject(store: StateStore): Promise<Pointer | undefined> {
  return readJson<Pointer>(store, CURRENT);
}

/** The version a folder was last filled with. */
export function pulledVersion(dir: string): string | undefined {
  try {
    return (JSON.parse(readFileSync(join(dir, PULLED_FILE), "utf8")) as { version?: string }).version;
  } catch {
    return undefined;
  }
}

/**
 * Make `dir` hold a pushed version (the current one unless `version` names another): its
 * files written, and the files only the previous pull had removed. Files that were never
 * part of a pull (state, logs) are left alone.
 */
export async function pullProject(store: StateStore, dir: string, version?: string): Promise<{ version: string; files: number; written: number; removed: number }> {
  dir = resolve(dir);
  version ??= (await currentProject(store))?.version;
  if (!version) throw new ProjectError(`Nothing has been pushed to ${store.label} yet: run \`halo push --to ${store.label}\` from the project`);
  const manifest = await readJson<ProjectManifest>(store, manifestKey(version));
  if (!manifest) throw new ProjectError(`${store.label} names version ${version}, but its manifest is missing: push again`);
  let before: string[] = [];
  try {
    before = (JSON.parse(readFileSync(join(dir, PULLED_FILE), "utf8")) as { files?: string[] }).files ?? [];
  } catch {}
  mkdirSync(dir, { recursive: true });
  let written = 0;
  for (const [path, info] of Object.entries(manifest.files)) {
    if (!safePath(path)) throw new ProjectError(`Version ${version} lists "${path}", which is not a path inside a project`);
    const full = join(dir, ...path.split("/"));
    if (existsSync(full) && statSync(full).isFile() && sha256(new Uint8Array(readFileSync(full))) === info.sha256) continue;
    const content = await store.get(blobKey(info.sha256));
    if (!content || sha256(content) !== info.sha256) throw new ProjectError(`Version ${version}: the stored copy of ${path} is missing or damaged: push again`);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(`${full}.pull`, content);
    if (info.executable) chmodSync(`${full}.pull`, 0o755);
    renameSync(`${full}.pull`, full);
    written++;
  }
  let removed = 0;
  for (const path of before) {
    if (manifest.files[path] || !safePath(path)) continue;
    rmSync(join(dir, ...path.split("/")), { force: true });
    removed++;
  }
  writeFileSync(join(dir, PULLED_FILE), JSON.stringify({ version, at: manifest.at, pulledAt: new Date().toISOString(), files: Object.keys(manifest.files) }));
  return { version, files: Object.keys(manifest.files).length, written, removed };
}
