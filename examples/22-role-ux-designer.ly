// ============================================================
// ROLE: UX Designer
// PURPOSE: Audit a product screen for accessibility issues,
//          generate design tokens, produce an annotated mock
// ============================================================

// --- Guardrails ---
guardrail WCAG2x : Enforce("WCAG.JSON")
guardrail BrandSystem : Enforce("DesignTokens.JSON")

// --- Tools ---
tool FigmaAPI : POST("api.figma.com/v1", apiKey: Env.FIGMA_KEY)
tool ChromeAudit : POST("lhci.google.com/api/audit")
tool SlackDesign : POST("hooks.slack.com/services/design-team")

// --- Memory ---
tool DesignTokens : VectorStore(Env.PINECONE_KEY, namespace: "design-system")

// --- Minds ---
mind Auditor [openai/gpt-4o, temp: 0.3]
  equips ChromeAudit
  requires WCAG2x

mind TokenMaster [anthropic/claude-3-5-sonnet, temp: 0.5]
  equips DesignTokens

mind MockArtist [openai/dall-e-3, temp: 0.8]

// --- The Stream ---
stream AuditScreen(screen: Figma.Screen) -> Report:
  screen
    // Step 1: Automated accessibility audit
    |> Auditor.audit(
        tool: ChromeAudit,
        url: context.data.screen.url
      )

    // Step 2: LLM-powered WCAG analysis
    |> Auditor.analyze(
        context.data.Auditor.audit,
        standard: "WCAG2x-AA"
      )

    // Step 3: Gate — only continue if issues found
    |? (context.data.Auditor.analyze.issue_count > 0)

    // Step 4: Generate design tokens
    |> TokenMaster.generate(
        context.data.Auditor.analyze,
        output: "design-tokens.json"
      )

    // Step 5: Create annotated mock
    |> MockArtist.render(
        context.data.screen,
        tokens: context.data.TokenMaster.generate
      )

    // Step 6: Post to Slack
    |> SlackDesign.post(
        channel: "#design-reviews",
        mock: context.data.MockArtist.render
      )
    |> System.Print()
