# Context & Scope

Every run has a `context` with these namespaces:

| Path | Contents |
|---|---|
| `context.current` | The flowing value (the last stage's result) |
| `context.input` | The pipeline's arguments, as passed |
| `context.data` | Arguments, call results, and `as` bindings |
| `context.meta` | `runId`, `pipeline`, `startedAt`, `finishedAt`, `durationMs`, `cost`, `tokens`, `calls`, `violations`, `shadows`, `halted`, `paused`, `checkpoint`, `rewoundFrom` |
| `context.trace` | One entry per stage, each with a SHA-256 hash linking it to the previous entry |
| `context.thread` | In a `@thread` pipeline: the thread's state, kept between runs ([Thread State](/guide/thread-state)) |

## Where results go

```halo
agent Summarizer [openai/gpt-4o-mini]
agent Editor     [openai/gpt-4o-mini]

pipeline Process(email: String) -> Result:
  email
    |> Summarizer.summarize() as summary
    |> Editor.polish(context.data.Summarizer.summarize, original: email)
```

After the first stage, the result is available as:

- `context.data.Summarizer.summarize`: always, unless the callee is `System`
- `context.data.summarize`: the method name alone. This is skipped if `summarize` is an input or a declared name.
- `context.data.summary`: from `as summary`
- `context.current`, until the next stage replaces it

A pipeline call stores its output at `context.data.<PipelineName>`. A yield response is stored at `context.data.yield`, and a listen payload at its target path (`context.data.Slack.Reaction`). A later result with the same name overwrites the earlier one.

## Bare names and templates

Inside a pipeline, a bare name such as `email` or `summary.title` resolves in this order:

1. an input
2. a declared tool, agent, pipeline, or policy, which stands for itself
3. a `context.data` entry
4. otherwise, the name as a plain string, such as the channel in `channel: Terminal`

`{{name}}` placeholders check `context.data` first, then inputs. They also accept `{{context.…}}` and `{{current}}`.

### Paths into lists

On a list, a number picks an item, `length` counts the items, and any other name reaches into every item:

| Path | Gives |
|---|---|
| `context.data.issues.0.title` | the first issue's title |
| `context.data.issues.length` | how many issues |
| `context.data.issues.title` | every title, as a list |
| `context.data.name.length` | a string's length |

So `|? (context.data.matches.length > 0)` tests for an empty list, and `{{issues.title}}` puts all titles in a prompt.

## Scope

- **Fan-out** stages all see the same context and write into it. Each call's result goes to its own `Callee.method` slot.
- **each** gives every iteration its own copy of `context.data` with the loop variable and `index`. Iterations can't see each other's results. The list of results is stored afterward.
- **Called pipelines** start a fresh context with only their parameters. Their output comes back as the call's result. Their cost, tokens, calls, and violations are added to the caller's `meta`.

## The validator's view

`halo validate` follows what each stage writes. It warns when `context.data.x` or `{{x}}` is read before anything sets `x`, when `context.input.x` isn't a parameter, and when a namespace isn't one of the five above.
