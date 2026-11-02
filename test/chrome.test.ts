import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { HaloError } from "../src/runtime/errors.js";
import { CHROME_INFO, chromeProvider, closeChromeSessions, findChrome } from "../src/runtime/providers/chrome.js";
import type { ToolCall, ToolMethod, ToolServices } from "../src/runtime/tools.js";

const chrome = findChrome();

const PAGE = `<!doctype html>
<html><head><title>Form page</title></head>
<body>
  <h1 id="status">Waiting</h1>
  <form onsubmit="event.preventDefault(); document.getElementById('status').textContent = 'Hello, ' + document.getElementById('name').value;">
    <input id="name" type="text">
    <select id="color"><option value="r">Red</option><option value="g">Green</option></select>
    <button id="go" type="submit">Go</button>
  </form>
  <a id="next" href="/next">Next page</a>
  <a id="away" href="http://localhost:PORT/elsewhere">Elsewhere</a>
</body></html>`;

let server: ReturnType<typeof Bun.serve>;
let base: string;
const hits: string[] = [];

beforeAll(() => {
  if (!chrome) return;
  server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch(req) {
      const url = new URL(req.url);
      hits.push(`${url.hostname}${url.pathname}`);
      const html = url.pathname === "/next" ? `<title>Next</title><p>Second page</p>` : url.pathname === "/elsewhere" ? `<title>Elsewhere</title>` : PAGE.replace("PORT", String(server.port));
      return new Response(html, { headers: { "Content-Type": "text/html" } });
    },
  });
  base = `http://127.0.0.1:${server.port}`;
});

afterAll(async () => {
  await closeChromeSessions();
  server?.stop(true);
});

function call(method: string, named: Record<string, unknown> = {}, opts: { runId?: string; tool?: string; config?: Record<string, unknown> } = {}): ToolCall {
  const config = opts.config ?? {};
  return {
    tool: { name: opts.tool ?? "Web", provider: "Chrome", args: [], namedArgs: {}, argList: [] },
    method,
    positional: [],
    named,
    config: (k) => config[k as string],
    viaAgent: false,
    signal: new AbortController().signal,
    runId: opts.runId ?? "run-1",
  };
}

const services = {} as ToolServices;
const invoke = (c: ToolCall) => chromeProvider(c, services) as Promise<any>;

describe.skipIf(!chrome)("Chrome provider", () => {
  test("open, fill, click, text in one session", async () => {
    const page = await invoke(call("open", { url: base }));
    expect(page.title).toBe("Form page");
    expect(page.text).toContain("Waiting");

    await invoke(call("fill", { selector: "#name", value: "Ada" }));
    await invoke(call("select", { selector: "#color", value: "Green" }));
    const clicked = await invoke(call("click", { selector: "#go" }));
    expect(clicked.navigated).toBe(false);
    expect(await invoke(call("text", { selector: "#status" }))).toBe("Hello, Ada");

    const links = await invoke(call("links"));
    expect(links.map((l: any) => l.href)).toContain(`${base}/next`);
  }, 60_000);

  test("click follows a link; back returns", async () => {
    await invoke(call("open", { url: base }));
    const r = await invoke(call("click", { selector: "#next" }));
    expect(r.navigated).toBe(true);
    expect(r.title).toBe("Next");
    const back = await invoke(call("back"));
    expect(back.wentBack).toBe(true);
    expect(back.title).toBe("Form page");
  }, 60_000);

  test("screenshot to a file and as base64", async () => {
    const dir = mkdtempSync(join(process.cwd(), ".chrome-test-"));
    try {
      const rel = relative(process.cwd(), join(dir, "shot.png"));
      const saved = await invoke(call("screenshot", { path: rel }));
      expect(saved.path).toBe(rel);
      expect(saved.bytes).toBeGreaterThan(100);
      const bytes = new Uint8Array(await Bun.file(rel).arrayBuffer());
      expect([...bytes.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
      const inline = await invoke(call("screenshot"));
      expect(inline.mimeType).toBe("image/png");
      expect(inline.base64.length).toBeGreaterThan(100);
      await expect(invoke(call("screenshot", { path: join(tmpdir(), "x.png") }))).rejects.toThrow(/outside/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);

  test("allow list refuses open and blocks a clicked link to another host", async () => {
    const opts = { tool: "Safe", config: { allow: ["127.0.0.1"] } };
    await expect(invoke(call("open", { url: "https://example.com" }, opts))).rejects.toThrow(/not in allow/);
    await expect(invoke(call("open", { url: "file:///etc/passwd" }, opts))).rejects.toThrow(/only http and https/);

    await invoke(call("open", { url: base }, opts));
    hits.length = 0;
    const err = await invoke(call("click", { selector: "#away" }, opts)).catch((e) => e);
    expect(err).toBeInstanceOf(HaloError);
    expect(err.code).toBe("TOOL_ARGUMENT");
    expect(err.message).toContain("blocked navigation to http://localhost");
    // The request never reached the server, and the tab is back on the allowed page.
    expect(hits.filter((h) => h.startsWith("localhost"))).toEqual([]);
    const text = await invoke(call("text", { selector: "h1" }, opts));
    expect(text).toBe("Waiting");
  }, 60_000);

  test("one browser per (tool, runId), reused across calls", async () => {
    await invoke(call("open", { url: base }, { runId: "run-a" }));
    await invoke(call("fill", { selector: "#name", value: "kept" }, { runId: "run-a" }));
    // Same run: the page and its state are still there.
    expect(await invoke(call("evaluate", { script: "document.getElementById('name').value" }, { runId: "run-a", config: { allowScript: true } }))).toBe("kept");
    // Another run gets its own fresh browser.
    expect(await invoke(call("html", {}, { runId: "run-b" }))).not.toContain("Form page");
    await closeChromeSessions("run-b");
    expect(await invoke(call("text", { selector: "h1" }, { runId: "run-a" }))).toBe("Waiting");
  }, 60_000);

  test("evaluate needs allowScript; unknown methods and missing elements are clear errors", async () => {
    await expect(invoke(call("evaluate", { script: "1" }))).rejects.toThrow(/allowScript: true/);
    await expect(invoke(call("scroll"))).rejects.toThrow(/has no method "scroll"/);
    await invoke(call("open", { url: base }));
    await expect(invoke(call("click", { selector: "#missing", timeout_ms: 200 }))).rejects.toThrow(/no visible element/);
    expect((await invoke(call("wait", { selector: "#missing", timeout_ms: 200 }))).found).toBe(false);
  }, 60_000);

  test("closeChromeSessions removes the profile directories", async () => {
    await closeChromeSessions();
    const dirs = () => new Set(new Bun.Glob("halo-chrome-*").scanSync({ cwd: tmpdir(), onlyFiles: false }));
    const before = dirs();
    await invoke(call("text", {}, { runId: "run-c" }));
    const ours = [...dirs()].filter((d) => !before.has(d));
    expect(ours.length).toBe(1);
    await closeChromeSessions();
    expect(ours.filter((d) => existsSync(join(tmpdir(), d)))).toEqual([]);
  }, 60_000);
});

test("CHROME_INFO describes every method, and evaluate only with allowScript", async () => {
  const methods = CHROME_INFO.methods as (ctx: any, s: any) => Promise<ToolMethod[]>;
  const ctx = (allowScript?: boolean) => ({ tool: {}, config: (k: string) => (k === "allowScript" ? allowScript : undefined), signal: new AbortController().signal });
  const plain = await methods(ctx(), {});
  expect(plain.map((m) => m.name)).toEqual(["open", "click", "fill", "press", "select", "text", "html", "links", "wait", "screenshot", "back"]);
  expect(plain.find((m) => m.name === "click")!.effect).toBe("external");
  expect(plain.find((m) => m.name === "open")!.effect).toBe("read");
  for (const m of plain) expect(m.description.length).toBeGreaterThan(20);
  expect((await methods(ctx(true), {})).map((m) => m.name)).toContain("evaluate");
});

test("a missing browser is a TOOL_CONFIG error", async () => {
  const err: any = await chromeProvider(call("open", { url: "https://example.com" }, { tool: "Nope", runId: "none", config: { chrome: "/nonexistent/chrome" } }), services).catch((e: any) => e);
  expect(err).toBeInstanceOf(HaloError);
  expect(err.code).toBe("TOOL_CONFIG");
});
