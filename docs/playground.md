---
layout: page
title: Playground
sidebar: false
aside: false
---

<div class="vp-doc playground-page">

# Playground

Halo's real parser, validator, and planner, running in your browser: write Halo and it's checked and planned as you type. Nothing leaves the page and no model is called, so break things freely.

- **🎯 Challenges**: seven small puzzles, from squashing a bug to capping what a run can spend. Each one checks itself as you type and has a hint if you're stuck.
- **📚 Every example**, grouped like the [examples folder](/examples/). Roll the 🎲 for a random one.
- **The cheat sheet tab** adds agents, pipes, gates, loops, and policies below your cursor.
- **Your edits are kept** in this browser, and **🔗 Share** copies a link to exactly what's in the editor.

Link to an example with `?example=01-hello`, or a challenge with `?challenge=budget`.

<ClientOnly>
  <Playground />
</ClientOnly>

</div>

<style>
.playground-page {
  max-width: 1280px;
  margin: 0 auto;
  padding: 32px 24px 64px;
}
</style>
