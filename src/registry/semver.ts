/**
 * Semantic versions and ranges, with npm's semantics.
 *
 * Pure (no Node or Bun APIs), so the registry Worker uses it too.
 *
 * Ranges: `1.2.3`, `=1.2.3`, `^1.2.3`, `~1.2.3`, `>=1.2.0 <2.0.0`, `1.x`, `1.2.*`, `*`,
 * `1.2.3 - 2.0.0`, and any of those joined with `||`.
 *
 * A prerelease (`2.0.0-beta.1`) satisfies a range only when one of the range's
 * comparators names a prerelease of the same major.minor.patch, as on npm, so
 * `^1.2.0` never picks up `1.3.0-beta`. Pass `{ includePrerelease: true }` to drop that rule
 * and compare a prerelease by its order alone, as npm does when it checks `engines`.
 */

export interface SemVer {
  major: number;
  minor: number;
  patch: number;
  prerelease: (string | number)[];
  build: string[];
  raw: string;
}

const NUM = "0|[1-9]\\d*";
const PRE_ID = `(?:${NUM}|\\d*[A-Za-z-][0-9A-Za-z-]*)`;
const VERSION_RE = new RegExp(`^v?(${NUM})\\.(${NUM})\\.(${NUM})(?:-(${PRE_ID}(?:\\.${PRE_ID})*))?(?:\\+([0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*))?$`);

export function parseVersion(text: string): SemVer | undefined {
  const m = VERSION_RE.exec(text.trim());
  if (!m) return undefined;
  const nums = [m[1], m[2], m[3]].map(Number);
  if (nums.some((n) => !Number.isSafeInteger(n))) return undefined;
  return {
    major: nums[0]!,
    minor: nums[1]!,
    patch: nums[2]!,
    prerelease: m[4] ? m[4].split(".").map((p) => (/^\d+$/.test(p) ? Number(p) : p)) : [],
    build: m[5] ? m[5].split(".") : [],
    raw: text.trim().replace(/^v/, ""),
  };
}

export function isValidVersion(text: string): boolean {
  return !!parseVersion(text);
}

/**
 * A version as a package may publish it: exactly `MAJOR.MINOR.PATCH[-PRERELEASE]`, with no
 * leading `v`, no surrounding whitespace, and no build metadata (`+...`). parseVersion accepts
 * those (they're harmless in ranges and on the command line), but two spellings of one version
 * must never be two versions in a registry.
 */
export function isCanonicalVersion(text: string): boolean {
  const v = parseVersion(text);
  return !!v && v.raw === text && !v.build.length;
}

/** Same precedence: canonical spellings first, then by text, so sorting never depends on input order. */
function tiebreak(a: string, b: string): number {
  const ca = isCanonicalVersion(a);
  const cb = isCanonicalVersion(b);
  if (ca !== cb) return ca ? -1 : 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Precedence order: negative when a < b. Build metadata is ignored. Throws on invalid versions. */
export function compare(a: string | SemVer, b: string | SemVer): number {
  const x = typeof a === "string" ? must(a) : a;
  const y = typeof b === "string" ? must(b) : b;
  return x.major - y.major || x.minor - y.minor || x.patch - y.patch || comparePre(x.prerelease, y.prerelease);
}

function must(v: string): SemVer {
  const p = parseVersion(v);
  if (!p) throw new Error(`Invalid version: ${v}`);
  return p;
}

function comparePre(a: (string | number)[], b: (string | number)[]): number {
  if (!a.length || !b.length) return a.length ? -1 : b.length ? 1 : 0;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i];
    const y = b[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    if (x === y) continue;
    if (typeof x === "number" && typeof y === "number") return x - y;
    if (typeof x === "number") return -1;
    if (typeof y === "number") return 1;
    return x < y ? -1 : 1;
  }
  return 0;
}

export const isPrerelease = (v: string) => (parseVersion(v)?.prerelease.length ?? 0) > 0;

// ── Ranges ──

type Op = "<" | "<=" | ">" | ">=" | "=";
interface Comparator {
  op: Op;
  v: SemVer;
  /** An upper bound Halo added (x.y.z-0), not one the range wrote. */
  internal?: true;
}
/** A range is OR of AND-sets of comparators. An empty AND-set matches any version. */
export type Range = Comparator[][];

const PARTIAL = /^v?(\*|x|X|\d+)(?:\.(\*|x|X|\d+))?(?:\.(\*|x|X|\d+))?(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

interface Partial {
  major?: number;
  minor?: number;
  patch?: number;
  pre: string;
}

function partial(text: string): Partial | undefined {
  const m = PARTIAL.exec(text);
  if (!m) return undefined;
  const n = (s?: string) => (s === undefined || /^[*xX]$/.test(s) ? undefined : Number(s));
  const major = n(m[1]);
  const minor = major === undefined ? undefined : n(m[2]);
  const patch = minor === undefined ? undefined : n(m[3]);
  return { major, minor, patch, pre: patch === undefined ? "" : (m[4] ?? "") };
}

const ver = (major: number, minor: number, patch: number, pre = ""): SemVer => must(`${major}.${minor}.${patch}${pre ? `-${pre}` : ""}`);
/** The exclusive upper bound below every prerelease of a version. */
const below = (major: number, minor: number, patch: number): Comparator => ({ op: "<", v: ver(major, minor, patch, "0"), internal: true });

/** Expand one token (`^1.2`, `>=1.0.0`, `1.x`) into comparators. */
function expand(token: string): Comparator[] {
  const m = /^(\^|~>?|>=|<=|>|<|=)?\s*(.*)$/.exec(token)!;
  const op = m[1] ?? "";
  const p = partial(m[2]!);
  if (!p) throw new Error(`Invalid range part: ${token}`);
  const { major, minor, patch, pre } = p;
  if (major === undefined) return op === "<" || op === ">" ? [below(0, 0, 0)] : [];
  const lo = ver(major, minor ?? 0, patch ?? 0, pre);
  switch (op) {
    case "^": {
      const hi = major > 0 || minor === undefined ? below(major + 1, 0, 0) : minor > 0 || patch === undefined ? below(0, minor + 1, 0) : below(0, 0, patch + 1);
      return [{ op: ">=", v: lo }, hi];
    }
    case "~":
    case "~>": {
      const hi = minor === undefined ? below(major + 1, 0, 0) : below(major, minor + 1, 0);
      return [{ op: ">=", v: lo }, hi];
    }
    case "":
    case "=": {
      if (patch !== undefined) return [{ op: "=", v: lo }];
      const hi = minor === undefined ? below(major + 1, 0, 0) : below(major, minor + 1, 0);
      return [{ op: ">=", v: lo }, hi];
    }
    case ">":
      if (patch !== undefined) return [{ op: ">", v: lo }];
      return [{ op: ">=", v: minor === undefined ? ver(major + 1, 0, 0) : ver(major, minor + 1, 0) }];
    case ">=":
      return [{ op: ">=", v: lo }];
    case "<":
      return [patch !== undefined ? { op: "<", v: lo } : below(major, minor ?? 0, 0)];
    case "<=":
      if (patch !== undefined) return [{ op: "<=", v: lo }];
      return [minor === undefined ? below(major + 1, 0, 0) : below(major, minor + 1, 0)];
  }
  throw new Error(`Invalid range part: ${token}`);
}

export function parseRange(text: string): Range {
  const trimmed = text.trim();
  if (!trimmed || trimmed === "latest") return [[]];
  return trimmed.split("||").map((alt) => {
    const s = alt.trim().replace(/(\^|~>?|>=|<=|>|<|=)\s+/g, "$1");
    const hyphen = /^(\S+)\s+-\s+(\S+)$/.exec(s);
    if (hyphen) {
      return [...expand(`>=${hyphen[1]}`), ...expand(`<=${hyphen[2]}`)];
    }
    return s ? s.split(/\s+/).flatMap(expand) : [];
  });
}

export function isValidRange(text: string): boolean {
  try {
    parseRange(text);
    return true;
  } catch {
    return false;
  }
}

function test(c: Comparator, v: SemVer): boolean {
  const d = compare(v, c.v);
  switch (c.op) {
    case "<":
      return d < 0;
    case "<=":
      return d <= 0;
    case ">":
      return d > 0;
    case ">=":
      return d >= 0;
    case "=":
      return d === 0;
  }
}

export function satisfies(version: string, range: string | Range, opts: { includePrerelease?: boolean } = {}): boolean {
  const v = parseVersion(version);
  if (!v) return false;
  const r = typeof range === "string" ? parseRange(range) : range;
  return r.some((set) => {
    if (!set.every((c) => test(c, v))) return false;
    if (!v.prerelease.length || opts.includePrerelease) return true;
    // A prerelease only matches when the range itself names a prerelease of the same version.
    return set.some((c) => !c.internal && c.v.prerelease.length > 0 && c.v.major === v.major && c.v.minor === v.minor && c.v.patch === v.patch);
  });
}

/** The highest version that satisfies the range, or undefined. */
export function maxSatisfying(versions: Iterable<string>, range: string | Range): string | undefined {
  const r = typeof range === "string" ? parseRange(range) : range;
  let best: string | undefined;
  for (const v of versions) {
    if (!satisfies(v, r)) continue;
    const d = best === undefined ? 1 : compare(v, best);
    if (d > 0 || (d === 0 && tiebreak(v, best!) < 0)) best = v;
  }
  return best;
}

/** Highest first. Invalid versions are dropped. */
export function sortDescending(versions: Iterable<string>): string[] {
  return [...versions].filter(isValidVersion).sort((a, b) => compare(b, a) || tiebreak(a, b));
}

/** The range `halo add` writes for a version: `^1.2.3`, or the exact version for a prerelease. */
export function defaultRangeFor(version: string): string {
  return isPrerelease(version) ? version : `^${version}`;
}
