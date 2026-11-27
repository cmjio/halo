---
title: Upgrading
---

# Upgrading

Upgrading Halo has two parts: the `halo` binary, and the projects written for an older one.

```bash
halo upgrade            # the binary (or brew upgrade halolang, a newer npm version, a newer image tag)
halo migrate            # in a project: what the new version changes for it
halo migrate --write    # apply what can be applied, and record the version
```

Most releases change nothing for an existing project, and `halo migrate` says so.

## The version a project is written for

A project records it in `halo.json`, as a range:

```json
{ "halo": "^1.4.0" }
```

`halo init` writes it, and `halo migrate --write` moves it forward. Halo uses it in two ways:

- **A project behind this Halo.** Every change to Halo that can alter what an existing project does comes with a migration, tagged with the version that made the change. `halo migrate` checks the ones newer than the project's version.
- **A project ahead of this Halo.** If `halo.json` asks for `^1.6.0` and the binary is 1.4.0, `halo migrate`, `halo validate` and `halo serve` say to run `halo upgrade`.

A project with no `"halo"` in `halo.json` (or no `halo.json`) is checked against every change Halo has made. That is safe: a migration looks for its cases in the files, so one that doesn't apply finds nothing.

For a [package](../tool-packages.md), `"halo"` is also the range of Halo versions it installs on.

## What `halo migrate` shows

```
$ halo migrate
.: written for Halo 1.2.0; this is Halo 1.4.0

! A model can no longer choose a POST tool's path (Halo 1.4.0)  yours to decide
    pipelines/pay.halo:3  tool Ledger is equipped by an agent and has no rule for path
    An agent that calls a POST tool reaches only the address the tool declares; ...

Run halo migrate --write to record "halo": "^1.4.0" in halo.json.
```

Each change is one of two kinds:

| Marked | Means |
|---|---|
| `--write applies this` | Halo can rewrite the project itself. `halo migrate --write` does it |
| `yours to decide` | The right answer depends on what you meant, so Halo lists each place with its file and line, and what the choices are. Nothing is rewritten |

Without `--write`, nothing is changed. With it, Halo applies the first kind, oldest change first, then writes the new range to `halo.json`, leaving the rest of the file as it was. If a change can't be applied (a package can't be downloaded, say), the version is not recorded, and running it again picks up where it stopped.

Once the version is recorded, older changes are not checked again, including the ones that were yours to decide. Read those before you run `--write`; `halo migrate --from 1.2.0` shows them again.

| Option | Does |
|---|---|
| `halo migrate [dir]` | Checks the project in `dir` (default: this folder): every `.halo` file outside dot-folders and `node_modules`, `halo.json` and `halo.lock` |
| `--write` | Applies what can be applied and records the version |
| `--from <version>` | Checks changes since this version, whatever `halo.json` says |
| `--check` | Exits 1 if the project is behind (for CI). `--write` then `--check` passes |
| `--trust` | With `--write`: allows packages that run their own code, as `halo install --trust` does |
| `--json` | The report as JSON |

`halo validate` (run on the project folder) and `halo serve` print one line when the project is behind or ahead. They never stop for it. When `halo run` stops on a validation error and the project is behind, it says to run `halo migrate` too.

## The changes

| Since | Change | Applied by `--write` |
|---|---|---|
| 1.0.0 | `halo.lock` in the 0.x format (`tools`) becomes `dependencies` in `halo.json` and a version 2 `halo.lock`. `halo install` does the same | Yes |
| 1.4.0 | A model can no longer set a `POST` tool's `path` unless the tool is declared `& Unlocked("path")` (see [Rules on a tool's arguments](../../stdlib/tools.md#rules-on-a-tool-s-arguments)). Listed for each `POST` tool an agent equips that has no rule for `path` | No |
| 1.6.0 | `Chrome.screenshot()` without a `path:` returns `{ image }`, an [image value](../files.md), instead of `{ mimeType, base64 }`. Listed for each line that reads `.base64` or `mimeType` in a file that declares a `Chrome` tool | No |
| 1.7.0 | A `Bash` command no longer inherits Halo's whole environment, so an agent with a shell can't print your API keys. It sees `PATH`, `HOME`, `USER`, `LOGNAME`, `SHELL`, `LANG`, `LC_ALL`, `LC_CTYPE`, `TMPDIR`, `TZ` and `TERM`, plus what the declaration passes on with `env:` (see [`Bash`](../../stdlib/tools.md#bash)). Listed for each `Bash` tool with no `env:`, with the `$VARIABLES` its commands name | No |
| 1.9.0 | A misspelled policy rule, `Block`/`Redact` category, directive, `Vault` setting or `loop` option, or a policy tool name one letter off a declared tool, is an error instead of a warning. Before, the misspelled name did nothing: `maxspend(0.25)` ran with no spend cap. `--write` renames each to the name it was close to (`maxspend` → `MaxSpend`, `@retyr` → `@retry`), which turns that rule on, so check it's what you want | Yes |
| 1.9.0 | A rule nothing can check (`Require(Approver)`, `Block(Competitors)`, `Enforce(XML)`) is an error. It never ran before. Remove it, or use a rule that is enforced; for a person's approval, `\|! yield` | No |
| 1.9.0 | A `loop`'s condition is written in parentheses like a gate's: `loop(Coder, (context.data.tests.exitCode != 0))`. The quoted form still works and behaves the same; `--write` rewrites it | Yes |
| 1.9.0 | A `=>` after a gate's condition (`\|? (cond) =>`) did nothing and is now a warning. `--write` removes it | Yes |
| 1.9.0 | `Result<T>` is checked as `T` (it was ignored, so `-> Result<Reply>` checked nothing). A run whose output doesn't match now fails. Listed for each `Result<…>` type | No |
| 1.10.0 | Trust for packages that run their own code is kept in `~/.config/halo/trust.json`, keyed by the project's folder, not in the project's `.halo/trust.json` (which a repo could ship, and which is now ignored). Run `halo install --trust` once in the project. Listed: the old file, and each package in `halo.lock` that runs code (see [Packages](../tool-packages.md)) | No |
| 1.10.0 | `MaxSpend` uses exact prices and refuses a call to a model it can't price. Add such models to `"prices"` in `halo.json` (USD per million tokens). Reported costs change too: `claude-haiku-4-5` is counted at its real $1/$5. Listed for each agent under `MaxSpend` whose model has no price (see [Policies](../../stdlib/policies.md)) | No |
| 1.10.0 | A model can no longer set `query:` on a `GET`, `REST` or `POST` tool unless it is declared `& Unlocked("query")`, and a key in `query:` that a `Locked`, `Fixed` or `Match` rule names is refused for any call. Listed for each such tool an agent equips | No |
| 1.10.0 | A `Bash` placeholder inside a string a second shell reads (`bash -c '…'`, `sh -c "…"`, `eval`, an `ssh` command) is refused, and so is a value starting with `-` where a command would read it as an option, unless `--` comes first (see [`Bash`](../../stdlib/tools.md#bash)). Listed for each command `halo validate` warns about | No |
| 1.10.0 | A `Workspace` can't read or write inside a `.git` folder unless it is declared `git: true`, and `glob`, `search` and `Git.grep` leave out `.env`, key and credential files unless the tool is declared `secrets: true`. `search` takes `pattern:` only. Listed: Workspaces rooted in `.git` | No |
| 1.10.0 | `halo serve` doesn't take the API token from `?token=` or a webhook secret from `?secret=` (unless the webhook sets `"secretInQuery": true`): send `Authorization: Bearer` and `x-halo-secret`. Its state folder is made readable only by you. Listed for each webhook with a secret | No |
| 1.12.0 | A value a tool read from `Env.NAME` is shown as `[secret NAME]` wherever a tool result or error repeats it, so a service that echoes a key can't leak it (see [Built-in Tools](../../stdlib/tools.md)). Values under 8 characters, numbers, booleans, words like `us-east-1`, host names, paths and plain URLs are left alone unless the variable's name says it's a secret. A pipeline that compares a tool's result with such a value now sees the mask. `Redact(APIKey)` also finds more kinds of secret, including `Bearer` tokens and passwords in URLs (see [Policies](../../stdlib/policies.md)). Listed: `Env` variables read by tools whose names don't say they're secrets | No |
| 1.12.0 | A stdio `MCP` server without `cwd:` starts in a private empty folder, so it can't load the project's `.env`. Relative paths in its command (`./server.ts`, `server.ts`, `.`) are made absolute against the project first, so most servers work as before. One that must start in the project (`python -m`, `uv run`, a `node_modules/.bin` program) needs `cwd: "."` (see [MCP](../integrations/mcp.md#where-a-stdio-server-runs)). Listed for each `MCP` tool with a command and no `cwd:` | No |
| 1.12.0 | An `MCP` setting Halo doesn't read (`timeout: 5`, `oauth: true`), or a second positional argument, is an error. Before, it did nothing. Listed for each one, with the setting it was close to | No |
| 1.12.0 | `Remote` over SSH sets `StrictHostKeyChecking yes` (`accept-new` with `accept_new_hosts: true`), `ForwardAgent no`, `ForwardX11 no`, `ClearAllForwardings yes`, `ControlMaster no` and `PermitLocalCommand no` on every call, whatever `~/.ssh/config` says, and gives ssh a small environment, so `SendEnv` can't send your API keys. Host aliases still work. A host that worked only with `StrictHostKeyChecking no` fails until its key is in `known_hosts` or pinned with `hostKey:`; a remote command that used your forwarded agent needs a deploy key on the host. A command that exits 255 returns `exitCode: 255` instead of failing as "couldn't reach", a connection that drops mid-command is no longer retried, and `write` renames a new file over the old one (a symlink there is replaced). Listed for each SSH `Remote` tool (see [A machine over SSH](../../stdlib/remote.md#a-machine-over-ssh)) | No |
| 1.12.0 | `Remote` `upload` refuses a credential file (`.env`, a private key, `.npmrc`, `credentials.json`…), or a symlink to one, and `download` won't write one here, unless the declaration names it with `allowFiles: ["deploy/.env"]` (for a sandbox, `files:` naming it exactly works too). Listed for each `upload`/`download` in a pipeline that names such a file | No |
| 1.12.0 | A `Bash` placeholder in an ssh option that runs a command (`-o ProxyCommand=…`, `LocalCommand`, `KnownHostsCommand`, a whole `-o {{x}}`, `-J`, `-F`, `scp -S`), in a remote path (`scp host:{{f}}`, `rsync host:{{f}}`), at the start of an `scp` path, in `rsync -e`/`--rsync-path`, or in what `sftp` reads on stdin is refused. Write the option out or use a `Host` alias in `~/.ssh/config`, use a fixed remote path, and write `./{{f}}` for a local scp file (see [`Bash`](../../stdlib/tools.md#bash)). Listed for each command `halo validate` warns about | No |
| 1.12.0 | An `Email` tool with `via: "gmail"` or `"outlook"` that signs in with `clientId:` gets its tokens from the [OAuth broker](../integrations/oauth.md). Its settings work as before. A refresh token the provider rotates is now kept outside the project (`~/.config/halo/credentials.json`, or the Keychain on macOS) and spent next time, instead of the one in `Env`. A new value in `Env` wins over it. On a Mac where nothing can answer a Keychain prompt (CI), set `HALO_CREDENTIALS_STORE=file`. Listed for each such `Email` tool | No |
