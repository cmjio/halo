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
  Schedule   0 9 * * 1-5 America/New_York → TriageIssues (next 11/3/2026, 9:00:00 AM)
```

Every file must validate, and pipeline names must be unique across the files you serve.

## Configuration: `halo.json`

All optional. `halo serve` reads `./halo.json` (or `--config <file>`). Strings like `"Env.NAME"` are read from the environment.

```json
{
  "files": ["workflows/"],
  "port": 8080,
  "publicUrl": "https://halo.example.com",
  "timezone": "America/New_York",
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
| `port`, `host` | Where to listen. Default `127.0.0.1:8080`. `PORT` and `HALO_HOST` in the environment win over these, and `--port` and `--host` win over everything (see [On a hosting platform](#on-a-hosting-platform)) |
| `token` | API token; the same as setting `HALO_SERVE_TOKEN`. If it names a variable (`Env.X`) that is empty or not set, the server refuses to start rather than run without one |
| `publicUrl` | The address people reach the server at, used in approval links. It can name a variable (`"Env.PUBLIC_URL"`); without it, `HALO_PUBLIC_URL` is used, then the address Render, Railway or Fly gives the app |
| `timezone` | The IANA time zone schedules run in unless they name their own `tz`, e.g. `"Europe/London"`. Default: the server's, which is usually UTC in a container |
| `schedules` | Start `pipeline` with `args` on a cron schedule (see [Schedules](#schedules)) |
| `webhooks` | `POST /hooks/<path>` starts `pipeline`, with a JSON body or a whole email (see [Inbound email](#inbound-email)) |
| `watches` | Start `pipeline` when a URL, file, or command's output changes |
| `notify.slack` | A Slack incoming-webhook URL to announce paused runs |
| `notify.webhook`, `notify.secret` | Your app's URL, and the secret Halo signs with. Halo POSTs there when a run completes, halts, fails or pauses (see [Run callbacks](#run-callbacks)). `notify.events` narrows which |
| `state.store` | Where a copy of the state folder is kept, for hosts whose disk doesn't outlive a deploy: `"s3://bucket/prefix"` or a folder (see [State without a disk](#state-without-a-disk)). Default: `HALO_STATE_STORE` |
| `resumeRuns` | `true` picks up runs that were cut short when the server stopped or died (see [Runs cut short](#runs-cut-short)) |
| `mocks` | A mocks file for [dry runs](#dry-runs) |
| `slack.signingSecret` | Your Slack app's signing secret. Adds Approve / Reject buttons to the announcements, answered at `POST /slack/actions`. If it names a variable that is empty or not set, the server refuses to start |
| `mcp` | `false` turns off the MCP endpoint at `/mcp`. Default on |
| `stateDir` | Where telemetry, paused runs, schedule and watch state, and the link-signing secret are kept. Default `.halo` |
| `recordings` | `{"serve": true}` records every served run to `<stateDir>/recordings`, as `halo run` does, so `halo replay`, `halo compare` and `halo evolve` can learn from production traffic. `keep` (default 50) is how many to keep. Recordings aren't redacted |
| `evolve` | Defaults for `halo evolve` and Studio's Evolve tab: `proposer`, `judge`, `models`, `maxCostRatio`, `holdout`, `concurrency`, `criteria` (see [`halo evolve`](../plan-and-replay.md#halo-evolve)) |
| `registry` | The package registry for `halo add`, `halo search` and `halo publish` (not used by `halo serve` itself; see [Packages](../tool-packages.md)). `registries` maps a scope to its own registry |

### Schedules

```json
"timezone": "Europe/London",
"schedules": [
  { "pipeline": "NightlyReorder", "cron": "0 2 * * *", "tz": "America/Los_Angeles", "catchup": "6h" },
  { "pipeline": "OptimizeHVAC", "cron": "*/15 * * * *", "args": { "campus": "lakeside" }, "catchup": "none" }
]
```

| Key | Meaning |
|---|---|
| `pipeline`, `args` | The pipeline to start, and its arguments |
| `cron` | Standard 5-field cron: minute, hour, day of month, month, day of week. Fields take `*`, numbers, ranges (`1-5`), lists (`1,15`), steps (`*/15`), and names (`jan`, `mon`). When day of month and day of week are both set, a day matches if either does |
| `tz` | The IANA time zone the cron is read in. Default: `timezone`, else the server's |
| `overlap` | `"skip"` (default): while this schedule's last run is still running, or paused waiting for an answer, a due run is skipped (and a paused run's notice is sent again). `"allow"` starts it anyway |
| `catchup` | How late a missed run may still start, e.g. `"30m"` or `"24h"`. Default `"1h"`. `"none"` never starts a run late |

| Expression | Runs |
|---|---|
| `0 9 * * 1-5` | 9:00 on weekdays |
| `*/15 * * * *` | every 15 minutes |
| `30 8 1 * *` | 8:30 on the 1st of each month |

**Restarts and outages.** `halo serve` records each schedule's last run in `<stateDir>/schedules.json`. A restart never runs the same slot twice. When the server was stopped or asleep through a slot, it runs the most recent missed one **once**, if that was due within `catchup`, and logs how many it missed. It never replays every missed slot, so a server that was down for a week doesn't start 672 runs of a 15-minute job. A schedule that's new to the state folder doesn't catch up on slots from before it existed.

**Clock changes** follow Vixie cron. A fixed time that doesn't exist on the day clocks go forward (`30 2 * * *` in most of the US and Europe) runs once at the jump, and one that happens twice when they go back runs once, the first time. A job whose minute or hour starts with `*` (`*/15 * * * *`, `0 * * * *`) follows real time, so it runs in both copies of a repeated hour.

**Only one server runs the schedules.** The first `halo serve` on a state folder takes `<stateDir>/scheduler.lock`. Another one on the same folder serves the API but doesn't start scheduled runs, and takes over when the first stops (or is gone for more than about two minutes). Servers with separate state folders, such as two machines or two containers without a shared volume, each run every schedule.

`GET /api/pipelines` lists each pipeline's schedules with their zone, next run, `lastStatus`, and how many runs were `skipped` and `missed`.

### Webhooks

A webhook takes JSON, a form post (`application/x-www-form-urlencoded`, as an object of its fields), or an email (below). For a Twilio number's text messages, see [Text messages](../files.md#text-messages).

The JSON body becomes the pipeline's arguments: fields that match parameter names are passed by name, and a pipeline with a single parameter that isn't in the body gets the whole body (handy for GitHub or Stripe events).

With a `secret`, a request must either carry it in an `x-halo-secret` header (or `?secret=`), or be signed GitHub-style with `x-hub-signature-256`. Requests without it get `401`. If the secret names a variable that is empty or not set, the server refuses to start rather than accept unsigned requests. A webhook with no `secret` at all is open to anyone who can reach it, and the server warns about it at startup. It still refuses requests a web page sends through someone's browser: an `Origin` other than localhost or `publicUrl`, and, when listening on localhost, a `Host` that isn't (DNS rebinding).

### Inbound email

A webhook also takes a whole email, posted as `Content-Type: message/rfc822`. The pipeline gets it parsed, in the shape the [`Email` tool](../../stdlib/tools.md#email) reads mail: `{ id, from, fromName, to, cc, subject, date, text, html, attachments, messageId, inReplyTo, headers }`, plus `envelope` (`from`, `to`) when the request carries `X-Envelope-From` and `X-Envelope-To`.

```json
"webhooks": [{ "path": "inbound-mail", "pipeline": "HandleEmail", "secret": "Env.MAIL_HOOK_SECRET" }]
```

```halo
pipeline HandleEmail(email: JSON) -> Result:
  email |> Helper.answer("Answer {{email.subject}} from {{email.from}}: {{email.text}}")
```

With [Cloudflare Email Routing](https://developers.cloudflare.com/email-routing/), route an address to a Worker that hands the message on:

```js
export default {
  async email(message, env) {
    const res = await fetch(`${env.HALO_URL}/hooks/inbound-mail`, {
      method: "POST",
      headers: { "Content-Type": "message/rfc822", "X-Halo-Secret": env.MAIL_HOOK_SECRET, "X-Envelope-From": message.from, "X-Envelope-To": message.to },
      body: await new Response(message.raw).arrayBuffer(),
    });
    if (!res.ok) message.setReject("This address can't take mail right now");
  },
};
```

- The message's `Message-ID` is the run's [idempotency key](#starting-a-run-once) (unless the request sends its own), so a delivery that is retried starts one run.
- `envelope.from` is who the sending server said it was; the `from` header is whatever the message claims. Mail is input from strangers: treat `text` like any other untrusted input (see [Guardrails](../architecture/guardrails-and-safety.md)).
- Attachments are listed by name, type and size; their contents aren't passed on.
- Any mail server that can pipe a message to a command works the same way: `curl --data-binary @- -H 'Content-Type: message/rfc822' ...`.

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
‖ TriageIssues is waiting for a human: approve = save the report, label = …, reject = discard
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

## Serving a hosted package

`halo serve --package <dir>` serves the hosted pipelines of a package you publish, on your models and keys, to the people who installed it: exactly the pipelines in its `hosted.exports`, behind the key in `hosted.auth`, checked against the `Halo-Package` version each call sends. See [Hosted packages](../hosted-packages.md).

## MCP

`/mcp` serves every pipeline as an MCP tool over Streamable HTTP, behind the API token. See [MCP](../integrations/mcp.md#http).

## HTTP API

Every `/api` request needs `Authorization: Bearer <token>` when a token is set. `POST` requests must be `Content-Type: application/json`.

| Request | Does |
|---|---|
| `GET /api/pipelines` | Pipelines with their parameters, webhooks, and schedules: each one's `cron`, `tz`, `next` run, `lastSlot`, `lastRunId`, `lastStatus`, and how many runs were `skipped` and `missed` |
| `POST /api/pipelines/<name>/runs` | Start a run. Body `{"args": {...}}`; returns `202 {"runId"}`. Add `"wait": true` to wait and get `status` and `output`, an `Idempotency-Key` header to [start it once](#starting-a-run-once), and `"dryRun": true` for a [dry run](#dry-runs) |
| `GET /api/runs` | Recent runs: pipeline, status, duration, cost |
| `GET /api/runs/<id>` | A run's events, and `paused` (`waitingFor`, `message`, `approveUrl`) while it waits |
| `POST /api/runs/<id>/signal` | Resume a paused run. Body `{"answer": "approve"}`, or `{"payload": {...}, "event": "Slack.Reaction"}` |
| `POST /api/runs/<id>/stop` | Stop a running run: the stage it's on is cut short and the run fails as stopped. Body `{"reason": "..."}` (optional). With `@checkpoint`, it can be resumed. See [Stopping, resuming and budgets](#stopping-resuming-and-budgets) |
| `POST /api/runs/<id>/budget` | Raise every `MaxSpend` limit of a running or paused run, for that run only. Body `{"add": 1.00}` (USD) |
| `POST /api/runs/<id>/resume` | Continue a failed, stopped or halted `@checkpoint` run from its last finished stage, as the same run. Body `{"addBudget": 1.00}` (optional), `"wait": true` to wait |
| `POST /api/runs/<id>/rewind` | Run a `@checkpoint` run again from one of its steps, as a new run. Body `{"step": 3, "addBudget": 1.00}`; returns `202 {"runId", "rewoundFrom"}` |
| `GET /api/runs/<id>/steps` | A `@checkpoint` run's steps, to rewind to: `step`, `label`, `at`, `cost`, `tokens` |
| `GET /api/evolve` | Evolve runs, running and finished, newest first |
| `POST /api/evolve` | Start one in the background. Body `{"pipeline": "Name", "variants": 4, "rounds": 2, "budget": 3, "criteria": "..."}`; returns `202 {"id"}`. Needs `minRuns` (default 10) finished recordings |
| `GET /api/evolve/<id>` | Its progress while it runs (`log`, and `now`: what it's doing at the moment, since `nowSince`), then its `evolve.json` (`record`), every variant's diff, and the report |
| `POST /api/evolve/<id>/apply` | Write a variant (`{"variant": "v2"}`, default the winner) over its file. Refused when the file changed since. The server keeps serving the version it loaded until restarted |
| `GET /api/blobs/<sha256>` | A [file](../files.md) a run holds. Images, audio and video are shown in place; documents are downloads. A file in a run's `output` carries its `url`. An approval link shows the files in what it asks about without the token |
| `GET /api/health` | `{"ok": true, "pipelines": n}` |
| `GET /healthz` | `{"ok": true, "version", "startedAt"}`, without the token, for health checks. Also `build` (whatever `HALO_BUILD` is set to: an image tag, a commit) and `project` (the [pushed version](./deploying.md#deploy-without-building-an-image) being served), so a deploy script can tell that the server answering is the one it just deployed |

```bash
curl -X POST localhost:8080/api/pipelines/TriageIssues/runs \
  -H 'Content-Type: application/json' -d '{"args": {"repo": "oven-sh/bun", "limit": 5}}'
```

A file argument (`Image`, `Document`, `Audio`, `Video`) is a `data:` URI or an https URL in the JSON, or the request is a `multipart/form-data` upload (see [Files](../files.md#giving-a-pipeline-a-file)). A request body can be up to 256 MB.

### Starting a run once

Send an `Idempotency-Key` header (or `"idempotencyKey"` in the body) with a start, and starting again with the same key returns the first run instead of starting another:

```bash
curl -X POST localhost:8080/api/pipelines/PayWinners/runs \
  -H 'Content-Type: application/json' -H 'Idempotency-Key: challenge-9:confirmation-3' \
  -d '{"args": {"challenge": 9}}'
# 202 {"runId": "6f9696ef-…", "status": "running"}
# again, same key:
# 202 {"runId": "6f9696ef-…", "status": "completed", "duplicate": true}
```

- A key belongs to one pipeline, and is remembered for 7 days in `<stateDir>/idempotency.json`.
- Webhooks take the header too, so a sender that retries a delivery doesn't start a second run.
- The key also seeds the [idempotency key of every tool call](../../stdlib/tools.md#idempotency-keys) the run makes. So even if the first run is gone (the server lost its state), a second run with the same key sends the same keys to your tools, and a ledger that honours them pays once.
- Use a key that names the thing the run is for and nothing else. A key built from a time window repeats when the same thing legitimately happens twice in the window.

### Run callbacks

Instead of asking the API whether a run has finished, have Halo tell your app:

```json
"notify": { "webhook": "https://app.example.com/halo/events", "secret": "Env.HALO_CALLBACK_SECRET" }
```

When a run completes, halts, fails or pauses, Halo POSTs:

```json
{ "id": "0d3c…", "type": "run.completed", "at": "2026-11-19T10:04:11.000Z",
  "runId": "6f9696ef-…", "pipeline": "ScoreEntries", "status": "completed",
  "output": { "scored": 42 }, "cost": 0.0121, "durationMs": 1834, "idempotencyKey": "challenge-9" }
```

| `type` | Also carries |
|---|---|
| `run.completed`, `run.halted` | `output`, `cost`, `durationMs` |
| `run.failed` | `error` |
| `run.paused` | `waitingFor`, and `approveUrl`: the signed link that answers it |

A run that pauses and is answered sends `run.paused`, then its ending. `"events": ["completed", "failed"]` sends only those. A [dry run](#dry-runs) says `"dryRun": true`.

**Check the signature.** Each request has `Halo-Signature: t=<unix seconds>,v1=<hex>`, where the hex is HMAC-SHA256 of `<t>.<raw body>` with your secret. Refuse a request whose signature doesn't match or whose `t` is more than five minutes old:

```ts
// Works in Node, Bun, Deno and Workers. `raw` is the body exactly as received, before parsing.
async function fromHalo(secret: string, raw: string, header: string | null): Promise<boolean> {
  const parts = Object.fromEntries((header ?? "").split(",").map((p) => p.split("=")));
  if (!parts.t || !parts.v1 || Math.abs(Date.now() / 1000 - Number(parts.t)) > 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const given = Uint8Array.from(parts.v1.match(/../g) ?? [], (h: string) => parseInt(h, 16));
  return crypto.subtle.verify("HMAC", key, given, new TextEncoder().encode(`${parts.t}.${raw}`));
}
```

From Bun code that uses [Halo as a library](../sdk.md), `verifySignature(secret, raw, header)` does the same.

**Deliveries repeat.** Answer with a 2xx within 15 seconds. On a 5xx, 408, 429 or no answer, Halo tries again after 2 seconds, 10 seconds and a minute, then logs that it gave up; any other 4xx is not retried. Every try of one event has the same `id` (also in `Halo-Delivery`), so ignore an `id` you have already handled. A callback is not kept across a restart: the run's state is, so `GET /api/runs/<id>` remains the source of truth.

`notify.webhook` needs `notify.secret`: the server refuses to start without it, because an unsigned callback could be sent by anyone who knows the URL.

### Dry runs

A dry run goes through the real server (the same files, config, routes, callbacks and telemetry) with every model and tool answered from mocks, so nothing is sent anywhere and nothing is spent:

```json
"mocks": "ai/mocks/pay-winners.json"
```

```bash
curl -X POST localhost:8080/api/pipelines/PayWinners/runs \
  -H 'Content-Type: application/json' -d '{"args": {"challenge": 9}, "dryRun": true, "wait": true}'
```

- The mocks file is the one [`halo test --mocks`](../plan-and-replay.md) reads: answers by `Agent.method`, `Tool.method`, `yield` and so on. A tool marked `"live"` runs for real. Anything the file doesn't name answers with a placeholder, as under `--mock`.
- `"dryRun": true` in the body, or a `Halo-Dry-Run: 1` header, makes that one run dry; other runs on the same server are real.
- A dry run that pauses stays dry when it is answered. It keeps `@thread` state in memory, isn't recorded for `halo replay`, and has its own idempotency keys, so a rehearsal can't use up the key of the real run.
- `halo serve --mocks <file>` (or `--mock`) makes every run a dry run. `/healthz` then says `"dryRun": true`, so nobody mistakes a rehearsal server for the real one.

## Stopping, resuming and budgets

`GET /api/runs/<id>` includes `controls`: what can be done to the run right now.

```json
"controls": {
  "stoppable": true,
  "resumable": false,
  "rewindable": true,
  "steps": 4,
  "stopped": false,
  "budget": { "limit": 2.0, "limits": [2.0], "added": 0.5, "spent": 1.62 }
}
```

- **Stop** works on a run this server is running. A run waiting for an answer isn't running: reject it to end it.
- **Resume** and **rewind** need `@checkpoint` on the pipeline, since they start from the state it saved after each stage. Resume continues the same run after its last finished stage (the stage it failed or was stopped in runs again from its start). Rewind starts a new run from any step. Both use the pipeline as the server loaded it.
- **The budget** is the lowest `MaxSpend` among the agents (`limit`; `limits` lists them all) plus what has been `added`, against what the run has `spent`. A resumed or rewound run carries its spend over, so a run that ran out needs more added to get anywhere: send `addBudget` with the resume. An extension belongs to that run, is kept through checkpoints, resumes and rewinds, and never changes the file. Studio offers it once a run has spent 80% of its budget.

```bash
curl -X POST localhost:8080/api/runs/$RUN/budget -H 'Content-Type: application/json' -d '{"add": 1}'
curl -X POST localhost:8080/api/runs/$RUN/resume -H 'Content-Type: application/json' -d '{"addBudget": 1}'
```

## Security

- It listens on `127.0.0.1` by default (on `0.0.0.0` when `PORT` is set). To listen on any other interface you must set `HALO_SERVE_TOKEN` (or `token`); it refuses to start otherwise, because the API starts runs that spend money and run data includes prompts and answers.
- Web pages can't drive the API from a browser. A request with an `Origin` other than localhost or `publicUrl` is refused, and so is a `POST` that isn't JSON (the kind a page can send without asking). The `Host` header must be localhost, the address it listens on, or `publicUrl`'s host, which stops DNS rebinding (a site pointing its own name at `127.0.0.1`).
- `/mcp` has the same `Origin`, `Host` and JSON checks as `/api`, and needs the token when one is set (see [MCP](../integrations/mcp.md#http)).
- `/slack/actions` accepts only requests signed with `slack.signingSecret`.
- What Halo sends your app (run callbacks, `Handoff` items) is signed with a secret you set; check it as [Run callbacks](#run-callbacks) shows.
- Approval links are signed with the token, or with a random secret kept in `.halo/serve-secret`. Deleting that file invalidates outstanding links.
- Put it behind HTTPS (a reverse proxy such as Caddy) when it's reachable from the internet, and set `publicUrl` to that address.

## Running it in production

Run `halo serve` under a process manager (systemd, Docker, or a PaaS that runs containers) with the provider keys in its environment and `stateDir` on persistent storage. On `SIGTERM` it stops accepting requests and waits for running pipelines to reach a stopping point. Runs that are paused stay paused and continue after a restart.

The [`ghcr.io/cmjio/halo` image](./deploying.md#the-container-image) runs `halo serve` on `/app`, so most hosts need no Dockerfile of your own. With [`halo push`](./deploying.md#deploy-without-building-an-image) they need no image of your own either.

### State without a disk

Some hosts give a container a disk that is thrown away on every deploy. There, keep a copy of the state folder in object storage:

```json
"state": { "store": "s3://my-bucket/halo/prod" }
```

- On start, before anything else, the folder is filled from the store. While the server runs, a file that changed is copied up within a second (databases at most every `"every"`, default `"30s"`), and everything once more when it stops.
- Images and documents runs hold (`blobs/`) are copied up as soon as they are made, and brought down only when a run needs one, not at start.
- So after a deploy the new container has the paused runs, the link-signing secret (links people were already sent still work), schedule state, idempotency keys, `@thread` state, vector stores, checkpoints and telemetry.
- `s3://bucket/prefix` is any S3-compatible store: AWS S3, Cloudflare R2, Google Cloud Storage, MinIO, Spaces. Credentials come from `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY` (or the `AWS_` names), the endpoint from `S3_ENDPOINT` (for R2, `https://<account-id>.r2.cloudflarestorage.com`) and the region from `S3_REGION`. A plain path is a folder, for a shared mount.
- It can be set without touching `halo.json`: `HALO_STATE_STORE=s3://my-bucket/halo/prod`.
- It is a copy for one server at a time, not a shared database. Two servers writing one store overwrite each other's files. During a deploy the old and new server overlap briefly; a run the old one pauses in that window is fetched from the store when someone answers it.
- What is lost if the machine dies without warning: whatever changed since the last copy, which is at most `every` of telemetry and under a second of everything else.
- If the store can't be reached at start, the server doesn't start: running with an empty state folder would forget paused runs and repeat scheduled ones.

### Runs cut short

By default a run that is in flight when the server dies is lost: Studio shows it as unfinished. With `"resumeRuns": true`, the server keeps each run's state after every stage (in `<stateDir>/running`), and a server that starts and finds one there continues it at the stage it was on.

- Stages that finished are not run again. The stage that was in flight is, from its start: its model calls are made again, and so are its tool calls.
- Those tool calls carry the [same idempotency keys](../../stdlib/tools.md#idempotency-keys) as the first time. Turn this on when the tools that act on the world honour them (`idempotencyKey: true` on a `POST`, `Email` through Resend, `Handoff`), or when doing a step twice is harmless.
- A stage inside a fan-out, `each`, or a called pipeline restarts with the top-level stage that contains it.
- A run that has been picked up three times and cut short each time is not picked up a fourth: it is marked failed, and the log says why. So a run that crashes the server can't keep doing it.
- With a [state store](#state-without-a-disk), the state kept after each stage is copied too, so this works across a deploy onto a new machine.
- On `SIGTERM` the server still waits for running pipelines before it exits. If the host kills it first, the next start continues them.

### On a hosting platform

Render, Railway, Heroku, Cloud Run, Fly and similar hosts set `PORT` and expect the app to answer on it from outside the container. `halo serve` follows that:

- `PORT` sets the port, over `halo.json`'s `port`. `--port` still wins.
- When `PORT` is set and nothing names a host, it listens on `0.0.0.0`. That needs `HALO_SERVE_TOKEN`, as any address but localhost does, and it refuses to start without one. Set `HALO_HOST=127.0.0.1` to keep it local, for example behind a sidecar proxy.
- Approval links use `publicUrl`, then `HALO_PUBLIC_URL`, then the address the platform gives the app: `RENDER_EXTERNAL_URL` on Render, `https://$RAILWAY_PUBLIC_DOMAIN` on Railway, `https://$FLY_APP_NAME.fly.dev` on Fly. With none of them, it warns at startup that links will point at an address people can't open.
- Paused runs and schedule state are files in `stateDir` (`.halo`). On a host without a persistent disk they're lost when the app restarts, so attach a volume at `/app/.halo` (Fly volumes, Render disks, Railway volumes) or set a [state store](#state-without-a-disk). Without either, a restart forgets which scheduled runs already happened and which are still paused.
- Containers run in UTC. Set `timezone` in `halo.json` (or `tz` on a schedule) so `0 9 * * 1-5` means 9:00 where your users are.
- Run one instance, or give every instance the same volume. Instances with their own `stateDir` each run every schedule.
