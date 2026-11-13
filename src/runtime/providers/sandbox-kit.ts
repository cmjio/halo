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
 * Files that hold credentials (.env, keys, registry and git logins), never copied into a sandbox
 * unless files: names them exactly. Templates such as .env.example are fine.
 */
export function credentialFile(path: string): boolean {
  const name = path.slice(path.lastIndexOf("/") + 1).toLowerCase();
  if (/^\.env(\..+)?$/.test(name)) return !/\.(example|sample|template|dist|defaults?)$/.test(name);
  if (/\.(pem|key|p12|pfx|jks|keystore|kdbx|ppk|gpg)$/.test(name)) return true;
  if (/^id_(rsa|dsa|ecdsa|ed25519)(_sk)?$/.test(name)) return true;
  return [".npmrc", ".yarnrc.yml", ".pypirc", ".netrc", ".git-credentials", ".dockercfg", "credentials", "credentials.json", "service-account.json", ".htpasswd"].includes(name);
}

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
 * Whether an address is one a sandbox must not reach through its proxy: loopback, private,
 * link-local (cloud metadata at 169.254.169.254), CGNAT, multicast, and their IPv6 forms.
 */
export function privateAddress(ip: string): boolean {
  let a = ip.toLowerCase();
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(a);
  if (mapped) a = mapped[1]!;
  const v4 = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(a);
  if (v4) {
    const [x, y] = [Number(v4[1]), Number(v4[2])];
    return x === 0 || x === 10 || x === 127 || x >= 224 || (x === 100 && y >= 64 && y < 128) || (x === 169 && y === 254) || (x === 172 && y >= 16 && y < 32) || (x === 192 && y === 168) || (x === 192 && y === 0 && Number(v4[3]) === 0) || (x === 198 && (y === 18 || y === 19));
  }
  return a === "::" || a === "::1" || /^f[cd]/.test(a) || /^fe[89ab]/.test(a) || /^ff/.test(a) || a.startsWith("::ffff:") || a.startsWith("64:ff9b:");
}

/**
 * The server name (SNI) in a TLS ClientHello: the name, null when there is none or `b` isn't a
 * ClientHello, undefined when more bytes are needed.
 */
export function tlsServerName(b: Uint8Array): string | null | undefined {
  if (b.length < 5) return undefined;
  if (b[0] !== 0x16) return null;
  const end = 5 + ((b[3]! << 8) | b[4]!);
  if (b.length < end) return end > 5 + 16384 ? null : undefined;
  const u16 = (i: number) => (b[i]! << 8) | b[i + 1]!;
  let p = 5;
  if (b[p] !== 1) return null;
  p += 4 + 2 + 32;
  if (p >= end) return null;
  p += 1 + b[p]!;
  if (p + 2 > end) return null;
  p += 2 + u16(p);
  if (p >= end) return null;
  p += 1 + b[p]!;
  if (p + 2 > end) return null;
  const extEnd = Math.min(end, p + 2 + u16(p));
  p += 2;
  while (p + 4 <= extEnd) {
    const type = u16(p);
    const len = u16(p + 2);
    p += 4;
    if (type === 0) {
      if (p + 5 > extEnd || b[p + 2] !== 0) return null;
      const n = u16(p + 3);
      if (p + 5 + n > extEnd) return null;
      return String.fromCharCode(...b.subarray(p + 5, p + 5 + n));
    }
    p += len;
  }
  return null;
}

/**
 * A forward proxy for a Docker sandbox, run with `bun -e` in its own container. It tunnels HTTPS
 * (CONNECT, port 443) and forwards plain HTTP (port 80), but only to hosts in HALO_HOSTS (a JSON
 * list), and prints `{"blocked":"<host>"}` for each refusal so Halo can report it. It is the
 * sandbox's only way out: the sandbox sits on an internal network with no route anywhere else.
 *
 * What it checks, beyond the name asked for:
 * - the address the name resolves to is public (no loopback, private network or cloud metadata),
 *   and it connects to that checked address, so a second lookup can't swap it;
 * - over HTTPS, the TLS server name (SNI) is the host the tunnel was opened to, so a request
 *   can't ride an allowed host's CDN to another site on it;
 * - over plain HTTP, the Host header is the URL's host, and the connection closes after one
 *   request.
 * A site behind the same CDN can still be reached from inside the TLS session (by its Host
 * header) without a proxy that decrypts traffic, which this one doesn't.
 */
export const PROXY_SCRIPT = `
const net = require("node:net");
const dns = require("node:dns");
const allowed = JSON.parse(process.env.HALO_HOSTS || "[]");
${hostAllowed.toString()}
${privateAddress.toString()}
${tlsServerName.toString()}
const norm = (h) => String(h).toLowerCase().replace(/\\.$/, "");
const refuse = (sock, host, why) => { console.log(JSON.stringify({ blocked: host })); sock.end("HTTP/1.1 403 Forbidden\\r\\ncontent-type: text/plain\\r\\nconnection: close\\r\\n\\r\\nblocked by halo: " + host + " " + (why || "is not an allowed host") + "\\n"); };
const split = (hp, port) => { const m = /^\\[([^\\]]+)\\](?::(\\d+))?$/.exec(hp) || /^([^:]+)(?::(\\d+))?$/.exec(hp); return m ? [m[1], Number(m[2] || port)] : [hp, port]; };
// Resolve a name to an address the sandbox may reach, or say why not.
const resolve = (host, done) => {
  if (net.isIP(host)) return done(null, "is an address, not a host name");
  dns.lookup(host, { all: true }, (err, list) => {
    if (err || !list || !list.length) return done(null, "didn't resolve");
    const ok = list.find((a) => !privateAddress(a.address));
    if (!ok || list.some((a) => privateAddress(a.address))) return done(null, "resolves to a private address");
    done(ok.address);
  });
};
let open = 0;
net.createServer((sock) => {
  if (open >= 256) return sock.destroy();
  open++;
  sock.on("close", () => open--);
  sock.setTimeout(300000, () => sock.destroy());
  let buf = Buffer.alloc(0);
  const onData = (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    const end = buf.indexOf("\\r\\n\\r\\n");
    if (end < 0) { if (buf.length > 65536) sock.destroy(); return; }
    sock.off("data", onData);
    sock.pause();
    const head = buf.subarray(0, end).toString("latin1");
    const rest = buf.subarray(end + 4);
    const [method, target, version] = head.split("\\r\\n")[0].split(" ");
    if (method === "CONNECT") {
      const [host, port] = split(target, 443);
      if (!hostAllowed(host, allowed)) return refuse(sock, host);
      if (port !== 443) return refuse(sock, host + ":" + port, "is allowed on port 443 only");
      return resolve(host, (ip, why) => {
        if (!ip) return refuse(sock, host, why);
        sock.write("HTTP/1.1 200 Connection Established\\r\\n\\r\\n");
        // Hold the client's first TLS record until its server name checks out.
        let hello = rest;
        const check = () => {
          const name = tlsServerName(hello);
          if (name === undefined) return false;
          sock.off("data", more);
          if (name === null || norm(name) !== norm(host)) {
            console.log(JSON.stringify({ blocked: name ? norm(name) : host + " (no TLS server name)" }));
            return sock.destroy(), true;
          }
          sock.pause();
          const up = net.connect(443, ip, () => { up.write(hello); up.pipe(sock); sock.pipe(up); sock.resume(); });
          up.on("error", () => sock.destroy()); sock.on("error", () => up.destroy());
          return true;
        };
        const more = (chunk) => { hello = Buffer.concat([hello, chunk]); check(); };
        if (!check()) { sock.on("data", more); sock.resume(); }
      });
    }
    let url; try { url = new URL(target); } catch { return sock.end("HTTP/1.1 400 Bad Request\\r\\n\\r\\n"); }
    if (url.protocol !== "http:") return sock.end("HTTP/1.1 400 Bad Request\\r\\n\\r\\n");
    if (!hostAllowed(url.hostname, allowed)) return refuse(sock, url.hostname);
    if (url.port && url.port !== "80") return refuse(sock, url.hostname + ":" + url.port, "is allowed on port 80 only");
    resolve(url.hostname, (ip, why) => {
      if (!ip) return refuse(sock, url.hostname, why);
      // The Host header is the URL's host, whatever the client sent, and one request per connection.
      const lines = head.split("\\r\\n").slice(1).filter((l) => !/^(proxy-[^:]*|host|connection|keep-alive)\\s*:/i.test(l));
      const up = net.connect(80, ip, () => {
        up.write([method + " " + url.pathname + url.search + " " + version, "Host: " + url.host, "Connection: close", ...lines].join("\\r\\n") + "\\r\\n\\r\\n");
        if (rest.length) up.write(rest);
        up.pipe(sock); sock.pipe(up); sock.resume();
      });
      up.on("error", () => sock.destroy()); sock.on("error", () => up.destroy());
    });
  };
  sock.on("data", onData);
  sock.on("error", () => {});
}).listen(3128, () => console.log(JSON.stringify({ ready: true })));
`;
