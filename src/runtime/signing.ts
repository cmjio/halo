/**
 * How Halo signs what it sends to your app (run callbacks from `halo serve`, and `Handoff`
 * tools), and how your app checks it.
 *
 * The request carries `Halo-Signature: t=<unix seconds>,v1=<hex>`, where the hex is
 * HMAC-SHA256 over `<t>.<raw body>` with the secret you configured. Check it against the
 * body exactly as received, and refuse a timestamp more than a few minutes old.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export const SIGNATURE_HEADER = "Halo-Signature";

export function signBody(secret: string, body: string, at = Date.now()): string {
  const t = Math.floor(at / 1000);
  return `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")}`;
}

/** Whether `header` is a signature of `body` made with `secret` within `toleranceSeconds` of now. */
export function verifySignature(secret: string, body: string, header: string | null | undefined, toleranceSeconds = 300, now = Date.now()): boolean {
  const parts = Object.fromEntries((header ?? "").split(",").map((p) => p.trim().split("=") as [string, string]));
  const t = Number(parts.t);
  if (!Number.isFinite(t) || !parts.v1 || Math.abs(now / 1000 - t) > toleranceSeconds) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(`${t}.${body}`).digest("hex"));
  const given = Buffer.from(parts.v1);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
