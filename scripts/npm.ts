/**
 * Build the npm packages for a release, and publish them.
 *
 *   bun scripts/npm.ts                     into dist/npm, from dist/release/<version>
 *   bun scripts/npm.ts --from <dir>        from binaries somewhere else (named as in the release)
 *   bun scripts/npm.ts --only linux-x64    just these platforms (comma-separated), e.g. for CI
 *   bun scripts/npm.ts --publish           build, then npm publish each one not yet published
 *
 * @halolang/halo is a small Node launcher (npm/halo). Each platform's binary is its own
 * package, @halolang/halo-<platform>, limited by os, cpu and libc, and listed as an optional
 * dependency, so npm installs only the one for the machine (the way esbuild ships).
 * Platform packages are published first, so the launcher never points at a missing version.
 */

import { chmodSync, cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import pkg from "../package.json" with { type: "json" };
// Plain CommonJS shared with the launcher, so both use one table.
import { PLATFORMS, SCOPE } from "../npm/halo/lib/platform.js";

type Platform = { asset: string; os: string; cpu: string; libc?: string };
const platforms = PLATFORMS as Record<string, Platform>;

const root = resolve(import.meta.dir, "..");
const version = pkg.version;
const argv = process.argv.slice(2);
const opt = (name: string) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const from = resolve(root, opt("--from") ?? join("dist/release", version));
const out = join(root, "dist/npm");
const only = opt("--only")?.split(",").map((s) => s.trim());
const keys = Object.keys(platforms).filter((k) => !only || only.includes(k));
if (only) for (const k of only) if (!platforms[k]) throw new Error(`Unknown platform ${k}; known: ${Object.keys(platforms).join(", ")}`);

const common = {
  version,
  license: "MIT",
  homepage: "https://halolang.com",
  repository: { type: "git", url: "git+https://github.com/cmjio/halo.git" },
};

rmSync(out, { recursive: true, force: true });

for (const key of keys) {
  const p = platforms[key];
  const src = join(from, p.asset);
  if (!existsSync(src)) throw new Error(`No ${p.asset} in ${from}. Build the release first (bun scripts/release.ts --no-upload).`);
  const dir = join(out, `halo-${key}`);
  const exe = p.os === "win32" ? "halo.exe" : "halo";
  mkdirSync(join(dir, "bin"), { recursive: true });
  cpSync(src, join(dir, "bin", exe));
  chmodSync(join(dir, "bin", exe), 0o755);
  await Bun.write(
    join(dir, "package.json"),
    JSON.stringify(
      {
        name: `${SCOPE}/halo-${key}`,
        description: `The halo binary for ${key}. Install @halolang/halo instead; it picks this one for you.`,
        ...common,
        os: [p.os],
        cpu: [p.cpu],
        ...(p.libc ? { libc: [p.libc] } : {}),
        files: ["bin"],
        preferUnplugged: true,
      },
      null,
      2,
    ) + "\n",
  );
  await Bun.write(join(dir, "README.md"), `# ${SCOPE}/halo-${key}\n\nThe \`halo\` binary for ${key}. Install [@halolang/halo](https://www.npmjs.com/package/@halolang/halo) instead: it installs the right one of these for your machine.\n`);
}

const main = join(out, "halo");
cpSync(join(root, "npm/halo"), main, { recursive: true });
chmodSync(join(main, "bin/halo.js"), 0o755);
await Bun.write(
  join(main, "package.json"),
  JSON.stringify(
    {
      name: `${SCOPE}/halo`,
      description: pkg.description,
      ...common,
      keywords: pkg.keywords,
      bin: { halo: "bin/halo.js" },
      files: ["bin", "lib"],
      engines: { node: ">=18" },
      optionalDependencies: Object.fromEntries(keys.map((k) => [`${SCOPE}/halo-${k}`, version])),
    },
    null,
    2,
  ) + "\n",
);
console.log(`Built ${keys.length + 1} npm packages for ${version} in ${out}`);

if (argv.includes("--publish")) {
  const published = (name: string) => Bun.spawnSync(["npm", "view", `${name}@${version}`, "version"], { stdout: "pipe", stderr: "pipe" }).stdout.toString().trim() === version;
  const provenance = process.env.GITHUB_ACTIONS ? ["--provenance"] : [];
  for (const dir of [...keys.map((k) => `halo-${k}`), "halo"]) {
    const name = `${SCOPE}/${dir}`;
    if (published(name)) {
      console.log(`  ${name}@${version} is already published`);
      continue;
    }
    const p = Bun.spawnSync(["npm", "publish", "--access", "public", ...provenance], { cwd: join(out, dir), stdout: "inherit", stderr: "inherit" });
    if (p.exitCode !== 0) throw new Error(`npm publish ${name} failed (${p.exitCode})`);
    console.log(`  published ${name}@${version}`);
  }
}
