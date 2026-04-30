// ============================================================
// STEP 15: Shadow Directive (A/B Testing)
// ============================================================
// LEARN: How to use @shadow for A/B testing minds
// WHY:  Compare different model outputs for same task
// ============================================================

// Control group mind
mind Baseline [openai/gpt-4o-mini, temp: 0.3]

// Shadow mind - runs in parallel, results logged but not used
@shadow(Baseline)
mind Candidate [anthropic/claude-3-5-sonnet, temp: 0.5]

stream CompareGreetings(name: String) -> Result:
  name
    // Both Baseline and Candidate run
    // Only Baseline's result is returned
    |> Baseline.prompt("Greet {{name}} warmly")
    |> System.Print()

// Runtime logs shadow output:
// [Shadow] Candidate output: "..."
//
// Use shadow to test new models without affecting production
