/** A small SMTP client: enough to hand one message to a mail server, with TLS and a login. */

import { isLoopback, Wire, type Security } from "./wire.js";

export interface SmtpOptions {
  host: string;
  port?: number;
  /** "tls" (port 465), "starttls" (587 and 25), or "none". Default: by port. */
  security?: Security;
  verify?: boolean;
  user?: string;
  password?: string;
  /** An OAuth access token for `user`, sent as XOAUTH2. */
  accessToken?: string;
  /** The name this client gives itself. */
  name?: string;
  signal?: AbortSignal;
}

export class SmtpError extends Error {
  constructor(message: string, readonly code: number) {
    super(message);
  }
  /** 4xx: the server may take it later. */
  get temporary() {
    return this.code >= 400 && this.code < 500;
  }
}

export const xoauth2 = (user: string, token: string) => Buffer.from(`user=${user}\x01auth=Bearer ${token}\x01\x01`).toString("base64");

/** Send `data` (a whole message, CRLF lines) from `from` to each of `recipients`. Returns the server's last word. */
export async function sendSmtp(options: SmtpOptions, from: string, recipients: string[], data: string): Promise<{ response: string }> {
  const port = options.port ?? 587;
  const security: Security = options.security ?? (port === 465 ? "tls" : "starttls");
  const where = `${options.host}:${port}`;
  const wire = await Wire.open({ host: options.host, port, tls: security === "tls", verify: options.verify, signal: options.signal });
  const reply = async (): Promise<{ code: number; lines: string[] }> => {
    const lines: string[] = [];
    for (;;) {
      const line = await wire.line();
      lines.push(line.slice(4));
      if (line[3] !== "-") return { code: Number(line.slice(0, 3)), lines };
    }
  };
  const expect = async (want: number, doing: string) => {
    const r = await reply();
    if (Math.floor(r.code / 100) !== Math.floor(want / 100)) throw new SmtpError(`${where} refused ${doing}: ${r.code} ${r.lines.join(" ")}`.trim(), r.code);
    return r;
  };
  const command = async (line: string, want: number, doing: string) => {
    await wire.write(`${line}\r\n`);
    return expect(want, doing);
  };
  try {
    await expect(220, "the connection");
    const name = options.name ?? "halo.local";
    let features = (await command(`EHLO ${name}`, 250, "EHLO")).lines.map((l) => l.toUpperCase());
    if (security === "starttls") {
      if (!features.some((f) => f.startsWith("STARTTLS"))) throw new SmtpError(`${where} doesn't offer STARTTLS, so the message would travel unencrypted. Use port 465, or tls: "none" for a relay on this machine`, 0);
      await command("STARTTLS", 220, "STARTTLS");
      await wire.secure();
      features = (await command(`EHLO ${name}`, 250, "EHLO")).lines.map((l) => l.toUpperCase());
    }
    if (options.user && (options.password || options.accessToken)) {
      // A password in the clear is only ever sent to this machine.
      if (!wire.encrypted && !isLoopback(options.host)) throw new SmtpError(`Not sending a password to ${where} without TLS`, 0);
      const methods = features.find((f) => f.startsWith("AUTH"))?.split(/[ =]+/).slice(1) ?? [];
      if (options.accessToken) {
        await command(`AUTH XOAUTH2 ${xoauth2(options.user, options.accessToken)}`, 235, "the login");
      } else if (methods.includes("PLAIN") || !methods.includes("LOGIN")) {
        await command(`AUTH PLAIN ${Buffer.from(`\0${options.user}\0${options.password}`).toString("base64")}`, 235, "the login");
      } else {
        await command("AUTH LOGIN", 334, "the login");
        await command(Buffer.from(options.user).toString("base64"), 334, "the login");
        await command(Buffer.from(options.password!).toString("base64"), 235, "the login");
      }
    }
    await command(`MAIL FROM:<${from}>`, 250, `the sender ${from}`);
    for (const to of recipients) await command(`RCPT TO:<${to}>`, 250, `the recipient ${to}`);
    await command("DATA", 354, "the message");
    // A line that is only a dot would end the message early, so lines that start with one get another.
    const body = data.replace(/\r?\n/g, "\r\n").replace(/^\./gm, "..");
    await wire.write(`${body}${body.endsWith("\r\n") ? "" : "\r\n"}.\r\n`);
    const done = await expect(250, "the message");
    await wire.write("QUIT\r\n").catch(() => {});
    return { response: done.lines.join(" ") };
  } finally {
    wire.close();
  }
}
