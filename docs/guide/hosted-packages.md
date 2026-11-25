# Hosted packages

Most of a package runs on the machine that uses it, with that person's keys: its agents use [model slots](./tool-packages.md#model-slots), so the consumer picks the models and pays for them. A **hosted export** turns that around. The pipeline runs on the publisher's own server, on the publisher's models and keys, and the package carries only its interface. Use it when you want to pay for the tokens (a service, a free tier, a metered API), or when the pipeline's prompts are yours to keep.

One package can have both: local exports that run on the consumer's models, and hosted pipelines that run on yours.

## Using a hosted package

You use a hosted pipeline like any other:

```halo
use "@acme/hosted-replies" { DraftReply, Draft }

pipeline Answer(ticket: String) -> Draft:
  ticket |> DraftReply(ticket: ticket, tone: "warm")
```

`halo add` says what that means before anything runs:

```
✓ @acme/hosted-replies@1.0.0
    network: replies.acme.com
    reads env: ACME_REPLIES_KEY
    sends your inputs to: replies.acme.com
  ! hosted: DraftReply runs on replies.acme.com, not on this machine. This package sends your inputs to replies.acme.com and reads ACME_REPLIES_KEY (the key @acme/hosted-replies's publisher issues you)
```

`halo info` shows the same, and `halo.lock` records the host under the package's `permissions.hosted`.

- **The key.** Set the variable the package names (`ACME_REPLIES_KEY` above) to the key the publisher gave you. Without it, the call fails with a message naming the variable. A key the server doesn't know fails with `refused the key in ACME_REPLIES_KEY (401)`.
- **Arguments** are checked when the program is linked (`halo validate`, `halo run`, the editor): a parameter the pipeline doesn't take, one it needs and doesn't get, and a value of the wrong type are errors, because the publisher's server would refuse the call.
- **Schemas** the interface names come with it. You can import them (`{ Draft }`) to use as types.
- **Each call** is `POST <endpoint>/api/pipelines/DraftReply/runs` with a `Halo-Package: @acme/hosted-replies@1.0.0` header and your key, and returns the run's output. It waits for the run, honours `@timeout` and cancellation, and is retried by `@retry` on 429 and 5xx answers.
- **An old version.** When the publisher stops serving the version you have, the call fails with `410` and asks you to run `halo update @acme/hosted-replies`.
- **Records.** To the runtime, a hosted pipeline is one tool call, `DraftReply.run`, with the effect `external`. It appears that way in telemetry, Studio, recordings and replays.

`halo plan` shows where your inputs go:

```
  1      DraftReply(...)
  1.0    DraftReply.run
         calls DraftReply.run: external
         hosted by @acme/hosted-replies: sends its inputs to replies.acme.com (key from ACME_REPLIES_KEY)

Acts on the world without asking: DraftReply.run
```

### Testing offline

Mock a hosted pipeline by its name, `"DraftReply"` (or `"DraftReply.run"`). Nothing is sent and no key is needed:

```json
{
  "DraftReply": { "reply": { "text": "Sorry about that! Here's how to fix it.", "tone": "warm" }, "confidence": 0.9 }
}
```

```bash
halo run main.halo --mocks mocks.json --arg ticket="My invite never came"
```

`--mock` alone mocks hosted pipelines too, with a placeholder answer; a pipeline that returns a schema (like `Draft`) needs a real-looking answer from a mocks file.

In code, `runtime.mockAll({ DraftReply: (req) => ... })` gets the arguments in `req.named`.

## Publishing a hosted package

Add `hosted` to the package's `halo.json`:

```json
{
  "name": "@acme/hosted-replies",
  "version": "1.0.0",
  "description": "Ticket tagging on your models, and reply drafting on Acme's",
  "exports": ["lib/replies.halo"],
  "models": { "fast": { "description": "Tags tickets.", "suggested": "anthropic/claude-haiku-4-5" } },
  "hosted": {
    "endpoint": "https://replies.acme.com",
    "auth": { "type": "bearer", "env": "ACME_REPLIES_KEY" },
    "exports": ["DraftReply"]
  }
}
```

- `endpoint` is where your `halo serve --package` answers (https; http only for localhost). Halo never follows a redirect from it, so the key isn't sent anywhere else. `halo add` and `halo install` warn when an endpoint is plain http, this machine, or a private address.
- `auth` says how consumers send their key: `bearer` (`Authorization: Bearer <key>`) or `header` with a `name` (`"name": "X-Acme-Key"`), read from the variable `env`. It is required. `env` must be a variable for your key only: the consumer's other secrets (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GITHUB_TOKEN`, `HALO_TOKEN`, `AWS_*` and the like) are refused.
- `exports` lists the hosted pipelines by name.

### Where the hosted source goes

The package file holds the `.halo` files your `exports` reach (the exported files and the files they `use` by relative path) and nothing else of your `.halo` source. Put hosted pipelines in a file that `exports` doesn't list and the exported files don't `use`, such as `hosted/draft.halo`:

```
acme-hosted-replies/
  halo.json
  README.md
  lib/replies.halo      exported: ships, runs on the consumer's models (model slots)
  hosted/draft.halo     hosted source: stays with you, runs on your server
```

A hosted file may `use` the exported ones (`use "../lib/replies.halo" { Reply }`), and its agents may name models (`agent Drafter [anthropic/claude-sonnet-4-5]`), since they never run on a consumer's machine. Agents in shipped files still use model slots.

`halo publish` refuses:

- a hosted pipeline declared in a file that ships (its source would ship with it);
- a hosted pipeline that isn't declared anywhere, or is declared twice;
- a hosted pipeline that can **pause**: one that reaches `|! yield`, `~> listen`, or an agent whose policies ask for approval (`ApproveTools`, `ApproveEffects`), directly or through the pipelines it calls. The consumer has no way to answer a pause yet;
- a hosted pipeline with link errors;
- a `.halotool` that holds `.halo` files its exports don't reach.

### What it publishes

For each hosted pipeline, `halo publish` links your project and writes an interface into the package: the pipeline's description (the `//` comment lines just above it), its parameters and return type, and the schemas they name, flattened to field and type. `--dry-run` shows them:

```
$ halo publish --dry-run
@acme/hosted-replies@1.0.0 (3 files, 2310 bytes, sha256 …)
    exports pipelines: Tag, DraftReply · agents: Tagger · schemas: Reply
    model slots: fast
    network: replies.acme.com
    reads env: ACME_REPLIES_KEY
    sends your inputs to: replies.acme.com
    hosted on replies.acme.com (https://replies.acme.com; consumers send Authorization: Bearer $ACME_REPLIES_KEY)
      DraftReply(ticket: String, tone: String) -> Draft  // Drafts a reply to a support ticket in the tone you ask for.
        schema Draft { reply: Reply, confidence: Number }
        schema Reply { text: String, tone: String }
Dry run: not published to https://registry.halolang.com
```

`halo pack` writes the same package file.

## Serving a hosted package

Run `halo serve --package` in the package's folder, on a machine that can reach your model providers:

```bash
export ANTHROPIC_API_KEY=...
export HALO_PACKAGE_KEYS="initech=hk_live_1a2b,globex=hk_live_3c4d"
export HALO_SERVE_TOKEN=...            # yours, for /api/usage and the rest of the API
halo serve --package . --host 0.0.0.0 --port 8080
```

It serves exactly the pipelines in `hosted.exports`, at `POST /api/pipelines/<name>/runs` and as MCP tools at `/mcp`. Nothing else in their files is reachable, and Halo Studio, schedules and webhooks are off. It refuses to start if a hosted pipeline can pause, or if it has no consumer keys.

Every request needs:

| Check | Missing or wrong |
|---|---|
| A consumer key, sent as `hosted.auth` says | `401` |
| `Halo-Package: <name>@<version>` (Halo sends it) | `400` when missing or for another package |
| The version this server runs | `410` with `{ "error": "...no longer served...", "code": "version_gone" }` |

The 410 is how you retire a version: deploy the new one, and consumers still on the old version are told to `halo update`. (`/mcp` checks the header when it's sent; MCP clients may leave it out.)

### Consumer keys

Issue one key per consumer, so you can revoke and meter each one. Keys come from any of:

- `HALO_PACKAGE_KEYS`: `id=key` pairs, comma separated.
- A JSON file, `.halo/package-keys.json` by default (or `--keys <file>`, or `"keysFile"` in `halo.json`). It maps consumer ids to keys; a value `"sha256:<hex>"` stores only the key's SHA-256, so the file never holds the key itself. The file is re-read when it changes: delete a line to revoke a key, with no restart.

```json
{
  "initech": "hk_live_1a2b",
  "globex": "sha256:9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"
}
```

`HALO_SERVE_TOKEN` is yours, not a consumer key: with it you reach every endpoint, including `GET /api/usage`. A consumer key only runs the hosted pipelines (and lists them at `GET /api/pipelines`).

Keep keys out of what you publish. The package folder's `halo.json` is also what `halo pack` and `halo publish` read, so keys must live in the environment or outside the package folder:

- `package-keys.json` is never packed, wherever it is.
- `halo pack` refuses a package whose `"keysFile"` is a file inside the folder, or whose `"stateDir"` is inside it and has files in it. Point them outside the folder, or keep the default `.halo` (never packed).
- `"token"` (and any other serve secret, such as `webhooks[].secret` or `slack.signingSecret`) must be an environment reference, `"token": "Env.HALO_SERVE_TOKEN"`, or left out (serve reads `HALO_SERVE_TOKEN`). A token written into `halo.json` stops `halo pack`.

### Metering

Every run is logged with the consumer's key id in the `hosted_usage` table of `.halo/telemetry.db`: the pipeline, run id, status, cost in USD, prompt and completion tokens, and duration. `GET /api/usage` (with your token; `?since=<ms since epoch>`) sums it per key:

```json
[
  { "key": "globex", "runs": 120, "failed": 2, "cost": 1.82, "promptTokens": 210400, "completionTokens": 48100 },
  { "key": "initech", "runs": 37, "failed": 0, "cost": 0.51, "promptTokens": 61200, "completionTokens": 14900 }
]
```

or query the table directly:

```bash
sqlite3 .halo/telemetry.db "SELECT key_id, COUNT(*), SUM(cost) FROM hosted_usage WHERE at >= strftime('%s','2026-11-01')*1000 GROUP BY key_id"
```

Billing is yours: the registry lists your endpoint and shows a "Hosted by" badge, and doesn't take part in the calls.

## Limits in this version

- Hosted pipelines can't pause, and can't call the consumer's tools: both need a way back to the consumer, designed later.
- A server runs one version of a package. To serve two at once, run two servers behind a router on the `Halo-Package` header.
