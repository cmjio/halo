// ============================================================
// STEP 11: Context Data Flow
// ============================================================
// LEARN: How results accumulate in context.data.* automatically
// WHY:  Each pipeline stage's output is available to later stages
// ============================================================

mind Analyzer [openai/gpt-4o, temp: 0.5]

stream AnalyzeText(text: String) -> Result:
  text
    // Stage 1: Generate sentiment (stored to context.data.Analyzer.prompt)
    |> Analyzer.prompt("Analyze sentiment of: {{text}}")
    
    // Stage 2: Extract keywords (uses result from stage 1)
    // Access previous result via context.data
    |> Analyzer.prompt("Extract 3 keywords from previous analysis")
    
    // Stage 3: Generate summary using both previous results
    |> Analyzer.prompt("Write a one-line summary of the analysis")
    |> System.Print()

// NOTES:
// - context.data.Mind.Method holds the LAST result from that mind+method
// - For multiple results from same mind, use different methods or minds
// - Context is available to all subsequent stages in the same stream
