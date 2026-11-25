/**
 * Counting Halo installs: the site Worker's /dl counter (site/worker.ts) and the report that
 * reads it back with GitHub's and npm's counts (scripts/install-stats.ts).
 */

import { describe, expect, test } from "bun:test";
import worker, { viaOf, type Env } from "../site/worker";
import { fillDays, formatStats, installStats } from "../scripts/install-stats";

function site() {
  const points: { blobs?: string[]; doubles?: number[]; indexes?: string[] }[] = [];
  const object = { body: new Blob(["binary"]).stream(), size: 6, httpEtag: '"e"', writeHttpMetadata() {} };
  const env: Env = {
    ASSETS: { fetch: async () => new Response("asset") },
    RELEASES: {
      get: async (key) => (key.startsWith("9.9.9/") ? null : { ...object, body: new Blob(["binary"]).stream() }),
      head: async () => object,
    },
    DOWNLOADS: { writeDataPoint: (p) => void points.push(p) },
  };
  const get = (path: string, init?: RequestInit) => {
    const req = new Request(`https://halolang.com${path}`, init);
    Object.defineProperty(req, "cf", { value: { country: "NZ" } });
    return worker.fetch(req, env);
  };
  return { env, points, get };
}

describe("halolang.com/dl counts binary downloads", () => {
  test("one data point per binary served, with version, platform, channel and country", async () => {
    const s = site();
    expect((await s.get("/dl/0.5.0/halo-darwin-arm64?via=script")).status).toBe(200);
    expect((await s.get("/dl/v0.5.0/halo-linux-x64?via=upgrade")).status).toBe(200);
    expect((await s.get("/dl/0.5.0/halo-windows-x64.exe")).status).toBe(200);
    expect(s.points).toEqual([
      { blobs: ["0.5.0", "halo-darwin-arm64", "script", "NZ"], doubles: [1], indexes: ["halo-darwin-arm64"] },
      { blobs: ["0.5.0", "halo-linux-x64", "upgrade", "NZ"], doubles: [1], indexes: ["halo-linux-x64"] },
      { blobs: ["0.5.0", "halo-windows-x64.exe", "direct", "NZ"], doubles: [1], indexes: ["halo-windows-x64.exe"] },
    ]);
  });

  test("checksums, latest.json, HEAD and misses aren't counted; a broken counter doesn't break the download", async () => {
    const s = site();
    await s.get("/dl/0.5.0/SHA256SUMS");
    await s.get("/dl/latest.json");
    await s.get("/dl/0.5.0/halo-linux-x64", { method: "HEAD" });
    expect((await s.get("/dl/9.9.9/halo-linux-x64")).status).toBe(404);
    expect(s.points).toEqual([]);

    s.env.DOWNLOADS = { writeDataPoint: () => { throw new Error("quota"); } };
    expect((await s.get("/dl/0.5.0/halo-linux-x64")).status).toBe(200);
    s.env.DOWNLOADS = undefined;
    expect((await s.get("/dl/0.5.0/halo-linux-x64")).status).toBe(200);
  });

  test("channels are a short known list", () => {
    const via = (q: string) => viaOf(new URL(`https://halolang.com/dl/0.5.0/halo-linux-x64${q}`));
    expect(["", "?via=", "?via=ci", "?via=action", "?via=%3Cscript%3E", "?via=anything"].map(via)).toEqual(["direct", "direct", "ci", "action", "other", "other"]);
  });
});

describe("scripts/install-stats.ts", () => {
  const today = new Date().toISOString().slice(0, 10);

  function apis() {
    const sql: string[] = [];
    const fetchFn = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/analytics_engine/sql")) {
        expect(new Headers(init?.headers).get("authorization")).toBe("Bearer cf-token");
        const q = String(init?.body);
        sql.push(q);
        const data = q.includes("formatDateTime")
          ? [{ k: today, n: "4" }]
          : q.includes("blob3")
            ? [{ k: "script", n: 3 }, { k: "upgrade", n: 1 }]
            : q.includes("blob2")
              ? [{ k: "halo-darwin-arm64", n: 4 }]
              : q.includes("blob1")
                ? [{ k: "0.5.0", n: 4 }]
                : [{ k: "", n: 4 }];
        return Response.json({ data });
      }
      if (url.startsWith("https://api.github.com/repos/cmjio/halo/releases")) {
        return Response.json([
          { tag_name: "v0.5.0", assets: [{ name: "halo-linux-x64", download_count: 10 }, { name: "SHA256SUMS", download_count: 99 }] },
          { tag_name: "v0.4.0", assets: [{ name: "halo-linux-x64", download_count: 5 }, { name: "halo-darwin-arm64", download_count: 2 }] },
        ]);
      }
      if (url.startsWith("https://api.npmjs.org/downloads/range/")) {
        expect(url.endsWith("/@halolang/halo")).toBe(true);
        return Response.json({ downloads: [{ day: today, downloads: 7 }] });
      }
      return new Response("unexpected", { status: 500 });
    }) as typeof fetch;
    return { sql, fetchFn };
  }

  test("adds up halolang.com/dl, GitHub releases and npm", async () => {
    const { sql, fetchFn } = apis();
    const s = await installStats(30, { CLOUDFLARE_ACCOUNT_ID: "acct", CLOUDFLARE_API_TOKEN: "cf-token" }, fetchFn);
    expect(sql.every((q) => q.includes("SUM(_sample_interval)") && q.includes("INTERVAL '30' DAY") && q.endsWith("FORMAT JSON"))).toBe(true);
    expect(s.site).toMatchObject({ total: 4, byVia: { script: 3, upgrade: 1 }, byAsset: { "halo-darwin-arm64": 4 }, byCountry: { "(unknown)": 4 } });
    if ("skipped" in s.site) throw new Error("site skipped");
    expect(s.site.daily).toHaveLength(30);
    expect(s.site.daily.at(-1)).toEqual({ day: today, count: 4 });
    expect(s.github).toEqual({ total: 17, byVersion: { "0.5.0": 10, "0.4.0": 7 }, byAsset: { "halo-linux-x64": 15, "halo-darwin-arm64": 2 } });
    expect(s.npm).toMatchObject({ total: 7 });

    const text = formatStats(s).join("\n");
    expect(text).toContain("4 downloads");
    expect(text).toContain("by channel   script 3, upgrade 1");
    expect(text).toContain("17 downloads");
  });

  test("without Cloudflare credentials, /dl is skipped and the rest still reports", async () => {
    const { sql, fetchFn } = apis();
    const s = await installStats(7, {}, fetchFn);
    expect(sql).toEqual([]);
    expect((s.site as { skipped: string }).skipped).toContain("CLOUDFLARE_API_TOKEN");
    expect(s.npm).toMatchObject({ total: 7 });
    expect(formatStats(s).join("\n")).toContain("skipped: set CLOUDFLARE_ACCOUNT_ID");
  });

  test("fillDays zero-fills a window ending today", () => {
    const days = fillDays(3, [{ day: today, count: 2 }]);
    expect(days.map((d) => d.count)).toEqual([0, 0, 2]);
    expect(days.at(-1)!.day).toBe(today);
  });
});
