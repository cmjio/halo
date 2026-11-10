# SQLite

`SQLite` is a local SQLite database file in your project folder. Pipelines can query it and write to it, and agents can use it too. Reads and writes are separate methods, so `halo plan` shows which steps change the database, and [tool policies](./policies.md) can hide or gate an agent's writes. Every query is parameterised, and the file can't be outside the project folder. It runs on `bun:sqlite`, which is part of Halo itself, so there's nothing to install.

```halo
tool Ledger : SQLite("data/ledger.db", write: true)
tool Books  : SQLite("data/ledger.db")

pipeline Setup() -> Result:
  ""
    |> Ledger.execute(sql: "CREATE TABLE IF NOT EXISTS expenses (id INTEGER PRIMARY KEY, description TEXT, amount REAL, category TEXT)")

pipeline Record(description: String, amount: Number, category: String) -> Result:
  description
    |> Ledger.execute(sql: "INSERT INTO expenses (description, amount, category) VALUES (:description, :amount, :category)", description: description, amount: amount, category: category)

pipeline Totals(min: Number) -> Result:
  min
    |> Books.query(sql: "SELECT category, sum(amount) AS total FROM expenses GROUP BY category HAVING total >= ? ORDER BY total DESC", params: [min])
```

The full example is [`examples/real-world/80-sqlite-ledger.halo`](/examples/80-sqlite-ledger). It has a setup step, a bulk import, a monthly summary, an analyst agent that can only read, and a bookkeeper agent whose changes need approval.

## Methods

| Method | Effect | Arguments | Returns |
|---|---|---|---|
| `query` | <span class="e read">read</span> | `sql`, `params`, `limit` (default 1000) | a list of rows (records) |
| `get` | <span class="e read">read</span> | `sql`, `params` | the first row, or `null` |
| `tables` | <span class="e read">read</span> | | `[{ name, type, columns: [{ name, type, not_null?, primary_key?, default? }] }]` |
| `execute` | <span class="e write">write</span> | `sql`, `params`, `batch` | `{ changes, last_insert_rowid }`, plus `rows` for `RETURNING`, plus `statements` for a batch |

- **The declaration.** The first argument is the database file, relative to the project folder (default `.halo/data.sqlite`). `":memory:"` gives you an in-memory database that lasts as long as the process.
- **Read-only by default.** If the tool isn't declared with `write: true`, the file is opened read-only, and a missing file is an error rather than being created. `execute` is refused, and `halo validate` reports any pipeline that calls it. If you want reads and writes on the same file, declare two tools, as in the example above.
- **Rows.** A row comes back as a record keyed by column name. `query` fails if there are more rows than `limit` (at most 100,000) rather than silently dropping some. To get fewer rows, add a `LIMIT` to the SQL. BLOBs come back as base64 text.
- **`batch:`** takes a list of params, one per row, and runs the statement once for each. The whole batch is one transaction, so if one row fails (a constraint, say), none of them are kept. Pass it a list of records from the input or from `context.data`, for example `batch: rows`.

## Parameterised SQL only

SQL never contains values. Write placeholders in the SQL, and pass the values separately:

| Placeholder | Values |
|---|---|
| `?`, `?1`, `?2` | `params: [a, b]` |
| `:name`, `@name`, `$name` | `params:` as a record (for example `params: context.data.row`), or named arguments with the same names: `name: value` |

- A pipeline must write its `sql:` out as a string, and the string can't contain `{{placeholders}}`. `halo validate` reports SQL with `{{…}}` in it, or SQL taken from a variable (`sql: context.data.q`), as an error. The runtime refuses both as well, even when validate didn't run (for example, from the SDK). A value such as `x' OR '1'='1` is only ever matched as data.
- Lists and records in params are stored as JSON text, and booleans are stored as `1`/`0`. Read JSON back out with `json_extract(col, '$.field')`.
- An agent writes its own SQL. It is told to use placeholders, but it decides the SQL text itself. That's why reads and writes are kept apart by SQLite itself, as described in the next section, and not by trusting the SQL.

## What's enforced

- **Reads can't write.** `query`, `get` and `tables` run with SQLite's `query_only` setting on, and a read-only tool's connection is opened read-only. Either way, an `INSERT ... RETURNING` sent through `query` fails with "attempt to write a readonly database". The method decides whether a call reads or writes, not what the SQL text looks like.
- **One statement per call.** `SELECT 1; DROP TABLE t` is refused. Semicolons inside strings, quoted names and comments are fine, and so is a trailing semicolon.
- **Nothing outside the file.** `ATTACH`, `DETACH`, `VACUUM` (which can write a copy to another file) and `PRAGMA` are refused, including under `EXPLAIN`. That way a read can't turn `query_only` off, and no statement can open or write a file somewhere else. For the schema, use `tables()` or `pragma_table_info('t')` in a `SELECT`.
- **No transaction control.** `BEGIN`, `COMMIT`, `ROLLBACK` and `SAVEPOINT` are refused. Each `execute` is its own transaction, and you can use `batch:` for many rows at once.
- **The file stays in the project folder.** Absolute paths, `..` and symlinks that lead out of the folder are refused, using the same rules as [`Workspace`](./local-tools.md#workspace). `halo validate` reports a path that is absolute or climbs out.
- Foreign keys are enforced (`PRAGMA foreign_keys = ON`), and a locked database is retried for up to 5 seconds.

## Plans and policies

`halo plan` lists each step's database calls with their effect:

```txt
Plan for Fix

  1      Bookkeeper.fix [anthropic/claude-sonnet-4-5] ≤ $1.4186
         may call Ledger.query: read
         may call Ledger.get: read
         may call Ledger.tables: read
         may call Ledger.execute: write · needs approval (AskBeforeWriting)
```

For agents, use the effect rules:

```halo
policy ReadOnly : AllowEffects(read)            // execute is never offered
policy AskBeforeWriting : ApproveEffects(write) // each execute waits for a person
policy NoDeletes : DenyArgs("Ledger.execute", "sql", "^\\s*(delete|drop)\\b")
```

Tool policies apply to the calls an agent chooses. A pipeline's own `|> Ledger.execute(...)` is written in the pipeline and shown by `halo plan`. To put a person in front of it, add `|! yield` before it (see [Human-in-the-Loop](../guide/architecture/human-in-the-loop.md)).

## SQLite or PostgreSQL

Use [`PostgreSQL`](./tools.md#postgresql-sql) for a database server that you reach with a connection URL. Use `SQLite` for a database file that lives with the project, such as a ledger, a cache of results, or data a pipeline builds up between runs. For simple keyed values, [`KV`](./local-tools.md#kv) needs no schema.
