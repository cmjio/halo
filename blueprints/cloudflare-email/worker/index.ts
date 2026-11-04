// The Cloudflare half of the app:
//   email()  Email Routing hands every message for your address to this Worker. It is parsed
//            and stored in the Inbox Durable Object, whose alarm asks Halo for a draft.
//   fetch()  Serves the review page that the reviewer's link opens. Nothing else is public:
//            Halo's API is only reachable from the Inbox, inside Cloudflare.
import { Container } from "@cloudflare/containers";
import PostalMime from "postal-mime";
import { Inbox, sign, type Email } from "./inbox";

export { Inbox };

export interface Env {
  HALO: DurableObjectNamespace<HaloContainer>;
  INBOX: DurableObjectNamespace<Inbox>;
  EMAIL: SendEmail;
  // vars (wrangler.jsonc)
  SUPPORT_FROM: string;
  SUPPORT_NAME: string;
  REVIEWER_EMAIL: string;
  PUBLIC_URL: string;
  // secrets (wrangler secret put)
  ANTHROPIC_API_KEY: string;
  HALO_SERVE_TOKEN: string;
  REVIEW_SECRET: string;
}

/** `halo serve` running pipelines/email.halo, built from the Dockerfile. */
export class HaloContainer extends Container<Env> {
  override defaultPort = 8080;
  // Sleeps when idle. That wipes its disk, which holds nothing that needs to outlive it.
  override sleepAfter = "10m";
  override pingEndpoint = "localhost/healthz";

  constructor(ctx: DurableObjectState<{}>, env: Env) {
    super(ctx, env);
    this.envVars = { ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY, HALO_SERVE_TOKEN: env.HALO_SERVE_TOKEN };
  }
}

/** Emails larger than this are left for a person (they are mostly attachments). */
const MAX_BYTES = 5 * 1024 * 1024;

const inbox = (env: Env) => env.INBOX.get(env.INBOX.idFromName("inbox"));

export default {
  async email(message, env) {
    // Don't answer robots: auto-replies, bounces and mailing lists (and so never loop with one).
    const auto = message.headers.get("auto-submitted");
    if ((auto && auto !== "no") || message.headers.get("list-id") || message.from === env.SUPPORT_FROM) return;
    if (message.rawSize > MAX_BYTES) return message.setReject("Message too large");

    // message.raw can be read only once.
    const parsed = await PostalMime.parse(await new Response(message.raw).arrayBuffer());
    const body = (parsed.text ?? htmlToText(parsed.html ?? "")).trim().slice(0, 20_000);
    await inbox(env).receive({
      // The envelope sender: checked by Email Routing (SPF/DKIM/DMARC), unlike the From: header.
      sender: message.from,
      senderName: parsed.from?.name ?? "",
      subject: parsed.subject ?? "(no subject)",
      body,
      // A retried delivery has the same Message-ID, so it is stored (and answered) once.
      messageId: parsed.messageId ?? message.headers.get("message-id") ?? crypto.randomUUID(),
    });
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/healthz") return Response.json({ ok: true });

    const match = url.pathname.match(/^\/review\/([\w-]+)$/);
    if (!match) return new Response("Not found", { status: 404 });
    const id = match[1]!;
    if (!(await validSignature(env, id, url.searchParams.get("sig") ?? ""))) return new Response("This link isn't valid.", { status: 403 });

    const box = inbox(env);
    if (request.method === "POST") {
      const form = await request.formData();
      const action = form.get("action") === "send" ? "send" : "discard";
      const result = await box.decide(id, action, String(form.get("reply") ?? ""));
      const email = await box.get(id);
      return page(email ? review(email, url, result) : `<p>${escape(result.message)}</p>`, result.ok ? 200 : 409);
    }
    const email = await box.get(id);
    return email ? page(review(email, url)) : new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;

async function validSignature(env: Env, id: string, sig: string): Promise<boolean> {
  const expected = await sign(env.REVIEW_SECRET, id);
  if (sig.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

// ── The review page ─────

function review(email: Email, url: URL, result?: { ok: boolean; message: string }): string {
  const triage = email.triage ? (JSON.parse(email.triage) as Record<string, unknown>) : {};
  const open = email.status === "review" || email.status === "failed";
  const facts = [triage.urgency, triage.category, triage.summary].filter(Boolean).map((f) => escape(String(f))).join(" · ");
  return `
    <h1>${escape(email.subject)}</h1>
    <p class="meta">From ${escape(email.sender_name ? `${email.sender_name} <${email.sender}>` : email.sender)} · ${new Date(email.received_at).toUTCString()}</p>
    ${facts ? `<p class="meta">${facts}</p>` : ""}
    ${result ? `<p class="${result.ok ? "ok" : "bad"}">${escape(result.message)}</p>` : ""}
    ${email.error && open ? `<p class="bad">${escape(email.error)}</p>` : ""}
    ${email.note && open ? `<p class="note">${escape(email.note)}</p>` : ""}
    <h2>They wrote</h2>
    <pre>${escape(email.body)}</pre>
    <h2>${open ? "Reply" : `Reply (${email.status})`}</h2>
    ${
      open
        ? `<form method="post" action="${escape(url.pathname + url.search)}">
             <textarea name="reply" rows="14">${escape(email.draft ?? "")}</textarea>
             <div class="actions">
               <button name="action" value="send">Send to ${escape(email.sender)}</button>
               <button name="action" value="discard" class="secondary">Discard</button>
             </div>
           </form>`
        : `<pre>${escape(email.draft ?? "")}</pre>`
    }`;
}

function page(body: string, status = 200): Response {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Review reply</title><style>
:root{color-scheme:light dark;--fg:#1b1b1f;--muted:#6b6b76;--bg:#fff;--line:#d9d9e0;--accent:#f38020}
@media (prefers-color-scheme:dark){:root{--fg:#ececf1;--muted:#9a9aa6;--bg:#16161a;--line:#33333b}}
body{font:16px/1.5 system-ui,sans-serif;color:var(--fg);background:var(--bg);max-width:720px;margin:0 auto;padding:24px 16px}
h1{font-size:1.4rem;margin:0 0 4px}h2{font-size:1rem;margin:24px 0 8px}.meta{color:var(--muted);margin:0 0 4px}
pre{white-space:pre-wrap;border:1px solid var(--line);border-radius:8px;padding:12px;font:inherit}
textarea{width:100%;box-sizing:border-box;font:inherit;padding:12px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--fg)}
.actions{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}button{font:inherit;padding:8px 16px;border-radius:8px;border:0;background:var(--accent);color:#fff;cursor:pointer}
button.secondary{background:transparent;color:var(--fg);border:1px solid var(--line)}.ok{color:#2e7d32}.bad{color:#c62828}.note{border-left:3px solid var(--accent);padding-left:8px}
</style></head><body>${body}</body></html>`;
  return new Response(html, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>|<\/(p|div|li|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
