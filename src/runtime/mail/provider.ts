/**
 * The `Email` tool: send mail, and read a mailbox, through the service `via:` names.
 *
 *   tool Mail : Email(Env.RESEND_API_KEY, from: "bot@example.com")                       Resend (the default)
 *   tool Mail : Email(Env.CLOUDFLARE_API_TOKEN, via: "cloudflare", account: Env.CF_ACCOUNT_ID, from: …)
 *   tool Mail : Email(Env.SMTP_PASSWORD, via: "smtp", host: "smtp.example.com", user: "bot@example.com")
 *   tool Inbox: Email(Env.IMAP_PASSWORD, via: "imap", host: "imap.example.com", user: "support@example.com")
 *   tool Mail : Email(Env.GMAIL_APP_PASSWORD, via: "gmail", user: "me@gmail.com")
 *   tool Mail : Email(Env.MS_CLIENT_SECRET, via: "outlook", tenant: Env.MS_TENANT, clientId: Env.MS_CLIENT_ID, user: "support@contoso.com")
 *
 *   send(to:, subject:, body:, html:, cc:, bcc:, reply_to:, in_reply_to:)   every service
 *   list(unread:, from:, subject:, text:, since:, limit:, folder:, full:)    imap, gmail, outlook (and smtp with imap:)
 *   read(id:)  mark(id:, read:)                                             the same
 */

import { parseDuration } from "../../parser/builtins.js";
import { HaloError, HttpError } from "../errors.js";
import type { ToolCall, ToolProvider, ToolServices } from "../tools.js";
import { ImapError, ImapSession, type ImapSearch } from "./imap.js";
import { buildMessage, parseAddress, parseMessage, validAddress, type ParsedMessage } from "./mime.js";
import { sendSmtp, SmtpError } from "./smtp.js";
import type { Security } from "./wire.js";

export const EMAIL_SERVICES = ["resend", "postmark", "sendgrid", "mailgun", "cloudflare", "smtp", "imap", "gmail", "outlook"] as const;
type Via = (typeof EMAIL_SERVICES)[number];

/** A message as `list` and `read` return it, the same whichever service it came from. */
export interface MailMessage {
  id: string;
  from?: string;
  fromName?: string;
  to: string[];
  cc: string[];
  subject: string;
  date?: string;
  unread?: boolean;
  /** The first lines, when the service gives them or the body was fetched. */
  snippet?: string;
  text?: string;
  html?: string;
  messageId?: string;
  inReplyTo?: string;
  attachments?: Array<{ filename?: string; type: string; size: number }>;
}

const str = (v: unknown): string => (typeof v === "string" ? v : JSON.stringify(v));
const many = (v: unknown): string[] => (v === undefined || v === null || v === "" ? [] : Array.isArray(v) ? v.map(str) : [str(v)]);

function need(call: ToolCall, name: string, value: unknown): string {
  if (value === undefined || value === null || value === "") throw new HaloError(`${call.tool.name}.${call.method} needs ${name}`, { code: "TOOL_ARGUMENT" });
  return str(value);
}

const bad = (call: ToolCall, message: string): never => {
  throw new HaloError(`Tool "${call.tool.name}": ${message}`, { code: "TOOL_CONFIG" });
};

function setting(call: ToolCall, name: string): string | undefined {
  const v = call.config(name);
  return v === undefined || v === null || v === "" ? undefined : str(v);
}

function secret(call: ToolCall, hint: string): string {
  const t = call.config(0) ?? call.config("token") ?? call.config("apiKey");
  if (typeof t !== "string" || !t) throw new HaloError(`Tool "${call.tool.name}" needs ${hint} as its first argument, e.g. Email(Env.${hint.toUpperCase().replace(/[^A-Z]+/g, "_")}, ...)`, { code: "TOOL_CONFIG" });
  return t;
}

async function readJson(res: Response, label: string): Promise<any> {
  const text = await res.text();
  if (!res.ok) throw new HttpError(`${label} failed (${res.status}): ${text.slice(0, 500)}`, res.status, text);
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return text;
  }
}

// ── What a call asks to send ──

interface Outgoing {
  from: string;
  to: string[];
  cc: string[];
  bcc: string[];
  replyTo: string[];
  subject: string;
  text?: string;
  html?: string;
  inReplyTo?: string;
}

function outgoing(call: ToolCall, fromDefault?: string): Outgoing {
  const from = need(call, "from: (here or in the tool declaration)", call.named.from ?? call.config("from") ?? fromDefault);
  const to = many(call.named.to ?? call.config("to"));
  if (!to.length) need(call, "to:", undefined);
  const html = call.named.html === undefined ? undefined : str(call.named.html);
  const plain = call.named.body ?? call.named.text ?? (call.implicitInput ? undefined : call.positional[0]) ?? (html === undefined ? call.positional[0] : undefined);
  const out: Outgoing = {
    from,
    to,
    cc: many(call.named.cc),
    bcc: many(call.named.bcc),
    replyTo: many(call.named.reply_to ?? call.named.replyTo ?? call.config("reply_to") ?? call.config("replyTo")),
    subject: need(call, "subject:", call.named.subject),
    ...(html === undefined || plain !== undefined ? { text: need(call, "body:", plain) } : {}),
    ...(html !== undefined ? { html } : {}),
    ...(call.named.in_reply_to !== undefined ? { inReplyTo: str(call.named.in_reply_to) } : {}),
  };
  // An address is checked before it reaches a mail server, where a line break in one would be a second command.
  for (const a of [out.from, ...out.to, ...out.cc, ...out.bcc, ...out.replyTo]) {
    if (!validAddress(parseAddress(a).address)) throw new HaloError(`${call.tool.name}.${call.method}: "${a.slice(0, 80)}" is not an email address`, { code: "TOOL_ARGUMENT" });
  }
  return out;
}

const bare = (list: string[]) => list.map((a) => parseAddress(a).address);

/** The message as text, for services that take one whole (SMTP, the Gmail API). */
function asMime(call: ToolCall, m: Outgoing): string {
  const domain = parseAddress(m.from).address.split("@")[1] ?? "localhost";
  // The id comes from the call's idempotency key, so the same step sending again sends the same message.
  return buildMessage({ from: m.from, to: m.to, cc: m.cc, replyTo: m.replyTo, subject: m.subject, text: m.text, html: m.html, inReplyTo: m.inReplyTo, messageId: `${call.idempotencyKey ?? crypto.randomUUID()}@${domain}` });
}

// ── Tokens for Gmail and Outlook ──

const tokens = new Map<string, { token: string; until: number }>();

async function oauthToken(services: ToolServices, call: ToolCall, url: string, form: Record<string, string>, label: string): Promise<string> {
  const key = `${url}\n${JSON.stringify(form)}`;
  const cached = tokens.get(key);
  if (cached && cached.until > Date.now() + 60_000) return cached.token;
  const res = await services.fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(form).toString(), signal: call.signal });
  const out = await readJson(res, `${label} sign-in`);
  if (typeof out.access_token !== "string") throw new HaloError(`${label} sign-in for tool "${call.tool.name}" returned no access token`, { code: "TOOL_CONFIG" });
  tokens.set(key, { token: out.access_token, until: Date.now() + (Number(out.expires_in) || 3600) * 1000 });
  return out.access_token;
}

/** How a Gmail tool signs in: an app password (then it is SMTP and IMAP), or OAuth (then the Gmail API). */
function gmailMode(call: ToolCall): "password" | "oauth" {
  return setting(call, "accessToken") || setting(call, "clientId") ? "oauth" : "password";
}

async function gmailToken(call: ToolCall, services: ToolServices): Promise<string> {
  const given = setting(call, "accessToken");
  if (given) return given;
  return oauthToken(
    services,
    call,
    "https://oauth2.googleapis.com/token",
    { grant_type: "refresh_token", refresh_token: secret(call, "a refresh token"), client_id: setting(call, "clientId")!, client_secret: setting(call, "clientSecret") ?? bad(call, "Gmail with clientId also needs clientSecret:") },
    "Google",
  );
}

/** A Graph token and the mailbox it is for: "/me" for a person's token, "/users/<address>" for an app's. */
async function graph(call: ToolCall, services: ToolServices): Promise<{ token: string; base: string }> {
  const user = setting(call, "user");
  const root = "https://graph.microsoft.com/v1.0";
  const given = setting(call, "accessToken");
  if (given) return { token: given, base: user ? `${root}/users/${encodeURIComponent(user)}` : `${root}/me` };
  const clientId = setting(call, "clientId") ?? bad(call, `Outlook needs clientId: and tenant: (an app registration), or accessToken:`);
  const tenant = setting(call, "tenant") ?? "common";
  const url = `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`;
  const refresh = setting(call, "refreshToken");
  if (refresh) {
    const clientSecret: Record<string, string> = typeof call.config(0) === "string" && call.config(0) ? { client_secret: String(call.config(0)) } : {};
    const token = await oauthToken(services, call, url, { grant_type: "refresh_token", refresh_token: refresh, client_id: clientId, ...clientSecret }, "Microsoft");
    return { token, base: `${root}/me` };
  }
  if (!user) bad(call, `Outlook as an app needs user: (the mailbox, e.g. user: "support@contoso.com")`);
  if (tenant === "common") bad(call, "Outlook as an app needs tenant: (your directory's id or domain)");
  const token = await oauthToken(services, call, url, { grant_type: "client_credentials", client_id: clientId, client_secret: secret(call, "the app's client secret"), scope: "https://graph.microsoft.com/.default" }, "Microsoft");
  return { token, base: `${root}/users/${encodeURIComponent(user!)}` };
}

// ── SMTP and IMAP settings ──

function hostPort(text: string, port: number): { host: string; port: number } {
  const m = text.match(/^(.*):(\d+)$/);
  return m ? { host: m[1]!, port: Number(m[2]) } : { host: text, port };
}

function security(call: ToolCall, value: string | undefined): Security | undefined {
  if (value === undefined) return undefined;
  if (value !== "tls" && value !== "starttls" && value !== "none") bad(call, `tls: is "tls", "starttls" or "none" (got "${value}")`);
  return value as Security;
}

function smtpServer(call: ToolCall, via: Via) {
  const verify = call.config("tlsVerify") === false ? false : undefined;
  if (via === "gmail") return { host: "smtp.gmail.com", port: 465, verify };
  if (via === "smtp") {
    const host = setting(call, "host") ?? bad(call, `SMTP needs host:, e.g. Email(Env.SMTP_PASSWORD, via: "smtp", host: "smtp.example.com", user: "bot@example.com")`);
    return { host, port: Number(setting(call, "port") ?? 587), security: security(call, setting(call, "tls")), verify };
  }
  const extra = setting(call, "smtp") ?? bad(call, `to send from an IMAP mailbox, add smtp: "smtp.example.com" (or "host:port")`);
  return { ...hostPort(extra, 587), verify };
}

function imapServer(call: ToolCall, via: Via) {
  const verify = call.config("tlsVerify") === false ? false : undefined;
  if (via === "gmail") return { host: "imap.gmail.com", port: 993, verify };
  if (via === "imap") {
    const host = setting(call, "host") ?? bad(call, `IMAP needs host:, e.g. Email(Env.IMAP_PASSWORD, via: "imap", host: "imap.example.com", user: "support@example.com")`);
    return { host, port: Number(setting(call, "port") ?? 993), security: security(call, setting(call, "tls")), verify };
  }
  const extra = setting(call, "imap") ?? bad(call, `to read mail with this tool, add imap: "imap.example.com" (or "host:port")`);
  return { ...hostPort(extra, 993), verify };
}

function login(call: ToolCall) {
  const user = setting(call, "user") ?? bad(call, "needs user: (the address or name you sign in with)");
  const token = setting(call, "accessToken");
  return token ? { user, accessToken: token } : { user, password: secret(call, "a password") };
}

// ── Sending ──

async function send(call: ToolCall, via: Via, services: ToolServices): Promise<unknown> {
  const { fetch } = services;
  const key = call.idempotencyKey;
  const post = async (label: string, url: string, headers: Record<string, string>, body: string | FormData) => {
    const res = await fetch(url, { method: "POST", headers, body, signal: call.signal });
    return { res, out: await readJson(res, `${label} send`) };
  };
  const m = outgoing(call, via === "smtp" || via === "imap" || via === "gmail" || via === "outlook" ? setting(call, "user") : undefined);
  const to = m.to;

  if (via === "resend") {
    const body = { from: m.from, to, subject: m.subject, ...(m.text !== undefined ? { text: m.text } : {}), ...(m.html !== undefined ? { html: m.html } : {}), ...(m.cc.length ? { cc: m.cc } : {}), ...(m.bcc.length ? { bcc: m.bcc } : {}), ...(m.replyTo.length ? { reply_to: m.replyTo } : {}) };
    const { out } = await post("Resend", "https://api.resend.com/emails", { Authorization: `Bearer ${secret(call, "a Resend API key")}`, "Content-Type": "application/json", ...(key ? { "Idempotency-Key": key } : {}) }, JSON.stringify(body));
    return { sent: true, id: out.id, to };
  }
  if (via === "postmark") {
    const body = { From: m.from, To: to.join(","), Subject: m.subject, TextBody: m.text, HtmlBody: m.html, Cc: m.cc.join(",") || undefined, Bcc: m.bcc.join(",") || undefined, ReplyTo: m.replyTo.join(",") || undefined, MessageStream: call.config("stream") ?? undefined };
    const { out } = await post("Postmark", "https://api.postmarkapp.com/email", { "X-Postmark-Server-Token": secret(call, "a Postmark server token"), "Content-Type": "application/json", Accept: "application/json" }, JSON.stringify(body));
    return { sent: true, id: out.MessageID, to };
  }
  if (via === "sendgrid") {
    const addr = (list: string[]) => bare(list).map((email) => ({ email }));
    const sender = parseAddress(m.from);
    const body = {
      personalizations: [{ to: addr(to), ...(m.cc.length ? { cc: addr(m.cc) } : {}), ...(m.bcc.length ? { bcc: addr(m.bcc) } : {}) }],
      from: sender.name ? { email: sender.address, name: sender.name } : { email: sender.address },
      ...(m.replyTo.length ? { reply_to: { email: bare(m.replyTo)[0] } } : {}),
      subject: m.subject,
      content: [...(m.text !== undefined ? [{ type: "text/plain", value: m.text }] : []), ...(m.html !== undefined ? [{ type: "text/html", value: m.html }] : [])],
    };
    const { res } = await post("SendGrid", "https://api.sendgrid.com/v3/mail/send", { Authorization: `Bearer ${secret(call, "a SendGrid API key")}`, "Content-Type": "application/json" }, JSON.stringify(body));
    return { sent: true, id: res.headers.get("x-message-id") ?? undefined, to };
  }
  if (via === "mailgun") {
    const domain = setting(call, "domain") ?? bad(call, `Mailgun needs domain: "mg.example.com" on the declaration`);
    const form = new FormData();
    form.set("from", m.from);
    for (const [name, list] of [["to", to], ["cc", m.cc], ["bcc", m.bcc]] as const) for (const a of list) form.append(name, a);
    form.set("subject", m.subject);
    if (m.text !== undefined) form.set("text", m.text);
    if (m.html !== undefined) form.set("html", m.html);
    if (m.replyTo.length) form.set("h:Reply-To", m.replyTo.join(","));
    const base = (setting(call, "apiUrl") ?? "https://api.mailgun.net").replace(/\/+$/, "");
    const { out } = await post("Mailgun", `${base}/v3/${encodeURIComponent(domain)}/messages`, { Authorization: `Basic ${btoa(`api:${secret(call, "a Mailgun API key")}`)}` }, form);
    return { sent: true, id: out.id, to };
  }
  if (via === "cloudflare") {
    const account = setting(call, "account") ?? bad(call, `Cloudflare needs account: (your account id, e.g. account: Env.CLOUDFLARE_ACCOUNT_ID)`);
    const sender = parseAddress(m.from);
    const body = {
      to: bare(to),
      from: sender.name ? { address: sender.address, name: sender.name } : sender.address,
      subject: m.subject,
      ...(m.text !== undefined ? { text: m.text } : {}),
      ...(m.html !== undefined ? { html: m.html } : {}),
      ...(m.cc.length ? { cc: bare(m.cc) } : {}),
      ...(m.bcc.length ? { bcc: bare(m.bcc) } : {}),
      ...(m.replyTo.length ? { reply_to: bare(m.replyTo)[0] } : {}),
      ...(m.inReplyTo ? { headers: { "In-Reply-To": `<${m.inReplyTo.replace(/[<>\s]/g, "")}>` } } : {}),
    };
    const { out } = await post("Cloudflare", `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(account)}/email/sending/send`, { Authorization: `Bearer ${secret(call, "a Cloudflare API token")}`, "Content-Type": "application/json" }, JSON.stringify(body));
    if (out?.success === false) throw new HaloError(`Cloudflare send failed: ${(out.errors ?? []).map((e: { message?: string }) => e.message).join("; ") || "no reason given"}`, { code: "TOOL_ERROR" });
    const r = out?.result ?? {};
    return { sent: true, to, delivered: r.delivered ?? [], queued: r.queued ?? [], bounced: r.permanent_bounces ?? [] };
  }
  if (via === "outlook") {
    const g = await graph(call, services);
    const people = (list: string[]) => list.map((a) => ({ emailAddress: parseAddress(a) }));
    const message = {
      subject: m.subject,
      // Graph takes one body: the HTML one when there is one.
      body: m.html !== undefined ? { contentType: "HTML", content: m.html } : { contentType: "Text", content: m.text ?? "" },
      toRecipients: people(to),
      ...(m.cc.length ? { ccRecipients: people(m.cc) } : {}),
      ...(m.bcc.length ? { bccRecipients: people(m.bcc) } : {}),
      ...(m.replyTo.length ? { replyTo: people(m.replyTo) } : {}),
    };
    await post("Outlook", `${g.base}/sendMail`, { Authorization: `Bearer ${g.token}`, "Content-Type": "application/json" }, JSON.stringify({ message, saveToSentItems: true }));
    return { sent: true, to };
  }
  if (via === "gmail" && gmailMode(call) === "oauth") {
    const raw = Buffer.from(asMime(call, m)).toString("base64url");
    const { out } = await post("Gmail", "https://gmail.googleapis.com/gmail/v1/users/me/messages/send", { Authorization: `Bearer ${await gmailToken(call, services)}`, "Content-Type": "application/json" }, JSON.stringify({ raw }));
    return { sent: true, id: out.id, to };
  }
  // SMTP: a server of your own, an IMAP mailbox's outgoing server, or Gmail with an app password.
  const mime = asMime(call, m);
  try {
    const { response } = await sendSmtp({ ...smtpServer(call, via), ...login(call), signal: call.signal }, parseAddress(m.from).address, bare([...to, ...m.cc, ...m.bcc]), mime);
    return { sent: true, id: mime.match(/^Message-ID: <([^>]+)>/m)?.[1], to, response };
  } catch (err) {
    if (err instanceof SmtpError) throw new HaloError(`${call.tool.name}.${call.method}: ${err.message}`, { code: "TOOL_ERROR", retryable: err.temporary });
    throw err;
  }
}

// ── Reading ──

function fromParsed(id: string, p: ParsedMessage, extra: Partial<MailMessage> = {}, body = true): MailMessage {
  const snippet = p.text.replace(/\s+/g, " ").trim().slice(0, 200);
  return {
    id,
    from: p.from?.address,
    ...(p.from?.name ? { fromName: p.from.name } : {}),
    to: p.to.map((a) => a.address),
    cc: p.cc.map((a) => a.address),
    subject: p.subject,
    date: p.date,
    ...extra,
    ...(body ? { ...(snippet ? { snippet } : {}), text: p.text, ...(p.html !== undefined ? { html: p.html } : {}), attachments: p.attachments } : {}),
    messageId: p.messageId,
    ...(p.inReplyTo ? { inReplyTo: p.inReplyTo } : {}),
  };
}

/**
 * A message that was posted whole (a mail route handing it to a webhook), as a pipeline's
 * input: the same fields `read` returns, plus every header, and the envelope when the
 * sender of the request passed it along.
 */
export function mailFromRaw(raw: Uint8Array, envelope: { from?: string; to?: string } = {}): MailMessage & { headers: Record<string, string>; envelope?: { from?: string; to?: string } } {
  const parsed = parseMessage(raw);
  const id = parsed.messageId ?? crypto.randomUUID();
  return { ...fromParsed(id, parsed), headers: parsed.headers, ...(envelope.from || envelope.to ? { envelope } : {}) };
}

interface Query extends ImapSearch {
  limit: number;
  folder?: string;
  full: boolean;
}

function query(call: ToolCall): Query {
  const n = call.named;
  const flag = (v: unknown) => v === true || v === "true";
  let since: Date | undefined;
  if (n.since !== undefined && n.since !== "") {
    const text = str(n.since);
    const ms = parseDuration(text);
    since = ms > 0 ? new Date(Date.now() - ms) : new Date(text);
    if (Number.isNaN(since.getTime())) throw new HaloError(`${call.tool.name}.${call.method}: since: is a date ("2026-11-01") or how far back ("24h", "7d"), not "${text}"`, { code: "TOOL_ARGUMENT" });
  }
  const limit = Math.min(50, Math.max(1, Number(n.limit ?? 10) || 10));
  return {
    unseen: flag(n.unread ?? n.unseen) || call.method === "unread",
    ...(n.from ? { from: str(n.from) } : {}),
    ...(n.subject ? { subject: str(n.subject) } : {}),
    ...(n.text ?? n.query ? { text: str(n.text ?? n.query) } : {}),
    ...(since ? { since } : {}),
    limit,
    ...(n.folder ?? n.mailbox ? { folder: str(n.folder ?? n.mailbox) } : {}),
    full: flag(n.full),
  };
}

async function withImap<T>(call: ToolCall, via: Via, work: (s: ImapSession) => Promise<T>): Promise<T> {
  let session: ImapSession | undefined;
  try {
    session = await ImapSession.open({ ...imapServer(call, via), ...login(call), signal: call.signal });
    return await work(session);
  } catch (err) {
    if (err instanceof ImapError) throw new HaloError(`${call.tool.name}.${call.method}: ${err.message}`, { code: "TOOL_ERROR" });
    throw err;
  } finally {
    await session?.close();
  }
}

const READ_METHODS = ["list", "search", "inbox", "unread", "read", "get", "mark"];

async function mailbox(call: ToolCall, via: Via, services: ToolServices): Promise<unknown> {
  const { fetch } = services;
  const method = call.method === "get" ? "read" : ["search", "inbox", "unread"].includes(call.method) ? "list" : call.method;
  const id = () => need(call, "id: (a message's id, from list)", call.named.id ?? (call.implicitInput ? undefined : call.positional[0]));
  const markRead = () => !(call.named.read === false || call.named.read === "false" || call.named.unread === true);

  if (via === "outlook") {
    const g = await graph(call, services);
    const auth = { Authorization: `Bearer ${g.token}` };
    if (method === "mark") {
      const res = await fetch(`${g.base}/messages/${encodeURIComponent(id())}`, { method: "PATCH", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({ isRead: markRead() }), signal: call.signal });
      await readJson(res, "Outlook mark");
      return { id: id(), unread: !markRead() };
    }
    if (method === "read") {
      // The message as it travelled, so its text, HTML and attachments are read the same way as everywhere else.
      const res = await fetch(`${g.base}/messages/${encodeURIComponent(id())}/$value`, { headers: auth, signal: call.signal });
      if (!res.ok) await readJson(res, "Outlook read");
      return fromParsed(id(), parseMessage(new Uint8Array(await res.arrayBuffer())));
    }
    const q = query(call);
    const url = new URL(`${g.base}/mailFolders/${encodeURIComponent(q.folder ?? "inbox")}/messages`);
    url.searchParams.set("$top", String(q.limit));
    url.searchParams.set("$select", "id,subject,from,toRecipients,ccRecipients,receivedDateTime,isRead,bodyPreview,internetMessageId");
    const words = [q.from ? `from:${q.from}` : "", q.subject ? `subject:${q.subject}` : "", q.text ?? ""].filter(Boolean);
    const filters = [q.unseen ? "isRead eq false" : "", q.since ? `receivedDateTime ge ${q.since.toISOString()}` : ""].filter(Boolean);
    // Graph searches or filters, not both; a search comes back most relevant first.
    if (words.length) url.searchParams.set("$search", `"${[...words, q.unseen ? "isread:false" : ""].filter(Boolean).join(" ").replace(/"/g, "")}"`);
    else {
      if (filters.length) url.searchParams.set("$filter", filters.join(" and "));
      url.searchParams.set("$orderby", "receivedDateTime desc");
    }
    const out = await readJson(await fetch(url, { headers: { ...auth, ...(words.length ? { ConsistencyLevel: "eventual" } : {}) }, signal: call.signal }), "Outlook list");
    const people = (list: unknown) => (Array.isArray(list) ? list.map((r) => String(r?.emailAddress?.address ?? "")).filter(Boolean) : []);
    const listed: MailMessage[] = (out.value ?? []).map((v: any) => ({
      id: String(v.id),
      from: v.from?.emailAddress?.address,
      ...(v.from?.emailAddress?.name ? { fromName: v.from.emailAddress.name } : {}),
      to: people(v.toRecipients),
      cc: people(v.ccRecipients),
      subject: v.subject ?? "",
      date: v.receivedDateTime,
      unread: v.isRead === false,
      snippet: v.bodyPreview,
      messageId: String(v.internetMessageId ?? "").replace(/^<|>$/g, "") || undefined,
    }));
    return listed;
  }

  if (via === "gmail" && gmailMode(call) === "oauth") {
    const auth = { Authorization: `Bearer ${await gmailToken(call, services)}` };
    const root = "https://gmail.googleapis.com/gmail/v1/users/me/messages";
    const one = async (messageId: string, whole: boolean): Promise<MailMessage> => {
      const out = await readJson(await fetch(`${root}/${encodeURIComponent(messageId)}?format=raw`, { headers: auth, signal: call.signal }), "Gmail read");
      const parsed = parseMessage(new Uint8Array(Buffer.from(String(out.raw ?? ""), "base64url")));
      return fromParsed(String(out.id ?? messageId), parsed, { unread: Array.isArray(out.labelIds) && out.labelIds.includes("UNREAD"), ...(out.snippet && !whole ? { snippet: String(out.snippet) } : {}) }, whole);
    };
    if (method === "mark") {
      const res = await fetch(`${root}/${encodeURIComponent(id())}/modify`, { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify(markRead() ? { removeLabelIds: ["UNREAD"] } : { addLabelIds: ["UNREAD"] }), signal: call.signal });
      await readJson(res, "Gmail mark");
      return { id: id(), unread: !markRead() };
    }
    if (method === "read") return one(id(), true);
    const q = query(call);
    const day = (d: Date) => `${d.getUTCFullYear()}/${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
    const terms = [q.unseen ? "is:unread" : "", q.from ? `from:(${q.from})` : "", q.subject ? `subject:(${q.subject})` : "", q.since ? `after:${day(q.since)}` : "", q.text ?? "", q.folder ? `in:${q.folder}` : "in:inbox"].filter(Boolean);
    const url = new URL(root);
    url.searchParams.set("maxResults", String(q.limit));
    url.searchParams.set("q", terms.join(" "));
    const found = await readJson(await fetch(url, { headers: auth, signal: call.signal }), "Gmail list");
    const ids: string[] = (found.messages ?? []).map((x: { id: string }) => x.id);
    return Promise.all(ids.map((messageId) => one(messageId, q.full)));
  }

  // IMAP: a mailbox of your own, or Gmail with an app password.
  return withImap(call, via, async (s) => {
    if (method === "mark") {
      await s.select(str(call.named.folder ?? call.named.mailbox ?? "INBOX"), true);
      await s.setSeen([Number(id())], markRead());
      return { id: id(), unread: !markRead() };
    }
    if (method === "read") {
      await s.select(str(call.named.folder ?? call.named.mailbox ?? "INBOX"));
      const uid = Number(id());
      if (!Number.isInteger(uid) || uid <= 0) throw new HaloError(`${call.tool.name}.read: id: is the number list gave the message, not "${id()}"`, { code: "TOOL_ARGUMENT" });
      const [found] = await s.fetch([uid], true);
      if (!found) throw new HaloError(`${call.tool.name}.read: there is no message ${uid} in that folder`, { code: "TOOL_ERROR" });
      return fromParsed(String(found.uid), parseMessage(found.raw), { unread: !found.flags.includes("\\Seen") });
    }
    const q = query(call);
    await s.select(q.folder ?? "INBOX");
    // The newest ones, newest first.
    const uids = (await s.search(q)).slice(-q.limit);
    const messages = await s.fetch(uids, q.full);
    return messages.reverse().map((x) => fromParsed(String(x.uid), parseMessage(x.raw), { unread: !x.flags.includes("\\Seen") }, q.full));
  });
}

export const email: ToolProvider = async (call, services) => {
  const via = String(call.config("via") ?? "resend").toLowerCase() as Via;
  if (!EMAIL_SERVICES.includes(via)) throw new HaloError(`Tool "${call.tool.name}": via: "${via}" is not an email service Halo knows (${EMAIL_SERVICES.join(", ")})`, { code: "TOOL_CONFIG" });
  if (["send", "email", "execute", "notify", "reply"].includes(call.method)) {
    if (via === "imap" && !setting(call, "smtp")) bad(call, `an IMAP mailbox reads mail; to send from it too, add smtp: "smtp.example.com"`);
    return send(call, via, services);
  }
  if (READ_METHODS.includes(call.method)) {
    const reads = via === "imap" || via === "gmail" || via === "outlook" || (via === "smtp" && !!setting(call, "imap"));
    if (!reads) bad(call, `${via} only sends. To read mail, use via: "imap", "gmail" or "outlook"${via === "smtp" ? `, or add imap: "imap.example.com"` : ""}`);
    return mailbox(call, via, services);
  }
  throw new HaloError(`Email tool "${call.tool.name}" has no method "${call.method}" (use send, list, read, mark)`, { code: "TOOL_METHOD" });
};
