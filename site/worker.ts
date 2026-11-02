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
    return env.ASSETS.fetch(req);
  },
};

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
  return new Response("body" in object ? object.body : null, { headers });
}
