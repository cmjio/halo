# Built-in Policies & Guardrails

Policies are the backbone of Halo's security model. The standard library provides both deterministic and LLM-evaluated policies.

## Deterministic Guardrails

These execute instantly in the Node.js runtime and cost $0.

### `MaxSpend(amount: Float)`
Throws a `PolicyViolation` if the cumulative token cost of the pipeline exceeds the USD amount.
```halo
policy Budget : MaxSpend(5.00)
```

### `RedactPII()`
Uses RegEx and local heuristics to strip Social Security Numbers, Credit Cards, and Phone Numbers from the LLM output before it hits the context.
```halo
policy Privacy : RedactPII()
```

### `Timeout(ms: Integer)`
Fails the execution if an API request hangs.

## LLM-Evaluated Guardrails

These policies invoke a secondary, cheaper LLM (like `gpt-4o-mini`) in the background to evaluate the output of the primary agent.

### `Tone(style: String)`
Rejects outputs that do not match the specified corporate tone.
```halo
policy BrandSafe : Tone("Professional and empathetic")
```

### `Block(topic: String)`
Rejects outputs that discuss the blocked topic.
```halo
policy Safety : Block("Competitors") & Block("Hate Speech")
```
