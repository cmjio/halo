import { describe, expect, test } from "bun:test";
import { channelOf, nightlyVersion } from "../src/channel";
import { isDownloadKey } from "../site/worker";

describe("a version's channel", () => {
  test("a plain version is latest", () => {
    expect(channelOf("1.2.0")).toBe("latest");
    expect(channelOf("v1.2.0")).toBe("latest");
    expect(channelOf("1.2.0+build.5")).toBe("latest");
  });

  test("any prerelease is next", () => {
    expect(channelOf("1.3.0-next.1")).toBe("next");
    expect(channelOf("1.3.0-rc.2")).toBe("next");
    expect(channelOf("v2.0.0-beta.1")).toBe("next");
  });

  test("a nightly is nightly", () => {
    expect(channelOf("1.2.1-nightly.20261113.g9172379")).toBe("nightly");
    expect(channelOf(nightlyVersion("1.2.0", new Date(), "abc1234"))).toBe("nightly");
  });
});

describe("nightly versions", () => {
  const day = new Date("2026-11-13T04:23:00Z");

  test("follow a release with the next patch", () => {
    expect(nightlyVersion("1.2.0", day, "9172379c0ffee")).toBe("1.2.1-nightly.20261113.g9172379");
  });

  test("lead up to the release a prerelease is heading for", () => {
    expect(nightlyVersion("1.3.0-next.2", day, "9172379")).toBe("1.3.0-nightly.20261113.g9172379");
  });

  test("are valid semver that sorts after the release before them and by date", () => {
    const v = nightlyVersion("1.2.0", day, "0123456");
    expect(v).toBe("1.2.1-nightly.20261113.g0123456"); // a leading zero is fine behind the "g"
    expect(Bun.semver.order(v, "1.2.0")).toBe(1);
    expect(Bun.semver.order(v, "1.2.1")).toBe(-1);
    expect(Bun.semver.order(nightlyVersion("1.2.0", new Date("2026-11-14"), "0000000"), v)).toBe(1);
  });

  test("refuse something that isn't a version", () => {
    expect(() => nightlyVersion("main", day, "abc")).toThrow();
  });
});

describe("halolang.com/dl serves", () => {
  test("each channel's pointer", () => {
    for (const c of ["latest", "next", "nightly"]) expect(isDownloadKey(`${c}.json`)).toBe(true);
    expect(isDownloadKey("beta.json")).toBe(false);
  });

  test("the files of release, prerelease and nightly versions", () => {
    expect(isDownloadKey("1.2.0/halo-linux-x64")).toBe(true);
    expect(isDownloadKey("1.3.0-next.1/SHA256SUMS")).toBe(true);
    expect(isDownloadKey("1.2.1-nightly.20261113.g9172379/halo-windows-x64.exe")).toBe(true);
    expect(isDownloadKey("../secrets")).toBe(false);
  });
});
