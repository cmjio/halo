# Directives

Directives go before an `agent` or `pipeline` declaration. Unknown directives produce a validator warning and are ignored.

| Directive | On agents | On pipelines |
|---|---|---|
| `@timeout(d)` | each call to the agent | the whole run of the pipeline |
| `@retry(n, delay)` | calls to the agent | every agent and tool call in the pipeline |
| `@correct(n)` | the agent's policy failures | every agent in the pipeline |
| `@checkpoint` | — | snapshot after every stage |
| `@shadow(target)` | run alongside another agent | — |

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

## `@checkpoint`

```halo
agent Bot [openai/gpt-4o-mini]

@checkpoint
pipeline LongJob(data: String) -> Result:
  data |> Bot.step_one() |> Bot.step_two()
```

After every stage, and when a gate halts, the run is written to `.halo/checkpoints/<Pipeline>-<runId>.json` (`checkpointDir` in `RuntimeConfig`). Continue with `halo run file.halo --checkpoint <path>` or `runtime.resume(path)`. A run resumed from a halted gate evaluates that gate again. Checkpoints are written only for the top-level pipeline.

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
