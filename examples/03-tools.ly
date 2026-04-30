// ============================================================
// STEP 3: Tools - External Integrations
// Learn: Define tools (APIs, databases), equip minds with `equips`
// Tools wrap external services for minds to call
// ============================================================

// Define a translation tool
tool Translator : REST("api.deepl.com/v2", apiKey: Env.DEEPL_KEY)

guardrail NoProfanity : Block(Profanity)

// Equip mind with Translator tool to use in pipeline
mind Greeter [gemini-3-1-pro, temp: 0.7]
  equips Translator
  requires NoProfanity

stream MultiLangHello(name: String, lang: String) -> Result:
  name
    |> Greeter.prompt("Write a warm, one-sentence greeting for {{name}}.")
    // Call tool method with named args (pipeline passes previous output as first arg)
    |> Translator.translate(target_lang: lang)
    |> System.Print()
