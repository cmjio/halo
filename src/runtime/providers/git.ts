/**
 * Git: a local repository, read through git itself (no shell, so arguments can't add commands).
 *
 *   tool Repo : Git("./", write: false)
 *     status()   log(limit?, path?, since?, author?)   diff(from?, to?, staged?, path?, stat?)   show(ref, path?)
 *     blame(path, start?, end?)   branches()   files(pattern?)   grep(pattern, path?)
 *     commit(message, paths?, all?)   checkout(branch, create?)        (these two need write: true)
 *
 * Refs and paths that start with "-" are refused, so a value can't turn into an option, and
 * paths always follow "--". Outputs are cut at `max_chars` (default 100000).
 */

import { HaloError } from "../errors.js";
import type { ToolCall, ToolProvider } from "../tools.js";
import { intArg, need, unknownMethod } from "./common.js";
import { workspaceRoot } from "./workspace.js";

const METHODS = ["status", "log", "diff", "show", "blame", "branches", "files", "grep", "commit", "checkout"];
const WRITES = new Set(["commit", "checkout"]);
const DEFAULT_MAX_CHARS = 100_000;
const TIMEOUT_MS = 30_000;
const SEP = "\x1f";
const END = "\x1e";

function argError(call: ToolCall, message: string): HaloError {
  return new HaloError(`${call.tool.name}.${call.method}: ${message}`, { code: "TOOL_ARGUMENT" });
}

/** A ref or path from the model or a pipeline: never an option, never a NUL. */
function safe(call: ToolCall, name: string, value: unknown): string {
  const s = need(call, name, value);
  if (s.startsWith("-")) throw argError(call, `${name} can't start with "-": ${s}`);
  if (/[\0\n\r]/.test(s)) throw argError(call, `${name} can't contain control characters`);
  return s;
}

function optional(call: ToolCall, name: string, value: unknown): string | undefined {
  return value === undefined || value === null || value === "" ? undefined : safe(call, name, value);
}

async function git(call: ToolCall, root: string, args: string[], okCodes = [0]): Promise<string> {
  const proc = Bun.spawn(["git", "-C", root, "-c", "core.quotepath=off", "-c", "color.ui=never", "--no-pager", ...args], {
    stdout: "pipe",
    stderr: "pipe",
    stdin: "ignore",
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_OPTIONAL_LOCKS: "0", LC_ALL: "C" },
  });
  const timer = setTimeout(() => proc.kill(), TIMEOUT_MS);
  const abort = () => proc.kill();
  call.signal.addEventListener("abort", abort, { once: true });
  try {
    const [out, err, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
    if (!okCodes.includes(code)) throw new HaloError(`${call.tool.name}.${call.method}: git ${args[0]} failed (${code}): ${err.trim().slice(0, 500) || out.trim().slice(0, 500)}`, { code: "TOOL_FAILED" });
    return out;
  } catch (err) {
    if (err instanceof HaloError) throw err;
    throw new HaloError(`${call.tool.name}: couldn't run git (${(err as Error).message}); is it installed?`, { code: "TOOL_CONFIG" });
  } finally {
    clearTimeout(timer);
    call.signal.removeEventListener("abort", abort);
  }
}

function clip(text: string, max: number): { text: string; truncated?: true } {
  return text.length > max ? { text: text.slice(0, max), truncated: true } : { text };
}

const STATUS_NAMES: Record<string, string> = { M: "modified", A: "added", D: "deleted", R: "renamed", C: "copied", U: "conflicted", "?": "untracked", "!": "ignored", T: "type_changed" };

export function parseStatus(out: string) {
  const lines = out.split("\n").filter(Boolean);
  const head = lines[0]?.startsWith("## ") ? lines.shift()!.slice(3) : "";
  const branch = head.split("...")[0]!.replace(/^No commits yet on /, "");
  const ahead = Number(head.match(/ahead (\d+)/)?.[1] ?? 0);
  const behind = Number(head.match(/behind (\d+)/)?.[1] ?? 0);
  const files = lines.map((l) => {
    const x = l[0]!;
    const y = l[1]!;
    const path = l.slice(3).split(" -> ").at(-1)!;
    const code = x !== " " && x !== "?" ? x : y;
    return { path, status: STATUS_NAMES[code] ?? code, staged: x !== " " && x !== "?" && x !== "!" };
  });
  return { branch, ahead, behind, clean: files.length === 0, files };
}

export const gitProvider: ToolProvider = async (call) => {
  const root = workspaceRoot(call, call.config(0) ?? call.config("root"), false);
  const n = call.named;
  const max = intArg(call, "max_chars", n.max_chars ?? call.config("max_chars"), DEFAULT_MAX_CHARS, 1000, 5_000_000);
  if (WRITES.has(call.method) && call.config("write") !== true) {
    throw new HaloError(`${call.tool.name}.${call.method} changes the repository; declare the tool with write: true to allow it`, { code: "TOOL_ARGUMENT" });
  }

  switch (call.method) {
    case "status":
      return parseStatus(await git(call, root, ["status", "--porcelain=v1", "-b", "--untracked-files=all"]));

    case "log": {
      const limit = intArg(call, "limit", n.limit, 20, 1, 500);
      const args = ["log", `-n${limit}`, `--format=%H${SEP}%h${SEP}%an${SEP}%ae${SEP}%aI${SEP}%s${SEP}%b${END}`];
      const ref = optional(call, "ref", n.ref);
      if (n.since !== undefined) args.push(`--since=${safe(call, "since", n.since)}`);
      if (n.author !== undefined) args.push(`--author=${safe(call, "author", n.author)}`);
      if (n.grep !== undefined) args.push(`--grep=${safe(call, "grep", n.grep)}`, "-i");
      if (ref) args.push(ref);
      const path = optional(call, "path", n.path);
      args.push("--", ...(path ? [path] : []));
      const out = await git(call, root, args, [0, 128]);
      return out
        .split(END)
        .map((r) => r.trim())
        .filter(Boolean)
        .map((r) => {
          const [hash, short, author, email, date, subject, body] = r.split(SEP);
          return { hash, short, author, email, date, subject, body: body?.trim() || undefined };
        });
    }

    case "diff": {
      const args = ["diff", "--no-ext-diff"];
      if (n.stat === true) args.push("--stat");
      if (n.staged === true) args.push("--cached");
      const from = optional(call, "from", n.from);
      const to = optional(call, "to", n.to);
      if (from) args.push(from);
      if (to) args.push(to);
      const path = optional(call, "path", n.path);
      args.push("--", ...(path ? [path] : []));
      const out = clip(await git(call, root, args), max);
      return { from: from ?? (n.staged === true ? "HEAD" : "index"), to: to ?? (n.staged === true ? "index" : "working tree"), diff: out.text, ...(out.truncated ? { truncated: true } : {}) };
    }

    case "show": {
      const ref = safe(call, "ref", n.ref ?? "HEAD");
      const path = optional(call, "path", n.path);
      if (path) {
        if (path.includes(":")) throw argError(call, "path can't contain \":\"");
        const out = clip(await git(call, root, ["show", `${ref}:${path}`]), max);
        return { ref, path, content: out.text, ...(out.truncated ? { truncated: true } : {}) };
      }
      const out = clip(await git(call, root, ["show", "--stat", "--patch", "--format=commit %H%nAuthor: %an <%ae>%nDate: %aI%n%n%B", ref, "--"]), max);
      return { ref, text: out.text, ...(out.truncated ? { truncated: true } : {}) };
    }

    case "blame": {
      const path = safe(call, "path", n.path);
      const args = ["blame", "--line-porcelain"];
      if (n.start !== undefined || n.end !== undefined) {
        const start = intArg(call, "start", n.start, 1, 1, Number.MAX_SAFE_INTEGER);
        const end = intArg(call, "end", n.end, start + 49, start, Number.MAX_SAFE_INTEGER);
        args.push(`-L${start},${end}`);
      }
      const ref = optional(call, "ref", n.ref);
      if (ref) args.push(ref);
      const out = await git(call, root, [...args, "--", path]);
      const lines: { line: number; hash: string; author: string; date: string; summary: string; text: string }[] = [];
      let cur: Record<string, string> = {};
      for (const l of out.split("\n")) {
        const head = l.match(/^([0-9a-f]{40}) \d+ (\d+)/);
        if (head) cur = { hash: head[1]!.slice(0, 12), line: head[2]! };
        else if (l.startsWith("author ")) cur.author = l.slice(7);
        else if (l.startsWith("author-time ")) cur.date = new Date(Number(l.slice(12)) * 1000).toISOString();
        else if (l.startsWith("summary ")) cur.summary = l.slice(8);
        else if (l.startsWith("\t")) lines.push({ line: Number(cur.line), hash: cur.hash!, author: cur.author ?? "", date: cur.date ?? "", summary: cur.summary ?? "", text: l.slice(1) });
        if (lines.length >= 2000) break;
      }
      return { path, lines };
    }

    case "branches": {
      const out = await git(call, root, ["branch", "--all", `--format=%(HEAD)${SEP}%(refname:short)${SEP}%(objectname:short)${SEP}%(committerdate:iso-strict)${SEP}%(subject)`]);
      return out
        .split("\n")
        .filter(Boolean)
        .map((l) => {
          const [head, name, hash, date, subject] = l.split(SEP);
          return { name, current: head === "*", hash, date, subject };
        });
    }

    case "files": {
      const args = ["ls-files", "--cached", "--others", "--exclude-standard"];
      const pattern = optional(call, "pattern", n.pattern);
      if (pattern) args.push("--", pattern);
      const files = (await git(call, root, args)).split("\n").filter(Boolean);
      return { count: files.length, files: files.slice(0, 5000), ...(files.length > 5000 ? { truncated: true } : {}) };
    }

    case "grep": {
      const pattern = need(call, "pattern", n.pattern);
      if (/[\0\n\r]/.test(pattern)) throw argError(call, "pattern can't contain control characters");
      const args = ["grep", "-n", "-I", "--untracked", n.regex === true ? "-E" : "-F"];
      if (n.ignore_case === true) args.push("-i");
      args.push("-e", pattern);
      const path = optional(call, "path", n.path);
      args.push("--", ...(path ? [path] : []));
      const out = await git(call, root, args, [0, 1]);
      const matches = out
        .split("\n")
        .filter(Boolean)
        .slice(0, 200)
        .map((l) => {
          const m = l.match(/^(.*?):(\d+):(.*)$/);
          return m ? { path: m[1], line: Number(m[2]), text: m[3]!.slice(0, 500) } : { path: l, line: 0, text: "" };
        });
      return { pattern, matches };
    }

    case "commit": {
      const message = need(call, "message", n.message);
      if (n.paths !== undefined) {
        const paths = (Array.isArray(n.paths) ? n.paths : [n.paths]).map((p, i) => safe(call, `paths.${i}`, p));
        if (paths.length) await git(call, root, ["add", "--", ...paths]);
      } else if (n.all === true) {
        await git(call, root, ["add", "--all"]);
      }
      const staged = (await git(call, root, ["diff", "--cached", "--name-only"])).split("\n").filter(Boolean);
      if (!staged.length) return { committed: false, reason: "nothing staged to commit" };
      const author = call.config("author");
      await git(call, root, ["commit", "--no-verify", "--no-gpg-sign", `--message=${message}`, ...(author ? [`--author=${safe(call, "author", author)}`] : [])]);
      const hash = (await git(call, root, ["rev-parse", "HEAD"])).trim();
      return { committed: true, hash, files: staged };
    }

    case "checkout": {
      const branch = safe(call, "branch", n.branch);
      if (n.create === true) await git(call, root, ["switch", "-c", branch]);
      else await git(call, root, ["switch", branch]);
      return { branch, created: n.create === true };
    }

    default:
      return unknownMethod(call, METHODS);
  }
};
