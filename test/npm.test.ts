import { test, expect, describe } from "bun:test";
import { PLATFORMS, platformKey } from "../npm/halo/lib/platform.js";

describe("the npm launcher picks the binary package for the machine", () => {
  test("macOS, Linux (glibc and musl) and Windows", () => {
    expect(platformKey("darwin", "arm64", false)).toBe("darwin-arm64");
    expect(platformKey("darwin", "x64", false)).toBe("darwin-x64");
    expect(platformKey("linux", "x64", false)).toBe("linux-x64");
    expect(platformKey("linux", "arm64", true)).toBe("linux-arm64-musl");
    expect(platformKey("win32", "x64", false)).toBe("win32-x64");
  });

  test("ARM64 Windows runs the x64 build, as install.ps1 does", () => {
    expect(platformKey("win32", "arm64", false)).toBe("win32-x64");
  });

  test("machines with no build get nothing, so the launcher can say how else to install", () => {
    expect(platformKey("freebsd", "x64", false)).toBeUndefined();
    expect(platformKey("linux", "ia32", false)).toBeUndefined();
  });

  test("every npm platform ships an asset the release builds", async () => {
    const release = await Bun.file(`${import.meta.dir}/../scripts/release.ts`).text();
    for (const p of Object.values(PLATFORMS) as Array<{ asset: string }>) expect(release).toContain(`"${p.asset}"`);
  });
});
