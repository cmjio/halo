# Blueprints

A blueprint is a complete Halo app you can deploy, not a snippet: the pipelines, the service configuration, sample data, offline tests, and the files to deploy it. `halo init` writes one out:

```bash
halo init my-inbox --template support-inbox
cd my-inbox
halo test pipelines/support.halo -p IndexKnowledge --mocks samples/mocks.json
halo test pipelines/support.halo -p HandleEmail --body samples/email.json --mocks samples/mocks.json
```

| Blueprint | Trigger | Integrations | Runs on its own? |
|---|---|---|---|
| [`support-inbox`](#support-inbox) | inbound email webhook | Resend, Slack | No: a person approves every reply |
| [`github-triage`](#github-triage) | GitHub webhook, weekly schedule | GitHub, Slack | Labels on its own; comments wait for a person |
| [`incident-responder`](#incident-responder) | Sentry webhook | Sentry, GitHub, Linear, Slack | Yes: it only writes to your own tools |
| [`customer-chat`](#customer-chat) | your backend, over the API | Postgres, Slack | Yes, and it hands off what it can't do |
| [`web-monitor`](#web-monitor) | schedules | the web, Resend | Yes |
| [`cloudflare-email`](#cloudflare-email-agent) | email to your domain | Cloudflare Workers, Durable Objects, Containers, Email Routing and Sending | No: a person sends every reply |

Each blueprint follows the same layout, so once you've read one you know where everything is in the next:

| File | What it holds |
|---|---|
| `pipelines/*.halo` | The workflow |
| `halo.json` | How [`halo serve`](./serving.md) runs it: webhooks, schedules, watches, Slack notices |
| `samples/` | Example inputs (webhook bodies) and `mocks.json`, canned answers for [offline tests](../../dx/testing-and-mocks.md#canned-answers-and-webhook-bodies) |
| `.env.example` | Every key it needs, and where to get each |
| `Dockerfile`, `fly.toml` | Deployment. The image installs the `halo` version that created the project, and validates the pipelines while it builds |
| `README.md` | Trying it offline, running it for real, connecting the outside service, deploying, and making it yours |

`cloudflare-email` deploys to Cloudflare instead, so it has a `wrangler.jsonc` and a Worker (`worker/`) in place of `fly.toml`.

## Support inbox

`--template support-inbox`. Customer email arrives at a webhook (`POST /hooks/email`, in Postmark's inbound JSON shape). Halo skips repeats and spam, triages the email, searches your help articles and past replies, drafts a reply from them, and waits for a person, who approves it, writes their own text, or rejects it, from the approval link, Slack or Studio. Then it sends the reply with Resend and remembers it.

It shows:

- **A real trigger:** a webhook with a shared secret, and deduplication with `KV`, since email providers retry.
- **Retrieval:** a `VectorStore` index of `knowledge/`, rebuilt by a `watches` entry whenever a file there changes.
- **Guardrails:** `Block(PromptInjection)` on email from strangers, `Require(JSON)` and `Validate` on the triage, a per-email `MaxSpend`, and a system prompt that lists what the agent may never promise.
- **A person in the loop:** every reply waits at `|! yield`, and the reviewer can send edited text with `{"approved": true, "reply": "..."}`. Sending is inside the same pipeline, so nothing can send mail through the API or MCP without that approval.
- **Deployment:** a container with a volume for `.halo/` (paused runs survive a redeploy), `HALO_SERVE_TOKEN` for the API, `HALO_PUBLIC_URL` for approval links, and `GET /healthz` for health checks.

Source: [`blueprints/support-inbox`](https://github.com/cmjio/halo/tree/main/blueprints/support-inbox).

## GitHub triage

`--template github-triage`. GitHub's "issues" webhook (`POST /hooks/github`, checked with GitHub's signature) starts `TriageIssue` for each new issue. Halo finds similar earlier issues, classifies the new one, and applies labels right away. When the issue looks like a duplicate or is missing details, `AskAuthor` drafts a comment and waits for a person before posting it. A schedule runs `WeeklyReport` on Monday mornings and posts a summary of open issues to Slack.

It shows:

- **Two levels of autonomy in one workflow:** labels are cheap to undo, so they're applied at once; a public comment waits at `|! yield`.
- **A pipeline that's safe to expose:** `AskAuthor` is callable from the API and MCP, and still pauses for approval there.
- **Webhook plus schedule:** the same service reacts to events and runs a weekly job (`schedules` with `args`).
- **Memory across runs:** a `VectorStore` of every triaged issue, used to spot duplicates.

## Incident responder

`--template incident-responder`. A Sentry internal integration's issue webhook (`POST /hooks/sentry`) starts `HandleAlert` for each new error. In parallel, Halo reads the error's latest stack trace from Sentry, the latest commits from GitHub, and similar past incidents; an investigator agent names the likely cause, suspect commits and first steps; then Halo opens a Linear issue and posts the summary in Slack.

It shows:

- **Fan-out over several APIs:** `|*` runs the Sentry, GitHub and store calls at once, each a plain `REST` tool with a token.
- **Settings outside the pipeline:** the webhook's `args` in `halo.json` pass the Sentry org and GitHub repo with every body (see [Webhooks](./serving.md#webhooks)).
- **Trimming big payloads:** `System.Pick` keeps the stack frames and commit fields the model needs, from responses that are tens of kilobytes.
- **Running unattended:** it only reads from Sentry and GitHub and only writes to your own Linear and Slack, so it needs no approval.

## Customer chat

`--template customer-chat`. Your backend calls `POST /api/pipelines/Chat/runs` with `wait: true`, the customer's id from your login session, and their message. `Chat` reads that customer's recent orders from Postgres and your store policies, answers with the conversation so far, and, for refunds, damaged items, complaints or anything it isn't sure of, hands off to your team in Slack.

It shows:

- **Per-user state:** `@thread(user_id)` keeps each customer's conversation; `Thread.append` and `Thread.set` change it.
- **Scoped data access:** the SQL is written in the pipeline with `params: [user_id]`, never by the model, and the `PostgreSQL` tool refuses anything but `SELECT`.
- **Money rules:** it can't move money; refunds go to a person. A per-message `MaxSpend` caps cost.
- **Serving to an app:** the HTTP API with `HALO_SERVE_TOKEN`, called from your server, not the browser.

## Web monitor

`--template web-monitor`. A schedule runs `CheckAll` every hour with the pages listed in `halo.json`. For each page, `CheckSource` reads its text and compares it with the last reading kept in `KV`; only a page whose text changed goes to a model, which decides whether the change matters. Changes that matter are noted in a store, and `SendDigest` emails them every weekday morning, then clears what it sent.

It shows:

- **Schedules with data:** the list of pages is the schedule's `args`.
- **Spending only on change:** an unchanged page costs no model call.
- **A queue in a store:** changes are tagged `pending` until the digest sends them, so a failed send loses nothing, and each one stays searchable afterwards.

## Cloudflare email agent

`--template cloudflare-email`. The same job as the support inbox, built on Cloudflare: Email Routing hands each email to a Worker, which stores it in a Durable Object. The Durable Object's alarm asks Halo, running under `halo serve` in a Cloudflare Container, for a triage and a draft (`DraftReply`). The reviewer gets an email with a signed link to a review page the Worker serves, and the reply goes out through Cloudflare Email Sending when they click Send. `wrangler deploy` builds and ships all of it.

It shows:

- **Halo inside a larger app:** the Worker calls the HTTP API (`wait: true`) and reads a completed run's output, a `halted` run (spam) and an `error` run (a policy stopped it).
- **Running where the disk doesn't last:** a Container's disk is wiped whenever it sleeps, so the inbox, deduplication and approvals live in the Durable Object, and the `Dockerfile` builds the article index into the image.
- **A pipeline that can't send:** it has no mail tool. Only the Worker sends, after a person approves.

## Tested in CI

`test/blueprints.test.ts` checks every blueprint: the CLI bundles exactly its files, every pipeline passes `halo validate --strict`, and its offline commands run. It also runs each one's behavior with canned answers: for example, approval, edits, rejection, retries, spam and injection for the support inbox, and duplicate deliveries, hand-offs and the digest queue for the others. For `cloudflare-email`, it checks the pipeline and the exact API exchange the Worker relies on; the Worker itself is checked by its own `npm run typecheck`, which CI doesn't run.
