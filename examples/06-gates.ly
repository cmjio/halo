// ============================================================
// STEP 6: Gates - Conditional Execution
// Learn: Skip pipeline stages with `|? (condition)`
// Condition uses variables or context from previous stages
// ============================================================

guardrail NoProfanity : Block(Profanity)
guardrail ShortOnly : MaxWords(50)

mind Greeter [gemini-3-1-pro, temp: 0.7]
  requires NoProfanity, ShortOnly

stream ConditionalHello(name: String, lang: String) -> Result:
  name
    |> Greeter.prompt("Write a warm, 1-sentence greeting for {{name}}.")
    // Gate: Only translate if target language is not English
    |? (lang != "en")
    |> Greeter.prompt(context.data.greeting)
    |> System.Print()
