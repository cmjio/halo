/**
 * Email messages as text: building one to send (over SMTP, or to the Gmail API), and reading
 * one that arrived (from IMAP, the Gmail and Outlook APIs, or a mail route that posts it).
 */

import { MediaBytes, sniff } from "../media.js";

export interface Address {
  address: string;
  name?: string;
}

export interface OutgoingMessage {
  from: string;
  to: string[];
  cc?: string[];
  replyTo?: string[];
  subject: string;
  text?: string;
  html?: string;
  messageId?: string;
  inReplyTo?: string;
  headers?: Record<string, string>;
  date?: Date;
}

export interface ParsedMessage {
  messageId?: string;
  from?: Address;
  to: Address[];
  cc: Address[];
  replyTo: Address[];
  subject: string;
  date?: string;
  inReplyTo?: string;
  references: string[];
  text: string;
  html?: string;
  /** `file`: the bytes of an attachment Halo can read (an image, PDF, Word, PowerPoint or text file), which a run stores and a model can be sent. */
  attachments: Array<{ filename?: string; type: string; size: number; file?: MediaBytes }>;
  /** Every header, by lower-case name (the last one wins when a name repeats). */
  headers: Record<string, string>;
}

const ASCII = /^[\x20-\x7e]*$/;
const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");

/** A header value that isn't plain ASCII, as RFC 2047 encoded words that each fit on a line. */
function encodeWord(text: string): string {
  if (ASCII.test(text)) return text;
  const words: string[] = [];
  let chunk = "";
  for (const ch of text) {
    if (Buffer.byteLength(chunk + ch, "utf8") > 39) {
      words.push(chunk);
      chunk = "";
    }
    chunk += ch;
  }
  if (chunk) words.push(chunk);
  return words.map((w) => `=?UTF-8?B?${b64(w)}?=`).join("\r\n ");
}

/** "Ada <ada@example.com>" or "ada@example.com", split. */
export function parseAddress(text: string): Address {
  const m = text.match(/^\s*(.*?)\s*<([^<>]+)>\s*$/);
  if (!m) return { address: text.trim() };
  const name = m[1]!.replace(/^"(.*)"$/, "$1").replace(/\\(.)/g, "$1").trim();
  return { address: m[2]!.trim(), ...(name ? { name } : {}) };
}

/** Whether a string can be used as an address: no line breaks or brackets to smuggle a second one in. */
export function validAddress(address: string): boolean {
  return /^[^\s<>@,;:"\\()[\]]+@[^\s<>@,;:"\\()[\]]+\.[^\s<>@,;:"\\()[\]]+$/.test(address) && address.length <= 254;
}

function formatAddress(text: string): string {
  const { address, name } = parseAddress(text);
  if (!name) return address;
  return ASCII.test(name) ? `"${name.replace(/(["\\])/g, "\\$1")}" <${address}>` : `${encodeWord(name)} <${address}>`;
}

const wrap76 = (s: string) => s.replace(/(.{76})/g, "$1\r\n").replace(/\r\n$/, "");

function bodyPart(type: string, content: string): string {
  return `Content-Type: ${type}; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${wrap76(b64(content))}\r\n`;
}

/** A header's value with anything that could start another header taken out. */
const oneLine = (s: string) => s.replace(/[\r\n]+\s*/g, " ").trim();

/** An RFC 5322 message, with CRLF line ends. Bcc recipients are never written into it. */
export function buildMessage(m: OutgoingMessage): string {
  const lines: string[] = [];
  const header = (name: string, value: string | undefined) => value !== undefined && value !== "" && lines.push(`${name}: ${value}`);
  header("From", formatAddress(oneLine(m.from)));
  header("To", m.to.map((a) => formatAddress(oneLine(a))).join(", "));
  header("Cc", m.cc?.length ? m.cc.map((a) => formatAddress(oneLine(a))).join(", ") : undefined);
  header("Reply-To", m.replyTo?.length ? m.replyTo.map((a) => formatAddress(oneLine(a))).join(", ") : undefined);
  header("Subject", encodeWord(oneLine(m.subject)));
  header("Date", (m.date ?? new Date()).toUTCString().replace("GMT", "+0000"));
  header("Message-ID", m.messageId ? `<${m.messageId.replace(/[<>\s]/g, "")}>` : undefined);
  header("In-Reply-To", m.inReplyTo ? `<${m.inReplyTo.replace(/[<>\s]/g, "")}>` : undefined);
  header("References", m.inReplyTo ? `<${m.inReplyTo.replace(/[<>\s]/g, "")}>` : undefined);
  for (const [name, value] of Object.entries(m.headers ?? {})) {
    if (!/^[A-Za-z0-9-]+$/.test(name)) throw new Error(`"${name}" is not a header name`);
    header(name, encodeWord(oneLine(String(value))));
  }
  header("MIME-Version", "1.0");
  const text = m.text ?? "";
  if (m.html === undefined) return `${lines.join("\r\n")}\r\n${bodyPart("text/plain", text)}`;
  if (m.text === undefined) return `${lines.join("\r\n")}\r\n${bodyPart("text/html", m.html)}`;
  const boundary = `halo-${crypto.randomUUID().replace(/-/g, "")}`;
  return `${lines.join("\r\n")}\r\nContent-Type: multipart/alternative; boundary="${boundary}"\r\n\r\n--${boundary}\r\n${bodyPart("text/plain", text)}--${boundary}\r\n${bodyPart("text/html", m.html)}--${boundary}--\r\n`;
}

// ── Reading ──

/** Bytes as a string with one character per byte, so nothing is decoded before its charset is known. */
const binary = (raw: Uint8Array | string) => (typeof raw === "string" ? Buffer.from(raw, "utf8").toString("latin1") : Buffer.from(raw).toString("latin1"));

function decodeBytes(bytes: Buffer, charset: string | undefined): string {
  try {
    const label = (charset ?? "utf-8").trim().toLowerCase();
    return new TextDecoder((label === "us-ascii" ? "utf-8" : label) as ConstructorParameters<typeof TextDecoder>[0]).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

const fromQuotedPrintable = (s: string, underscore = false) =>
  Buffer.from((underscore ? s.replace(/_/g, " ") : s.replace(/=\r?\n/g, "")).replace(/=([0-9A-Fa-f]{2})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16))), "latin1");

/** A header value with its RFC 2047 encoded words read. `value` is a binary string. */
function decodeHeader(value: string): string {
  const joined = value.replace(/(\?=)\s+(=\?)/g, "$1$2");
  const out = joined.replace(/=\?([^?]+)\?([bBqQ])\?([^?]*)\?=/g, (_, charset: string, enc: string, data: string) => {
    const bytes = enc.toLowerCase() === "b" ? Buffer.from(data, "base64") : fromQuotedPrintable(data, true);
    return `\u0000${Buffer.from(decodeBytes(bytes, charset.split("*")[0]), "utf8").toString("latin1")}\u0000`;
  });
  // What wasn't an encoded word is read as UTF-8 (raw UTF-8 headers are common, if not strictly allowed).
  return Buffer.from(out.replace(/\u0000/g, ""), "latin1").toString("utf8");
}

interface Entity {
  headers: Map<string, string>;
  body: string;
}

function splitEntity(raw: string): Entity {
  const at = raw.search(/\r?\n\r?\n/);
  const head = at === -1 ? raw : raw.slice(0, at);
  const body = at === -1 ? "" : raw.slice(at).replace(/^\r?\n\r?\n/, "");
  const headers = new Map<string, string>();
  for (const line of head.replace(/\r?\n[ \t]+/g, " ").split(/\r?\n/)) {
    const colon = line.indexOf(":");
    if (colon > 0) headers.set(line.slice(0, colon).trim().toLowerCase(), line.slice(colon + 1).trim());
  }
  return { headers, body };
}

/** `text/plain; charset="utf-8"; name=x` → ["text/plain", { charset: "utf-8", name: "x" }] */
function params(value: string | undefined): [string, Record<string, string>] {
  const [type = "", ...rest] = (value ?? "").split(";");
  const out: Record<string, string> = {};
  for (const p of rest) {
    const eq = p.indexOf("=");
    if (eq > 0) out[p.slice(0, eq).trim().toLowerCase().replace(/\*$/, "")] = p.slice(eq + 1).trim().replace(/^"(.*)"$/, "$1");
  }
  return [type.trim().toLowerCase(), out];
}

function addresses(value: string | undefined): Address[] {
  if (!value) return [];
  // Commas inside a quoted name don't separate addresses.
  const parts = value.match(/(?:"(?:[^"\\]|\\.)*"|[^,])+/g) ?? [];
  return parts.map((p) => parseAddress(decodeHeader(p))).filter((a) => a.address.includes("@"));
}

function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Read a message as it travels (RFC 5322 with MIME). Never throws: a part it can't read is skipped. */
export function parseMessage(raw: Uint8Array | string): ParsedMessage {
  const top = splitEntity(binary(raw));
  const out: ParsedMessage = { to: [], cc: [], replyTo: [], subject: "", references: [], text: "", attachments: [], headers: {} };
  for (const [name, value] of top.headers) out.headers[name] = decodeHeader(value);
  const id = (v: string | undefined) => v?.match(/<([^<>]+)>/)?.[1] ?? (v?.trim() || undefined);
  out.messageId = id(top.headers.get("message-id"));
  out.inReplyTo = id(top.headers.get("in-reply-to"));
  out.references = [...(top.headers.get("references") ?? "").matchAll(/<([^<>]+)>/g)].map((m) => m[1]!);
  out.from = addresses(top.headers.get("from"))[0];
  out.to = addresses(top.headers.get("to"));
  out.cc = addresses(top.headers.get("cc"));
  out.replyTo = addresses(top.headers.get("reply-to"));
  out.subject = out.headers.subject ?? "";
  const when = Date.parse(top.headers.get("date") ?? "");
  if (Number.isFinite(when)) out.date = new Date(when).toISOString();

  const texts: string[] = [];
  const htmls: string[] = [];
  const walk = (e: Entity, depth: number) => {
    const [type, p] = params(e.headers.get("content-type") ?? "text/plain");
    if (type.startsWith("multipart/") && p.boundary && depth < 20) {
      const pieces = e.body.split(new RegExp(`(?:^|\\r?\\n)--${p.boundary.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:--)?[ \\t]*(?:\\r?\\n|$)`));
      for (const piece of pieces.slice(1)) if (piece.trim()) walk(splitEntity(piece), depth + 1);
      return;
    }
    const encoding = (e.headers.get("content-transfer-encoding") ?? "").trim().toLowerCase();
    const bytes = encoding === "base64" ? Buffer.from(e.body.replace(/\s+/g, ""), "base64") : encoding === "quoted-printable" ? fromQuotedPrintable(e.body) : Buffer.from(e.body, "latin1");
    const [disposition, dp] = params(e.headers.get("content-disposition"));
    const filename = dp.filename ?? p.name;
    if (type === "message/rfc822" && depth < 20 && disposition !== "attachment") return walk(splitEntity(bytes.toString("latin1")), depth + 1);
    if (disposition === "attachment" || filename || !type.startsWith("text/")) {
      const name = filename ? decodeHeader(filename) : undefined;
      // Attachments Halo can read (images, PDFs, Word, PowerPoint, text) keep their bytes, so a pipeline can show them to a model; others are described only.
      const file = sniff(bytes) ? new MediaBytes(new Uint8Array(bytes), { name }) : undefined;
      out.attachments.push({ ...(name ? { filename: name } : {}), type: type || "application/octet-stream", size: bytes.length, ...(file ? { file } : {}) });
      return;
    }
    const text = decodeBytes(bytes, p.charset).replace(/\r\n/g, "\n");
    if (type === "text/html") htmls.push(text);
    else texts.push(text);
  };
  try {
    walk(top, 0);
  } catch {}
  if (htmls.length) out.html = htmls.join("\n");
  out.text = (texts.length ? texts.join("\n") : out.html ? htmlToText(out.html) : "").trim();
  return out;
}
