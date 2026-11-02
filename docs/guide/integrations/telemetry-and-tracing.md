# Telemetry & Tracing

When an LLM pipeline fails in production, you need to know exactly which agent failed, what the prompt was, what the tools returned, and how much the execution cost.

Because Halo pipelines compile to an Abstract Syntax Tree (AST), the runtime has perfect visibility into every node transition.

## The Telemetry Dispatcher

The `@halo-lang/runtime` exposes an event emitter called `telemetry` that fires at every stage of the pipeline lifecycle. 

You can hook into this dispatcher to pipe execution traces to your observability platform of choice (Datadog, LangSmith, Helicone, or just stdout).

```typescript
import { HaloRuntime } from '@halo-lang/runtime';

const runtime = new HaloRuntime({ apiKey: process.env.OPENAI_API_KEY });

// 1. Listen for Pipeline Start
runtime.telemetry.on("pipeline_start", (event) => {
  console.log(`[START] Pipeline ${event.pipelineName} initialized with trace ID: ${event.traceId}`);
});

// 2. Listen for Agent Execution
runtime.telemetry.on("node_start", (event) => {
  console.log(`[AGENT] ${event.agentName} is thinking... Model: ${event.model}`);
});

// 3. Intercept Tool Calls
runtime.telemetry.on("tool_call", (event) => {
  console.log(`[TOOL] Agent called ${event.toolName} with args:`, event.payload);
});

// 4. Capture Final Output and Costs
runtime.telemetry.on("pipeline_complete", (event) => {
  console.log(`[END] Pipeline finished in ${event.durationMs}ms`);
  console.log(`[COST] Total execution cost: $${event.totalCost}`);
});
```

## Built-in Datadog/LangSmith Adapters (Coming Soon)

In the future, the SDK will ship with built-in adapters for major observability platforms. 

```typescript
import { LangSmithTracer } from '@halo-lang/runtime/tracers';

// This automatically binds all telemetry events to LangSmith traces
runtime.telemetry.attach(new LangSmithTracer(process.env.LANGSMITH_API_KEY));
```

## Cost Tracking

The `HaloRuntime` exposes a `getCostTracker()` method that maintains a running tally of prompt and completion tokens across all agents in the pipeline, calculating the precise USD cost based on the models utilized (e.g., `gpt-4o` vs `claude-3-5-sonnet`).

```typescript
const output = await runtime.execute("MainPipeline", { data });

const tracker = runtime.getCostTracker();
console.log(tracker.getTotalCost()); // 0.045
console.log(tracker.getTokenUsage()); // { prompt: 1500, completion: 450 }
```
