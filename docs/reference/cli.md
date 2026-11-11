---
title: CLI
---

# CLI

`halo` is one binary: install it with `curl -fsSL https://halolang.com/install.sh | sh` (see [Quickstart](/guide/quickstart)), update it with `halo upgrade`. This is `halo --help` from the current release:

<!--@include: ../.vitepress/generated/help.md-->

Every command that reads a `.halo` file (`run`, `test`, `validate`, `plan`, `serve`, `mcp`, `compare`) reads the files and installed packages it [`use`s](/spec#files-and-packages-use) too, and fills model slots from `halo.json` `"models"`. Problems in those files are reported where they are. Only the file's own pipelines can be run; the ones it imports are called from them.

Every `halo run` keeps a recording in `.halo/recordings` for [`halo replay`](/guide/plan-and-replay) (`--no-record` turns that off) and records telemetry for Halo Studio in `.halo/telemetry.db` (`--no-telemetry`). Exit status is 0 on success, 1 on a failed run or validation errors.
