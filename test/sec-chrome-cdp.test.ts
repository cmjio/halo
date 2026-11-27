/**
 * The Chrome tool's DevTools connection is a pipe, not a TCP port. With --remote-debugging-port, any
 * other process on the machine could read <profile>/DevToolsActivePort, connect to 127.0.0.1:<port>
 * and run Runtime.evaluate in the page (reading what Web.fill or the wallet typed). Here a run holds
 * a page with a typed value open, and the browser it launched must have no port file, no listening
 * TCP socket, and launch arguments without --remote-debugging-port. The run still works.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "../src/parser/index";
import { closeChromeSessions, findChrome } from "../src/runtime/providers/chrome";
import { HaloRuntime, type RuntimeEvent } from "../src/runtime/runtime";

const chrome = findChrome();
const SECRET = "4111111111111111";

const PAGE = `<!doctype html><title>Pay</title>
<input id="card" type="text">
<p id="echo">empty</p>
<script>const el = document.getElementById("card"); el.addEventListener("input", () => { document.getElementById("echo").textContent = "typed " + el.value.length; });</script>`;

let server: ReturnType<typeof Bun.serve>;
beforeAll(() => {
  if (!chrome) return;
  server = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: () => new Response(PAGE, { headers: { "Content-Type": "text/html" } }) });
});
afterAll(async () => {
  await closeChromeSessions();
  server?.stop(true);
});

const sh = async (cmd: string[]) => {
  const p = Bun.spawn(cmd, { stdout: "pipe", stderr: "ignore" });
  const out = await new Response(p.stdout).text();
  await p.exited;
  return out;
};

/** Every process in this test process's tree below it (Chrome and its helpers). */
async function descendants(): Promise<number[]> {
  const rows = (await sh(["ps", "-A", "-o", "pid=,ppid="]))
    .trim()
    .split("\n")
    .map((l) => l.trim().split(/\s+/).map(Number) as [number, number]);
  const found: number[] = [];
  const queue = [process.pid];
  while (queue.length) {
    const parent = queue.shift()!;
    for (const [pid, ppid] of rows) if (ppid === parent && !found.includes(pid)) found.push(pid), queue.push(pid);
  }
  return found;
}

describe.skipIf(!chrome)("Chrome's DevTools connection", () => {
  test("a run with a typed value open exposes no debugging port, and still reads and fills the page", async () => {
    const before = new Set(readdirSync(tmpdir()).filter((n) => n.startsWith("halo-chrome-")));
    const events: RuntimeEvent[] = [];
    const rt = new HaloRuntime({ logger: { log() {}, warn() {} }, onEvent: (e) => events.push(e) }).load(
      parse(`tool Web : Chrome(allow: ["127.0.0.1"])
pipeline Fill(url: String) -> Result:
  url |> Web.open(url: url)
    |> Web.fill(selector: "#card", value: "${SECRET}")
    |> System.Sleep(4s)
    |> Web.text(selector: "#echo")`),
    );
    const running = rt.run("Fill", { url: `http://127.0.0.1:${server.port}/` });

    // Wait until the value is typed and the run is sleeping with the page open.
    const deadline = Date.now() + 60_000;
    while (!events.some((e) => e.type === "stage" && e.status === "start" && e.label.includes("Sleep")) && Date.now() < deadline) await Bun.sleep(50);
    expect(events.some((e) => e.type === "stage" && e.status === "start" && e.label.includes("Sleep"))).toBe(true);

    // The profile this run's browser uses has no DevToolsActivePort file.
    const profiles = readdirSync(tmpdir()).filter((n) => n.startsWith("halo-chrome-") && !before.has(n));
    expect(profiles.length).toBeGreaterThan(0);
    for (const p of profiles) expect(existsSync(join(tmpdir(), p, "DevToolsActivePort"))).toBe(false);

    // The browser's processes: launched with a pipe, and none of them listens on TCP.
    const pids = await descendants();
    const args = await Promise.all(pids.map((pid) => sh(["ps", "-o", "args=", "-p", String(pid)])));
    const browser = args.filter((a) => profiles.some((p) => a.includes(p)));
    expect(browser.length).toBeGreaterThan(0);
    const main = browser.find((a) => !a.includes("--type="))!;
    expect(main).toContain("--remote-debugging-pipe");
    for (const a of browser) expect(a).not.toContain("--remote-debugging-port");
    const listening = await sh(["lsof", "-nP", "-a", "-p", pids.join(","), "-iTCP", "-sTCP:LISTEN"]);
    expect(listening.trim()).toBe("");

    // And the run still filled the field and read the page.
    const done = await running;
    expect(done.status).toBe("completed");
    expect(done.output).toBe(`typed ${SECRET.length}`);
  }, 90_000);
});
