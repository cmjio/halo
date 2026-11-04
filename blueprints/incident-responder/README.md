# Incident responder

A Halo blueprint: a complete, deployable app, not a snippet. When Sentry sees a new error, Halo reads its stack trace, the latest commits, and similar past incidents, works out a likely cause, opens a Linear issue, and posts a summary in Slack, all within a minute and without waiting for anyone.

```
new Sentry issue ─▶ POST /hooks/sentry ─▶ HandleAlert
  ├─ skip warnings, and deliveries already handled
  ├─ stack trace + recent commits + past incidents   (in parallel)
  ├─ likely cause, suspect commits, first steps
  ├─ a Linear issue for the team
  └─ a summary in Slack, and remember it for next time
```

It only reads from Sentry and GitHub, and only writes to your own Linear and Slack, so it runs on its own. Nothing it does reaches customers.

| File | What it is |
|---|---|
| `pipelines/incidents.halo` | The workflow: `HandleAlert` |
| `halo.json` | The service: the Sentry webhook, with your Sentry org and GitHub repo |
| `samples/` | A Sentry issue webhook, and canned answers for offline tests |
| `Dockerfile`, `fly.toml` | Deployment |
| `.env.example` | Every key it needs, and where to get it |

## 1. Try it offline (no keys)

```bash
halo test pipelines/incidents.halo -p HandleAlert --body samples/sentry-issue.json \
  --arg org=acme --arg repo=acme/api --mocks samples/mocks.json
```

`--body` gives the pipeline the webhook body, and `--arg` the values `halo.json` adds to it. `samples/mocks.json` has a canned stack trace, commits and model answer, and keeps the incident history real (`"live"`): run it twice and the second run stops early, because that Sentry issue was already handled. Delete `.halo/` to start again.

## 2. Configure

1. In `halo.json`, set `org` to your Sentry organization slug and `repo` to the GitHub repo the errors come from.
2. `cp .env.example .env` and fill it in.
3. In Sentry: **Settings → Developer Settings → Custom Integrations → New Internal Integration**.
   - Webhook URL: `https://<your server>/hooks/sentry?secret=<SENTRY_WEBHOOK_SECRET>`
   - Permissions: Issue & Event **Read**, Project **Read**
   - Webhooks: **issue**
   - Save, then copy its token into `SENTRY_AUTH_TOKEN`.

Sentry sends a webhook when an issue is created (a new kind of error, not each occurrence). Errors and fatals are handled; warnings and info are skipped. For self-hosted Sentry, change the `Sentry` tool's URL in `pipelines/incidents.halo`.

## 3. Run it

```bash
halo serve
curl -X POST "localhost:8080/hooks/sentry?secret=$SENTRY_WEBHOOK_SECRET" \
  -H 'content-type: application/json' -d @samples/sentry-issue.json
```

With real keys, that sample fails at the Sentry call (its issue id isn't in your org). Trigger a real error in a test project, or change the sample's `id` to one of yours. Open http://127.0.0.1:8080 (Halo Studio) to follow each step.

## 4. Deploy

Halo needs a host that runs a long-lived process with a disk: past incidents and dedupe keys are kept in `.halo/`.

**Fly.io**

```bash
fly launch --copy-config --no-deploy        # pick a name, then set it in fly.toml's HALO_PUBLIC_URL
fly volumes create halo_state --size 1
fly secrets set ANTHROPIC_API_KEY=... SENTRY_AUTH_TOKEN=... SENTRY_WEBHOOK_SECRET=$(openssl rand -hex 24) \
  GITHUB_TOKEN=... LINEAR_TOKEN=... LINEAR_TEAM=ENG SLACK_BOT_TOKEN=... SLACK_CHANNEL='#incidents' \
  HALO_SERVE_TOKEN=$(openssl rand -hex 24)
fly deploy
```

**Anywhere else that runs a container**: build the `Dockerfile`, mount a volume at `/app/.halo`, set the variables from `.env.example`, and expose port 8080. `GET /healthz` answers health checks.

## Make it yours

- **Several projects:** add one webhook per Sentry integration in `halo.json`, each with its own `path`, `org` and `repo`.
- **Severity:** the `Investigator.investigate` prompt defines sev1–3. Put your own definitions there.
- **Page someone for sev1:** add a branch after the findings, for example `(context.data.findings.severity == "sev1") => Pager.trigger(...)` with a `POST` tool for PagerDuty's Events API.
- **Ask before filing:** add `|! yield(...)` before `Tickets.create_issue` to have a person confirm each ticket.
- **Cost:** `halo plan pipelines/incidents.halo` shows every call. `MaxSpend(0.15)` caps each error.

## What it doesn't do yet

- It reads the latest commits on the default branch, not the deployed release's diff. To compare releases, call GitHub's compare API with the release from the event's tags.
- A Sentry issue that regresses (resolved, then back) doesn't start a new run.
- Sentry's own webhook signature isn't checked; the `?secret=` in the URL is.
