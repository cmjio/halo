// ============================================================
// ROLE: UX Researcher
// PURPOSE: Collect user interview transcripts, run thematic
//          analysis, cross-reference with behavioral data,
//          and generate an evidence-backed research report
// ============================================================

guardrail Privacy        : Redact(PersonalInfo) & Anonymize(Speaker)
guardrail ResearchBudget : MaxSpend(3.00)

// --- Tools ---
tool DovetailAPI     : POST("api.dovetail.app/graphql", apiKey: Env.DOVTAIL_KEY)
tool AmplitudeAPI    : POST("api.amplitude.com/1/export", apiKey: Env.AMPLITUDE_KEY)
tool SlackResearch   : POST("hooks.slack.com/services/ux-research")
tool NotionResearch  : POST("api.notion.com/v1/pages", apiKey: Env.NOTION_KEY)

// --- Memory ---
tool PriorResearch   : VectorStore(Env.PINECONE_KEY, namespace: "interview-themes")
tool UserSegments    : VectorStore(Env.PINECONE_KEY, namespace: "user-personas")

// --- Minds ---
// The thematic analyst identifies patterns across interviews
@shadow(Analyst_Check)
mind ThematicAnalyst [anthropic/claude-sonnet-4, temp: 0.2]
  equips PriorResearch, UserSegments
  requires Privacy, ResearchBudget

// The data trier validates themes against behavioral metrics
mind DataTrier [openai/gpt-4o-mini, temp: 0.0]
  requires ResearchBudget

// The synthesizer produces the final report
mind ReportSynthesizer [openai/gpt-4o-mini, temp: 0.4]
  equips NotionResearch

// --- The Stream ---
@timeout(15m)
@retry(2, 10s)
stream ResearchReport(study_id: String) -> Report:
  study_id
    // Step 1: Load all interview transcripts from Dovetail
    |> ThematicAnalyst.load_transcripts(
         study_id,
         PriorResearch
       )

    // Step 2: Fan-out — parallel analysis: thematic + behavioral + persona
    |* {
         ThematicAnalyst.extract_themes(
           context.data.transcripts,
           ["pain_point", "satisfaction", "feature_request", "workflow"]
         ),
         DataTrier.validate_metrics(
           AmplitudeAPI,
           context.data.study.user_segment,
           context.data.study.timeframe
         ),
         ThematicAnalyst.segment_users(
           context.data.transcripts.speakers,
           UserSegments
         )
       }

    // Step 3: Gate — need at least 2 themes to report on
    |? (context.data.themes.primary_themes > 2)

    // Step 4: Cross-reference themes with behavioral data
    |> DataTrier.correlate(
         context.data.themes.ranked,
         context.data.metrics.validation
       )

    // Step 5: Synthesize the full research report
    |> ReportSynthesizer.build_report(
         context.data.themes,
         context.data.correlations,
         context.data.segments,
         "evidence-backed"
       )

    // Step 6: Send draft to research team for review
    |> SlackResearch.post(
         context.data.report.executive_summary,
         [context.data.report.full_doc, context.data.report.top_quotes],
         "ux-research-team"
       )

    // Step 7: Human-in-the-loop — researcher approves before publishing
    |! yield(
         SlackResearch,
         "Research report ready for review. Approve for stakeholder distribution?",
         [context.data.report.key_findings, context.data.report.recommendations],
         48h
       )

    // Step 8: Wait for researcher action
    ~> listen(SlackResearch.Reaction)

    // Step 9: Gate on approval
    |? (context.data.researcher.action == "approve")

    // Step 10: Publish to Notion and notify stakeholders
    |> NotionResearch.publish(
         context.data.report.content,
         "stakeholder-digest"
       )
