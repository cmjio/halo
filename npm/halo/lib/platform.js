"use strict";
// Which @halolang/halo-<platform> package holds the halo binary for this machine.
// Plain CommonJS with no dependencies, so it runs on any Node from 18 (and on Bun).

const fs = require("node:fs");
const path = require("node:path");

const SCOPE = "@halolang";

/** npm package suffix → the release asset it carries (scripts/npm.ts uses the same table). */
const PLATFORMS = {
  "darwin-arm64": { asset: "halo-darwin-arm64", os: "darwin", cpu: "arm64" },
  "darwin-x64": { asset: "halo-darwin-x64", os: "darwin", cpu: "x64" },
  "linux-x64": { asset: "halo-linux-x64", os: "linux", cpu: "x64", libc: "glibc" },
  "linux-arm64": { asset: "halo-linux-arm64", os: "linux", cpu: "arm64", libc: "glibc" },
  "linux-x64-musl": { asset: "halo-linux-x64-musl", os: "linux", cpu: "x64", libc: "musl" },
  "linux-arm64-musl": { asset: "halo-linux-arm64-musl", os: "linux", cpu: "arm64", libc: "musl" },
  "win32-x64": { asset: "halo-windows-x64.exe", os: "win32", cpu: "x64" },
};

/** Alpine and other musl systems: Node's report has no glibc version there. */
function isMusl() {
  if (process.platform !== "linux") return false;
  try {
    const report = process.report && process.report.getReport();
    if (report && report.header) return !report.header.glibcVersionRuntime;
  } catch {}
  try {
    return fs.readFileSync("/usr/bin/ldd", "utf8").includes("musl");
  } catch {
    return false;
  }
}

/** The platform key for a machine, or undefined when Halo has no build for it. */
function platformKey(platform, arch, musl) {
  // ARM64 Windows runs the x64 build, as install.ps1 does.
  if (platform === "win32" && (arch === "x64" || arch === "arm64")) return "win32-x64";
  const key = `${platform}-${arch}${platform === "linux" && musl ? "-musl" : ""}`;
  return PLATFORMS[key] ? key : undefined;
}

const INSTALL_INSTEAD = "Install it another way: curl -fsSL https://halolang.com/install.sh | sh (Windows: irm https://halolang.com/install.ps1 | iex).";

/** The path of the halo binary to run. HALO_BINARY overrides it. */
function binaryPath() {
  if (process.env.HALO_BINARY) return process.env.HALO_BINARY;
  const key = platformKey(process.platform, process.arch, isMusl());
  if (!key) throw new Error(`Halo has no build for ${process.platform} ${process.arch}. ${INSTALL_INSTEAD}`);
  const name = `${SCOPE}/halo-${key}`;
  let dir;
  try {
    dir = path.dirname(require.resolve(`${name}/package.json`));
  } catch {
    throw new Error(
      `${name} isn't installed. It's an optional dependency of @halolang/halo, so it is skipped by --no-optional, --omit=optional, or a lockfile made on another platform. ` +
        `Reinstall with optional dependencies (npm install --include=optional), or ${INSTALL_INSTEAD.charAt(0).toLowerCase()}${INSTALL_INSTEAD.slice(1)}`,
    );
  }
  const bin = path.join(dir, "bin", process.platform === "win32" ? "halo.exe" : "halo");
  if (process.platform !== "win32") {
    // Some package managers drop the executable bit when they unpack.
    try {
      fs.accessSync(bin, fs.constants.X_OK);
    } catch {
      try {
        fs.chmodSync(bin, 0o755);
      } catch {}
    }
  }
  return bin;
}

module.exports = { SCOPE, PLATFORMS, isMusl, platformKey, binaryPath };
