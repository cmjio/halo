# Serving pipelines

`halo serve` runs your pipelines as a service: one Bun process that starts runs from an HTTP API, webhooks, and schedules, sends approval links when a run pauses for a human, and serves Halo Studio.

```bash
halo serve                      # every .halo file under the current folder
halo serve workflows/ --port 8080
```

```
Halo is serving 3 pipeline(s) at http://127.0.0.1:8080
  Studio     http://127.0.0.1:8080/
  API        POST http://127.0.0.1:8080/api/pipelines/<name>/runs  {"args": {...}}
  Webhook    POST http://127.0.0.1:8080/hooks/github → TriageIssues
  Schedule   0 9 * * 1-5 → TriageIssues (next 11/3/2026, 9:00:00 AM)
```

Every file must validate, and pipeline names must be unique across the files you serve.

## Configuration: `halo.json`

All optional. `halo serve` reads `./halo.json` (or `--config <file>`). Strings like `"Env.NAME"` are read from the environment.

```json
{
  "files": ["workflows/"],
  "port": 8080,
  "publicUrl": "https://halo.example.com",
  "schedules": [
    { "pipeline": "TriageIssues", "cron": "0 9 * * 1-5", "args": { "repo": "acme/api", "limit": 10 } }
  ],
  "webhooks": [
    { "path": "github", "pipeline": "TriageIssues", "secret": "Env.GITHUB_WEBHOOK_SECRET" }
  ],
  "notify": { "slack": "Env.SLACK_WEBHOOK_URL" }
}
```

| Key | Meaning |
|---|---|
| `files` | `.halo` files or folders to load (command-line paths take precedence). Default: the current folder |
| `port`, `host` | Where to listen. Default `127.0.0.1:8080` |
| `token` | API token; the same as setting `HALO_SERVE_TOKEN` |
| `publicUrl` | The address people reach the server at, used in approval links |
| `schedules` | Start `pipeline` with `args` on a cron schedule |
| `webhooks` | `POST /hooks/<path>` starts `pipeline` |
| `notify.slack` | A Slack incoming-webhook URL to announce paused runs |
| `stateDir` | Where telemetry, paused runs, and the link-signing secret are kept. Default `.halo` |

### Schedules

Standard 5-field cron in the server's local time: minute, hour, day of month, month, day of week. Fields take `*`, numbers, ranges (`1-5`), lists (`1,15`), steps (`*/15`), and names (`jan`, `mon`). When day of month and day of week are both set, a day matches if either does.

| Expression | Runs |
|---|---|
| `0 9 * * 1-5` | 9:00 on weekdays |
| `*/15 * * * *` | every 15 minutes |
| `30 8 1 * *` | 8:30 on the 1st of each month |

### Webhooks

The JSON body becomes the pipeline's arguments: fields that match parameter names are passed by name, and a pipeline with a single parameter that isn't in the body gets the whole body (handy for GitHub or Stripe events).

With a `secret`, a request must either carry it in an `x-halo-secret` header (or `?secret=`), or be signed GitHub-style with `x-hub-signature-256`. Requests without it get `401`.

## Human approval

A run that reaches `|! yield` or `~> listen` pauses and is saved under `.halo/runs`, so it survives restarts. The server logs (and, with `notify.slack`, posts) a signed link:

```
⏸ TriageIssues is waiting for a human: approve = save the report, label = …, reject = discard
Respond: https://halo.example.com/approve/6f9696ef-…?sig=94cea2…
```

The link opens a page with the question, the current value, and Approve / Reject buttons (or any other answer, as a word or JSON). It works without the API token, because the signature only allows answering that one run, once. The answer becomes the response (`context.data.yield`), the same as answering in the terminal: `approve` gives `{ approved: true, action: "approve", ... }`.

Studio shows the same buttons on a paused run.

## HTTP API

Every `/api` request needs `Authorization: Bearer <token>` when a token is set.

| Request | Does |
|---|---|
| `GET /api/pipelines` | Pipelines with their parameters, schedules (and next run), and webhooks |
| `POST /api/pipelines/<name>/runs` | Start a run. Body `{"args": {...}}`; returns `202 {"runId"}`. Add `"wait": true` to wait and get `status` and `output` |
| `GET /api/runs` | Recent runs: pipeline, status, duration, cost |
| `GET /api/runs/<id>` | A run's events, and `paused` (`waitingFor`, `message`, `approveUrl`) while it waits |
| `POST /api/runs/<id>/signal` | Resume a paused run. Body `{"answer": "approve"}`, or `{"payload": {...}, "event": "Slack.Reaction"}` |
| `GET /api/health` | `{"ok": true, "pipelines": n}` |

```bash
curl -X POST localhost:8080/api/pipelines/TriageIssues/runs \
  -H 'Content-Type: application/json' -d '{"args": {"repo": "oven-sh/bun", "limit": 5}}'
```

## Security

- It listens on `127.0.0.1` by default. To listen on any other interface you must set `HALO_SERVE_TOKEN` (or `token`); it refuses to start otherwise, because the API starts runs that spend money and run data includes prompts and answers.
- Approval links are signed with the token, or with a random secret kept in `.halo/serve-secret`. Deleting that file invalidates outstanding links.
- Put it behind HTTPS (a reverse proxy such as Caddy) when it's reachable from the internet, and set `publicUrl` to that address.

## Running it in production

Run `halo serve` under a process manager (systemd, Docker, or a PaaS that runs containers) with the provider keys in its environment and `stateDir` on persistent storage. On `SIGTERM` it stops accepting requests and waits for running pipelines to reach a stopping point. Runs that are paused stay paused and continue after a restart.
