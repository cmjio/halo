# Compiler Directives

Compiler directives are meta-annotations that instruct the Halo Runtime on how to execute a node, agent, or pipeline. They are prefixed with an `@` symbol.

## `@timeout`

Prevents an agent or pipeline from looping endlessly or stalling out on network requests.

**Syntax:** `@timeout(duration)`
- `duration`: `s` (seconds), `m` (minutes), `h` (hours).

```halo
@timeout(5m)
pipeline SafeProcess(data: String) -> Result:
```

## `@retry`

Automatically intercepts network errors or API rate limits and retries the operation with exponential backoff.

**Syntax:** `@retry(attempts, delay)`

```halo
@retry(3, 2s)
pipeline ResilientProcess(data: String) -> Result:
```

## `@checkpoint`

Tells the runtime to snapshot the full `context` state to disk at this exact node. If the server crashes, the pipeline can be resumed exactly from this checkpoint instead of starting over.

```halo
@checkpoint
agent StatefulBot [openai/gpt-4o]
```

## `@shadow`

Used for seamless A/B testing and CI/CD model comparisons. It silently forks the pipeline context to a secondary agent, executing it in the background without affecting the primary return value.

**Syntax:** `@shadow(AgentName)`

```halo
@shadow(BetaBot_V2)
agent ProdBot [openai/gpt-4]
```
If you deploy `BetaBot_V2`, you can use `HaloRuntime.telemetry` to compare its output and latency against `ProdBot` in production without risking user experience!
