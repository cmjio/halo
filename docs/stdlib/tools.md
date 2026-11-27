# Built-in Tools

Declare a tool with `tool Name : Provider(args)`. A pipeline can call it directly (`|> Name.method(...)`), an equipped agent can call it first (`Agent.task(tool: Name, ...)`), or an equipped agent can choose its own calls (`Agent.task(tools: [Name])`, see [Agents with Tools](../guide/agents-with-tools.md)). If a call has no positional arguments, its first argument is the flowing value (Browser's URL, a memory search's query, a File entry); REST and POST don't send it. Tokens can be written as `Env.NAME` or `"Env.NAME"`, and they are read only when the tool is used.

**A value read from `Env` is masked if a service sends it back.** Some services quote what they were sent, like an error page that repeats the `Authorization` header. Halo remembers each value it reads from `Env.NAME` (and the model providers' keys), and replaces it with `[secret NAME]` in every tool result and error, before the model, the terminal, telemetry, recordings, Studio or an `onEvent` callback sees it. The values stay in memory only. A value isn't masked if it is under 8 characters, a number, `true` or `false`, a word like `production` or `us-east-1`, a host name, a path, or a URL without a user, password or query, unless the variable's name has `KEY`, `TOKEN`, `SECRET`, `PASS`, `AUTH` or a similar word in it (then any value of 8 or more characters is masked). Masking catches accidents. A tool that re-encodes a value (base64, URL-encoding) gets past it, so keep keys out of what a tool returns.

| Provider | What it does |
|---|---|
| `REST` / `GET` | HTTP GET, JSON or text response |
| `POST` | HTTP POST with a JSON, form or multipart body; can send files |
| `PostgreSQL` / `SQL` | SQL queries, read-only by default |
| `Bash` | Run a shell command |
| `Browser` | Fetch a page's readable text |
| `Chrome` | A headless browser tab that runs JavaScript, clicks and types (see [Chrome](./chrome.md)) |
| `File` | JSON-file history or notes (see [Stores](./stores.md)) |
| `VectorStore` | Searchable memory, with hashed or model embeddings, in SQLite or Postgres (see [Stores](./stores.md) and [Embeddings](./embeddings.md)) |
| `Workspace` | Read, search and edit files in one folder (see [Local Tools](./local-tools.md)) |
| `KV` | A key-value store in a local SQLite file (see [Local Tools](./local-tools.md)) |
| `SQLite` | A SQLite database file in the project: parameterised reads and writes, read-only by default (see [SQLite](./sqlite.md)) |
| `Code` | Run a JavaScript, TypeScript or Python snippet in its own process (see [Local Tools](./local-tools.md)) |
| `Documents` | Text from text, HTML, CSV, JSON, Word, PowerPoint, email and PDF files (see [Local Tools](./local-tools.md)) |
| `Transcribe` | Speech to text, with OpenAI or Gemini (see [Files](../guide/files.md#audio-and-transcription)) |
| `SMS` | Send text messages through Twilio (see [Files](../guide/files.md#text-messages)) |
| `Clock` | The date and time, date arithmetic, timezones (see [Utility Tools](./utility-tools.md)) |
| `Calc` | Exact arithmetic expressions and statistics (see [Utility Tools](./utility-tools.md)) |
| `Data` | Filter, sort, group, aggregate, join and diff JSON; CSV (see [Utility Tools](./utility-tools.md)) |
| `Git` | Read a local git repository; commit with `write: true` (see [Utility Tools](./utility-tools.md)) |
| `WebSearch` | Web search through Brave, Tavily, Serper or Exa (see [Utility Tools](./utility-tools.md)) |
| `Skills` | A library of instructions an agent loads when it needs them (see [Skills](./skills.md)) |
| `Remote` | A remote computer: a server over SSH, or a sandbox (E2B, Daytona, or a local Docker container) for the run (see [Remote Computers](./remote.md)) |
| `MCP` | Any Model Context Protocol server's tools (see [MCP](../guide/integrations/mcp.md)) |
| `Slack`, `Email`, `GitHub`, `Linear`, `Figma` | API clients for those services |
| `Handoff` | Hands an item to your own app, signed, to act on (see [Handoff](#handoff)) |

More providers come in [packages](../guide/tool-packages.md) (`halo add stripe`), and `halo tools` lists every provider in a project with its methods and their effects.

## Rules on a tool's arguments

Rules written after the provider say what a tool's arguments may be, for everything that calls it:

```halo
tool Ledger : POST("ledger.example.com/v1/prizes/issue", apiKey: Env.LEDGER_KEY, idempotencyKey: true)
  & Fixed("currency", "USD")
  & Match("amount", "\\d+(\\.\\d\\d)?")
  & Match("winner", "[a-z0-9_]{3,32}")
  & Locked("memo")
```

| Rule | What it does |
|---|---|
| `Fixed("arg", value)` | Every call sends this value. A model isn't shown the argument, and a call that sets it to anything else is refused. The value is a literal or `Env.NAME` |
| `Match("arg", "regex")` | The argument's whole value must match. A missing argument is checked as `""`, so a pattern that needs something also makes the argument required |
| `Locked("arg", ...)` | A model may not set these, and isn't shown them. A pipeline's own calls still can |
| `Unlocked("arg", ...)` | Undoes a default lock (see below) |

- `Fixed` and `Match` hold for a pipeline's own calls as well as a model's: a call that breaks one fails with `TOOL_ARGUMENT`. `Locked` is only about models.
- A `Match` pattern covers the whole value: `"\\d+"` accepts `25` and refuses `25; and 9000 more`. It is case-sensitive.
- A model's call that breaks a rule isn't made. The model is told why, the run goes on, and the refusal is recorded in `context.meta.violations` with the tool's name as the policy and `phase: "tool"`, like a call refused by a [policy](./policies.md#tool-rules).
- The rules apply to the named argument on every method of the tool.
- They are checked before an approval is asked for, so a person is never asked to approve a call the tool would refuse.

**`query:` is locked by default on `GET`, `REST` and `POST` tools.** It's a raw query string, so a model could put any parameter in it, including ones the tool's rules lock, fix or pattern-check, and many servers read the URL and the body as one. A model's call can't set `query:` unless the declaration says `& Unlocked("query")`, and even then (or in a pipeline's own call) a key in it that a `Locked`, `Fixed` or `Match` rule names is refused: pass that one as its own argument, where the rule sees it.

**A `POST` tool's `path` is locked by default.** A `POST` tool is bound to the address it declares, so a model that calls it can't add a path under that address unless the declaration says `& Unlocked("path")`. A pipeline's own call can still pass `path:`. Use [`DenyArgs`](./policies.md#tool-rules) when a limit belongs to one agent and not to the tool. This changed in Halo 1.4.0: [`halo migrate`](../guide/production/upgrading.md) lists the tools it affects in a project written before then.

## `REST` / `GET` and `POST`

```halo
tool GitHub : REST("api.github.com")
tool Hook   : POST("hooks.example.com/ingest", apiKey: Env.HOOK_TOKEN, sendInput: false)

pipeline Issues(repo: String) -> Result:
  repo
    |> GitHub.search(path: "/search/issues", q: "repo:{{repo}} is:open", per_page: 5) as found
    |> Hook.send(count: context.data.found.total_count)
```

- The first argument is the base URL. `https://` is added if it's missing.
- `apiKey:` adds `Authorization: Bearer …`.
- **GET** requests `base + path`. When there is no `path:`, it requests `base/<method>`; a method named `get`, `fetch`, `request`, `call`, `execute`, or `send` (or a call by an agent) requests just `base`. Named arguments become query parameters. `query: "a=1&b=2"` appends raw query parameters. `{{key}}` placeholders in the base URL are filled from named arguments (URL-encoded, so a value can't add path segments or a query), which are then not sent again as parameters.
- A request must stay under the declared URL: a `path:` that climbs out with `../` or names another host is refused, and so is one with `?` or `#` (pass query parameters as named arguments or `query:`).
- **POST** sends the named arguments as a JSON body to `base + path`, or with `body: "form"` as a form, or with `body: "multipart"` as an upload. A file in the arguments goes as a `data:` URI in JSON (`files: "base64"` for bare base64) and as a file part in multipart; a form or a GET request can't carry one (see [Files to tools](../guide/files.md#files-to-tools)). The method name is ignored. A model that chooses the call can't set `path` unless the tool is declared `& Unlocked("path")` (see [Rules on a tool's arguments](#rules-on-a-tool-s-arguments)).
- `idempotencyKey: true` on a `POST` declaration sends the call's [idempotency key](#idempotency-keys) as an `Idempotency-Key` header. A header name (`idempotencyKey: "X-Request-Id"`) sends it as that header, and `"body.<field>"` puts it in the JSON body.
- Only what you pass is sent: the flowing value is never added implicitly. An explicit first positional argument is sent as `input` (`sendInput: false` on the declaration turns that off too).
- 408, 429, and 5xx responses are retryable under `@retry`.
- `allowNotFound: true` (on the declaration) returns `null` for a 404, for APIs that answer "no matches" with 404 (openFDA does); check it with `|? (context.data.x != null)`.

## Idempotency keys

Every tool call has a key that stays the same when the call is made again, so a service that honours it does the work once:

- The same call, with the same arguments, at the same step of the same run always gets the same key: on a `@retry`, when the step runs again after the server restarted, and when a model asks twice.
- Another run gets other keys, unless both were started with the same key: `halo run --idempotency-key <k>`, the `Idempotency-Key` header or `"idempotencyKey"` on [the API](../guide/production/serving.md#starting-a-run-once), or `runtime.run(name, args, { idempotencyKey })`. Give the run a key that names what it is for (an order, a confirmation id), and running it twice pays once.
- A run started by [`halo rewind`](../guide/plan-and-replay.md#halo-rewind) keeps the keys of the run it came from.
- Two identical calls in one step have one key. If you mean two, give them something that tells them apart (a line id, a reference).

`POST` sends it with `idempotencyKey:` on the declaration, `Email` and `Handoff` always send it, and a provider you register reads it as `call.idempotencyKey`. A key looks like `halo_3f9c…` (45 characters).

## `PostgreSQL` / `SQL`

```halo
tool DB : PostgreSQL(Env.DATABASE_URL)

pipeline Orders(customer: String) -> Result:
  customer |> DB.query(sql: "SELECT id, total FROM orders WHERE customer = $1", params: [customer])
```

Pass the SQL as `sql:`, `query:`, or the first positional argument. `params:` binds `$1`, `$2`, and so on. The result is a list of rows. The tool is read-only unless it's declared with `readOnly: false`, and Postgres enforces that: each query runs in a `READ ONLY` transaction, so a write is refused by the database even when it's written to look like a read (`WITH gone AS (DELETE …) SELECT …`, `EXPLAIN ANALYZE UPDATE …`). A read-only tool also refuses SQL with more than one statement (`SELECT 1; COMMIT; UPDATE …` would end the transaction and then write), and statements that don't start with `SELECT`/`WITH`/`SHOW`/`EXPLAIN`/`VALUES`/`TABLE`. For more than Halo can check, connect as a database role that can only read. Bun's `Bun.SQL` handles the connection. For a database file in the project folder, use [`SQLite`](./sqlite.md), whose reads and writes are separate methods with their own effects.

## `Bash`

```halo
tool Shell : Bash(cwd: ".", timeout_ms: 60000)

pipeline Check(file: String) -> Result:
  file |> Shell.run(command: "wc -l {{file}}") as count
```

`command:` is required. Any method name works. Values inserted with `{{…}}` are **escaped for where they sit**: a bare word, `'single'`, `"double"` or `$'ANSI-C'` quotes, `$(...)`, `${v:-…}`, a here-string, or a heredoc (whatever way its end marker is quoted). So model output and user input are always read as data by the bash that runs `command:`, and can't add commands.

That escaping is for that one bash. A command that hands the text to something that parses it again would run what's in the value, so the run fails before the command starts if a placeholder is:

- inside the string after `-c` of `bash`, `sh`, `zsh`, `dash`, `ksh`, `fish` or `su`, wherever that shell is in the command (`sudo sh -c '…'`, `env … sh -c`, `xargs sh -c`, `find … -exec sh -c`, `docker exec … sh -c`, `kubectl exec … -- sh -c`);
- an argument of `eval`;
- after the host in `ssh host …` (ssh runs its remote command through a shell), or in a heredoc that `ssh host` or `bash` reads as its script;
- in a variable that one of those then expands outside `'…'` (`msg={{x}}; eval "echo $msg"`).

This happens whatever the value is, so a command can't work for some values and fail for others. Pass the value to the second shell as an argument instead, where it stays data: `bash -c 'echo deploying "$1"' _ {{x}}`, or `bash -s -- {{x}} <<'EOF'` with `"$1"` in the script. An exported variable works too: `export V={{x}}; bash -c 'echo "$V"'`. (`env:` on the declaration names variables from Halo's environment; it can't carry a pipeline value.) For `ssh`, send the value on stdin: `printf '%s' {{x}} | ssh host 'cat > notes.txt'`.

A value that starts with `-` where a command reads options is refused too: `git log {{x}}` with `--output=notes.txt` would overwrite that file, quoted or not. That is a placeholder at the start of an argument (`{{x}}`, `"{{x}}"`, `{{x}}.txt`) with no `--` before it in that command. Put `--` before it (`git log -- {{x}}`), or join the value to its option (`--message={{x}}`). Values with a `-` further in are fine, and so are `echo {{x}}`, `printf '%s' {{x}}`, `[[ {{x}} == … ]]`, the arguments after `bash -c '…'`, and a placeholder inside a longer word or string (`"note: {{x}}"`).

`halo validate` warns about each placeholder the run would refuse, about `... | sh`, and about any command that uses `eval` and has a placeholder at all: a value can still reach `eval` through a file or a command's output (`read -r v < {{x}}; eval "$v"`), which the run can't follow. It also warns about a `command:` that isn't written out (`command: context.data.cmd` runs whatever that value is). Other interpreters' code strings (`python -c`, `node -e`, an `awk` program) aren't checked: don't put a placeholder in them. Bash runs code hidden in array subscripts whenever it evaluates arithmetic, even from a quoted value, so in arithmetic spots (`$((…))`, `((…))`, `$[…]`, `[[ … -eq … ]]` and the other numeric tests, `let`, `declare -i`, `${a[…]}`, `${s:…}`) a value must be a whole number or a plain name, or the run fails. That check can't follow a value through a variable: `n={{x}}; echo $((n))` still runs code from `x`, so check values like that with a policy or a gate first. A value that ends a heredoc early (its end marker on a line of its own) or adds a line break inside a `# comment` is refused. So is a placeholder inside `` `backticks` `` (use `$(...)`) or right after a backslash (`\{{x}}`). Inside `"${v:-…}"` or a heredoc, a `}` in a value ends the `${…}` early; that changes the text but runs nothing. The result is `{ command, stdout, stderr, exitCode }`, plus `json` (stdout, parsed) when the command prints JSON, so `context.data.x.json.length` and `each(item in x.json)` work. A non-zero exit code is not an error, so you can check it with a gate or `|<> loop`. The default timeout is 120 seconds; `timeout_ms:` on the declaration changes it, and a call can ask for less with its own `timeout_ms:` but never more.

A command doesn't see Halo's environment, so an agent with a shell can't print your API keys. It gets `PATH`, `HOME`, `USER`, `LOGNAME`, `SHELL`, `LANG`, `LC_ALL`, `LC_CTYPE`, `TMPDIR`, `TZ` and `TERM`, and whatever `env:` passes on:

```halo
tool Db : Bash(env: ["DATABASE_URL", "PGUSER"])
```

The names are read from Halo's environment (or the runtime's `env`, in the [SDK](../guide/sdk.md)), and a name that isn't set is left out. They are written in quotes: `Env.DATABASE_URL` there would be the value, and `halo validate` says so. Before Halo 1.7.0 a command inherited everything; `halo migrate` lists each `Bash` tool with no `env:` (see [Upgrading](../guide/production/upgrading.md)).

## `Browser`

```halo
tool Reader : Browser(maxChars: 8000)

pipeline Read(url: String) -> Result:
  url |> Reader.fetch()
```

Fetches `url:` (or the flowing value) and returns `{ url, title, content }`, with scripts, styles, and tags removed. It runs no JavaScript, and it can't click or fill forms.

## `Slack`

```halo
tool Chat : Slack(Env.SLACK_BOT_TOKEN, channel: "#alerts")

pipeline Alert(msg: String) -> Result:
  msg |> Chat.post(text: "{{msg}}", buttons: ["Approve", "Reject"])
```

`post` (also `send`, `message`, `notify`, `execute`) calls `chat.postMessage` with `channel:`, `text:`, and optional `buttons:`, and returns `{ ok, channel, ts }`. During a run, each button's value is JSON with the run id, how many times the run has paused so far (`after`), and the button's label (`answer`). Under `halo serve` with `slack.signingSecret`, a click answers the run's next pause after the post (never a tool-call approval), with the label as the answer (see [Serving pipelines](../guide/production/serving.md#slack-buttons)). Elsewhere, Halo doesn't receive the clicks: your Slack app's endpoint calls `runtime.signal()` (see [Human-in-the-Loop](../guide/architecture/human-in-the-loop.md)).

## `Email`

One tool sends mail and reads a mailbox, through the service `via:` names.

```halo
tool Mail : Email(Env.RESEND_API_KEY, from: "bot@example.com")

pipeline Send(report: String) -> Result:
  report |> Mail.send(to: "team@example.com", subject: "Daily report", body: "{{report}}")
```

| Method | Arguments | Returns | Effect |
|---|---|---|---|
| `send` | `to:` (a string or a list), `subject:`, `body:` (plain text; also `text:`). Optional: `html:`, `cc:`, `bcc:`, `reply_to:`, `in_reply_to:` (a `messageId`, to stay in its thread) | `{ sent, id, to }` | external |
| `list` | `unread:`, `from:`, `subject:`, `text:`, `since:` (a date, or `"24h"`, `"7d"`), `limit:` (10; at most 50), `folder:`, `full:` (include bodies) | Messages, newest first | read |
| `read` | `id:` (from `list`), `folder:` | One message with `text`, `html` and `attachments` | read |
| `mark` | `id:`, `read:` (`false` marks it unread) | `{ id, unread }` | external |

A message is `{ id, from, fromName, to, cc, subject, date, unread, snippet, messageId, inReplyTo }`, plus `text`, `html` and `attachments` from `read` or `list(full: true)`. Each attachment has its name, type and size; one Halo can read (an image, PDF, Word, PowerPoint or text file) also has `file`, a [file](../guide/files.md) a model the message reaches is sent. It is the same shape whichever service it came from. `list` and `read` never mark anything read.

`from:`, `to:` and `reply_to:` can be set on the declaration. The first argument is the service's secret:

| `via:` | Sends | Reads | First argument | Also on the declaration |
|---|---|---|---|---|
| `"resend"` (default) | yes | | API key | |
| `"cloudflare"` | yes | | An API token that may send email | `account:` (the account id). The `from:` domain must be set up for [Email Sending](https://developers.cloudflare.com/email-service/) |
| `"smtp"` | yes | with `imap:` | Password | `host:`, `user:`, `port:` (587), `tls:`; `imap: "host"` to read too |
| `"imap"` | with `smtp:` | yes | Password | `host:`, `user:`, `port:` (993), `tls:`; `smtp: "host"` to send too |
| `"gmail"` | yes | yes | An [app password](https://support.google.com/accounts/answer/185833), with `user:`. Or a refresh token, with `clientId:` and `clientSecret:` | |
| `"outlook"` | yes | yes | The app's client secret | `tenant:`, `clientId:`, `user:` (the mailbox) |
| `"postmark"` | yes | | Server token | `stream:` |
| `"sendgrid"` | yes | | API key | |
| `"mailgun"` | yes | | API key | `domain:` (required), `apiUrl:` (`"https://api.eu.mailgun.net"` in the EU) |

**SMTP and IMAP** work with any mail server:

```halo
tool Mail : Email(Env.MAIL_PASSWORD, via: "smtp", host: "smtp.example.com", user: "support@example.com", imap: "imap.example.com")
```

- Port 465 (SMTP) and 993 (IMAP) are TLS from the first byte. Port 587, 25 and 143 start plain and switch with STARTTLS; a server that doesn't offer it is refused, so mail and passwords never travel in the clear. `tls: "none"` allows it for a relay on the same machine, and a password is still never sent unencrypted to any other host.
- `tlsVerify: false` accepts a certificate that can't be checked (a relay with a private CA).
- With no `from:`, mail is from `user:`.
- `accessToken:` signs in with OAuth (XOAUTH2) in place of the password.
- An IMAP search takes plain ASCII; `id` is the message's UID in its folder.

**Gmail** with an app password uses Gmail's own SMTP and IMAP servers. With `clientId:` it uses the Gmail API, signing in with the refresh token; `text:` is then a Gmail search (`"has:attachment newer_than:2d"`), and `folder:` a label.

**Outlook** uses Microsoft Graph as an app (client credentials): register an app in Entra, give it the `Mail.Send` and `Mail.ReadWrite` application permissions, and name the mailbox in `user:`. For one person's mailbox instead, pass `refreshToken:` (or `accessToken:`) with `clientId:`. Graph sends one body, so `html:` wins over `body:` when both are given.

**Not sending twice.** Resend gets the call's [idempotency key](#idempotency-keys). Over SMTP and the Gmail API the key becomes the message's `Message-ID`, so a repeat is the same message to whoever receives it, though the server will still accept it. `via: "cloudflare"` reports `delivered`, `queued` and `bounced` addresses in place of an id.

**A mailbox an agent can read but not write to:**

```halo
tool Inbox : Email(Env.IMAP_PASSWORD, via: "imap", host: "imap.example.com", user: "support@example.com")
policy ReadOnly : AllowEffects("read")
agent Triage [anthropic/claude-sonnet-4-5] equips Inbox requires ReadOnly
```

To keep a model's mail inside one domain, put a rule on the tool:

```halo
tool Mail : Email(Env.POSTMARK_TOKEN, via: "postmark", from: "prizes@example.com")
  & Match("to", "[\\w.+-]+@example\\.com")
  & Locked("cc", "bcc")
```

**Mail that starts a run.** Poll a mailbox on a [schedule](../guide/production/serving.md#schedules) (`Inbox.list(unread: true, full: true)`, then `Inbox.mark` each one handled), or have mail pushed to a webhook as it arrives (see [Inbound email](../guide/production/serving.md#inbound-email)).

## `Handoff`

Hands an item to the app that hosts your pipelines, for the things that app already does well: sending from its own mail system, writing to its database, queueing a job.

```halo
tool App : Handoff(Env.APP_URL, secret: Env.HALO_HANDOFF_SECRET)

pipeline Announce(winner: JSON) -> Result:
  winner
    |> Announcer.note("Write a short congratulation for {{winner.name}}") as note
    |> App.send(kind: "winner_note", to: winner.email, note: context.data.note)
```

Halo POSTs this to the URL, and the pipeline goes on with what your app answers (`{ delivered, id, kind }` when it answers with nothing):

```json
{ "id": "halo_3f9c…", "type": "handoff", "kind": "winner_note", "at": "2026-11-19T10:04:11.000Z",
  "runId": "6f9696ef-…", "data": { "to": "ada@example.com", "note": "Well played." } }
```

- `kind:` says what the item is. A method name works too: `App.winner_note(to: ...)`.
- `id` is the call's [idempotency key](#idempotency-keys), also sent as `Idempotency-Key`. Store it and ignore an `id` you have already acted on: the same step running again sends the same one.
- The request is signed with `secret:`, the same way as a [run callback](../guide/production/serving.md#run-callbacks), so one check covers both.
- An answer of 4xx or 5xx fails the step (408, 429 and 5xx are retryable under `@retry`).
- Its effect is `external`, so `ApproveEffects("external")` asks a person first.

## `GitHub`

```halo
tool Repo : GitHub(Env.GITHUB_TOKEN, repo: "acme/api")

pipeline FileIssue(title: String) -> Result:
  title |> Repo.create_issue(title: "{{title}}", body: "Filed by Halo", labels: ["triage"])
```

| Method | Arguments |
|---|---|
| `create_issue` | `title`, `body`, `labels` |
| `comment` | `number`, `body` |
| `add_labels` | `number`, `labels` |
| `create_pr` | `title`, `head` (or `branch`), `base` (default `main`), `body` |
| `get_issue` | `number` |
| `list_issues` | `state` (default `open`), `limit` (default 30) |

`repo:` can be set on the declaration or on each call. `Repo.execute(method: "comment", ...)` also works.

## `Linear` and `Figma`

```halo
tool Tickets : Linear(Env.LINEAR_TOKEN, team: "ENG")
tool Design  : Figma(Env.FIGMA_TOKEN, file: "AbC123")

pipeline Sync(note: String) -> Result:
  note
    |> Design.get_node(node: "1:2") as frame
    |> Tickets.create_issue(title: "Review frame", description: "{{note}}")
```

- Linear: `create_issue` takes `team:` (a team key), `title:`, and `description:`. It returns `{ id, url }`.
- Figma: `get_file` takes `file:` and optionally `depth:`. `get_node` takes `file:` and `node:`.

## `System`

`System` is built in and not declared.

| Method | Effect |
|---|---|
| `System.Print(x?)` | Prints `x` or the flowing value. The value passes through. |
| `System.Log(x?)` | Logs with the pipeline name. The value passes through. |
| `System.Sleep(2s)` | Waits. |
| `System.Fail("msg")` | Fails the run with a `HaloError`. |
| `System.Pick(value?, fields: [...], maxChars: n)` | Keeps only these dotted fields of an object or of each list item, and clips long strings. |
| `System.Value(x)` | Makes `x` the flowing value, e.g. to end a pipeline with a result bound earlier: `\|> System.Value(context.data.review)`. |
| `System.Publish/Distribute/ResolveIncident/TriggerWebhook/Notify(...)` | Sends the call to `onSystemEvent`, or logs it when no handler is set. |

`runtime.registerSystem("Name", fn)` adds more methods. Unknown `System` methods are a validator error.

## Not built in

Hosted vector databases other than Postgres with pgvector (Pinecone, Chroma, …) have no provider. Jira, Stripe, Notion and Sentry are [packages](../guide/tool-packages.md) (`@halo/jira`, ...) rather than built-ins. For anything else, install or write a package, use an [MCP](../guide/integrations/mcp.md) server, or register a provider in TypeScript (see [Custom Tools](../guide/integrations/custom-tools.md)).
