---
title: Packages
---

# Packages

Any API can ship as a Halo tool. These are in the registry at `halolang.com/registry`:

```bash
halo search                 # list them
halo add stripe             # then: tool Pay : Stripe()
halo add world-time --trust # it runs its own code, so it needs --trust
halo tools                  # every provider you can use, and its methods
```

## In the registry

<PackageList />

Method colors are their effects: <span class="e read">read</span> <span class="e write">write</span> <span class="e external">external</span>. Policies and `halo plan` use them.

## How packages work

A package is a `halo-tool.json` declaring providers of one of three kinds:

| Kind | What runs | Needs `--trust` |
|---|---|---|
| `http` | Nothing from the package: Halo makes the requests, only under the declared base URL | no |
| `mcp` | An MCP server: a command it starts, or a URL | for a command |
| `module` | The package's TypeScript | yes |

Every package is a single checksummed file. `halo add` pins its version and SHA-256 in `halo.lock`, and every load checks the installed files against it. Trust is recorded on your machine (`.halo/trust.json`, per checksum), never read from the lockfile, so a pull request can't grant it.

## Publish your own

```bash
halo pack ./my-api                                         # → my-api-1.0.0.halotool
halo publish my-api-1.0.0.halotool --registry ./index.json # add it to a registry index
```

A registry is a static `index.json` plus the package files: host it anywhere. Users point at it with `--registry`, `HALO_REGISTRY`, or `"registry"` in `halo.json`. [Writing a package →](/guide/tool-packages)
