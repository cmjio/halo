/**
 * Tool packages: how a platform or service offers its API as Halo tools.
 *
 * A package is a folder with a `halo-tool.json` manifest declaring one or more
 * providers, each of one kind:
 *
 *   - http:   a declarative REST API (base URL, auth, methods). No package code runs;
 *             Halo makes the requests, and only under the declared base URL.
 *   - mcp:    an MCP server, started with a command (stdio) or reached at a URL.
 *   - module: a TypeScript/JavaScript module exporting a provider. It runs with the
 *             same access as Halo itself, so installing it needs `--trust`.
 *
 * A project uses an installed provider like a built-in one:
 *   tool Pay : Stripe()          (its key from the env var the manifest names)
 */

import type { JsonSchema, ToolEffect } from "../runtime/tools.js";

export interface HttpMethodSpec {
  name: string;
  description: string;
  effect: ToolEffect;
  http: {
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    /** Under the base URL. `{name}` segments are filled from the call's arguments, URL-encoded. */
    path: string;
  };
  /** JSON Schema of the arguments. Defaults to the path's `{name}` parameters, plus anything (as query or body). */
  params?: JsonSchema;
}

export interface HttpAuth {
  /** bearer: Authorization: Bearer <key>; header: <name>: <key>; query: ?<name>=<key>; basic: user:key from two variables. */
  type: "bearer" | "header" | "query" | "basic" | "none";
  /** The environment variable(s) holding the secret (basic: [user, password]). A declaration's `apiKey:` overrides it. */
  env?: string | string[];
  /** The header or query parameter name, for header/query auth. */
  name?: string;
}

export interface HttpProviderSpec {
  kind: "http";
  description: string;
  /** e.g. "https://api.stripe.com/v1". `{{name}}` parts are filled from the tool declaration (e.g. a Jira site). */
  baseUrl: string;
  auth?: HttpAuth;
  /** How POST/PUT/PATCH send their arguments. Default json. */
  body?: "json" | "form";
  /** Fixed headers sent with every request, e.g. an API version. */
  headers?: Record<string, string>;
  methods: HttpMethodSpec[];
}

export interface McpProviderSpec {
  kind: "mcp";
  description: string;
  /** A stdio server's command, e.g. "npx -y @modelcontextprotocol/server-github". */
  command?: string;
  /** Or a Streamable HTTP endpoint. */
  url?: string;
  /** Environment variables passed to a stdio server. */
  env?: string[];
}

export interface ModuleProviderSpec {
  kind: "module";
  description: string;
  /** The module file, relative to the package. It exports `provider` (a ToolProvider) and `info` (its ProviderInfo). */
  entry: string;
}

export type ProviderSpec = HttpProviderSpec | McpProviderSpec | ModuleProviderSpec;

export interface ToolManifest {
  name: string;
  version: string;
  description: string;
  publisher?: string;
  homepage?: string;
  license?: string;
  /** Provider names, used as `tool X : <Name>(...)`. */
  providers: Record<string, ProviderSpec>;
}

/** What installing a package lets it do, shown before install and recorded in the lockfile. */
export interface Permissions {
  /** Hosts its requests go to. */
  network: string[];
  /** Environment variables it reads. */
  env: string[];
  /** Commands it starts. */
  spawn: string[];
  /** Whether it runs its own code (module providers, stdio MCP servers). */
  code: boolean;
}

export const MANIFEST_FILE = "halo-tool.json";
const NAME = /^[a-z0-9][a-z0-9-]{0,62}$/;
const VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const PROVIDER = /^[A-Z][A-Za-z0-9]{0,40}$/;
const METHOD = /^[a-z_][a-z0-9_]{0,60}$/;
const ENV = /^[A-Z_][A-Z0-9_]*$/;
const EFFECTS = new Set(["read", "write", "external"]);

export class ManifestError extends Error {}

/** Check a manifest; returns it typed, or throws listing every problem. */
export function checkManifest(raw: unknown, reserved: Iterable<string> = []): ToolManifest {
  const problems: string[] = [];
  const bad = (m: string) => problems.push(m);
  const m = raw as ToolManifest;
  if (!m || typeof m !== "object") throw new ManifestError(`${MANIFEST_FILE} must be a JSON object`);
  if (typeof m.name !== "string" || !NAME.test(m.name)) bad(`name must be lowercase letters, digits and dashes (got ${JSON.stringify(m.name)})`);
  if (typeof m.version !== "string" || !VERSION.test(m.version)) bad(`version must look like 1.2.3 (got ${JSON.stringify(m.version)})`);
  if (typeof m.description !== "string" || !m.description.trim()) bad("description is required");
  const taken = new Set(reserved);
  const providers = m.providers && typeof m.providers === "object" ? Object.entries(m.providers) : [];
  if (!providers.length) bad("providers must declare at least one provider");
  for (const [name, p] of providers) {
    const at = `providers.${name}`;
    if (!PROVIDER.test(name)) bad(`${at}: provider names start with a capital letter and use letters and digits`);
    if (taken.has(name)) bad(`${at}: "${name}" is already a provider (built in, or from another package)`);
    if (!p || typeof p !== "object") {
      bad(`${at} must be an object`);
      continue;
    }
    if (typeof p.description !== "string" || !p.description.trim()) bad(`${at}.description is required`);
    if (p.kind === "http") checkHttp(p, at, bad);
    else if (p.kind === "mcp") {
      if (!!p.command === !!p.url) bad(`${at}: an mcp provider needs a command or a url (one of them)`);
      if (p.url && !isWebUrl(p.url)) bad(`${at}.url must be an https URL`);
      for (const e of p.env ?? []) if (!ENV.test(e)) bad(`${at}.env: "${e}" is not an environment variable name`);
    } else if (p.kind === "module") {
      if (typeof p.entry !== "string" || !safeRelative(p.entry)) bad(`${at}.entry must be a path inside the package`);
    } else bad(`${at}.kind must be http, mcp, or module`);
  }
  if (problems.length) throw new ManifestError(`Invalid ${MANIFEST_FILE}${typeof m.name === "string" ? ` for "${m.name}"` : ""}:\n  - ${problems.join("\n  - ")}`);
  return m;
}

function checkHttp(p: HttpProviderSpec, at: string, bad: (m: string) => void) {
  // `{{site}}` placeholders may fill a tenant's subdomain or part of the path.
  if (typeof p.baseUrl !== "string" || !isWebUrl(p.baseUrl.replace(/\{\{\s*\w+\s*\}\}/g, "x"))) bad(`${at}.baseUrl must be an https URL (http only for localhost)`);
  const auth = p.auth;
  if (auth) {
    if (!["bearer", "header", "query", "basic", "none"].includes(auth.type)) bad(`${at}.auth.type must be bearer, header, query, basic, or none`);
    for (const e of [auth.env ?? []].flat()) if (!ENV.test(e)) bad(`${at}.auth.env: "${e}" is not an environment variable name`);
    if ((auth.type === "header" || auth.type === "query") && !auth.name) bad(`${at}.auth.name is required for ${auth.type} auth`);
    if (auth.type === "basic" && (!Array.isArray(auth.env) || auth.env.length !== 2)) bad(`${at}.auth.env must name two variables (user, password) for basic auth`);
  }
  if (p.body !== undefined && p.body !== "json" && p.body !== "form") bad(`${at}.body must be json or form`);
  if (!Array.isArray(p.methods) || !p.methods.length) return bad(`${at}.methods must list at least one method`);
  const seen = new Set<string>();
  for (const [i, method] of p.methods.entries()) {
    const where = `${at}.methods[${i}]`;
    if (typeof method.name !== "string" || !METHOD.test(method.name)) bad(`${where}.name must be lowercase snake_case`);
    else if (seen.has(method.name)) bad(`${where}: "${method.name}" is listed twice`);
    seen.add(method.name);
    if (typeof method.description !== "string" || !method.description.trim()) bad(`${where}.description is required (the model reads it)`);
    if (!EFFECTS.has(method.effect)) bad(`${where}.effect must be read, write, or external`);
    if (!method.http || !["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method.http.method)) bad(`${where}.http.method must be GET, POST, PUT, PATCH, or DELETE`);
    else if (typeof method.http.path !== "string" || !method.http.path.startsWith("/") || /\.\.|[?#]/.test(method.http.path)) bad(`${where}.http.path must start with / and contain no .., ?, or #`);
    if (method.http?.method === "GET" && method.effect !== "read") bad(`${where}: a GET method should have effect "read"`);
  }
}

/** The host of a base URL, with `{{placeholders}}` shown as `*` (e.g. "*.atlassian.net"). */
export function hostOf(baseUrl: string): string {
  return baseUrl.replace(/\{\{\s*\w+\s*\}\}/g, "*").match(/^https?:\/\/([^/?#]+)/i)?.[1]?.toLowerCase() ?? baseUrl;
}

function isWebUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || (u.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname));
  } catch {
    return false;
  }
}

/** A path inside a package: relative, no `..`, no backslashes. */
export function safeRelative(path: string): boolean {
  return !!path && !path.startsWith("/") && !path.includes("\\") && !path.split("/").some((part) => part === ".." || part === "") && !/^[A-Za-z]:/.test(path);
}

/** What a manifest's providers can reach, for the install prompt and the lockfile. */
export function permissionsOf(m: ToolManifest): Permissions {
  const network = new Set<string>();
  const env = new Set<string>();
  const spawn = new Set<string>();
  let code = false;
  for (const p of Object.values(m.providers)) {
    if (p.kind === "http") {
      network.add(hostOf(p.baseUrl));
      for (const e of [p.auth?.env ?? []].flat()) env.add(e);
    } else if (p.kind === "mcp") {
      if (p.url) network.add(new URL(p.url).hostname);
      if (p.command) {
        spawn.add(p.command);
        code = true;
      }
      for (const e of p.env ?? []) env.add(e);
    } else {
      code = true;
    }
  }
  return { network: [...network], env: [...env], spawn: [...spawn], code };
}

export function describePermissions(p: Permissions): string[] {
  return [
    `network: ${p.network.length ? p.network.join(", ") : "none declared"}`,
    `reads env: ${p.env.length ? p.env.join(", ") : "nothing"}`,
    ...(p.spawn.length ? [`starts: ${p.spawn.join("; ")}`] : []),
    `runs its own code: ${p.code ? "YES (needs --trust)" : "no"}`,
  ];
}
