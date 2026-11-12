import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { Glob } from "bun";
import { checkPackageManifest, ManifestError, normalizePackageName, packageDocPath, packageFilePath, parsePackageName } from "../src/registry/contract";
import { compare, defaultRangeFor, isValidRange, maxSatisfying, satisfies, sortDescending } from "../src/registry/semver";

describe("semver", () => {
  const cases: [string, string, boolean][] = [
    ["1.2.3", "^1.2.0", true],
    ["2.0.0", "^1.2.0", false],
    ["1.3.0-beta", "^1.2.0", false],
    ["1.2.3-beta.2", "^1.2.3-beta.1", true],
    ["1.2.4-beta.1", "^1.2.3-beta.1", false],
    ["0.2.5", "^0.2.3", true],
    ["0.3.0", "^0.2.3", false],
    ["0.0.4", "^0.0.3", false],
    ["1.2.9", "~1.2.3", true],
    ["1.3.0", "~1.2.3", false],
    ["1.9.0", "1.x", true],
    ["2.0.0", "1.x", false],
    ["5.0.0", "*", true],
    ["1.5.0", ">=1.0.0 <2.0.0", true],
    ["2.0.0", "1.0.0 - 2.0.0", true],
    ["2.3.9", "1.0.0 - 2.3", true],
    ["2.4.0", "1.0.0 - 2.3", false],
    ["1.0.0", "1.0.0", true],
    ["1.0.1", "1.0.0", false],
    ["3.1.0", "^1.0.0 || ^3.0.0", true],
    ["1.0.0-beta", "1.0.0-beta", true],
    ["1.0.0-beta", ">=1.0.0-0", true],
    ["2.0.0", ">1", true],
    ["1.9.0", ">1", false],
    ["1.9.9", "<=1", true],
    ["2.0.0", "<=1", false],
  ];
  for (const [v, r, want] of cases) test(`${v} ${want ? "satisfies" : "doesn't satisfy"} ${r}`, () => expect(satisfies(v, r)).toBe(want));

  test("precedence follows semver 2.0", () => {
    const order = ["1.0.0-alpha", "1.0.0-alpha.1", "1.0.0-alpha.beta", "1.0.0-beta", "1.0.0-beta.2", "1.0.0-beta.11", "1.0.0-rc.1", "1.0.0"];
    for (let i = 1; i < order.length; i++) expect(compare(order[i - 1]!, order[i]!)).toBeLessThan(0);
    expect(compare("1.0.0+build.1", "1.0.0")).toBe(0);
  });

  test("maxSatisfying skips prereleases and out-of-range versions", () => {
    expect(maxSatisfying(["1.0.0", "1.4.0", "2.0.0", "1.5.0-beta"], "^1.0.0")).toBe("1.4.0");
    expect(maxSatisfying(["1.0.0"], "^2.0.0")).toBeUndefined();
    expect(sortDescending(["1.0.0", "nope", "2.0.0-rc.1", "1.10.0"])).toEqual(["2.0.0-rc.1", "1.10.0", "1.0.0"]);
  });

  test("ranges", () => {
    expect(isValidRange("^1.2")).toBe(true);
    expect(isValidRange("banana")).toBe(false);
    expect(defaultRangeFor("1.2.3")).toBe("^1.2.3");
    expect(defaultRangeFor("2.0.0-beta.1")).toBe("2.0.0-beta.1");
  });
});

describe("names", () => {
  test("scoped names", () => {
    expect(parsePackageName("@acme/support-kit")).toEqual({ full: "@acme/support-kit", scope: "@acme", name: "support-kit" });
    for (const bad of ["acme/kit", "@Acme/kit", "@acme/", "@acme/kit/x", "@acme/.kit", "@acme/kit.", "@/kit", `@a/${"x".repeat(214)}`]) expect(parsePackageName(bad)).toBeUndefined();
    expect(normalizePackageName("stripe")).toBe("@halo/stripe");
    expect(normalizePackageName("@acme/kit")).toBe("@acme/kit");
  });

  test("registry paths", () => {
    expect(packageDocPath("@acme/kit")).toBe("v1/packages/@acme/kit.json");
    expect(packageFilePath("@acme/kit", "1.0.0")).toBe("v1/files/@acme/kit/1.0.0.halotool");
    expect(() => packageDocPath("kit")).toThrow(ManifestError);
  });
});

describe("package manifest", () => {
  const fixtures = join(import.meta.dir, "fixtures/packages");
  for (const dir of readdirSync(fixtures)) {
    test(`fixture ${dir} is a valid package`, () => {
      const root = join(fixtures, dir);
      const files = [...new Glob("**/*").scanSync({ cwd: root, onlyFiles: true })].map((f) => relative(".", f).split("\\").join("/"));
      expect(() => checkPackageManifest(JSON.parse(readFileSync(join(root, "halo.json"), "utf8")), { files })).not.toThrow();
    });
  }

  test("lists every problem", () => {
    const raw = {
      name: "kit",
      version: "1.0",
      description: "",
      exports: ["../x.halo", "lib/missing.halo"],
      models: { Fast: { description: "" } },
      dependencies: { "@acme/kit": "banana", nope: "^1.0.0" },
      hosted: { endpoint: "http://example.com", exports: [] },
    };
    try {
      checkPackageManifest(raw, { files: ["halo.json"] });
      throw new Error("expected ManifestError");
    } catch (err) {
      expect(err).toBeInstanceOf(ManifestError);
      const text = (err as Error).message;
      for (const part of ["scoped name", "semver", "description is required", "../x.halo", "lib/missing.halo is not in the package", "models.Fast", "banana", '"nope"', "hosted.endpoint", "hosted.exports", "README.md is required"]) expect(text).toContain(part);
    }
  });

  test("a package must export something", () => {
    expect(() => checkPackageManifest({ name: "@a/b", version: "1.0.0", description: "x" })).toThrow(/must export something/);
  });

  test("a package can't depend on itself", () => {
    expect(() => checkPackageManifest({ name: "@a/b", version: "1.0.0", description: "x", skills: "skills", dependencies: { "@a/b": "^1.0.0" } })).toThrow(/itself/);
  });
});
