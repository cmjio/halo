/** A small IMAP client: log in, pick a mailbox, search it, fetch messages, and mark them read. */

import { xoauth2 } from "./smtp.js";
import { isLoopback, Wire, type Security } from "./wire.js";

export interface ImapOptions {
  host: string;
  port?: number;
  /** "tls" (port 993), "starttls" (143), or "none". Default: by port. */
  security?: Security;
  verify?: boolean;
  user: string;
  password?: string;
  accessToken?: string;
  signal?: AbortSignal;
}

export interface ImapSearch {
  unseen?: boolean;
  from?: string;
  subject?: string;
  text?: string;
  /** Messages received on or after this day. */
  since?: Date;
}

export interface ImapMessage {
  uid: number;
  flags: string[];
  size?: number;
  /** The headers alone, or the whole message, as asked. */
  raw: Buffer;
}

export class ImapError extends Error {}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function quoted(value: string, what: string): string {
  if (!/^[\x20-\x7e]*$/.test(value)) throw new ImapError(`IMAP search: ${what} must be plain ASCII (got "${value.slice(0, 40)}")`);
  return `"${value.replace(/(["\\])/g, "\\$1")}"`;
}

export function searchCriteria(q: ImapSearch): string {
  const parts: string[] = [];
  if (q.unseen) parts.push("UNSEEN");
  if (q.from) parts.push(`FROM ${quoted(q.from, "from")}`);
  if (q.subject) parts.push(`SUBJECT ${quoted(q.subject, "subject")}`);
  if (q.text) parts.push(`TEXT ${quoted(q.text, "text")}`);
  if (q.since) parts.push(`SINCE ${q.since.getUTCDate()}-${MONTHS[q.since.getUTCMonth()]}-${q.since.getUTCFullYear()}`);
  return parts.length ? parts.join(" ") : "ALL";
}

export class ImapSession {
  private tag = 0;
  private constructor(private wire: Wire, private where: string) {}

  static async open(options: ImapOptions): Promise<ImapSession> {
    const port = options.port ?? 993;
    const security: Security = options.security ?? (port === 143 ? "starttls" : "tls");
    const where = `${options.host}:${port}`;
    const wire = await Wire.open({ host: options.host, port, tls: security === "tls", verify: options.verify, signal: options.signal });
    const session = new ImapSession(wire, where);
    try {
      const hello = await wire.line();
      if (!/^\* (OK|PREAUTH)/i.test(hello)) throw new ImapError(`${where} is not an IMAP server (it said "${hello.slice(0, 80)}")`);
      if (security === "starttls") {
        await session.command("STARTTLS");
        await wire.secure();
      }
      if (!wire.encrypted && !isLoopback(options.host)) throw new ImapError(`Not sending a password to ${where} without TLS`);
      if (options.accessToken) await session.command(`AUTHENTICATE XOAUTH2 ${xoauth2(options.user, options.accessToken)}`, "the login");
      else await session.command(`LOGIN ${quotedAny(options.user)} ${quotedAny(options.password ?? "")}`, "the login");
      return session;
    } catch (err) {
      wire.close();
      throw err;
    }
  }

  /**
   * Send a command and collect what comes back until its tagged reply. Each untagged
   * response is one entry: its text, with any literals ({n} followed by n bytes) set aside.
   */
  private async command(text: string, doing = text.split(" ")[0]!): Promise<Array<{ text: string; literals: Buffer[] }>> {
    const tag = `H${++this.tag}`;
    await this.wire.write(`${tag} ${text}\r\n`);
    const out: Array<{ text: string; literals: Buffer[] }> = [];
    for (;;) {
      let line = await this.wire.line();
      const literals: Buffer[] = [];
      // A line that ends in {n} goes on with n bytes and then the rest of the line.
      for (let m = line.match(/\{(\d+)\}$/); m; m = line.match(/\{(\d+)\}$/)) {
        literals.push(await this.wire.bytes(Number(m[1])));
        line = `${line.slice(0, m.index)}\u0000${await this.wire.line()}`;
      }
      if (line.startsWith(`${tag} `)) {
        const status = line.slice(tag.length + 1);
        if (!/^OK/i.test(status)) throw new ImapError(`${this.where} refused ${doing}: ${status}`);
        return out;
      }
      if (line.startsWith("+")) {
        // The server wants more (a rejected XOAUTH2 explains itself this way): an empty line ends it.
        await this.wire.write("\r\n");
        continue;
      }
      out.push({ text: line, literals });
    }
  }

  /** Open a mailbox; read-only unless `write`. Returns how many messages it holds. */
  async select(mailbox: string, write = false): Promise<number> {
    const lines = await this.command(`${write ? "SELECT" : "EXAMINE"} ${quotedAny(mailbox)}`, `the mailbox ${mailbox}`);
    return Number(lines.map((l) => l.text.match(/^\* (\d+) EXISTS/i)?.[1]).find(Boolean) ?? 0);
  }

  /** The UIDs that match, oldest first. */
  async search(query: ImapSearch): Promise<number[]> {
    const lines = await this.command(`UID SEARCH ${searchCriteria(query)}`, "the search");
    const found = lines.flatMap((l) => (/^\* SEARCH/i.test(l.text) ? l.text.slice(8).trim().split(/\s+/).filter(Boolean).map(Number) : []));
    return found.filter(Number.isFinite).sort((a, b) => a - b);
  }

  /** Fetch messages by UID without marking them read: their headers, or all of each. */
  async fetch(uids: number[], whole: boolean): Promise<ImapMessage[]> {
    if (!uids.length) return [];
    const lines = await this.command(`UID FETCH ${uids.join(",")} (UID FLAGS RFC822.SIZE BODY.PEEK[${whole ? "" : "HEADER"}])`, "the fetch");
    const out: ImapMessage[] = [];
    for (const l of lines) {
      if (!/^\* \d+ FETCH/i.test(l.text) || !l.literals.length) continue;
      const uid = Number(l.text.match(/\bUID (\d+)/i)?.[1]);
      if (!Number.isFinite(uid)) continue;
      const size = l.text.match(/RFC822\.SIZE (\d+)/i)?.[1];
      out.push({ uid, flags: l.text.match(/FLAGS \(([^)]*)\)/i)?.[1]?.split(/\s+/).filter(Boolean) ?? [], ...(size ? { size: Number(size) } : {}), raw: l.literals[0]! });
    }
    return out.sort((a, b) => a.uid - b.uid);
  }

  /** Mark messages read or unread (the mailbox must be open for writing). */
  async setSeen(uids: number[], seen: boolean): Promise<void> {
    if (uids.length) await this.command(`UID STORE ${uids.join(",")} ${seen ? "+" : "-"}FLAGS.SILENT (\\Seen)`, "the change");
  }

  async close(): Promise<void> {
    await this.command("LOGOUT").catch(() => {});
    this.wire.close();
  }
}

/** A string as an IMAP quoted string (used where the server, not a search, reads it). */
function quotedAny(value: string): string {
  if (/[\r\n]/.test(value)) throw new ImapError("A line break can't be part of a login or a mailbox name");
  return `"${value.replace(/(["\\])/g, "\\$1")}"`;
}
