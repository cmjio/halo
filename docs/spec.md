# Halo DSL

A language for orchestrating AI workflows with declarative infrastructure, safety policies, and pipe-based composition.

## Language Design

Halo is a **declarative**, pipeline-oriented language for expressing AI workflows as readable, auditable data flows. Instead of imperative boilerplate (`try/catch`, `if/else`, retry loops, memory arrays), you write **declarations** (agents, tools, policies, schemas) and **pipelines** joined by pipe operators.

### Types and state

Halo is dynamically typed and statically validated (`halo validate`). Parameter and return types are written as `String`, `Number`, `Integer`, `Boolean`, `Array` / `List` (optionally `Array<T>`), `Object` / `JSON` / `Map`, `Any`, `Result` (unchecked, like `Any`), or a declared `schema`. The validator checks type names, fields read from schema-typed parameters, and values passed to pipelines whose types it can see (literals and parameters). At runtime, a pipeline's output is checked against its return type.

#### The Global State (`context`)

| Namespace | Purpose |
|---|---|
| `context.current` | The value flowing through the pipe right now |
| `context.input` | The pipeline's arguments |
| `context.data` | Results: the pipeline's arguments, every call at `context.data.<Callee>.<method>` and `context.data.<method>`, and every `as name` binding |
| `context.meta` | Run data: cost, tokens, every call with latency and attempts, policy violations, shadow results, halted/paused state |
| `context.trace` | SHA-256 hash chain of every stage touched (tamper-evident) |

## Declarations

### `policy`: the rules

Checked on an agent's prompt (input) and answer (output) for every agent that `requires` the policy. All rules are deterministic; rules that would need a model to judge them (e.g. `Tone`) are recognized but not enforced, and `halo validate` warns about them.

```halo
policy Privacy : Redact(PII) & Block(PromptInjection)
policy Budget  : MaxSpend(5.00) & MaxTokens(800)
policy Shape   : Require(JSON) & Validate("payout", "<=", "context.data.coverage.max_payout")
```

### `tool`: the hands

Outbound connections. An agent may only use tools it `equips` (zero trust).

```halo
tool CoreDB : PostgreSQL(Env.DB_URI)
tool GitHub : REST("api.github.com")
tool Shell  : Bash()
tool Chat   : Slack(Env.SLACK_BOT_TOKEN)
```

### `store`: memory

`store` declares a store the same way `tool` does. `VectorStore` keeps entries in a local SQLite file; an agent that equips it gets the entries closest to each call's input. A `File` store holds an agent's conversation history.

```halo
store KnowledgeBase : VectorStore(namespace: "engineering")
store History       : File(".halo/history.json", keep: 10)
```

### `schema`: output shapes

```halo
schema Profile {
  name: String
  age: Number
  tags: Array<String>
}
```

A pipeline declared `-> Profile` must return matching JSON. A model's text answer is parsed first, and a mismatch fails the run with a `SchemaValidationError` (e.g. `missing field "age"`).

### `agent`: the brains

A model binding with optional modifiers.

```halo
agent DataAnalyst [gemini-2.5-pro, temp: 0.1]
  system """
    You are a careful data analyst. Show your reasoning briefly.
  """
  equips CoreDB, KnowledgeBase
  requires Budget
```

| Modifier | Purpose |
|---|---|
| `system "..."` | The system prompt sent with every call (`"..."` or `"""..."""`) |
| `equips` | Grants the agent permission to use specific tools and stores |
| `requires` | Binds policies. `halo validate` fails if one is missing |

### `pipeline`: the flow

```
pipeline Name(arg: Type, other: Type) -> ReturnType:
  arg
    |> Agent.method(...) as result
    |> ...
```

A pipeline starts with an expression (usually an argument) and continues with stages.

## Files and Packages: `use`

`use` brings names from another `.halo` file, or from an installed package, into a file.

```halo
use "./shared/policies.halo" { Careful }
use "@acme/support-kit" { Triage, Triager as AcmeTriager } with models(fast: anthropic/claude-haiku-4-5)
use "@halo/stripe" { Stripe }

tool Pay : Stripe()

agent Closer [anthropic/claude-sonnet-4-5] equips Pay requires Careful

pipeline Inbox(ticket: String):
  ticket |> Triage() as triaged |> Closer.reply(context.data.triaged)
```

- The string is a relative path (`"./x.halo"`, `"../shared/x.halo"`) or a package name (`"@acme/support-kit"`). A bare name like `"stripe"` means `"@halo/stripe"`.
- `{ Name, Other as Alias }` lists what to import. An imported name works everywhere a local one does: calls, `equips`, `requires`, `tool X : Provider()`, and types.
- Every top-level declaration in a file is importable. A package exports only what its exported files declare (`exports` in its `halo.json`), plus its tool providers. Its other files are private.
- Two imports that bring the same name, or an import with the same name as a declaration in the file, is an error. Rename one with `as`.
- `use` lines can't go round in a circle (`a.halo` uses `b.halo`, which uses `a.halo`). Move what both need into a third file.
- A `use` with no `{ ... }` imports nothing. It still checks that the file or package is there, and its `with models(...)` still applies.
- A package can only `use` the packages in its own `dependencies`.
- Versions live in `halo.json` and `halo.lock`, not in the source.
- `use` and `with` are soft keywords: they still work as argument names and `as` bindings.

The linker loads a file and everything it uses into one program. Declarations from other files keep their own names inside, so two files (or two packages) can each have a private `Writer` without a clash. Mocks, recordings, `halo plan`, telemetry and errors use the names you see: `"Triager.classify"` in `mocks.json` mocks the package's `Triager`. When two things would show the same name, they show their internal names (`@acme/support-kit#Triager`, `lib/shared#Writer`), and a mock can use those.

Only the file's own pipelines are entry points (`halo run`, `halo serve`, `halo mcp`). Imported pipelines are called from them. `halo serve` links each file, so a pipeline can call a pipeline in another file. `halo compare` and `halo evolve` link each version of the file in its place, so its `use` lines resolve the same way.

Policies name imported tools as the file imported them: `AllowTools(Desk, "Desk.get_ticket")`, `DenyTools("*.delete")` work on a `Desk` from another file or package, whatever its path.

### Model slots

A package's agents don't pick a model. They name a slot, and the program that uses the package fills it:

```halo
agent Triager [models.fast, temp: 0]
```

A slot is filled, in order, by:

1. the `with models(...)` of the `use` line that imports the package (for that package's agents only),
2. `"models"` in the project's `halo.json`: `{ "models": { "fast": "anthropic/claude-haiku-4-5" } }`.

An unfilled slot is an error that names the slot, what the package says it needs, and a model that works. A project's own agents can use `[models.<slot>]` too, filled from `halo.json`. In a package's own `halo.json`, `models` holds `{ "description", "suggested" }` for each slot, and the `suggested` model fills it when the package runs its own tests.

A binding can name a slot of the program doing the `use`: `with models(fast: models.smart)`.

Every agent in a package (exported file or not) must use a slot that its `halo.json` declares. `halo publish` and the registry refuse a package with a hard-coded model id, unless the package is hosted: a hosted pipeline runs on its publisher's server, with their keys.

## Operators

| Operator | Name | Purpose |
|---|---|---|
| `\|> Call(...)` | Push | Run a call on the current value. The result becomes the current value |
| `\|? (cond)` | Gate | Continue only if the condition is true; otherwise the run halts (status `halted`) |
| `\|? { ... }` | Branch | Run the first arm whose condition holds (if/else) |
| `\|* { A(), B() }` | Fan-out | Run calls in parallel. The result is the list of outputs |
| `\|* each(x in list) => Call()` | Each | Run one call per list item, in parallel |
| `\|<> loop(Agent, "cond")` | Loop | While the condition holds, go back to the agent's stage |
| `\|! yield(...)` | Interrupt | Ask a human |
| `~> listen(Source.Event)` | Listen | Wait for an external event |

A call is `Agent.method(...)`, `Tool.method(...)`, `System.Method(...)`, `Thread.method(...)` (in a `@thread` pipeline), or `OtherPipeline(...)`.

## Directives

| Directive | Purpose | Example |
|---|---|---|
| `@retry(n, duration)` | Retry each model/tool call up to n times on transient failures (network, 429, 5xx, timeouts). Policy violations are never retried | `@retry(3, 2s)` |
| `@timeout(duration)` | On a pipeline: abort the whole run. On an agent: abort each call | `@timeout(5m)` |
| `@checkpoint` | Snapshot state after every stage (and at a closed gate); continue with `halo run --checkpoint <file>`; `halo history <runId>` lists every step and `halo rewind <file> <runId> --step N` continues from one | `@checkpoint` |
| `@thread(input)`, `@thread(input, Name)` | Keep state between runs, one thread per value of `input`: read it as `context.thread`, change it with `Thread.set`, `Thread.append` and `Thread.clear`, saved when the run ends ([Thread State](/guide/thread-state)) | `@thread(user_id)` |
| `@shadow(Primary)` | On an agent: run it alongside every call to `Primary` and record its output, which is never used. `@shadow(openai/gpt-4o)` runs the same prompt on that model instead | `@shadow(Baseline)` |
| `@cascade(model, ...)` | On an agent: when a call fails (after `@retry`), an output policy rejects the answer (after `@correct`), or the answer misses the pipeline's schema, ask the next model in the list. Budget violations never move up | `@cascade(anthropic/claude-opus-4-5)` |
| `@correct(n)` | On an agent or pipeline: when an output policy rejects an answer, tell the agent what was wrong and ask again, up to n times | `@correct(2)` |
| `@expect("cond", ...)` | On a pipeline: conditions its output must meet, in gate syntax over `output` and the inputs. `halo run`/`halo test` report them (`test` fails on a broken one); `halo compare` and `halo evolve` hold every variant to the original's, with no judge | `@expect("output.labels.length <= 3")` |

## Bindings, Conditions & Strings

```
|> Analyst.analyze_trends(metrics: context.data.stripe) as trends   // context.data.trends
|* { A.fetch() as a, B.fetch() as b } as both                       // per-item and whole-block bindings
|? (context.data.trends.notable_changes > 0 && !(region == null))   // && || ! == != > < >= <= null
|> Writer.prompt("""
     Multi-line prompt for {{company}}.
     Previous result: {{trends.summary}}
   """)
|> Summarize(context.data.trends)                                   // call another pipeline
```

Keywords (`tool`, `context`, `pipeline`, ...) can be used as named-argument keys, e.g. `Agent.fetch(tool: Stripe)`. `Env.NAME` can only be read in tool declarations, so secrets never reach prompts.

## Branching & Loops

```
|? {
     (context.data.screen.score < 0.3) => System.Publish(context.data.post),
     (context.data.screen.score > 0.9) => System.Notify("removed"),
     else => DeepReview(context.data.post),
   } as outcome

|* each(issue in context.data.triage.issues, concurrency: 2) => GitHub.add_labels(
     path: "/repos/{{repo}}/issues/{{issue.number}}/labels",
     labels: issue.labels
   ) as labeled

|> SWE.write_code()
|> Shell.run(command: "bun test")
|<> loop(SWE, "context.data.Shell.run.exitCode != 0", max: 3) as retries
```

**Branch** (`|? { ... }`) checks arms in order and runs the first one whose condition holds; `else` (last) matches anything. Each arm is one call. For several steps, call another pipeline; a gate inside that pipeline ends just that pipeline early, and the branch gets its last value. The arm's result becomes the flowing value and the `as` binding. If nothing matches and there is no `else`, the value passes through unchanged.

**Each** (`|* each(item in list) => Call(...)`) runs the call once per item, up to `concurrency` (default 4) at a time, and keeps the input order. Inside the call, the item is available as `item`, `{{item.field}}`, and the flowing value, and its position as `index`. The loop variable doesn't exist after the loop. The result list is stored at the `as` binding and at `context.data.<Callee>.<method>`. If any item fails, the stage fails.

**Loop** (`|<> loop(Agent, "cond", max: n)`) checks its condition (written as a string) when reached. While it holds, the run jumps back to the agent's most recent stage, so the agent sees the current value (e.g. the failing test output) and tries again. After `max` tries (default 3) the run fails with a `LoopLimitError`. When the condition is false the run continues, and `as` binds the number of retries.

## Human-in-the-Loop

`|! yield(...)` sends a request to the runtime's interrupt handler. The request has `message` (from `msg:`/`message:` or a string arg), `channel` (from `channel:`/`queue:` or a tool name), `attachments` (list args), and `timeoutMs` (from a duration). The response is stored at `context.data.yield` and any binding. `~> listen(Source.Event)` waits for the listen handler and stores the event at `context.data.Source.Event`. Neither changes the flowing value.

With no handler, a top-level run **pauses**: it returns status `paused` with a `runId`, and the run is saved to the runtime's run store. `runtime.signal(runId, "yield", response)` (or the listen target, e.g. `"Slack.Reaction"`) continues it. The CLI asks in a terminal; elsewhere it pauses, saves the run to `.halo/runs`, and prints the `halo resume <file> <runId> --payload ...` command. The CLI turns a typed answer into an event (`{ action, approved, ... }`), so gates and branches can check `context.data.yield.approved` or `context.data.yield.action == "label"`.

## Full Example

```halo
policy Budget    : MaxSpend(1.00)
policy Shape     : Require(JSON)

tool   Warehouse : SQL(Env.WAREHOUSE_URL)
tool   Deploys   : POST("ci.example.com/deploy", apiKey: Env.CI_TOKEN)
store  Incidents : VectorStore(namespace: "incidents")

schema Diagnosis {
  root_cause: String
  confidence: Number
}

agent Analyst [anthropic/claude-sonnet-4-5, temp: 0.0]
  system "You diagnose sales drops from data. Answer in JSON."
  equips Warehouse, Incidents
  requires Budget, Shape

@timeout(5m)
@retry(2, 5s)
pipeline ResolveSalesDrop(event: String) -> Diagnosis:
  event
    |> Analyst.query(tool: Warehouse, sql: "SELECT region, revenue FROM daily_sales LIMIT 50") as sales
    |> Analyst.diagnose(context.data.sales) as diagnosis
    |? {
         (context.data.diagnosis.confidence < 0.7) => System.Notify("Low-confidence diagnosis", event: event),
       }
    |! yield(msg: "Ship the fix for this diagnosis?", [context.data.diagnosis]) as review
    |? (context.data.review.approved == true)
    |> Deploys.trigger(service: "pricing")
    |> Incidents.log(content: context.data.diagnosis)
    |> System.Pick(context.data.diagnosis, fields: ["root_cause", "confidence"])
```

## Editor Support

| Editor | Status | Path |
|---|---|---|
| VS Code | Highlighting + language server (errors, hover, completion, go to definition, across `use`) | `editors/vscode/` |
| Zed | Tree-sitter highlighting | `editors/zed/` |
| Sublime Text | Highlighting | `editors/sublime/` |
| JetBrains | Planned | — |

## Dictionary

See [docs/dictionary.md](dictionary.md) for the full formal lexicon.

## Building

```sh
bun install
bun run generate     # rebuild the parser from grammars/Halo.g4 (needs Java)
bun test
bunx tsc --noEmit
```
