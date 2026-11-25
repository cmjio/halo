import { test, expect, describe, afterAll } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import net from "node:net";
import tls from "node:tls";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "../src/parser/index";
import { validate } from "../src/parser/validate";
import { HaloRuntime, useTool } from "../src/runtime/runtime";
import { buildMessage, parseMessage } from "../src/runtime/mail/mime";
import { searchCriteria } from "../src/runtime/mail/imap";
import { startServer } from "../src/serve/server";

const tmp = mkdtempSync(join(tmpdir(), "halo-mail-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));
const quiet = { log() {}, warn() {}, error() {} };

interface Sent {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: any;
}

function rt(src: string, answer: (s: Sent) => Response | Promise<Response> = () => Response.json({}), mocks: Record<string, unknown> = {}) {
  const ast = parse(src);
  expect(ast.errors).toEqual([]);
  expect(validate(ast).filter((d) => d.severity === "error")).toEqual([]);
  const sent: Sent[] = [];
  const fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const raw = typeof init?.body === "string" ? init.body : "";
    let body: unknown = raw;
    try {
      body = JSON.parse(raw);
    } catch {}
    const s = { url: String(url), method: init?.method ?? "GET", headers: Object.fromEntries(new Headers(init?.headers).entries()), body };
    sent.push(s);
    return answer(s);
  }) as typeof globalThis.fetch;
  const env = { KEY: "secret-1", ACCOUNT: "acc_9", TENANT: "contoso.example", CLIENT: "client-1" };
  return { runtime: new HaloRuntime({ env, fetch, logger: quiet }).load(ast).mockAll(mocks), sent };
}

// ── A mail server to talk to ──

interface SmtpDelivery {
  from: string;
  to: string[];
  data: string;
  auth?: string;
  encrypted: boolean;
}

function smtpServer(options: { cert?: { key: string; cert: string }; auth?: string[]; reject?: string } = {}) {
  const deliveries: SmtpDelivery[] = [];
  const server = net.createServer((plain) => {
    let socket: net.Socket = plain;
    let buffer = "";
    let inData = false;
    let current: SmtpDelivery = { from: "", to: [], data: "", encrypted: false };
    let loginStep = 0;
    let loginUser = "";
    const say = (line: string) => socket.write(`${line}\r\n`);
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      for (;;) {
        if (inData) {
          const end = buffer.indexOf("\r\n.\r\n");
          if (end === -1) return;
          current.data = buffer.slice(0, end).replace(/^\.\./gm, ".");
          buffer = buffer.slice(end + 5);
          inData = false;
          deliveries.push(current);
          current = { from: "", to: [], data: "", encrypted: current.encrypted, auth: current.auth };
          say("250 2.0.0 queued as 42");
          continue;
        }
        const at = buffer.indexOf("\r\n");
        if (at === -1) return;
        const line = buffer.slice(0, at);
        buffer = buffer.slice(at + 2);
        const verb = line.split(/[ :]/)[0]!.toUpperCase();
        if (loginStep === 1) {
          loginUser = Buffer.from(line, "base64").toString();
          loginStep = 2;
          say("334 UGFzc3dvcmQ6");
        } else if (loginStep === 2) {
          current.auth = `${loginUser}:${Buffer.from(line, "base64").toString()}`;
          loginStep = 0;
          say("235 ok");
        } else if (verb === "EHLO") {
          socket.write(`250-mail.test\r\n${options.cert && !current.encrypted ? "250-STARTTLS\r\n" : ""}250-AUTH ${(options.auth ?? ["PLAIN", "LOGIN"]).join(" ")}\r\n250 SIZE 1000000\r\n`);
        } else if (verb === "STARTTLS") {
          say("220 go ahead");
          plain.removeListener("data", onData);
          const secure = new tls.TLSSocket(plain, { isServer: true, key: options.cert!.key, cert: options.cert!.cert });
          secure.on("data", onData);
          secure.on("error", () => {});
          socket = secure;
          current.encrypted = true;
          return;
        } else if (verb === "AUTH") {
          const [, kind, arg] = line.split(" ");
          if (kind === "PLAIN") {
            const [, user, pass] = Buffer.from(arg ?? "", "base64").toString().split("\0");
            if (pass === "wrong") say("535 5.7.8 bad credentials");
            else {
              current.auth = `${user}:${pass}`;
              say("235 ok");
            }
          } else if (kind === "LOGIN") {
            loginStep = 1;
            say("334 VXNlcm5hbWU6");
          } else if (kind === "XOAUTH2") {
            current.auth = `xoauth2:${Buffer.from(arg ?? "", "base64").toString().replace(/\x01/g, "|")}`;
            say("235 ok");
          }
        } else if (verb === "MAIL") {
          current.from = line.match(/<(.*)>/)?.[1] ?? "";
          say("250 ok");
        } else if (verb === "RCPT") {
          const to = line.match(/<(.*)>/)?.[1] ?? "";
          if (options.reject && to === options.reject) say("550 5.1.1 no such user");
          else {
            current.to.push(to);
            say("250 ok");
          }
        } else if (verb === "DATA") {
          inData = true;
          say("354 go");
        } else if (verb === "QUIT") {
          say("221 bye");
          socket.end();
        } else say("500 what");
      }
    };
    plain.on("data", onData);
    plain.on("error", () => {});
    say("220 mail.test ESMTP");
  });
  return new Promise<{ port: number; deliveries: SmtpDelivery[]; stop: () => void }>((resolve) => server.listen(0, "127.0.0.1", () => resolve({ port: (server.address() as net.AddressInfo).port, deliveries, stop: () => server.close() })));
}

function selfSigned(): { key: string; cert: string } | undefined {
  const key = join(tmp, "key.pem");
  const cert = join(tmp, "cert.pem");
  try {
    const p = Bun.spawnSync(["openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", key, "-out", cert, "-days", "1", "-subj", "/CN=localhost"], { stderr: "ignore", stdout: "ignore" });
    if (p.exitCode !== 0) return undefined;
    return { key: readFileSync(key, "utf8"), cert: readFileSync(cert, "utf8") };
  } catch {
    return undefined;
  }
}

const SEND = `pipeline Note(to: String) -> Result:
  to |> Mail.send(to: to, subject: "You won, félicitations", body: "Well played.\\n.hidden line\\nBye", html: "<p>Well played.</p>", cc: "Judges <judges@example.com>", bcc: "audit@example.com")`;

describe("Email over SMTP", () => {
  test("it logs in, names every recipient, and sends a message a mail reader understands", async () => {
    const server = await smtpServer();
    try {
      const { runtime } = rt(`tool Mail : Email(Env.KEY, via: "smtp", host: "127.0.0.1", port: ${server.port}, tls: "none", user: "bot@example.com", from: "Prizes <prizes@example.com>")\n${SEND}`);
      const r = await runtime.run("Note", { to: "ada@example.com" }, { runId: "run-1" });
      expect(r.output).toMatchObject({ sent: true, to: ["ada@example.com"], response: expect.stringContaining("queued as 42") });
      const [d] = server.deliveries;
      expect(d).toMatchObject({ from: "prizes@example.com", to: ["ada@example.com", "judges@example.com", "audit@example.com"], auth: "bot@example.com:secret-1" });
      const m = parseMessage(d!.data);
      expect(m).toMatchObject({ subject: "You won, félicitations", text: "Well played.\n.hidden line\nBye", html: "<p>Well played.</p>", from: { address: "prizes@example.com", name: "Prizes" } });
      expect(m.cc.map((a) => a.address)).toEqual(["judges@example.com"]);
      // Blind copies get the message but are not named in it.
      expect(d!.data).not.toContain("audit@example.com");
      // The message id comes from the call's idempotency key: the same step sends the same message.
      expect(m.messageId).toMatch(/^halo_[0-9a-f]{40}@example\.com$/);
      await runtime.run("Note", { to: "ada@example.com" }, { runId: "run-1" });
      expect(parseMessage(server.deliveries[1]!.data).messageId).toBe(m.messageId!);
    } finally {
      server.stop();
    }
  });

  test("a server that only knows LOGIN is logged into that way", async () => {
    const server = await smtpServer({ auth: ["LOGIN"] });
    try {
      const { runtime } = rt(`tool Mail : Email(Env.KEY, via: "smtp", host: "127.0.0.1", port: ${server.port}, tls: "none", user: "bot@example.com")\n${SEND}`);
      await runtime.run("Note", { to: "ada@example.com" });
      // With no from:, mail is from the account that signs in.
      expect(server.deliveries[0]).toMatchObject({ auth: "bot@example.com:secret-1", from: "bot@example.com" });
    } finally {
      server.stop();
    }
  });

  test("STARTTLS encrypts before the password is sent", async () => {
    const cert = selfSigned();
    if (!cert) return; // no openssl here to make a certificate
    const server = await smtpServer({ cert });
    try {
      const { runtime } = rt(`tool Mail : Email(Env.KEY, via: "smtp", host: "127.0.0.1", port: ${server.port}, tlsVerify: false, user: "bot@example.com")\n${SEND}`);
      await runtime.run("Note", { to: "ada@example.com" });
      expect(server.deliveries[0]).toMatchObject({ encrypted: true, auth: "bot@example.com:secret-1" });
      // Without tlsVerify: false, a certificate nobody vouches for is refused.
      const strict = rt(`tool Mail : Email(Env.KEY, via: "smtp", host: "127.0.0.1", port: ${server.port}, user: "bot@example.com")\n${SEND}`);
      await expect(strict.runtime.run("Note", { to: "ada@example.com" })).rejects.toThrow(/did not complete TLS/);
    } finally {
      server.stop();
    }
  });

  test("a server without STARTTLS is not sent mail in the clear unless told to", async () => {
    const server = await smtpServer();
    try {
      const { runtime } = rt(`tool Mail : Email(Env.KEY, via: "smtp", host: "127.0.0.1", port: ${server.port}, user: "bot@example.com")\n${SEND}`);
      await expect(runtime.run("Note", { to: "ada@example.com" })).rejects.toThrow(/doesn't offer STARTTLS/);
      expect(server.deliveries).toHaveLength(0);
    } finally {
      server.stop();
    }
  });

  test("a refused login or recipient is an error that says what the server said", async () => {
    const server = await smtpServer({ reject: "ada@example.com" });
    try {
      const refused = rt(`tool Mail : Email(Env.KEY, via: "smtp", host: "127.0.0.1", port: ${server.port}, tls: "none", user: "bot@example.com")\n${SEND}`);
      await expect(refused.runtime.run("Note", { to: "ada@example.com" })).rejects.toThrow(/refused the recipient ada@example.com: 550 5.1.1 no such user/);
      const wrong = rt(`tool Mail : Email("wrong", via: "smtp", host: "127.0.0.1", port: ${server.port}, tls: "none", user: "bot@example.com")\n${SEND}`);
      await expect(wrong.runtime.run("Note", { to: "b@example.com" })).rejects.toThrow(/refused the login: 535/);
    } finally {
      server.stop();
    }
  });

  test("an address can't carry a second command", async () => {
    const server = await smtpServer();
    try {
      const { runtime } = rt(`tool Mail : Email(Env.KEY, via: "smtp", host: "127.0.0.1", port: ${server.port}, tls: "none", user: "bot@example.com")\n${SEND}`);
      await expect(runtime.run("Note", { to: "ada@example.com>\r\nRCPT TO:<evil@example.net" })).rejects.toThrow(/is not an email address/);
      expect(server.deliveries).toHaveLength(0);
    } finally {
      server.stop();
    }
  });
});

// ── A mailbox to read ──

const MAILBOX = [
  { uid: 7, flags: ["\\Seen"], raw: buildMessage({ from: "Dana <dana@example.com>", to: ["support@example.com"], subject: "Old question", text: "Answered long ago.", messageId: "m7@example.com", date: new Date("2026-11-01T09:00:00Z") }) },
  { uid: 9, flags: [], raw: buildMessage({ from: "Ada Lovelace <ada@example.com>", to: ["support@example.com"], subject: "Invite never arrived", text: "Hi, the invite never came.\nThanks, Ada", html: "<p>Hi, the invite never came.</p>", messageId: "m9@example.com", date: new Date("2026-11-18T09:00:00Z") }) },
  { uid: 12, flags: [], raw: buildMessage({ from: "grace@example.com", to: ["support@example.com"], subject: "Billing", text: "Charged twice.", messageId: "m12@example.com", date: new Date("2026-11-19T08:00:00Z") }) },
];

function imapServer() {
  const log: string[] = [];
  const box = MAILBOX.map((m) => ({ ...m, flags: [...m.flags] }));
  const server = net.createServer((socket) => {
    let buffer = "";
    socket.on("error", () => {});
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      for (let at = buffer.indexOf("\r\n"); at !== -1; at = buffer.indexOf("\r\n")) {
        const line = buffer.slice(0, at);
        buffer = buffer.slice(at + 2);
        const [tag, ...rest] = line.split(" ");
        const cmd = rest.join(" ");
        log.push(cmd.replace(/^LOGIN .*/, (l) => l));
        const ok = (extra = "") => socket.write(`${extra}${tag} OK done\r\n`);
        if (/^LOGIN /.test(cmd)) cmd.includes('"secret-1"') ? ok() : socket.write(`${tag} NO [AUTHENTICATIONFAILED] Invalid credentials\r\n`);
        else if (/^(EXAMINE|SELECT) /.test(cmd)) cmd.includes('"INBOX"') ? ok(`* ${box.length} EXISTS\r\n* FLAGS (\\Seen)\r\n`) : socket.write(`${tag} NO no such mailbox\r\n`);
        else if (/^UID SEARCH/.test(cmd)) {
          const hits = box.filter((m) => (!cmd.includes("UNSEEN") || !m.flags.includes("\\Seen")) && (!/FROM "([^"]*)"/.test(cmd) || m.raw.toLowerCase().includes(cmd.match(/FROM "([^"]*)"/)![1]!.toLowerCase())));
          ok(`* SEARCH ${hits.map((m) => m.uid).join(" ")}\r\n`);
        } else if (/^UID FETCH/.test(cmd)) {
          const uids = cmd.split(" ")[2]!.split(",").map(Number);
          const headerOnly = cmd.includes("BODY.PEEK[HEADER]");
          let out = "";
          box.filter((m) => uids.includes(m.uid)).forEach((m, i) => {
            const part = headerOnly ? `${m.raw.split("\r\n\r\n")[0]}\r\n\r\n` : m.raw;
            out += `* ${i + 1} FETCH (UID ${m.uid} FLAGS (${m.flags.join(" ")}) RFC822.SIZE ${m.raw.length} BODY[${headerOnly ? "HEADER" : ""}] {${Buffer.byteLength(part)}}\r\n${part})\r\n`;
          });
          ok(out);
        } else if (/^UID STORE/.test(cmd)) {
          const uid = Number(cmd.split(" ")[2]);
          const m = box.find((x) => x.uid === uid)!;
          m.flags = cmd.includes("+FLAGS") ? [...new Set([...m.flags, "\\Seen"])] : m.flags.filter((f) => f !== "\\Seen");
          ok();
        } else if (/^LOGOUT/.test(cmd)) {
          socket.write(`* BYE\r\n${tag} OK bye\r\n`);
          socket.end();
        } else socket.write(`${tag} BAD what\r\n`);
      }
    });
    socket.write("* OK IMAP4rev1 ready\r\n");
  });
  return new Promise<{ port: number; log: string[]; box: typeof box; stop: () => void }>((resolve) => server.listen(0, "127.0.0.1", () => resolve({ port: (server.address() as net.AddressInfo).port, log, box, stop: () => server.close() })));
}

describe("Email over IMAP", () => {
  const inbox = (port: number, key = "Env.KEY") => `tool Inbox : Email(${key}, via: "imap", host: "127.0.0.1", port: ${port}, tls: "none", user: "support@example.com")`;

  test("list gives the newest messages first, and unread narrows it", async () => {
    const server = await imapServer();
    try {
      const { runtime } = rt(`${inbox(server.port)}
pipeline All(n: Number) -> Result:
  n |> Inbox.list(limit: n)
pipeline Unread(who: String) -> Result:
  who |> Inbox.list(unread: true, from: who, full: true)`);
      const all = (await runtime.run("All", { n: 2 })).output as Array<Record<string, unknown>>;
      expect(all.map((m) => [m.id, m.subject, m.unread])).toEqual([["12", "Billing", true], ["9", "Invite never arrived", true]]);
      expect(all[1]).toMatchObject({ from: "ada@example.com", fromName: "Ada Lovelace", to: ["support@example.com"], messageId: "m9@example.com", date: "2026-11-18T09:00:00.000Z" });
      // Headers only, unless full: true.
      expect(all[1]!.text).toBeUndefined();
      const unread = (await runtime.run("Unread", { who: "ada" })).output as Array<Record<string, unknown>>;
      expect(unread).toHaveLength(1);
      expect(unread[0]).toMatchObject({ id: "9", text: "Hi, the invite never came.\nThanks, Ada", html: "<p>Hi, the invite never came.</p>" });
      expect(server.log).toContain('UID SEARCH UNSEEN FROM "ada"');
      // Looking doesn't mark anything read.
      expect(server.log.some((l) => l.startsWith("SELECT"))).toBe(false);
      expect(server.box.find((m) => m.uid === 9)!.flags).toEqual([]);
    } finally {
      server.stop();
    }
  });

  test("read gives one message whole, and mark changes whether it is unread", async () => {
    const server = await imapServer();
    try {
      const { runtime } = rt(`${inbox(server.port)}
pipeline Read(id: String) -> Result:
  id |> Inbox.read(id: id)
pipeline Done(id: String) -> Result:
  id |> Inbox.mark(id: id)`);
      expect((await runtime.run("Read", { id: "12" })).output).toMatchObject({ id: "12", from: "grace@example.com", subject: "Billing", text: "Charged twice.", unread: true, attachments: [] });
      expect((await runtime.run("Done", { id: "12" })).output).toEqual({ id: "12", unread: false });
      expect(server.box.find((m) => m.uid === 12)!.flags).toEqual(["\\Seen"]);
      await expect(runtime.run("Read", { id: "99" })).rejects.toThrow(/there is no message 99/);
    } finally {
      server.stop();
    }
  });

  test("a wrong password says so, and a sending-only tool says it can't read", async () => {
    const server = await imapServer();
    try {
      const wrong = rt(`${inbox(server.port, '"nope"')}\npipeline P(n: Number) -> Result:\n  n |> Inbox.list()`);
      await expect(wrong.runtime.run("P", { n: 1 })).rejects.toThrow(/refused the login: NO \[AUTHENTICATIONFAILED\]/);
      const sender = rt(`tool Inbox : Email(Env.KEY, from: "a@example.com")\npipeline P(n: Number) -> Result:\n  n |> Inbox.list()`);
      await expect(sender.runtime.run("P", { n: 1 })).rejects.toThrow(/resend only sends. To read mail, use via: "imap", "gmail" or "outlook"/);
    } finally {
      server.stop();
    }
  });

  test("an agent can triage a mailbox it is only allowed to read", async () => {
    const server = await imapServer();
    try {
      const { runtime } = rt(
        `${inbox(server.port)}
policy ReadOnly : AllowEffects("read")
agent Triage [openai/gpt-4o] equips Inbox requires ReadOnly
pipeline Sort(x: String) -> Result:
  x |> Triage.sort(tools: [Inbox])`,
        undefined,
        { "Triage.sort": (req: { step?: number; tools?: string[] }) => [[useTool("Inbox.list", { unread: true })], [useTool("Inbox.mark", { id: "9" })], `offered: ${req.tools?.join(",")}`][(req.step ?? 1) - 1] },
      );
      const r = await runtime.run("Sort", { x: "go" });
      // It was offered list and read, not send or mark; the mark it tried anyway was refused.
      expect(r.output).toBe("offered: Inbox.list,Inbox.read");
      expect(server.box.find((m) => m.uid === 9)!.flags).toEqual([]);
    } finally {
      server.stop();
    }
  });

  test("search criteria are quoted, and refuse what IMAP can't carry in a quoted string", () => {
    expect(searchCriteria({})).toBe("ALL");
    expect(searchCriteria({ unseen: true, subject: 'say "hi"', since: new Date("2026-11-05T12:00:00Z") })).toBe('UNSEEN SUBJECT "say \\"hi\\"" SINCE 5-Nov-2026');
    expect(() => searchCriteria({ text: "café" })).toThrow(/plain ASCII/);
  });
});

describe("Email through Gmail", () => {
  test("with an app password it is Gmail's own SMTP and IMAP servers", async () => {
    // No network here: the address it would connect to is what matters.
    const { runtime } = rt(`tool Mail : Email(Env.KEY, via: "gmail")\n${SEND}`);
    await expect(runtime.run("Note", { to: "ada@example.com" })).rejects.toThrow(/needs from:/);
    const noUser = rt(`tool Mail : Email(Env.KEY, via: "gmail", from: "me@gmail.com")\n${SEND}`);
    await expect(noUser.runtime.run("Note", { to: "ada@example.com" })).rejects.toThrow(/needs user:/);
  });

  test("with OAuth it is the Gmail API: a token from the refresh token, then send, list, read and mark", async () => {
    const raw = Buffer.from(MAILBOX[1]!.raw).toString("base64url");
    const { runtime, sent } = rt(
      `tool Mail : Email(Env.KEY, via: "gmail", clientId: Env.CLIENT, clientSecret: "shh", user: "me@gmail.com")
${SEND}
pipeline Unread(n: Number) -> Result:
  n |> Mail.list(unread: true, from: "ada@example.com", since: "2026-11-01", limit: n)
pipeline Read(id: String) -> Result:
  id |> Mail.read(id: id)
pipeline Done(id: String) -> Result:
  id |> Mail.mark(id: id)`,
      (s) => {
        if (s.url.includes("oauth2.googleapis.com")) return Response.json({ access_token: "ya29.token", expires_in: 3600 });
        if (s.url.endsWith("/messages/send")) return Response.json({ id: "18c1" });
        if (s.url.includes("/messages?")) return Response.json({ messages: [{ id: "18a9" }] });
        if (s.url.endsWith("/modify")) return Response.json({ id: "18a9" });
        return Response.json({ id: "18a9", labelIds: ["INBOX", "UNREAD"], snippet: "Hi, the invite never came.", raw });
      },
    );
    expect((await runtime.run("Note", { to: "ada@example.com" })).output).toMatchObject({ sent: true, id: "18c1" });
    expect(sent[0]).toMatchObject({ url: "https://oauth2.googleapis.com/token", method: "POST" });
    expect(String(sent[0]!.body)).toBe("grant_type=refresh_token&refresh_token=secret-1&client_id=client-1&client_secret=shh");
    expect(sent[1]!.headers.authorization).toBe("Bearer ya29.token");
    const mime = parseMessage(Buffer.from(sent[1]!.body.raw, "base64url"));
    expect(mime).toMatchObject({ subject: "You won, félicitations", from: { address: "me@gmail.com" }, to: [{ address: "ada@example.com" }] });

    const listed = (await runtime.run("Unread", { n: 5 })).output as Array<Record<string, unknown>>;
    // The token is reused, not fetched again.
    expect(sent.filter((s) => s.url.includes("oauth2")).length).toBe(1);
    const list = new URL(sent.find((s) => s.url.includes("/messages?"))!.url);
    expect(list.searchParams.get("q")).toBe("is:unread from:(ada@example.com) after:2026/11/1 in:inbox");
    expect(listed[0]).toMatchObject({ id: "18a9", from: "ada@example.com", subject: "Invite never arrived", unread: true, snippet: "Hi, the invite never came." });
    expect(listed[0]!.text).toBeUndefined();
    expect((await runtime.run("Read", { id: "18a9" })).output).toMatchObject({ id: "18a9", text: "Hi, the invite never came.\nThanks, Ada", unread: true });
    expect((await runtime.run("Done", { id: "18a9" })).output).toEqual({ id: "18a9", unread: false });
    expect(sent.at(-1)).toMatchObject({ url: "https://gmail.googleapis.com/gmail/v1/users/me/messages/18a9/modify", body: { removeLabelIds: ["UNREAD"] } });
  });
});

describe("Email through Outlook", () => {
  const OUTLOOK = `tool Mail : Email(Env.KEY, via: "outlook", tenant: Env.TENANT, clientId: Env.CLIENT, user: "support@contoso.example")`;

  test("an app signs in for the mailbox, then sends, lists, reads and marks through Graph", async () => {
    const { runtime, sent } = rt(
      `${OUTLOOK}
${SEND}
pipeline Unread(n: Number) -> Result:
  n |> Mail.list(unread: true, since: "2026-11-01", limit: n)
pipeline Find(q: String) -> Result:
  q |> Mail.list(text: q, from: "ada@example.com")
pipeline Read(id: String) -> Result:
  id |> Mail.read(id: id)
pipeline Done(id: String) -> Result:
  id |> Mail.mark(id: id, read: false)`,
      (s) => {
        if (s.url.includes("login.microsoftonline.com")) return Response.json({ access_token: "eyJ.graph", expires_in: 3600 });
        if (s.url.endsWith("/sendMail")) return new Response(null, { status: 202 });
        if (s.url.endsWith("/$value")) return new Response(MAILBOX[1]!.raw);
        if (s.method === "PATCH") return Response.json({ id: "AAMk1" });
        return Response.json({ value: [{ id: "AAMk1", subject: "Invite never arrived", from: { emailAddress: { address: "ada@example.com", name: "Ada Lovelace" } }, toRecipients: [{ emailAddress: { address: "support@contoso.example" } }], receivedDateTime: "2026-11-18T09:00:00Z", isRead: false, bodyPreview: "Hi, the invite never came.", internetMessageId: "<m9@example.com>" }] });
      },
    );
    expect((await runtime.run("Note", { to: "ada@example.com" })).output).toMatchObject({ sent: true, to: ["ada@example.com"] });
    expect(sent[0]!.url).toBe("https://login.microsoftonline.com/contoso.example/oauth2/v2.0/token");
    expect(String(sent[0]!.body)).toContain("grant_type=client_credentials");
    expect(sent[1]).toMatchObject({
      url: "https://graph.microsoft.com/v1.0/users/support%40contoso.example/sendMail",
      headers: { authorization: "Bearer eyJ.graph" },
      body: { saveToSentItems: true, message: { subject: "You won, félicitations", body: { contentType: "HTML", content: "<p>Well played.</p>" }, toRecipients: [{ emailAddress: { address: "ada@example.com" } }], ccRecipients: [{ emailAddress: { address: "judges@example.com", name: "Judges" } }], bccRecipients: [{ emailAddress: { address: "audit@example.com" } }] } },
    });

    const listed = (await runtime.run("Unread", { n: 5 })).output as Array<Record<string, unknown>>;
    const list = new URL(sent.at(-1)!.url);
    expect(list.pathname).toBe("/v1.0/users/support%40contoso.example/mailFolders/inbox/messages");
    expect(list.searchParams.get("$filter")).toBe("isRead eq false and receivedDateTime ge 2026-11-01T00:00:00.000Z");
    expect(list.searchParams.get("$orderby")).toBe("receivedDateTime desc");
    expect(listed[0]).toMatchObject({ id: "AAMk1", from: "ada@example.com", fromName: "Ada Lovelace", unread: true, snippet: "Hi, the invite never came.", messageId: "m9@example.com" });

    await runtime.run("Find", { q: "invite" });
    const search = new URL(sent.at(-1)!.url);
    expect(search.searchParams.get("$search")).toBe('"from:ada@example.com invite"');
    expect(search.searchParams.has("$orderby")).toBe(false);

    expect((await runtime.run("Read", { id: "AAMk1" })).output).toMatchObject({ id: "AAMk1", text: "Hi, the invite never came.\nThanks, Ada", html: "<p>Hi, the invite never came.</p>" });
    expect((await runtime.run("Done", { id: "AAMk1" })).output).toEqual({ id: "AAMk1", unread: true });
    expect(sent.at(-1)).toMatchObject({ method: "PATCH", body: { isRead: false } });
  });

  test("it says what an app registration is missing", async () => {
    const noUser = rt(`tool Mail : Email(Env.KEY, via: "outlook", tenant: Env.TENANT, clientId: Env.CLIENT)\npipeline P(n: Number) -> Result:\n  n |> Mail.list()`);
    await expect(noUser.runtime.run("P", { n: 1 })).rejects.toThrow(/Outlook as an app needs user:/);
    const nothing = rt(`tool Mail : Email(Env.KEY, via: "outlook")\npipeline P(n: Number) -> Result:\n  n |> Mail.list()`);
    await expect(nothing.runtime.run("P", { n: 1 })).rejects.toThrow(/Outlook needs clientId: and tenant:/);
  });
});

describe("Email through Cloudflare", () => {
  test("it posts to the account's Email Sending API and reports what was delivered", async () => {
    const { runtime, sent } = rt(`tool Mail : Email(Env.KEY, via: "cloudflare", account: Env.ACCOUNT, from: "Prizes <prizes@example.com>", reply_to: "help@example.com")\n${SEND}`, () =>
      Response.json({ success: true, errors: [], result: { delivered: ["ada@example.com"], permanent_bounces: [], queued: ["judges@example.com"] } }),
    );
    expect((await runtime.run("Note", { to: "ada@example.com" })).output).toEqual({ sent: true, to: ["ada@example.com"], delivered: ["ada@example.com"], queued: ["judges@example.com"], bounced: [] });
    expect(sent[0]).toMatchObject({
      url: "https://api.cloudflare.com/client/v4/accounts/acc_9/email/sending/send",
      headers: { authorization: "Bearer secret-1" },
      body: { to: ["ada@example.com"], from: { address: "prizes@example.com", name: "Prizes" }, subject: "You won, félicitations", html: "<p>Well played.</p>", cc: ["judges@example.com"], bcc: ["audit@example.com"], reply_to: "help@example.com" },
    });
  });

  test("a refusal says why, and it needs the account", async () => {
    const refused = rt(`tool Mail : Email(Env.KEY, via: "cloudflare", account: Env.ACCOUNT, from: "a@example.com")\n${SEND}`, () => Response.json({ success: false, errors: [{ code: 1000, message: "Sender domain not verified" }], result: null }, { status: 400 }));
    await expect(refused.runtime.run("Note", { to: "ada@example.com" })).rejects.toThrow(/Cloudflare send failed \(400\).*Sender domain not verified/);
    const none = rt(`tool Mail : Email(Env.KEY, via: "cloudflare", from: "a@example.com")\n${SEND}`);
    await expect(none.runtime.run("Note", { to: "ada@example.com" })).rejects.toThrow(/Cloudflare needs account:/);
  });
});

describe("reading mail as it travels", () => {
  test("quoted-printable, other charsets, nested parts and attachments", () => {
    const raw = [
      "From: =?ISO-8859-1?Q?Jos=E9_Mart=EDnez?= <jose@example.com>",
      'To: "Support, Team" <support@example.com>, other@example.com',
      "Subject: =?UTF-8?B?UHJvYmzDqG1l?= =?UTF-8?Q?_de_facturation?=",
      "Message-ID: <abc@mail.example.com>",
      "In-Reply-To: <prev@example.com>",
      "References: <first@example.com> <prev@example.com>",
      "Date: Wed, 18 Nov 2026 10:00:00 +0100",
      'Content-Type: multipart/mixed; boundary="outer"',
      "",
      "--outer",
      'Content-Type: multipart/alternative; boundary="inner"',
      "",
      "--inner",
      "Content-Type: text/plain; charset=ISO-8859-1",
      "Content-Transfer-Encoding: quoted-printable",
      "",
      "J'ai =E9t=E9 factur=E9 deux fois, et la ligne est tr=E8s longue alors elle =",
      "continue ici.",
      "--inner",
      "Content-Type: text/html; charset=utf-8",
      "Content-Transfer-Encoding: base64",
      "",
      Buffer.from("<p>J'ai été facturé deux fois.</p>").toString("base64"),
      "--inner--",
      "--outer",
      'Content-Type: application/pdf; name="facture.pdf"',
      "Content-Disposition: attachment; filename=\"facture.pdf\"",
      "Content-Transfer-Encoding: base64",
      "",
      Buffer.from("%PDF-1.4 not really").toString("base64"),
      "--outer--",
      "",
    ].join("\r\n");
    const m = parseMessage(raw);
    expect(m).toMatchObject({
      from: { address: "jose@example.com", name: "José Martínez" },
      subject: "Problème de facturation",
      messageId: "abc@mail.example.com",
      inReplyTo: "prev@example.com",
      references: ["first@example.com", "prev@example.com"],
      date: "2026-11-18T09:00:00.000Z",
      text: "J'ai été facturé deux fois, et la ligne est très longue alors elle continue ici.",
      html: "<p>J'ai été facturé deux fois.</p>",
      attachments: [{ filename: "facture.pdf", type: "application/pdf", size: 19 }],
    });
    expect(m.to).toEqual([{ address: "support@example.com", name: "Support, Team" }, { address: "other@example.com" }]);
  });

  test("a message with only HTML still has text, and nonsense doesn't throw", () => {
    const html = parseMessage("From: a@example.com\r\nContent-Type: text/html\r\n\r\n<html><head><style>p{}</style></head><body><p>Hello</p><p>there &amp; you</p></body></html>");
    expect(html.text).toBe("Hello\nthere & you");
    expect(parseMessage("not an email at all").text).toBe("");
    expect(parseMessage(new Uint8Array([0xff, 0xfe, 0x00])).subject).toBe("");
  });
});

describe("mail arriving at a webhook", () => {
  const FLOW = `agent Helper [openai/gpt-4o]
pipeline HandleEmail(email: JSON) -> Result:
  email |> Helper.answer("Answer {{email.subject}} from {{email.from}}: {{email.text}}")
`;

  test("a whole message posted as message/rfc822 starts the pipeline with the mail as its input, once", async () => {
    const dir = mkdtempSync(join(tmp, "app-"));
    await Bun.write(join(dir, "flow.halo"), FLOW);
    const prompts: string[] = [];
    const inputs: any[] = [];
    const s = await startServer({
      files: [join(dir, "flow.halo")],
      port: 0,
      stateDir: join(dir, ".halo"),
      scheduler: false,
      logger: quiet,
      env: {},
      webhooks: [{ path: "inbound-mail", pipeline: "HandleEmail", secret: "hook-secret" }],
      onRuntime: (r) => r.mockAll({ "Helper.answer": (req: { prompt?: string; input: unknown }) => (prompts.push(req.prompt ?? ""), inputs.push(req.input), "answered") }),
    });
    try {
      const deliver = (secret = "hook-secret") =>
        fetch(`${s.url}/hooks/inbound-mail`, { method: "POST", headers: { "Content-Type": "message/rfc822", "X-Halo-Secret": secret, "X-Envelope-From": "bounce@example.com", "X-Envelope-To": "support@example.com" }, body: MAILBOX[1]!.raw });
      expect((await deliver("wrong")).status).toBe(401);
      const first = (await (await deliver()).json()) as { runId: string };
      expect((await s.settled(first.runId))?.output).toBe("answered");
      expect(prompts[0]).toContain("Answer Invite never arrived from ada@example.com: Hi, the invite never came.\nThanks, Ada");
      expect(inputs[0]).toMatchObject({ id: "m9@example.com", fromName: "Ada Lovelace", to: ["support@example.com"], html: "<p>Hi, the invite never came.</p>", envelope: { from: "bounce@example.com", to: "support@example.com" }, headers: { subject: "Invite never arrived" } });
      // The mail route retries a delivery: the same message is the same run.
      expect(await (await deliver()).json()).toMatchObject({ runId: first.runId, duplicate: true });
      expect(prompts).toHaveLength(1);
      const junk = await fetch(`${s.url}/hooks/inbound-mail`, { method: "POST", headers: { "Content-Type": "message/rfc822", "X-Halo-Secret": "hook-secret" }, body: "" });
      expect(junk.status).toBe(400);
    } finally {
      await s.stop();
    }
  });
});
