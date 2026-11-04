// Blueprint files are bundled into the CLI as text (`import x from "..." with { type: "text" }`).
declare module "*.halo" {
  const text: string;
  export default text;
}
declare module "*.md" {
  const text: string;
  export default text;
}
declare module "*.example" {
  const text: string;
  export default text;
}
declare module "*.gitignore" {
  const text: string;
  export default text;
}
declare module "*/Dockerfile" {
  const text: string;
  export default text;
}
declare module "*.sql" {
  const text: string;
  export default text;
}

declare module "*.jsonc" {
  const text: string;
  export default text;
}

// The cloudflare-email blueprint's Worker is bundled as text too, but TypeScript still checks it
// here: an import of a .ts file always resolves to the file. These are the few Workers runtime
// types it uses, so that check passes without @cloudflare/workers-types. The blueprint's own
// `npm run typecheck` checks it against the real ones.
interface SqlStorageCursor<T> {
  toArray(): T[];
  one(): T;
  readonly rowsWritten: number;
}
interface DurableObjectState<_Props = unknown> {
  storage: {
    sql: { exec<T extends Record<string, unknown> = Record<string, unknown>>(query: string, ...bindings: unknown[]): SqlStorageCursor<T> };
    getAlarm(): Promise<number | null>;
    setAlarm(time: number): Promise<void>;
  };
}
interface DurableObjectNamespace<T = unknown> {
  idFromName(name: string): unknown;
  get(id: unknown): T;
}
interface SendEmail {
  send(message: { to: string; from: { email: string; name: string }; subject: string; text: string; headers?: Record<string, string> }): Promise<unknown>;
}
interface ForwardableEmailMessage {
  readonly from: string;
  readonly to: string;
  readonly headers: Headers;
  readonly raw: ReadableStream<Uint8Array>;
  readonly rawSize: number;
  setReject(reason: string): void;
}
interface ExportedHandler<E = unknown> {
  email?(message: ForwardableEmailMessage, env: E, ctx: unknown): void | Promise<void>;
  fetch?(request: Request, env: E, ctx: unknown): Response | Promise<Response>;
}
declare module "cloudflare:workers" {
  export abstract class DurableObject<E = unknown> {
    constructor(ctx: DurableObjectState, env: E);
    protected ctx: DurableObjectState;
    protected env: E;
    alarm?(): Promise<void>;
  }
}
declare module "@cloudflare/containers" {
  export class Container<E = unknown> {
    constructor(ctx: DurableObjectState<{}>, env: E);
    defaultPort?: number;
    sleepAfter: string | number;
    pingEndpoint: string;
    envVars: Record<string, string>;
  }
  export function getContainer(binding: unknown, name?: string): { fetch(request: Request): Promise<Response> };
}
declare module "postal-mime" {
  const PostalMime: {
    parse(raw: ArrayBuffer): Promise<{ text?: string; html?: string; subject?: string; messageId?: string; from?: { name?: string } }>;
  };
  export default PostalMime;
}
