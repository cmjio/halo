/**
 * SQLite: a local SQLite database file in the project folder.
 *
 *   tool Shop : SQLite("data/shop.db", write: true)
 *     query(sql, params?, limit?)   get(sql, params?)   tables()        (read)
 *     execute(sql, params?, batch?)                                  (write; needs write: true)
 *
 * SQL is always parameterised: values go in `params:` (a list for `?` / `?1`, a
 * record for `:name`, `@name` or `$name`) or in named args of the same names
 * (`id: userId` fills `:id`), never into the SQL text. A pipeline's
 * `sql:` must be written out as a string with no {{placeholders}} (validate and the
 * runtime refuse one that isn't; see sqlArgProblem in src/parser/sql.ts).
 *
 * Reads and writes are separate methods, so `halo plan` and policies see which is
 * which (AllowEffects(read), ApproveEffects(write)), and the separation is enforced
 * by SQLite rather than by reading the SQL:
 *   - a tool without `write: true` opens the file read-only (and never creates it);
 *   - `query`, `get` and `tables` run with PRAGMA query_only on, so even on a
 *     writable tool they can't change anything;
 *   - one statement per call, and statements that reach past the database file or
 *     change the connection (ATTACH, DETACH, VACUUM, PRAGMA, transaction control)
 *     are refused, so a read can't turn query_only off and nothing can write a file
 *     outside the project folder.
 *
 * The database path is relative to the project folder (the current directory) and
 * can't leave it: absolute paths, `..` and symlinks out of it are refused.
 */

import { Database, type Statement } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, relative } from "node:path";
import { HaloError } from "../errors.js";
import type { ToolCall, ToolProvider } from "../tools.js";
import { explicitFirst, intArg, unknownMethod } from "./common.js";
import { confine, workspaceRoot } from "./workspace.js";

const DEFAULT_PATH = ".halo/data.sqlite";
const METHODS = ["query", "get", "tables", "execute"];
const READS = new Set(["query", "get", "tables"]);
const DEFAULT_LIMIT = 1000;
const MAX_LIMIT = 100_000;
const MAX_BATCH = 100_000;

/** Statements no method runs: they reach past the database file, or change the connection itself. */
const REFUSED = new Map<string, string>([
  ["ATTACH", "ATTACH opens another database file"],
  ["DETACH", "DETACH changes the connection's databases"],
  ["VACUUM", "VACUUM can write a copy of the database to another file"],
  ["PRAGMA", "PRAGMA changes the connection's settings; use tables() for the schema, or pragma_table_info('t') in a SELECT"],
  ["BEGIN", "each execute is its own transaction; pass batch: to run many rows in one"],
  ["COMMIT", "each execute is its own transaction"],
  ["END", "each execute is its own transaction"],
  ["ROLLBACK", "each execute is its own transaction"],
  ["SAVEPOINT", "each execute is its own transaction"],
  ["RELEASE", "each execute is its own transaction"],
]);

interface Handle {
  db: Database;
  /** Opened read-only, so SQLite refuses every write on this connection. */
  readOnly: boolean;
}

const handles = new Map<string, Handle>();

/** Close every cached SQLite database (tests, shutdown). */
export function closeSqliteDatabases(): void {
  for (const h of handles.values()) h.db.close();
  handles.clear();
}

function argError(call: ToolCall, message: string): HaloError {
  return new HaloError(`${call.tool.name}.${call.method}: ${message}`, { code: "TOOL_ARGUMENT" });
}

/**
 * Split SQL into its words and statements, skipping string literals, quoted
 * identifiers and comments. Returns the first two keywords (upper-cased) of the
 * first statement, and whether anything but whitespace and comments follows it.
 */
export function scanSql(sql: string): { keywords: string[]; trailing: boolean } {
  const keywords: string[] = [];
  let i = 0;
  let ended = false;
  while (i < sql.length) {
    const c = sql[i]!;
    if (/\s/.test(c)) {
      i++;
    } else if (c === "-" && sql[i + 1] === "-") {
      const nl = sql.indexOf("\n", i);
      i = nl < 0 ? sql.length : nl + 1;
    } else if (c === "/" && sql[i + 1] === "*") {
      const close = sql.indexOf("*/", i + 2);
      i = close < 0 ? sql.length : close + 2;
    } else if (ended) {
      return { keywords, trailing: true };
    } else if (c === ";") {
      ended = true;
      i++;
    } else if (c === "'" || c === '"' || c === "`" || c === "[") {
      const close = c === "[" ? "]" : c;
      let j = i + 1;
      for (;;) {
        const k = sql.indexOf(close, j);
        if (k < 0) {
          j = sql.length;
          break;
        }
        // '' inside a string (and "" inside an identifier) is an escaped quote.
        if (close !== "]" && sql[k + 1] === close) {
          j = k + 2;
          continue;
        }
        j = k + 1;
        break;
      }
      i = j;
    } else if (/[A-Za-z_]/.test(c)) {
      let j = i + 1;
      while (j < sql.length && /\w/.test(sql[j]!)) j++;
      if (keywords.length < 4) keywords.push(sql.slice(i, j).toUpperCase());
      i = j;
    } else {
      i++;
    }
  }
  return { keywords, trailing: false };
}

/** Refuse what no method runs: more than one statement, or a statement in REFUSED. */
function checkStatement(call: ToolCall, sql: string): void {
  const { keywords, trailing } = scanSql(sql);
  if (!keywords.length) throw argError(call, "the SQL is empty");
  if (trailing) throw argError(call, "runs one statement per call; split the SQL into separate calls");
  // EXPLAIN [QUERY PLAN] <statement> is checked by the statement it explains.
  const lead = keywords[0] === "EXPLAIN" ? (keywords[1] === "QUERY" ? keywords[3] : keywords[1]) : keywords[0];
  const why = lead ? REFUSED.get(lead) : undefined;
  if (why) throw argError(call, `${lead} is not allowed: ${why}`);
}

/** The database file, inside the project folder; ":memory:" for a database that lasts the process. */
function databasePath(call: ToolCall): string {
  const configured = call.config(0) ?? call.config("path") ?? DEFAULT_PATH;
  if (typeof configured !== "string" || !configured) throw new HaloError(`Tool "${call.tool.name}" needs a database file, e.g. SQLite("data/app.db")`, { code: "TOOL_CONFIG" });
  if (configured === ":memory:") return configured;
  const root = workspaceRoot(call, ".", false);
  try {
    return confine(call, root, configured).abs;
  } catch (err) {
    const why = err instanceof Error ? err.message.replace(/^[^:]*: /, "") : String(err);
    throw new HaloError(`Tool "${call.tool.name}": database ${why.replace(/workspace root|workspace/g, "project folder")}`, { code: "TOOL_CONFIG" });
  }
}

function open(call: ToolCall, path: string, writable: boolean): Handle {
  const key = `${writable ? "rw" : "ro"}:${path}`;
  let h = handles.get(key);
  if (h) return h;
  let db: Database;
  try {
    if (writable && path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    db = writable || path === ":memory:" ? new Database(path, { create: true, strict: true }) : new Database(path, { readonly: true, strict: true });
  } catch (err) {
    const rel = path === ":memory:" ? path : relative(process.cwd(), path);
    const missing = !writable && /unable to open/i.test(String(err));
    throw new HaloError(
      missing ? `Tool "${call.tool.name}": database "${rel}" doesn't exist (a read-only tool never creates it; declare one with write: true to create it)` : `Tool "${call.tool.name}": can't open database "${rel}": ${err instanceof Error ? err.message : err}`,
      { code: "TOOL_CONFIG" },
    );
  }
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec("PRAGMA foreign_keys = ON");
  h = { db, readOnly: !writable && path !== ":memory:" };
  handles.set(key, h);
  return h;
}

type Binding = string | number | bigint | boolean | null | Uint8Array;

function bindValue(v: unknown): Binding {
  if (v === undefined || v === null) return null;
  if (typeof v === "string" || typeof v === "number" || typeof v === "bigint" || typeof v === "boolean") return v;
  if (v instanceof Uint8Array) return v;
  // Lists and records are stored as JSON text (read them back with json_extract, or JSON.parse).
  return JSON.stringify(v);
}

/** `params:` as SQLite bindings: a list for ? / ?1, a record for :name, @name, $name. */
function bindings(call: ToolCall, params: unknown): Binding[] | Record<string, Binding> {
  if (params === undefined || params === null) return [];
  if (Array.isArray(params)) return params.map(bindValue);
  if (typeof params === "object") return Object.fromEntries(Object.entries(params as Record<string, unknown>).map(([k, v]) => [k.replace(/^[:@$]/, ""), bindValue(v)]));
  return [bindValue(params)];
}

/** Rows as plain JSON: BLOBs become base64 text. */
function plain(row: Record<string, unknown>): Record<string, unknown> {
  for (const [k, v] of Object.entries(row)) if (v instanceof Uint8Array) row[k] = Buffer.from(v).toString("base64");
  return row;
}

function sqlOf(call: ToolCall): string {
  const sql = call.named.sql ?? call.named.query ?? explicitFirst(call);
  if (typeof sql !== "string" || !sql.trim()) throw argError(call, 'needs sql: "SELECT ..." (with ? or :name placeholders, and the values in params:)');
  return sql;
}

/** Named args that configure the call rather than fill a :name placeholder. */
const CALL_ARGS = new Set(["sql", "query", "params", "limit", "batch"]);

/**
 * The call's values: `params:` (a list or record), a second positional arg, or else
 * the other named args, each filling the :name placeholder of the same name
 * (`DB.get(sql: "SELECT * FROM users WHERE id = :id", id: userId)`).
 */
function paramsOf(call: ToolCall): unknown {
  if (call.named.params !== undefined) return call.named.params;
  if (!call.implicitInput && call.positional[1] !== undefined) return call.positional[1];
  const rest = Object.entries(call.named).filter(([k]) => !CALL_ARGS.has(k));
  return rest.length ? Object.fromEntries(rest) : undefined;
}

function prepare(call: ToolCall, db: Database, sql: string): Statement {
  try {
    return db.query(sql);
  } catch (err) {
    throw argError(call, err instanceof Error ? err.message : String(err));
  }
}

function run<T>(call: ToolCall, fn: () => T): T {
  try {
    return fn();
  } catch (err) {
    if (err instanceof HaloError) throw err;
    const message = err instanceof Error ? err.message : String(err);
    if (/readonly database/i.test(message)) throw argError(call, `${message} (${READS.has(call.method) ? `${call.method} only reads; use execute to change data` : "declare the tool with write: true"})`);
    throw argError(call, message);
  }
}

/** Run a read with query_only on, so SQLite itself refuses any change. */
function reading<T>(h: Handle, fn: () => T): T {
  if (h.readOnly) return fn();
  h.db.exec("PRAGMA query_only = ON");
  try {
    return fn();
  } finally {
    h.db.exec("PRAGMA query_only = OFF");
  }
}

export const sqlite: ToolProvider = async (call) => {
  if (!METHODS.includes(call.method)) unknownMethod(call, METHODS);
  const writable = call.config("write") === true;
  if (call.method === "execute" && !writable) {
    throw argError(call, "changes the database; declare the tool with write: true to allow it");
  }
  const path = databasePath(call);
  const h = open(call, path, writable);
  const db = h.db;

  switch (call.method) {
    case "tables":
      return run(call, () =>
        reading(h, () => {
          const tables = db.query("SELECT name, type FROM sqlite_schema WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as Array<{ name: string; type: string }>;
          return tables.map((t) => ({
            name: t.name,
            type: t.type,
            columns: (db.query("SELECT name, type, \"notnull\", pk, dflt_value FROM pragma_table_info(?)").all(t.name) as Array<{ name: string; type: string; notnull: number; pk: number; dflt_value: unknown }>).map((c) => ({
              name: c.name,
              type: c.type,
              ...(c.notnull ? { not_null: true } : {}),
              ...(c.pk ? { primary_key: true } : {}),
              ...(c.dflt_value !== null ? { default: c.dflt_value } : {}),
            })),
          }));
        }),
      );

    case "query":
    case "get": {
      const sql = sqlOf(call);
      checkStatement(call, sql);
      const params = bindings(call, paramsOf(call));
      const limit = call.method === "get" ? 1 : intArg(call, "limit", call.named.limit ?? call.config("limit"), DEFAULT_LIMIT, 1, MAX_LIMIT);
      return run(call, () =>
        reading(h, () => {
          const stmt = prepare(call, db, sql);
          const rows: Record<string, unknown>[] = [];
          try {
            for (const row of stmt.iterate(params as never) as IterableIterator<Record<string, unknown>>) {
              if (rows.length === limit) {
                if (call.method === "get") break;
                throw argError(call, `returned more than ${limit} rows; add a LIMIT to the SQL, or pass a higher limit: (at most ${MAX_LIMIT})`);
              }
              rows.push(plain(row));
            }
          } finally {
            stmt.finalize();
          }
          return call.method === "get" ? (rows[0] ?? null) : rows;
        }),
      );
    }

    case "execute": {
      const sql = sqlOf(call);
      checkStatement(call, sql);
      const batch = call.named.batch;
      if (batch !== undefined && !Array.isArray(batch)) throw argError(call, "batch: must be a list of params (one list or record per row)");
      if (Array.isArray(batch) && batch.length > MAX_BATCH) throw argError(call, `batch: has ${batch.length} rows, more than ${MAX_BATCH}`);
      const sets = Array.isArray(batch) ? batch.map((p) => bindings(call, p)) : [bindings(call, paramsOf(call))];
      return run(call, () => {
        const stmt = prepare(call, db, sql);
        try {
          let changes = 0;
          let lastId: number | bigint = 0;
          const returned: Record<string, unknown>[] = [];
          // One transaction: a batch is all or nothing.
          db.transaction(() => {
            for (const params of sets) {
              if (stmt.columnNames.length) {
                // INSERT ... RETURNING (or a SELECT): keep the rows it gives back.
                for (const row of stmt.all(params as never) as Record<string, unknown>[]) returned.push(plain(row));
                const r = db.query("SELECT changes() AS changes, last_insert_rowid() AS id").get() as { changes: number; id: number };
                changes += r.changes;
                lastId = r.id;
              } else {
                const r = stmt.run(params as never);
                changes += r.changes;
                lastId = r.lastInsertRowid;
              }
            }
          })();
          return { changes, last_insert_rowid: typeof lastId === "bigint" ? Number(lastId) : lastId, ...(stmt.columnNames.length ? { rows: returned } : {}), ...(Array.isArray(batch) ? { statements: sets.length } : {}) };
        } finally {
          stmt.finalize();
        }
      });
    }
  }
  return unknownMethod(call, METHODS);
};
