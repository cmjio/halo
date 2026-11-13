/**
 * Helpers for sandboxes that don't depend on which backend runs them:
 *
 *   - tarball(): pack files into a ustar archive, to copy a project into a sandbox in one write
 *   - projectFiles(): the files of a local folder worth copying (git's view of it when it's a repo)
 *   - hostAllowed() and PROXY_SCRIPT: the egress allowlist a Docker sandbox's proxy enforces
 *   - compareTrees(): what changed between the files a sandbox started with and what it has now
 */

import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

// ── tar ──

function octal(n: number, width: number): string {
  return n.toString(8).padStart(width - 1, "0") + "\0";
}

/** Split a path into ustar's prefix (≤155) and name (≤100), at a slash. */
function ustarName(path: string): { name: string; prefix: string } {
  const bytes = new TextEncoder().encode(path).length;
  if (bytes <= 100) return { name: path, prefix: "" };
  for (let i = path.length - 1; i > 0; i--) {
    if (path[i] !== "/") continue;
    const prefix = path.slice(0, i);
    const name = path.slice(i + 1);
    if (new TextEncoder().encode(name).length <= 100 && new TextEncoder().encode(prefix).length <= 155) return { name, prefix };
  }
  throw new Error(`"${path}" is too long to copy into a sandbox`);
}

/** A ustar archive of regular files (directories are implied by their paths). */
export function tarball(files: { path: string; bytes: Uint8Array; mode?: number }[]): Uint8Array {
  const enc = new TextEncoder();
  const blocks: Uint8Array[] = [];
  for (const f of files) {
    const header = new Uint8Array(512);
    const { name, prefix } = ustarName(f.path);
    const put = (text: string, at: number) => header.set(enc.encode(text), at);
    put(name, 0);
    put(octal(f.mode ?? 0o644, 8), 100);
    put(octal(0, 8), 108);
    put(octal(0, 8), 116);
    put(octal(f.bytes.length, 12), 124);
    put(octal(Math.floor(Date.now() / 1000), 12), 136);
    put("        ", 148); // checksum counts as spaces while it's computed
    put("0", 156);
    put("ustar\0", 257);
    put("00", 263);
    put(prefix, 345);
    let sum = 0;
    for (const b of header) sum += b;
    put(octal(sum, 7) + " ", 148);
    blocks.push(header, f.bytes);
    const pad = (512 - (f.bytes.length % 512)) % 512;
    if (pad) blocks.push(new Uint8Array(pad));
  }
  blocks.push(new Uint8Array(1024));
  const out = new Uint8Array(blocks.reduce((n, b) => n + b.length, 0));
  let at = 0;
  for (const b of blocks) (out.set(b, at), (at += b.length));
  return out;
}

// ── A project's files ──

/** Folders never copied into a sandbox, nor reported as its changes. */
export const SKIP_DIRS = new Set([".git", "node_modules", "__pycache__", ".venv", "venv", ".halo", ".pytest_cache", ".mypy_cache", ".cache", ".npm", ".next", "dist", "target"]);

/**
 * The files of `dir` to copy into a sandbox, relative and with forward slashes: git's tracked and
 * untracked-but-not-ignored files in a repo, else every file outside SKIP_DIRS.
 */
export function projectFiles(dir: string): string[] {
  let git: { exitCode: number | null; stdout: Uint8Array } | undefined;
  try {
    git = Bun.spawnSync(["git", "-C", dir, "ls-files", "-co", "--exclude-standard", "-z"], { stdout: "pipe", stderr: "ignore", env: process.env });
  } catch {
    git = undefined; // no git installed: walk the folder instead
  }
  if (git?.exitCode === 0) {
    return new TextDecoder()
      .decode(git.stdout)
      .split("\0")
      .filter(Boolean)
      .filter((p) => {
        try {
          return statSync(join(dir, p)).isFile();
        } catch {
          return false; // deleted but still in the index
        }
      });
  }
  const out: string[] = [];
  const walk = (at: string) => {
    for (const e of readdirSync(at, { withFileTypes: true })) {
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) walk(join(at, e.name));
      } else if (e.isFile()) out.push(relative(dir, join(at, e.name)).split(sep).join("/"));
    }
  };
  walk(dir);
  return out.sort();
}

export function sha256Hex(bytes: Uint8Array): string {
  return new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
}

// ── What changed ──

export interface FileChange {
  path: string;
  status: "added" | "modified" | "deleted";
}

/**
 * Compare the files a sandbox started with (`before`, path → sha256) with what it has now.
 * Dot-folders at the top (a home's .cache, .local, .config…) count only if the project had them.
 */
export function compareTrees(before: Map<string, string>, now: Map<string, string>): FileChange[] {
  const tops = new Set([...before.keys()].map((p) => p.split("/")[0]!));
  const counts = (p: string) => {
    const top = p.split("/")[0]!;
    return !top.startsWith(".") || tops.has(top) || before.has(p);
  };
  const changes: FileChange[] = [];
  for (const [p, h] of now) {
    if (!counts(p)) continue;
    const was = before.get(p);
    if (was === undefined) changes.push({ path: p, status: "added" });
    else if (was !== h) changes.push({ path: p, status: "modified" });
  }
  for (const p of before.keys()) if (!now.has(p)) changes.push({ path: p, status: "deleted" });
  return changes.sort((a, b) => a.path.localeCompare(b.path));
}

/** A shell command printing `<sha256>  ./<path>` for every file under the current folder, outside SKIP_DIRS. */
export function hashCommand(): string {
  const prune = [...SKIP_DIRS].map((d) => `-name '${d}'`).join(" -o ");
  return `find . \\( ${prune} \\) -prune -o -type f -exec sha256sum {} +`;
}

/** Parse hashCommand()'s output. */
export function parseHashes(text: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const line of text.split("\n")) {
    const m = /^([0-9a-f]{64})\s+\*?\.\/(.+)$/.exec(line);
    if (m) out.set(m[2]!, m[1]!);
  }
  return out;
}

// ── Egress allowlist ──

export { HOST_PATTERN } from "../../parser/builtins.js";

/** Whether `host` matches one of `allowed` ("pypi.org", or "*.pythonhosted.org" for it and its subdomains). */
export function hostAllowed(host: string, allowed: string[]): boolean {
  const h = host.toLowerCase().replace(/\.$/, "").replace(/^\[|\]$/g, "");
  return allowed.some((p) => {
    const q = p.toLowerCase();
    return q.startsWith("*.") ? h === q.slice(2) || h.endsWith(q.slice(1)) : h === q;
  });
}

/**
 * A forward proxy for a Docker sandbox, run with `bun -e` in its own container. It tunnels HTTPS
 * (CONNECT) and forwards plain HTTP, but only to hosts in HALO_HOSTS (a JSON list), and prints
 * `{"blocked":"<host>"}` for each refusal so Halo can report it. It is the sandbox's only way out:
 * the sandbox sits on an internal network with no route anywhere else.
 */
export const PROXY_SCRIPT = `
const net = require("node:net");
const allowed = JSON.parse(process.env.HALO_HOSTS || "[]");
${hostAllowed.toString()}
const refuse = (sock, host) => { console.log(JSON.stringify({ blocked: host })); sock.end("HTTP/1.1 403 Forbidden\\r\\ncontent-type: text/plain\\r\\nconnection: close\\r\\n\\r\\nblocked by halo: " + host + " is not an allowed host\\n"); };
const split = (hp, port) => { const m = /^\\[([^\\]]+)\\](?::(\\d+))?$/.exec(hp) || /^([^:]+)(?::(\\d+))?$/.exec(hp); return m ? [m[1], Number(m[2] || port)] : [hp, port]; };
net.createServer((sock) => {
  let buf = Buffer.alloc(0);
  const onData = (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    const end = buf.indexOf("\\r\\n\\r\\n");
    if (end < 0) { if (buf.length > 65536) sock.destroy(); return; }
    sock.off("data", onData);
    const head = buf.subarray(0, end).toString("latin1");
    const rest = buf.subarray(end + 4);
    const [method, target, version] = head.split("\\r\\n")[0].split(" ");
    if (method === "CONNECT") {
      const [host, port] = split(target, 443);
      if (!hostAllowed(host, allowed)) return refuse(sock, host);
      const up = net.connect(port, host, () => { sock.write("HTTP/1.1 200 Connection Established\\r\\n\\r\\n"); if (rest.length) up.write(rest); up.pipe(sock); sock.pipe(up); });
      up.on("error", () => sock.destroy()); sock.on("error", () => up.destroy());
      return;
    }
    let url; try { url = new URL(target); } catch { return sock.end("HTTP/1.1 400 Bad Request\\r\\n\\r\\n"); }
    if (url.protocol !== "http:") return sock.end("HTTP/1.1 400 Bad Request\\r\\n\\r\\n");
    if (!hostAllowed(url.hostname, allowed)) return refuse(sock, url.hostname);
    const lines = head.split("\\r\\n").slice(1).filter((l) => !/^proxy-/i.test(l));
    const up = net.connect(Number(url.port || 80), url.hostname, () => {
      up.write([method + " " + url.pathname + url.search + " " + version, ...lines].join("\\r\\n") + "\\r\\n\\r\\n");
      if (rest.length) up.write(rest);
      up.pipe(sock); sock.pipe(up);
    });
    up.on("error", () => sock.destroy()); sock.on("error", () => up.destroy());
  };
  sock.on("data", onData);
  sock.on("error", () => {});
}).listen(3128, () => console.log(JSON.stringify({ ready: true })));
`;
