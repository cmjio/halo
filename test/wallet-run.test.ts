/**
 * The wallet end to end through the runtime: a pipeline that pauses for approval and picks up
 * again, an agent whose policy approval is folded into the wallet's question, and a check that no
 * recording, telemetry event, paused snapshot or audit-log line ever holds a value.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "../src/parser/index";
import { closeChromeSessions, findChrome } from "../src/runtime/providers/chrome";
import { HaloRuntime, useTool, type InterruptRequest, type RecordedCall, type RuntimeEvent } from "../src/runtime/runtime";

const chrome = findChrome();
const CARD = "4242424242424242";
const leaks = (x: unknown) => /4242\D{0,3}4242/.test(JSON.stringify(x));

const PAY = `<!doctype html><title>Card</title><input id="cc" autocomplete="cc-number">
<script>const el = document.getElementById("cc"); el.addEventListener("input", () => el.setAttribute("value", el.value)); el.addEventListener("change", () => fetch("/typed?v=" + encodeURIComponent(el.value)));</script>`;

let payServer: ReturnType<typeof Bun.serve>;
let shopServer: ReturnType<typeof Bun.serve>;
let SHOP = "";
const typed: string[] = [];
const dir = mkdtempSync(join(tmpdir(), "halo-wallet-run-"));

beforeAll(() => {
  if (!chrome) return;
  payServer = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch(req) {
      const url = new URL(req.url);
      if (url.pathname === "/typed") return typed.push(url.searchParams.get("v") ?? ""), new Response("ok");
      return new Response(PAY, { headers: { "Content-Type": "text/html" } });
    },
  });
  shopServer = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch: (req) =>
      new URL(req.url).pathname === "/steal"
        ? new Response(`<input id="victim" autocomplete="cc-number"><input id="other"><script>document.getElementById("victim").addEventListener("input", () => document.getElementById("other").focus(), { once: true });</script>`, { headers: { "Content-Type": "text/html" } })
        : new Response(`<title>Checkout</title><p id="status">Ready</p><iframe id="payframe" src="http://localhost:${payServer.port}/pay"></iframe>`, { headers: { "Content-Type": "text/html" } }),
  });
  SHOP = `http://127.0.0.1:${shopServer.port}/`;
});

afterAll(async () => {
  await closeChromeSessions();
  payServer?.stop(true);
  shopServer?.stop(true);
  rmSync(dir, { recursive: true, force: true });
});

const DECLS = `tool Card : Vault(source: "mock", kind: "card", fields: ["number", "expiry", "cvc"], hosts: ["127.0.0.1"], pay_via: ["localhost"])
tool Web : Chrome(headless: false, allow: ["127.0.0.1"], wallet: [Card])`;

describe.skipIf(!chrome)("the wallet through the runtime", () => {
  test("a pipeline pauses for the person, and the same request picks up when they answer", async () => {
    const recorded: RecordedCall[] = [];
    const events: RuntimeEvent[] = [];
    const log = join(dir, "wallet.log");
    const rt = new HaloRuntime({ logger: { log() {}, warn() {} }, recorder: (e) => recorded.push(e), onEvent: (e) => events.push(e), walletLog: log }).load(
      parse(`${DECLS}
pipeline Pay(url: String) -> Result:
  url |> Web.open(url: url)
    |> Web.fill_secret(selector: "#cc", ref: "Card.number", frame: "#payframe")
    |> Web.hand_over(reason: "check the order and press Pay")`),
    );
    const paused = await rt.run("Pay", { url: SHOP });
    expect(paused.status).toBe("paused");
    const meta = paused.context.meta;
    expect(meta.paused).toMatchObject({ stage: 2, waitingFor: "approval" });
    expect(meta.paused!.key).toMatch(/^wallet:[0-9a-f]{32}$/);
    expect(meta.paused!.message).toStartWith("The pipeline wants to type Card (Visa ending 4242): number");
    expect(typed).toEqual([]);

    // Approving the fill types the card; the run then pauses again, for the person to finish.
    const handed = await rt.signal(paused.runId, "approval", "approve");
    expect(handed.status).toBe("paused");
    expect(handed.context.meta.paused).toMatchObject({ stage: 3, waitingFor: "approval" });
    expect(handed.context.meta.paused!.message).toStartWith("The pipeline typed Card on 127.0.0.1 and hands the browser to you: check the order and press Pay");
    await Bun.sleep(300);
    expect(typed).toEqual([CARD]);
    const done = await rt.signal(handed.runId, "approval", "done");
    expect(done.status).toBe("completed");
    expect(done.output).toEqual({ handedOver: true, closed: true });

    // Nothing kept anywhere holds the value: the paused snapshot, the recording, telemetry, the audit log.
    expect(leaks(paused.context)).toBe(false);
    expect(leaks(done.context)).toBe(false);
    expect(leaks(recorded)).toBe(false);
    expect(leaks(events)).toBe(false);
    const lines = readFileSync(log, "utf8").trim().split("\n").map((l) => JSON.parse(l));
    expect(lines.map((l) => [l.outcome, l.refs, l.chain.map((c: { host: string }) => c.host)])).toEqual([
      ["typed", ["Card.number"], ["127.0.0.1", "localhost"]],
      ["handed_over", ["Card.number"], ["127.0.0.1"]],
    ]);
    expect(leaks(lines)).toBe(false);
    expect(events.filter((e) => e.type === "wallet").map((e) => (e as { outcome: string }).outcome)).toEqual(["typed", "handed_over"]);
    expect(leaks(handed.context)).toBe(false);
  }, 90_000);

  test("an agent: AllowWallet decides what it may type, and its policy's approval is asked once, with the wallet's question", async () => {
    const asked: InterruptRequest[] = [];
    const rt = new HaloRuntime({ logger: { log() {}, warn() {} }, onInterrupt: (req) => (asked.push(req), "approve") }).load(
      parse(`${DECLS}
policy Booking : AllowWallet("Card.number") & ApproveTools("Web.fill_secrets")
agent Booker [anthropic/claude-sonnet-4-5]
  equips Web
  requires Booking
pipeline Book(url: String) -> Result:
  url |> Web.open(url: url)
    |> Booker.pay(tools: [Web])`),
    );
    let step = 0;
    const seen: string[] = [];
    rt.mockAll({ "Booker.pay": (req: { step?: number; messages?: Array<{ content: unknown }> }) => {
      step++;
      if (step > 1) seen.push(String(req.messages?.at(-1)?.content ?? ""));
      if (step === 1) return useTool("Web.fill_secrets", { frame: "#payframe", fields: { "#cc": "Card.cvc" } });
      if (step === 2) return useTool("Web.fill_secrets", { frame: "#payframe", fields: { "#cc": "Card.number" } });
      return "Paid.";
    } });
    const r = await rt.run("Book", { url: SHOP });
    expect(r.status).toBe("completed");
    expect(seen[0]).toBe("Error: Web.fill_secrets: Booker may not use Card.cvc: its AllowWallet rules don't cover it");
    expect(seen[1]).toContain('"filled":{"#cc":"Card.number"}');
    expect(asked).toHaveLength(1);
    expect(asked[0]!.message).toStartWith("Booker wants to type Card (Visa ending 4242): number (policy Booking)");
    expect(asked[0]!.named).toMatchObject({ wallet: { mock: true }, refs: ["Card.number"], policy: "Booking", agent: "Booker" });
    await Bun.sleep(300);
    expect(typed.at(-1)).toBe(CARD);
    expect(leaks(r.context)).toBe(false);
  }, 90_000);

  test("a page stealing focus while the agent types stops the run, not just the call", async () => {
    const rt = new HaloRuntime({ logger: { log() {}, warn() {} }, onInterrupt: () => "approve" }).load(
      parse(`${DECLS}
policy Booking : AllowWallet("Card")
agent Booker [anthropic/claude-sonnet-4-5]
  equips Web
  requires Booking
pipeline Book(url: String) -> Result:
  url |> Web.open(url: url)
    |> Booker.pay(tools: [Web])`),
    );
    let step = 0;
    rt.mockAll({ "Booker.pay": () => (++step === 1 ? useTool("Web.fill_secrets", { fields: { "#victim": "Card.number" } }) : "Carried on.") });
    const err = await rt.run("Book", { url: `${SHOP}steal` }).then(() => undefined, (e: unknown) => e as { code?: string; message?: string });
    expect(err?.code).toBe("WALLET_INCIDENT");
    expect(step).toBe(1);
  }, 90_000);

  test("a mock for approvals doesn't answer for a real wallet", async () => {
    const rt = new HaloRuntime({ logger: { log() {}, warn() {} }, env: {} }).load(
      parse(`tool Card : Vault(source: "env", kind: "card", fields: ["number"], hosts: ["127.0.0.1"], pay_via: ["localhost"])
tool Web : Chrome(headless: false, allow: ["127.0.0.1"], wallet: [Card])
pipeline Pay(url: String) -> Result:
  url |> Web.open(url: url)
    |> Web.fill_secret(selector: "#cc", ref: "Card.number", frame: "#payframe")`),
    );
    rt.mockAll({ approval: () => "approve" });
    const r = await rt.run("Pay", { url: SHOP });
    // The mock was passed over: the run waits for a person instead.
    expect(r.status).toBe("paused");
    expect(r.context.meta.paused!.key).toMatch(/^wallet:/);
  }, 90_000);
});
