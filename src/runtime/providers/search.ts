/**
 * WebSearch: search the web and get back titles, URLs and snippets.
 *
 *   tool Web : WebSearch(engine: "brave", apiKey: Env.BRAVE_API_KEY)
 *     search(query, limit?, site?, freshness?)  →  { query, engine, results: [{ title, url, snippet, published? }] }
 *
 * Engines: "brave" (BRAVE_API_KEY), "tavily" (TAVILY_API_KEY), "serper" (SERPER_API_KEY, Google results),
 * "exa" (EXA_API_KEY). With no `engine:`, the first one whose key is set in the environment is used.
 * Pair it with `Browser` to read the pages a search finds.
 */

import { HaloError } from "../errors.js";
import type { ToolCall, ToolProvider, ToolServices } from "../tools.js";
import { explicitFirst, intArg, need, unknownMethod } from "./common.js";

const METHODS = ["search"];

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  published?: string;
}

interface Engine {
  env: string;
  search(q: { query: string; limit: number; freshness?: string }, key: string, services: ToolServices, signal: AbortSignal): Promise<SearchResult[]>;
}

async function json(res: Response, engine: string): Promise<any> {
  const text = await res.text();
  if (!res.ok) throw new HaloError(`WebSearch (${engine}) failed (${res.status}): ${text.slice(0, 300)}`, { code: "TOOL_FAILED", retryable: res.status === 429 || res.status >= 500 });
  try {
    return JSON.parse(text);
  } catch {
    throw new HaloError(`WebSearch (${engine}) returned something other than JSON`, { code: "TOOL_FAILED" });
  }
}

const strip = (s: unknown) => String(s ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

const FRESHNESS: Record<string, { brave: string; tavily: number; serper: string; exaDays: number }> = {
  day: { brave: "pd", tavily: 1, serper: "qdr:d", exaDays: 1 },
  week: { brave: "pw", tavily: 7, serper: "qdr:w", exaDays: 7 },
  month: { brave: "pm", tavily: 31, serper: "qdr:m", exaDays: 31 },
  year: { brave: "py", tavily: 365, serper: "qdr:y", exaDays: 365 },
};

export const ENGINES: Record<string, Engine> = {
  brave: {
    env: "BRAVE_API_KEY",
    async search(q, key, { fetch }, signal) {
      const url = new URL("https://api.search.brave.com/res/v1/web/search");
      url.searchParams.set("q", q.query);
      url.searchParams.set("count", String(Math.min(q.limit, 20)));
      if (q.freshness) url.searchParams.set("freshness", FRESHNESS[q.freshness]!.brave);
      const body = await json(await fetch(url, { headers: { Accept: "application/json", "X-Subscription-Token": key }, signal }), "brave");
      return (body?.web?.results ?? []).map((r: any) => ({ title: strip(r.title), url: String(r.url), snippet: strip(r.description), ...(r.page_age || r.age ? { published: String(r.page_age ?? r.age) } : {}) }));
    },
  },
  tavily: {
    env: "TAVILY_API_KEY",
    async search(q, key, { fetch }, signal) {
      const body = await json(
        await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify({ query: q.query, max_results: Math.min(q.limit, 20), ...(q.freshness ? { days: FRESHNESS[q.freshness]!.tavily, topic: "news" } : {}) }),
          signal,
        }),
        "tavily",
      );
      return (body?.results ?? []).map((r: any) => ({ title: strip(r.title), url: String(r.url), snippet: strip(r.content), ...(r.published_date ? { published: String(r.published_date) } : {}) }));
    },
  },
  serper: {
    env: "SERPER_API_KEY",
    async search(q, key, { fetch }, signal) {
      const body = await json(
        await fetch("https://google.serper.dev/search", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-API-KEY": key },
          body: JSON.stringify({ q: q.query, num: Math.min(q.limit, 20), ...(q.freshness ? { tbs: FRESHNESS[q.freshness]!.serper } : {}) }),
          signal,
        }),
        "serper",
      );
      return (body?.organic ?? []).map((r: any) => ({ title: strip(r.title), url: String(r.link), snippet: strip(r.snippet), ...(r.date ? { published: String(r.date) } : {}) }));
    },
  },
  exa: {
    env: "EXA_API_KEY",
    async search(q, key, { fetch }, signal) {
      const since = q.freshness ? new Date(Date.now() - FRESHNESS[q.freshness]!.exaDays * 86_400_000).toISOString() : undefined;
      const body = await json(
        await fetch("https://api.exa.ai/search", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": key },
          body: JSON.stringify({ query: q.query, numResults: Math.min(q.limit, 20), contents: { highlights: true }, ...(since ? { startPublishedDate: since } : {}) }),
          signal,
        }),
        "exa",
      );
      return (body?.results ?? []).map((r: any) => ({ title: strip(r.title), url: String(r.url), snippet: strip((r.highlights ?? []).join(" … ") || r.text || ""), ...(r.publishedDate ? { published: String(r.publishedDate) } : {}) }));
    },
  },
};

function pickEngine(call: ToolCall, services: ToolServices): { name: string; engine: Engine; key: string } {
  const env = services.env ?? process.env;
  const configured = call.config("engine");
  const names = configured === undefined ? Object.keys(ENGINES) : [String(configured).toLowerCase()];
  for (const name of names) {
    const engine = ENGINES[name];
    if (!engine) throw new HaloError(`Tool "${call.tool.name}": unknown search engine "${configured}" (use ${Object.keys(ENGINES).join(", ")})`, { code: "TOOL_CONFIG" });
    const key = call.config("apiKey") ?? env[engine.env];
    if (typeof key === "string" && key) return { name, engine, key };
    if (configured !== undefined) throw new HaloError(`Tool "${call.tool.name}": the ${name} engine needs an API key: set ${engine.env}, or pass apiKey:`, { code: "MISSING_API_KEY" });
  }
  throw new HaloError(`Tool "${call.tool.name}": WebSearch needs an API key for a search engine: set one of ${Object.values(ENGINES).map((e) => e.env).join(", ")}, or declare engine: and apiKey:`, { code: "MISSING_API_KEY" });
}

export const webSearch: ToolProvider = async (call, services) => {
  if (!["search", "query", "find"].includes(call.method) && !call.viaAgent) return unknownMethod(call, METHODS);
  let query = need(call, "query", call.named.query ?? explicitFirst(call) ?? (call.implicitInput ? call.positional[0] : undefined));
  const site = call.named.site ?? call.config("site");
  if (typeof site === "string" && site) query = `site:${site.replace(/^https?:\/\//, "").replace(/\/.*$/, "")} ${query}`;
  const limit = intArg(call, "limit", call.named.limit ?? call.config("limit"), 5, 1, 20);
  const freshness = call.named.freshness === undefined ? undefined : String(call.named.freshness);
  if (freshness !== undefined && !FRESHNESS[freshness]) throw new HaloError(`${call.tool.name}.${call.method}: freshness must be day, week, month or year`, { code: "TOOL_ARGUMENT" });
  const { name, engine, key } = pickEngine(call, services);
  const results = await engine.search({ query, limit, freshness }, key, services, call.signal);
  return { query, engine: name, results: results.slice(0, limit) };
};
