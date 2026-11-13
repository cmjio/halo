/**
 * Remote: a computer somewhere else that an agent can run commands on and move files to.
 *
 *   tool Box  : Remote("deploy@build.example.com")       a machine you reach over SSH
 *   tool Box  : Remote("ssh://deploy@10.0.0.5:2222", key: "~/.ssh/ci")
 *   tool Lab  : Remote("e2b")                             a fresh cloud sandbox from E2B (E2B_API_KEY)
 *   tool Lab  : Remote("daytona", snapshot: "python")     ... or from Daytona (DAYTONA_API_KEY)
 *   tool Lab  : Remote("docker", image: "node:22")        ... or a container on this machine (Docker)
 *
 *     run(command, cwd?, env?, timeout_ms?)  →  { command, stdout, stderr, exitCode, timedOut, json? }
 *     read(path)                             →  { path, content, bytes, encoding }
 *     write(path, content)                   →  { path, bytes }
 *     list(path?)                            →  { path, entries: [{ name, type }] }
 *     upload(from, to)                       local file → remote
 *     download(from, to)                     remote file → local
 *     info()                                 →  { backend, host | id }
 *
 * SSH uses the `ssh` on this machine with your keys and ~/.ssh/config, in batch mode (it
 * never prompts), and checks host keys against known_hosts as ssh always does. Each call
 * is its own connection; remote paths are relative to the login's home folder.
 *
 * A sandbox is created on a run's first call, kept for the rest of that run (so a run can
 * write a file, then test it), and deleted when the run ends. If Halo dies before it can
 * delete one, the provider removes it anyway: E2B after `ttl_minutes` (default 30),
 * Daytona once it has been idle `idle_minutes` (default 15), and a Docker container stops
 * (and, being --rm, removes itself) after `ttl_minutes` (default 30).
 *
 * Local paths (upload's `from`, download's `to`) stay inside `root:` (default ".").
 *
 * A sandbox can be narrowed further:
 *   files: ["src/billing"]       with from:, only those paths are copied in, shown by diff, and
 *                                written back by apply, upload and download
 *   secrets: ["STRIPE_TEST_KEY"] those environment variables (read from Halo's environment) are
 *                                set for each command, never stored in the container or its
 *                                snapshots, and their values are masked in what comes back (Docker only)
 */

import { mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, posix } from "node:path";
import { HaloError, TimeoutError } from "../errors.js";
import type { ToolCall, ToolServices } from "../tools.js";
import { shellQuote as q } from "../shell.js";
import { intArg, need, unknownMethod } from "./common.js";
import { confine, workspaceRoot } from "./workspace.js";
import { unifiedDiff } from "../../diff.js";
import { inFiles, scopePath, SECRET_NAME } from "../../parser/builtins.js";
import { compareTrees, hashCommand, HOST_PATTERN, parseHashes, projectFiles, PROXY_SCRIPT, sha256Hex, tarball, type FileChange } from "./sandbox-kit.js";

const METHODS = ["run", "read", "write", "list", "upload", "download", "info", "diff", "apply", "keep"];
const MAX_OUTPUT = 100_000;
const MAX_FILE = 50_000_000;
const DEFAULT_TIMEOUT_MS = 120_000;

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
  /** Hosts the sandbox's egress allowlist refused while the command ran. */
  blocked?: string[];
}

export interface ExecOptions {
  cwd?: string;
  env: Record<string, string>;
  timeoutMs: number;
  signal: AbortSignal;
}

/** One remote computer, whichever kind. */
export interface Machine {
  backend: "ssh" | "e2b" | "daytona" | "docker";
  /** The host (ssh) or sandbox id. */
  id: string;
  exec(command: string, opts: ExecOptions): Promise<ExecResult>;
  read(path: string, signal: AbortSignal): Promise<Uint8Array>;
  write(path: string, bytes: Uint8Array, signal: AbortSignal): Promise<void>;
  /** Save the sandbox's files as something a new sandbox can start from (Docker: an image). */
  snapshot?(): Promise<string>;
  close(): Promise<void>;
}

function fail(call: ToolCall, message: string, code = "TOOL_FAILED"): HaloError {
  return new HaloError(`${call.tool.name}.${call.method}: ${message}`, { code });
}

/** An error from a sandbox, which outlives the call that created it: name the tool, not that call's method. */
function sandboxFail(call: ToolCall, message: string): HaloError {
  return new HaloError(`${call.tool.name}: ${message}`, { code: "TOOL_FAILED" });
}

function configError(call: ToolCall, message: string): HaloError {
  return new HaloError(`Tool "${call.tool.name}": ${message}`, { code: "TOOL_CONFIG" });
}

function clip(text: string): string {
  return text.length > MAX_OUTPUT ? `${text.slice(0, MAX_OUTPUT)}\n… (cut at ${MAX_OUTPUT} characters)` : text;
}

/** A `cd` and `export`s in front of a command, every value quoted. */
export function prelude(cwd: string | undefined, env: Record<string, string>): string {
  let out = "";
  for (const [k, v] of Object.entries(env)) out += `export ${k}=${q(v)}; `;
  if (cwd) out += `cd -- ${q(cwd)} && `;
  return out;
}

// ── SSH ──

export interface SshTarget {
  user?: string;
  host: string;
  port?: number;
}

/** Parse "user@host", "host", "ssh://user@host:port" (and "[::1]" hosts). */
export function parseSshTarget(text: string): SshTarget {
  let rest = text.trim().replace(/^ssh:\/\//i, "");
  // Values can't become ssh options, or carry anything a shell or ssh would read specially.
  if (!rest || rest.startsWith("-") || /[\s'"`$;|&<>\\\0]/.test(rest)) throw new Error(`"${text}" is not an SSH host`);
  let user: string | undefined;
  const at = rest.lastIndexOf("@");
  if (at >= 0) {
    user = rest.slice(0, at);
    rest = rest.slice(at + 1);
    if (!user || user.startsWith("-")) throw new Error(`"${text}" is not an SSH host`);
  }
  let port: number | undefined;
  const bracket = /^\[([^\]]+)\](?::(\d+))?$/.exec(rest);
  if (bracket) {
    rest = bracket[1]!;
    if (bracket[2]) port = Number(bracket[2]);
  } else {
    const m = /^([^:]+):(\d+)$/.exec(rest);
    if (m) {
      rest = m[1]!;
      port = Number(m[2]);
    }
  }
  if (!rest || rest.startsWith("-") || rest.includes("/")) throw new Error(`"${text}" is not an SSH host`);
  if (port !== undefined && (!Number.isInteger(port) || port < 1 || port > 65535)) throw new Error(`"${text}" has a bad port`);
  return { user, host: rest, port };
}

/** The arguments to `ssh`, before the remote command. */
export function sshArgs(target: SshTarget, opts: { key?: string; connectTimeout?: number; strict?: boolean }): string[] {
  const args = ["-o", "BatchMode=yes", "-o", `ConnectTimeout=${opts.connectTimeout ?? 15}`, "-o", "ServerAliveInterval=15", "-T"];
  if (opts.strict === false) args.push("-o", "StrictHostKeyChecking=accept-new");
  if (target.port) args.push("-p", String(target.port));
  if (opts.key) args.push("-i", opts.key, "-o", "IdentitiesOnly=yes");
  if (target.user) args.push("-l", target.user);
  args.push("--", target.host);
  return args;
}

function expandHome(path: string): string {
  return path.startsWith("~/") ? `${process.env.HOME ?? ""}${path.slice(1)}` : path;
}

/** Read a stream into memory, so whatever arrived can be taken even if it never ends. */
function collect(stream: ReadableStream<Uint8Array>) {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
  const done = (async () => {
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) return;
        chunks.push(value);
      }
    } catch {}
  })();
  return {
    done,
    stop: () => void reader.cancel().catch(() => {}),
    bytes: () => {
      const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
      let at = 0;
      for (const c of chunks) (out.set(c, at), (at += c.length));
      return out;
    },
  };
}

/** Run a program, feeding it `stdin`, killed after `timeoutMs` or when `signal` aborts. */
async function spawnProgram(argv: string[], opts: { stdin?: Uint8Array; timeoutMs: number; signal: AbortSignal; env?: Record<string, string> }) {
  // env: process.env so `docker`/`ssh` are looked up on the PATH as it is now, not as it was at startup.
  const proc = Bun.spawn(argv, { stdin: opts.stdin ? "pipe" : "ignore", stdout: "pipe", stderr: "pipe", env: opts.env ? { ...process.env, ...opts.env } : process.env });
  let timedOut = false;
  const kill = () => proc.kill();
  const timer = setTimeout(() => {
    timedOut = true;
    proc.kill();
  }, opts.timeoutMs);
  opts.signal.addEventListener("abort", kill, { once: true });
  try {
    if (opts.stdin && proc.stdin) {
      proc.stdin.write(opts.stdin);
      await proc.stdin.end();
    }
    const out = collect(proc.stdout);
    const err = collect(proc.stderr);
    const code = await proc.exited;
    const exitCode = typeof code === "number" ? code : -1;
    // A killed client can leave a child holding its pipes open; don't wait on them past a moment.
    const grace = timedOut || opts.signal.aborted ? 500 : 30_000;
    await Promise.race([Promise.all([out.done, err.done]), Bun.sleep(grace)]);
    out.stop();
    err.stop();
    return { out: out.bytes(), err: new TextDecoder().decode(err.bytes()), exitCode, timedOut };
  } finally {
    clearTimeout(timer);
    opts.signal.removeEventListener("abort", kill);
  }
}

function sshMachine(call: ToolCall, spec: string): Machine {
  let target: SshTarget;
  try {
    target = parseSshTarget(spec);
  } catch (e) {
    throw configError(call, (e as Error).message);
  }
  const key = call.config("key");
  const ssh = (call.config("ssh") as string | undefined) ?? "ssh";
  const base = sshArgs(target, {
    key: typeof key === "string" && key ? expandHome(key) : undefined,
    connectTimeout: typeof call.config("connect_timeout") === "number" ? (call.config("connect_timeout") as number) : undefined,
    // Only a first connection to a host is trusted on sight; a changed key is still refused.
    strict: call.config("accept_new_hosts") === true ? false : undefined,
  });
  const id = `${target.user ? `${target.user}@` : ""}${target.host}${target.port ? `:${target.port}` : ""}`;

  const spawn = (remote: string, opts: { stdin?: Uint8Array; timeoutMs: number; signal: AbortSignal }) => spawnProgram([ssh, ...base, remote], opts);

  /** ssh exits 255 when it couldn't connect or log in (not when the command did). */
  const connectError = (r: { exitCode: number; err: string }) =>
    r.exitCode === 255 ? new HaloError(`${call.tool.name}: couldn't reach ${id} over SSH: ${r.err.trim() || "connection failed"}`, { code: "TOOL_FAILED", retryable: true }) : undefined;

  return {
    backend: "ssh",
    id,
    async exec(command, opts) {
      const r = await spawn(prelude(opts.cwd, opts.env) + command, opts);
      const e = connectError(r);
      if (e && !r.timedOut) throw e;
      return { stdout: new TextDecoder().decode(r.out), stderr: r.err, exitCode: r.exitCode, timedOut: r.timedOut };
    },
    async read(path, signal) {
      const r = await spawn(`cat -- ${q(path)}`, { timeoutMs: DEFAULT_TIMEOUT_MS, signal });
      const e = connectError(r);
      if (e) throw e;
      if (r.exitCode !== 0) throw fail(call, r.err.trim() || `can't read ${path}`);
      return r.out;
    },
    async write(path, bytes, signal) {
      const dir = posix.dirname(path);
      const r = await spawn(`${dir === "." ? "" : `mkdir -p -- ${q(dir)} && `}cat > ${q(path)}`, { stdin: bytes, timeoutMs: DEFAULT_TIMEOUT_MS, signal });
      const e = connectError(r);
      if (e) throw e;
      if (r.exitCode !== 0) throw fail(call, r.err.trim() || `can't write ${path}`);
    },
    async close() {},
  };
}

// ── Sandboxes ──

async function api(call: ToolCall, fetchFn: typeof fetch, what: string, url: string, init: RequestInit & { signal?: AbortSignal }): Promise<Response> {
  let res: Response;
  try {
    res = await fetchFn(url, init);
  } catch (e) {
    if (init.signal?.aborted) throw e;
    throw new HaloError(`${call.tool.name}: ${what} failed: ${(e as Error).message}`, { code: "TOOL_FAILED", retryable: true });
  }
  if (!res.ok) {
    const body = (await res.text().catch(() => "")).slice(0, 500);
    const retryable = res.status === 429 || res.status >= 500;
    throw new HaloError(`${call.tool.name}: ${what} failed (${res.status}): ${body || res.statusText}`, { code: res.status === 401 || res.status === 403 ? "TOOL_AUTH" : "TOOL_FAILED", retryable });
  }
  return res;
}

function apiKey(call: ToolCall, services: ToolServices, name: string): string {
  const key = call.config("apiKey") ?? (services.env ?? process.env)[name];
  if (typeof key !== "string" || !key) throw new HaloError(`Tool "${call.tool.name}" needs an API key: set ${name}, or declare it with apiKey: Env.${name}`, { code: "MISSING_API_KEY" });
  return key;
}

function envRecord(call: ToolCall, value: unknown): Record<string, string> {
  if (value === undefined || value === null) return {};
  if (typeof value !== "object" || Array.isArray(value)) throw fail(call, "env must be a record of NAME: value", "TOOL_ARGUMENT");
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(k)) throw fail(call, `"${k}" is not an environment variable name`, "TOOL_ARGUMENT");
    out[k] = typeof v === "string" ? v : JSON.stringify(v);
  }
  return out;
}

/** Connect protocol framing: a flags byte, a big-endian length, then the message. */
export function connectFrame(message: unknown, flags = 0): Uint8Array<ArrayBuffer> {
  const body = new TextEncoder().encode(JSON.stringify(message));
  const out = new Uint8Array(5 + body.length);
  out[0] = flags;
  new DataView(out.buffer).setUint32(1, body.length);
  out.set(body, 5);
  return out;
}

/** Read Connect frames from a streamed body as they arrive. */
export async function* connectFrames(body: ReadableStream<Uint8Array>): AsyncGenerator<{ flags: number; message: any }> {
  const reader = body.getReader();
  let buf = new Uint8Array(0);
  for (;;) {
    while (buf.length >= 5) {
      const len = new DataView(buf.buffer, buf.byteOffset).getUint32(1);
      if (buf.length < 5 + len) break;
      const flags = buf[0]!;
      const text = new TextDecoder().decode(buf.subarray(5, 5 + len));
      buf = buf.slice(5 + len);
      yield { flags, message: text ? JSON.parse(text) : {} };
    }
    const { value, done } = await reader.read();
    if (done) return;
    const next = new Uint8Array(buf.length + value.length);
    next.set(buf);
    next.set(value, buf.length);
    buf = next;
  }
}

function b64decode(s: string): string {
  return new TextDecoder().decode(Uint8Array.from(atob(s), (c) => c.charCodeAt(0)));
}

async function e2bMachine(call: ToolCall, services: ToolServices, signal: AbortSignal): Promise<Machine> {
  const key = apiKey(call, services, "E2B_API_KEY");
  const base = ((call.config("apiUrl") as string | undefined) ?? (services.env ?? process.env).E2B_API_URL ?? "https://api.e2b.app").replace(/\/+$/, "");
  const ttl = intArg(call, "ttl_minutes", call.config("ttl_minutes"), 30, 1, 24 * 60);
  const res = await api(call, services.fetch, "creating an E2B sandbox", `${base}/sandboxes`, {
    method: "POST",
    headers: { "X-API-Key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ templateID: (call.config("template") as string | undefined) ?? "base", timeout: ttl * 60, secure: true, metadata: { createdBy: "halo" } }),
    signal,
  });
  const sb = (await res.json()) as { sandboxID: string; envdAccessToken?: string; domain?: string | null };
  if (!sb.sandboxID) throw configError(call, "E2B didn't return a sandbox id");
  const envd = `https://49983-${sb.sandboxID}.${sb.domain || "e2b.app"}`;
  const auth: Record<string, string> = sb.envdAccessToken ? { "X-Access-Token": sb.envdAccessToken } : {};
  const user = (call.config("user") as string | undefined) ?? "user";
  const fileUrl = (path: string) => `${envd}/files?${new URLSearchParams({ path, username: user })}`;

  return {
    backend: "e2b",
    id: sb.sandboxID,
    async exec(command, opts) {
      const timeout = AbortSignal.timeout(opts.timeoutMs);
      const both = AbortSignal.any([opts.signal, timeout]);
      let stdout = "";
      let stderr = "";
      let exitCode = -1;
      let pid: number | undefined;
      try {
        const res = await api(call, services.fetch, "running a command", `${envd}/process.Process/Start`, {
          method: "POST",
          headers: { ...auth, "Content-Type": "application/connect+json", "Connect-Protocol-Version": "1" },
          body: connectFrame({ process: { cmd: "/bin/bash", args: ["-l", "-c", command], envs: opts.env, ...(opts.cwd ? { cwd: opts.cwd } : {}) } }),
          signal: both,
        });
        for await (const { flags, message } of connectFrames(res.body!)) {
          if (flags & 2) {
            if (message.error) throw sandboxFail(call, message.error.message ?? message.error.code ?? "the command failed");
            break;
          }
          const ev = message.event ?? {};
          if (ev.start) pid = ev.start.pid;
          if (ev.data?.stdout) stdout += b64decode(ev.data.stdout);
          if (ev.data?.stderr) stderr += b64decode(ev.data.stderr);
          if (ev.end) {
            exitCode = ev.end.exitCode ?? 0;
            if (ev.end.error && !stderr) stderr = ev.end.error;
          }
        }
        return { stdout, stderr, exitCode, timedOut: false };
      } catch (e) {
        if (!timeout.aborted || opts.signal.aborted) throw e;
        // Stop the command too, not just the wait for it.
        if (pid !== undefined) {
          await services.fetch(`${envd}/process.Process/SendSignal`, { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({ process: { pid }, signal: "SIGNAL_SIGKILL" }) }).catch(() => {});
        }
        return { stdout, stderr, exitCode, timedOut: true };
      }
    },
    async read(path, sig) {
      const res = await api(call, services.fetch, `reading ${path}`, fileUrl(path), { headers: auth, signal: sig });
      return new Uint8Array(await res.arrayBuffer());
    },
    async write(path, bytes, sig) {
      const form = new FormData();
      form.append("file", new Blob([bytes as Uint8Array<ArrayBuffer>]), posix.basename(path));
      await api(call, services.fetch, `writing ${path}`, fileUrl(path), { method: "POST", headers: auth, body: form, signal: sig });
    },
    async close() {
      await services.fetch(`${base}/sandboxes/${encodeURIComponent(sb.sandboxID)}`, { method: "DELETE", headers: { "X-API-Key": key }, signal: AbortSignal.timeout(15_000) }).catch(() => {});
    },
  };
}

const DAYTONA_FAILED = new Set(["error", "build_failed", "destroyed", "destroying"]);

async function daytonaMachine(call: ToolCall, services: ToolServices, signal: AbortSignal): Promise<Machine> {
  const env = services.env ?? process.env;
  const key = apiKey(call, services, "DAYTONA_API_KEY");
  const base = ((call.config("apiUrl") as string | undefined) ?? env.DAYTONA_API_URL ?? "https://app.daytona.io/api").replace(/\/+$/, "");
  const headers: Record<string, string> = { Authorization: `Bearer ${key}` };
  const org = call.config("organization") ?? env.DAYTONA_ORGANIZATION_ID;
  if (typeof org === "string" && org) headers["X-Daytona-Organization-ID"] = org;
  const idle = intArg(call, "idle_minutes", call.config("idle_minutes"), 15, 1, 24 * 60);
  const snapshot = call.config("snapshot");
  const target = call.config("target") ?? env.DAYTONA_TARGET;

  const res = await api(call, services.fetch, "creating a Daytona sandbox", `${base}/sandbox`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    // Stopped after `idle` minutes, and deleted as soon as it stops.
    body: JSON.stringify({ ...(typeof snapshot === "string" ? { snapshot } : {}), ...(typeof target === "string" ? { target } : {}), autoStopInterval: idle, autoDeleteInterval: 0, labels: { "created-by": "halo" } }),
    signal,
  });
  let sb = (await res.json()) as { id: string; state?: string; errorReason?: string; toolboxProxyUrl?: string };
  const id = sb.id;
  const remove = () => services.fetch(`${base}/sandbox/${encodeURIComponent(id)}`, { method: "DELETE", headers, signal: AbortSignal.timeout(15_000) }).then(() => {}, () => {});
  try {
    const deadline = Date.now() + intArg(call, "start_timeout_ms", call.config("start_timeout_ms"), 120_000, 1_000, 600_000);
    while (sb.state !== "started") {
      if (sb.state && DAYTONA_FAILED.has(sb.state)) throw configError(call, `the Daytona sandbox didn't start (${sb.state}${sb.errorReason ? `: ${sb.errorReason}` : ""})`);
      if (Date.now() > deadline) throw new TimeoutError(`${call.tool.name}: the Daytona sandbox didn't start in time (state: ${sb.state ?? "unknown"})`);
      await Bun.sleep(500);
      sb = (await (await api(call, services.fetch, "checking the sandbox", `${base}/sandbox/${encodeURIComponent(id)}`, { headers, signal })).json()) as typeof sb;
    }
    let proxy = sb.toolboxProxyUrl;
    if (!proxy) proxy = ((await (await api(call, services.fetch, "finding the toolbox", `${base}/sandbox/${encodeURIComponent(id)}/toolbox-proxy-url`, { headers, signal })).json()) as { url: string }).url;
    const toolbox = `${proxy.replace(/\/+$/, "")}/${encodeURIComponent(id)}`;

    return {
      backend: "daytona",
      id,
      async exec(command, opts) {
        // The toolbox splits its command into words, so the script travels as base64.
        const b64 = Buffer.from(command).toString("base64");
        const wrapped = `sh -c "echo '${b64}' | base64 -d | bash"`;
        const seconds = Math.max(1, Math.ceil(opts.timeoutMs / 1000));
        try {
          const r = await services.fetch(`${toolbox}/process/execute`, {
            method: "POST",
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify({ command: wrapped, ...(opts.cwd ? { cwd: opts.cwd } : {}), envs: opts.env, timeout: seconds }),
            signal: AbortSignal.any([opts.signal, AbortSignal.timeout(opts.timeoutMs + 15_000)]),
          });
          if (r.status === 408) return { stdout: "", stderr: "", exitCode: -1, timedOut: true };
          if (!r.ok) throw new HaloError(`${call.tool.name}: running a command failed (${r.status}): ${(await r.text()).slice(0, 500)}`, { code: "TOOL_FAILED", retryable: r.status >= 500 });
          const out = (await r.json()) as { exitCode: number; result: string };
          // Daytona returns stdout and stderr together.
          return { stdout: out.result ?? "", stderr: "", exitCode: out.exitCode, timedOut: false };
        } catch (e) {
          if (opts.signal.aborted || !(e instanceof DOMException && e.name === "TimeoutError")) throw e;
          return { stdout: "", stderr: "", exitCode: -1, timedOut: true };
        }
      },
      async read(path, sig) {
        const r = await api(call, services.fetch, `reading ${path}`, `${toolbox}/files/download?${new URLSearchParams({ path })}`, { headers, signal: sig });
        return new Uint8Array(await r.arrayBuffer());
      },
      async write(path, bytes, sig) {
        const form = new FormData();
        form.append("file", new Blob([bytes as Uint8Array<ArrayBuffer>]), posix.basename(path));
        await api(call, services.fetch, `writing ${path}`, `${toolbox}/files/upload-v2?${new URLSearchParams({ path })}`, { method: "POST", headers, body: form, signal: sig });
      },
      close: remove,
    };
  } catch (e) {
    await remove();
    throw e;
  }
}

// ── Docker: a container on this machine ──

const DOCKER_HOME = "/home/user";
/** Image references: registry/name:tag@digest, nothing a shell or docker would read as an option. */
const IMAGE_RE = /^[A-Za-z0-9][A-Za-z0-9._\-/:@]*$/;
/** The image the egress proxy runs in (it needs only Bun). */
const PROXY_IMAGE = "oven/bun:1-alpine";
const PROXY_URL = "http://halo-proxy:3128";

export interface DockerRunOptions {
  image: string;
  ttlSeconds: number;
  /** true: Docker's default network; false: none; a string: that network. */
  network: boolean | string;
  memory: string;
  cpus: number;
  pids: number;
  runId?: string;
  /** A container runtime other than Docker's default, e.g. gVisor's "runsc". */
  runtime?: string;
  env?: Record<string, string>;
}

/** The arguments to `docker run` that start a sandbox container, which removes itself after `ttlSeconds`. */
export function dockerRunArgs(opts: DockerRunOptions): string[] {
  const args = ["run", "--detach", "--rm", "--init", "--label", "created-by=halo"];
  if (opts.runId) args.push("--label", `halo.run=${opts.runId}`);
  args.push("--workdir", DOCKER_HOME, "--env", `HOME=${DOCKER_HOME}`);
  for (const [k, v] of Object.entries(opts.env ?? {})) args.push("--env", `${k}=${v}`);
  if (opts.network === false) args.push("--network", "none");
  else if (typeof opts.network === "string") args.push("--network", opts.network);
  if (opts.runtime) args.push("--runtime", opts.runtime);
  args.push("--memory", opts.memory, "--cpus", String(opts.cpus), "--pids-limit", String(opts.pids), "--security-opt", "no-new-privileges");
  // The container's only job is to stay up for `ttlSeconds`; commands run beside it with `docker exec`.
  args.push(opts.image, "sleep", String(opts.ttlSeconds));
  return args;
}

/** Run `script` with bash if the image has it, else sh; under coreutils/busybox `timeout` when there is one. */
export function dockerShell(script: string, timeoutSeconds?: number): string[] {
  const limit = timeoutSeconds ? `command -v timeout >/dev/null 2>&1 && t="timeout -s KILL ${timeoutSeconds}" || t=""; ` : `t=""; `;
  return ["sh", "-c", `${limit}command -v bash >/dev/null 2>&1 && exec $t bash -c "$1"; exec $t sh -c "$1"`, "sh", script];
}

/** Of Docker's registered runtimes, one that gives each container its own kernel (gVisor) or VM (Kata, Firecracker). */
export function pickVmRuntime(names: string[]): string | undefined {
  return names.find((n) => /runsc|gvisor/i.test(n)) ?? names.find((n) => /kata|firecracker/i.test(n));
}

const quiet = () => new AbortController().signal;
const decode = (b: Uint8Array) => new TextDecoder().decode(b);

const dockerChecks = new Map<string, { at: number; up: Promise<boolean> }>();

/** Whether a Docker daemon answers (checked at most every 30 seconds). */
export function dockerAvailable(docker = "docker"): Promise<boolean> {
  const hit = dockerChecks.get(docker);
  if (hit && Date.now() - hit.at < 30_000) return hit.up;
  const up = spawnProgram([docker, "version", "--format", "{{.Server.Version}}"], { timeoutMs: 5_000, signal: quiet() }).then(
    (r) => r.exitCode === 0 && !r.timedOut,
    () => false,
  );
  dockerChecks.set(docker, { at: Date.now(), up });
  return up;
}

async function dockerRuntimes(docker: string): Promise<string[]> {
  const r = await spawnProgram([docker, "info", "--format", "{{json .Runtimes}}"], { timeoutMs: 10_000, signal: quiet() }).catch(() => undefined);
  try {
    return r && r.exitCode === 0 ? Object.keys(JSON.parse(decode(r.out)) as object) : [];
  } catch {
    return [];
  }
}

/**
 * An egress allowlist: an internal network with no route out, and a proxy container on it (and on
 * Docker's default network) that lets through only connections to `hosts`.
 */
async function startProxy(call: ToolCall, docker: string, hosts: string[], ttlSeconds: number, signal: AbortSignal) {
  const tag = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  const network = `halo-net-${tag}`;
  const name = `halo-proxy-${tag}`;
  const run = (args: string[], timeoutMs = 60_000) => spawnProgram([docker, ...args], { timeoutMs, signal });
  const cleanup = async () => {
    await spawnProgram([docker, "rm", "--force", name], { timeoutMs: 15_000, signal: quiet() }).catch(() => {});
    await spawnProgram([docker, "network", "rm", network], { timeoutMs: 15_000, signal: quiet() }).catch(() => {});
  };
  const must = (r: { exitCode: number; err: string; timedOut: boolean }, what: string) => {
    if (r.exitCode !== 0 || r.timedOut) throw new HaloError(`${call.tool.name}: couldn't set up the sandbox's allowed hosts (${what}): ${r.err.trim() || "failed"}`, { code: "TOOL_FAILED" });
  };
  try {
    must(await run(["network", "create", "--internal", "--label", "created-by=halo", ...(call.runId ? ["--label", `halo.run=${call.runId}`] : []), network]), "network");
    const script = `${PROXY_SCRIPT}\nsetTimeout(() => process.exit(0), ${ttlSeconds * 1000});`;
    must(
      await run(
        ["run", "--detach", "--rm", "--name", name, "--label", "created-by=halo", ...(call.runId ? ["--label", `halo.run=${call.runId}`] : []), "--env", `HALO_HOSTS=${JSON.stringify(hosts)}`, "--memory", "256m", "--pids-limit", "128", "--security-opt", "no-new-privileges", PROXY_IMAGE, "bun", "-e", script],
        300_000,
      ),
      `starting the proxy from ${PROXY_IMAGE}`,
    );
    must(await run(["network", "connect", "--alias", "halo-proxy", network, name]), "network connect");
    const deadline = Date.now() + 30_000;
    for (;;) {
      const logs = await run(["logs", name], 10_000);
      if (decode(logs.out).includes('"ready":true')) break;
      if (Date.now() > deadline) throw new HaloError(`${call.tool.name}: the sandbox's proxy didn't start: ${logs.err.trim() || "no output"}`, { code: "TOOL_FAILED" });
      await Bun.sleep(100);
    }
  } catch (e) {
    await cleanup();
    throw e;
  }
  let seen = 0;
  return {
    network,
    cleanup,
    /** Hosts refused since the last time this was asked. */
    async blocked(): Promise<string[]> {
      const r = await spawnProgram([docker, "logs", name], { timeoutMs: 10_000, signal: quiet() }).catch(() => undefined);
      if (!r) return [];
      const hosts = decode(r.out)
        .split("\n")
        .flatMap((l) => {
          try {
            const j = JSON.parse(l) as { blocked?: string };
            return typeof j.blocked === "string" ? [j.blocked] : [];
          } catch {
            return [];
          }
        });
      const fresh = hosts.slice(seen);
      seen = hosts.length;
      return [...new Set(fresh)];
    },
  };
}

/** `hosts:` on a declaration: the hosts a sandbox may reach, or undefined for no allowlist. */
function hostList(call: ToolCall): string[] | undefined {
  const raw = call.config("hosts");
  if (raw === undefined || raw === null) return undefined;
  const list = Array.isArray(raw) ? raw : [raw];
  for (const h of list) if (typeof h !== "string" || !HOST_PATTERN.test(h)) throw configError(call, `hosts: ${JSON.stringify(h)} is not a host name like "pypi.org" or "*.pythonhosted.org"`);
  return [...new Set(list as string[])].map((h) => h.toLowerCase());
}

/** `files:` on a declaration: the paths (inside `from:`) the sandbox gets and may write back, or undefined for all. */
function fileList(call: ToolCall): string[] | undefined {
  const raw = call.config("files");
  if (raw === undefined || raw === null) return undefined;
  if (call.config("from") === undefined) throw configError(call, `files: picks paths from the project that from: copies in; add from: "." (or the folder they're in)`);
  const list = Array.isArray(raw) ? raw : [raw];
  const out: string[] = [];
  for (const f of list) {
    const p = typeof f === "string" ? scopePath(f) : undefined;
    if (p === undefined) throw configError(call, `files: ${JSON.stringify(f)} should be a path inside from:, like "src/billing" (no leading /, no ..)`);
    out.push(p);
  }
  return [...new Set(out)];
}

/** `secrets:` on a declaration: the environment variables to set for each command, with their values. */
function secretValues(call: ToolCall, services: ToolServices): Map<string, string> | undefined {
  const raw = call.config("secrets");
  if (raw === undefined || raw === null) return undefined;
  const env = services.env ?? process.env;
  const out = new Map<string, string>();
  for (const n of Array.isArray(raw) ? raw : [raw]) {
    if (typeof n !== "string" || !SECRET_NAME.test(n)) throw configError(call, `secrets: ${JSON.stringify(n)} should be an environment variable name, like STRIPE_TEST_KEY`);
    const value = env[n];
    if (value === undefined || value === "") throw configError(call, `secrets: ${n} is not set in Halo's environment`);
    out.set(n, value);
  }
  return out;
}

/** Secret values masked in text a sandbox sends back. Values under 4 characters are left alone. */
function mask(text: string, secrets: Map<string, string> | undefined): string {
  if (!secrets) return text;
  let out = text;
  for (const [name, value] of secrets) if (value.length >= 4) out = out.split(value).join(`[secret ${name}]`);
  return out;
}

/** A local path (relative to root) as a path inside `from:`, if it is inside it. */
function insideFrom(rel: string, from: string): string | undefined {
  if (from === "." || from === "") return rel;
  return rel === from ? "." : rel.startsWith(from + "/") ? rel.slice(from.length + 1) : undefined;
}

/** Refuse a local path outside the sandbox's `files:` (when it has them). */
function checkFiles(call: ToolCall, rel: string, what: string): void {
  const files = fileList(call);
  if (!files) return;
  const from = confine(call, workspaceRoot(call, call.config("root"), false), call.config("from")).rel;
  const inner = insideFrom(rel, from);
  if (inner === undefined || !inFiles(inner, files)) {
    throw new HaloError(`${call.tool.name}: ${what} ${rel} is outside the sandbox's files: ${files.map((f) => (from === "." ? f : `${from}/${f}`)).join(", ")}`, { code: "TOOL_ARGUMENT" });
  }
}

let snapshots = 0;
/** Snapshots this process made, and the run each belongs to: removed when the run ends, unless pinned. */
const made = new Map<string, { docker: string; runId: string }>();
/** Snapshots a @checkpoint recorded: kept after the run, for `halo rewind`. */
const pinned = new Set<string>();
/** Snapshots a pause recorded: kept until the run resumes (perhaps in another process, which then keeps them). */
const paused = new Set<string>();

/** Remove a run's snapshots nothing will need again (forks, superseded saves). */
async function dropSnapshots(runId?: string): Promise<void> {
  const drop = [...made].filter(([ref, o]) => (runId === undefined || o.runId === runId) && !pinned.has(ref) && !paused.has(ref));
  for (const [ref] of drop) made.delete(ref);
  const byDocker = new Map<string, string[]>();
  for (const [ref, o] of drop) byDocker.set(o.docker, [...(byDocker.get(o.docker) ?? []), ref]);
  for (const [docker, refs] of byDocker) await spawnProgram([docker, "rmi", ...refs], { timeoutMs: 60_000, signal: quiet() }).catch(() => {});
}

async function dockerMachine(call: ToolCall, signal: AbortSignal, from?: string, secrets?: Map<string, string>): Promise<Machine> {
  const docker = (call.config("docker") as string | undefined) ?? "docker";
  const image = from ?? (call.config("image") as string | undefined) ?? "python:3.12-slim";
  if (typeof image !== "string" || !IMAGE_RE.test(image)) throw configError(call, `"${image}" is not a Docker image name`);
  const memory = String(call.config("memory") ?? "2g");
  if (!/^\d+(\.\d+)?[bkmg]?$/i.test(memory)) throw configError(call, `memory: "${memory}" should look like "512m" or "2g"`);
  const cpusRaw = call.config("cpus") ?? 2;
  const cpus = typeof cpusRaw === "number" ? cpusRaw : Number(cpusRaw);
  if (!Number.isFinite(cpus) || cpus <= 0) throw configError(call, `cpus: must be a positive number`);
  const ttl = intArg(call, "ttl_minutes", call.config("ttl_minutes"), 30, 1, 24 * 60);
  const pids = intArg(call, "pids", call.config("pids"), 512, 16, 65_536);
  const network = call.config("network") !== false && call.config("network") !== "none";
  const startMs = intArg(call, "start_timeout_ms", call.config("start_timeout_ms"), 300_000, 1_000, 1_800_000);
  const hosts = hostList(call);
  if (hosts && !network) throw configError(call, `hosts: lets the sandbox reach those hosts, and network: false cuts it off from all of them; use one or the other`);

  let runtime = call.config("runtime") as string | undefined;
  if (runtime !== undefined && (typeof runtime !== "string" || !/^[\w.-]+$/.test(runtime))) throw configError(call, `runtime: "${runtime}" is not a container runtime name`);
  const isolation = call.config("isolation") ?? "container";
  if (isolation !== "container" && isolation !== "vm") throw configError(call, `isolation: is "container" or "vm", not ${JSON.stringify(isolation)}`);
  if (isolation === "vm" && !runtime) {
    const names = await dockerRuntimes(docker);
    runtime = pickVmRuntime(names);
    if (!runtime) {
      throw configError(
        call,
        `isolation: "vm" needs a runtime registered with Docker that gives each container its own kernel, such as gVisor (runsc) or Kata Containers; this Docker has ${names.join(", ") || "none it reports"}. Or use Remote("e2b") or Remote("daytona"), which run each sandbox in its own VM.`,
      );
    }
  }

  const proxy = hosts ? await startProxy(call, docker, hosts, ttl * 60, signal) : undefined;
  const proxyEnv = proxy ? Object.fromEntries(["HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy"].map((k) => [k, PROXY_URL]).concat([["NO_PROXY", "localhost,127.0.0.1"], ["no_proxy", "localhost,127.0.0.1"]])) : undefined;
  let started;
  try {
    started = await spawnProgram([docker, ...dockerRunArgs({ image, ttlSeconds: ttl * 60, network: proxy ? proxy.network : network, memory, cpus, pids, runId: call.runId, runtime, env: proxyEnv })], { timeoutMs: startMs, signal });
  } catch (e) {
    await proxy?.cleanup();
    throw e;
  }
  const id = decode(started.out).trim().split("\n").pop()?.trim() ?? "";
  if (started.timedOut || started.exitCode !== 0 || !/^[0-9a-f]{12,64}$/.test(id)) {
    await proxy?.cleanup();
    if (started.timedOut) throw new TimeoutError(`${call.tool.name}: the Docker container didn't start in time (pulling ${image}?)`);
    const why = started.err.trim() || "docker run failed";
    const hint = /Cannot connect to the Docker daemon|docker daemon/i.test(why) ? " Is Docker running?" : "";
    throw new HaloError(`${call.tool.name}: couldn't start a Docker sandbox from ${image}: ${why}${hint}`, { code: "TOOL_FAILED" });
  }

  const gone = (err: string) => /No such container|is not running/i.test(err);
  const daemonError = (r: { exitCode: number; err: string }) =>
    gone(r.err) || /^Error response from daemon|Cannot connect to the Docker daemon/m.test(r.err)
      ? new HaloError(`${call.tool.name}: the Docker sandbox ${id.slice(0, 12)} is unavailable: ${r.err.trim()}${gone(r.err) ? ` (it stops after ttl_minutes: ${ttl})` : ""}`, { code: "TOOL_FAILED" })
      : undefined;
  const tool = call.tool.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40) || "sandbox";

  return {
    backend: "docker",
    id: id.slice(0, 12),
    async exec(command, opts) {
      const seconds = Math.max(1, Math.ceil(opts.timeoutMs / 1000));
      const began = Date.now();
      // The in-container `timeout` stops the command; the client-side limit is a backstop.
      // Secrets go in by name (--env NAME), their values only in docker's own environment: not in
      // any command line, and not in the container's config, so docker commit never saves them.
      const names = [...(secrets?.keys() ?? [])].flatMap((n) => ["--env", n]);
      const r = await spawnProgram([docker, "exec", ...names, id, ...dockerShell(prelude(opts.cwd, opts.env) + command, seconds)], {
        timeoutMs: opts.timeoutMs + 5_000,
        signal: opts.signal,
        env: secrets ? Object.fromEntries(secrets) : undefined,
      });
      const e = daemonError(r);
      if (e && !r.timedOut) throw e;
      // `timeout -s KILL` exits 137 (124 for some builds); either way it ran out the clock.
      const killed = (r.exitCode === 124 || r.exitCode >= 128 || r.exitCode < 0) && Date.now() - began >= opts.timeoutMs - 250;
      const blocked = proxy ? await proxy.blocked() : [];
      return { stdout: decode(r.out), stderr: r.err, exitCode: r.exitCode, timedOut: r.timedOut || killed, ...(blocked.length ? { blocked } : {}) };
    },
    async read(path, sig) {
      const r = await spawnProgram([docker, "exec", id, "cat", "--", path], { timeoutMs: DEFAULT_TIMEOUT_MS, signal: sig });
      const e = daemonError(r);
      if (e) throw e;
      if (r.exitCode !== 0) throw sandboxFail(call, r.err.trim() || `can't read ${path}`);
      return r.out;
    },
    async write(path, bytes, sig) {
      const dir = posix.dirname(path);
      const script = `${dir === "." ? "" : `mkdir -p -- ${q(dir)} && `}cat > ${q(path)}`;
      const r = await spawnProgram([docker, "exec", "--interactive", id, "sh", "-c", script], { stdin: bytes, timeoutMs: DEFAULT_TIMEOUT_MS, signal: sig });
      const e = daemonError(r);
      if (e) throw e;
      if (r.exitCode !== 0) throw sandboxFail(call, r.err.trim() || `can't write ${path}`);
    },
    async snapshot() {
      const ref = `halo-sandbox:${(call.runId ?? "run").slice(0, 8)}-${tool}-${Date.now().toString(36)}${(snapshots++).toString(36)}`;
      const labels = ["--change", "LABEL created-by=halo", ...(call.runId ? ["--change", `LABEL halo.run=${call.runId}`] : [])];
      const r = await spawnProgram([docker, "commit", ...labels, id, ref], { timeoutMs: 300_000, signal: quiet() });
      const e = daemonError(r);
      if (e) throw e;
      if (r.exitCode !== 0) throw sandboxFail(call, `couldn't snapshot the sandbox: ${r.err.trim() || "docker commit failed"}`);
      made.set(ref, { docker, runId: call.runId ?? "" });
      return ref;
    },
    async close() {
      await spawnProgram([docker, "rm", "--force", id], { timeoutMs: 15_000, signal: quiet() }).catch(() => {});
      await proxy?.cleanup();
    },
  };
}

// ── Sessions: one sandbox per (tool, run, branch) ──

/** The files a sandbox started with (from `from:`), to tell what it changed. */
interface Baseline {
  /** The local folder they came from, relative to root. */
  from: string;
  hashes: Map<string, string>;
  content: Map<string, Uint8Array>;
}

interface Session {
  tool: string;
  runId: string;
  /** "" for the run itself; "3.0", "3.0/5.2"… for the branches of a fan-out (Docker only). */
  branch: string;
  machine: Promise<Machine>;
  /** Changed since `image` was saved. */
  dirty: boolean;
  /** The snapshot (or image) that holds this sandbox's files as of its last save. */
  image?: string;
  saving?: Promise<string | undefined>;
  baseline?: Baseline;
  /** secrets: values, masked in what comes back. */
  secrets?: Map<string, string>;
}

/** Where a new sandbox starts from, instead of its declared image. */
interface Seed {
  image: string;
  baseline?: Baseline;
}

const sessions = new Map<string, Session>();
/** Set by rewind, resume and keep: the next sandbox for (tool, run, branch) starts from this. */
const seeds = new Map<string, Seed>();
/** The sandboxes each branch of a fan-out ended with, for `keep(fork: n)`, by (tool, run, the fan-out's own branch). */
const forks = new Map<string, Seed[]>();
/** What `Remote("auto")` chose, by (tool, run), so a run doesn't switch backends halfway. */
const autoChoices = new Map<string, Promise<"docker" | "e2b" | "daytona">>();

const sKey = (tool: string, runId: string, branch = "") => `${tool}\0${runId}\0${branch}`;
const parentBranch = (branch: string) => (branch.includes("/") ? branch.slice(0, branch.lastIndexOf("/")) : "");

/** Save a session's files and return the snapshot (or the last one, when nothing changed since). */
function save(s: Session): Promise<string | undefined> {
  if (s.saving) return s.saving;
  s.saving = (async () => {
    const m = await s.machine;
    if (!m.snapshot) return undefined;
    if (!s.dirty && s.image) return s.image;
    s.dirty = false;
    try {
      s.image = await m.snapshot();
    } catch (e) {
      s.dirty = true;
      throw e;
    }
    return s.image;
  })().finally(() => (s.saving = undefined));
  return s.saving;
}

async function closeSession(key: string): Promise<void> {
  const s = sessions.get(key);
  if (!s) return;
  sessions.delete(key);
  await s.machine.then((m) => m.close(), () => {});
}

/** Delete sandboxes: all of them, or one run's (when it ends). Snapshots stay, for rewind. */
export async function closeRemoteSessions(runId?: string): Promise<void> {
  const keys = [...sessions.values()].filter((s) => runId === undefined || s.runId === runId).map((s) => sKey(s.tool, s.runId, s.branch));
  for (const map of [seeds, forks, autoChoices]) for (const k of [...map.keys()]) if (runId === undefined || k.split("\0")[1] === runId) map.delete(k);
  await Promise.all(keys.map(closeSession));
  await dropSnapshots(runId);
}

/**
 * Snapshot a run's sandboxes that can be (Docker): tool name → snapshot. Only sandboxes that changed
 * since their last snapshot are saved again. For @checkpoint, so `halo rewind` can restore them.
 */
export async function snapshotRemoteSessions(runId: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const s of [...sessions.values()].filter((x) => x.runId === runId && x.branch === "")) {
    const image = await save(s).catch(() => undefined);
    if (image) (out[s.tool] = image), pinned.add(image);
  }
  return out;
}

/**
 * For a run that pauses: snapshot its Docker sandboxes and stop them, so a pause that lasts days
 * holds no containers. Returns tool → snapshot, for seedRemoteSessions when it resumes. Cloud
 * sandboxes can't be saved this way and stay up, as before.
 */
export async function suspendRemoteSessions(runId: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const s of [...sessions.values()].filter((x) => x.runId === runId)) {
    const m = await s.machine.catch(() => undefined);
    if (!m?.snapshot) continue;
    const image = s.branch === "" ? await save(s).catch(() => undefined) : undefined;
    // Pinned: the run may resume in another process, which can't know to remove it.
    if (image) (out[s.tool] = image), paused.add(image);
    await closeSession(sKey(s.tool, s.runId, s.branch));
  }
  return out;
}

/** Start a run's next sandboxes from these snapshots (tool name → snapshot): after rewind or resume. */
export function seedRemoteSessions(runId: string, images: Record<string, string> | undefined): void {
  for (const [tool, image] of Object.entries(images ?? {})) {
    // A pause's snapshot has done its job once the run resumes from it.
    paused.delete(image);
    if (!sessions.has(sKey(tool, runId))) seeds.set(sKey(tool, runId), { image });
  }
}

/**
 * A fan-out ended: snapshot and stop the sandboxes its branches forked, keeping the snapshots so
 * `keep(fork: n)` can carry one branch's work on. `branches` are the branch keys, in order.
 */
export async function endRemoteBranches(runId: string, branches: string[]): Promise<void> {
  if (!branches.length) return;
  const parent = parentBranch(branches[0]!);
  const tools = new Set([...sessions.values()].filter((s) => s.runId === runId && branches.includes(s.branch)).map((s) => s.tool));
  for (const tool of tools) {
    const kept: Seed[] = [];
    await Promise.all(
      branches.map(async (b, i) => {
        // Branches nested in this one end with it too.
        const own = [...sessions.values()].filter((s) => s.runId === runId && s.tool === tool && (s.branch === b || s.branch.startsWith(`${b}/`)));
        const s = own.find((x) => x.branch === b);
        if (s) {
          const image = await save(s).catch(() => undefined);
          if (image) kept[i] = { image, baseline: s.baseline };
        }
        await Promise.all(own.map((x) => closeSession(sKey(x.tool, x.runId, x.branch))));
      }),
    );
    forks.set(sKey(tool, runId, parent), kept);
  }
}

/** Which backend a declaration names; "auto" is resolved when the sandbox is made. */
export function backendOf(spec: unknown): "ssh" | "e2b" | "daytona" | "docker" | "auto" | undefined {
  if (typeof spec !== "string" || !spec.trim()) return undefined;
  const s = spec.trim().toLowerCase();
  return s === "e2b" || s === "daytona" || s === "docker" || s === "auto" ? s : "ssh";
}

/** `Remote("auto")`: Docker when it's running (with a VM runtime, for isolation: "vm"), else E2B, else Daytona. */
export async function chooseSandbox(opts: { docker: string; isolation?: unknown; env: Record<string, string | undefined>; apiKey?: unknown }): Promise<"docker" | "e2b" | "daytona" | undefined> {
  if (await dockerAvailable(opts.docker)) {
    if (opts.isolation !== "vm" || pickVmRuntime(await dockerRuntimes(opts.docker))) return "docker";
  }
  if (opts.env.E2B_API_KEY) return "e2b";
  if (opts.env.DAYTONA_API_KEY) return "daytona";
  return undefined;
}

async function resolveBackend(call: ToolCall, services: ToolServices): Promise<"ssh" | "e2b" | "daytona" | "docker"> {
  const backend = backendOf(call.config(0));
  if (!backend) throw configError(call, `needs a host or a sandbox service, e.g. Remote("deploy@build.example.com"), Remote("e2b") or Remote("docker")`);
  if (backend !== "auto") return backend;
  const key = `${call.tool.name}\0${call.runId ?? ""}`;
  let choice = autoChoices.get(key);
  if (!choice) {
    choice = chooseSandbox({ docker: (call.config("docker") as string | undefined) ?? "docker", isolation: call.config("isolation"), env: services.env ?? process.env }).then((c) => {
      if (c) return c;
      const vm = call.config("isolation") === "vm";
      throw configError(
        call,
        `Remote("auto") found no sandbox to use: ${vm ? "Docker isn't running or has no VM runtime (gVisor or Kata)" : "Docker isn't running"}, and neither E2B_API_KEY nor DAYTONA_API_KEY is set`,
      );
    });
    autoChoices.set(key, choice);
    choice.catch(() => autoChoices.get(key) === choice && autoChoices.delete(key));
  }
  return choice;
}

async function session(call: ToolCall, services: ToolServices): Promise<Session> {
  const backend = await resolveBackend(call, services);
  if (backend === "ssh") {
    for (const k of ["files", "secrets"]) if (call.config(k) !== undefined) throw configError(call, `${k}: is for sandboxes, not a machine over SSH`);
    return { tool: call.tool.name, runId: "", branch: "", machine: Promise.resolve(sshMachine(call, call.config(0) as string)), dirty: false };
  }
  const runId = call.runId ?? "";
  // Only Docker sandboxes fork; a fan-out's branches share one E2B or Daytona sandbox, as they always have.
  const branch = backend === "docker" ? (call.branch ?? "") : "";
  const key = sKey(call.tool.name, runId, branch);
  const existing = sessions.get(key);
  if (existing) return existing;

  const s: Session = { tool: call.tool.name, runId, branch, dirty: false, machine: undefined as unknown as Promise<Machine> };
  sessions.set(key, s);
  s.machine = (async () => {
    // Not the call's own signal: the sandbox outlives the call that created it.
    // Docker may have to pull the image first; it has its own start_timeout_ms.
    const create = AbortSignal.timeout(backend === "docker" ? 1_800_000 : 180_000);
    let seed = seeds.get(key);
    seeds.delete(key);
    if (!seed && branch) {
      // A branch of a fan-out starts as a copy of the sandbox the fan-out started from, if there is one.
      for (let b = parentBranch(branch); ; b = parentBranch(b)) {
        const parent = sessions.get(sKey(call.tool.name, runId, b));
        if (parent) {
          const image = await save(parent);
          if (image) seed = { image, baseline: parent.baseline };
          break;
        }
        if (b === "") break;
      }
    }
    for (const k of ["hosts", "secrets"]) {
      if (backend !== "docker" && call.config(k) !== undefined) throw configError(call, `${k}: is enforced by Docker sandboxes, and this one is ${backend}; use Remote("docker"), or drop ${k}:`);
    }
    fileList(call); // check files: before starting anything
    s.secrets = secretValues(call, services);
    const m = backend === "e2b" ? await e2bMachine(call, services, create) : backend === "daytona" ? await daytonaMachine(call, services, create) : await dockerMachine(call, create, seed?.image, s.secrets);
    s.image = seed?.image;
    try {
      const from = call.config("from");
      if (seed) s.baseline = seed.baseline ?? (from !== undefined ? localBaseline(call, from) : undefined);
      else if (from !== undefined) {
        s.baseline = localBaseline(call, from);
        await copyIn(call, m, s.baseline, create);
      }
    } catch (e) {
      await m.close();
      throw e;
    }
    return m;
  })();
  s.machine.catch(() => sessions.get(key) === s && sessions.delete(key));
  return s;
}

// ── A project in, its changes out ──

const MAX_PROJECT_FILES = 20_000;

/** Read `from:` (a local folder inside root) as the files a sandbox starts with. */
function localBaseline(call: ToolCall, from: unknown): Baseline {
  if (typeof from !== "string" || !from) throw configError(call, `from: is a local folder to copy into the sandbox, e.g. from: "."`);
  const root = workspaceRoot(call, call.config("root"), false);
  const dir = confine(call, root, from);
  const only = fileList(call);
  const files = only ? projectFiles(dir.abs).filter((p) => inFiles(p, only)) : projectFiles(dir.abs);
  if (files.length > MAX_PROJECT_FILES) throw configError(call, `from: "${from}" has ${files.length} files; a sandbox takes at most ${MAX_PROJECT_FILES}`);
  const hashes = new Map<string, string>();
  const content = new Map<string, Uint8Array>();
  let total = 0;
  for (const rel of files) {
    const bytes = new Uint8Array(readFileSync(`${dir.abs}/${rel}`));
    total += bytes.length;
    if (total > MAX_FILE) throw configError(call, `from: "${from}" is over ${MAX_FILE} bytes`);
    hashes.set(rel, sha256Hex(bytes));
    content.set(rel, bytes);
  }
  return { from: dir.rel, hashes, content };
}

/** Copy a baseline's files into a new sandbox's home folder, as one archive. */
async function copyIn(call: ToolCall, m: Machine, base: Baseline, signal: AbortSignal): Promise<void> {
  if (!base.content.size) return;
  const root = workspaceRoot(call, call.config("root"), false);
  const files = [...base.content].map(([path, bytes]) => {
    let mode = 0o644;
    try {
      if (statSync(`${root}/${base.from}/${path}`).mode & 0o111) mode = 0o755;
    } catch {}
    return { path, bytes, mode };
  });
  await m.write(".halo-seed.tar", tarball(files), signal);
  const r = await m.exec("tar -xf .halo-seed.tar; s=$?; rm -f .halo-seed.tar; exit $s", { env: {}, timeoutMs: 300_000, signal });
  if (r.exitCode !== 0) throw sandboxFail(call, `couldn't unpack ${base.from} in the sandbox: ${(r.stderr || r.stdout).trim()}`);
}

/**
 * What the sandbox changed, compared with what it started with (nothing, without `from:`). With
 * files:, changes elsewhere (build output, caches, stray edits) are listed apart as `outside`.
 */
async function changes(call: ToolCall, s: Session, m: Machine, under?: string): Promise<{ files: FileChange[]; outside: string[] }> {
  const r = await m.exec(hashCommand(), { env: {}, timeoutMs: 300_000, signal: call.signal });
  if (r.exitCode !== 0 && !r.stdout) throw sandboxFail(call, `couldn't list the sandbox's files: ${r.stderr.trim()}`);
  let all = compareTrees(s.baseline?.hashes ?? new Map(), parseHashes(r.stdout));
  const prefix = under ? under.replace(/^\.\/|\/+$/g, "") + "/" : undefined;
  if (prefix && prefix !== "./") all = all.filter((c) => c.path.startsWith(prefix));
  const only = fileList(call);
  if (!only) return { files: all, outside: [] };
  return { files: all.filter((c) => inFiles(c.path, only)), outside: all.filter((c) => !inFiles(c.path, only)).map((c) => c.path) };
}

const MAX_PATCH_FILES = 200;

// ── The provider ──

function remotePath(call: ToolCall, value: unknown, name = "path"): string {
  const path = need(call, name, value);
  if (path.includes("\0")) throw fail(call, `${name} contains a NUL byte`, "TOOL_ARGUMENT");
  return path;
}

function looksBinary(bytes: Uint8Array): boolean {
  const n = Math.min(bytes.length, 8192);
  for (let i = 0; i < n; i++) if (bytes[i] === 0) return true;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, n));
  } catch {
    // A multi-byte character cut at the edge isn't binary.
    return n === bytes.length;
  }
  return false;
}

/** `keep(fork: n)`: carry on from branch n of the last fan-out; the sandbox's next call starts from that branch's snapshot. */
async function keep(call: ToolCall): Promise<unknown> {
  const runId = call.runId ?? "";
  const branch = call.branch ?? "";
  const n = Number(call.named.fork ?? (call.implicitInput ? undefined : call.positional[0]));
  const kept = forks.get(sKey(call.tool.name, runId, branch));
  if (!kept?.length) throw fail(call, `has no forks to keep: a Docker sandbox forks when the branches of a |* fan-out or each call it`, "TOOL_ARGUMENT");
  if (!Number.isInteger(n) || !kept[n]) throw fail(call, `fork: must be the index of a branch that used the sandbox (0–${kept.length - 1}), got ${JSON.stringify(call.named.fork ?? call.positional[0])}`, "TOOL_ARGUMENT");
  const key = sKey(call.tool.name, runId, branch);
  await closeSession(key);
  seeds.set(key, kept[n]!);
  return { fork: n, snapshot: kept[n]!.image };
}

/** Methods that change the sandbox, so it needs saving again before a snapshot. */
const CHANGES = new Set(["run", "write", "upload", "keep"]);

export async function remote(call: ToolCall, services: ToolServices): Promise<unknown> {
  if (!METHODS.includes(call.method)) unknownMethod(call, METHODS);
  if (call.method === "keep") return keep(call);
  const s = await session(call, services);
  const m = await s.machine;
  const named = call.named;
  if (CHANGES.has(call.method)) s.dirty = true;

  switch (call.method) {
    case "info":
      return m.backend === "ssh" ? { backend: m.backend, host: m.id } : { backend: m.backend, id: m.id };

    case "run": {
      const command = named.command ?? (call.implicitInput ? undefined : call.positional[0]);
      if (typeof command !== "string" || !command.trim()) throw fail(call, `needs command: "...", e.g. ${call.tool.name}.run(command: "uname -a")`, "TOOL_ARGUMENT");
      const timeoutMs = intArg(call, "timeout_ms", named.timeout_ms ?? call.config("timeout_ms"), DEFAULT_TIMEOUT_MS, 1_000, 3_600_000);
      const cwd = named.cwd ?? call.config("cwd");
      const r = await m.exec(command, { cwd: typeof cwd === "string" && cwd ? cwd : undefined, env: envRecord(call, named.env), timeoutMs, signal: call.signal });
      const stdout = clip(mask(r.stdout, s.secrets).trimEnd());
      let json: unknown;
      if (/^\s*[[{]/.test(stdout)) {
        try {
          json = JSON.parse(stdout);
        } catch {}
      }
      return {
        command,
        stdout,
        stderr: clip(mask(r.stderr, s.secrets).trimEnd()),
        exitCode: r.exitCode,
        timedOut: r.timedOut,
        ...(json !== undefined ? { json } : {}),
        ...(r.blocked?.length ? { blocked: r.blocked } : {}),
      };
    }

    case "read": {
      const path = remotePath(call, named.path ?? (call.implicitInput ? undefined : call.positional[0]));
      const bytes = await m.read(path, call.signal);
      if (bytes.length > MAX_FILE) throw fail(call, `${path} is ${bytes.length} bytes; download it instead`);
      if (looksBinary(bytes)) return { path, content: Buffer.from(bytes).toString("base64"), bytes: bytes.length, encoding: "base64" };
      return { path, content: clip(mask(new TextDecoder().decode(bytes), s.secrets)), bytes: bytes.length, encoding: "utf8" };
    }

    case "write": {
      const path = remotePath(call, named.path);
      const content = named.content ?? (call.implicitInput ? call.positional[0] : call.positional[1] ?? call.positional[0]);
      if (content === undefined || content === null) throw fail(call, "needs content", "TOOL_ARGUMENT");
      const bytes = new TextEncoder().encode(typeof content === "string" ? content : JSON.stringify(content, null, 2));
      await m.write(path, bytes, call.signal);
      return { path, bytes: bytes.length };
    }

    case "list": {
      const path = named.path === undefined || named.path === null || named.path === "" ? "." : remotePath(call, named.path);
      const r = await m.exec(`ls -1Ap -- ${q(path)}`, { env: {}, timeoutMs: 30_000, signal: call.signal });
      if (r.exitCode !== 0) throw fail(call, (r.stderr || r.stdout).trim() || `can't list ${path}`);
      const entries = r.stdout.split("\n").filter(Boolean).map((line) => (line.endsWith("/") ? { name: line.slice(0, -1), type: "dir" } : { name: line, type: "file" }));
      return { path, entries };
    }

    case "upload": {
      const root = workspaceRoot(call, call.config("root"), false);
      const from = confine(call, root, named.from);
      checkFiles(call, from.rel, "upload from");
      const to = remotePath(call, named.to ?? named.from, "to");
      const file = Bun.file(from.abs);
      if (!(await file.exists())) throw fail(call, `${from.rel} doesn't exist`, "TOOL_ARGUMENT");
      if (file.size > MAX_FILE) throw fail(call, `${from.rel} is over ${MAX_FILE} bytes`, "TOOL_ARGUMENT");
      const bytes = await file.bytes();
      await m.write(to, bytes, call.signal);
      return { from: from.rel, to, bytes: bytes.length };
    }

    case "download": {
      const from = remotePath(call, named.from, "from");
      const root = workspaceRoot(call, call.config("root"), true);
      const to = confine(call, root, named.to ?? posix.basename(from));
      checkFiles(call, to.rel, "download to");
      const bytes = await m.read(from, call.signal);
      if (bytes.length > MAX_FILE) throw fail(call, `${from} is over ${MAX_FILE} bytes`);
      mkdirSync(dirname(to.abs), { recursive: true });
      await Bun.write(to.abs, bytes);
      return { from, to: to.rel, bytes: bytes.length };
    }

    case "diff": {
      if (m.backend === "ssh") throw fail(call, "diff works on sandboxes, not on a machine over SSH", "TOOL_ARGUMENT");
      const { files, outside } = await changes(call, s, m, typeof named.path === "string" ? named.path : undefined);
      const parts: string[] = [];
      for (const c of files.slice(0, MAX_PATCH_FILES)) {
        const before = s.baseline?.content.get(c.path) ?? new Uint8Array();
        const after = c.status === "deleted" ? new Uint8Array() : await m.read(c.path, call.signal);
        if (looksBinary(before) || looksBinary(after)) parts.push(`Binary file ${c.path} ${c.status}\n`);
        else parts.push(unifiedDiff(decode(before), decode(after), { a: c.status === "added" ? "/dev/null" : `a/${c.path}`, b: c.status === "deleted" ? "/dev/null" : `b/${c.path}` }));
      }
      return {
        files,
        patch: clip(mask(parts.join(""), s.secrets)),
        ...(files.length > MAX_PATCH_FILES ? { truncated: true } : {}),
        ...(outside.length ? { outside: outside.slice(0, MAX_PATCH_FILES) } : {}),
      };
    }

    case "apply": {
      if (m.backend === "ssh") throw fail(call, "apply works on sandboxes, not on a machine over SSH", "TOOL_ARGUMENT");
      const root = workspaceRoot(call, call.config("root"), true);
      const own = s.baseline?.from ?? ".";
      const base = typeof named.to === "string" && named.to ? named.to : own;
      if (fileList(call) && posix.normalize(base) !== posix.normalize(own)) {
        throw fail(call, `apply(to:) can't move changes elsewhere when the sandbox has files:; they go back where they came from (${own})`, "TOOL_ARGUMENT");
      }
      const { files, outside } = await changes(call, s, m, typeof named.path === "string" ? named.path : undefined);
      const written: string[] = [];
      const deleted: string[] = [];
      for (const c of files) {
        const target = confine(call, root, posix.join(base, c.path));
        if (c.status === "deleted") {
          await Bun.file(target.abs).delete().catch(() => {});
          deleted.push(target.rel);
        } else {
          const bytes = await m.read(c.path, call.signal);
          mkdirSync(dirname(target.abs), { recursive: true });
          await Bun.write(target.abs, bytes);
          written.push(target.rel);
        }
      }
      // With files:, changes outside them stay in the sandbox: listed, never written.
      return { to: base, written, deleted, ...(outside.length ? { outside: outside.slice(0, MAX_PATCH_FILES) } : {}) };
    }

  }
  return unknownMethod(call, METHODS);
}

// ── Housekeeping (halo sandboxes) ──

export interface SandboxListing {
  containers: { id: string; image: string; run?: string; status: string }[];
  snapshots: { ref: string; run?: string; created: string; size: string }[];
  networks: { name: string; run?: string }[];
}

function jsonLines(text: string): Record<string, string>[] {
  return text
    .split("\n")
    .filter((l) => l.trim())
    .flatMap((l) => {
      try {
        return [JSON.parse(l) as Record<string, string>];
      } catch {
        return [];
      }
    });
}

const runLabel = (labels: string | undefined) => /(?:^|,)halo\.run=([^,]+)/.exec(labels ?? "")?.[1];

/** Everything Halo made in Docker that's still there: sandboxes, snapshots, networks. */
export async function listDockerSandboxes(docker = "docker"): Promise<SandboxListing> {
  const run = async (args: string[]) => {
    const r = await spawnProgram([docker, ...args], { timeoutMs: 30_000, signal: quiet() });
    if (r.exitCode !== 0) throw new HaloError(`docker ${args[0]}: ${r.err.trim() || "failed"}${/daemon/i.test(r.err) ? " (is Docker running?)" : ""}`);
    return jsonLines(decode(r.out));
  };
  const [containers, images, networks] = await Promise.all([
    run(["ps", "--all", "--filter", "label=created-by=halo", "--format", "{{json .}}"]),
    run(["images", "--filter", "label=created-by=halo", "--format", "{{json .}}"]),
    run(["network", "ls", "--filter", "label=created-by=halo", "--format", "{{json .}}"]),
  ]);
  return {
    containers: containers.map((c) => ({ id: c.ID ?? "", image: c.Image ?? "", run: runLabel(c.Labels), status: c.Status ?? "" })),
    snapshots: images.map((i) => ({ ref: `${i.Repository}:${i.Tag}`, run: undefined, created: i.CreatedSince ?? "", size: i.Size ?? "" })),
    networks: networks.map((n) => ({ name: n.Name ?? "", run: runLabel(n.Labels) })),
  };
}

/** Remove Halo's snapshots and networks (and, with `containers`, its running sandboxes too). Snapshots still in use stay. */
export async function pruneDockerSandboxes(opts: { docker?: string; containers?: boolean } = {}): Promise<{ containers: number; snapshots: number; networks: number }> {
  const docker = opts.docker ?? "docker";
  const list = await listDockerSandboxes(docker);
  let containers = 0;
  if (opts.containers && list.containers.length) {
    const r = await spawnProgram([docker, "rm", "--force", ...list.containers.map((c) => c.id)], { timeoutMs: 60_000, signal: quiet() });
    if (r.exitCode === 0) containers = list.containers.length;
  }
  let snapshots = 0;
  for (const sn of list.snapshots) {
    const r = await spawnProgram([docker, "rmi", sn.ref], { timeoutMs: 60_000, signal: quiet() });
    if (r.exitCode === 0) snapshots++;
  }
  let networks = 0;
  for (const n of list.networks) {
    const r = await spawnProgram([docker, "network", "rm", n.name], { timeoutMs: 30_000, signal: quiet() });
    if (r.exitCode === 0) networks++;
  }
  return { containers, snapshots, networks };
}
