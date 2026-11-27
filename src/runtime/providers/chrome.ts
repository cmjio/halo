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
 * and adds no npm dependency: it launches the browser with --remote-debugging-pipe
 * and talks CDP over that pipe (no TCP port another process could attach to).
 *
 * Each (tool, run) gets its own browser with a fresh profile, kept between calls
 * so a run can open a page, fill a form and read the result. Idle browsers close
 * after `idle_ms` (default 5 minutes); `closeChromeSessions()` closes them all.
 *
 * Safety: only http(s) pages can be opened; `allow:` limits which hosts the tab
 * may be on (a click that navigates elsewhere is blocked before its request is
 * sent, and the tab returns to the previous page); new tabs and windows are
 * closed; arbitrary JavaScript (`evaluate`) needs `allowScript: true`. Halo's own
 * page code runs in an isolated world, so a page can't change what it sees.
 *
 * Frames: element methods take `frame:`, a selector for an <iframe> in the page
 * (or a list, for nested frames). Cross-site frames run in their own process and
 * are reached through their own DevTools session.
 *
 * The wallet (`wallet: [Card, Me]`, see ../wallet.ts): `fill_secrets` types values
 * from Vault items into elements that pass every check, after a person approves,
 * and the session is then armed: what it typed is sealed (never read back, matched
 * by a selector, or shown in a screenshot), selectors are limited to ones that
 * can't depend on a field's contents, and each submission asks first.
 */

import { MediaBytes } from "../media.js";
import { closeSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readlinkSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { HaloError, TimeoutError } from "../errors.js";
import type { ProviderInfo, ToolCall, ToolMethod, ToolProvider, ToolServices } from "../tools.js";
import { declineReason, isApproval } from "../values.js";
import {
  formatProblem,
  formatValue,
  hostMatches,
  isLoopback,
  parseRef,
  readWalletValue,
  refName,
  registrableDomain,
  tokenAgrees,
  TypedValues,
  NORMALIZE_SOURCE,
  DIGITS_SOURCE,
  walletAllows,
  walletFieldInfo,
  walletPatternMatches,
  type WalletItem,
  type WalletRef,
} from "../wallet.js";
import { need, str, unknownMethod } from "./common.js";
import { checkArmedSelector } from "./selector.js";

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

/**
 * CDP over the pipe Chrome opens with --remote-debugging-pipe: Halo writes to the browser's fd 3 and
 * reads its fd 4, each message JSON ending in a NUL byte. There is no TCP listener and no
 * DevToolsActivePort file, so no other process on the machine can attach to the browser (and read
 * what a page was typed into).
 */
class Cdp {
  private nextId = 1;
  private pending = new Map<number, { resolve(v: any): void; reject(e: Error): void; timer: Timer }>();
  readonly listeners = new Set<Listener>();
  closed = false;
  private sink: ReturnType<ReturnType<typeof Bun.file>["writer"]>;

  /** `toChrome` and `fromChrome` are this process's ends of the browser's fd 3 and fd 4. */
  constructor(
    private toChrome: number,
    private fromChrome: number,
  ) {
    this.sink = Bun.file(toChrome).writer();
    void this.read();
  }

  private async read() {
    const decoder = new TextDecoder();
    let buf = "";
    try {
      for await (const chunk of Bun.file(this.fromChrome).stream()) {
        let from = buf.length;
        buf += decoder.decode(chunk, { stream: true });
        for (let i = buf.indexOf("\0", from); i >= 0; i = buf.indexOf("\0", from)) {
          const raw = buf.slice(0, i);
          buf = buf.slice(i + 1);
          from = 0;
          if (raw) this.dispatch(raw);
        }
      }
    } catch {}
    // The browser closed its end (it exited): fail what's waiting, and release both descriptors.
    this.fail(new HaloError("Chrome closed the connection"));
    try {
      await this.sink.end();
    } catch {}
    for (const fd of [this.toChrome, this.fromChrome]) {
      try {
        closeSync(fd);
      } catch {}
    }
  }

  private dispatch(raw: string) {
    let msg: any;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
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
      try {
        this.sink.write(`${JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })}\0`);
        void Promise.resolve(this.sink.flush()).catch(() => {});
      } catch (e) {
        this.pending.delete(id);
        clearTimeout(timer);
        reject(new HaloError(`Chrome: could not send ${method}: ${(e as Error).message}`));
      }
    });
  }

  /** Stop sending; the descriptors are released once the browser exits and its end closes. */
  close() {
    this.closed = true;
  }
}

// ── Sessions ──

/** A frame Halo can run code in: the DevTools session that holds it, and its frame id. */
interface Frame {
  sid: string;
  frameId: string;
}

/** A filled element, sealed for the rest of the session. */
interface Sealed {
  sid: string;
  frameId: string;
  backendNodeId: number;
  ref: string;
  item: string;
}

/** What an armed session has typed and must keep sealed. Values stay in memory only, and are dropped on disarm. */
interface WalletState {
  typed: TypedValues;
  sealed: Sealed[];
  /** Frames sealed whole (payment frames a secret was typed into), by frame id. */
  sealedFrames: Map<string, { item: string; host: string }>;
  /** The items typed, so the session disarms when the page leaves all their hosts. */
  items: Map<string, WalletItem>;
  /** Submissions approved so far: each approval allows one. */
  submits: number;
  /** The top page's documents a value was typed into: while one is still loaded, a submission asks. */
  documents: Set<string>;
  /**
   * Set once a secret item (a card, a passport) is typed: the browser then belongs to the person.
   * The agent can only hand_over; nothing on the page can be read, queried, clicked or typed, since
   * a page can re-encode a value in more ways than any mask can follow.
   */
  locked?: { items: string[]; host: string };
}

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
  /** While a person is being asked to approve something, the browser stays open until this time. */
  holdUntil?: number;
  /** Calls on one browser run one at a time. */
  queue: Promise<unknown>;
  /** Cross-site frames (out-of-process iframes), by frame id: their session and URL. */
  children: Map<string, { sid: string; url: string }>;
  /** Set once a wallet value has been typed. */
  wallet?: WalletState;
  /** Hand-overs so far, so each one is its own question. */
  handovers: number;
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
  disarm(s);
  try {
    s.proc.kill("SIGKILL");
  } catch {}
  try {
    rmSync(s.dir, { recursive: true, force: true });
  } catch {}
}

async function closeSession(s: Session): Promise<void> {
  live.delete(s);
  disarm(s);
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
  // While a person is being asked (or a run is paused for their answer), the page they approve stays open.
  const held = s.holdUntil !== undefined ? s.holdUntil - Date.now() : 0;
  s.idleTimer = setTimeout(() => void closeSession(s), Math.max(s.idleMs, held));
  s.idleTimer.unref?.();
}

function allowList(call: ToolCall): string[] | undefined {
  const a = call.config("allow");
  if (a === undefined || a === null) return undefined;
  const list = (Array.isArray(a) ? a : [a]).map((x) => str(x).trim().toLowerCase()).filter(Boolean);
  return list;
}

/**
 * Whether `url` may be opened (exported for tests): http(s) only, and a host on the allow list when there is one.
 * `debugPort` refuses a DevTools endpoint on this machine; Halo's own browsers have none (they talk over a pipe).
 */
export function urlAllowed(url: string, allow?: string[], debugPort?: number): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  if (debugPort && Number(u.port || 80) === debugPort && isLoopback(u.hostname.replace(/^\[|\]$/g, ""))) return false;
  if (!allow) return true;
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return allow.some((p) => (p.startsWith("*.") ? host.endsWith(p.slice(1)) : host === p));
}

/** The Vault names a declaration's `wallet:` lists (resolved refs to declared tools are their names). */
function walletConfig(call: Pick<ToolCall, "config">): string[] | undefined {
  const w = call.config("wallet");
  if (w === undefined || w === null) return undefined;
  return (Array.isArray(w) ? w : [w]).map((x) => str(x));
}

/**
 * Profiles left in the temp folder by a Halo that was killed before it could remove them: a profile
 * whose browser isn't running any more (its SingletonLock names a dead process), or with no lock and
 * untouched for an hour. They can hold what a page was typed into, so they don't stay.
 */
let swept = false;
export function sweepStaleProfiles(root = tmpdir()): number {
  let removed = 0;
  let names: string[];
  try {
    names = readdirSync(root).filter((n) => n.startsWith("halo-chrome-"));
  } catch {
    return 0;
  }
  for (const n of names) {
    const dir = join(root, n);
    if ([...live].some((s) => s.dir === dir)) continue;
    let stale = false;
    try {
      const lock = readlinkSync(join(dir, "SingletonLock"));
      const pid = Number(lock.slice(lock.lastIndexOf("-") + 1));
      if (Number.isInteger(pid) && pid > 0) {
        try {
          process.kill(pid, 0);
        } catch (e) {
          // EPERM: it exists, and belongs to someone else. Only "no such process" is gone.
          stale = (e as { code?: string }).code === "ESRCH";
        }
      }
    } catch {
      try {
        stale = Date.now() - statSync(dir).mtimeMs > 3_600_000;
      } catch {}
    }
    if (stale) {
      try {
        rmSync(dir, { recursive: true, force: true });
        removed++;
      } catch {}
    }
  }
  return removed;
}

async function launch(call: ToolCall, key: string): Promise<Session> {
  const path = findChrome(call.config("chrome"));
  if (!path) {
    throw new HaloError(
      `Tool "${call.tool.name}" needs Chrome, Chromium, Edge or Brave installed (or its path in CHROME_PATH, or ${call.tool.provider}(chrome: "/path/to/chrome"))`,
      { code: "TOOL_CONFIG" },
    );
  }
  const wallet = walletConfig(call) !== undefined;
  if (wallet && !swept) {
    swept = true;
    sweepStaleProfiles();
  }
  const dir = mkdtempSync(join(tmpdir(), "halo-chrome-"));
  if (wallet) {
    // A browser that types wallet values saves none of what it types: no autofill, no form history, no saved cards or passwords.
    mkdirSync(join(dir, "Default"), { recursive: true });
    writeFileSync(
      join(dir, "Default", "Preferences"),
      JSON.stringify({
        autofill: { enabled: false, profile_enabled: false, credit_card_enabled: false },
        credentials_enable_service: false,
        profile: { password_manager_enabled: false },
        payments: { can_make_payment_enabled: false },
      }),
    );
  }
  // HALO_TEST_HEADLESS=1 runs a headless: false browser out of sight, for tests; nothing else changes.
  const headless = call.config("headless") !== false || process.env.HALO_TEST_HEADLESS === "1";
  const args = [
    ...(headless ? ["--headless=new"] : []),
    // CDP over fds 3 and 4: no TCP listener, no DevToolsActivePort file.
    "--remote-debugging-pipe",
    `--user-data-dir=${dir}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-networking",
    "--disable-sync",
    "--disable-extensions",
    "--mute-audio",
    "--window-size=1280,800",
    // Incognito: no session file, history or disk cache, so a page's typed state is never written to disk (Chrome
    // saves open pages' form contents for session restore otherwise, on a timer).
    ...(wallet ? ["--incognito", "--disable-features=AutofillServerCommunication,AutofillEnableAccountWalletStorage", "--disk-cache-size=1", "--disable-session-crashed-bubble"] : []),
    ...(process.platform === "linux" && process.getuid?.() === 0 ? ["--no-sandbox"] : []),
    "about:blank",
  ];
  let proc: ReturnType<typeof Bun.spawn>;
  try {
    // Chrome's stderr is kept, so a launch that fails can say why. fd 3 is what Chrome reads, fd 4 what it writes.
    proc = Bun.spawn([path, ...args], { stdio: ["ignore", "ignore", "pipe", "pipe", "pipe"], env: { ...process.env } });
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

  const [toChrome, fromChrome] = [proc.stdio[3], proc.stdio[4]];
  if (typeof toChrome !== "number" || typeof fromChrome !== "number") {
    proc.kill("SIGKILL");
    await proc.exited.catch(() => {});
    rmSync(dir, { recursive: true, force: true });
    throw new HaloError(`Tool "${call.tool.name}" could not open a DevTools pipe to ${path}`, { code: "TOOL_CONFIG" });
  }
  const cdp = new Cdp(toChrome, fromChrome);

  try {
    // A first start on a cold machine (fonts, profile, GPU probing) can take a while. Chrome answers on
    // the pipe once it's ready; until then the command waits in the pipe.
    const launchMs = Number(call.config("launch_timeout_ms") ?? 45_000);
    const ready = cdp.send("Target.getTargets", {}, undefined, launchMs);
    const outcome = await Promise.race([
      ready.then((r) => ({ r }), (e: Error) => ({ e })),
      proc.exited.then(() => ({ exited: true as const })),
    ]);
    if ("exited" in outcome) throw new HaloError(`${path} exited (code ${proc.exitCode}) before it was ready${why()}`, { code: "TOOL_CONFIG" });
    if ("e" in outcome) {
      if (proc.exitCode !== null) throw new HaloError(`${path} exited (code ${proc.exitCode}) before it was ready${why()}`, { code: "TOOL_CONFIG" });
      if (outcome.e instanceof TimeoutError) throw new TimeoutError(`${path} did not answer on its DevTools pipe within ${Math.round(launchMs / 1000)}s (launch_timeout_ms)${why()}`);
      throw outcome.e;
    }
    const { targetInfos } = outcome.r;
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
      children: new Map(),
      handovers: 0,
    };

    const autoAttach = (sessionId: string) =>
      cdp.send("Target.setAutoAttach", { autoAttach: true, waitForDebuggerOnStart: false, flatten: true }, sessionId).catch(() => {});

    cdp.listeners.add((method, p, sessionId) => {
      if (method === "Target.targetCreated" && p.targetInfo?.type === "page" && p.targetInfo.targetId !== s.targetId) {
        // A new tab or window (target=_blank, window.open): close it, and report where it went.
        s.popups.push(p.targetInfo.url || "about:blank");
        void cdp.send("Target.closeTarget", { targetId: p.targetInfo.targetId }).catch(() => {});
        return;
      }
      // Cross-site frames attach as their own sessions; nested ones attach through them.
      if (method === "Target.attachedToTarget" && p.targetInfo?.type === "iframe") {
        s.children.set(p.targetInfo.targetId, { sid: p.sessionId, url: p.targetInfo.url ?? "" });
        void autoAttach(p.sessionId);
        return;
      }
      if (method === "Target.detachedFromTarget") {
        for (const [id, c] of s.children) if (c.sid === p.sessionId) s.children.delete(id);
        return;
      }
      if (method === "Target.targetInfoChanged" && p.targetInfo?.type === "iframe") {
        const c = s.children.get(p.targetInfo.targetId);
        if (c) c.url = p.targetInfo.url ?? c.url;
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
    await autoAttach(sid);
    const tree = await cdp.send("Page.getFrameTree", {}, sid);
    s.frameId = tree.frameTree?.frame?.id ?? targetId;
    if (s.allow) await cdp.send("Fetch.enable", { patterns: [{ urlPattern: "*", resourceType: "Document", requestStage: "Request" }] }, sid);
    live.add(s);
    return s;
  } catch (e) {
    cdp.close();
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

/** One link in the chain from the top page to the frame a call works in. */
interface ChainLink {
  frame: Frame;
  url: string;
  /** The frame's own origin's host (about:blank and srcdoc frames have their parent's). */
  host: string;
  /** The <iframe> element that holds this frame, in its parent (none for the top page). */
  owner?: { frame: Frame; backendNodeId: number };
}

interface Ctx {
  call: ToolCall;
  s: Session;
  services: ToolServices;
  /** Per-command timeout, and how long navigations may take. */
  timeoutMs: number;
  /** The frame this call works in (the top page unless `frame:` says otherwise). */
  frame: Frame;
  /** Top page first. */
  chain: ChainLink[];
}

function abortable<T>(signal: AbortSignal, p: Promise<T>): Promise<T> {
  if (signal.aborted) return Promise.reject(signal.reason ?? new HaloError("Aborted"));
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason ?? new HaloError("Aborted"));
    signal.addEventListener("abort", onAbort, { once: true });
    p.then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
  });
}

/** A command to the page's own session. */
function send(c: Ctx, method: string, params: Record<string, unknown> = {}): Promise<any> {
  return sendTo(c, c.s.sid, method, params);
}

function sendTo(c: Ctx, sid: string, method: string, params: Record<string, unknown> = {}): Promise<any> {
  return abortable(c.call.signal, c.s.cdp.send(method, params, sid, c.timeoutMs));
}

const top = (s: Session): Frame => ({ sid: s.sid, frameId: s.frameId });

/** An isolated world in a frame: the page's DOM, without its scripts' globals, so a page can't change what Halo's code does. */
async function world(c: Ctx, f: Frame): Promise<number> {
  const r = await sendTo(c, f.sid, "Page.createIsolatedWorld", { frameId: f.frameId, worldName: "halo", grantUniveralAccess: false });
  return r.executionContextId;
}

function threw(c: Ctx, d: any): never {
  throw new HaloError(`${c.call.tool.name}.${c.call.method}: the page threw ${d.exception?.description ?? d.text ?? "an error"}`);
}

/** Run an expression in a frame's isolated world and return its value (JSON-serializable). */
async function evaluateIn(c: Ctx, f: Frame, expression: string): Promise<any> {
  const contextId = await world(c, f);
  const r = await sendTo(c, f.sid, "Runtime.evaluate", { expression, contextId, returnByValue: true, awaitPromise: true, userGesture: true });
  if (r.exceptionDetails) threw(c, r.exceptionDetails);
  return r.result?.value;
}

/** Run an expression in the call's frame. */
function evaluate(c: Ctx, expression: string): Promise<any> {
  return evaluateIn(c, c.frame, expression);
}

/**
 * In-page, in Halo's isolated world: blank every typed value in the document's text and attributes
 * before anything reads it, and return a function that puts them back. The text nodes are joined in
 * document order and matched as one string, so a value split across many nodes (a preview widget
 * with one <span> per digit) is found whole, and every piece of it is blanked: reading any part
 * of the page, however small, gets nothing of it. The first character of a match becomes
 * [wallet Item.field]; the rest become nothing.
 */
const REDACT = `function (patterns) {
  const normalize = (${NORMALIZE_SOURCE});
  const findDigits = (${DIGITS_SOURCE});
  const numbers = patterns.numbers.map((n) => n[1]);
  const res = patterns.texts.map(([ref, source]) => [ref, new RegExp(source, "giu")]);
  const undo = [];
  // Streams, in document order: every text node, and each attribute name's values (open shadow roots included).
  const text = [];
  const attrs = new Map();
  const walk = (root) => {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (n.nodeType === 3) { const node = n; text.push({ get: () => node.data, set: (v) => { node.data = v; } }); continue; }
      const el = n;
      for (const at of el.attributes) {
        const name = at.name;
        if (!attrs.has(name)) attrs.set(name, []);
        attrs.get(name).push({ get: () => el.getAttribute(name) || "", set: (v) => el.setAttribute(name, v) });
      }
      if (el.shadowRoot) walk(el.shadowRoot);
    }
  };
  walk(document);
  const redact = (segs) => {
    const parts = segs.map((x) => x.get());
    const starts = [];
    let all = "";
    for (const t of parts) { starts.push(all.length); all += t; }
    if (!all) return;
    const [norm, ns, ne] = normalize(all);
    const blank = new Uint8Array(all.length);
    const labels = new Map();
    const mark = (a, b, ref) => { if (!labels.has(a) && !blank[a]) labels.set(a, "[wallet " + ref + "]"); blank.fill(1, a, b); };
    for (const [a, b, i] of findDigits(norm, numbers, patterns.minRun, false)) mark(ns[a], ne[b - 1], patterns.numbers[i][0]);
    for (const [ref, re] of res) {
      re.lastIndex = 0;
      for (let m = re.exec(norm); m; m = re.exec(norm)) {
        if (!m[0].length) { re.lastIndex++; continue; }
        mark(ns[m.index], ne[m.index + m[0].length - 1], ref);
      }
    }
    parts.forEach((t, k) => {
      const from = starts[k];
      let touched = false, out = "";
      for (let j = 0; j < t.length; j++) {
        if (!blank[from + j]) { out += t[j]; continue; }
        touched = true;
        if (labels.has(from + j)) out += labels.get(from + j);
      }
      if (touched) { undo.push([segs[k], t]); segs[k].set(out); }
    });
  };
  redact(text);
  for (const segs of attrs.values()) redact(segs);
  return () => { for (const [seg, old] of undo.reverse()) seg.set(old); };
}`;

/**
 * An expression read through the redaction pass when the session is armed: blank, read, and put
 * back in one synchronous step, so the page never runs while its text is changed.
 */
function redacted(s: Session, expression: string): string {
  const patterns = armed(s) ? s.wallet!.typed.matchers() : undefined;
  if (!patterns || (!patterns.numbers.length && !patterns.texts.length)) return expression;
  return `(() => { const undo = (${REDACT})(${JSON.stringify(patterns)}); try { return (${expression}); } finally { undo(); } })()`;
}

/** Call a function on a node (by its backend id) in a frame's isolated world, with plain arguments. */
async function onNode(c: Ctx, f: Frame, backendNodeId: number, fn: string, args: unknown[] = []): Promise<any> {
  const contextId = await world(c, f);
  const { object } = await sendTo(c, f.sid, "DOM.resolveNode", { backendNodeId, executionContextId: contextId });
  const r = await sendTo(c, f.sid, "Runtime.callFunctionOn", { objectId: object.objectId, functionDeclaration: fn, arguments: args.map((value) => ({ value })), returnByValue: true, awaitPromise: true, userGesture: true });
  if (r.exceptionDetails) threw(c, r.exceptionDetails);
  return r.result?.value;
}

/** The node a selector finds in a frame, by its backend id (stable for the node's life), or undefined. */
async function nodeId(c: Ctx, f: Frame, selector: string): Promise<number | undefined> {
  const contextId = await world(c, f);
  const r = await sendTo(c, f.sid, "Runtime.evaluate", { expression: `document.querySelector(${JSON.stringify(selector)})`, contextId });
  if (r.exceptionDetails || !r.result?.objectId) return undefined;
  const d = await sendTo(c, f.sid, "DOM.describeNode", { objectId: r.result.objectId });
  return d.node?.backendNodeId;
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

/** Cut text to n characters, after masking it in an armed session (so a cut can't leave part of a value). */
function cap(text: string, n: number, s?: Session): string {
  const t = s?.wallet?.typed.size ? s.wallet.typed.mask(text) : text;
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

/**
 * The page's summary after an action, checked again: a navigation that starts after settle's grace
 * period (a slow machine) lands after checkLocation ran, so the URL the summary saw is checked too.
 */
async function checkedSummary(c: Ctx, withText: boolean): Promise<Record<string, unknown>> {
  const out = await summary(c, withText);
  const url = String(out.url);
  if (c.s.blocked.length || (url !== "about:blank" && !urlAllowed(url, c.s.allow))) await checkLocation(c);
  return out;
}

async function summary(c: Ctx, withText: boolean): Promise<Record<string, unknown>> {
  const page = await evaluateIn(c, top(c.s), redacted(c.s, `({ url: location.href, title: document.title, text: ${withText ? "(document.body ? document.body.innerText : '')" : "''"} })`));
  const out: Record<string, unknown> = { url: page.url, title: page.title };
  if (withText) out.text = cap(String(page.text).replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim(), maxChars(c), c.s);
  if (c.s.popups.length) out.closedPopups = c.s.popups.splice(0);
  if (c.s.dialogs.length) out.dialogs = c.s.dialogs.splice(0);
  return out;
}

/** In-page lookup of one element by CSS selector: whether it exists, is visible, and its center (in its frame). */
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

/** Where the call's frame sits in the top page's viewport, so a click inside a frame lands on the right spot. */
async function frameOffset(c: Ctx): Promise<{ x: number; y: number }> {
  let x = 0;
  let y = 0;
  for (const link of c.chain.slice(1)) {
    if (!link.owner) continue;
    const r = await onNode(c, link.owner.frame, link.owner.backendNodeId, `function () { const b = this.getBoundingClientRect(); return { x: b.left + this.clientLeft, y: b.top + this.clientTop }; }`);
    x += r.x;
    y += r.y;
  }
  return { x, y };
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

/** In an armed session, a selector must pass the armed rules; the browser is given its canonical form. */
function checked(c: Ctx, selector: string): string {
  if (!armed(c.s)) return selector;
  const r = checkArmedSelector(selector);
  if (!r.ok) throw new HaloError(`${c.call.tool.name}.${c.call.method}: ${r.reason}`, { code: "TOOL_ARGUMENT" });
  return r.canonical;
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

// ── Frames ──

/** A frame's URL and the host of its origin, read in its isolated world. */
async function frameLocation(c: Ctx, f: Frame): Promise<{ url: string; host: string }> {
  const loc = await evaluateIn(c, f, `({ href: location.href, origin: location.origin })`);
  let host = "";
  try {
    host = loc.origin && loc.origin !== "null" ? new URL(loc.origin).hostname.toLowerCase() : "";
  } catch {}
  return { url: String(loc.href), host };
}

/**
 * The chain from the top page to the frame `frame:` names: a selector for an <iframe> in the top
 * page, or a list of them for nested frames. Each <iframe> is found in its parent's isolated world,
 * and its content frame is reached in-process or through its own session (a cross-site frame).
 */
async function resolveChain(c: Ctx, raw: unknown): Promise<ChainLink[]> {
  const root = top(c.s);
  const first = await frameLocation(c, root);
  const chain: ChainLink[] = [{ frame: root, ...first }];
  if (raw === undefined || raw === null || raw === "") return chain;
  const selectors = (Array.isArray(raw) ? raw : [raw]).map((x) => str(x));
  if (!selectors.length || selectors.length > 5) throw new HaloError(`${c.call.tool.name}.${c.call.method}: frame: is one <iframe> selector, or a list of up to 5 for nested frames`, { code: "TOOL_ARGUMENT" });
  let parent = root;
  for (const raw of selectors) {
    const selector = checked(c, raw);
    const contextId = await world(c, parent);
    const r = await sendTo(c, parent.sid, "Runtime.evaluate", { expression: `(() => { const el = document.querySelector(${JSON.stringify(selector)}); return el && (el.tagName === "IFRAME" || el.tagName === "FRAME") ? el : null; })()`, contextId });
    if (r.exceptionDetails) throw new HaloError(`${c.call.tool.name}.${c.call.method}: "${raw}" is not a valid CSS selector`, { code: "TOOL_ARGUMENT" });
    if (!r.result?.objectId) throw new HaloError(`${c.call.tool.name}.${c.call.method}: no <iframe> matches "${raw}"`, { code: "TOOL_ARGUMENT" });
    const d = await sendTo(c, parent.sid, "DOM.describeNode", { objectId: r.result.objectId });
    const frameId: string | undefined = d.node?.frameId;
    if (!frameId) throw new HaloError(`${c.call.tool.name}.${c.call.method}: the <iframe> "${raw}" has no page loaded yet`, { code: "TOOL_ARGUMENT" });
    const child = c.s.children.get(frameId);
    const frame: Frame = child ? { sid: child.sid, frameId } : { sid: parent.sid, frameId };
    const loc = await frameLocation(c, frame);
    chain.push({ frame, ...loc, owner: { frame: parent, backendNodeId: d.node.backendNodeId } });
    parent = frame;
  }
  return chain;
}

// ── The wallet ──

const armed = (s: Session) => !!s.wallet && s.wallet.typed.size > 0;

/**
 * Forget what a session typed, when its browser closes. Not before: a page that held a value can come
 * back (the back button, a form the site restores), so an armed session stays armed for its life.
 */
function disarm(s: Session) {
  if (!s.wallet) return;
  s.wallet.typed.clear();
  s.wallet.sealed.length = 0;
  s.wallet.sealedFrames.clear();
  s.wallet.items.clear();
  s.wallet = undefined;
}

/** Whether a frame is sealed whole: a payment frame a secret was typed into, or one on a typed secret item's pay_via. */
function frameSealed(s: Session, frameId: string, host: string): boolean {
  const w = s.wallet;
  if (!w || !armed(s)) return false;
  if (w.sealedFrames.has(frameId)) return true;
  return [...w.items.values()].some((item) => item.secret && item.payVia.some((h) => hostMatches(host, h)));
}

function sealedIn(s: Session, f: Frame): Sealed[] {
  return s.wallet?.sealed.filter((x) => x.sid === f.sid && x.frameId === f.frameId) ?? [];
}

/** In an armed session, a call that works inside a sealed frame is refused (only fill_secrets may type there). */
function refuseSealedFrame(c: Ctx) {
  const link = c.chain.at(-1)!;
  if (c.chain.length > 1 && frameSealed(c.s, link.frame.frameId, link.host)) {
    throw new HaloError(`${c.call.tool.name}.${c.call.method}: the frame on ${link.host} is sealed: a wallet value was typed into it, so nothing in it can be read or used`, { code: "TOOL_ARGUMENT" });
  }
}

/** The ref of the sealed element a selector finds in the call's frame, if it finds one. */
async function sealedAt(c: Ctx, selector: string): Promise<string | undefined> {
  const here = sealedIn(c.s, c.frame);
  if (!here.length) return undefined;
  const id = await nodeId(c, c.frame, selector);
  return id === undefined ? undefined : here.find((x) => x.backendNodeId === id)?.ref;
}

async function refuseSealedElement(c: Ctx, selector: string) {
  const ref = await sealedAt(c, selector);
  if (ref) throw new HaloError(`${c.call.tool.name}.${c.call.method}: "${selector}" is sealed: ${ref} was typed into it`, { code: "TOOL_ARGUMENT" });
}

/** The top page's current document (it changes on every navigation, not on a single-page app's route change). */
async function topDocument(c: Ctx): Promise<string> {
  const tree = await send(c, "Page.getFrameTree");
  return String(tree.frameTree?.frame?.loaderId ?? "");
}

/**
 * Whether what was typed may still be submitted: the page it was typed into is still loaded (even if
 * it re-rendered the field), or a sealed element is still in a page. While so, a submission asks.
 */
async function sealedStillThere(c: Ctx): Promise<boolean> {
  if (c.s.wallet?.documents.has(await topDocument(c))) return true;
  for (const x of c.s.wallet?.sealed ?? []) {
    try {
      if (await onNode(c, { sid: x.sid, frameId: x.frameId }, x.backendNodeId, `function () { return this.isConnected; }`)) return true;
    } catch {}
  }
  return false;
}

/** Who is acting, for a question to a person. */
const actor = (call: ToolCall) => call.wallet?.agent ?? `The pipeline`;

function chainLines(chain: ChainLink[], items: WalletItem[]): string[] {
  return chain.map((l, i) => {
    const site = registrableDomain(l.host) || l.host || "(no host)";
    const pay = i > 0 && items.some((it) => it.payVia.some((h) => hostMatches(l.host, h)));
    const what = i === 0 ? "page    " : "field in";
    const url = l.url.length > 100 ? `${l.url.slice(0, 100)}…` : l.url;
    return `  ${what} ${site.padEnd(24)} ${url}${pay ? `  (payment frame, inside ${registrableDomain(chain[0]!.host)})` : ""}`;
  });
}

function sha(...parts: string[]): string {
  const h = new Bun.CryptoHasher("sha256");
  for (const p of parts) h.update(p).update("\0");
  return h.digest("hex").slice(0, 32);
}

/** Ask a person, holding the browser open while they decide (and while the run waits, if it pauses). */
async function askPerson(c: Ctx, req: Parameters<NonNullable<ToolServices["approve"]>>[0]): Promise<unknown> {
  if (!c.services.approve) throw new HaloError(`${c.call.tool.name}.${c.call.method} needs a person's approval, and nothing here can ask one`, { code: "APPROVAL_NEEDED" });
  c.s.holdUntil = Date.now() + Number(c.call.config("approval_hold_ms") ?? 3_600_000);
  if (c.s.idleTimer) clearTimeout(c.s.idleTimer);
  const answer = await c.services.approve(req);
  c.s.holdUntil = undefined;
  return answer;
}

/** A policy asked for this call to be approved, and the call asks no question of its own: ask it the usual way. */
async function policyGate(c: Ctx): Promise<void> {
  const policy = c.call.wallet?.policyApproval;
  if (!policy) return;
  const target = `${c.call.tool.name}.${c.call.method}`;
  const args = JSON.stringify(c.call.named);
  const answer = await askPerson(c, {
    key: `tool:${target}:${sha(args).slice(0, 16)}`,
    message: `Allow ${actor(c.call)} to call ${target} with ${args.length > 2000 ? `${args.slice(0, 2000)}…` : args}? (policy ${policy})`,
    named: { target, args: c.call.named, policy, agent: c.call.wallet?.agent },
  });
  if (!isApproval(answer)) throw new HaloError(`A person declined this call${declineReason(answer)}`, { code: "APPROVAL_DECLINED" });
}

/**
 * In an armed session, while a sealed element is still on the page, a click or an Enter may submit
 * what was typed: each asks a person, and one approval allows one submission. Returns whether it asked.
 */
/**
 * Where a submission would send what was typed: for every form in the call's frame that holds a
 * sealed field, its action and each of its buttons' formaction; and for the element being clicked
 * (or the focused one, for a key), the form it submits. Hosts, deduplicated.
 */
async function submissionTargets(c: Ctx, selector: string | undefined): Promise<{ hosts: string[]; submits?: string }> {
  const sealed = sealedIn(c.s, c.frame);
  const contextId = await world(c, c.frame);
  const objs = [];
  for (const x of sealed) {
    const o = await sendTo(c, c.frame.sid, "DOM.resolveNode", { backendNodeId: x.backendNodeId, executionContextId: contextId }).catch(() => undefined);
    if (o) objs.push({ objectId: o.object.objectId });
  }
  const doc = await sendTo(c, c.frame.sid, "Runtime.evaluate", { expression: "document", contextId });
  const r = await sendTo(c, c.frame.sid, "Runtime.callFunctionOn", {
    objectId: doc.result.objectId,
    functionDeclaration: `function (selector, ...sealed) {
      const host = (u) => { try { return new URL(u, document.baseURI).hostname.toLowerCase(); } catch { return ""; } };
      const hosts = new Set();
      const forms = new Set(sealed.map((el) => el && el.form).filter(Boolean));
      for (const f of forms) {
        hosts.add(host(f.action));
        for (const b of f.elements) if (b.formAction && b.hasAttribute("formaction")) hosts.add(host(b.formAction));
      }
      let submits;
      const el = selector ? document.querySelector(selector) : document.activeElement;
      if (el) {
        const btn = el.closest("button, input[type=submit], input[type=image]");
        const form = (btn && btn.form) || el.form || el.closest("form");
        if (form) submits = host(btn && btn.hasAttribute("formaction") ? btn.formAction : form.action);
        if (submits) hosts.add(submits);
      }
      return { hosts: [...hosts].filter(Boolean), submits };
    }`,
    arguments: [{ value: selector ?? null }, ...objs],
    returnByValue: true,
  });
  return r.result?.value ?? { hosts: [] };
}

async function submissionGate(c: Ctx, what: string, selector?: string): Promise<boolean> {
  const w = c.s.wallet;
  if (!w || !armed(c.s) || !(await sealedStillThere(c))) return false;
  // A form holding a typed value must send it only to a host its item allows.
  const targets = await submissionTargets(c, selector);
  for (const host of targets.hosts) {
    const item = [...w.items.values()].find((it) => w.sealed.some((x) => x.item === it.name && x.frameId === c.frame.frameId) && !it.hosts.some((h) => hostMatches(host, h)) && !it.payVia.some((h) => hostMatches(host, h)));
    if (item) {
      c.services.walletEvent?.({ tool: c.call.tool.name, method: c.call.method, refs: w.typed.refs(), chain: c.chain.map((l) => ({ host: l.host, url: l.url })), outcome: "refused", detail: `a form would send ${item.name} to ${host}` });
      throw new HaloError(`${c.call.tool.name}.${c.call.method}: a form on this page would send ${item.name} to ${host}, which isn't in its hosts:, so nothing was submitted`, { code: "TOOL_ARGUMENT" });
    }
  }
  const typed = [...w.items.values()].map((it) => `${it.name} (${w.sealed.filter((x) => x.item === it.name).map((x) => x.ref.split(".")[1]).join(", ")})`).join(", ");
  const link = c.chain.at(-1)!;
  const policy = c.call.wallet?.policyApproval;
  const key = `submit:${sha(c.call.tool.name, what, ...c.chain.map((l) => `${l.frame.frameId}@${l.url}`), ...w.sealed.map((x) => String(x.backendNodeId)), String(w.submits))}`;
  const answer = await askPerson(c, {
    key,
    message: [
      `${actor(c.call)} wants to ${what} on ${registrableDomain(link.host) || link.host}, after typing ${typed}. This may submit them (for a card, pay).${targets.submits ? ` It sends the form to ${targets.submits}.` : ""}${policy ? ` (policy ${policy})` : ""}`,
      ...chainLines(c.chain, [...w.items.values()]),
    ].join("\n"),
    named: { target: `${c.call.tool.name}.${c.call.method}`, action: what, chain: c.chain.map((l) => ({ host: l.host, url: l.url })), submission: true, agent: c.call.wallet?.agent },
    wallet: { mock: [...w.items.values()].every((it) => it.source === "mock") },
  });
  const event = { tool: c.call.tool.name, method: c.call.method, refs: w.typed.refs(), chain: c.chain.map((l) => ({ host: l.host, url: l.url })), ...(c.call.wallet?.agent ? { agent: c.call.wallet.agent } : {}) };
  if (!isApproval(answer)) {
    c.services.walletEvent?.({ ...event, outcome: "submit_declined", detail: what });
    throw new HaloError(`A person declined: ${what}${declineReason(answer)}`, { code: "APPROVAL_DECLINED" });
  }
  w.submits++;
  c.services.walletEvent?.({ ...event, outcome: "submit_approved", detail: what });
  return true;
}

/** What an element is, for the checks before a value is typed into it. */
const DESCRIBE_FIELD = `function () {
  const el = this;
  const r = el.getBoundingClientRect();
  const st = getComputedStyle(el);
  const labels = el.labels ? [...el.labels].map((l) => l.innerText.trim()).join(" ") : "";
  return {
    tag: el.tagName.toLowerCase(),
    type: (el.getAttribute("type") || "").toLowerCase(),
    role: (el.getAttribute("role") || "").toLowerCase(),
    autocomplete: (el.getAttribute("autocomplete") || "").toLowerCase(),
    disabled: !!el.disabled,
    readOnly: !!el.readOnly,
    editable: !!el.isContentEditable,
    visible: r.width > 0 && r.height > 0 && st.visibility !== "hidden" && st.display !== "none",
    label: [el.getAttribute("name"), el.id, el.getAttribute("aria-label"), el.getAttribute("placeholder"), labels].filter(Boolean).join(" ").slice(0, 200),
  };
}`;

const TYPABLE = new Set(["", "text", "tel", "number", "email", "password", "month"]);

interface FieldPlan {
  selector: string;
  canonical: string;
  ref: WalletRef;
  item: WalletItem;
  token?: string;
  backendNodeId: number;
  tag: string;
}

/** Check one field: the ref, the policies, the element. Throws a TOOL_ARGUMENT error saying why it can't be typed. */
async function planField(c: Ctx, selector: string, rawRef: unknown, items: Map<string, WalletItem>): Promise<FieldPlan> {
  const name = `${c.call.tool.name}.${c.call.method}`;
  const ref = parseRef(rawRef);
  const item = items.get(ref.item);
  if (!item) throw new HaloError(`${name}: "${ref.raw}": ${ref.item} isn't in this browser's wallet (${[...items.keys()].join(", ") || "none"})`, { code: "TOOL_ARGUMENT" });
  const field = item.fields.find((f) => f.name === ref.field);
  if (!field) throw new HaloError(`${name}: ${ref.item} has no field "${ref.field}" (it has ${item.fields.map((f) => f.name).join(", ")})`, { code: "TOOL_ARGUMENT" });
  const fmt = formatProblem(ref);
  if (fmt) throw new HaloError(`${name}: ${fmt}`, { code: "TOOL_ARGUMENT" });
  if (c.call.wallet && !walletAllows(c.call.wallet, ref)) {
    throw new HaloError(`${name}: ${c.call.wallet.agent ?? "this agent"} may not use ${refName(ref)}: ${c.call.wallet.allow.length ? "its AllowWallet rules don't cover it" : "none of its policies has AllowWallet(...)"}`, { code: "TOOL_ARGUMENT" });
  }
  const canonical = checked(c, selector);
  const backendNodeId = await nodeId(c, c.frame, canonical);
  if (backendNodeId === undefined) throw new HaloError(`${name}: no element matches "${selector}" on ${c.chain.at(-1)!.url}`, { code: "TOOL_ARGUMENT" });
  const el = await onNode(c, c.frame, backendNodeId, DESCRIBE_FIELD);
  const refuse = (why: string) => new HaloError(`${name}: won't type ${refName(ref)} into "${selector}": ${why}`, { code: "TOOL_ARGUMENT" });
  if (el.tag === "input") {
    if (!TYPABLE.has(el.type)) throw refuse(el.type === "search" ? "it's a search box" : `it's an <input type="${el.type}">`);
  } else if (el.tag !== "select") {
    throw refuse(el.editable ? "it's an editable region, not a form field" : `it's a <${el.tag}>, not an <input> or <select>`);
  }
  if (el.role === "search" || el.role === "searchbox") throw refuse("it's a search box");
  if (el.disabled || el.readOnly) throw refuse("it's disabled or read-only");
  if (!el.visible) throw refuse("it isn't visible");
  const tokens = String(el.autocomplete).split(/\s+/).filter(Boolean);
  if (!tokenAgrees(field.token, tokens)) {
    throw refuse(`the page marks it autocomplete="${el.autocomplete}", which is a different detail${field.token ? ` from ${field.token}` : ""}`);
  }
  const already = sealedIn(c.s, c.frame).find((x) => x.backendNodeId === backendNodeId);
  if (already && already.ref !== refName(ref)) throw refuse(`${already.ref} was already typed into it`);
  return { selector, canonical, ref, item, ...(field.token ? { token: field.token } : {}), backendNodeId, tag: el.tag };
}

/** What must not have changed between the checks and the typing: the chain and the elements. */
function fingerprint(c: Ctx, plans: FieldPlan[]): string {
  return sha(c.call.tool.name, ...c.chain.map((l) => `${l.frame.sid}/${l.frame.frameId}@${l.url}`), ...plans.map((p) => `${p.backendNodeId}=${p.ref.raw}`));
}

/** fill_secrets: type wallet values into elements, after every check and a person's approval. */
async function fillSecrets(c: Ctx, fields: Record<string, unknown>): Promise<Record<string, unknown>> {
  const name = `${c.call.tool.name}.${c.call.method}`;
  const names = walletConfig(c.call);
  if (!names) throw new HaloError(`${name}: declare the browser with a wallet, e.g. ${c.call.tool.name} : Chrome(wallet: [Card])`, { code: "TOOL_CONFIG" });
  if (c.call.branch) throw new HaloError(`${name}: wallet values can't be typed inside a fan-out (|*, each), where each branch would type them again`, { code: "TOOL_ARGUMENT" });
  if (!c.services.wallet) throw new HaloError(`${name}: this runtime can't reach a wallet`, { code: "TOOL_CONFIG" });
  const entries = Object.entries(fields);
  if (!entries.length) throw new HaloError(`${name}: fields: maps selectors to wallet refs, e.g. fields: { "#cardNumber": "Card.number" }`, { code: "TOOL_ARGUMENT" });
  if (entries.length > 12) throw new HaloError(`${name}: at most 12 fields in one call`, { code: "TOOL_ARGUMENT" });
  const items = new Map(c.services.wallet(names).map((it) => [it.name, it]));

  // 1. The chain: every site from the top page down to the frame.
  const topLink = c.chain[0]!;
  const event = (outcome: Parameters<NonNullable<ToolServices["walletEvent"]>>[0]["outcome"], refs: string[], detail?: string) =>
    c.services.walletEvent?.({ tool: c.call.tool.name, method: c.call.method, refs, chain: c.chain.map((l) => ({ host: l.host, url: l.url })), outcome, ...(detail ? { detail } : {}), ...(c.call.wallet?.agent ? { agent: c.call.wallet.agent } : {}) });
  const plans: FieldPlan[] = [];
  try {
    for (const [selector, ref] of entries) plans.push(await planField(c, selector, ref, items));
    const used = [...new Set(plans.map((p) => p.item))];
    for (const item of used) {
      if (!urlAllowed(topLink.url, c.s.allow)) throw new HaloError(`${name}: the page ${topLink.url} isn't one this browser may be on`, { code: "TOOL_ARGUMENT" });
      if (!item.hosts.some((h) => hostMatches(topLink.host, h))) {
        throw new HaloError(`${name}: ${item.name} may be typed only on pages on ${item.hosts.join(", ")}; this page is on ${topLink.host || topLink.url}`, { code: "TOOL_ARGUMENT" });
      }
      for (const [i, link] of c.chain.entries()) {
        const secure = (() => {
          try {
            const u = new URL(link.url === "about:blank" || link.url === "about:srcdoc" ? `https://${link.host}/` : link.url);
            return u.protocol === "https:" || isLoopback(u.hostname);
          } catch {
            return false;
          }
        })();
        if (!link.host) throw new HaloError(`${name}: a frame on the way to the field has no origin (a sandboxed frame), so where ${item.name} would go can't be checked`, { code: "TOOL_ARGUMENT" });
        if (!secure) throw new HaloError(`${name}: ${link.url} isn't https, so ${item.name} would be sent in the clear`, { code: "TOOL_ARGUMENT" });
        if (i === 0) continue;
        if (!item.hosts.some((h) => hostMatches(link.host, h)) && !item.payVia.some((h) => hostMatches(link.host, h))) {
          throw new HaloError(`${name}: the field is in a frame on ${link.host}, which isn't in ${item.name}'s hosts: or pay_via:`, { code: "TOOL_ARGUMENT" });
        }
      }
    }
  } catch (err) {
    if (err instanceof HaloError) event("refused", entries.map(([, r]) => String(r)), err.message);
    throw err;
  }

  // 2. A person approves, unless every item is personal, says ask: false, and no rule asks.
  const used = [...new Set(plans.map((p) => p.item))];
  const secrets = used.filter((it) => it.secret);
  if (secrets.length && c.call.config("headless") !== false) {
    event("refused", plans.map((p) => refName(p.ref)), "a secret needs a browser window");
    throw new HaloError(`${name}: ${secrets.map((it) => it.name).join(", ")} can be typed only into a browser a person can see, since only they can finish with it: declare ${c.call.tool.name} with headless: false`, { code: "TOOL_CONFIG" });
  }
  const ask =
    used.some((it) => it.secret || it.ask) ||
    !!c.call.wallet?.policyApproval ||
    plans.some((p) => (c.call.wallet?.approve ?? []).some((pat) => walletPatternMatches(pat, p.ref)));
  const key = `wallet:${fingerprint(c, plans)}`;
  const refsByItem = used.map((it) => `${it.name}${it.hint ? ` (${it.hint})` : ""}: ${plans.filter((p) => p.item === it).map((p) => p.ref.field).join(", ")}`);
  if (ask) {
    const hints = await Promise.all(used.map(async (it) => it.hint ?? (it.kind === "card" ? (await walletFieldInfo(it, "number").catch(() => ({}) as { hint?: string })).hint : undefined)));
    const described = used.map((it, i) => `${it.name}${hints[i] ? ` (${hints[i]})` : ""}: ${plans.filter((p) => p.item === it).map((p) => p.ref.field).join(", ")}`);
    const policy = c.call.wallet?.policyApproval;
    const answer = await askPerson(c, {
      key,
      message: [`${actor(c.call)} wants to type ${described.join("; ")}${policy ? ` (policy ${policy})` : ""}`, ...chainLines(c.chain, used)].join("\n"),
      named: {
        target: name,
        refs: plans.map((p) => refName(p.ref)),
        chain: c.chain.map((l) => ({ host: l.host, url: l.url })),
        ...(c.call.wallet?.agent ? { agent: c.call.wallet.agent } : {}),
        ...(policy ? { policy } : {}),
      },
      wallet: { mock: used.every((it) => it.source === "mock") },
    });
    if (!isApproval(answer)) {
      event("declined", plans.map((p) => refName(p.ref)), declineReason(answer).slice(2) || undefined);
      throw new HaloError(`A person declined typing ${refsByItem.join("; ")} on ${topLink.host}${declineReason(answer)}`, { code: "APPROVAL_DECLINED" });
    }

    // 3. Nothing may have changed while the person decided: the same frames, the same URLs, the same elements.
    const now = await resolveChain(c, c.call.named.frame);
    // Every check again, on the page as it is now: the same frames and elements, and each still the right kind of field.
    const before = key;
    c.chain = now;
    c.frame = now.at(-1)!.frame;
    let again: FieldPlan[] | undefined = [];
    for (const p of plans) {
      try {
        again.push(await planField(c, p.selector, p.ref.raw, items));
      } catch {
        again = undefined;
        break;
      }
    }
    if (!again || `wallet:${fingerprint(c, again)}` !== before) {
      event("refused", plans.map((p) => refName(p.ref)), "the page changed while waiting for approval");
      throw new HaloError(`${name}: the page changed while waiting for approval, so nothing was typed. Look at the page again and fill it again`, { code: "TOOL_ARGUMENT" });
    }
  }

  // 4. Type each field into exactly the approved element, checking focus before and after.
  const w: WalletState = (c.s.wallet ??= { typed: new TypedValues(), sealed: [], sealedFrames: new Map(), items: new Map(), submits: 0, documents: new Set() } satisfies WalletState);
  w.documents.add(await topDocument(c));
  const frame = c.frame;
  const link = c.chain.at(-1)!;
  const filled: Record<string, string> = {};
  for (const p of plans) {
    const full = await readWalletValue(p.item, p.ref.field, { environ: c.services.env, signal: c.call.signal });
    const value = formatValue(p.ref, full);
    // Sealed before typing, so nothing that runs after this point can read it back unmasked.
    w.items.set(p.item.name, p.item);
    w.typed.add(refName(p.ref), full);
    if (!w.sealed.some((x) => x.backendNodeId === p.backendNodeId && x.frameId === frame.frameId)) {
      w.sealed.push({ sid: frame.sid, frameId: frame.frameId, backendNodeId: p.backendNodeId, ref: refName(p.ref), item: p.item.name });
    }
    if (c.chain.length > 1 && p.item.secret) w.sealedFrames.set(frame.frameId, { item: p.item.name, host: link.host });
    if (p.tag === "select") {
      const r = await onNode(
        c,
        frame,
        p.backendNodeId,
        `function (v) { const o = [...this.options].find((o) => o.value === v || o.text.trim() === v || o.label.trim() === v);
          if (!o) return false; this.value = o.value; this.dispatchEvent(new Event("input", { bubbles: true })); this.dispatchEvent(new Event("change", { bubbles: true })); return true; }`,
        [value],
      );
      if (!r) throw new HaloError(`${name}: "${p.selector}" has no option for ${p.ref.raw} (try a format, like "${p.ref.item}.${p.ref.field}:MM")`, { code: "TOOL_ARGUMENT" });
    } else {
      await sendTo(c, frame.sid, "DOM.focus", { backendNodeId: p.backendNodeId });
      const focused = await onNode(c, frame, p.backendNodeId, `function () { if (this.ownerDocument.activeElement !== this) return false; this.value = ""; this.dispatchEvent(new Event("input", { bubbles: true })); return true; }`);
      if (!focused) {
        event("refused", [refName(p.ref)], "the element didn't take focus");
        throw new HaloError(`${name}: "${p.selector}" didn't take focus, so nothing was typed into it`, { code: "TOOL_ARGUMENT" });
      }
      await sendTo(c, frame.sid, "Input.insertText", { text: value });
      const still = await onNode(c, frame, p.backendNodeId, `function () { const ok = this.ownerDocument.activeElement === this; if (ok) this.dispatchEvent(new Event("change", { bubbles: true })); return ok; }`).catch(() => false);
      if (!still) {
        // The page moved focus while the value was typed: it may have gone into another element.
        const where = await evaluateIn(c, frame, `(() => { const a = document.activeElement; return a ? a.tagName.toLowerCase() + (a.id ? "#" + a.id : "") : "nothing"; })()`).catch(() => "unknown");
        event("incident", [refName(p.ref)], `focus moved to ${where} while typing`);
        await closeSession(c.s);
        throw new HaloError(`${name}: focus moved to ${where} while ${refName(p.ref)} was typed, so it may have gone into another element on ${link.host}. The browser was closed. Check that site before trying again`, { code: "WALLET_INCIDENT" });
      }
    }
    filled[p.selector] = p.ref.raw;
  }
  event("typed", plans.map((p) => refName(p.ref)));
  if (secrets.length) {
    // From here the person finishes. Nothing about the page comes back, not even its title.
    w.locked = { items: [...new Set([...(w.locked?.items ?? []), ...secrets.map((it) => it.name)])], host: topLink.host };
    return { filled, locked: true, next: `${secrets.map((it) => it.name).join(", ")} is typed. Call ${c.call.tool.name}.hand_over(reason: "...") so the person can check it and finish (press Pay, confirm with their bank). You can't read or use this page any more.` };
  }
  await settle(c, 50);
  await checkLocation(c);
  const sealedFrames = [...w.sealedFrames.values()].map((f) => `${f.host} frame`);
  return { filled, ...(sealedFrames.length ? { sealed: sealedFrames } : {}), armed: true, ...(await checkedSummary(c, false)) };
}

/** An element's (or the page's) HTML with sealed elements' attributes and sealed frames left out. */
async function sealedHtml(c: Ctx, selector: string | undefined): Promise<string> {
  const here = sealedIn(c.s, c.frame);
  const frames: Array<{ backendNodeId: number; label: string }> = [];
  for (const [frameId, info] of c.s.wallet?.sealedFrames ?? []) {
    try {
      const owner = await sendTo(c, c.frame.sid, "DOM.getFrameOwner", { frameId });
      frames.push({ backendNodeId: owner.backendNodeId, label: `[sealed frame ${info.host}]` });
    } catch {}
  }
  const marks = [...here.map((x) => ({ backendNodeId: x.backendNodeId, label: `[sealed ${x.ref}]` })), ...frames];
  const contextId = await world(c, c.frame);
  const rootExpr = selector ? `document.querySelector(${JSON.stringify(selector)})` : "document.documentElement";
  const root = await sendTo(c, c.frame.sid, "Runtime.evaluate", { expression: rootExpr, contextId });
  if (!root.result?.objectId) return "";
  const objects = [];
  for (const m of marks) {
    try {
      const { object } = await sendTo(c, c.frame.sid, "DOM.resolveNode", { backendNodeId: m.backendNodeId, executionContextId: contextId });
      objects.push({ objectId: object.objectId });
    } catch {
      objects.push({ value: null });
    }
  }
  const r = await sendTo(c, c.frame.sid, "Runtime.callFunctionOn", {
    objectId: root.result.objectId,
    functionDeclaration: `function (patterns, labels, ...marked) {
      const undo = (${REDACT})(patterns);
      try {
      const keep = new Set(["id", "name", "type", "autocomplete", "class", "for", "role", "placeholder", "aria-label", "data-testid"]);
      const clone = this.cloneNode(true);
      const a = document.createTreeWalker(this, NodeFilter.SHOW_ELEMENT);
      const b = document.createTreeWalker(clone, NodeFilter.SHOW_ELEMENT);
      const pairs = new Map();
      let x = this, y = clone;
      while (x && y) { pairs.set(x, y); x = a.nextNode(); y = b.nextNode(); }
      marked.forEach((el, i) => {
        const copy = el && pairs.get(el);
        if (!copy) return;
        for (const at of [...copy.attributes]) if (!keep.has(at.name)) copy.removeAttribute(at.name);
        if (copy.tagName === "IFRAME" || copy.tagName === "FRAME") { copy.setAttribute("data-sealed", labels[i]); copy.textContent = labels[i]; }
        else { copy.setAttribute("value", labels[i]); copy.textContent = copy.tagName === "SELECT" ? labels[i] : copy.textContent; }
      });
      return clone.outerHTML;
      } finally { undo(); }
    }`,
    arguments: [{ value: c.s.wallet?.typed.matchers() ?? { numbers: [], texts: [], minRun: 8 } }, { value: marks.map((m) => m.label) }, ...objects],
    returnByValue: true,
  });
  if (r.exceptionDetails) threw(c, r.exceptionDetails);
  return String(r.result?.value ?? "");
}

// ── Methods ──

const METHODS = ["open", "click", "fill", "press", "select", "text", "html", "links", "frames", "wait", "screenshot", "back", "evaluate", "fill_secrets", "fill_secret", "hand_over"];
const FRAMED = new Set(["click", "fill", "type", "press", "select", "text", "html", "links", "frames", "wait", "fill_secrets", "fill_secret"]);
/** Methods listed for this declaration: evaluate only with allowScript, the wallet's only with a wallet, hand_over with a window. */
function methodsFor(call: Pick<ToolCall, "config">): string[] {
  const wallet = call.config("wallet") !== undefined;
  return METHODS.filter((m) => (m === "evaluate" ? call.config("allowScript") === true && !wallet : m === "fill_secrets" || m === "fill_secret" ? wallet : m === "hand_over" ? wallet || call.config("headless") === false : true));
}

async function run(c: Ctx): Promise<unknown> {
  const { call, s } = c;
  if (s.wallet?.locked) {
    if (call.method === "hand_over") return handOverLocked(c);
    throw new HaloError(
      `${call.tool.name}.${call.method}: ${s.wallet.locked.items.join(", ")} was typed, so this browser now belongs to the person. Call ${call.tool.name}.hand_over(reason: "...") to let them finish (check the order, press Pay, confirm with their bank); nothing on the page can be read or used until then`,
      { code: "WALLET_LOCKED" },
    );
  }
  if (FRAMED.has(call.method) && call.named.frame !== undefined) {
    c.chain = await resolveChain(c, call.named.frame);
    c.frame = c.chain.at(-1)!.frame;
    if (call.method !== "fill_secrets" && call.method !== "fill_secret") refuseSealedFrame(c);
  } else {
    c.chain = await resolveChain(c, undefined);
  }
  switch (call.method) {
    case "open":
    case "goto":
    case "navigate": {
      await policyGate(c);
      const raw = need(call, "a url", call.named.url ?? call.positional[0]).trim();
      const url = /^[a-z][a-z0-9+.-]*:/i.test(raw) && !/^[^:/]+:\d/.test(raw) ? raw : `https://${raw}`;
      if (!urlAllowed(url, s.allow)) {
        const why = !/^https?:/i.test(url) ? "only http and https pages can be opened" : s.allow && !urlAllowed(url, s.allow) ? `its host is not in allow: [${s.allow.join(", ")}]` : "it is this browser's own DevTools endpoint";
        throw new HaloError(`${call.tool.name}.open: refused ${url}, ${why}`, { code: "TOOL_ARGUMENT" });
      }
      s.blocked.length = 0;
      const r = await send(c, "Page.navigate", { url });
      if (r.errorText && !s.blocked.length) {
        throw new HaloError(`${call.tool.name}.open could not load ${url} (${r.errorText})`, { retryable: true });
      }
      if (r.loaderId) await settle(c, 50);
      await checkLocation(c);
      return checkedSummary(c, true);
    }

    case "click": {
      const selector = checked(c, need(call, "selector:", selectorArg(call)));
      const el = await element(c, selector);
      if (!(await submissionGate(c, `click "${selector}"`, selector))) await policyGate(c);
      const off = c.chain.length > 1 ? await frameOffset(c) : { x: 0, y: 0 };
      const before = await currentUrl(c);
      const [x, y] = [el.x + off.x, el.y + off.y];
      const mouse = { x, y, button: "left", clickCount: 1 };
      await send(c, "Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
      await send(c, "Input.dispatchMouseEvent", { type: "mousePressed", ...mouse });
      await send(c, "Input.dispatchMouseEvent", { type: "mouseReleased", ...mouse });
      await settle(c);
      await checkLocation(c);
      const after = await checkedSummary(c, false);
      return { clicked: selector, navigated: after.url !== before, ...after };
    }

    case "fill":
    case "type": {
      const selector = checked(c, need(call, "selector:", selectorArg(call)));
      const value = str(call.named.value ?? call.named.text ?? (call.implicitInput ? undefined : call.positional[1]) ?? "");
      await element(c, selector);
      await refuseSealedElement(c, selector);
      await policyGate(c);
      // Focus and clear the field in the page, then type the value as real input (so frameworks see it).
      const ok = await evaluate(
        c,
        `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.focus();
          if ("value" in el) { el.value = ""; el.dispatchEvent(new Event("input", { bubbles: true })); }
          else if (el.isContentEditable) { el.textContent = ""; }
          return true; })()`,
      );
      if (!ok) throw new HaloError(`${call.tool.name}.fill: no element matches "${selector}"`, { code: "TOOL_ARGUMENT" });
      if (value) await sendTo(c, c.frame.sid, "Input.insertText", { text: value });
      await evaluate(c, `document.activeElement && document.activeElement.dispatchEvent(new Event("change", { bubbles: true }))`);
      await settle(c, 50);
      await checkLocation(c);
      return { filled: selector, value, ...(await checkedSummary(c, false)) };
    }

    case "press": {
      const key = need(call, `key: (e.g. "Enter", "Tab", "a")`, call.named.key ?? (call.implicitInput ? undefined : call.positional[0]));
      const selector = typeof call.named.selector === "string" ? checked(c, call.named.selector) : undefined;
      const known = KEYS[key];
      // A control character ("\r", "\n") would act like a named key without being one: Enter by another name.
      if (!known && [...key].length === 1 && (key.charCodeAt(0) < 0x20 || key.charCodeAt(0) === 0x7f)) {
        throw new HaloError(`${call.tool.name}.press: a control character isn't a key; use one of ${Object.keys(KEYS).join(", ")}`, { code: "TOOL_ARGUMENT" });
      }
      if (!known && [...key].length !== 1) {
        throw new HaloError(`${call.tool.name}.press: unknown key "${key}" (use a single character or ${Object.keys(KEYS).join(", ")})`, { code: "TOOL_ARGUMENT" });
      }
      if (selector) {
        await element(c, selector);
        if (key !== "Enter" && key !== "Tab") await refuseSealedElement(c, selector);
        await evaluate(c, `document.querySelector(${JSON.stringify(selector)}).focus()`);
      } else if (armed(s) && key !== "Enter" && key !== "Tab" && (await activeSealed(c))) {
        throw new HaloError(`${call.tool.name}.press: the focused field is sealed (a wallet value was typed into it); only Enter and Tab can be pressed there`, { code: "TOOL_ARGUMENT" });
      }
      const submits = key === "Enter" || key === "Space" || key === " ";
      if (!(submits && (await submissionGate(c, `press ${key}`)))) await policyGate(c);
      const desc = known ?? { code: "", keyCode: key.toUpperCase().charCodeAt(0), text: key };
      const base = { key: key === "Space" ? " " : key, code: desc.code, windowsVirtualKeyCode: desc.keyCode };
      await sendTo(c, c.frame.sid, "Input.dispatchKeyEvent", { type: desc.text ? "keyDown" : "rawKeyDown", ...base, ...(desc.text ? { text: desc.text } : {}) });
      await sendTo(c, c.frame.sid, "Input.dispatchKeyEvent", { type: "keyUp", ...base });
      await settle(c);
      await checkLocation(c);
      return { pressed: key, ...(await checkedSummary(c, false)) };
    }

    case "select": {
      const selector = checked(c, need(call, "selector:", selectorArg(call)));
      const value = need(call, "value:", call.named.value ?? (call.implicitInput ? undefined : call.positional[1]));
      await element(c, selector);
      await refuseSealedElement(c, selector);
      await policyGate(c);
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
      return { selected: r.value, label: r.label, ...(await checkedSummary(c, false)) };
    }

    case "text":
    case "html": {
      await policyGate(c);
      const raw = selectorArg(call);
      const selector = raw === undefined ? undefined : checked(c, raw);
      if (selector) await element(c, selector);
      if (selector && armed(s)) {
        const ref = await sealedAt(c, selector);
        if (ref) return `[sealed ${ref}]`;
      }
      if (call.method === "html" && armed(s)) return cap(await sealedHtml(c, selector), maxChars(c), s);
      const prop = call.method === "text" ? "innerText" : "outerHTML";
      const v = await evaluate(c, redacted(s, `(() => { const el = ${selector ? `document.querySelector(${JSON.stringify(selector)})` : call.method === "text" ? "document.body" : "document.documentElement"}; return el ? el.${prop} : ""; })()`));
      let out = String(v ?? "");
      if (call.method === "text") out = out.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
      return cap(out, maxChars(c), s);
    }

    case "links": {
      await policyGate(c);
      const limit = Number(call.named.limit ?? 200);
      return evaluate(
        c,
        redacted(s, `(() => { const seen = new Set(); const out = [];
          for (const a of document.querySelectorAll("a[href]")) {
            if (!/^https?:/.test(a.href) || seen.has(a.href)) continue;
            seen.add(a.href); out.push({ text: (a.innerText || a.title || "").trim().replace(/\\s+/g, " ").slice(0, 20000), href: a.href });
            if (out.length >= ${limit}) break;
          } return out; })()`),
      ).then((links: Array<{ text: string; href: string }>) => links.map((l) => ({ text: cap(l.text, 200, s).replace(/…$/, ""), href: s.wallet?.typed.size ? s.wallet.typed.mask(l.href) : l.href })));
    }

    case "frames": {
      await policyGate(c);
      // The frames in the call's frame, each with a selector frame: can use, its host, and whether it is sealed.
      const list: Array<{ selector: string; src: string; backendNodeId?: number }> = await evaluate(
        c,
        `[...document.querySelectorAll("iframe, frame")].slice(0, 30).map((f) => {
          const tag = f.tagName.toLowerCase();
          const path = (el) => { const parts = []; for (let e = el; e && e.parentElement && e !== document.body; e = e.parentElement) { const t = e.tagName.toLowerCase(); const i = [...e.parentElement.children].filter((x) => x.tagName === e.tagName).indexOf(e) + 1; parts.unshift(t + ":nth-of-type(" + i + ")"); } return "body > " + parts.join(" > "); };
          const one = (sel) => document.querySelectorAll(sel).length === 1;
          const byName = f.getAttribute("name") && tag + "[name=" + JSON.stringify(f.getAttribute("name")) + "]";
          const byTitle = f.getAttribute("title") && tag + "[title=" + JSON.stringify(f.getAttribute("title")) + "]";
          const selector = f.id && one("#" + CSS.escape(f.id)) ? "#" + CSS.escape(f.id) : byName && one(byName) ? byName : byTitle && one(byTitle) ? byTitle : path(f);
          return { selector, src: f.getAttribute("srcdoc") !== null ? "about:srcdoc" : f.src || "about:blank", title: f.getAttribute("title") || undefined };
        })`,
      );
      return list.map((f) => {
        let host = "";
        try {
          host = new URL(f.src).hostname.toLowerCase();
        } catch {}
        const sealed = host ? [...c.s.children.entries()].some(([id, x]) => x.url === f.src && frameSealed(c.s, id, host)) || (armed(c.s) && frameSealed(c.s, "", host)) : false;
        return { ...f, ...(host ? { host } : {}), ...(sealed ? { sealed: true } : {}) };
      });
    }

    case "wait": {
      await policyGate(c);
      const selector = checked(c, need(call, "selector:", selectorArg(call)));
      const waitMs = Number(call.named.timeout_ms ?? 10_000);
      const t0 = Date.now();
      const r = await waitFor(c, selector, waitMs);
      return { selector, found: r.found, waited_ms: Date.now() - t0 };
    }

    case "screenshot": {
      await policyGate(c);
      const fullPage = call.named.fullPage === true || call.named.full_page === true;
      // After a wallet value is typed, no screenshot: a page can draw a value in ways no check of its text can see
      // (CSS content, a canvas, a shadow root, undoing Halo's hiding).
      if (armed(s)) throw new HaloError(`${call.tool.name}.screenshot: a wallet value was typed in this browser, so it takes no more screenshots (a page can draw a value where Halo can't check it). Use text, which masks it`, { code: "TOOL_ARGUMENT" });
      const shot = await send(c, "Page.captureScreenshot", { format: "png", captureBeyondViewport: fullPage });
      const raw = call.named.path ?? (call.implicitInput ? undefined : call.positional[0]);
      // Without a path, the screenshot is an image value: a model the result reaches is sent the image.
      if (raw === undefined || raw === null || raw === "") return { image: new MediaBytes(Buffer.from(shot.data, "base64"), { name: "screenshot.png" }) };
      const path = screenshotPath(call, str(raw));
      mkdirSync(dirname(path), { recursive: true });
      const bytes = await Bun.write(path, Buffer.from(shot.data, "base64"));
      return { path: relative(process.cwd(), path), bytes };
    }

    case "back": {
      await policyGate(c);
      const h = await send(c, "Page.getNavigationHistory");
      const prev = h.entries?.[h.currentIndex - 1];
      if (!prev) return { wentBack: false, ...(await summary(c, false)) };
      await send(c, "Page.navigateToHistoryEntry", { entryId: prev.id });
      await settle(c);
      await checkLocation(c);
      return { wentBack: true, ...(await checkedSummary(c, false)) };
    }

    case "evaluate": {
      if (call.config("allowScript") !== true) {
        throw new HaloError(`${call.tool.name}.evaluate runs arbitrary JavaScript; declare the tool with allowScript: true to enable it`, { code: "TOOL_METHOD" });
      }
      await policyGate(c);
      const script = need(call, "script:", call.named.script ?? (call.implicitInput ? undefined : call.positional[0]));
      // The page's own world, so a script sees the page's globals (Halo's other code uses an isolated world).
      const r = await send(c, "Runtime.evaluate", { expression: script, returnByValue: true, awaitPromise: true, userGesture: true });
      if (r.exceptionDetails) threw(c, r.exceptionDetails);
      const value = r.result?.value;
      await settle(c, 50);
      await checkLocation(c);
      return value === undefined ? null : value;
    }

    case "fill_secret":
    case "fill_secrets": {
      let fields: Record<string, unknown>;
      if (call.method === "fill_secret") {
        const selector = need(call, "selector:", selectorArg(call));
        fields = { [selector]: need(call, `ref: (e.g. "Card.number")`, call.named.ref) };
      } else {
        const f = call.named.fields;
        if (!f || typeof f !== "object" || Array.isArray(f)) throw new HaloError(`${call.tool.name}.fill_secrets: fields: maps selectors to wallet refs, e.g. fields: { "#cardNumber": "Card.number" }`, { code: "TOOL_ARGUMENT" });
        fields = f as Record<string, unknown>;
      }
      return fillSecrets(c, fields);
    }

    case "hand_over": {
      const reason = str(call.named.reason ?? (call.implicitInput ? undefined : call.positional[0]) ?? "").trim();
      if (!reason) throw new HaloError(`${call.tool.name}.hand_over needs reason:, what the person should do (e.g. "confirm the payment with your bank")`, { code: "TOOL_ARGUMENT" });
      if (call.config("headless") !== false) throw new HaloError(`${call.tool.name}.hand_over needs a window a person can use: declare the browser with headless: false`, { code: "TOOL_CONFIG" });
      const here = c.chain[0]!;
      const answer = await askPerson(c, {
        key: `handover:${sha(call.tool.name, reason, here.url, String(s.handovers))}`,
        message: `${actor(call)} hands the browser to you on ${registrableDomain(here.host) || here.url}: ${reason.slice(0, 500)}\nDo it in the open Chrome window, then answer "done" (or say what went wrong).`,
        named: { target: `${call.tool.name}.hand_over`, reason, url: here.url, agent: call.wallet?.agent },
        // After a wallet value is typed, only a person says the handover is done, not an automatic approver.
        ...(s.wallet ? { wallet: { mock: [...s.wallet.items.values()].every((it) => it.source === "mock") } } : {}),
      });
      // A typed answer arrives as a word, or as the event the CLI makes of it ({ text: "done", ... }).
      const said = typeof answer === "string" ? answer : answer && typeof answer === "object" ? String((answer as { text?: unknown; action?: unknown }).text ?? (answer as { action?: unknown }).action ?? "") : "";
      const done = isApproval(answer) || /^\s*(done|finished|all done)\s*$/i.test(said);
      s.handovers++;
      if (s.wallet) c.services.walletEvent?.({ tool: call.tool.name, method: "hand_over", refs: s.wallet.typed.refs(), chain: [{ host: here.host, url: here.url }], outcome: "handed_over", detail: reason.slice(0, 200) });
      // The person may have gone anywhere (a bank's 3-D Secure page): report where the tab is, without sending it back.
      const page = await summary(c, true);
      return { handedOver: done, ...(done ? {} : { said: declineReason(answer).slice(2) || String(answer) }), ...page };
    }

    default:
      return unknownMethod(call, methodsFor(call));
  }
}

/**
 * hand_over on a locked browser: the person finishes, then the browser closes and its profile is
 * deleted, so nothing typed stays anywhere. The agent gets only what the person said.
 */
async function handOverLocked(c: Ctx): Promise<unknown> {
  const { call, s } = c;
  const w = s.wallet!;
  const reason = str(call.named.reason ?? (call.implicitInput ? undefined : call.positional[0]) ?? "").trim() || "finish the checkout";
  const answer = await askPerson(c, {
    key: `handover:${sha(call.tool.name, reason, String(s.handovers), ...w.locked!.items)}`,
    message: `${actor(call)} typed ${w.locked!.items.join(", ")} on ${registrableDomain(w.locked!.host) || w.locked!.host} and hands the browser to you: ${reason.slice(0, 500)}\nCheck the page and finish in the open Chrome window (press Pay, confirm with your bank), then answer "done", or say what happened. The browser closes when you answer.`,
    named: { target: `${call.tool.name}.hand_over`, reason, locked: true, agent: call.wallet?.agent },
    // Only a person can answer this, not an automatic approver (unless every item is a mock).
    wallet: { mock: [...w.items.values()].every((it) => it.source === "mock") },
  });
  const said = typeof answer === "string" ? answer : answer && typeof answer === "object" ? String((answer as { text?: unknown; action?: unknown }).text ?? (answer as { action?: unknown }).action ?? "") : "";
  const done = isApproval(answer) || /^\s*(done|finished|all done)\s*$/i.test(said);
  c.services.walletEvent?.({ tool: call.tool.name, method: "hand_over", refs: w.typed.refs(), chain: [{ host: w.locked!.host, url: "" }], outcome: "handed_over", detail: done ? "done" : said.slice(0, 200) });
  s.handovers++;
  // Masked before the browser closes and forgets what was typed: a person may paste a number back.
  const out = w.typed.maskDeep({ handedOver: done, ...(done ? {} : { said: (declineReason(answer).slice(2) || said).slice(0, 2000) }), closed: true });
  await closeSession(s);
  return out;
}

/** Whether the focused element of the call's frame is sealed. */
async function activeSealed(c: Ctx): Promise<boolean> {
  for (const x of sealedIn(c.s, c.frame)) {
    if (await onNode(c, c.frame, x.backendNodeId, `function () { return this.ownerDocument.activeElement === this; }`).catch(() => false)) return true;
  }
  return false;
}

export const chromeProvider: ToolProvider = async (call, services) => {
  const wallet = walletConfig(call);
  if (wallet && call.config("allowScript") === true) {
    throw new HaloError(`Tool "${call.tool.name}" has a wallet, so it can't run page scripts: remove allowScript: true (a script could read what was typed)`, { code: "TOOL_CONFIG" });
  }
  if (call.method === "evaluate" && call.config("allowScript") !== true) {
    // Refuse before launching a browser.
    throw new HaloError(`${call.tool.name}.evaluate runs arbitrary JavaScript; declare the tool with allowScript: true to enable it`, { code: "TOOL_METHOD" });
  }
  if (!wallet && (call.method === "fill_secrets" || call.method === "fill_secret")) {
    throw new HaloError(`${call.tool.name}.${call.method} types values from a wallet: declare the browser with one, e.g. ${call.tool.name} : Chrome(wallet: [Card])`, { code: "TOOL_CONFIG" });
  }
  if (!METHODS.includes(call.method) && !["goto", "navigate", "type"].includes(call.method)) unknownMethod(call, methodsFor(call));
  // The wallet's items are checked before a browser starts (a program that can't hold one fails here).
  if (wallet) services.wallet?.(wallet);
  const s = await session(call);
  const c: Ctx = { call, s, services, timeoutMs: Number(call.config("timeout_ms") ?? 30_000), frame: top(s), chain: [] };
  // Calls on one browser run one at a time (an agent may call tools in parallel).
  const result = s.queue.then(async () => {
    touch(s);
    try {
      const out = await run(c);
      // An armed session masks every typed value in what it returns.
      return s.wallet?.typed.size ? s.wallet.typed.maskDeep(out) : out;
    } catch (err) {
      if (s.wallet?.typed.size && err instanceof HaloError) {
        const masked = s.wallet.typed.mask(err.message);
        if (masked !== err.message) throw new HaloError(masked, { code: err.code, retryable: err.retryable });
      }
      throw err;
    } finally {
      if (!s.cdp.closed) touch(s);
    }
  });
  s.queue = result.catch(() => {});
  return result;
};

// ── Description for agents and `halo plan` ──

const selectorParam = { type: "string", description: "A CSS selector, e.g. \"#email\", \"button[type=submit]\", \"a[href*='pricing']\"" };
const timeoutParam = { type: "number", description: "How long to wait for the element to appear, in milliseconds (default 5000)" };
const frameParam = {
  anyOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
  description: "Work inside a frame: a selector for an <iframe> in the page (links lists them), or a list of selectors for nested frames",
};

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
    params: { type: "object", properties: { selector: selectorParam, frame: frameParam, timeout_ms: timeoutParam }, required: ["selector"] },
    effect: "external",
  },
  {
    name: "fill",
    description: "Clear a text field (input, textarea or contenteditable) and type a value into it. Returns { filled, value, url, title }.",
    params: { type: "object", properties: { selector: selectorParam, value: { type: "string", description: "The text to type" }, frame: frameParam, timeout_ms: timeoutParam }, required: ["selector", "value"] },
    effect: "external",
  },
  {
    name: "press",
    description: `Press a key in the page, e.g. "Enter" to submit the focused form. Keys: a single character or ${Object.keys(KEYS).join(", ")}. With selector, focuses that element first.`,
    params: { type: "object", properties: { key: { type: "string", description: "The key to press" }, selector: selectorParam, frame: frameParam }, required: ["key"] },
    effect: "external",
  },
  {
    name: "select",
    description: "Choose an option in a <select> dropdown, by its value or its visible label. Returns { selected, label, url, title }.",
    params: { type: "object", properties: { selector: selectorParam, value: { type: "string", description: "The option's value or visible label" }, frame: frameParam }, required: ["selector", "value"] },
    effect: "external",
  },
  {
    name: "text",
    description: "Get the readable text of the current page, or of the first element matching a selector.",
    params: { type: "object", properties: { selector: { ...selectorParam, description: "Optional CSS selector; the whole page when omitted" }, frame: frameParam } },
    effect: "read",
  },
  {
    name: "html",
    description: "Get the HTML of the current page, or the outer HTML of the first element matching a selector.",
    params: { type: "object", properties: { selector: { ...selectorParam, description: "Optional CSS selector; the whole page when omitted" }, frame: frameParam } },
    effect: "read",
  },
  {
    name: "links",
    description: "List the links on the current page as [{ text, href }] (http(s) links only, without duplicates). When the page has frames, returns { links, frames }, with a selector for each frame.",
    params: { type: "object", properties: { limit: { type: "number", description: "At most this many links (default 200)" }, frame: frameParam } },
    effect: "read",
  },
  {
    name: "frames",
    description: "List the frames (<iframe>s) in the page as [{ selector, src, host, sealed? }]. Pass a selector as frame: to work inside one; for a frame inside a frame, pass a list.",
    params: { type: "object", properties: { frame: frameParam } },
    effect: "read",
  },
  {
    name: "wait",
    description: "Wait until an element matching a selector is visible (e.g. after content loads). Returns { selector, found, waited_ms }; found is false if it timed out.",
    params: { type: "object", properties: { selector: selectorParam, frame: frameParam, timeout_ms: { type: "number", description: "How long to wait, in milliseconds (default 10000)" } }, required: ["selector"] },
    effect: "read",
  },
  {
    name: "screenshot",
    description: "Take a PNG screenshot of the page. With path, saves it (under the current directory) and returns { path, bytes }; otherwise returns { image }, which you are shown.",
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

const WALLET_METHODS: ToolMethod[] = [
  {
    name: "fill_secrets",
    description:
      'Type values from the wallet into form fields: fields maps each field\'s CSS selector to a wallet ref like "Card.number" (or "Card.expiry:MM/YY", "Card.expiry:MM", "Card.number:1-4" for part of a split number). You never see the values. A person approves first; the fields are then sealed (you can\'t read them back), and the next click or Enter asks the person too, since it may pay. Card fields are often inside a payment frame: pass frame (the frames method lists them). Returns { filled, armed, url, title }.',
    params: {
      type: "object",
      properties: {
        fields: { type: "object", additionalProperties: { type: "string" }, description: 'Selector → wallet ref, e.g. { "#cardNumber": "Card.number", "#cvc": "Card.cvc" }' },
        frame: frameParam,
      },
      required: ["fields"],
    },
    effect: "wallet",
  },
  {
    name: "fill_secret",
    description: 'Type one value from the wallet into one form field: selector, and ref like "Card.number". The same as fill_secrets with one field.',
    params: { type: "object", properties: { selector: selectorParam, ref: { type: "string", description: 'A wallet ref, e.g. "Card.number" or "Card.expiry:MM/YY"' }, frame: frameParam }, required: ["selector", "ref"] },
    effect: "wallet",
  },
  {
    name: "hand_over",
    description: "Ask the person to do a step themselves in the open browser window (confirm a payment with their bank, enter a one-time code, solve a CAPTCHA, press Pay), and wait until they say it's done. Returns { handedOver, url, title, text }.",
    params: { type: "object", properties: { reason: { type: "string", description: "What the person should do, e.g. \"confirm the payment with your bank\"" } }, required: ["reason"] },
    effect: "external",
  },
];

/** evaluate only with allowScript: true (and no wallet); fill_secrets only with a wallet; hand_over with a wallet or a window. */
function chromeMethods(config: (name: string) => unknown): ToolMethod[] {
  const wallet = config("wallet") !== undefined;
  return [
    ...CHROME_METHODS,
    ...(config("allowScript") === true && !wallet ? [EVALUATE_METHOD] : []),
    ...(wallet ? WALLET_METHODS : config("headless") === false ? WALLET_METHODS.filter((m) => m.name === "hand_over") : []),
  ];
}

export const CHROME_INFO: ProviderInfo = {
  description: "A headless Chrome browser tab: open pages (running their JavaScript), click, fill forms, read text, take screenshots.",
  methods: async (ctx) => chromeMethods((k) => ctx.config(k)),
  methodsFor: chromeMethods,
};
