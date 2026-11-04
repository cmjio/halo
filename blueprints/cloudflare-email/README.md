# Cloudflare email agent

Customers write to `support@yourdomain.com`. A Halo pipeline triages each email and drafts a reply from your help articles. A person reviews, edits and sends it from a link in their inbox. All of it runs on Cloudflare: no mail provider, server or database to look after.

```
email ─▶ Email Routing ─▶ Worker email() ─▶ Inbox (Durable Object, SQLite)
                                               │ alarm
                                               ▼
                         Halo in a Container: DraftReply ─▶ { triage, draft }
                                               │
              the reviewer gets an email with a link ◀┘
                                               │
          review page (Worker): edit ─▶ Send ─▶ Cloudflare Email Sending ─▶ the customer
```

| Part | Cloudflare service | What it does |
|---|---|---|
| `worker/index.ts` | Workers, Email Routing | Receives each email, parses it, skips auto-replies and mailing lists, and serves the review page |
| `worker/inbox.ts` | Durable Objects (SQLite), alarms | Keeps every email, its draft and the decision. Stores each `Message-ID` once, retries Halo with backoff, and sends only after a person approves |
| `pipelines/email.halo` | Containers | `DraftReply`: triage and a search of the help articles in parallel, spam dropped, then a draft from the articles only |
| `knowledge/` | | Your help articles, indexed into the image when it's built |
| `send_email` binding | Email Sending | Sends the replies and the reviewer's notices. No API key needed |

## Why the work is split this way

A Container's disk is wiped whenever it sleeps (after 10 idle minutes here). So nothing that matters lives there:

- **The inbox, deduplication and approvals** live in the Durable Object, which keeps its SQLite storage across sleeps and deploys. That's why approval happens in the Worker, not in a paused Halo run as in the `support-inbox` blueprint.
- **The article index** is built by the `Dockerfile` (`halo run … -p IndexKnowledge`), so it ships inside the image. Change an article and redeploy to update it.
- **Halo is stateless here.** It gets one email and returns a triage and a draft. It has no tool that sends mail; only the Worker can, after a person clicks Send.

Halo's API is never public. Only the Inbox calls it, inside Cloudflare, with `HALO_SERVE_TOKEN`. The Worker's only public pages are `/review/<id>` (each link carries an HMAC signature made with `REVIEW_SECRET`) and `/healthz`.

## Try it offline

```bash
halo test pipelines/email.halo -p DraftReply --body samples/email.json --mocks samples/mocks.json
```

This prints the `{ triage, draft }` the Worker receives, using canned model answers from `samples/mocks.json`.

With a real model:

```bash
cp .env.example .env               # add ANTHROPIC_API_KEY
halo run pipelines/email.halo -p IndexKnowledge
halo run pipelines/email.halo -p DraftReply --body samples/email.json
```

## Run the whole app locally

You need Docker running. `wrangler dev` builds the image and runs the container on your machine.

```bash
npm install
cp .dev.vars.example .dev.vars     # fill in all three
npx wrangler dev --port 8799
```

Set `PUBLIC_URL` in `wrangler.jsonc` to `http://localhost:8799` while you do this, so the review links point at your machine. Then send it an email through the local Email Routing endpoint:

```bash
curl -X POST 'http://localhost:8799/cdn-cgi/handler/email?from=dana@example.com&to=support@yourdomain.com' \
  --data-binary $'From: "Dana Ruiz" <dana@example.com>\nTo: support@yourdomain.com\nSubject: Teammate never got the invite\nMessage-ID: <test-1@example.com>\n\nShe never got the invite. Can you resend it?'
```

Locally, `send_email` doesn't deliver anything. Wrangler logs each message and saves its text under `.wrangler/tmp/email/`, including the reviewer's notice with the review link. Open the link, edit the draft, and click Send. Sending the same email twice stores it once.

## Deploy

You need a Cloudflare account with your domain on it, the Workers Paid plan (Containers need it), and Docker running.

1. **Set the addresses.** In `wrangler.jsonc`, set `SUPPORT_FROM` (the address customers write to), `SUPPORT_NAME`, and `REVIEWER_EMAIL` (who reviews drafts).

2. **Turn on Email Sending** for the domain. This adds its SPF and DKIM records:

   ```bash
   npx wrangler email sending enable yourdomain.com
   ```

3. **Add the secrets:**

   ```bash
   npx wrangler secret put ANTHROPIC_API_KEY
   npx wrangler secret put HALO_SERVE_TOKEN    # openssl rand -hex 24
   npx wrangler secret put REVIEW_SECRET       # openssl rand -hex 24
   ```

4. **Deploy:**

   ```bash
   npx wrangler deploy
   ```

   It builds the image (validating the pipelines and indexing `knowledge/`), pushes it, and prints the Worker's URL. Put that URL in `PUBLIC_URL` and deploy again. The first container can take a few minutes to become available.

5. **Route the mail to the Worker.** Turn on Email Routing for the domain, then send the support address to the Worker (use your Worker's name, from `wrangler.jsonc`):

   ```bash
   npx wrangler email routing enable yourdomain.com
   npx wrangler email routing rules create yourdomain.com \
     --match-type literal --match-field to --match-value support@yourdomain.com \
     --action-type worker --action-value cloudflare-email
   ```

   You can also do this in the dashboard: **Email Routing** → **Routing rules** → a custom address, with the action **Send to a Worker**.

Send the address an email. Within a minute (more if the container is starting), `REVIEWER_EMAIL` gets a notice with the triage and a link to the draft.

**Watching it:** `npx wrangler tail` streams the Worker's logs. The Inbox's table has each email's `status` (`new`, `review`, `sent`, `discarded`, `spam` or `failed`) and its last `error`.

## When something goes wrong

- **Halo can't be reached** (for example, the container is still starting): the Inbox tries 4 times, waiting longer each time. Then it marks the email `failed` and asks the reviewer to answer it by hand. The review page still works, with an empty reply box.
- **A policy stops the run** (an injection attempt, the spend cap, or a draft that isn't JSON): the email is marked `failed` with no draft, and the reviewer is asked to answer it by hand.
- **Spam** ends the run as `halted`. It's stored as `spam`; nothing is drafted and nobody is notified.
- **Auto-replies, bounces and mailing-list mail** (`Auto-Submitted`, `List-Id`) are ignored, so the agent never loops with another robot.

## Change it

- **Models:** the `agent` lines in `pipelines/email.halo`. To use another provider, pass its key in `envVars` in `worker/index.ts`, and add it to `.dev.vars.example`.
- **Who reviews:** `REVIEWER_EMAIL`. To review in Slack instead, post the link from `tellReviewer` in `worker/inbox.ts` to a Slack incoming webhook.
- **Several inboxes:** `inbox()` in `worker/index.ts` uses one Durable Object named `inbox`. Name it after `message.to` to give each address its own.
- **Remembering past replies:** the `support-inbox` blueprint keeps sent replies in a vector store for later drafts. Here that store would be wiped whenever the container sleeps. To keep it, point the `VectorStore` at Postgres with pgvector (`url:`, see the Halo docs on embeddings).
