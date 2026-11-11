# @acme/support-kit

Triage support tickets. Bring your own model for the `fast` slot.

```halo
use "@acme/support-kit" { Triage } with models(fast: anthropic/claude-haiku-4-5)

pipeline Inbox(ticket: String):
  ticket |> Triage()
```

Exports: `Triage` (pipeline), `Triager` (agent), `Classification` (schema).
