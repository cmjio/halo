/** Phase E of the file work: text messages (Twilio webhooks, the SMS tool) and form-encoded webhooks. */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "../src/parser/index";
import { HaloRuntime, type MockRequest } from "../src/runtime/runtime";
import { MediaBytes } from "../src/runtime/media";
import { incomingText, twilioSignature, twiml } from "../src/runtime/providers/sms";
import { startServer } from "../src/serve/server";

const quiet = { log() {}, warn() {}, error() {} };
const tmp = mkdtempSync(join(tmpdir(), "halo-sms-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));
const PNG = new Uint8Array(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC", "base64"));

describe("Twilio", () => {
  test("a signature covers the address and the sorted fields", () => {
    const params = new URLSearchParams({ To: "+15550100", From: "+15550123", Body: "hi" });
    const sig = twilioSignature("token", "https://example.com/hooks/sms", params);
    expect(sig).toBe(twilioSignature("token", "https://example.com/hooks/sms", new URLSearchParams({ Body: "hi", From: "+15550123", To: "+15550100" })));
    expect(sig).not.toBe(twilioSignature("token", "https://example.com/hooks/other", params));
    expect(sig).not.toBe(twilioSignature("other", "https://example.com/hooks/sms", params));
  });

  test("a reply is TwiML, escaped", () => {
    expect(twiml()).toBe('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    expect(twiml("Thanks <3 & bye")).toContain("<Message>Thanks &lt;3 &amp; bye</Message>");
  });

  test("a picture sent with a message is fetched; the account's key goes only to Twilio", async () => {
    const asked: Array<{ url: string; auth: string | null }> = [];
    const fetch = (async (url: string | URL, init?: RequestInit) => {
      asked.push({ url: String(url), auth: new Headers(init?.headers).get("authorization") });
      if (String(url).startsWith("https://api.twilio.com/")) return new Response(null, { status: 302, headers: { location: "https://media.twiliocdn.com/x/abc" } });
      return new Response(PNG);
    }) as unknown as typeof globalThis.fetch;
    const params = new URLSearchParams({ From: "+15550123", To: "+15550100", Body: "My dent", NumMedia: "1", MediaUrl0: "https://api.twilio.com/2010-04-01/Accounts/AC1/Messages/MM1/Media/ME1", AccountSid: "AC1", MessageSid: "SM1" });
    const message = await incomingText(params, { token: "tok", fetch, lookup: async () => ["93.184.215.14"] });
    expect(message).toMatchObject({ from: "+15550123", to: "+15550100", text: "My dent" });
    expect(message.media).toHaveLength(1);
    expect(message.media[0]).toBeInstanceOf(MediaBytes);
    expect(asked).toEqual([
      { url: "https://api.twilio.com/2010-04-01/Accounts/AC1/Messages/MM1/Media/ME1", auth: `Basic ${btoa("AC1:tok")}` },
      { url: "https://media.twiliocdn.com/x/abc", auth: null },
    ]);
  });
});

describe("webhooks for text messages", () => {
  let server: Awaited<ReturnType<typeof startServer>>;
  const asked: MockRequest[] = [];
  beforeAll(async () => {
    const dir = mkdtempSync(join(tmp, "app-"));
    await Bun.write(
      join(dir, "sms.halo"),
      `agent Clerk [anthropic/claude-haiku-4-5]
pipeline Reply(sms: Object) -> Result:
  sms |> Clerk.reply("Answer this text in one line.")
pipeline Form(order: Object) -> Result:
  order |> System.Print()`,
    );
    server = await startServer({
      files: [join(dir, "sms.halo")],
      root: dir,
      port: 0,
      stateDir: join(dir, ".halo"),
      scheduler: false,
      studio: false,
      logger: quiet,
      env: { TWILIO_AUTH_TOKEN: "tok" },
      webhooks: [
        { path: "sms", pipeline: "Reply", twilio: "Env.TWILIO_AUTH_TOKEN", reply: true },
        { path: "orders", pipeline: "Form", secret: "s3cret" },
      ],
      onRuntime: (rt) => rt.mockAll({ Clerk: (q: MockRequest) => (asked.push(q), "We got it, thanks.") }),
    });
  });
  afterAll(() => server.stop());

  const twilioPost = (fields: Record<string, string>, token = "tok") => {
    const body = new URLSearchParams(fields);
    const url = `${server.url}/hooks/sms`;
    return fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Twilio-Signature": twilioSignature(token, url, body) }, body });
  };

  test("a signed text starts a run with the message, and the reply goes back as TwiML", async () => {
    const res = await twilioPost({ From: "+15550123", To: "+15550100", Body: "Where is my order?", MessageSid: "SM100", NumMedia: "0" });
    expect(res.headers.get("content-type")).toContain("text/xml");
    expect(await res.text()).toContain("<Message>We got it, thanks.</Message>");
    expect(asked[0]!.prompt).toContain('"text": "Where is my order?"');
    expect(asked[0]!.prompt).toContain('"from": "+15550123"');
    // Twilio retries a message it thinks failed: the same MessageSid is one run.
    const again = await twilioPost({ From: "+15550123", To: "+15550100", Body: "Where is my order?", MessageSid: "SM100", NumMedia: "0" });
    expect(await again.text()).not.toContain("<Message>");
    expect(asked).toHaveLength(1);
  });

  test("a wrong signature is refused", async () => {
    expect((await twilioPost({ From: "+1", Body: "x" }, "wrong")).status).toBe(401);
  });

  test("any webhook takes a form post, as an object", async () => {
    const body = new URLSearchParams([["item", "mug"], ["qty", "2"], ["tag", "a"], ["tag", "b"]]);
    const res = await fetch(`${server.url}/hooks/orders`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Halo-Secret": "s3cret" }, body });
    expect(res.status).toBe(202);
    const { runId } = (await res.json()) as { runId: string };
    const done = await server.settled(runId);
    expect(done?.output).toEqual({ item: "mug", qty: "2", tag: ["a", "b"] });
  });
});

describe("the SMS tool", () => {
  let got: Array<{ path: string; auth: string | null; form: Record<string, string> }> = [];
  let api: ReturnType<typeof Bun.serve>;
  beforeAll(() => {
    api = Bun.serve({
      port: 0,
      async fetch(req) {
        got.push({ path: new URL(req.url).pathname, auth: req.headers.get("authorization"), form: Object.fromEntries(new URLSearchParams(await req.text())) });
        return Response.json({ sid: "SM9", status: "queued", to: "+15550123" }, { status: 201 });
      },
    });
  });
  afterAll(() => api.stop(true));

  test("sends a text with the account's key", async () => {
    const src = `tool Text : SMS(twilio, account: "AC1", token: "tok", from: "+15550100", baseUrl: "http://localhost:${api.port}")
pipeline Notify(to: String) -> Result:
  to |> Text.send(to: to, text: "Your claim is approved.")`;
    const r = await new HaloRuntime({ env: {}, logger: quiet }).load(parse(src)).run("Notify", { to: "+15550123" });
    expect(r.output).toEqual({ sid: "SM9", status: "queued", to: "+15550123" });
    expect(got[0]).toEqual({ path: "/2010-04-01/Accounts/AC1/Messages.json", auth: `Basic ${btoa("AC1:tok")}`, form: { To: "+15550123", From: "+15550100", Body: "Your claim is approved." } });
  });

  test("a number without its country code, or no key, says so", async () => {
    const run = (decl: string, to: string, env: Record<string, string> = {}) =>
      new HaloRuntime({ env, logger: quiet }).load(parse(`tool Text : ${decl}\npipeline N(to: String) -> Result:\n  to |> Text.send(to: to, text: "hi")`)).run("N", { to });
    await expect(run(`SMS(twilio, account: "AC1", token: "t", from: "+15550100")`, "555-0123")).rejects.toThrow(/with its country code, like \+15550123/);
    await expect(run(`SMS(twilio, from: "+15550100")`, "+15550123")).rejects.toThrow(/needs account: and token: \(or TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN\)/);
  });
});
