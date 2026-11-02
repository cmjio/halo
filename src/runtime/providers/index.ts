/**
 * Local tool providers: things an agent can do on this machine, with no service to sign up for.
 *
 *   tool Files : Workspace("./src", write: true)   read, write, edit, list, glob, search, delete, mkdir
 *   tool Cache : KV(".halo/kv.sqlite")             get, set, delete, list, incr
 *   tool Py    : Code("python", timeout_ms: 10000)  run
 *   tool Docs  : Documents(root: "./inbox")        extract
 */

import type { JsonSchema, ProviderInfo, ToolProvider } from "../tools.js";
import { codeRunner } from "./code.js";
import { documents } from "./documents.js";
import { kv } from "./kv.js";
import { workspace } from "./workspace.js";

export { closeKvDatabases } from "./kv.js";

export const LOCAL_PROVIDERS: Record<string, ToolProvider> = {
  Workspace: workspace,
  KV: kv,
  Code: codeRunner,
  Documents: documents,
};

function object(properties: Record<string, JsonSchema>, required: string[] = []): JsonSchema {
  return { type: "object", properties, required, additionalProperties: false };
}

const path = (description: string): JsonSchema => ({ type: "string", description });
const anyValue: JsonSchema = { description: "Any JSON value." };

export const LOCAL_PROVIDER_INFO: Record<string, ProviderInfo> = {
  Workspace: {
    description: "Files in one folder (the workspace root). Paths are relative to the root; absolute paths, .. and symlinks out of it are refused. Writing needs the tool declared with write: true.",
    methods: [
      {
        name: "read",
        description: "Read a text file. Returns { path, content, lines } (lines = the file's line count). Pass offset and limit to read part of a long file. Files over 1MB are cut off.",
        params: object(
          {
            path: path("File path, relative to the workspace root."),
            offset: { type: "integer", minimum: 1, description: "First line to return (1-based)." },
            limit: { type: "integer", minimum: 0, description: "Number of lines to return." },
          },
          ["path"],
        ),
        effect: "read",
      },
      {
        name: "write",
        description: "Create or overwrite a file with the given content (parent folders are created). Returns { path, bytes, created }.",
        params: object({ path: path("File path, relative to the workspace root."), content: { type: "string", description: "The whole new content of the file." } }, ["path", "content"]),
        effect: "write",
      },
      {
        name: "edit",
        description: "Replace exact text in a file. `old` must appear exactly once (include surrounding lines to make it unique), unless all is true. Returns { path, replacements }.",
        params: object(
          {
            path: path("File path, relative to the workspace root."),
            old: { type: "string", description: "The exact text to replace, including whitespace." },
            new: { type: "string", description: "The replacement text." },
            all: { type: "boolean", description: "Replace every occurrence instead of requiring exactly one." },
          },
          ["path", "old", "new"],
        ),
        effect: "write",
      },
      {
        name: "list",
        description: "List a folder's files and subfolders. Returns { path, entries: [{ path, type, size? }] }. node_modules and .git are skipped.",
        params: object({
          path: path('Folder, relative to the workspace root (default ".").'),
          depth: { type: "integer", minimum: 1, maximum: 10, description: "How many levels deep to list (default 1)." },
        }),
        effect: "read",
      },
      {
        name: "glob",
        description: 'Find files whose path matches a glob pattern, like "**/*.ts" or "src/*.{js,json}". Returns { pattern, matches: [path] } (at most 1000).',
        params: object({ pattern: { type: "string", description: "Glob pattern, relative to the workspace root." } }, ["pattern"]),
        effect: "read",
      },
      {
        name: "search",
        description: "Search file contents line by line, like grep. Returns { pattern, matches: [{ path, line, text }] } (at most 200). Binary files and files over 1MB are skipped.",
        params: object(
          {
            pattern: { type: "string", description: "Text to find (literal, unless regex is true)." },
            path: path('File or folder to search in (default ".").'),
            regex: { type: "boolean", description: "Treat pattern as a JavaScript regular expression." },
            ignore_case: { type: "boolean", description: "Match case-insensitively." },
            glob: { type: "string", description: 'Only search files whose path matches this glob, e.g. "**/*.md".' },
          },
          ["pattern"],
        ),
        effect: "read",
      },
      {
        name: "delete",
        description: "Delete a file, or a folder (a folder that isn't empty needs recursive: true). A symlink is removed, not its target. Returns { path, deleted }.",
        params: object({ path: path("File or folder, relative to the workspace root."), recursive: { type: "boolean", description: "Delete a folder and everything in it." } }, ["path"]),
        effect: "write",
      },
      {
        name: "mkdir",
        description: "Create a folder (and any missing parents). Returns { path, created }.",
        params: object({ path: path("Folder, relative to the workspace root.") }, ["path"]),
        effect: "write",
      },
    ],
  },

  KV: {
    description: "A persistent key-value store (local SQLite). Values are any JSON. Keys can expire.",
    methods: [
      {
        name: "get",
        description: "Get a key's value, or null (or `default`) when it's missing or expired.",
        params: object({ key: { type: "string", description: "The key." }, default: { ...anyValue, description: "Returned when the key is missing." } }, ["key"]),
        effect: "read",
      },
      {
        name: "set",
        description: "Set a key to a value, optionally expiring after ttl. Returns { key, set, expires_at? }.",
        params: object(
          {
            key: { type: "string", description: "The key." },
            value: { ...anyValue, description: "The value (any JSON)." },
            ttl: { type: ["string", "number"], description: 'Time to live: seconds, or a duration like "30s", "5m", "1h", "2d".' },
          },
          ["key", "value"],
        ),
        effect: "write",
      },
      {
        name: "delete",
        description: "Delete a key. Returns { key, deleted }.",
        params: object({ key: { type: "string", description: "The key." } }, ["key"]),
        effect: "write",
      },
      {
        name: "list",
        description: "List keys and values in key order, optionally only keys starting with prefix. Returns [{ key, value }].",
        params: object({
          prefix: { type: "string", description: "Only keys that start with this." },
          limit: { type: "integer", minimum: 1, maximum: 1000, description: "Most entries to return (default 100)." },
        }),
        effect: "read",
      },
      {
        name: "incr",
        description: "Add to a numeric key (a missing key counts as 0) and return the new number.",
        params: object({
          key: { type: "string", description: "The key." },
          by: { type: "number", description: "Amount to add (default 1; negative to subtract)." },
          ttl: { type: ["string", "number"], description: "Expiry for a key this creates (an existing key keeps its own)." },
        }, ["key"]),
        effect: "write",
      },
    ],
  },

  Code: {
    description: "Run a short code snippet in a separate process with no environment variables (no secrets). Not a security sandbox: it can still use files and the network.",
    methods: [
      {
        name: "run",
        description:
          "Run a snippet. It is the body of a function with `input` available; `return` a JSON-serializable value to get it back as `result` (printed output goes to stdout). In JS/TS, await works and modules load with await import(). Returns { stdout, stderr, exitCode, result, timedOut }.",
        params: object({ code: { type: "string", description: "The snippet: a function body that returns its answer." }, input: { ...anyValue, description: "Passed to the snippet as `input`." } }, ["code"]),
        // Arbitrary code can reach the network and start programs: as much as Bash.run can.
        effect: "external",
      },
    ],
  },

  Documents: {
    description: "Extract text from documents: text, Markdown, HTML, CSV/TSV, JSON, Word .docx, and PDF.",
    methods: [
      {
        name: "extract",
        description: "Extract a document's text from a file path (relative to the tool's root) or an http(s) URL. Returns { source, type, text }, plus rows (CSV/TSV records), data (parsed JSON), or pages (PDF page count).",
        params: object({
          path: { type: "string", description: "File path, relative to the tool's root." },
          url: { type: "string", description: "An http(s) URL to fetch instead of a path." },
          type: { type: "string", enum: ["text", "markdown", "html", "csv", "tsv", "json", "docx", "pdf"], description: "Override the type detected from the extension or content." },
        }),
        effect: "read",
      },
    ],
  },
};
