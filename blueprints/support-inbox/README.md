# Support inbox

A Halo blueprint: a complete, deployable app, not a snippet. Customer email arrives at a webhook. Halo triages it, drafts a reply from your help articles, and waits for a person to approve, edit, or reject the draft before it sends it.

```
inbound email ─▶ POST /hooks/email ─▶ HandleEmail
  ├─ skip repeats (the provider retried) and spam
  ├─ triage + search help articles + search past replies   (in parallel)
  ├─ draft a reply that uses only those articles
  ├─ ⏸ a person approves, edits or rejects it   (approval link, Slack, or Studio)
  └─ send it with Resend, and remember the answer for next time
```

| File | What it is |
|---|---|
| `pipelines/support.halo` | The workflow: `HandleEmail`, plus `IndexKnowledge` / `IndexArticle` |
| `knowledge/` | Your help articles (Markdown, text, HTML, PDF or Word). Replace the samples with yours |
| `halo.json` | The service: the email webhook, re-indexing when `knowledge/` changes, Slack notices |
| `samples/` | Example inbound emails, and canned model answers for offline tests |
| `Dockerfile`, `fly.toml` | Deployment |
| `.env.example` | Every key it needs, and where to get it |

## 1. Try it offline (no keys)

```bash
halo test pipelines/support.halo -p IndexKnowledge --mocks samples/mocks.json
halo test pipelines/support.halo -p HandleEmail --body samples/email.json --mocks samples/mocks.json
```

`--body` gives the pipeline a JSON body the way the webhook does. `samples/mocks.json` gives canned answers for the two model calls and the email send, and runs the local tools for real (`"live"`): the article index really is searched, and you can see which article the reply would use with `halo debug` in place of `halo test`.

Try `samples/email-injection.json` too: the `Untrusted` policy blocks it before any model sees it.

## 2. Run it for real, locally

```bash
cp .env.example .env     # add ANTHROPIC_API_KEY; RESEND_API_KEY and SUPPORT_FROM to send
halo run pipelines/support.halo -p IndexKnowledge
halo run pipelines/support.halo -p HandleEmail --body samples/email.json
```

In a terminal, Halo shows the triage and the draft and asks you. Answer `approve`, `reject`, or JSON with your own text: `{"approved": true, "reply": "..."}`. Change `From` in the sample to your own address before you approve, since that's where the reply goes.

Then run the service:

```bash
halo serve
curl -X POST "localhost:8080/hooks/email?secret=$INBOUND_WEBHOOK_SECRET" \
  -H 'content-type: application/json' -d @samples/email.json
```

Open http://127.0.0.1:8080 (Halo Studio) to see the run waiting for you, read the draft, and approve it.

## 3. Connect inbound email

The webhook takes Postmark's inbound JSON as it is. In Postmark, create an inbound stream and set its webhook URL to:

```
https://<your server>/hooks/email?secret=<INBOUND_WEBHOOK_SECRET>
```

Then forward your support address to the stream's inbound address. The pipeline reads `MessageID`, `From`, `FromName`, `Subject` and `TextBody`, so any other source works if it posts JSON with those fields: a Cloudflare Email Worker, a Zapier or n8n step, or your helpdesk's webhook. Senders of form-encoded bodies (Mailgun, SendGrid Inbound Parse) need a small step in between that posts JSON.

## 4. Deploy

Halo needs a host that runs a long-lived process with a disk: paused runs (drafts waiting for review), the article index, past replies and dedupe keys are kept in `.halo/`. Serverless functions and Cloudflare Workers can't run it.

**Fly.io**

```bash
fly launch --copy-config --no-deploy        # pick a name, then set it in fly.toml's HALO_PUBLIC_URL
fly volumes create halo_state --size 1
fly secrets set ANTHROPIC_API_KEY=... RESEND_API_KEY=... SUPPORT_FROM=support@yourcompany.com \
  INBOUND_WEBHOOK_SECRET=$(openssl rand -hex 24) HALO_SERVE_TOKEN=$(openssl rand -hex 24)
fly deploy
```

**Anywhere else that runs a container** (Railway, Render, a VM): build the `Dockerfile`, mount a volume at `/app/.halo`, set the variables from `.env.example`, and expose port 8080. The image validates the pipelines while it builds, so a broken file fails the deploy instead of the first email. `GET /healthz` answers health checks without the token.

On the internet, `HALO_SERVE_TOKEN` protects the API, MCP and Studio (send it as `Authorization: Bearer ...`). The webhook checks its own secret, and approval links carry their own signature, so neither needs the token.

## 5. Review drafts in Slack (optional)

- **Notices with a link:** set `SLACK_WEBHOOK_URL` to an incoming-webhook URL. Each draft waiting for review is posted with its approval link, which opens a page with the draft and Approve / Reject buttons, plus a box for your own text.
- **Approve / Reject buttons in Slack:** in your Slack app, turn on Interactivity with the request URL `https://<your server>/slack/actions`, set `SLACK_SIGNING_SECRET`, and add this to `halo.json`:

  ```json
  "slack": { "signingSecret": "Env.SLACK_SIGNING_SECRET" }
  ```

## Make it yours

- **Articles:** replace `knowledge/` with your help center. `halo serve` re-indexes within a minute of a change (the `watches` entry in `halo.json`), and on every start. Keep one topic per file: each file is one search entry.
- **Tone and rules:** the `Writer` agent's system prompt says what it may never promise. Add your own.
- **Models:** swap `anthropic/claude-haiku-4-5` and `anthropic/claude-sonnet-4-5` for any provider Halo supports.
- **Auto-send:** to send some replies without review, add a branch before the `|! yield`, for example on `context.data.draft.covered == true && context.data.triage.category == "how-to"`. Start with everything reviewed, and look at what people change first.
- **Cost:** `halo plan pipelines/support.halo` shows every call. The worst case is about $0.09 per email; `MaxSpend(0.10)` stops a run before it spends more.

## What it doesn't do yet

- Replies start a new thread in some mail clients: they reuse the subject (`Re: ...`) but don't set `In-Reply-To`.
- Attachments are ignored. Only the plain-text body is read.
- One email is one run. Earlier emails from the same customer aren't part of the prompt (add `@thread(...)` to keep that state).
