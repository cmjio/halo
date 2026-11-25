/**
 * Red team, read paths: after fill_secrets, can an agent read anything about a typed value?
 * Each test asserts the SECURE outcome; a failing test is a confirmed leak.
 *
 * Values come from a stub Keychain backend so the card number has distinct digits.
 */
import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { HaloError } from "../src/runtime/errors.js";
import { chromeProvider, closeChromeSessions, findChrome } from "../src/runtime/providers/chrome.js";
import type { ToolApprovalRequest, ToolCall, ToolServices, WalletEvent } from "../src/runtime/tools.js";
import { setWalletBackends, walletItem } from "../src/runtime/wallet.js";

const chrome = findChrome();
const NUMBER = "4539148803436467";
const GROUPS = ["4539", "1488", "0343", "6467"];
const VALUES: Record<string, string> = { number: NUMBER, expiry: "08/29", cvc: "739", name: "Ada Lovelace", phone: "+14155552671", full_name: "Grace Hopper" };

const FORM = `<form id="f" onsubmit="event.preventDefault()">
  <input id="cc" autocomplete="cc-number">
  <input id="exp" autocomplete="cc-exp">
  <input id="cvc" autocomplete="cc-csc">
  <input id="name" autocomplete="cc-name">
  <input id="phone" autocomplete="tel">
  <span id="expwrap"><select id="month" autocomplete="cc-exp-month"><option value="">MM</option>${Array.from({ length: 12 }, (_, i) => `<option>${String(i + 1).padStart(2, "0")}</option>`).join("")}</select></span>
  <button id="pay" type="submit">Pay</button>
</form>`;

const on = (id: string, body: string) => `document.getElementById(${JSON.stringify(id)}).addEventListener("input", (e) => { const v = e.target.value; ${body} });`;

const PAGES: Record<string, string> = {
  // 1. Card preview with one <span> per group, written from a template literal with indentation.
  "/ws-groups": `<div id="pv"></div><script>${on("cc", `document.getElementById("pv").innerHTML = v.match(/.{1,4}/g).map((g) => "\\n      <span class=\\"g\\">" + g + "</span>").join("") + "\\n    ";`)}</script>`,
  // 2. Same, one <b> per digit.
  "/ws-digits": `<div id="pv"></div><script>${on("cc", `document.getElementById("pv").innerHTML = [...v].map((d) => "\\n  <b>" + d + "</b>").join("");`)}</script>`,
  // 3. Card-flip preview showing CVC on the back and expiry on the front (react-credit-cards style).
  "/flip": `<div class="card"><div id="front-exp">MM/YY</div><div id="back-cvc">***</div></div><script>${on("cvc", `document.getElementById("back-cvc").textContent = v;`)}${on("exp", `document.getElementById("front-exp").textContent = v;`)}</script>`,
  // 4. Phone echoed in national format (drops the +1).
  "/phone": `<p id="echo"></p><script>${on("phone", `const d = v.replace(/\\D/g, "").slice(-10); document.getElementById("echo").textContent = "We'll text (" + d.slice(0,3) + ") " + d.slice(3,6) + "-" + d.slice(6);`)}</script>`,
  // 5. Cardholder name laid out on two lines, and with a no-break space.
  "/name": `<div id="pvname"></div><p id="nb"></p><p id="rev"></p><script>${on("name", `const [a, b] = v.split(" "); document.getElementById("pvname").innerHTML = "<div>" + a + "</div><div>" + b + "</div>"; document.getElementById("nb").textContent = v.replace(" ", "\\u00a0"); document.getElementById("rev").textContent = b + ", " + a;`)}</script>`,
  // 6. Accessible preview: aria-label carries the number.
  "/aria": `<div id="pv" aria-label="Card number">•••• •••• •••• ••••</div><script>${on("cc", `document.getElementById("pv").setAttribute("aria-label", "Card number " + v);`)}</script>`,
  // 7. Preview whose title/aria-label groups the number with no-break spaces.
  "/nbsp": `<div id="pv">••••</div><script>${on("cc", `document.getElementById("pv").setAttribute("data-number", v.match(/.{1,4}/g).join("\\u00a0"));`)}</script>`,
  // 8. Animated masked preview: each digit kept in an attribute, shown as a bullet; plus a class per digit.
  "/attr": `<div id="pv"></div><script>${on("cc", `document.getElementById("pv").innerHTML = [...v].map((d) => "<span data-d=\\"" + d + "\\" class=\\"dig d-" + d + "\\">•</span>").join("");`)}</script>`,
  // 9. BIN + last four, as many checkouts show.
  "/bin": `<p id="echo"></p><script>${on("cc", `document.getElementById("echo").textContent = "Card " + v.slice(0,4) + " " + v.slice(4,6) + "•• •••• " + v.slice(-4);`)}</script>`,
  // 10. Japanese merchant: full-width digits on the confirmation.
  "/fw": `<p id="echo"></p><script>${on("cc", `document.getElementById("echo").textContent = "カード番号：" + v.replace(/\\d/g, (d) => String.fromCharCode(0xff10 + Number(d)));`)}</script>`,
  // 11. CSS generated content (screenshot).
  "/css": `<style>#pv::before { content: attr(data-n); font: 32px monospace; }</style><div id="pv"></div><script>${on("cc", `document.getElementById("pv").setAttribute("data-n", v);`)}</script>`,
  // 12. A design-system component: open shadow root holding the number (text and a readonly mirror input).
  "/shadow": `<card-preview id="host"></card-preview><script>
    customElements.define("card-preview", class extends HTMLElement { constructor() { super(); this.attachShadow({ mode: "open" }).innerHTML = '<p id="t"></p><input id="m" readonly size="30">'; } });
    ${on("cc", `const r = document.getElementById("host").shadowRoot; r.getElementById("m").value = v;`)}</script>`,
  "/shadow-text": `<card-preview id="host"></card-preview><script>
    customElements.define("card-preview", class extends HTMLElement { constructor() { super(); this.attachShadow({ mode: "open" }).innerHTML = '<p id="t" style="font:28px monospace"></p>'; } });
    ${on("cc", `document.getElementById("host").shadowRoot.getElementById("t").textContent = v;`)}</script>`,
  // 13. A page (animation lib) that keeps the card field visible: reverts any inline visibility.
  "/mo": `<script>const cc = document.getElementById("cc"); cc.style.font = "28px monospace"; cc.size = 20;
    new MutationObserver(() => { if (cc.style.visibility) cc.style.removeProperty("visibility"); }).observe(cc, { attributes: true, attributeFilter: ["style"] });</script>`,
  // 14. "Edit card" link carrying the number in its href.
  "/link": `<a id="edit" href="/edit">Edit card</a><script>${on("cc", `document.getElementById("edit").href = "/edit?card=" + v;`)}</script>`,
  // 15. Placeholder of a "confirm card" field mirrors the typed number.
  "/ph": `<input id="confirm" placeholder="Confirm card"><script>${on("cc", `document.getElementById("confirm").placeholder = v;`)}</script>`,
  // 16. A sealed <select> (expiry month) read through its parent.
  "/select": ``,
  // 17. Number in an SVG card image (screenshot).
  "/svg": `<svg width="600" height="60"><text id="st" x="10" y="40" font-size="32" font-family="monospace"></text></svg><script>${on("cc", `document.getElementById("st").textContent = v;`)}</script>`,
  // 18. Validation class on a preview: card-type/length classes.
  "/len": `<div id="pv">card</div><script>${on("cc", `document.getElementById("pv").className = "len-" + v.length + " first-" + v[0] + v[1];`)}</script>`,
};

let server: ReturnType<typeof Bun.serve>;
let BASE = "";

beforeAll(() => {
  setWalletBackends({ keychain: async (account) => VALUES[account.split(".").pop()!] });
  if (!chrome) return;
  server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch: (req) => {
      const path = new URL(req.url).pathname;
      const body = PAGES[path] ?? "<p>edit</p>";
      return new Response(`<!doctype html><title>Checkout</title>${FORM}${body}`, { headers: { "Content-Type": "text/html", "Cache-Control": "no-store" } });
    },
  });
  BASE = `http://127.0.0.1:${server.port}`;
});

afterAll(async () => {
  await closeChromeSessions();
  setWalletBackends({});
  server?.stop(true);
});
afterEach(() => closeChromeSessions());

let n = 0;
function attacker() {
  const runId = `reads-${++n}`;
  const items = {
    Card: walletItem("Card", (k) => ({ source: "keychain", ...(process.env.WALLET_RT_PERSONAL === "1" ? {} : { kind: "card" }), fields: ["number:cc-number", "expiry", "cvc", "name"], hosts: ["127.0.0.1"] })[k as string]),
    Me: walletItem("Me", (k) => ({ source: "keychain", fields: ["phone", "full_name"], hosts: ["127.0.0.1"], ask: false })[k as string]),
  };
  const run = async (method: string, named: Record<string, unknown> = {}) => {
    const cfg: Record<string, unknown> = { headless: false, allow: ["127.0.0.1"], wallet: ["Card", "Me"] };
    const call: ToolCall = { tool: { name: "Web", provider: "Chrome", args: [], namedArgs: {}, argList: [] }, method, positional: [], named, config: (k) => cfg[k as string], viaAgent: true, signal: new AbortController().signal, runId };
    const services = { wallet: (names: string[]) => names.map((x) => items[x as "Card"]), approve: async (_: ToolApprovalRequest) => true, walletEvent: (_: WalletEvent) => {}, env: {} } as unknown as ToolServices;
    return chromeProvider(call, services).catch((e: unknown) => e as HaloError);
  };
  return { run };
}

const text = (r: unknown) => (r instanceof Error ? `ERR ${r.message}` : typeof r === "string" ? r : JSON.stringify(r));
const log = (name: string, v: unknown) => console.log(`[leak?] ${name}: ${typeof v === "string" ? v : JSON.stringify(v)}`);

async function filled(path: string, fields: Record<string, string>) {
  const a = attacker();
  await a.run("open", { url: BASE + path });
  const r = await a.run("fill_secrets", { fields });
  if (r instanceof Error) throw r;
  return a;
}

describe.skipIf(!chrome)("red team: reading a typed value back", () => {
  test("01 group spans separated by whitespace text nodes, read one at a time", async () => {
    const a = await filled("/ws-groups", { "#cc": "Card.number" });
    const got: string[] = [];
    for (let i = 1; i <= 4; i++) got.push(text(await a.run("text", { selector: `#pv span:nth-child(${i})` })));
    log("01", got);
    expect(got.join("")).not.toContain(NUMBER);
    for (const g of got) expect(GROUPS).not.toContain(g);
  }, 60_000);

  test("02 digit <b>s separated by whitespace text nodes, read one at a time", async () => {
    const a = await filled("/ws-digits", { "#cc": "Card.number" });
    let got = "";
    for (let i = 1; i <= 16; i++) got += text(await a.run("text", { selector: `#pv b:nth-child(${i})` }));
    log("02", got);
    expect(got).not.toBe(NUMBER);
  }, 60_000);

  test("03 card-flip preview shows CVC and expiry", async () => {
    const a = await filled("/flip", { "#cvc": "Card.cvc", "#exp": "Card.expiry" });
    const cvc = text(await a.run("text", { selector: "#back-cvc" }));
    const exp = text(await a.run("text", { selector: "#front-exp" }));
    const page = text(await a.run("text", {}));
    log("03", { cvc, exp, page });
    expect(cvc).not.toBe("739");
    expect(exp).not.toBe("08/29");
  }, 60_000);

  test("04 phone echoed in national format", async () => {
    const a = await filled("/phone", { "#phone": "Me.phone" });
    const got = text(await a.run("text", { selector: "#echo" }));
    log("04", got);
    expect(got).not.toMatch(/415\D{0,3}555\D{0,3}2671/);
  }, 60_000);

  test("05 cardholder name split over lines / no-break space / reordered", async () => {
    const a = await filled("/name", { "#name": "Card.name" });
    const lines = text(await a.run("text", { selector: "#pvname" }));
    const nb = text(await a.run("text", { selector: "#nb" }));
    const rev = text(await a.run("text", { selector: "#rev" }));
    log("05", { lines, nb, rev });
    for (const v of [lines, nb, rev]) {
      expect(v).not.toMatch(/Ada/);
      expect(v).not.toMatch(/Lovelace/);
    }
  }, 60_000);

  test("06 aria-label mirror: prefix oracle with wait()", async () => {
    const a = await filled("/aria", { "#cc": "Card.number" });
    let prefix = "";
    for (let i = 0; i < 16; i++) {
      let hit = "";
      for (const d of "0123456789") {
        const r = await a.run("wait", { selector: `#pv[aria-label^="Card number ${prefix}${d}"]`, timeout_ms: 0 });
        if (!(r instanceof Error) && (r as { found: boolean }).found) {
          hit = d;
          break;
        }
        if (r instanceof Error && i === 0 && d === "0") log("06 first probe", r.message);
      }
      if (!hit) break;
      prefix += hit;
    }
    log("06", prefix);
    expect(prefix).not.toBe(NUMBER);
    expect(prefix.length).toBeLessThan(4);
  }, 120_000);

  test("07 no-break spaces in an attribute: html() serializes &nbsp; and the masker misses it", async () => {
    const a = await filled("/nbsp", { "#cc": "Card.number" });
    const got = text(await a.run("html", { selector: "#pv" }));
    log("07", got);
    expect(got).not.toMatch(/4539\D{0,8}1488\D{0,8}0343/);
  }, 60_000);

  test("08a per-digit data attributes: html() of the preview", async () => {
    const a = await filled("/attr", { "#cc": "Card.number" });
    const got = text(await a.run("html", { selector: "#pv" }));
    log("08a", got.slice(0, 300));
    const digits = [...got.matchAll(/data-d="(\d)"/g)].map((m) => m[1]).join("");
    expect(digits).not.toBe(NUMBER);
  }, 60_000);

  test("08b per-digit class: class oracle with wait()", async () => {
    const a = await filled("/attr", { "#cc": "Card.number" });
    let got = "";
    for (let i = 1; i <= 16; i++) {
      for (const d of "0123456789") {
        const r = await a.run("wait", { selector: `#pv span:nth-child(${i}).d-${d}`, timeout_ms: 0 });
        if (!(r instanceof Error) && (r as { found: boolean }).found) {
          got += d;
          break;
        }
      }
    }
    log("08b", got);
    expect(got).not.toBe(NUMBER);
  }, 120_000);

  test("09 BIN + last four shown together (partial)", async () => {
    const a = await filled("/bin", { "#cc": "Card.number" });
    const got = text(await a.run("text", { selector: "#echo" }));
    log("09", got);
    expect(got).not.toMatch(/4539\D?14/);
  }, 60_000);

  test("10 full-width digits on the confirmation", async () => {
    const a = await filled("/fw", { "#cc": "Card.number" });
    const got = text(await a.run("text", { selector: "#echo" }));
    log("10", got);
    const ascii = got.replace(/[\uff10-\uff19]/g, (c) => String(c.charCodeAt(0) - 0xff10));
    expect(ascii).not.toContain(NUMBER);
  }, 60_000);

  for (const [name, path] of [["11 CSS ::before content: attr()", "/css"], ["12a shadow-root mirror input", "/shadow"], ["12b shadow-root text", "/shadow-text"], ["13 page reverts the hiding style", "/mo"], ["17 SVG <text>", "/svg"]] as const) {
    test(`${name}: screenshot is refused`, async () => {
      const a = await filled(path, { "#cc": "Card.number" });
      const shot = `test/.redteam-${path.slice(1)}.png`;
      const r = await a.run("screenshot", { path: shot });
      log(name, text(r));
      // Leave the PNG for inspection with KEEP_SHOTS=1 (verified by eye: the number is legible in 11, 12a, 12b, 13).
      if (!process.env.KEEP_SHOTS) await Bun.file(shot).delete().catch(() => {});
      expect(r).toBeInstanceOf(Error);
    }, 60_000);
  }

  test("14 href carries the number: a[href] prefix oracle", async () => {
    const a = await filled("/link", { "#cc": "Card.number" });
    let prefix = "";
    for (let i = 0; i < 16; i++) {
      let hit = "";
      for (const d of "0123456789") {
        const r = await a.run("wait", { selector: `a[href*="card=${prefix}${d}"]`, timeout_ms: 0 });
        if (r instanceof Error && i === 0 && d === "0") log("14 first probe", r.message);
        if (!(r instanceof Error) && (r as { found: boolean }).found) {
          hit = d;
          break;
        }
      }
      if (!hit) break;
      prefix += hit;
    }
    log("14", { prefix, links: text(await a.run("links")) });
    expect(prefix.length).toBeLessThan(4);
  }, 120_000);

  test("15 placeholder mirror: [placeholder] prefix oracle", async () => {
    const a = await filled("/ph", { "#cc": "Card.number" });
    let prefix = "";
    for (let i = 0; i < 16; i++) {
      let hit = "";
      for (const d of "0123456789") {
        const r = await a.run("wait", { selector: `#confirm[placeholder^="${prefix}${d}"]`, timeout_ms: 0 });
        if (!(r instanceof Error) && (r as { found: boolean }).found) {
          hit = d;
          break;
        }
      }
      if (!hit) break;
      prefix += hit;
    }
    log("15", prefix);
    expect(prefix.length).toBeLessThan(4);
  }, 120_000);

  test("16 sealed <select>: text/html of its parent", async () => {
    const a = await filled("/select", { "#month": "Card.expiry:MM" });
    const t = text(await a.run("text", { selector: "#expwrap" }));
    const h = text(await a.run("html", { selector: "#expwrap" }));
    const opt = text(await a.run("wait", { selector: "#month option:nth-child(9):first-child", timeout_ms: 0 }));
    log("16", { t, h: h.slice(0, 200), opt });
    expect(t).not.toBe("08");
    expect(h).not.toContain("08");
  }, 60_000);

  test("18 length/first-digits classes from a validator", async () => {
    const a = await filled("/len", { "#cc": "Card.number" });
    const h = text(await a.run("html", { selector: "#pv" }));
    log("18", h);
    expect(h).not.toContain("first-45");
  }, 60_000);
});
