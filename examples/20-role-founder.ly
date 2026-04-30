// ============================================================
// ROLE: Founder / CEO
// PURPOSE: Morning briefing — synthesize metrics, news, and
//          investor updates into an executive summary
// ============================================================

guardrail Confidential    : Redact(Revenue) & Redact(SalaryData)
guardrail BrevityPolicy   : MaxWords(500)

// --- Tools ---
tool StripeAPI       : REST("api.stripe.com/v1", apiKey: Env.STRIPE_KEY)
tool AnalyticsAPI    : REST("api.mixpanel.com/data", apiKey: Env.MIXPANEL_KEY)
tool NewsFeed        : REST("api.newsapi.org/v2", apiKey: Env.NEWS_KEY)
tool SlackFounder    : POST("hooks.slack.com/services/founder-digest")
tool InvestorCRM     : POST("api.affinity.co/api/updates")

// --- Memory ---
tool DailyDigests    : VectorStore(Env.PINECONE_KEY, namespace: "founder-digests")
tool CompetitorIntel : VectorStore(Env.PINECONE_KEY, namespace: "competitor-tracking")

// --- Minds ---
@shadow(Analyst_V2)
mind Analyst [anthropic/claude-sonnet-4, temp: 0.1]
  equips StripeAPI, AnalyticsAPI, NewsFeed, CompetitorIntel
  requires Confidential

mind Summarizer [openai/gpt-4o-mini, temp: 0.3]
  requires BrevityPolicy, Confidential

// --- The Stream ---
@timeout(5m)
@retry(2, 30s)
stream MorningBriefing(date: Date) -> Digest:
  date
    // Step 1: Fan-out — pull all data sources in parallel (fast, independent reads)
    |* {
         Analyst.fetch_metric(
           tool: StripeAPI,
           metric: "mrr",
           date: context.data.date,
           compare_to: "30d_ago"
         ),
         Analyst.fetch_metric(
           tool: AnalyticsAPI,
           metric: "dau",
           date: context.data.date,
           compare_to: "7d_ago"
         ),
         Analyst.search_news(
           tool: NewsFeed,
           query: context.data.company_name,
           sentiment: true
         ),
         Analyst.track_competitors(
           tool: CompetitorIntel,
           since: "24h",
           signals: ["launch", "funding", "layoff"]
         )
       }

    // Step 2: Context merges automatically — analyze trends
    |> Analyst.analyze_trends(
         metrics: [context.data.stripe, context.data.analytics],
         news: context.data.news,
         competitor_updates: context.data.competitors
       )

    // Step 3: Gate — if nothing significant changed, skip detailed report
    |? (context.data.trends.notable_changes > 0)

    // Step 4: Compose executive brief (max 500 words enforced by guardrail)
    |> Summarizer.brief(
         trends: context.data.trends,
         section_order: ["metrics", "news", "competitors", "action_items"],
         tone: "executive"
       )

    // Step 5: Post to founder Slack
    |> SlackFounder.post(
         message: context.data.brief.text,
         blocks: [context.data.brief.kpi_cards, context.data.brief.alerts],
         channel: "founder-morning"
       )

    // Step 6: Log to digest history for trend correlation
    |> DailyDigests.log(
         date: context.data.date,
         content: context.data.brief.text,
         tags: context.data.trends.tags
       )
