// A repo can't grant itself trust: opening it in an editor, or running halo test in it, must
// not run a package's code that nobody on this machine agreed to run.

import { test, expect, describe, afterAll } from "bun:test";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { readLockV2 } from "../src/registry/lockfile";
import { loadPackageInfo, loadPackageProviders } from "../src/registry/resolver";
import { readTrust, trustFile, writeTrust } from "../src/registry/trust";

const repo = resolve(import.meta.dir, "..");
const tmp = mkdtempSync(join(tmpdir(), "halo-sec-trust-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const marker = join(tmp, "MARKER");

async function cli(cwd: string, args: string[]) {
  const p = Bun.spawn(["bun", join(repo, "index.ts"), ...args], { cwd, env: { ...Bun.env, NO_COLOR: "1", HALO_REGISTRY: "" }, stdout: "pipe", stderr: "pipe" });
  const [out, err, code] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text(), p.exited]);
  return { code, out, err };
}

/** The attacker's project: a package that writes a marker when its module is imported, installed with --trust. */
async function attackerProject(): Promise<string> {
  const pkg = join(tmp, "pkg");
  mkdirSync(pkg, { recursive: true });
  writeFileSync(join(pkg, "halo.json"), JSON.stringify({ name: "@acme/clock", version: "1.0.0", description: "clock", license: "MIT", providers: { Clock2: { kind: "module", description: "The time", entry: "index.ts" } } }));
  writeFileSync(join(pkg, "README.md"), "# clock\n");
  writeFileSync(join(pkg, "index.ts"), `import { appendFileSync } from "node:fs";\nappendFileSync(${JSON.stringify(marker)}, "ran\\n");\nexport async function provider() { return "tick"; }\nexport const info = { description: "time", methods: [] };\n`);
  const app = join(tmp, "attacker");
  mkdirSync(app, { recursive: true });
  writeFileSync(join(app, "halo.json"), JSON.stringify({ files: ["main.halo"] }));
  writeFileSync(join(app, "main.halo"), "agent A [anthropic/claude-haiku-4-5]\n\npipeline P(name: String) -> Result:\n  name |> A.hi()\n");
  const added = await cli(app, ["add", "../pkg", "--trust"]);
  expect(added.code).toBe(0);
  return app;
}

describe("package trust", () => {
  test("trust is kept in the user's trust file, keyed by the project, not in the project", async () => {
    const app = await attackerProject();
    expect(trustFile()).toBe(process.env.HALO_TRUST_FILE!);
    expect(existsSync(join(app, ".halo/trust.json"))).toBe(false);
    const sha = readLockV2(app).packages["@acme/clock"]!.sha256;
    expect(readTrust(app)).toEqual({ "@acme/clock": sha });
    expect(Object.keys(JSON.parse(readFileSync(trustFile(), "utf8")))).toContain(realpathSync(app));

    // The attacker's own machine runs it, as it agreed to.
    rmSync(marker, { force: true });
    await loadPackageProviders(app);
    expect(existsSync(marker)).toBe(true);
  });

  test("a cloned repo that ships a trust file runs nothing: not the editor, not halo test", async () => {
    const app = join(tmp, "attacker");
    const sha = readLockV2(app).packages["@acme/clock"]!.sha256;
    const victim = join(tmp, "victim");
    cpSync(app, victim, { recursive: true });
    // What a malicious repo commits: the old in-project trust file, naming the right checksum.
    writeFileSync(join(victim, ".halo/trust.json"), JSON.stringify({ "@acme/clock": sha }));
    rmSync(marker, { force: true });

    // The language server's view: the declared description, without importing the module.
    expect(loadPackageInfo(victim)).toEqual([
      { name: "@acme/clock#Clock2", info: { description: "The time" } },
      { name: "Clock2", info: { description: "The time" } },
    ]);
    expect(existsSync(marker)).toBe(false);

    await expect(loadPackageProviders(victim)).rejects.toThrow(/hasn't trusted this version.*no longer counts/);
    const ran = await cli(victim, ["test", "main.halo", "--arg", "name=x"]);
    expect(ran.code).not.toBe(0);
    expect(ran.err).toContain("hasn't trusted this version");
    expect(existsSync(marker)).toBe(false);

    // Trusting it here is still possible, explicitly.
    writeTrust(victim, { "@acme/clock": sha });
    await loadPackageProviders(victim);
    expect(existsSync(marker)).toBe(true);
  });

  test("opening the file through halo lsp runs no package code", async () => {
    const victim = join(tmp, "victim2");
    cpSync(join(tmp, "attacker"), victim, { recursive: true });
    const sha = readLockV2(victim).packages["@acme/clock"]!.sha256;
    writeFileSync(join(victim, ".halo/trust.json"), JSON.stringify({ "@acme/clock": sha }));
    rmSync(marker, { force: true });
    const file = join(victim, "main.halo");
    const proc = Bun.spawn(["bun", join(repo, "index.ts"), "lsp", "--stdio"], { cwd: victim, stdin: "pipe", stdout: "pipe", stderr: "pipe" });
    const send = (m: unknown) => {
      const s = JSON.stringify(m);
      proc.stdin.write(`Content-Length: ${Buffer.byteLength(s)}\r\n\r\n${s}`);
      proc.stdin.flush();
    };
    send({ jsonrpc: "2.0", id: 1, method: "initialize", params: { processId: null, rootUri: `file://${victim}`, capabilities: {} } });
    send({ jsonrpc: "2.0", method: "initialized", params: {} });
    send({ jsonrpc: "2.0", method: "textDocument/didOpen", params: { textDocument: { uri: `file://${file}`, languageId: "halo", version: 1, text: readFileSync(file, "utf8") } } });
    send({ jsonrpc: "2.0", id: 2, method: "textDocument/hover", params: { textDocument: { uri: `file://${file}` }, position: { line: 3, character: 10 } } });
    await Bun.sleep(2500);
    proc.kill();
    expect(existsSync(marker)).toBe(false);
  }, 20_000);
});
