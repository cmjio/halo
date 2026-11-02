# Language Reference

This document serves as the exhaustive reference for the Halo syntax, keywords, and operators.

## File Structure

Halo files (`.halo`) consist of top-level declarations followed by one or more `pipeline` definitions.

```halo
// Top-level declarations
agent Coder [openai/gpt-4o]
tool Search : BrowserTool()

// Pipelines
pipeline Main() -> Result:
  ...
```

## Top-Level Declarations

### `agent`

Defines a Model binding with a specific persona and capabilities.

```halo
agent Name [provider/model-id, temp: 0.5]
  system "Your persona string"
  equips Tool1, Tool2
  requires Guardrail1
```

- **provider**: Currently supported are `openai`, `anthropic`, `google`, `ollama`.
- **temp**: The temperature float (0.0 to 1.0).
- **system**: Modifies the agent's system prompt (supports `"""` multi-line strings).
- **equips**: A comma-separated list of tools the agent is permitted to call.
- **requires**: A comma-separated list of policies the agent must pass.

### `tool`

Binds an external capability to the runtime.

```halo
tool ToolName : Provider(Args)
```
Examples:
- `tool Jira : REST("https://api.atlassian.com", Env.JIRA_TOKEN)`
- `tool DB   : PostgreSQL(Env.DB_URI)`

### `policy`

Defines safety guardrails for the environment.

```halo
policy Strict : MaxSpend(5.00) & RedactPII()
```

### `store`

Defines a stateful persistence layer (e.g., Vector Database or File System).

```halo
store Memory : VectorStore("pinecone", namespace: "bot")
```

### `schema`

Defines strong JSON typings for pipeline returns or intermediate states.

```halo
schema Result {
  confidence: Number
  reasoning: String
}
```

## Pipelines and Operators

Pipelines represent the data flow. They accept strongly typed arguments and return a specified type.

```halo
pipeline Name(arg1: String) -> ResultType:
  ...
```

### The Pipe Forward (`|>`)
The core operator. Takes the result of the left-hand side and pushes it into the right-hand side.

```halo
"Hello" |> System.Print()
```

### Pattern Matching Gates (`|?`)
Used for conditional branching. Replaces `if/else`.

```halo
|? (context.data.score > 90) =>
  context.data |> Agent.process()
```

### Fan-Out (`|* { }`)
Executes multiple branches in parallel. Merges the results.

```halo
data |* { Agent1.analyze(), Agent2.analyze() }
```

### Human-in-the-Loop (`|! yield` and `~> listen`)
`|! yield` suspends execution and pushes state to a persistent database. `~> listen` subscribes to system events.

```halo
|! yield(action: "Approval", data: context.data)
~> listen(System.ApprovalReceived)
```

## Directives

Directives modify pipeline execution behavior.

- `@retry(attempts, delay)`: Automatically retries the pipeline on network failure.
- `@timeout(duration)`: Hard kills the pipeline if it exceeds the limit (e.g., `@timeout(5m)`).
- `@checkpoint`: Saves the state of the pipeline after every stage for crash recovery.
- `@shadow(AgentName)`: Silently forks execution to a secondary agent to compare outputs in the background.
