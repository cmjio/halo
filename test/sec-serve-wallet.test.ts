/**
 * A wallet can't share a program with a tool that runs commands as you, and `halo serve` runs every
 * file it serves in one process: so a wallet in one file and Bash in another can't be served together.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startServer, ServeError, type ServeOptions } from "../src/serve/server";

const tmp = mkdtempSync(join(tmpdir(), "halo-sec-serve-wallet-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));
const quiet = { log() {}, warn() {}, error() {} };

const WALLET = `tool Card : Vault(source: "mock", kind: "card", fields: ["number", "expiry", "cvc"], hosts: ["shop.example.com"], serve: true)
tool Web : Chrome(headless: false, allow: ["shop.example.com"], wallet: [Card])

pipeline Pay(url: String) -> Result:
  url |> Web.open(url: url)
`;
const SHELL = `tool Sh : Bash()

pipeline Run(cmd: String) -> Result:
  cmd |> Sh.run(command: cmd)
`;
const PLAIN = `pipeline Hello(name: String) -> Result:
  name |> System.Print()
`;

async function serveFiles(files: Record<string, string>, extra: Partial<ServeOptions> = {}) {
  const dir = mkdtempSync(join(tmp, "app-"));
  for (const [name, src] of Object.entries(files)) await Bun.write(join(dir, name), src);
  return startServer({ files: Object.keys(files).map((n) => join(dir, n)), port: 0, stateDir: join(dir, ".halo"), scheduler: false, logger: quiet, env: {}, ...extra });
}

describe("halo serve with a wallet", () => {
  test("refuses to serve a wallet file alongside a file with a wallet-unsafe tool, naming both", async () => {
    let err: unknown;
    try {
      const s = await serveFiles({ "pay.halo": WALLET, "shell.halo": SHELL });
      await s.stop();
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(ServeError);
    const msg = (err as Error).message;
    expect(msg).toContain("pay.halo");
    expect(msg).toContain("shell.halo");
    expect(msg).toContain(`"Sh"`);
    expect(msg).toContain("separate processes");
    expect(msg).toContain("stateDir");
  });

  test("the order of the files doesn't matter", async () => {
    await expect(serveFiles({ "a-shell.halo": SHELL, "z-pay.halo": WALLET })).rejects.toThrow(/z-pay\.halo has a wallet.*a-shell\.halo has tool "Sh"/);
  });

  test("each on its own, or a wallet beside a harmless file, serves", async () => {
    for (const files of <Record<string, string>[]>[{ "pay.halo": WALLET }, { "shell.halo": SHELL }, { "pay.halo": WALLET, "hello.halo": PLAIN }]) {
      const s = await serveFiles(files);
      await s.stop();
    }
  });
});
