// ============================================================
// STEP 2: Guardrails - Safety & Constraints
// Learn: Define guardrails, apply to minds with `requires`
// Guardrails restrict mind behavior (block profanity, limit length, etc.)
// ============================================================

// Define guardrails (combine rules with &)
guardrail NoProfanity : Block(Profanity) & LogViolation()
guardrail Brevity : MaxWords(50)

// Apply guardrails to minds with `requires`
mind Greeter [gemini-3-1-pro, temp: 0.7]
  requires NoProfanity, Brevity

stream HelloWorld(name: String) -> Result:
  name
    |> Greeter.prompt("Write a warm, one-sentence 'Hello World' greeting for this person.")
    |> System.Print()
