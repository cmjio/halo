// ============================================================
// EXAMPLE: Adapter & Router System Demo
// PURPOSE: Demonstrate cost-optimized routing across
//          multiple LLM providers and local models
// ============================================================

// ── Minds with different providers ─────

// OpenAI cloud model
mind Fast [openai/gpt-4o-mini, temp: 0.3]

// Anthropic cloud model
mind Smart [anthropic/claude-3-5-sonnet, temp: 0.7]

// Local model (free, fast)
mind Local [ollama/llama3.1, temp: 0.5]

// Together AI (cheap alternative)
mind Alt [together/meta-llama/Llama-3.1-8B-Instruct, temp: 0.5]

// ── Router Configuration ─────
// In langly.json or runtime config:
// {
//   "router": {
//     "strategy": "balanced",
//     "maxCostPer1kTokens": 0.01,
//     "preferredProviders": ["ollama", "together", "openai"],
//     "requiredCapabilities": ["streaming"]
//   }
// }

// ── Stream: Auto-routes to best model ─────

stream AskAnything(question: String) -> Result:
  question
    |> Fast.prompt("Answer: {{question}}")
    |> System.Print()

// ── Stream: Cost-optimized ─────
// Router will prefer cheapest option (local > together > openai)

stream CheapAnswer(question: String) -> Result:
  question
    |> Alt.prompt("Quick answer: {{question}}")
    |> System.Print()

// ── Stream: Performance-optimized ─────
// Router will pick most capable model

stream SmartAnswer(question: String) -> Result:
  question
    |> Smart.prompt("Detailed answer: {{question}}")
    |> System.Print()

// ── Execution:
// runtime.setRouterConfig({
//   strategy: "cost-optimized",
//   maxCostPer1kTokens: 0.005,
// });
// await runtime.execute("CheapAnswer", { question: "What is AI?" });
//
// Router might select: ollama/llama3.1 (free) or together/meta-llama (cheap)
//
// With strategy: "performance":
// Router would select: anthropic/claude-3-5-sonnet (most capable)
