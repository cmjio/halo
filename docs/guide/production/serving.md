# Serving pipelines

`halo serve` runs your pipelines as a service: one Bun process that starts runs from an HTTP API, webhooks, schedules, and watched sources, sends approval links (and Slack buttons) when a run pauses for a human, serves the pipelines as MCP tools, and serves Halo Studio.

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
  "watches": [
    { "pipeline": "OnRelease", "command": "git ls-remote --tags origin", "every": "5m" }
  ],
  "notify": { "slack": "Env.SLACK_WEBHOOK_URL" },
  "slack": { "signingSecret": "Env.SLACK_SIGNING_SECRET" }
}
```

| Key | Meaning |
|---|---|
| `files` | `.halo` files or folders to load (command-line paths take precedence). Default: the current folder |
| `port`, `host` | Where to listen. Default `127.0.0.1:8080` |
| `token` | API token; the same as setting `HALO_SERVE_TOKEN`. If it names a variable (`Env.X`) that is empty or not set, the server refuses to start rather than run without one |
| `publicUrl` | The address people reach the server at, used in approval links. It can name a variable (`"Env.PUBLIC_URL"`); without it, `HALO_PUBLIC_URL` is used |
| `schedules` | Start `pipeline` with `args` on a cron schedule |
| `webhooks` | `POST /hooks/<path>` starts `pipeline` |
| `watches` | Start `pipeline` when a URL, file, or command's output changes |
| `notify.slack` | A Slack incoming-webhook URL to announce paused runs |
| `slack.signingSecret` | Your Slack app's signing secret. Adds Approve / Reject buttons to the announcements, answered at `POST /slack/actions`. If it names a variable that is empty or not set, the server refuses to start |
| `mcp` | `false` turns off the MCP endpoint at `/mcp`. Default on |
| `stateDir` | Where telemetry, paused runs, watch readings, and the link-signing secret are kept. Default `.halo` |
| `registry` | The tool package registry for `halo add` and `halo search` (not used by `halo serve` itself; see [Tool Packages](../tool-packages.md)) |

### Schedules

Standard 5-field cron in the server's local time: minute, hour, day of month, month, day of week. Fields take `*`, numbers, ranges (`1-5`), lists (`1,15`), steps (`*/15`), and names (`jan`, `mon`). When day of month and day of week are both set, a day matches if either does.

| Expression | Runs |
|---|---|
| `0 9 * * 1-5` | 9:00 on weekdays |
| `*/15 * * * *` | every 15 minutes |
| `30 8 1 * *` | 8:30 on the 1st of each month |

### Webhooks

The JSON body becomes the pipeline's arguments: fields that match parameter names are passed by name, and a pipeline with a single parameter that isn't in the body gets the whole body (handy for GitHub or Stripe events).

With a `secret`, a request must either carry it in an `x-halo-secret` header (or `?secret=`), or be signed GitHub-style with `x-hub-signature-256`. Requests without it get `401`. If the secret names a variable that is empty or not set, the server refuses to start rather than accept unsigned requests. A webhook with no `secret` at all is open to anyone who can reach it, and the server warns about it at startup. It still refuses requests a web page sends through someone's browser: an `Origin` other than localhost or `publicUrl`, and, when listening on localhost, a `Host` that isn't (DNS rebinding).

### Watches

A watch reads a source on a timer and starts its pipeline only when what it reads has changed. Checking costs no model call.

```json
"watches": [
  { "pipeline": "OnPrice", "url": "https://api.example.com/price.json", "every": "5m", "headers": { "Authorization": "Env.PRICE_TOKEN" } },
  { "pipeline": "OnOrders", "file": "data/orders.csv", "every": "30s" },
  { "pipeline": "OnDeploy", "command": "git rev-parse origin/main", "every": "1m", "args": { "env": "prod" } }
]
```

| Key | Meaning |
|---|---|
| `pipeline` | The pipeline to start |
| `url`, `file`, or `command` | Exactly one source. A `url` must be `http(s)` and is fetched with GET; a non-2xx answer counts as a failed check. A missing `file` reads as empty. A `command` runs with `bash -c` and must exit 0 within 60 seconds |
| `every` | How often to check: `"30s"`, `"5m"`, `"1h"`. Default `1m`, and never more often than every 5 seconds |
| `headers` | Headers for a `url`. A value that is exactly `"Env.NAME"` is read from the environment (so put any `Bearer ` prefix in the variable) |
| `args` | More arguments for the pipeline |
| `runOnStart` | Also start the pipeline on the very first reading. Default `false`: the first reading is only remembered |

What was read is parsed as JSON when it is JSON, and kept as text otherwise. When it changes, the pipeline gets `{ ...args, source, before, after, changes }`, matched to its parameters like a webhook body (a pipeline with one parameter that isn't in it gets the whole object). `changes` lists, for JSON, each path that changed (`{ path: "items.0.price", before, after }`), and for text, each line added or removed (`{ added }`, `{ removed }`), at most 200.

The last reading of each watch is kept in `.halo/watches.json`, so a restart doesn't count everything as new, and a change made while the server was down starts the pipeline at the first check. A failed check is logged and changes nothing. A check doesn't start while the previous one for the same watch is still running.

A `command` runs with the server's full environment and permissions. It comes from your own `halo.json`, so treat that file like code.

## Human approval

A run that reaches `|! yield` or `~> listen` pauses and is saved under `.halo/runs`, so it survives restarts. The server logs (and, with `notify.slack`, posts) a signed link:

```
⏸ TriageIssues is waiting for a human: approve = save the report, label = …, reject = discard
Respond: https://halo.example.com/approve/6f9696ef-…?sig=94cea2…
```

The link opens a page with the question, the current value, and Approve / Reject buttons (or any other answer, as a word or JSON). It works without the API token, because the signature only allows answering that one question of that one run: once it's answered, the link stops working (`403`), and a run that pauses again gets a new link. If several people answer at once, only the first answer counts. The answer becomes the response (`context.data.yield`), the same as answering in the terminal: `approve` gives `{ approved: true, action: "approve", ... }`.

Studio shows the same buttons on a paused run.

The same applies to a run paused because an agent's tool call needs approval (`waitingFor: "approval"`, see [Agents with Tools](../agents-with-tools.md#approvals)). The message names the agent, the call, and its arguments, and approving runs that call.

### Slack buttons

With `notify.slack` alone, the announcement is a message with the link. Add your Slack app's signing secret, and it also gets **Approve** and **Reject** buttons:

```json
{
  "publicUrl": "https://halo.example.com",
  "notify": { "slack": "Env.SLACK_WEBHOOK_URL" },
  "slack": { "signingSecret": "Env.SLACK_SIGNING_SECRET" }
}
```

In your Slack app's settings, turn on Interactivity and set its Request URL to `https://<publicUrl>/slack/actions`. Slack must be able to reach that address.

- Halo checks every request's Slack signature and refuses requests more than 5 minutes old (`401`).
- A button on a pause announcement carries the run, the pause, and the same signature as the approval link, so it answers only that pause. A click after the pause was answered changes nothing.
- The answer is `approve` or `reject`, plus `by` (the Slack user name) and `via: "slack"`. Halo then replaces the buttons with who answered.
- Anyone in the channel who can click the button can answer. Post announcements only to channels whose members may approve.

A [`Slack` tool](../../stdlib/tools.md#slack) that posts `buttons:` during a run also gets its clicks here. Each button carries the run id, how many times the run had paused when it posted, and its label. A click answers only the run's **next** pause after the post, with the label as the answer, and only while the run is waiting there: post the buttons, then `|! yield` or `~> listen`. A click on a button whose pause is over, or that came before the run paused, changes nothing. These buttons never answer a tool-call approval (`waitingFor: "approval"`); use the announcement's buttons or the approval link for those.

## MCP

`/mcp` serves every pipeline as an MCP tool over Streamable HTTP, behind the API token. See [MCP](../integrations/mcp.md#http).

## HTTP API

Every `/api` request needs `Authorization: Bearer <token>` when a token is set. `POST` requests must be `Content-Type: application/json`.

| Request | Does |
|---|---|
| `GET /api/pipelines` | Pipelines with their parameters, schedules (and next run), and webhooks |
| `POST /api/pipelines/<name>/runs` | Start a run. Body `{"args": {...}}`; returns `202 {"runId"}`. Add `"wait": true` to wait and get `status` and `output` |
| `GET /api/runs` | Recent runs: pipeline, status, duration, cost |
| `GET /api/runs/<id>` | A run's events, and `paused` (`waitingFor`, `message`, `approveUrl`) while it waits |
| `POST /api/runs/<id>/signal` | Resume a paused run. Body `{"answer": "approve"}`, or `{"payload": {...}, "event": "Slack.Reaction"}` |
| `GET /api/health` | `{"ok": true, "pipelines": n}` |
| `GET /healthz` | `{"ok": true}`, without the token, for health checks |

```bash
curl -X POST localhost:8080/api/pipelines/TriageIssues/runs \
  -H 'Content-Type: application/json' -d '{"args": {"repo": "oven-sh/bun", "limit": 5}}'
```

## Security

- It listens on `127.0.0.1` by default. To listen on any other interface you must set `HALO_SERVE_TOKEN` (or `token`); it refuses to start otherwise, because the API starts runs that spend money and run data includes prompts and answers.
- Web pages can't drive the API from a browser. A request with an `Origin` other than localhost or `publicUrl` is refused, and so is a `POST` that isn't JSON (the kind a page can send without asking). The `Host` header must be localhost, the address it listens on, or `publicUrl`'s host, which stops DNS rebinding (a site pointing its own name at `127.0.0.1`).
- `/mcp` has the same `Origin`, `Host` and JSON checks as `/api`, and needs the token when one is set (see [MCP](../integrations/mcp.md#http)).
- `/slack/actions` accepts only requests signed with `slack.signingSecret`.
- Approval links are signed with the token, or with a random secret kept in `.halo/serve-secret`. Deleting that file invalidates outstanding links.
- Put it behind HTTPS (a reverse proxy such as Caddy) when it's reachable from the internet, and set `publicUrl` to that address.

## Running it in production

Run `halo serve` under a process manager (systemd, Docker, or a PaaS that runs containers) with the provider keys in its environment and `stateDir` on persistent storage. On `SIGTERM` it stops accepting requests and waits for running pipelines to reach a stopping point. Runs that are paused stay paused and continue after a restart.
