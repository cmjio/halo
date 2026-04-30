// ============================================================
// ROLE: Product Manager
// PURPOSE: Ingest feature requests, cluster them by theme,
//          score against strategy, and draft a roadmap brief
// ============================================================

guardrail BudgetPolicy    : MaxSpend(1.00)
guardrail StrategyAlign   : Enforce(ProductStrategy.JSON)

// --- Tools ---
tool Linear          : POST("api.linear.app/graphql", apiKey: Env.LINEAR_KEY)
tool Notion          : POST("api.notion.com/v1/pages", apiKey: Env.NOTION_KEY)
tool SlackPM         : POST("hooks.slack.com/services/pm-team")

// --- Memory ---
tool RequestHistory  : VectorStore(Env.PINECONE_KEY, namespace: "feature-requests")
tool ProductDocs     : VectorStore(Env.PINECONE_KEY, namespace: "product-strategy")

// --- Minds ---
mind Clustering [openai/gpt-4o-mini, temp: 0.2]
  requires BudgetPolicy

mind Strategist [anthropic/claude-sonnet-4, temp: 0.3]
  equips ProductDocs
  requires StrategyAlign, BudgetPolicy

mind Writer [openai/gpt-4o-mini, temp: 0.5]
  equips Notion

// --- The Stream ---
@timeout(10m)
stream RoadmapBrief(requests: FeatureRequests) -> Briefing:
  requests
    // Step 1: Cluster raw requests into themes
    |> Clustering.cluster(
         context.data.requests.items,
         ["user_segment", "problem_area", "urgency"],
         8
       )

    // Step 2: Gate — need at least 3 items to be actionable
    |? (context.data.clusters.total_items > 3)

    // Step 3: Score each cluster against strategic goals
    |> Strategist.score(
         context.data.clusters.themes,
         ProductDocs,
         ["revenue_impact", "retention", "competitive_edge", "effort"]
       )

    // Step 4: Gate — drop clusters below threshold
    |? (context.data.scoring.top_scores > 50)

    // Step 5: Draft the roadmap brief in Notion
    |> Writer.compose(
         "RoadmapBrief",
         [context.data.clusters, context.data.scoring.ranked],
         "strategic_narrative"
       )

    // Step 6: Send draft to PM Slack for feedback
    |! yield(
         SlackPM,
         context.data.draft.executive_summary,
         [context.data.notion.doc_url],
         24h
       )

    // Step 7: Wait for PM review
    ~> listen(SlackPM.Reaction)

    // Step 8: Gate on approval
    |? (context.data.pm_review.status == "approved")
    |> System.Publish(
         context.data.notion.doc_id,
         "product-team"
       )
