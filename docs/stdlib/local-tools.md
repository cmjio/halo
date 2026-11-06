# Local Tools

These providers work on this machine, with no service to sign up for: a folder of files, a key-value store, a SQLite database, a code runner, and a document reader. `SQLite` has [its own page](./sqlite.md). Declare them like any other tool, call them from a pipeline, or equip an agent with them.

| Provider | What it does |
|---|---|
| `Workspace` | Read, search and (if allowed) change files in one folder |
| `KV` | A persistent key-value store in a local SQLite file |
| [`SQLite`](./sqlite.md) | Query and write a SQLite database file with parameterised SQL |
| `Code` | Run a JavaScript, TypeScript or Python snippet in its own process |
| `Documents` | Extract text from text, Markdown, HTML, CSV/TSV, JSON, Word and PDF files |

## `Workspace`

```halo
tool Files : Workspace("./src", write: true)

pipeline Rename(old: String, new: String) -> Result:
  old
    |> Files.search(pattern: "{{old}}", glob: "**/*.ts") as hits
    |> Files.edit(path: "index.ts", old: "{{old}}", new: "{{new}}", all: true)
```

| Method | Arguments | Returns |
|---|---|---|
| `read` | `path`, `offset`, `limit` (lines) | `{ path, content, lines }` |
| `write` | `path`, `content` | `{ path, bytes, created }` |
| `edit` | `path`, `old`, `new`, `all` | `{ path, replacements }` |
| `list` | `path` (default `.`), `depth` (default 1) | `{ path, entries: [{ path, type, size }] }` |
| `glob` | `pattern` (`"**/*.md"`) | `{ pattern, matches }` |
| `search` | `pattern`, `path`, `regex`, `ignore_case`, `glob` | `{ pattern, matches: [{ path, line, text }] }` |
| `delete` | `path`, `recursive` | `{ path, deleted }` |
| `mkdir` | `path` | `{ path, created }` |

- The first argument is the root folder, relative to the current directory (default `.`). Every path is relative to the root.
- **Read-only by default.** `write`, `edit`, `delete` and `mkdir` are refused unless the tool is declared with `write: true`.
- Paths can't leave the root: absolute paths and `..` are refused, and symlinks are resolved first, so a link inside the root that points outside it (to a file or a folder) can't be read or written through. A symlink that points nowhere is refused too. `delete` on a symlink removes the link, not its target.
- `edit` replaces exact text. `old` must appear once; if it appears more often, add surrounding lines to make it unique, or pass `all: true`.
- `list`, `glob` and `search` skip `node_modules` and `.git` and never enter symlinked folders. `glob` and `list` return at most 1000 entries, `search` at most 200 matches (with `truncated: true` when cut short). `read` returns at most 1MB of a file, and binary files are refused.

## `KV`

```halo
tool Seen : KV(".halo/kv.sqlite", namespace: "seen")

pipeline Once(id: String) -> Result:
  id
    |> Seen.get(key: "{{id}}") as before
    |> Seen.set(key: "{{id}}", value: true, ttl: "7d")
```

| Method | Arguments | Returns |
|---|---|---|
| `get` | `key`, `default` | the value, or `null` (or `default`) |
| `set` | `key`, `value`, `ttl` | `{ key, set, expires_at? }` |
| `delete` | `key` | `{ key, deleted }` |
| `list` | `prefix`, `limit` (default 100, at most 1000) | `[{ key, value }]` in key order |
| `incr` | `key`, `by` (default 1), `ttl` | the new number |

- The file defaults to `.halo/kv.sqlite`. The namespace defaults to the tool's name, so two tools on one file only share keys when they name the same `namespace:`.
- Values are stored as JSON: strings, numbers, lists and records come back as they went in. `set` takes the flowing value when `value:` isn't given.
- `ttl:` is seconds or a duration (`"30s"`, `"5m"`, `"1h"`, `"2d"`). An expired key reads as missing and is deleted later. `incr` on a missing key starts from 0; an existing key keeps its expiry.

## `Code`

```halo
tool Calc : Code("python", timeout_ms: 5000)

pipeline Stats(numbers: List) -> Result:
  numbers |> Calc.run(code: "import statistics\nreturn {'mean': statistics.mean(input)}")
```

`run(code, input)` returns `{ stdout, stderr, exitCode, result, timedOut }`. The language is `js`, `ts` or `python` (default `js`; bun runs JS and TS, `python3` runs Python), and the default timeout is 10 seconds.

- The snippet is the body of a function. `input` holds the call's `input:` (or the flowing value), passed as JSON. Whatever the snippet `return`s comes back as `result`; printed output goes to `stdout`. In JS and TS the function is async, so `await` works, and modules load with `await import("...")`.
- A snippet that throws is not an error: check `exitCode` and `stderr`. One that runs too long is killed, with `timedOut: true`. Output past 200,000 characters is cut off.

**What `Code` protects, and what it doesn't.** Each run is a new process in a new temporary folder (deleted afterwards), with an empty environment: only `PATH`, and `HOME`/`TMPDIR` set to that folder. API keys and other secrets in Halo's environment aren't visible to it. It is **not a security sandbox**: the snippet runs as your user and can still read and write files elsewhere, use the network, and start programs. Only run code you'd run yourself, or run Halo in a container.

## `Documents`

```halo
tool Docs : Documents(root: "./inbox")

pipeline Summarize(file: String) -> Result:
  file
    |> Docs.extract() as doc
    |> Writer.summarize(text: context.data.doc.text)
```

`extract(path)` or `extract(url:)` returns `{ source, type, text }`, plus:

| Type | From | Extra |
|---|---|---|
| `text`, `markdown` | `.txt`, `.md` | |
| `html` | `.html` | `title`; scripts, styles and tags removed |
| `csv`, `tsv` | `.csv`, `.tsv` | `rows`: one record per line, keyed by the header (quoted fields handled) |
| `json` | `.json` | `data`: the parsed value |
| `docx` | `.docx` | paragraphs one per line |
| `pdf` | `.pdf` | `pages`: the page count |

- The type comes from the extension, then the content type, then the first bytes; `type:` overrides it.
- A path is relative to `root:` (default: the current directory) and can't leave it, with the same rules as `Workspace`. An `http(s)` URL is fetched instead. Files and downloads over 25MB are refused, and `text` is cut at 200,000 characters (`maxChars:` changes it), with `truncated: true`.
- PDF text uses `pdftotext` (from poppler) when it's installed. Without it, a built-in extractor reads simple PDFs, but not scanned pages, encrypted files, or fonts with custom encodings, and its text follows the file's order rather than the page layout. Install `pdftotext` for anything that matters.
