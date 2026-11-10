---
layout: page
title: Playground
sidebar: false
aside: false
---

<div class="vp-doc playground-page">

# Playground

Halo's real parser, validator, and planner, running in your browser: write Halo and it's checked and planned as you type. Nothing leaves the page and no model is called, so break things freely.

- **Challenges**: 22 small puzzles in five tracks. **Basics** (agents, pipes, naming results, system prompts), **Flow** (gates, branches, fan-outs, `each`, loops, calling pipelines, waiting for events), **Safety** (spend caps, human approval, redaction, prompt-injection blocking, read-only tools), **Reliability** (JSON policies, `@correct`, `@retry`, schemas, `@expect`), and a **Finale** that puts them together. Each one checks itself as you type and has a hint if you're stuck.
- **Every example**, grouped like the [examples folder](/examples/). Press **Surprise me** for a random one.
- **The cheat sheet tab** adds agents, pipes, gates, loops, and policies below your cursor.
- **Your edits are kept** in this browser, and **Share** copies a link to exactly what's in the editor.

Link to an example with `?example=01-hello`, or a challenge with `?challenge=budget`.

<ClientOnly>
  <Playground />
</ClientOnly>

</div>

<style>
/* The whole window: the editor wants every column it can get. */
.playground-page {
  max-width: none;
  margin: 0;
  padding: 24px 24px 48px;
}
</style>
