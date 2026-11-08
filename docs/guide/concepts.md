# Core Concepts

A Halo program is a set of declarations (`policy`, `tool`, `store`, `schema`, `agent`) and one or more `pipeline`s that use them. Each agent is a model plus a configuration, and a pipeline calls it as one step in a fixed sequence of stages. Within that step, an agent given `tools:` may choose its own tool calls, under its policies (see [Agents with Tools](./agents-with-tools.md)).

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

### Files and pipelines

A file can hold any number of pipelines, and a pipeline can call another by name (`|> ApplyLabels(repo, issues)`). Keep one **entry pipeline** per file, the one nothing else calls, next to the pipelines it calls. With one entry, `halo run`, `halo plan` and `halo compare` know which pipeline you mean without `--pipeline`.

Keep versions of a pipeline in git, not as copies in the file. A pipeline's name is how the rest of Halo finds it: its recordings, its thread state, its API route and webhook, and its MCP tool are all keyed by it, and `halo serve` serves every pipeline in the file. A `TriageV2` beside `Triage` is a second live endpoint with no history. Change `Triage` in place, and check the change with [`halo compare triage.halo --from main`](./plan-and-replay.md#halo-compare).

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

The agent's method name becomes the task line of the prompt. String arguments become instructions. With `tool: Repo`, the runtime first calls `Repo.get_issue(number: ...)` and then sends the agent its result. Without `tools:`, tools run only when the pipeline calls them. With `tools: [Repo]`, the agent calls `Repo`'s methods itself, as many times as it needs, up to `max_steps` (see [Agents with Tools](./agents-with-tools.md)). Equipped stores also add context on their own: a `VectorStore` adds its closest matches to the prompt, and a `File` store adds the conversation history.

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

## State that lasts

A run's `context` ends with the run. Two directives keep more:

- `@checkpoint` saves the run after every stage and keeps every step. `halo history <runId>` lists the steps, and `halo rewind <file> <runId> --step N` continues from any of them as a new run. See [Plan and Replay](./plan-and-replay.md#halo-history).
- `@thread(user_id)` keeps state between runs, one thread per user. A run reads it as `context.thread`, changes it with `Thread.set`, `Thread.append` and `Thread.clear`, and saves the changes when it ends. See [Thread State](./thread-state.md).
