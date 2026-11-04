# Web monitor and digest

A Halo blueprint: a complete, deployable app, not a snippet. It watches the pages you care about (competitors' pricing, a changelog, a status page, a regulator's notices), notes each change that matters to you, and emails one digest every weekday morning.

```
every hour ─▶ CheckAll(sources) ─▶ CheckSource, for each page
  ├─ read the page, compare it with the last reading
  └─ changed? ─▶ does it matter? ─▶ note it for the digest   (NoteChange)
weekdays 8:00 ─▶ SendDigest ─▶ email, if anything was noted
```

Checking a page that hasn't changed costs nothing: a model only looks at pages whose text changed, and decides whether the change matters (a new price does, a rotated testimonial doesn't).

| File | What it is |
|---|---|
| `pipelines/monitor.halo` | The workflow: `CheckAll`, `CheckSource`, `NoteChange` and `SendDigest` |
| `halo.json` | The service: the pages to watch, and when to check and send |
| `samples/` | A list of pages, and canned answers for offline tests |
| `Dockerfile`, `fly.toml` | Deployment |
| `.env.example` | Every key it needs, and where to get it |

## 1. Try it offline (no keys)

```bash
halo test pipelines/monitor.halo -p CheckAll --body samples/sources.json --mocks samples/mocks.json
```

The first run records each page ("first reading"); run it again and they're "unchanged". Now change the page text in `samples/mocks.json` (`Page.fetch` → `content`) and run it a third time: the change is noted. Then send the digest:

```bash
halo test pipelines/monitor.halo -p SendDigest --mocks samples/mocks.json
```

It sends once, then clears what it sent: run it again and it stops early with nothing to send. Delete `.halo/` to start again.

## 2. Choose your pages

In `halo.json`, list the pages under the `CheckAll` schedule's `sources`:

```json
{ "name": "Rival pricing", "url": "https://rival.com/pricing", "watch_for": "plan prices, limits, new or removed plans" }
```

`watch_for` tells the model what counts as a change worth noting. Change the `cron` lines to check more or less often, or send the digest at another time.

## 3. Run it for real

```bash
cp .env.example .env     # add ANTHROPIC_API_KEY, RESEND_API_KEY, DIGEST_FROM and DIGEST_TO
halo run pipelines/monitor.halo -p CheckAll --body samples/sources.json
halo serve               # checks every hour and sends at 8:00 on weekdays, in the server's time zone
```

## 4. Deploy

Halo needs a host that runs a long-lived process with a disk: the last reading of each page, and the changes waiting for the digest, are kept in `.halo/`.

**Fly.io**

```bash
fly launch --copy-config --no-deploy        # pick a name, then set it in fly.toml's HALO_PUBLIC_URL
fly volumes create halo_state --size 1
fly secrets set ANTHROPIC_API_KEY=... RESEND_API_KEY=... DIGEST_FROM=monitor@yourcompany.com \
  DIGEST_TO=team@yourcompany.com HALO_SERVE_TOKEN=$(openssl rand -hex 24)
fly deploy
```

Schedules use the server's time zone, which is UTC on Fly.io: set `TZ` (for example `TZ=Europe/London` under `[env]` in `fly.toml`) to send at 8:00 local time.

**Anywhere else that runs a container**: build the `Dockerfile`, mount a volume at `/app/.halo`, set the variables from `.env.example`, and expose port 8080. `GET /healthz` answers health checks.

## Make it yours

- **Slack instead of email:** add `tool Team : Slack(Env.SLACK_BOT_TOKEN, channel: "#market")` and replace `Mail.send` with `Team.post(text: "{{digest}}")`.
- **Alert right away:** for a page that can't wait for the digest (a status page), call `Team.post` in `NoteChange`'s branch as well as `Changes.log`.
- **JSON APIs and feeds:** for a JSON endpoint or a file, use a `watches` entry in `halo.json` instead: it compares readings itself and passes the changes to a pipeline.
- **Search past changes:** every noted change is also tagged `"change"` and kept, so `Changes.search(query: "pricing", tags: ["change"])` finds the history.

## What it doesn't do yet

- Pages that need JavaScript to show their content read as empty. Use the `Chrome` provider (see [Chrome](https://halolang.com/stdlib/chrome)) in place of `Browser` for those.
- Pages that change on every load (a clock, a random quote) cost one small model call per check. Point `url` at a quieter page, or add the noise to `watch_for` so it's ignored.
- A day with no changes sends nothing, and that run shows as "halted" in Studio.
