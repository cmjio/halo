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

## Fix an issue

`--template fix-issue`. Someone labels a GitHub issue `halo-fix` (a GitHub `issues` webhook, `POST /hooks/github`), or you run `FixIssue` by hand with an issue number. A `Coder` agent fixes it on a copy of the repository in a sandbox and runs the tests there; the pipeline runs the tests again itself and sends a red run back to the agent. A person reads the diff, and only on a yes does Halo write it back, commit it on a `halo/issue-<n>` branch, push it, and open a pull request. On a no, it comments on the issue.

```bash
halo init my-fixer --template fix-issue
cd my-fixer
halo test pipelines/fix.halo -p FixIssue --arg number=42 --mocks samples/mocks.json
halo test pipelines/fix.halo -p FixIssue --arg number=42 --mocks samples/mocks-reject.json
```

It shows:

- **A sandbox with your project in it:** `Remote("auto", from: "repo")` copies a clone of the repository into a Docker, E2B or Daytona sandbox, and `sandbox: Repo` gives it to the agent. See [Coding Agents That Run Their Code](../coding-agents.md).
- **Changes out only on a yes:** `DenyTools("Repo.apply", "Repo.download", "Repo.keep")` keeps the agent from writing back itself. The pipeline measures the change with `Repo.diff()`, waits at `|! yield` with the patch, and calls `Repo.apply()` after the approval.
- **The tests decide:** `Repo.run` runs the test command in the same sandbox, and `|<> loop(Dev, ...)` sends failures back to the agent, twice at most.
- **Untrusted input:** `Block(PromptInjection)` on the issue text, a label gate so only people who can label issues start a run, a per-issue `MaxSpend`, and a GitHub token that stays on the server and never reaches the sandbox.
- **Deployment:** Fly with E2B sandboxes, since Fly has no Docker. Allowed hosts (`hosts:`) work only with Docker sandboxes, and a sandbox with `hosts:` that lands on E2B or Daytona fails rather than run without them, so the deployed pipeline leaves them out. The README explains running it on a VM or CI runner with Docker instead, with an allowlist.

The blueprint's source is [`blueprints/fix-issue`](https://github.com/cmjio/halo/tree/main/blueprints/fix-issue), and `test/blueprints.test.ts` runs it in CI: approval to a pull request, rejection to a comment, the webhook's label gate, failing tests sent back to the agent, the agent's denied methods, and an injection attempt in an issue.
