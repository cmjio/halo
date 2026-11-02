/**
 * Providers built from installed packages' manifests.
 *
 * An http provider is only data: Halo builds each request from the method's
 * declared verb and path, under the declared base URL, with the declared auth.
 * An mcp provider is Halo's MCP client pointed at the declared server. A module
 * provider is the package's own code.
 */

import { HaloError, HttpError } from "../runtime/errors.js";
import { MCP_INFO, mcpProvider } from "../runtime/mcp.js";
import type { JsonSchema, ProviderInfo, ToolCall, ToolMethod, ToolProvider, ToolServices } from "../runtime/tools.js";
import type { HttpMethodSpec, HttpProviderSpec, McpProviderSpec, ProviderSpec } from "./manifest.js";

export interface BuiltProvider {
  provider: ToolProvider;
  info: ProviderInfo;
}

const str = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v));

function pathParams(path: string): string[] {
  return [...path.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!);
}

/** A method's argument schema: as declared, else its path parameters (required) plus anything. */
function paramsOf(m: HttpMethodSpec): JsonSchema {
  if (m.params) return m.params;
  const names = pathParams(m.http.path);
  return { type: "object", properties: Object.fromEntries(names.map((n) => [n, { type: "string" }])), required: names, additionalProperties: true };
}

function secret(call: ToolCall, services: ToolServices, name: string | undefined): string | undefined {
  if (!name) return undefined;
  const v = services.env?.[name] ?? process.env[name];
  return v || undefined;
}

/** Form encoding as Stripe and similar APIs read it: nested objects and lists as a[b]=1, a[0]=x. */
function formBody(args: Record<string, unknown>): URLSearchParams {
  const out = new URLSearchParams();
  const add = (key: string, v: unknown) => {
    if (v === undefined || v === null) return;
    if (Array.isArray(v)) v.forEach((item, i) => add(`${key}[${i}]`, item));
    else if (typeof v === "object") for (const [k, x] of Object.entries(v)) add(`${key}[${k}]`, x);
    else out.append(key, String(v));
  };
  for (const [k, v] of Object.entries(args)) add(k, v);
  return out;
}

export function httpProvider(providerName: string, spec: HttpProviderSpec): BuiltProvider {
  const methods = new Map(spec.methods.map((m) => [m.name, m]));
  const provider: ToolProvider = async (call, services) => {
    const method = methods.get(call.method);
    if (!method) throw new HaloError(`${providerName} tool "${call.tool.name}" has no method "${call.method}" (use ${[...methods.keys()].join(", ")})`, { code: "TOOL_METHOD" });
    const args: Record<string, unknown> = { ...call.named };
    // A single positional value fills the first path parameter (Pay.get_customer("cus_123")).
    const params = pathParams(method.http.path);
    if (!call.implicitInput && call.positional[0] !== undefined && params[0] && args[params[0]] === undefined) args[params[0]] = call.positional[0];

    // The base URL's {{placeholders}} come from the tool declaration (a tenant, a region), never from the model.
    const base = spec.baseUrl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => {
      const v = call.config(k);
      if (v === undefined || v === "") throw new HaloError(`Tool "${call.tool.name}" needs ${k}: in its declaration, e.g. ${providerName}(${k}: "...")`, { code: "TOOL_CONFIG" });
      const text = str(v);
      if (!/^[\w.-]+$/.test(text)) throw new HaloError(`Tool "${call.tool.name}": ${k} "${text}" can only contain letters, digits, ".", "-" and "_"`, { code: "TOOL_CONFIG" });
      return text;
    });
    const path = method.http.path.replace(/\{(\w+)\}/g, (_, k: string) => {
      const v = args[k];
      if (v === undefined || v === null || v === "") throw new HaloError(`${call.tool.name}.${call.method} needs ${k}`, { code: "TOOL_ARGUMENT" });
      delete args[k];
      return encodeURIComponent(str(v));
    });
    const url = new URL(base.replace(/\/+$/, "") + path);
    const root = new URL(base.replace(/\/+$/, "") + "/");
    if (url.origin !== root.origin || !(url.pathname + "/").startsWith(root.pathname)) {
      throw new HaloError(`${call.tool.name}.${call.method}: ${url.href} is outside ${root.href}`, { code: "TOOL_ARGUMENT" });
    }

    const headers: Record<string, string> = { Accept: "application/json", ...(spec.headers ?? {}) };
    const auth = spec.auth ?? { type: "none" as const };
    const declared = call.config("apiKey") ?? call.config(0);
    const key = typeof declared === "string" && declared ? declared : secret(call, services, typeof auth.env === "string" ? auth.env : undefined);
    if (auth.type !== "none" && auth.type !== "basic" && !key) {
      throw new HaloError(`Tool "${call.tool.name}" needs an API key: set ${auth.env ?? "it"}, or declare ${providerName}(apiKey: Env.NAME)`, { code: "TOOL_CONFIG" });
    }
    if (auth.type === "bearer") headers.Authorization = `Bearer ${key}`;
    else if (auth.type === "header") headers[auth.name!] = key!;
    else if (auth.type === "query") url.searchParams.set(auth.name!, key!);
    else if (auth.type === "basic") {
      const [userVar, passVar] = auth.env as string[];
      const user = str(call.config("user") ?? secret(call, services, userVar) ?? "");
      const pass = typeof declared === "string" && declared ? declared : secret(call, services, passVar);
      if (!user || !pass) throw new HaloError(`Tool "${call.tool.name}" needs ${userVar} and ${passVar} (or user: and apiKey: in its declaration)`, { code: "TOOL_CONFIG" });
      headers.Authorization = `Basic ${btoa(`${user}:${pass}`)}`;
    }

    let body: string | URLSearchParams | undefined;
    if (method.http.method === "GET" || method.http.method === "DELETE") {
      for (const [k, v] of Object.entries(args)) if (v !== undefined) url.searchParams.set(k, str(v));
    } else if (spec.body === "form") {
      body = formBody(args);
    } else {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(args);
    }

    const res = await services.fetch(url, { method: method.http.method, headers, body, signal: call.signal });
    const text = await res.text();
    const label = `${call.tool.name}.${call.method} (${method.http.method} ${url.origin}${url.pathname})`;
    if (!res.ok) throw new HttpError(`${label} failed (${res.status}): ${text.slice(0, 500)}`, res.status, text);
    if (!text) return { ok: true, status: res.status };
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  };
  const info: ProviderInfo = {
    description: spec.description,
    methods: spec.methods.map((m): ToolMethod => ({ name: m.name, description: m.description, effect: m.effect, params: paramsOf(m) })),
  };
  return { provider, info };
}

/** An MCP server declared by a package: the declaration's own args can't point it elsewhere. */
export function mcpPackageProvider(spec: McpProviderSpec): BuiltProvider {
  const fixed = (config: ToolCall["config"]) => (key: string | number) => {
    if (key === 0) return spec.command ?? spec.url;
    if (key === "url") return spec.url;
    if (key === "env") return spec.env;
    return config(key);
  };
  const provider: ToolProvider = (call, services) => mcpProvider({ ...call, config: fixed(call.config) }, services);
  const list = MCP_INFO.methods as Exclude<ProviderInfo["methods"], ToolMethod[] | undefined>;
  return { provider, info: { description: spec.description, methods: (ctx, services) => list({ ...ctx, config: fixed(ctx.config) }, services) } };
}

/** A package's own module. */
export async function moduleProvider(entryPath: string, name: string, spec: ProviderSpec): Promise<BuiltProvider> {
  const mod = (await import(entryPath)) as { provider?: ToolProvider; info?: ProviderInfo; providers?: Record<string, { provider: ToolProvider; info?: ProviderInfo }> };
  const own = mod.providers?.[name] ?? (mod.provider ? { provider: mod.provider, info: mod.info } : undefined);
  if (typeof own?.provider !== "function") throw new HaloError(`${entryPath} doesn't export a provider for ${name} (export \`provider\` and \`info\`, or \`providers.${name}\`)`, { code: "TOOL_CONFIG" });
  return { provider: own.provider, info: { description: spec.description, ...(own.info ?? {}) } };
}
