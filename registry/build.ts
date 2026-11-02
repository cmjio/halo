/** Rebuild the bundled registry: pack every package in src/ and publish new versions to index.json. */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pack, publish, readRegistry } from "../src/registry/packages.ts";

const root = import.meta.dir;
const index = join(root, "index.json");
const published = existsSync(index) ? await readRegistry(index) : undefined;
for (const name of readdirSync(join(root, "src")).sort()) {
  const dir = join(root, "src", name);
  const { bytes, manifest } = pack(dir);
  if (published?.packages[manifest.name]?.versions[manifest.version]) {
    const old = readFileSync(join(root, published.packages[manifest.name]!.versions[manifest.version]!.file));
    if (!old.equals(Buffer.from(bytes))) console.warn(`! ${manifest.name}@${manifest.version} changed but kept its version; bump it to publish`);
    continue;
  }
  const out = join(root, "build", `${manifest.name}-${manifest.version}.halotool`);
  await Bun.write(out, bytes);
  publish(out, index);
  console.log(`published ${manifest.name}@${manifest.version}`);
}
