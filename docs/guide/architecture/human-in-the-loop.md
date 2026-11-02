# Human-in-the-Loop

AI models hallucinate, get confused, and can make high-stakes errors. Fully autonomous pipelines are a massive liability in production enterprise software.

Halo embraces **Human-in-the-Loop (HITL)** as a first-class language primitive.

## The `|! yield` Operator

The `yield` keyword acts like a webhook that instantly **suspends** the pipeline and freezes the context state. It pushes the state to an external system (like a Slack channel or a UI dashboard) and waits.

```halo
pipeline DeployToProduction(commit: String) -> Result:
  // 1. Agent analyzes the commit
  commit 
    |> DevOpsAgent.analyze()

  // 2. If risk is high, suspend the pipeline and ask a human
  |? (context.data.DevOpsAgent.analyze.riskLevel == "HIGH") =>
    |! yield(channel: "Slack", message: "Review this deployment!", data: commit)

  // 3. This only executes after human approval
  |> System.TriggerDeploy()
```

### How `yield` Works Under the Hood
When the Halo Runtime encounters a `yield`, it:
1. Emits a `yield` event to `runtime.telemetry`.
2. Returns a `suspended` status to the host application.
3. The host application saves the `ExecutionContext` (which contains the full pipeline state) to a database.
4. The Halo process exits. **No server resources are blocked waiting for the human.**

## The `~> listen` Operator

While `yield` pushes data out to a human, `listen` is the mechanism for waiting for data to come back in.

```halo
|! yield(channel: "Slack", data: invoice)
~> listen(System.ApprovalReceived)
```

In your host Node.js application, when a manager clicks "Approve" in the UI, you resume the pipeline by passing the event back to the runtime:

```typescript
// In your Next.js API route
export async function POST(req: Request) {
  const { pipelineStateId, managerDecision } = await req.json();
  
  // Load the frozen state from your database
  const state = await db.get(pipelineStateId);
  
  // Resume the pipeline, injecting the manager's decision into the listener
  const result = await runtime.resume(state, {
    event: "System.ApprovalReceived",
    payload: { decision: managerDecision }
  });
  
  return Response.json(result);
}
```

By making HITL a native language feature, Halo allows you to build asynchronous, long-running agentic workflows without writing complicated database polling logic in your backend.
