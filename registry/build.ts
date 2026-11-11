/**
 * Rebuild the bundled registry: pack every package in src/ and publish new versions into
 * the static v2 layout (v1/index.json, v1/packages/@halo/<name>.json,
 * v1/files/@halo/<name>/<version>.halotool). A checkout of Halo reads this folder as its
 * default registry; the site copies it to halolang.com/registry/.
 *
 * index.json and packages/ are the v1 registry, frozen for Halo 0.8 and older (which read
 * halolang.com/registry/index.json). Nothing updates them any more.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { packageDocPath, type PackageDoc } from "../src/registry/contract.ts";
import { pack } from "../src/registry/format.ts";
import { RegistryClient } from "../src/registry/client.ts";

const root = import.meta.dir;
const registry = new RegistryClient(root);
for (const dir of readdirSync(join(root, "src")).sort()) {
  const { bytes, pkg } = pack(join(root, "src", dir));
  const docPath = join(root, packageDocPath(pkg.name));
  const doc: PackageDoc | undefined = existsSync(docPath) ? JSON.parse(readFileSync(docPath, "utf8")) : undefined;
  const published = doc?.versions[pkg.version];
  if (published) {
    const old = readFileSync(join(root, published.file));
    if (!old.equals(Buffer.from(bytes))) console.warn(`! ${pkg.name}@${pkg.version} changed but kept its version; bump it to publish`);
    continue;
  }
  await registry.publish(bytes);
  console.log(`published ${pkg.name}@${pkg.version}`);
}
