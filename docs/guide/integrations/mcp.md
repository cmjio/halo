# MCP (Model Context Protocol)

Halo works with MCP in both directions. It can use any MCP server's tools as a Halo tool, and it can expose your pipelines as MCP tools to Claude Desktop, Claude Code, Cursor and other MCP clients.

## Using MCP servers as tools

Declare a tool with the `MCP` provider. Give it a command to run the server locally over stdio, or a `url:` for a remote server over Streamable HTTP.

```halo
tool Git  : MCP("npx -y @modelcontextprotocol/server-github", env: ["GITHUB_TOKEN"])
tool Docs : MCP(url: "https://docs.example.com/mcp", apiKey: Env.DOCS_KEY)
```

Every tool the server offers is a method:

```halo
pipeline Answer(question: String) -> Result:
  question
    |> Docs.search_docs(query: question) as hits
    |> Writer.answer("Answer the question using these docs.")
```

You can also let an agent choose. An agent that equips an MCP tool sees each of the server's tools, with its description and input schema, and calls them through native tool calling:

```halo
agent Maintainer [anthropic/claude-sonnet-4-5]
  equips Git
```

### Arguments and results

- Pass arguments by name: `Docs.search_docs(query: "rate limits", limit: 5)`. A single positional value fills the tool's first required argument, and a positional object is used as the arguments.
- The result is the tool's `structuredContent` when it has one. Otherwise it's the text content, parsed as JSON when it is JSON. Images and audio come back as `{ type, mimeType, data }`.
- When the server marks a result `isError`, the stage fails with the server's message, so `@retry` and `|?` handle it like any other tool error.

Every MCP tool also has three built-in methods. These take precedence over server tools with the same names:

| Method | Returns |
| --- | --- |
| `list_tools()` | The server's tools (name, description, inputSchema, annotations) |
| `list_resources()` | The server's resources |
| `read_resource(uri: "...")` | One resource's contents (JSON parsed when it is JSON) |

### Options

| Option | Meaning |
| --- | --- |
| first arg | The command that starts a stdio server. It is split into arguments with simple `'...'`/`"..."` quoting and run **without a shell**. |
| `url:` | A Streamable HTTP endpoint. Halo keeps the server's `Mcp-Session-Id` and accepts JSON or `text/event-stream` responses. |
| `apiKey:` | Sent as `Authorization: Bearer ...` (HTTP only). |
| `env:` | Names of environment variables the stdio server may see, e.g. `env: ["GITHUB_TOKEN"]`. |
| `cwd:` | Working directory for the stdio server. |
| `timeout_ms:` | How long one request may take. The default is 60000. |

A stdio server gets a clean environment: `PATH`, `HOME`, and only the variables you list in `env:`. Your other secrets are not passed to it.

Halo opens one connection per declaration and reuses it across calls and runs. If a stdio server exits, Halo restarts it on the next call. Halo connects with protocol version `2025-06-18` and also works with servers that answer with `2025-03-26` or `2024-11-05`.

### Effects

`halo plan` and approval policies classify each server tool by its annotations:

- `readOnlyHint: true` is **read**
- `destructiveHint: true` or `openWorldHint: true` is **external**
- anything else is **write**

Annotations are hints from the server. Treat a server you don't trust the way you would treat any other code you run.

## Exposing pipelines as MCP tools

Each pipeline becomes an MCP tool. Its parameters become the tool's input schema: `String`, `Number`, `Integer`, `Boolean`, `Array<T>`/`List`, `Object`/`Map` and `JSON`/`Any` map to the matching JSON Schema types, and schema types map to objects.

### stdio

```sh
halo mcp flows.halo
```

This command speaks MCP on stdin and stdout, which is the setup most desktop clients expect. For example, in Claude Desktop's `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "halo": { "command": "halo", "args": ["mcp", "/path/to/flows.halo"] }
  }
}
```

Or in Claude Code:

```sh
claude mcp add halo -- halo mcp /path/to/flows.halo
```

### HTTP

`halo serve` also answers Streamable HTTP at `/mcp`:

```sh
halo serve flows.halo
claude mcp add --transport http halo http://localhost:3000/mcp
```

The endpoint is stateless and returns JSON, not server-sent streams. It rejects browser requests from other origins. Put it behind the same authentication as the rest of `halo serve` before you expose it beyond localhost.

### Results

| Run status | What the client gets |
| --- | --- |
| completed | The output as text, plus `structuredContent` when the output is an object |
| paused | A message such as `Paused waiting for approval, run id 4f1c…`. Resume the run through the HTTP API or Studio. |
| halted or failed | A tool error (`isError: true`) with the reason and the run id |

If the client cancels a call, Halo aborts the run.

## From TypeScript

```ts
import { createMcpServer, serveMcpStdio } from "halo/src/serve/mcp-server.ts";

const server = createMcpServer({
  list: () => [{ name: "Greet", description: "Say hello", params: [{ name: "name", type: "String" }] }],
  call: async (name, args) => ({ status: "completed", output: `hello ${args.name}`, runId: crypto.randomUUID() }),
});

Bun.serve({ routes: { "/mcp": (req) => server.handleHttp(req) } }); // Streamable HTTP
// or: await serveMcpStdio(server);                                // stdio
```
