# Built-in Tools

Declare a tool with `tool Name : Provider(args)`. A pipeline can call it directly (`|> Name.method(...)`), an equipped agent can call it first (`Agent.task(tool: Name, ...)`), or an equipped agent can choose its own calls (`Agent.task(tools: [Name])`, see [Agents with Tools](../guide/agents-with-tools.md)). If a call has no positional arguments, its first argument is the flowing value (Browser's URL, a memory search's query, a File entry); REST and POST don't send it. Tokens can be written as `Env.NAME` or `"Env.NAME"`, and they are read only when the tool is used.

| Provider | What it does |
|---|---|
| `REST` / `GET` | HTTP GET, JSON or text response |
| `POST` | HTTP POST with a JSON body |
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
| `Documents` | Text from text, HTML, CSV, JSON, Word and PDF files (see [Local Tools](./local-tools.md)) |
| `Clock` | The date and time, date arithmetic, timezones (see [Utility Tools](./utility-tools.md)) |
| `Calc` | Exact arithmetic expressions and statistics (see [Utility Tools](./utility-tools.md)) |
| `Data` | Filter, sort, group, aggregate, join and diff JSON; CSV (see [Utility Tools](./utility-tools.md)) |
| `Git` | Read a local git repository; commit with `write: true` (see [Utility Tools](./utility-tools.md)) |
| `WebSearch` | Web search through Brave, Tavily, Serper or Exa (see [Utility Tools](./utility-tools.md)) |
| `Skills` | A library of instructions an agent loads when it needs them (see [Skills](./skills.md)) |
| `Remote` | A remote computer: a server over SSH, or a cloud sandbox (E2B, Daytona) for the run (see [Remote Computers](./remote.md)) |
| `MCP` | Any Model Context Protocol server's tools (see [MCP](../guide/integrations/mcp.md)) |
| `Slack`, `Email`, `GitHub`, `Linear`, `Figma` | API clients for those services |

More providers come as [tool packages](../guide/tool-packages.md) (`halo add stripe`), and `halo tools` lists every provider in a project with its methods and their effects.

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
- **POST** sends the named arguments as a JSON body to `base + path`. The method name is ignored.
- Only what you pass is sent: the flowing value is never added implicitly. An explicit first positional argument is sent as `input` (`sendInput: false` on the declaration turns that off too).
- 408, 429, and 5xx responses are retryable under `@retry`.
- `allowNotFound: true` (on the declaration) returns `null` for a 404, for APIs that answer "no matches" with 404 (openFDA does); check it with `|? (context.data.x != null)`.

## `PostgreSQL` / `SQL`

```halo
tool DB : PostgreSQL(Env.DATABASE_URL)

pipeline Orders(customer: String) -> Result:
  customer |> DB.query(sql: "SELECT id, total FROM orders WHERE customer = $1", params: [customer])
```

Pass the SQL as `sql:`, `query:`, or the first positional argument. `params:` binds `$1`, `$2`, and so on. The result is a list of rows. Statements other than `SELECT`/`WITH`/`SHOW`/`EXPLAIN`/`VALUES`/`TABLE` are refused unless the tool is declared with `readOnly: false`. Bun's `Bun.SQL` handles the connection. For a database file in the project folder, use [`SQLite`](./sqlite.md), whose reads and writes are separate methods with their own effects.

## `Bash`

```halo
tool Shell : Bash(cwd: ".", timeout_ms: 60000)

pipeline Check(file: String) -> Result:
  file |> Shell.run(command: "wc -l {{file}}") as count
```

`command:` is required. Any method name works. Values inserted with `{{…}}` are **escaped for where they sit**: a bare word, `'single'`, `"double"` or `$'ANSI-C'` quotes, `$(...)`, `${v:-…}`, a here-string, or a heredoc (whatever way its end marker is quoted). So model output and user input are always read as data and can't add commands. Two things can't be made safe, and `halo validate` warns about both: a command that runs a value as code (`eval {{x}}`, `bash -c {{x}}`, `... | sh`), and a `command:` that isn't written out (`command: context.data.cmd` runs whatever that value is). Bash runs code hidden in array subscripts whenever it evaluates arithmetic, even from a quoted value, so in arithmetic spots (`$((…))`, `((…))`, `$[…]`, `[[ … -eq … ]]` and the other numeric tests, `let`, `declare -i`, `${a[…]}`, `${s:…}`) a value must be a whole number or a plain name, or the run fails. That check can't follow a value through a variable: `n={{x}}; echo $((n))` still runs code from `x`, so check values like that with a policy or a gate first. A value that ends a heredoc early (its end marker on a line of its own) or adds a line break inside a `# comment` is refused. So is a placeholder inside `` `backticks` `` (use `$(...)`) or right after a backslash (`\{{x}}`). Inside `"${v:-…}"` or a heredoc, a `}` in a value ends the `${…}` early; that changes the text but runs nothing. The result is `{ command, stdout, stderr, exitCode }`, plus `json` (stdout, parsed) when the command prints JSON, so `context.data.x.json.length` and `each(item in x.json)` work. A non-zero exit code is not an error, so you can check it with a gate or `|<> loop`. The default timeout is 120 seconds.

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

Hosted vector databases other than Postgres with pgvector (Pinecone, Chroma, …) have no provider. Jira, Stripe, Notion and Sentry are [tool packages](../guide/tool-packages.md) rather than built-ins. For anything else, install or write a package, use an [MCP](../guide/integrations/mcp.md) server, or register a provider in TypeScript (see [Custom Tools](../guide/integrations/custom-tools.md)).
