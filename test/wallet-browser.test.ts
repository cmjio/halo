/**
 * The wallet in a real browser, against a local checkout built to attack it.
 *
 * Three origins: the merchant's checkout on 127.0.0.1, a cross-site payment frame on localhost
 * (a separate process, as Stripe's is), and an attacker's page on evil.localhost that embeds the
 * same real payment frame. The merchant's page mirrors what is typed into each field's value
 * attribute, as React does, echoes the card number on a review step, and has a card-preview widget
 * that splits the digits into spans. The payment frame reports every value it receives to its own
 * server, which is how the tests see what was typed without Halo ever reading it.
 */
import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { HaloError } from "../src/runtime/errors.js";
import { chromeProvider, closeChromeSessions, findChrome } from "../src/runtime/providers/chrome.js";
import type { ToolApprovalRequest, ToolCall, ToolServices, WalletEvent } from "../src/runtime/tools.js";
import { walletItem, type WalletItem, type WalletLimits } from "../src/runtime/wallet.js";

const chrome = findChrome();
const CARD = "4242424242424242";

const PAY = `<!doctype html><title>Card</title>
<input id="cc" autocomplete="cc-number"><input id="exp" autocomplete="cc-exp"><input id="cvc" autocomplete="cc-csc">
<select id="month" autocomplete="cc-exp-month"><option value="">MM</option>${Array.from({ length: 12 }, (_, i) => `<option>${String(i + 1).padStart(2, "0")}</option>`).join("")}</select>
<script>
  for (const el of document.querySelectorAll("input, select")) {
    el.addEventListener("input", () => el.setAttribute("value", el.value));
    el.addEventListener("change", () => fetch("/typed?f=" + el.id + "&v=" + encodeURIComponent(el.value)));
  }
</script>`;

const shop = (payOrigin: string) => `<!doctype html><title>Checkout</title>
<form id="f" onsubmit="event.preventDefault(); const s = document.getElementById('status'); s.textContent = 'Paid ' + (Number(s.dataset.n || 0) + 1); s.dataset.n = Number(s.dataset.n || 0) + 1;">
  <input id="email" autocomplete="email">
  <input id="card" name="cardnumber" autocomplete="cc-number">
  <input id="q" type="search">
  <textarea id="notes"></textarea>
  <input id="hidden" autocomplete="cc-number" style="display:none">
  <button id="pay" type="submit">Pay</button>
</form>
<p id="status">Waiting</p>
<div id="preview"></div>
<button id="review" type="button" onclick="document.getElementById('echo').textContent = 'Card: ' + document.getElementById('card').value.replace(/(\\d{4})(?=\\d)/g, '$1 ');">Review</button>
<p id="echo"></p>
<iframe id="payframe" title="Secure card" src="${payOrigin}/pay" width="400" height="120"></iframe>
<script>
  for (const el of document.querySelectorAll("input")) el.addEventListener("input", () => el.setAttribute("value", el.value));
  document.getElementById("card").addEventListener("input", (e) => {
    document.getElementById("preview").innerHTML = e.target.value.match(/.{1,4}/g).map((g) => "<span>" + g + "</span>").join("");
  });
</script>`;

const STEAL = `<!doctype html><title>Steal</title>
<input id="victim" autocomplete="cc-number"><input id="other">
<script>document.getElementById("victim").addEventListener("input", () => document.getElementById("other").focus(), { once: true });</script>`;

let shopServer: ReturnType<typeof Bun.serve>;
let payServer: ReturnType<typeof Bun.serve>;
let SHOP = "";
let PAYO = "";
let EVIL = "";
const typed: Array<{ f: string; v: string }> = [];

beforeAll(() => {
  if (!chrome) return;
  payServer = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch(req) {
      const url = new URL(req.url);
      if (url.pathname === "/typed") {
        typed.push({ f: url.searchParams.get("f") ?? "", v: url.searchParams.get("v") ?? "" });
        return new Response("ok");
      }
      return new Response(PAY, { headers: { "Content-Type": "text/html" } });
    },
  });
  PAYO = `http://localhost:${payServer.port}`;
  shopServer = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch(req) {
      const url = new URL(req.url);
      // /swap: the page replaces its payment frame with another page a second after it loads.
      const swap = `<script>setTimeout(() => { document.getElementById("payframe").src = "${PAYO}/pay?swapped=1"; }, 1000);</script>`;
      const html = url.pathname === "/steal" ? STEAL : url.pathname === "/other" ? `<title>Other</title><input id="x"><p>elsewhere</p>` : url.pathname === "/swap" ? shop(PAYO) + swap : shop(PAYO);
      return new Response(html, { headers: { "Content-Type": "text/html" } });
    },
  });
  SHOP = `http://127.0.0.1:${shopServer.port}`;
  // Chrome sends every *.localhost name to this machine, so the attacker needs no server of its own.
  EVIL = `http://evil.localhost:${shopServer.port}`;
});

afterAll(async () => {
  await closeChromeSessions();
  shopServer?.stop(true);
  payServer?.stop(true);
});

const card = (o: Record<string, unknown> = {}) => walletItem("Card", (k) => ({ source: "mock", kind: "card", fields: ["number", "expiry", "cvc", "name"], hosts: ["127.0.0.1"], pay_via: ["localhost"], ...o })[k as string]);
const me = () => walletItem("Me", (k) => ({ source: "mock", fields: ["email", "full_name"], hosts: ["127.0.0.1"], ask: false })[k as string]);
// A personal item holding a long number: not secret, so the browser stays the agent's and masking is what protects it.
const acct = () => walletItem("Acct", (k) => ({ source: "mock", fields: ["number:cc-number"], hosts: ["127.0.0.1"] })[k as string]);

interface Harness {
  requests: ToolApprovalRequest[];
  events: WalletEvent[];
  results: unknown[];
  answer: (req: ToolApprovalRequest) => unknown | Promise<unknown>;
  items: Record<string, WalletItem>;
  run(method: string, named?: Record<string, unknown>, opts?: { wallet?: WalletLimits; config?: Record<string, unknown> }): Promise<any>;
}

let runN = 0;
function harness(config: Record<string, unknown> = {}): Harness {
  const runId = `wallet-${++runN}`;
  const h: Harness = {
    requests: [],
    events: [],
    results: [],
    answer: () => true,
    items: { Card: card(), Me: me(), Acct: acct() },
    async run(method, named = {}, opts = {}) {
      const cfg: Record<string, unknown> = { headless: false, allow: ["127.0.0.1", "evil.localhost"], wallet: ["Card", "Me", "Acct"], ...config, ...opts.config };
      const call: ToolCall = {
        tool: { name: "Web", provider: "Chrome", args: [], namedArgs: {}, argList: [] },
        method,
        positional: [],
        named,
        config: (k) => cfg[k as string],
        viaAgent: !!opts.wallet,
        signal: new AbortController().signal,
        runId,
        ...(opts.wallet ? { wallet: opts.wallet } : {}),
      };
      const services = {
        wallet: (names: string[]) => names.map((n) => h.items[n]!),
        approve: async (req: ToolApprovalRequest) => (h.requests.push(req), h.answer(req)),
        walletEvent: (e: WalletEvent) => h.events.push(e),
        env: {},
      } as unknown as ToolServices;
      const r = await chromeProvider(call, services);
      h.results.push(r);
      return r;
    },
  };
  return h;
}

const caught = (p: Promise<unknown>) => p.then(() => undefined, (e: unknown) => e as HaloError);

afterEach(async () => {
  await closeChromeSessions();
  typed.length = 0;
});

describe.skipIf(!chrome)("the wallet in Chrome", () => {
  test("types a card into a cross-site payment frame, after one approval, and never returns it", async () => {
    const h = harness();
    await h.run("open", { url: SHOP });
    const frames = await h.run("frames");
    expect(frames).toEqual([{ selector: "#payframe", src: `${PAYO}/pay`, title: "Secure card", host: "localhost" }]);
    const r = await h.run("fill_secrets", { frame: "#payframe", fields: { "#cc": "Card.number", "#exp": "Card.expiry:MM/YY", "#cvc": "Card.cvc", "#month": "Card.expiry:MM" } });
    expect(r).toEqual({
      filled: { "#cc": "Card.number", "#exp": "Card.expiry:MM/YY", "#cvc": "Card.cvc", "#month": "Card.expiry:MM" },
      locked: true,
      next: `Card is typed. Call Web.hand_over(reason: "...") so the person can check it and finish (press Pay, confirm with their bank). You can't read or use this page any more.`,
    });
    await Bun.sleep(300);
    expect(Object.fromEntries(typed.map((t) => [t.f, t.v]))).toEqual({ cc: CARD, exp: "12/34", cvc: "123", month: "12" });

    // One question, naming the item, its hint, and the chain of sites, and no value.
    expect(h.requests).toHaveLength(1);
    const q = h.requests[0]!;
    expect(q.wallet).toEqual({ mock: true });
    expect(q.key).toMatch(/^wallet:[0-9a-f]{32}$/);
    expect(q.message).toContain("The pipeline wants to type Card (Visa ending 4242): number, expiry, cvc, expiry");
    expect(q.message).toContain(`  page     127.0.0.1                ${SHOP}/`);
    expect(q.message).toContain(`  field in localhost                ${PAYO}/pay  (payment frame, inside 127.0.0.1)`);
    expect(q.named).toMatchObject({ target: "Web.fill_secrets", refs: ["Card.number", "Card.expiry", "Card.cvc", "Card.expiry"] });
    expect(h.events.map((e) => e.outcome)).toEqual(["typed"]);

    // Nothing Halo returned, asked or logged holds the value.
    expect(JSON.stringify([h.results, h.requests, h.events])).not.toMatch(/4242\D?4242|12\/34/);
  }, 60_000);

  test("after a card is typed the browser is the person's: only hand_over, which closes it", async () => {
    const h = harness();
    await h.run("open", { url: SHOP });
    await h.run("fill_secrets", { frame: "#payframe", fields: { "#cc": "Card.number" } });
    for (const [method, named] of [["text", {}], ["html", { selector: "form" }], ["links", {}], ["frames", {}], ["wait", { selector: "#pay" }], ["screenshot", {}], ["click", { selector: "#pay" }], ["fill", { selector: "#email", value: "x" }], ["press", { key: "Enter" }], ["open", { url: SHOP }], ["back", {}], ["fill_secrets", { fields: { "#email": "Me.email" } }]] as const) {
      const err = await caught(h.run(method, named as Record<string, unknown>));
      expect([method, err?.code]).toEqual([method, "WALLET_LOCKED"]);
    }
    h.answer = (req) => (req.named.target === "Web.hand_over" ? "BA1234 booked" : true);
    const done = await h.run("hand_over", { reason: "press Pay" });
    expect(done).toEqual({ handedOver: false, said: "BA1234 booked", closed: true });
    const q = h.requests.at(-1)!;
    expect(q.wallet).toEqual({ mock: true });
    expect(q.message).toStartWith("The pipeline typed Card on 127.0.0.1 and hands the browser to you: press Pay");
    // The browser closed: the next call starts a fresh one, with nothing typed in it.
    expect(await h.run("open", { url: SHOP })).toMatchObject({ title: "Checkout" });
    expect(await h.run("text", { selector: "#status" })).toBe("Waiting");
  }, 60_000);

  test("a secret can only be typed into a browser a person can see", async () => {
    const h = harness({ headless: true });
    await h.run("open", { url: SHOP });
    const err = await caught(h.run("fill_secrets", { frame: "#payframe", fields: { "#cc": "Card.number" } }));
    expect(err?.message).toBe("Web.fill_secrets: Card can be typed only into a browser a person can see, since only they can finish with it: declare Web with headless: false");
    await Bun.sleep(200);
    expect(typed).toEqual([]);
  }, 60_000);

  test("an attacker's page embedding the real payment frame gets nothing", async () => {
    const h = harness();
    await h.run("open", { url: `${EVIL}/` });
    const err = await caught(h.run("fill_secrets", { frame: "#payframe", fields: { "#cc": "Card.number" } }));
    expect(err?.message).toBe(`Web.fill_secrets: Card may be typed only on pages on 127.0.0.1; this page is on evil.localhost`);
    expect(h.requests).toEqual([]);
    expect(h.events.map((e) => [e.outcome, e.chain.map((l) => l.host)])).toEqual([["refused", ["evil.localhost", "localhost"]]]);
    await Bun.sleep(200);
    expect(typed).toEqual([]);
  }, 60_000);

  test("a frame on a host the item doesn't name is refused", async () => {
    const h = harness();
    h.items.Card = card({ pay_via: ["js.stripe.com"] });
    await h.run("open", { url: SHOP });
    const err = await caught(h.run("fill_secrets", { frame: "#payframe", fields: { "#cc": "Card.number" } }));
    expect(err?.message).toBe("Web.fill_secrets: the field is in a frame on localhost, which isn't in Card's hosts: or pay_via:");
  }, 60_000);

  test("elements that aren't the field: a different autocomplete, a search box, a textarea, a hidden field", async () => {
    const h = harness();
    await h.run("open", { url: SHOP });
    const why = async (fields: Record<string, string>) => (await caught(h.run("fill_secrets", { fields })))?.message;
    expect(await why({ "#email": "Card.number" })).toBe(`Web.fill_secrets: won't type Card.number into "#email": the page marks it autocomplete="email", which is a different detail from cc-number`);
    expect(await why({ "#q": "Card.number" })).toBe(`Web.fill_secrets: won't type Card.number into "#q": it's a search box`);
    expect(await why({ "#notes": "Card.number" })).toBe(`Web.fill_secrets: won't type Card.number into "#notes": it's a <textarea>, not an <input> or <select>`);
    expect(await why({ "#hidden": "Card.number" })).toBe(`Web.fill_secrets: won't type Card.number into "#hidden": it isn't visible`);
    expect(await why({ "#card": "Card.pin" })).toBe(`Web.fill_secrets: Card has no field "pin" (it has number, expiry, cvc, name)`);
    expect(await why({ "#card": "Passport.number" })).toBe(`Web.fill_secrets: "Passport.number": Passport isn't in this browser's wallet (Card, Me, Acct)`);
    expect(h.requests).toEqual([]);
  }, 60_000);

  test("an agent's AllowWallet rules hold, and a policy's approval is folded into the wallet's question", async () => {
    const h = harness();
    await h.run("open", { url: SHOP });
    const err = await caught(h.run("fill_secrets", { fields: { "#card": "Card.number" } }, { wallet: { allow: [["Me"]], approve: [], agent: "Booker" } }));
    expect(err?.message).toBe("Web.fill_secrets: Booker may not use Card.number: its AllowWallet rules don't cover it");
    const none = await caught(h.run("fill_secrets", { fields: { "#card": "Card.number" } }, { wallet: { allow: [], approve: [], agent: "Booker" } }));
    expect(none?.message).toBe("Web.fill_secrets: Booker may not use Card.number: none of its policies has AllowWallet(...)");
    // A personal item with ask: false types without asking, unless a rule asks.
    await h.run("fill_secrets", { fields: { "#email": "Me.email" } }, { wallet: { allow: [["Me", "Card"]], approve: [], agent: "Booker" } });
    expect(h.requests).toHaveLength(0);
    await h.run("fill_secrets", { fields: { "#email": "Me.email" } }, { wallet: { allow: [["Me"]], approve: ["Me.email"], agent: "Booker" } });
    expect(h.requests).toHaveLength(1);
    await h.run("fill_secrets", { fields: { "#card": "Card.number" } }, { wallet: { allow: [["Card"]], approve: [], agent: "Booker", policyApproval: "Careful" } });
    expect(h.requests).toHaveLength(2);
    expect(h.requests[1]!.message).toStartWith("Booker wants to type Card (Visa ending 4242): number (policy Careful)");
  }, 60_000);

  test("a person declining types nothing", async () => {
    const h = harness();
    h.answer = () => ({ approved: false, reason: "wrong card" });
    await h.run("open", { url: SHOP });
    const err = await caught(h.run("fill_secrets", { frame: "#payframe", fields: { "#cc": "Card.number" } }));
    expect(err?.code).toBe("APPROVAL_DECLINED");
    expect(err?.message).toBe("A person declined typing Card: number on 127.0.0.1: wrong card");
    await Bun.sleep(200);
    expect(typed).toEqual([]);
    expect(h.events.map((e) => [e.outcome, e.detail])).toEqual([["declined", "wrong card"]]);
  }, 60_000);

  test("a page that changes while the person decides gets nothing", async () => {
    const h = harness();
    await h.run("open", { url: `${SHOP}/swap` });
    // The page swaps its payment frame for another while the person reads the question.
    h.answer = async () => (await Bun.sleep(2000), true);
    const err = await caught(h.run("fill_secrets", { frame: "#payframe", fields: { "#cc": "Card.number" } }));
    expect(err?.message).toBe("Web.fill_secrets: the page changed while waiting for approval, so nothing was typed. Look at the page again and fill it again");
    await Bun.sleep(200);
    expect(typed).toEqual([]);
  }, 60_000);

  test("a personal item: after typing, nothing about the field can be read back or probed", async () => {
    const h = harness();
    await h.run("open", { url: SHOP });
    await h.run("fill_secrets", { fields: { "#card": "Acct.number" } });
    const why = async (method: string, named: Record<string, unknown>) => (await caught(h.run(method, named)))?.message;

    // The selector oracle: the page mirrored the value into the attribute, and no selector may ask about it.
    expect(await why("wait", { selector: 'input[value^="4"]' })).toStartWith("Web.wait: [value] can't be used after a wallet value is typed");
    expect(await why("click", { selector: 'input[v\\61lue^="4"]' })).toStartWith("Web.click: [value] can't be used after a wallet value is typed");
    expect(await why("text", { selector: "form:has(input)" })).toStartWith("Web.text: :has can't be used after a wallet value is typed");
    expect(await why("text", { selector: "#card:placeholder-shown" })).toStartWith("Web.text: :placeholder-shown can't be used");

    // The field itself is sealed.
    expect(await h.run("text", { selector: "#card" })).toBe("[sealed Acct.number]");
    expect(await why("fill", { selector: "#card", value: "x" })).toBe(`Web.fill: "#card" is sealed: Acct.number was typed into it`);
    expect(await why("press", { selector: "#card", key: "Backspace" })).toBe(`Web.press: "#card" is sealed: Acct.number was typed into it`);
    const html = await h.run("html", { selector: "form" });
    expect(html).toContain('value="[sealed Acct.number]"');
    expect(html).not.toMatch(/4242/);

    // What the page echoes elsewhere is masked: the preview widget's spans, the review text.
    // Every group of the preview is blanked, so no single <span> holds any of it.
    expect(await h.run("html", { selector: "#preview" })).toBe('<div id="preview"><span>[wallet Acct.number]</span><span></span><span></span><span></span></div>');
    expect(await h.run("text", { selector: "#preview span:nth-child(2)" })).toBe("");
    h.answer = () => true; // clicking Review is a submission while the card is on the page
    await h.run("click", { selector: "#review" });
    expect(await h.run("text", { selector: "#echo" })).toBe("Card: [wallet Acct.number]");
    expect(JSON.stringify(h.results)).not.toMatch(/4242\D{0,3}4242/);

    // No screenshots after typing: a page can draw a value where no check of its text can see it.
    expect(await why("screenshot", {})).toBe("Web.screenshot: a wallet value was typed in this browser, so it takes no more screenshots (a page can draw a value where Halo can't check it). Use text, which masks it");
    // And no .class or partial attribute tests: a page derives classes and labels from what's typed.
    expect(await why("wait", { selector: ".brand-visa" })).toStartWith("Web.wait: .class selectors can't be used");
    expect(await why("wait", { selector: '[aria-label^="Card 4"]' })).toStartWith("Web.wait: [aria-label^=...] can't be used");
  }, 90_000);

  test("a personal item: each submission after a fill asks, and one approval allows one", async () => {
    const h = harness();
    await h.run("open", { url: SHOP });
    await h.run("fill_secrets", { fields: { "#card": "Acct.number" } });
    h.answer = (req) => (req.named.submission ? { approved: false, reason: "not yet" } : true);
    const no = await caught(h.run("click", { selector: "#pay" }));
    expect(no?.message).toBe(`A person declined: click "#pay": not yet`);
    expect(await h.run("text", { selector: "#status" })).toBe("Waiting");
    h.answer = () => true;
    await h.run("click", { selector: "#pay" });
    await h.run("press", { selector: "#email", key: "Enter" });
    expect(await h.run("text", { selector: "#status" })).toBe("Paid 2");
    const submits = h.requests.filter((r) => r.named.submission);
    expect(submits.map((r) => r.named.action)).toEqual([`click "#pay"`, `click "#pay"`, "press Enter"]);
    expect(new Set(submits.map((r) => r.key)).size).toBe(2); // the declined click and the approved one ask the same question
    expect(submits[0]!.message).toStartWith(`The pipeline wants to click "#pay" on 127.0.0.1, after typing Acct (number). This may submit them (for a card, pay). It sends the form to 127.0.0.1.`);
    expect(h.events.map((e) => e.outcome)).toEqual(["typed", "submit_declined", "submit_approved", "submit_approved"]);
  }, 60_000);

  test("a personal item: the session stays armed after leaving the item's hosts, for when the page comes back", async () => {
    const h = harness();
    await h.run("open", { url: SHOP });
    await h.run("fill_secrets", { fields: { "#card": "Acct.number" } });
    await h.run("open", { url: `${EVIL}/other` });
    expect((await caught(h.run("wait", { selector: "input[value]", timeout_ms: 100 })))?.message).toStartWith("Web.wait: [value] can't be used");
    await h.run("back");
    expect(await h.run("html", { selector: "form" })).not.toMatch(/4242/);
  }, 60_000);

  test("a page that moves focus while a value is typed stops the run and closes the browser", async () => {
    const h = harness();
    await h.run("open", { url: `${SHOP}/steal` });
    const err = await caught(h.run("fill_secrets", { fields: { "#victim": "Card.number" } }));
    expect(err?.code).toBe("WALLET_INCIDENT");
    expect(err?.message).toBe("Web.fill_secrets: focus moved to input#other while Card.number was typed, so it may have gone into another element on 127.0.0.1. The browser was closed. Check that site before trying again");
    expect(h.events.map((e) => [e.outcome, e.detail])).toEqual([["incident", "focus moved to input#other while typing"]]);
    // The next call starts a fresh browser.
    expect(await h.run("open", { url: SHOP })).toMatchObject({ title: "Checkout" });
  }, 60_000);

  test("a wallet browser can't run page scripts, and a plain browser can't type from a wallet", async () => {
    const h = harness();
    const a = await caught(h.run("open", { url: SHOP }, { config: { allowScript: true } }));
    expect(a?.message).toBe(`Tool "Web" has a wallet, so it can't run page scripts: remove allowScript: true (a script could read what was typed)`);
    const b = await caught(h.run("fill_secrets", { fields: { "#card": "Card.number" } }, { config: { wallet: undefined } }));
    expect(b?.message).toBe("Web.fill_secrets types values from a wallet: declare the browser with one, e.g. Web : Chrome(wallet: [Card])");
  }, 60_000);
});
