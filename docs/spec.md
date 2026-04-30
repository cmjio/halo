# Langly DSL

A domain-specific language for orchestrating AI/LLM workflows with declarative infrastructure, safety guardrails, and reactive pipeline composition.

## Language Design

Langly is a **declarative**, pipeline-oriented DSL designed to express complex AI workflows as readable, auditable data flows. It replaces imperative boilerplate (`try/catch`, `if/else`, memory arrays) with **four pipe operators** and **infrastructure declarations**.

### Type System & State Management

Langly is dynamically typed but strictly validated. The flowing state is immutable at each node transition.

#### Standard Types
- `String`, `Integer`, `Float`, `Boolean`, `List`, `JSON`

#### Domain Types
- `Asset` — Multimodal primitive (Image, Video, Audio, UI Component). Stored in memory without base64 bloat.
- `Embedding` — Native vector array for semantic math.

#### The Global State (`context`)
The implicit object flowing through the pipes. Three reserved namespaces:

| Namespace | Purpose |
|---|---|
| `context.data` | Actual payload (text, assets, JSON) |
| `context.meta` | System data (token usage, latency, cost) |
| `context.trace` | Cryptographic history of every node touched |

## Core Declarations (The Environment)

These entities are defined once per file to build the infrastructure sandbox.

### `guardrail` — The Bouncers

Evaluated *before* and *after* execution. Can be deterministic or AI-driven.

```
guardrail Privacy   : Redact(PII) & Block(PromptInjection)
guardrail Budget    : MaxSpend(50.00)
guardrail Aesthetics: MaxDensity(15) & Enforce(Brand.JSON)
```

### `tool` — The Hands

Zero-trust outbound network connections.

```
tool CoreDB   : PostgreSQL(Env.DB_URI)
tool Figma    : POST("api.figma.com/v1/render")
tool Snowflake: SQL(Env.SNOWFLAKE_KEY)
```

### `memory` — The Hippocampus

Persistent, stateful storage for RAG (Retrieval-Augmented Generation).

```
memory KnowledgeBase : VectorStore(Env.PINECONE_KEY, namespace: "engineering")
```

### `mind` — The Brains

The LLM/Model binding with optional modifiers.

```
mind DataAnalyst [gemini-3-1-pro, temp: 0.1]
  equips Snowflake, PastTests
  requires BudgetCap
```

#### Mind Modifiers
| Modifier | Purpose |
|---|---|
| `equips` | Grants a `mind` permission to use specific `tools` |
| `requires` | Binds `guardrail` policies — fails at compile-time if missing |

## Reactive Operators (Control Flow)

Four reactive pipe operators replace imperative `if/else`:

| Operator | Name | Purpose |
|---|---|---|
| `\|>` | Push | Standard execution. Pipes context into next node |
| `\|?` | Gate | Conditional branch. Only continues if condition is true |
| `\|!` | Interrupt | Human-in-the-Loop. Halts stream until external action |
| `\|*` | Fan-Out | Parallel execution. Merges outputs when block closes |
| `~>` | Listen | Telemetry. Suspends stream indefinitely to wait for events |

```
// Gate: only continue if risk score exceeds threshold
|? (context.data.risk_score > 90)

// Interrupt: Human approval required
|! yield(channel: Slack, msg: "Approve deployment?")

// Fan-Out: run multiple prompts in parallel
|* { MindA.prompt("task1"), MindB.prompt("task2") }

// Listen: wait for user interaction
~> listen(UI.Button_Click)
```

## Compiler Directives (Infrastructure as Code)

Annotations that control how the cloud runtime handles execution.

| Directive | Purpose | Example |
|---|---|---|
| `@checkpoint` | Snapshot state for time-travel resumption | `@checkpoint` |
| `@shadow(Name)` | Fork stream to secondary model for CI/CD comparison | `@shadow(Analyst_v2)` |
| `@retry(n, duration)` | Auto-recover transient failures | `@retry(3, 2s)` |
| `@timeout(duration)` | Hard-kill process to prevent infinite loops | `@timeout(5m)` |

## Full Example

```
// --- Environment ---
guardrail BudgetCap   : MaxSpend(5.00)
guardrail BrandSafe   : Tone("Professional") & Enforce(BrandGuide.JSON)
memory    PastTests   : VectorStore(Env.MILVUS_KEY)
tool      Snowflake   : SQL(Env.SNOWFLAKE_KEY)
tool      Figma       : POST("api.figma.com/render")

mind DataScientist [gemini-3-1-pro, temp: 0.0]
  equips Snowflake, PastTests
  requires BudgetCap

@shadow(Designer_V2)
mind UXDesigner [gemini-3-1-flash, temp: 0.7]
  equips Figma
  requires BrandSafe

// --- The Stream ---
@timeout(5m)
stream ResolveSalesDrop(event: String) -> Result:
  event
    |* { DataScientist.prompt("query data"), DataScientist.prompt("query memory") }
    |? (context.data.found_root_cause == true)
    |> UXDesigner.prompt("Design new UI")
    |! yield(channel: Slack, msg: "Approve?")
    ~> listen(Slack.Interaction)
    |? (context.data.slack_response == "approve")
    |> System.TriggerWebhook("CI/CD_Deploy")
```

## Editor Support

| Editor | Status | Path |
|---|---|---|
| VS Code | ✅ Supported | `editors/vscode/` |
| Sublime Text | ✅ Supported | `editors/sublime/` |
| **Zed** | ✅ **Supported** | `editors/zed/` |
| JetBrains | ⚠️ Planned | — |

## Dictionary

See [docs/dictionary.md](dictionary.md) for the full formal lexicon.

## Building

```sh
# Install dependencies
bun install

# Regenerate ANTLR parser
bash generate-grammar.sh

# Run tests
bun test

# Run with API key
LANGLY_API_KEY=sk-... bun test
```
