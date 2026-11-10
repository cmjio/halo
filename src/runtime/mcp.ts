/**
 * MCP: use a Model Context Protocol server's tools as a Halo tool.
 *
 *   tool Git  : MCP("npx -y @modelcontextprotocol/server-github", env: ["GITHUB_TOKEN"])
 *   tool Docs : MCP(url: "https://example.com/mcp", apiKey: Env.DOCS_KEY)
 *
 *   |> Docs.search_docs(query: "rate limits")     tools/call, name "search_docs"
 *   |> Docs.list_tools()                          the server's tools
 *   |> Docs.list_resources() / Docs.read_resource(uri: "file:///README.md")
 *
 * A command runs the server as a child process speaking JSON-RPC over stdio. It is
 * spawned without a shell, and sees only PATH, HOME and the variables named in `env:`
 * (or given as `env: { NAME: value }`). A URL speaks Streamable HTTP. One connection
 * per declaration config is opened on first use, initialized once, and reused across
 * calls and runs; a stdio server that exits is restarted on the next call.
 * `closeMcpClients()` shuts them all down.
 */

import { HaloError, TimeoutError } from "./errors.js";
import type { JsonSchema, ProviderInfo, ToolCall, ToolEffect, ToolInfoContext, ToolMethod, ToolProvider, ToolServices } from "./tools.js";

export const MCP_PROTOCOL_VERSION = "2025-06-18";
/** Versions we can talk to: a server may answer initialize with an older one. */
export const MCP_SUPPORTED_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];

const DEFAULT_TIMEOUT_MS = 60_000;
const CLIENT_INFO = { name: "halo", version: "0.6.1" };

/** Methods every MCP tool has, in addition to the server's own tools. */
const BUILTIN_METHODS = new Set(["list_tools", "list_resources", "read_resource"]);

// ── JSON-RPC ──

type JsonRpcId = number | string;

interface JsonRpcMessage {
  jsonrpc: "2.0";
  id?: JsonRpcId | null;
  method?: string;
  params?: any;
  result?: any;
  error?: { code: number; message: string; data?: unknown };
}

/** A JSON-RPC error answered by the server. */
export class McpError extends HaloError {
  constructor(message: string, readonly rpcCode: number, readonly data?: unknown) {
    super(message, { code: "TOOL_FAILED" });
    this.name = "McpError";
  }
}

/** One way of exchanging JSON-RPC messages with a server. */
interface Transport {
  /** Send a request and wait for its response (or throw). */
  request(msg: JsonRpcMessage, signal: AbortSignal): Promise<JsonRpcMessage>;
  notify(msg: JsonRpcMessage): Promise<void>;
  /** False once the server is gone (a stdio process that exited); the client then reconnects. */
  readonly alive: boolean;
  /** Set after initialize, for transports that send it with each request. */
  protocolVersion?: string;
  onNotification?: (msg: JsonRpcMessage) => void;
  close(): Promise<void>;
}

/** Answer the requests a server may send us: ping, and nothing else we support. */
function answerServerRequest(msg: JsonRpcMessage): JsonRpcMessage {
  if (msg.method === "ping") return { jsonrpc: "2.0", id: msg.id, result: {} };
  if (msg.method === "roots/list") return { jsonrpc: "2.0", id: msg.id, result: { roots: [] } };
  return { jsonrpc: "2.0", id: msg.id, error: { code: -32601, message: `Method not supported by Halo: ${msg.method}` } };
}

// ── Command lines ──

/**
 * Split a command into argv like a shell would for simple cases: whitespace separates,
 * '...' is literal, "..." allows \" and \\, and a backslash outside quotes escapes the next
 * character. No variables, globs or operators: the command never runs through a shell.
 */
export function splitCommand(command: string): string[] {
  const out: string[] = [];
  let cur = "";
  let has = false;
  let quote: "'" | '"' | null = null;
  for (let i = 0; i < command.length; i++) {
    const c = command[i]!;
    if (quote === "'") {
      if (c === "'") quote = null;
      else cur += c;
    } else if (quote === '"') {
      if (c === '"') quote = null;
      else if (c === "\\" && (command[i + 1] === '"' || command[i + 1] === "\\")) cur += command[++i];
      else cur += c;
    } else if (c === "'" || c === '"') {
      quote = c;
      has = true;
    } else if (c === "\\" && i + 1 < command.length) {
      cur += command[++i];
      has = true;
    } else if (/\s/.test(c)) {
      if (has) out.push(cur);
      cur = "";
      has = false;
    } else {
      cur += c;
      has = true;
    }
  }
  if (quote) throw new HaloError(`Unclosed ${quote} in MCP command: ${command}`, { code: "TOOL_CONFIG" });
  if (has) out.push(cur);
  return out;
}

// ── stdio ──

class StdioTransport implements Transport {
  private proc: ReturnType<typeof Bun.spawn<"pipe", "pipe", "pipe">>;
  private pending = new Map<JsonRpcId, { resolve: (m: JsonRpcMessage) => void; reject: (e: unknown) => void }>();
  private stderrTail = "";
  private exited = false;
  protocolVersion?: string;
  onNotification?: (msg: JsonRpcMessage) => void;

  constructor(private label: string, argv: string[], env: Record<string, string>, cwd?: string) {
    try {
      this.proc = Bun.spawn(argv, { env, cwd, stdin: "pipe", stdout: "pipe", stderr: "pipe" });
    } catch (err) {
      throw new HaloError(`${label}: could not start MCP server "${argv.join(" ")}": ${(err as Error).message}`, { code: "TOOL_CONFIG", cause: err });
    }
    void this.readStdout();
    void this.readStderr();
    void this.proc.exited.then((code) => {
      this.exited = true;
      const tail = this.stderrTail.trim();
      const err = new HaloError(`${label}: MCP server exited (code ${code})${tail ? `: ${tail.slice(-500)}` : ""}`, { code: "TOOL_FAILED", retryable: true });
      for (const p of this.pending.values()) p.reject(err);
      this.pending.clear();
    });
  }

  get alive(): boolean {
    return !this.exited;
  }

  private async readStdout(): Promise<void> {
    const decoder = new TextDecoder();
    let buf = "";
    for await (const chunk of this.proc.stdout) {
      buf += decoder.decode(chunk, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (line) this.receive(line);
      }
    }
  }

  private async readStderr(): Promise<void> {
    const decoder = new TextDecoder();
    // Servers log to stderr; keep the last few KB for error messages.
    for await (const chunk of this.proc.stderr) this.stderrTail = (this.stderrTail + decoder.decode(chunk, { stream: true })).slice(-4000);
  }

  private receive(line: string): void {
    let msg: JsonRpcMessage;
    try {
      msg = JSON.parse(line);
    } catch {
      return; // Not JSON-RPC (a server that prints a banner to stdout): skip it.
    }
    if (msg.method !== undefined) {
      if (msg.id !== undefined && msg.id !== null) this.write(answerServerRequest(msg));
      else this.onNotification?.(msg);
      return;
    }
    if (msg.id === undefined || msg.id === null) return;
    const p = this.pending.get(msg.id);
    if (p) {
      this.pending.delete(msg.id);
      p.resolve(msg);
    }
  }

  private write(msg: JsonRpcMessage): void {
    if (this.exited) throw new HaloError(`${this.label}: MCP server is not running`, { code: "TOOL_FAILED", retryable: true });
    this.proc.stdin.write(`${JSON.stringify(msg)}\n`);
    this.proc.stdin.flush();
  }

  request(msg: JsonRpcMessage, signal: AbortSignal): Promise<JsonRpcMessage> {
    return new Promise((resolve, reject) => {
      const id = msg.id!;
      const onAbort = () => {
        if (!this.pending.delete(id)) return;
        // Tell the server to stop working on it.
        try {
          this.write({ jsonrpc: "2.0", method: "notifications/cancelled", params: { requestId: id, reason: "aborted" } });
        } catch {}
        reject(signal.reason);
      };
      if (signal.aborted) return reject(signal.reason);
      signal.addEventListener("abort", onAbort, { once: true });
      this.pending.set(id, {
        resolve: (m) => (signal.removeEventListener("abort", onAbort), resolve(m)),
        reject: (e) => (signal.removeEventListener("abort", onAbort), reject(e)),
      });
      try {
        this.write(msg);
      } catch (err) {
        this.pending.delete(id);
        signal.removeEventListener("abort", onAbort);
        reject(err);
      }
    });
  }

  async notify(msg: JsonRpcMessage): Promise<void> {
    this.write(msg);
  }

  async close(): Promise<void> {
    if (this.exited) return;
    try {
      this.proc.stdin.end();
    } catch {}
    // Give the server a moment to exit on EOF, then make sure.
    const timer = setTimeout(() => this.proc.kill(), 1000);
    await this.proc.exited;
    clearTimeout(timer);
  }
}

// ── Streamable HTTP ──

/** Parse a text/event-stream body into its `data:` payloads. */
async function* sseMessages(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  let buf = "";
  let data: string[] = [];
  for await (const chunk of body) {
    buf += decoder.decode(chunk, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).replace(/\r$/, "");
      buf = buf.slice(nl + 1);
      if (line === "") {
        if (data.length) yield data.join("\n");
        data = [];
      } else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
    }
  }
  if (data.length) yield data.join("\n");
}

class HttpTransport implements Transport {
  private sessionId?: string;
  protocolVersion?: string;
  onNotification?: (msg: JsonRpcMessage) => void;
  readonly alive = true;

  constructor(private label: string, private url: string, private headers: Record<string, string>, private fetchFn: typeof fetch) {}

  private async post(msg: JsonRpcMessage, signal?: AbortSignal): Promise<Response> {
    const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json, text/event-stream", ...this.headers };
    if (this.sessionId) headers["Mcp-Session-Id"] = this.sessionId;
    if (this.protocolVersion) headers["MCP-Protocol-Version"] = this.protocolVersion;
    const res = await this.fetchFn(this.url, { method: "POST", headers, body: JSON.stringify(msg), signal });
    const session = res.headers.get("mcp-session-id");
    if (session) this.sessionId = session;
    return res;
  }

  private async fail(res: Response): Promise<never> {
    const text = (await res.text().catch(() => "")).slice(0, 500);
    // 404 with a session means the server forgot it: the client re-initializes.
    if (res.status === 404 && this.sessionId) {
      this.sessionId = undefined;
      throw new HaloError(`${this.label}: MCP session expired`, { code: "MCP_SESSION_EXPIRED", retryable: true });
    }
    const auth = res.status === 401 || res.status === 403 ? " (check the tool's apiKey:)" : "";
    throw new HaloError(`${this.label}: MCP server answered ${res.status}${auth}${text ? `: ${text}` : ""}`, { code: "TOOL_FAILED", retryable: res.status === 429 || res.status >= 500 });
  }

  async request(msg: JsonRpcMessage, signal: AbortSignal): Promise<JsonRpcMessage> {
    const res = await this.post(msg, signal);
    if (!res.ok) return this.fail(res);
    const type = res.headers.get("content-type") ?? "";
    const handle = (m: JsonRpcMessage): JsonRpcMessage | undefined => {
      if (m.method !== undefined) {
        if (m.id !== undefined && m.id !== null) void this.post(answerServerRequest(m)).catch(() => {});
        else this.onNotification?.(m);
        return undefined;
      }
      return m.id === msg.id ? m : undefined;
    };
    if (type.includes("text/event-stream") && res.body) {
      for await (const data of sseMessages(res.body)) {
        let parsed: JsonRpcMessage | JsonRpcMessage[];
        try {
          parsed = JSON.parse(data);
        } catch {
          continue;
        }
        for (const m of Array.isArray(parsed) ? parsed : [parsed]) {
          const found = handle(m);
          if (found) {
            void res.body.cancel().catch(() => {});
            return found;
          }
        }
      }
      throw new HaloError(`${this.label}: MCP server closed the stream without answering ${msg.method}`, { code: "TOOL_FAILED", retryable: true });
    }
    const text = await res.text();
    let parsed: JsonRpcMessage | JsonRpcMessage[];
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new HaloError(`${this.label}: MCP server sent a response that is not JSON: ${text.slice(0, 200)}`, { code: "TOOL_FAILED" });
    }
    for (const m of Array.isArray(parsed) ? parsed : [parsed]) {
      const found = handle(m);
      if (found) return found;
    }
    throw new HaloError(`${this.label}: MCP server did not answer ${msg.method}`, { code: "TOOL_FAILED" });
  }

  async notify(msg: JsonRpcMessage): Promise<void> {
    const res = await this.post(msg);
    if (!res.ok && res.status !== 202) return this.fail(res);
    await res.body?.cancel().catch(() => {});
  }

  async close(): Promise<void> {
    // End the session, when the server gave us one (it may answer 405: that's fine).
    if (!this.sessionId) return;
    const headers: Record<string, string> = { ...this.headers, "Mcp-Session-Id": this.sessionId };
    if (this.protocolVersion) headers["MCP-Protocol-Version"] = this.protocolVersion;
    this.sessionId = undefined;
    await this.fetchFn(this.url, { method: "DELETE", headers, signal: AbortSignal.timeout(2000) }).then((r) => r.body?.cancel(), () => {});
  }
}

// ── Client ──

export interface McpToolInfo {
  name: string;
  title?: string;
  description?: string;
  inputSchema?: JsonSchema;
  outputSchema?: JsonSchema;
  annotations?: { title?: string; readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean; openWorldHint?: boolean };
}

export type McpTarget =
  | { kind: "stdio"; argv: string[]; env: Record<string, string>; cwd?: string }
  | { kind: "http"; url: string; headers: Record<string, string> };

/** A connection to one MCP server, initialized once and reconnected when it drops. */
export class McpClient {
  private transport?: Transport;
  private ready?: Promise<Transport>;
  private nextId = 1;
  private toolCache?: McpToolInfo[];
  /** What the server said about itself in initialize. */
  server?: { protocolVersion: string; capabilities: Record<string, unknown>; serverInfo?: { name: string; version?: string }; instructions?: string };

  constructor(readonly label: string, private target: McpTarget, private fetchFn: typeof fetch = fetch, private timeoutMs = DEFAULT_TIMEOUT_MS) {}

  private open(): Transport {
    const t = this.target;
    return t.kind === "stdio" ? new StdioTransport(this.label, t.argv, t.env, t.cwd) : new HttpTransport(this.label, t.url, t.headers, this.fetchFn);
  }

  private connect(signal: AbortSignal): Promise<Transport> {
    if (this.ready && this.transport?.alive !== false) return this.ready;
    this.toolCache = undefined;
    const transport = this.open();
    transport.onNotification = (m) => {
      if (m.method === "notifications/tools/list_changed") this.toolCache = undefined;
    };
    this.transport = transport;
    const ready = (async () => {
      const init = await this.send(transport, "initialize", { protocolVersion: MCP_PROTOCOL_VERSION, capabilities: {}, clientInfo: CLIENT_INFO }, signal);
      if (!MCP_SUPPORTED_VERSIONS.includes(init?.protocolVersion)) {
        await transport.close();
        throw new HaloError(`${this.label}: MCP server speaks protocol version ${init?.protocolVersion}, Halo supports ${MCP_SUPPORTED_VERSIONS.join(", ")}`, { code: "TOOL_CONFIG" });
      }
      transport.protocolVersion = init.protocolVersion;
      this.server = { protocolVersion: init.protocolVersion, capabilities: init.capabilities ?? {}, serverInfo: init.serverInfo, instructions: init.instructions };
      await transport.notify({ jsonrpc: "2.0", method: "notifications/initialized" });
      return transport;
    })();
    this.ready = ready;
    // A failed connect isn't cached: the next call tries again.
    ready.catch(() => {
      if (this.ready === ready) {
        this.ready = undefined;
        this.transport = undefined;
        void transport.close().catch(() => {});
      }
    });
    return ready;
  }

  private async send(transport: Transport, method: string, params: unknown, signal: AbortSignal): Promise<any> {
    const timeout = AbortSignal.timeout(this.timeoutMs);
    const both = AbortSignal.any([signal, timeout]);
    try {
      const res = await transport.request({ jsonrpc: "2.0", id: this.nextId++, method, params }, both);
      if (res.error) throw new McpError(`${this.label}: ${method} failed: ${res.error.message}`, res.error.code, res.error.data);
      return res.result;
    } catch (err) {
      if (timeout.aborted && !signal.aborted) throw new TimeoutError(`${this.label}: MCP ${method} took longer than ${this.timeoutMs}ms`);
      throw err;
    }
  }

  /** Send a request, connecting (or reconnecting) first. */
  async request(method: string, params: unknown, signal: AbortSignal = new AbortController().signal): Promise<any> {
    try {
      return await this.send(await this.connect(signal), method, params, signal);
    } catch (err) {
      // The HTTP server forgot our session: initialize again, once.
      if (err instanceof HaloError && err.code === "MCP_SESSION_EXPIRED") {
        this.ready = undefined;
        return this.send(await this.connect(signal), method, params, signal);
      }
      throw err;
    }
  }

  /** All the server's tools, following `nextCursor`. Cached until the server says they changed. */
  async listTools(signal?: AbortSignal): Promise<McpToolInfo[]> {
    if (this.toolCache && this.transport?.alive) return this.toolCache;
    const tools: McpToolInfo[] = [];
    let cursor: string | undefined;
    do {
      const page = await this.request("tools/list", cursor ? { cursor } : {}, signal);
      tools.push(...(page?.tools ?? []));
      cursor = typeof page?.nextCursor === "string" && page.nextCursor ? page.nextCursor : undefined;
    } while (cursor);
    this.toolCache = tools;
    return tools;
  }

  async listResources(signal?: AbortSignal): Promise<unknown[]> {
    const resources: unknown[] = [];
    let cursor: string | undefined;
    do {
      const page = await this.request("resources/list", cursor ? { cursor } : {}, signal);
      resources.push(...(page?.resources ?? []));
      cursor = typeof page?.nextCursor === "string" && page.nextCursor ? page.nextCursor : undefined;
    } while (cursor);
    return resources;
  }

  async close(): Promise<void> {
    const t = this.transport;
    this.transport = undefined;
    this.ready = undefined;
    this.toolCache = undefined;
    await t?.close().catch(() => {});
  }
}

// ── Connections per declaration ──

const clients = new Map<string, McpClient>();

type Config = (name: string | number) => unknown;

/** Where a declaration's server lives: a URL (positional or `url:`) or a command. */
export function mcpTarget(label: string, config: Config, environ: Record<string, string | undefined> = process.env): McpTarget {
  const first = config(0);
  const url = config("url") ?? (typeof first === "string" && /^https?:\/\//i.test(first.trim()) ? first.trim() : undefined);
  if (url !== undefined) {
    if (typeof url !== "string" || !/^https?:\/\//i.test(url)) throw new HaloError(`Tool "${label}": MCP url: must be an http(s) URL`, { code: "TOOL_CONFIG" });
    const headers: Record<string, string> = {};
    const extra = config("headers");
    if (extra && typeof extra === "object") for (const [k, v] of Object.entries(extra)) headers[k] = String(v);
    const key = config("apiKey");
    if (typeof key === "string" && key) headers.Authorization = `Bearer ${key}`;
    return { kind: "http", url, headers };
  }
  const command = first ?? config("command");
  if (typeof command !== "string" || !command.trim()) {
    throw new HaloError(`Tool "${label}" needs a server command or url:, e.g. MCP("npx -y @modelcontextprotocol/server-everything") or MCP(url: "https://example.com/mcp")`, { code: "TOOL_CONFIG" });
  }
  const argv = splitCommand(command);
  // The child sees only PATH and HOME, plus what the declaration passes on.
  const env: Record<string, string> = {};
  for (const name of ["PATH", "HOME"]) if (process.env[name] !== undefined) env[name] = process.env[name]!;
  // Passed-on variables come from the runtime's environment (RuntimeConfig.env), like Env.NAME does.
  const pass = config("env");
  if (Array.isArray(pass)) {
    for (const name of pass) {
      if (typeof name !== "string") throw new HaloError(`Tool "${label}": env: lists variable names, e.g. env: ["GITHUB_TOKEN"]`, { code: "TOOL_CONFIG" });
      if (environ[name] !== undefined) env[name] = environ[name]!;
    }
  } else if (pass && typeof pass === "object") {
    for (const [k, v] of Object.entries(pass)) if (v !== undefined && v !== null) env[k] = typeof v === "string" ? v : JSON.stringify(v);
  } else if (pass !== undefined && pass !== null) {
    throw new HaloError(`Tool "${label}": env: must be a list of variable names, e.g. env: ["GITHUB_TOKEN"]`, { code: "TOOL_CONFIG" });
  }
  const cwd = config("cwd");
  return { kind: "stdio", argv, env, ...(typeof cwd === "string" ? { cwd } : {}) };
}

/** The shared client for a declaration's config (a new one when the config differs). */
export function mcpClient(label: string, config: Config, fetchFn: typeof fetch = fetch, environ?: Record<string, string | undefined>): McpClient {
  const target = mcpTarget(label, config, environ);
  const timeoutMs = Number(config("timeout_ms") ?? DEFAULT_TIMEOUT_MS);
  // Hash the config, so keys and tokens don't sit in the map's keys as plain text.
  const key = String(Bun.hash(JSON.stringify([target, timeoutMs])));
  let client = clients.get(key);
  if (!client) {
    client = new McpClient(label, target, fetchFn, Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS);
    clients.set(key, client);
  }
  return client;
}

/** Shut down every MCP connection (stdio servers exit). Call from the runtime's close(). */
export async function closeMcpClients(): Promise<void> {
  const all = [...clients.values()];
  clients.clear();
  await Promise.all(all.map((c) => c.close()));
}

// ── Results ──

function maybeJson(text: string): unknown {
  if (/^\s*[[{"]/.test(text)) {
    try {
      return JSON.parse(text);
    } catch {}
  }
  return text;
}

function contentItem(item: any): unknown {
  switch (item?.type) {
    case "text":
      return item.text;
    case "image":
    case "audio":
      return { type: item.type, mimeType: item.mimeType, data: item.data };
    case "resource":
      return item.resource?.text !== undefined ? maybeJson(item.resource.text) : item.resource;
    default:
      return item;
  }
}

/** A tools/call result as a Halo value: structuredContent, else the text (JSON parsed), else the content items. */
export function mcpResultValue(result: any): unknown {
  if (result?.structuredContent !== undefined && result.structuredContent !== null) return result.structuredContent;
  const content: any[] = Array.isArray(result?.content) ? result.content : [];
  if (content.every((c) => c?.type === "text")) return maybeJson(content.map((c) => c.text).join("\n"));
  const items = content.map(contentItem);
  return items.length === 1 ? items[0] : items;
}

function errorText(result: any): string {
  const content: any[] = Array.isArray(result?.content) ? result.content : [];
  const text = content.filter((c) => c?.type === "text").map((c) => c.text).join("\n").trim();
  return text || "the tool reported an error";
}

// ── Provider ──

function effectOf(tool: McpToolInfo): ToolEffect {
  const a = tool.annotations ?? {};
  if (a.readOnlyHint === true) return "read";
  if (a.destructiveHint === true || a.openWorldHint === true) return "external";
  return "write";
}

/** Map a server tool to the method an agent sees. */
export function mcpToolMethod(tool: McpToolInfo): ToolMethod {
  return {
    name: tool.name,
    description: tool.description ?? tool.annotations?.title ?? tool.title ?? tool.name,
    params: tool.inputSchema ?? { type: "object", properties: {} },
    effect: effectOf(tool),
  };
}

/** Call args: named args, plus an explicit positional object merged in, or a lone value for the tool's first required param. */
function toolArguments(call: ToolCall, tool: McpToolInfo | undefined): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  if (!call.implicitInput) {
    const [first, ...more] = call.positional;
    if (more.length) throw new HaloError(`${call.tool.name}.${call.method}: pass MCP tool arguments by name, e.g. ${call.tool.name}.${call.method}(query: "...")`, { code: "TOOL_ARGUMENT" });
    if (first && typeof first === "object" && !Array.isArray(first)) Object.assign(args, first);
    else if (first !== undefined) {
      const schema = tool?.inputSchema;
      const name = schema?.required?.[0] ?? (schema?.properties && Object.keys(schema.properties).length === 1 ? Object.keys(schema.properties)[0] : undefined);
      if (!name) throw new HaloError(`${call.tool.name}.${call.method}: pass MCP tool arguments by name, e.g. ${call.tool.name}.${call.method}(name: value)`, { code: "TOOL_ARGUMENT" });
      args[name] = first;
    }
  }
  Object.assign(args, call.named);
  return args;
}

export const mcpProvider: ToolProvider = async (call, services) => {
  const client = mcpClient(call.tool.name, call.config, services.fetch, services.env);
  const signal = call.signal;
  switch (call.method) {
    case "list_tools":
      return client.listTools(signal);
    case "list_resources":
      return client.listResources(signal);
    case "read_resource": {
      const uri = call.named.uri ?? (call.implicitInput ? undefined : call.positional[0]);
      if (typeof uri !== "string" || !uri) throw new HaloError(`${call.tool.name}.read_resource needs uri: "..."`, { code: "TOOL_ARGUMENT" });
      const res = await client.request("resources/read", { uri }, signal);
      const contents: any[] = Array.isArray(res?.contents) ? res.contents : [];
      const values = contents.map((c) => (c.text !== undefined ? maybeJson(c.text) : { uri: c.uri, mimeType: c.mimeType, blob: c.blob }));
      return values.length === 1 ? values[0] : values;
    }
  }
  const tools = await client.listTools(signal);
  const tool = tools.find((t) => t.name === call.method);
  if (!tool) {
    const names = [...tools.map((t) => t.name), ...BUILTIN_METHODS];
    throw new HaloError(`MCP tool "${call.tool.name}" has no method "${call.method}" (use ${names.join(", ")})`, { code: "TOOL_METHOD" });
  }
  const result = await client.request("tools/call", { name: tool.name, arguments: toolArguments(call, tool) }, signal);
  if (result?.isError) throw new HaloError(`${call.tool.name}.${call.method}: ${errorText(result)}`, { code: "TOOL_FAILED" });
  return mcpResultValue(result);
};

export const MCP_INFO: ProviderInfo = {
  description: "A Model Context Protocol server's tools, over stdio (a command) or Streamable HTTP (url:).",
  methods: async (ctx: ToolInfoContext, services: ToolServices): Promise<ToolMethod[]> => {
    const client = mcpClient(ctx.tool.name, ctx.config, services.fetch, services.env);
    // A server tool named like one of Halo's own methods can't be called (Halo's wins), so it isn't offered.
    const methods = (await client.listTools(ctx.signal)).filter((t) => !BUILTIN_METHODS.has(t.name)).map(mcpToolMethod);
    // Resources are offered to agents only when the server has some.
    if (client.server?.capabilities.resources) {
      methods.push(
        { name: "list_resources", description: "List the resources this server offers (uri, name, description).", params: { type: "object", properties: {} }, effect: "read" },
        { name: "read_resource", description: "Read one resource by its uri.", params: { type: "object", properties: { uri: { type: "string", description: "The resource's uri" } }, required: ["uri"] }, effect: "read" },
      );
    }
    return methods;
  },
};
