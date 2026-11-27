/**
 * The status line `halo run` shows on stderr while a run works:
 *
 *   ⠹ Triage · 2/4 Triager.prompt · writing, 120 words · 4.1s · $0.0031
 *
 * It's only drawn on a terminal (never in CI, a pipe or a log file), and it gets out of the
 * way: anything else written to stdout or stderr clears it first and it's redrawn on the next
 * tick, and it stops while the run asks a person something.
 */
import type { RuntimeEvent } from "./runtime/runtime.js";

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const TICK_MS = 80;
const CLEAR = "\r\x1b[2K";

export interface ProgressOptions {
  /** How many top-level stages each pipeline has, by name, for "2/4". */
  stages: Record<string, number>;
  stream?: NodeJS.WriteStream;
  color?: boolean;
  now?: () => number;
}

/** Whether to show progress: stderr is a terminal and nothing asked for quiet. */
export function progressWanted(env: Record<string, string | undefined> = process.env, stream: { isTTY?: boolean } = process.stderr): boolean {
  if (!stream.isTTY) return false;
  if (env.CI || env.HALO_NO_PROGRESS || env.TERM === "dumb") return false;
  return true;
}

export class Progress {
  private readonly stream: NodeJS.WriteStream;
  private readonly color: boolean;
  private readonly now: () => number;
  private readonly stages: Record<string, number>;
  private timer: ReturnType<typeof setInterval> | undefined;
  private frame = 0;
  private drawn = false;
  private paused = 0;
  private started = 0;
  private cost = 0;
  /** Stage being run, innermost pipeline last (a pipeline can call another). */
  private stack: Array<{ pipeline: string; index: number; label: string }> = [];
  /** What's happening inside the stage: a model writing, a tool answering, a retry. */
  private detail = "";
  private words = 0;
  private restore: Array<() => void> = [];

  constructor(options: ProgressOptions) {
    this.stream = options.stream ?? process.stderr;
    this.color = options.color ?? !process.env.NO_COLOR;
    this.now = options.now ?? (() => performance.now());
    this.stages = options.stages;
  }

  start(): this {
    if (this.timer) return this;
    this.started = this.now();
    this.intercept();
    this.timer = setInterval(() => this.draw(), TICK_MS);
    this.timer.unref?.();
    this.draw();
    return this;
  }

  /** Clear the line and stop for good. */
  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    this.clear();
    for (const undo of this.restore.splice(0)) undo();
  }

  /** Run `fn` with the line cleared and not redrawn, as when the run asks a person something. */
  async hold<T>(fn: () => T | Promise<T>): Promise<T> {
    this.paused++;
    this.clear();
    try {
      return await fn();
    } finally {
      this.paused--;
    }
  }

  event(e: RuntimeEvent): void {
    switch (e.type) {
      case "stage":
        if (e.status === "start") {
          // A stage of a pipeline already on the stack replaces it and anything it called.
          const at = this.stack.findIndex((s) => s.pipeline === e.pipeline);
          if (at >= 0) this.stack.length = at;
          this.stack.push({ pipeline: e.pipeline, index: e.index, label: e.label });
          this.detail = "";
          this.words = 0;
        } else {
          const at = this.stack.findIndex((s) => s.pipeline === e.pipeline);
          if (at > 0) this.stack.length = at + 1;
        }
        break;
      case "token":
        this.words += e.text.split(/\s+/).filter(Boolean).length;
        this.detail = `${e.target} writing, ${this.words} word${this.words === 1 ? "" : "s"}`;
        break;
      case "llm":
        this.cost += e.cost;
        this.detail = `${e.agent} answered in ${seconds(e.latencyMs)}`;
        this.words = 0;
        break;
      case "tool":
        this.detail = `${e.tool}.${e.method} done`;
        break;
      case "tool_progress": {
        // The message is the server's text: no control characters reach the terminal.
        const message = (e.message ?? "").replace(/[\u0000-\u001f\u007f-\u009f]/g, " ").slice(0, 80);
        this.detail = `${e.tool}.${e.method} ${e.total ? `${Math.round((e.progress / e.total) * 100)}%` : e.progress}${message ? `: ${message}` : ""}`;
        break;
      }
      case "agent_tool":
        this.detail = `${e.agent} → ${e.target}${e.decision === "allowed" || e.decision === "approved" ? "" : ` (${e.decision})`}`;
        break;
      case "retry":
        this.detail = `retrying ${e.target} (attempt ${e.attempt})`;
        break;
      case "correction":
        this.detail = `${e.target} fixing its answer`;
        break;
      case "escalate":
        this.detail = `${e.target} trying ${e.to}`;
        break;
      case "loop":
        this.detail = `loop ${e.iteration}`;
        break;
    }
  }

  /** The status line, without the spinner frame, cut to `width` columns. */
  line(width = this.stream.columns || 80): string {
    const parts: string[] = [];
    const stage = this.stack.at(-1);
    if (stage) {
      const path = this.stack.map((s) => s.pipeline).join(" › ");
      const total = this.stages[stage.pipeline];
      parts.push(`${path} · ${total ? `${Math.min(stage.index + 1, total)}/${total} ` : ""}${stage.label}`);
    } else {
      parts.push("starting");
    }
    if (this.detail) parts.push(this.detail);
    parts.push(seconds(this.now() - this.started));
    if (this.cost > 0) parts.push(`$${this.cost.toFixed(4)}`);
    const text = parts.join(" · ").replace(/\s+/g, " ");
    // Two columns for the frame and its space; one spare so the cursor never wraps.
    const room = Math.max(10, width - 3);
    return text.length > room ? `${text.slice(0, room - 1)}…` : text;
  }

  private draw(): void {
    if (this.paused || !this.timer) return;
    const spinner = FRAMES[this.frame++ % FRAMES.length]!;
    const text = this.line();
    this.write(`${CLEAR}${this.color ? `\x1b[36m${spinner}\x1b[0m \x1b[2m${text}\x1b[0m` : `${spinner} ${text}`}`);
    this.drawn = true;
  }

  private clear(): void {
    if (!this.drawn) return;
    this.write(CLEAR);
    this.drawn = false;
  }

  private write: (s: string) => void = (s) => void this.stream.write(s);

  /**
   * Clear the line before anything else reaches the terminal. Bun's console writes straight to
   * the file descriptor, so console methods are wrapped as well as the streams' write.
   */
  private intercept(): void {
    const own = this.stream.write.bind(this.stream);
    this.write = (s) => void own(s);
    for (const stream of [process.stdout, process.stderr]) {
      const original = stream.write;
      stream.write = ((...args: Parameters<typeof original>) => {
        this.clear();
        return original.apply(stream, args);
      }) as typeof original;
      this.restore.push(() => (stream.write = original));
    }
    for (const name of ["log", "error", "warn", "info", "debug"] as const) {
      const original = console[name];
      console[name] = (...args: unknown[]) => {
        this.clear();
        original.apply(console, args);
      };
      this.restore.push(() => (console[name] = original));
    }
  }
}

export function seconds(ms: number): string {
  return ms < 10_000 ? `${(ms / 1000).toFixed(1)}s` : ms < 60_000 ? `${Math.round(ms / 1000)}s` : `${Math.floor(ms / 60_000)}m${String(Math.round((ms % 60_000) / 1000)).padStart(2, "0")}s`;
}
