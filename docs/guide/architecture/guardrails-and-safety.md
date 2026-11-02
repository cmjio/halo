# Guardrails & Safety

When deploying LLMs to production, you cannot rely solely on the model's system prompt to enforce safety constraints. LLMs can be tricked via Prompt Injection, and they can easily hallucinate PII or exceed token limits.

Halo enforces safety at the **runtime level** using the `policy` primitive.

## Defining Policies

A `policy` is a set of hard constraints evaluated before and after an agent executes. If a policy fails, the execution is blocked and the pipeline halts safely.

```halo
// A deterministic budget policy
policy QA_Budget : MaxSpend(5.00)

// A deterministic redaction policy
policy Privacy : RedactPII()

// An LLM-evaluated safety policy
policy BrandSafe : Tone("Professional") & Block("HateSpeech")
```

## Binding Policies to Agents

Policies are bound to an `agent` using the `requires` modifier. 

```halo
agent CustomerSupportBot [openai/gpt-4o]
  system "You are a customer support agent."
  requires Privacy, BrandSafe, QA_Budget
```

If the `CustomerSupportBot` attempts to generate a response containing a Social Security Number, the `Privacy` policy will intercept the payload at the runtime layer, apply the redaction algorithm, and pass the safe text forward. 

If the agent has consumed $5.01 of API credits, the `QA_Budget` policy will instantly throw a `PolicyViolation` error, preventing further execution.

## Writing Custom TypeScript Policies

You are not limited to the built-in policies. You can write custom policies in TypeScript and register them with the Halo Runtime, just like tools.

```typescript
// 1. Write the custom policy
class CompetitorMentionPolicy {
  name = "BlockCompetitors";
  
  async validateOutbound(output: string): Promise<boolean> {
    const competitors = ["AcmeCorp", "GlobalTech"];
    const hasCompetitor = competitors.some(c => output.includes(c));
    
    if (hasCompetitor) {
      throw new Error("PolicyViolation: Output mentions a competitor.");
    }
    return true;
  }
}

// 2. Register it with the runtime
runtime.policyRegistry.register(new CompetitorMentionPolicy());
```

Then use it in your Halo file:
```halo
policy StrictMarketing : BlockCompetitors()

agent Marketer [anthropic/claude-3-5-sonnet]
  requires StrictMarketing
```
