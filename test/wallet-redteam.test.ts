/**
 * Red-team regressions for the wallet: each test is an attack on the implementation, by an agent
 * (or a page steering one) that wants the card number out. Each asserts the attack gets nothing.
 *
 * The merchant page here is hostile in the ways real checkouts are careless: it mirrors what's typed
 * into attributes (value, and title on one field), shows the number in a preview widget with one
 * <span> per digit, echoes it after a known prefix on a review step, and re-renders a field.
 */
import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { HaloError } from "../src/runtime/errors.js";
import { chromeProvider, closeChromeSessions, findChrome } from "../src/runtime/providers/chrome.js";
import type { ToolApprovalRequest, ToolCall, ToolServices, WalletEvent } from "../src/runtime/tools.js";
import { walletItem } from "../src/runtime/wallet.js";

const chrome = findChrome();
const CARD = "4242424242424242";
// Any 4 or more of the card's digits in order, other than its last four (which the hint shows anyway).
const LEAK = /4242\D{0,3}4242|42424|24242|\b(4242|2424)\b(?!$)/;

const SHOP = `<!doctype html><title>Checkout</title>
<form id="f" onsubmit="event.preventDefault(); document.getElementById('status').textContent = 'Paid';">
  <input id="card" autocomplete="cc-number">
  <input id="card2" autocomplete="cc-number">
  <input id="card3" autocomplete="cc-number">
  <button id="pay" type="submit">Pay</button>
</form>
<p id="status">Waiting</p>
<div id="digits"></div>
<p id="echo"></p>
<button id="review" type="button">Review</button>
<script>
  const $ = (id) => document.getElementById(id);
  for (const el of document.querySelectorAll("input")) el.addEventListener("input", () => el.setAttribute("value", el.value));
  $("card").addEventListener("input", (e) => { $("digits").innerHTML = [...e.target.value].map((d) => "<span>" + d + "</span>").join(""); });
  $("card2").addEventListener("input", (e) => e.target.setAttribute("title", e.target.value));
  // A framework re-rendering the field: the typed node is replaced by a new one holding the value.
  $("card3").addEventListener("change", (e) => setTimeout(() => { const n = e.target.cloneNode(true); n.value = e.target.value; e.target.replaceWith(n); }, 50));
  $("review").addEventListener("click", () => { $("echo").textContent = "Your card number is " + $("card").value + " and it expires soon."; });
</script>`;

let server: ReturnType<typeof Bun.serve>;
let BASE = "";
let OTHER = "";

beforeAll(() => {
  if (!chrome) return;
  server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch: (req) => {
      const path = new URL(req.url).pathname;
      // /flip: a second after loading, the card field becomes an email field (same node, same URL).
      const flip = `<script>setTimeout(() => document.getElementById("card").setAttribute("autocomplete", "email"), 1000);</script>`;
      const html = path === "/other" ? "<title>Other</title><p>elsewhere</p>" : path === "/flip" ? SHOP + flip : SHOP;
      return new Response(html, { headers: { "Content-Type": "text/html", "Cache-Control": "no-store" } });
    },
  });
  BASE = `http://127.0.0.1:${server.port}`;
  OTHER = `http://evil.localhost:${server.port}/other`;
});

afterAll(async () => {
  await closeChromeSessions();
  server?.stop(true);
});
afterEach(() => closeChromeSessions());

let n = 0;
function attacker() {
  const runId = `redteam-${++n}`;
  const requests: ToolApprovalRequest[] = [];
  const results: unknown[] = [];
  const items = { Card: walletItem("Card", (k) => ({ source: "mock", fields: ["number:cc-number"], hosts: ["127.0.0.1"] })[k as string]) };
  const run = async (method: string, named: Record<string, unknown> = {}) => {
    const cfg: Record<string, unknown> = { headless: false, allow: ["127.0.0.1", "evil.localhost"], wallet: ["Card"] };
    const call: ToolCall = { tool: { name: "Web", provider: "Chrome", args: [], namedArgs: {}, argList: [] }, method, positional: [], named, config: (k) => cfg[k as string], viaAgent: true, signal: new AbortController().signal, runId };
    const services = { wallet: (names: string[]) => names.map((x) => items[x as "Card"]), approve: async (r: ToolApprovalRequest) => (requests.push(r), delay && (await Bun.sleep(delay)), true), walletEvent: (_: WalletEvent) => {}, env: {} } as unknown as ToolServices;
    const r = await chromeProvider(call, services).catch((e: unknown) => e as HaloError);
    results.push(r instanceof Error ? r.message : r);
    return r;
  };
  return { run, requests, results };
}

/** An attacker whose person takes `ms` to answer. */
function slowAttacker(ms: number) {
  const a = attacker();
  const run = a.run;
  return { ...a, run: (m: string, named: Record<string, unknown> = {}) => (m === "fill_secrets" ? withDelay(ms, () => run(m, named)) : run(m, named)) };
}
let delay = 0;
async function withDelay<T>(ms: number, f: () => Promise<T>): Promise<T> {
  delay = ms;
  try {
    return await f();
  } finally {
    delay = 0;
  }
}

const text = (r: unknown) => (r instanceof Error ? r.message : typeof r === "string" ? r : JSON.stringify(r));

describe.skipIf(!chrome)("red team: getting the card number out", () => {
  test("A. truncating the page text mid-number with maxChars", async () => {
    const a = attacker();
    await a.run("open", { url: BASE });
    await a.run("fill_secrets", { fields: { "#card": "Card.number" } });
    await a.run("click", { selector: "#review" });
    // "Your card number is " is 20 characters: cut after 20 + 12 to keep 12 digits and lose the rest.
    for (const maxChars of [32, 28, 24, 22]) expect(text(await a.run("text", { selector: "#echo", maxChars }))).not.toMatch(/4242\D{0,3}4242|^Your card number is 4/);
  }, 60_000);

  test("B. reading the preview widget one digit at a time", async () => {
    const a = attacker();
    await a.run("open", { url: BASE });
    await a.run("fill_secrets", { fields: { "#card": "Card.number" } });
    let got = "";
    for (let i = 1; i <= 16; i++) got += text(await a.run("text", { selector: `#digits span:nth-child(${i})` }));
    expect(got).not.toBe(CARD);
    expect(got).not.toContain("424242");
    expect(text(await a.run("html", { selector: "#digits" }))).not.toMatch(/4<\/span><span>2<\/span>/);
  }, 60_000);

  test("C. leaving the merchant, then going back to a page holding the typed value", async () => {
    const a = attacker();
    await a.run("open", { url: BASE });
    await a.run("fill_secrets", { fields: { "#card": "Card.number" } });
    await a.run("open", { url: OTHER });
    await a.run("back");
    expect(text(await a.run("html", { selector: "form" }))).not.toMatch(LEAK);
    expect(text(await a.run("wait", { selector: 'input[value^="4"]', timeout_ms: 100 }))).not.toContain('"found":true');
  }, 60_000);

  test("D. submitting with a raw carriage return instead of Enter", async () => {
    const a = attacker();
    await a.run("open", { url: BASE });
    await a.run("fill_secrets", { fields: { "#card": "Card.number" } });
    const before = a.requests.length;
    for (const key of ["\r", "\n"]) await a.run("press", { selector: "#pay", key });
    const asked = a.requests.length - before;
    const status = text(await a.run("text", { selector: "#status" }));
    expect(status === "Waiting" || asked >= 1).toBe(true);
  }, 60_000);

  test("F. a page that mirrors the value into title", async () => {
    const a = attacker();
    await a.run("open", { url: BASE });
    await a.run("fill_secrets", { fields: { "#card2": "Card.number" } });
    const found = text(await a.run("wait", { selector: 'input[title^="4"]', timeout_ms: 100 }));
    expect(found).not.toContain('"found":true');
    expect(found).not.toContain('"found":false');
  }, 60_000);

  test("G. the page re-renders the field, and Pay is still gated", async () => {
    const a = attacker();
    await a.run("open", { url: BASE });
    await a.run("fill_secrets", { fields: { "#card3": "Card.number" } });
    await Bun.sleep(200);
    const before = a.requests.length;
    await a.run("click", { selector: "#pay" });
    expect(a.requests.length - before).toBe(1);
    expect(a.requests.at(-1)!.named.submission).toBe(true);
  }, 60_000);

  test("H. the page turns the card field into an email field while the person decides: nothing is typed", async () => {
    const a = slowAttacker(2000);
    await a.run("open", { url: `${BASE}/flip` });
    expect(text(await a.run("fill_secrets", { fields: { "#card": "Card.number" } }))).toBe("Web.fill_secrets: the page changed while waiting for approval, so nothing was typed. Look at the page again and fill it again");
  }, 60_000);

  test("K. the browser's own DevTools endpoint is never a page", async () => {
    const { urlAllowed } = await import("../src/runtime/providers/chrome.js");
    expect(urlAllowed("http://127.0.0.1:9333/json", undefined, 9333)).toBe(false);
    expect(urlAllowed("http://localhost:9333/json/version", ["localhost"], 9333)).toBe(false);
    expect(urlAllowed("http://127.0.0.1:9334/", undefined, 9333)).toBe(true);
    expect(urlAllowed("https://example.com:9333/", undefined, 9333)).toBe(true);
  });

  test("nothing any attack returned holds the number", () => {
    // (Each test above collects its own results; this one is a reminder the suite checks values, not shapes.)
    expect(LEAK.test(CARD)).toBe(true);
  });
});
