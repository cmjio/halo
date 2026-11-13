import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "../src/parser/index";
import { validate } from "../src/parser/validate";
import { HaloRuntime, useTool, type MockRequest } from "../src/runtime/runtime";
import { plan } from "../src/plan";
import { getCompletions } from "../src/lsp/completions";
import { withSandbox } from "../src/runtime/sandbox-agents";
import { LOCAL_PROVIDER_INFO } from "../src/runtime/providers/index";
import { backendOf, closeRemoteSessions, connectFrame, connectFrames, dockerRunArgs, dockerShell, parseSshTarget, prelude, remote, sshArgs } from "../src/runtime/providers/remote";
import type { ToolCall, ToolServices } from "../src/runtime/tools";

let tmp: string;
let home: string;
let fakeSsh: string;
let fakeDocker: string;
let local: string;

beforeAll(() => {
  tmp = mkdtempSync(join(tmpdir(), "halo-remote-"));
  home = join(tmp, "home");
  local = join(tmp, "local");
  mkdirSync(home);
  mkdirSync(local);
  // A stand-in for ssh: records its arguments, then runs the remote command in `home`
  // with sh, as sshd would (host "down" fails to connect, like ssh's exit 255).
  fakeSsh = join(tmp, "fake-ssh");
  writeFileSync(
    fakeSsh,
    `#!/bin/sh
printf '%s\\n' "$@" > "${tmp}/ssh-args"
for last; do :; done
for a; do if [ "$a" = "down" ]; then echo "ssh: connect to host down port 22: Connection refused" >&2; exit 255; fi; done
cd "${home}" && exec sh -c "$last"
`,
  );
  chmodSync(fakeSsh, 0o755);
  // A stand-in for docker: `run` makes a folder for the container and prints its id, `exec`
  // runs the command in that folder, `rm` deletes it. Every call is logged.
  fakeDocker = join(tmp, "fake-docker");
  writeFileSync(
    fakeDocker,
    `#!/bin/sh
echo "$*" >> "${tmp}/docker-log"
cmd=$1; shift
case "$cmd" in
  run)
    for a; do if [ "$a" = "missing:image" ]; then echo "Unable to find image 'missing:image' locally" >&2; exit 125; fi; done
    n=$(ls "${tmp}/containers" 2>/dev/null | wc -l | tr -d ' ')
    id=$(printf 'c%011d%052d' "$n" 0 | tr c a)
    mkdir -p "${tmp}/containers/$id"
    echo "$id" ;;
  exec)
    [ "$1" = "--interactive" ] && shift
    id=$1; shift
    [ -d "${tmp}/containers/$id" ] || { echo "Error response from daemon: No such container: $id" >&2; exit 1; }
    cd "${tmp}/containers/$id" && exec "$@" ;;
  rm)
    for id; do :; done
    rm -rf "${tmp}/containers/$id" ;;
esac
`,
  );
  chmodSync(fakeDocker, 0o755);
});
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

function makeCall(method: string, named: Record<string, unknown> = {}, decl: Record<string | number, unknown> = {}, runId = "r1"): ToolCall {
  return {
    tool: { name: "Box", provider: "Remote", args: [], namedArgs: {}, argList: [] },
    method,
    positional: [],
    named,
    config: (n) => decl[n],
    viaAgent: false,
    signal: new AbortController().signal,
    runId,
  };
}

const services = (fetchImpl?: typeof fetch, env: Record<string, string> = {}): ToolServices =>
  ({ fetch: fetchImpl ?? (() => Promise.reject(new Error("no network"))), env, vectors: () => undefined, sql: () => undefined }) as unknown as ToolServices;

const ssh = (method: string, named: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) =>
  remote(makeCall(method, named, { 0: "deploy@build.example.com:2222", ssh: fakeSsh, root: local, ...extra }), services()) as Promise<any>;

describe("Remote: parsing", () => {
  test("SSH targets", () => {
    expect(parseSshTarget("deploy@build.example.com")).toEqual({ user: "deploy", host: "build.example.com", port: undefined });
    expect(parseSshTarget("ssh://ci@10.0.0.5:2222")).toEqual({ user: "ci", host: "10.0.0.5", port: 2222 });
    expect(parseSshTarget("[::1]:22")).toEqual({ user: undefined, host: "::1", port: 22 });
    expect(parseSshTarget("my-alias")).toEqual({ user: undefined, host: "my-alias", port: undefined });
    for (const bad of ["-oProxyCommand=evil", "a@-x", "host;rm", "a b", "", "host:99999", "a/b"]) expect(() => parseSshTarget(bad)).toThrow();
  });

  test("ssh never prompts, and the host can't be read as an option", () => {
    const args = sshArgs({ user: "u", host: "h", port: 2222 }, { key: "/k" });
    expect(args).toContain("BatchMode=yes");
    expect(args.slice(-2)).toEqual(["--", "h"]);
    expect(args.join(" ")).toContain("-p 2222");
    expect(args.join(" ")).toContain("-i /k");
    expect(args.join(" ")).not.toContain("StrictHostKeyChecking");
    expect(sshArgs({ host: "h" }, { strict: false }).join(" ")).toContain("StrictHostKeyChecking=accept-new");
  });

  test("backends", () => {
    expect(backendOf("e2b")).toBe("e2b");
    expect(backendOf("Daytona")).toBe("daytona");
    expect(backendOf("docker")).toBe("docker");
    expect(backendOf("ssh://e2b")).toBe("ssh");
    expect(backendOf("")).toBeUndefined();
  });

  test("cwd and env are quoted", () => {
    expect(prelude("my dir", { A: "x'; rm -rf ~" })).toBe(`export A='x'\\''; rm -rf ~'; cd -- 'my dir' && `);
  });

  test("Connect frames round-trip", async () => {
    const frames = [connectFrame({ a: 1 }), connectFrame({ b: "two" }), connectFrame({}, 2)];
    const all = new Uint8Array(frames.reduce((n, f) => n + f.length, 0));
    let at = 0;
    for (const f of frames) all.set(f, (at += f.length) - f.length);
    // Delivered in awkward chunks, as a network would.
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        for (let i = 0; i < all.length; i += 3) c.enqueue(all.slice(i, i + 3));
        c.close();
      },
    });
    const out = [];
    for await (const f of connectFrames(stream)) out.push(f);
    expect(out).toEqual([{ flags: 0, message: { a: 1 } }, { flags: 0, message: { b: "two" } }, { flags: 2, message: {} }]);
  });
});

describe("Remote over SSH", () => {
  test("run, with cwd and env", async () => {
    mkdirSync(join(home, "app"), { recursive: true });
    const r = await ssh("run", { command: 'pwd; echo "$GREETING"; echo oops >&2; exit 3', cwd: "app", env: { GREETING: "hi there" } });
    expect(r.stdout).toMatch(/\/home\/app\nhi there$/);
    expect(r.stderr).toBe("oops");
    expect(r.exitCode).toBe(3);
    expect(r.timedOut).toBe(false);
    const args = readFileSync(join(tmp, "ssh-args"), "utf8").split("\n");
    expect(args).toContain("BatchMode=yes");
    expect(args).toContain("deploy");
    expect(args).toContain("build.example.com");
  });

  test("JSON output is parsed", async () => {
    const r = await ssh("run", { command: `echo '{"ok": true}'` });
    expect(r.json).toEqual({ ok: true });
  });

  test("timeouts kill the command", async () => {
    // `; true` makes every shell fork sleep, which then holds the output pipe after the kill.
    const started = Date.now();
    const r = await ssh("run", { command: "echo started; sleep 5; true", timeout_ms: 1000 });
    expect(r.timedOut).toBe(true);
    expect(r.stdout).toBe("started");
    expect(Date.now() - started).toBeLessThan(3000);
  });

  test("write, read, list", async () => {
    expect(await ssh("write", { path: "notes/it's here.txt", content: "line 1\n$(whoami)\n" })).toEqual({ path: "notes/it's here.txt", bytes: 17 });
    expect(readFileSync(join(home, "notes/it's here.txt"), "utf8")).toBe("line 1\n$(whoami)\n");
    const r = await ssh("read", { path: "notes/it's here.txt" });
    expect(r).toMatchObject({ content: "line 1\n$(whoami)\n", encoding: "utf8", bytes: 17 });
    const l = await ssh("list", { path: "." });
    expect(l.entries).toContainEqual({ name: "notes", type: "dir" });
    expect((await ssh("list", { path: "notes" })).entries).toEqual([{ name: "it's here.txt", type: "file" }]);
  });

  test("binary files come back as base64", async () => {
    writeFileSync(join(home, "blob.bin"), new Uint8Array([0, 1, 2, 255]));
    expect(await ssh("read", { path: "blob.bin" })).toMatchObject({ content: "AAEC/w==", encoding: "base64", bytes: 4 });
  });

  test("upload and download stay inside root", async () => {
    writeFileSync(join(local, "build.tar"), "tarball");
    expect(await ssh("upload", { from: "build.tar", to: "releases/build.tar" })).toEqual({ from: "build.tar", to: "releases/build.tar", bytes: 7 });
    expect(readFileSync(join(home, "releases/build.tar"), "utf8")).toBe("tarball");
    expect(await ssh("download", { from: "releases/build.tar", to: "back/copy.tar" })).toEqual({ from: "releases/build.tar", to: "back/copy.tar", bytes: 7 });
    expect(readFileSync(join(local, "back/copy.tar"), "utf8")).toBe("tarball");
    await expect(ssh("download", { from: "releases/build.tar", to: "../escape.tar" })).rejects.toMatchObject({ code: "TOOL_ARGUMENT" });
    await expect(ssh("upload", { from: "/etc/passwd" })).rejects.toMatchObject({ code: "TOOL_ARGUMENT" });
    expect(existsSync(join(tmp, "escape.tar"))).toBe(false);
  });

  test("a missing file and an unreachable host are errors", async () => {
    await expect(ssh("read", { path: "nope.txt" })).rejects.toMatchObject({ code: "TOOL_FAILED" });
    await expect(remote(makeCall("run", { command: "true" }, { 0: "down", ssh: fakeSsh }), services())).rejects.toThrow(/couldn't reach down/);
    await expect(remote(makeCall("run", { command: "true" }, { 0: "-oProxyCommand=x", ssh: fakeSsh }), services())).rejects.toMatchObject({ code: "TOOL_CONFIG" });
    await expect(remote(makeCall("run", {}, { 0: "h", ssh: fakeSsh }), services())).rejects.toMatchObject({ code: "TOOL_ARGUMENT" });
    await expect(remote(makeCall("run", { command: "true", env: { "BAD-NAME": "x" } }, { 0: "h", ssh: fakeSsh }), services())).rejects.toMatchObject({ code: "TOOL_ARGUMENT" });
  });

  test("info", async () => {
    expect(await ssh("info")).toEqual({ backend: "ssh", host: "deploy@build.example.com:2222" });
  });

  test("{{placeholders}} in a pipeline's command are shell-quoted; other arguments aren't", async () => {
    const src = `
tool Box : Remote("me@box", ssh: "${fakeSsh}")
pipeline Greet(name: String) -> Result:
  name
    |> Box.write(path: "greet/{{name}}.txt", content: "hello") as w
    |> Box.run(command: "echo {{name}}; cat greet/*.txt")
`;
    const r = await new HaloRuntime({ env: {}, logger: { log() {}, warn() {} } }).load(parse(src)).run("Greet", { name: "x; touch pwned" });
    expect(r.status).toBe("completed");
    expect((r.output as any).stdout).toBe("x; touch pwned\nhello");
    expect(existsSync(join(home, "pwned"))).toBe(false);
    expect(existsSync(join(home, "greet/x; touch pwned.txt"))).toBe(true);
  });
});

/** A small E2B: the control API, plus envd's process and file endpoints. */
function fakeE2B() {
  const files = new Map<string, Uint8Array>();
  const log: string[] = [];
  let created = 0;
  let deleted = 0;
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input as string);
    const method = init?.method ?? "GET";
    log.push(`${method} ${url.host}${url.pathname}`);
    if (url.host === "api.e2b.app" && url.pathname === "/sandboxes" && method === "POST") {
      expect((init!.headers as Record<string, string>)["X-API-Key"]).toBe("e2b-key");
      created++;
      return Response.json({ sandboxID: `sb${created}`, envdAccessToken: "tok", domain: null });
    }
    if (url.host === "api.e2b.app" && method === "DELETE") {
      deleted++;
      return new Response(null, { status: 204 });
    }
    expect(url.host).toMatch(/^49983-sb\d+\.e2b\.app$/);
    expect((init!.headers as Record<string, string>)["X-Access-Token"]).toBe("tok");
    if (url.pathname === "/process.Process/Start") {
      const buf = new Uint8Array(init!.body as Uint8Array);
      const req = JSON.parse(new TextDecoder().decode(buf.subarray(5)));
      const [, , script] = req.process.args as string[];
      const enc = (s: string) => btoa(s);
      const events: unknown[] = [{ event: { start: { pid: 7 } } }];
      if (script === "fail") events.push({ event: { data: { stderr: enc("bad\n") } } }, { event: { end: { exitCode: 2, exited: true, status: "exit status 2" } } });
      else events.push({ event: { data: { stdout: enc(`ran ${script} in ${req.process.cwd ?? "~"} with ${JSON.stringify(req.process.envs)}\n`) } } }, { event: { end: { exited: true, status: "exit status 0" } } });
      const frames = [...events.map((e) => connectFrame(e)), connectFrame({}, 2)];
      return new Response(new Blob(frames as unknown as Uint8Array<ArrayBuffer>[]), { headers: { "Content-Type": "application/connect+json" } });
    }
    if (url.pathname === "/files") {
      const path = url.searchParams.get("path")!;
      expect(url.searchParams.get("username")).toBe("user");
      if (method === "POST") {
        const file = (init!.body as FormData).get("file") as Blob;
        files.set(path, new Uint8Array(await file.arrayBuffer()));
        return Response.json([{ path, name: path, type: "file" }]);
      }
      const f = files.get(path);
      return f ? new Response(f) : new Response("not found", { status: 404 });
    }
    return new Response("unexpected", { status: 500 });
  }) as typeof fetch;
  return { fetchImpl, files, log, stats: () => ({ created, deleted }) };
}

describe("Remote sandboxes: E2B", () => {
  test("one sandbox per run, kept between calls, deleted at the end", async () => {
    const e = fakeE2B();
    const svc = services(e.fetchImpl, { E2B_API_KEY: "e2b-key" });
    const decl = { 0: "e2b" };
    const r = (await remote(makeCall("run", { command: "make test", cwd: "/work", env: { CI: "1" } }, decl, "run-a"), svc)) as any;
    expect(r).toMatchObject({ stdout: 'ran make test in /work with {"CI":"1"}', exitCode: 0, timedOut: false });
    await remote(makeCall("write", { path: "a.txt", content: "hello" }, decl, "run-a"), svc);
    expect(await remote(makeCall("read", { path: "a.txt" }, decl, "run-a"), svc)).toMatchObject({ content: "hello" });
    expect(await remote(makeCall("info", {}, decl, "run-a"), svc)).toEqual({ backend: "e2b", id: "sb1" });
    const failed = (await remote(makeCall("run", { command: "fail" }, decl, "run-a"), svc)) as any;
    expect(failed).toMatchObject({ stderr: "bad", exitCode: 2 });
    expect(e.stats()).toEqual({ created: 1, deleted: 0 });

    // Another run gets its own sandbox.
    expect(await remote(makeCall("info", {}, decl, "run-b"), svc)).toEqual({ backend: "e2b", id: "sb2" });
    await closeRemoteSessions("run-a");
    expect(e.stats()).toEqual({ created: 2, deleted: 1 });
    await closeRemoteSessions();
    expect(e.stats()).toEqual({ created: 2, deleted: 2 });
  });

  test("needs a key", async () => {
    await expect(remote(makeCall("info", {}, { 0: "e2b" }, "run-k"), services())).rejects.toMatchObject({ code: "MISSING_API_KEY" });
  });

  test("a pipeline run deletes its sandbox when it ends", async () => {
    const e = fakeE2B();
    const src = `
tool Lab : Remote("e2b")
pipeline Try(code: String) -> Result:
  code
    |> Lab.write(path: "main.py", content: code) as saved
    |> Lab.run(command: "python3 main.py")
`;
    const rt = new HaloRuntime({ env: { E2B_API_KEY: "e2b-key" }, fetch: e.fetchImpl, logger: { log() {}, warn() {} } }).load(parse(src));
    const r = await rt.run("Try", { code: "print(1)" });
    expect(r.status).toBe("completed");
    expect((r.output as any).stdout).toBe("ran python3 main.py in ~ with {}");
    expect(new TextDecoder().decode(e.files.get("main.py"))).toBe("print(1)");
    expect(e.stats()).toEqual({ created: 1, deleted: 1 });
  });
});

describe("Remote sandboxes: Daytona", () => {
  test("waits for the sandbox to start, runs, moves files, deletes it", async () => {
    const files = new Map<string, Uint8Array>();
    let polls = 0;
    let deleted = 0;
    let created: any;
    const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(input as string);
      const method = init?.method ?? "GET";
      if (url.host === "app.daytona.io") {
        expect((init!.headers as Record<string, string>).Authorization).toBe("Bearer day-key");
        if (url.pathname === "/api/sandbox" && method === "POST") {
          created = JSON.parse(init!.body as string);
          return Response.json({ id: "d1", state: "creating" });
        }
        if (url.pathname === "/api/sandbox/d1" && method === "GET") return Response.json({ id: "d1", state: ++polls < 2 ? "starting" : "started", toolboxProxyUrl: "https://proxy.app.daytona.io/toolbox" });
        if (url.pathname === "/api/sandbox/d1" && method === "DELETE") return (deleted++, Response.json({ id: "d1" }));
      }
      if (url.host === "proxy.app.daytona.io") {
        if (url.pathname === "/toolbox/d1/process/execute") {
          const body = JSON.parse(init!.body as string);
          const b64 = /echo '([^']+)'/.exec(body.command)![1]!;
          return Response.json({ exitCode: 0, result: `${Buffer.from(b64, "base64").toString()} @ ${body.cwd} ${JSON.stringify(body.envs)} ${body.timeout}s` });
        }
        const path = url.searchParams.get("path")!;
        if (url.pathname === "/toolbox/d1/files/upload-v2") {
          files.set(path, new Uint8Array(await ((init!.body as FormData).get("file") as Blob).arrayBuffer()));
          return Response.json({ name: path, path, type: "file" });
        }
        if (url.pathname === "/toolbox/d1/files/download") return files.has(path) ? new Response(files.get(path)) : new Response("{}", { status: 404 });
      }
      return new Response(`unexpected ${method} ${url}`, { status: 500 });
    }) as typeof fetch;
    const svc = services(fetchImpl, { DAYTONA_API_KEY: "day-key" });
    const decl = { 0: "daytona", snapshot: "python", idle_minutes: 5 };

    const r = (await remote(makeCall("run", { command: "echo 'quoted' && ls", cwd: "/home/daytona", timeout_ms: 30_000 }, decl, "d-run"), svc)) as any;
    expect(r).toMatchObject({ stdout: `echo 'quoted' && ls @ /home/daytona {} 30s`, exitCode: 0 });
    expect(created).toMatchObject({ snapshot: "python", autoStopInterval: 5, autoDeleteInterval: 0 });
    await remote(makeCall("write", { path: "x/y.txt", content: "data" }, decl, "d-run"), svc);
    expect(await remote(makeCall("read", { path: "x/y.txt" }, decl, "d-run"), svc)).toMatchObject({ content: "data" });
    await expect(remote(makeCall("read", { path: "missing" }, decl, "d-run"), svc)).rejects.toMatchObject({ code: "TOOL_FAILED" });
    await closeRemoteSessions("d-run");
    expect(deleted).toBe(1);
  });

  test("a sandbox that fails to start is deleted and reported", async () => {
    let deleted = 0;
    const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      if (method === "POST") return Response.json({ id: "d2", state: "creating" });
      if (method === "DELETE") return (deleted++, Response.json({}));
      return Response.json({ id: "d2", state: "build_failed", errorReason: "no such snapshot" });
    }) as typeof fetch;
    await expect(remote(makeCall("info", {}, { 0: "daytona" }, "d-bad"), services(fetchImpl, { DAYTONA_API_KEY: "k" }))).rejects.toThrow(/build_failed: no such snapshot/);
    expect(deleted).toBe(1);
  });
});

describe("Remote sandboxes: Docker", () => {
  const log = () => (existsSync(join(tmp, "docker-log")) ? readFileSync(join(tmp, "docker-log"), "utf8").trim().split("\n") : []);
  const live = () => (existsSync(join(tmp, "containers")) ? require("node:fs").readdirSync(join(tmp, "containers")).length : 0);

  test("docker run starts a locked-down container that removes itself", () => {
    const args = dockerRunArgs({ image: "node:22", ttlSeconds: 600, network: false, memory: "1g", cpus: 1.5, pids: 256, runId: "r9" });
    const text = args.join(" ");
    expect(args[0]).toBe("run");
    for (const part of ["--detach", "--rm", "--init", "--network none", "--memory 1g", "--cpus 1.5", "--pids-limit 256", "no-new-privileges", "halo.run=r9", "HOME=/home/user"]) expect(text).toContain(part);
    expect(text).not.toContain("--volume");
    expect(args.slice(-3)).toEqual(["node:22", "sleep", "600"]);
    expect(dockerRunArgs({ image: "x", ttlSeconds: 60, network: true, memory: "2g", cpus: 2, pids: 512 }).join(" ")).not.toContain("--network");
  });

  test("commands run under bash when there is one, with a timeout", async () => {
    const argv = dockerShell("echo $0-$BASH_VERSION | cut -c1-5", 5);
    const p = Bun.spawn(argv, { stdout: "pipe" });
    expect((await new Response(p.stdout).text()).trim()).toMatch(/^bash-/);
    expect(argv[2]).toContain("timeout -s KILL 5");
  });

  test("one container per run, kept between calls, removed at the end", async () => {
    const decl = { 0: "docker", docker: fakeDocker, image: "python:3.12-slim", root: local };
    const call = (method: string, named: Record<string, unknown>, run = "d-a") => remote(makeCall(method, named, decl, run), services()) as Promise<any>;
    const r = await call("run", { command: 'echo "$GREETING from $(basename $PWD)"; mkdir -p sub', env: { GREETING: "hi; rm -rf ~" } });
    expect(r).toMatchObject({ exitCode: 0, timedOut: false });
    expect(r.stdout).toMatch(/^hi; rm -rf ~ from a/);
    await call("write", { path: "src/main.py", content: "print(1)" });
    expect(await call("read", { path: "src/main.py" })).toMatchObject({ content: "print(1)", encoding: "utf8" });
    expect((await call("list", { path: "." })).entries).toEqual(expect.arrayContaining([{ name: "src", type: "dir" }, { name: "sub", type: "dir" }]));
    expect((await call("run", { command: "pwd", cwd: "src" })).stdout).toEndWith("/src");
    expect((await call("run", { command: "echo oops >&2; exit 3" }))).toMatchObject({ stderr: "oops", exitCode: 3 });
    const info = await call("info", {});
    expect(info).toMatchObject({ backend: "docker" });
    expect(info.id).toHaveLength(12);

    writeFileSync(join(local, "data.csv"), "a,b\n1,2\n");
    await call("upload", { from: "data.csv", to: "in/data.csv" });
    expect((await call("run", { command: "cat in/data.csv" })).stdout).toBe("a,b\n1,2");
    await call("download", { from: "in/data.csv", to: "back.csv" });
    expect(readFileSync(join(local, "back.csv"), "utf8")).toBe("a,b\n1,2\n");

    expect((await call("info", {}, "d-b")).id).not.toBe(info.id);
    expect(log().filter((l) => l.startsWith("run ")).length).toBe(2);
    expect(live()).toBe(2);
    await closeRemoteSessions("d-a");
    expect(live()).toBe(1);
    await closeRemoteSessions();
    expect(live()).toBe(0);
    expect(log().filter((l) => l.startsWith("rm --force")).length).toBe(2);
  });

  test("a gone container, a missing image and a bad image name are errors", async () => {
    const decl = { 0: "docker", docker: fakeDocker };
    await remote(makeCall("info", {}, decl, "d-gone"), services());
    rmSync(join(tmp, "containers"), { recursive: true, force: true });
    // Errors name the tool, not the method of the call that happened to create the container.
    const missing: any = await remote(makeCall("read", { path: "nope.txt" }, decl, "d-gone"), services()).catch((e: Error) => e);
    expect(missing.message).toStartWith("Box: ");
    expect(missing.message).not.toContain("Box.info");
    await expect(remote(makeCall("run", { command: "true" }, decl, "d-gone"), services())).rejects.toThrow(/unavailable.*No such container.*ttl_minutes/);
    await closeRemoteSessions("d-gone");
    await expect(remote(makeCall("info", {}, { ...decl, image: "missing:image" }, "d-miss"), services())).rejects.toThrow(/couldn't start a Docker sandbox from missing:image/);
    await expect(remote(makeCall("info", {}, { ...decl, image: "--privileged" }, "d-bad"), services())).rejects.toMatchObject({ code: "TOOL_CONFIG" });
    await expect(remote(makeCall("info", {}, { ...decl, memory: "lots" }, "d-bad2"), services())).rejects.toMatchObject({ code: "TOOL_CONFIG" });
  });

  test("timeouts are reported", async () => {
    const decl = { 0: "docker", docker: fakeDocker };
    const r = (await remote(makeCall("run", { command: "sleep 5", timeout_ms: 1000 }, decl, "d-slow"), services())) as any;
    expect(r.timedOut).toBe(true);
    await closeRemoteSessions("d-slow");
  }, 15_000);

  test("sandbox: \"docker\" gives an agent its own container", () => {
    const d = withSandbox({ name: "Dev", modelId: "m", params: { sandbox: "docker" } }, new Map());
    expect(d.tool).toMatchObject({ name: "DevSandbox", provider: "Remote", argList: [{ value: { kind: "string", value: "docker" } }] });
    expect(d.agent.system).toContain("(docker)");
  });
});

describe("Remote: declaration", () => {
  test("validates, and lists its methods with effects", () => {
    const doc = parse(`
tool Box : Remote("deploy@build.example.com", key: "~/.ssh/ci")
tool Lab : Remote("e2b", template: "base")
agent Ops [anthropic/claude-sonnet-4-5, tools: auto]
  equips Box, Lab
`);
    expect(validate(doc).filter((d) => d.severity === "error")).toEqual([]);
    const info = LOCAL_PROVIDER_INFO.Remote!;
    const effects = Object.fromEntries((info.methods as { name: string; effect: string }[]).map((m) => [m.name, m.effect]));
    expect(effects).toEqual({ run: "external", read: "read", write: "external", list: "read", upload: "external", download: "write", info: "read", diff: "read", apply: "write", keep: "external" });
  });
});

describe("Sandbox agents", () => {
  const quiet = { log() {}, warn() {} };

  test("sandbox: \"e2b\" gives the agent its own sandbox for the run", async () => {
    const e = fakeE2B();
    const src = `
agent Dev [anthropic/claude-sonnet-4-5, preset: Coder, sandbox: "e2b"]
  system "Use Python."

pipeline Build(task: String) -> Result:
  task |> Dev.work() as first |> Dev.check()
`;
    expect(validate(parse(src)).filter((d) => d.severity === "error")).toEqual([]);
    const asked: MockRequest[] = [];
    const rt = new HaloRuntime({ env: { E2B_API_KEY: "e2b-key" }, fetch: e.fetchImpl, logger: quiet })
      .load(parse(src))
      .mockAll({
        "Dev.work": (req: MockRequest) => (asked.push(structuredClone(req)), req.step === 1 ? useTool("DevSandbox.write", { path: "app.py", content: "print(2)" }) : req.step === 2 ? useTool("DevSandbox.run", { command: "python3 app.py" }) : "built"),
        "Dev.check": (req: MockRequest) => (req.step === 1 ? useTool("DevSandbox.read", { path: "app.py" }) : "checked"),
      });
    const r = await rt.run("Build", { task: "print 2" });
    expect(r.status).toBe("completed");
    expect(r.output).toBe("checked");
    expect(asked[0]!.tools).toEqual(["DevSandbox.run", "DevSandbox.read", "DevSandbox.write", "DevSandbox.list", "DevSandbox.upload", "DevSandbox.download", "DevSandbox.info", "DevSandbox.diff", "DevSandbox.apply", "DevSandbox.keep"]);
    expect(asked[0]!.system).toContain("Use Python.");
    expect(asked[0]!.system).toContain("a fresh Linux sandbox (e2b)");
    expect(JSON.stringify(asked[2]!.messages)).toContain("ran python3 app.py");
    // Both calls in the run used one sandbox, and it was deleted at the end.
    expect(e.stats()).toEqual({ created: 1, deleted: 1 });
    expect(new TextDecoder().decode(e.files.get("app.py"))).toBe("print(2)");
  });

  test("sandbox: Lab shares a declared Remote tool with the pipeline", async () => {
    const e = fakeE2B();
    const src = `
tool Lab : Remote("e2b")
agent Dev [anthropic/claude-sonnet-4-5, sandbox: Lab]

pipeline Fix(code: String) -> Result:
  code
    |> Lab.write(path: "main.py", content: code) as put
    |> Dev.work("Fix main.py.") as fixed
    |> Lab.read(path: "main.py")
`;
    expect(validate(parse(src)).filter((d) => d.severity === "error")).toEqual([]);
    const rt = new HaloRuntime({ env: { E2B_API_KEY: "e2b-key" }, fetch: e.fetchImpl, logger: quiet })
      .load(parse(src))
      .mockAll({ "Dev.work": (req: MockRequest) => (req.step === 1 ? useTool("Lab.write", { path: "main.py", content: "print('fixed')" }) : "done") });
    const r = await rt.run("Fix", { code: "print(" });
    expect((r.output as any).content).toBe("print('fixed')");
    expect(e.stats()).toEqual({ created: 1, deleted: 1 });
  });

  test("agents with their own sandboxes don't share", () => {
    const tools = new Map();
    const a = withSandbox({ name: "A", modelId: "m", params: { sandbox: "daytona", tools: "none" } }, tools);
    expect(a.tool).toMatchObject({ name: "ASandbox", provider: "Remote", argList: [{ value: { kind: "string", value: "daytona" } }] });
    expect(a.agent.params.tools).toBe("none");
    expect(a.agent.equips).toEqual(["ASandbox"]);
    expect(withSandbox({ name: "B", modelId: "m", params: { sandbox: "e2b" } }, tools).tool!.name).toBe("BSandbox");
    expect(withSandbox({ name: "C", modelId: "m", params: {} }, tools).tool).toBeUndefined();
  });

  test("bad sandbox: values are errors", () => {
    const src = `
tool Files : Workspace(".")
tool DevSandbox : Remote("e2b")
agent A [m/x, sandbox: Files]
agent B [m/x, sandbox: Nowhere]
agent Dev [m/x, sandbox: "e2b"]
`;
    const errors = validate(parse(src)).filter((d) => d.severity === "error").map((d) => d.message);
    expect(errors).toEqual([
      expect.stringContaining("sandbox: Files is a Workspace tool"),
      expect.stringContaining("sandbox: Nowhere is not"),
      expect.stringContaining('"DevSandbox", but a tool of that name is already declared'),
    ]);
    expect(() => new HaloRuntime({ env: {}, logger: quiet }).load(parse(src))).toThrow(/sandbox/);
  });

  test("plan shows what a sandbox agent may do", () => {
    const p = plan(parse(`
agent Dev [anthropic/claude-sonnet-4-5, sandbox: "e2b"]
pipeline Go(t: String) -> Result:
  t |> Dev.work()
`), "Go", { providerInfo: (name) => LOCAL_PROVIDER_INFO[name] });
    const text = JSON.stringify(p);
    expect(text).toContain("DevSandbox.run");
  });

  test("the editor completes sandbox:", () => {
    const src = `tool Lab : Remote("e2b")\nagent A [m/x, sandbox: `;
    const labels = getCompletions(src, { line: 1, character: 24 }).map((c) => c.label);
    expect(labels).toEqual(['"e2b"', '"daytona"', '"docker"', '"auto"', "Lab"]);
  });
});
