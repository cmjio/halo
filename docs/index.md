---
layout: home

hero:
  name: "Halo"
  text: "A small language for AI workflows"
  tagline: "Declare agents, tools, policies, and pipelines in a .halo file. The Bun runtime runs them with policies enforced, results traced, and humans in the loop."
  actions:
    - theme: brand
      text: Get Started
      link: /guide/quickstart
    - theme: alt
      text: Language Reference
      link: /guide/reference

features:
  - title: Declarative pipelines
    details: Agents, tools, policies, and schemas are language constructs. Pipelines chain them with operators for piping, gates, branches, fan-out, loops, and human approval.
  - title: Enforced policies
    details: Block prompt injection and PII, redact secrets, cap words and spend, and require JSON. These rules are checked in code on every agent call. Rules the runtime can't check produce a validator warning.
  - title: Inspectable runs
    details: Every run records cost, tokens, calls, and a SHA-256 hash-chained trace. The CLI saves runs for Halo Studio. Paused runs resume from the CLI or from your server.
---

## What it looks like

```halo
policy Safe   : Block(PromptInjection) & Redact(Email)
policy Budget : MaxSpend(0.50)

schema Assessment {
  fraudRisk: Number,
  summary: String,
}

agent Assessor [anthropic/claude-haiku-4-5, temp: 0.2]
  system "You assess insurance claims. Reply with JSON only."
  requires Safe, Budget

pipeline ProcessClaim(claim: String) -> Assessment:
  claim
    |> Assessor.assess("""
         Assess this claim. Reply as {"fraudRisk": <0-1>, "summary": "<one sentence>"}.
         Claim: {{claim}}
       """) as assessment
```

```bash
halo run claim.halo --arg claim="Rear-ended at a stop light, bumper damage"
halo test claim.halo --arg claim="..."   # offline: every call mocked
```

The run fails with a `SchemaValidationError` if the answer isn't JSON matching `Assessment`. It fails with a `PolicyViolation` if the input contains an injection attempt or the run has already spent $0.50.

## Why Halo?

1. **The prompt is the program.** Halo handles provider APIs, API keys, retries, timeouts, output parsing, and schema checks.
2. **Real tools.** REST, Postgres, Bash, a fetch-based Browser, Slack, Email (Resend), GitHub, Linear, Figma, and a local vector store are built in. You can register your own in TypeScript.
3. **Embeddable.** The parser and runtime are a TypeScript library for Bun. You can run pipelines from your own server and resume paused runs with `runtime.signal()`.
