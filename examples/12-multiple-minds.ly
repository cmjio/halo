// ============================================================
// STEP 12: Multiple Minds in One Stream
// ============================================================
// LEARN: How to use different minds (LLMs) in a single pipeline
// WHY:  Different tasks need different model capabilities/costs
// ============================================================

// Cheap mind for simple tasks
mind Quick [openai/gpt-4o-mini, temp: 0.0]

// Powerful mind for complex tasks
mind Smart [anthropic/claude-3-5-sonnet, temp: 0.7]

// Specialized mind for creative tasks
mind Creative [google/gemini-1.5-pro, temp: 0.9]

stream ProcessIdea(idea: String) -> Result:
  idea
    // Step 1: Quick initial analysis (cheap)
    |> Quick.prompt("Is this idea feasible? Yes/No + one reason.")
    
    // Step 2: Deep analysis (powerful)
    |> Smart.prompt("Expand on this idea in detail")
    
    // Step 3: Generate creative variations (creative)
    |> Creative.prompt("Generate 3 creative variations")
    |> System.Print()

// Cost optimization: Use cheap models for simple tasks,
// reserve expensive models for complex reasoning.
