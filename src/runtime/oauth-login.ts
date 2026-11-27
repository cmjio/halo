/**
 * Signing in from a terminal: the loopback redirect (RFC 8252) and opening the browser.
 *
 * The listener is on 127.0.0.1 (never `localhost`, which may resolve to ::1 or be rebound), on a
 * random port, at a random path. It takes exactly one request on that path: whatever that request
 * carries, the listener closes after it, so a second one (another process guessing) finds nothing.
 * A request to another path, or with a Host other than 127.0.0.1:<port>, gets a 400 and doesn't
 * count. It gives up after 5 minutes.
 */

import { randomBytes } from "node:crypto";
import { HaloError } from "./errors.js";

export interface Loopback {
  redirectUri: string;
  /** The redirect's query, once it comes. */
  result: Promise<URLSearchParams>;
  close(): void;
}

const PAGE = (title: string, body: string) =>
  new Response(`<!doctype html><meta charset="utf-8"><title>${title}</title><body style="font:16px system-ui;max-width:520px;margin:80px auto;padding:0 16px"><h2>${title}</h2><p>${body}</p></body>`, { headers: { "Content-Type": "text/html; charset=utf-8" } });

export function startLoopback(opts: { timeoutMs?: number } = {}): Loopback {
  const path = `/callback/${randomBytes(12).toString("base64url")}`;
  let settle!: { ok: (p: URLSearchParams) => void; no: (e: Error) => void };
  const result = new Promise<URLSearchParams>((ok, no) => (settle = { ok, no }));
  // Closed before anyone waited (a sign-in that failed before the browser opened): not an unhandled rejection.
  result.catch(() => {});
  let done = false;
  const finish = () => {
    done = true;
    clearTimeout(timer);
    // Let the answer page go out before the listener stops.
    setTimeout(() => server.stop(true), 50);
  };
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(req) {
      const url = new URL(req.url);
      if (done) return new Response("This sign-in is over.", { status: 410 });
      if (req.headers.get("host") !== `127.0.0.1:${server.port}` || url.pathname !== path || req.method !== "GET") return new Response("Not here.", { status: 400 });
      finish();
      settle.ok(url.searchParams);
      return url.searchParams.has("error") ? PAGE("Sign-in was refused", "You can close this tab.") : PAGE("Signed in", "You can close this tab and go back to the terminal.");
    },
  });
  const timer = setTimeout(() => {
    if (done) return;
    finish();
    settle.no(new HaloError(`Nobody signed in within ${Math.round((opts.timeoutMs ?? 300_000) / 60_000) || 1} minutes; nothing was stored`, { code: "AUTH_TIMEOUT" }));
  }, opts.timeoutMs ?? 300_000);
  return {
    redirectUri: `http://127.0.0.1:${server.port}${path}`,
    result,
    close() {
      if (!done) {
        finish();
        settle.no(new HaloError("Sign-in cancelled", { code: "AUTH_TIMEOUT" }));
      }
    },
  };
}

/** Whether this machine likely has a browser a person is looking at. */
export function hasBrowser(env: Record<string, string | undefined> = process.env): boolean {
  if (env.HALO_NO_BROWSER || env.SSH_CONNECTION || env.SSH_TTY) return false;
  if (process.platform === "linux") return !!(env.DISPLAY || env.WAYLAND_DISPLAY);
  return process.platform === "darwin" || process.platform === "win32";
}

/** Open a URL in the browser; false when it couldn't be. */
export async function openBrowser(url: string): Promise<boolean> {
  const cmd = process.platform === "darwin" ? ["open", url] : process.platform === "win32" ? ["cmd", "/c", "start", "", url] : ["xdg-open", url];
  try {
    const p = Bun.spawn(cmd, { stdout: "ignore", stderr: "ignore" });
    return (await p.exited) === 0;
  } catch {
    return false;
  }
}
