/**
 * Expose Halo pipelines as MCP tools, so Claude Desktop, Claude Code, Cursor or any
 * other MCP client can run them:
 *
 *   halo mcp flows.halo          stdio (newline-delimited JSON-RPC on stdin/stdout)
 *   halo serve flows.halo        also answers Streamable HTTP at /mcp
 *
 * Each pipeline is one tool; its params become the tool's input schema. A run that
 * completes returns its output (as text, and as structuredContent). A run that fails or
 * halts is a tool error; one that pauses for approval says so, with its run id, so it
 * can be resumed through the HTTP API or Studio.
 *
 * Stateless: no sessions, no server-sent streams. Each POST carries its own answer.
 */

import { MCP_PROTOCOL_VERSION, MCP_SUPPORTED_VERSIONS } from "../runtime/mcp.js";
import type { JsonSchema } from "../runtime/tools.js";

export interface McpPipelineSource {
  list(): Array<{ name: string; description?: string; params: Array<{ name: string; type: string }> }>;
  call(name: string, args: Record<string, unknown>, signal?: AbortSignal): Promise<{ status: string; output?: unknown; runId: string; error?: string; waitingFor?: string }>;
}

export interface McpServer {
  /** Answer one JSON-RPC message; undefined for notifications and responses. */
  handleMessage(msg: unknown, signal?: AbortSignal): Promise<object | undefined>;
  /** Streamable HTTP: mount at /mcp. */
  handleHttp(req: Request): Promise<Response>;
}

type Id = string | number;

const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;
const INTERNAL_ERROR = -32603;

const PRIMITIVES: Record<string, JsonSchema> = {
  string: { type: "string" },
  text: { type: "string" },
  number: { type: "number" },
  float: { type: "number" },
  integer: { type: "integer" },
  int: { type: "integer" },
  boolean: { type: "boolean" },
  bool: { type: "boolean" },
  object: { type: "object" },
  map: { type: "object" },
  json: {},
  any: {},
};

/**
 * JSON Schema for a Halo type: String, Number, Integer, Boolean, Array/List (of T),
 * Object/Map, JSON/Any. A trailing ? (optional) is ignored here; named schemas and
 * other unknown names are objects.
 */
export function haloTypeToJsonSchema(type: string): JsonSchema {
  const t = type.trim().replace(/\?$/, "").trim();
  const generic = t.match(/^(\w+)\s*<\s*([\s\S]+)>$/);
  if (generic) {
    const outer = generic[1]!.toLowerCase();
    if (outer === "array" || outer === "list") return { type: "array", items: haloTypeToJsonSchema(generic[2]!) };
    if (outer === "map" || outer === "object") {
      // Map<K, V>: the value type is the last argument.
      const parts = generic[2]!.split(",");
      return { type: "object", additionalProperties: haloTypeToJsonSchema(parts[parts.length - 1]!) };
    }
  }
  if (/\[\]$/.test(t)) return { type: "array", items: haloTypeToJsonSchema(t.slice(0, -2)) };
  const lower = t.toLowerCase();
  if (lower === "array" || lower === "list") return { type: "array" };
  return { ...(PRIMITIVES[lower] ?? { type: "object" }) };
}

function inputSchema(params: Array<{ name: string; type: string }>): JsonSchema {
  const properties: Record<string, JsonSchema> = {};
  const required: string[] = [];
  for (const p of params) {
    properties[p.name] = haloTypeToJsonSchema(p.type);
    if (!p.type.trim().endsWith("?")) required.push(p.name);
  }
  return { type: "object", properties, ...(required.length ? { required } : {}) };
}

function outputText(output: unknown): string {
  if (output === undefined || output === null) return "";
  return typeof output === "string" ? output : JSON.stringify(output, null, 2);
}

export function createMcpServer(source: McpPipelineSource, info: { name: string; version: string } = { name: "halo", version: "0.3.0" }): McpServer {
  /** In-flight tools/call requests, so notifications/cancelled can stop them. */
  const inflight = new Map<Id, AbortController>();

  const ok = (id: Id, result: unknown) => ({ jsonrpc: "2.0", id, result });
  const fail = (id: Id | null, code: number, message: string) => ({ jsonrpc: "2.0", id, error: { code, message } });

  async function callTool(id: Id, params: any, signal?: AbortSignal): Promise<object> {
    const name = params?.name;
    if (typeof name !== "string") return fail(id, INVALID_PARAMS, "tools/call needs a tool name");
    if (!source.list().some((p) => p.name === name)) return fail(id, INVALID_PARAMS, `Unknown tool: ${name}`);
    const args = params.arguments ?? {};
    if (typeof args !== "object" || Array.isArray(args)) return fail(id, INVALID_PARAMS, "tools/call arguments must be an object");
    const controller = new AbortController();
    inflight.set(id, controller);
    const both = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
    try {
      const run = await source.call(name, args, both);
      const text = (t: string, isError = false) => ok(id, { content: [{ type: "text", text: t }], ...(isError ? { isError: true } : {}) });
      switch (run.status) {
        case "completed": {
          const out = run.output;
          // structuredContent must be an object; other values travel as text only.
          const structured = out !== null && typeof out === "object" && !Array.isArray(out) ? { structuredContent: out } : {};
          return ok(id, { content: [{ type: "text", text: outputText(out) }], ...structured });
        }
        case "paused":
          return text(`Paused waiting for ${run.waitingFor ?? "approval"}, run id ${run.runId}. Resume it through the Halo HTTP API or Studio.`);
        case "halted":
          return text(`Halted${run.error ? `: ${run.error}` : ""} (run id ${run.runId})${run.output !== undefined ? `\n${outputText(run.output)}` : ""}`, true);
        default:
          return text(`Run ${run.status}${run.error ? `: ${run.error}` : ""} (run id ${run.runId})`, true);
      }
    } catch (err) {
      return ok(id, { content: [{ type: "text", text: err instanceof Error ? err.message : String(err) }], isError: true });
    } finally {
      inflight.delete(id);
    }
  }

  async function handleMessage(raw: unknown, signal?: AbortSignal): Promise<object | undefined> {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fail(null, INVALID_REQUEST, "Invalid request");
    const msg = raw as { jsonrpc?: string; id?: Id | null; method?: unknown; params?: any };
    // Responses to requests we never send: ignore.
    if (typeof msg.method !== "string") return undefined;
    const isRequest = msg.id !== undefined && msg.id !== null;
    if (!isRequest) {
      if (msg.method === "notifications/cancelled") inflight.get(msg.params?.requestId)?.abort(new Error("cancelled by the client"));
      return undefined;
    }
    const id = msg.id as Id;
    try {
      switch (msg.method) {
        case "initialize": {
          const asked = msg.params?.protocolVersion;
          return ok(id, {
            protocolVersion: MCP_SUPPORTED_VERSIONS.includes(asked) ? asked : MCP_PROTOCOL_VERSION,
            capabilities: { tools: { listChanged: false } },
            serverInfo: info,
          });
        }
        case "ping":
          return ok(id, {});
        case "tools/list":
          return ok(id, {
            tools: source.list().map((p) => ({ name: p.name, description: p.description ?? `Run the ${p.name} pipeline.`, inputSchema: inputSchema(p.params) })),
          });
        case "tools/call":
          return await callTool(id, msg.params, signal);
        default:
          return fail(id, METHOD_NOT_FOUND, `Method not found: ${msg.method}`);
      }
    } catch (err) {
      return fail(id, INTERNAL_ERROR, err instanceof Error ? err.message : String(err));
    }
  }

  async function handleHttp(req: Request): Promise<Response> {
    if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST" } });
    // Guard against DNS rebinding: a browser page from another origin can't drive the server.
    const origin = req.headers.get("origin");
    if (origin) {
      let same = false;
      try {
        same = new URL(origin).host === new URL(req.url).host;
      } catch {}
      if (!same) return Response.json(fail(null, INVALID_REQUEST, "Origin not allowed"), { status: 403 });
    }
    const version = req.headers.get("mcp-protocol-version");
    if (version && !MCP_SUPPORTED_VERSIONS.includes(version)) {
      return Response.json(fail(null, INVALID_REQUEST, `Unsupported MCP-Protocol-Version: ${version}`), { status: 400 });
    }
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json(fail(null, PARSE_ERROR, "Parse error"), { status: 400 });
    }
    if (Array.isArray(body)) {
      if (!body.length) return Response.json(fail(null, INVALID_REQUEST, "Empty batch"), { status: 400 });
      const answers = (await Promise.all(body.map((m) => handleMessage(m, req.signal)))).filter((a) => a !== undefined);
      return answers.length ? Response.json(answers) : new Response(null, { status: 202 });
    }
    const answer = await handleMessage(body, req.signal);
    return answer ? Response.json(answer) : new Response(null, { status: 202 });
  }

  return { handleMessage, handleHttp };
}

/**
 * Serve over stdio: one JSON-RPC message per line on stdin, answers on stdout.
 * Nothing else may be written to stdout (log to stderr). Resolves when stdin ends and
 * in-flight calls have answered.
 */
export async function serveMcpStdio(
  server: McpServer,
  io: { input?: ReadableStream<Uint8Array>; write?: (line: string) => void } = {},
): Promise<void> {
  const input = io.input ?? Bun.stdin.stream();
  const write = io.write ?? ((line: string) => void process.stdout.write(line));
  const send = (msg: object | undefined) => msg !== undefined && write(`${JSON.stringify(msg)}\n`);
  const pending = new Set<Promise<void>>();
  const handle = (line: string) => {
    let msg: unknown;
    try {
      msg = JSON.parse(line);
    } catch {
      send({ jsonrpc: "2.0", id: null, error: { code: PARSE_ERROR, message: "Parse error" } });
      return;
    }
    // Requests run concurrently, so a long pipeline doesn't block ping or cancellation.
    const work = (async () => {
      if (Array.isArray(msg)) {
        const answers = (await Promise.all(msg.map((m) => server.handleMessage(m)))).filter((a) => a !== undefined);
        if (answers.length) send(answers);
      } else send(await server.handleMessage(msg));
    })().catch((err) => console.error("[halo mcp]", err));
    pending.add(work);
    void work.finally(() => pending.delete(work));
  };
  const decoder = new TextDecoder();
  let buf = "";
  for await (const chunk of input) {
    buf += decoder.decode(chunk, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (line) handle(line);
    }
  }
  if (buf.trim()) handle(buf.trim());
  await Promise.all(pending);
}
