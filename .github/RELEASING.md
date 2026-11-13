# Releasing Halo

Halo ships on three channels. Each has a pointer at `halolang.com/dl/<channel>.json`, an npm
dist-tag and a container image tag of the same name, and `src/channel.ts` decides a version's
channel from its version string:

| Channel | How it ships | Version | Install |
|---|---|---|---|
| `latest` | push a tag | `1.2.0` | `curl -fsSL https://halolang.com/install.sh \| sh`, `@halolang/halo`, `:latest` |
| `next` | push a prerelease tag | `1.3.0-next.1`, `1.3.0-rc.1` | `… \| HALO_VERSION=next sh`, `@halolang/halo@next`, `:next` |
| `nightly` | every night from `main` (04:23 UTC) | `1.2.1-nightly.20261113.g9172379` | `… \| HALO_VERSION=nightly sh`, `@halolang/halo@nightly`, `:nightly` |

`halo upgrade` stays on the channel the installed build came from; `halo upgrade --channel
<name>` moves to another. The GitHub Action takes `version: next` or `version: nightly` too.

A release or prerelease is a version tag. CI does the rest.

```bash
# 1. bump "version" in package.json (e.g. 0.2.0, or 0.3.0-next.1), commit, push
# 2. tag that commit and push the tag
git tag v0.2.0 && git push origin v0.2.0
```

A prerelease gets a GitHub release marked as a prerelease and doesn't redeploy the site. When
a stable release is newer than what `next.json` points at, it moves `next.json` up to it too, so
`next` never trails `latest` at halolang.com/dl. (npm's `next` dist-tag can't be moved by
trusted publishing; it moves with the next prerelease.)

Nightlies need nothing: the workflow's schedule builds `main` when it has changed since the last
nightly, with a version made up from package.json's (the next patch after a release, or the
release a prerelease is heading for) and never committed or tagged. They get no GitHub release
and no site deploy. Only the newest 14 stay at halolang.com/dl; older ones are deleted from R2.

The site's pages only change with a stable release. But a prerelease or nightly does check that
halolang.com serves its `next.json` or `nightly.json`. If it doesn't (the live worker is older
than channels), the workflow redeploys the latest release's pages with that commit's
`site/worker.ts`, so `HALO_VERSION=next` and `HALO_VERSION=nightly` work.

Run one by hand from Actions → Release → Run workflow (tick *force* to rebuild an unchanged
`main`).

The [Release workflow](workflows/release.yml) then:

1. checks the tag matches `package.json`, runs the test suite, and builds `halo` for every
   platform (`bun scripts/release.ts --no-upload`);
2. runs the Linux builds in containers (Debian, Alpine, and arm64 under emulation);
3. installs the build on macOS with `install.sh` and on Windows with `install.ps1`, from a
   local copy of the release, and runs `halo init` and `halo test` with it;
4. if all of that passes: creates the GitHub release with the binaries and `SHA256SUMS`,
   uploads the same files to halolang.com/dl (so `curl … | sh` and `halo upgrade` get the
   new version), and redeploys the site;
5. builds the container image from the Linux binaries, runs `docker/smoke-test.sh` on it,
   and pushes `ghcr.io/cmjio/halo:<version>`, `:<major.minor>` and `:latest` (amd64 and arm64);
6. builds the npm packages (`bun scripts/npm.ts`), runs `npm/smoke-test.sh` on the linux-x64
   one, and publishes `@halolang/halo-<platform>` and then `@halolang/halo`, with provenance.

The tag is also how people pin the GitHub Action (`uses: cmjio/halo@v0.5.0`): `action.yml`
at the repository root installs the version of the tag it's used at.

A version's files are cached forever once published, so a fix is a new version. Every push
and pull request also runs [CI](workflows/ci.yml): typecheck, tests on Linux and macOS, the
examples, the compiled binary, and the site build.

## One-time setup

Publishing to halolang.com needs a Cloudflare API token, stored as a repository secret:

1. Cloudflare dashboard → My Profile → API Tokens → Create Token → "Edit Cloudflare
   Workers" template. Account resources: your account. Zone resources: `halolang.com`.
   Add the permission **Account · Workers R2 Storage · Edit**.
2. `gh secret set CLOUDFLARE_API_TOKEN` and paste it.

The account id is set as the repository variable `CLOUDFLARE_ACCOUNT_ID`.

**npm.** The packages live in the `halolang` organization on npmjs.com and publish with
[trusted publishing](https://docs.npmjs.com/trusted-publishers): the workflow proves who it
is with GitHub's OIDC token, so there is no npm token to store or rotate. (npm no longer
lets tokens that bypass 2FA publish, so a token in CI doesn't work.) Each package, the
launcher `@halolang/halo` and every `@halolang/halo-<platform>`, needs this once on
npmjs.com: package → Settings → Trusted Publisher → GitHub Actions, with organization
`cmjio`, repository `halo` and workflow `release.yml`. Then, under Publishing access, choose
to require 2FA and disallow tokens, since trusted publishing keeps working.

A package must exist before it can have a trusted publisher, so a new platform publishes its
first version by hand: `bun scripts/npm.ts --only <platform>`, then `npm publish --access
public` in `dist/npm/halo-<platform>` (signed in with `npm login`). If the npm job fails
after the rest of the release shipped, fix the setup and rerun only that job (`gh run rerun
<id> --failed`); versions already on npm are skipped.

**Container image.** Nothing to set up: the workflow pushes with its own `GITHUB_TOKEN`.
After the first release, open the `halo` package under the account's GitHub Packages, and
change its visibility to public so `docker pull` works without signing in.

## Install counts

```bash
CLOUDFLARE_ACCOUNT_ID=… CLOUDFLARE_API_TOKEN=… bun scripts/install-stats.ts [--days 30] [--json]
```

prints how many times Halo was downloaded, per source:

| Source | What's counted | Window |
|---|---|---|
| halolang.com/dl | Each binary `site/worker.ts` serves, into the Workers Analytics Engine dataset `halo_downloads`, by version, platform, channel and country. The channel comes from `?via=` on the binary URL: `script` (install.sh/install.ps1), `ci` (the same under `$CI`), `action` (the GitHub Action, on a cache miss), `upgrade` (`halo upgrade`), `direct` (anything else). | up to 90 days (Analytics Engine's retention) |
| GitHub releases | Each release asset's `download_count`. | all time only |
| npm | `@halolang/halo` from api.npmjs.org. | the window |
| ghcr.io | Not available by API; the package page shows pulls. | |

The Cloudflare token needs **Account · Account Analytics · Read**; without it the script reports
the other sources and says /dl was skipped. These are downloads, not people: nothing identifies
a machine, and a CI job that installs on every run counts every run.

## By hand

`bun scripts/release.ts` does steps 1 and 4's upload from your machine (with `wrangler`
logged in), and `bun run site:deploy` deploys the site.
