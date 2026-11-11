# Directives

Directives go before an `agent` or `pipeline` declaration. Unknown directives produce a validator warning and are ignored.

| Directive | On agents | On pipelines |
|---|---|---|
| `@timeout(d)` | each call to the agent | the whole run of the pipeline |
| `@retry(n, delay)` | calls to the agent | every agent and tool call in the pipeline |
| `@correct(n)` | the agent's policy failures | every agent in the pipeline |
| `@cascade(model, ...)` | move up to a bigger model when a call fails or its answer is rejected | — |
| `@checkpoint` | — | snapshot after every stage |
| `@shadow(target)` | run alongside another agent | — |
| `@thread(input, Name?)` | — | keep state between runs, per value of `input` |

Durations are `ms`, `s`, `m`, `h`, or `d`: `500ms`, `30s`, `5m`.

## `@timeout`

```halo
@timeout(30s)
agent Bot [openai/gpt-4o-mini]

@timeout(5m)
pipeline Process(data: String) -> Result:
  data |> Bot.summarize()
```

Exceeding the limit throws a `TimeoutError`. An agent-level timeout counts as retryable.

## `@retry`

```halo
agent Bot [openai/gpt-4o-mini]

@retry(3, 2s)
pipeline Resilient(data: String) -> Result:
  data |> Bot.summarize()
```

The directive allows `n` extra attempts with a fixed `delay` between them. If the agent has its own `@retry`, the agent's takes precedence. Only retryable errors are retried: timeouts, network failures, and HTTP 408, 429, or 5xx. Policy violations and schema failures are not retried.

## `@correct`

```halo
policy JsonOnly : Require(JSON) & MaxWords(200)

@correct(2)
agent Extractor [openai/gpt-4o-mini]
  requires JsonOnly

pipeline Extract(text: String) -> Result:
  text |> Extractor.extract()
```

When an output policy rejects an answer, the agent is asked again, up to `n` times. The new prompt includes the rejected answer and the policy's message. Each correction emits a `correction` event, and the violation stays in `context.meta.violations` marked `corrected: true`, so the audit trail shows what was fixed. The CLI shows a corrected violation as `✎ … asked to fix it` rather than as a failure. Input-side violations, such as a blocked prompt, are not corrected.

## `@cascade`

```halo
policy Short : MaxWords(80)

@cascade(anthropic/claude-sonnet-4-5, anthropic/claude-opus-4-5)
agent Triage [anthropic/claude-haiku-4-5]
  requires Short

pipeline Label(issue: String) -> Labels:
  issue |> Triage.label()
```

Each call goes to the agent's own model first. A bigger model is tried next, in the order listed, only when the call on the current one:

- fails, after any `@retry` attempts (a provider outage, a timeout, a 4xx or 5xx, a missing key)
- has its answer rejected by an output policy, after any `@correct` tries
- misses the pipeline's `-> Schema`, when the agent's stage is the last one and its answer becomes the pipeline's output

The next model gets the original prompt, not the smaller model's rejected answer. An agent with tools starts its conversation over on the next model, so tools it already called may be called again. A spent `MaxSpend` budget, a stopped run, and a pause for approval never move up; a run paused mid-conversation resumes on the model that was answering. When the last model fails too, the run fails with that model's error.

A name in the list can also be an agent, which contributes its model (not its system prompt or policies; those stay the cascading agent's). Each move emits an `escalate` event and is kept in `context.meta.escalations` as `{ target, from, to, error }`. A policy violation that caused one stays in `context.meta.violations`, marked `escalated: true`. `context.meta.calls` shows which model answered and what each one cost. The CLI shows a move as `⇡ … trying <model>`.

In `halo test` and mocks, `Agent@model` (or `Agent.method@model`) answers for one model of the cascade; without one, the agent's usual mock answers every model.

## `@checkpoint`

```halo
agent Bot [openai/gpt-4o-mini]

@checkpoint
pipeline LongJob(data: String) -> Result:
  data |> Bot.step_one() |> Bot.step_two()
```

After every stage, and when a gate halts, the run is written to `.halo/checkpoints/<Pipeline>-<runId>.json` (`checkpointDir` in `RuntimeConfig`). Continue with `halo run file.halo --checkpoint <path>` or `runtime.resume(path)`. A run resumed from a halted gate evaluates that gate again. Checkpoints are written only for the top-level pipeline.

## `@thread`

```halo
@thread(user_id)
pipeline Chat(user_id: String, msg: String) -> Result:
  msg |> Bot.reply("{{context.thread.summary}} / {{msg}}") |> Thread.append(messages: msg, keep: 20)
```

Each value of `user_id` has its own thread: state that lasts from one run to the next, read as `context.thread` and changed with `Thread.set`, `Thread.append` and `Thread.clear`. Changes are saved when the run completes or halts, applied to the thread as it is then. A second argument names the thread, so pipelines can share it: `@thread(ticket_id, Support)`. See [Thread State](/guide/thread-state).

## `@shadow`

The directive goes on the **candidate** agent and names the agent it shadows. Every time the primary is called, the candidate gets the same prompt in the background. Its answer is recorded in `context.meta.shadows` and a `shadow` event, and it never changes the pipeline's value.

```halo
agent Prod [openai/gpt-4o-mini]

@shadow(Prod)
agent Candidate [anthropic/claude-haiku-4-5]

@shadow(openai/gpt-4o)
agent Writer [openai/gpt-4o-mini]

pipeline Answer(q: String) -> Result:
  q |> Prod.answer() |> Writer.polish()
```

With a model id as the target (`@shadow(openai/gpt-4o)`), the agent's own prompts are also sent to that model. The run waits for shadow calls to finish before it returns. Shadow costs are added to `context.meta.cost`.

## `@expect`

Conditions a pipeline's output must meet, written beside the pipeline. Each argument is a condition in the same language as a gate, over `output` (what the run returned) and the pipeline's inputs (`input.repo`, or just `repo`). Strings can hold commas.

```halo
@expect("output.issues.length <= limit", "output.confidence >= 0", "output.summary != null")
pipeline Triage(repo: String, limit: Number) -> Result:
  ...
```

No model is involved, so they are hard checks:

- `halo run` and `halo test` print `✓` or `✗` for each after a run that completes. `halo test` exits with status 1 when one is broken, except when every answer is a placeholder from `--mock` without `--mocks` (it says so instead).
- `halo compare` and `halo evolve` hold every variant to the **original's** expectations, never the variant's own, so a variant can't loosen what it's checked against. A variant whose output breaks one the original's met loses that run without asking the judge; one that meets every expectation the original broke wins it. `halo evolve` also shows them to the proposer.
- `halo validate` reports a condition that doesn't parse.
