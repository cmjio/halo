/**
 * Release channels. Every published version belongs to exactly one, decided by its version string:
 *
 *   latest   1.2.0              a v1.2.0 tag: the stable release
 *   next     1.3.0-next.1       a prerelease tag (-next.N, -rc.N, -beta.N, …): what the next release will be
 *   nightly  1.2.1-nightly.…    built from main every night by the release workflow, never tagged
 *
 * Each channel has a pointer at halolang.com/dl/<channel>.json ({ version, published, … }), an npm
 * dist-tag and a ghcr.io image tag of the same name. install.sh, install.ps1, the GitHub Action and
 * `halo upgrade` read the pointer.
 */

export const CHANNELS = ["latest", "next", "nightly"] as const;
export type Channel = (typeof CHANNELS)[number];

export const isChannel = (s: string): s is Channel => (CHANNELS as readonly string[]).includes(s);

/** The channel a version was published on. */
export function channelOf(version: string): Channel {
  const pre = version.replace(/^v/, "").split("+")[0]!.split("-").slice(1).join("-");
  if (!pre) return "latest";
  return pre.startsWith("nightly.") ? "nightly" : "next";
}

/**
 * The version for a nightly build of `base` (package.json's version on main) made from `commit`
 * on `date`: the next patch after a stable base (1.2.0 → 1.2.1-nightly.20261113.g9172379), or the
 * same release a prerelease base is heading for (1.3.0-next.2 → 1.3.0-nightly.…). The date sorts
 * nightlies in order; the commit (prefixed with "g", as git describe does, so it's never a numeric
 * identifier with a leading zero) tells two builds from one day apart.
 */
export function nightlyVersion(base: string, date: Date, commit: string): string {
  const m = /^v?(\d+)\.(\d+)\.(\d+)(-[^+]+)?/.exec(base);
  if (!m) throw new Error(`Not a version: ${base}`);
  const [, major, minor, patch, pre] = m;
  const core = pre ? `${major}.${minor}.${patch}` : `${major}.${minor}.${Number(patch) + 1}`;
  const day = date.toISOString().slice(0, 10).replaceAll("-", "");
  return `${core}-nightly.${day}.g${commit.slice(0, 7).toLowerCase()}`;
}
