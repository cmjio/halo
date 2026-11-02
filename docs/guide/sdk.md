# Using Halo as a Library

The CLI is a thin wrapper around a TypeScript library. You can use the same parser and runtime from your own Bun code. The runtime uses Bun APIs (`Bun.file`, `bun:sqlite`, `Bun.SQL`, `Bun.spawn`), so it needs **Bun**, not Node.

Add the package from a checkout (for example `bun add /path/to/halo`), then import from `"halo"`. `"halo/runtime"`, `"halo/parser"`, `"halo/adapter"`, `"halo/router"`, and `"halo/errors"` are also exported.

## Parse, validate, run

```ts
import { compile, HaloRuntime } from "halo";

const { ast, diagnostics, ok } = compile(await Bun.file("./support.halo").text());
if (!ok) throw new Error(diagnostics.map((d) => `${d.line}:${d.column} ${d.message}`).join("\n"));

const runtime = new HaloRuntime().load(ast);   // keys come from env vars (see below)

const result = await runtime.run("HandleTicket", { ticket: "My invoice is wrong" });
result.status;               // "completed" | "halted" | "paused"
result.output;               // the final value (parsed JSON when the model answered in JSON)
result.context.meta.cost;    // USD, plus tokens, calls, violations, shadows
result.context.trace;        // hash-chained stage trace (check it with verifyTrace)
```

`compile` is `parse` plus `validate`. `runtime.execute(name, args)` returns only `output`. `runtime.load()` throws if the AST has syntax errors, but it does not run the validator.

## `RuntimeConfig`

| Option | Purpose |
|---|---|
| `apiKey` | Key for any provider without a more specific one |
| `apiKeys` | Per-provider keys by adapter id: `{ anthropic: "...", openai: "..." }` |
| `env` | Environment for `Env.*` and provider keys (default `Bun.env`) |
| `router` | Model routing, e.g. `{ strategy: "cost-optimized" }` (see below) |
| `fetch` | Custom `fetch` (proxies, tests) |
| `vectorPath` | SQLite file for `VectorStore` (default `.halo/vectors.sqlite`) |
| `checkpointDir` | Where `@checkpoint` writes (default `.halo/checkpoints`) |
| `runStore` | Where paused runs wait (default in-memory; `new FileRunStore(".halo/runs")` for files) |
| `onInterrupt`, `onListen` | Answer `\|! yield` and `~> listen` |
| `onSystemEvent` | Receives `System.Publish/Distribute/ResolveIncident/TriggerWebhook/Notify` |
| `onEvent` | Every [runtime event](./integrations/telemetry-and-tracing.md) |
| `logger` | Replaces `console` for logs and policy warnings |

Key lookup order for each provider: `apiKeys[id]`, then the provider's env var (`ANTHROPIC_API_KEY`, …), then `apiKey`, then `HALO_API_KEY`.

## Runtime methods

| Method | |
|---|---|
| `load(ast)` | Register declarations. You can call it more than once. |
| `run(name, args, { signal? })` | Run a pipeline and return a `RunResult`. Pass an `AbortSignal` to cancel. |
| `execute(name, args)` | Run a pipeline and return only its output. |
| `stream(name, args)` | Async generator of events, ending with `{ type: "done", result }` or `{ type: "error", error }`. |
| `signal(runId, event, payload)` | Resume a paused run. `event` is `"yield"` or the listen target. |
| `resume(checkpointPath)` | Continue from a `@checkpoint` file. |
| `onInterrupt(fn)`, `onListen(fn)` | Set human and event handlers. |
| `registerToolProvider(name, fn)` | Add a tool provider ([Custom Tools](./integrations/custom-tools.md)). |
| `registerSystem(name, fn)` | Add a `System.Name(...)` method. |
| `registerAdapter(adapter)` | Add a model provider. |
| `setRouterConfig(config)` | Turn on the router. |
| `mockAll(mocks)` | Canned responses for tests ([Testing](../dx/testing-and-mocks.md)). |
| `getCostTracker()` | Cumulative per-model cost across runs. |
| `close()` | Release SQLite and Postgres handles. |

## Streaming

```ts
for await (const e of runtime.stream("HandleTicket", { ticket })) {
  if (e.type === "token") process.stdout.write(e.text);
  if (e.type === "done") console.log("\n", e.result.status);
}
```

The built-in adapters don't stream yet. Each model answer arrives as one `token` event.

## Errors

Every error is a `HaloError` with a stable `code` and a `retryable` flag:

| Class | `code` |
|---|---|
| `PolicyViolation` (`.policy`, `.rule`) | `POLICY_VIOLATION` |
| `SchemaValidationError` (`.schema`, `.detail`) | `SCHEMA_VALIDATION` |
| `TimeoutError` | `TIMEOUT` (retryable) |
| `HttpError` (`.status`, `.body`) | `HTTP_ERROR` (retryable for 408, 429, 5xx) |
| `LoopLimitError` | `LOOP_LIMIT` |
| `SignalError` | `RUN_NOT_FOUND` or `SIGNAL_MISMATCH` |

## Router

When you pass `router` (or `--router` on the CLI), each agent call goes to a model the router picks. It chooses from a built-in model list, keeping only models whose provider has a key, and filters by `maxCostPer1kTokens`, `preferredProviders`, `requiredCapabilities`, and `maxLatency`. `strategy` is one of `"cost-optimized"`, `"performance"`, `"balanced"`, or `"local-first"`. Without a router config, the agent's own model is used.
