// ============================================================
// STEP 4: Stream Params & Context
// Learn: Multiple stream params, context passing between stages
// Each pipeline stage's output is stored in `context.data.<stage>`
// ============================================================

guardrail NoProfanity : Block(Profanity)

tool Translator : REST("api.deepl.com/v2", apiKey: Env.DEEPL_KEY)

mind Greeter [gemini-3-1-pro, temp: 0.7]
  equips Translator
  requires NoProfanity

// Stream with two input params
stream PersonalizedHello(name: String, lang: String) -> Result:
  name
    // Stage 1: Generate greeting (output stored to context)
    |> Greeter.prompt("Write a warm, one-sentence greeting for {{name}}.")
    // Stage 2: Translate using previous stage's output
    |> Translator.translate(target_lang: lang)
    // Stage 3: Print final result
    |> System.Print()
