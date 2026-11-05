# Utility Tools

Five providers for the things models are bad at or can't do alone: knowing the date, doing exact arithmetic, reshaping data, reading a git repository, and searching the web. The first four run in-process or on this machine with nothing to sign up for. Each describes its methods, so an agent can call them itself (`tools: [Time, Math]`), and `halo plan` knows what each can change.

| Provider | What it does | Effects |
|---|---|---|
| `Clock` | The current date and time, date arithmetic, formatting in a timezone | read |
| `Calc` | Exact arithmetic expressions and statistics | read |
| `Data` | Filter, sort, group, aggregate, join and diff JSON; CSV in and out | read |
| `Git` | Status, log, diff, show, blame, grep in a local repository; commit with `write: true` | read (commit and checkout: write) |
| `WebSearch` | Web search through Brave, Tavily, Serper or Exa | read |

## `Clock`

```halo
tool Time : Clock(timezone: "Europe/London")

pipeline DueDate(days: Number) -> Result:
  days |> Time.add(days: days) as due
```

| Method | Arguments | Returns |
|---|---|---|
| `now` | `timezone` | `{ iso, unix, timezone, local, date, time, weekday }` |
| `add` | `date` (default now), `duration` (`"90m"`, `"-2d"`, `"1h30m"`, `"2w"`), or `years`, `months`, `weeks`, `days`, `hours`, `minutes`, `seconds` | the same fields, for the new date |
| `diff` | `from`, `to` (default now) | `{ ms, seconds, minutes, hours, days, human }` |
| `format` | `date`, `timezone`, `style` (`full`, `long`, `medium`, `short`), `locale` | the same fields plus `text` |
| `parse` | `text` | the same fields |

- `iso` is UTC; `local` is the same moment in the timezone, with its offset (`2026-11-05T17:30:00+05:30`).
- `timezone:` on the declaration sets the default (else UTC); a call's `timezone:` overrides it. Names are IANA names like `America/New_York`.
- `now:` on the declaration pins the current time, so tests and replays get the same dates every run: `Clock(now: "2026-01-01T09:00:00Z")`.

## `Calc`

```halo
tool Rows : Data()
tool Math : Calc(precision: 2)

pipeline Invoice(order: Object) -> Result:
  order
    |> Math.eval(expression: "sum(prices) * (1 + vat)", vars: order) as total
    |> Math.eval(expression: "{{context.data.total.result}} / {{order.people}}") as each
```

`vars:` is a record of names (here the pipeline's `order`, which has `prices` and `vat`); `{{...}}` in the expression is filled in before it's read. An agent passes `vars` in its tool call.

| Method | Arguments | Returns |
|---|---|---|
| `eval` | `expression`, `vars` | `{ expression, result }` |
| `stats` | `values` (a list of numbers) | `{ count, sum, mean, median, min, max, stdev }` |
| `percent` | `part`, `whole` | `{ part, whole, percent }` |
| `change` | `from`, `to` | `{ from, to, difference, percent }` |

`eval` reads its own expression language and never runs code: numbers, `+ - * / %`, `^` (power, right-associative), parentheses, comparisons and `&& || !` (giving `1` or `0`), the constants `pi` and `e`, and `abs ceil floor round(x, digits) sqrt cbrt exp ln log log2 pow min max sum avg mean median sin cos tan if(cond, a, b)`. Names come from `vars:` and can be dotted paths (`order.total`). A name that holds a list spreads into a function (`sum(prices)`). Numeric strings like `"1,250.50"` are read as numbers. Division by zero, unknown names and anything else it can't read are errors, not `NaN`.

Results are rounded to 15 significant digits, so `0.1 + 0.2` is `0.3`. `precision:` on the declaration rounds to that many decimal places.

## `Data`

```halo
tool Rows : Data()

pipeline TopCustomers(orders: Array) -> Result:
  orders
    |> Rows.filter(where: "status == 'paid' && total > 100") as paid
    |> Rows.aggregate(data: context.data.paid, field: "total", op: "sum", by: "customer") as spend
```

`data:` defaults to the flowing value. Paths are dotted (`user.address.city`, `items.0.id`); a segment applied to a list maps over it (`items.title` is every title).

| Method | Arguments | Returns |
|---|---|---|
| `get` | `data`, `path` | the value, or `null` |
| `pick` | `data`, `fields` | the record (or each record) with only those fields |
| `filter` / `find` | `data`, `where` | matching records / the first match or `null` |
| `sort` | `data`, `by` (a path or list), `desc` | the sorted list |
| `limit` | `data`, `n`, `offset` | a slice |
| `group` | `data`, `by` | `{ value: [records] }` |
| `count` | `data`, `by` | a number, or `{ value: count }` most first |
| `aggregate` | `data`, `field`, `op` (`sum avg min max count first last list`), `by` | a value, or one per group |
| `unique` | `data`, `by` | records with duplicates dropped |
| `flatten` | `data`, `depth` | the flattened list |
| `join` | `left`, `right`, `on` (a path, or `[left, right]`), `type` (`left` or `inner`) | joined records |
| `diff` | `before`, `after`, `key` | `{ changed, count, changes: [{ path, type, before, after }] }` |
| `from_csv` | `text`, `delimiter` | records keyed by the header |
| `to_csv` | `data`, `fields`, `delimiter` | CSV text |

A `where` is text, `"status == 'paid' && total > 100 && tags contains urgent"`: conditions joined by `&&`, each a path, an operator and a value (quoted or bare text, a number, `true`, `false`, `null`, or a list `['a', 'b']`). `{{...}}` in it is filled in first, so `"total >= {{limit}}"` works. An agent can also pass a record of path → value (equal) or path → `{ op: value }`, or the same as JSON text. All conditions must hold. Operators: `=` `!=` `>` `>=` `<` `<=` `in` `not_in` `contains` `starts_with` `ends_with` `matches` (a regex, case-insensitive) `exists`. Numbers written as strings compare as numbers.

`diff` with `key:` matches records in two lists by that field, so a reordered list isn't a change. With a watch (see [Serving](../guide/production/serving.md)), it tells you exactly what changed since last time.

## `Git`

```halo
tool Repo : Git(".")

agent Reviewer [anthropic/claude-sonnet-4-5, preset: CodeReviewer]
  equips Repo

pipeline ReviewBranch(base: String) -> Result:
  base
    |> Repo.diff(from: "{{base}}") as change
    |> Reviewer.review(context.data.change.diff, tools: [Repo])
```

| Method | Arguments | Returns |
|---|---|---|
| `status` | | `{ branch, ahead, behind, clean, files: [{ path, status, staged }] }` |
| `log` | `limit` (20), `ref`, `path`, `since`, `author`, `grep` | `[{ hash, short, author, email, date, subject, body }]` |
| `diff` | `from`, `to`, `staged`, `path`, `stat` | `{ from, to, diff }` |
| `show` | `ref` (HEAD), `path` | a commit's message and patch, or `{ content }` of a file at that ref |
| `blame` | `path`, `start`, `end`, `ref` | `{ path, lines: [{ line, hash, author, date, summary, text }] }` |
| `branches` | | `[{ name, current, hash, date, subject }]` |
| `files` | `pattern` | `{ count, files }` (tracked and untracked, not ignored) |
| `grep` | `pattern`, `path`, `regex`, `ignore_case` | `{ pattern, matches: [{ path, line, text }] }` |
| `commit` | `message`, `paths` or `all` | `{ committed, hash, files }` (needs `write: true`) |
| `checkout` | `branch`, `create` | `{ branch, created }` (needs `write: true`) |

- Git runs directly, never through a shell. A ref or path that starts with `-` is refused, so a value can't become an option, and paths always follow `--`.
- `commit` and `checkout` fail unless the tool is declared with `write: true`. `commit` skips hooks and signing; `author:` on the declaration sets the author.
- Outputs are cut at `max_chars` (100,000) with `truncated: true`.

## `WebSearch`

```halo
tool Web    : WebSearch(engine: "brave")
tool Reader : Browser(maxChars: 8000)

agent Scout [anthropic/claude-sonnet-4-5, preset: Researcher]
  equips Web, Reader

pipeline Ask(question: String) -> Result:
  question |> Scout.research()
```

`search(query, limit?, site?, freshness?)` returns `{ query, engine, results: [{ title, url, snippet, published? }] }`. `limit` is 1–20 (default 5), `site:` keeps results to one site, and `freshness:` is `day`, `week`, `month` or `year`.

| `engine:` | Key |
|---|---|
| `brave` | `BRAVE_API_KEY` |
| `tavily` | `TAVILY_API_KEY` |
| `serper` (Google results) | `SERPER_API_KEY` |
| `exa` | `EXA_API_KEY` |

With no `engine:`, the first engine whose key is set is used. `apiKey:` on the declaration overrides the environment. Search snippets are leads, not sources: give the agent a `Browser` tool to read the pages it cites (the [`web-research`](./skills.md) skill tells it to).
