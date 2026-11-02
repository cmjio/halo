# Core Concepts

A Halo program is a set of declarations (`policy`, `tool`, `store`, `schema`, `agent`) and one or more `pipeline`s that use them. Agents are not autonomous loops. Each one is a model plus a configuration, and a pipeline calls it as one step in a fixed sequence of stages.

## Pipelines and the flowing value

A pipeline starts from a value (usually a parameter) and pushes it through stages with `|>`:

```halo
agent Reader [openai/gpt-4o-mini]
agent Writer [openai/gpt-4o-mini]

pipeline Summarize(text: String) -> Result:
  text
    |> Reader.extract_facts()
    |> Writer.summarize() as summary
```

Each stage's result becomes the next stage's input, `context.current`. A result is also stored in three places:

- `context.data.Reader.extract_facts` (callee and method)
- `context.data.extract_facts` (method alone, unless that name is an input or a declaration)
- `context.data.summary` (the `as` binding)

Strings can reference parameters and results with `{{name}}` or `{{context.data.x.y}}`.

## Agents

An `agent` binds a model to parameters, a system prompt, tools, and policies:

```halo
tool Repo : GitHub(Env.GITHUB_TOKEN, repo: "acme/api")
policy Budget : MaxSpend(1.00)

agent Reviewer [anthropic/claude-sonnet-4-5, temp: 0.2]
  system "You are a strict code reviewer."
  equips Repo
  requires Budget

pipeline Review(number: Number) -> Result:
  number |> Reviewer.get_issue("Review this issue and list what is missing.", tool: Repo, number: number)
```

The agent's method name becomes the task line of the prompt. String arguments become instructions. With `tool: Repo`, the runtime first calls `Repo.get_issue(number: ...)` and then sends the agent its result. There is no model-driven function-calling loop. Tools run only when the pipeline calls them. The one exception is equipped stores: a `VectorStore` adds its closest matches to the prompt, and a `File` store adds the conversation history.

Agents keep no memory between calls. Pass earlier results explicitly (`context.data.…`) or equip a store.

## Control flow

Gates, branches, and loops are pipeline stages, not statements:

```halo
agent Engineer [openai/gpt-4o-mini]
agent Support  [openai/gpt-4o-mini]
agent Triager  [openai/gpt-4o-mini]

pipeline Route(ticket: String) -> Result:
  ticket
    |> Triager.classify("""Reply with JSON: {"type": "bug" | "billing" | "other"}""") as kind
    |? (context.data.kind.type != "other")
    |? {
         (context.data.kind.type == "bug") => Engineer.fix(ticket),
         else => Support.reply(ticket),
       }
```

- `|? (cond)` is a **gate**. If the condition is false, the run stops with status `"halted"`. This is not an error.
- `|? { (cond) => Call(), else => Call() }` is a **branch**. The first arm that matches runs. If no arm matches, the value passes through unchanged.
- `|<> loop(Agent, "cond", max: n)` sends the run back to that agent's earlier stage while the condition holds.

See [Pipe Operators](../reference/operators.md) for all of them.

## Humans in the loop

`|! yield(...)` asks a human, and `~> listen(Source.Event)` waits for an external event. If you register a handler (`runtime.onInterrupt` / `onListen`, or the CLI's terminal prompt), it answers right away. With no handler, the top-level run **pauses** with status `"paused"`. You continue it with `runtime.signal(runId, ...)` or `halo resume`. See [Human-in-the-Loop](./architecture/human-in-the-loop.md).

## Run results

A run returns `{ output, status, runId, context }`. `context.meta` has the cost, tokens, every call, policy violations, and shadow results. `context.trace` is a SHA-256 hash chain of the stages. `verifyTrace(trace)` checks that the chain is unbroken.
