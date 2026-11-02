# Context & Scope

In Python, passing data between functions requires explicit variables (`res1 = fn()`, `res2 = fn(res1)`). 

In Halo, state flows implicitly through the `context` object. The `context` is an immutable state tree that grows as it moves through the pipeline.

## Anatomy of the Context

The `context` object is split into three reserved namespaces:

### `context.data`
This holds the actual payload. When a pipeline starts, its arguments are placed here. When an agent executes, its return value is appended here.

```halo
pipeline Process(email: String) -> Result:
  // Here, context.data.email exists.
  
  email |> Summarizer.run()
  // Here, context.data.Summarizer exists containing the result.
```

### `context.meta`
System metadata about the current execution trace.
- `context.meta.cost`: The running total USD cost of the pipeline.
- `context.meta.tokens`: The number of tokens consumed so far.
- `context.meta.latency`: The time elapsed since the pipeline began.

### `context.trace`
A cryptographic history of every node touched in the AST. Useful for auditing and time-travel debugging.

## Scoping Rules

State in Halo is **append-only**. You cannot mutate or delete variables once they are in the context.

During a **Fan-Out** (`|*`), the context is cloned for each parallel branch. When the branches merge, their local contexts are combined.

```halo
pipeline MergeExample(doc: String) -> Result:
  doc 
    |* { AgentA.run(), AgentB.run() }
    
  // Here, BOTH context.data.AgentA and context.data.AgentB exist.
  |> FinalAgent.summarize(
       a: context.data.AgentA, 
       b: context.data.AgentB
     )
```
