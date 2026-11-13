/**
 * Local tool providers: things an agent can do on this machine, with no service to sign up for.
 *
 *   tool Files : Workspace("./src", write: true)   read, write, edit, list, glob, search, delete, mkdir
 *   tool Cache : KV(".halo/kv.sqlite")             get, set, delete, list, incr
 *   tool Shop  : SQLite("data/shop.db", write: true) query, get, tables, execute
 *   tool Py    : Code("python", timeout_ms: 10000)  run
 *   tool Docs  : Documents(root: "./inbox")        extract
 *   tool Time  : Clock(timezone: "UTC")            now, add, diff, format, parse
 *   tool Math  : Calc()                            eval, stats, percent, change
 *   tool Rows  : Data()                            get, pick, filter, sort, group, count, aggregate, join, diff, ...
 *   tool Repo  : Git("./")                         status, log, diff, show, blame, branches, files, grep
 *   tool Web   : WebSearch(engine: "brave")        search
 *   tool Kit   : Skills("./skills")                list, load, read
 *   tool Box   : Remote("deploy@host") / ("e2b")   run, read, write, list, upload, download, info
 */

import type { JsonSchema, ProviderInfo, ToolProvider } from "../tools.js";
import { calc } from "./calc.js";
import { clock } from "./clock.js";
import { codeRunner } from "./code.js";
import { data } from "./data.js";
import { gitProvider } from "./git.js";
import { remote } from "./remote.js";
import { webSearch } from "./search.js";
import { SKILLS_INFO, skills } from "./skills.js";
import { documents } from "./documents.js";
import { kv } from "./kv.js";
import { sqlite } from "./sqlite.js";
import { workspace } from "./workspace.js";

export { closeKvDatabases } from "./kv.js";
export { closeSqliteDatabases } from "./sqlite.js";
export { closeRemoteSessions } from "./remote.js";

export const LOCAL_PROVIDERS: Record<string, ToolProvider> = {
  Workspace: workspace,
  KV: kv,
  SQLite: sqlite,
  Code: codeRunner,
  Documents: documents,
  Clock: clock,
  Calc: calc,
  Data: data,
  Git: gitProvider,
  WebSearch: webSearch,
  Skills: skills,
  Remote: remote,
};

function object(properties: Record<string, JsonSchema>, required: string[] = []): JsonSchema {
  return { type: "object", properties, required, additionalProperties: false };
}

const path = (description: string): JsonSchema => ({ type: "string", description });
const anyValue: JsonSchema = { description: "Any JSON value." };
const tz: JsonSchema = { type: "string", description: 'IANA timezone, like "Europe/London" (default the tool\'s, or UTC).' };
const dateArg = (description: string): JsonSchema => ({ type: ["string", "number"], description: `${description} ISO 8601, or unix milliseconds.` });
const strings = (description: string): JsonSchema => ({ type: "array", items: { type: "string" }, description });
const sqlParams: JsonSchema = {
  type: ["array", "object"],
  description: "Values for the placeholders: a list for ? (or ?1, ?2), a record for :name. Lists and records inside are stored as JSON text.",
};
const listArg: JsonSchema = { type: "array", description: "A list of records." };
const whereArg: JsonSchema = { type: ["object", "string"], description: "Conditions, all of which must hold: { path: value } or { path: { op: value } }, or text like \"total > 100 && status == 'paid'\"." };

export const LOCAL_PROVIDER_INFO: Record<string, ProviderInfo> = {
  Workspace: {
    description: "Files in one folder (the workspace root). Paths are relative to the root; absolute paths, .. and symlinks out of it are refused. Writing needs the tool declared with write: true.",
    methods: [
      {
        name: "read",
        description: "Read a text file. Returns { path, content, lines } (lines = the file's line count). Pass offset and limit to read part of a long file. Files over 1MB are cut off.",
        params: object(
          {
            path: path("File path, relative to the workspace root."),
            offset: { type: "integer", minimum: 1, description: "First line to return (1-based)." },
            limit: { type: "integer", minimum: 0, description: "Number of lines to return." },
          },
          ["path"],
        ),
        effect: "read",
      },
      {
        name: "write",
        description: "Create or overwrite a file with the given content (parent folders are created). Returns { path, bytes, created }.",
        params: object({ path: path("File path, relative to the workspace root."), content: { type: "string", description: "The whole new content of the file." } }, ["path", "content"]),
        effect: "write",
      },
      {
        name: "edit",
        description: "Replace exact text in a file. `old` must appear exactly once (include surrounding lines to make it unique), unless all is true. Returns { path, replacements }.",
        params: object(
          {
            path: path("File path, relative to the workspace root."),
            old: { type: "string", description: "The exact text to replace, including whitespace." },
            new: { type: "string", description: "The replacement text." },
            all: { type: "boolean", description: "Replace every occurrence instead of requiring exactly one." },
          },
          ["path", "old", "new"],
        ),
        effect: "write",
      },
      {
        name: "list",
        description: "List a folder's files and subfolders. Returns { path, entries: [{ path, type, size? }] }. node_modules and .git are skipped.",
        params: object({
          path: path('Folder, relative to the workspace root (default ".").'),
          depth: { type: "integer", minimum: 1, maximum: 10, description: "How many levels deep to list (default 1)." },
        }),
        effect: "read",
      },
      {
        name: "glob",
        description: 'Find files whose path matches a glob pattern, like "**/*.ts" or "src/*.{js,json}". Returns { pattern, matches: [path] } (at most 1000).',
        params: object({ pattern: { type: "string", description: "Glob pattern, relative to the workspace root." } }, ["pattern"]),
        effect: "read",
      },
      {
        name: "search",
        description: "Search file contents line by line, like grep. Returns { pattern, matches: [{ path, line, text }] } (at most 200). Binary files and files over 1MB are skipped.",
        params: object(
          {
            pattern: { type: "string", description: "Text to find (literal, unless regex is true)." },
            path: path('File or folder to search in (default ".").'),
            regex: { type: "boolean", description: "Treat pattern as a JavaScript regular expression." },
            ignore_case: { type: "boolean", description: "Match case-insensitively." },
            glob: { type: "string", description: 'Only search files whose path matches this glob, e.g. "**/*.md".' },
          },
          ["pattern"],
        ),
        effect: "read",
      },
      {
        name: "delete",
        description: "Delete a file, or a folder (a folder that isn't empty needs recursive: true). A symlink is removed, not its target. Returns { path, deleted }.",
        params: object({ path: path("File or folder, relative to the workspace root."), recursive: { type: "boolean", description: "Delete a folder and everything in it." } }, ["path"]),
        effect: "write",
      },
      {
        name: "mkdir",
        description: "Create a folder (and any missing parents). Returns { path, created }.",
        params: object({ path: path("Folder, relative to the workspace root.") }, ["path"]),
        effect: "write",
      },
    ],
  },

  KV: {
    description: "A persistent key-value store (local SQLite). Values are any JSON. Keys can expire.",
    methods: [
      {
        name: "get",
        description: "Get a key's value, or null (or `default`) when it's missing or expired.",
        params: object({ key: { type: "string", description: "The key." }, default: { ...anyValue, description: "Returned when the key is missing." } }, ["key"]),
        effect: "read",
      },
      {
        name: "set",
        description: "Set a key to a value, optionally expiring after ttl. Returns { key, set, expires_at? }.",
        params: object(
          {
            key: { type: "string", description: "The key." },
            value: { ...anyValue, description: "The value (any JSON)." },
            ttl: { type: ["string", "number"], description: 'Time to live: seconds, or a duration like "30s", "5m", "1h", "2d".' },
          },
          ["key", "value"],
        ),
        effect: "write",
      },
      {
        name: "delete",
        description: "Delete a key. Returns { key, deleted }.",
        params: object({ key: { type: "string", description: "The key." } }, ["key"]),
        effect: "write",
      },
      {
        name: "list",
        description: "List keys and values in key order, optionally only keys starting with prefix. Returns [{ key, value }].",
        params: object({
          prefix: { type: "string", description: "Only keys that start with this." },
          limit: { type: "integer", minimum: 1, maximum: 1000, description: "Most entries to return (default 100)." },
        }),
        effect: "read",
      },
      {
        name: "incr",
        description: "Add to a numeric key (a missing key counts as 0) and return the new number.",
        params: object({
          key: { type: "string", description: "The key." },
          by: { type: "number", description: "Amount to add (default 1; negative to subtract)." },
          ttl: { type: ["string", "number"], description: "Expiry for a key this creates (an existing key keeps its own)." },
        }, ["key"]),
        effect: "write",
      },
    ],
  },

  SQLite: {
    description:
      "A local SQLite database. Write SQL with ? or :name placeholders and pass the values in params (never put values in the SQL text). One statement per call. query, get and tables only read; execute changes data, and needs the tool declared with write: true.",
    methods: [
      {
        name: "query",
        description: "Run a SELECT (or WITH ... SELECT) and return its rows as a list of records. The database can't be changed through this method. More rows than limit is an error: add a LIMIT.",
        params: object(
          {
            sql: { type: "string", description: 'One SQL statement, e.g. "SELECT * FROM orders WHERE status = :status".' },
            params: sqlParams,
            limit: { type: "integer", minimum: 1, maximum: 100000, description: "Most rows to return (default 1000)." },
          },
          ["sql"],
        ),
        effect: "read",
      },
      {
        name: "get",
        description: "Run a SELECT and return its first row as a record, or null when there is none.",
        params: object({ sql: { type: "string", description: "One SQL statement." }, params: sqlParams }, ["sql"]),
        effect: "read",
      },
      {
        name: "tables",
        description: "The database's tables and views, with their columns: [{ name, type, columns: [{ name, type, not_null?, primary_key?, default? }] }].",
        params: object({}),
        effect: "read",
      },
      {
        name: "execute",
        description:
          "Run one INSERT, UPDATE, DELETE, CREATE, ALTER or DROP statement. With batch (a list of params, one per row), runs it once per row in a single transaction. Returns { changes, last_insert_rowid }, plus rows for a statement with RETURNING.",
        params: object(
          {
            sql: { type: "string", description: 'One SQL statement, e.g. "INSERT INTO notes (title, body) VALUES (:title, :body)".' },
            params: sqlParams,
            batch: { type: "array", items: { type: ["array", "object"] }, description: "Run the statement once per item, each item being that row's params." },
          },
          ["sql"],
        ),
        effect: "write",
      },
    ],
  },

  Code: {
    description: "Run a short code snippet in a separate process with no environment variables (no secrets). Not a security sandbox: it can still use files and the network.",
    methods: [
      {
        name: "run",
        description:
          "Run a snippet. It is the body of a function with `input` available; `return` a JSON-serializable value to get it back as `result` (printed output goes to stdout). In JS/TS, await works and modules load with await import(). Returns { stdout, stderr, exitCode, result, timedOut }.",
        params: object({ code: { type: "string", description: "The snippet: a function body that returns its answer." }, input: { ...anyValue, description: "Passed to the snippet as `input`." } }, ["code"]),
        // Arbitrary code can reach the network and start programs: as much as Bash.run can.
        effect: "external",
      },
    ],
  },

  Documents: {
    description: "Extract text from documents: text, Markdown, HTML, CSV/TSV, JSON, Word .docx, and PDF.",
    methods: [
      {
        name: "extract",
        description: "Extract a document's text from a file path (relative to the tool's root) or an http(s) URL. Returns { source, type, text }, plus rows (CSV/TSV records), data (parsed JSON), or pages (PDF page count).",
        params: object({
          path: { type: "string", description: "File path, relative to the tool's root." },
          url: { type: "string", description: "An http(s) URL to fetch instead of a path." },
          type: { type: "string", enum: ["text", "markdown", "html", "csv", "tsv", "json", "docx", "pdf"], description: "Override the type detected from the extension or content." },
        }),
        effect: "read",
      },
    ],
  },

  Clock: {
    description: "Dates and times. Dates are ISO 8601 strings; results have iso (UTC), local (in the timezone), date, time and weekday.",
    methods: [
      { name: "now", description: "The current date and time.", params: object({ timezone: tz }), effect: "read" },
      {
        name: "add",
        description: "Add (or, with negative numbers, subtract) time from a date (default now). Months and years keep the day of the month.",
        params: object({
          date: dateArg("The date to start from (default now)."),
          duration: { type: "string", description: 'Like "90m", "-2d", "1h30m", "2w".' },
          years: { type: "number" },
          months: { type: "number" },
          weeks: { type: "number" },
          days: { type: "number" },
          hours: { type: "number" },
          minutes: { type: "number" },
          timezone: tz,
        }),
        effect: "read",
      },
      { name: "diff", description: "The time from one date to another (default now), in ms, seconds, minutes, hours, days, and as text.", params: object({ from: dateArg("The earlier date."), to: dateArg("The later date (default now).") }, ["from"]), effect: "read" },
      {
        name: "format",
        description: "Format a date for people, in a timezone and locale. Returns text plus the usual fields.",
        params: object({ date: dateArg("The date (default now)."), timezone: tz, style: { type: "string", enum: ["full", "long", "medium", "short"] }, locale: { type: "string", description: 'Like "en-GB" or "de-DE".' } }),
        effect: "read",
      },
      { name: "parse", description: "Read a date written as text (ISO 8601 or a common format) into the usual fields.", params: object({ text: { type: "string", description: "The date as text." }, timezone: tz }, ["text"]), effect: "read" },
    ],
  },

  Calc: {
    description: "Exact arithmetic and statistics. Use it for any number that matters instead of working it out yourself.",
    methods: [
      {
        name: "eval",
        description:
          "Evaluate an arithmetic expression: + - * / % ^, parentheses, comparisons, names from vars (dotted paths), pi, e, and abs ceil floor round(x, digits) sqrt exp ln log log2 pow min max sum avg median sin cos tan if(c, a, b). A list in vars spreads into a function: sum(prices). Returns { expression, result }.",
        params: object({ expression: { type: "string", description: 'Like "(price * qty) * (1 + tax)".' }, vars: { type: "object", description: "Values for the names used in the expression.", additionalProperties: true } }, ["expression"]),
        effect: "read",
      },
      { name: "stats", description: "Count, sum, mean, median, min, max and sample standard deviation of a list of numbers.", params: object({ values: { type: "array", items: { type: "number" } } }, ["values"]), effect: "read" },
      { name: "percent", description: "What percent part is of whole.", params: object({ part: { type: "number" }, whole: { type: "number" } }, ["part", "whole"]), effect: "read" },
      { name: "change", description: "The difference and percent change from one number to another.", params: object({ from: { type: "number" }, to: { type: "number" } }, ["from", "to"]), effect: "read" },
    ],
  },

  Data: {
    description:
      'Reshape JSON data deterministically. Paths are dotted ("user.city", "items.0.id"). A where is { path: value } or { path: { op: value } }, ops: = != > >= < <= in not_in contains starts_with ends_with matches exists.',
    methods: [
      { name: "get", description: "The value at a path.", params: object({ data: anyValue, path: { type: "string" } }, ["data", "path"]), effect: "read" },
      { name: "pick", description: "Keep only these fields (of a record, or of each record in a list).", params: object({ data: anyValue, fields: strings("Paths to keep.") }, ["data", "fields"]), effect: "read" },
      { name: "filter", description: "The records that match where.", params: object({ data: listArg, where: whereArg }, ["data", "where"]), effect: "read" },
      { name: "find", description: "The first record that matches where, or null.", params: object({ data: listArg, where: whereArg }, ["data", "where"]), effect: "read" },
      { name: "sort", description: "Sort records by one or more paths.", params: object({ data: listArg, by: strings("Paths to sort by, in order."), desc: { type: "boolean" } }, ["data"]), effect: "read" },
      { name: "limit", description: "At most n records, after skipping offset.", params: object({ data: listArg, n: { type: "integer", minimum: 0 }, offset: { type: "integer", minimum: 0 } }, ["data", "n"]), effect: "read" },
      { name: "group", description: "Records grouped by the value at a path: { value: [records] }.", params: object({ data: listArg, by: { type: "string" } }, ["data", "by"]), effect: "read" },
      { name: "count", description: "How many records, or how many per value of by (most first).", params: object({ data: listArg, by: { type: "string" } }, ["data"]), effect: "read" },
      {
        name: "aggregate",
        description: "Sum, average, min, max, first, last, list or count a field, optionally per value of by.",
        params: object({ data: listArg, field: { type: "string" }, op: { type: "string", enum: ["sum", "avg", "min", "max", "count", "first", "last", "list"] }, by: { type: "string" } }, ["data", "op"]),
        effect: "read",
      },
      { name: "unique", description: "Drop duplicate records (or records with a duplicate value at by).", params: object({ data: listArg, by: { type: "string" } }, ["data"]), effect: "read" },
      { name: "flatten", description: "Flatten nested lists.", params: object({ data: listArg, depth: { type: "integer", minimum: 1 } }, ["data"]), effect: "read" },
      {
        name: "join",
        description: "Join two lists of records on a field (left join; type: inner drops unmatched).",
        params: object({ left: listArg, right: listArg, on: { type: ["string", "array"], description: "A path in both, or [left_path, right_path]." }, type: { type: "string", enum: ["left", "inner"] } }, ["left", "right", "on"]),
        effect: "read",
      },
      { name: "diff", description: "What changed between two values: { changed, count, changes: [{ path, type, before, after }] }. Lists of records match by key when given.", params: object({ before: anyValue, after: anyValue, key: { type: "string" } }, ["before", "after"]), effect: "read" },
      { name: "from_csv", description: "Parse CSV (or TSV) text with a header row into records.", params: object({ text: { type: "string" }, delimiter: { type: "string" } }, ["text"]), effect: "read" },
      { name: "to_csv", description: "Write records as CSV text.", params: object({ data: listArg, fields: strings("Columns, in order (default: every field).") }, ["data"]), effect: "read" },
    ],
  },

  Git: {
    description: "A local git repository. Reads are always allowed; commit and checkout need the tool declared with write: true.",
    methods: [
      { name: "status", description: "The current branch, ahead/behind counts, and changed files.", params: object({}), effect: "read" },
      {
        name: "log",
        description: "Recent commits: { hash, short, author, email, date, subject, body }.",
        params: object({ limit: { type: "integer", minimum: 1, maximum: 500 }, ref: { type: "string" }, path: { type: "string" }, since: { type: "string", description: 'Like "2 weeks ago" or "2026-01-01".' }, author: { type: "string" }, grep: { type: "string", description: "Only commits whose message matches." } }),
        effect: "read",
      },
      {
        name: "diff",
        description: "A unified diff: working tree vs index by default, staged changes with staged: true, or between from and to.",
        params: object({ from: { type: "string" }, to: { type: "string" }, staged: { type: "boolean" }, path: { type: "string" }, stat: { type: "boolean", description: "Only a summary of changed files." } }),
        effect: "read",
      },
      { name: "show", description: "A commit (message and patch), or a file's content at a ref when path is given.", params: object({ ref: { type: "string", description: "Default HEAD." }, path: { type: "string" } }), effect: "read" },
      { name: "blame", description: "Who last changed each line of a file.", params: object({ path: { type: "string" }, start: { type: "integer", minimum: 1 }, end: { type: "integer", minimum: 1 }, ref: { type: "string" } }, ["path"]), effect: "read" },
      { name: "branches", description: "Local and remote branches.", params: object({}), effect: "read" },
      { name: "files", description: "Tracked and untracked (not ignored) files, optionally matching a pathspec.", params: object({ pattern: { type: "string" } }), effect: "read" },
      { name: "grep", description: "Search the repository's files.", params: object({ pattern: { type: "string" }, path: { type: "string" }, regex: { type: "boolean" }, ignore_case: { type: "boolean" } }, ["pattern"]), effect: "read" },
      { name: "commit", description: "Stage paths (or all: true) and commit them. Hooks are skipped.", params: object({ message: { type: "string" }, paths: strings("Files to stage first."), all: { type: "boolean" } }, ["message"]), effect: "write" },
      { name: "checkout", description: "Switch to a branch, or create it with create: true.", params: object({ branch: { type: "string" }, create: { type: "boolean" } }, ["branch"]), effect: "write" },
    ],
  },

  WebSearch: {
    description: "Searches the web (Brave, Tavily, Serper or Exa). Read the pages you'll rely on before citing them.",
    methods: [
      {
        name: "search",
        description: "Search the web. Returns { query, engine, results: [{ title, url, snippet, published? }] }.",
        params: object({
          query: { type: "string", description: "What to search for." },
          limit: { type: "integer", minimum: 1, maximum: 20, description: "How many results (default 5)." },
          site: { type: "string", description: 'Only results from this site, like "docs.python.org".' },
          freshness: { type: "string", enum: ["day", "week", "month", "year"], description: "Only recent results." },
        }, ["query"]),
        effect: "read",
      },
    ],
  },

  Skills: SKILLS_INFO,

  Remote: {
    description: "A remote computer: a machine reached over SSH, or a fresh sandbox (E2B, Daytona, or a local Docker container) kept for the run and deleted after. Commands run in a shell there; paths there are relative to the home folder.",
    methods: [
      {
        name: "run",
        description: "Run a shell command on the remote computer. Returns { stdout, stderr, exitCode, timedOut } (and json, when stdout is JSON).",
        params: object({
          command: { type: "string", description: "A shell command, e.g. \"ls -la\" or \"python3 app.py\"." },
          cwd: { type: "string", description: "Folder to run it in." },
          env: { type: "object", additionalProperties: { type: "string" }, description: "Environment variables for this command." },
          timeout_ms: { type: "integer", minimum: 1000, maximum: 3600000 },
        }, ["command"]),
        effect: "external",
      },
      { name: "read", description: "Read a file on the remote computer: { path, content, bytes, encoding } (base64 for binary files).", params: object({ path: { type: "string" } }, ["path"]), effect: "read" },
      { name: "write", description: "Write text to a file on the remote computer, creating folders as needed.", params: object({ path: { type: "string" }, content: { type: "string" } }, ["path", "content"]), effect: "external" },
      { name: "list", description: "List a folder on the remote computer: { path, entries: [{ name, type }] }.", params: object({ path: { type: "string", description: "Default: the home folder." } }), effect: "read" },
      { name: "upload", description: "Copy a local file (inside the tool's root) to the remote computer.", params: object({ from: { type: "string", description: "Local path." }, to: { type: "string", description: "Remote path (default: the same path)." } }, ["from"]), effect: "external" },
      { name: "download", description: "Copy a file from the remote computer to a local path inside the tool's root.", params: object({ from: { type: "string", description: "Remote path." }, to: { type: "string", description: "Local path (default: the file's name)." } }, ["from"]), effect: "write" },
      { name: "info", description: "Which computer this is: { backend, host } or { backend, id }.", params: object({}), effect: "read" },
      { name: "diff", description: "What changed in the sandbox since it started (from the files it was given with from:, or from empty): { files: [{ path, status }], patch } as a unified diff.", params: object({ path: { type: "string", description: "Only changes under this folder." } }), effect: "read" },
      { name: "apply", description: "Copy the sandbox's changes (diff) back to the local folder it was given (from:), or to: another folder inside the tool's root. Deleted files are deleted there too.", params: object({ to: { type: "string" }, path: { type: "string", description: "Only changes under this folder." } }), effect: "write" },
      { name: "keep", description: "After a fan-out whose branches each forked the Docker sandbox: carry on from branch fork's sandbox.", params: object({ fork: { type: "integer", minimum: 0 } }, ["fork"]), effect: "external" },
    ],
  },
};
