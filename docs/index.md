---
layout: home

hero:
  name: "Halo"
  text: "Infrastructure as Code for AI Agents"
  tagline: "Stop writing spaghetti Python to orchestrate LLMs. Halo is a strongly-typed, declarative orchestration language designed for production agentic workflows."
  actions:
    - theme: brand
      text: Get Started
      link: /guide/quickstart
    - theme: alt
      text: View Language Spec
      link: /spec

features:
  - title: Fully Declarative
    details: Define agents, tools, guardrails, and pipelines as native language constructs, not endless API wrappers.
  - title: Strongly Typed Data Flow
    details: Pipelines enforce JSON schema inputs and outputs natively. If an LLM hallucinates a missing field, the pipeline halts safely.
  - title: Production Guardrails
    details: Bind MaxSpend, RedactPII, and MaxTokens policies directly to your agents.
---

<style>
.comparison-container {
  display: flex;
  gap: 2rem;
  margin-top: 4rem;
  flex-wrap: wrap;
}
.comparison-col {
  flex: 1;
  min-width: 300px;
}
.comparison-col h3 {
  text-align: center;
  margin-bottom: 1rem;
}
</style>

## The Paradigm Shift

<div class="comparison-container">
<div class="comparison-col">

### The "Spaghetti" Way (Python/LangChain)

```python
from langchain.chat_models import ChatOpenAI
from langchain.prompts import PromptTemplate
from langchain.chains import LLMChain
from langchain.callbacks import get_openai_callback

llm = ChatOpenAI(temperature=0.7, model_name="gpt-4")
prompt = PromptTemplate(
    input_variables=["claim"],
    template="Analyze this claim: {claim}"
)
chain = LLMChain(llm=llm, prompt=prompt)

def process_claim(claim_text):
    with get_openai_callback() as cb:
        if cb.total_cost > 0.50:
            raise Exception("Max spend exceeded")
        result = chain.run(claim_text)
        # Manually redact PII...
        # Manually parse JSON...
        return result
```
</div>
<div class="comparison-col">

### The Halo Way

```halo
policy MaxSpend : Limit(0.50)
policy RedactPII : Redact()

agent Assessor [openai/gpt-4, temp: 0.7]
  requires MaxSpend, RedactPII

schema ClaimResult {
  fraudRisk: Number
  summary: String
}

pipeline ProcessClaim(claim: String) -> ClaimResult:
  claim 
    |> Assessor.prompt("Analyze this claim: {{claim}}")
```
</div>
</div>

<br>
<br>

### Why Halo?

1. **Focus on the Prompt, Not the Plumbing**: Halo handles the LLM API calls, the JSON schema enforcement, the tracing, and the API key routing natively.
2. **Native Tooling**: Equip an agent with `PostgreSQLTool` and Halo handles the tool-call loop automatically.
3. **The Escape Hatch**: Under the hood, Halo compiles down to an AST that runs in a lightweight, zero-dependency Node/Bun runtime (`@halo-lang/runtime`). You can embed Halo directly in your Next.js API routes or Express servers.
