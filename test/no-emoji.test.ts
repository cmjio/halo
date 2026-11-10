// No emojis anywhere in the repo. Web UIs use Tabler icons (site/src/icons.ts in the site
// and playground, @tabler/icons-react in Studio); terminal output and docs use plain text
// symbols such as ✓ ✗ ‖ ■ ⊘ ▸, which aren't emoji.

import { test, expect } from "bun:test";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const EMOJI = /[\p{Extended_Pictographic}\u{FE0F}]/u;
const BINARY = /\.(mp4|jpg|jpeg|png|gif|webp|ico|woff2?|wasm)$/;

test("no file in the repo contains an emoji", async () => {
  const files = (await Bun.$`git ls-files -co --exclude-standard`.cwd(root).text()).split("\n").filter((f) => f && !BINARY.test(f));
  const found: string[] = [];
  for (const f of files) {
    const file = Bun.file(resolve(root, f));
    if (!(await file.exists())) continue;
    (await file.text()).split("\n").forEach((line, i) => {
      const m = line.match(EMOJI);
      if (m) found.push(`${f}:${i + 1}: ${m[0]}`);
    });
  }
  expect(found).toEqual([]);
});
