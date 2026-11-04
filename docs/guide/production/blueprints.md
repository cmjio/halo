# Blueprints

A blueprint is a complete Halo app you can deploy, not a snippet: the pipelines, the service configuration, sample data, offline tests, and the files to deploy it. `halo init` writes one out:

```bash
halo init my-inbox --template support-inbox
cd my-inbox
halo test pipelines/support.halo -p IndexKnowledge --mocks samples/mocks.json
halo test pipelines/support.halo -p HandleEmail --body samples/email.json --mocks samples/mocks.json
```

Each blueprint follows the same layout, so once you've read one you know where everything is in the next:

| File | What it holds |
|---|---|
| `pipelines/*.halo` | The workflow |
| `halo.json` | How [`halo serve`](./serving.md) runs it: webhooks, schedules, watches, Slack notices |
| `samples/` | Example inputs (webhook bodies) and `mocks.json`, canned answers for [offline tests](../../dx/testing-and-mocks.md#canned-answers-and-webhook-bodies) |
| `.env.example` | Every key it needs, and where to get each |
| `Dockerfile`, `fly.toml` | Deployment. The image installs the `halo` version that created the project, and validates the pipelines while it builds |
| `README.md` | Trying it offline, running it for real, connecting the outside service, deploying, and making it yours |

## Support inbox

`--template support-inbox`. Customer email arrives at a webhook (`POST /hooks/email`, in Postmark's inbound JSON shape). Halo skips repeats and spam, triages the email, searches your help articles and past replies, drafts a reply from them, and waits for a person, who approves it, writes their own text, or rejects it, from the approval link, Slack or Studio. Then it sends the reply with Resend and remembers it.

It shows:

- **A real trigger:** a webhook with a shared secret, and deduplication with `KV`, since email providers retry.
- **Retrieval:** a `VectorStore` index of `knowledge/`, rebuilt by a `watches` entry whenever a file there changes.
- **Guardrails:** `Block(PromptInjection)` on email from strangers, `Require(JSON)` and `Validate` on the triage, a per-email `MaxSpend`, and a system prompt that lists what the agent may never promise.
- **A person in the loop:** every reply waits at `|! yield`, and the reviewer can send edited text with `{"approved": true, "reply": "..."}`. Sending is inside the same pipeline, so nothing can send mail through the API or MCP without that approval.
- **Deployment:** a container with a volume for `.halo/` (paused runs survive a redeploy), `HALO_SERVE_TOKEN` for the API, `HALO_PUBLIC_URL` for approval links, and `GET /healthz` for health checks.

The blueprint's source is [`blueprints/support-inbox`](https://github.com/cmjio/halo/tree/main/blueprints/support-inbox), and `test/blueprints.test.ts` runs it in CI: approval, edited replies, rejection, retries, spam, and an injection attempt.
