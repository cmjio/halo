/**
 * halolang.com: static files, plus
 *   - /dl/<version>/<file> and /dl/latest.json: release binaries, from R2
 *   - a 301 from www (and the old workers.dev address) to halolang.com, keeping the path
 *   - a 301 from /docs/<page> (where the docs used to be) to /<page>
 */

interface R2Object {
  body: ReadableStream;
  size: number;
  httpEtag: string;
  writeHttpMetadata(headers: Headers): void;
}

interface Env {
  ASSETS: { fetch(req: Request): Promise<Response> };
  RELEASES: { get(key: string): Promise<R2Object | null>; head(key: string): Promise<Omit<R2Object, "body"> | null> };
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
    if (url.pathname.startsWith("/dl/")) return download(req, url, env);
    if (url.pathname.endsWith(".mp4")) return byteRange(req, env);
    return env.ASSETS.fetch(req);
  },
};

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

async function download(req: Request, url: URL, env: Env): Promise<Response> {
  if (req.method !== "GET" && req.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
  const key = decodeURIComponent(url.pathname.slice("/dl/".length));
  if (!/^(latest\.json|v?\d+\.\d+\.\d+[\w.-]*\/[\w.-]+)$/.test(key)) return new Response("Not found", { status: 404 });
  const object = req.method === "HEAD" ? await env.RELEASES.head(key) : await env.RELEASES.get(key);
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("content-length", String(object.size));
  // A version's files never change; which version is latest does.
  headers.set("cache-control", key === "latest.json" ? "public, max-age=60" : "public, max-age=31536000, immutable");
  if (!headers.has("content-type")) headers.set("content-type", key.endsWith(".json") ? "application/json" : "application/octet-stream");
  if (!key.endsWith(".json")) headers.set("content-disposition", `attachment; filename="${key.split("/").pop()}"`);
  return new Response(req.method === "HEAD" ? null : (object as R2Object).body, { headers });
}
