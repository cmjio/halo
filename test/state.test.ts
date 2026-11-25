import { test, expect, describe, afterAll } from "bun:test";
import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { MockRequest } from "../src/runtime/runtime";
import { startServer, ServeError, type ServeOptions } from "../src/serve/server";
import { FolderStateStore, S3StateStore, StateMirror, StateStoreError, openStateStore } from "../src/serve/state-mirror";

const tmp = mkdtempSync(join(tmpdir(), "halo-state-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));
const quiet = { log() {}, warn() {}, error() {} };
const dir = (name = "d-") => mkdtempSync(join(tmp, name));
const text = (b: Uint8Array | undefined) => (b ? new TextDecoder().decode(b) : undefined);

describe("the state mirror", () => {
  test("copies up what changed and removes what was removed", async () => {
    const local = dir();
    const store = new FolderStateStore(dir("store-"));
    const mirror = new StateMirror(local, store, { logger: quiet });
    mkdirSync(join(local, "runs"));
    writeFileSync(join(local, "runs", "a.json"), "one");
    writeFileSync(join(local, "schedules.json"), "{}");
    writeFileSync(join(local, "scheduler.lock"), "mine");
    writeFileSync(join(local, "schedules.json.tmp"), "half");
    await mirror.sync();
    expect((await store.list()).sort()).toEqual(["runs/a.json", "schedules.json"]);

    await Bun.sleep(5);
    writeFileSync(join(local, "runs", "a.json"), "two!");
    rmSync(join(local, "schedules.json"));
    await mirror.sync();
    expect(text(await store.get("runs/a.json"))).toBe("two!");
    expect(await store.list()).toEqual(["runs/a.json"]);
  });

  test("a fresh folder is filled from the store, and a file already there is kept", async () => {
    const store = new FolderStateStore(dir("store-"));
    await store.put("runs/a.json", new TextEncoder().encode("from the store"));
    await store.put("serve-secret", new TextEncoder().encode("s"));
    const local = dir();
    writeFileSync(join(local, "serve-secret"), "local");
    const mirror = new StateMirror(local, store, { logger: quiet });
    expect(await mirror.restore()).toBe(1);
    expect(readFileSync(join(local, "runs", "a.json"), "utf8")).toBe("from the store");
    expect(readFileSync(join(local, "serve-secret"), "utf8")).toBe("local");
    // The file that was kept differs from the store's copy, so it goes up.
    await mirror.sync();
    expect(text(await store.get("serve-secret"))).toBe("local");
  });

  test("a database is copied as a whole, with what is still in its write-ahead log", async () => {
    const local = dir();
    const store = new FolderStateStore(dir("store-"));
    const db = new Database(join(local, "telemetry.db"));
    db.exec("PRAGMA journal_mode = WAL; CREATE TABLE t (v TEXT); INSERT INTO t VALUES ('kept')");
    const mirror = new StateMirror(local, store, { logger: quiet });
    await mirror.sync(true);
    db.close();
    const fresh = dir();
    await new StateMirror(fresh, store, { logger: quiet }).restore();
    const copy = new Database(join(fresh, "telemetry.db"));
    expect(copy.query("SELECT v FROM t").all()).toEqual([{ v: "kept" }]);
    copy.close();
    expect((await store.list()).some((k) => k.endsWith("-wal"))).toBe(false);
  });

  test("databases wait for the interval; other files go at once", async () => {
    const local = dir();
    const store = new FolderStateStore(dir("store-"));
    new Database(join(local, "telemetry.db")).exec("CREATE TABLE t (v TEXT)");
    const mirror = new StateMirror(local, store, { logger: quiet, everyMs: 60_000 });
    await mirror.sync();
    expect(await store.list()).toEqual(["telemetry.db"]);
    const db = new Database(join(local, "telemetry.db"));
    db.exec("INSERT INTO t VALUES ('x')");
    db.close();
    writeFileSync(join(local, "idempotency.json"), "{}");
    await mirror.sync();
    await new StateMirror(dir(), store, { logger: quiet }).restore();
    const seen = dir();
    await new StateMirror(seen, store, { logger: quiet }).restore();
    const copy = new Database(join(seen, "telemetry.db"));
    expect(copy.query("SELECT count(*) AS n FROM t").get()).toEqual({ n: 0 });
    copy.close();
    expect(existsSync(join(seen, "idempotency.json"))).toBe(true);
    await mirror.stop();
    const after = dir();
    await new StateMirror(after, store, { logger: quiet }).restore();
    const last = new Database(join(after, "telemetry.db"));
    expect(last.query("SELECT count(*) AS n FROM t").get()).toEqual({ n: 1 });
    last.close();
  });

  test("touch copies soon, and a removed file is not brought back by a late listing", async () => {
    const local = dir();
    const store = new FolderStateStore(dir("store-"));
    const mirror = new StateMirror(local, store, { logger: quiet, settleMs: 5, everyMs: 60_000 });
    writeFileSync(join(local, "a.json"), "1");
    mirror.touch();
    await Bun.sleep(60);
    expect(await store.list()).toEqual(["a.json"]);
    rmSync(join(local, "a.json"));
    await mirror.sync();
    expect(await store.list()).toEqual([]);
    // Another server's file appears in the store; a full pass brings it down, but not the one we removed.
    await store.put("runs/b.json", new TextEncoder().encode("theirs"));
    await store.put("a.json", new TextEncoder().encode("stale"));
    expect(await mirror.pull("a.json")).toBe(false);
    await mirror.sync(true);
    expect(readdirSync(local).sort()).toEqual(["runs"]);
    expect(readFileSync(join(local, "runs", "b.json"), "utf8")).toBe("theirs");
    await mirror.stop();
  });

  test("a store address says what it is", () => {
    expect(openStateStore(join(tmp, "x"), {})).toBeInstanceOf(FolderStateStore);
    expect(openStateStore("s3://bucket/halo/prod", { S3_ACCESS_KEY_ID: "a", S3_SECRET_ACCESS_KEY: "b" }).label).toBe("s3://bucket/halo/prod");
    expect(() => openStateStore("s3://bucket/x", {})).toThrow(/needs credentials: set S3_ACCESS_KEY_ID/);
    expect(() => openStateStore("gs://bucket/x", {})).toThrow(StateStoreError);
  });
});

/** Enough of S3 for the client: put, get, delete and list, path-style. */
function fakeS3() {
  const objects = new Map<string, Uint8Array>();
  const server = Bun.serve({
    port: 0,
    async fetch(req) {
      const url = new URL(req.url);
      const [, bucket, ...rest] = url.pathname.split("/");
      const key = decodeURIComponent(rest.join("/"));
      if (!req.headers.get("authorization")?.startsWith("AWS4-HMAC-SHA256")) return new Response("unsigned", { status: 403 });
      if (req.method === "GET" && url.searchParams.has("list-type")) {
        const prefix = url.searchParams.get("prefix") ?? "";
        const after = url.searchParams.get("start-after") ?? "";
        const max = Number(url.searchParams.get("max-keys") ?? 1000);
        const keys = [...objects.keys()].filter((k) => k.startsWith(`${bucket}/${prefix}`) && k.slice(bucket!.length + 1) > after).sort();
        const page = keys.slice(0, Math.min(max, 2));
        const xml = `<?xml version="1.0" encoding="UTF-8"?><ListBucketResult><Name>${bucket}</Name><Prefix>${prefix}</Prefix><KeyCount>${page.length}</KeyCount><MaxKeys>${max}</MaxKeys><IsTruncated>${page.length < keys.length}</IsTruncated>${page
          .map((k) => `<Contents><Key>${k.slice(bucket!.length + 1)}</Key><Size>${objects.get(k)!.length}</Size><LastModified>2026-11-19T00:00:00.000Z</LastModified><ETag>"e"</ETag></Contents>`)
          .join("")}</ListBucketResult>`;
        return new Response(xml, { headers: { "Content-Type": "application/xml" } });
      }
      const id = `${bucket}/${key}`;
      if (req.method === "PUT") {
        objects.set(id, new Uint8Array(await req.arrayBuffer()));
        return new Response(null, { headers: { ETag: '"e"' } });
      }
      if (req.method === "DELETE") {
        objects.delete(id);
        return new Response(null, { status: 204 });
      }
      const data = objects.get(id);
      if (!data) return new Response(`<?xml version="1.0" encoding="UTF-8"?><Error><Code>NoSuchKey</Code><Message>The specified key does not exist.</Message></Error>`, { status: 404, headers: { "Content-Type": "application/xml" } });
      if (req.method === "HEAD") return new Response(null, { headers: { "Content-Length": String(data.length) } });
      return new Response(data);
    },
  });
  return { objects, endpoint: `http://localhost:${server.port}`, stop: () => server.stop(true) };
}

describe("an S3 state store", () => {
  test("puts, gets, lists across pages, and deletes under its prefix", async () => {
    const s3 = fakeS3();
    try {
      const store = new S3StateStore(new URL(`s3://halo-state/prod?endpoint=${encodeURIComponent(s3.endpoint)}`), { S3_ACCESS_KEY_ID: "id", S3_SECRET_ACCESS_KEY: "secret" });
      for (const k of ["runs/a.json", "runs/b.json", "schedules.json"]) await store.put(k, new TextEncoder().encode(k));
      s3.objects.set("halo-state/other/x", new Uint8Array([1]));
      expect((await store.list()).sort()).toEqual(["runs/a.json", "runs/b.json", "schedules.json"]);
      expect([...s3.objects.keys()].sort()[1]).toBe("halo-state/prod/runs/a.json");
      expect(text(await store.get("runs/b.json"))).toBe("runs/b.json");
      expect(await store.get("runs/none.json")).toBeUndefined();
      await store.delete("runs/a.json");
      expect((await store.list()).sort()).toEqual(["runs/b.json", "schedules.json"]);
    } finally {
      await s3.stop();
    }
  });
});

const FLOW = `
agent Writer [openai/gpt-4o]
tool Ledger : POST("ledger.example.com/v1/pay", idempotencyKey: true)

pipeline Draft(topic: String) -> Result:
  topic
    |> Writer.draft("Draft a note about {{topic}}") as draft
    |! yield(msg: "Publish this draft?") as review
    |? (context.data.review.approved == true)
    |> Writer.publish(context.data.draft)

pipeline Prize(winner: String) -> Result:
  winner
    |> Writer.confirm("Confirm {{winner}}") as confirmed
    |> Ledger.post(winner: winner, amount: 25) as paid
    |> Writer.announce("Announce {{winner}}")
`;

interface Opts {
  mocks?: Record<string, unknown>;
  pay?: () => Promise<Response>;
}

async function serve(extra: Partial<ServeOptions>, stateDir: string, opts: Opts = {}) {
  const app = dir("app-");
  await Bun.write(join(app, "flow.halo"), FLOW);
  const calls: string[] = [];
  const keys: string[] = [];
  const out = (async (_url: string | URL | Request, init?: RequestInit) => {
    keys.push(new Headers(init?.headers).get("idempotency-key") ?? "");
    return opts.pay ? opts.pay() : Response.json({ paid: true });
  }) as typeof fetch;
  const server = await startServer({
    files: [join(app, "flow.halo")],
    port: 0,
    stateDir,
    scheduler: false,
    logger: quiet,
    env: {},
    runtime: { fetch: out },
    onRuntime: (rt) =>
      rt.mockAll({
        "Writer.draft": (r: MockRequest) => (calls.push("draft"), `Draft about ${r.input}`),
        "Writer.publish": (r: MockRequest) => (calls.push("publish"), `Published: ${r.args[0]}`),
        "Writer.confirm": () => (calls.push("confirm"), "confirmed"),
        "Writer.announce": () => (calls.push("announce"), "announced"),
        ...opts.mocks,
      }),
    ...extra,
  });
  return Object.assign(server, { calls, keys, stateDir });
}

const post = (url: string, body: unknown) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

describe("state that outlives the disk", () => {
  test("a run paused before a deploy is answered after it, on a new machine", async () => {
    const store = dir("store-");
    const a = await serve({ state: { store } }, join(dir(), ".halo"));
    const runId = a.start("Draft", { topic: "tides" }, "test", { idempotencyKey: "tides-1" });
    expect((await a.settled(runId))?.status).toBe("paused");
    const link = (await a.approvalUrl(runId))!;
    await a.stop();
    expect(existsSync(join(store, "runs", `${runId}.json`))).toBe(true);

    // A new container: an empty disk, the same store.
    const b = await serve({ state: { store } }, join(dir(), ".halo"));
    try {
      // The link people were sent still answers it (the signing secret came back too).
      expect((await b.approvalUrl(runId))!.split("?")[1]).toBe(link.split("?")[1]!);
      const done = (await (await post(`${b.url}/api/runs/${runId}/signal`, { answer: "approve", wait: true })).json()) as Record<string, unknown>;
      expect(done).toMatchObject({ status: "completed", output: "Published: Draft about tides" });
      expect(b.calls).toEqual(["publish"]);
      // And the start isn't repeated: its idempotency key came back as well.
      expect(b.start("Draft", { topic: "tides" }, "test", { idempotencyKey: "tides-1" })).toBe(runId);
      // Its history is there for Studio.
      const detail = (await (await fetch(`${b.url}/api/runs/${runId}`)).json()) as { events: unknown[] };
      expect(detail.events.length).toBeGreaterThan(4);
    } finally {
      await b.stop();
    }
    // Finished, so the store no longer holds it as paused.
    expect(existsSync(join(store, "runs", `${runId}.json`))).toBe(false);
  });

  test("a run paused on the old server while the new one was starting is found in the store", async () => {
    const store = dir("store-");
    const a = await serve({ state: { store } }, join(dir(), ".halo"));
    const b = await serve({ state: { store } }, join(dir(), ".halo"));
    try {
      const runId = a.start("Draft", { topic: "late" }, "test");
      await a.settled(runId);
      await a.stop();
      const done = (await (await post(`${b.url}/api/runs/${runId}/signal`, { answer: "approve", wait: true })).json()) as Record<string, unknown>;
      expect(done).toMatchObject({ status: "completed" });
    } finally {
      await b.stop();
    }
  });

  test("a store that can't be reached, or a bad setting, stops the server from starting", async () => {
    await expect(serve({ state: { store: "Env.NOPE" } }, join(dir(), ".halo"))).rejects.toThrow(ServeError);
    await expect(serve({ state: { store: "gs://x/y" } }, join(dir(), ".halo"))).rejects.toThrow(/not a kind of state store/);
    await expect(serve({ state: { store: dir(), every: "soon" } }, join(dir(), ".halo"))).rejects.toThrow(/state\.every/);
  });
});

describe("runs cut short by a restart", () => {
  test("the run continues at the stage it was on, with the same idempotency key", async () => {
    // Server A hangs in the payment (as if the machine died mid-request).
    let release!: () => void;
    const hung = new Promise<Response>((r) => (release = () => r(Response.json({ paid: "late" }))));
    const a = await serve({ resumeRuns: true }, join(dir(), ".halo"), { pay: () => hung });
    const runId = a.start("Prize", { winner: "ada" }, "test");
    for (let i = 0; i < 200 && !a.keys.length; i++) await Bun.sleep(5);
    expect(a.calls).toEqual(["confirm"]);

    // Server B starts from what A had on disk at that moment.
    const state = join(dir(), ".halo");
    cpSync(a.stateDir, state, { recursive: true });
    const b = await serve({ resumeRuns: true }, state);
    try {
      expect(b.resumed).toEqual([runId]);
      const result = await b.settled(runId);
      expect(result).toMatchObject({ status: "completed", output: "announced" });
      // The stage that finished is not run again; the one that was in flight is, with its key.
      expect(b.calls).toEqual(["announce"]);
      expect(b.keys).toEqual([a.keys[0]!]);
      expect(result!.context.meta.resumes).toBe(1);
      expect(result!.context.data.confirmed).toBe("confirmed");
      expect(readdirSync(join(state, "running"))).toEqual([]);
    } finally {
      await b.stop();
      release();
      await a.stop();
    }
  });

  test("without resumeRuns nothing is kept or picked up", async () => {
    const a = await serve({}, join(dir(), ".halo"));
    try {
      await a.settled(a.start("Prize", { winner: "ada" }, "test"));
      expect(existsSync(join(a.stateDir, "running"))).toBe(false);
      expect(a.resumed).toEqual([]);
    } finally {
      await a.stop();
    }
  });

  test("a run that ended or paused leaves nothing to pick up", async () => {
    const a = await serve({ resumeRuns: true }, join(dir(), ".halo"));
    await a.settled(a.start("Prize", { winner: "ada" }, "test"));
    await a.settled(a.start("Draft", { topic: "x" }, "test"));
    await a.stop();
    expect(readdirSync(join(a.stateDir, "running"))).toEqual([]);
    const b = await serve({ resumeRuns: true }, a.stateDir);
    expect(b.resumed).toEqual([]);
    await b.stop();
  });

  test("a run that keeps taking the server down is given up on", async () => {
    let release!: () => void;
    const hung = new Promise<Response>((r) => (release = () => r(Response.json({}))));
    const a = await serve({ resumeRuns: true }, join(dir(), ".halo"), { pay: () => hung });
    const runId = a.start("Prize", { winner: "ada" }, "test");
    for (let i = 0; i < 200 && !a.keys.length; i++) await Bun.sleep(5);
    const state = join(dir(), ".halo");
    cpSync(a.stateDir, state, { recursive: true });
    const file = join(state, "running", `${runId}.json`);
    const snap = JSON.parse(readFileSync(file, "utf8"));
    snap.meta.resumes = 3;
    writeFileSync(file, JSON.stringify(snap));
    const warnings: string[] = [];
    const b = await serve({ resumeRuns: true, logger: { ...quiet, warn: (m: string) => warnings.push(m) } }, state);
    try {
      expect(b.resumed).toEqual([]);
      expect(warnings.join("\n")).toContain("picked up 3 times already");
      expect(b.calls).toEqual([]);
    } finally {
      await b.stop();
      release();
      await a.stop();
    }
  });
});
