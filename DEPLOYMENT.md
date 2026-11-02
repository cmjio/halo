# Deploying Halo

Halo needs **Bun**. The runtime uses `Bun.file`, `Bun.CryptoHasher`, `bun:sqlite`, `Bun.SQL`, and `Bun.spawn`, so Node-only hosts can't run it. That includes Next.js on Node, AWS Lambda's Node runtimes, and Cloudflare Workers. Any VM, container, or PaaS that runs a Bun process works. The full guide is in `docs/guide/production/deploying.md`.

## Local models (no API key)

```bash
ollama serve && ollama pull llama3.2
# in your .halo file: agent Bot [ollama/llama3.2]
bun run index.ts run my.halo --arg question="..."
```

Set `OLLAMA_HOST` if Ollama isn't at `http://localhost:11434`.

## Running the CLI in a container

```dockerfile
FROM oven/bun:1
WORKDIR /app
COPY . .
RUN bun install --production
ENV ANTHROPIC_API_KEY=""
CMD ["bun", "run", "index.ts", "run", "workflows/main.halo", "--json", "--no-telemetry"]
```

- Pass arguments with `--arg key=value` or `--args '<json>'`.
- Without a terminal, a run that reaches `|! yield` / `~> listen` pauses. It is saved to `.halo/runs/` and continued with `halo resume <file> <runId> --payload ...` (`bun run index.ts resume ...`). Use `--auto-approve` for jobs that must never wait. Mount `.halo/` on a volume if paused runs must survive restarts.
- The exit code is 1 on validation errors, thrown errors, and policy violations. Halted and paused runs exit with 0, so check `status` in the `--json` output.

## Embedding in a Bun server

```ts
import { compile, FileRunStore, HaloRuntime } from "halo";

const { ast, ok, diagnostics } = compile(await Bun.file("workflows/support.halo").text());
if (!ok) throw new Error(JSON.stringify(diagnostics));
const runtime = new HaloRuntime({ runStore: new FileRunStore(".halo/runs") }).load(ast);

Bun.serve({
  port: 3000,
  routes: {
    "/tickets": {
      POST: async (req) => {
        const result = await runtime.run("HandleTicket", await req.json());
        return Response.json({ status: result.status, runId: result.runId, output: result.output });
      },
    },
    // A human answered a paused |! yield: continue the run.
    "/runs/:id/answer": {
      POST: async (req) => Response.json(await runtime.signal(req.params.id, "yield", await req.json())),
    },
  },
});
```

`signal(runId, event, payload)` takes `"yield"` or a listen target (e.g. `"Slack.Interaction"`). It throws a `SignalError` with code `RUN_NOT_FOUND` or `SIGNAL_MISMATCH`. The default `MemoryRunStore` loses paused runs on restart. Use `FileRunStore` on shared storage or implement `RunStore` over your database.

## Environment variables

| Variable | Used for |
|---|---|
| `ANTHROPIC_API_KEY` | `anthropic/…`, `claude-…` models |
| `OPENAI_API_KEY` | `openai/…`, `gpt-…` models |
| `GEMINI_API_KEY` or `GOOGLE_API_KEY` | `google/…`, `gemini-…` models |
| `OPENROUTER_API_KEY`, `TOGETHER_API_KEY`, `REPLICATE_API_TOKEN` | those providers |
| `HALO_API_KEY` (legacy `LANGLY_API_KEY`) | fallback for any provider without its own key |
| `OLLAMA_HOST` | Ollama server |
| anything read with `Env.X` in a tool | e.g. `GITHUB_TOKEN`, `SLACK_BOT_TOKEN`, `RESEND_API_KEY`, `DATABASE_URL` |

There is no project config file. Configure model routing with `--router '{"strategy":"cost-optimized"}'` or `RuntimeConfig.router`.

## Cost and safety

- `policy Budget : MaxSpend(0.50)` caps the cost of **each run**. There is no monthly or cross-run cap.
- Costs are estimates from each adapter's price table. The CLI prints them after each run.
- `Block(PromptInjection)`, `Redact(PII)`, `Redact(APIKey)`, and `Require(JSON)` are enforced in code. Run `halo validate --strict` in CI so that rules the runtime ignores (such as `Tone(...)`) fail the build.
- `context.trace` is a SHA-256 hash chain of every stage (`verifyTrace`).
- The CLI records runs to `.halo/telemetry.db` for Halo Studio. Pass `--no-telemetry` in production unless you want that file.
