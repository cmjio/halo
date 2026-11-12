/**
 * Package stats for publishers (and anyone else; downloads were already public):
 * downloads by day and by version from `downloads_daily`, and the packages that build on this
 * one, directly or through other packages, with a shortest dependency chain for each.
 *
 * Dependents count each package's latest version only (what a fresh `halo add` would pull),
 * not every version ever published, so a package that dropped a dependency stops counting.
 */

import { STATS_MAX_DEPENDENTS, type Dependent, type PackageStats } from "../../../src/registry/contract.ts";
import { satisfies, sortDescending } from "../../../src/registry/semver.ts";
import type { Env } from "./env.ts";
import { cached, fail, json } from "./http.ts";

/** Stats move all day and carry no revision; five minutes stale is fine for them. */
export const STATS_TTL = 300;

const DAY_MS = 86_400_000;
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function statsDays(text: string | null): number {
  const n = text === null || text === "" ? NaN : Number(text);
  return Number.isInteger(n) ? Math.min(365, Math.max(1, n)) : 30;
}

export async function getStats(env: Env, name: string, url: URL): Promise<Response> {
  const days = statsDays(url.searchParams.get("days"));
  return cached(
    env,
    `v1/packages/${name}/stats?days=${days}`,
    async () => {
      const stats = await packageStats(env, name, days);
      if (!stats) return fail(404, "not_found", `No package ${name}`);
      return json(stats);
    },
    { ttl: STATS_TTL },
  );
}

export async function packageStats(env: Env, name: string, days = 30, today = Date.now()): Promise<PackageStats | undefined> {
  const pkg = await env.DB.prepare(
    `SELECT p.id, (SELECT version FROM dist_tags d WHERE d.package_id = p.id AND d.tag = 'latest') AS latest FROM packages p WHERE p.name = ?`,
  )
    .bind(name)
    .first<{ id: number; latest: string | null }>();
  if (!pkg) return undefined;

  // The window is `days` long and ends today; last7 and last30 come from the same rows.
  const start = (n: number) => isoDay(today - (n - 1) * DAY_MS);
  const since = start(days);
  const earliest = start(Math.max(days, 30));
  const [versions, perVersion, perDay, dependents] = await Promise.all([
    env.DB.prepare(`SELECT version FROM versions WHERE package_id = ?`).bind(pkg.id).all<{ version: string }>(),
    env.DB.prepare(
      `SELECT version, SUM(count) AS total, SUM(CASE WHEN day >= ? THEN count ELSE 0 END) AS period
       FROM downloads_daily WHERE package_id = ? GROUP BY version`,
    )
      .bind(since, pkg.id)
      .all<{ version: string; total: number; period: number }>(),
    env.DB.prepare(`SELECT day, SUM(count) AS count FROM downloads_daily WHERE package_id = ? AND day >= ? GROUP BY day`)
      .bind(pkg.id, earliest)
      .all<{ day: string; count: number }>(),
    dependentsOf(env, name, pkg.latest),
  ]);

  const counted = new Map(perVersion.results.map((r) => [r.version, r]));
  const byDay = new Map(perDay.results.map((r) => [r.day, r.count]));
  const sumSince = (from: string) => perDay.results.reduce((n, r) => n + (r.day >= from ? r.count : 0), 0);
  const daily = Array.from({ length: days }, (_, i) => {
    const day = isoDay(today - (days - 1 - i) * DAY_MS);
    return { day, count: byDay.get(day) ?? 0 };
  });
  return {
    name,
    latest: pkg.latest ?? "",
    days,
    downloads: {
      total: perVersion.results.reduce((n, r) => n + r.total, 0),
      last7: sumSince(start(7)),
      last30: sumSince(start(30)),
      period: daily.reduce((n, d) => n + d.count, 0),
      daily,
      versions: sortDescending(versions.results.map((r) => r.version)).map((version) => ({
        version,
        total: counted.get(version)?.total ?? 0,
        period: counted.get(version)?.period ?? 0,
      })),
    },
    dependents,
  };
}

interface Edge {
  src: string;
  version: string;
  dep: string;
  range: string;
}

/**
 * Every package that reaches `name` through its latest version's dependencies, nearest first.
 * SQL finds the edges that matter (a recursive walk up from `name`; UNION stops it at cycles),
 * then a breadth-first search over them gives each dependent its depth and a shortest chain.
 */
export async function dependentsOf(env: Env, name: string, latest: string | null): Promise<PackageStats["dependents"]> {
  const { results: edges } = await env.DB.prepare(
    `WITH RECURSIVE
       edges(src, version, dep, range) AS (
         SELECT p.name, v.version, j.key, j.value
         FROM packages p
         JOIN dist_tags d ON d.package_id = p.id AND d.tag = 'latest'
         JOIN versions v ON v.package_id = p.id AND v.version = d.version
         JOIN json_each(v.dependencies) j
       ),
       reach(name) AS (
         SELECT ?
         UNION
         SELECT e.src FROM edges e JOIN reach r ON e.dep = r.name
       )
     SELECT src, version, dep, range FROM edges WHERE dep IN (SELECT name FROM reach)`,
  )
    .bind(name)
    .all<Edge>();

  const users = new Map<string, Edge[]>();
  for (const e of edges) users.set(e.dep, [...(users.get(e.dep) ?? []), e]);
  // Each dependent's next hop toward `name`, found breadth-first so chains are shortest.
  const found = new Map<string, { edge: Edge; depth: number }>();
  let frontier = [name];
  for (let depth = 1; frontier.length; depth++) {
    const next: string[] = [];
    for (const dep of frontier) {
      for (const e of (users.get(dep) ?? []).sort((a, b) => a.src.localeCompare(b.src))) {
        if (e.src === name || found.has(e.src)) continue;
        found.set(e.src, { edge: e, depth });
        next.push(e.src);
      }
    }
    frontier = next;
  }

  const chainOf = (from: string): string[] => {
    const chain = [from];
    for (let at = from; at !== name; ) chain.push((at = found.get(at)!.edge.dep));
    return chain;
  };
  const all: Dependent[] = [...found.entries()]
    .sort(([a, x], [b, y]) => x.depth - y.depth || a.localeCompare(b))
    .map(([src, { edge, depth }]) => ({
      name: src,
      version: edge.version,
      depth,
      chain: chainOf(src),
      ...(depth === 1 ? { range: edge.range, ...(latest ? { onLatest: safeSatisfies(latest, edge.range) } : {}) } : {}),
    }));
  return {
    direct: all.filter((d) => d.depth === 1).length,
    transitive: all.length,
    packages: all.slice(0, STATS_MAX_DEPENDENTS),
  };
}

function safeSatisfies(version: string, range: string): boolean {
  try {
    return satisfies(version, range);
  } catch {
    return false;
  }
}
