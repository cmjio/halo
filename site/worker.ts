/**
 * halolang.com: static files, plus
 *   - /dl/<version>/<file> and /dl/<channel>.json (latest, next, nightly): release binaries and
 *     which version each channel is on, from R2; each binary served is counted in Workers
 *     Analytics Engine (see countDownload)
 *   - Markdown instead of HTML for a page when the request's Accept prefers text/markdown
 *   - a 301 from www (and the old workers.dev address) to halolang.com, keeping the path
 *   - a 301 from /docs/<page> (where the docs used to be) to /<page>
 *   - a 301 from an example's old URL (/examples/74-software-team, /examples/casebook/021-…)
 *     to its page now (/examples/software-team)
 */

import renamed from "./data/renamed-examples.json";

interface R2Object {
  body: ReadableStream;
  size: number;
  httpEtag: string;
  writeHttpMetadata(headers: Headers): void;
}

export interface AnalyticsDataset {
  writeDataPoint(point: { blobs?: string[]; doubles?: number[]; indexes?: string[] }): void;
}

export interface Env {
  ASSETS: { fetch(req: Request): Promise<Response> };
  RELEASES: { get(key: string): Promise<R2Object | null>; head(key: string): Promise<Omit<R2Object, "body"> | null> };
  /** Binary downloads (dataset halo_downloads). Unbound in local dev, and then skipped. */
  DOWNLOADS?: AnalyticsDataset;
}

const CANONICAL = "halolang.com";

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.hostname !== CANONICAL && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
      url.hostname = CANONICAL;
      url.protocol = "https:";
      url.port = "";
      return Response.redirect(url.toString(), 301);
    }
    if (url.pathname === "/docs" || url.pathname.startsWith("/docs/")) {
      const page = url.pathname.slice("/docs".length).replace(/\.html$/, "").replace(/\/index$/, "/") || "/";
      return Response.redirect(new URL(page + url.search + url.hash, url).toString(), 301);
    }
    const moved = movedExample(url.pathname);
    if (moved) return Response.redirect(new URL(moved + url.search + url.hash, url).toString(), 301);
    if (url.pathname.startsWith("/dl/")) return download(req, url, env);
    if (url.pathname.endsWith(".mp4")) return byteRange(req, env);
    if (wantsMarkdown(req.headers.get("accept"))) {
      const md = await markdown(req, url, env);
      if (md) return md;
    }
    const res = await env.ASSETS.fetch(req);
    // A page's URL serves HTML or Markdown by Accept, so caches must keep the two apart.
    if (!(res.headers.get("content-type") ?? "").startsWith("text/html")) return res;
    const out = new Response(res.body, res);
    out.headers.append("vary", "Accept");
    return out;
  },
};

/**
 * Markdown for agents: a request whose Accept prefers text/markdown to text/html gets the
 * page's Markdown (the /<page>.md that site/llms.ts writes) instead of its HTML. Browsers
 * don't ask for text/markdown, so they keep getting HTML.
 */
export function wantsMarkdown(accept: string | null): boolean {
  if (!accept) return false;
  const q = (type: string) => {
    let best = -1;
    for (const part of accept.split(",")) {
      const [range, ...params] = part.trim().toLowerCase().split(";").map((s) => s.trim());
      if (range !== type) continue;
      const qp = params.find((p) => p.startsWith("q="));
      best = Math.max(best, qp ? Number(qp.slice(2)) || 0 : 1);
    }
    return best;
  };
  const md = q("text/markdown");
  return md > 0 && md >= q("text/html");
}

/** Where a page's Markdown is: / → /index.md, /guide/x(.html) → /guide/x.md, /examples/ → /examples/index.md. */
export function markdownPath(pathname: string): string | undefined {
  if (pathname.endsWith(".md")) return pathname;
  const path = pathname.replace(/\.html$/, "").replace(/\/index$/, "/");
  if (/\.[\w]+$/.test(path)) return undefined; // a file (.txt, .svg, .json): not a page
  return path.endsWith("/") ? `${path}index.md` : `${path}.md`;
}

async function markdown(req: Request, url: URL, env: Env): Promise<Response | undefined> {
  if (req.method !== "GET" && req.method !== "HEAD") return undefined;
  const path = markdownPath(url.pathname);
  if (!path) return undefined;
  const res = await env.ASSETS.fetch(new Request(new URL(path, url).toString(), { method: "GET" }));
  if (res.status !== 200) return undefined;
  const text = await res.text();
  const headers = new Headers({
    "content-type": "text/markdown; charset=utf-8",
    vary: "Accept",
    // A rough count (about 4 characters a token), for agents budgeting their context.
    "x-markdown-tokens": String(Math.ceil(text.length / 4)),
    "cache-control": res.headers.get("cache-control") ?? "public, max-age=0, must-revalidate",
  });
  const etag = res.headers.get("etag");
  if (etag) headers.set("etag", etag);
  return new Response(req.method === "HEAD" ? null : text, { headers });
}

/** The page an example moved to, when the path is one of its old URLs. */
export function movedExample(pathname: string): string | undefined {
  const m = /^\/examples\/((?:casebook\/)?[\w-]+?)(?:\.html)?\/?$/.exec(pathname);
  const to = m ? (renamed as Record<string, string>)[m[1]!] : undefined;
  return to ? `/examples/${to}` : undefined;
}

/**
 * Static assets ignore Range and always send the whole file, but Safari won't play a
 * video without 206 responses. So videos are sliced here.
 */
async function byteRange(req: Request, env: Env): Promise<Response> {
  const headers = new Headers(req.headers);
  headers.delete("range");
  const res = await env.ASSETS.fetch(new Request(req.url, { method: req.method, headers }));
  const out = new Headers(res.headers);
  out.set("accept-ranges", "bytes");
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
  if (res.status !== 200 || req.method !== "GET" || !m || (!m[1] && !m[2])) return new Response(res.body, { status: res.status, headers: out });
  const body = await res.arrayBuffer();
  const size = body.byteLength;
  // "bytes=a-b", "bytes=a-" (to the end), or "bytes=-n" (the last n bytes)
  const start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
  const end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
  if (start >= size || start > end) {
    out.set("content-range", `bytes */${size}`);
    out.delete("content-length");
    return new Response(null, { status: 416, headers: out });
  }
  out.set("content-range", `bytes ${start}-${end}/${size}`);
  out.set("content-length", String(end - start + 1));
  return new Response(body.slice(start, end + 1), { status: 206, headers: out });
}

/**
 * How a download was asked for: install.sh and install.ps1 add ?via= (script, ci, action or
 * upgrade, from HALO_INSTALLED_VIA or $CI); anything else (a browser, a hand-written curl) is
 * "direct". Unknown values are "other", so the column stays a short, known list.
 */
export const VIAS = ["script", "ci", "action", "upgrade"] as const;
export function viaOf(url: URL): string {
  const via = url.searchParams.get("via");
  if (via === null || via === "") return "direct";
  return (VIAS as readonly string[]).includes(via) ? via : "other";
}

/**
 * One data point per binary served (not SHA256SUMS, latest.json, HEAD or a miss):
 *   blob1 version, blob2 asset (halo-darwin-arm64, …), blob3 via, blob4 country; double1 = 1.
 * Analytics Engine samples at high volume, so totals are SUM(_sample_interval), not COUNT().
 * scripts/install-stats.ts reads it back over the SQL API.
 */
export function countDownload(env: Env, req: Request, url: URL, key: string): void {
  const [version, asset] = key.split("/") as [string, string];
  if (!asset || asset === "SHA256SUMS" || asset.endsWith(".json")) return;
  const country = (req as Request & { cf?: { country?: string } }).cf?.country ?? "";
  try {
    env.DOWNLOADS?.writeDataPoint({ blobs: [version.replace(/^v/, ""), asset, viaOf(url), country], doubles: [1], indexes: [asset] });
  } catch {
    // Counting must never break a download.
  }
}

/** A key under /dl/ that may be served: a channel pointer, or a file of one version. */
export function isDownloadKey(key: string): boolean {
  return /^((latest|next|nightly)\.json|v?\d+\.\d+\.\d+[\w.-]*\/[\w.-]+)$/.test(key);
}

async function download(req: Request, url: URL, env: Env): Promise<Response> {
  if (req.method !== "GET" && req.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
  const key = decodeURIComponent(url.pathname.slice("/dl/".length));
  if (!isDownloadKey(key)) return new Response("Not found", { status: 404 });
  const object = req.method === "HEAD" ? await env.RELEASES.head(key) : await env.RELEASES.get(key);
  if (!object) return new Response("Not found", { status: 404 });
  if (req.method === "GET") countDownload(env, req, url, key);
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("content-length", String(object.size));
  // A version's files never change; which version a channel is on does.
  headers.set("cache-control", key.endsWith(".json") ? "public, max-age=60" : "public, max-age=31536000, immutable");
  if (!headers.has("content-type")) headers.set("content-type", key.endsWith(".json") ? "application/json" : "application/octet-stream");
  if (!key.endsWith(".json")) headers.set("content-disposition", `attachment; filename="${key.split("/").pop()}"`);
  return new Response(req.method === "HEAD" ? null : (object as R2Object).body, { headers });
}
