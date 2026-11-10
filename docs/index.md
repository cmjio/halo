---
layout: home
title: Halo
titleTemplate: a language for AI pipelines
---

<script setup>
import data from './.vitepress/generated/lite.json'
</script>

<section class="h-hero">
<div class="h-ring" aria-hidden="true"></div>
<div class="h-hero-main">

<p class="h-eyebrow"><span class="h-dot"></span>halo v{{ data.version }} · a language for AI pipelines</p>

<h1 class="h-title" aria-label="Agents: bounded, planned, replayed.">
  <span class="h-line">Agents</span>
  <span class="h-line in"><b>|&gt;</b> bounded</span>
  <span class="h-line in"><b>|&gt;</b> planned</span>
  <span class="h-line in"><b>|&gt;</b> replayed.</span>
</h1>

</div>
<div class="h-hero-side">

<p class="h-lede">Declare agents, tools, and the policies that fence them in, then wire them together with pipe operators. The runtime checks every tool call against policy before it runs.</p>

```bash
curl -fsSL https://halolang.com/install.sh | sh
```

<div class="h-actions">
  <a class="h-btn primary" href="/guide/quickstart">Quickstart →</a>
  <a class="h-btn" href="/playground">Playground</a>
  <a class="h-btn ghost" href="https://github.com/cmjio/halo">GitHub</a>
</div>

</div>
</section>

<section class="h-stage">
<div class="h-window">
<div class="h-pane">
<p class="h-pane-title"><i></i><i></i><i></i><span>triage.halo</span></p>

<!--@include: ./.vitepress/generated/hero-file.md-->

</div>
<div class="h-pane">
<p class="h-pane-title"><span>what the CLI says, before anything runs</span></p>

<!--@include: ./.vitepress/generated/hero-plan.md-->

</div>
</div>
<p class="h-caption">Real CLI output, run on this file when this site was built.</p>
</section>

<section class="h-stats">
  <div><b>{{ data.counts.examples }}</b><span>runnable examples</span></div>
  <div><b>{{ data.counts.providers }}</b><span>built-in tool providers</span></div>
  <div><b>{{ data.counts.packages }}</b><span>tool packages to install</span></div>
  <div><b>19<small>ms</small></b><span>to replay a recorded run, for $0</span></div>
</section>

<section class="h-rows">
<a class="h-row" href="/reference/operators">
  <span class="h-row-n">01</span>
  <span class="h-row-t">Declare</span>
  <span class="h-row-d">A <code>.halo</code> file names its agents, tools, policies and schemas, then chains them into pipelines. The validator catches an undefined policy or unknown tool before anything runs.</span>
</a>
<a class="h-row" href="/stdlib/policies">
  <span class="h-row-n">02</span>
  <span class="h-row-t">Bound</span>
  <span class="h-row-d">Agents pick their own tool calls. Policies decide which they can see, which arguments are refused, which need a person, and how much a run may spend.</span>
</a>
<a class="h-row" href="/guide/plan-and-replay">
  <span class="h-row-n">03</span>
  <span class="h-row-t">Prove</span>
  <span class="h-row-d"><code>halo plan</code> lists every call, cost and side effect before a run. <code>halo replay</code> reruns a recording exactly, with no model or tool calls.</span>
</a>
</section>

<section class="h-section">
<div class="h-section-head">
<p class="h-kicker">The operators</p>
<h2 class="h-h2">Six operators.<br>One pipeline.</h2>
</div>
<div class="h-ops">
<a class="h-op" href="/reference/operators#pipe">
  <span class="h-op-g">|&gt;</span>
  <span class="h-op-n">Pipe</span>
  <span class="h-op-d">Call an agent, tool, or pipeline. Its result flows to the next stage.</span>
  <code>|&gt; Writer.draft(context.data.outline)</code>
</a>
<a class="h-op" href="/reference/operators#gate-cond">
  <span class="h-op-g">|?</span>
  <span class="h-op-n">Gate · Branch</span>
  <span class="h-op-d">Stop the run when a condition is false, or pick one arm of several.</span>
  <code>|? (context.data.review.score &gt;= 70)</code>
</a>
<a class="h-op" href="/reference/operators#fan-out">
  <span class="h-op-g">|*</span>
  <span class="h-op-n">Fan-out · Each</span>
  <span class="h-op-d">Run calls in parallel on one input, or once per item of a list.</span>
  <code>|* { Optimist.argue_for(), Skeptic.argue_against() }</code>
</a>
<a class="h-op" href="/reference/operators#yield-yield">
  <span class="h-op-g">|!</span>
  <span class="h-op-n">Yield</span>
  <span class="h-op-d">Ask a person. The run waits for the answer, then carries on.</span>
  <code>|! yield("Publish this draft?", channel: "#editors")</code>
</a>
<a class="h-op" href="/reference/operators#loop-loop-agent-cond-max-n">
  <span class="h-op-g">|&lt;&gt;</span>
  <span class="h-op-n">Loop</span>
  <span class="h-op-d">Send a failing result back to an agent until the check passes.</span>
  <code>|&lt;&gt; loop(Coder, "context.data.tests.exitCode != 0", max: 3)</code>
</a>
<a class="h-op" href="/reference/operators#listen-listen-source-event">
  <span class="h-op-g">~&gt;</span>
  <span class="h-op-n">Listen</span>
  <span class="h-op-d">Pause until an outside event arrives, then use its payload.</span>
  <code>~&gt; listen(Slack.Reaction) as reaction</code>
</a>
</div>
</section>

<section class="h-section">
<div class="h-section-head">
<p class="h-kicker">Halo in a minute</p>
<h2 class="h-h2 wide">Written. Approved by a person. Blocked by a policy.</h2>
<p class="h-sub">The approval prompt, the block, and <code>halo plan</code> are the CLI's own output. The model's answer and its timings are illustrative.</p>
</div>

<video class="showcase" controls preload="metadata" playsinline poster="/video/halo-showcase.jpg" src="/video/halo-showcase.mp4"></video>
</section>

<section class="h-section h-split">
<div class="h-section-head">
<p class="h-kicker">Agents with tools</p>
<h2 class="h-h2">Agents choose their tools. Policy sets the fence.</h2>
<p class="h-sub">Give an agent <code>tools: [...]</code> and it calls them until it has an answer, using each provider's native tool calling. Every call is checked first:</p>
<ul class="h-list">
  <li><code>AllowTools</code> / <code>AllowEffects</code> decide what it can see at all.</li>
  <li><code>DenyArgs</code> refuses calls whose arguments match a pattern.</li>
  <li><code>ApproveTools</code> asks a person first: terminal, approval link, or Slack buttons. The run waits on disk.</li>
  <li>Tool results pass through <code>Redact</code> and <code>Block</code> before the model reads them.</li>
</ul>
<p class="h-more"><a href="/guide/agents-with-tools">Agents with tools →</a></p>
</div>
<div>
<p class="h-caption top">The fixer from <a href="/examples/software-team">example 74</a>, fixing two bugs, as <code>halo run</code> recorded it:</p>
<RecordedRun />
</div>
</section>

<section class="h-section h-split">
<div class="h-section-head">
<p class="h-kicker">Checked first</p>
<h2 class="h-h2">Wrong on your laptop, not in production.</h2>
<p class="h-sub"><code>halo validate</code> reports an undefined policy or an unknown tool with its line and column. <code>halo test</code> runs the whole pipeline offline, with every model and tool mocked.</p>
<p class="h-more"><a href="/dx/testing-and-mocks">Testing and mocks →</a></p>
</div>
<div class="h-tabs">

<!--@include: ./.vitepress/generated/checks.md-->

</div>
</section>

<section class="h-section h-split">
<div class="h-section-head">
<p class="h-kicker">Plan before, replay after</p>
<h2 class="h-h2">Know the worst case before it runs.</h2>
<p class="h-sub"><code>halo plan</code> lists every model call with its worst-case cost, every tool it could call and what that changes, and what needs approval. Nothing runs.</p>
<p class="h-sub">Every run keeps a recording. <code>halo replay &lt;file&gt; &lt;run&gt;</code> feeds it back with no model or tool calls; <code>--live-models</code> or <code>--live-tools</code> redo one side.</p>
<p class="h-more"><a href="/guide/plan-and-replay">Plan and replay →</a></p>
</div>
<div>

<!--@include: ./.vitepress/generated/plan-research.md-->

</div>
</section>

<section class="h-cta" id="install">
<p class="h-kicker">Install</p>
<p class="h-cta-cmd" aria-hidden="true"><b>$</b> halo init my-flow</p>
<h2 class="h-h2">One binary. Bun built in.</h2>
<p class="h-sub">The script picks the build for your OS and CPU, checks it against the release's <code>SHA256SUMS</code>, and puts it in <code>~/.halo/bin</code>. <a href="/install.sh">Read the script</a> before piping it to a shell; <code>halo upgrade</code> updates it.</p>

<div class="h-cta-code">

::: code-group

```bash [macOS · Linux]
curl -fsSL https://halolang.com/install.sh | sh
```

```powershell [Windows]
irm https://halolang.com/install.ps1 | iex
```

```bash [npm · pnpm · Bun]
npx @halolang/halo init my-flow
```

```bash [From source]
git clone https://github.com/cmjio/halo && cd halo
bun install && bun link   # `halo` now runs the source
```

:::

```bash
halo init my-flow && cd my-flow
halo test main.halo --arg topic=tides   # offline: every model and tool mocked
halo run main.halo --arg topic=tides    # with ANTHROPIC_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY set
```

</div>
</section>

<section class="h-section">
<div class="h-section-head">
<p class="h-kicker">Where next</p>
</div>
<div class="h-cards">
  <a href="/guide/quickstart"><strong>Quickstart</strong><span>Install, write a pipeline, run it</span></a>
  <a href="/guide/reference"><strong>Language reference</strong><span>Every declaration, operator, and built-in</span></a>
  <a href="/reference/cli"><strong>CLI</strong><span>Every command and flag</span></a>
  <a href="/stdlib/policies"><strong>Policies</strong><span>Every rule the runtime enforces</span></a>
  <a href="/reference/providers"><strong>Tool providers</strong><span>Built-in and packaged tools, with their effects</span></a>
  <a href="/examples/"><strong>Examples</strong><span>From hello world to a team of agents</span></a>
  <a href="/packages"><strong>Packages</strong><span>Stripe, Notion, Jira, Sentry, GitHub; publish your own</span></a>
  <a href="/guide/production/serving"><strong>Serving</strong><span>HTTP, webhooks, schedules, Slack approvals, MCP</span></a>
</div>
</section>
