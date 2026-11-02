/**
 * The site is static files; this only sends www.halolang.com (and the old
 * workers.dev address) to https://halolang.com, keeping the path.
 */

interface Env {
  ASSETS: { fetch(req: Request): Promise<Response> };
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
    return env.ASSETS.fetch(req);
  },
};
