# Telemetry & Tracing

Every run returns its own record in `result.context`:

- `meta.calls`: every agent, tool, and shadow call, with model, latency, cost, tokens, attempts, and whether it was mocked
- `meta.cost` and `meta.tokens`: totals for the run
- `meta.violations` and `meta.shadows`
- `trace`: one hash-chained entry per stage. Check it with `verifyTrace(trace)`.

## What the trace vouches for

Each trace entry hashes the stage's output (`outputHash`) and links to the entry before it. A stage that called tools (directly, or an agent choosing its own calls) also has `effectsHash`: a SHA-256 over every call it made, each call's target, arguments and result. It's part of the entry's hash, so the chain covers what the run *did* (the commands it ran in a sandbox, the files it wrote, the requests it sent) as well as what its agents said. Change any recorded effect and `verifyTrace` fails from that entry on.

The hash proves the trace wasn't edited after the fact; it doesn't hold the effects themselves. Keep a [recording](../plan-and-replay.md#recordings) (`halo run` does by default) to see the calls, and compare their hashes against the trace.

`halo run --json` prints all of it.

## Runtime events

Pass `onEvent` in `RuntimeConfig` to observe a run as it happens, or iterate `runtime.stream(...)`.

| `type` | When |
|---|---|
| `run` | Start and end of a top-level run (`status`: `start`, `completed`, `halted`, `paused`, or `error`) |
| `stage` | Each stage starting and ending, with its value and duration |
| `llm` | Each model call: agent, model, system, prompt, output, latency, cost, tokens, mocked |
| `token` | A model's text (the whole answer as one chunk) |
| `tool` | Each tool call: tool, method, output, latency, mocked |
| `agent_tool` | A tool call an agent chose: target, args, and whether it was allowed, approved, declined, refused, or failed (see [Agents with Tools](../agents-with-tools.md#events)) |
| `retry` | A retry under `@retry` |
| `correction` | `@correct` asking an agent again |
| `violation` | A policy failure |
| `shadow` | A shadow call finishing |
| `halt` | A gate closing |
| `branch` | A branch choosing an arm (`arm: -1` when none matched) |
| `loop` | A loop jumping back |
| `paused` | A run pausing at yield, listen, or a tool-call approval |
| `checkpoint` | A checkpoint file being written |

```ts
const runtime = new HaloRuntime({
  onEvent: (e) => {
    if (e.type === "llm") console.log(`${e.agent} via ${e.model}: ${e.latencyMs}ms $${e.cost.toFixed(4)}`);
    if (e.type === "violation") console.warn(`${e.policy}/${e.rule}: ${e.message}`);
  },
});
```

You can forward these events to any logging or tracing system. There are no built-in exporters for Datadog, LangSmith, or similar services.

## Halo Studio

The CLI records every `run`, `debug`, `test`, and `resume` to `.halo/telemetry.db` (SQLite, the last 100 finished runs; runs still going are never pruned, and a field over 32 KB, like a huge output, is kept as a preview) in the current directory. Pass `--no-telemetry` to turn this off. `halo serve` records its runs to the same file and serves Studio at `/`:

```bash
halo serve        # Studio at http://127.0.0.1:8080/ (also: bun run studio)
```

Studio lists recent runs (pipeline, status, duration, cost), draws each one as a chart of its stages, model calls, and tool calls, and shows any step's prompt, answer, tokens, and cost. It can also start pipelines and approve paused runs. Start it from the folder whose `.halo/` you want to see (or set `stateDir` in `halo.json`). See [Serving pipelines](../production/serving.md).

In the library, telemetry is **opt-in**. Use `SqliteTelemetry` as the event handler:

```ts
import { SqliteTelemetry } from "halo";

const telemetry = new SqliteTelemetry(".halo/telemetry.db");
const runtime = new HaloRuntime({ onEvent: telemetry.handler });
// ...
telemetry.close();
```

## Cost across runs

`runtime.getCostTracker()` totals cost per model over the runtime's lifetime. It provides `getTotalCost()`, `getCostBreakdown()` (cost, count, and average per model), and `reset()`. Costs are estimated from each adapter's price table and the token counts the provider reports. Ollama is $0.
