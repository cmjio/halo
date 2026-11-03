import { test, expect, describe, afterAll } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse, validate } from "../src/parser/index";
import { HaloRuntime, type MockRequest, type RuntimeConfig } from "../src/runtime/runtime";
import { applyOps, ThreadStore } from "../src/runtime/threads";

const tmp = mkdtempSync(join(tmpdir(), "halo-threads-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));
let files = 0;
const freshDb = () => join(tmp, `threads-${++files}.sqlite`);

function rt(src: string, mocks: Record<string, unknown> = {}, config: RuntimeConfig = {}) {
  const ast = parse(src);
  expect(ast.errors).toEqual([]);
  expect(validate(ast).filter((d) => d.severity === "error")).toEqual([]);
  return new HaloRuntime({ env: {}, vectorPath: ":memory:", threadPath: ":memory:", checkpointDir: tmp, logger: { log() {}, warn() {} }, ...config }).load(ast).mockAll(mocks);
}

const CHAT = `agent M [openai/gpt-4o]
@thread(user_id)
pipeline Chat(user_id: String, msg: String) -> Result:
  msg
    |> M.reply("Earlier: {{context.thread.messages}}. Now: {{msg}}") as reply
    |> Thread.append(messages: msg, keep: 3)
    |> Thread.set(last: context.data.reply)
    |> System.Value(context.data.reply)`;

describe("thread state", () => {
  test("a thread carries state from one run to the next, per key", async () => {
    const r = rt(CHAT, { "M.reply": (q: MockRequest) => q.prompt });
    const first = await r.run("Chat", { user_id: "ana", msg: "hi" });
    expect(first.output).toEndWith("Earlier: {{context.thread.messages}}. Now: hi");
    expect(first.context.thread).toEqual({ name: "Chat", key: "ana", version: 1, state: { messages: ["hi"], last: first.output } });

    const second = await r.run("Chat", { user_id: "ana", msg: "again" });
    expect(second.output).toEndWith('Earlier: [\n  "hi"\n]. Now: again');
    expect(second.context.thread?.version).toBe(2);

    // Another key has its own thread.
    const other = await r.run("Chat", { user_id: "bo", msg: "yo" });
    expect(other.context.thread).toMatchObject({ key: "bo", version: 1, state: { messages: ["yo"] } });

    // keep: 3 keeps the newest three.
    for (const m of ["3", "4", "5"]) await r.run("Chat", { user_id: "ana", msg: m });
    expect((await r.run("Chat", { user_id: "ana", msg: "6" })).context.thread?.state.messages).toEqual(["4", "5", "6"]);
  });

  test("context.thread is readable in conditions and branches", async () => {
    const r = rt(
      `agent M [openai/gpt-4o]
       @thread(id)
       pipeline S(id: String) -> Result:
         id
           |? { (context.thread.seen == true) => M.again(), else => M.first() }
           |> Thread.set(seen: true)`,
      { "M.first": "first", "M.again": "again" },
    );
    expect((await r.run("S", { id: "x" })).context.data.M).toEqual({ first: "first" });
    expect((await r.run("S", { id: "x" })).context.data.M).toEqual({ again: "again" });
  });

  test("Thread.clear removes named fields, or everything", () => {
    const s = { a: 1, b: [1], c: "x" };
    expect(applyOps(s, [{ op: "clear", names: ["a", "c"] }])).toEqual({ b: [1] });
    expect(applyOps(s, [{ op: "clear" }])).toEqual({});
    expect(applyOps({ a: 1 }, [{ op: "append", fields: { a: 2 } }])).toEqual({ a: [1, 2] });
    expect(s).toEqual({ a: 1, b: [1], c: "x" });
  });

  test("a failed run saves nothing; a halted run saves what it did", async () => {
    const r = rt(
      `agent M [openai/gpt-4o]
       @thread(id)
       pipeline S(id: String, fail: Boolean) -> Result:
         id |> Thread.append(log: "start") |? (context.input.fail == false) |> M.work() |> Thread.append(log: "done")`,
      { "M.work": (q: MockRequest) => { throw new Error("boom"); } },
    );
    await expect(r.run("S", { id: "x", fail: false })).rejects.toThrow("boom");
    const halted = await r.run("S", { id: "x", fail: true });
    expect(halted.status).toBe("halted");
    expect(halted.context.thread).toMatchObject({ version: 1, state: { log: ["start"] } });
  });

  test("a paused run saves its changes when it ends, not while it waits", async () => {
    const r = rt(
      `@thread(id, T)
       pipeline Ask(id: String) -> Result:
         id |> Thread.append(log: "asked") |! yield(msg: "ok?") |> Thread.append(log: "answered")
       @thread(id, T)
       pipeline Note(id: String) -> Result:
         id |> Thread.append(log: "noted")`,
    );
    const paused = await r.run("Ask", { id: "x" });
    expect(paused.status).toBe("paused");
    expect(paused.context.thread?.state).toEqual({ log: ["asked"] });
    // Meanwhile another run on the thread sees nothing from the paused one.
    const meanwhile = await r.run("Note", { id: "x" });
    expect(meanwhile.context.thread).toMatchObject({ version: 1, state: { log: ["noted"] } });
    const done = await r.signal(paused.runId, "yield", { approved: true });
    expect(done.status).toBe("completed");
    // Its changes land on the thread as it is now, after the other run's.
    expect(done.context.thread).toMatchObject({ version: 2, state: { log: ["noted", "asked", "answered"] } });
  });

  test("runs on one thread at the same time keep each other's appends", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const r = rt(
      `agent M [openai/gpt-4o]
       @thread(id)
       pipeline S(id: String, n: Number) -> Result:
         id |> M.slow() |> Thread.append(seen: context.input.n) |> Thread.set(last: context.input.n)`,
      { "M.slow": async () => (await gate, "ok") },
    );
    const runs = [r.run("S", { id: "x", n: 1 }), r.run("S", { id: "x", n: 2 })];
    release();
    await Promise.all(runs);
    const last = await r.run("S", { id: "x", n: 3 });
    expect((last.context.thread?.state.seen as number[]).sort()).toEqual([1, 2, 3]);
    expect(last.context.thread).toMatchObject({ version: 3, state: { last: 3 } });
  });

  test("pipelines share a named thread, and a called pipeline uses its caller's", async () => {
    const r = rt(
      `@thread(ticket, Support)
       pipeline Open(ticket: String) -> Result:
         ticket |> Note(ticket)
       pipeline Note(ticket: String) -> Result:
         ticket |> Thread.append(notes: "opened")
       @thread(ticket, Support)
       pipeline Close(ticket: String) -> Result:
         ticket |> Thread.append(notes: "closed") |> System.Value(context.thread.notes)`,
    );
    await r.run("Open", { ticket: "T-1" });
    expect((await r.run("Close", { ticket: "T-1" })).output).toEqual(["opened", "closed"]);
  });

  test("a run needs the input that keys its thread", async () => {
    const r = rt(`@thread(user_id)\npipeline S(user_id: String) -> Result:\n  user_id |> Thread.set(x: 1)`);
    await expect(r.run("S", { user_id: "" })).rejects.toThrow("keeps a thread per user_id, so it needs user_id");
  });

  test("threads are kept in SQLite: another store on the same file sees them, and a reset is logged", async () => {
    const path = freshDb();
    const r = rt(CHAT, { "M.reply": "hey" }, { threadPath: path });
    const run = await r.run("Chat", { user_id: "ana", msg: "hi" });
    await r.close();
    const store = new ThreadStore(path);
    expect(store.get("Chat", "ana")?.state).toEqual({ messages: ["hi"], last: "hey" });
    expect(store.list().map((t) => t.key)).toEqual(["ana"]);
    expect(store.log("Chat", "ana")).toMatchObject([{ version: 1, runId: run.runId }]);
    expect(store.reset("Chat", "ana")).toBe(true);
    expect(store.get("Chat", "ana")).toBeUndefined();
    expect(store.log("Chat", "ana")[0]).toMatchObject({ version: 2, ops: "reset" });
    expect(store.reset("Chat", "ana")).toBe(false);
    store.close();
  });

  test("rewinding a run doesn't save its earlier thread changes twice", async () => {
    let n = 0;
    const r = rt(
      `agent M [openai/gpt-4o]
       @checkpoint
       @thread(id)
       pipeline S(id: String) -> Result:
         id |> Thread.append(log: "start") |> M.work() as work |> Thread.append(log: context.data.work)`,
      { "M.work": () => `work ${++n}` },
    );
    const first = await r.run("S", { id: "x" });
    expect(first.context.thread?.state.log).toEqual(["start", "work 1"]);
    // Step 2 is after Thread.append(log: "start"): only the later append is new.
    const again = await r.rewind(first.context.meta.checkpoint!, 2);
    expect(again.context.thread).toMatchObject({ version: 2, state: { log: ["start", "work 1", "work 2"] } });
  });
});

describe("validating threads", () => {
  const errors = (src: string) => validate(parse(src)).filter((d) => d.severity === "error").map((d) => d.message);

  test("@thread must name an input", () => {
    expect(errors(`@thread(nope)\npipeline S(x: String) -> Result:\n  x |> Thread.set(a: 1)`)).toEqual([
      `Pipeline "S": @thread(nope) keys the thread by an input, but "nope" is not a parameter`,
    ]);
    expect(errors(`@thread()\npipeline S(x: String) -> Result:\n  x`).join()).toContain("@thread needs the input");
  });

  test("Thread calls and context.thread need a @thread pipeline", () => {
    expect(errors(`pipeline S(x: String) -> Result:\n  x |> Thread.set(a: 1) |> System.Value(context.thread.a)`)).toEqual([
      `Pipeline "S": Thread.set needs a thread; add @thread(<input>) to the pipeline, e.g. @thread(user_id)`,
      `Pipeline "S": context.thread needs a thread; add @thread(<input>) to the pipeline, e.g. @thread(user_id)`,
    ]);
  });

  test("Thread methods and their arguments are checked", () => {
    const errs = errors(`@thread(x)\npipeline S(x: String) -> Result:\n  x |> Thread.push(a: 1) |> Thread.set() |> Thread.append(keep: 3) |> Thread.clear()`);
    expect(errs).toEqual([
      `Pipeline "S": unknown Thread method "push" (use set, append, clear)`,
      `Pipeline "S": Thread.set takes fields by name, e.g. Thread.set(summary: context.data.summary)`,
      `Pipeline "S": Thread.append takes fields by name, e.g. Thread.append(messages: context.data.reply, keep: 20)`,
    ]);
  });

  test("a declared Thread takes the name over from the built-in", async () => {
    const src = `tool Thread : MCP(url: "https://example.test/mcp")\npipeline S(x: String) -> Result:\n  x |> Thread.post_update(text: x)`;
    expect(errors(src)).toEqual([]);
    const r = rt(src, { "Thread.post_update": "posted" });
    const result = await r.run("S", { x: "hi" });
    expect(result.output).toBe("posted");
    expect(result.context.data.Thread).toEqual({ post_update: "posted" });
  });
});
