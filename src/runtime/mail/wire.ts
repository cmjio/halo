/**
 * A TCP or TLS connection read as bytes on demand, for the line protocols mail speaks
 * (SMTP and IMAP): read a line, read n bytes, write, and switch to TLS mid-conversation.
 */

import net from "node:net";
import tls from "node:tls";

export type Security = "tls" | "starttls" | "none";

export interface WireOptions {
  host: string;
  port: number;
  /** "tls" from the first byte; otherwise plain (the caller may `secure()` it later). */
  tls: boolean;
  /** False accepts a certificate that can't be verified (a relay with a private CA). */
  verify?: boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
}

const LOOPBACK = new Set(["127.0.0.1", "localhost", "::1"]);
export const isLoopback = (host: string) => LOOPBACK.has(host);

export class Wire {
  private buffer: Buffer = Buffer.alloc(0);
  private waiting: (() => void) | undefined;
  private failure: Error | undefined;
  private ended = false;
  private socket!: net.Socket;
  encrypted = false;

  private constructor(private options: WireOptions) {}

  static async open(options: WireOptions): Promise<Wire> {
    const wire = new Wire(options);
    await new Promise<void>((resolve, reject) => {
      const onError = (err: Error) => reject(new Error(`Could not connect to ${options.host}:${options.port}: ${err.message}`));
      const socket = options.tls
        ? tls.connect({ host: options.host, port: options.port, servername: net.isIP(options.host) ? undefined : options.host, rejectUnauthorized: options.verify !== false }, resolve)
        : net.connect({ host: options.host, port: options.port }, resolve);
      socket.once("error", onError);
      wire.attach(socket, onError);
      wire.encrypted = options.tls;
    });
    return wire;
  }

  private attach(socket: net.Socket, connectError?: (err: Error) => void) {
    this.socket = socket;
    socket.setTimeout(this.options.timeoutMs ?? 30_000, () => socket.destroy(new Error(`${this.options.host} stopped answering`)));
    socket.on("data", (chunk: Buffer) => {
      this.buffer = this.buffer.length ? Buffer.concat([this.buffer, chunk]) : chunk;
      this.wake();
    });
    socket.on("error", (err) => {
      this.failure ??= err;
      this.wake();
    });
    socket.on("close", () => {
      this.ended = true;
      this.wake();
    });
    socket.once("connect", () => connectError && socket.off("error", connectError));
    socket.once("secureConnect", () => connectError && socket.off("error", connectError));
    this.options.signal?.addEventListener("abort", () => socket.destroy(new Error("The run was stopped")), { once: true });
  }

  private wake() {
    const w = this.waiting;
    this.waiting = undefined;
    w?.();
  }

  private async more(): Promise<void> {
    const failed = () => (this.failure ? new Error(`${this.options.host}: ${this.failure.message}`) : undefined);
    if (failed()) throw failed();
    if (this.ended) throw new Error(`${this.options.host} closed the connection`);
    await new Promise<void>((r) => (this.waiting = r));
    if (failed() && !this.buffer.length) throw failed();
  }

  /** The next line, without its line end. Bytes are kept as they are (one character each). */
  async line(): Promise<string> {
    for (;;) {
      const at = this.buffer.indexOf("\n");
      if (at !== -1) {
        const line = this.buffer.subarray(0, at).toString("latin1").replace(/\r$/, "");
        this.buffer = this.buffer.subarray(at + 1);
        return line;
      }
      if (this.buffer.length > 1_000_000) throw new Error(`${this.options.host} sent a line that never ends`);
      await this.more();
    }
  }

  async bytes(n: number): Promise<Buffer> {
    while (this.buffer.length < n) await this.more();
    const out = Buffer.from(this.buffer.subarray(0, n));
    this.buffer = this.buffer.subarray(n);
    return out;
  }

  write(data: string | Uint8Array): Promise<void> {
    return new Promise((resolve, reject) => this.socket.write(data, (err) => (err ? reject(err) : resolve())));
  }

  /** Switch the open connection to TLS (after STARTTLS was accepted). */
  async secure(): Promise<void> {
    const plain = this.socket;
    plain.removeAllListeners("data");
    plain.removeAllListeners("error");
    plain.removeAllListeners("close");
    plain.setTimeout(0);
    this.buffer = Buffer.alloc(0);
    await new Promise<void>((resolve, reject) => {
      const socket = tls.connect({ socket: plain, servername: net.isIP(this.options.host) ? undefined : this.options.host, rejectUnauthorized: this.options.verify !== false }, resolve);
      const onError = (err: Error) => reject(new Error(`${this.options.host} did not complete TLS: ${err.message}`));
      socket.once("error", onError);
      this.attach(socket, onError);
    });
    this.encrypted = true;
  }

  close(): void {
    this.socket.destroy();
  }
}
