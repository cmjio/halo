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
  named: Record<string, unknown>;
  /** Resolve one of the tool declaration's own args (e.g. `apiKey: Env.KEY`). */
  config(name: string | number): unknown;
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
 * Request params: named args plus the first positional arg as `input`.
 * A tool declared with `sendInput: false` sends named args only (for strict APIs).
 */
function params(call: ToolCall): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (call.config("sendInput") !== false) {
    const [input, ...rest] = call.positional;
    if (input !== undefined) out.input = input;
    if (rest.length) out.args = rest;
  }
  for (const [k, v] of Object.entries(call.named)) if (!RESERVED.has(k)) out[k] = v;
  return out;
}

function buildUrl(call: ToolCall, defaultPath: string): URL {
  let base = baseUrl(call);
  // {{key}} placeholders in the base URL are filled from named args.
  base = base.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => encodeURIComponent(str(call.named[k] ?? "")));
  const path = typeof call.named.path === "string" ? call.named.path : defaultPath;
  const url = new URL(base.replace(/\/+$/, "") + (path && !path.startsWith("/") ? "/" : "") + path);
  if (typeof call.named.query === "string") {
    for (const [k, v] of new URLSearchParams(call.named.query)) url.searchParams.append(k, v);
  }
  return url;
}

function authHeaders(call: ToolCall): Record<string, string> {
  const key = call.config("apiKey");
  return typeof key === "string" && key ? { Authorization: `Bearer ${key}` } : {};
}

async function readResponse(res: Response, label: string): Promise<unknown> {
  const text = await res.text();
  if (!res.ok) throw new HttpError(`${label} failed (${res.status}): ${text.slice(0, 500)}`, res.status, text);
  if ((res.headers.get("content-type") ?? "").includes("json") || /^\s*[[{]/.test(text)) {
    try {
      return JSON.parse(text);
    } catch {}
  }
  return text;
}

const rest: ToolProvider = async (call, { fetch }) => {
  const url = buildUrl(call, call.viaAgent ? "" : call.method);
  for (const [k, v] of Object.entries(params(call))) url.searchParams.set(k, str(v));
  const res = await fetch(url, { method: "GET", headers: authHeaders(call), signal: call.signal });
  return readResponse(res, `GET ${url.origin}${url.pathname}`);
};

const post: ToolProvider = async (call, { fetch }) => {
  const url = buildUrl(call, "");
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(call) },
    body: JSON.stringify(params(call)),
    signal: call.signal,
  });
  return readResponse(res, `POST ${url.origin}${url.pathname}`);
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
      return store.search(ns, query, Number(named.limit ?? 5), Number(named.min_score ?? named.minScore ?? 0), named.tags ? tags(named.tags) : undefined);
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
