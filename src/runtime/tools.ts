/**
 * Tool providers: the implementations behind `tool Name : Provider(...)`.
 *
 * A provider receives the tool's declaration args (resolved lazily, so a
 * VectorStore never needs its remote key) and the call's resolved args.
 */

import type { ToolDeclaration, Value } from "../parser/types.js";
import { HttpError, HaloError } from "./errors.js";
import type { LocalVectorStore } from "./vectors.js";
import { INTEGRATIONS } from "./integrations.js";

export interface ToolCall {
  tool: ToolDeclaration;
  method: string;
  /** Positional call args. The first defaults to the pipeline value when none are given. */
  positional: unknown[];
  /** True when `positional` is just the pipeline value, because the call passed no positional args. */
  implicitInput?: boolean;
  named: Record<string, unknown>;
  /** Resolve one of the tool declaration's own args (e.g. `apiKey: Env.KEY`). */
  config(name: string | number): unknown;
  /** The declaration's first argument as written, before {{...}} are filled (e.g. a URL or file template). */
  template0?: string;
  /** True when an agent invoked the tool via `Agent.method(tool: Name, ...)`. */
  viaAgent: boolean;
  signal: AbortSignal;
}

export interface ToolServices {
  fetch: typeof fetch;
  vectors(): LocalVectorStore;
  sql(url: string): InstanceType<typeof Bun.SQL>;
}

export type ToolProvider = (call: ToolCall, services: ToolServices) => Promise<unknown>;

const RESERVED = new Set(["path", "query", "tool"]);

function str(v: unknown): string {
  return typeof v === "string" ? v : JSON.stringify(v);
}

function baseUrl(call: ToolCall): string {
  const url = call.config(0);
  if (typeof url !== "string" || !url) throw new HaloError(`Tool "${call.tool.name}" needs a URL, e.g. ${call.tool.provider}("api.example.com/v1")`);
  return /^https?:\/\//.test(url) ? url : `https://${url}`;
}

/**
 * Request params: named args, plus an explicit first positional arg as `input`.
 * The pipeline value is never sent implicitly (strict APIs reject unknown
 * params), and args that filled a {{placeholder}} in the URL aren't sent again.
 * A tool declared with `sendInput: false` sends named args only.
 */
function params(call: ToolCall): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (call.config("sendInput") !== false && !call.implicitInput) {
    const [input, ...rest] = call.positional;
    if (input !== undefined) out.input = input;
    if (rest.length) out.args = rest;
  }
  const inUrl = new Set([...(call.template0 ?? "").matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]!));
  for (const [k, v] of Object.entries(call.named)) if (!RESERVED.has(k) && !inUrl.has(k)) out[k] = v;
  return out;
}

/** Methods named after the request itself call the URL as declared, with no extra path segment. */
const PLAIN_METHODS = new Set(["get", "fetch", "request", "call", "execute", "send"]);

/** The fixed part of a URL template: everything before its first {{placeholder}}. */
function fixedPrefix(template: string): URL {
  const literal = template.split("{{")[0]!;
  return new URL(/^https?:\/\//.test(literal) ? literal : `https://${literal}`);
}

function buildUrl(call: ToolCall, defaultPath: string): URL {
  let base = baseUrl(call);
  // {{key}} placeholders in the base URL are filled from named args.
  base = base.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => encodeURIComponent(str(call.named[k] ?? "")));
  const path = typeof call.named.path === "string" ? call.named.path : defaultPath;
  // Query parameters go in named args or `query:`; a path that carries its own would bypass that.
  if (/[?#]/.test(path)) throw new HaloError(`${call.tool.name}: path "${path}" can't contain ? or #; pass query parameters as named args or query:`, { code: "TOOL_ARGUMENT" });
  const url = new URL(base.replace(/\/+$/, "") + (path && !path.startsWith("/") ? "/" : "") + path);
  // The request must stay under the tool's declared URL (no ../ out of it, no other host).
  const root = fixedPrefix(call.template0 ?? base);
  const rootPath = root.pathname.endsWith("/") ? root.pathname : `${root.pathname}/`;
  if (url.origin !== root.origin || !(url.pathname === root.pathname || url.pathname.startsWith(rootPath) || (root.pathname.endsWith("/") && url.pathname.startsWith(root.pathname)))) {
    throw new HaloError(`${call.tool.name}: ${url.origin}${url.pathname} is outside the tool's URL ${root.origin}${root.pathname}`, { code: "TOOL_ARGUMENT" });
  }
  if (typeof call.named.query === "string") {
    for (const [k, v] of new URLSearchParams(call.named.query)) url.searchParams.append(k, v);
  }
  return url;
}

function authHeaders(call: ToolCall): Record<string, string> {
  const key = call.config("apiKey");
  return typeof key === "string" && key ? { Authorization: `Bearer ${key}` } : {};
}

/** Parse a response. A tool declared with `allowNotFound: true` returns null on 404 (for APIs that 404 when nothing matches). */
async function readResponse(res: Response, label: string, call?: ToolCall): Promise<unknown> {
  const text = await res.text();
  if (res.status === 404 && call?.config("allowNotFound") === true) return null;
  if (!res.ok) throw new HttpError(`${label} failed (${res.status}): ${text.slice(0, 500)}`, res.status, text);
  if ((res.headers.get("content-type") ?? "").includes("json") || /^\s*[[{]/.test(text)) {
    try {
      return JSON.parse(text);
    } catch {}
  }
  return text;
}

const rest: ToolProvider = async (call, { fetch }) => {
  const url = buildUrl(call, call.viaAgent || PLAIN_METHODS.has(call.method.toLowerCase()) ? "" : call.method);
  for (const [k, v] of Object.entries(params(call))) url.searchParams.set(k, str(v));
  const res = await fetch(url, { method: "GET", headers: authHeaders(call), signal: call.signal });
  return readResponse(res, `GET ${url.origin}${url.pathname}`, call);
};

const post: ToolProvider = async (call, { fetch }) => {
  const url = buildUrl(call, "");
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(call) },
    body: JSON.stringify(params(call)),
    signal: call.signal,
  });
  return readResponse(res, `POST ${url.origin}${url.pathname}`, call);
};

const VECTOR_METHODS = new Set(["log", "insert", "add", "upsert", "save", "store", "search", "query", "find", "recall", "similar", "delete", "forget", "count"]);

const vectorStore: ToolProvider = async (call, services) => {
  const store = services.vectors();
  const ns = String(call.config("namespace") ?? call.tool.name);
  const [first] = call.positional;
  const named = call.named;
  const tags = (v: unknown) => (v === undefined ? [] : (Array.isArray(v) ? v : [v]).map(str));
  // An agent using the store (`Agent.task(tool: Store, ...)`) retrieves context for its task.
  const method = call.viaAgent && !VECTOR_METHODS.has(call.method) ? "search" : call.method;

  switch (method) {
    case "log":
    case "insert":
    case "add":
    case "upsert":
    case "save":
    case "store": {
      const { content = first, tags: t, ...metadata } = named;
      if (content === undefined) throw new HaloError(`${call.tool.name}.${call.method} needs content`);
      return { stored: true, namespace: ns, ...store.insert(ns, content, tags(t), metadata) };
    }
    case "search":
    case "query":
    case "find":
    case "recall":
    case "similar": {
      const query = named.query ?? first ?? (Object.keys(named).length ? named : undefined);
      if (query === undefined) throw new HaloError(`${call.tool.name}.${call.method} needs a query`);
      const order = named.order === undefined ? undefined : String(named.order);
      if (order !== undefined && order !== "score" && order !== "recent") throw new HaloError(`${call.tool.name}.${call.method}: order must be "score" or "recent"`);
      return store.search(ns, query, {
        limit: Number(named.limit ?? 5),
        minScore: Number(named.min_score ?? named.minScore ?? 0),
        tags: named.tags ? tags(named.tags) : undefined,
        excludeTags: named.exclude_tags ?? named.excludeTags ? tags(named.exclude_tags ?? named.excludeTags) : undefined,
        order,
      });
    }
    case "delete":
    case "forget":
      return { deleted: store.delete(ns, { id: named.id !== undefined ? Number(named.id) : undefined, tags: tags(named.tags) }) };
    case "count":
      return store.count(ns);
    default:
      throw new HaloError(`VectorStore tool "${call.tool.name}" has no method "${call.method}" (use log, search, delete, count)`);
  }
};

const READ_ONLY_SQL = /^\s*(?:select|with|show|explain|values|table)\b/i;

const postgres: ToolProvider = async (call, services) => {
  const url = call.config(0);
  if (typeof url !== "string" || !url) throw new HaloError(`Tool "${call.tool.name}" needs a connection URL, e.g. PostgreSQL(Env.DB_URI)`);
  const text = call.named.sql ?? call.named.query ?? call.positional[0];
  if (typeof text !== "string") throw new HaloError(`${call.tool.name}.${call.method} needs a SQL string (sql: "SELECT ...")`);
  // Zero-trust default: only reads, unless the tool is declared with readOnly: false.
  if (call.config("readOnly") !== false && !READ_ONLY_SQL.test(text)) {
    throw new HaloError(`Tool "${call.tool.name}" is read-only; declare it with readOnly: false to allow: ${text.slice(0, 80)}`);
  }
  const list = call.named.params;
  const rows = await services.sql(url).unsafe(text, Array.isArray(list) ? list : list === undefined ? [] : [list]);
  return [...rows];
};

export const BUILTIN_PROVIDERS: Record<string, ToolProvider> = {
  REST: rest,
  GET: rest,
  POST: post,
  VectorStore: vectorStore,
  PostgreSQL: postgres,
  SQL: postgres,
  ...INTEGRATIONS,
};

export function declArgs(tool: ToolDeclaration): { positional: Value[]; named: Record<string, Value> } {
  const positional: Value[] = [];
  const named: Record<string, Value> = {};
  for (const a of tool.argList) {
    if (a.name) named[a.name] = a.value;
    else positional.push(a.value);
  }
  return { positional, named };
}
