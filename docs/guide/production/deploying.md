# Deploying

The runtime needs **Bun**. It uses `Bun.file`, `Bun.CryptoHasher`, `bun:sqlite`, `Bun.SQL`, and `Bun.spawn`. Node-based hosts can't run it, including Next.js on Node, AWS Lambda's Node runtimes, and Cloudflare Workers. Any host that runs a Bun process works: a VM, a container (`oven/bun`), or a PaaS that runs Docker images.

## Option 1: run the CLI

For scheduled or one-off jobs, run the CLI directly:

```bash
bun run index.ts run workflows/triage.halo --arg repo=acme/api --json --no-telemetry
```

- Set the provider keys (`ANTHROPIC_API_KEY`, …) in the environment.
- Without a terminal, a run that reaches `|! yield` or `~> listen` **pauses**. It is saved to `.halo/runs/<runId>.json` and prints the `halo resume` command. Use `--auto-approve` for unattended jobs that should never wait.
- `--json` prints the output, status, and full `context` (cost, calls, trace) for your logs.
- The exit code is 1 when validation fails, an error is thrown, or a policy blocks the run. Halted and paused runs exit with 0, so check `status` in the JSON.

## Option 2: embed the runtime in a Bun server

```ts
import { compile, FileRunStore, HaloRuntime } from "halo";

const { ast, ok, diagnostics } = compile(await Bun.file("workflows/support.halo").text());
if (!ok) throw new Error(JSON.stringify(diagnostics));

const runtime = new HaloRuntime({
  runStore: new FileRunStore("/var/lib/halo/runs"),   // paused runs survive restarts
  vectorPath: "/var/lib/halo/vectors.sqlite",
}).load(ast);

Bun.serve({
  port: 3000,
  routes: {
    "/tickets": {
      POST: async (req) => {
        const { ticket } = await req.json();
        const result = await runtime.run("HandleTicket", { ticket });
        // status "paused": a human must answer; store result.runId with the ticket
        return Response.json({ status: result.status, runId: result.runId, output: result.output });
      },
    },
    "/runs/:id/answer": {
      POST: async (req) => {
        const result = await runtime.signal(req.params.id, "yield", await req.json());
        return Response.json({ status: result.status, output: result.output });
      },
    },
  },
});
```

- Load the program once and reuse the runtime across requests. Runs don't share state.
- With a `FileRunStore`, any process that loads the same `.halo` program can resume a paused run. Use one directory on shared storage, or implement `RunStore` over your database. The default `MemoryRunStore` loses paused runs on restart.
- `signal()` throws a `SignalError` (`RUN_NOT_FOUND`, `SIGNAL_MISMATCH`). Map it to a 404 or 409.
- Pass `{ signal: AbortSignal }` to `runtime.run` to cancel runs when clients disconnect. Use `@timeout` on pipelines and agents to bound run time.
- Call `runtime.close()` on shutdown to release SQLite and Postgres handles.

## Long runs

Multi-agent pipelines can take minutes. If your HTTP host has a request time limit, accept the request, run the pipeline in the background (or in a queue worker), and report `result.status` and `output` when it finishes. `@checkpoint` writes a snapshot after each stage to `.halo/checkpoints/`, so a crashed run can continue with `runtime.resume(path)` or `halo run --checkpoint <path>`.

## Configuration

| Variable | Used for |
|---|---|
| `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`/`GOOGLE_API_KEY`, `OPENROUTER_API_KEY`, `TOGETHER_API_KEY`, `REPLICATE_API_TOKEN` | Model providers |
| `HALO_API_KEY` (legacy `LANGLY_API_KEY`) | Fallback for any provider without its own key |
| `OLLAMA_HOST` | Ollama server (default `http://localhost:11434`) |
| Whatever your tools read with `Env.X` | e.g. `GITHUB_TOKEN`, `SLACK_BOT_TOKEN`, `RESEND_API_KEY`, `DATABASE_URL` |

There is no project config file. Configure the runtime in code (`RuntimeConfig`) or with CLI flags (`--router`, `--api-key`).

These files are written relative to the working directory unless you configure other paths:

| Path | Written by | Configure with |
|---|---|---|
| `.halo/runs/` | paused runs (CLI) | `FileRunStore(dir)` |
| `.halo/checkpoints/` | `@checkpoint` | `checkpointDir` |
| `.halo/vectors.sqlite` | `VectorStore` | `vectorPath` |
| `.halo/telemetry.db` | the CLI (Studio) | `--no-telemetry` |

`File` stores write wherever they are declared.

## Costs and safety

- `MaxSpend(usd)` caps the cost of **each run**. There is no monthly or cross-run budget. Use `getCostTracker()` or your own accounting for that.
- Costs are estimates from built-in price tables.
- Run `halo validate --strict` in CI so that policies the runtime can't enforce fail the build instead of being silently ignored.
