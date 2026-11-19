/**
 * Text messages through Twilio.
 *
 *   tool Text : SMS(twilio, account: Env.TWILIO_ACCOUNT_SID, token: Env.TWILIO_AUTH_TOKEN, from: "+15550100")
 *   |> Text.send(to: "+15550123", text: "Your claim is approved.")
 *
 * Incoming messages arrive at a webhook declared with `"twilio": "Env.TWILIO_AUTH_TOKEN"` in
 * halo.json (see src/serve/server.ts): its signature is checked, and pictures sent with the
 * message become files of the run.
 */

import { createHmac } from "node:crypto";
import { HaloError, HttpError } from "../errors.js";
import { MediaBytes, fetchMedia } from "../media.js";
import type { ProviderInfo, ToolProvider } from "../tools.js";

const E164 = /^\+[1-9]\d{6,14}$/;

/**
 * Twilio's request signature: base64 HMAC-SHA1, keyed with the auth token, of the URL it
 * called followed by each form field's name and value, sorted by name.
 */
export function twilioSignature(token: string, url: string, params: URLSearchParams): string {
  const sorted = [...params.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return createHmac("sha1", token).update(url + sorted.map(([k, v]) => k + v).join("")).digest("base64");
}

export interface IncomingText {
  from: string;
  to: string;
  text: string;
  /** Pictures (and other files Halo reads) sent with the message. */
  media: MediaBytes[];
  /** Twilio's own fields, as it sent them (MessageSid, AccountSid, FromCity, ...). */
  twilio: Record<string, string>;
}

/** An incoming message as a pipeline gets it, with its pictures fetched from Twilio. */
export async function incomingText(params: URLSearchParams, o: { token: string; fetch: typeof fetch; signal?: AbortSignal; lookup?: (host: string) => Promise<string[]> }): Promise<IncomingText> {
  const fields = Object.fromEntries(params);
  const media: MediaBytes[] = [];
  const count = Math.min(Number(fields.NumMedia ?? 0) || 0, 10);
  for (let i = 0; i < count; i++) {
    const at = fields[`MediaUrl${i}`];
    if (!at) continue;
    // Twilio's media links redirect to its file store; the account's key is sent only to Twilio itself.
    const got = await fetchMedia(at, { fetch: o.fetch, signal: o.signal, lookup: o.lookup, redirects: 3, auth: fields.AccountSid ? { host: "api.twilio.com", header: `Basic ${btoa(`${fields.AccountSid}:${o.token}`)}` } : undefined });
    media.push(new MediaBytes(got.bytes, { name: `message-${i + 1}` }));
  }
  return { from: fields.From ?? "", to: fields.To ?? "", text: fields.Body ?? "", media, twilio: fields };
}

/** A reply in TwiML, Twilio's answer format: the text to send back, or nothing. */
export function twiml(reply?: string): string {
  const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${reply ? `<Message>${escape(reply)}</Message>` : ""}</Response>`;
}

export const SMS_INFO: ProviderInfo = {
  description: "Text messages (SMS) through Twilio. SMS(twilio, account:, token:, from:).",
  methods: [
    {
      name: "send",
      description: "Send a text message. Returns { sid, status, to }.",
      params: { type: "object", properties: { to: { type: "string", description: "The number, with its country code: +15550123" }, text: { type: "string", description: "The message" } }, required: ["to", "text"] },
      effect: "external",
    },
  ],
};

export const smsProvider: ToolProvider = async (call, services) => {
  if (call.method !== "send") throw new HaloError(`${call.tool.name} has no method "${call.method}" (use send)`, { code: "TOOL_METHOD" });
  const service = call.config(0) ?? "twilio";
  if (service !== "twilio") throw new HaloError(`Tool "${call.tool.name}": SMS(${String(service)}) isn't supported; use SMS(twilio)`, { code: "TOOL_CONFIG" });
  const env = services.env ?? Bun.env;
  const text = (v: unknown) => (typeof v === "string" && v ? v : undefined);
  const account = text(call.config("account")) ?? env.TWILIO_ACCOUNT_SID;
  const token = text(call.config("token")) ?? env.TWILIO_AUTH_TOKEN;
  const from = text(call.config("from")) ?? text(call.named.from);
  if (!account || !token) throw new HaloError(`Tool "${call.tool.name}" needs account: and token: (or TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN)`, { code: "NO_API_KEY" });
  if (!from) throw new HaloError(`Tool "${call.tool.name}" needs from: the Twilio number it sends from`, { code: "TOOL_CONFIG" });
  const to = text(call.named.to ?? call.positional[0]);
  const body = text(call.named.text ?? call.named.body ?? call.positional[1]);
  if (!to || !E164.test(to)) throw new HaloError(`${call.tool.name}.send: to must be a number with its country code, like +15550123 (got ${JSON.stringify(to ?? "")})`, { code: "TOOL_ARGUMENT" });
  if (!body) throw new HaloError(`${call.tool.name}.send needs text:`, { code: "TOOL_ARGUMENT" });
  const base = (text(call.config("baseUrl")) ?? "https://api.twilio.com").replace(/\/+$/, "");
  const res = await services.fetch(`${base}/2010-04-01/Accounts/${encodeURIComponent(account)}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${btoa(`${account}:${token}`)}` },
    body: new URLSearchParams({ To: to, From: from, Body: body }),
    signal: call.signal,
  });
  const raw = await res.text();
  if (!res.ok) throw new HttpError(`${call.tool.name}.send failed (${res.status}): ${raw.slice(0, 300)}`, res.status, raw);
  const sent = JSON.parse(raw) as { sid?: string; status?: string; to?: string };
  return { sid: sent.sid, status: sent.status, to: sent.to ?? to };
};
