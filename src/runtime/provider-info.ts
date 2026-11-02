/**
 * What each built-in provider's methods do, for agents that choose their own tool
 * calls (the model sees these descriptions and argument schemas) and for `halo plan`
 * (which lists what a run could change, by each method's effect).
 */

import { MCP_INFO } from "./mcp.js";
import { CHROME_INFO } from "./providers/chrome.js";
import { LOCAL_PROVIDER_INFO } from "./providers/index.js";
import type { JsonSchema, ProviderInfo, ToolMethod } from "./tools.js";

const obj = (properties: Record<string, JsonSchema>, required: string[] = []): JsonSchema => ({ type: "object", properties, required });
const text = (description: string): JsonSchema => ({ type: "string", description });
const num = (description: string): JsonSchema => ({ type: "number", description });
const list = (description: string, items: JsonSchema = { type: "string" }): JsonSchema => ({ type: "array", description, items });

const rest: ProviderInfo = {
  description: "HTTP GET requests under the tool's base URL",
  methods: [
    {
      name: "get",
      description: "GET a path under the base URL. Other arguments become query parameters.",
      params: { type: "object", properties: { path: text("Path under the base URL, e.g. /search/issues") }, additionalProperties: true },
      effect: "read",
    },
  ],
};

const post: ProviderInfo = {
  description: "HTTP POST with a JSON body to the tool's URL",
  methods: [
    {
      name: "post",
      description: "POST the arguments (except path) as a JSON body.",
      params: { type: "object", properties: { path: text("Path under the base URL") }, additionalProperties: true },
      effect: "external",
    },
  ],
};

const sql: ProviderInfo = {
  description: "A PostgreSQL database",
  methods: [
    {
      name: "query",
      description: "Run a SQL statement and return its rows. Use $1, $2 placeholders with params; the tool may only allow reads.",
      params: obj({ sql: text("The SQL statement"), params: list("Values for $1, $2, ...", {}) }, ["sql"]),
      effect: "write",
    },
  ],
};

const bash: ProviderInfo = {
  description: "A bash shell",
  methods: [
    {
      name: "run",
      description: "Run a bash command and return its stdout, stderr and exit code. A non-zero exit code is not an error.",
      params: obj({ command: text("The command to run"), timeout_ms: num("Kill it after this many milliseconds") }, ["command"]),
      effect: "external",
    },
  ],
};

const browser: ProviderInfo = {
  description: "Fetches web pages as readable text (no JavaScript)",
  methods: [{ name: "fetch", description: "Fetch a page and return its title and text.", params: obj({ url: text("The page's URL") }, ["url"]), effect: "read" }],
};

const file: ProviderInfo = {
  description: "A JSON file of notes or conversation history",
  methods: [
    { name: "read", description: "Read the recent entries.", params: obj({}), effect: "read" },
    { name: "append", description: "Add an entry.", params: obj({ content: text("The entry") }, ["content"]), effect: "write" },
    { name: "clear", description: "Remove all entries.", params: obj({}), effect: "write" },
  ],
};

const vectorStore: ProviderInfo = {
  description: "Searchable memory",
  methods: [
    {
      name: "search",
      description: "Find stored entries closest to a query.",
      params: obj({ query: text("What to look for"), limit: num("How many results (default 5)"), tags: list("Only entries with these tags") }, ["query"]),
      effect: "read",
    },
    { name: "log", description: "Store an entry.", params: obj({ content: text("What to store"), tags: list("Tags for filtering later") }, ["content"]), effect: "write" },
    { name: "count", description: "Count stored entries.", params: obj({}), effect: "read" },
    { name: "delete", description: "Delete entries by id or tags.", params: obj({ id: num("Entry id"), tags: list("Delete entries with these tags") }), effect: "write" },
  ],
};

const slack: ProviderInfo = {
  description: "Slack",
  methods: [
    {
      name: "post",
      description: "Post a message to a channel.",
      params: obj({ channel: text("Channel, e.g. #alerts"), text: text("The message"), buttons: list("Optional button labels") }, ["text"]),
      effect: "external",
    },
  ],
};

const email: ProviderInfo = {
  description: "Sends email",
  methods: [
    {
      name: "send",
      description: "Send an email.",
      params: obj({ to: { type: ["string", "array"], description: "Recipient address(es)" }, subject: text("Subject line"), body: text("Plain-text body") }, ["subject", "body"]),
      effect: "external",
    },
  ],
};

const github: ProviderInfo = {
  description: "A GitHub repository",
  methods: [
    { name: "get_issue", description: "Get an issue or pull request by number.", params: obj({ number: num("Issue number") }, ["number"]), effect: "read" },
    { name: "list_issues", description: "List issues.", params: obj({ state: { type: "string", enum: ["open", "closed", "all"] }, limit: num("Most to return (default 30)") }), effect: "read" },
    { name: "create_issue", description: "Open an issue.", params: obj({ title: text("Title"), body: text("Body (Markdown)"), labels: list("Labels") }, ["title"]), effect: "external" },
    { name: "comment", description: "Comment on an issue or pull request.", params: obj({ number: num("Issue number"), body: text("Comment (Markdown)") }, ["number", "body"]), effect: "external" },
    { name: "add_labels", description: "Add labels to an issue.", params: obj({ number: num("Issue number"), labels: list("Labels") }, ["number", "labels"]), effect: "external" },
    {
      name: "create_pr",
      description: "Open a pull request from an existing branch.",
      params: obj({ title: text("Title"), head: text("Branch with the changes"), base: text("Branch to merge into (default main)"), body: text("Description") }, ["title", "head"]),
      effect: "external",
    },
  ],
};

const linear: ProviderInfo = {
  description: "Linear issues",
  methods: [
    { name: "create_issue", description: "Create an issue.", params: obj({ team: text("Team key"), title: text("Title"), description: text("Description (Markdown)") }, ["title"]), effect: "external" },
  ],
};

const figma: ProviderInfo = {
  description: "Figma files",
  methods: [
    { name: "get_file", description: "Get a file's document tree.", params: obj({ file: text("File key"), depth: num("How deep to go") }), effect: "read" },
    { name: "get_node", description: "Get one node of a file.", params: obj({ file: text("File key"), node: text("Node id, e.g. 1:2") }, ["node"]), effect: "read" },
  ],
};

export const BUILTIN_PROVIDER_INFO: Record<string, ProviderInfo> = {
  REST: rest,
  GET: rest,
  POST: post,
  PostgreSQL: sql,
  SQL: sql,
  Bash: bash,
  Browser: browser,
  File: file,
  VectorStore: vectorStore,
  Slack: slack,
  Email: email,
  GitHub: github,
  Linear: linear,
  Figma: figma,
  MCP: MCP_INFO,
  Chrome: CHROME_INFO,
  ...LOCAL_PROVIDER_INFO,
};

/** A method's static description, when the provider lists its methods up front. */
export function staticMethod(info: ProviderInfo | undefined, method: string): ToolMethod | undefined {
  return Array.isArray(info?.methods) ? info.methods.find((m) => m.name === method) : undefined;
}
