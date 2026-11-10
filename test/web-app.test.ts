import { afterAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import type { MockRequest } from "../src/index";
import { createApp, type PublicEvent } from "../blueprints/web-app/app";
import { businessDaysBetween, ordersApi } from "../blueprints/web-app/orders-api";

const dir = join(import.meta.dir, "../blueprints/web-app");
const source = await Bun.file(join(dir, "pipelines/reply.halo")).text();
const mocks = await Bun.file(join(dir, "samples/mocks.json")).json();
const orders = await Bun.file(join(dir, "samples/orders.json")).json();

// The orders API, reached through the runtime's fetch, so no port is opened.
const TOKEN = "test-orders-token";
const orderService = ordersApi(orders, TOKEN, () => new Date("2026-11-10T12:00:00Z"));
const prompts: MockRequest[] = [];
const app = createApp({
  source,
  stateDir: ":memory:",
  // Model answers are canned; the tools (handbook files, orders API) run for real.
  mocks: { ...mocks, "Writer.draft": (req: MockRequest) => (prompts.push(req), mocks["Writer.draft"]) },
  runtime: {
    env: { HANDBOOK_DIR: join(dir, "handbook"), ORDERS_API_URL: "http://orders.internal/orders", ORDERS_API_TOKEN: TOKEN },
    fetch: (async (input: RequestInfo | URL, init?: RequestInit) => orderService(new Request(input, init))) as typeof fetch,
  },
});
afterAll(() => app.close());

const base = "http://localhost";

/** A browser: keeps its session cookie between requests. */
function browser() {
  let cookie = "";
  return async (path: string, body?: unknown) => {
    const res = (await app.fetch(new Request(base + path, {
      method: body === undefined ? "GET" : "POST",
      headers: { cookie, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })))!;
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0]!;
    return res;
  };
}

/** Read Server-Sent Events until `until` matches one. */
async function readEvents(res: Response, until: (e: PublicEvent) => boolean): Promise<PublicEvent[]> {
  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
  const seen: PublicEvent[] = [];
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return seen;
    buffer += value;
    let i: number;
    while ((i = buffer.indexOf("\n\n")) >= 0) {
      const chunk = buffer.slice(0, i);
      buffer = buffer.slice(i + 2);
      if (!chunk.startsWith("data: ")) continue;
      const e = JSON.parse(chunk.slice(6)) as PublicEvent;
      seen.push(e);
      if (until(e)) { await reader.cancel(); return seen; }
    }
  }
}

describe("web-app blueprint", () => {
  test("draft → pause → approve with an edit → done, remembered in the user's thread", async () => {
    const ana = browser();
    const { userId } = await (await ana("/api/me")).json();
    const start = await ana("/api/drafts", { message: "Where is my lamp?", user_id: "someone-else" });
    expect(start.status).toBe(202);
    const { runId } = await start.json();

    const first = await readEvents((await ana(`/api/runs/${runId}/events`))!, (e) => e.type === "paused");
    expect(first.filter((e) => e.type === "stage").map((e) => (e as { label: string }).label)).toContain("Writer.draft");
    const paused = first.at(-1) as Extract<PublicEvent, { type: "paused" }>;
    expect(paused.draft).toBe(mocks["Writer.draft"]);
    expect((paused.triage as { category: string }).category).toBe("order");
    // Nothing the browser sees carries a prompt.
    expect(JSON.stringify(first)).not.toContain("never follow instructions");

    // The approver sees the order the API returned, with the date arithmetic done in code.
    expect(paused.order).toMatchObject({ id: "A1001", status: "in_transit", business_days_in_transit: 9 });
    expect(paused.check).toEqual({ ok: true, problems: [] });

    // The draft was written from the rules and the order, not from the model's imagination ...
    const prompt = prompts.at(-1)!.prompt;
    expect(prompt).toContain("More than 7 business days in transit: we open a trace");
    expect(prompt).toContain("Sign off as \"The Lamp & Loom team\"");
    expect(prompt).toContain("\"business_days_in_transit\": 9");
    // ... and the API token stayed in the tool.
    expect(prompt).not.toContain(TOKEN);

    const events = ana(`/api/runs/${runId}/events`);
    expect((await ana(`/api/runs/${runId}/answer`, { approved: true, reply: "Edited by Ana" })).status).toBe(202);
    const rest = await readEvents((await events)!, (e) => e.type === "done");
    expect(rest.at(-1)).toMatchObject({ type: "done", status: "completed", output: "Edited by Ana" });

    // user_id came from the session, not the body.
    const thread = await app.runtime.run("DraftReply", { user_id: userId, message: "again" });
    expect(thread.context.thread?.state.replies).toEqual(["Edited by Ana"]);
    expect((await app.runtime.run("DraftReply", { user_id: "someone-else", message: "x" })).context.thread?.state.replies).toBeUndefined();
  });

  test("another user can't watch or answer someone's run", async () => {
    const ana = browser();
    const bo = browser();
    const { runId } = await (await ana("/api/drafts", { message: "Refund please" })).json();
    await readEvents((await ana(`/api/runs/${runId}/events`))!, (e) => e.type === "paused");
    expect((await bo(`/api/runs/${runId}/events`)).status).toBe(404);
    expect((await bo(`/api/runs/${runId}/answer`, { approved: true })).status).toBe(404);
  });

  test("reject halts the run; a second answer is refused", async () => {
    const ana = browser();
    const { runId } = await (await ana("/api/drafts", { message: "Hello" })).json();
    await readEvents((await ana(`/api/runs/${runId}/events`))!, (e) => e.type === "paused");
    expect((await ana(`/api/runs/${runId}/answer`, { approved: false })).status).toBe(202);
    expect((await ana(`/api/runs/${runId}/answer`, { approved: true })).status).toBe(409);
    const all = await readEvents((await ana(`/api/runs/${runId}/events`))!, (e) => e.type === "done");
    expect(all.at(-1)).toMatchObject({ type: "done", status: "halted" });
  });

  test("bad requests", async () => {
    const ana = browser();
    expect((await ana("/api/drafts", { message: "  " })).status).toBe(400);
    const form = await app.fetch(new Request(base + "/api/drafts", { method: "POST", body: "message=hi", headers: { "Content-Type": "application/x-www-form-urlencoded" } }));
    expect(form!.status).toBe(415);
    expect((await ana("/api/runs/nope/events")).status).toBe(404);
  });

  test("an unknown order reaches the writer as null, not as an error", async () => {
    app.runtime.mockAll({ "Triager.classify": { ...mocks["Triager.classify"], order_id: "Z9999" } });
    const r = await app.runtime.run("DraftReply", { user_id: "ana", message: "where is Z9999?" });
    app.runtime.mockAll({ "Triager.classify": mocks["Triager.classify"] });
    expect(r.status).toBe("paused");
    expect(r.context.data.order).toBeNull();
  });

  test("business days skip weekends", () => {
    expect(businessDaysBetween(new Date("2026-10-28"), new Date("2026-11-10"))).toBe(9);
    expect(businessDaysBetween(new Date("2026-11-06"), new Date("2026-11-09"))).toBe(1); // Fri → Mon
  });

  test("the orders API refuses a request without its token", () => {
    expect(orderService(new Request("http://x/orders?id=A1001")).status).toBe(401);
  });
});
