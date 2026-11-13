/**
 * Next-generation sandboxes: forks, rewind, pauses, egress allowlists, isolation, sandbox: "auto",
 * copying a project in and its changes out, and tool effects in the trace. Docker is played by a
 * shell script, so this runs anywhere; test/remote.test.ts covers the basics.
 */

import { test, expect, describe, beforeAll, afterAll, afterEach } from "bun:test";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "../src/parser/index";
import { validate } from "../src/parser/validate";
import { HaloRuntime, verifyTrace } from "../src/runtime/runtime";
import { intersectFiles, intersectHosts, sandboxLimits, withSandbox } from "../src/runtime/sandbox-agents";
import { chooseSandbox, closeRemoteSessions, dockerRunArgs, mask, pickVmRuntime, remote } from "../src/runtime/providers/remote";
import { compareTrees, credentialFile, hostAllowed, parseHashes, privateAddress, tarball, tlsServerName } from "../src/runtime/providers/sandbox-kit";
import { HOST_PATTERN, RESERVED_SECRET } from "../src/parser/builtins";
import type { ToolCall, ToolServices } from "../src/runtime/tools";

let tmp: string;
let docker: string;
const quiet = { log() {}, warn() {} };

beforeAll(() => {
  tmp = mkdtempSync(join(tmpdir(), "halo-sandboxes-"));
  // A stand-in for docker. Containers and snapshots are folders; exec runs in the container's.
  // `run` from a halo-sandbox:* image copies that snapshot; `commit` copies a container to one.
  // The proxy container's `logs` print "ready" and whatever the test put in proxy-log.
  docker = join(tmp, "docker");
  writeFileSync(
    docker,
    `#!/bin/sh
D="${tmp}"
echo "$*" >> "$D/log"
cmd=$1; shift
case "$cmd" in
  version) [ -e "$D/down" ] && { echo "Cannot connect to the Docker daemon" >&2; exit 1; }; echo 28.0.0 ;;
  info) if [ -e "$D/vm" ]; then echo '{"runc":{},"runsc":{}}'; else echo '{"runc":{}}'; fi ;;
  network) [ "$1" = inspect ] && exit 1; exit 0 ;;
  logs) echo '{"ready":true}'; cat "$D/proxy-log" 2>/dev/null ;;
  run)
    image=""; prev=""
    for a; do [ "$a" = "sleep" ] && image=$prev; [ "$a" = "bun" ] && image=proxy; prev=$a; done
    id=0$(od -An -N16 -tx1 /dev/urandom | tr -d ' \\n')
    mkdir -p "$D/c/$id"
    case "$image" in halo-sandbox:*) cp -R "$D/s/$(echo "$image" | tr ':/' '__')/." "$D/c/$id/" ;; esac
    echo "$id" ;;
  exec)
    while :; do case "$1" in --interactive) shift ;; --env) shift 2 ;; *) break ;; esac; done
    id=$1; shift
    [ -d "$D/c/$id" ] || { echo "Error response from daemon: No such container: $id" >&2; exit 1; }
    cd "$D/c/$id" && exec "$@" ;;
  commit)
    for a; do :; done; ref=$a
    for b; do case "$b" in 0*) id=$b ;; esac; done
    mkdir -p "$D/s/$(echo "$ref" | tr ':/' '__')" && cp -R "$D/c/$id/." "$D/s/$(echo "$ref" | tr ':/' '__')/" ;;
  rmi) for ref; do rm -rf "$D/s/$(echo "$ref" | tr ':/' '__')"; done ;;
  inspect)
    for id; do :; done
    [ -d "$D/c/$id" ] && echo true || { echo "Error: No such object: $id" >&2; exit 1; } ;;
  rm) for id; do :; done; rm -rf "$D/c/$id" ;;
esac
`,
  );
  chmodSync(docker, 0o755);
});
afterAll(() => rmSync(tmp, { recursive: true, force: true }));
afterEach(async () => {
  await closeRemoteSessions();
  rmSync(join(tmp, "down"), { force: true });
  rmSync(join(tmp, "vm"), { force: true });
  rmSync(join(tmp, "proxy-log"), { force: true });
});

const log = () => (existsSync(join(tmp, "log")) ? readFileSync(join(tmp, "log"), "utf8").trim().split("\n") : []);
const live = () => (existsSync(join(tmp, "c")) ? readdirSync(join(tmp, "c")).length : 0);
const snapshots = () => (existsSync(join(tmp, "s")) ? readdirSync(join(tmp, "s")).length : 0);
const runtime = (src: string, extra: object = {}) => new HaloRuntime({ env: {}, logger: quiet, ...extra }).load(parse(src.replaceAll("$DOCKER", docker)));

function makeCall(method: string, named: Record<string, unknown>, decl: Record<string | number, unknown>, runId = "u1", branch?: string): ToolCall {
  return { tool: { name: "Lab", provider: "Remote", args: [], namedArgs: {}, argList: [] }, method, positional: [], named, config: (n) => decl[n], viaAgent: false, signal: new AbortController().signal, runId, branch };
}
const services = (env: Record<string, string> = {}) => ({ fetch: () => Promise.reject(new Error("no network")), env }) as unknown as ToolServices;

describe("Forks", () => {
  test("each branch of a fan-out gets a copy of the sandbox, and keep() carries one on", async () => {
    const rt = runtime(`
tool Lab : Remote("docker", docker: "$DOCKER")
pipeline Try() -> Result:
  "x"
    |> Lab.write(path: "base.txt", content: "parent") as b
    |* each(n in ["a", "b", "c"]) => Lab.run(command: "cat base.txt; echo {{n}} > pick.txt; cat pick.txt") as tries
    |> Lab.keep(fork: 2) as kept
    |> Lab.run(command: "cat pick.txt base.txt")
`);
    const r = await rt.run("Try");
    expect((r.context.data.tries as any[]).map((t) => t.stdout)).toEqual(["parenta", "parentb", "parentc"]);
    expect((r.output as any).stdout).toBe("c\nparent");
    expect(r.context.data.kept).toMatchObject({ fork: 2, snapshot: expect.stringMatching(/^halo-sandbox:/) });
    // Four containers in all (the run's, then three branches), none left; fork snapshots are gone too.
    expect(log().filter((l) => l.startsWith("run ") && !l.includes(" bun ")).length).toBeGreaterThanOrEqual(5);
    expect(live()).toBe(0);
    expect(snapshots()).toBe(0);
  });

  test("keep() needs a fork that happened", async () => {
    const rt = runtime(`
tool Lab : Remote("docker", docker: "$DOCKER")
pipeline Try() -> Result:
  "x" |> Lab.keep(fork: 0)
`);
    await expect(rt.run("Try")).rejects.toThrow(/no forks to keep/);
  });
});

describe("Rewind and pause", () => {
  test("@checkpoint saves sandboxes, and rewind starts from the files they had at that step", async () => {
    const dir = join(tmp, "cp");
    const rt = runtime(
      `
tool Lab : Remote("docker", docker: "$DOCKER")
@checkpoint
pipeline Steps() -> Result:
  "x"
    |> Lab.write(path: "state.txt", content: "one") as s1
    |> Lab.run(command: "echo two >> state.txt") as s2
    |> Lab.read(path: "state.txt")
`,
      { checkpointDir: dir },
    );
    const r = await rt.run("Steps");
    expect((r.output as any).content).toBe("onetwo\n");
    const steps = readFileSync(r.context.meta.checkpoint!.replace(/\.json$/, ".steps.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
    expect(steps[1].sandboxes.Lab).toStartWith("halo-sandbox:");
    // Checkpoint snapshots outlive the run.
    expect(snapshots()).toBeGreaterThan(0);
    const again = await rt.rewind(r.context.meta.checkpoint!, 2);
    expect((again.output as any).content).toBe("onetwo\n"); // a fresh sandbox would say just "two"
  });

  test("a paused run's sandbox is saved and stopped, and back when it resumes", async () => {
    const rt = runtime(`
tool Lab : Remote("docker", docker: "$DOCKER")
pipeline Wait() -> Result:
  "x"
    |> Lab.write(path: "w.txt", content: "still here") as w
    |! yield(msg: "ok?") as ok
    |> Lab.read(path: "w.txt")
`);
    const before = snapshots();
    const r = await rt.run("Wait");
    expect(r.status).toBe("paused");
    expect(live()).toBe(0);
    const done = await rt.signal(r.runId, "yield", { approved: true });
    expect((done.output as any).content).toBe("still here");
    expect(live()).toBe(0);
    expect(snapshots()).toBe(before);
  });
});

describe("Allowed hosts", () => {
  test("hosts: routes the sandbox through a proxy on an internal network, and refusals are violations", async () => {
    writeFileSync(join(tmp, "proxy-log"), '{"blocked":"evil.example"}\n');
    const rt = runtime(`
tool Net : Remote("docker", docker: "$DOCKER", hosts: ["pypi.org", "*.pythonhosted.org"])
pipeline Go() -> Result:
  "x" |> Net.run(command: "echo hi")
`);
    const r = await rt.run("Go");
    expect((r.output as any).blocked).toEqual(["evil.example"]);
    expect(r.context.meta.violations).toEqual([expect.objectContaining({ rule: "AllowHosts", phase: "tool", message: expect.stringContaining("evil.example") })]);
    rmSync(join(tmp, "log"), { force: true });
    await rt.run("Go");
    const lines = log();
    expect(lines.some((l) => l.startsWith("network create --internal"))).toBe(true);
    const proxy = lines.find((l) => l.includes(" bun -e "))!;
    expect(proxy).toContain('HALO_HOSTS=["pypi.org","*.pythonhosted.org"]');
    const sandbox = lines.find((l) => l.startsWith("run ") && l.includes(" sleep "))!;
    expect(sandbox).toMatch(/--network halo-net-\w+/);
    expect(sandbox).toContain("HTTPS_PROXY=http://halo-proxy:3128");
    expect(lines.some((l) => l.startsWith("network rm halo-net-"))).toBe(true);
  });

  test("hosts are checked, and can't be mixed with network: false or a cloud sandbox", async () => {
    await expect(remote(makeCall("info", {}, { 0: "docker", docker, hosts: ["-x"] }), services())).rejects.toMatchObject({ code: "TOOL_CONFIG" });
    await expect(remote(makeCall("info", {}, { 0: "docker", docker, hosts: ["a.com"], network: false }), services())).rejects.toThrow(/one or the other/);
    await expect(remote(makeCall("info", {}, { 0: "e2b", hosts: ["a.com"] }), services({ E2B_API_KEY: "k" }))).rejects.toThrow(/enforced by Docker/);
  });

  test("matching", () => {
    expect(hostAllowed("files.pythonhosted.org", ["*.pythonhosted.org"])).toBe(true);
    expect(hostAllowed("pythonhosted.org", ["*.pythonhosted.org"])).toBe(true);
    expect(hostAllowed("evilpythonhosted.org", ["*.pythonhosted.org"])).toBe(false);
    expect(hostAllowed("PyPI.org.", ["pypi.org"])).toBe(true);
    expect(hostAllowed("pypi.org.evil.com", ["pypi.org"])).toBe(false);
  });

  test("an agent's AllowHosts policy becomes its sandbox's hosts", () => {
    const policies = new Map([["Deps", { name: "Deps", rules: [{ name: "AllowHosts", args: ["pypi.org", "registry.npmjs.org"] }] }]]);
    const d = withSandbox({ name: "Dev", modelId: "m", params: { sandbox: "docker" }, requires: ["Deps"] }, new Map(), policies as any);
    expect(d.tool!.argList[1]).toEqual({ name: "hosts", value: { kind: "list", items: [{ kind: "string", value: "pypi.org" }, { kind: "string", value: "registry.npmjs.org" }] } });
    const src = `
policy Deps : AllowHosts("pypi.org")
policy Bad : AllowHosts("not a host")
tool Lab : Remote("docker")
agent A [m/x, sandbox: "e2b"]
  requires Deps
agent B [m/x, sandbox: Lab]
  requires Deps
agent C [m/x, sandbox: "docker"]
  requires Deps
`;
    const errors = validate(parse(src)).filter((x) => x.severity === "error").map((x) => x.message);
    expect(errors).toEqual([
      expect.stringContaining("AllowHosts(not a host) is not a host name"),
      expect.stringContaining('Agent "A": AllowHosts is enforced by Docker sandboxes'),
      expect.stringContaining('Agent "B": AllowHosts limits a sandbox the agent owns'),
    ]);
    // Policies may name the tool sandbox: "docker" makes (<Agent>Sandbox) without a warning.
    const named = validate(parse(`policy P : DenyTools("CSandbox.apply")\nagent C [m/x, sandbox: "docker"]\n  requires P\n`));
    expect(named.filter((x) => x.message.includes("not a declared tool"))).toEqual([]);
  });
});

describe("Isolation and auto", () => {
  test('isolation: "vm" uses a VM runtime Docker has, or says what\'s missing', async () => {
    await expect(remote(makeCall("info", {}, { 0: "docker", docker, isolation: "vm" }, "iso1"), services())).rejects.toThrow(/gVisor \(runsc\) or Kata.*has runc/);
    writeFileSync(join(tmp, "vm"), "");
    await remote(makeCall("info", {}, { 0: "docker", docker, isolation: "vm" }, "iso2"), services());
    expect(log().at(-1)).toBe(log().find((l) => l.includes("--runtime runsc")) ?? "missing --runtime");
    expect(pickVmRuntime(["runc", "kata-qemu", "runsc"])).toBe("runsc");
    expect(pickVmRuntime(["io.containerd.runc.v2", "kata"])).toBe("kata");
    expect(pickVmRuntime(["runc"])).toBeUndefined();
    expect(dockerRunArgs({ image: "x", ttlSeconds: 60, network: "halo-net-1", memory: "1g", cpus: 1, pids: 64, runtime: "runsc", env: { A: "1" } }).join(" ")).toContain("--env A=1 --network halo-net-1 --runtime runsc");
  });

  test('"auto" picks Docker when it runs, else E2B, else Daytona, else explains', async () => {
    expect(await chooseSandbox({ docker, env: {} })).toBe("docker");
    writeFileSync(join(tmp, "down"), "");
    const down = join(tmp, "docker-down");
    writeFileSync(down, "#!/bin/sh\nexit 1\n");
    chmodSync(down, 0o755);
    expect(await chooseSandbox({ docker: down, env: { E2B_API_KEY: "k" } })).toBe("e2b");
    expect(await chooseSandbox({ docker: down, env: { DAYTONA_API_KEY: "k" } })).toBe("daytona");
    expect(await chooseSandbox({ docker: down, env: {} })).toBeUndefined();
    await expect(remote(makeCall("info", {}, { 0: "auto", docker: down }, "auto1"), services())).rejects.toThrow(/found no sandbox/);
    expect(await chooseSandbox({ docker, isolation: "vm", env: { E2B_API_KEY: "k" } })).toBe("e2b"); // the fake reports only runc
    const r = (await remote(makeCall("info", {}, { 0: "auto", docker }, "auto2"), services())) as any;
    expect(r.backend).toBe("docker");
    expect(withSandbox({ name: "D", modelId: "m", params: { sandbox: "auto" } }, new Map()).tool!.argList[0]!.value).toEqual({ kind: "string", value: "auto" });
  });
});

describe("A project in, its changes out", () => {
  test("from: copies a folder in; diff shows what changed; apply writes it back", async () => {
    const root = join(tmp, "work");
    mkdirSync(join(root, "proj/src"), { recursive: true });
    writeFileSync(join(root, "proj/src/calc.py"), "def add(a, b):\n    return a - b\n");
    writeFileSync(join(root, "proj/README.md"), "# demo\n");
    const decl = { 0: "docker", docker, from: "proj", root };
    const call = (method: string, named: Record<string, unknown> = {}) => remote(makeCall(method, named, decl, "proj1"), services()) as Promise<any>;
    expect((await call("run", { command: "cat src/calc.py" })).stdout).toContain("a - b");
    await call("run", { command: "sed 's/a - b/a + b/' src/calc.py > t && mv t src/calc.py && echo ok > NOTES.txt && rm README.md && mkdir -p .cache && echo x > .cache/junk" });
    const d = await call("diff");
    expect(d.files).toEqual([
      { path: "NOTES.txt", status: "added" },
      { path: "README.md", status: "deleted" },
      { path: "src/calc.py", status: "modified" },
    ]);
    expect(d.patch).toContain("-    return a - b\n+    return a + b");
    expect(d.patch).toContain("--- /dev/null\n+++ b/NOTES.txt");
    expect((await call("diff", { path: "src" })).files).toEqual([{ path: "src/calc.py", status: "modified" }]);

    const a = await call("apply", { to: "out" });
    expect(a).toEqual({ to: "out", written: ["out/NOTES.txt", "out/src/calc.py"], deleted: ["out/README.md"] });
    expect(readFileSync(join(root, "out/src/calc.py"), "utf8")).toContain("a + b");
    await expect(call("apply", { to: "../escape" })).rejects.toThrow(/outside the workspace/);
    // The original is untouched until apply writes to it.
    expect(readFileSync(join(root, "proj/src/calc.py"), "utf8")).toContain("a - b");
  });

  test("tar archives unpack with the system tar", async () => {
    const out = join(tmp, "untar");
    mkdirSync(out);
    const long = `${"deep/".repeat(30)}file.txt`;
    writeFileSync(join(tmp, "t.tar"), tarball([{ path: "a/b.txt", bytes: new TextEncoder().encode("hi\n") }, { path: long, bytes: new Uint8Array([1, 2]) }, { path: "run.sh", bytes: new TextEncoder().encode("echo"), mode: 0o755 }]));
    const p = Bun.spawnSync(["tar", "-xf", join(tmp, "t.tar"), "-C", out]);
    expect(p.exitCode).toBe(0);
    expect(readFileSync(join(out, "a/b.txt"), "utf8")).toBe("hi\n");
    expect(readFileSync(join(out, long)).length).toBe(2);
  });

  test("compareTrees ignores a home folder's dot-folders the project didn't have", () => {
    const before = new Map([["a.py", "1"], [".github/ci.yml", "2"]]);
    const now = new Map([["a.py", "1"], [".github/ci.yml", "3"], [".cache/pip/x", "4"], ["b.py", "5"]]);
    expect(compareTrees(before, now)).toEqual([
      { path: ".github/ci.yml", status: "modified" },
      { path: "b.py", status: "added" },
    ]);
    expect(parseHashes(`${"a".repeat(64)}  ./src/x.py\n${"b".repeat(64)} *./y\n`)).toEqual(new Map([["src/x.py", "a".repeat(64)], ["y", "b".repeat(64)]]));
  });
});

describe("Limits: files, secrets, and hosts by pattern", () => {
  test("several AllowHosts narrow by pattern, not by exact name", () => {
    expect(intersectHosts(["*.stripe.com", "pypi.org"], ["api.stripe.com", "registry.npmjs.org"])).toEqual(["api.stripe.com"]);
    expect(intersectHosts(["*.stripe.com"], ["*.api.stripe.com"])).toEqual(["*.api.stripe.com"]);
    expect(intersectHosts(["stripe.com"], ["*.stripe.com"])).toEqual(["stripe.com"]);
    expect(intersectHosts(["evilstripe.com"], ["*.stripe.com"])).toEqual([]);
    expect(intersectHosts(["*.stripe.com"], ["*.com"])).toEqual(["*.stripe.com"]);
    expect(intersectFiles(["src"], ["src/billing", "docs"])).toEqual(["src/billing"]);
    expect(intersectFiles(["."], ["test"])).toEqual(["test"]);
    expect(intersectFiles(["src/billing"], ["src/bill"])).toEqual([]);
    const policies = new Map(
      Object.entries({
        Role: { name: "Role", rules: [{ name: "AllowHosts", args: ["*.stripe.com", "pypi.org"] }, { name: "AllowFiles", args: ["src", "./test/"] }, { name: "AllowSecrets", args: ["STRIPE_KEY", "NPM_TOKEN"] }] },
        Task: { name: "Task", rules: [{ name: "AllowHosts", args: ["api.stripe.com"] }, { name: "AllowFiles", args: ["src/billing"] }, { name: "AllowSecrets", args: ["STRIPE_KEY"] }] },
      }),
    );
    const agent = { name: "Dev", modelId: "m", params: { sandbox: "docker" }, requires: ["Role", "Task"] };
    expect(sandboxLimits(agent, policies as any)).toEqual({ hosts: ["api.stripe.com"], files: ["src/billing"], secrets: ["STRIPE_KEY"] });
    const named = Object.fromEntries(withSandbox(agent, new Map(), policies as any).tool!.argList.slice(1).map((a) => [a.name, a.value]));
    expect(named).toEqual({
      hosts: { kind: "list", items: [{ kind: "string", value: "api.stripe.com" }] },
      from: { kind: "string", value: "." },
      files: { kind: "list", items: [{ kind: "string", value: "src/billing" }] },
      secrets: { kind: "list", items: [{ kind: "string", value: "STRIPE_KEY" }] },
    });
  });

  test("AllowFiles and AllowSecrets are checked, and need a sandbox that can enforce them", () => {
    const src = `
policy Files : AllowFiles("src/billing")
policy Keys : AllowSecrets("STRIPE_KEY")
policy BadFiles : AllowFiles("../etc", "/abs")
policy BadKeys : AllowSecrets("not-a-name")
tool Lab : Remote("docker")
agent A [m/x, sandbox: "e2b"]
  requires Files
agent B [m/x, sandbox: "daytona"]
  requires Keys
agent C [m/x, sandbox: Lab]
  requires Files, Keys
agent D [m/x, sandbox: "docker"]
  requires Files, Keys
`;
    const errors = validate(parse(src)).filter((x) => x.severity === "error").map((x) => x.message);
    expect(errors).toEqual([
      expect.stringContaining("AllowFiles(../etc) should be a path inside the project"),
      expect.stringContaining("AllowFiles(/abs) should be a path inside the project"),
      expect.stringContaining("AllowSecrets(not-a-name) should be an environment variable name"),
      expect.stringContaining('Agent "B": AllowSecrets is enforced by Docker sandboxes'),
      expect.stringContaining('Agent "C": AllowFiles, AllowSecrets limit a sandbox the agent owns'),
    ]);
  });

  test("files: copies in only those paths; diff and apply leave the rest in the sandbox", async () => {
    const root = join(tmp, "scoped");
    for (const [path, text] of Object.entries({ "src/billing/pay.ts": "pay\n", "src/auth/login.ts": "login\n", "README.md": "readme\n" })) {
      mkdirSync(join(root, "repo", path, ".."), { recursive: true });
      writeFileSync(join(root, "repo", path), text);
    }
    const decl = { 0: "docker", docker, from: "repo", root, files: ["src/billing/"] };
    const call = (method: string, named: Record<string, unknown> = {}) => remote(makeCall(method, named, decl, "files1"), services()) as Promise<any>;
    expect((await call("run", { command: "find . -type f -not -path './.*' | sort" })).stdout).toBe("./src/billing/pay.ts");
    await call("run", { command: "echo paid > src/billing/pay.ts && mkdir -p src/auth lib && echo hacked > src/auth/login.ts && echo out > lib/app.js" });

    const d = await call("diff");
    expect(d.files).toEqual([{ path: "src/billing/pay.ts", status: "modified" }]);
    expect(d.outside).toEqual(["lib/app.js", "src/auth/login.ts"]);
    expect(d.patch).not.toContain("hacked");

    expect(await call("apply")).toEqual({ to: "repo", written: ["repo/src/billing/pay.ts"], deleted: [], outside: ["lib/app.js", "src/auth/login.ts"] });
    expect(readFileSync(join(root, "repo/src/billing/pay.ts"), "utf8")).toBe("paid\n");
    expect(readFileSync(join(root, "repo/src/auth/login.ts"), "utf8")).toBe("login\n");
    expect(existsSync(join(root, "repo/lib"))).toBe(false);

    await expect(call("apply", { to: "elsewhere" })).rejects.toThrow(/can't move changes elsewhere when the sandbox has files:/);
    await expect(call("download", { from: "src/auth/login.ts", to: "repo/src/auth/login.ts" })).rejects.toThrow(/download to repo\/src\/auth\/login.ts is outside the sandbox's files: repo\/src\/billing/);
    await expect(call("upload", { from: "repo/README.md" })).rejects.toThrow(/upload from repo\/README.md is outside/);
    expect((await call("download", { from: "src/billing/pay.ts", to: "repo/src/billing/copy.ts" })).to).toBe("repo/src/billing/copy.ts");

    await expect(remote(makeCall("info", {}, { 0: "docker", docker, files: ["src"] }, "files2"), services())).rejects.toThrow(/files: picks paths from the project that from: copies in/);
    await expect(remote(makeCall("info", {}, { 0: "docker", docker, from: "repo", root, files: ["../x"] }, "files3"), services())).rejects.toThrow(/files: "..\/x" should be a path inside from:/);
  });

  test("secrets: are set by name for each command and masked in what comes back", async () => {
    const value = "sk_test_51abcDEF";
    const decl = { 0: "docker", docker, secrets: ["STRIPE_KEY"] };
    const call = (method: string, named: Record<string, unknown> = {}) => remote(makeCall(method, named, decl, "sec1"), services({ STRIPE_KEY: value })) as Promise<any>;
    const r = await call("run", { command: 'echo "key=$STRIPE_KEY"; echo "$STRIPE_KEY" >&2; echo "$STRIPE_KEY" > k.txt' });
    expect(r.stdout).toBe("key=[secret STRIPE_KEY]");
    expect(r.stderr).toBe("[secret STRIPE_KEY]");
    expect((await call("read", { path: "k.txt" })).content).toBe("[secret STRIPE_KEY]\n");
    // By name only: the value is in no command line, and docker run (which commit would save) never sees it.
    const lines = log().filter((l) => l.includes("STRIPE_KEY") || l.includes(value));
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.every((l) => l.startsWith("exec --env STRIPE_KEY ") && !l.includes(value))).toBe(true);

    await expect(remote(makeCall("info", {}, decl, "sec2"), services())).rejects.toThrow(/secrets: STRIPE_KEY is not set in Halo's environment/);
    await expect(remote(makeCall("info", {}, { ...decl, secrets: ["bad-name"] }, "sec3"), services({ STRIPE_KEY: value }))).rejects.toThrow(/should be the name of an environment variable/);
    await expect(remote(makeCall("info", {}, { 0: "e2b", secrets: ["STRIPE_KEY"] }, "sec4"), services({ STRIPE_KEY: value, E2B_API_KEY: "k" }))).rejects.toThrow(/secrets: is enforced by Docker sandboxes, and this one is e2b/);
  });
});

describe("Red team: what a hostile sandbox can't get out", () => {
  const value = "sk_test_51abcDEF";
  const env = { STRIPE_KEY: value };

  test("mask() ignores case and masks the longest secret first", () => {
    const secrets = new Map([["SHORT", "canary"], ["LONG", "canary-Zq7x9K"]]);
    expect(mask("a canary-Zq7x9K b CANARY c", secrets)).toBe("a [secret LONG] b [secret SHORT] c");
    expect(mask("host canary-zq7x9k.example.com", secrets)).toBe("host [secret LONG].example.com");
    expect(mask("a.b*c", new Map([["X", "a.b*c"]]))).toBe("[secret X]");
    expect(mask("abc", new Map([["X", "abc"]]))).toBe("abc"); // under 4 characters: left alone
  });

  test("file names, hosts and errors are masked, not just output", async () => {
    const decl = { 0: "docker", docker, secrets: ["STRIPE_KEY"] };
    const call = (method: string, named: Record<string, unknown> = {}) => remote(makeCall(method, named, decl, "rt1"), services(env)) as Promise<any>;
    await call("run", { command: 'mkdir -p d && touch "d/$STRIPE_KEY"' });
    expect((await call("list", { path: "d" })).entries).toEqual([{ name: "[secret STRIPE_KEY]", type: "file" }]);
    expect((await call("diff")).files).toEqual([{ path: "d/[secret STRIPE_KEY]", status: "added" }]);
    // stderr that looks like Docker's own error is just a failed command while the container runs.
    const spoof = await call("run", { command: 'echo "Error response from daemon: No such container $STRIPE_KEY" >&2; exit 1' });
    expect(spoof).toMatchObject({ exitCode: 1, stderr: "Error response from daemon: No such container [secret STRIPE_KEY]" });
    // A thrown error is masked too.
    const err: Error = await call("list", { path: "d/$STRIPE_KEY-nope" }).then(() => new Error("no error"), (e: Error) => e);
    expect(err.message).not.toContain(value);
  });

  test("file content holding a secret isn't returned as base64, downloaded or applied", async () => {
    const root = join(tmp, "rt-content");
    mkdirSync(join(root, "repo"), { recursive: true });
    writeFileSync(join(root, "repo/app.txt"), "app\n");
    const decl = { 0: "docker", docker, secrets: ["STRIPE_KEY"], from: "repo", root };
    const call = (method: string, named: Record<string, unknown> = {}) => remote(makeCall(method, named, decl, "rt2"), services(env)) as Promise<any>;
    await call("run", { command: 'printf "%s\\377\\000" "$STRIPE_KEY" > bin.dat; echo "$STRIPE_KEY" > app.txt' });
    await expect(call("read", { path: "bin.dat" })).rejects.toThrow(/bin.dat holds the value of secret STRIPE_KEY/);
    await expect(call("download", { from: "app.txt", to: "repo/copy.txt" })).rejects.toThrow(/holds the value of secret STRIPE_KEY/);
    expect(existsSync(join(root, "repo/copy.txt"))).toBe(false);
    await expect(call("apply")).rejects.toThrow(/holds the value of secret STRIPE_KEY, so it isn't applied/);
    expect(readFileSync(join(root, "repo/app.txt"), "utf8")).toBe("app\n");
  });

  test("credential files stay behind, and a sandbox can't write over them", async () => {
    expect([".env", ".env.local", "config/.env.production", "deploy/key.pem", "id_ed25519", ".npmrc", ".git-credentials"].every(credentialFile)).toBe(true);
    expect([".env.example", "env.ts", "src/keyboard.ts", "README.md", ".envrc.md"].some(credentialFile)).toBe(false);
    const root = join(tmp, "rt-creds");
    mkdirSync(join(root, "repo"), { recursive: true });
    writeFileSync(join(root, "repo/.env"), "OTHER_KEY=canary-dotenv-123\n");
    writeFileSync(join(root, "repo/.env.example"), "OTHER_KEY=\n");
    writeFileSync(join(root, "repo/app.py"), "print(1)\n");
    mkdirSync(join(root, "repo/config"));
    writeFileSync(join(root, "repo/config/.env"), "DB=canary-db\n");
    writeFileSync(join(root, "repo/config/app.toml"), "x = 1\n");
    const call = (method: string, named: Record<string, unknown> = {}) => remote(makeCall(method, named, { 0: "docker", docker, from: "repo", root }, "rt3"), services()) as Promise<any>;
    expect((await call("run", { command: "find . -type f | sort" })).stdout).toBe("./.env.example\n./app.py\n./config/app.toml");
    await call("run", { command: "echo OTHER_KEY=attacker > .env; echo DB=attacker > config/.env; echo 'print(2)' > app.py" });
    expect(await call("apply")).toEqual({ to: "repo", written: ["repo/app.py"], deleted: [], outside: ["config/.env"] });
    expect(readFileSync(join(root, "repo/.env"), "utf8")).toBe("OTHER_KEY=canary-dotenv-123\n");
    expect(readFileSync(join(root, "repo/config/.env"), "utf8")).toBe("DB=canary-db\n");
    // files: can still hand one over by naming it exactly.
    const named = remote(makeCall("run", { command: "ls -A" }, { 0: "docker", docker, from: "repo", root, files: [".env", "app.py"] }, "rt4"), services()) as Promise<any>;
    expect((await named).stdout.split("\n").sort()).toEqual([".env", "app.py"]);
  });

  test("secrets: and hosts: refuse values that aren't names", async () => {
    expect(["PATH", "HOME", "LD_PRELOAD", "DYLD_INSERT_LIBRARIES", "DOCKER_HOST", "HTTPS_PROXY", "no_proxy", "HALO_X"].every((n) => RESERVED_SECRET.test(n))).toBe(true);
    expect(RESERVED_SECRET.test("STRIPE_KEY")).toBe(false);
    for (const h of ["127.0.0.1", "0", "169.254.169.254", "localhost", "*.localhost", "a.localhost", "[::1]", "2130706433"]) expect(HOST_PATTERN.test(h)).toBe(false);
    for (const h of ["pypi.org", "*.pythonhosted.org", "registry.npmjs.org", "PyPI.org", "x1.example.io"]) expect(HOST_PATTERN.test(h)).toBe(true);

    // The value itself (secrets: [Env.KEY]) is never echoed back.
    const err: Error = await remote(makeCall("info", {}, { 0: "docker", docker, secrets: [value] }, "rt5"), services(env)).then(() => new Error("none"), (e: Error) => e);
    expect(err.message).toContain("is the value of an environment variable, not its name");
    expect(err.message).not.toContain(value);
    await expect(remote(makeCall("info", {}, { 0: "docker", docker, secrets: ["PATH"] }, "rt6"), services({ PATH: "/bin" }))).rejects.toThrow(/PATH can't be a secret/);
    await expect(remote(makeCall("info", {}, { 0: "docker", docker, network: "false" }, "rt7"), services())).rejects.toThrow(/network: is true or false, not "false"/);

    const errors = validate(parse(`
tool A : Remote("docker", secrets: [Env.STRIPE_KEY])
tool B : Remote("docker", secrets: ["LD_PRELOAD"])
policy P : AllowSecrets("DOCKER_HOST")
policy H : AllowHosts("169.254.169.254")
`)).filter((x) => x.severity === "error").map((x) => x.message);
    expect(errors).toEqual([
      expect.stringContaining('Tool "A": secrets: lists names in quotes'),
      expect.stringContaining('Tool "B": secrets: LD_PRELOAD can\'t be a secret'),
      expect.stringContaining('AllowSecrets(DOCKER_HOST): DOCKER_HOST can\'t be a secret'),
      expect.stringContaining("AllowHosts(169.254.169.254) is not a host name"),
    ]);
  });

  test("sandboxes get their own network, no raw sockets, and a proxy that runs locked down", async () => {
    await remote(makeCall("run", { command: "true" }, { 0: "docker", docker }, "rt8"), services());
    expect(log()).toContainEqual(expect.stringMatching(/^network create .*enable_icc=false halo-sandboxes$/));
    const run = log().find((l) => l.startsWith("run ") && l.includes("halo.run=rt8"))!;
    expect(run).toContain("--network halo-sandboxes");
    expect(run).toContain("--cap-drop NET_RAW");
    await closeRemoteSessions();
    await remote(makeCall("run", { command: "true" }, { 0: "docker", docker, hosts: ["pypi.org"] }, "rt9"), services());
    expect(log()).toContainEqual(expect.stringMatching(/^network create --internal .*gateway_mode_ipv4=isolated/));
    const proxy = log().find((l) => l.startsWith("run ") && l.includes(" bun ") && l.includes("halo.run=rt9"))!;
    for (const part of ["--cap-drop ALL", "--read-only", "--user 65534:65534"]) expect(proxy).toContain(part);
  });

  test("the proxy refuses private addresses and checks the TLS server name", async () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.18.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "224.0.0.1"]) expect(privateAddress(ip)).toBe(true);
    for (const ip of ["151.101.0.223", "104.16.0.1", "2a04:4e42::223", "172.32.0.1"]) expect(privateAddress(ip)).toBe(false);

    // A real ClientHello, as a TLS client sends it.
    const net = await import("node:net");
    const tls = await import("node:tls");
    const hello = await new Promise<Buffer>((resolve) => {
      const server = net.createServer((sock) => sock.once("data", (d: Buffer) => (resolve(d), sock.destroy(), server.close())));
      server.listen(0, "127.0.0.1", () => {
        const c = tls.connect({ host: "127.0.0.1", port: (server.address() as any).port, servername: "pypi.org" });
        c.on("error", () => {});
      });
    });
    expect(tlsServerName(hello)).toBe("pypi.org");
    expect(tlsServerName(hello.subarray(0, 40))).toBeUndefined(); // needs more bytes
    expect(tlsServerName(Buffer.from("GET / HTTP/1.1\r\n"))).toBeNull();
  });
});

describe("Effects in the trace", () => {
  test("a stage's tool calls are hashed into its trace entry, and the chain still verifies", async () => {
    const rt = runtime(`
tool Lab : Remote("docker", docker: "$DOCKER")
pipeline Go() -> Result:
  "x"
    |> Lab.run(command: "echo hi") as a
    |> System.Value("plain")
`);
    const r = await rt.run("Go");
    const [first, second, third] = r.context.trace;
    expect(first!.effectsHash).toBeUndefined();
    expect(second!.effectsHash).toMatch(/^[0-9a-f]{64}$/);
    expect(third!.effectsHash).toBeUndefined();
    expect(verifyTrace(r.context.trace)).toBe(true);
    // Changing what a call did breaks the chain.
    const forged = r.context.trace.map((t) => ({ ...t }));
    forged[1]!.effectsHash = "0".repeat(64);
    expect(verifyTrace(forged)).toBe(false);
  });
});
