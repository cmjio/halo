// ============================================================
// CONTROL: Enterprise Content Moderation Pipeline
// ============================================================
// A hardened moderation pipeline with multiple defense layers,
// audit trails, escalating human review, and budget-safe
// AI model selection. Shows how Langly handles compliance.
// ============================================================

// --- GUARDRAILS: Hard boundaries ---
guardrail PIIProtection   : Redact(SSN) & Redact(CreditCard) & Redact(HealthData)
guardrail OutputSafety    : Block(HarmfulContent) & Block(HateSpeech) & Block(SexualContent)
guardrail CostControl     : MaxSpend(2.00)

// --- TOOLS ---
tool ModerationAPI  : POST("api.openai.com/v1/moderations")
tool AuditLogger    : POST("api.example.com/audit", apiKey: Env.AUDIT_KEY)
tool EscalationQueue: POST("api.jira.com/rest/issue")

// --- MEMORY ---
tool PolicyRules    : VectorStore(Env.PINECONE_KEY, namespace: "content-policy-v3")
tool PastCases      : VectorStore(Env.PINECONE_KEY, namespace: "moderation-history")

// --- MINDS ---
// The triage mind is cheap — handles bulk content fast
mind TriageAgent [openai/gpt-4o-mini, temp: 0.0]
  requires CostControl

// The deep-review mind handles edge cases with precision
@timeout(60s)
mind ReviewAgent [google/gemini-flash, temp: 0.1]

// The policy expert knows regulations inside-out
mind PolicyExpert [anthropic/claude-sonnet-4, temp: 0.2]
  equips PolicyRules

// --- The Stream ---
@timeout(5m)
@retry(3, 10s)
stream ModerateContent(submission: ContentSubmission) -> Decision:
  submission
    // Layer 1: Quick triage — 80% of content auto-decisioned
    |> TriageAgent.screen(
        text: context.data.submission.body,
        user_flags: context.data.submission.user_flags
      )

    // Layer 2: Gate — skip deep review for obvious cases
    |? (context.data.TriageAgent.screen.toxicity_score < 0.3)

    // Layer 3: Deep review for ambiguous content
    |> ReviewAgent.evaluate(
        content: context.data.submission.body,
        policy: PolicyRules,
        history: PastCases
      )

    // Layer 4: Log everything to audit trail
    |> AuditLogger.record(
        event: "moderation_review",
        data: context.data
      )

    // Layer 5: Gate — escalate to human if risk is high
    |? (context.data.ReviewAgent.evaluate.risk_level == "high")

    // Layer 6: Human-in-the-loop for final sign-off
    |! yield(
        queue: EscalationQueue,
        context: context.data.ReviewAgent.evaluate,
        timeout: 1h
      )

    // Layer 7: Wait for human decision
    ~> listen(EscalationQueue.Reaction)

    // Layer 8: Gate on approval
    |? (context.data.human.action == "approve")

    // Layer 9: Final policy check before publishing
    |> PolicyExpert.final_review(
        content: context.data.submission.body,
        review: context.data.ReviewAgent.evaluate
      )
    |> System.Print()
