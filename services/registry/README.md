# halo-registry

The Halo package registry at `registry.halolang.com`: the JSON API the CLI talks to (`v1/*`)
and the package pages people browse (`/`, `/@scope/name`, `/@scope/name/v/<version>`).
The design is in `proposals/halo-registry.md`; the API's routes and types are in
`src/registry/contract.ts`, which this Worker imports so client and server enforce the same rules.

## Architecture

One Worker, three Cloudflare products. No Durable Objects or Queues.

| Piece | What it holds |
|---|---|
| Worker `halo-registry` (`src/index.ts`) | Routes `v1/*` (JSON, `ApiError` on failure, CORS on GETs) and the HTML pages. |
| D1 `halo-registry` (`DB`) | Users, tokens (sha256 only), scopes and members, packages, versions (manifest, README, computed exports and permissions), dist-tags, daily downloads, pending device logins, domain checks, and an FTS5 table for search. Schema: `migrations/`. |
| R2 `halo-packages` (`PACKAGES`) | Package files at `files/@scope/name/<version>/<sha256>.halotool`, written once. Served at `v1/files/@scope/name/<version>.halotool` (found through the sha256 in D1) with `Cache-Control: immutable` and the sha256 as ETag. |
| Cache API | Package docs, `v1/index.json` and the pages, cached 60s at the edge and purged on publish, yank, deprecate, dist-tag and verification changes. |
| Rate Limiting (`RATE_LIMITER`) | Publish (per user), login start (per IP) and token creation (per user). Skipped when unbound. |

| File | |
|---|---|
| `src/index.ts` | The router and error handling. |
| `src/auth.ts` | GitHub device flow (proxied), `halo_` tokens, whoami, token CRUD, permission checks. A user is their GitHub id; see [Logins](#logins). |
| `src/scopes.ts` | Org scopes, members (owners only; the last owner can't leave), DNS TXT domain verification over DoH. |
| `src/packages.ts` | Docs, index, search, file downloads, publishing, yank, deprecate, dist-tags, cache purges. |
| `../../src/registry/check.ts` | Not in this folder: `checkPackageFiles`, shared with the CLI. Runs the linker's `analyzePackage` on the package's `.halo` files and returns the exports, the permissions and the problems that refuse a publish (syntax errors, hard-coded models in a package that isn't hosted, undeclared model slots, names declared twice in exported files, `use` outside the package or its dependencies, no README, hosted pipelines without interfaces). `halo publish` runs the same function, so the client refuses what the server refuses. |
| `src/markdown.ts` | A small Markdown renderer that escapes all raw HTML and drops unsafe links. |
| `src/pages.ts` | The HTML pages. No external assets; dark-mode aware. |
| `src/env.ts` | The bindings, typed structurally, so the code also type-checks and runs under `bun test`. |

### Routes

| Method and path | |
|---|---|
| `GET v1/index.json` | `PackageSummary[]` |
| `GET v1/search?q=&limit=&offset=` | `SearchResponse` (FTS5, bm25 with name > keywords > description > README; exact name first) |
| `GET v1/packages/@s/n.json` (or without `.json`) | `PackageDoc` |
| `GET v1/files/@s/n/<v>.halotool` | the package file; counts a download |
| `PUT v1/packages/@s/n` | publish (`Content-Type: application/vnd.halo.package+json`, at most `MAX_PACKAGE_WIRE_BYTES`, 8MB; the files inside at most `MAX_PACKAGE_BYTES`, 5MB) → 201 `PublishResponse`, whose `url` is the version's page |
| `POST`/`DELETE v1/packages/@s/n/versions/<v>/yank` | yank `{ reason }` / unyank |
| `POST v1/packages/@s/n/deprecate` | `{ range, message }`; empty message clears |
| `PUT`/`DELETE v1/packages/@s/n/dist-tags/<tag>` | `{ version }`; `latest` can't be removed or point at a yanked version |
| `POST v1/auth/device`, `POST v1/auth/device/token` | GitHub device flow → `TokenResponse` (428 pending, 429 slow_down, 410 expired) |
| `GET v1/whoami` | `WhoAmI` |
| `GET`/`POST v1/tokens`, `DELETE v1/tokens/<id>` | list, create `{ name, readOnly?, scopes? }` (secret shown once), revoke |
| `POST v1/scopes`, `GET v1/scopes/@s` | create an org scope `{ scope }` → `ScopeDoc` |
| `PUT`/`DELETE v1/scopes/@s/members/<login>` | `{ role: "owner" \| "publisher" }` |
| `POST v1/scopes/@s/verify` | `{ domain }` → `{ record, value, verified }` |
| `GET /`, `/?q=`, `/@s/n`, `/@s/n/v/<version>` | HTML pages |

## Publishing and races

A publish checks the package, then writes the file to R2 under a key that holds its sha256,
then inserts the version in one D1 batch. The unique `(package, version)` lets only one of two
racing publishes in; the loser gets 409 and deletes its own R2 object. Because the key holds
the sha256, the loser can never overwrite the winner's file, and a download only finds a file
through the sha256 D1 recorded, so a file is never served before (or without) its version row.
An object left behind by a Worker that died between the two writes is unreachable and harmless.

## Logins

A user is their GitHub user id; `login` is a label that follows GitHub's. When someone signs in
with a login another row still holds (that account renamed on GitHub and hasn't signed in
since), the old row gives it up and becomes `<login>~<github id>` until its owner signs in again
and takes their new login. Scopes, memberships, tokens and packages belong to the id, so they
stay with the account that made them: the new holder of `bob` does not get `@bob` if the old
`bob` created it, and gets no personal scope until they create one.

## Local development

```bash
cp services/registry/.dev.vars.example services/registry/.dev.vars   # optional: a GitHub OAuth app for real logins
bun run registry:dev     # applies migrations to the local D1, then wrangler dev --local on :8787
curl localhost:8787/v1/index.json
open http://localhost:8787/
```

`wrangler dev --local` uses Miniflare's local D1 and R2 (state in `services/registry/.wrangler/`,
which is gitignored). Without `GITHUB_CLIENT_ID`, `POST v1/auth/device` answers 503; to try
publishing without GitHub, insert a user, scope, member and token row with
`bunx wrangler d1 execute halo-registry --local --config services/registry/wrangler.jsonc --command "…"`
(the token row stores the sha256 hex of the token).

## Tests

```bash
bun test test/registry-service.test.ts
```

They call the Worker's `fetch(request, env, ctx)` directly with in-memory fakes: D1 over
`bun:sqlite` with the real migration, R2 and the Cache API as Maps, and a local server playing
GitHub (device flow, `/user`) and DNS over HTTPS. `bun run typecheck` covers the Worker through
`tsconfig.tooling.json`; `services/registry/tsconfig.json` is there for editors.

`test/e2e-registry.test.ts` (in the default `bun test`, or alone with `bun run test:e2e`) runs
the real Worker under `wrangler dev --local` on a fresh D1 and R2 state folder, with a fake
GitHub and DoH served by the test, and drives the real `halo` CLI against it: login, scopes,
publish (dependencies first), search, info, add, install, validate, plan, run with mocks, yank,
outdated and update, deprecate, dist-tags, read-only tokens, a racing double publish, and the
HTML pages. It skips, saying why, when wrangler can't start.

Check the bundle without deploying:

```bash
bunx wrangler deploy --dry-run --config services/registry/wrangler.jsonc --outdir /tmp/halo-registry-dry
```

## Deploying (one time, by a maintainer)

1. Create the database and bucket:

   ```bash
   bunx wrangler d1 create halo-registry
   bunx wrangler r2 bucket create halo-packages
   ```

2. Put the `database_id` that `d1 create` printed into `services/registry/wrangler.jsonc`
   (replacing the all-zero placeholder) and commit it.

3. Create a GitHub OAuth app (GitHub, Settings, Developer settings, OAuth Apps, New):
   homepage `https://registry.halolang.com`, callback URL `https://registry.halolang.com/`
   (unused by the device flow, but required), and tick **Enable Device Flow**.
   It needs no scopes: the registry only reads the public profile to learn the login.

4. Set the secrets:

   ```bash
   bunx wrangler secret put GITHUB_CLIENT_ID --config services/registry/wrangler.jsonc
   bunx wrangler secret put GITHUB_CLIENT_SECRET --config services/registry/wrangler.jsonc
   ```

5. Apply the migrations and deploy (this is what `bun run registry:deploy` does, every time):

   ```bash
   bunx wrangler d1 migrations apply halo-registry --remote --config services/registry/wrangler.jsonc
   bunx wrangler deploy --config services/registry/wrangler.jsonc
   ```

6. DNS: `registry.halolang.com` is a Workers custom domain (`routes` in `wrangler.jsonc`), so
   the deploy creates its DNS record and certificate in the `halolang.com` zone. Nothing to add
   by hand, as long as no other record already uses that name.

Later deploys: `bun run registry:deploy`. New schema changes go in a new
`migrations/000N_*.sql`; never edit an applied one.

The rate limiter's `namespace_id` (`4801`) only has to be unique within the account; change it
if another Worker already uses it.
