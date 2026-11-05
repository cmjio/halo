/**
 * Remote: a computer somewhere else that an agent can run commands on and move files to.
 *
 *   tool Box  : Remote("deploy@build.example.com")       a machine you reach over SSH
 *   tool Box  : Remote("ssh://deploy@10.0.0.5:2222", key: "~/.ssh/ci")
 *   tool Lab  : Remote("e2b")                             a fresh cloud sandbox from E2B (E2B_API_KEY)
 *   tool Lab  : Remote("daytona", snapshot: "python")     ... or from Daytona (DAYTONA_API_KEY)
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
 * Daytona once it has been idle `idle_minutes` (default 15).
 *
 * Local paths (upload's `from`, download's `to`) stay inside `root:` (default ".").
 */

import { mkdirSync } from "node:fs";
import { dirname, posix } from "node:path";
import { HaloError, TimeoutError } from "../errors.js";
import type { ToolCall, ToolServices } from "../tools.js";
import { shellQuote as q } from "../shell.js";
import { intArg, need, unknownMethod } from "./common.js";
import { confine, workspaceRoot } from "./workspace.js";

const METHODS = ["run", "read", "write", "list", "upload", "download", "info"];
const MAX_OUTPUT = 100_000;
const MAX_FILE = 50_000_000;
const DEFAULT_TIMEOUT_MS = 120_000;

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
}

export interface ExecOptions {
  cwd?: string;
  env: Record<string, string>;
  timeoutMs: number;
  signal: AbortSignal;
}

/** One remote computer, whichever kind. */
export interface Machine {
  backend: "ssh" | "e2b" | "daytona";
  /** The host (ssh) or sandbox id. */
  id: string;
  exec(command: string, opts: ExecOptions): Promise<ExecResult>;
  read(path: string, signal: AbortSignal): Promise<Uint8Array>;
  write(path: string, bytes: Uint8Array, signal: AbortSignal): Promise<void>;
  close(): Promise<void>;
}

function fail(call: ToolCall, message: string, code = "TOOL_FAILED"): HaloError {
  return new HaloError(`${call.tool.name}.${call.method}: ${message}`, { code });
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

  async function spawn(remote: string, opts: { stdin?: Uint8Array; timeoutMs: number; signal: AbortSignal }) {
    const proc = Bun.spawn([ssh, ...base, remote], { stdin: opts.stdin ? "pipe" : "ignore", stdout: "pipe", stderr: "pipe" });
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
      const [out, err, exitCode] = await Promise.all([new Response(proc.stdout).bytes(), new Response(proc.stderr).text(), proc.exited]);
      return { out, err, exitCode, timedOut };
    } finally {
      clearTimeout(timer);
      opts.signal.removeEventListener("abort", kill);
    }
  }

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
export function connectFrame(message: unknown, flags = 0): Uint8Array {
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
            if (message.error) throw fail(call, message.error.message ?? message.error.code ?? "the command failed");
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
      form.append("file", new Blob([bytes]), posix.basename(path));
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
        form.append("file", new Blob([bytes]), posix.basename(path));
        await api(call, services.fetch, `writing ${path}`, `${toolbox}/files/upload-v2?${new URLSearchParams({ path })}`, { method: "POST", headers, body: form, signal: sig });
      },
      close: remove,
    };
  } catch (e) {
    await remove();
    throw e;
  }
}

// ── Sessions: one sandbox per (tool, run) ──

const sandboxes = new Map<string, Promise<Machine>>();

/** Delete sandboxes: all of them, or one run's (when it ends). */
export async function closeRemoteSessions(runId?: string): Promise<void> {
  const keys = [...sandboxes.keys()].filter((k) => runId === undefined || k.endsWith(`\0${runId}`));
  const pending = keys.map((k) => sandboxes.get(k)!);
  for (const k of keys) sandboxes.delete(k);
  await Promise.all(pending.map((p) => p.then((m) => m.close(), () => {})));
}

/** What a declaration's first argument names: an SSH host, or a sandbox service. */
export function backendOf(spec: unknown): "ssh" | "e2b" | "daytona" | undefined {
  if (typeof spec !== "string" || !spec.trim()) return undefined;
  const s = spec.trim().toLowerCase();
  return s === "e2b" || s === "daytona" ? s : "ssh";
}

async function machine(call: ToolCall, services: ToolServices): Promise<Machine> {
  const spec = call.config(0);
  const backend = backendOf(spec);
  if (!backend) throw configError(call, `needs a host or a sandbox service, e.g. Remote("deploy@build.example.com") or Remote("e2b")`);
  if (backend === "ssh") return sshMachine(call, spec as string);
  const key = `${call.tool.name}\0${call.runId ?? ""}`;
  let p = sandboxes.get(key);
  if (!p) {
    // Not the call's own signal: the sandbox outlives the call that created it.
    const create = AbortSignal.timeout(180_000);
    p = backend === "e2b" ? e2bMachine(call, services, create) : daytonaMachine(call, services, create);
    sandboxes.set(key, p);
    p.catch(() => sandboxes.get(key) === p && sandboxes.delete(key));
  }
  return p;
}

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

export async function remote(call: ToolCall, services: ToolServices): Promise<unknown> {
  if (!METHODS.includes(call.method)) unknownMethod(call, METHODS);
  const m = await machine(call, services);
  const named = call.named;

  switch (call.method) {
    case "info":
      return m.backend === "ssh" ? { backend: m.backend, host: m.id } : { backend: m.backend, id: m.id };

    case "run": {
      const command = named.command ?? (call.implicitInput ? undefined : call.positional[0]);
      if (typeof command !== "string" || !command.trim()) throw fail(call, `needs command: "...", e.g. ${call.tool.name}.run(command: "uname -a")`, "TOOL_ARGUMENT");
      const timeoutMs = intArg(call, "timeout_ms", named.timeout_ms ?? call.config("timeout_ms"), DEFAULT_TIMEOUT_MS, 1_000, 3_600_000);
      const cwd = named.cwd ?? call.config("cwd");
      const r = await m.exec(command, { cwd: typeof cwd === "string" && cwd ? cwd : undefined, env: envRecord(call, named.env), timeoutMs, signal: call.signal });
      const stdout = clip(r.stdout.trimEnd());
      let json: unknown;
      if (/^\s*[[{]/.test(stdout)) {
        try {
          json = JSON.parse(stdout);
        } catch {}
      }
      return { command, stdout, stderr: clip(r.stderr.trimEnd()), exitCode: r.exitCode, timedOut: r.timedOut, ...(json !== undefined ? { json } : {}) };
    }

    case "read": {
      const path = remotePath(call, named.path ?? (call.implicitInput ? undefined : call.positional[0]));
      const bytes = await m.read(path, call.signal);
      if (bytes.length > MAX_FILE) throw fail(call, `${path} is ${bytes.length} bytes; download it instead`);
      if (looksBinary(bytes)) return { path, content: Buffer.from(bytes).toString("base64"), bytes: bytes.length, encoding: "base64" };
      return { path, content: clip(new TextDecoder().decode(bytes)), bytes: bytes.length, encoding: "utf8" };
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
      const bytes = await m.read(from, call.signal);
      if (bytes.length > MAX_FILE) throw fail(call, `${from} is over ${MAX_FILE} bytes`);
      mkdirSync(dirname(to.abs), { recursive: true });
      await Bun.write(to.abs, bytes);
      return { from, to: to.rel, bytes: bytes.length };
    }
  }
  return unknownMethod(call, METHODS);
}
