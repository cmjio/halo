import { test, expect, describe } from "bun:test";
import { ASSETS, formula, parseSums } from "../scripts/homebrew";

const sha = (c: string) => c.repeat(64);
const SUMS = [
  `${sha("a")}  halo-darwin-arm64`,
  `${sha("b")}  halo-darwin-x64`,
  `${sha("c")}  halo-linux-arm64`,
  `${sha("d")}  halo-linux-x64`,
  `${sha("e")}  halo-windows-x64.exe`,
].join("\n");

describe("the Homebrew formula", () => {
  test("downloads each platform's binary from the GitHub release, with its checksum", () => {
    const rb = formula("1.2.1", parseSums(SUMS));
    expect(rb).toContain("class Halolang < Formula");
    expect(rb).toContain('url "https://github.com/cmjio/halo/releases/download/v1.2.1/halo-darwin-arm64"\n      sha256 "' + sha("a"));
    expect(rb).toContain('url "https://github.com/cmjio/halo/releases/download/v1.2.1/halo-linux-x64"\n      sha256 "' + sha("d"));
    expect(rb).toContain('HALO_INSTALLED_BY: "homebrew"');
  });

  test("refuses prereleases, nightlies and missing binaries", () => {
    expect(() => formula("1.3.0-next.1", parseSums(SUMS))).toThrow(/stable/);
    expect(() => formula("1.2.1-nightly.20261113.g9172379", parseSums(SUMS))).toThrow(/stable/);
    expect(() => formula("1.2.1", parseSums(SUMS.split("\n").slice(1).join("\n")))).toThrow(/halo-darwin-arm64/);
  });

  test("uses only files the release builds", async () => {
    const release = await Bun.file(`${import.meta.dir}/../scripts/release.ts`).text();
    for (const os of Object.values(ASSETS)) for (const file of Object.values(os)) expect(release).toContain(`"${file}"`);
  });

  test("halo upgrade knows about Homebrew installs", async () => {
    const cli = await Bun.file(`${import.meta.dir}/../src/cli.ts`).text();
    expect(cli).toContain('by === "homebrew"');
  });
});
