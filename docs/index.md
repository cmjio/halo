---
layout: home
title: Halo
titleTemplate: a language for AI pipelines
---

<section class="h-hero">
<div class="h-hero-copy">

<p class="h-eyebrow"><span class="h-dot"></span>halo · a language for AI pipelines</p>

<h1 class="h-title">Agents you can <em>bound</em>, plan, and replay.</h1>

<p class="h-lede">Declare agents, tools, and the policies that fence them in, then wire them together with pipe operators. The runtime checks every tool call against policy before it runs.</p>

```bash
curl -fsSL https://halolang.com/install.sh | sh
```

<div class="h-actions">
  <a class="h-btn primary" href="/guide/quickstart">Quickstart →</a>
  <a class="h-btn" href="/playground">Open the playground</a>
  <a class="h-btn ghost" href="https://github.com/cmjio/halo">GitHub</a>
</div>

</div>
<div class="h-hero-code">

<!--@include: ./.vitepress/generated/hero.md-->

<p class="h-caption">Real CLI output, run on these files when this site was built.</p>

</div>
</section>

<section class="h-pillars">
<a class="h-pillar" href="/reference/operators">
  <span class="h-num">01</span>
  <h3>Declare</h3>
  <p>A <code>.halo</code> file names its agents, tools, policies and schemas, then chains them into pipelines. The validator catches an undefined policy or unknown tool before anything runs.</p>
</a>
<a class="h-pillar" href="/stdlib/policies">
  <span class="h-num">02</span>
  <h3>Bound</h3>
  <p>Agents pick their own tool calls. Policies decide which they can see, which arguments are refused, which need a person, and how much a run may spend.</p>
</a>
<a class="h-pillar" href="/guide/plan-and-replay">
  <span class="h-num">03</span>
  <h3>Prove</h3>
  <p><code>halo plan</code> lists every call, cost and side effect before a run. <code>halo replay</code> reruns a recording exactly, with no model or tool calls.</p>
</a>
</section>

<section class="h-ops">
<p class="h-kicker">Six operators, one pipeline</p>
<div class="h-ops-grid">
  <a href="/reference/operators#pipe"><code>|&gt;</code><span>pipe a value to the next step</span></a>
  <a href="/reference/operators#gate-cond"><code>|?</code><span>gate or branch on a condition</span></a>
  <a href="/reference/operators#fan-out"><code>|*</code><span>fan out in parallel, or each over a list</span></a>
  <a href="/reference/operators#yield-yield"><code>|!</code><span>stop and ask a person</span></a>
  <a href="/reference/operators#loop-loop-agent-cond-max-n"><code>|&lt;&gt;</code><span>loop until an agent is satisfied</span></a>
  <a href="/reference/operators#listen-listen-source-event"><code>~&gt;</code><span>listen for an event to start</span></a>
</div>
</section>

<section class="h-section">
<div class="h-section-head">
<p class="h-kicker">Halo in a minute</p>
<h2 class="h-h2">Written, approved by a person, and blocked by a policy</h2>
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
<p class="h-kicker">Plan before, replay after</p>
<h2 class="h-h2">Know the worst case before it runs</h2>
<p class="h-sub"><code>halo plan</code> lists every model call with its worst-case cost, every tool it could call and what that changes, and what needs approval. Nothing runs.</p>
<p class="h-sub">Every run keeps a recording. <code>halo replay &lt;file&gt; &lt;run&gt;</code> feeds it back with no model or tool calls (the fixer run replays in 19 ms, for $0); <code>--live-models</code> or <code>--live-tools</code> redo one side.</p>
<p class="h-more"><a href="/guide/plan-and-replay">Plan and replay →</a></p>
</div>
<div>

<!--@include: ./.vitepress/generated/plan-research.md-->

</div>
</section>

<section class="h-section" id="install">
<div class="h-section-head">
<p class="h-kicker">Install</p>
<h2 class="h-h2">One binary. Bun built in.</h2>
<p class="h-sub">The script picks the build for your OS and CPU, checks it against the release's <code>SHA256SUMS</code>, and puts it in <code>~/.halo/bin</code>. <a href="/install.sh">Read the script</a> before piping it to a shell; <code>halo upgrade</code> updates it.</p>
</div>

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
