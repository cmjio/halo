---
layout: home
title: Halo
titleTemplate: a language for AI pipelines
---

<script setup>
import data from './.vitepress/generated/lite.json'
</script>

<section class="h-hero">
<div class="h-grid-bg" aria-hidden="true"></div>

<p class="h-eyebrow"><a href="https://github.com/cmjio/halo"><span class="h-dot"></span>Open source · MIT · v{{ data.version }}</a></p>

<h1 class="h-title">AI pipelines, <em>governed in code.</em></h1>

<p class="h-lede">Halo is a declarative language for AI workflows. Declare agents, tools, and the policies that bound them. The runtime checks every tool call against policy before it runs, plans a run before it starts, and replays it after.</p>

<div class="h-actions">
  <a class="h-btn primary" href="/guide/quickstart">Get started</a>
  <a class="h-btn" href="/playground">Try the playground</a>
  <a class="h-btn" href="https://github.com/cmjio/halo">GitHub ↗</a>
</div>

<div class="h-install">

```bash
curl -fsSL https://halolang.com/install.sh | sh
```

</div>
</section>

<section class="h-stage">
<div class="h-window">
<div class="h-pane">
<p class="h-pane-title"><i></i><i></i><i></i><span>triage.halo</span></p>

<!--@include: ./.vitepress/generated/hero-file.md-->

</div>
<div class="h-pane">
<p class="h-pane-title"><span>halo plan · nothing has run yet</span></p>

<!--@include: ./.vitepress/generated/hero-plan.md-->

</div>
</div>
<p class="h-caption center">Real CLI output, run on this file when this site was built.</p>
</section>

<section class="h-models">
<p>One file, any model</p>
<ul>
  <li>OpenAI</li><li>Anthropic</li><li>Google Gemini</li><li>OpenRouter</li><li>Together</li><li>Replicate</li><li>Ollama · local</li>
</ul>
</section>

<section class="h-section">
<div class="h-head">
<p class="h-kicker">The toolchain</p>
<h2 class="h-h2">From a file to a service, one command at a time.</h2>
</div>
<div class="h-flow">
<a href="/reference/cli"><code>halo validate</code><span>Undefined policies and unknown tools, reported with line and column.</span></a>
<a href="/dx/testing-and-mocks"><code>halo test</code><span>The whole pipeline offline, with every model and tool mocked.</span></a>
<a href="/guide/plan-and-replay"><code>halo plan</code><span>Every call, its worst-case cost, what it changes, and what needs approval.</span></a>
<a href="/reference/cli"><code>halo run</code><span>Every tool call checked against policy first. Every run recorded.</span></a>
<a href="/guide/plan-and-replay"><code>halo replay</code><span>A recorded run fed back exactly, with no model or tool calls.</span></a>
<a href="/guide/production/serving"><code>halo serve</code><span>HTTP API, webhooks, schedules, approval links, and Studio in one process.</span></a>
</div>
</section>

<section class="h-section">
<div class="h-head">
<p class="h-kicker">The language</p>
<h2 class="h-h2">Six operators. Control flow you can read in review.</h2>
</div>
<div class="h-ops">
<a href="/reference/operators#pipe"><b>|&gt;</b><strong>Pipe</strong><span>Call an agent, tool, or pipeline. Its result flows to the next stage.</span><code>|&gt; Writer.draft(context.data.outline)</code></a>
<a href="/reference/operators#gate-cond"><b>|?</b><strong>Gate · Branch</strong><span>Stop the run when a condition is false, or pick one arm of several.</span><code>|? (context.data.review.score &gt;= 70)</code></a>
<a href="/reference/operators#fan-out"><b>|*</b><strong>Fan-out · Each</strong><span>Run calls in parallel on one input, or once per item of a list.</span><code>|* { Optimist.argue_for(), Skeptic.argue_against() }</code></a>
<a href="/reference/operators#yield-yield"><b>|!</b><strong>Yield</strong><span>Ask a person. The run waits for the answer, then carries on.</span><code>|! yield("Publish this draft?", channel: "#editors")</code></a>
<a href="/reference/operators#loop-loop-agent-cond-max-n"><b>|&lt;&gt;</b><strong>Loop</strong><span>Send a failing result back to an agent until the check passes.</span><code>|&lt;&gt; loop(Coder, "context.data.tests.exitCode != 0", max: 3)</code></a>
<a href="/reference/operators#listen-listen-source-event"><b>~&gt;</b><strong>Listen</strong><span>Pause until an outside event arrives, then use its payload.</span><code>~&gt; listen(Slack.Reaction) as reaction</code></a>
</div>
</section>

<section class="h-section">
<div class="h-head">
<p class="h-kicker">Governance</p>
<h2 class="h-h2">Controls that run in code, not in a prompt.</h2>
<p class="h-sub">Every rule is checked by the runtime. No model judges the content, and the checks cost nothing.</p>
</div>
<div class="h-feats">
<a href="/stdlib/policies#tool-rules">
  <code>AllowTools · DenyArgs</code>
  <strong>Least privilege for agents</strong>
  <span>An agent sees only the tools its policy allows. Calls whose arguments match a pattern are refused before they run.</span>
</a>
<a href="/guide/architecture/human-in-the-loop">
  <code>ApproveTools · |! yield</code>
  <strong>Human approval</strong>
  <span>Ask a person in the terminal, by signed approval link, or with Slack buttons. Paused runs wait on disk and continue after a restart.</span>
</a>
<a href="/stdlib/policies">
  <code>MaxSpend(0.50)</code>
  <strong>Spend limits</strong>
  <span>A run stops once it reaches its limit. Calls in flight count at their most, so parallel calls can't overshoot it.</span>
</a>
<a href="/stdlib/policies#categories">
  <code>Redact(PII, APIKey)</code>
  <strong>Redaction and blocking</strong>
  <span>Applied to prompts, answers, and tool results before the model reads them. The redacted text is what telemetry keeps.</span>
</a>
<a href="/guide/integrations/telemetry-and-tracing">
  <code>verifyTrace(trace)</code>
  <strong>A trace you can verify</strong>
  <span>Every run returns a hash-chained trace, one entry per stage, with each call's model, latency, tokens, and cost.</span>
</a>
<a href="/guide/production/deploying">
  <code>ghcr.io/cmjio/halo</code>
  <strong>Runs on your infrastructure</strong>
  <span>One binary or one container image, on a VM, a container host, or a PaaS. Provider keys stay in your environment.</span>
</a>
</div>
</section>

<section class="h-section h-split">
<div class="h-head">
<p class="h-kicker">Agents with tools</p>
<h2 class="h-h2">Agents choose their tools. Policy sets the fence.</h2>
<p class="h-sub">Give an agent <code>tools: [...]</code> and it calls them until it has an answer, using each provider's native tool calling. Every call is checked against the agent's policies first.</p>
<p class="h-more"><a href="/guide/agents-with-tools">Agents with tools →</a></p>
</div>
<div>
<p class="h-caption top">The fixer from <a href="/examples/software-team">example 74</a>, fixing two bugs, as <code>halo run</code> recorded it:</p>
<RecordedRun />
</div>
</section>

<section class="h-section h-split">
<div class="h-head">
<p class="h-kicker">Checked first</p>
<h2 class="h-h2">Errors on your laptop, not in production.</h2>
<p class="h-sub"><code>halo validate</code> reports an undefined policy or an unknown tool with its line and column. <code>halo test</code> runs the whole pipeline offline, with every model and tool mocked.</p>
<p class="h-more"><a href="/dx/testing-and-mocks">Testing and mocks →</a></p>
</div>
<div>

<!--@include: ./.vitepress/generated/checks.md-->

</div>
</section>

<section class="h-section h-split">
<div class="h-head">
<p class="h-kicker">Plan and replay</p>
<h2 class="h-h2">Know the worst case before it runs.</h2>
<p class="h-sub"><code>halo plan</code> lists every model call with its worst-case cost, every tool it could call and what that changes, and what needs approval. Nothing runs.</p>
<p class="h-sub">Every run keeps a recording. <code>halo replay &lt;file&gt; &lt;run&gt;</code> feeds it back with no model or tool calls; the fixer run above replays in 19 ms, for $0.</p>
<p class="h-more"><a href="/guide/plan-and-replay">Plan and replay →</a></p>
</div>
<div>

<!--@include: ./.vitepress/generated/plan-research.md-->

</div>
</section>

<section class="h-section">
<div class="h-head">
<p class="h-kicker">See it run</p>
<h2 class="h-h2">Written, approved by a person, and blocked by a policy.</h2>
<p class="h-sub">The approval prompt, the block, and <code>halo plan</code> are the CLI's own output. The model's answer and its timings are illustrative.</p>
</div>

<video class="showcase" controls preload="metadata" playsinline poster="/video/halo-showcase.jpg" src="/video/halo-showcase.mp4"></video>
</section>

<section class="h-section h-open">
<div class="h-head">
<p class="h-kicker">Open</p>
<h2 class="h-h2">MIT licensed. No lock-in at any layer.</h2>
<p class="h-sub">The language, the runtime, the CLI, Studio, and the editor tooling are in one public repository.</p>
<div class="h-actions">
  <a class="h-btn" href="https://github.com/cmjio/halo">Read the source ↗</a>
  <a class="h-btn ghost" href="/spec">Language spec →</a>
</div>
<dl class="h-stats">
  <div><dt>{{ data.counts.examples }}</dt><dd>runnable examples</dd></div>
  <div><dt>{{ data.counts.providers }}</dt><dd>built-in tool providers</dd></div>
  <div><dt>{{ data.counts.packages }}</dt><dd>tool packages</dd></div>
</dl>
</div>
<div class="h-openlist">
<a href="/guide/reference"><strong>Any model</strong><span>A model id's prefix picks the provider: <code>openai/</code>, <code>anthropic/</code>, <code>google/</code>, <code>openrouter/</code>, <code>together/</code>, <code>replicate/</code>, <code>ollama/</code>.</span></a>
<a href="/guide/integrations/mcp"><strong>MCP, both ways</strong><span>Use any MCP server as a tool. Expose your pipelines as MCP tools with <code>halo mcp</code>.</span></a>
<a href="/guide/tool-packages"><strong>Tool packages</strong><span>Install tools for Stripe, Notion, Jira, Sentry, and GitHub from the registry, or publish your own.</span></a>
<a href="/guide/sdk"><strong>A library, too</strong><span>Embed the runtime in a Bun server and forward its events to the logging or tracing system you already use.</span></a>
<a href="/dx/editor-support"><strong>Your editor</strong><span>A language server with diagnostics, hover, and completion, plus packages for VS Code, Zed, and Sublime Text.</span></a>
<a href="/guide/production/deploying"><strong>Your pipeline</strong><span>Docker, GitHub Actions, npm, cron, or a plain HTTP call from a service in any language.</span></a>
</div>
</section>

<section class="h-cta" id="install">
<div class="h-head">
<p class="h-kicker">Install</p>
<h2 class="h-h2">One binary. Nothing else to install.</h2>
<p class="h-sub">The script picks the build for your OS and CPU, checks it against the release's <code>SHA256SUMS</code>, and puts it in <code>~/.halo/bin</code>. <a href="/install.sh">Read the script</a> before piping it to a shell; <code>halo upgrade</code> updates it.</p>
</div>
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

```bash [Docker]
docker run -p 8080:8080 -v "$PWD:/app" -e HALO_SERVE_TOKEN -e ANTHROPIC_API_KEY ghcr.io/cmjio/halo
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
<div class="h-cards">
  <a href="/guide/quickstart"><strong>Quickstart</strong><span>Install, write a pipeline, run it</span></a>
  <a href="/guide/reference"><strong>Language reference</strong><span>Every declaration, operator, and built-in</span></a>
  <a href="/reference/cli"><strong>CLI</strong><span>Every command and flag</span></a>
  <a href="/stdlib/policies"><strong>Policies</strong><span>Every rule the runtime enforces</span></a>
  <a href="/reference/providers"><strong>Tool providers</strong><span>Built-in and packaged tools, with their effects</span></a>
  <a href="/examples/"><strong>Examples</strong><span>From hello world to a team of agents</span></a>
  <a href="/packages"><strong>Packages</strong><span>Install tools, or publish your own</span></a>
  <a href="/guide/production/serving"><strong>Serving</strong><span>HTTP, webhooks, schedules, Slack approvals, MCP</span></a>
</div>
</section>
