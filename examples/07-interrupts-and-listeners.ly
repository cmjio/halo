// ============================================================
// STEP 7: Interrupts & Listeners - Human-in-the-Loop
// Learn: Pause for human input with `|! yield(...)`, wait with `~>`
// ============================================================

guardrail NoProfanity : Block(Profanity)

tool SlackApprovals : POST("hooks.slack.com/services/hello-approvals")

mind Greeter [gemini-3-1-pro, temp: 0.7]
  requires NoProfanity

stream ApprovedHello(name: String) -> Result:
  name
    |> Greeter.prompt("Write a warm, 1-sentence greeting for {{name}}.")
    // Interrupt: Pause for human approval
    |! yield(context.data.greeting)
    // Listen for approval response
    ~> listen(SlackApprovals.Reaction)
    // Gate: Only print if approved
    |? (context.data.reaction == "approve")
    |> System.Print()
