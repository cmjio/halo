// The inbox: every email, its draft and what the reviewer decided, kept in this Durable
// Object's SQLite storage. It survives deploys and the container sleeping, so nothing that
// matters lives on the container's disk.
import { DurableObject } from "cloudflare:workers";
import { getContainer } from "@cloudflare/containers";
import type { Env } from "./index";

export type Status = "new" | "review" | "sending" | "sent" | "discarded" | "spam" | "failed";

// A type, not an interface: sql.exec<T> needs an index signature.
export type Email = {
  id: string;
  received_at: number;
  sender: string;
  sender_name: string;
  subject: string;
  body: string;
  message_id: string;
  status: Status;
  /** Halo's triage, as JSON. */
  triage: string | null;
  draft: string | null;
  note: string | null;
  attempts: number;
  next_try: number;
  error: string | null;
};

export interface Incoming {
  sender: string;
  senderName: string;
  subject: string;
  body: string;
  messageId: string;
}

interface DraftRun {
  status?: string;
  error?: string;
  output?: {
    triage?: { category?: string; urgency?: string; summary?: string };
    draft?: { reply?: string; sources?: string[]; covered?: boolean; note_for_reviewer?: string };
  };
}

/** Tries to reach Halo before giving up on an email (the container may be starting). */
const MAX_ATTEMPTS = 4;
/** Emails drafted per alarm; the rest wait for the next one. */
const BATCH = 5;

export class Inbox extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS emails (
      id TEXT PRIMARY KEY,
      received_at INTEGER NOT NULL,
      sender TEXT NOT NULL,
      sender_name TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      message_id TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'new',
      triage TEXT,
      draft TEXT,
      note TEXT,
      attempts INTEGER NOT NULL DEFAULT 0,
      next_try INTEGER NOT NULL DEFAULT 0,
      error TEXT
    )`);
  }

  /** Stores a new email and wakes the alarm. False when this Message-ID was already seen. */
  async receive(mail: Incoming): Promise<boolean> {
    const now = Date.now();
    const written = this.ctx.storage.sql.exec(
      `INSERT OR IGNORE INTO emails (id, received_at, sender, sender_name, subject, body, message_id, next_try)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      crypto.randomUUID(), now, mail.sender, mail.senderName, mail.subject, mail.body, mail.messageId, now,
    ).rowsWritten;
    if (written === 0) return false;
    if ((await this.ctx.storage.getAlarm()) === null) await this.ctx.storage.setAlarm(now);
    return true;
  }

  get(id: string): Email | null {
    return this.ctx.storage.sql.exec<Email>(`SELECT * FROM emails WHERE id = ?`, id).toArray()[0] ?? null;
  }

  /** Drafts waiting emails, then sets the alarm for the next one that is due. */
  override async alarm(): Promise<void> {
    const due = this.ctx.storage.sql
      .exec<Email>(`SELECT * FROM emails WHERE status = 'new' AND next_try <= ? ORDER BY received_at LIMIT ?`, Date.now(), BATCH)
      .toArray();
    for (const email of due) await this.draft(email);
    const next = this.ctx.storage.sql.exec<{ t: number | null }>(`SELECT MIN(next_try) AS t FROM emails WHERE status = 'new'`).one().t;
    if (next !== null) await this.ctx.storage.setAlarm(Math.max(next, Date.now()));
  }

  /** Asks Halo for a triage and a draft, and tells the reviewer it is ready. */
  private async draft(email: Email): Promise<void> {
    let run: DraftRun;
    try {
      // localhost: halo serve only accepts its own host names. The container starts on the first call.
      const res = await getContainer(this.env.HALO).fetch(
        new Request("http://localhost/api/pipelines/DraftReply/runs", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.env.HALO_SERVE_TOKEN}` },
          body: JSON.stringify({
            args: { email: { from: email.sender, name: email.sender_name, subject: email.subject, text: email.body } },
            wait: true,
          }),
        }),
      );
      run = (await res.json()) as DraftRun;
      if (!res.ok) throw new Error(run.error ?? `Halo answered ${res.status}`);
    } catch (err) {
      // Halo couldn't be reached: try again later, with backoff.
      const attempts = email.attempts + 1;
      const error = err instanceof Error ? err.message : String(err);
      if (attempts < MAX_ATTEMPTS) {
        this.ctx.storage.sql.exec(`UPDATE emails SET attempts = ?, next_try = ?, error = ? WHERE id = ?`, attempts, Date.now() + 30_000 * 2 ** attempts, error, email.id);
        return;
      }
      return this.fail(email, `Halo couldn't be reached: ${error}`);
    }

    // A halted run is spam (the pipeline's gate). Nothing is drafted or sent.
    if (run.status === "halted") {
      this.ctx.storage.sql.exec(`UPDATE emails SET status = 'spam', error = NULL WHERE id = ?`, email.id);
      return;
    }
    const reply = run.output?.draft?.reply;
    // An "error" run already had Halo's own retries; a policy (such as the injection check) may have stopped it.
    if (run.status !== "completed" || !reply) return this.fail(email, `DraftReply ended as "${run.status}" without a draft`);

    const triage = run.output?.triage ?? {};
    const draft = run.output?.draft ?? {};
    const note = [draft.covered === false ? "The help articles don't fully cover this." : "", draft.note_for_reviewer ?? ""].filter(Boolean).join(" ");
    this.ctx.storage.sql.exec(
      `UPDATE emails SET status = 'review', triage = ?, draft = ?, note = ?, error = NULL WHERE id = ?`,
      JSON.stringify(triage), reply, note || null, email.id,
    );
    await this.tellReviewer(
      email,
      `[${triage.urgency ?? "normal"}] ${triage.category ?? "email"} from ${email.sender}: ${email.subject}`,
      `${triage.summary ?? ""}\n\n${note ? `Note: ${note}\n\n` : ""}Review the draft, edit it, and send or discard it:\n${await this.reviewLink(email.id)}`,
    );
  }

  /** Records a failure and asks the reviewer to answer by hand. */
  private async fail(email: Email, error: string): Promise<void> {
    this.ctx.storage.sql.exec(`UPDATE emails SET status = 'failed', error = ? WHERE id = ?`, error, email.id);
    await this.tellReviewer(email, `Answer by hand: ${email.subject}`, `No draft for the email from ${email.sender}.\n${error}\n\n${await this.reviewLink(email.id)}`);
  }

  /** The reviewer's decision: send the (possibly edited) reply, or discard it. Each email is answered once. */
  async decide(id: string, action: "send" | "discard", reply: string): Promise<{ ok: boolean; message: string }> {
    const email = this.get(id);
    if (!email) return { ok: false, message: "No such email." };
    if (email.status !== "review" && email.status !== "failed") return { ok: false, message: `This email is already ${email.status}.` };
    if (action === "discard") {
      this.ctx.storage.sql.exec(`UPDATE emails SET status = 'discarded' WHERE id = ?`, id);
      return { ok: true, message: "Discarded. Nothing was sent." };
    }
    if (!reply.trim()) return { ok: false, message: "The reply is empty." };

    // Claim it before sending, so a double click can't send twice.
    this.ctx.storage.sql.exec(`UPDATE emails SET status = 'sending' WHERE id = ?`, id);
    try {
      await this.env.EMAIL.send({
        to: email.sender,
        from: { email: this.env.SUPPORT_FROM, name: this.env.SUPPORT_NAME },
        subject: /^re:/i.test(email.subject) ? email.subject : `Re: ${email.subject}`,
        text: reply,
        // Threads the reply under the customer's email in their mail client.
        ...(email.message_id.startsWith("<") ? { headers: { "In-Reply-To": email.message_id, References: email.message_id } } : {}),
      });
    } catch (err) {
      this.ctx.storage.sql.exec(`UPDATE emails SET status = ? WHERE id = ?`, email.status, id);
      return { ok: false, message: `Sending failed: ${err instanceof Error ? err.message : String(err)}` };
    }
    this.ctx.storage.sql.exec(`UPDATE emails SET status = 'sent', draft = ? WHERE id = ?`, reply, id);
    return { ok: true, message: `Sent to ${email.sender}.` };
  }

  private async tellReviewer(email: Email, subject: string, text: string): Promise<void> {
    await this.env.EMAIL.send({
      to: this.env.REVIEWER_EMAIL,
      from: { email: this.env.SUPPORT_FROM, name: `${this.env.SUPPORT_NAME} (drafts)` },
      subject,
      text: `${text}\n\n--- The customer wrote ---\n${email.body.slice(0, 2000)}`,
    });
  }

  private async reviewLink(id: string): Promise<string> {
    return `${this.env.PUBLIC_URL.replace(/\/+$/, "")}/review/${id}?sig=${await sign(this.env.REVIEW_SECRET, id)}`;
  }
}

/** HMAC-SHA256 of an email id, hex: the review link's signature. */
export async function sign(secret: string, id: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(id));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
