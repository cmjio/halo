import { afterAll, describe, expect, test } from "bun:test";
import { copyFileSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "../src/parser/index.js";
import type { ToolDeclaration } from "../src/parser/types.js";
import { HaloRuntime, type RuntimeEvent } from "../src/runtime/runtime.js";
import { HaloError } from "../src/runtime/errors.js";
import { closeMcpClients, MCP_INFO, mcpProvider, mcpTarget, resolveCommandPaths, splitCommand } from "../src/runtime/mcp.js";
import type { ToolCall, ToolServices } from "../src/runtime/tools.js";
import { createMcpServer, haloTypeToJsonSchema, serveMcpStdio } from "../src/serve/mcp-server.js";

const FIXTURE = join(import.meta.dir, "fixtures", "mcp-echo-server.ts");
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
    expect(tools.map((t) => t.name)).toEqual(["echo", "add", "fail", "env", "picture", "die", "cwd", "slow"]);
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
      const listed = (await mcpProvider(call({ 0: COMMAND, env: ["PROBE"] }, "env"), services)) as { names: string[]; probe: string | null };
      expect(listed.probe).toBe("visible");
      expect(listed.names).not.toContain("SECRET_NOT_LISTED");
      for (const n of listed.names) expect(["PATH", "HOME", "PROBE"]).toContain(n);
      const bare = (await mcpProvider(call({ 0: COMMAND }, "env"), services)) as { names: string[]; probe: string | null };
      expect(bare.probe).toBeNull();
    } finally {
      delete process.env.PROBE;
      delete process.env.SECRET_NOT_LISTED;
    }
  });

  test("a server starts in a private empty folder, so it can't load the project's .env", async () => {
    // A project with a .env holding a key, and a server script in it, run as `bun ./server.ts`.
    const project = realpathSync(mkdtempSync(join(tmpdir(), "halo-mcp-project-")));
    copyFileSync(FIXTURE, join(project, "server.ts"));
    mkdirSync(join(project, "bin"));
    copyFileSync(FIXTURE, join(project, "bin", "server.ts"));
    writeFileSync(join(project, ".env"), "HALO_API_KEY=leaked\nPROBE=from-dotenv\n");
    const home = process.cwd();
    process.chdir(project);
    try {
      for (const command of [`"${process.execPath}" ./server.ts`, `"${process.execPath}" server.ts`, `"${process.execPath}" bin/server.ts`]) {
        const seen = (await mcpProvider(call({ 0: command }, "env"), services)) as { names: string[]; probe: string | null };
        expect(seen.names).not.toContain("HALO_API_KEY");
        expect(seen.probe).toBeNull();
        const where = (await mcpProvider(call({ 0: command }, "cwd"), services)) as { cwd: string };
        expect(where.cwd.startsWith(project)).toBe(false);
      }
      // cwd: "." runs it in the project, still without the project's .env (bun gets --no-env-file).
      const here = { 0: `"${process.execPath}" ./server.ts`, cwd: "." };
      expect(((await mcpProvider(call(here, "cwd"), services)) as { cwd: string }).cwd).toBe(project);
      const seen = (await mcpProvider(call(here, "env"), services)) as { names: string[] };
      expect(seen.names).not.toContain("HALO_API_KEY");
    } finally {
      process.chdir(home);
      await closeMcpClients();
      rmSync(project, { recursive: true, force: true });
    }
  });

  test("relative paths in the command resolve against the project", () => {
    const project = realpathSync(mkdtempSync(join(tmpdir(), "halo-mcp-paths-")));
    writeFileSync(join(project, "server.ts"), "");
    try {
      expect(resolveCommandPaths(["bun", "./server.ts"], project)).toEqual(["bun", join(project, "server.ts")]);
      expect(resolveCommandPaths(["bun", "server.ts", "--root=./data", "."], project)).toEqual(["bun", join(project, "server.ts"), `--root=${join(project, "data")}`, project]);
      expect(resolveCommandPaths(["./bin/server", "-y", "@scope/pkg", "missing.ts", "https://x.example"], project)).toEqual([join(project, "bin/server"), "-y", "@scope/pkg", "missing.ts", "https://x.example"]);
      expect(resolveCommandPaths(["npx", "-y", "/abs/path"], project)).toEqual(["npx", "-y", "/abs/path"]);
      // With cwd: the command is left as written, and cwd: is resolved against the project.
      const t = mcpTarget("T", (k) => ({ 0: "bun ./server.ts", cwd: "sub" } as Record<string | number, unknown>)[k], {}, project);
      expect(t).toMatchObject({ kind: "stdio", argv: ["bun", "./server.ts"], cwd: join(project, "sub") });
      const dot = mcpTarget("T", (k) => ({ 0: "bun ./server.ts", cwd: "." } as Record<string | number, unknown>)[k], {}, project);
      expect(dot).toMatchObject({ argv: ["bun", "--no-env-file", "./server.ts"], cwd: project });
    } finally {
      rmSync(project, { recursive: true, force: true });
    }
  });

  test("rejects servers with an unsupported protocol version", async () => {
    const err: any = await mcpProvider(call({ 0: COMMAND, env: { FAKE_PROTOCOL: "1999-01-01" } }, "echo", { text: "x" }), services).catch((e: any) => e);
    expect(err.code).toBe("TOOL_CONFIG");
  });

  test("accepts older protocol versions", async () => {
    expect(await mcpProvider(call({ 0: COMMAND, env: { FAKE_PROTOCOL: "2024-11-05" } }, "echo", { text: "old" }), services)).toBe("old");
  });

  test("progress keeps a long call alive past timeout_ms, up to max_ms, and is reported", async () => {
    const seen: unknown[] = [];
    const withProgress = { ...services, progress: (p: unknown) => seen.push(p) } as ToolServices;
    // 5 steps of 150ms: 750ms in all, longer than timeout_ms, but never 400ms without progress.
    const out = await mcpProvider(call({ 0: COMMAND, timeout_ms: 400 }, "slow", { steps: 5, every_ms: 150 }), withProgress);
    expect(out).toEqual({ done: 5, token: true });
    expect(seen).toHaveLength(5);
    expect(seen[0]).toEqual({ progress: 1, total: 5, message: "step 1" });
    // A gap longer than timeout_ms between reports still times out.
    const idle: any = await mcpProvider(call({ 0: COMMAND, timeout_ms: 200 }, "slow", { steps: 1, every_ms: 500 }), services).catch((e: any) => e);
    expect(idle.code).toBe("TIMEOUT");
    expect(idle.message).toContain("without reporting progress");
    // max_ms caps the whole call, however often it reports.
    const capped: any = await mcpProvider(call({ 0: COMMAND, timeout_ms: 300, max_ms: 500 }, "slow", { steps: 10, every_ms: 100 }), services).catch((e: any) => e);
    expect(capped.code).toBe("TIMEOUT");
    expect(capped.message).toContain("max_ms");
  });

  test("a run reports a call's progress as tool_progress events", async () => {
    const events: RuntimeEvent[] = [];
    const src = `tool Echo : MCP(${JSON.stringify(COMMAND)})\npipeline P(x: String) -> Result:\n  x |> Echo.slow(steps: 2, every_ms: 50)`;
    const rt = new HaloRuntime({ logger: { log() {}, warn() {} }, onEvent: (e) => events.push(e) }).load(parse(src));
    try {
      expect(await rt.execute("P", { x: "" })).toEqual({ done: 2, token: true });
      expect(events.filter((e) => e.type === "tool_progress")).toEqual([
        { type: "tool_progress", pipeline: "P", runId: expect.any(String), tool: "Echo", method: "slow", progress: 1, total: 2, message: "step 1" },
        { type: "tool_progress", pipeline: "P", runId: expect.any(String), tool: "Echo", method: "slow", progress: 2, total: 2, message: "step 2" },
      ]);
    } finally {
      await rt.close();
    }
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

  test("a caller can cancel only its own calls, even when another uses the same id", async () => {
    const aborted: string[] = [];
    const waiting = createMcpServer({
      list: () => [{ name: "Wait", params: [{ name: "who", type: "String" }] }],
      call: (_name, args, signal) =>
        new Promise((resolve) => {
          const done = setTimeout(() => resolve({ status: "completed", output: `${args.who} finished`, runId: String(args.who) }), 400);
          signal?.addEventListener("abort", () => {
            clearTimeout(done);
            aborted.push(String(args.who));
            resolve({ status: "failed", runId: String(args.who), error: "cancelled" });
          });
        }),
    });
    const post = (caller: string, body: unknown) => waiting.handleHttp(new Request("http://localhost/mcp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }), caller);
    const call = (caller: string) => post(caller, { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "Wait", arguments: { who: caller } } }).then((r) => r.json() as Promise<any>);
    const cancel = (caller: string) => post(caller, { jsonrpc: "2.0", method: "notifications/cancelled", params: { requestId: 1 } });
    const a = call("consumer:a");
    const b = call("consumer:b");
    await Bun.sleep(50);
    // B cancels "its" request 1: A's request 1 keeps running.
    expect((await cancel("consumer:b")).status).toBe(202);
    expect(aborted).toEqual(["consumer:b"]);
    expect((await b).result.isError).toBe(true);
    expect((await a).result.content[0].text).toBe("consumer:a finished");
    // A caller that cancels nothing of its own stops nothing.
    const c = call("consumer:c");
    await cancel("consumer:d");
    expect((await c).result.content[0].text).toBe("consumer:c finished");
    expect(aborted).toEqual(["consumer:b"]);
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
