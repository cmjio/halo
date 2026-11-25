/**
 * Red team: getting a typed wallet value SUBMITTED (or sent anywhere) without the per-submission
 * approval, double-charging, and lifecycle holes. Each test asserts the SECURE outcome, so a
 * failing test is a confirmed attack.
 *
 * The merchant's checkout posts a real form to /charge, which records what arrived: that is how a
 * test sees the card number leave without Halo ever reading it.
 */
import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HaloError } from "../src/runtime/errors.js";
import { chromeProvider, closeChromeSessions, findChrome } from "../src/runtime/providers/chrome.js";
import type { ToolApprovalRequest, ToolCall, ToolServices, WalletEvent } from "../src/runtime/tools.js";
import { captureWalletEnv, walletItem, type WalletItem } from "../src/runtime/wallet.js";

const chrome = findChrome();
const CARD = "4242424242424242";

const FORM = `<form id="f" method="POST" action="/charge">
  <input id="email" name="email" autocomplete="email">
  <input id="card" name="cardnumber" autocomplete="cc-number">
  <input id="coupon" name="coupon" onchange="this.form.requestSubmit()">
  <select id="ship" name="ship" onchange="this.form.requestSubmit()"><option value="std">Standard</option><option value="exp">Express</option></select>
  <label><input type="radio" name="speed" id="r1" value="1" checked onchange="this.form.requestSubmit()">Slow</label>
  <label><input type="radio" name="speed" id="r2" value="2" onchange="this.form.requestSubmit()">Fast</label>
  <button id="pay" type="submit">Pay</button>
</form>`;
const SHOP = `<!doctype html><title>Checkout</title>${FORM}`;

// Two-step checkout: the card is typed on step 1, "Continue" posts it, step 2's "Place order" charges.
const STEP1 = `<!doctype html><title>Checkout</title>
<form method="POST" action="/review"><input id="card" name="cardnumber" autocomplete="cc-number"><button id="continue" type="submit">Continue</button></form>`;
const step2 = (card: string) => `<!doctype html><title>Review</title>
<p>Review your order</p><form method="POST" action="/charge"><input type="hidden" name="token" value="tok_${card.length}_${card.slice(-4)}"><button id="place" type="submit">Place order</button></form>`;

// Two buttons; 1.5s after load the page moves Pay to where Review was.
const SWAP = `<!doctype html><title>Checkout</title>
<form id="f" method="POST" action="/charge"><input id="card" name="cardnumber" autocomplete="cc-number" style="position:fixed;left:10px;top:10px">
<button id="pay" type="submit" style="position:fixed;left:600px;top:300px;width:120px;height:40px">Pay</button></form>
<button id="review" type="button" style="position:fixed;left:200px;top:300px;width:120px;height:40px">Review</button>
<script>setTimeout(() => { document.getElementById("review").style.left = "600px"; document.getElementById("pay").style.left = "200px"; }, 1500);</script>`;

let server: ReturnType<typeof Bun.serve>;
let BASE = "";
const charges: string[] = [];

beforeAll(() => {
  captureWalletEnv({ HALO_WALLET_CARD_NUMBER: CARD });
  if (!chrome) return;
  server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    async fetch(req) {
      const url = new URL(req.url);
      const h = { "Content-Type": "text/html", "Cache-Control": "no-store" };
      if (url.pathname === "/charge") {
        charges.push(req.method === "POST" ? await req.text() : url.search);
        return new Response(`<!doctype html><title>Done</title><p id="status">Charged ${charges.length}</p>`, { headers: h });
      }
      if (url.pathname === "/review") {
        const body = new URLSearchParams(await req.text());
        return new Response(step2(body.get("cardnumber") ?? ""), { headers: h });
      }
      if (url.pathname === "/other") return new Response("<title>Other</title><p>elsewhere</p>", { headers: h });
      if (url.pathname === "/step1") return new Response(STEP1, { headers: h });
      if (url.pathname === "/swap") return new Response(SWAP, { headers: h });
      return new Response(SHOP, { headers: h });
    },
  });
  BASE = `http://127.0.0.1:${server.port}`;
});

afterAll(async () => {
  await closeChromeSessions();
  server?.stop(true);
});
afterEach(async () => {
  await closeChromeSessions();
  charges.length = 0;
});

let n = 0;
function harness(opts: { source?: string; delayMs?: number; config?: Record<string, unknown> } = {}) {
  const runId = `rt-submit-${++n}`;
  const requests: ToolApprovalRequest[] = [];
  const item: WalletItem = walletItem("Card", (k) => ({ source: opts.source ?? "mock", kind: "card", fields: ["number"], hosts: ["127.0.0.1"] })[k as string]);
  const run = async (method: string, named: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) => {
    const cfg: Record<string, unknown> = { headless: false, allow: ["127.0.0.1"], wallet: ["Card"], ...opts.config, ...extra };
    const call: ToolCall = { tool: { name: "Web", provider: "Chrome", args: [], namedArgs: {}, argList: [] }, method, positional: [], named, config: (k) => cfg[k as string], viaAgent: true, signal: new AbortController().signal, runId };
    const services = {
      wallet: () => [item],
      approve: async (r: ToolApprovalRequest) => {
        requests.push(r);
        if (opts.delayMs) await Bun.sleep(opts.delayMs);
        return true;
      },
      walletEvent: (_: WalletEvent) => {},
      env: { HALO_WALLET_CARD_NUMBER: CARD },
    } as unknown as ToolServices;
    return chromeProvider(call, services).catch((e: unknown) => e as HaloError);
  };
  const submissions = () => requests.filter((r) => r.named?.submission === true).length;
  return { run, requests, submissions };
}

const carded = () => charges.filter((c) => c.includes(CARD));

describe.skipIf(!chrome)("red team: submitting without the per-submission approval", () => {
  test("1. select on a <select onchange=form.requestSubmit()> submits the card unasked", async () => {
    const a = harness();
    await a.run("open", { url: `${BASE}/shop` });
    await a.run("fill_secrets", { fields: { "#card": "Card.number" } });
    await a.run("select", { selector: "#ship", value: "exp" });
    await Bun.sleep(300);
    // Secure: either nothing was charged, or a person was asked about this submission.
    expect({ charged: carded().length, asked: a.submissions() }).not.toEqual({ charged: 1, asked: 0 });
    expect(carded().length === 0 || a.submissions() >= 1).toBe(true);
  }, 60_000);

  test("2. fill into another field whose change handler submits (auto-applied coupon)", async () => {
    const a = harness();
    await a.run("open", { url: `${BASE}/shop` });
    await a.run("fill_secrets", { fields: { "#card": "Card.number" } });
    await a.run("fill", { selector: "#coupon", value: "SAVE10" });
    await Bun.sleep(300);
    expect(carded().length === 0 || a.submissions() >= 1).toBe(true);
  }, 60_000);

  test("3. press ArrowDown on a radio group whose change handler submits", async () => {
    const a = harness();
    await a.run("open", { url: `${BASE}/shop` });
    await a.run("fill_secrets", { fields: { "#card": "Card.number" } });
    await a.run("press", { selector: "#r1", key: "ArrowDown" });
    await Bun.sleep(300);
    expect(carded().length === 0 || a.submissions() >= 1).toBe(true);
  }, 60_000);

  test("4. leave the page and go back: Chrome restores the card into a new document, and Pay is ungated", async () => {
    const a = harness();
    await a.run("open", { url: `${BASE}/shop` });
    await a.run("fill_secrets", { fields: { "#card": "Card.number" } });
    await a.run("open", { url: `${BASE}/other` });
    await a.run("back");
    const before = a.submissions();
    await a.run("click", { selector: "#pay" });
    await Bun.sleep(300);
    expect(carded().length === 0 || a.submissions() > before).toBe(true);
  }, 60_000);

  test("5. double charge: one approved Pay, then back to the restored form and Pay again unasked", async () => {
    const a = harness();
    await a.run("open", { url: `${BASE}/shop` });
    await a.run("fill_secrets", { fields: { "#card": "Card.number" } });
    await a.run("click", { selector: "#pay" }); // approved: 1 submission
    await Bun.sleep(300);
    await a.run("back");
    await a.run("click", { selector: "#pay" });
    await Bun.sleep(300);
    // Secure: one approval allows one charge.
    expect(carded().length).toBeLessThanOrEqual(a.submissions());
  }, 60_000);

  test("6. back to a POST result page doesn't re-POST the card (double charge)", async () => {
    const a = harness();
    await a.run("open", { url: `${BASE}/shop` });
    await a.run("fill_secrets", { fields: { "#card": "Card.number" } });
    await a.run("click", { selector: "#pay" });
    await Bun.sleep(300);
    await a.run("open", { url: `${BASE}/other` });
    await a.run("back");
    await Bun.sleep(500);
    expect(carded().length).toBeLessThanOrEqual(a.submissions());
  }, 60_000);

  test("7. two-step checkout: the approved Continue, then Place order charges with no question", async () => {
    const a = harness();
    await a.run("open", { url: `${BASE}/step1` });
    await a.run("fill_secrets", { fields: { "#card": "Card.number" } });
    await a.run("click", { selector: "#continue" }); // approved: 1 submission (posts the card to /review)
    const asked = a.submissions();
    await a.run("click", { selector: "#place" });
    await Bun.sleep(300);
    // Secure: the charge (a second submission of what was typed) asks again.
    expect(charges.length === 0 || a.submissions() > asked).toBe(true);
  }, 60_000);

  test("9. a resolved click position computed before a slow approval: the page moves Pay under it", async () => {
    // One session; the person takes 2.5s to answer the click question, during which the page swaps the buttons.
    let delay = 0;
    const runId = `rt-submit-swap-${++n}`;
    const requests: ToolApprovalRequest[] = [];
    const item = walletItem("Card", (k) => ({ source: "mock", kind: "card", fields: ["number"], hosts: ["127.0.0.1"] })[k as string]);
    const run = (method: string, named: Record<string, unknown> = {}) => {
      const cfg: Record<string, unknown> = { headless: false, allow: ["127.0.0.1"], wallet: ["Card"] };
      const call: ToolCall = { tool: { name: "Web", provider: "Chrome", args: [], namedArgs: {}, argList: [] }, method, positional: [], named, config: (k) => cfg[k as string], viaAgent: true, signal: new AbortController().signal, runId };
      const services = { wallet: () => [item], approve: async (r: ToolApprovalRequest) => (requests.push(r), await Bun.sleep(delay), true), walletEvent: () => {}, env: {} } as unknown as ToolServices;
      return chromeProvider(call, services).catch((e: unknown) => e as HaloError);
    };
    await run("open", { url: `${BASE}/swap` });
    await run("fill_secrets", { fields: { "#card": "Card.number" } });
    delay = 2500;
    const clicked = await run("click", { selector: "#review" });
    await Bun.sleep(300);
    // Secure: after a card is typed, the agent can't click at all (the browser is the person's), so nothing is charged.
    expect((clicked as HaloError).code).toBe("WALLET_LOCKED");
    expect(carded().length).toBe(0);
  }, 60_000);

  test("10. hand_over with a real (non-mock) wallet is marked so --auto-approve can't answer 'done'", async () => {
    const a = harness({ source: "env" });
    await a.run("open", { url: `${BASE}/shop` });
    const f = await a.run("fill_secrets", { fields: { "#card": "Card.number" } });
    expect(f).toMatchObject({ locked: true });
    // (headless: false only on this call, so the check passes without a window.)
    const r = (await a.run("hand_over", { reason: "press Pay" }, { headless: false })) as any;
    const q = a.requests.at(-1)!;
    expect(q.named?.target).toBe("Web.hand_over");
    // Secure: the question carries the wallet marker (as submissions do), so autoAnswer refuses it for a real wallet.
    expect(q.wallet).toEqual({ mock: false });
    void r;
  }, 60_000);

  test("11. fill with a newline doesn't implicitly submit the form", async () => {
    const a = harness();
    await a.run("open", { url: `${BASE}/shop` });
    await a.run("fill_secrets", { fields: { "#card": "Card.number" } });
    await a.run("fill", { selector: "#email", value: "a@b.co\n" });
    await a.run("fill", { selector: "#email", value: "a@b.co\r" });
    await Bun.sleep(300);
    expect(carded().length === 0 || a.submissions() >= 1).toBe(true);
  }, 60_000);

  test("12. press Space / Enter variants on the focused Pay button", async () => {
    const a = harness();
    await a.run("open", { url: `${BASE}/shop` });
    await a.run("fill_secrets", { fields: { "#card": "Card.number" } });
    for (const key of [" ", "　", "constructor", "toString", "space", "enter", "Return", "NumpadEnter"]) {
      await a.run("press", { selector: "#pay", key });
    }
    await Bun.sleep(300);
    expect(carded().length === 0 || a.submissions() >= 1).toBe(true);
  }, 60_000);
});

/** The live profile of the newest wallet browser. */
function newestProfile(since: number): string | undefined {
  const root = tmpdir();
  const dirs = readdirSync(root)
    .filter((x) => x.startsWith("halo-chrome-"))
    .map((x) => join(root, x))
    .filter((d) => {
      try {
        return statSync(d).birthtimeMs >= since - 1000;
      } catch {
        return false;
      }
    });
  return dirs.sort((x, y) => statSync(y).birthtimeMs - statSync(x).birthtimeMs)[0];
}

function filesHolding(dir: string, needle: string): string[] {
  const out: string[] = [];
  const a = Buffer.from(needle, "utf8");
  const u = Buffer.from(needle, "utf16le");
  const walk = (d: string) => {
    let entries;
    try {
      entries = readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile()) {
        try {
          const b = readFileSync(p);
          if (b.includes(a) || b.includes(u)) out.push(p.slice(dir.length + 1));
        } catch {}
      }
    }
  };
  walk(dir);
  return out;
}

describe.skipIf(!chrome)("red team: the profile on disk", () => {
  test("13. nothing typed is written to the profile (Sessions, Web Data, History, cache)", async () => {
    const t0 = Date.now();
    const a = harness();
    await a.run("open", { url: `${BASE}/shop` });
    await a.run("fill_secrets", { fields: { "#card": "Card.number" } });
    await a.run("open", { url: `${BASE}/other` }); // the checkout's page state (its form values) goes into history
    await a.run("back");
    await a.run("click", { selector: "#pay" });
    await Bun.sleep(6000); // Chrome saves its session on a timer
    const dir = newestProfile(t0);
    expect(dir && existsSync(dir)).toBe(true);
    const found = filesHolding(dir!, CARD);
    // Secure: the profile a killed Halo leaves behind holds no card number.
    expect(found).toEqual([]);
  }, 60_000);
});

// ── halo wallet add: the command line handed to `security -i` ──

const CLI = readFileSync(join(import.meta.dir, "../src/wallet-cli.ts"), "utf8");
// The exact quoting function and command template add() uses.
const qSrc = CLI.match(/const q = (\(s: string\) => .*);\n/)![1]!.replace("(s: string)", "(s)");
const q: (s: string) => string = (0, eval)(qSrc);

describe.skipIf(process.platform !== "darwin")("red team: halo wallet add", () => {
  test("14. quotes, backslashes and option-looking text are one word to security -i", async () => {
    expect(CLI).toContain('-w ${q(value)}\\n`');
    const scratch = join(tmpdir(), `halo-rt-kc-${process.pid}`);
    rmSync(scratch, { recursive: true, force: true });
    const { mkdirSync } = await import("node:fs");
    mkdirSync(scratch, { recursive: true });
    const kc = join(scratch, "rt.keychain");
    try {
      const mk = Bun.spawnSync(["security", "create-keychain", "-p", "pw", kc]);
      expect(mk.exitCode).toBe(0);
      for (const v of [`x" -T /usr/bin/security -w "y`, `a\\" b`, `\\\\`, `'q' "r"`]) {
        const p = Bun.spawn(["security", "-i"], { stdin: "pipe", stdout: "pipe", stderr: "pipe" });
        p.stdin.write(`add-generic-password -U -s ${q("halo-rt")} -a ${q("A.f")} -w ${q(v)} ${q(kc)}\nfind-generic-password -s ${q("halo-rt")} -a ${q("A.f")} -w ${q(kc)}\n`);
        await p.stdin.end();
        const out = (await new Response(p.stdout).text()).trim();
        await p.exited;
        expect(out).toBe(v);
      }
    } finally {
      Bun.spawnSync(["security", "delete-keychain", kc]);
      rmSync(scratch, { recursive: true, force: true });
    }
  }, 30_000);

  test("15. a long value (security -i reads 4095 bytes a line) can't run a second security command", async () => {
    // security -i runs whatever follows byte 4095 of a line as its own command, quoted or not. So Halo
    // never builds a line that long, and refuses values long enough, or with control characters, to try.
    const { checkValue, keychainAddLine, WalletCliError } = await import("../src/wallet-cli.ts");
    const item = walletItem("Me", (k) => ({ source: "keychain", fields: ["note"], hosts: ["127.0.0.1"] })[k as string]);
    const long = "A".repeat(3990) + "create-keychain -p pw /tmp/x";
    expect(() => checkValue(item, "note", long, true)).toThrow(WalletCliError);
    expect(() => checkValue(item, "note", "a\u0085b\u0007", true)).toThrow("no control characters");
    expect(() => keychainAddLine("Me.note", long)).toThrow("can't be stored safely");
    expect(() => keychainAddLine("Me.note", "ok\ncreate-keychain x")).toThrow("can't be stored safely");
    const line = keychainAddLine("Me.note", "x".repeat(1024));
    expect(Buffer.byteLength(line)).toBeLessThan(4000);
    expect(line.endsWith("\n") && line.indexOf("\n") === line.length - 1).toBe(true);
  }, 30_000);
});
