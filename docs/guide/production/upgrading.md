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
