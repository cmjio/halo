// ============================================================
// STEP 13: Deep Context Paths
// ============================================================
// LEARN: How to access nested context data (context.data.x.y.z)
// WHY:  Complex pipelines build nested result structures
// ============================================================

mind Worker [openai/gpt-4o, temp: 0.5]

// Simulating a fan-out that builds nested context
stream DeepContextAnalysis(input: String) -> Result:
  input
    // Stage 1: First analysis
    |> Worker.prompt("Analyze: {{input}}")
    
    // Stage 2: Access the result via context
    // In real usage, fan-out stores results in context.data[callee]
    |? (context.data.Worker != null)
    
    // Stage 3: Use the stored result
    |> Worker.prompt("Summarize this analysis")
    |> System.Print()

// Deep context paths work with any nesting level:
//   context.data.mindName.methodName
//   context.input.paramName
