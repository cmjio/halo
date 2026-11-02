import { test, expect, describe, afterAll } from "bun:test";
import { createHmac } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { CronError, cronMatches, nextRun, parseCron } from "../src/serve/cron";
import { startServer, ServeError, type HaloServer, type ServeOptions } from "../src/serve/server";
import type { MockRequest } from "../src/runtime/runtime";

const tmp = mkdtempSync(join(tmpdir(), "halo-serve-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));
const quiet = { log() {}, warn() {}, error() {} };

describe("cron", () => {
  const at = (s: string) => new Date(s);

  test("matches minutes, hours, ranges, lists, steps, and names", () => {
    const weekdays9 = parseCron("0 9 * * mon-fri");
    expect(cronMatches(weekdays9, at("2026-11-02T09:00:00"))).toBe(true); // Monday
    expect(cronMatches(weekdays9, at("2026-11-02T09:01:00"))).toBe(false);
    expect(cronMatches(weekdays9, at("2026-11-01T09:00:00"))).toBe(false); // Sunday
    const quarter = parseCron("*/15 * * * *");
    expect([0, 15, 30, 45, 7].map((m) => cronMatches(quarter, at(`2026-11-02T10:${String(m).padStart(2, "0")}:00`)))).toEqual([true, true, true, true, false]);
    expect(cronMatches(parseCron("30 8 1,15 jan *"), at("2026-01-15T08:30:00"))).toBe(true);
    expect(cronMatches(parseCron("0 0 * * 7"), at("2026-11-01T00:00:00"))).toBe(true); // 7 is Sunday
  });

  test("day-of-month and day-of-week are OR'd when both are restricted", () => {
    const cron = parseCron("0 12 13 * fri");
    expect(cronMatches(cron, at("2026-11-13T12:00:00"))).toBe(true); // the 13th (a Friday)
    expect(cronMatches(cron, at("2026-11-06T12:00:00"))).toBe(true); // a Friday
    expect(cronMatches(cron, at("2026-11-12T12:00:00"))).toBe(false);
  });

  test("nextRun finds the next firing minute", () => {
    expect(nextRun(parseCron("0 9 * * 1-5"), at("2026-11-06T10:00:00"))).toEqual(at("2026-11-09T09:00:00")); // Fri → Mon
  });

  test("bad expressions explain what's wrong", () => {
    expect(() => parseCron("0 9 * *")).toThrow("needs 5 fields");
    expect(() => parseCron("61 * * * *")).toThrow("minute 61 is out of range 0-59");
    expect(() => parseCron("* * * * funday")).toThrow(CronError);
    expect(() => parseCron("*/0 * * * *")).toThrow("invalid step");
  });
});

const FLOW = `
agent Writer [openai/gpt-4o]
tool Store : VectorStore(namespace: "drafts")

pipeline Draft(topic: String) -> Result:
  topic
    |> Writer.draft("Draft a note about {{topic}}") as draft
    |! yield(msg: "Publish this draft?") as review
    |? (context.data.review.approved == true)
    |> Writer.publish(context.data.draft)

pipeline Echo(payload: JSON) -> Result:
  payload |> Writer.echo()

pipeline Quick(n: Number) -> Result:
  n |> Writer.count()
`;

async function serve(extra: Partial<ServeOptions> = {}): Promise<HaloServer & { calls: string[] }> {
  const dir = mkdtempSync(join(tmp, "app-"));
  await Bun.write(join(dir, "flow.halo"), FLOW);
  const calls: string[] = [];
  const server = await startServer({
    files: [join(dir, "flow.halo")],
    port: 0,
    stateDir: join(dir, ".halo"),
    scheduler: false,
    logger: quiet,
    env: {},
    onRuntime: (rt) =>
      rt.mockAll({
        "Writer.draft": (r: MockRequest) => (calls.push(`draft:${r.input}`), `Draft about ${r.input}`),
        "Writer.publish": (r: MockRequest) => (calls.push("publish"), `Published: ${r.args[0]}`),
        "Writer.echo": (r: MockRequest) => (calls.push(`echo:${JSON.stringify(r.input)}`), r.input),
        "Writer.count": (r: MockRequest) => (calls.push(`count:${r.input}`), `count ${r.input}`),
      }),
    ...extra,
  });
  return Object.assign(server, { calls });
}

const post = (url: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });

describe("halo serve", () => {
  test("lists pipelines and starts runs over the API", async () => {
    const s = await serve();
    try {
      const list = (await (await fetch(`${s.url}/api/pipelines`)).json()) as Array<{ name: string; params: unknown }>;
      expect(list.map((p) => p.name)).toEqual(["Draft", "Echo", "Quick"]);
      expect(list[2]!.params).toEqual([{ name: "n", type: "Number" }]);

      const res = await post(`${s.url}/api/pipelines/Quick/runs`, { args: { n: 3 }, wait: true });
      expect(await res.json()).toMatchObject({ status: "completed", output: "count 3" });

      const started = await post(`${s.url}/api/pipelines/Quick/runs`, { args: { n: 4 } });
      expect(started.status).toBe(202);
      const { runId } = (await started.json()) as { runId: string };
      expect((await s.settled(runId))?.output).toBe("count 4");

      expect((await post(`${s.url}/api/pipelines/Quick/runs`, {})).status).toBe(400);
      expect(await (await post(`${s.url}/api/pipelines/Quick/runs`, {})).json()).toEqual({ error: "Quick needs n" });
      expect(await (await post(`${s.url}/api/pipelines/Nope/runs`, {})).json()).toMatchObject({ error: expect.stringContaining(`Unknown pipeline "Nope"`) });
    } finally {
      await s.stop();
    }
  });

  test("a paused run gets a signed approval link; approving it resumes the run once", async () => {
    const s = await serve();
    try {
      const runId = s.start("Draft", { topic: "tides" }, "test");
      expect((await s.settled(runId))?.status).toBe("paused");

      const detail = (await (await fetch(`${s.url}/api/runs/${runId}`)).json()) as { paused: { waitingFor: string; message: string; approveUrl: string } };
      expect(detail.paused).toMatchObject({ waitingFor: "yield", message: "Publish this draft?" });
      expect(detail.paused.approveUrl).toBe((await s.approvalUrl(runId))!);

      const page = await (await fetch(detail.paused.approveUrl)).text();
      expect(page).toContain("Draft is waiting for you");
      expect(page).toContain("Publish this draft?");
      expect(page).toContain("Draft about tides");

      expect((await fetch(`${s.url}/approve/${runId}?sig=forged`)).status).toBe(403);

      const form = new FormData();
      form.set("answer", "approve");
      const done = await (await fetch(detail.paused.approveUrl, { method: "POST", body: form })).text();
      expect(done).toContain("The run continues with “approve”");
      expect((await s.settled(runId))?.output).toBe("Published: Draft about tides");
      expect(s.calls).toEqual(["draft:tides", "publish"]);

      // The link can't be used twice
      const again = await fetch(detail.paused.approveUrl, { method: "POST", body: form });
      expect(again.status).toBe(403);
      expect(await again.text()).toContain("already answered");
    } finally {
      await s.stop();
    }
  });

  test("the signal API resumes with an answer; rejecting halts at the gate", async () => {
    const s = await serve();
    try {
      const runId = s.start("Draft", { topic: "x" }, "test");
      await s.settled(runId);
      const res = await post(`${s.url}/api/runs/${runId}/signal`, { answer: "reject", wait: true });
      expect(await res.json()).toMatchObject({ status: "halted" });
      expect(s.calls).toEqual(["draft:x"]);
      expect((await post(`${s.url}/api/runs/${runId}/signal`, {})).status).toBe(409);

      const runs = (await (await fetch(`${s.url}/api/runs`)).json()) as Array<{ run_id: string; pipeline: string; status: string }>;
      expect(runs.find((r) => r.run_id === runId)).toMatchObject({ pipeline: "Draft", status: "halted" });
    } finally {
      await s.stop();
    }
  });

  test("a paused run survives a restart", async () => {
    const dir = mkdtempSync(join(tmp, "restart-"));
    const first = await serve({ stateDir: join(dir, ".halo") });
    const runId = first.start("Draft", { topic: "persist" }, "test");
    await first.settled(runId);
    const link = (await first.approvalUrl(runId))!.replace(first.url, "");
    await first.stop();

    const second = await serve({ stateDir: join(dir, ".halo") });
    try {
      const form = new FormData();
      form.set("answer", "approve");
      // The same signed link works on the new server (the signing secret is kept in .halo)
      expect(await (await fetch(second.url + link, { method: "POST", body: form })).text()).toContain("The run continues");
      expect((await second.settled(runId))?.output).toBe("Published: Draft about persist");
    } finally {
      await second.stop();
    }
  });

  test("webhooks start pipelines, checking a shared secret or a GitHub signature", async () => {
    const s = await serve({
      webhooks: [
        { path: "echo", pipeline: "Echo", secret: "Env.HOOK_SECRET" },
        { path: "/count/", pipeline: "Quick" },
      ],
      env: { HOOK_SECRET: "s3cret" },
    });
    try {
      const event = { action: "opened", issue: { number: 7 } };
      expect((await post(`${s.url}/hooks/echo`, event)).status).toBe(401);
      expect((await post(`${s.url}/hooks/echo`, event, { "x-halo-secret": "wrong" })).status).toBe(401);

      const ok = await post(`${s.url}/hooks/echo`, event, { "x-halo-secret": "s3cret" });
      expect(ok.status).toBe(202);
      // A single-parameter pipeline gets the whole body
      expect((await s.settled(((await ok.json()) as { runId: string }).runId))?.output).toEqual(event);

      const raw = JSON.stringify(event);
      const sig = `sha256=${createHmac("sha256", "s3cret").update(raw).digest("hex")}`;
      const gh = await fetch(`${s.url}/hooks/echo`, { method: "POST", headers: { "x-hub-signature-256": sig }, body: raw });
      expect(gh.status).toBe(202);
      const forged = await fetch(`${s.url}/hooks/echo`, { method: "POST", headers: { "x-hub-signature-256": "sha256=00" }, body: raw });
      expect(forged.status).toBe(401);

      // Matching fields map to parameters by name
      const counted = await post(`${s.url}/hooks/count`, { n: 9, extra: true });
      expect((await s.settled(((await counted.json()) as { runId: string }).runId))?.output).toBe("count 9");
      expect((await post(`${s.url}/hooks/missing`, {})).status).toBe(404);
    } finally {
      await s.stop();
    }
  });

  test("schedules start their pipeline once in a matching minute", async () => {
    const s = await serve({ schedules: [{ pipeline: "Quick", cron: "30 9 * * *", args: { n: 1 } }] });
    try {
      expect(s.tick(new Date("2026-11-02T09:29:00"))).toEqual([]);
      const [runId] = s.tick(new Date("2026-11-02T09:30:05"));
      expect(s.tick(new Date("2026-11-02T09:30:40"))).toEqual([]);
      expect((await s.settled(runId!))?.output).toBe("count 1");
      expect(s.tick(new Date("2026-11-03T09:30:00"))).toHaveLength(1);
      const list = (await (await fetch(`${s.url}/api/pipelines`)).json()) as Array<{ name: string; schedules: Array<{ cron: string }> }>;
      expect(list.find((p) => p.name === "Quick")!.schedules[0]!.cron).toBe("30 9 * * *");
    } finally {
      await s.stop();
    }
  });

  test("a paused run is announced to Slack with its approval link", async () => {
    const sent: unknown[] = [];
    const fetchSpy = (async (input: string | URL, init?: RequestInit) => {
      if (String(input).startsWith("https://hooks.slack.test/")) {
        sent.push(JSON.parse(String(init!.body)));
        return new Response("ok");
      }
      return fetch(input, init);
    }) as typeof fetch;
    const s = await serve({ notify: { slack: "Env.SLACK_URL" }, env: { SLACK_URL: "https://hooks.slack.test/T1" }, fetch: fetchSpy, publicUrl: "https://halo.example.com" });
    try {
      const runId = s.start("Draft", { topic: "slack" }, "test");
      await s.settled(runId);
      await Bun.sleep(20);
      expect(sent).toEqual([{ text: `⏸ Draft is waiting for a human: Publish this draft?\nRespond: https://halo.example.com/approve/${runId}?sig=${(await s.approvalUrl(runId))!.split("sig=")[1]}` }]);
    } finally {
      await s.stop();
    }
  });

  test("off localhost a token is required, and then every API call needs it", async () => {
    await expect(serve({ host: "0.0.0.0" })).rejects.toThrow(ServeError);
    const s = await serve({ host: "127.0.0.1", token: "Env.T", env: { T: "tok" } });
    try {
      expect((await fetch(`${s.url}/api/pipelines`)).status).toBe(401);
      expect((await fetch(`${s.url}/api/pipelines`, { headers: { Authorization: "Bearer nope" } })).status).toBe(401);
      expect((await fetch(`${s.url}/api/pipelines`, { headers: { Authorization: "Bearer tok" } })).status).toBe(200);
      expect((await fetch(`${s.url}/api/pipelines?token=tok`)).status).toBe(200);
      // Approval links are signed, so they work without the token
      const runId = s.start("Draft", { topic: "t" }, "test");
      await s.settled(runId);
      expect((await fetch((await s.approvalUrl(runId))!)).status).toBe(200);
    } finally {
      await s.stop();
    }
  });

  test("approving the same link three times at once resumes the run once", async () => {
    const s = await serve();
    try {
      const runId = s.start("Draft", { topic: "tides" }, "test");
      await s.settled(runId);
      const link = (await s.approvalUrl(runId))!;
      const pages = await Promise.all([1, 2, 3].map(() => fetch(link, { method: "POST", body: new URLSearchParams({ answer: "approve" }) }).then((r) => r.text())));
      expect((await s.settled(runId))?.output).toBe("Published: Draft about tides");
      expect(s.calls.filter((c) => c === "publish")).toHaveLength(1);
      expect(pages.filter((p) => p.includes("The run continues")).length).toBe(1);
    } finally {
      await s.stop();
    }
  });

  test("an approval link answers only the pause it was made for", async () => {
    const dir = mkdtempSync(join(tmp, "two-"));
    await Bun.write(
      join(dir, "two.halo"),
      `agent W [openai/gpt-4o]
       pipeline Two(x: String) -> Result:
         x
           |! yield(msg: "first?") as one
           |! yield(msg: "second?") as two
           |? (context.data.two.approved == true)
           |> W.go()`,
    );
    const s = await startServer({ files: [dir], port: 0, stateDir: join(dir, ".halo"), scheduler: false, logger: quiet, env: {}, onRuntime: (rt) => rt.mockAll({ "W.go": "went" }) });
    try {
      const runId = s.start("Two", { x: "a" }, "test");
      await s.settled(runId);
      const first = (await s.approvalUrl(runId))!;
      await fetch(first, { method: "POST", body: new URLSearchParams({ answer: "approve" }) });
      expect((await s.settled(runId))?.status).toBe("paused");
      // Replaying the first link must not answer the second question
      expect((await fetch(first, { method: "POST", body: new URLSearchParams({ answer: "approve" }) })).status).toBe(403);
      const second = (await s.approvalUrl(runId))!;
      expect(second).not.toBe(first);
      await fetch(second, { method: "POST", body: new URLSearchParams({ answer: "approve" }) });
      expect((await s.settled(runId))?.output).toBe("went");
    } finally {
      await s.stop();
    }
  });

  test("the API refuses cross-site requests, foreign Host headers, and non-object args", async () => {
    const s = await serve();
    try {
      const url = `${s.url}/api/pipelines/Quick/runs`;
      const body = JSON.stringify({ args: { n: 1 } });
      // A page on another site can send a "simple" text/plain POST without a preflight
      const plain = await fetch(url, { method: "POST", headers: { "Content-Type": "text/plain" }, body });
      expect(plain.status).toBe(403);
      expect(await plain.json()).toEqual({ error: "POST requests to /api must be Content-Type: application/json" });
      expect((await post(url, { args: { n: 1 } }, { Origin: "https://evil.example" })).status).toBe(403);
      // DNS rebinding: an attacker's name pointed at 127.0.0.1
      expect((await fetch(`${s.url}/api/runs`, { headers: { Host: "attacker.example" } })).status).toBe(403);
      expect((await post(url, { args: "n=1" })).status).toBe(400);
      expect((await post(url, { args: { n: 1 } }, { Origin: s.url })).status).toBe(202);
      expect(s.calls).toEqual(["count:1"]);
    } finally {
      await s.stop();
    }
  });

  test("bad config fails at startup with a clear message", async () => {
    await expect(serve({ webhooks: [{ path: "gh", pipeline: "Echo", secret: "Env.UNSET_SECRET" }] })).rejects.toThrow(`has secret "Env.UNSET_SECRET", but it is empty or not set`);
    await expect(serve({ schedules: [{ pipeline: "Nope", cron: "* * * * *" }] })).rejects.toThrow(`Unknown pipeline "Nope"`);
    await expect(serve({ schedules: [{ pipeline: "Quick", cron: "every day" }] })).rejects.toThrow("needs 5 fields");
    const dir = mkdtempSync(join(tmp, "bad-"));
    await Bun.write(join(dir, "a.halo"), "pipeline P(x: String) -> Result:\n  x |> Ghost.run()");
    await expect(startServer({ files: [dir], port: 0, stateDir: join(dir, ".halo"), logger: quiet })).rejects.toThrow(`unknown callee "Ghost"`);
  });

  test("Halo Studio is served at / and bundled by Bun", async () => {
    const s = await serve();
    try {
      const html = await (await fetch(`${s.url}/`)).text();
      expect(html).toContain("<title>Halo Studio</title>");
      const script = html.match(/<script[^>]*src="([^"]+)"/)![1]!;
      expect((await fetch(new URL(script, s.url))).status).toBe(200);
    } finally {
      await s.stop();
    }
  });
});

test("`halo serve` starts from the CLI and stops on SIGTERM", async () => {
  const dir = mkdtempSync(join(tmp, "cli-"));
  await Bun.write(join(dir, "flow.halo"), FLOW);
  const proc = Bun.spawn(["bun", resolve(`${import.meta.dir}/../index.ts`), "serve", "flow.halo", "--port", "0"], { cwd: dir, stdout: "pipe", stderr: "pipe", env: { ...Bun.env, NO_COLOR: "1" } });
  const reader = proc.stdout.getReader();
  let out = "";
  while (!/http:\/\/127\.0\.0\.1:\d+/.test(out)) {
    const { value, done } = await reader.read();
    if (done) break;
    out += new TextDecoder().decode(value);
  }
  const url = out.match(/http:\/\/127\.0\.0\.1:\d+/)![0];
  expect(out).toContain("Halo is serving 3 pipeline(s)");
  expect(await (await fetch(`${url}/api/health`)).json()).toEqual({ ok: true, pipelines: 3 });
  proc.kill("SIGTERM");
  expect(await proc.exited).toBe(0);
});
