# Customer chat

A Halo blueprint: a complete, deployable app, not a snippet. The assistant behind your site's chat box. It remembers each customer's conversation, looks up their own orders in your database, answers from your store policies, and hands the chat to a person in Slack when it can't help: refunds, damaged items, complaints, anything it isn't sure of. It never moves money.

```
your backend ─▶ POST /api/pipelines/Chat/runs ─▶ Chat(user_id, msg)
  ├─ this customer's orders + your store policies   (in parallel)
  ├─ answer, with the conversation so far   (@thread per customer)
  └─ needs a person? ─▶ HandOff ─▶ Slack, with the conversation
```

| File | What it is |
|---|---|
| `pipelines/chat.halo` | The workflow: `Chat` and `HandOff` |
| `policies/store-policies.md` | What the assistant answers from. Replace it with yours |
| `db/schema.sql` | An `orders` table with sample rows, if you want to try it against Postgres |
| `samples/` | Example messages, and canned answers for offline tests |
| `Dockerfile`, `fly.toml` | Deployment |
| `.env.example` | Every key it needs, and where to get it |

## 1. Try it offline (no keys)

```bash
halo test pipelines/chat.halo -p Chat --body samples/message.json --mocks samples/mocks.json
```

`samples/mocks.json` has canned orders and a canned answer, and reads `policies/` for real. `halo test` keeps the conversation in memory only, so each test starts fresh.

## 2. Run it for real, locally

```bash
cp .env.example .env              # add ANTHROPIC_API_KEY and DATABASE_URL
psql "$DATABASE_URL" -f db/schema.sql   # or point the SELECT in chat.halo at your own table
halo run pipelines/chat.halo -p Chat --body samples/message.json
halo run pipelines/chat.halo -p Chat --body samples/refund.json      # hands off (needs SLACK_*)
```

`halo run` keeps each customer's conversation between runs: `halo thread Chat cus_dana` shows it, and `halo thread Chat cus_dana --reset --yes` clears it.

## 3. Call it from your backend

Run `halo serve`, then call it from your own server, never from the browser:

```ts
// In your backend, after your own login check. user_id comes from the session, not the request.
const res = await fetch(`${HALO_URL}/api/pipelines/Chat/runs`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${HALO_SERVE_TOKEN}` },
  body: JSON.stringify({ args: { user_id: session.customerId, msg: body.message }, wait: true }),
});
const { status, output } = await res.json();
// status "completed": show output.reply. output.handoff is true when a person will follow up.
```

`user_id` decides whose orders are read and whose conversation continues, so it must come from your session. The API token must stay on your server: anyone with it can start any pipeline here.

A teammate who takes over answers the customer in your own support tool. To let the assistant pick up again later, clear the flag with `halo thread Chat <user_id> --reset --yes` (that also clears the history), or leave it: the assistant only hands off again for a new problem.

## 4. Deploy

Halo needs a host that runs a long-lived process with a disk: each customer's conversation is kept in `.halo/`.

**Fly.io**

```bash
fly launch --copy-config --no-deploy        # pick a name, then set it in fly.toml's HALO_PUBLIC_URL
fly volumes create halo_state --size 1
fly secrets set ANTHROPIC_API_KEY=... DATABASE_URL=... SLACK_BOT_TOKEN=... SLACK_CHANNEL='#support' \
  HALO_SERVE_TOKEN=$(openssl rand -hex 24)
fly deploy
```

**Anywhere else that runs a container**: build the `Dockerfile`, mount a volume at `/app/.halo`, set the variables from `.env.example`, and expose port 8080. `GET /healthz` answers health checks.

Use a read-only database user. The `PostgreSQL` tool already refuses anything but `SELECT`, and the query is written in the pipeline, not by the model, but a read-only user makes that true at the database too.

## Make it yours

- **Your tables:** edit the `SELECT` in `Chat`. Keep `WHERE customer_id = $1` with `params: [user_id]`: that's what keeps one customer from seeing another's orders.
- **More facts:** add files to `policies/` and read them alongside `store-policies.md`, or search a help center as in the `support-inbox` blueprint.
- **When to hand off:** the rules are in the `Assistant.reply` prompt.
- **Refunds:** to let it start refunds, add a pipeline that pauses with `|! yield` for a person, then calls your payment provider, and hand off to it instead of Slack. Keep a person in that loop.
- **Cost:** `MaxSpend(0.03)` caps each message. `halo plan pipelines/chat.halo` shows the worst case.

## What it doesn't do yet

- Replies aren't streamed: your backend gets the whole answer when it's ready (usually a few seconds).
- There's no chat widget: you render the conversation in your own front end.
- A teammate's replies in Slack don't reach the customer. Answer them in your support tool.
