# Halo

A **declarative language for AI workflows**. A `.halo` file declares agents, tools, policies, and schemas, then wires them into pipelines with pipe operators, with gates, branches, loops, parallel calls, and human approval built in.

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
bun install
bun link                                   # makes the `halo` command available

halo init my-project && cd my-project
halo test main.halo --arg topic="tide pools"   # offline: every call mocked
cp .env.example .env                           # add your API key
halo run main.halo --arg topic="tide pools"    # for real
```

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
| `\|* each(item in list, concurrency: 2) => Call()` | One call per item, in parallel |
| `\|<> loop(Agent, "cond", max: 3)` | While the condition holds, go back to the agent's stage (e.g. until tests pass) |
| `\|! yield(msg: "...")` | Ask a human |
| `~> listen(Slack.Reaction)` | Wait for an external event |

Directives: `@retry(3, 2s)`, `@timeout(5m)`, `@checkpoint`, `@shadow(Primary)` (runs this agent alongside `Primary` and records its output), `@correct(2)` (when a policy rejects an answer, tells the agent why and asks again).

### How a pipeline runs

- The flowing value is `context.current`. Each call's result is also stored at `context.data.<Callee>.<method>`, at `context.data.<method>`, and at any `as` binding. Pipeline arguments are bare names (`lang`) and `context.input.lang`.
- `{{name}}` and `{{context.data.x.y}}` in strings are filled in at runtime. `Env.*` is only readable in tool declarations, so secrets can't leak into prompts.
- An agent's prompt is built from the method name (as the task), its string arguments, the input, any `tool:` result, its named arguments, and context from what it `equips`: the closest entries of an equipped `VectorStore` and the recent conversation in an equipped `File` store. JSON answers are parsed, so gates can read `context.data.review.approved`.
- A pipeline whose return type is a declared `schema` must produce matching output, or the run fails with a `SchemaValidationError`.
- `|! yield` and `~> listen` ask your handler. With no handler, the run **pauses** (status `paused`) and `runtime.signal(runId, ...)` or `halo resume` continues it later.
- `context.meta` records cost, tokens, every call, policy violations, and shadow results. `context.trace` is a SHA-256 hash chain over every stage.

## 🔧 CLI

```bash
halo run <file.halo> [--pipeline Name] [--arg k=v ...] [--args '<json>'] [--json]
halo debug <file.halo> ...            # same, with every stage, prompt, and model call
halo test <file.halo> ...             # offline: --mock --auto-approve
halo resume <file.halo> <runId> --payload approve   # continue a paused run
halo validate <file.halo|dir ...> [--strict]
halo parse <file.halo>                # the AST as JSON
halo init [name]                      # a new project
```

`validate` catches undefined agents, tools, and policies; tools an agent uses without `equips`; unknown `System.*` methods; `context.data.x` values nothing writes; bad schema types and loop targets; and policy rules the runtime can't enforce.

In a terminal, the CLI asks you at `|! yield` and `~> listen`. Elsewhere (CI, a server), the run pauses and prints the `halo resume` command; paused runs are kept in `.halo/runs`. Every CLI run is recorded to `.halo/telemetry.db` for Halo Studio unless you pass `--no-telemetry`.

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
| `REST(url)` / `GET` | `Tool.method(...)` sends a GET to `url/method` (or `path:`), named args as query params |
| `POST(url)` | Named args as a JSON body (`sendInput: false` to send only those) |
| `VectorStore(namespace: "x")` | Local vector store in `.halo/vectors.sqlite`: `log`, `search`, `delete`, `count`. Lexical (hashed) embeddings, no network |
| `File(path, keep: 10)` | Text entries in a JSON file: `read`, `append`, `clear`. Equipped by an agent, it's that agent's chat history |
| `PostgreSQL(url)` / `SQL` | `query(sql: "...", params: [...])` via `Bun.SQL`; read-only unless `readOnly: false` |
| `Bash()` | `run(command: "...")` → `{stdout, stderr, exitCode}`. Values inserted with `{{...}}` are shell-quoted |
| `Browser()` | `fetch(url)` → the page's title and readable text |
| `Slack(token)` | `post(channel:, text:, buttons:)` via `chat.postMessage` |
| `Email(token, from:)` | `send(to:, subject:, body:)` via Resend |
| `GitHub(token)` | `create_issue`, `comment`, `add_labels`, `create_pr`, `get_issue`, `list_issues` (`repo: "owner/name"`) |
| `Linear(token)` | `create_issue(team:, title:, description:)` |
| `Figma(token)` | `get_file(file:)`, `get_node(file:, node:)` |

Tokens can be `Env.NAME` or the string `"Env.NAME"`. An agent calls an equipped tool with `Agent.task(tool: T, ...)` and then works on its result.

## 🛡 Policies

Checked on every prompt (input) and answer (output) of agents that `requires` them:

- `Block(...)`: Profanity, DestructiveOps, PromptInjection, PII, SSN, CreditCard (Luhn-checked), Email, Phone, APIKey, Markdown
- `Redact(...)`: PII, SSN, CreditCard, Email, Phone, APIKey, IPAddress
- `MaxWords(n)`, `MaxChars(n)`, `MaxTokens(n)`, `MaxSpend(usd)` (per run)
- `Require(JSON | XML | Citation)` (`Enforce(JSON)` also works), `MatchRegex("...")`
- `Validate("amount", "<=", "context.data.coverage.max_payout")`: compare an output field with a context value
- `LogViolation()`

`Tone`, `Anonymize`, other `Require(...)` checks, and other categories need a model to judge them and are **not enforced yet**; `validate` warns wherever they're used.

## 🧰 Tooling

- **Editors**: VS Code (`editors/vscode`, with a language server for errors, hover, and completion), Zed (`editors/zed`, tree-sitter), Sublime Text (`editors/sublime`).
- **Halo Studio** (`studio/`): browse recorded runs. `bun run studio` serves the API on `localhost:4000` and the UI.
- **Docs site**: `bun run docs:dev`.

## 📚 Examples

`examples/` is a learning path: 01–19 introduce one concept each, 20–25 are role-based workflows, 30–38 are larger systems (moderation routing, a multi-agent swarm, local automation, schema validation), 40–46 are industry examples, and 50 is the flagship. Every example validates, and `test/examples.test.ts` runs them.

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
