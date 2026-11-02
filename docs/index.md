---
layout: home
title: Halo
titleTemplate: a language for AI pipelines

hero:
  name: "halo"
  text: "A language for AI pipelines"
  tagline: "Declare agents, tools, and the policies that bound them, then chain them with pipeline operators. The runtime checks every tool call an agent makes against its policies before it runs. halo plan shows what a run could do; halo replay reruns exactly what it did."
  actions:
    - theme: brand
      text: Install
      link: "#install"
    - theme: alt
      text: Quickstart
      link: /guide/quickstart
    - theme: alt
      text: Playground
      link: /playground
---

## Install

::: code-group

```bash [macOS · Linux]
curl -fsSL https://halolang.com/install.sh | sh
```

```powershell [Windows]
irm https://halolang.com/install.ps1 | iex
```

```bash [From source]
git clone https://github.com/cmjio/halo && cd halo
bun install && bun link   # `halo` now runs the source
```

:::

One standalone binary with Bun built in, so there's nothing else to install. The script picks the build for your OS and CPU, checks it against the release's `SHA256SUMS`, and puts it in `~/.halo/bin`. [Read the script](/install.sh) before piping it to a shell. `halo upgrade` updates it.

```bash
halo init my-flow && cd my-flow
halo test main.halo --arg topic=tides   # offline: every model and tool mocked
halo run main.halo --arg topic=tides    # with ANTHROPIC_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY set
```

## What it looks like

A file, and what the CLI says about it. The outputs are the real CLI, run on these files when this site was built.

<!--@include: ./.vitepress/generated/hero.md-->

## Agents choose their tools; policy sets the fence

Give an agent `tools: [...]` and it calls them until it has an answer, using each provider's native tool calling. Every call is checked against the agent's policies first:

- `AllowTools` / `AllowEffects` decide what it can see at all.
- `DenyArgs` refuses calls whose arguments match a pattern.
- `ApproveTools` asks a person first (terminal, approval link, or Slack buttons); the run waits on disk until someone answers.
- Tool results go through the agent's `Redact` and `Block` rules before the model reads them.

A real run of the fixer in [example 74](/examples/74-software-team), on a small project with two bugs, as `halo run` recorded it:

<RecordedRun />

[Agents with tools →](/guide/agents-with-tools)

## Plan before; replay after

`halo plan` lists every model call with its worst-case cost, every tool it could call and what that changes, and what needs approval. Nothing runs.

<!--@include: ./.vitepress/generated/plan-research.md-->

Every run keeps a recording of what it got back. `halo replay <file> <run>` feeds it back with no model or tool calls (the fixer run above replays in 19 ms, for $0); `--live-models` or `--live-tools` redo one side. [Plan and replay →](/guide/plan-and-replay)

## Where next

| | |
|---|---|
| [Quickstart](/guide/quickstart) | Install, write a pipeline, run it |
| [Language reference](/guide/reference) | Every declaration, operator, and built-in |
| [CLI](/reference/cli) | Every command and flag |
| [Tool providers](/reference/providers) | Every built-in and packaged tool, with its methods and effects |
| [Policies](/stdlib/policies) | Every rule the runtime enforces |
| [Examples](/examples/) | Working pipelines, from hello world to a team of agents |
| [Packages](/packages) | Install tools for Stripe, Notion, Jira, Sentry, GitHub; publish your own |
| [Serving](/guide/production/serving) | HTTP API, webhooks, schedules, watches, Slack approvals, MCP |
