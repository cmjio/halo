import { test, expect, describe, beforeAll, afterAll, afterEach } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "../src/parser/index";
import { validate } from "../src/parser/validate";
import { plan } from "../src/plan";
import { HaloRuntime, useTool, type MockRequest } from "../src/runtime/runtime";
import { BUILTIN_PROVIDER_INFO } from "../src/runtime/provider-info";
import { LOCAL_PROVIDERS, LOCAL_PROVIDER_INFO, closeSqliteDatabases } from "../src/runtime/providers/index";
import { scanSql } from "../src/runtime/providers/sqlite";
import type { ToolCall, ToolServices } from "../src/runtime/tools";

// SQLite databases live in the project folder (the current directory), so these tests run in a temporary one.
let project: string;
let outside: string;
let cwd: string;
beforeAll(() => {
  cwd = process.cwd();
  project = realpathSync(mkdtempSync(join(tmpdir(), "halo-sqlite-project-")));
  outside = realpathSync(mkdtempSync(join(tmpdir(), "halo-sqlite-outside-")));
  process.chdir(project);
});
afterEach(() => closeSqliteDatabases());
afterAll(() => {
  process.chdir(cwd);
  rmSync(project, { recursive: true, force: true });
  rmSync(outside, { recursive: true, force: true });
});

function makeCall(method: string, named: Record<string, unknown>, decl: [unknown?, Record<string, unknown>?], positional: unknown[] = [], implicitInput = false): ToolCall {
  const [first, declNamed = {}] = decl;
  return {
    tool: { name: "DB", provider: "SQLite", args: [], namedArgs: {}, argList: [] },
    method,
    positional,
    implicitInput,
    named,
    config: (n) => (n === 0 ? first : typeof n === "string" ? declNamed[n] : undefined),
    viaAgent: false,
    signal: new AbortController().signal,
  };
}

const services = {} as ToolServices;
const sql = (method: string, named: Record<string, unknown>, decl: [unknown?, Record<string, unknown>?] = ["data/app.db", { write: true }], positional: unknown[] = []) =>
  LOCAL_PROVIDERS.SQLite!(makeCall(method, named, decl, positional), services) as Promise<any>;
const read = (method: string, named: Record<string, unknown>) => sql(method, named, ["data/app.db"]);

const quiet = { env: {}, logger: { log() {}, warn() {} } };

describe("SQLite provider", () => {
  test("creates the file, writes with params, and reads it back", async () => {
    expect(await sql("execute", { sql: "CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY, title TEXT NOT NULL, tags TEXT, done INTEGER DEFAULT 0)" })).toEqual({ changes: 0, last_insert_rowid: 0 });
    expect(existsSync(join(project, "data", "app.db"))).toBe(true);

    expect(await sql("execute", { sql: "INSERT INTO notes (title, tags) VALUES (?, ?)", params: ["first", ["a", "b"]] })).toEqual({ changes: 1, last_insert_rowid: 1 });
    expect(await sql("execute", { sql: "INSERT INTO notes (title) VALUES (:title)", params: { title: "second" } })).toMatchObject({ changes: 1, last_insert_rowid: 2 });
    // Named args fill :name placeholders too.
    expect(await sql("execute", { sql: "INSERT INTO notes (title, done) VALUES (:title, :done)", title: "third", done: true })).toMatchObject({ last_insert_rowid: 3 });

    expect(await read("query", { sql: "SELECT id, title, tags FROM notes WHERE done = ? ORDER BY id", params: [0] })).toEqual([
      { id: 1, title: "first", tags: '["a","b"]' },
      { id: 2, title: "second", tags: null },
    ]);
    expect(await read("get", { sql: "SELECT title FROM notes WHERE id = :id", id: 3 })).toEqual({ title: "third" });
    expect(await read("get", { sql: "SELECT title FROM notes WHERE id = :id", id: 99 })).toBeNull();
    // A value that looks like SQL is only ever data.
    expect(await read("query", { sql: "SELECT id FROM notes WHERE title = ?", params: ["x' OR '1'='1"] })).toEqual([]);
  });

  test("SQL as the first positional arg, params as the second", async () => {
    await sql("execute", { sql: "CREATE TABLE kv (k TEXT PRIMARY KEY, v TEXT)" });
    await sql("execute", {}, undefined, ["INSERT INTO kv VALUES (?, ?)", ["a", "1"]]);
    expect(await sql("query", {}, undefined, ["SELECT * FROM kv WHERE k = ?", ["a"]])).toEqual([{ k: "a", v: "1" }]);
  });

  test("batch runs one statement per row in one transaction; RETURNING gives rows", async () => {
    await sql("execute", { sql: "CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT UNIQUE, qty INTEGER)" });
    const r = await sql("execute", { sql: "INSERT INTO items (name, qty) VALUES (:name, :qty)", batch: [{ name: "a", qty: 1 }, { name: "b", qty: 2 }] });
    expect(r).toEqual({ changes: 2, last_insert_rowid: 2, statements: 2 });
    // The second row breaks a constraint, so the first isn't kept either.
    await expect(sql("execute", { sql: "INSERT INTO items (name, qty) VALUES (?, ?)", batch: [["c", 3], ["a", 4]] })).rejects.toThrow(/UNIQUE/);
    expect(await read("query", { sql: "SELECT name FROM items ORDER BY id" })).toEqual([{ name: "a" }, { name: "b" }]);

    const ret = await sql("execute", { sql: "UPDATE items SET qty = qty + 1 WHERE qty >= ? RETURNING name, qty", params: [1] });
    expect(ret.changes).toBe(2);
    expect(ret.rows).toEqual([{ name: "a", qty: 2 }, { name: "b", qty: 3 }]);
  });

  test("tables lists tables and columns", async () => {
    const db: [string, Record<string, unknown>] = ["data/people.db", { write: true }];
    await sql("execute", { sql: "CREATE TABLE people (id INTEGER PRIMARY KEY, name TEXT NOT NULL, team TEXT DEFAULT 'none')" }, db);
    await sql("execute", { sql: "CREATE VIEW names AS SELECT name FROM people" }, db);
    const tables = await sql("tables", {}, ["data/people.db"]);
    expect(tables.map((t: { name: string }) => t.name)).toEqual(["names", "people"]);
    expect(tables.find((t: { name: string }) => t.name === "people").columns).toEqual([
      { name: "id", type: "INTEGER", primary_key: true },
      { name: "name", type: "TEXT", not_null: true },
      { name: "team", type: "TEXT", default: "'none'" },
    ]);
  });

  test("BLOBs come back as base64", async () => {
    await sql("execute", { sql: "CREATE TABLE IF NOT EXISTS blobs (b BLOB)" });
    await sql("execute", { sql: "INSERT INTO blobs VALUES (?)", params: [new Uint8Array([104, 105])] });
    expect(await read("get", { sql: "SELECT b FROM blobs" })).toEqual({ b: "aGk=" });
  });

  test("a tool without write: true can't change anything, or create the file", async () => {
    await expect(read("execute", { sql: "CREATE TABLE t (x)" })).rejects.toThrow(/declare the tool with write: true/);
    await expect(sql("query", { sql: "SELECT 1" }, ["data/missing.db"])).rejects.toThrow(/doesn't exist/);
    expect(existsSync(join(project, "data", "missing.db"))).toBe(false);

    await sql("execute", { sql: "CREATE TABLE IF NOT EXISTS t (x)" });
    // Reads on a read-only tool open the file read-only: SQLite refuses the write.
    await expect(read("query", { sql: "INSERT INTO t VALUES (1) RETURNING x" })).rejects.toThrow(/readonly/);
  });

  test("query and get only read, even on a writable tool", async () => {
    await sql("execute", { sql: "CREATE TABLE IF NOT EXISTS t (x)" });
    await expect(sql("query", { sql: "INSERT INTO t VALUES (1) RETURNING x" })).rejects.toThrow(/only reads; use execute/);
    await expect(sql("get", { sql: "DELETE FROM t RETURNING x" })).rejects.toThrow(/readonly/);
    await expect(sql("query", { sql: "CREATE TABLE u (y)" })).rejects.toThrow(/readonly/);
    // query_only is switched back off afterwards.
    expect(await sql("execute", { sql: "INSERT INTO t VALUES (2)" })).toMatchObject({ changes: 1 });
    expect(await read("query", { sql: "SELECT x FROM t" })).toEqual([{ x: 2 }]);
  });

  test("one statement per call; nothing that reaches past the file or the connection", async () => {
    await sql("execute", { sql: "CREATE TABLE IF NOT EXISTS t (x)" });
    await expect(sql("query", { sql: "SELECT 1; DROP TABLE t" })).rejects.toThrow(/one statement per call/);
    await expect(sql("execute", { sql: "INSERT INTO t VALUES (1); DROP TABLE t" })).rejects.toThrow(/one statement per call/);
    await expect(sql("query", { sql: "PRAGMA query_only = OFF" })).rejects.toThrow(/PRAGMA is not allowed/);
    await expect(sql("execute", { sql: `ATTACH DATABASE '${join(outside, "x.db")}' AS x` })).rejects.toThrow(/ATTACH is not allowed/);
    await expect(sql("execute", { sql: `VACUUM INTO '${join(outside, "copy.db")}'` })).rejects.toThrow(/VACUUM is not allowed/);
    await expect(sql("query", { sql: `EXPLAIN QUERY PLAN VACUUM` })).rejects.toThrow(/VACUUM is not allowed/);
    await expect(sql("execute", { sql: "BEGIN" })).rejects.toThrow(/BEGIN is not allowed/);
    expect(existsSync(join(outside, "x.db"))).toBe(false);
    expect(existsSync(join(outside, "copy.db"))).toBe(false);
    // Semicolons in strings, identifiers and comments are fine, and so is a trailing one.
    expect(await sql("get", { sql: "SELECT ';' AS \"a;b\" -- trailing; comment\n;" })).toEqual({ "a;b": ";" });
    expect(await read("query", { sql: "SELECT count(*) AS n FROM t /* ; */" })).toHaveLength(1);
  });

  test("scanSql skips strings, identifiers and comments", () => {
    expect(scanSql("select 'it''s; fine', [x;y] from t; ")).toEqual({ keywords: ["SELECT", "FROM", "T"], trailing: false });
    expect(scanSql("/* lead */ pragma x")).toEqual({ keywords: ["PRAGMA", "X"], trailing: false });
    expect(scanSql("select 1; select 2")).toMatchObject({ trailing: true });
  });

  test("more rows than limit is an error, not a silent cut", async () => {
    await sql("execute", { sql: "CREATE TABLE IF NOT EXISTS n (i)" });
    await sql("execute", { sql: "INSERT INTO n VALUES (?)", batch: [[1], [2], [3]] });
    expect(await read("query", { sql: "SELECT i FROM n", limit: 3 })).toHaveLength(3);
    await expect(read("query", { sql: "SELECT i FROM n", limit: 2 })).rejects.toThrow(/more than 2 rows/);
  });

  test("the database stays inside the project folder", async () => {
    await expect(sql("tables", {}, [join(outside, "x.db"), { write: true }])).rejects.toThrow(/not absolute/);
    await expect(sql("tables", {}, ["../x.db", { write: true }])).rejects.toThrow(/outside the project folder/);
    symlinkSync(outside, join(project, "escape"));
    await expect(sql("tables", {}, ["escape/x.db", { write: true }])).rejects.toThrow(/outside the project folder/);
    expect(existsSync(join(outside, "x.db"))).toBe(false);
    // An in-memory database is fine.
    expect(await sql("query", { sql: "SELECT 2 AS two" }, [":memory:"])).toEqual([{ two: 2 }]);
    await expect(sql("query", { sql: "CREATE TABLE m (x)" }, [":memory:"])).rejects.toThrow(/readonly/);
  });

  test("bad SQL is a tool argument error", async () => {
    await expect(sql("query", { sql: "SELEC 1" })).rejects.toThrow(/DB.query: .*syntax error/);
    await expect(sql("query", {})).rejects.toThrow(/needs sql:/);
    await expect(sql("drop", { sql: "x" })).rejects.toThrow(/has no method "drop"/);
  });

  test("methods are described with their effects", () => {
    const methods = LOCAL_PROVIDER_INFO.SQLite!.methods as Array<{ name: string; effect: string }>;
    expect(Object.fromEntries(methods.map((m) => [m.name, m.effect]))).toEqual({ query: "read", get: "read", tables: "read", execute: "write" });
  });
});

describe("SQLite in pipelines", () => {
  const src = `
tool DB : SQLite("data/shop.db", write: true)
tool Reader : SQLite("data/shop.db")

pipeline Setup() -> Result:
  ""
    |> DB.execute(sql: "CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY, customer TEXT, total REAL, status TEXT)")
    |> DB.execute(sql: "INSERT INTO orders (customer, total, status) VALUES (:customer, :total, :status)", batch: context.input.orders)

pipeline Paid(min: Number) -> Result:
  min
    |> Reader.query(sql: "SELECT customer, total FROM orders WHERE status = 'paid' AND total >= ? ORDER BY total DESC", params: [min]) as paid
    |> Reader.get(sql: "SELECT count(*) AS n FROM orders WHERE status = :status", status: "open") as open
`;

  test("validates, writes and reads", async () => {
    expect(validate(parse(src)).filter((d) => d.severity === "error")).toEqual([]);
    const rt = new HaloRuntime(quiet).load(parse(src));
    const orders = [
      { customer: "ada", total: 120, status: "paid" },
      { customer: "bob", total: 40, status: "open" },
      { customer: "cy", total: 80, status: "paid" },
    ];
    await rt.run("Setup", { orders });
    const r = await rt.run("Paid", { min: 50 });
    expect(r.context.data.paid).toEqual([{ customer: "ada", total: 120 }, { customer: "cy", total: 80 }]);
    expect(r.output).toEqual({ n: 1 });
    await rt.close();
  });

  test("validate refuses SQL that isn't parameterised, writes on a read-only tool, and paths outside the project", () => {
    const bad = `
tool DB : SQLite("data/shop.db")
tool Out : SQLite("../elsewhere.db")
tool Abs : SQLite("/etc/x.db")

pipeline P(name: String, q: String) -> Result:
  name
    |> DB.query(sql: "SELECT * FROM users WHERE name = '{{name}}'")
    |> DB.query(sql: q)
    |> DB.execute(sql: "DELETE FROM users")
`;
    const errors = validate(parse(bad)).filter((d) => d.severity === "error").map((d) => d.message);
    expect(errors.some((m) => /DB.query: SQL can't contain \{\{placeholders\}\}/.test(m))).toBe(true);
    expect(errors.some((m) => /DB.query: SQL must be written out as a string, not taken from q/.test(m))).toBe(true);
    expect(errors.some((m) => /DB.execute changes the database, but tool "DB" isn't declared with write: true/.test(m))).toBe(true);
    expect(errors.some((m) => /"Out": SQLite database "..\/elsewhere.db" must be a path inside the project folder/.test(m))).toBe(true);
    expect(errors.some((m) => /"Abs": SQLite database "\/etc\/x.db"/.test(m))).toBe(true);
  });

  test("the runtime refuses templated SQL even without validate", async () => {
    const injected = `
tool DB : SQLite(":memory:")
pipeline P(name: String) -> Result:
  name |> DB.query(sql: "SELECT '{{name}}' AS n")
`;
    await expect(new HaloRuntime(quiet).load(parse(injected)).run("P", { name: "x' OR 1=1 --" })).rejects.toThrow(/can't contain \{\{placeholders\}\}/);
  });

  test("halo plan shows reads and writes, and policies gate an agent's writes", async () => {
    const agentSrc = `
policy ReadOnly : AllowEffects(read)
policy AskFirst : ApproveEffects(write)

tool DB : SQLite("data/crm.db", write: true)

agent Looker [openai/gpt-4o]
  equips DB
  requires ReadOnly

agent Clerk [openai/gpt-4o]
  equips DB
  requires AskFirst

pipeline Look(q: String) -> Result:
  q |> Looker.answer(tools: [DB])

pipeline Log(note: String) -> Result:
  note
    |> DB.execute(sql: "CREATE TABLE IF NOT EXISTS notes (body TEXT)")
    |> Clerk.record(tools: [DB])
`;
    const ast = parse(agentSrc);
    expect(validate(ast).filter((d) => d.severity === "error")).toEqual([]);
    const info = (name: string) => BUILTIN_PROVIDER_INFO[name];
    const look = plan(ast, "Look", { providerInfo: info });
    const lookEffects = look.steps.flatMap((s) => s.effects.map((e) => `${e.target}:${e.effect}`));
    expect(lookEffects).toEqual(["DB.query:read", "DB.get:read", "DB.tables:read"]);

    const log = plan(ast, "Log", { providerInfo: info });
    expect(log.steps[0]!.effects).toEqual([{ target: "DB.execute", effect: "write" }]);
    expect(log.steps[1]!.effects.find((e) => e.target === "DB.execute")).toMatchObject({ effect: "write", approval: "AskFirst" });

    // At run time: the read-only agent isn't offered execute; the other one's write waits for approval.
    const offered: string[][] = [];
    const rt = new HaloRuntime(quiet).load(ast).mockAll({
      "Looker.answer": (req: MockRequest) => (offered.push(req.tools ?? []), "nothing"),
      "Clerk.record": (req: MockRequest) => (req.step === 1 ? useTool("DB.execute", { sql: "INSERT INTO notes (body) VALUES (?)", params: ["hi"] }) : "logged"),
    });
    await rt.run("Look", { q: "how many?" });
    expect(offered[0]).toEqual(["DB.query", "DB.get", "DB.tables"]);

    const paused = await rt.run("Log", { note: "hi" });
    expect(paused.status).toBe("paused");
    await rt.close();
  });
});
