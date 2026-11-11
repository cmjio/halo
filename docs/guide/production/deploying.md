# Deploying

The runtime needs **Bun**. It uses `Bun.file`, `Bun.CryptoHasher`, `bun:sqlite`, `Bun.SQL`, and `Bun.spawn`. Node-based hosts can't run it, including Next.js on Node, AWS Lambda's Node runtimes, and Cloudflare Workers. Any host that runs a Bun process works: a VM, a container (`oven/bun`), or a PaaS that runs Docker images.

The simplest way to run pipelines as a service is [`halo serve`](./serving.md): an HTTP API, webhooks, schedules, approval links, and Studio in one process. For a worked example with a `Dockerfile`, a Fly.io config and a volume for paused runs, start from a [blueprint](./blueprints.md).

## Use what you already have

Each of these is one line or one step in a setup you already run. They ship from Halo 0.5.0.

| You already use | Add Halo with |
|---|---|
| Docker, or any host that runs images | `docker run -p 8080:8080 -v "$PWD:/app" -e HALO_SERVE_TOKEN -e ANTHROPIC_API_KEY ghcr.io/cmjio/halo` |
| Render, Railway, Heroku, Cloud Run, Fly | A Dockerfile of two lines (below). `halo serve` reads `PORT` and the platform's public address |
| GitHub Actions | `uses: cmjio/halo@v0.5.0`, then `halo` in any later step |
| npm, pnpm, Yarn or Bun | `npm install --save-dev @halolang/halo`, then `npx halo ...` |
| cron, a shell script, a CI job | `halo run flow.halo --json` (install with `curl -fsSL https://halolang.com/install.sh \| sh`) |
| Another service, in any language | `POST /api/pipelines/<name>/runs` on `halo serve`, or a webhook |
| Claude, Cursor, other MCP clients | `halo mcp`, or `/mcp` on `halo serve` |

### The container image

`ghcr.io/cmjio/halo` is Debian slim with the `halo` binary, `git` and `pdftotext`, for `linux/amd64` and `linux/arm64`. It runs `halo serve` in `/app` as user `halo` (uid 1000), with `PORT=8080`. Tags: the version (`0.5.0`), the minor version (`0.5`), and `latest`.

```bash
# Serve the pipelines in this folder
docker run -p 8080:8080 -v "$PWD:/app" \
  -e HALO_SERVE_TOKEN=change-me -e ANTHROPIC_API_KEY ghcr.io/cmjio/halo

# Any other command
docker run --rm -v "$PWD:/app" ghcr.io/cmjio/halo test main.halo --arg topic=tides
```

To deploy to a host that builds from a Dockerfile:

```dockerfile
FROM ghcr.io/cmjio/halo:0.5
COPY --chown=halo . .
```

- It refuses to serve without `HALO_SERVE_TOKEN`, because it listens on every interface inside the container.
- Paused runs, schedule state, telemetry and stores live in `/app/.halo`. Mount a volume there so runs waiting for approval survive a restart, and so scheduled runs aren't repeated or forgotten.
- The container's clock is UTC. Set `timezone` in `halo.json` for schedules in local time (see [Schedules](./serving.md#schedules)).
- On Linux, a bind-mounted folder must be writable by uid 1000. Otherwise add `--user "$(id -u)"`.
- `halo upgrade` doesn't replace the binary in the image. Use a newer tag.

### GitHub Actions

```yaml
- uses: cmjio/halo@v0.5.0
  with:
    command: validate --strict pipelines/
- run: halo test pipelines/support.halo -p HandleEmail --body samples/email.json --mocks samples/mocks.json
```

The action installs the version of the tag you use (or `version:`), caches it, and puts `halo` on `PATH` for later steps, on Linux, macOS and Windows runners. `command` is optional. Its output `version` is the installed version.

### npm

```bash
npx @halolang/halo init my-project       # without installing
npm install --save-dev @halolang/halo    # then npx halo, or halo in package.json scripts
```

The package is a small launcher. npm installs the standalone binary for your machine as an optional dependency (`@halolang/halo-<platform>`), so it needs no Bun. It covers macOS, Linux (glibc and musl, x64 and arm64) and Windows x64. If your install omits optional dependencies, or your x64 CPU lacks AVX2, use the install script instead. Update with your package manager; `halo upgrade` says so.

The npm package is the CLI only. To use Halo as a library in a Bun app, see [Option 2](#option-2-embed-the-runtime-in-a-bun-server).

## Running pipelines yourself

The options below run pipelines from your own process instead of `halo serve`.

## Option 1: run the CLI

For scheduled or one-off jobs, run the CLI directly:

```bash
bun run index.ts run workflows/triage.halo --arg repo=acme/api --json --no-telemetry
```

- Set the provider keys (`ANTHROPIC_API_KEY`, …) in the environment.
- Without a terminal, a run that reaches `|! yield` or `~> listen` **pauses**. It is saved to `.halo/runs/<runId>.json` (with its trace and call history in `<runId>.log.jsonl`, which each later pause only appends to) and prints the `halo resume` command. Use `--auto-approve` for unattended jobs that should never wait.
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

Multi-agent pipelines can take minutes. If your HTTP host has a request time limit, accept the request, run the pipeline in the background (or in a queue worker), and report `result.status` and `output` when it finishes. `@checkpoint` writes a snapshot after each stage to `.halo/checkpoints/` (appending to its log, so a long run stays cheap to checkpoint), so a crashed run can continue with `runtime.resume(path)` or `halo run --checkpoint <path>`.

## Configuration

| Variable | Used for |
|---|---|
| `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`/`GOOGLE_API_KEY`, `OPENROUTER_API_KEY`, `TOGETHER_API_KEY`, `REPLICATE_API_TOKEN` | Model providers |
| `HALO_API_KEY` | Fallback for any provider without its own key |
| `OLLAMA_HOST` | Ollama server (default `http://localhost:11434`) |
| Whatever your tools read with `Env.X` | e.g. `GITHUB_TOKEN`, `SLACK_BOT_TOKEN`, `RESEND_API_KEY`, `DATABASE_URL` |

There is no project config file. Configure the runtime in code (`RuntimeConfig`) or with CLI flags (`--router`, `--api-key`).

These files are written relative to the working directory unless you configure other paths:

| Path | Written by | Configure with |
|---|---|---|
| `.halo/runs/` | paused runs (CLI) | `FileRunStore(dir)` |
| `.halo/checkpoints/` | `@checkpoint` (snapshots and step histories) | `checkpointDir` |
| `.halo/vectors.sqlite` | `VectorStore` | `vectorPath` |
| `.halo/threads.sqlite` | `@thread` state | `threadPath` |
| `.halo/telemetry.db` | the CLI (Studio) | `--no-telemetry` |

`File` stores write wherever they are declared.

## Costs and safety

- `MaxSpend(usd)` caps the cost of **each run**. There is no monthly or cross-run budget. Use `getCostTracker()` or your own accounting for that.
- Costs are estimates from built-in price tables.
- Run `halo validate --strict` in CI so that policies the runtime can't enforce fail the build instead of being silently ignored.
