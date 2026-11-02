# Built-in Tools

Declare a tool with `tool Name : Provider(args)`. A pipeline can call it directly (`|> Name.method(...)`), or an equipped agent can call it first (`Agent.task(tool: Name, ...)`). If a call has no positional arguments, its first argument is the flowing value. Tokens can be written as `Env.NAME` or `"Env.NAME"`, and they are read only when the tool is used.

| Provider | What it does |
|---|---|
| `REST` / `GET` | HTTP GET, JSON or text response |
| `POST` | HTTP POST with a JSON body |
| `PostgreSQL` / `SQL` | SQL queries, read-only by default |
| `Bash` | Run a shell command |
| `Browser` | Fetch a page's readable text |
| `File` | JSON-file history or notes (see [Stores](./stores.md)) |
| `VectorStore` | Local searchable memory (see [Stores](./stores.md)) |
| `Slack`, `Email`, `GitHub`, `Linear`, `Figma` | API clients for those services |

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
- **GET** requests `base + path`. When there is no `path:`, it requests `base/<method>`, and when called by an agent it requests just `base`. Named arguments become query parameters, and the input is sent as `input=…`. `query: "a=1&b=2"` appends raw query parameters. `{{key}}` placeholders in the base URL are filled from named arguments.
- **POST** sends the named arguments, plus `input`, as a JSON body to `base + path`. The method name is ignored.
- `sendInput: false` (on the declaration) stops the flowing value from being sent as `input`.
- 408, 429, and 5xx responses are retryable under `@retry`.

## `PostgreSQL` / `SQL`

```halo
tool DB : PostgreSQL(Env.DATABASE_URL)

pipeline Orders(customer: String) -> Result:
  customer |> DB.query(sql: "SELECT id, total FROM orders WHERE customer = $1", params: [customer])
```

Pass the SQL as `sql:`, `query:`, or the first positional argument. `params:` binds `$1`, `$2`, and so on. The result is a list of rows. Statements other than `SELECT`/`WITH`/`SHOW`/`EXPLAIN`/`VALUES`/`TABLE` are refused unless the tool is declared with `readOnly: false`. Bun's `Bun.SQL` handles the connection.

## `Bash`

```halo
tool Shell : Bash(cwd: ".", timeout_ms: 60000)

pipeline Check(file: String) -> Result:
  file |> Shell.run(command: "wc -l {{file}}") as count
```

`command:` is required. Any method name works. Values inserted with `{{…}}` are **shell-quoted**, so model output and user input can't add commands. Don't wrap placeholders in your own quotes, because that undoes the quoting. The result is `{ command, stdout, stderr, exitCode }`. A non-zero exit code is not an error, so you can check it with a gate or `|<> loop`. The default timeout is 120 seconds.

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

`post` (also `send`, `message`, `notify`, `execute`) calls `chat.postMessage` with `channel:`, `text:`, and optional `buttons:`, and returns `{ ok, channel, ts }`. Halo doesn't receive button clicks. Your server handles them and calls `runtime.signal()` (see [Human-in-the-Loop](../guide/architecture/human-in-the-loop.md)).

## `Email` (Resend)

```halo
tool Mail : Email(Env.RESEND_API_KEY, from: "bot@example.com")

pipeline Send(report: String) -> Result:
  report |> Mail.send(to: "team@example.com", subject: "Daily report", body: "{{report}}")
```

`send` posts to the Resend API with `from:`, `to:` (a string or a list), `subject:`, and `body:`/`text:`. `from:` and `to:` can be set on the declaration. It returns `{ sent, id, to }`.

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

These have no built-in provider: headless-browser automation (clicking, JavaScript), Jira, Stripe, a SQLite key-value store, and hosted vector databases. To add one, register a provider: see [Custom Tools](../guide/integrations/custom-tools.md).
