/**
 * Built-in tool providers for local automation and common services:
 *
 *   tool Shell   : Bash()                          run(command: "...")
 *   tool Reader  : Browser()                       fetch(url) → page text
 *   tool History : File(".halo/chat.json", keep: 10)  read / append / clear
 *   tool Chat    : Slack(Env.SLACK_BOT_TOKEN)       post(channel:, text:, buttons:)
 *   tool Mail    : Email(Env.RESEND_API_KEY, from: "bot@example.com")  send(to:, subject:, body:)
 *   tool Repo    : GitHub(Env.GITHUB_TOKEN)        create_issue, comment, add_labels, create_pr, get_issue, list_issues
 *   tool Tickets : Linear(Env.LINEAR_TOKEN)        create_issue(team:, title:, description:)
 *   tool Design  : Figma(Env.FIGMA_TOKEN)          get_file(file:), get_node(file:, node:)
 *
 * A token can also be written as a string: Slack("Env.SLACK_BOT_TOKEN").
 */

import { mkdirSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { HaloError, HttpError } from "./errors.js";
import type { ToolCall, ToolProvider } from "./tools.js";

function str(v: unknown): string {
  return typeof v === "string" ? v : JSON.stringify(v);
}

function need(call: ToolCall, name: string, value: unknown): string {
  if (value === undefined || value === null || value === "") {
    throw new HaloError(`${call.tool.name}.${call.method} needs ${name}`, { code: "TOOL_ARGUMENT" });
  }
  return str(value);
}

function token(call: ToolCall, envHint: string): string {
  const t = call.named.token ?? call.config(0) ?? call.config("token") ?? call.config("apiKey");
  if (typeof t !== "string" || !t) throw new HaloError(`Tool "${call.tool.name}" needs a token, e.g. ${call.tool.provider}(Env.${envHint})`, { code: "TOOL_CONFIG" });
  return t;
}

async function json(res: Response, label: string): Promise<any> {
  const text = await res.text();
  if (!res.ok) throw new HttpError(`${label} failed (${res.status}): ${text.slice(0, 500)}`, res.status, text);
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return text;
  }
}

function unknownMethod(call: ToolCall, methods: string[]): never {
  throw new HaloError(`${call.tool.provider} tool "${call.tool.name}" has no method "${call.method}" (use ${methods.join(", ")})`, { code: "TOOL_METHOD" });
}

// ── Bash ──

/**
 * Runs `command:` with bash in the current directory. Values inserted into the
 * command with {{...}} are shell-quoted by the runtime, so model output or user
 * input can't inject commands. A failing command is not an error: check
 * `exitCode` (e.g. with `|<> loop`). When stdout is JSON, it is also returned
 * parsed as `json`.
 */
export const bash: ToolProvider = async (call) => {
  const command = call.named.command;
  if (typeof command !== "string" || !command.trim()) {
    throw new HaloError(`${call.tool.name}.${call.method} needs command: "...", e.g. ${call.tool.name}.run(command: "bun test")`, { code: "TOOL_ARGUMENT" });
  }
  const timeoutMs = Number(call.named.timeout_ms ?? call.config("timeout_ms") ?? 120_000);
  const proc = Bun.spawn(["bash", "-c", command], { cwd: (call.config("cwd") as string | undefined) ?? process.cwd(), stdout: "pipe", stderr: "pipe", stdin: "ignore" });
  const kill = () => proc.kill();
  call.signal.addEventListener("abort", kill, { once: true });
  const timer = setTimeout(kill, timeoutMs);
  try {
    const [stdout, stderr, exitCode] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
    const out = stdout.trimEnd();
    // Commands that print JSON (jq, curl, a script) also get it parsed, as `json`.
    let json: unknown;
    if (/^\s*[[{]/.test(out)) {
      try {
        json = JSON.parse(out);
      } catch {}
    }
    return { command, stdout: out, stderr: stderr.trimEnd(), exitCode, ...(json !== undefined ? { json } : {}) };
  } finally {
    clearTimeout(timer);
    call.signal.removeEventListener("abort", kill);
  }
};

export { shellQuote } from "./shell.js";

// ── Browser ──

function htmlToText(html: string): string {
  return html
    .replace(/<head[\s\S]*?<\/head>/i, " ")
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Fetches a page (`url:` or the pipeline value) and returns its readable text. */
export const browser: ToolProvider = async (call, { fetch }) => {
  const raw = need(call, "a url", call.named.url ?? call.positional[0]).trim();
  const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new HaloError(`${call.tool.name}: "${raw}" is not a URL`, { code: "TOOL_ARGUMENT" });
  }
  const res = await fetch(parsed, { headers: { "User-Agent": "Halo-Browser/1.0", Accept: "text/html,text/plain,*/*" }, signal: call.signal });
  const body = await res.text();
  if (!res.ok) throw new HttpError(`${call.tool.name} could not fetch ${parsed.href} (${res.status})`, res.status, body.slice(0, 500));
  const maxChars = Number(call.named.maxChars ?? call.config("maxChars") ?? 15_000);
  const isHtml = (res.headers.get("content-type") ?? "").includes("html") || /^\s*</.test(body);
  const title = isHtml ? (body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim() : "";
  const text = isHtml ? htmlToText(body) : body;
  return { url: parsed.href, title, content: text.length > maxChars ? `${text.slice(0, maxChars)}…` : text };
};

// ── File (conversation history / notes) ──

async function readEntries(path: string): Promise<string[]> {
  const file = Bun.file(path);
  if (!(await file.exists())) return [];
  const data = await file.json().catch(() => []);
  return Array.isArray(data) ? data.map(str) : [];
}

const fileQueues = new Map<string, Promise<unknown>>();

/**
 * Run read-modify-write steps on one file one at a time: parallel appends (an agent that
 * equips the file, called from each) would otherwise read the same entries and drop each other's.
 */
function oneAtATime<T>(path: string, work: () => Promise<T>): Promise<T> {
  const key = resolve(path);
  const next = (fileQueues.get(key) ?? Promise.resolve()).then(work, work);
  const tail = next.catch(() => {});
  fileQueues.set(key, tail);
  void tail.then(() => fileQueues.get(key) === tail && fileQueues.delete(key));
  return next;
}

/** A JSON file of text entries: `read` (the last `keep`), `append`, `clear`. */
export const fileStore: ToolProvider = async (call) => {
  const path = call.config(0);
  if (typeof path !== "string" || !path) throw new HaloError(`Tool "${call.tool.name}" needs a file path, e.g. File(".halo/history.json")`, { code: "TOOL_CONFIG" });
  // When the path is filled from data (File(".halo/history-{{user}}.json")), it must stay in the
  // folder its fixed part names, so a value like "../../x" can't reach other files, and each value
  // must stay one name, so "x/../history-alice" can't reach another user's file in that folder.
  if (call.template0?.includes("{{")) {
    const fixed = call.template0.split("{{")[0]!;
    const folder = resolve(fixed.endsWith("/") ? fixed : dirname(`${fixed}x`));
    if (!resolve(path).startsWith(`${folder}${sep}`)) {
      throw new HaloError(`Tool "${call.tool.name}": "${path}" is outside ${relative(process.cwd(), folder) || "."}/`, { code: "TOOL_ARGUMENT" });
    }
    const shape = new RegExp(`^${call.template0.split(/\{\{\s*[\w.]+\s*\}\}/).map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("(?!\\.\\.?(?:[/\\\\]|$))[^/\\\\]*")}$`);
    if (!shape.test(path)) {
      throw new HaloError(`Tool "${call.tool.name}": "${path}" doesn't fit ${call.template0}; a {{value}} in a file path can't contain / or \\ or be . or ..`, { code: "TOOL_ARGUMENT" });
    }
  }
  const keep = Number(call.named.keep ?? call.config("keep") ?? 10);
  switch (call.method) {
    case "read":
    case "load":
    case "history":
      return (await readEntries(path)).slice(-keep).join("\n\n");
    case "append":
    case "add":
    case "save":
    case "write": {
      const entry = need(call, "content", call.named.content ?? call.positional[0]);
      return oneAtATime(path, async () => {
        const entries = [...(await readEntries(path)), entry].slice(-Math.max(keep, 1) * 5);
        mkdirSync(dirname(path), { recursive: true });
        await Bun.write(path, JSON.stringify(entries, null, 2));
        return { saved: true, entries: entries.length };
      });
    }
    case "clear":
      await Bun.write(path, "[]");
      return { cleared: true };
    default:
      return unknownMethod(call, ["read", "append", "clear"]);
  }
};

// ── Slack ──

export const slack: ToolProvider = async (call, { fetch }) => {
  const auth = { Authorization: `Bearer ${token(call, "SLACK_BOT_TOKEN")}`, "Content-Type": "application/json; charset=utf-8" };
  switch (call.method) {
    case "post":
    case "send":
    case "message":
    case "notify":
    case "execute": {
      const channel = need(call, "channel:", call.named.channel ?? call.config("channel"));
      const text = need(call, "text:", call.named.text ?? call.named.message ?? call.positional[0]);
      const buttons = Array.isArray(call.named.buttons) ? call.named.buttons.map(str) : [];
      const blocks = buttons.length
        ? [
            { type: "section", text: { type: "mrkdwn", text } },
            { type: "actions", elements: buttons.map((b, i) => ({ type: "button", text: { type: "plain_text", text: b }, value: b, action_id: `halo_${i}` })) },
          ]
        : undefined;
      const res = await fetch("https://slack.com/api/chat.postMessage", { method: "POST", headers: auth, body: JSON.stringify({ channel, text, blocks }), signal: call.signal });
      const body = await json(res, "Slack chat.postMessage");
      if (!body.ok) throw new HaloError(`Slack chat.postMessage failed: ${body.error}`, { code: "TOOL_FAILED" });
      return { ok: true, channel: body.channel, ts: body.ts };
    }
    default:
      return unknownMethod(call, ["post"]);
  }
};

// ── Email (Resend) ──

export const email: ToolProvider = async (call, { fetch }) => {
  if (!["send", "email", "execute", "notify"].includes(call.method)) unknownMethod(call, ["send"]);
  const from = need(call, "from: (here or in the tool declaration)", call.named.from ?? call.config("from"));
  const to = call.named.to ?? call.config("to");
  const body = {
    from,
    to: Array.isArray(to) ? to.map(str) : [need(call, "to:", to)],
    subject: need(call, "subject:", call.named.subject),
    text: need(call, "body:", call.named.body ?? call.named.text ?? call.positional[0]),
  };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${token(call, "RESEND_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: call.signal,
  });
  const out = await json(res, "Resend send");
  return { sent: true, id: out.id, to: body.to };
};

// ── GitHub ──

export const github: ToolProvider = async (call, { fetch }) => {
  const method = call.method === "execute" ? String(call.named.method ?? "") : call.method;
  const repo = need(call, `repo: "owner/name"`, call.named.repo ?? call.config("repo"));
  const api = async (path: string, verb: string, body?: unknown) => {
    const res = await fetch(`https://api.github.com/repos/${repo}${path}`, {
      method: verb,
      headers: { Authorization: `Bearer ${token(call, "GITHUB_TOKEN")}`, Accept: "application/vnd.github+json", "Content-Type": "application/json", "X-GitHub-Api-Version": "2022-11-28" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: call.signal,
    });
    return json(res, `GitHub ${verb} ${path}`);
  };
  const n = () => need(call, "number:", call.named.number ?? call.named.issue ?? call.named.pr);
  switch (method) {
    case "create_issue": {
      const r = await api("/issues", "POST", { title: need(call, "title:", call.named.title), body: call.named.body, labels: call.named.labels });
      return { number: r.number, url: r.html_url };
    }
    case "comment": {
      const r = await api(`/issues/${n()}/comments`, "POST", { body: need(call, "body:", call.named.body) });
      return { id: r.id, url: r.html_url };
    }
    case "add_labels":
      return { labels: (await api(`/issues/${n()}/labels`, "POST", { labels: call.named.labels })).map((l: { name: string }) => l.name) };
    case "create_pr": {
      const r = await api("/pulls", "POST", {
        title: need(call, "title:", call.named.title),
        head: need(call, "head: (or branch:)", call.named.head ?? call.named.branch),
        base: call.named.base ?? "main",
        body: call.named.body,
      });
      return { number: r.number, url: r.html_url };
    }
    case "get_issue":
      return api(`/issues/${n()}`, "GET");
    case "list_issues":
      return api(`/issues?state=${encodeURIComponent(str(call.named.state ?? "open"))}&per_page=${Number(call.named.limit ?? 30)}`, "GET");
    default:
      return unknownMethod(call, ["create_issue", "comment", "add_labels", "create_pr", "get_issue", "list_issues"]);
  }
};

// ── Linear ──

export const linear: ToolProvider = async (call, { fetch }) => {
  const gql = async (query: string, variables: Record<string, unknown>) => {
    const res = await fetch("https://api.linear.app/graphql", {
      method: "POST",
      headers: { Authorization: token(call, "LINEAR_TOKEN"), "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
      signal: call.signal,
    });
    const body = await json(res, "Linear GraphQL");
    if (body.errors?.length) throw new HaloError(`Linear: ${body.errors.map((e: { message: string }) => e.message).join("; ")}`, { code: "TOOL_FAILED" });
    return body.data;
  };
  const method = call.method === "execute" ? String(call.named.method ?? "") : call.method;
  if (method !== "create_issue") unknownMethod(call, ["create_issue"]);
  const key = need(call, `team: "ENG"`, call.named.team ?? call.config("team"));
  const teams = await gql(`query($key: String!) { teams(filter: { key: { eq: $key } }) { nodes { id } } }`, { key });
  const teamId = teams.teams.nodes[0]?.id;
  if (!teamId) throw new HaloError(`Linear: no team with key "${key}"`, { code: "TOOL_FAILED" });
  const data = await gql(
    `mutation($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { identifier url } } }`,
    { input: { teamId, title: need(call, "title:", call.named.title), description: call.named.description ?? call.named.body } },
  );
  return { id: data.issueCreate.issue.identifier, url: data.issueCreate.issue.url };
};

// ── Figma ──

export const figma: ToolProvider = async (call, { fetch }) => {
  const method = call.method === "execute" ? String(call.named.method ?? "") : call.method;
  const file = need(call, "file: (the file key from its URL)", call.named.file ?? call.config("file"));
  const get = async (path: string) =>
    json(await fetch(`https://api.figma.com/v1/files/${encodeURIComponent(file)}${path}`, { headers: { "X-Figma-Token": token(call, "FIGMA_TOKEN") }, signal: call.signal }), "Figma");
  switch (method) {
    case "get_file":
      return get(`?depth=${Number(call.named.depth ?? 2)}`);
    case "get_node": {
      const node = need(call, "node: (a node id like 1:2)", call.named.node ?? call.named.ids ?? call.positional[0]);
      return (await get(`/nodes?ids=${encodeURIComponent(node)}`)).nodes?.[node] ?? null;
    }
    default:
      return unknownMethod(call, ["get_file", "get_node"]);
  }
};

export const INTEGRATIONS: Record<string, ToolProvider> = {
  Bash: bash,
  Browser: browser,
  File: fileStore,
  Slack: slack,
  Email: email,
  GitHub: github,
  Linear: linear,
  Figma: figma,
};
