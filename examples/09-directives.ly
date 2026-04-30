// ============================================================
// STEP 9: Directives - Build/Runtime Modifiers
// Learn: Use `@` directives to configure streams/minds
// ============================================================

guardrail NoProfanity : Block(Profanity)

mind Greeter [gemini-3-1-pro, temp: 0.7]
  requires NoProfanity

// Retry up to 2 times, wait 30s between retries
@retry(2, 30s)
// Timeout after 5 minutes
@timeout(5m)
stream ReliableHello(name: String) -> Result:
  name
    |> Greeter.prompt("Write a warm, one-sentence greeting for {{name}}.")
    |> System.Print()
