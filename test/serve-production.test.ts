import { test, expect, describe, afterAll } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "../src/parser/index";
import { HaloRuntime, type MockRequest } from "../src/runtime/runtime";
import { signBody, verifySignature } from "../src/runtime/signing";
import { startServer, ServeError, type HaloServer, type RunCallback, type ServeOptions } from "../src/serve/server";

const tmp = mkdtempSync(join(tmpdir(), "halo-serve-prod-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));
const quiet = { log() {}, warn() {}, error() {} };

const FLOW = `
agent Writer [openai/gpt-4o]
tool Ledger : POST("ledger.example.com/v1/pay", idempotencyKey: true)

pipeline Draft(topic: String) -> Result:
  topic
    |> Writer.draft("Draft a note about {{topic}}") as draft
    |! yield(msg: "Publish this draft?") as review
    |? (context.data.review.approved == true)
    |> Writer.publish(context.data.draft)

pipeline Quick(n: Number) -> Result:
  n |> Writer.count()

pipeline Pay(winner: String) -> Result:
  winner |> Ledger.post(winner: winner, amount: 25)

pipeline Broken(n: Number) -> Result:
  n |> System.Fail("it broke")
`;

interface Sent {
  url: string;
  headers: Record<string, string>;
  body: string;
}

/** A server over FLOW whose outgoing requests (callbacks, tool calls) land in `sent`. */
async function serve(extra: Partial<ServeOptions> = {}, dir = mkdtempSync(join(tmp, "app-")), answer: (s: Sent) => Response = () => Response.json({ ok: true })) {
  await Bun.write(join(dir, "flow.halo"), FLOW);
  const calls: string[] = [];
  const sent: Sent[] = [];
  const out = (async (url: string | URL | Request, init?: RequestInit) => {
    const s = { url: String(url), headers: Object.fromEntries(new Headers(init?.headers).entries()), body: String(init?.body ?? "") };
    sent.push(s);
    return answer(s);
  }) as typeof fetch;
  const server = await startServer({
    files: [join(dir, "flow.halo")],
    root: dir,
    port: 0,
    stateDir: join(dir, ".halo"),
    scheduler: false,
    logger: quiet,
    env: { CALLBACK_SECRET: "s3cret" },
    fetch: out,
    runtime: { fetch: out },
    callbackRetryMs: [5, 5],
    onRuntime: (rt) =>
      rt.mockAll({
        "Writer.draft": (r: MockRequest) => (calls.push(`draft:${r.input}`), `Draft about ${r.input}`),
        "Writer.publish": (r: MockRequest) => (calls.push("publish"), `Published: ${r.args[0]}`),
        "Writer.count": (r: MockRequest) => (calls.push(`count:${r.input}`), `count ${r.input}`),
      }),
    ...extra,
  });
  return Object.assign(server, { calls, sent, dir });
}

const post = (url: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });

const until = async (ok: () => boolean) => {
  for (let i = 0; i < 200 && !ok(); i++) await Bun.sleep(5);
  expect(ok()).toBe(true);
};

describe("starting a run once", () => {
  test("the same Idempotency-Key returns the first run", async () => {
    const s = await serve();
    try {
      const first = (await (await post(`${s.url}/api/pipelines/Quick/runs`, { args: { n: 1 }, wait: true }, { "Idempotency-Key": "order-7" })).json()) as { runId: string; duplicate?: boolean };
      const again = (await (await post(`${s.url}/api/pipelines/Quick/runs`, { args: { n: 1 }, wait: true }, { "Idempotency-Key": "order-7" })).json()) as { runId: string; duplicate?: boolean; output: unknown };
      expect(first.duplicate).toBeUndefined();
      expect(again).toMatchObject({ runId: first.runId, duplicate: true, output: "count 1", status: "completed" });
      expect(s.calls).toEqual(["count:1"]);
      // The key can also come in the body; another key, or another pipeline, is another run.
      const other = (await (await post(`${s.url}/api/pipelines/Quick/runs`, { args: { n: 1 }, wait: true, idempotencyKey: "order-8" })).json()) as { runId: string };
      expect(other.runId).not.toBe(first.runId);
      const same = (await (await post(`${s.url}/api/pipelines/Quick/runs`, { args: { n: 1 }, idempotencyKey: "order-8" })).json()) as { runId: string; status: string };
      expect(same).toMatchObject({ runId: other.runId, status: "completed" });
    } finally {
      await s.stop();
    }
  });

  test("a restart remembers the key", async () => {
    const a = await serve();
    const first = a.start("Quick", { n: 2 }, "test", { idempotencyKey: "k" });
    await a.settled(first);
    await a.stop();
    const b = await serve({}, a.dir);
    try {
      expect(b.start("Quick", { n: 2 }, "test", { idempotencyKey: "k" })).toBe(first);
      expect(b.calls).toEqual([]);
    } finally {
      await b.stop();
    }
  });

  test("a webhook sender's retry doesn't start a second run", async () => {
    const s = await serve({ webhooks: [{ path: "quick", pipeline: "Quick", secret: "w" }] });
    try {
      const hit = async () => (await (await post(`${s.url}/hooks/quick`, { n: 5 }, { "X-Halo-Secret": "w", "Idempotency-Key": "evt_1" })).json()) as { runId: string; duplicate?: boolean };
      const first = await hit();
      const again = await hit();
      expect(again).toMatchObject({ runId: first.runId, duplicate: true });
      await s.settled(first.runId);
      expect(s.calls).toEqual(["count:5"]);
    } finally {
      await s.stop();
    }
  });
});

describe("idempotency keys for tool calls", () => {
  test("a POST tool sends the same key for the same call of the same run, and a new one for another run", async () => {
    const s = await serve();
    try {
      const pay = async (key?: string) => {
        const id = s.start("Pay", { winner: "ada" }, "test", { idempotencyKey: key });
        await s.settled(id);
        return s.sent.at(-1)!.headers["idempotency-key"]!;
      };
      const a = await pay();
      const b = await pay();
      expect(a).toMatch(/^halo_[0-9a-f]{40}$/);
      expect(b).not.toBe(a);
      // Two runs started with one key (the first server lost its state, say) make the same payment.
      const keyed = await pay("challenge-9:confirmation-3");
      const s2 = await serve();
      try {
        const id = s2.start("Pay", { winner: "ada" }, "test", { idempotencyKey: "challenge-9:confirmation-3" });
        await s2.settled(id);
        expect(s2.sent.at(-1)!.headers["idempotency-key"]).toBe(keyed);
      } finally {
        await s2.stop();
      }
    } finally {
      await s.stop();
    }
  });

  test("the key survives a retry, changes with the arguments, and can go in the body", async () => {
    const sent: Array<{ headers: Headers; body: Record<string, unknown> }> = [];
    let fails = 1;
    const fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      sent.push({ headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) });
      return fails-- > 0 ? new Response("busy", { status: 503 }) : Response.json({ ok: true });
    }) as typeof globalThis.fetch;
    const ast = parse(`tool Ledger : POST("ledger.example.com/pay", idempotencyKey: true)
tool Square : POST("square.example.com/pay", idempotencyKey: "body.idempotency_key")
tool Plain : POST("plain.example.com/pay")
@retry(2, 1ms)
pipeline Pay(winner: String) -> Result:
  winner |> Ledger.post(winner: winner)
pipeline Other(winner: String) -> Result:
  winner |> Square.post(winner: winner) |> Plain.post(winner: winner)`);
    expect(ast.errors).toEqual([]);
    const rt = new HaloRuntime({ env: {}, fetch, logger: quiet }).load(ast);
    await rt.run("Pay", { winner: "ada" }, { runId: "run-1" });
    expect(sent).toHaveLength(2);
    expect(sent[0]!.headers.get("idempotency-key")).toBe(sent[1]!.headers.get("idempotency-key")!);
    await rt.run("Pay", { winner: "grace" }, { runId: "run-1" });
    expect(sent[2]!.headers.get("idempotency-key")).not.toBe(sent[0]!.headers.get("idempotency-key"));
    await rt.run("Other", { winner: "ada" }, { runId: "run-1" });
    expect(sent[3]!.body).toMatchObject({ winner: "ada", idempotency_key: expect.stringMatching(/^halo_/) });
    expect(sent[3]!.headers.get("idempotency-key")).toBeNull();
    // A tool that doesn't ask for a key sends none.
    expect(sent[4]!.headers.get("idempotency-key")).toBeNull();
    expect(sent[4]!.body).toEqual({ winner: "ada" });
  });
});

describe("run callbacks", () => {
  const callbacks = (s: { sent: Sent[] }) => s.sent.filter((x) => x.url === "https://app.example.com/halo").map((x) => ({ ...x, event: JSON.parse(x.body) as RunCallback }));
  const notify = { webhook: "https://app.example.com/halo", secret: "Env.CALLBACK_SECRET" };

  test("a finished run is announced, signed", async () => {
    const s = await serve({ notify });
    try {
      const runId = s.start("Quick", { n: 3 }, "test", { idempotencyKey: "abc" });
      await s.settled(runId);
      await until(() => callbacks(s).length === 1);
      const [c] = callbacks(s);
      expect(c!.event).toMatchObject({ type: "run.completed", status: "completed", runId, pipeline: "Quick", output: "count 3", idempotencyKey: "abc" });
      expect(c!.headers["halo-event"]).toBe("run.completed");
      expect(c!.headers["halo-delivery"]).toBe(c!.event.id);
      expect(verifySignature("s3cret", c!.body, c!.headers["halo-signature"])).toBe(true);
      expect(verifySignature("wrong", c!.body, c!.headers["halo-signature"])).toBe(false);
      expect(verifySignature("s3cret", c!.body + " ", c!.headers["halo-signature"])).toBe(false);
    } finally {
      await s.stop();
    }
  });

  test("a pause carries the link that answers it, and the run's end follows", async () => {
    const s = await serve({ notify });
    try {
      const runId = s.start("Draft", { topic: "tides" }, "test");
      await s.settled(runId);
      await until(() => callbacks(s).length === 1);
      expect(callbacks(s)[0]!.event).toMatchObject({ type: "run.paused", waitingFor: "yield", approveUrl: await s.approvalUrl(runId) });
      await post(`${s.url}/api/runs/${runId}/signal`, { answer: "approve", wait: true });
      await until(() => callbacks(s).length === 2);
      expect(callbacks(s)[1]!.event).toMatchObject({ type: "run.completed", runId, output: "Published: Draft about tides" });
    } finally {
      await s.stop();
    }
  });

  test("a failed run is announced with its error", async () => {
    const s = await serve({ notify });
    try {
      const runId = s.start("Broken", { n: 1 }, "test");
      await s.settled(runId);
      await until(() => callbacks(s).length === 1);
      expect(callbacks(s)[0]!.event).toMatchObject({ type: "run.failed", status: "failed", runId, error: expect.stringContaining("it broke") });
    } finally {
      await s.stop();
    }
  });

  test("a delivery is retried while the app is down, and not when it says no", async () => {
    let down = 2;
    const s = await serve({ notify }, undefined, (x) => (x.url.includes("app.example.com") && down-- > 0 ? new Response("down", { status: 503 }) : Response.json({ ok: true })));
    try {
      await s.settled(s.start("Quick", { n: 1 }, "test"));
      await until(() => callbacks(s).length === 3);
      expect(new Set(callbacks(s).map((c) => c.event.id)).size).toBe(1);
    } finally {
      await s.stop();
    }
    const refused = await serve({ notify }, undefined, () => new Response("no", { status: 400 }));
    try {
      await refused.settled(refused.start("Quick", { n: 1 }, "test"));
      await Bun.sleep(40);
      expect(callbacks(refused)).toHaveLength(1);
    } finally {
      await refused.stop();
    }
  });

  test("events narrows what is sent", async () => {
    const s = await serve({ notify: { ...notify, events: ["failed"] } });
    try {
      await s.settled(s.start("Quick", { n: 1 }, "test"));
      await s.settled(s.start("Broken", { n: 1 }, "test"));
      await until(() => callbacks(s).length === 1);
      expect(callbacks(s)[0]!.event.type).toBe("run.failed");
    } finally {
      await s.stop();
    }
  });

  test("a callback needs a secret and a real URL", async () => {
    await expect(serve({ notify: { webhook: "https://app.example.com/halo" } })).rejects.toThrow(/notify\.webhook needs notify\.secret/);
    await expect(serve({ notify: { webhook: "Env.NOPE", secret: "x" } })).rejects.toThrow(ServeError);
    await expect(serve({ notify: { ...notify, events: ["done"] } })).rejects.toThrow(/notify\.events: done/);
  });

  test("signatures go stale", () => {
    const body = "{}";
    const old = signBody("k", body, Date.now() - 10 * 60_000);
    expect(verifySignature("k", body, old)).toBe(false);
    expect(verifySignature("k", body, signBody("k", body))).toBe(true);
    expect(verifySignature("k", body, null)).toBe(false);
  });
});

describe("dry runs", () => {
  const mocks = async (dir: string) => {
    await Bun.write(join(dir, "mocks.json"), JSON.stringify({ "Writer.count": "counted (mock)", "Writer.draft": "A mock draft", "Writer.publish": "Published (mock)", "Ledger.post": { id: "pay_mock" } }));
    return "mocks.json";
  };

  test("a start with dryRun answers from the mocks file, and a normal start doesn't", async () => {
    const dir = mkdtempSync(join(tmp, "app-"));
    const s = await serve({ mocks: await mocks(dir) }, dir);
    try {
      const dry = (await (await post(`${s.url}/api/pipelines/Pay/runs`, { args: { winner: "ada" }, wait: true, dryRun: true })).json()) as Record<string, unknown>;
      expect(dry).toMatchObject({ status: "completed", output: { id: "pay_mock" }, dryRun: true });
      expect(s.sent).toHaveLength(0);
      const viaHeader = (await (await post(`${s.url}/api/pipelines/Quick/runs`, { args: { n: 1 }, wait: true }, { "Halo-Dry-Run": "1" })).json()) as Record<string, unknown>;
      expect(viaHeader).toMatchObject({ output: "counted (mock)", dryRun: true });
      const real = (await (await post(`${s.url}/api/pipelines/Pay/runs`, { args: { winner: "ada" }, wait: true })).json()) as Record<string, unknown>;
      expect(real.dryRun).toBeUndefined();
      expect(s.sent.map((x) => x.url)).toEqual(["https://ledger.example.com/v1/pay"]);
    } finally {
      await s.stop();
    }
  });

  test("a dry run that pauses stays dry when it continues", async () => {
    const dir = mkdtempSync(join(tmp, "app-"));
    const s = await serve({ mocks: await mocks(dir) }, dir);
    try {
      const runId = s.start("Draft", { topic: "tides" }, "test", { dryRun: true });
      expect((await s.settled(runId))?.status).toBe("paused");
      const done = (await (await post(`${s.url}/api/runs/${runId}/signal`, { answer: "approve", wait: true })).json()) as Record<string, unknown>;
      expect(done).toMatchObject({ status: "completed", output: "Published (mock)" });
      expect(s.calls).toEqual([]);
    } finally {
      await s.stop();
    }
  });

  test("without a mocks file a dry run still calls nothing", async () => {
    const s = await serve();
    try {
      const id = s.start("Pay", { winner: "ada" }, "test", { dryRun: true });
      expect((await s.settled(id))?.output).toMatchObject({ mock: true, tool: "Ledger.post" });
      expect(s.sent).toHaveLength(0);
    } finally {
      await s.stop();
    }
  });

  test("serve can make every run a dry run, and says so", async () => {
    const dir = mkdtempSync(join(tmp, "app-"));
    const s = await serve({ mocks: await mocks(dir), dryRun: true, onRuntime: undefined }, dir);
    try {
      const r = (await (await post(`${s.url}/api/pipelines/Pay/runs`, { args: { winner: "ada" }, wait: true })).json()) as Record<string, unknown>;
      expect(r).toMatchObject({ output: { id: "pay_mock" }, dryRun: true });
      expect(s.sent).toHaveLength(0);
      expect(await (await fetch(`${s.url}/healthz`)).json()).toMatchObject({ ok: true, dryRun: true });
    } finally {
      await s.stop();
    }
  });

  test("a missing or broken mocks file stops the server from starting", async () => {
    await expect(serve({ mocks: "nope.json" })).rejects.toThrow("Mocks file not found: nope.json");
  });
});

test("healthz says which version and build is answering", async () => {
  const s = await serve({ env: { HALO_BUILD: "sha-abc123" } });
  try {
    const h = (await (await fetch(`${s.url}/healthz`)).json()) as Record<string, unknown>;
    expect(h).toMatchObject({ ok: true, build: "sha-abc123", version: expect.stringMatching(/^\d+\.\d+\.\d+/) });
    expect(Date.parse(String(h.startedAt))).toBeGreaterThan(0);
  } finally {
    await s.stop();
  }
});
