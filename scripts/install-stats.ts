/**
 * How many times Halo has been installed, from every place it ships:
 *
 *   halolang.com/dl   install.sh, install.ps1, `halo upgrade` and the GitHub Action. Counted by
 *                     site/worker.ts in Workers Analytics Engine (dataset halo_downloads), by
 *                     version, platform, channel (script, ci, action, upgrade, direct) and country.
 *                     Needs CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN (Account Analytics: Read).
 *                     Analytics Engine keeps 90 days, so this window is at most 90 days.
 *   GitHub releases   the binaries attached to each release: all-time counts only (GitHub keeps no
 *                     dates). GITHUB_TOKEN is optional (higher rate limit).
 *   npm               @halolang/halo, from api.npmjs.org (public).
 *   ghcr.io           GitHub shows pulls on the package page but has no API for them.
 *
 *   bun scripts/install-stats.ts [--days 30] [--json]
 *
 * These are downloads, not people: a CI job that installs on every run counts every run (the
 * GitHub Action caches the binary per version and runner, so it counts once per cache miss).
 */

const REPO = "cmjio/halo";
const NPM_PACKAGE = "@halolang/halo";
const DATASET = "halo_downloads";
const MAX_DAYS = 90;

type Fetch = typeof fetch;
type Counts = Record<string, number>;

export interface SiteStats {
  total: number;
  byVia: Counts;
  byAsset: Counts;
  byVersion: Counts;
  byCountry: Counts;
  daily: { day: string; count: number }[];
}

export interface InstallStats {
  days: number;
  site: SiteStats | { skipped: string };
  github: { total: number; byVersion: Counts; byAsset: Counts } | { skipped: string };
  npm: { total: number; daily: { day: string; count: number }[] } | { skipped: string };
}

const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Rows of [key, n] into a record, biggest first. */
const tally = (rows: { k: string; n: number | string }[]): Counts =>
  Object.fromEntries(rows.map((r) => [r.k || "(unknown)", Number(r.n)] as const).sort((a, b) => b[1] - a[1]));

export async function siteStats(days: number, env: Record<string, string | undefined>, fetchFn: Fetch = fetch): Promise<SiteStats | { skipped: string }> {
  const account = env.CLOUDFLARE_ACCOUNT_ID;
  const token = env.CLOUDFLARE_API_TOKEN;
  if (!account || !token) return { skipped: "set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN (Account Analytics: Read) to read halolang.com/dl counts" };
  const query = async (sql: string) => {
    const res = await fetchFn(`https://api.cloudflare.com/client/v4/accounts/${account}/analytics_engine/sql`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: `${sql} FORMAT JSON`,
    });
    if (!res.ok) throw new Error(`Analytics Engine query failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
    return ((await res.json()) as { data: { k: string; n: number | string }[] }).data;
  };
  // Sampled at high volume: SUM(_sample_interval) is the count.
  const where = `WHERE timestamp > NOW() - INTERVAL '${days}' DAY`;
  const by = (col: string) => query(`SELECT ${col} AS k, SUM(_sample_interval) AS n FROM ${DATASET} ${where} GROUP BY k`);
  const [via, asset, version, country, daily] = await Promise.all([
    by("blob3"),
    by("blob2"),
    by("blob1"),
    by("blob4"),
    query(`SELECT formatDateTime(timestamp, '%Y-%m-%d') AS k, SUM(_sample_interval) AS n FROM ${DATASET} ${where} GROUP BY k ORDER BY k`),
  ]);
  return {
    total: via.reduce((n, r) => n + Number(r.n), 0),
    byVia: tally(via),
    byAsset: tally(asset),
    byVersion: tally(version),
    byCountry: tally(country),
    daily: fillDays(days, daily.map((r) => ({ day: r.k, count: Number(r.n) }))),
  };
}

export async function githubStats(env: Record<string, string | undefined>, fetchFn: Fetch = fetch): Promise<InstallStats["github"]> {
  const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (env.GITHUB_TOKEN) headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
  const byVersion: Counts = {};
  const byAsset: Counts = {};
  for (let page = 1; page <= 10; page++) {
    const res = await fetchFn(`https://api.github.com/repos/${REPO}/releases?per_page=100&page=${page}`, { headers });
    if (!res.ok) return { skipped: `GitHub answered ${res.status} (set GITHUB_TOKEN if it's the rate limit)` };
    const releases = (await res.json()) as { tag_name: string; assets: { name: string; download_count: number }[] }[];
    for (const r of releases) {
      for (const a of r.assets) {
        if (a.name === "SHA256SUMS") continue;
        const v = r.tag_name.replace(/^v/, "");
        byVersion[v] = (byVersion[v] ?? 0) + a.download_count;
        byAsset[a.name] = (byAsset[a.name] ?? 0) + a.download_count;
      }
    }
    if (releases.length < 100) break;
  }
  const sorted = (c: Counts) => Object.fromEntries(Object.entries(c).sort((a, b) => b[1] - a[1]));
  return { total: Object.values(byAsset).reduce((n, x) => n + x, 0), byVersion: sorted(byVersion), byAsset: sorted(byAsset) };
}

export async function npmStats(days: number, fetchFn: Fetch = fetch, today = Date.now()): Promise<InstallStats["npm"]> {
  const range = `${isoDay(today - (days - 1) * 86_400_000)}:${isoDay(today)}`;
  const res = await fetchFn(`https://api.npmjs.org/downloads/range/${range}/${NPM_PACKAGE}`);
  if (res.status === 404) return { skipped: `${NPM_PACKAGE} has no downloads on record yet` };
  if (!res.ok) return { skipped: `npm answered ${res.status}` };
  const body = (await res.json()) as { downloads: { day: string; downloads: number }[] };
  const daily = body.downloads.map((d) => ({ day: d.day, count: d.downloads }));
  return { total: daily.reduce((n, d) => n + d.count, 0), daily };
}

/** One entry per day of the window, ending today, zeros included. */
export function fillDays(days: number, rows: { day: string; count: number }[], today = Date.now()): { day: string; count: number }[] {
  const by = new Map(rows.map((r) => [r.day, r.count]));
  return Array.from({ length: days }, (_, i) => {
    const day = isoDay(today - (days - 1 - i) * 86_400_000);
    return { day, count: by.get(day) ?? 0 };
  });
}

export async function installStats(days: number, env: Record<string, string | undefined> = Bun.env, fetchFn: Fetch = fetch): Promise<InstallStats> {
  const settle = async <T>(p: Promise<T>): Promise<T | { skipped: string }> => p.catch((e: unknown) => ({ skipped: e instanceof Error ? e.message : String(e) }));
  const [site, github, npm] = await Promise.all([settle(siteStats(days, env, fetchFn)), settle(githubStats(env, fetchFn)), settle(npmStats(days, fetchFn))]);
  return { days, site, github, npm };
}

// ── Printing ──

const SPARK = "▁▂▃▄▅▆▇█";
const spark = (counts: number[]) => {
  const max = Math.max(0, ...counts);
  return counts.map((c) => (c && max ? SPARK[Math.min(7, Math.ceil((c / max) * 8) - 1)] : "·")).join("");
};
const num = (n: number) => n.toLocaleString("en-US");
const top = (c: Counts, n = 8) =>
  Object.entries(c)
    .slice(0, n)
    .map(([k, v]) => `${k} ${num(v)}`)
    .join(", ") + (Object.keys(c).length > n ? ", …" : "");

export function formatStats(s: InstallStats): string[] {
  const out: string[] = [`Halo installs, last ${s.days} days unless noted`, ""];
  out.push("halolang.com/dl (install.sh, install.ps1, halo upgrade, GitHub Action)");
  if ("skipped" in s.site) out.push(`  skipped: ${s.site.skipped}`);
  else {
    out.push(`  ${num(s.site.total)} downloads  ${spark(s.site.daily.map((d) => d.count))}`);
    out.push(`  by channel   ${top(s.site.byVia)}`);
    out.push(`  by platform  ${top(s.site.byAsset)}`);
    out.push(`  by version   ${top(s.site.byVersion)}`);
    out.push(`  by country   ${top(s.site.byCountry)}`);
  }
  out.push("", `npm (${NPM_PACKAGE})`);
  if ("skipped" in s.npm) out.push(`  skipped: ${s.npm.skipped}`);
  else out.push(`  ${num(s.npm.total)} downloads  ${spark(s.npm.daily.map((d) => d.count))}`);
  out.push("", "GitHub release binaries (all time)");
  if ("skipped" in s.github) out.push(`  skipped: ${s.github.skipped}`);
  else {
    out.push(`  ${num(s.github.total)} downloads`);
    out.push(`  by version   ${top(s.github.byVersion)}`);
  }
  out.push("", `ghcr.io/${REPO}: pulls are on https://github.com/${REPO}/pkgs/container/halo (no API)`);
  out.push("", "Downloads, not people: CI that installs on every run counts every run.");
  return out;
}

if (import.meta.main) {
  const args = Bun.argv.slice(2);
  const at = args.indexOf("--days");
  const days = at >= 0 ? Number(args[at + 1]) : 30;
  if (!Number.isInteger(days) || days < 1 || days > MAX_DAYS) {
    console.error(`--days is a whole number from 1 to ${MAX_DAYS} (Analytics Engine keeps ${MAX_DAYS} days)`);
    process.exit(1);
  }
  const stats = await installStats(days);
  console.log(args.includes("--json") ? JSON.stringify(stats, null, 2) : formatStats(stats).join("\n"));
}
