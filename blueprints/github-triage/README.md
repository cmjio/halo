# GitHub triage

A Halo blueprint: a complete, deployable app, not a snippet. Every new issue in your repos is labeled within a minute. When an issue looks like a duplicate or is missing what a maintainer needs, Halo drafts a comment to its author, and a person approves it before it's posted. Every Monday, your team gets a summary of what's open in Slack.

```
issue opened ─▶ POST /hooks/github ─▶ TriageIssue
  ├─ skip edits, bots, and deliveries already handled
  ├─ find similar earlier issues
  ├─ classify it, then apply the labels
  └─ a duplicate, or missing details?
       └─ draft a comment ─▶ ⏸ a person approves ─▶ post it   (AskAuthor)
Mondays 9:00 ─▶ WeeklyReport ─▶ Slack
```

| File | What it is |
|---|---|
| `pipelines/triage.halo` | The workflow: `TriageIssue`, `AskAuthor` and `WeeklyReport` |
| `halo.json` | The service: the GitHub webhook, the weekly schedule, Slack notices |
| `samples/` | A GitHub "issues" event, and canned model answers for offline tests |
| `Dockerfile`, `fly.toml` | Deployment |
| `.env.example` | Every key it needs, and where to get it |

## 1. Try it offline (no keys)

```bash
halo test pipelines/triage.halo -p TriageIssue --body samples/issue-opened.json --mocks samples/mocks.json
halo test pipelines/triage.halo -p WeeklyReport --arg repo=acme/api --mocks samples/mocks.json
```

`--body` gives the pipeline the event the way GitHub's webhook does. `samples/mocks.json` has canned answers for the model and GitHub calls, and keeps the issue history real (`"live"`), so the second run of the first command stops early: that issue was already triaged. Delete `.halo/` to start again.

## 2. Run it for real, locally

```bash
cp .env.example .env     # add ANTHROPIC_API_KEY and GITHUB_TOKEN
```

Edit `samples/issue-opened.json` to point at a real issue in a repo you can write to (`repository.full_name`, `issue.number`), then:

```bash
halo run pipelines/triage.halo -p TriageIssue --body samples/issue-opened.json
```

It labels the issue. If it drafts a comment, the terminal shows the draft and asks: answer `approve`, `reject`, or `{"approved": true, "reply": "..."}` to post your own text.

## 3. Connect GitHub

In your repo (or organization): **Settings → Webhooks → Add webhook**.

- Payload URL: `https://<your server>/hooks/github`
- Content type: `application/json`
- Secret: your `GITHUB_WEBHOOK_SECRET`
- Events: **Let me select individual events → Issues**

Halo checks GitHub's signature (`X-Hub-Signature-256`) on every delivery. One server can triage many repos: each event names its repo, and the token needs access to each.

## 4. Deploy

Halo needs a host that runs a long-lived process with a disk: comments waiting for approval, the issue history and dedupe keys are kept in `.halo/`.

**Fly.io**

```bash
fly launch --copy-config --no-deploy        # pick a name, then set it in fly.toml's HALO_PUBLIC_URL
fly volumes create halo_state --size 1
fly secrets set ANTHROPIC_API_KEY=... GITHUB_TOKEN=... GITHUB_WEBHOOK_SECRET=... \
  SLACK_BOT_TOKEN=... SLACK_CHANNEL='#maintainers' HALO_SERVE_TOKEN=$(openssl rand -hex 24)
fly deploy
```

**Anywhere else that runs a container**: build the `Dockerfile`, mount a volume at `/app/.halo`, set the variables from `.env.example`, and expose port 8080. `GET /healthz` answers health checks.

## 5. Approve comments

A run that drafted a comment waits for a person. Open Studio (`https://<your server>/`, with `HALO_SERVE_TOKEN`) to see it, or set `SLACK_WEBHOOK_URL` to get each draft in Slack with an approval link. For Approve / Reject buttons in Slack, see [Serving pipelines](https://halolang.com/guide/production/serving#slack-buttons).

## Make it yours

- **Labels:** the list is in the `Triager.classify` prompt. Use your repo's labels; GitHub creates any label that doesn't exist yet.
- **Weekly report:** list your repos in `halo.json`'s `schedules`, one entry per repo, and change the `cron`.
- **Comment on everything, or nothing:** the branch at the end of `TriageIssue` decides when to ask the author. Remove it to only label.
- **Post without approval:** replace `AskAuthor`'s `|! yield` and the gate after it. Start with approval, and look at what people change first.
- **Models:** swap `anthropic/claude-haiku-4-5` and `anthropic/claude-sonnet-4-5` for any provider Halo supports.

## What it doesn't do yet

- Pull requests aren't triaged (they're a different webhook event).
- Labels the model suggests are applied as they are: keep the list in the prompt short, and watch the first week's labels.
- Similar issues are matched by words, not meaning. For better duplicate detection, give the `History` store `embeddings:` (see [Embeddings](https://halolang.com/stdlib/embeddings)).
