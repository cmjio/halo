---
title: CLI
---

# CLI

`halo` is one binary: install it with `curl -fsSL https://halolang.com/install.sh | sh` (see [Quickstart](/guide/quickstart)), update it with `halo upgrade`, and bring a project written for an older Halo up to date with `halo migrate` (see [Upgrading](/guide/production/upgrading)). This is `halo --help` from the current release:

<!--@include: ../.vitepress/generated/help.md-->

Every command that reads a `.halo` file (`run`, `test`, `validate`, `plan`, `serve`, `mcp`, `compare`, `evolve`) reads the files and installed packages it [`use`s](/spec#files-and-packages-use) too, and fills model slots from `halo.json` `"models"`. Problems in those files are reported where they are. Only the file's own pipelines can be run; the ones it imports are called from them.

Every `halo run` keeps a recording in `.halo/recordings` for [`halo replay`](/guide/plan-and-replay) (`--no-record` turns that off) and records telemetry for Halo Studio in `.halo/telemetry.db` (`--no-telemetry`). In a terminal, a status line on stderr shows the stage being run, what it's doing (a model writing, a tool answering, a retry), the time so far and the cost; it clears before any output and while the run asks you something. It isn't shown in CI or when stderr isn't a terminal, and `--no-progress` (or `HALO_NO_PROGRESS=1`) hides it. Exit status is 0 on success, 1 on a failed run or validation errors.

## Packages

| Command | Does |
|---|---|
| `halo add <name[@range]> ...` | Adds the range to `halo.json` `dependencies` (default `^` the newest version), installs, writes `halo.lock`, and prints an example `use` line. Bare names are `@halo/<name>`. Also takes a folder, a `.halotool` file or an https URL |
| `halo install [--trust]` | Installs what `halo.json` and `halo.lock` pin. Migrates a Halo 0.8 lock (`tools`) |
| `halo remove <name> ...` | Removes packages, and dependencies nothing else needs |
| `halo outdated` / `halo update [name] [--latest]` | Newer versions within and beyond your ranges / move to them |
| `halo search [query]`, `halo info <name>` | Find packages; show versions, exports, model slots, permissions and the README |
| `halo stats <name\|@scope> [--days n] [--json]` | Downloads (by day and by version) and dependents, direct and through other packages, with the chain for each. A scope lists every package in it |
| `halo init --package [dir] [--name @scope/name]` | Scaffold `halo.json`, `README.md` and `lib/main.halo` |
| `halo pack [dir]`, `halo publish [dir\|file] [--dry-run]` | Bundle a package; check and publish it |
| `halo yank`, `unyank`, `deprecate`, `dist-tag` | Manage published versions |
| `halo login`, `logout`, `whoami`, `token`, `owner`, `scope` | Accounts, tokens, and who can publish in a scope |

Every package command takes `--registry <https URL or folder>`. Without it: `HALO_REGISTRY`, then `"registry"` in `halo.json`, then Halo's registry; `"registries"` in `halo.json` maps a scope to its own. `halo login` saves a token per registry in `~/.halo/credentials.json`; `HALO_TOKEN` overrides it for Halo's registry, or for the registry `HALO_TOKEN_REGISTRY` names (and no other). The token is sent only on writes and account commands, never on reads. See [Packages](/guide/tool-packages).

## Auth

`halo auth` connects an [OAuth declaration](/guide/integrations/oauth) to an account, once, for every run in the project. Run it in the project folder. Each command reads the `.halo` files under the folder, or the file you name.

| Command | Does |
|---|---|
| `halo auth login <Connection> [file.halo]` | Opens the browser at the provider's sign-in, takes the answer on `127.0.0.1` (one request, 5 minutes, `state` checked) and stores the tokens. Prints the link when it can't open a browser. `--no-browser` only prints it |
| `halo auth login <Connection> --device` | Signs in with a code on another device (the device flow). The default when there is no browser, and for `grant: "device"` |
| `halo auth logout <Connection> [--no-revoke]` | Revokes the token at the provider, when it has a revoke URL, and forgets it |
| `halo auth list [file.halo]` | Every connection, its grant, and whether this machine is connected, as whom, until when |
| `halo auth status [<Connection>]` | One connection's account, scopes granted and declared, expiry, and where its tokens are kept |

A client credentials connection needs no login: `halo auth login` checks that its client works. Tokens are kept in the macOS Keychain or `~/.config/halo/credentials.json` (`HALO_CREDENTIALS_FILE` moves it; `HALO_CREDENTIALS_STORE=file` keeps them in the file on macOS too), never in the project. That file is not `halo login`'s registry tokens, which stay in `~/.halo/credentials.json`.

A run paused for a connection (`waitingFor: connect:Google`) continues with `halo resume <file.halo> <runId>` once it is connected.
