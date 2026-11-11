/** Responses, errors, hashing and the edge cache: shared by the API and the pages. */

import type { ApiError } from "../../../src/registry/contract.ts";
import { edgeCache, type Env } from "./env.ts";

/** Thrown anywhere in a handler; becomes an ApiError response. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly problems?: string[],
    readonly headers?: Record<string, string>,
  ) {
    super(message);
  }
}

export const fail = (status: number, code: string, message: string, problems?: string[], headers?: Record<string, string>): never => {
  throw new HttpError(status, code, message, problems, headers);
};

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", ...headers } });
}

export function errorResponse(e: HttpError): Response {
  const body: ApiError = { error: e.message, code: e.code, ...(e.problems?.length ? { problems: e.problems } : {}) };
  return json(body, e.status, e.headers);
}

export const CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, HEAD, OPTIONS",
  "access-control-allow-headers": "content-type, if-none-match",
  "access-control-max-age": "86400",
};

export function withHeaders(res: Response, headers: Record<string, string>): Response {
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(headers)) out.headers.set(k, v);
  return out;
}

/** Parse a JSON request body as an object, or fail with 400. */
export async function readJson(req: Request, maxBytes = 64 * 1024): Promise<Record<string, unknown>> {
  const bytes = await readCapped(req, maxBytes);
  try {
    const value: unknown = JSON.parse(new TextDecoder().decode(bytes) || "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value as Record<string, unknown>;
  } catch {
    return fail(400, "bad_json", "The request body must be a JSON object");
  }
}

/** Read a request body, failing with 413 as soon as it passes `maxBytes` (never buffers more). */
export async function readCapped(req: Request, maxBytes: number): Promise<Uint8Array> {
  const declared = Number(req.headers.get("content-length") ?? "NaN");
  if (declared > maxBytes) fail(413, "too_large", `The body is over ${maxBytes} bytes`);
  if (!req.body) return new Uint8Array();
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      fail(413, "too_large", `The body is over ${maxBytes} bytes`);
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.byteLength;
  }
  return out;
}

export async function sha256Hex(data: Uint8Array | string): Promise<string> {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const digest = await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function base64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function randomToken(bytes = 32): string {
  return base64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

/** Strict base64 → bytes, or undefined when it isn't base64. */
export function fromBase64(text: string): Uint8Array | undefined {
  if (typeof text !== "string" || !/^[A-Za-z0-9+/]*={0,2}$/.test(text)) return undefined;
  try {
    const bin = atob(text);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return undefined;
  }
}

export const now = () => new Date().toISOString();

// ── Edge cache ──
//
// Cached responses are keyed by their URL under PUBLIC_URL, whatever host served them, so a
// write can purge exactly the keys it affects.

export const DOC_TTL = 60;

export function cacheKey(env: Env, path: string): string {
  return `${env.PUBLIC_URL.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

/** Serve `path` from the edge cache, or build it, cache it (on 200) and return it. */
export async function cached(env: Env, path: string, build: () => Promise<Response>, ttl = DOC_TTL): Promise<Response> {
  const cache = edgeCache();
  const key = cacheKey(env, path);
  if (cache) {
    const hit = await cache.match(key);
    if (hit) return hit;
  }
  const res = await build();
  if (res.status !== 200) return res;
  res.headers.set("cache-control", `public, max-age=${ttl}`);
  if (cache) await cache.put(key, res.clone() as Response);
  return res;
}

export async function purge(env: Env, paths: string[]): Promise<void> {
  const cache = edgeCache();
  if (!cache) return;
  await Promise.all(paths.map((p) => cache.delete(cacheKey(env, p))));
}

/** Apply the Rate Limiting binding; skipped when it isn't bound (local tests). */
export async function rateLimit(env: Env, action: string, key: string): Promise<void> {
  if (!env.RATE_LIMITER) return;
  const { success } = await env.RATE_LIMITER.limit({ key: `${action}:${key}` });
  if (!success) fail(429, "rate_limited", `Too many ${action} requests; try again in a minute`, undefined, { "retry-after": "60" });
}

export const clientIp = (req: Request) => req.headers.get("cf-connecting-ip") ?? "local";
