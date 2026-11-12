# A package registry for Halo

| | |
|---|---|
| Status | Built on branch `claude/halo-package-registry-a9a967` (language, package manager, registry Worker, hosted exports, end-to-end tests, security review fixes). Not deployed: see `services/registry/README.md`. |
| Date | 11 November 2026 |
| Supersedes | The registry section of `halo-cloud.md` where they differ (naming, manifest, hosting). Its review checks, evals and org-private packages are later work. |
| Builds on | Tool packages (`src/registry/`, `registry/`), `halo.lock`, `halo serve` (`/api/pipelines/<name>/runs`, `/mcp`), the parser (`grammars/Halo.g4`) |

This lives outside `docs/` because everything under `docs/` is published to halolang.com.

## Summary

Third-party platforms should be able to publish Halo packages for other developers to use. A package might contain tools, agents, pipelines, policies, schemas or skills. The registry should work like npmjs or pub.dev:

- **Names are scoped**, npm-style: `@acme/support-kit`.
- **Versions are semver.** Consumers depend on ranges (`^1.2.0`), and `halo.lock` pins the exact versions.
- **Every package has a `README.md`**, which the registry renders on the package page.
- **Packages don't pick the consumer's model.** A package's agents declare *model slots* that the consumer fills with their own models and keys. The exception is a **hosted** export, where the owner pays for the tokens: it runs on the owner's servers, and the consumer calls it over HTTP.

This proposal does four things:

1. Adds `use` to the language, and a linker that loads a program and everything it uses into one runtime. This works for local files as well as packages.
2. Adds package format v2: a `halo.json` with `name`, `version`, `exports`, `models` and `dependencies`, plus a required README. The current tool-provider packages fold into it.
3. Adds a hosted registry service: accounts, scopes, tokens, publishing, yanking, package pages and search.
4. Adds hosted exports: pipelines that run on the publisher's `halo serve` and are paid for by the publisher.

## What exists today

- **Package**: a folder with `halo-tool.json` declaring *providers* only (`http`, `mcp`, `module`). `halo pack` turns it into one `.halotool` file: base64 JSON, sha256, up to 5MB.
- **Registry**: a static `index.json` plus the package files. `halo publish` edits that file on local disk. The hosted copy is `registry/` copied onto halolang.com by `site/build.ts`.
- **Consumer**: `halo add stripe` installs into `.halo/tools/`, pins the version and sha256 in `halo.lock`, and records trust for code-running packages per machine in `.halo/trust.json`. Then `tool Pay : Stripe()`.

The security model is sound and should be kept: checksums are verified on every load, trust is never read from the shared lockfile, and `http` providers run no package code.

### Gaps

| Gap | Effect |
|---|---|
| Flat names (`/^[a-z0-9-]+$/`), and `publisher` is free text | Anyone can publish `stripe` or claim to be "Halo (first-party)". There's no ownership. |
| No publish service | There are no accounts, tokens, upload, yank or deprecate. Publishing means committing to this repo. |
| Packages can only export providers | There's no way to ship agents, pipelines, policies, schemas or skills. |
| No README or metadata | There's no readme, keywords, repository or required Halo version. The package page is built from `registry/src/<name>/`, so a third-party package with no source here breaks `site/build.ts`. |
| Exact versions only | There are no ranges, `outdated` or `update`. `compareVersions` ignores prerelease ordering, so publishing `2.0.0-beta` makes it `latest`. |
| No dependencies | Packages can't depend on packages. `halo.lock` is a flat `tools` map. |
| One growing `index.json` | Every lookup downloads the whole registry. Private registries can't be mapped by scope. |
| Integrity rests on the index | The sha256 comes from the same index as the file, so a compromised registry can swap both. |
| Provider names are global | Two packages can't both export `Client`; the second fails to install. |
| **No `use` or `import` in the language** | A `.halo` file can't reference anything outside itself. |
| **No cross-file linking** | `halo serve` gives each file its own `HaloRuntime`, so a pipeline can't call a pipeline in another file, even in the same project. |
| Permissions cover providers only | An exported pipeline's effects, env vars and hosts aren't computed, so `halo plan` and the install prompt can't show them. |

## Naming

- Packages are `@scope/name`. Both parts are lowercase letters, digits, `-`, `.` and `_`, and the whole name is at most 214 characters, as on npm.
- A scope belongs to a user or an organisation. Organisations verify a domain (DNS TXT record) to get a verified badge. This replaces the free-text `publisher` field.
- The existing packages move to `@halo/stripe`, `@halo/jira`, and so on. The CLI keeps accepting bare `stripe` as an alias for `@halo/stripe`, and existing lockfiles keep working.
- In source, a package name is a string: `use "@acme/support-kit" { … }`. Local files use the same form (`use "./shared.halo"`), so there is one rule and no new lexer token to confuse with `@retry`-style directives.

## Package format v2

One `halo.json` serves both apps and packages, as `package.json` and `pubspec.yaml` do. A package adds `name` and `version`. The old `halo-tool.json` `providers` block moves in unchanged.

```json
{
  "name": "@acme/support-kit",
  "version": "1.2.0",
  "description": "Ticket triage and reply agents for Zendesk",
  "license": "MIT",
  "repository": "https://github.com/acme/halo-support-kit",
  "keywords": ["support", "zendesk"],
  "halo": ">=0.9.0",
  "exports": ["lib/support.halo"],
  "models": {
    "fast":  { "description": "Classifies tickets. Needs tool calls.", "suggested": "anthropic/claude-haiku-4-5" },
    "smart": { "description": "Writes customer replies.",               "suggested": "anthropic/claude-sonnet-4-5" }
  },
  "providers": { "Zendesk": { "kind": "http", "baseUrl": "https://{{subdomain}}.zendesk.com/api/v2", "...": "..." } },
  "skills": "skills/",
  "env": ["ZENDESK_TOKEN"],
  "dependencies": { "@halo/stripe": "^1.0.0" }
}
```

- **`README.md` is required.** `halo publish` refuses a package without one.
- **`exports`** lists the public `.halo` files. Every declaration in them is exported, and other files stay private to the package.
- **`halo`** is the range of Halo versions the package works with. Install fails clearly on an older Halo.
- **`env`** lists the variables the package reads. It's shown at install time, merged with what the providers declare.
- The `.halotool` single-file format stays (`format: "halo-package/2"`), as do the 5MB cap and the safe-path checks.

## Using a package in a `.halo` file

```halo
use "@acme/support-kit" { Triage, Triager, Zendesk } with models(fast: anthropic/claude-haiku-4-5, smart: openai/gpt-5)
use "@halo/stripe" { Stripe }
use "./shared/policies.halo" { Careful }

tool Pay : Stripe()

agent Closer [anthropic/claude-sonnet-4-5] equips Pay, Zendesk requires Careful

pipeline Inbox(ticket: String):
  ticket |> Triage() as triaged |> Closer.reply(context.triaged)
```

- `use "<package or ./path.halo>" { Name, Name as Alias }` brings names into the file. Imported names work everywhere a local one does: `equips`, `requires`, `tool X : Provider()`, calls and schema types. No other grammar changes are needed.
- `use` is a soft keyword, added to the `name` rule so existing identifiers called `use` keep working.
- **Versions live in `halo.json`, not in source** (as in Go and Dart). The `.halo` file names the package; `halo.json` and `halo.lock` decide which version.
- Two imports that bring in the same name are an error unless one is renamed (`{ Triage as AcmeTriage }`). This also removes the global provider-name collision.
- Later: `use "@acme/support-kit" as Support` and `Support.Triage(...)`. That needs `callExpr` to accept a dotted path, so it isn't in the first version.

### Linking

A linker parses the entry file, follows its `use` graph (local paths and installed packages), and loads every declaration into **one** `HaloRuntime` under qualified internal names (`@acme/support-kit#Triage`). The other parts of Halo work on the linked program:

- `validate` and the LSP see imported names, with go-to-definition into `.halo/packages/`.
- `halo serve` links each entry file, not each file. Pipelines can call pipelines from other files, which fixes the cross-file gap for projects with no packages at all.
- `halo plan` walks into imported pipelines and shows their tool effects.
- A package's private declarations stay unreachable from the consumer.

## Models: the consumer pays by default

A package's agents run on the consumer's machine with the consumer's keys, so the consumer chooses the models.

- A package declares **model slots** in `halo.json` (`models`), each with a description of what it needs and a suggested model.
- Its agents use a slot instead of a model id: `agent Triager [models.fast, temperature: 0]`. The grammar already accepts a dotted name here.
- The consumer fills the slots on the `use` line, `with models(fast: ..., smart: ...)`, or project-wide in `halo.json` (`"models": { "smart": "anthropic/claude-sonnet-4-5" }`). The `use` line wins. A project's own agents can use `[models.smart]` too. The linker substitutes the model ids before the runtime sees the agents, so everything downstream (adapters, `@cascade`, cost tracking, recordings) works unchanged.
- An unfilled slot is a validation error that names the slot, what it's for, and its suggested model. `halo add` writes the suggested models into a commented example `use` line, so getting started is copy-and-paste.
- **`halo publish` rejects a non-hosted package with a hard-coded model id in any agent**, exported or not. Every token a non-hosted package spends is the consumer's, so the consumer decides.

## Hosted exports: the owner pays

When a platform wants to pay for the tokens (as a service, a free tier, or a metered API), its agents can't run on the consumer's machine: that would mean shipping the owner's API keys inside the package. A hosted export runs on the owner's servers instead, and the package carries only its interface.

```json
{
  "name": "@acme/support-kit",
  "hosted": {
    "endpoint": "https://halo.acme.com",
    "auth": { "type": "bearer", "env": "ACME_HALO_KEY" },
    "exports": ["Triage", "DraftReply"]
  }
}
```

- **Publishing.** The owner runs `halo publish` from their project. It links the program and writes an interface for each hosted pipeline into the package: name, parameters, return schema, description, and the effects `halo plan` computed. **The `.halo` source of a hosted export is not in the package.** Hosted agents may hard-code models, because they never run on the consumer's machine.
- **Serving.** The owner runs `halo serve --package` (or Halo Cloud). It serves exactly the published hosted exports, keyed by package version, behind API keys that the owner issues and meters. It uses the existing `POST /api/pipelines/<name>/runs` with `"wait": true`, plus a `Halo-Package: @acme/support-kit@1.2.0` header so the server can refuse a version it no longer serves.
- **Consuming.** `use "@acme/support-kit" { Triage }` works the same as for a local export. The linker makes `Triage` a stub that calls the endpoint. To the consumer's runtime and `halo plan`, it's one `external` call to `halo.acme.com`.
- **Install prompt.** It says plainly that this package *sends your inputs to halo.acme.com* and reads `ACME_HALO_KEY`. The registry shows a "Hosted by acme.com" badge on the package page.
- **Mixing.** One package can have both local exports (consumer's models) and hosted ones (owner's models). For example, a free local triage pipeline and a paid hosted reply writer.
- **First version: hosted pipelines can't pause.** `halo publish` rejects a hosted pipeline that can reach `|! yield` or `~> listen`. Passing a pause across the boundary (the consumer answers, the owner resumes) is a later step.

## Dependencies and the lockfile

- `halo.json` `dependencies` holds ranges: `^`, `~`, exact, or `>=a <b`, with npm's semver semantics. Prereleases are chosen only when the range names one.
- Resolution is **one version per package across the graph**, as in pub.dev and Go. A conflict fails with both requirement chains printed. Nested copies (npm-style) make `use` ambiguous and aren't worth it here.
- `halo.lock` v2 records the full graph. Each package gets its version, source, sha256, permissions, its dependencies, and whether it's hosted. v1 lockfiles (`tools`) are read and rewritten on the next `halo install`.
- Packages install into `.halo/packages/@scope/name/`. Trust stays per machine, per checksum, never from the lockfile.
- A package's permissions are the union of its providers, the tools its `.halo` exports declare, its hosted endpoints, and its dependencies. The install prompt shows the totals and which dependency adds what.

## CLI

```bash
halo login                         # browser device-code flow; token saved in ~/.halo/credentials
halo init --package                # scaffold halo.json, README.md, lib/, an example
halo add @acme/support-kit         # adds "^1.2.0" to halo.json, resolves, writes halo.lock
halo install [--trust]             # install exactly what halo.lock pins
halo outdated | halo update [name] # newer versions within, and beyond, your ranges
halo remove @acme/support-kit
halo search zendesk
halo publish [--dry-run]           # check, pack and upload; README required; prints the permissions it computed
halo yank @acme/support-kit@1.2.1  # hidden from resolution; existing lockfiles still install it
halo deprecate @acme/support-kit@"<1.0" "Use 1.x"
halo owner add @acme/support-kit someone
```

`--registry`, `HALO_REGISTRY` and `"registry"` in `halo.json` keep working, and `"registries": { "@acme": "https://halo.acme.internal" }` maps a scope to a private registry.

## The registry service

`site/` already runs on Cloudflare Workers, so:

- A **Worker** serves the API, **R2** stores the `.halotool` files, and **D1** stores accounts, scopes, owners, versions, yanks and download counts.
- **Read API** (npm-style, cacheable): `GET /api/packages/@scope/name` returns all versions, dist-tags, sha256s, permissions, `halo` ranges and the README. `GET /api/search?q=`. Files come from immutable URLs.
- **Write API**: `PUT /api/packages/@scope/name` with a bearer token scoped to publishing for that scope. The server re-runs the manifest checks, computes the permissions itself rather than trusting the client, rejects republishing an existing version, and rejects hard-coded models in non-hosted packages.
- **Package pages** come from the README and the computed data: exports and their kinds, model slots with suggestions, permissions, effects, hosted badge, versions and dependents. This replaces the build-time `PackageList.vue`, so third-party packages no longer touch `site/build.ts`.
- **Static registries keep working.** `halo publish --registry ./index.json` writes the same per-package JSON layout to a folder, so a company can host a registry on any static host.
- **Moderation**: report a package, ownership transfer, and reserved scopes (`@halo` and well-known platform names, released to their verified owners).

Later: signed packages with Sigstore provenance from CI, so the sha256 doesn't rest on the registry alone.

## Rollout

1. **`use` for local files, and the linker.** Fixes multi-file projects now, and everything else builds on it. It touches the grammar, parser, validator, LSP, `serve`, `plan` and the editor grammars.
2. **Package format v2.** Scoped names, `exports`, model slots, README, ranges, dependencies, lockfile v2 and the `@halo/*` migration, all on the static registry.
3. **The registry service.** Accounts, tokens, publish, yank and deprecate, package pages and search.
4. **Hosted exports.** `halo serve --package`, interface-only packages, the endpoint stub and the install disclosure.
5. **Signing and provenance.**

## Decisions

| Question | Decision |
|---|---|
| Name syntax in source | A string: `use "@acme/support-kit" { … }`, the same form as local files. |
| Binding models project-wide | Yes: `halo.json` `models` binds slots for every package and for the project's own agents. A `use … with models(…)` overrides it for that package. |
| Billing for hosted exports | Each publisher issues and meters its own API keys. The registry doesn't bill (Halo Cloud's "no paid marketplace" non-goal stands). |
| Consumer tools in hosted pipelines | Not in the first version. Hosted pipelines also can't pause. Both need a callback channel, designed later. |
| Package-private declarations | The exported/private file split is enough. No `private` keyword. |

## Cloudflare architecture

halolang.com already runs on Workers (`site/`, with an R2 bucket for releases). The registry is a second Worker, `services/registry`, at `registry.halolang.com`.

| Need | Cloudflare product | How |
|---|---|---|
| API and package pages | **Worker** (`halo-registry`) | One `fetch` handler routes `v1/*` (JSON API) and `/@scope/name` (HTML pages). It imports `src/registry/contract.ts` and `semver.ts`, so client and server enforce the same rules. |
| Package files | **R2** bucket `halo-packages` | Keys `files/@scope/name/<version>/<sha256>.halotool`, written once and never overwritten (the sha256 in the key means a losing concurrent publish can't replace the winner's file). Served through the Worker with `Cache-Control: public, max-age=31536000, immutable` and the sha256 as ETag. |
| Metadata | **D1** database `halo-registry` | Tables: `users`, `tokens` (sha256 of the token only), `scopes`, `scope_members`, `packages`, `versions` (manifest JSON, README, exports, permissions, yank/deprecate), `dist_tags`, `downloads_daily`, `device_codes`, `scope_verifications`. Search uses an FTS5 table over name, description, keywords and README. Unique `(package, version)` makes double publishes impossible without locks. Migrations live in `services/registry/migrations/`. |
| Read performance | **Cache API** | Package docs and the index are cached at the edge for 60s and purged on publish, yank, deprecate and dist-tag changes. Files are cached forever. |
| Abuse limits | **Rate Limiting binding** | Publish, login and token creation are limited per user and per IP. |
| Sign-in | **Worker + GitHub OAuth device flow** | `halo login` starts a device flow through the Worker. On approval the Worker creates the user (their scope is `@<github-login>`) and returns a `halo_…` token. Secrets: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`. `GITHUB_URL` / `GITHUB_API_URL` vars are overridable for local tests. |
| Domain verification | **Worker + Cloudflare DNS over HTTPS** | `POST v1/scopes/@acme/verify` returns a TXT record for `_halo.<domain>`; the next call checks it through `cloudflare-dns.com/dns-query`. |
| Downloads | **D1** `downloads_daily` | Incremented in `ctx.waitUntil` on each file download, so it never slows a download. |
| Hosted exports | Not on Workers | `halo serve` needs Bun (`bun:sqlite`, `Bun.spawn`), so publishers run `halo serve --package` on their own hosts or Cloudflare Containers. The registry only lists the endpoint. |

Nothing here needs Durable Objects or Queues. Publishing is one D1 batch plus one R2 put, and README rendering happens on read (cached).

**Local development and tests.** `bun run registry:dev` runs `wrangler dev --local`, so D1 and R2 are Miniflare's local copies. Unit tests run under `bun test` against the Worker's `fetch` with in-memory D1 (`bun:sqlite`) and R2 fakes. An end-to-end test drives the real CLI against `wrangler dev`.

**Deploying** is a manual step for a maintainer: create the D1 database and R2 bucket, apply migrations, set the secrets, create the GitHub OAuth app, then `wrangler deploy`. `services/registry/README.md` lists the commands.

## Delivery

The work is split so agents can build it in parallel without touching the same files. Everyone builds against the contract (`src/registry/contract.ts`, `src/registry/semver.ts`) and the shared fixtures (`test/fixtures/packages/`, `test/fixtures/projects/support-app/`).

| Wave | Workstream | Owns |
|---|---|---|
| 1 | **Language and linker** | `grammars/`, `src/parser/`, new `src/linker/`, runtime loading, `validate`, `plan`, LSP, `editors/`, language docs. Finds packages only through `PackageResolver`. |
| 1 | **Package manager** | `src/registry/` (except the contract), lockfile v2, `.halo/packages`, the registry client, resolution, all package CLI commands, the `@halo/*` migration of `registry/`, package docs. Implements `PackageResolver`. |
| 1 | **Registry service** | `services/registry/`: Worker, D1 migrations, R2, auth, API, package pages, search, its tests and deploy README. |
| 2 | **Hosted exports** | `hosted` in publish, `halo serve --package`, the linker's remote stubs, the install disclosure. |
| 2 | **End to end** | The CLI against `wrangler dev`: login, publish, add, run with mocks, yank, outdated. Fixes integration bugs across workstreams. |
| 3 | **Review** | A full review of the change, the whole test suite, typecheck and the docs build. |
