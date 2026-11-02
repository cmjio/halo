/**
 * Workspace: a folder an agent can read (and, if allowed, change).
 *
 *   tool Files : Workspace("./src", write: true)
 *     read(path, offset?, limit?)   write(path, content)   edit(path, old, new, all?)
 *     list(path?, depth?)   glob(pattern)   search(pattern, path?, regex?)   delete(path)   mkdir(path)
 *
 * Every path is relative to the root (resolved against the current directory).
 * Absolute paths and `..` are refused, and symlinks are resolved before use, so
 * a link inside the root that points outside it can't be read or written
 * through. Writes are refused unless the tool is declared with `write: true`.
 * Listing, glob and search skip node_modules and .git, never descend into
 * symlinked folders, and cap how many results they return.
 */

import { lstatSync, mkdirSync, readdirSync, realpathSync, rmSync, statSync, type Dirent } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { HaloError } from "../errors.js";
import type { ToolCall, ToolProvider } from "../tools.js";
import { intArg, need, str, unknownMethod } from "./common.js";

/** Largest file `read` returns whole (bytes); larger files are cut off. */
export const MAX_READ_BYTES = 1_000_000;
/** Largest content `write` / `edit` will store (bytes). */
const MAX_WRITE_BYTES = 10_000_000;
/** Most entries `list` / `glob` return, and most matches `search` returns. */
const MAX_ENTRIES = 1000;
const MAX_MATCHES = 200;
/** Most directory entries one walk looks at, so a huge tree can't stall a call. */
const MAX_VISITS = 50_000;
/** Folders skipped by list / glob / search (unless the path names one directly). */
const SKIP = new Set(["node_modules", ".git"]);

const METHODS = ["read", "write", "edit", "list", "glob", "search", "delete", "mkdir"];

function argError(call: ToolCall, message: string): HaloError {
  return new HaloError(`${call.tool.name}.${call.method}: ${message}`, { code: "TOOL_ARGUMENT" });
}

/** True when `child` is `parent` or inside it (both absolute, normalized). */
function within(parent: string, child: string): boolean {
  return child === parent || child.startsWith(parent.endsWith(sep) ? parent : parent + sep);
}

/** The root folder, made real (symlinks resolved). A writable root is created if missing. */
export function workspaceRoot(call: ToolCall, configured: unknown, create: boolean): string {
  const root = resolve(typeof configured === "string" && configured ? configured : ".");
  try {
    if (create) mkdirSync(root, { recursive: true });
    const real = realpathSync(root);
    if (!statSync(real).isDirectory()) throw new Error("not a folder");
    return real;
  } catch {
    throw new HaloError(`Tool "${call.tool.name}": root "${relative(process.cwd(), root) || "."}" is not a folder`, { code: "TOOL_CONFIG" });
  }
}

/**
 * Map a user-supplied relative path to a real path inside `root`.
 *
 * The path is checked as written (no absolute paths, no climbing with ..), then
 * the nearest part of it that exists is resolved with realpath, so a symlink
 * anywhere along it (the file itself or a parent folder) must also land inside
 * the root. A symlink that points nowhere is refused, since writing through it
 * would create its target wherever it points.
 *
 * With `keepLast`, the last segment is not followed (the parent is resolved and
 * the name kept), so `delete` removes a symlink itself rather than its target.
 */
export function confine(call: ToolCall, root: string, path: unknown, keepLast = false): { abs: string; rel: string } {
  if (typeof path !== "string" || path === "") throw argError(call, "needs a path");
  if (path.includes("\0")) throw argError(call, "path contains a NUL byte");
  if (isAbsolute(path) || /^[a-zA-Z]:[\\/]/.test(path) || path.startsWith("\\") || path.startsWith("~")) {
    throw argError(call, `"${path}" must be relative to the workspace root, not absolute`);
  }
  const lexical = resolve(root, path);
  if (!within(root, lexical)) throw argError(call, `"${path}" is outside the workspace`);

  if (keepLast && lexical !== root) {
    const parent = confine(call, root, relative(root, dirname(lexical)) || ".");
    const abs = join(parent.abs, basename(lexical));
    return { abs, rel: relative(root, abs).split(sep).join("/") || "." };
  }

  // Walk up to the nearest part of the path that exists (a dangling symlink counts as existing).
  let existing = lexical;
  const rest: string[] = [];
  for (;;) {
    let exists = true;
    try {
      lstatSync(existing);
    } catch {
      exists = false;
    }
    if (exists) break;
    rest.unshift(basename(existing));
    const up = dirname(existing);
    if (up === existing) break;
    existing = up;
  }
  let real: string;
  try {
    real = realpathSync(existing);
  } catch {
    throw argError(call, `"${path}" goes through a symlink that points nowhere`);
  }
  if (!within(root, real)) throw argError(call, `"${path}" resolves outside the workspace (through a symlink)`);
  const abs = join(real, ...rest);
  return { abs, rel: relative(root, abs).split(sep).join("/") || "." };
}

/** Byte-sniff for binary content: a NUL in the first 8KB. */
function looksBinary(bytes: Uint8Array): boolean {
  return bytes.subarray(0, 8192).includes(0);
}

interface WalkEntry {
  rel: string;
  abs: string;
  type: "file" | "dir" | "symlink";
  depth: number;
}

/**
 * Walk a folder breadth-first, never following symlinks, skipping SKIP folders.
 * Calls `visit` per entry; stops when it returns false or MAX_VISITS is reached.
 * Returns true if the walk was cut short.
 */
function walk(root: string, start: string, maxDepth: number, visit: (e: WalkEntry) => boolean): boolean {
  let visits = 0;
  const queue: Array<{ abs: string; depth: number }> = [{ abs: start, depth: 0 }];
  while (queue.length) {
    const dir = queue.shift()!;
    let entries: Dirent[];
    try {
      entries = readdirSync(dir.abs, { withFileTypes: true });
    } catch {
      continue;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const d of entries) {
      if (++visits > MAX_VISITS) return true;
      const abs = join(dir.abs, d.name);
      const type = d.isSymbolicLink() ? "symlink" : d.isDirectory() ? "dir" : d.isFile() ? "file" : undefined;
      if (!type) continue;
      if (type === "dir" && SKIP.has(d.name)) continue;
      const entry = { rel: relative(root, abs).split(sep).join("/"), abs, type, depth: dir.depth + 1 } as WalkEntry;
      if (!visit(entry)) return true;
      if (type === "dir" && entry.depth < maxDepth) queue.push({ abs, depth: entry.depth });
    }
  }
  return false;
}

/** `path` and the value that follows it: `write(path: "a", content: x)`, `write("a", x)`, or `x |> write(path: "a")`. */
function pathAndValue(call: ToolCall, valueName: string): [unknown, unknown] {
  if (call.named.path !== undefined) return [call.named.path, call.named[valueName] ?? call.positional[0]];
  return [call.positional[0], call.named[valueName] ?? call.positional[1]];
}

export const workspace: ToolProvider = async (call) => {
  if (!METHODS.includes(call.method)) unknownMethod(call, METHODS);
  const writable = call.config("write") === true;
  const writes = ["write", "edit", "delete", "mkdir"].includes(call.method);
  if (writes && !writable) {
    throw new HaloError(`Tool "${call.tool.name}" is read-only; declare it with write: true to allow ${call.method}`, { code: "TOOL_ARGUMENT" });
  }
  const root = workspaceRoot(call, call.config(0) ?? call.config("root"), writable);
  const named = call.named;

  switch (call.method) {
    case "read": {
      const { abs, rel } = confine(call, root, named.path ?? call.positional[0]);
      if (!lstatOrNull(abs)?.isFile()) throw argError(call, `no file "${rel}"`);
      const file = Bun.file(abs);
      const size = file.size;
      const bytes = new Uint8Array(await file.slice(0, MAX_READ_BYTES).arrayBuffer());
      if (looksBinary(bytes)) throw argError(call, `"${rel}" is a binary file`);
      const text = new TextDecoder().decode(bytes);
      const all = text.split("\n");
      const offset = intArg(call, "offset", named.offset, 1, 1, Number.MAX_SAFE_INTEGER);
      const limit = intArg(call, "limit", named.limit, all.length, 0, Number.MAX_SAFE_INTEGER);
      const whole = named.offset === undefined && named.limit === undefined;
      const content = whole ? text : all.slice(offset - 1, offset - 1 + limit).join("\n");
      return {
        path: rel,
        content,
        lines: all.length,
        ...(whole ? {} : { offset, limit }),
        ...(size > MAX_READ_BYTES ? { truncated: true, size } : {}),
      };
    }

    case "write": {
      const [path, value] = pathAndValue(call, "content");
      const { abs, rel } = confine(call, root, path);
      if (value === undefined || value === null) throw argError(call, "needs content");
      const content = str(value);
      if (Buffer.byteLength(content) > MAX_WRITE_BYTES) throw argError(call, `content is over ${MAX_WRITE_BYTES} bytes`);
      if (lstatOrNull(abs)?.isDirectory()) throw argError(call, `"${rel}" is a folder`);
      const created = !lstatOrNull(abs);
      mkdirSync(dirname(abs), { recursive: true });
      const bytes = await Bun.write(abs, content);
      return { path: rel, bytes, created };
    }

    case "edit": {
      const { abs, rel } = confine(call, root, named.path ?? call.positional[0]);
      const oldText = need(call, "old: (the exact text to replace)", named.old);
      if (named.new === undefined || named.new === null) throw argError(call, "needs new: (the replacement text)");
      const newText = str(named.new);
      if (!lstatOrNull(abs)?.isFile()) throw argError(call, `no file "${rel}"`);
      const file = Bun.file(abs);
      if (file.size > MAX_READ_BYTES) throw argError(call, `"${rel}" is too large to edit (${file.size} bytes)`);
      const text = await file.text();
      const count = text.split(oldText).length - 1;
      if (count === 0) throw argError(call, `old text not found in "${rel}"`);
      if (count > 1 && named.all !== true) throw argError(call, `old text appears ${count} times in "${rel}"; add more context to make it unique, or pass all: true`);
      const updated = named.all === true ? text.split(oldText).join(newText) : text.replace(oldText, () => newText);
      if (Buffer.byteLength(updated) > MAX_WRITE_BYTES) throw argError(call, `result is over ${MAX_WRITE_BYTES} bytes`);
      await Bun.write(abs, updated);
      return { path: rel, replacements: named.all === true ? count : 1 };
    }

    case "list": {
      const { abs, rel } = confine(call, root, named.path ?? call.positional[0] ?? ".");
      if (!lstatOrNull(abs)?.isDirectory()) throw argError(call, `"${rel}" is not a folder`);
      const depth = intArg(call, "depth", named.depth, 1, 1, 10);
      const entries: Array<{ path: string; type: string; size?: number }> = [];
      const cut = walk(root, abs, depth, (e) => {
        if (entries.length >= MAX_ENTRIES) return false;
        entries.push({ path: e.rel, type: e.type, ...(e.type === "file" ? { size: lstatOrNull(e.abs)?.size ?? 0 } : {}) });
        return true;
      });
      return { path: rel, entries, ...(cut ? { truncated: true } : {}) };
    }

    case "glob": {
      const pattern = need(call, "pattern: (e.g. \"**/*.ts\")", named.pattern ?? call.positional[0]);
      const glob = new Bun.Glob(pattern);
      const matches: string[] = [];
      // Matched against walked paths, so a pattern with ../ or an absolute path simply matches nothing.
      const cut = walk(root, root, 64, (e) => {
        if (e.type !== "dir" && glob.match(e.rel)) matches.push(e.rel);
        return matches.length < MAX_ENTRIES;
      });
      return { pattern, matches, ...(cut ? { truncated: true } : {}) };
    }

    case "search": {
      const pattern = need(call, "pattern: (the text to find)", named.pattern ?? named.query ?? call.positional[0]);
      const ignoreCase = named.ignore_case === true;
      let re: RegExp;
      try {
        re = named.regex === true ? new RegExp(pattern, ignoreCase ? "i" : "") : new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), ignoreCase ? "i" : "");
      } catch (e) {
        throw argError(call, `bad regex: ${(e as Error).message}`);
      }
      const { abs: start, rel: startRel } = confine(call, root, named.path ?? ".");
      const filter = typeof named.glob === "string" ? new Bun.Glob(named.glob) : undefined;
      const files: WalkEntry[] = [];
      const startStat = lstatOrNull(start);
      if (!startStat) throw argError(call, `no file or folder "${startRel}"`);
      let cut = false;
      if (startStat.isFile()) files.push({ rel: startRel, abs: start, type: "file", depth: 0 });
      else cut = walk(root, start, 64, (e) => (e.type === "file" && (!filter || filter.match(e.rel)) && files.push(e), true));
      const matches: Array<{ path: string; line: number; text: string }> = [];
      for (const f of files) {
        if (matches.length >= MAX_MATCHES) break;
        // Symlinked files are never followed (walk reports them as "symlink"), and big or binary files are skipped.
        const file = Bun.file(f.abs);
        if (file.size > MAX_READ_BYTES) continue;
        const bytes = new Uint8Array(await file.arrayBuffer());
        if (looksBinary(bytes)) continue;
        const lines = new TextDecoder().decode(bytes).split("\n");
        for (let i = 0; i < lines.length && matches.length < MAX_MATCHES; i++) {
          if (re.test(lines[i]!)) matches.push({ path: f.rel, line: i + 1, text: lines[i]!.slice(0, 300) });
        }
      }
      return { pattern, matches, ...(cut || matches.length >= MAX_MATCHES ? { truncated: true } : {}) };
    }

    case "delete": {
      const { abs, rel } = confine(call, root, named.path ?? call.positional[0], true);
      if (abs === root) throw argError(call, "can't delete the workspace root");
      const stat = lstatOrNull(abs);
      if (!stat) throw argError(call, `no file or folder "${rel}"`);
      if (stat.isDirectory() && named.recursive !== true && readdirSync(abs).length) {
        throw argError(call, `"${rel}" is a folder that isn't empty; pass recursive: true to delete it and everything in it`);
      }
      // A symlink is removed itself; its target (wherever it is) is left alone.
      rmSync(abs, { recursive: stat.isDirectory() });
      return { path: rel, deleted: true };
    }

    case "mkdir": {
      const { abs, rel } = confine(call, root, named.path ?? call.positional[0]);
      const existed = lstatOrNull(abs);
      if (existed && !existed.isDirectory()) throw argError(call, `"${rel}" exists and is not a folder`);
      mkdirSync(abs, { recursive: true });
      return { path: rel, created: !existed };
    }
  }
  return unknownMethod(call, METHODS);
};

function lstatOrNull(path: string) {
  try {
    return lstatSync(path);
  } catch {
    return null;
  }
}
