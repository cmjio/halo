---
title: CLI
---

# CLI

`halo` is one binary: install it with `curl -fsSL https://halolang.com/install.sh | sh` (see [Quickstart](/guide/quickstart)), update it with `halo upgrade`. This is `halo --help` from the current release:

<!--@include: ../.vitepress/generated/help.md-->

Every command that reads a `.halo` file (`run`, `test`, `validate`, `plan`, `serve`, `mcp`, `compare`, `evolve`) reads the files and installed packages it [`use`s](/spec#files-and-packages-use) too, and fills model slots from `halo.json` `"models"`. Problems in those files are reported where they are. Only the file's own pipelines can be run; the ones it imports are called from them.

Every `halo run` keeps a recording in `.halo/recordings` for [`halo replay`](/guide/plan-and-replay) (`--no-record` turns that off) and records telemetry for Halo Studio in `.halo/telemetry.db` (`--no-telemetry`). Exit status is 0 on success, 1 on a failed run or validation errors.

## Packages

| Command | Does |
|---|---|
| `halo add <name[@range]> ...` | Adds the range to `halo.json` `dependencies` (default `^` the newest version), installs, writes `halo.lock`, and prints an example `use` line. Bare names are `@halo/<name>`. Also takes a folder, a `.halotool` file or an https URL |
| `halo install [--trust]` | Installs what `halo.json` and `halo.lock` pin. Migrates a Halo 0.8 lock (`tools`) |
| `halo remove <name> ...` | Removes packages, and dependencies nothing else needs |
| `halo outdated` / `halo update [name] [--latest]` | Newer versions within and beyond your ranges / move to them |
| `halo search [query]`, `halo info <name>` | Find packages; show versions, exports, model slots, permissions and the README |
| `halo init --package [dir] [--name @scope/name]` | Scaffold `halo.json`, `README.md` and `lib/main.halo` |
| `halo pack [dir]`, `halo publish [dir\|file] [--dry-run]` | Bundle a package; check and publish it |
| `halo yank`, `unyank`, `deprecate`, `dist-tag` | Manage published versions |
| `halo login`, `logout`, `whoami`, `token`, `owner`, `scope` | Accounts, tokens, and who can publish in a scope |

Every package command takes `--registry <https URL or folder>`. Without it: `HALO_REGISTRY`, then `"registry"` in `halo.json`, then Halo's registry; `"registries"` in `halo.json` maps a scope to its own. `halo login` saves a token per registry in `~/.halo/credentials.json`; `HALO_TOKEN` overrides it. See [Packages](/guide/tool-packages).
