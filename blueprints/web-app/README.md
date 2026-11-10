# Web app: Halo behind your own frontend and backend

A small working app that shows where Halo fits when you build a product with a browser
frontend: **Reply desk**. Someone on a shop's support team pastes a customer message. Halo
looks up the order, reads the shop's written rules, drafts a reply, checks the draft against
those rules, and waits while the person approves, edits, or rejects it in the page.

```bash
bun blueprints/web-app/server.ts                     # offline: canned model answers, no key needed
ANTHROPIC_API_KEY=... bun blueprints/web-app/server.ts   # real models
bun test test/web-app.test.ts
```

Open http://localhost:3000 and ask about order `A1001` (in transit) or `A1002` (delivered).
Offline, only the model answers are canned. The handbook files and the orders API are read
for real either way.

## Where Halo goes: the backend, always

```
 browser (React)          your backend (Bun)                         Halo runtime (same process)
 ───────────────          ───────────────────────────────────────    ────────────────────────────
 POST /api/drafts   ───▶  session → user_id, limits, choose runId ─▶  runtime.run("DraftReply", …)
 GET  …/events (SSE) ◀──  filter runtime events per user         ◀──  onEvent(stage, violation, …)
 POST …/answer      ───▶  check owner                            ─▶  runtime.signal(runId, "yield", …)
                          /internal/orders  ◀──── REST tool ──────── Orders.get(id: …)
                          handbook/*.md      ◀── Documents tool ───── Handbook.extract(…)
```

The frontend never talks to a model, or to Halo. That isn't a style choice:

- **The runtime is server-only.** It uses `bun:sqlite`, `Bun.file` and `Bun.spawn`, so it can't
  run in a browser.
- **It holds your keys.** Model keys, and every tool's token (`Env.*`), live in the runtime's
  environment. Anything in a browser is public.
- **Policies are only guardrails where the user can't skip them.** `MaxSpend`,
  `Block(PromptInjection)` and the approval step mean nothing if the client can run the
  pipeline without them.

## What gets in the way, and what this example does about it

| Problem | What happens | What `app.ts` does |
|---|---|---|
| **You can't import the library from npm.** `@halolang/halo` ships only the CLI binary. | A Node or Bun backend has no `HaloRuntime` to import. | `bun add github:cmjio/halo` (see `halo.ts`), on a Bun backend. A Node backend has to run `halo serve` next to it and call its HTTP API. |
| **`halo serve` isn't for browsers.** | It refuses requests with a foreign `Origin`, and its API takes one shared token. Give that to a browser and every user can start any run and answer any approval. | Don't expose it. Embed the runtime (this example), or keep `halo serve` private and put your backend in front of it. |
| **Halo has no users.** | `@thread(user_id)` keys memory by an argument. If that comes from the request body, anyone can read or write anyone's thread. | `user_id` always comes from the session. The body's `user_id` is ignored (there is a test for it). |
| **Runs belong to nobody.** | `signal(runId, …)` resumes any paused run. | Every run records its owner. Another user gets `404` for its events and its answer. After a restart, the owner is read from the paused run's saved `user_id`. |
| **Events say too much.** | `llm` events carry the system prompt, the full prompt, and the raw answer. Error messages can quote them. | Only stage names, policy blocks, the pause, and the result go to the browser. Errors send only their `code`. |
| **The browser can't wait on `run()`.** | A run takes seconds, then pauses for minutes or days. | The server picks the `runId` (`run(…, { runId })`), returns `202` at once, and streams events over Server-Sent Events. It replays past events to late subscribers and pings every 15s so proxies don't drop the stream. |
| **Answering twice.** | A double click on Approve. | The run is marked busy before `signal()`; a second answer gets `409`. |
| **Cost per user.** | `MaxSpend` caps a run, not a user. | One run at a time per user, and a per-user spend cap from the `run` events' `cost`. |
| **Paths are relative to the process.** | `Documents("handbook")` resolves against the working directory, so it breaks when the server starts from another folder. | Absolute paths through `Env.HANDBOOK_DIR`. |
| **Empty placeholders stay in the prompt.** | A new user has no `context.thread.replies`, and `{{context.thread.replies}}` reaches the model as written. | Not handled here. Halo leaves unresolved `{{…}}` as written by design (`src/runtime/values.ts`). |

## How the agents know what's true

A model only knows what's in its prompt. "Is two weeks too long?" depends on facts it can't
know: the shipping policy, when this order shipped, today's date. So the pipeline gives it
those facts, and checks what it writes.

| What | Where it comes from | In `reply.halo` |
|---|---|---|
| **Rules people write**: policy, tone, what can be promised | Files: Markdown, PDF, Word, HTML | `tool Handbook : Documents(root: Env.HANDBOOK_DIR)`, then `Handbook.extract(path: "shipping-policy.md")`. The text goes into the prompt. |
| **Facts that change**: the order, its status | Your own API | `tool Orders : REST(Env.ORDERS_API_URL, apiKey: Env.ORDERS_API_TOKEN, allowNotFound: true)`. The URL and token never reach a prompt. An unknown order comes back as `null`. |
| **Exact answers**: business days since it shipped | Code, not the model | `orders-api.ts` computes `business_days_in_transit`; the model only reads the number. |
| **Instructions on every call** | The agent's `system` prompt | "Use only the facts you are given … never guess dates". |
| **This user's style** | `@thread(user_id)` | Approved replies are kept (`Thread.append`) and shown to the writer next time. |

Then, before a person sees the draft:

1. **Policies** run on every answer: `Block(PromptInjection)`, `Redact(APIKey)`, `MaxWords(220)`,
   `Require(JSON)` for the triager and checker, and `MaxSpend` per run.
2. **A second agent** (`Checker.review`) compares the draft with the same policy and voice guide
   and lists anything that breaks a rule. The page shows the list next to the draft.
3. **A person approves** (`|! yield`). Nothing is kept until they do, and they can edit first.

And over time, outside the request path: `@expect(...)` for hard checks in `halo test`,
recorded runs (`halo replay`, `halo compare`) to catch a prompt change that makes things
worse, and `halo evolve` to propose better prompts from real traffic.

### More ways to give agents context

- **A few short files** (this example): read them and put them in the prompt. Simple, and the
  model sees every rule.
- **Many documents, or long ones**: index them in a `VectorStore` and search per message, which
  is retrieval-augmented generation. `blueprints/support-inbox` does exactly this with help
  articles: `IndexKnowledge` extracts and indexes them, and each email searches them.
- **A database**: `SQLite(…)` or `PostgreSQL(…)`, read-only by default.
- **Any HTTP API**: `REST` / `POST`, or a tool package (`halo add stripe`).
- **An MCP server**: `tool Shop : MCP(…)` gives an agent that server's tools.
- **Let the agent choose**: `Writer.draft(tools: [Orders, Handbook])` lets the model decide
  what to look up, fenced by the tools' policies. This example fetches everything up front
  instead, because the facts it needs are always the same three, and fixed steps are cheaper,
  faster, and easier to test.
- **Skills**: a `SKILL.md` of instructions loaded into an agent's prompt (`skills: "…"`).

## When not to build this

If nobody outside your team needs a custom page, `halo serve` already gives you an API,
webhooks, schedules, Slack approvals, and Studio. Build a backend like this one when the
pipeline is a feature of your own product, used by your own users.

## Files

| File | What it is |
|---|---|
| `pipelines/reply.halo` | The pipeline: triage, look up, draft, check, approve, remember |
| `handbook/` | The shop's rules, as files a person edits |
| `app.ts` | The backend: sessions, run ownership, SSE, approvals, limits |
| `orders-api.ts` | Stands in for your order system, with the date arithmetic |
| `server.ts` | `Bun.serve`: the page, the API, and the orders endpoint |
| `web/` | The React page |
| `samples/` | Sample orders, and the canned model answers for offline use |
| `halo.ts` | Where the library comes from |
| `../../test/web-app.test.ts` | Tests: the whole flow, isolation between users, grounding, and bad requests |
