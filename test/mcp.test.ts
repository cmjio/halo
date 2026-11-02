import { afterAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import type { ToolDeclaration } from "../src/parser/types.js";
import { HaloError } from "../src/runtime/errors.js";
import { closeMcpClients, MCP_INFO, mcpProvider, splitCommand } from "../src/runtime/mcp.js";
import type { ToolCall, ToolServices } from "../src/runtime/tools.js";
import { createMcpServer, haloTypeToJsonSchema, serveMcpStdio } from "../src/serve/mcp-server.js";

const FIXTURE = join(import.meta.dir, "fixtures", "mcp-echo-server.ts");
// Bun loads .env from its cwd, so the env test runs the fixture from a folder without one.
const FIXTURE_DIR = join(import.meta.dir, "fixtures");
const COMMAND = `"${process.execPath}" "${FIXTURE}"`;

const services = { fetch } as unknown as ToolServices;

function decl(name: string): ToolDeclaration {
  return { name, provider: "MCP", args: [], namedArgs: {}, argList: [] };
}

/** A tool call against a declaration whose args are `config`. */
function call(config: Record<string | number, unknown>, method: string, named: Record<string, unknown> = {}, positional: unknown[] = []): ToolCall {
  return {
    tool: decl("Echo"),
    method,
    positional,
    implicitInput: positional.length === 0,
    named,
    config: (k) => config[k],
    viaAgent: false,
    signal: new AbortController().signal,
  };
}

afterAll(closeMcpClients);

describe("splitCommand", () => {
  test("splits on whitespace with quotes and escapes", () => {
    expect(splitCommand(`npx -y "@scope/server name" 'a b' c\\ d ""`)).toEqual(["npx", "-y", "@scope/server name", "a b", "c d", ""]);
    expect(splitCommand(`say "he said \\"hi\\""`)).toEqual(["say", 'he said "hi"']);
    expect(() => splitCommand(`oops "unclosed`)).toThrow(HaloError);
  });
});

describe("MCP client over stdio", () => {
  const cfg = { 0: COMMAND };

  test("calls tools with named args", async () => {
    expect(await mcpProvider(call(cfg, "echo", { text: "hello" }), services)).toBe("hello");
    // structuredContent wins over text
    expect(await mcpProvider(call(cfg, "add", { a: 2, b: 3 }), services)).toEqual({ sum: 5 });
  });

  test("a lone positional value fills the first required param", async () => {
    expect(await mcpProvider(call(cfg, "echo", {}, ["positional"]), services)).toBe("positional");
  });

  test("isError becomes a HaloError with the text", async () => {
    const err: any = await mcpProvider(call(cfg, "fail"), services).catch((e: any) => e);
    expect(err).toBeInstanceOf(HaloError);
    expect(err.message).toContain("something broke");
  });

  test("unknown methods are TOOL_METHOD errors", async () => {
    const err: any = await mcpProvider(call(cfg, "nope"), services).catch((e: any) => e);
    expect(err.code).toBe("TOOL_METHOD");
    expect(err.message).toContain("echo");
  });

  test("images come back as {type, mimeType, data}", async () => {
    expect(await mcpProvider(call(cfg, "picture"), services)).toEqual({ type: "image", mimeType: "image/png", data: "iVBORw0KGgo=" });
  });

  test("list_tools follows pagination; resources work", async () => {
    const tools = (await mcpProvider(call(cfg, "list_tools"), services)) as Array<{ name: string }>;
    expect(tools.map((t) => t.name)).toEqual(["echo", "add", "fail", "env", "picture", "die"]);
    expect(await mcpProvider(call(cfg, "list_resources"), services)).toEqual([{ uri: "memo://hello", name: "hello" }]);
    expect(await mcpProvider(call(cfg, "read_resource", { uri: "memo://hello" }), services)).toEqual({ hello: "world" });
  });

  test("MCP_INFO maps tools to methods with effects", async () => {
    const methods = await (MCP_INFO.methods as Function)({ tool: decl("Echo"), config: (k: string | number) => (cfg as any)[k], signal: new AbortController().signal }, services);
    const byName = Object.fromEntries(methods.map((m: any) => [m.name, m]));
    expect(byName.add.effect).toBe("read");
    expect(byName.fail.effect).toBe("external");
    expect(byName.picture.effect).toBe("external");
    expect(byName.echo.effect).toBe("write");
    expect(byName.echo.description).toBe("Echo the text back");
    expect(byName.echo.params.required).toEqual(["text"]);
    expect(byName.read_resource.effect).toBe("read");
  });

  test("restarts a server that died", async () => {
    const err: any = await mcpProvider(call(cfg, "die"), services).catch((e: any) => e);
    expect(err).toBeInstanceOf(HaloError);
    expect(await mcpProvider(call(cfg, "echo", { text: "back" }), services)).toBe("back");
  });

  test("the child sees only PATH, HOME and the listed env vars", async () => {
    process.env.PROBE = "visible";
    process.env.SECRET_NOT_LISTED = "hidden";
    try {
      const listed = (await mcpProvider(call({ 0: COMMAND, env: ["PROBE"], cwd: FIXTURE_DIR }, "env"), services)) as { names: string[]; probe: string | null };
      expect(listed.probe).toBe("visible");
      expect(listed.names).not.toContain("SECRET_NOT_LISTED");
      for (const n of listed.names) expect(["PATH", "HOME", "PROBE"]).toContain(n);
      const bare = (await mcpProvider(call({ 0: COMMAND, cwd: FIXTURE_DIR }, "env"), services)) as { names: string[]; probe: string | null };
      expect(bare.probe).toBeNull();
    } finally {
      delete process.env.PROBE;
      delete process.env.SECRET_NOT_LISTED;
    }
  });

  test("rejects servers with an unsupported protocol version", async () => {
    const err: any = await mcpProvider(call({ 0: COMMAND, env: { FAKE_PROTOCOL: "1999-01-01" } }, "echo", { text: "x" }), services).catch((e: any) => e);
    expect(err.code).toBe("TOOL_CONFIG");
  });

  test("accepts older protocol versions", async () => {
    expect(await mcpProvider(call({ 0: COMMAND, env: { FAKE_PROTOCOL: "2024-11-05" } }, "echo", { text: "old" }), services)).toBe("old");
  });

  test("times out with timeout_ms", async () => {
    // `sleep` never answers initialize.
    const err: any = await mcpProvider(call({ 0: "sleep 5", timeout_ms: 200 }, "echo", { text: "x" }), services).catch((e: any) => e);
    expect(err.code).toBe("TIMEOUT");
  });
});

const PIPELINES = [
  { name: "Greet", description: "Say hello", params: [{ name: "name", type: "String" }, { name: "times", type: "Integer?" }] },
  { name: "Review", params: [{ name: "doc", type: "Document" }, { name: "tags", type: "Array<String>" }] },
  { name: "Halts", params: [] },
];

const source = {
  list: () => PIPELINES,
  async call(name: string, args: Record<string, unknown>) {
    if (name === "Greet") return { status: "completed", output: { greeting: `hello ${args.name}` }, runId: "r1" };
    if (name === "Review") return { status: "paused", runId: "r2", waitingFor: "approval" };
    return { status: "halted", runId: "r3", error: "policy said no" };
  },
};

describe("MCP server", () => {
  const server = createMcpServer(source, { name: "halo-test", version: "9.9.9" });

  test("maps Halo types to JSON Schema", () => {
    expect(haloTypeToJsonSchema("String")).toEqual({ type: "string" });
    expect(haloTypeToJsonSchema("Number")).toEqual({ type: "number" });
    expect(haloTypeToJsonSchema("Integer")).toEqual({ type: "integer" });
    expect(haloTypeToJsonSchema("Boolean")).toEqual({ type: "boolean" });
    expect(haloTypeToJsonSchema("List")).toEqual({ type: "array" });
    expect(haloTypeToJsonSchema("Array<Number>")).toEqual({ type: "array", items: { type: "number" } });
    expect(haloTypeToJsonSchema("Map")).toEqual({ type: "object" });
    expect(haloTypeToJsonSchema("JSON")).toEqual({});
    expect(haloTypeToJsonSchema("Any")).toEqual({});
    expect(haloTypeToJsonSchema("Ticket")).toEqual({ type: "object" });
  });

  test("tools/list builds input schemas from params", async () => {
    const res: any = await server.handleMessage({ jsonrpc: "2.0", id: 1, method: "tools/list" });
    const [greet, review] = res.result.tools;
    expect(greet).toEqual({
      name: "Greet",
      description: "Say hello",
      inputSchema: { type: "object", properties: { name: { type: "string" }, times: { type: "integer" } }, required: ["name"] },
    });
    expect(review.inputSchema.properties).toEqual({ doc: { type: "object" }, tags: { type: "array", items: { type: "string" } } });
  });

  test("initialize negotiates the version; notifications get no answer", async () => {
    const res: any = await server.handleMessage({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {} } });
    expect(res.result.protocolVersion).toBe("2025-03-26");
    expect(res.result.serverInfo).toEqual({ name: "halo-test", version: "9.9.9" });
    expect(await server.handleMessage({ jsonrpc: "2.0", method: "notifications/initialized" })).toBeUndefined();
    const unknown: any = await server.handleMessage({ jsonrpc: "2.0", id: 2, method: "prompts/list" });
    expect(unknown.error.code).toBe(-32601);
  });

  test("tools/call reports outputs, pauses and halts", async () => {
    const done: any = await server.handleMessage({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "Greet", arguments: { name: "Ada" } } });
    expect(done.result.structuredContent).toEqual({ greeting: "hello Ada" });
    expect(JSON.parse(done.result.content[0].text)).toEqual({ greeting: "hello Ada" });
    const paused: any = await server.handleMessage({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "Review", arguments: {} } });
    expect(paused.result.content[0].text).toContain("waiting for approval, run id r2");
    const halted: any = await server.handleMessage({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "Halts", arguments: {} } });
    expect(halted.result.isError).toBe(true);
    expect(halted.result.content[0].text).toContain("policy said no");
  });

  test("HTTP: notifications 202, GET 405, batches", async () => {
    const post = (body: unknown) => server.handleHttp(new Request("http://localhost/mcp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
    expect((await post({ jsonrpc: "2.0", method: "notifications/initialized" })).status).toBe(202);
    expect((await server.handleHttp(new Request("http://localhost/mcp"))).status).toBe(405);
    const batch = await post([{ jsonrpc: "2.0", id: 1, method: "ping" }, { jsonrpc: "2.0", method: "notifications/initialized" }, { jsonrpc: "2.0", id: 2, method: "ping" }]);
    expect(await batch.json()).toEqual([{ jsonrpc: "2.0", id: 1, result: {} }, { jsonrpc: "2.0", id: 2, result: {} }]);
    const cross = await server.handleHttp(new Request("http://localhost/mcp", { method: "POST", headers: { Origin: "https://evil.example" }, body: "{}" }));
    expect(cross.status).toBe(403);
  });

  test("the client talks to it over Streamable HTTP", async () => {
    const http = Bun.serve({ port: 0, routes: { "/mcp": (req) => server.handleHttp(req) } });
    try {
      const cfg = { url: `http://localhost:${http.port}/mcp`, apiKey: "test-key" };
      expect(await mcpProvider(call(cfg, "Greet", { name: "Grace" }), services)).toEqual({ greeting: "hello Grace" });
      const err: any = await mcpProvider(call(cfg, "Halts"), services).catch((e: any) => e);
      expect(err.message).toContain("policy said no");
      const tools = (await mcpProvider(call(cfg, "list_tools"), services)) as Array<{ name: string }>;
      expect(tools.map((t) => t.name)).toEqual(["Greet", "Review", "Halts"]);
    } finally {
      await closeMcpClients();
      http.stop(true);
    }
  });

  test("the client reads text/event-stream responses and keeps the session id", async () => {
    const seen: Array<string | null> = [];
    const http = Bun.serve({
      port: 0,
      async fetch(req) {
        seen.push(req.headers.get("mcp-session-id"));
        const res = await server.handleHttp(req);
        if (res.status !== 200) return new Response(res.body, { status: res.status, headers: { "Mcp-Session-Id": "s-1" } });
        const body = `event: message\ndata: ${await res.text()}\n\n`;
        return new Response(body, { headers: { "Content-Type": "text/event-stream", "Mcp-Session-Id": "s-1" } });
      },
    });
    try {
      const cfg = { 0: `http://localhost:${http.port}/mcp` };
      expect(await mcpProvider(call(cfg, "Greet", { name: "Lin" }), services)).toEqual({ greeting: "hello Lin" });
      expect(seen[0]).toBeNull();
      expect(seen.slice(1).every((s) => s === "s-1")).toBe(true);
    } finally {
      await closeMcpClients();
      http.stop(true);
    }
  });

  test("stdio: newline-delimited JSON-RPC in, answers out", async () => {
    const lines: string[] = [];
    const input = new Response(
      [
        JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {} } }),
        JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
        JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "Greet", arguments: { name: "Bo" } } }),
        "not json",
      ].join("\n") + "\n",
    ).body!;
    await serveMcpStdio(server, { input, write: (l) => lines.push(l) });
    const answers = lines.map((l) => JSON.parse(l));
    expect(answers.find((a) => a.id === 1).result.serverInfo.name).toBe("halo-test");
    expect(answers.find((a) => a.id === 2).result.structuredContent).toEqual({ greeting: "hello Bo" });
    expect(answers.find((a) => a.id === null).error.code).toBe(-32700);
  });
});
