# Multi-Agent Swarms

A single LLM cannot hold the context of an entire codebase or analyze 10,000 pages of financial documents simultaneously. To solve complex problems, you need a "Swarm" of specialized agents working together.

Halo makes orchestrating multi-agent swarms declarative and type-safe.

## The Fan-Out Operator (`|* { }`)

The simplest form of a swarm is parallel execution. Use the fan-out block to run multiple agents concurrently. The pipeline will automatically wait for all agents to finish, and merge their results into a single object before continuing.

```halo
agent FrontendReviewer [openai/gpt-4o]
agent BackendReviewer [anthropic/claude-3-5-sonnet]
agent SecurityAuditor [google/gemini-1.5-pro]

pipeline ReviewPullRequest(prUrl: String) -> Result:
  prUrl 
    // Run three specialist agents in parallel
    |* { 
      FrontendReviewer.analyze(), 
      BackendReviewer.analyze(), 
      SecurityAuditor.audit() 
    }
    // The results merge into context.data
    |> MergeTool.combine()
```

## Hierarchical Delegation

For more advanced swarms, you can treat pipelines as functions and have an "Architect" agent delegate tasks to "Worker" agents.

In Halo, pipelines can call other pipelines directly.

```halo
// 1. Define the Worker pipelines
pipeline WriteTests(feature: String) -> Code:
  feature |> QAAgent.write_jest_tests()

pipeline WriteDocs(feature: String) -> Markdown:
  feature |> TechWriterAgent.draft_readme()

// 2. Define the Master pipeline
pipeline ArchitectWorkflow(spec: String) -> Result:
  spec
    // Fan out to multiple sub-pipelines!
    |* { WriteTests(spec), WriteDocs(spec) }
    
    // The Architect agent reviews the output of its workers
    |> ArchitectAgent.review()
```

## Shared Memory (The Hive Mind)

If you have a swarm of 50 agents analyzing financial data, they shouldn't all search the web individually. You can use the `store` primitive to create a shared memory bank that all agents can read from and write to.

```halo
// Define a shared vector store
store ResearchHive : VectorStore("pinecone", namespace: "research")

agent Analyst [openai/gpt-4o]
  equips ResearchHive

agent Writer [anthropic/claude-3-5-sonnet]
  equips ResearchHive

// The Analyst writes to the Hive, the Writer reads from the Hive.
pipeline ReportGen(topic: String) -> Result:
  topic 
    |> Analyst.research()
    |> Writer.draft()
```

By combining Fan-Out (`|*`), Sub-Pipelines, and Shared Stores, you can build massive, asynchronous, hierarchical swarms that execute predictably.
