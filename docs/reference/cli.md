---
title: CLI
---

# CLI

`halo` is one binary: install it with `curl -fsSL https://halolang.com/install.sh | sh` (see [Quickstart](/guide/quickstart)), update it with `halo upgrade`. This is `halo --help` from the current release:

<!--@include: ../.vitepress/generated/help.md-->

Every `halo run` keeps a recording in `.halo/recordings` for [`halo replay`](/guide/plan-and-replay) (`--no-record` turns that off) and records telemetry for Halo Studio in `.halo/telemetry.db` (`--no-telemetry`). Exit status is 0 on success, 1 on a failed run or validation errors.
