/**
 * Chrome: a real headless browser, driven over the Chrome DevTools Protocol.
 *
 *   tool Web : Chrome(headless: true, allow: ["example.com", "*.example.org"])
 *
 *   |> Web.open(url: "https://example.com")       → { url, title, text }
 *   |> Web.fill(selector: "#q", value: "halo")
 *   |> Web.click(selector: "button[type=submit]")
 *   |> Web.text(selector: "main")
 *
 * Unlike Browser(), it runs the page's JavaScript and can click and type. It
 * needs Chrome, Chromium, Edge or Brave installed (or `chrome:` / CHROME_PATH),
 * and adds no npm dependency: it launches the browser with a remote-debugging
 * port and talks CDP over Bun's built-in WebSocket.
 *
 * Each (tool, run) gets its own browser with a fresh profile, kept between calls
 * so a run can open a page, fill a form and read the result. Idle browsers close
 * after `idle_ms` (default 5 minutes); `closeChromeSessions()` closes them all.
 *
 * Safety: only http(s) pages can be opened; `allow:` limits which hosts the tab
 * may be on (a click that navigates elsewhere is blocked before its request is
 * sent, and the tab returns to the previous page); new tabs and windows are
 * closed; arbitrary JavaScript (`evaluate`) needs `allowScript: true`.
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { HaloError, TimeoutError } from "../errors.js";
import type { ProviderInfo, ToolCall, ToolMethod, ToolProvider } from "../tools.js";
import { need, str, unknownMethod } from "./common.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Finding a browser ──

const CANDIDATES =
  process.platform === "darwin"
    ? [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
        "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
        "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
        "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
      ]
    : [
        "/usr/bin/google-chrome",
        "/usr/bin/google-chrome-stable",
        "/usr/bin/chromium",
        "/usr/bin/chromium-browser",
        "/snap/bin/chromium",
        "/usr/bin/microsoft-edge",
        "/usr/bin/brave-browser",
        "/opt/google/chrome/chrome",
      ];

/** The browser to launch: `explicit` (the `chrome:` arg), CHROME_PATH, a standard install, or one on PATH. */
export function findChrome(explicit?: unknown): string | undefined {
  if (typeof explicit === "string" && explicit) return explicit;
  const env = process.env.CHROME_PATH;
  if (env) return env;
  for (const p of CANDIDATES) if (existsSync(p)) return p;
  for (const name of ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable", "microsoft-edge", "brave-browser"]) {
    const p = Bun.which(name);
    if (p) return p;
  }
  return undefined;
}

// ── CDP connection ──

type Listener = (method: string, params: any, sessionId?: string) => void;

class Cdp {
  private nextId = 1;
  private pending = new Map<number, { resolve(v: any): void; reject(e: Error): void; timer: Timer }>();
  readonly listeners = new Set<Listener>();
  closed = false;

  constructor(private ws: WebSocket) {
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(String(ev.data));
      if (msg.id !== undefined) {
        const p = this.pending.get(msg.id);
        if (!p) return;
        this.pending.delete(msg.id);
        clearTimeout(p.timer);
        if (msg.error) p.reject(new HaloError(`Chrome: ${msg.error.message}${msg.error.data ? ` (${msg.error.data})` : ""}`));
        else p.resolve(msg.result ?? {});
      } else if (msg.method) {
        for (const l of this.listeners) l(msg.method, msg.params ?? {}, msg.sessionId);
      }
    });
    ws.addEventListener("close", () => this.fail(new HaloError("Chrome closed the connection")));
  }

  private fail(err: Error) {
    this.closed = true;
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(err);
    }
    this.pending.clear();
  }

  /** Send one command, failing after `timeoutMs` (every command has a timeout). */
  send(method: string, params: Record<string, unknown> = {}, sessionId?: string, timeoutMs = 30_000): Promise<any> {
    if (this.closed) return Promise.reject(new HaloError("Chrome is no longer running"));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new TimeoutError(`Chrome did not answer ${method} within ${timeoutMs}ms`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }

  close() {
    this.closed = true;
    try {
      this.ws.close();
    } catch {}
  }
}

async function connect(url: string, timeoutMs: number): Promise<WebSocket> {
  const ws = new WebSocket(url);
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(`Could not connect to Chrome at ${url}`)), timeoutMs);
    ws.addEventListener("open", () => (clearTimeout(timer), resolve()), { once: true });
    ws.addEventListener("error", () => (clearTimeout(timer), reject(new HaloError(`Could not connect to Chrome at ${url}`))), { once: true });
  });
  return ws;
}

// ── Sessions ──

interface Session {
  key: string;
  proc: ReturnType<typeof Bun.spawn>;
  dir: string;
  cdp: Cdp;
  /** The page's flattened CDP session id. */
  sid: string;
  targetId: string;
  frameId: string;
  loading: boolean;
  allow?: string[];
  /** Main-frame navigations blocked by `allow:` since the last action began. */
  blocked: string[];
  popups: string[];
  dialogs: string[];
  /** The last page the tab was on that passed the checks (where a refused navigation returns to). */
  lastGood?: string;
  idleMs: number;
  idleTimer?: Timer;
  /** Calls on one browser run one at a time. */
  queue: Promise<unknown>;
}

const sessions = new Map<string, Promise<Session>>();
let exitHookInstalled = false;

function installExitHook() {
  if (exitHookInstalled) return;
  exitHookInstalled = true;
  // Only synchronous work is possible here: kill the browsers and remove their profiles.
  process.on("exit", () => {
    for (const s of live) killSync(s);
  });
}

/** Sessions that have finished starting (the exit hook can't await the promises above). */
const live = new Set<Session>();

function killSync(s: Session) {
  try {
    s.proc.kill("SIGKILL");
  } catch {}
  try {
    rmSync(s.dir, { recursive: true, force: true });
  } catch {}
}

async function closeSession(s: Session): Promise<void> {
  live.delete(s);
  if (sessions.get(s.key)) sessions.delete(s.key);
  if (s.idleTimer) clearTimeout(s.idleTimer);
  if (!s.cdp.closed) await s.cdp.send("Browser.close", {}, undefined, 3_000).catch(() => {});
  s.cdp.close();
  const exited = await Promise.race([s.proc.exited.then(() => true), sleep(3_000).then(() => false)]);
  if (!exited) s.proc.kill("SIGKILL");
  await s.proc.exited.catch(() => {});
  rmSync(s.dir, { recursive: true, force: true });
}

/**
 * Close Chrome sessions: all of them, or just one run's (for the runtime's
 * close(), or when a run finishes).
 */
export async function closeChromeSessions(runId?: string): Promise<void> {
  const keys = [...sessions.keys()].filter((k) => runId === undefined || k.endsWith(`\0${runId}`));
  const pending = keys.map((k) => sessions.get(k)!);
  for (const k of keys) sessions.delete(k);
  await Promise.all(pending.map((p) => p.then(closeSession, () => {})));
}

function touch(s: Session) {
  if (s.idleTimer) clearTimeout(s.idleTimer);
  s.idleTimer = setTimeout(() => void closeSession(s), s.idleMs);
  s.idleTimer.unref?.();
}

function allowList(call: ToolCall): string[] | undefined {
  const a = call.config("allow");
  if (a === undefined || a === null) return undefined;
  const list = (Array.isArray(a) ? a : [a]).map((x) => str(x).trim().toLowerCase()).filter(Boolean);
  return list;
}

/** Whether `url` may be opened: http(s) only, and a host on the allow list when there is one. */
function urlAllowed(url: string, allow?: string[]): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  if (!allow) return true;
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return allow.some((p) => (p.startsWith("*.") ? host.endsWith(p.slice(1)) : host === p));
}

async function launch(call: ToolCall, key: string): Promise<Session> {
  const path = findChrome(call.config("chrome"));
  if (!path) {
    throw new HaloError(
      `Tool "${call.tool.name}" needs Chrome, Chromium, Edge or Brave installed (or its path in CHROME_PATH, or ${call.tool.provider}(chrome: "/path/to/chrome"))`,
      { code: "TOOL_CONFIG" },
    );
  }
  const dir = mkdtempSync(join(tmpdir(), "halo-chrome-"));
  const headless = call.config("headless") !== false;
  const args = [
    ...(headless ? ["--headless=new"] : []),
    "--remote-debugging-port=0",
    `--user-data-dir=${dir}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-networking",
    "--disable-sync",
    "--disable-extensions",
    "--mute-audio",
    "--window-size=1280,800",
    ...(process.platform === "linux" && process.getuid?.() === 0 ? ["--no-sandbox"] : []),
    "about:blank",
  ];
  let proc: ReturnType<typeof Bun.spawn>;
  try {
    // Chrome's stderr is kept, so a launch that fails can say why.
    proc = Bun.spawn([path, ...args], { stdin: "ignore", stdout: "ignore", stderr: "pipe" });
  } catch (e) {
    rmSync(dir, { recursive: true, force: true });
    throw new HaloError(`Tool "${call.tool.name}" could not start ${path}: ${(e as Error).message}`, { code: "TOOL_CONFIG" });
  }
  installExitHook();
  let stderr = "";
  void (async () => {
    for await (const chunk of proc.stderr as ReadableStream<Uint8Array>) stderr = (stderr + new TextDecoder().decode(chunk)).slice(-4000);
  })().catch(() => {});
  const why = () => (stderr.trim() ? `; Chrome said: ${stderr.trim().split("\n").slice(-6).join(" | ")}` : "");

  try {
    // Chrome writes its port and browser WebSocket path here once it's listening.
    const portFile = join(dir, "DevToolsActivePort");
    // A first start on a cold machine (fonts, profile, GPU probing) can take a while.
    const launchMs = Number(call.config("launch_timeout_ms") ?? 45_000);
    const deadline = Date.now() + launchMs;
    let lines: string[] = [];
    while (Date.now() < deadline) {
      if (proc.exitCode !== null) throw new HaloError(`${path} exited (code ${proc.exitCode}) before it was ready${why()}`, { code: "TOOL_CONFIG" });
      if (existsSync(portFile)) {
        lines = readFileSync(portFile, "utf8").trim().split("\n");
        if (lines.length >= 2) break;
      }
      await sleep(50);
    }
    if (lines.length < 2) throw new TimeoutError(`${path} did not open a debugging port within ${Math.round(launchMs / 1000)}s (launch_timeout_ms)${why()}`);
    const cdp = new Cdp(await connect(`ws://127.0.0.1:${lines[0]}${lines[1]}`, 10_000));

    const { targetInfos } = await cdp.send("Target.getTargets");
    const page = (targetInfos as any[]).find((t) => t.type === "page");
    const targetId: string = page?.targetId ?? (await cdp.send("Target.createTarget", { url: "about:blank" })).targetId;
    const { sessionId: sid } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });

    const s: Session = {
      key,
      proc,
      dir,
      cdp,
      sid,
      targetId,
      frameId: targetId,
      loading: false,
      allow: allowList(call),
      blocked: [],
      popups: [],
      dialogs: [],
      idleMs: Number(call.config("idle_ms") ?? 300_000),
      queue: Promise.resolve(),
    };

    cdp.listeners.add((method, p, sessionId) => {
      if (method === "Target.targetCreated" && p.targetInfo?.type === "page" && p.targetInfo.targetId !== s.targetId) {
        // A new tab or window (target=_blank, window.open): close it, and report where it went.
        s.popups.push(p.targetInfo.url || "about:blank");
        void cdp.send("Target.closeTarget", { targetId: p.targetInfo.targetId }).catch(() => {});
        return;
      }
      if (sessionId !== s.sid) return;
      if (method === "Page.frameStartedLoading" && p.frameId === s.frameId) s.loading = true;
      else if (method === "Page.frameStoppedLoading" && p.frameId === s.frameId) s.loading = false;
      else if (method === "Page.javascriptDialogOpening") {
        // Alerts are accepted; confirm() and prompt() are dismissed, so a dialog can't approve anything.
        s.dialogs.push(`${p.type}: ${p.message}`);
        void cdp.send("Page.handleJavaScriptDialog", { accept: p.type === "alert" || p.type === "beforeunload" }, s.sid).catch(() => {});
      } else if (method === "Fetch.requestPaused") {
        // Navigations to hosts outside `allow:` are refused before the request leaves the browser.
        const main = !p.frameId || p.frameId === s.frameId;
        if (!main || urlAllowed(p.request.url, s.allow)) {
          void cdp.send("Fetch.continueRequest", { requestId: p.requestId }, s.sid).catch(() => {});
        } else {
          s.blocked.push(p.request.url);
          void cdp.send("Fetch.failRequest", { requestId: p.requestId, errorReason: "BlockedByClient" }, s.sid).catch(() => {});
        }
      }
    });

    await cdp.send("Target.setDiscoverTargets", { discover: true });
    await cdp.send("Page.enable", {}, sid);
    const tree = await cdp.send("Page.getFrameTree", {}, sid);
    s.frameId = tree.frameTree?.frame?.id ?? targetId;
    if (s.allow) await cdp.send("Fetch.enable", { patterns: [{ urlPattern: "*", resourceType: "Document", requestStage: "Request" }] }, sid);
    live.add(s);
    return s;
  } catch (e) {
    proc.kill("SIGKILL");
    await proc.exited.catch(() => {});
    rmSync(dir, { recursive: true, force: true });
    throw e;
  }
}

async function session(call: ToolCall): Promise<Session> {
  const key = `${call.tool.name}\0${call.runId ?? ""}`;
  let p = sessions.get(key);
  if (p) {
    const s = await p.catch(() => undefined);
    if (s && !s.cdp.closed && s.proc.exitCode === null) return s;
    sessions.delete(key);
    if (s) await closeSession(s).catch(() => {});
  }
  p = launch(call, key);
  sessions.set(key, p);
  p.catch(() => sessions.get(key) === p && sessions.delete(key));
  return p;
}

// ── Page helpers ──

interface Ctx {
  call: ToolCall;
  s: Session;
  /** Per-command timeout, and how long navigations may take. */
  timeoutMs: number;
}

function abortable<T>(signal: AbortSignal, p: Promise<T>): Promise<T> {
  if (signal.aborted) return Promise.reject(signal.reason ?? new HaloError("Aborted"));
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason ?? new HaloError("Aborted"));
    signal.addEventListener("abort", onAbort, { once: true });
    p.then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
  });
}

function send(c: Ctx, method: string, params: Record<string, unknown> = {}): Promise<any> {
  return abortable(c.call.signal, c.s.cdp.send(method, params, c.s.sid, c.timeoutMs));
}

/** Run an expression in the page and return its value (JSON-serializable). */
async function evaluate(c: Ctx, expression: string): Promise<any> {
  const r = await send(c, "Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true, userGesture: true });
  if (r.exceptionDetails) {
    const d = r.exceptionDetails;
    throw new HaloError(`${c.call.tool.name}.${c.call.method}: the page threw ${d.exception?.description ?? d.text ?? "an error"}`);
  }
  return r.result?.value;
}

async function currentUrl(c: Ctx): Promise<string> {
  const h = await send(c, "Page.getNavigationHistory");
  return h.entries?.[h.currentIndex]?.url ?? "about:blank";
}

/** Wait for the main frame to stop loading (a navigation started by an action, or open()). */
async function settle(c: Ctx, graceMs = 150): Promise<void> {
  await abortable(c.call.signal, sleep(graceMs));
  const deadline = Date.now() + c.timeoutMs;
  while (c.s.loading && Date.now() < deadline) await abortable(c.call.signal, sleep(50));
  if (c.s.loading) throw new TimeoutError(`${c.call.tool.name}: the page did not finish loading within ${c.timeoutMs}ms`);
}

/**
 * After every action: if the tab ended up somewhere it may not be (a blocked
 * navigation, or a non-http page), return to the previous page and refuse.
 */
async function checkLocation(c: Ctx): Promise<void> {
  const url = await currentUrl(c);
  const blocked = c.s.blocked.splice(0);
  if (!blocked.length && (url === "about:blank" || urlAllowed(url, c.s.allow))) {
    if (url !== "about:blank") c.s.lastGood = url;
    return;
  }
  const target = blocked[0] ?? url;
  if (url !== c.s.lastGood) {
    if (c.s.lastGood) {
      await send(c, "Page.navigate", { url: c.s.lastGood });
      await settle(c);
    } else {
      await send(c, "Page.navigate", { url: "about:blank" });
    }
    c.s.blocked.length = 0;
  }
  const why = c.s.allow ? `its host is not in allow: [${c.s.allow.join(", ")}]` : "only http and https pages can be opened";
  throw new HaloError(`${c.call.tool.name}.${c.call.method}: blocked navigation to ${target}, ${why}`, { code: "TOOL_ARGUMENT" });
}

function maxChars(c: Ctx): number {
  return Number(c.call.named.maxChars ?? c.call.config("maxChars") ?? 15_000);
}

function cap(text: string, n: number): string {
  return text.length > n ? `${text.slice(0, n)}…` : text;
}

async function summary(c: Ctx, withText: boolean): Promise<Record<string, unknown>> {
  const page = await evaluate(c, `({ url: location.href, title: document.title, text: ${withText ? "(document.body ? document.body.innerText : '')" : "''"} })`);
  const out: Record<string, unknown> = { url: page.url, title: page.title };
  if (withText) out.text = cap(String(page.text).replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim(), maxChars(c));
  if (c.s.popups.length) out.closedPopups = c.s.popups.splice(0);
  if (c.s.dialogs.length) out.dialogs = c.s.dialogs.splice(0);
  return out;
}

/** In-page lookup of one element by CSS selector: whether it exists, is visible, and its center. */
function locate(selector: string): string {
  return `(() => {
    let el;
    try { el = document.querySelector(${JSON.stringify(selector)}); } catch (e) { return { error: String(e.message) }; }
    if (!el) return { found: false };
    el.scrollIntoView({ block: "center", inline: "center" });
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    const visible = r.width > 0 && r.height > 0 && st.visibility !== "hidden" && st.display !== "none";
    return { found: true, visible, x: r.left + r.width / 2, y: r.top + r.height / 2, tag: el.tagName.toLowerCase() };
  })()`;
}

/** Wait (up to `waitMs`) for a visible element matching `selector`. */
async function waitFor(c: Ctx, selector: string, waitMs: number): Promise<{ found: boolean; x?: number; y?: number; tag?: string }> {
  const deadline = Date.now() + waitMs;
  for (;;) {
    const r = await evaluate(c, locate(selector));
    if (r.error) throw new HaloError(`${c.call.tool.name}.${c.call.method}: "${selector}" is not a valid CSS selector (${r.error})`, { code: "TOOL_ARGUMENT" });
    if (r.found && r.visible) return r;
    if (Date.now() >= deadline) return { found: false };
    await abortable(c.call.signal, sleep(100));
  }
}

async function element(c: Ctx, selector: string) {
  const waitMs = Number(c.call.named.timeout_ms ?? 5_000);
  const r = await waitFor(c, selector, waitMs);
  if (!r.found) throw new HaloError(`${c.call.tool.name}.${c.call.method}: no visible element matches "${selector}" on ${await currentUrl(c)}`, { code: "TOOL_ARGUMENT" });
  return r as { found: true; x: number; y: number; tag: string };
}

const KEYS: Record<string, { code: string; keyCode: number; text?: string }> = {
  Enter: { code: "Enter", keyCode: 13, text: "\r" },
  Tab: { code: "Tab", keyCode: 9 },
  Escape: { code: "Escape", keyCode: 27 },
  Backspace: { code: "Backspace", keyCode: 8 },
  Delete: { code: "Delete", keyCode: 46 },
  Space: { code: "Space", keyCode: 32, text: " " },
  ArrowLeft: { code: "ArrowLeft", keyCode: 37 },
  ArrowUp: { code: "ArrowUp", keyCode: 38 },
  ArrowRight: { code: "ArrowRight", keyCode: 39 },
  ArrowDown: { code: "ArrowDown", keyCode: 40 },
  Home: { code: "Home", keyCode: 36 },
  End: { code: "End", keyCode: 35 },
  PageUp: { code: "PageUp", keyCode: 33 },
  PageDown: { code: "PageDown", keyCode: 34 },
};

/** A selector argument: `selector:`, or an explicit first positional arg (never the pipeline value). */
function selectorArg(call: ToolCall): string | undefined {
  const v = call.named.selector ?? (call.implicitInput ? undefined : call.positional[0]);
  return v === undefined || v === null || v === "" ? undefined : str(v);
}

/** Screenshots are written under the current directory, like File(). */
function screenshotPath(call: ToolCall, raw: string): string {
  const root = process.cwd();
  const full = resolve(root, raw);
  if (isAbsolute(relative(root, full)) || relative(root, full).split(sep)[0] === "..") {
    throw new HaloError(`${call.tool.name}.screenshot: "${raw}" is outside ${root}`, { code: "TOOL_ARGUMENT" });
  }
  return full.toLowerCase().endsWith(".png") ? full : `${full}.png`;
}

// ── Methods ──

const METHODS = ["open", "click", "fill", "press", "select", "text", "html", "links", "wait", "screenshot", "back", "evaluate"];

async function run(c: Ctx): Promise<unknown> {
  const { call, s } = c;
  switch (call.method) {
    case "open":
    case "goto":
    case "navigate": {
      const raw = need(call, "a url", call.named.url ?? call.positional[0]).trim();
      const url = /^[a-z][a-z0-9+.-]*:/i.test(raw) && !/^[^:/]+:\d/.test(raw) ? raw : `https://${raw}`;
      if (!urlAllowed(url, s.allow)) {
        const why = !/^https?:/i.test(url) ? "only http and https pages can be opened" : `its host is not in allow: [${s.allow!.join(", ")}]`;
        throw new HaloError(`${call.tool.name}.open: refused ${url}, ${why}`, { code: "TOOL_ARGUMENT" });
      }
      s.blocked.length = 0;
      const r = await send(c, "Page.navigate", { url });
      if (r.errorText && !s.blocked.length) {
        throw new HaloError(`${call.tool.name}.open could not load ${url} (${r.errorText})`, { retryable: true });
      }
      if (r.loaderId) await settle(c, 50);
      await checkLocation(c);
      return summary(c, true);
    }

    case "click": {
      const selector = need(call, "selector:", selectorArg(call));
      const el = await element(c, selector);
      const before = await currentUrl(c);
      const mouse = { x: el.x, y: el.y, button: "left", clickCount: 1 };
      await send(c, "Input.dispatchMouseEvent", { type: "mouseMoved", x: el.x, y: el.y });
      await send(c, "Input.dispatchMouseEvent", { type: "mousePressed", ...mouse });
      await send(c, "Input.dispatchMouseEvent", { type: "mouseReleased", ...mouse });
      await settle(c);
      await checkLocation(c);
      const after = await summary(c, false);
      return { clicked: selector, navigated: after.url !== before, ...after };
    }

    case "fill":
    case "type": {
      const selector = need(call, "selector:", selectorArg(call));
      const value = str(call.named.value ?? call.named.text ?? (call.implicitInput ? undefined : call.positional[1]) ?? "");
      await element(c, selector);
      // Focus and clear the field in the page, then type the value as real input (so frameworks see it).
      const ok = await evaluate(
        c,
        `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.focus();
          if ("value" in el) { el.value = ""; el.dispatchEvent(new Event("input", { bubbles: true })); }
          else if (el.isContentEditable) { el.textContent = ""; }
          return true; })()`,
      );
      if (!ok) throw new HaloError(`${call.tool.name}.fill: no element matches "${selector}"`, { code: "TOOL_ARGUMENT" });
      if (value) await send(c, "Input.insertText", { text: value });
      await evaluate(c, `document.activeElement && document.activeElement.dispatchEvent(new Event("change", { bubbles: true }))`);
      await settle(c, 50);
      await checkLocation(c);
      return { filled: selector, value, ...(await summary(c, false)) };
    }

    case "press": {
      const key = need(call, `key: (e.g. "Enter", "Tab", "a")`, call.named.key ?? (call.implicitInput ? undefined : call.positional[0]));
      const selector = typeof call.named.selector === "string" ? call.named.selector : undefined;
      if (selector) {
        await element(c, selector);
        await evaluate(c, `document.querySelector(${JSON.stringify(selector)}).focus()`);
      }
      const known = KEYS[key];
      if (!known && [...key].length !== 1) {
        throw new HaloError(`${call.tool.name}.press: unknown key "${key}" (use a single character or ${Object.keys(KEYS).join(", ")})`, { code: "TOOL_ARGUMENT" });
      }
      const desc = known ?? { code: "", keyCode: key.toUpperCase().charCodeAt(0), text: key };
      const base = { key: key === "Space" ? " " : key, code: desc.code, windowsVirtualKeyCode: desc.keyCode };
      await send(c, "Input.dispatchKeyEvent", { type: desc.text ? "keyDown" : "rawKeyDown", ...base, ...(desc.text ? { text: desc.text } : {}) });
      await send(c, "Input.dispatchKeyEvent", { type: "keyUp", ...base });
      await settle(c);
      await checkLocation(c);
      return { pressed: key, ...(await summary(c, false)) };
    }

    case "select": {
      const selector = need(call, "selector:", selectorArg(call));
      const value = need(call, "value:", call.named.value ?? (call.implicitInput ? undefined : call.positional[1]));
      await element(c, selector);
      const r = await evaluate(
        c,
        `(() => { const el = document.querySelector(${JSON.stringify(selector)});
          if (!el || el.tagName !== "SELECT") return { error: "not a <select>" };
          const v = ${JSON.stringify(value)};
          const opt = [...el.options].find((o) => o.value === v) || [...el.options].find((o) => o.label.trim() === v || o.text.trim() === v);
          if (!opt) return { error: "no option " + JSON.stringify(v), options: [...el.options].map((o) => o.value) };
          el.value = opt.value;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
          return { value: opt.value, label: opt.label }; })()`,
      );
      if (r.error) throw new HaloError(`${call.tool.name}.select: "${selector}" has ${r.error}${r.options ? ` (options: ${r.options.join(", ")})` : ""}`, { code: "TOOL_ARGUMENT" });
      await settle(c, 50);
      await checkLocation(c);
      return { selected: r.value, label: r.label, ...(await summary(c, false)) };
    }

    case "text":
    case "html": {
      const selector = selectorArg(call);
      const prop = call.method === "text" ? "innerText" : "outerHTML";
      if (selector) await element(c, selector);
      const v = await evaluate(c, `(() => { const el = ${selector ? `document.querySelector(${JSON.stringify(selector)})` : call.method === "text" ? "document.body" : "document.documentElement"}; return el ? el.${prop} : ""; })()`);
      let out = String(v ?? "");
      if (call.method === "text") out = out.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
      return cap(out, maxChars(c));
    }

    case "links": {
      const limit = Number(call.named.limit ?? 200);
      return evaluate(
        c,
        `(() => { const seen = new Set(); const out = [];
          for (const a of document.querySelectorAll("a[href]")) {
            if (!/^https?:/.test(a.href) || seen.has(a.href)) continue;
            seen.add(a.href); out.push({ text: (a.innerText || a.title || "").trim().replace(/\\s+/g, " ").slice(0, 200), href: a.href });
            if (out.length >= ${limit}) break;
          } return out; })()`,
      );
    }

    case "wait": {
      const selector = need(call, "selector:", selectorArg(call));
      const waitMs = Number(call.named.timeout_ms ?? 10_000);
      const t0 = Date.now();
      const r = await waitFor(c, selector, waitMs);
      return { selector, found: r.found, waited_ms: Date.now() - t0 };
    }

    case "screenshot": {
      const fullPage = call.named.fullPage === true || call.named.full_page === true;
      const shot = await send(c, "Page.captureScreenshot", { format: "png", captureBeyondViewport: fullPage });
      const raw = call.named.path ?? (call.implicitInput ? undefined : call.positional[0]);
      if (raw === undefined || raw === null || raw === "") return { mimeType: "image/png", base64: shot.data };
      const path = screenshotPath(call, str(raw));
      mkdirSync(dirname(path), { recursive: true });
      const bytes = await Bun.write(path, Buffer.from(shot.data, "base64"));
      return { path: relative(process.cwd(), path), bytes };
    }

    case "back": {
      const h = await send(c, "Page.getNavigationHistory");
      const prev = h.entries?.[h.currentIndex - 1];
      if (!prev) return { wentBack: false, ...(await summary(c, false)) };
      await send(c, "Page.navigateToHistoryEntry", { entryId: prev.id });
      await settle(c);
      await checkLocation(c);
      return { wentBack: true, ...(await summary(c, false)) };
    }

    case "evaluate": {
      if (call.config("allowScript") !== true) {
        throw new HaloError(`${call.tool.name}.evaluate runs arbitrary JavaScript; declare the tool with allowScript: true to enable it`, { code: "TOOL_METHOD" });
      }
      const script = need(call, "script:", call.named.script ?? (call.implicitInput ? undefined : call.positional[0]));
      const value = await evaluate(c, script);
      await settle(c, 50);
      await checkLocation(c);
      return value === undefined ? null : value;
    }

    default:
      return unknownMethod(call, METHODS.filter((m) => m !== "evaluate" || call.config("allowScript") === true));
  }
}

export const chromeProvider: ToolProvider = async (call) => {
  if (call.method === "evaluate" && call.config("allowScript") !== true) {
    // Refuse before launching a browser.
    throw new HaloError(`${call.tool.name}.evaluate runs arbitrary JavaScript; declare the tool with allowScript: true to enable it`, { code: "TOOL_METHOD" });
  }
  if (!METHODS.includes(call.method) && !["goto", "navigate", "type"].includes(call.method)) unknownMethod(call, METHODS.filter((m) => m !== "evaluate"));
  const s = await session(call);
  const c: Ctx = { call, s, timeoutMs: Number(call.config("timeout_ms") ?? 30_000) };
  // Calls on one browser run one at a time (an agent may call tools in parallel).
  const result = s.queue.then(async () => {
    touch(s);
    try {
      return await run(c);
    } finally {
      touch(s);
    }
  });
  s.queue = result.catch(() => {});
  return result;
};

// ── Description for agents and `halo plan` ──

const selectorParam = { type: "string", description: "A CSS selector, e.g. \"#email\", \"button[type=submit]\", \"a[href*='pricing']\"" };
const timeoutParam = { type: "number", description: "How long to wait for the element to appear, in milliseconds (default 5000)" };

const CHROME_METHODS: ToolMethod[] = [
  {
    name: "open",
    description: "Open a web page in the browser tab and wait for it to load. Runs the page's JavaScript. Returns { url, title, text } with the page's readable text.",
    params: { type: "object", properties: { url: { type: "string", description: "The http(s) URL to open" } }, required: ["url"] },
    effect: "read",
  },
  {
    name: "click",
    description: "Click the first visible element matching a CSS selector, as a real mouse click (it may follow a link or submit a form). Waits for any navigation it causes. Returns { clicked, navigated, url, title }.",
    params: { type: "object", properties: { selector: selectorParam, timeout_ms: timeoutParam }, required: ["selector"] },
    effect: "external",
  },
  {
    name: "fill",
    description: "Clear a text field (input, textarea or contenteditable) and type a value into it. Returns { filled, value, url, title }.",
    params: { type: "object", properties: { selector: selectorParam, value: { type: "string", description: "The text to type" }, timeout_ms: timeoutParam }, required: ["selector", "value"] },
    effect: "external",
  },
  {
    name: "press",
    description: `Press a key in the page, e.g. "Enter" to submit the focused form. Keys: a single character or ${Object.keys(KEYS).join(", ")}. With selector, focuses that element first.`,
    params: { type: "object", properties: { key: { type: "string", description: "The key to press" }, selector: selectorParam }, required: ["key"] },
    effect: "external",
  },
  {
    name: "select",
    description: "Choose an option in a <select> dropdown, by its value or its visible label. Returns { selected, label, url, title }.",
    params: { type: "object", properties: { selector: selectorParam, value: { type: "string", description: "The option's value or visible label" } }, required: ["selector", "value"] },
    effect: "external",
  },
  {
    name: "text",
    description: "Get the readable text of the current page, or of the first element matching a selector.",
    params: { type: "object", properties: { selector: { ...selectorParam, description: "Optional CSS selector; the whole page when omitted" } } },
    effect: "read",
  },
  {
    name: "html",
    description: "Get the HTML of the current page, or the outer HTML of the first element matching a selector.",
    params: { type: "object", properties: { selector: { ...selectorParam, description: "Optional CSS selector; the whole page when omitted" } } },
    effect: "read",
  },
  {
    name: "links",
    description: "List the links on the current page as [{ text, href }] (http(s) links only, without duplicates).",
    params: { type: "object", properties: { limit: { type: "number", description: "At most this many links (default 200)" } } },
    effect: "read",
  },
  {
    name: "wait",
    description: "Wait until an element matching a selector is visible (e.g. after content loads). Returns { selector, found, waited_ms }; found is false if it timed out.",
    params: { type: "object", properties: { selector: selectorParam, timeout_ms: { type: "number", description: "How long to wait, in milliseconds (default 10000)" } }, required: ["selector"] },
    effect: "read",
  },
  {
    name: "screenshot",
    description: "Take a PNG screenshot of the page. With path, saves it (under the current directory) and returns { path, bytes }; otherwise returns { mimeType, base64 }.",
    params: { type: "object", properties: { path: { type: "string", description: "Where to save the PNG, e.g. \"shots/home.png\"" }, fullPage: { type: "boolean", description: "Capture the whole page, not just the visible part" } } },
    effect: "read",
  },
  {
    name: "back",
    description: "Go back to the previous page in the tab's history. Returns { wentBack, url, title }.",
    params: { type: "object", properties: {} },
    effect: "external",
  },
];

const EVALUATE_METHOD: ToolMethod = {
  name: "evaluate",
  description: "Run a JavaScript expression in the page and return its (JSON-serializable) value. Promises are awaited.",
  params: { type: "object", properties: { script: { type: "string", description: "A JavaScript expression, e.g. \"document.querySelectorAll('li').length\"" } }, required: ["script"] },
  effect: "external",
};

export const CHROME_INFO: ProviderInfo = {
  description: "A headless Chrome browser tab: open pages (running their JavaScript), click, fill forms, read text, take screenshots.",
  // evaluate is listed only for a tool declared with allowScript: true.
  methods: async (ctx) => (ctx.config("allowScript") === true ? [...CHROME_METHODS, EVALUATE_METHOD] : CHROME_METHODS),
};
