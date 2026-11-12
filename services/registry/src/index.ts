/**
 * halo-registry: the Halo package registry at registry.halolang.com.
 *
 *   v1/*            the JSON API (src/registry/contract.ts lists every route)
 *   /, /@s/n, /@s/n/v/<version>   package pages (HTML)
 *
 * D1 (DB) holds accounts, scopes and versions; R2 (PACKAGES) holds the package files.
 * See services/registry/README.md and proposals/halo-registry.md.
 */

import { parsePackageName } from "../../../src/registry/contract.ts";
import { authenticate, createToken, deleteToken, listTokens, pollDevice, startDevice, whoami, type Caller } from "./auth.ts";
import type { Ctx, Env } from "./env.ts";
import { CORS_HEADERS, errorResponse, fail, HttpError, json, now, secured, withHeaders } from "./http.ts";
import { deleteDistTag, deprecate, getDoc, getFile, getIndex, publish, putDistTag, search, yank } from "./packages.ts";
import { homePage, packagePage } from "./pages.ts";
import { createScope, deleteMember, getScopeDoc, putMember, verifyScope } from "./scopes.ts";

export type { Env } from "./env.ts";

const SEG = "([^/]+)";
const PKG = "(@[^/]+/[^/]+)";

function packageName(text: string): string {
  if (!parsePackageName(text)) fail(400, "invalid_name", `"${text}" is not a scoped package name like @acme/support-kit`);
  return text;
}

async function route(req: Request, env: Env, ctx: Ctx): Promise<Response> {
  const url = new URL(req.url);
  let path: string;
  try {
    // Clients may encode the scope's @ and / (npm sends @acme%2fkit).
    path = decodeURIComponent(url.pathname).replace(/^\/+/, "");
  } catch {
    return fail(400, "bad_path", "The path is not valid");
  }
  const method = req.method === "HEAD" ? "GET" : req.method;
  const m = (re: string) => new RegExp(`^${re}$`).exec(path);
  const caller = async (): Promise<Caller> => {
    const c = await authenticate(req, env);
    ctx.waitUntil(
      env.DB.prepare(`UPDATE tokens SET last_used_at = ? WHERE id = ?`)
        .bind(now(), c.tokenId)
        .run()
        .catch(() => undefined),
    );
    return c;
  };
  let r: RegExpExecArray | null;

  if (path.startsWith("v1/") || path === "v1") {
    if (method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
    if (method === "GET") {
      const res = await getApi(path, url, req, env, ctx, caller).catch((e: unknown) => {
        if (e instanceof HttpError) return errorResponse(e);
        throw e;
      });
      return res.headers.has("access-control-allow-origin") ? res : withHeaders(res, CORS_HEADERS);
    }
    if (method === "PUT" && (r = m(`v1/packages/${PKG}`))) return publish(req, env, await caller(), packageName(r[1]!));
    if (method === "POST" && (r = m(`v1/packages/${PKG}/versions/${SEG}/yank`))) return yank(req, env, await caller(), packageName(r[1]!), r[2]!, true);
    if (method === "DELETE" && (r = m(`v1/packages/${PKG}/versions/${SEG}/yank`))) return yank(req, env, await caller(), packageName(r[1]!), r[2]!, false);
    if (method === "POST" && (r = m(`v1/packages/${PKG}/deprecate`))) return deprecate(req, env, await caller(), packageName(r[1]!));
    if (method === "PUT" && (r = m(`v1/packages/${PKG}/dist-tags/${SEG}`))) return putDistTag(req, env, await caller(), packageName(r[1]!), r[2]!);
    if (method === "DELETE" && (r = m(`v1/packages/${PKG}/dist-tags/${SEG}`))) return deleteDistTag(env, await caller(), packageName(r[1]!), r[2]!);
    if (method === "POST" && path === "v1/auth/device") return startDevice(req, env);
    if (method === "POST" && path === "v1/auth/device/token") return pollDevice(req, env);
    if (method === "POST" && path === "v1/tokens") return createToken(req, await caller(), env);
    if (method === "DELETE" && (r = m(`v1/tokens/${SEG}`))) return deleteToken(r[1]!, await caller(), env);
    if (method === "POST" && path === "v1/scopes") return createScope(req, await caller(), env);
    if (method === "PUT" && (r = m(`v1/scopes/(@[^/]+)/members/${SEG}`))) return putMember(req, r[1]!, r[2]!, await caller(), env);
    if (method === "DELETE" && (r = m(`v1/scopes/(@[^/]+)/members/${SEG}`))) return deleteMember(r[1]!, r[2]!, await caller(), env);
    if (method === "POST" && (r = m(`v1/scopes/(@[^/]+)/verify`))) return verifyScope(req, r[1]!, await caller(), env);
    return fail(isKnownPath(path) ? 405 : 404, isKnownPath(path) ? "method_not_allowed" : "not_found", `${req.method} /${path} is not a registry API route`);
  }

  if (method !== "GET") return fail(405, "method_not_allowed", `${req.method} is not allowed here`);
  if (path === "" || path === "index.html") return homePage(url, env);
  if ((r = m(`${PKG}/v/${SEG}`))) return packagePage(env, ctx, packageName(r[1]!), r[2]!);
  if ((r = m(PKG))) return packagePage(env, ctx, packageName(r[1]!));
  if (path === "robots.txt") return new Response("User-agent: *\nDisallow: /v1/\n", { headers: { "content-type": "text/plain" } });
  return new Response("Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
}

async function getApi(path: string, url: URL, req: Request, env: Env, ctx: Ctx, caller: () => Promise<Caller>): Promise<Response> {
  let r: RegExpExecArray | null;
  const m = (re: string) => new RegExp(`^${re}$`).exec(path);
  if (path === "v1/index.json") return getIndex(env);
  if (path === "v1/search") return search(url, env);
  if ((r = m(`v1/packages/${PKG}\\.json`))) return getDoc(env, packageName(r[1]!), ctx);
  if ((r = m(`v1/packages/${PKG}`))) return getDoc(env, packageName(r[1]!), ctx);
  if ((r = m(`v1/files/${PKG}/${SEG}\\.halotool`))) return getFile(req, env, ctx, packageName(r[1]!), r[2]!);
  if (path === "v1/whoami") return whoami(await caller(), env);
  if (path === "v1/tokens") return listTokens(await caller(), env);
  if ((r = m(`v1/scopes/(@[^/]+)`))) return getScopeDoc(env, r[1]!, ctx);
  return fail(404, "not_found", `GET /${path} is not a registry API route`);
}

function isKnownPath(path: string): boolean {
  return /^v1\/(packages\/@[^/]+\/[^/]+(\/.*)?|auth\/device(\/token)?|tokens(\/[^/]+)?|scopes(\/.*)?|whoami|index\.json|search|files\/.*)$/.test(path);
}

export default {
  async fetch(req: Request, env: Env, ctx: Ctx): Promise<Response> {
    let res: Response;
    try {
      res = await route(req, env, ctx);
    } catch (e) {
      if (e instanceof HttpError) res = errorResponse(e);
      else {
        console.error(JSON.stringify({ message: "unhandled error", url: req.url, method: req.method, error: e instanceof Error ? (e.stack ?? e.message) : String(e) }));
        res = json({ error: "Internal error", code: "internal" }, 500);
      }
    }
    return secured(res);
  },
};
