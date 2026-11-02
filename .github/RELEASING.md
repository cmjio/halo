# Releasing Halo

A release is a version tag. CI does the rest.

```bash
# 1. bump "version" in package.json (e.g. 0.2.0), commit, push
# 2. tag that commit and push the tag
git tag v0.2.0 && git push origin v0.2.0
```

The [Release workflow](workflows/release.yml) then:

1. checks the tag matches `package.json`, runs the test suite, and builds `halo` for every
   platform (`bun scripts/release.ts --no-upload`);
2. runs the Linux builds in containers (Debian, Alpine, and arm64 under emulation);
3. installs the build on macOS with `install.sh` and on Windows with `install.ps1`, from a
   local copy of the release, and runs `halo init` and `halo test` with it;
4. if all of that passes: creates the GitHub release with the binaries and `SHA256SUMS`,
   uploads the same files to halolang.com/dl (so `curl … | sh` and `halo upgrade` get the
   new version), and redeploys the site.

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

## By hand

`bun scripts/release.ts` does steps 1 and 4's upload from your machine (with `wrangler`
logged in), and `bun run site:deploy` deploys the site.
