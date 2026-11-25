/**
 * Build `halo` as a standalone binary for every platform and publish it to halolang.com.
 *
 *   bun scripts/release.ts                build, check, upload to R2 (served at halolang.com/dl/)
 *   bun scripts/release.ts --no-upload    build and check only (into dist/release/<version>)
 *   bun scripts/release.ts --upload-only  upload what --no-upload built (CI builds and publishes in separate jobs)
 *   bun scripts/release.ts --force        replace a version that's already published
 *
 * dist/release is laid out like halolang.com/dl (<channel>.json, <version>/<file>), so a
 * local server over it can stand in for the site when testing the installers.
 *
 * Each binary carries the Bun runtime, so users need nothing else installed. A version's
 * files are cached forever once published, so a new release needs a new version in
 * package.json. The version picks the channel (src/channel.ts): 1.2.0 is latest, 1.3.0-next.1
 * is next, 1.2.1-nightly.… is nightly. The channel's pointer (latest.json, next.json or
 * nightly.json), which says which version is current there, is uploaded last. A stable
 * release also moves next.json up to it when next is behind, so `next` is never older than
 * `latest`. Only the newest NIGHTLIES_KEPT nightlies stay in R2; older ones are deleted.
 */

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import pkg from "../package.json" with { type: "json" };
import { channelOf } from "../src/channel";

const root = resolve(import.meta.dir, "..");
const version = pkg.version;
const out = join(root, "dist/release", version);
const BUCKET = "halo-releases";
const SITE = "https://halolang.com";
const NIGHTLIES_KEPT = 14;
const channel = channelOf(version);

/** Bun's compile targets, by the file name install.sh asks for. */
const TARGETS: Record<string, string> = {
  "halo-darwin-arm64": "bun-darwin-arm64",
  "halo-darwin-x64": "bun-darwin-x64",
  "halo-linux-x64": "bun-linux-x64",
  // For x64 CPUs without AVX2 (install.sh picks it when it has to).
  "halo-linux-x64-baseline": "bun-linux-x64-baseline",
  "halo-linux-arm64": "bun-linux-arm64",
  // Alpine and other musl systems.
  "halo-linux-x64-musl": "bun-linux-x64-musl",
  "halo-linux-arm64-musl": "bun-linux-arm64-musl",
  "halo-windows-x64.exe": "bun-windows-x64",
};

const args = new Set(process.argv.slice(2));
const uploadOnly = args.has("--upload-only");
const sh = (cmd: string[], opts: { quiet?: boolean } = {}) => {
  const p = Bun.spawnSync(cmd, { cwd: root, stdout: opts.quiet ? "pipe" : "inherit", stderr: "inherit" });
  if (p.exitCode !== 0) throw new Error(`${cmd.join(" ")} failed (${p.exitCode})`);
  return p.stdout?.toString() ?? "";
};

if (!args.has("--no-upload") && !args.has("--force") && !uploadOnly) {
  const res = await fetch(`${SITE}/dl/${version}/SHA256SUMS`, { method: "HEAD" });
  if (res.ok) throw new Error(`${version} is already published; bump the version in package.json (or pass --force)`);
}

const pointer = join(root, "dist/release", `${channel}.json`);
type Pointer = { version: string; published: string; commit?: string; history?: string[] };
const readPointer = async (name: string): Promise<Pointer | undefined> => {
  const res = await fetch(`${SITE}/dl/${name}.json`, { headers: { "cache-control": "no-cache" } });
  return res.ok ? ((await res.json()) as Pointer) : undefined;
};

if (!uploadOnly) {
  console.log(`Building halo ${version} (${channel})`);
  sh(["bun", "test"]);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });

  const sums: string[] = [];
  for (const [file, target] of Object.entries(TARGETS)) {
    const path = join(out, file);
    sh(["bun", "build", "index.ts", "--compile", "--minify", `--target=${target}`, "--outfile", path], { quiet: true });
    const sha = createHash("sha256").update(readFileSync(path)).digest("hex");
    sums.push(`${sha}  ${file}`);
    console.log(`  ${file.padEnd(26)} ${(statSync(path).size / 1e6).toFixed(1)} MB  ${sha.slice(0, 12)}`);
  }
  await Bun.write(join(out, "SHA256SUMS"), sums.join("\n") + "\n");

  // The binary for this machine must run and know its version before anything ships.
  const here = `halo-${process.platform === "win32" ? "windows" : process.platform}-${process.arch === "arm64" ? "arm64" : "x64"}${process.platform === "win32" ? ".exe" : ""}`;
  const reported = sh([join(out, here), "--version"], { quiet: true }).trim();
  if (reported !== version) throw new Error(`${here} --version printed "${reported}", expected ${version}`);
  console.log(`  ${here} --version → ${reported}`);
  const commit = process.env.GITHUB_SHA ?? Bun.spawnSync(["git", "rev-parse", "HEAD"], { cwd: root, stdout: "pipe" }).stdout.toString().trim();
  await Bun.write(pointer, JSON.stringify({ version, published: new Date().toISOString(), ...(commit ? { commit } : {}) }) + "\n");
}

if (uploadOnly && !Bun.file(join(out, "SHA256SUMS")).size) throw new Error(`Nothing built in ${out}; run with --no-upload first`);

if (args.has("--no-upload")) {
  console.log(`Built in ${out}`);
  process.exit(0);
}

const put = (key: string, file: string, type: string) =>
  sh(["bunx", "wrangler", "r2", "object", "put", `${BUCKET}/${key}`, "--file", file, "--content-type", type, "--remote"], { quiet: true });
for (const file of Object.keys(TARGETS)) {
  put(`${version}/${file}`, join(out, file), "application/octet-stream");
  console.log(`  uploaded ${version}/${file}`);
}
put(`${version}/SHA256SUMS`, join(out, "SHA256SUMS"), "text/plain; charset=utf-8");

// Nightlies keep a short history in nightly.json; the ones that fall off it are deleted.
if (channel === "nightly") {
  const before = await readPointer("nightly");
  const history = [version, ...[before?.version, ...(before?.history ?? [])].filter((v): v is string => !!v && v !== version)];
  const p = (await Bun.file(pointer).json()) as Pointer;
  await Bun.write(pointer, JSON.stringify({ ...p, history: history.slice(0, NIGHTLIES_KEPT) }) + "\n");
  put(`${channel}.json`, pointer, "application/json");
  for (const old of history.slice(NIGHTLIES_KEPT)) {
    for (const file of [...Object.keys(TARGETS), "SHA256SUMS"]) {
      Bun.spawnSync(["bunx", "wrangler", "r2", "object", "delete", `${BUCKET}/${old}/${file}`, "--remote"], { cwd: root, stdout: "pipe", stderr: "pipe" });
    }
    console.log(`  deleted nightly ${old}`);
  }
} else {
  put(`${channel}.json`, pointer, "application/json");
}

// A stable release that's newer than next becomes next too, so `next` never trails `latest`.
if (channel === "latest") {
  const next = await readPointer("next");
  if (!next || Bun.semver.order(next.version, version) < 0) {
    put("next.json", pointer, "application/json");
    console.log(`  next.json → ${version}`);
  }
}

const how = channel === "latest" ? "" : `HALO_VERSION=${channel} `;
console.log(`Published halo ${version} on ${channel}: curl -fsSL ${SITE}/install.sh | ${how}sh`);
