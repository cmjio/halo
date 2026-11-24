import { expect, test } from "bun:test";

test("robots.txt has a User-agent group, allows the site, and points at the sitemap", async () => {
  const text = await Bun.file(new URL("../docs/public/robots.txt", import.meta.url)).text();
  const lines = text.split("\n").map((l) => l.replace(/#.*/, "").trim()).filter(Boolean);
  expect(lines[0]).toBe("User-agent: *");
  expect(lines).toContain("Allow: /");
  expect(lines).toContain("Disallow: /dl/");
  expect(lines).toContain("Sitemap: https://halolang.com/sitemap.xml");
});
