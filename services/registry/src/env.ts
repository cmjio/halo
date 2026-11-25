/**
 * The bindings this Worker uses, typed structurally: just the parts of D1, R2, the Cache API
 * and the Rate Limiting binding that the code calls. Keeping them structural (rather than
 * pulling in @cloudflare/workers-types globals) lets the same code type-check under Bun, where
 * the tests run it against in-memory fakes (test/registry-service.test.ts). They match
 * services/registry/wrangler.jsonc.
 */

export interface D1Result<T = Record<string, unknown>> {
  results: T[];
  success: boolean;
  meta: { changes?: number; last_row_id?: number };
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(column?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<D1Result>;
  raw<T = unknown[]>(): Promise<T[]>;
}

export interface D1Database {
  prepare(sql: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<D1Result[]>;
  exec(sql: string): Promise<unknown>;
}

export interface R2ObjectHead {
  key: string;
  size: number;
  httpEtag: string;
  customMetadata?: Record<string, string>;
}

export interface R2ObjectBody extends R2ObjectHead {
  body: ReadableStream;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface R2Bucket {
  get(key: string): Promise<R2ObjectBody | null>;
  head(key: string): Promise<R2ObjectHead | null>;
  put(key: string, value: ArrayBuffer | Uint8Array | string, options?: { httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> }): Promise<R2ObjectHead | null>;
  delete(key: string): Promise<void>;
}

export interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface EdgeCache {
  match(request: Request | string): Promise<Response | undefined>;
  put(request: Request | string, response: Response): Promise<void>;
  delete(request: Request | string): Promise<boolean>;
}

export interface Env {
  DB: D1Database;
  PACKAGES: R2Bucket;
  /** Absent under `bun test`, and skipped then. */
  RATE_LIMITER?: RateLimiter;
  GITHUB_URL: string;
  GITHUB_API_URL: string;
  PUBLIC_URL: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  /** DNS over HTTPS endpoint for domain verification. Default https://cloudflare-dns.com/dns-query. */
  DOH_URL?: string;
  /**
   * "true" lets hosted packages point at http, localhost or private addresses. Only for local
   * registries (the e2e test sets it with `wrangler dev --var`); unset in production.
   */
  ALLOW_LOCAL_HOSTED_ENDPOINTS?: string;
}

export const allowLocalHostedEndpoints = (env: Env) => /^(true|1|yes)$/i.test(env.ALLOW_LOCAL_HOSTED_ENDPOINTS ?? "");

export interface Ctx {
  waitUntil(promise: Promise<unknown>): void;
}

/** The Workers Cache API's default cache, when running on Workers (or a test installs one). */
export function edgeCache(): EdgeCache | undefined {
  const g = globalThis as { caches?: { default?: EdgeCache } };
  return g.caches?.default;
}
