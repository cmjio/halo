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
| **Compiles to** | Zero-trust network policies with explicit egress whitelisting |
| **Syntax** | `tool Name : Provider(args)` |
| **Example** | `tool CoreDB : PostgreSQL(Env.DB_URI)` |

### `store`

| Field | Value |
|---|---|
| **Definition** | Persistent, stateful storage for RAG (Retrieval-Augmented Generation) |
| **Use case** | Vector stores, document indexes, past-test registries |
| **Syntax** | `store Name : Provider(args)` |
| **Example** | `store KnowledgeBase : VectorStore(Env.PINECONE_KEY, namespace: "engineering")` |

### `agent`

| Field | Value |
|---|---|
| **Definition** | Instantiates an AI actor. Binds a foundation model to parameters |
| **Modifiers** | `equips` (binds tools/store), `requires` (binds policies) |
| **Syntax** | `agent Name [model-ref, key: value]` |
| **Example** | `agent DataAnalyst [gemini-3-1-pro, temp: 0.1]` |

### `pipeline`

| Field | Value |
|---|---|
| **Definition** | Defines an execution pipeline and its event trigger |
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

The Human-in-the-Loop trigger. Hard-stops the pipeline and freezes container state until external intervention.

```halo
|! yield(channel: Slack, msg: "Approve deployment?")
```

### `|*` — Fan-Out Pipe

Triggers parallel execution. Runs multiple nodes concurrently, merging outputs when the `{}` block closes.

```halo
|* { AgentA.prompt("task1"), AgentB.prompt("task2") }
```

### `~>` — Listen (Telemetry)

The asynchronous pause. Suspends the pipeline indefinitely to wait for human interaction or system events, injecting results back into context.

```halo
~> listen(UI.Button_Click)
```

## 4. Compiler Directives

Annotations placed above entities or pipelines that control cloud infrastructure behavior.

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
| **Definition** | The implicit, immutable data structure flowing through the pipeline |
| **Namespaces** | `context.data` (payload), `context.meta` (system), `context.trace` (history) |

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
