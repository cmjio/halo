import { test, expect, describe } from "bun:test";
import { parse } from "../src/parser/index";
import { validate } from "../src/parser/validate";
import { HaloRuntime, useTool } from "../src/runtime/runtime";
import { verifySignature } from "../src/runtime/signing";

interface Sent {
  url: string;
  headers: Record<string, string>;
  body: unknown;
  raw: string;
}

function rt(src: string, answer: (s: Sent) => Response = () => Response.json({ id: "msg_1" }), mocks: Record<string, unknown> = {}) {
  const ast = parse(src);
  expect(ast.errors).toEqual([]);
  expect(validate(ast).filter((d) => d.severity === "error")).toEqual([]);
  const sent: Sent[] = [];
  const fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const raw = init?.body instanceof FormData ? JSON.stringify([...init.body.entries()]) : String(init?.body ?? "");
    const s = { url: String(url), headers: Object.fromEntries(new Headers(init?.headers).entries()), raw, body: JSON.parse(raw || "null") };
    sent.push(s);
    return answer(s);
  }) as typeof globalThis.fetch;
  const env = { KEY: "k_123", APP_URL: "https://app.example.com/halo", APP_SECRET: "shh" };
  return { runtime: new HaloRuntime({ env, fetch, logger: { log() {}, warn() {} } }).load(ast).mockAll(mocks), sent };
}

const NOTE = `pipeline Note(to: String) -> Result:
  to |> Mail.send(to: to, subject: "You won", body: "Well played.", html: "<p>Well played.</p>", cc: "judges@example.com", reply_to: "help@example.com")`;

describe("Email", () => {
  test("Resend is the default, and gets the call's idempotency key", async () => {
    const { runtime, sent } = rt(`tool Mail : Email(Env.KEY, from: "Prizes <prizes@example.com>")\n${NOTE}`);
    const a = await runtime.run("Note", { to: "ada@example.com" }, { runId: "r1" });
    expect(a.output).toEqual({ sent: true, id: "msg_1", to: ["ada@example.com"] });
    expect(sent[0]).toMatchObject({
      url: "https://api.resend.com/emails",
      headers: { authorization: "Bearer k_123" },
      body: { from: "Prizes <prizes@example.com>", to: ["ada@example.com"], subject: "You won", text: "Well played.", html: "<p>Well played.</p>", cc: ["judges@example.com"], reply_to: ["help@example.com"] },
    });
    // The same step of the same run sends the same key, so Resend drops the repeat.
    await runtime.run("Note", { to: "ada@example.com" }, { runId: "r1" });
    expect(sent[1]!.headers["idempotency-key"]).toBe(sent[0]!.headers["idempotency-key"]!);
    expect(sent[0]!.headers["idempotency-key"]).toMatch(/^halo_/);
  });

  test("Postmark", async () => {
    const { runtime, sent } = rt(`tool Mail : Email(Env.KEY, via: "postmark", from: "prizes@example.com", stream: "outbound")\n${NOTE}`, () => Response.json({ MessageID: "pm_1" }));
    expect((await runtime.run("Note", { to: "ada@example.com" })).output).toMatchObject({ sent: true, id: "pm_1" });
    expect(sent[0]).toMatchObject({
      url: "https://api.postmarkapp.com/email",
      headers: { "x-postmark-server-token": "k_123" },
      body: { From: "prizes@example.com", To: "ada@example.com", Subject: "You won", TextBody: "Well played.", HtmlBody: "<p>Well played.</p>", Cc: "judges@example.com", ReplyTo: "help@example.com", MessageStream: "outbound" },
    });
  });

  test("SendGrid", async () => {
    const { runtime, sent } = rt(`tool Mail : Email(Env.KEY, via: "sendgrid", from: "Prizes <prizes@example.com>")\n${NOTE}`, () => new Response(null, { status: 202, headers: { "X-Message-Id": "sg_1" } }));
    expect((await runtime.run("Note", { to: "ada@example.com" })).output).toMatchObject({ sent: true, id: "sg_1" });
    expect(sent[0]).toMatchObject({
      url: "https://api.sendgrid.com/v3/mail/send",
      headers: { authorization: "Bearer k_123" },
      body: {
        personalizations: [{ to: [{ email: "ada@example.com" }], cc: [{ email: "judges@example.com" }] }],
        from: { email: "prizes@example.com", name: "Prizes" },
        reply_to: { email: "help@example.com" },
        subject: "You won",
        content: [{ type: "text/plain", value: "Well played." }, { type: "text/html", value: "<p>Well played.</p>" }],
      },
    });
  });

  test("Mailgun", async () => {
    const { runtime, sent } = rt(`tool Mail : Email(Env.KEY, via: "mailgun", domain: "mg.example.com", from: "prizes@example.com")\n${NOTE}`, () => Response.json({ id: "<mg_1>", message: "Queued." }));
    expect((await runtime.run("Note", { to: "ada@example.com" })).output).toMatchObject({ sent: true, id: "<mg_1>" });
    expect(sent[0]!.url).toBe("https://api.mailgun.net/v3/mg.example.com/messages");
    expect(sent[0]!.headers.authorization).toBe(`Basic ${btoa("api:k_123")}`);
    expect(sent[0]!.body).toEqual(expect.arrayContaining([["from", "prizes@example.com"], ["to", "ada@example.com"], ["cc", "judges@example.com"], ["subject", "You won"], ["text", "Well played."], ["html", "<p>Well played.</p>"], ["h:Reply-To", "help@example.com"]]));
  });

  test("an unknown service, or Mailgun without a domain, says what to fix", async () => {
    await expect(rt(`tool Mail : Email(Env.KEY, via: "pigeon", from: "a@example.com")\n${NOTE}`).runtime.run("Note", { to: "b@example.com" })).rejects.toThrow(/"pigeon" is not an email service Halo knows \(resend, postmark, sendgrid, mailgun, cloudflare, smtp, imap, gmail, outlook\)/);
    await expect(rt(`tool Mail : Email(Env.KEY, via: "mailgun", from: "a@example.com")\n${NOTE}`).runtime.run("Note", { to: "b@example.com" })).rejects.toThrow(/Mailgun needs domain/);
  });

  test("a tool rule keeps a model's mail inside one domain", async () => {
    const { runtime, sent } = rt(
      `tool Mail : Email(Env.KEY, from: "prizes@example.com") & Match("to", "[\\\\w.+-]+@example\\\\.com") & Locked("cc", "bcc")
       agent Announcer [openai/gpt-4o] equips Mail
       pipeline Announce(winner: String) -> Result:
         winner |> Announcer.tell(tools: [Mail])`,
      undefined,
      { "Announcer.tell": (req: { step?: number }) => [[useTool("Mail.send", { to: "ada@elsewhere.net", subject: "Hi", body: "x" })], [useTool("Mail.send", { to: "ada@example.com", subject: "Hi", body: "x", bcc: "me@elsewhere.net" })], [useTool("Mail.send", { to: "ada@example.com", subject: "Hi", body: "x" })], "Told."][(req.step ?? 1) - 1] },
    );
    const r = await runtime.run("Announce", { winner: "ada" });
    expect(r.output).toBe("Told.");
    expect(sent).toHaveLength(1);
    expect(r.context.meta.violations.map((v) => v.rule)).toEqual(["Match", "Locked"]);
  });
});

describe("Handoff", () => {
  const APP = `tool App : Handoff(Env.APP_URL, secret: Env.APP_SECRET)`;

  test("the app gets a signed item it can act on once", async () => {
    const { runtime, sent } = rt(
      `${APP}
       pipeline Tell(winner: String) -> Result:
         winner |> App.send(kind: "winner_note", to: winner, note: "Well played.")`,
      () => Response.json({ queued: true }),
    );
    const r = await runtime.run("Tell", { winner: "ada@example.com" }, { runId: "run-9" });
    expect(r.output).toEqual({ queued: true });
    const [s] = sent;
    expect(s!.url).toBe("https://app.example.com/halo");
    expect(s!.body).toMatchObject({ type: "handoff", kind: "winner_note", runId: "run-9", data: { to: "ada@example.com", note: "Well played." } });
    expect(verifySignature("shh", s!.raw, s!.headers["halo-signature"])).toBe(true);
    expect(s!.headers["halo-event"]).toBe("handoff");
    // The id is the call's idempotency key: the same when the step runs again.
    const id = (s!.body as { id: string }).id;
    expect(s!.headers["idempotency-key"]).toBe(id);
    await runtime.run("Tell", { winner: "ada@example.com" }, { runId: "run-9" });
    expect((sent[1]!.body as { id: string }).id).toBe(id);
  });

  test("the method name is the kind, and an empty answer is still a delivery", async () => {
    const { runtime, sent } = rt(
      `${APP}
       pipeline Tell(winner: String) -> Result:
         winner |> App.winner_note(to: winner)`,
      () => new Response(null, { status: 204 }),
    );
    const r = await runtime.run("Tell", { winner: "ada" });
    expect(r.output).toMatchObject({ delivered: true, kind: "winner_note" });
    expect(sent[0]!.body).toMatchObject({ kind: "winner_note", data: { to: "ada" } });
  });

  test("it needs a secret, and a kind", async () => {
    await expect(rt(`tool App : Handoff(Env.APP_URL)\npipeline P(x: String) -> Result:\n  x |> App.send(kind: "k")`).runtime.run("P", { x: "x" })).rejects.toThrow(/needs secret:/);
    await expect(rt(`${APP}\npipeline P(x: String) -> Result:\n  x |> App.send(note: "n")`).runtime.run("P", { x: "x" })).rejects.toThrow(/needs kind:/);
  });

  test("an app that refuses fails the step", async () => {
    const { runtime } = rt(`${APP}\npipeline P(x: String) -> Result:\n  x |> App.send(kind: "k")`, () => new Response("nope", { status: 422 }));
    await expect(runtime.run("P", { x: "x" })).rejects.toThrow(/App handoff \(k\) failed \(422\): nope/);
  });
});
