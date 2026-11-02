# Telemetry & Tracing

Every run returns its own record in `result.context`:

- `meta.calls`: every agent, tool, and shadow call, with model, latency, cost, tokens, attempts, and whether it was mocked
- `meta.cost` and `meta.tokens`: totals for the run
- `meta.violations` and `meta.shadows`
- `trace`: one hash-chained entry per stage. Check it with `verifyTrace(trace)`.

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
| `retry` | A retry under `@retry` |
| `correction` | `@correct` asking an agent again |
| `violation` | A policy failure |
| `shadow` | A shadow call finishing |
| `halt` | A gate closing |
| `branch` | A branch choosing an arm (`arm: -1` when none matched) |
| `loop` | A loop jumping back |
| `paused` | A run pausing at yield or listen |
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

The CLI records every `run`, `debug`, `test`, and `resume` to `.halo/telemetry.db` (SQLite, the last 100 runs) in the current directory. Pass `--no-telemetry` to turn this off. Studio is a local viewer for that file:

```bash
bun run studio   # API on 127.0.0.1:4000, plus the Vite UI
```

Studio reads `HALO_TELEMETRY` if it is set. Otherwise it reads `.halo/telemetry.db` at the repository root, so either run the CLI from the repository root or point `HALO_TELEMETRY` at your project's file.

In the library, telemetry is **opt-in**. Use `SqliteTelemetry` as the event handler:

```ts
// Not re-exported from "halo" yet: import it from the source file.
import { SqliteTelemetry } from "/path/to/halo/src/runtime/telemetry.ts";

const telemetry = new SqliteTelemetry(".halo/telemetry.db");
const runtime = new HaloRuntime({ onEvent: telemetry.handler });
// ...
telemetry.close();
```

## Cost across runs

`runtime.getCostTracker()` totals cost per model over the runtime's lifetime. It provides `getTotalCost()`, `getCostBreakdown()` (cost, count, and average per model), and `reset()`. Costs are estimated from each adapter's price table and the token counts the provider reports. Ollama is $0.
