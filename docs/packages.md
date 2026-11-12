---
title: Packages
---

# Packages

A package is tools, agents, pipelines, policies, schemas or skills that someone published for other projects to use. Names are scoped, like npm's: `@acme/support-kit`. These first-party ones are in the `@halo` scope:

```bash
halo search                    # list them
halo add stripe                # short for @halo/stripe; then: tool Pay : Stripe()
halo add world-time --trust    # it runs its own code, so it needs --trust
halo tools                     # every provider you can use, and its methods
```

<PackageList />

Method colors are their effects: <span class="e read">read</span> <span class="e write">write</span> <span class="e external">external</span>. Policies and `halo plan` use them.

## How packages work

- `halo add @acme/support-kit` writes `"@acme/support-kit": "^1.2.0"` into `halo.json` `dependencies`, picks one version of every package in the graph, and pins each one's version and SHA-256 in `halo.lock`.
- A `.halo` file names the package, not the version: `use "@acme/support-kit" { Triage }`. `halo.json` and `halo.lock` decide the version.
- Packages don't choose your models. Their agents declare model slots, and you fill them: `use "@acme/support-kit" { Triage } with models(fast: anthropic/claude-haiku-4-5)`.
- Every package is one checksummed file, and every load checks the installed files against `halo.lock`. Trust to run a package's own code is kept on your machine (`.halo/trust.json`, per checksum), never in the lockfile, so a pull request can't grant it.

| A package's providers | What runs | Needs `--trust` |
|---|---|---|
| `http` | Nothing from the package: Halo makes the requests, only under the declared base URL | no |
| `mcp` | An MCP server: a command it starts, or a URL | for a command |
| `module` | The package's TypeScript | yes |

## Publish your own

```bash
halo login                   # once; opens a device code page
halo init --package          # halo.json, README.md, lib/main.halo
halo publish --dry-run       # check it and see the permissions it computes
halo publish
```

A registry can also be a folder of static files: `halo publish --registry ./registry` writes one you can host anywhere. Point projects at it with `--registry`, `HALO_REGISTRY`, `"registry"` in `halo.json`, or per scope with `"registries"`. [Writing a package →](/guide/tool-packages)
