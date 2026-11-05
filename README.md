# Halo

A **declarative language for AI workflows**. A `.halo` file declares agents, tools, policies, and schemas, then wires them into pipelines with pipe operators, with gates, branches, loops, parallel calls, and human approval built in. Agents can also choose their own tool calls, fenced in by tool policies.

```halo
policy Safe   : Block(PromptInjection) & Redact(APIKey)
policy Budget : MaxSpend(0.25)

agent Writer [anthropic/claude-haiku-4-5, temp: 0.4]
  system "You write short, friendly explanations."
  requires Safe, Budget

pipeline Explain(topic: String) -> Result:
  topic
    |> Writer.explain("Explain {{topic}} in three sentences.") as explanation
    |! yield(msg: "Publish this?", [context.data.explanation]) as review
    |? (context.data.review.approved == true)
    |> System.Print()
```

## 🚀 Quick Start

```bash
curl -fsSL https://halolang.com/install.sh | sh     # macOS, Linux
# Windows (PowerShell): irm https://halolang.com/install.ps1 | iex

halo init my-project && cd my-project
halo test main.halo --arg topic="tide pools"   # offline: every call mocked
cp .env.example .env                           # add your API key
halo run main.halo --arg topic="tide pools"    # for real
```

The installer puts a standalone `halo` binary (Bun is built in) in `~/.halo/bin` and checks it against the release's checksums; `halo upgrade` updates it. To work on Halo itself: `git clone https://github.com/cmjio/halo && cd halo && bun install && bun link`. Docs and playground: [halolang.com](https://halolang.com).

Inside this repo, `bun run index.ts ...` works the same as `halo ...`.

### ⭐ Try the flagship

[`examples/50-github-triage.halo`](examples/50-github-triage.halo) triages a public repo's open issues for real:
- fetches issues from GitHub's public API (no token needed)
- trims each payload with `System.Pick`
- classifies the issues and searches past reports in parallel
- stops if the model is unsure
- writes a report and asks you before saving it, so the next run flags repeats

Answer `label` instead of `approve` and it also adds each issue's suggested labels with `|* each` (set `GITHUB_TOKEN`). It needs only an Anthropic key; a run costs about $0.02.

```bash
ANTHROPIC_API_KEY=... halo debug examples/50-github-triage.halo --arg repo=oven-sh/bun --arg limit=8
```

### 📦 Start from a blueprint

A blueprint is a complete app you can deploy: pipelines, `halo.json`, sample data, offline tests, a `Dockerfile` and `fly.toml`. [`support-inbox`](blueprints/support-inbox) answers customer email: a webhook receives each email, Halo drafts a reply from your help articles, and a person approves or edits it before Resend sends it.

```bash
halo init my-inbox --template support-inbox && cd my-inbox
halo test pipelines/support.halo -p HandleEmail --body samples/email.json --mocks samples/mocks.json
```

## 🧠 The language

| Declaration | Example |
|---|---|
| `agent` | `agent Analyst [openai/gpt-4o, temp: 0.1]` with optional `system "..."`, `equips Tool, Store`, `requires Policy` |
| `tool` / `store` | `tool GitHub : REST("api.github.com")`, `store KB : VectorStore(namespace: "faq")` |
| `policy` | `policy Safe : Block(PromptInjection) & Redact(Email) & MaxSpend(1.00)` |
| `schema` | `schema Profile { name: String, age: Number, tags: Array<String> }` |
| `pipeline` | `pipeline Name(arg: Type) -> Type:` followed by stages |

| Operator | Meaning |
|---|---|
| `\|> Call(...) as name` | Run a call on the current value; `as` also stores it at `context.data.name` |
| `\|? (cond)` | Gate: stop the run (status `halted`) unless the condition holds. `&&`, `\|\|`, `!`, `==`, `>=`, `null`, ... |
| `\|? { (cond) => A(), else => B() }` | Branch: run the first matching arm |
| `\|* { A(), B() }` | Fan out: run calls in parallel; the result is the list |
| `\|* each(item in list, concurrency: 2, limit: 5) => Call()` | One call per item (the first 5), in parallel |
| `\|<> loop(Agent, "cond", max: 3)` | While the condition holds, go back to the agent's stage (e.g. until tests pass) |
| `\|! yield(msg: "...")` | Ask a human |
| `~> listen(Slack.Reaction)` | Wait for an external event |

Directives: `@retry(3, 2s)`, `@timeout(5m)`, `@checkpoint` (snapshot every step, for `halo history` and `halo rewind`), `@thread(user_id)` (keep state between runs, per user), `@shadow(Primary)` (runs this agent alongside `Primary` and records its output), `@correct(2)` (when a policy rejects an answer, tells the agent why and asks again).

### Built in: tools, agents, and skills

- **Tools** that need no account: `Workspace`, `KV`, `Code`, `Documents`, `Clock` (dates and timezones), `Calc` (exact arithmetic), `Data` (filter, group, aggregate, join, diff, CSV), and `Git` (read a repo; commit with `write: true`). Plus `WebSearch` (Brave, Tavily, Serper or Exa), `Remote` (a server over SSH, or a cloud sandbox from E2B or Daytona that lasts one run), `Browser`, `Chrome`, `REST`, `MCP` and service clients. `halo tools` lists them all.
- **Agent presets**: `agent R [anthropic/claude-sonnet-4-5, preset: CodeReviewer]` gives an agent a ready-made prompt, settings and skills. Twelve ship: `Summarizer`, `Classifier`, `Extractor`, `Judge`, `Researcher`, `Writer`, `Editor`, `Planner`, `Coder`, `CodeReviewer`, `Translator`, `Triager` (`halo agents`). The JSON ones say their fields, so gates can read `context.data.verdict.pass`. `sandbox: "e2b"` gives an agent its own cloud sandbox for the run, to run what it writes.
- **Skills**: instructions for one kind of task, in the Agent Skills `SKILL.md` format. `skills: "release-notes"` loads one into an agent's prompt; `tool Kit : Skills("./skills")` lets an agent pick and load its own. Seven ship (`code-review`, `write-tests`, `web-research`, `data-extraction`, `release-notes`, `incident-postmortem`, `bug-triage`); yours in `./skills` come first (`halo skills`).

See [`examples/78-builtin-kit.halo`](examples/78-builtin-kit.halo), [Agent Presets](docs/stdlib/agent-presets.md), [Skills](docs/stdlib/skills.md), [Utility Tools](docs/stdlib/utility-tools.md) and [Remote Computers](docs/stdlib/remote.md).

### How a pipeline runs

- The flowing value is `context.current`. Each call's result is also stored at `context.data.<Callee>.<method>`, at `context.data.<method>`, and at any `as` binding. Pipeline arguments are bare names (`lang`) and `context.input.lang`.
- Paths reach into lists: `issues.0.title` is the first title, `issues.length` the count, and `issues.title` every title. `System.Value(x)` makes `x` the flowing value.
- `{{name}}` and `{{context.data.x.y}}` in strings are filled in at runtime. `Env.*` is only readable in tool declarations, so secrets can't leak into prompts.
- `Agent.task(tools: [Files, Shell])` lets the agent choose its own calls (native tool calling) until it answers, up to `max_steps` (10). Each call is checked first against its policies' tool rules; results pass through its input policies; errors go back to the model. See [Agents with Tools](docs/guide/agents-with-tools.md).
- An agent's prompt is built from the method name (as the task), its string arguments, the input, any `tool:` result, its named arguments, and context from what it `equips`: the closest entries of an equipped `VectorStore` and the recent conversation in an equipped `File` store. JSON answers are parsed, so gates can read `context.data.review.approved`.
- A pipeline whose return type is a declared `schema` must produce matching output, or the run fails with a `SchemaValidationError`.
- `|! yield` and `~> listen` ask your handler. With no handler, the run **pauses** (status `paused`) and `runtime.signal(runId, ...)` or `halo resume` continues it later.
- `context.meta` records cost, tokens, every call, policy violations, and shadow results. `context.trace` is a SHA-256 hash chain over every stage.
- In a `@thread(user_id)` pipeline, `context.thread` is state kept between runs for that user. `Thread.set`, `Thread.append` and `Thread.clear` change it, and the changes are saved when the run ends. See [Thread State](docs/guide/thread-state.md).

## 🔧 CLI

```bash
halo run <file.halo> [--pipeline Name] [--arg k=v ...] [--args '<json>'] [--json]
halo debug <file.halo> ...            # same, with every stage, prompt, and model call
halo test <file.halo> ...             # offline: --mock --auto-approve (--mocks answers.json, --body webhook.json)
halo resume <file.halo> <runId> --payload approve   # continue a paused run
halo validate <file.halo|dir ...> [--strict]
halo parse <file.halo>                # the AST as JSON
halo init [name] [--template support-inbox]   # a new project, or a deployable blueprint
halo serve [files|dirs] [--port 8080] # run pipelines as a service (below)
halo plan <file.halo>                 # what a run could do: model calls, worst-case cost, tool effects, approvals
halo replay <file.halo> <runId>       # rerun a recorded run with the answers it got (--live-models, --live-tools)
halo history <runId> [--step N]       # every step of a @checkpoint run, or its state after step N
halo rewind <file.halo> <runId> --step N   # continue a @checkpoint run from a step, as a new run
halo threads | thread <name> <key>    # list threads, show one (--reset --yes deletes its state)
halo mcp [files|dirs]                 # serve pipelines as MCP tools over stdio
halo agents | skills [name]           # the built-in agent presets; skills (yours and built-in)
halo search | add | remove | install | tools | pack | publish   # tool packages
```

`validate` catches undefined agents, tools, and policies; tools an agent uses without `equips`; unknown `System.*` methods; `context.data.x` values nothing writes; bad schema types and loop targets; and policy rules the runtime can't enforce.

In a terminal, the CLI asks you at `|! yield` and `~> listen`. Elsewhere (CI, a server), the run pauses and prints the `halo resume` command; paused runs are kept in `.halo/runs`. Every CLI run is recorded to `.halo/telemetry.db` for Halo Studio unless you pass `--no-telemetry`, and to `.halo/recordings` for `halo replay` (unredacted; the newest 50 are kept) unless you pass `--no-record`. See [Plan and Replay](docs/guide/plan-and-replay.md).

## 🌐 Serving pipelines

`halo serve` turns a folder of pipelines into a service, in one Bun process:

- **Triggers**: an HTTP API (`POST /api/pipelines/<name>/runs`), webhooks (`POST /hooks/<path>`, with a shared secret or GitHub signatures), cron schedules, and watches (a URL, file, or command's output changed)
- **Approvals**: when a run pauses at `|! yield` or for a tool call, it gets a signed approve/reject link, logged and optionally posted to Slack, with Approve/Reject buttons when you give it your Slack app's signing secret. Paused runs survive restarts
- **MCP** at `/mcp`: every pipeline as a tool for Claude, Cursor, and other MCP clients, behind the API token
- **Halo Studio** at `/`: start runs, watch them, and approve paused ones

```json
// halo.json (optional)
{
  "schedules": [{ "pipeline": "TriageIssues", "cron": "0 9 * * 1-5", "args": { "repo": "acme/api", "limit": 10 } }],
  "webhooks": [{ "path": "github", "pipeline": "TriageIssues", "secret": "Env.GITHUB_WEBHOOK_SECRET" }],
  "notify": { "slack": "Env.SLACK_WEBHOOK_URL" },
  "publicUrl": "https://halo.example.com"
}
```

It listens on localhost unless you set `HALO_SERVE_TOKEN`. See [Serving pipelines](docs/guide/production/serving.md).

## 🧩 Library

```ts
import { compile, HaloRuntime, FileRunStore } from "halo";

const { ast, diagnostics, ok } = compile(await Bun.file("flow.halo").text());
const rt = new HaloRuntime({
  runStore: new FileRunStore(".halo/runs"),           // paused runs survive restarts
  onEvent: (e) => console.debug(e),                   // stages, model calls, tools, ...
}).load(ast);

const run = await rt.run("Explain", { topic: "tides" });
if (run.status === "paused") {
  // later, e.g. from a Slack button handler:
  await rt.signal(run.runId, "yield", { approved: true });
}

for await (const event of rt.stream("Explain", { topic: "tides" })) { /* live events */ }
```

Register an `onInterrupt` / `onListen` handler to answer humans and events in-process instead of pausing. Extension points: `registerAdapter()` (any OpenAI-compatible API via `OpenAICompatibleAdapter`), `registerToolProvider()`, `registerSystem()`, and `mockAll()` for tests. Errors are `HaloError`s with a `code` (`PolicyViolation`, `SchemaValidationError`, `TimeoutError`, `LoopLimitError`, ...).

## ✅ Model providers

| Provider | Model prefix | API key |
|---|---|---|
| OpenAI | `openai/*`, `oai/*`, `gpt-*`, `o1*` | `OPENAI_API_KEY` |
| Anthropic | `anthropic/*`, `claude/*`, `claude-*` | `ANTHROPIC_API_KEY` |
| Google Gemini | `google/*`, `gemini/*`, `gemini-*` | `GEMINI_API_KEY` or `GOOGLE_API_KEY` |
| OpenRouter | `openrouter/*`, `or/*` | `OPENROUTER_API_KEY` |
| Together AI | `together/*`, `tog/*` | `TOGETHER_API_KEY` |
| Replicate | `replicate/*`, `rep/*` | `REPLICATE_API_TOKEN` |
| Ollama (local) | `ollama/*`, `local/*` | none (`OLLAMA_HOST` to change the host) |

`HALO_API_KEY` (or `--api-key`) is used for any provider without its own key.

## 🛠 Tools

| Provider | What it does |
|---|---|
| `REST(url)` / `GET` | `Tool.method(...)` sends a GET to `url/method` (or `path:`; `Tool.get()` calls `url` itself), named args as query params |
| `POST(url)` | Named args as a JSON body. Only what you pass is sent |
| `VectorStore(namespace: "x")` | Local vector store in `.halo/vectors.sqlite`: `log`, `search` (filter with `tags:` and `exclude_tags:`, `order: "recent"` for newest first), `delete`, `count`. Lexical (hashed) embeddings, no network |
| `File(path, keep: 10)` | Text entries in a JSON file: `read`, `append`, `clear`. Equipped by an agent, it's that agent's chat history |
| `PostgreSQL(url)` / `SQL` | `query(sql: "...", params: [...])` via `Bun.SQL`; read-only unless `readOnly: false` |
| `Bash()` | `run(command: "...")` → `{stdout, stderr, exitCode}`. Values inserted with `{{...}}` are shell-quoted |
| `Browser()` | `fetch(url)` → the page's title and readable text |
| `Slack(token)` | `post(channel:, text:, buttons:)` via `chat.postMessage` |
| `Email(token, from:)` | `send(to:, subject:, body:)` via Resend |
| `GitHub(token)` | `create_issue`, `comment`, `add_labels`, `create_pr`, `get_issue`, `list_issues` (`repo: "owner/name"`) |
| `Linear(token)` | `create_issue(team:, title:, description:)` |
| `Figma(token)` | `get_file(file:)`, `get_node(file:, node:)` |
| `Chrome(allow: [...])` | A headless Chrome tab: `open`, `click`, `fill`, `press`, `text`, `screenshot`, ... limited to the hosts you allow |
| `Workspace(dir, write: true)` | `read`, `write`, `edit`, `list`, `glob`, `search`, `delete` inside one folder (read-only by default) |
| `KV(path)` | `get`, `set` (with `ttl:`), `delete`, `list`, `incr` in a local SQLite file |
| `Code("python")` | `run(code:, input:)` in its own process, without your environment (not a sandbox) |
| `Documents()` | `extract(path)`: text from Markdown, HTML, CSV, JSON, Word, and PDF |
| `MCP(command)` / `MCP(url: ...)` | Every tool of an MCP server, over stdio or Streamable HTTP |

Tokens can be `Env.NAME` or the string `"Env.NAME"`. An agent calls an equipped tool first with `Agent.task(tool: T, ...)`, or chooses its own calls with `tools: [T]`. `VectorStore(embeddings: "openai/text-embedding-3-small")` searches by meaning, and `url:` keeps it in Postgres with pgvector.

**Tool packages** add providers from a registry: `halo add stripe` (also `jira`, `notion`, `sentry`, `cloudflare`, `github-mcp`, `world-time`). A package is a REST API described as data, an MCP server, or code; anything that runs code needs `--trust`, and `halo.lock` pins each one's checksum. See [Tool Packages](docs/guide/tool-packages.md).

## 🛡 Policies

Checked on every prompt (input) and answer (output) of agents that `requires` them:

- `Block(...)`: Profanity, DestructiveOps, PromptInjection, PII, SSN, CreditCard (Luhn-checked), Email, Phone, APIKey, Markdown
- `Redact(...)`: PII, SSN, CreditCard, Email, Phone, APIKey, IPAddress
- `MaxWords(n)`, `MaxChars(n)`, `MaxTokens(n)`, `MaxSpend(usd)` (per run)
- `Require(JSON | XML | Citation)` (`Enforce(JSON)` also works), `MatchRegex("...")`
- `Validate("amount", "<=", "context.data.coverage.max_payout")`: compare an output field with a context value
- `LogViolation()`
- Tool rules, for tool calls an agent chooses: `AllowTools("Files.*")`, `DenyTools("Files.delete")`, `AllowEffects(read)`, `ApproveTools(...)` / `ApproveEffects(write, external)` (a person approves first), `DenyArgs("Shell.run", "command", "^(?!bun test)")`

`Tone`, `Anonymize`, other `Require(...)` checks, and other categories need a model to judge them and are **not enforced yet**; `validate` warns wherever they're used.

## 🧰 Tooling

- **Editors**: VS Code (`editors/vscode`, with a language server for errors, hover, and completion), Zed (`editors/zed`, tree-sitter), Sublime Text (`editors/sublime`).
- **Halo Studio** (`studio/`): browse runs, start them, and approve paused ones. It's served by `halo serve` at `/` (`bun run studio` does the same).
- **Docs site**: `bun run docs:dev`.

## 📚 Examples

`examples/` is a learning path: 01–19 introduce one concept each, 20–25 are role-based workflows, 30–38 are larger systems (moderation routing, a multi-agent swarm, local automation, schema validation), 40–46 are industry examples, 50 is the flagship, 60–66 are everyday domains, and 70–72 run for real on free public data:

| # | Example | What it shows |
|---|---|---|
| 60 | HR applicant screening | Contact details redacted before scoring, `\|* each`, a recruiter approves the shortlist |
| 61 | School essay feedback | Draft feedback per essay, `@correct` fixes drafts that break policy, the teacher approves before release |
| 62 | Shopping restock | The budget enforced in code with `Validate`, approval before ordering |
| 63 | Weekly team report | GitHub issues trimmed with `System.Pick`, reviewed, then posted to Slack |
| 64 | Sports scouting | Two analysts in parallel, output checked against a `schema` |
| 65 | Esports match review | OpenDota's free API (runs for real); reuses a saved review; compares a player only with their own past matches |
| 66 | Meal planner | Allergens checked by `grep`, `\|<> loop` replans until the plan is clean |
| 70 | **Pipeline author** | Describe a workflow in English; an agent writes the `.halo` file, the real validator checks it, and `\|<> loop` sends errors back until it passes |
| 71 | Dependency security watch | Installed versions checked against OSV.dev (free), sorted by severity, alerts only on new advisories |
| 72 | FDA recall monitor | openFDA (free) recalls explained in plain language; publishing waits for approval |
| 73 | **Code writer** | An agent writes code, the real tests run, and failing output goes back until they pass (run it in a sandbox) |
| 74 | **Software team** | An architect plans modules, coders build them in parallel, an integrator wires them up, and a fixer patches until the acceptance tests pass. Built the spreadsheet engine in `examples/projects/spreadsheet` (1,400 lines, 29/29 tests, 16/16 hidden) in 4 minutes for $0.68 |

[`examples/casebook/`](examples/casebook/) holds 100 more: agent designs from real work (support, finance, health, security, operations, and more), each a system prompt, its tools, and what the agent may do freely, must confirm, or must never do. The rules that have to hold are enforced by policies, gates and approvals rather than by the prompt. Their servers are fictional, so read them with `halo plan`.

Every example validates, and `test/examples.test.ts` runs them.

## 🏗 Layout

```
grammars/Halo.g4        the grammar (source of truth); `bun run generate` rebuilds the parser (needs Java)
src/parser/             generated parser, AST walker, validator
src/runtime/            runtime, adapters, router, policies, schemas, tools, telemetry
src/cli.ts, src/lsp/    CLI and language server
editors/, studio/, docs/, examples/, test/
```

```bash
bun test              # parser, validator, runtime, adapters over HTTP, tools, CLI, LSP, every example
bunx tsc --noEmit
```

## 📄 License

MIT
