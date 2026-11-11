---
layout: home
title: Halo
titleTemplate: a language for AI pipelines
---

<script setup>
import data from './.vitepress/generated/lite.json'
</script>

<section class="h-hero">
<div class="h-hero-copy">

<h1 class="h-title"><svg class="h-mark" viewBox="0 0 32 26" aria-hidden="true"><ellipse cx="16" cy="6.2" rx="12.4" ry="4.6" fill="none" stroke="currentColor" stroke-width="2.6"/><circle class="h-mark-dot" cx="16" cy="18.6" r="6.2"/></svg><span>halo</span></h1>

<p class="h-tagline">A declarative language for AI pipelines.</p>

<p class="h-lede">A <code>.halo</code> file declares agents, tools, policies, and schemas, and wires them into pipelines with six operators. The runtime checks every tool call against policy in code, records every run, and can replay it without calling a model.</p>

<div class="h-install">

```bash
curl -fsSL https://halolang.com/install.sh | sh
```

</div>

<div class="h-actions">
  <a class="h-btn primary" href="/guide/quickstart">Quickstart</a>
  <a class="h-btn" href="/guide/reference">Language reference</a>
  <a class="h-btn" href="/playground">Playground</a>
  <a class="h-btn" href="https://github.com/cmjio/halo">Source</a>
</div>

</div>
<svg class="h-figure" viewBox="0 0 520 300" role="img" aria-label="A pipeline of five stages. The two agent stages each have a ring above them.">
  <path class="h-fig-line" d="M40 196 H480"/>
  <g class="h-fig-ring"><ellipse cx="150" cy="148" rx="46" ry="16"/><ellipse cx="370" cy="148" rx="46" ry="16"/></g>
  <g class="h-fig-stage"><circle cx="40" cy="196" r="7"/><circle cx="260" cy="196" r="7"/><circle cx="480" cy="196" r="7"/></g>
  <g class="h-fig-agent"><circle cx="150" cy="196" r="22"/><circle cx="370" cy="196" r="22"/></g>
  <g class="h-fig-op"><text x="95" y="184">|&gt;</text><text x="205" y="184">|&gt;</text><text x="315" y="184">|?</text><text x="425" y="184">|&gt;</text></g>
  <g class="h-fig-label"><text x="40" y="246">input</text><text x="150" y="246">agent</text><text x="260" y="246">tool</text><text x="370" y="246">agent</text><text x="480" y="246">result</text></g>
  <g class="h-fig-label h-fig-policy"><text x="150" y="116">policy</text><text x="370" y="116">policy</text></g>
</svg>
</section>

<nav class="h-toc" aria-label="On this page">
  <a href="#program">Program structure</a>
  <a href="#context">Execution model</a>
  <a href="#operators">Operators</a>
  <a href="#tool-calls">Tool calls under policy</a>
  <a href="#policies">Policies and effects</a>
  <a href="#plan">Static planning</a>
  <a href="#replay">Recording and replay</a>
  <a href="#toolchain">Toolchain</a>
  <a href="#runtime">Models and runtime</a>
  <a href="#install">Install</a>
</nav>

<section class="h-section" id="program">
<div class="h-head">
<h2 class="h-h2">Program structure</h2>
<p class="h-sub">Each agent is a model plus a configuration. A pipeline calls it as one step in a fixed sequence of stages. The file below is complete: it validates, plans, and runs as written.</p>
</div>
<div class="h-anatomy">
<div class="h-file">
<p class="h-file-name">triage.halo</p>

<!--@include: ./.vitepress/generated/hero-file.md-->

</div>
<ol class="h-notes">
  <li><code>policy</code><span>A list of rules joined with <code>&amp;</code>. Here: which tool methods the agent may be offered, which need a person's approval, and a spend limit for the run. Every rule is evaluated by the runtime, not by a model.</span></li>
  <li><code>tool</code><span>A named instance of a provider, with its arguments. <code>Env.GITHUB_TOKEN</code> is read from the environment at run time. Each provider method carries an effect: <code>read</code>, <code>write</code>, or <code>external</code>.</span></li>
  <li><code>agent</code><span>A model id and its parameters in brackets, then the tools it <code>equips</code> and the policies it <code>requires</code>. Agents keep no memory between calls; earlier results are passed explicitly.</span></li>
  <li><code>pipeline</code><span>Typed parameters, a return type, and a chain of stages. With <code>tools: [Repo]</code> the agent chooses its own calls, up to <code>max_steps</code>; without it, an agent call is a single model request.</span></li>
</ol>
</div>
<p class="h-more"><a href="/guide/concepts">Core concepts →</a></p>
</section>

<section class="h-section h-split" id="context">
<div class="h-head">
<h2 class="h-h2">Execution model</h2>
<p class="h-sub">A pipeline starts from a value, usually a parameter. Each stage's result becomes the next stage's input, <code>context.current</code>, and is stored under <code>context.data</code> by callee and method, by method alone, and by its <code>as</code> binding.</p>
<p class="h-sub">Strings reference parameters and results with <code v-pre>{{name}}</code>. <code>halo validate</code> follows what each stage writes and warns when a path is read before anything sets it.</p>
<p class="h-more"><a href="/reference/context-and-scope">Context and scope →</a></p>
</div>
<div>

```halo
agent Summarizer [openai/gpt-4o-mini]
agent Editor     [openai/gpt-4o-mini]

pipeline Process(email: String) -> Result:
  email
    |> Summarizer.summarize() as summary
    |> Editor.polish(context.data.Summarizer.summarize, original: email)
```

<div class="h-table">

| Path | Contents |
|---|---|
| `context.current` | The flowing value: the last stage's result |
| `context.input` | The pipeline's arguments, as passed |
| `context.data` | Arguments, call results, and `as` bindings |
| `context.meta` | `runId`, `cost`, `tokens`, `calls`, `violations`, `halted`, `paused`, and timings |
| `context.trace` | One entry per stage, each with a SHA-256 hash linking it to the previous entry |

</div>
</div>
</section>

<section class="h-section" id="operators">
<div class="h-head">
<h2 class="h-h2">Operators</h2>
<p class="h-sub">Gates, branches, and loops are pipeline stages, not statements. Each operator adds one stage. Any stage that produces a value can end with <code>as name</code>, which stores it at <code>context.data.name</code>.</p>
</div>
<div class="h-ops">
<a href="/reference/operators#pipe"><b>|&gt;</b><strong>Pipe</strong><span>Calls an agent, tool, <code>System</code> method, or pipeline. The result becomes the flowing value.</span><code>|&gt; Writer.draft(context.data.outline)</code></a>
<a href="/reference/operators#gate-cond"><b>|?</b><strong>Gate · Branch</strong><span>Gate: if the condition is false the run ends with status <code>halted</code>, which is not an error. Branch: runs the first arm whose condition holds.</span><code>|? (context.data.review.score &gt;= 70)</code></a>
<a href="/reference/operators#fan-out"><b>|*</b><strong>Fan-out · Each</strong><span>Runs calls in parallel on the same input and returns a list in the same order. <code>each</code> calls once per item, 4 at a time by default.</span><code>|* { Optimist.argue_for(), Skeptic.argue_against() }</code></a>
<a href="/reference/operators#yield-yield"><b>|!</b><strong>Yield</strong><span>Asks a person. The response is stored at <code>context.data.yield</code>; the flowing value continues unchanged. With no handler, the run pauses.</span><code>|! yield("Publish this draft?", channel: "#editors")</code></a>
<a href="/reference/operators#loop-loop-agent-cond-max-n"><b>|&lt;&gt;</b><strong>Loop</strong><span>While the condition holds, jumps back to that agent's most recent stage with the failing value. After <code>max</code> tries (default 3) the run fails with <code>LoopLimitError</code>.</span><code>|&lt;&gt; loop(Coder, "context.data.tests.exitCode != 0", max: 3)</code></a>
<a href="/reference/operators#listen-listen-source-event"><b>~&gt;</b><strong>Listen</strong><span>Waits for an external event and stores its payload. The run pauses until your server calls <code>signal()</code>.</span><code>~&gt; listen(Slack.Reaction) as reaction</code></a>
</div>
<p class="h-more"><a href="/reference/operators">Operator reference →</a></p>
</section>

<section class="h-section h-split" id="tool-calls">
<div class="h-head">
<h2 class="h-h2">Tool calls under policy</h2>
<p class="h-sub">With <code>tools:</code>, an agent asks for a tool, sees the result, and asks again until it answers, using each provider's native tool calling. Each request passes through the same sequence:</p>
<ol class="h-steps">
  <li><strong>Offer</strong><span>Only methods that every <code>AllowTools</code> and <code>AllowEffects</code> rule permits are sent to the model, as functions named <code>Tool__method</code> with JSON Schema arguments. Hidden methods are not offered.</span></li>
  <li><strong>Refuse</strong><span><code>DenyTools</code> and <code>DenyArgs</code> are checked against the call. A refusal is recorded in <code>context.meta.violations</code>; the model is told, and the run continues.</span></li>
  <li><strong>Approve</strong><span><code>ApproveTools</code> and <code>ApproveEffects</code> apply after the refusal checks, so a refused call is never put to a person. The run waits for the answer.</span></li>
  <li><strong>Execute</strong><span>The tool runs with only the arguments the model gave. Its result is cut at <code>tool_result_chars</code> (16,000 by default).</span></li>
  <li><strong>Filter</strong><span>The result is input to the model, so the agent's <code>Redact</code> and <code>Block</code> rules apply before the model reads it.</span></li>
  <li><strong>Repeat</strong><span>Up to <code>max_steps</code> requests (10 by default). The final answer goes through output policies, schemas, and <code>@correct</code> as usual.</span></li>
</ol>
<p class="h-more"><a href="/guide/agents-with-tools">Agents with tools →</a></p>
</div>
<div>
<p class="h-caption top">A recorded run of the fixer from <a href="/examples/software-team">example 74</a>: seven model requests, nine tool calls, each labelled with its effect.</p>
<RecordedRun />
</div>
</section>

<section class="h-section" id="policies">
<div class="h-head">
<h2 class="h-h2">Policies and effects</h2>
<p class="h-sub">Every rule runs in code: no model judges the content, and the checks cost nothing. An agent applies a policy with <code>requires</code>. A failed rule throws a <code>PolicyViolation</code>, is recorded in <code>context.meta.violations</code>, and is never retried. The detectors are regular expressions: they catch common patterns, not every variant.</p>
</div>
<div class="h-cols">
<div class="h-table">

| Rule | Checked on | Effect |
|---|---|---|
| `Block(cat, ...)` | prompt and answer | Fails if a category is detected: `PromptInjection`, `DestructiveOps`, `PII`, and others |
| `Redact(cat, ...)` | prompt and answer | Replaces matches with `[REDACTED:<cat>]`; runs before `Block` |
| `MaxSpend(usd)` | before and after each call | Fails once the run's cost reaches the limit; calls in flight count at their most |
| `Require(JSON)` | answer | Fails unless the answer is JSON; pair with `@correct(n)` to ask again |
| `Validate(field, op, value)` | answer | Compares a field of the JSON answer with a literal or a `context` path |
| `AllowTools(pattern, ...)` | tool offer | Only matching methods are offered to the model |
| `DenyArgs(pattern, regex)` | tool call | Refuses a call if an argument value matches |
| `ApproveTools(pattern, ...)` | tool call | The call waits for a person's approval |

</div>
<div class="h-effects">
<p class="h-effects-title">Every tool method declares one effect</p>
<dl>
  <div><dt><span class="e read">read</span></dt><dd>Changes nothing.</dd></div>
  <div><dt><span class="e write">write</span></dt><dd>Changes local or stored state: a file, a KV key, a SQL statement.</dd></div>
  <div><dt><span class="e external">external</span></dt><dd>Acts outside this machine or can't be taken back: a POST, a Slack message, a shell command.</dd></div>
</dl>
<p class="h-note">An effect is a description written by whoever made the provider, not something Halo measures. Built-in providers err on the side of <code>external</code>. <code>halo tools</code> lists every method's effect.</p>
</div>
</div>
<p class="h-more"><a href="/stdlib/policies">Policy reference →</a></p>
</section>

<section class="h-section h-split" id="plan">
<div class="h-head">
<h2 class="h-h2">Static planning</h2>
<p class="h-sub"><code>halo plan</code> reads the file and runs nothing: no model calls, no tool calls, no API keys. For each stage it lists the model and a worst-case cost, the tool calls the pipeline makes, and the ones an agent may choose, each with its effect.</p>
<p class="h-sub">The cost is an upper bound from the model's price list, not a forecast:</p>
<ul class="h-list">
  <li>Each model call counts its instructions, 2,000 tokens for inputs it can't know, and a full reply of <code>max_tokens</code>.</li>
  <li>An agent with tools counts <code>max_steps + 1</code> requests, each resending the conversation so far.</li>
  <li>Loops multiply by their <code>max</code>. Every branch arm is counted, though only one runs.</li>
  <li><code>|* each</code> makes the total unbounded, because it depends on the list's length.</li>
</ul>
<p class="h-more"><a href="/guide/plan-and-replay">Plan and replay →</a></p>
</div>
<div>

<!--@include: ./.vitepress/generated/hero-plan.md-->

<p class="h-caption">The plan for <code>triage.halo</code> above, generated when this site was built. A larger one:</p>

<!--@include: ./.vitepress/generated/plan-research.md-->

</div>
</section>

<section class="h-section h-split" id="replay">
<div class="h-head">
<h2 class="h-h2">Recording and replay</h2>
<p class="h-sub">Every <code>halo run</code> keeps what the run got from outside, in order: each model answer with a fingerprint of its request, each tool result, each approval, and each <code>yield</code> and <code>listen</code> answer.</p>
<p class="h-sub"><code>halo replay</code> runs the current file against that recording. Nothing is sent to a model, no tool runs, and nobody is asked. If the pipeline asks for something the recording doesn't have, the run fails with <code>REPLAY_MISMATCH</code>.</p>
<p class="h-note">Recordings are not redacted. They hold model answers and tool results as they arrived. Keep <code>.halo/recordings</code> out of version control, or pass <code>--no-record</code>.</p>
<p class="h-more"><a href="/guide/plan-and-replay#halo-replay">Replay reference →</a></p>
</div>
<div>

```bash
halo run tidy.halo --arg task="file the notes"
# 1834ms · 3 LLM call(s) · 2 tool call(s) · $0.0121 · run 6f9696ef-…

halo replay tidy.halo 6f9696ef-1c2b-4c47-9a1e-3f0c2d1b9a77
# ✓ Same output as the recorded run 6f9696ef-…
```

<div class="h-table">

| Flag | Replays | Calls for real |
|---|---|---|
| (none) | Model answers and tool results | Nothing |
| `--live-models` | Tool results | The models: new prompts against the same tool results |
| `--live-changed` | Tool results, and model answers whose requests didn't change | Only the models whose request changed |
| `--live-tools` | Model answers | The tools: writes, posts, and shell commands run again |

</div>
</div>
</section>

<section class="h-section" id="toolchain">
<div class="h-head">
<h2 class="h-h2">Toolchain</h2>
<p class="h-sub">One binary provides every command.</p>
</div>
<div class="h-flow">
<a href="/reference/cli"><code>halo validate</code><span>Parses and checks the file. Reports undefined policies and unknown tools with line and column.</span></a>
<a href="/dx/testing-and-mocks"><code>halo test</code><span>Runs the whole pipeline offline, with every model and tool mocked.</span></a>
<a href="/guide/plan-and-replay"><code>halo plan</code><span>Lists every call, its worst-case cost, its effect, and what needs approval.</span></a>
<a href="/reference/cli"><code>halo run</code><span>Runs for real. Each tool call is checked against policy first; the run is recorded.</span></a>
<a href="/guide/plan-and-replay"><code>halo replay</code><span>Feeds a recording back exactly, with no model or tool calls.</span></a>
<a href="/guide/production/serving"><code>halo serve</code><span>HTTP API, webhooks, schedules, approval links, and Studio in one process.</span></a>
</div>
<div class="h-split h-gap">
<div class="h-head">
<h3 class="h-h3">Validation and tests</h3>
<p class="h-sub"><code>halo validate</code> output for a file with two mistakes, and <code>halo test</code> running a pipeline with its model mocked. Both are real CLI output from this site's build.</p>
<p class="h-more"><a href="/dx/testing-and-mocks">Testing and mocks →</a> · <a href="/dx/editor-support">Editor support →</a></p>
</div>
<div>

<!--@include: ./.vitepress/generated/checks.md-->

</div>
</div>
</section>

<section class="h-section" id="runtime">
<div class="h-head">
<h2 class="h-h2">Models and runtime</h2>
<p class="h-sub">A model id's prefix selects the provider. The runtime is a Bun process that you host.</p>
</div>
<div class="h-cols even">
<div class="h-table">

| Provider | Prefix | Tool calling |
|---|---|---|
| OpenAI | `openai/` | `tools` as functions, results as `tool` messages |
| Anthropic | `anthropic/` | `tool_use` and `tool_result` blocks |
| Google Gemini | `google/` | `functionDeclarations` |
| OpenRouter, Together | `openrouter/`, `together/` | As OpenAI; depends on the model |
| Ollama | `ollama/` | `tools` on `/api/chat`; depends on the model |
| Replicate | `replicate/` | Not supported |

</div>
<div class="h-rows">
<a href="/guide/production/deploying"><strong>Runtime</strong><span>Requires Bun. Runs on a VM, in a container (<code>ghcr.io/cmjio/halo</code>), or on a PaaS that runs images. Node-based hosts can't run it.</span></a>
<a href="/guide/production/serving#security"><strong>Serving</strong><span><code>halo serve</code> listens on <code>127.0.0.1</code> by default and refuses any other interface without <code>HALO_SERVE_TOKEN</code>.</span></a>
<a href="/guide/integrations/mcp"><strong>MCP</strong><span>Use an MCP server as a tool, or expose pipelines as MCP tools with <code>halo mcp</code>.</span></a>
<a href="/guide/sdk"><strong>Library</strong><span>Embed the runtime in TypeScript and forward its events through <code>onEvent</code>. There are no built-in exporters.</span></a>
<a href="/guide/tool-packages"><strong>Packages</strong><span>{{ data.counts.providers }} built-in tool providers and {{ data.counts.packages }} packages in the registry. Publish your own.</span></a>
<a href="https://github.com/cmjio/halo"><strong>Source</strong><span>MIT licensed. The language, runtime, CLI, Studio, and editor tooling are in one repository, with {{ data.counts.examples }} runnable examples.</span></a>
</div>
</div>
</section>

<section class="h-cta" id="install">
<div class="h-head">
<h2 class="h-h2">Install</h2>
<p class="h-sub">One standalone binary with Bun built in. The script picks the build for your OS and CPU, checks it against the release's <code>SHA256SUMS</code>, and puts it in <code>~/.halo/bin</code>. <a href="/install.sh">Read the script</a> before piping it to a shell; <code>halo upgrade</code> updates it.</p>
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
<div class="h-head">
<h2 class="h-h2">Reference</h2>
</div>
<div class="h-cards">
  <a href="/guide/quickstart"><strong>Quickstart</strong><span>Install, write a pipeline, run it</span></a>
  <a href="/guide/reference"><strong>Language reference</strong><span>Every declaration, operator, and built-in</span></a>
  <a href="/spec"><strong>Specification</strong><span>Language design, types, and state</span></a>
  <a href="/reference/cli"><strong>CLI</strong><span>Every command and flag</span></a>
  <a href="/stdlib/policies"><strong>Policies</strong><span>Every rule the runtime enforces</span></a>
  <a href="/reference/providers"><strong>Tool providers</strong><span>Built-in and packaged tools, with their effects</span></a>
  <a href="/examples/"><strong>Examples</strong><span>From hello world to a team of agents</span></a>
  <a href="/guide/production/serving"><strong>Serving</strong><span>HTTP, webhooks, schedules, Slack approvals, MCP</span></a>
</div>
</section>
