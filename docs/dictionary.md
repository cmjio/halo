# Langly DSL Dictionary

The formal lexicon for the Langly DSL. Reserved keywords are strictly limited to five categories: **Entities, Modifiers, Flow Operators, Directives,** and **Native Primitives.**

## 1. Core Entities (The Nouns)

Keywords that declare foundational infrastructure blocks. Instantiated globally and called by streams.

### `guardrail`

| Field | Value |
|---|---|
| **Definition** | Defines strict, non-negotiable boundaries for security, budget, or compliance. |
| **Evaluated** | At runtime before and after every model inference |
| **Syntax** | `guardrail Name : Rule(args) & Rule(args)` |
| **Example** | `guardrail Privacy : Redact(PII) & Block(PromptInjection)` |

### `tool`

| Field | Value |
|---|---|
| **Definition** | Declares an external capability — database query, REST API, etc. |
| **Compiles to** | Zero-trust network policies with explicit egress whitelisting |
| **Syntax** | `tool Name : Provider(args)` |
| **Example** | `tool CoreDB : PostgreSQL(Env.DB_URI)` |

### `memory`

| Field | Value |
|---|---|
| **Definition** | Persistent, stateful storage for RAG (Retrieval-Augmented Generation) |
| **Use case** | Vector stores, document indexes, past-test registries |
| **Syntax** | `memory Name : Provider(args)` |
| **Example** | `memory KnowledgeBase : VectorStore(Env.PINECONE_KEY, namespace: "engineering")` |

### `mind`

| Field | Value |
|---|---|
| **Definition** | Instantiates an AI actor. Binds a foundation model to parameters |
| **Modifiers** | `equips` (binds tools/memory), `requires` (binds guardrails) |
| **Syntax** | `mind Name [model-ref, key: value]` |
| **Example** | `mind DataAnalyst [gemini-3-1-pro, temp: 0.1]` |

### `stream`

| Field | Value |
|---|---|
| **Definition** | Defines an execution pipeline and its event trigger |
| **Syntax** | `stream Name(param: Type) -> ReturnType: ...` |
| **Example** | `stream ProcessClaim(event: Webhook) -> Result:` |

## 2. Relational Modifiers (The Verbs)

Keywords that define relationships and permissions between entities.

### `equips`

| Field | Value |
|---|---|
| **Definition** | Grants a `mind` permission to use specific `tools` or `memory` |
| **Enforcement** | Compile-time — unequipped API calls fail before runtime |
| **Syntax** | `equips Tool1, Tool2` |

### `requires`

| Field | Value |
|---|---|
| **Definition** | Binds `guardrail` policies to a `mind` |
| **Enforcement** | Agent cannot execute without policy wrapper active |
| **Syntax** | `requires Guard1, Guard2` |

## 3. Flow Operators (The Routing)

Reactive pipeline operators that dictate how the implicit `context` flows. No `if/else` needed.

### `|>` — Push Pipe

Pushes the current context forward to the next node or mind.

```
context |> Mind.prompt("process this")
```

### `|?` — Gate (Conditional)

Evaluates structured data in the context and only continues if true.

```
|? (context.data.risk_score > 90)
|? (context.data.confidence == true)
```

### `|!` — Interrupt Pipe

The Human-in-the-Loop trigger. Hard-stops the stream and freezes container state until external intervention.

```
|! yield(channel: Slack, msg: "Approve deployment?")
```

### `|*` — Fan-Out Pipe

Triggers parallel execution. Runs multiple nodes concurrently, merging outputs when the `{}` block closes.

```
|* { MindA.prompt("task1"), MindB.prompt("task2") }
```

### `~>` — Listen (Telemetry)

The asynchronous pause. Suspends the stream indefinitely to wait for human interaction or system events, injecting results back into context.

```
~> listen(UI.Button_Click)
~> listen(Slack.Interaction)
```

## 4. Compiler Directives

Annotations placed above entities or streams that control cloud infrastructure behavior.

### `@checkpoint`

| Field | Value |
|---|---|
| **Definition** | Snapshots container memory at this node |
| **Benefit** | Enables time-travel debugging and resumption from failure points |

### `@shadow(Name)`

| Field | Value |
|---|---|
| **Definition** | Duplicates production traffic to a secondary agent |
| **Use case** | CI/CD model comparison — tests a new prompt silently |

### `@retry(count, backoff)`

| Field | Value |
|---|---|
| **Definition** | Auto-recovers transient API failures |
| **Example** | `@retry(3, 2s)` |

### `@timeout(duration)`

| Field | Value |
|---|---|
| **Definition** | Hard-kills the process to prevent infinite agentic looping |
| **Units** | `s` (seconds), `m` (minutes), `h` (hours), `d` (days) |
| **Example** | `@timeout(5m)` |

## 5. Native Primitives (The Built-ins)

Reserved functions for state mechanics.

### `yield`

| Field | Value |
|---|---|
| **Definition** | Packages current context state and pushes to external UI for human input |
| **Used with** | The `|!` interrupt pipe |
| **Args** | `channel`, `msg`, `timeout`, `attachments` |

### `context`

| Field | Value |
|---|---|
| **Definition** | The implicit, immutable data structure flowing through the stream |
| **Namespaces** | `context.data` (payload), `context.meta` (system), `context.trace` (history) |

## 6. Lexical Tokens

### Brackets & Punctuation

| Token | Usage |
|---|---|
| `[ ]` | Mind model config block |
| `( )` | Function arguments, conditions |
| `{ }` | Fan-Out parallel block |
| `:` | Type declarations, key-value pairs |
| `,` | Argument separator |
| `&` | Guardrail rule combinator |
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
