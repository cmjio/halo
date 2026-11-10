# Multi-Agent Pipelines

Halo coordinates several agents with explicit stages. It doesn't run a free-form conversation between them.

## Parallel specialists

`|* { … }` runs calls in parallel on the same input and returns their results as a list, in order. Each result is also stored at `context.data.<Agent>.<method>`, so a later agent can read them by name.

```halo
agent FrontendReviewer [openai/gpt-4o-mini]
agent BackendReviewer  [anthropic/claude-haiku-4-5]
agent SecurityAuditor  [gemini-2.5-flash]
agent Lead             [anthropic/claude-sonnet-4-5]

pipeline ReviewPullRequest(diff: String) -> Result:
  diff
    |* {
         FrontendReviewer.review(),
         BackendReviewer.review() as backend,
         SecurityAuditor.audit(),
       } as reviews
    |> Lead.summarize("Merge these reviews into one list of required changes.", context.data.reviews)
```

`FrontendReviewer.review` and `BackendReviewer.review` both write `context.data.review`, so the last one to finish wins there. Read results by `Agent.method` or by binding, not by bare method name.

## Fan out over a list

`|* each(item in list, concurrency: n) => Call()` runs one call per item, at most `n` at a time:

```halo
agent Classifier [openai/gpt-4o-mini]

pipeline ClassifyAll(tickets: List) -> Result:
  tickets
    |* each(ticket in tickets, concurrency: 5) => Classifier.classify("Classify ticket {{index}}: {{ticket}}") as labels
```

## Pipelines as sub-tasks

A pipeline can call another pipeline like a function. Fan-out items can be pipeline calls too.

```halo
agent QA        [openai/gpt-4o-mini]
agent Writer    [openai/gpt-4o-mini]
agent Architect [anthropic/claude-sonnet-4-5]

pipeline WriteTests(feature: String) -> Result:
  feature |> QA.write_tests()

pipeline WriteDocs(feature: String) -> Result:
  feature |> Writer.draft_readme()

pipeline Build(spec: String) -> Result:
  spec
    |* { WriteTests(spec), WriteDocs(spec) } as parts
    |> Architect.review(context.data.WriteTests, context.data.WriteDocs)
```

A called pipeline runs in its own context and receives only its arguments. Its cost and calls count toward the caller's run. Nesting is limited to 16 levels, counting the top-level pipeline.

## Shared memory

Agents that equip the same `VectorStore` share it. Write to the store explicitly. Equipping a `VectorStore` adds search results to prompts, but it never saves an agent's answers.

```halo
store Research : VectorStore(namespace: "research")

agent Analyst [openai/gpt-4o-mini]
agent Writer  [anthropic/claude-haiku-4-5]
  equips Research

pipeline Report(topic: String) -> Result:
  topic
    |> Analyst.research("List five findings about {{topic}}.") as findings
    |> Research.log(content: context.data.findings, tags: [topic])
    |> Writer.draft("Write a short report on {{topic}}.")
```

`Writer.draft` automatically gets the closest stored findings, including findings from earlier runs, because the store is a local SQLite file.

## Comparing models

`@shadow` runs a candidate agent or model next to a primary agent without affecting its output. See [Directives](../../reference/compiler-directives.md#shadow). `examples/data-research/analyst-swarm.halo` and `examples/learn/12-multiple-agents.halo` are longer examples.
