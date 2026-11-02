/**
 * A tiny MCP server over stdio, for tests. Tools: echo, add (read-only), fail
 * (isError), env (reports its environment), picture (image content), die (exits).
 * tools/list pages two tools at a time. One resource: memo://hello.
 */

const TOOLS = [
  { name: "echo", description: "Echo the text back", inputSchema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] } },
  {
    name: "add",
    description: "Add two numbers",
    inputSchema: { type: "object", properties: { a: { type: "number" }, b: { type: "number" } }, required: ["a", "b"] },
    annotations: { readOnlyHint: true },
  },
  { name: "fail", description: "Always fails", inputSchema: { type: "object", properties: {} }, annotations: { destructiveHint: true } },
  { name: "env", description: "Report environment variable names and the value of PROBE", inputSchema: { type: "object", properties: {} } },
  { name: "picture", description: "Return an image", inputSchema: { type: "object", properties: {} }, annotations: { openWorldHint: true } },
  { name: "die", description: "Exit the process", inputSchema: { type: "object", properties: {} } },
];

const PAGE = 2;

function result(id: unknown, result: unknown) {
  return { jsonrpc: "2.0", id, result };
}

function handle(msg: any): unknown {
  const { id, method, params } = msg;
  if (id === undefined || id === null) return undefined;
  switch (method) {
    case "initialize":
      return result(id, {
        protocolVersion: process.env.FAKE_PROTOCOL ?? params.protocolVersion,
        capabilities: { tools: {}, resources: {} },
        serverInfo: { name: "echo", version: "1.0.0" },
      });
    case "ping":
      return result(id, {});
    case "tools/list": {
      const start = Number(params?.cursor ?? 0);
      const next = start + PAGE;
      return result(id, { tools: TOOLS.slice(start, next), ...(next < TOOLS.length ? { nextCursor: String(next) } : {}) });
    }
    case "resources/list":
      return result(id, { resources: [{ uri: "memo://hello", name: "hello" }] });
    case "resources/read":
      return result(id, { contents: [{ uri: params.uri, mimeType: "application/json", text: JSON.stringify({ hello: "world" }) }] });
    case "tools/call": {
      const args = params.arguments ?? {};
      switch (params.name) {
        case "echo":
          return result(id, { content: [{ type: "text", text: String(args.text) }] });
        case "add":
          return result(id, { content: [{ type: "text", text: String(args.a + args.b) }], structuredContent: { sum: args.a + args.b } });
        case "fail":
          return result(id, { content: [{ type: "text", text: "something broke" }], isError: true });
        case "env":
          return result(id, { content: [{ type: "text", text: JSON.stringify({ names: Object.keys(process.env).sort(), probe: process.env.PROBE ?? null }) }] });
        case "picture":
          return result(id, { content: [{ type: "image", mimeType: "image/png", data: "iVBORw0KGgo=" }] });
        case "die":
          process.exit(3);
        default:
          return { jsonrpc: "2.0", id, error: { code: -32602, message: `Unknown tool: ${params.name}` } };
      }
    }
    default:
      return { jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } };
  }
}

const decoder = new TextDecoder();
let buf = "";
for await (const chunk of Bun.stdin.stream()) {
  buf += decoder.decode(chunk, { stream: true });
  let nl: number;
  while ((nl = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, nl).trim();
    buf = buf.slice(nl + 1);
    if (!line) continue;
    const answer = handle(JSON.parse(line));
    if (answer) process.stdout.write(`${JSON.stringify(answer)}\n`);
  }
}
