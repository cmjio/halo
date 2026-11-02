/**
 * Build `halo` as a standalone binary for every platform and publish it to halolang.com.
 *
 *   bun scripts/release.ts              build, check, upload to R2 (served at halolang.com/dl/)
 *   bun scripts/release.ts --no-upload  build and check only (into dist/release/<version>)
 *   bun scripts/release.ts --force      replace a version that's already published
 *
 * Each binary carries the Bun runtime, so users need nothing else installed. A version's
 * files are cached forever once published, so a new release needs a new version in
 * package.json. latest.json, which says which version is current, is uploaded last.
 */

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import pkg from "../package.json" with { type: "json" };

const root = resolve(import.meta.dir, "..");
const version = pkg.version;
const out = join(root, "dist/release", version);
const BUCKET = "halo-releases";
const SITE = "https://halolang.com";

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
const sh = (cmd: string[], opts: { quiet?: boolean } = {}) => {
  const p = Bun.spawnSync(cmd, { cwd: root, stdout: opts.quiet ? "pipe" : "inherit", stderr: "inherit" });
  if (p.exitCode !== 0) throw new Error(`${cmd.join(" ")} failed (${p.exitCode})`);
  return p.stdout?.toString() ?? "";
};

if (!args.has("--no-upload") && !args.has("--force")) {
  const res = await fetch(`${SITE}/dl/${version}/SHA256SUMS`, { method: "HEAD" });
  if (res.ok) throw new Error(`${version} is already published; bump the version in package.json (or pass --force)`);
}

console.log(`Building halo ${version}`);
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
const latest = join(out, "latest.json");
await Bun.write(latest, JSON.stringify({ version, published: new Date().toISOString() }) + "\n");
put("latest.json", latest, "application/json");
console.log(`Published halo ${version}: curl -fsSL ${SITE}/install.sh | sh`);
