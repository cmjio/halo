# MCP (Model Context Protocol)

Halo works with MCP in both directions. It can use any MCP server's tools as a Halo tool, and it can expose your pipelines as MCP tools to Claude Desktop, Claude Code, Cursor and other MCP clients.

## Using MCP servers as tools

Declare a tool with the `MCP` provider. Give it a command to run the server locally over stdio, or a `url:` (or an `https://` first argument) for a remote server over Streamable HTTP.

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

You can also let an agent choose. Give an agent call `tools: [Git]` (or the agent `tools: auto`), and the agent sees each of the server's tools, with its description and input schema, and calls them through native tool calling (see [Agents with Tools](../agents-with-tools.md)):

```halo
agent Maintainer [anthropic/claude-sonnet-4-5]
  equips Git

pipeline Tend(repo: String) -> Result:
  repo |> Maintainer.review("List the open pull requests in {{repo}} that have failing checks.", tools: [Git])
```

The server's tool list is read when the agent call starts. The agent is also offered Halo's `list_resources` and `read_resource` when the server says it has resources. `list_tools` is not offered to agents, and neither is a server tool named `list_tools`, `list_resources` or `read_resource`, since Halo's own method of that name would run instead.

### Arguments and results

- Pass arguments by name: `Docs.search_docs(query: "rate limits", limit: 5)`. A single positional value fills the tool's first required argument, and a positional object is used as the arguments.
- The result is the tool's `structuredContent` when it has one. Otherwise it's the text content, parsed as JSON when it is JSON. Images and audio come back as `{ type, mimeType, data }`.
- When the server marks a result `isError`, the stage fails with the server's message, so `@retry` and `|?` handle it like any other tool error.

Every MCP tool also has three built-in methods that a pipeline can call. These take precedence over server tools with the same names:

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
| `headers:` | Extra HTTP headers, e.g. `headers: { "X-Org": "acme" }` (HTTP only). |
| `env:` | Names of environment variables the stdio server may see, e.g. `env: ["GITHUB_TOKEN"]`, read from the runtime's environment (`RuntimeConfig.env`, which defaults to the process environment), like `Env.NAME`. Or a record of values: `env: { LOG_LEVEL: "warn" }`. |
| `cwd:` | Working directory for the stdio server. |
| `timeout_ms:` | How long one request may take. The default is 60000. |

A stdio server gets a clean environment: `PATH`, `HOME`, and only the variables you list in `env:`. Your other secrets are not passed to it. It still runs as your user, with your files and network: a stdio server is a program you install and run, so only use servers you trust.

Halo opens one connection per declaration and reuses it across calls and runs. If a stdio server exits, Halo restarts it on the next call. Halo connects with protocol version `2025-06-18` and also works with servers that answer with `2025-03-26` or `2024-11-05`.

### Effects

[Tool policies](../../stdlib/policies.md#tool-rules) (`AllowEffects`, `ApproveEffects`) classify each server tool by its annotations when an agent call starts:

- `readOnlyHint: true` is **read**
- `destructiveHint: true` or `openWorldHint: true` is **external**
- anything else is **write**

Annotations are hints from the server, and a server can say anything. A server that marks a destructive tool `readOnlyHint: true` gets past `AllowEffects(read)`. To rely on a policy, name tools: `AllowTools("Git.list_pull_requests", "Git.get_pull_request")`.

`halo plan` doesn't start servers, so it can't list an MCP tool's methods or their effects. It shows them as `Git.*`, with the effect not described.

## Exposing pipelines as MCP tools

Each pipeline becomes an MCP tool. Its parameters become the tool's input schema, all required: `String`, `Number`, `Integer`, `Boolean`, `Array<T>`/`List`, `Object`/`Map` and `JSON`/`Any` map to the matching JSON Schema types, and schema types map to objects.

### stdio

```sh
halo mcp flows.halo        # or several files or folders; the default is the current folder
```

This command speaks MCP on stdin and stdout, which is the setup most desktop clients expect. Every file must validate. Logs go to stderr. Tool packages from the current folder's `halo.lock` are loaded, as with `halo run`. For example, in Claude Desktop's `claude_desktop_config.json`:

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
HALO_SERVE_TOKEN=... halo serve flows.halo
claude mcp add --transport http halo http://localhost:8080/mcp --header "Authorization: Bearer $HALO_SERVE_TOKEN"
```

- It has the same browser checks as `/api`: a request with an `Origin` other than localhost or `publicUrl` is refused, the `Host` header must be localhost, the address it listens on, or `publicUrl`'s host (which stops DNS rebinding), and a `POST` must be `Content-Type: application/json`. Refused requests get `403`.
- Then it uses the API token: when one is set, a request needs `Authorization: Bearer <token>` (or `?token=`), or it gets `401`. **Without a token, any program that can reach the port can run your pipelines**: on localhost, any program on the machine.
- It is stateless and returns JSON, not server-sent streams. Batches work.
- `"mcp": false` in `halo.json` turns it off.

Runs started over `/mcp` appear in Studio and the API like any other run.

### Results

| Run status | What the client gets |
| --- | --- |
| completed | The output as text, plus `structuredContent` when the output is an object |
| paused | A message such as `Paused waiting for yield, run id 4f1c…`. Under `halo serve`, answer it with the approval link, Studio, or the HTTP API. Under `halo mcp`, the run is saved in `.halo/runs` (in the folder `halo mcp` started in): continue it with `halo resume <file> <runId> --payload approve`. |
| halted or failed | A tool error (`isError: true`) with the reason and the run id |

If the client cancels a call (or, over HTTP, drops the request), Halo aborts the run.

Neither `halo mcp` nor `/mcp` asks anyone at `|! yield`, `~> listen`, or a tool call that needs approval: the run pauses. A tool call that needs approval inside a fan-out, `each`, branch, or called pipeline fails with `APPROVAL_NEEDED` (see [Approvals](../agents-with-tools.md#approvals)).

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
