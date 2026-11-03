# Halo DSL Dictionary

The formal lexicon for the Halo DSL. Reserved keywords are strictly limited to five categories: **Entities, Modifiers, Flow Operators, Directives,** and **Native Primitives.**

## 1. Core Entities (The Nouns)

Keywords that declare foundational infrastructure blocks. Instantiated globally and called by pipelines.

### `policy`

| Field | Value |
|---|---|
| **Definition** | Defines strict, non-negotiable boundaries for security, budget, or compliance. |
| **Evaluated** | At runtime before and after every model inference |
| **Syntax** | `policy Name : Rule(args) & Rule(args)` |
| **Example** | `policy Privacy : Redact(PII) & Block(PromptInjection)` |

### `tool`

| Field | Value |
|---|---|
| **Definition** | Declares an external capability — database query, REST API, etc. |
| **Enforced** | Zero trust: an agent can only use the tools it `equips` |
| **Syntax** | `tool Name : Provider(args)` |
| **Example** | `tool CoreDB : PostgreSQL(Env.DB_URI)` |

### `store`

| Field | Value |
|---|---|
| **Definition** | Persistent storage: a local vector store (`VectorStore`) or a conversation history (`File`) |
| **Equipped** | An agent that equips a VectorStore gets the entries closest to each call's input; a File store keeps its conversation |
| **Syntax** | `store Name : Provider(args)` |
| **Example** | `store KnowledgeBase : VectorStore(namespace: "engineering")` |

### `schema`

| Field | Value |
|---|---|
| **Definition** | Declares the shape of a pipeline's output |
| **Field types** | `String`, `Number`, `Integer`, `Boolean`, `Array` / `List` (or `Array<T>`), `Object` / `JSON`, `Any`, another schema |
| **Enforced** | A pipeline declared `-> Schema` fails with `SchemaValidationError` if its output doesn't match |
| **Example** | `schema Profile { name: String, tags: Array<String> }` |

### `agent`

| Field | Value |
|---|---|
| **Definition** | Instantiates an AI actor. Binds a foundation model to parameters |
| **Modifiers** | `system` (system prompt), `equips` (binds tools/stores), `requires` (binds policies) |
| **Syntax** | `agent Name [model-ref, key: value]` |
| **Example** | `agent DataAnalyst [gemini-3-1-pro, temp: 0.1]` |

### `pipeline`

| Field | Value |
|---|---|
| **Definition** | Defines a pipeline: its parameters, return type, and stages |
| **Syntax** | `pipeline Name(param: Type) -> ReturnType: ...` |
| **Example** | `pipeline ProcessClaim(event: Webhook) -> Result:` |

## 2. Relational Modifiers (The Verbs)

Keywords that define relationships and permissions between entities.

### `equips`

| Field | Value |
|---|---|
| **Definition** | Grants an `agent` permission to use specific `tools` or `store` |
| **Enforcement** | Compile-time — unequipped API calls fail before runtime |
| **Syntax** | `equips Tool1, Tool2` |

### `requires`

| Field | Value |
|---|---|
| **Definition** | Binds `policy` guardrails to an `agent` |
| **Enforcement** | Agent cannot execute without policy wrapper active |
| **Syntax** | `requires Guard1, Guard2` |

### `system`

| Field | Value |
|---|---|
| **Definition** | Sets the agent's persona prompt |
| **Syntax** | `system "You are a QA engineer..."` |

## 3. Flow Operators (The Routing)

Reactive pipeline operators that dictate how the implicit `context` flows. No `if/else` needed.

### `|>` — Push Pipe

Pushes the current context forward to the next node or agent.

```halo
context |> Agent.prompt("process this")
```

### `|?` — Gate (Conditional)

Evaluates structured data in the context and only continues if true.

```halo
|? (context.data.risk_score > 90) =>
```

### `|!` — Interrupt Pipe

The Human-in-the-Loop trigger. Asks the runtime's interrupt handler; with no handler, the run pauses until `signal()` / `halo resume` continues it.

```halo
|! yield(channel: Slack, msg: "Approve deployment?")
```

### `|*` — Fan-Out Pipe

Triggers parallel execution. Runs multiple nodes concurrently, merging outputs when the `{}` block closes.

```halo
|* { AgentA.prompt("task1"), AgentB.prompt("task2") }
```

### `|? { ... }` — Branch

| Field | Value |
|---|---|
| **Definition** | Runs the first arm whose condition holds; `else` matches anything and must come last |
| **Result** | The chosen arm's result (or the unchanged value when nothing matches) |
| **Example** | `\|? { (context.data.score > 0.9) => System.Notify("removed"), else => Review(post) } as outcome` |

### `|* each(...)` — Each

| Field | Value |
|---|---|
| **Definition** | Runs one call per list item, in parallel (`concurrency: n`, default 4), in input order |
| **Scope** | The item under its loop name (`issue`, `{{issue.number}}`) and `index`, inside the call only |
| **Example** | `\|* each(issue in context.data.issues, concurrency: 2) => GitHub.add_labels(labels: issue.labels) as labeled` |

### `|<>` — Loop

| Field | Value |
|---|---|
| **Definition** | While the condition (a string) holds, jump back to the agent's most recent stage so it can try again |
| **Limit** | `max: n` (default 3); then the run fails with `LoopLimitError` |
| **Example** | `\|<> loop(SWE, "context.data.Shell.run.exitCode != 0", max: 3) as retries` |

### `~>` — Listen (Events)

Waits for an external event (from the listen handler, or `signal()` after a pause) and stores it at `context.data.<Source>.<Event>`.

```halo
~> listen(UI.Button_Click)
```

## 4. Compiler Directives

Annotations placed above agents or pipelines that control how they run.

### `@checkpoint`

| Field | Value |
|---|---|
| **Definition** | On a pipeline: saves a snapshot after every stage (and at a closed gate) to `.halo/checkpoints`, and keeps every step |
| **Benefit** | Continue a failed or halted run with `halo run --checkpoint <file>`; list its steps with `halo history <runId>`; continue from any step with `halo rewind <file> <runId> --step N` |

### `@thread(input, Name?)`

| Field | Value |
|---|---|
| **Definition** | On a pipeline: keeps state between runs, one thread per value of `input` (named after the pipeline, or `Name` to share it) |
| **Used with** | `context.thread`, and `Thread.set` / `Thread.append` / `Thread.clear` |
| **Example** | `@thread(user_id)` |

### `@shadow(Name)`

| Field | Value |
|---|---|
| **Definition** | On an agent: runs it alongside every call to the named agent (or model) and records its output, which is never used |
| **Use case** | Comparing a new model or prompt on real traffic |

### `@retry(count, backoff)`

| Field | Value |
|---|---|
| **Definition** | Retries model and tool calls on transient failures (network, 429, 5xx, timeouts); never on policy violations |
| **Example** | `@retry(3, 2s)` |

### `@timeout(duration)`

| Field | Value |
|---|---|
| **Definition** | On a pipeline: aborts the whole run. On an agent: aborts each call |
| **Units** | `ms`, `s`, `m`, `h`, `d` |
| **Example** | `@timeout(5m)` |

### `@correct(n)`

| Field | Value |
|---|---|
| **Definition** | When an output policy rejects an agent's answer, show the agent the reason and ask again, up to n times |
| **Applies to** | An agent, or a pipeline (all its agents) |
| **Example** | `@correct(2)` |

## 5. Native Primitives (The Built-ins)

Reserved functions for state mechanics.

### `yield`

| Field | Value |
|---|---|
| **Definition** | Asks a human: the request (message, channel, attachments, timeout) goes to the interrupt handler, or the run pauses |
| **Used with** | The `|!` interrupt pipe |
| **Args** | `channel`, `msg`, `timeout`, `attachments` |

### `context`

| Field | Value |
|---|---|
| **Definition** | The state of a run |
| **Namespaces** | `context.current` (flowing value), `context.input` (arguments), `context.data` (results), `context.meta` (cost, calls, violations), `context.trace` (hash chain), `context.thread` (state kept between runs, in a `@thread` pipeline) |

### `as`

| Field | Value |
|---|---|
| **Definition** | Binds a stage's result to a name under `context.data` |
| **Applies to** | `\|>` calls, fan-out items and blocks, `\|! yield`, `~> listen` |
| **Example** | `\|> Analyst.score(deal) as score` then `\|? (context.data.score.value > 80)` |

### `System`

| Field | Value |
|---|---|
| **Definition** | Built-in callee for runtime utilities and events |
| **Methods** | `Print`, `Log` (output, pass the value through), `Sleep(duration)`, `Fail(msg)`, `Value(x)` (make `x` the flowing value), `Pick(value, fields: [...], maxChars: n)` (keep only dotted fields of an object or of each list item; `labels.name` maps over a list), and the events `ResolveIncident`, `Publish`, `Distribute`, `TriggerWebhook`, `Notify` (sent to `onSystemEvent`) |
| **Example** | `\|> System.Pick(context.data.issues.items, fields: ["number", "title", "labels.name"], maxChars: 1500) as items` |

### `Thread`

| Field | Value |
|---|---|
| **Definition** | Built-in callee that changes a `@thread` pipeline's thread state; each call passes the flowing value through, and the run saves the changes when it ends |
| **Methods** | `set(field: value, ...)`, `append(field: value, ..., keep: n)` (add to a list, keeping the newest n), `clear("field", ...)` (or every field) |
| **Example** | `\|> Thread.append(messages: context.data.reply, keep: 20)` |
| **Note** | A tool, store, agent or pipeline you declare named `Thread` takes the name over |

## 6. Lexical Tokens

### Brackets & Punctuation

| Token | Usage |
|---|---|
| `[ ]` | Agent model config block |
| `( )` | Function arguments, conditions |
| `{ }` | Fan-Out parallel block |
| `:` | Type declarations, key-value pairs |
| `,` | Argument separator |
| `&` | Policy rule combinator |
| `.` | Property access, method calls |

### String Literals

- Double-quoted: `"hello world"`
- Single-quoted: `'no escape needed'`
- Escape sequences: `\"`, `\\`, `\n`, `\t`

### Model References (`MODEL_REF`)

Provider/name identifiers with dashes and slashes. Must contain at least one `-` or `/`.

| Example | Provider |
|---|---|
| `openai/gpt-4o-mini` | OpenAI |
| `anthropic/claude-sonnet-4` | Anthropic |
| `gemini-3-1-pro` | Google |
