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
 * can be resumed through the HTTP API or Studio. A tool's annotations (readOnlyHint,
 * destructiveHint, openWorldHint) come from its pipeline's plan, when the source gives one.
 *
 * Stateless: no sessions, no server-sent streams. Each POST carries its own answer.
 */

import pkg from "../../package.json" with { type: "json" };
import { MCP_PROTOCOL_VERSION, MCP_SUPPORTED_VERSIONS, type McpToolInfo } from "../runtime/mcp.js";
import type { JsonSchema } from "../runtime/tools.js";
import type { ParseResult } from "../parser/types.js";
import { plan, type PlanOptions } from "../plan.js";

export type McpToolAnnotations = NonNullable<McpToolInfo["annotations"]>;

export interface McpPipelineSource {
  list(): Array<{ name: string; description?: string; params: Array<{ name: string; type: string }>; annotations?: McpToolAnnotations }>;
  call(name: string, args: Record<string, unknown>, signal?: AbortSignal): Promise<{ status: string; output?: unknown; runId: string; error?: string; waitingFor?: string; approveUrl?: string }>;
}

/** What a pipeline's plan says it can do: the effect of every call it may make, and whether it can wait for a person. */
export interface PipelineEffects {
  effects: Array<{ target: string; effect: string; approval?: string }>;
  pauses: boolean;
}

/**
 * MCP annotations from a plan's effects. Only reads: readOnlyHint. Anything that writes or
 * reaches out: not read-only, and destructive (Halo can't tell an append from a delete), and
 * openWorldHint when a call is external. An effect the plan can't know (an MCP tool's)
 * claims nothing, so the client's own defaults (not read-only, destructive) apply.
 */
export function annotationsFromEffects(p: PipelineEffects): McpToolAnnotations {
  const kinds = new Set(p.effects.map((e) => e.effect));
  if (kinds.has("unknown")) return {};
  const open = kinds.has("external") || kinds.has("wallet");
  if ([...kinds].every((k) => k === "read")) return { readOnlyHint: true, openWorldHint: false };
  return { readOnlyHint: false, destructiveHint: true, openWorldHint: open };
}

/** A pipeline's effects from `halo plan`'s analysis, or undefined when it can't be planned. */
export function pipelineEffects(ast: ParseResult, pipeline: string, providerInfo: PlanOptions["providerInfo"]): PipelineEffects | undefined {
  try {
    const steps = plan(ast, pipeline, { providerInfo }).steps;
    return { effects: steps.flatMap((s) => s.effects), pauses: steps.some((s) => s.kind === "human" || s.effects.some((e) => e.approval)) };
  } catch {
    return undefined;
  }
}

/** A tool description from a pipeline's signature and plan, for an agent choosing what to call. */
export function describePipelineTool(d: { name: string; params: Array<{ name: string; type: string }>; returnType?: string; file?: string }, plan?: PipelineEffects): string {
  const sig = `${d.name}(${d.params.map((p) => `${p.name}: ${p.type}`).join(", ")})${d.returnType ? ` -> ${d.returnType}` : ""}`;
  const parts = [`Runs the Halo pipeline ${sig}${d.file ? ` from ${d.file}` : ""} and returns its output.`];
  if (plan) {
    const seen = new Map<string, string>();
    for (const e of plan.effects) if (!seen.has(e.target)) seen.set(e.target, `${e.target} (${e.effect}${e.approval ? ", asks a person first" : ""})`);
    if (seen.size) parts.push(`It may call ${[...seen.values()].slice(0, 12).join(", ")}${seen.size > 12 ? `, and ${seen.size - 12} more` : ""}.`);
    else parts.push("It calls no tools.");
    if (plan.pauses) parts.push("It can pause for a person's approval; the result then says so, with the run id.");
  }
  return parts.join(" ");
}

export interface McpServer {
  /**
   * Answer one JSON-RPC message; undefined for notifications and responses. `caller` says who
   * sent it (a token, a consumer key): a request id means something only to the caller that
   * used it, so one caller's notifications/cancelled can't stop another's call.
   */
  handleMessage(msg: unknown, signal?: AbortSignal, caller?: string): Promise<object | undefined>;
  /** Streamable HTTP: mount at /mcp. Pass who the request comes from, once it is authenticated. */
  handleHttp(req: Request, caller?: string): Promise<Response>;
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

export function createMcpServer(source: McpPipelineSource, info: { name: string; version: string } = { name: "halo", version: pkg.version }): McpServer {
  /** In-flight tools/call requests, by caller and id, so notifications/cancelled can stop them. */
  const inflight = new Map<string, Set<AbortController>>();
  const callKey = (caller: string, id: unknown) => `${caller}\u0000${typeof id}:${String(id)}`;

  const ok = (id: Id, result: unknown) => ({ jsonrpc: "2.0", id, result });
  const fail = (id: Id | null, code: number, message: string) => ({ jsonrpc: "2.0", id, error: { code, message } });

  async function callTool(id: Id, params: any, signal: AbortSignal | undefined, caller: string): Promise<object> {
    const name = params?.name;
    if (typeof name !== "string") return fail(id, INVALID_PARAMS, "tools/call needs a tool name");
    if (!source.list().some((p) => p.name === name)) return fail(id, INVALID_PARAMS, `Unknown tool: ${name}`);
    const args = params.arguments ?? {};
    if (typeof args !== "object" || Array.isArray(args)) return fail(id, INVALID_PARAMS, "tools/call arguments must be an object");
    const controller = new AbortController();
    const key = callKey(caller, id);
    const running = inflight.get(key) ?? new Set<AbortController>();
    inflight.set(key, running.add(controller));
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
        case "paused": {
          // The same, as data, so a client can show the run or hand the link to a person.
          const waitingFor = run.waitingFor ?? "approval";
          const how = run.approveUrl ? `A person can answer it at ${run.approveUrl}` : "Resume it through the Halo HTTP API or Studio";
          return ok(id, {
            content: [{ type: "text", text: `Paused waiting for ${waitingFor}, run id ${run.runId}. ${how}.` }],
            structuredContent: { status: "paused", runId: run.runId, waitingFor, ...(run.approveUrl ? { approveUrl: run.approveUrl } : {}) },
          });
        }
        case "halted":
          return text(`Halted${run.error ? `: ${run.error}` : ""} (run id ${run.runId})${run.output !== undefined ? `\n${outputText(run.output)}` : ""}`, true);
        default:
          return text(`Run ${run.status}${run.error ? `: ${run.error}` : ""} (run id ${run.runId})`, true);
      }
    } catch (err) {
      return ok(id, { content: [{ type: "text", text: err instanceof Error ? err.message : String(err) }], isError: true });
    } finally {
      running.delete(controller);
      if (!running.size) inflight.delete(key);
    }
  }

  async function handleMessage(raw: unknown, signal?: AbortSignal, caller = ""): Promise<object | undefined> {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fail(null, INVALID_REQUEST, "Invalid request");
    const msg = raw as { jsonrpc?: string; id?: Id | null; method?: unknown; params?: any };
    // Responses to requests we never send: ignore.
    if (typeof msg.method !== "string") return undefined;
    const isRequest = msg.id !== undefined && msg.id !== null;
    if (!isRequest) {
      // Only the caller that sent the request can cancel it: another caller's id 1 is a different call.
      if (msg.method === "notifications/cancelled") for (const c of inflight.get(callKey(caller, msg.params?.requestId)) ?? []) c.abort(new Error("cancelled by the client"));
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
            tools: source.list().map((p) => ({
              name: p.name,
              description: p.description ?? describePipelineTool(p),
              inputSchema: inputSchema(p.params),
              ...(p.annotations && Object.keys(p.annotations).length ? { annotations: p.annotations } : {}),
            })),
          });
        case "tools/call":
          return await callTool(id, msg.params, signal, caller);
        default:
          return fail(id, METHOD_NOT_FOUND, `Method not found: ${msg.method}`);
      }
    } catch (err) {
      return fail(id, INTERNAL_ERROR, err instanceof Error ? err.message : String(err));
    }
  }

  async function handleHttp(req: Request, caller = ""): Promise<Response> {
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
      const answers = (await Promise.all(body.map((m) => handleMessage(m, req.signal, caller)))).filter((a) => a !== undefined);
      return answers.length ? Response.json(answers) : new Response(null, { status: 202 });
    }
    const answer = await handleMessage(body, req.signal, caller);
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
