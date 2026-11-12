/**
 * The registry Worker (services/registry) against in-memory fakes: D1 over bun:sqlite with the
 * real migration, R2 as a Map, the Cache API as a Map, and a fake GitHub and DNS-over-HTTPS
 * server. The Worker's fetch(request, env, ctx) is called directly.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { MAX_PACKAGE_BYTES, MAX_PACKAGE_WIRE_BYTES, PACKAGE_FORMAT_V2, PACKAGE_MEDIA_TYPE, type PackageDoc, type PackageStats, type PackageSummary, type SearchResponse } from "../src/registry/contract";
import { runPackageCommand } from "../src/registry/cli";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import worker from "../services/registry/src/index";
import type { D1Database, D1PreparedStatement, D1Result, EdgeCache, Env, R2Bucket, R2ObjectBody } from "../services/registry/src/env";
import { PAGE_CSP } from "../services/registry/src/http";
import { renderMarkdown } from "../services/registry/src/markdown";

const ROOT = join(import.meta.dir, "..");
const MIGRATIONS_DIR = join(ROOT, "services/registry/migrations");
const MIGRATION = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(join(MIGRATIONS_DIR, f), "utf8"))
  .join("\n");
const FIXTURES = join(import.meta.dir, "fixtures/packages");

// ── Fakes ──

class FakeStatement implements D1PreparedStatement {
  constructor(
    private db: Database,
    readonly sql: string,
    private values: unknown[] = [],
  ) {}
  bind(...values: unknown[]): D1PreparedStatement {
    for (const v of values) if (v === undefined) throw new Error("D1_TYPE_ERROR: undefined is not a supported type");
    return new FakeStatement(this.db, this.sql, values);
  }
  private params() {
    return this.values as never[];
  }
  async first<T>(column?: string): Promise<T | null> {
    const row = this.db.query(this.sql).get(...this.params()) as Record<string, unknown> | null;
    if (!row) return null;
    return (column ? row[column] : row) as T;
  }
  allSync<T>(): D1Result<T> {
    return { results: this.db.query(this.sql).all(...this.params()) as T[], success: true, meta: {} };
  }
  async all<T>(): Promise<D1Result<T>> {
    return this.allSync<T>();
  }
  runSync(): D1Result {
    const r = this.db.query(this.sql).run(...this.params());
    return { results: [], success: true, meta: { changes: r.changes, last_row_id: Number(r.lastInsertRowid) } };
  }
  async run(): Promise<D1Result> {
    return this.runSync();
  }
  async raw<T>(): Promise<T[]> {
    return this.db.query(this.sql).values(...this.params()) as T[];
  }
}

class FakeD1 implements D1Database {
  readonly db = new Database(":memory:");
  constructor() {
    this.db.exec("PRAGMA foreign_keys = ON");
    this.db.exec(MIGRATION);
  }
  prepare(sql: string): D1PreparedStatement {
    return new FakeStatement(this.db, sql);
  }
  async batch(statements: D1PreparedStatement[]): Promise<D1Result[]> {
    // D1 runs a batch as one transaction.
    return this.db.transaction(() =>
      statements.map((s) => {
        const st = s as FakeStatement;
        return /^\s*(SELECT|WITH)/i.test(st.sql) ? (st.allSync() as D1Result) : st.runSync();
      }),
    )();
  }
  async exec(sql: string) {
    this.db.exec(sql);
    return {};
  }
}

class FakeR2 implements R2Bucket {
  readonly objects = new Map<string, { bytes: Uint8Array; customMetadata: Record<string, string> }>();
  private meta(key: string) {
    const o = this.objects.get(key)!;
    return { key, size: o.bytes.byteLength, httpEtag: `"${createHash("md5").update(o.bytes).digest("hex")}"`, customMetadata: o.customMetadata };
  }
  async get(key: string): Promise<R2ObjectBody | null> {
    const o = this.objects.get(key);
    if (!o) return null;
    return { ...this.meta(key), body: new Response(o.bytes).body!, arrayBuffer: async () => o.bytes.slice().buffer };
  }
  async head(key: string) {
    return this.objects.has(key) ? this.meta(key) : null;
  }
  async put(key: string, value: ArrayBuffer | Uint8Array | string, options?: { customMetadata?: Record<string, string> }) {
    const bytes = typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value instanceof Uint8Array ? value : new Uint8Array(value));
    this.objects.set(key, { bytes: bytes.slice(), customMetadata: options?.customMetadata ?? {} });
    return this.meta(key);
  }
  async delete(key: string) {
    this.objects.delete(key);
  }
}

class FakeCache implements EdgeCache {
  readonly entries = new Map<string, Response>();
  async match(req: Request | string) {
    return this.entries.get(typeof req === "string" ? req : req.url)?.clone() as Response | undefined;
  }
  async put(req: Request | string, res: Response) {
    this.entries.set(typeof req === "string" ? req : req.url, res.clone() as Response);
  }
  async delete(req: Request | string) {
    return this.entries.delete(typeof req === "string" ? req : req.url);
  }
}

/** A scripted GitHub: each poll of a device code takes the next step from `script`. */
const github = {
  script: [] as (string | { id: number; login: string })[],
  issued: 0,
  lastPoll: undefined as Record<string, unknown> | undefined,
};
/** TXT records the fake DNS-over-HTTPS server answers with. */
const dns = new Map<string, string[]>();
/** Every name the fake DNS-over-HTTPS server was asked about; and whether it fails. */
const dnsQueries: string[] = [];
let dnsFail = false;

let server: ReturnType<typeof Bun.serve>;
const tokensByAccess = new Map<string, { id: number; login: string }>();

beforeAll(() => {
  server = Bun.serve({
    port: 0,
    async fetch(req) {
      const url = new URL(req.url);
      if (url.pathname === "/login/device/code") {
        github.issued++;
        return Response.json({ device_code: `dc-${github.issued}-${crypto.randomUUID()}`, user_code: "ABCD-1234", verification_uri: "https://github.com/login/device", expires_in: 900, interval: 5 });
      }
      if (url.pathname === "/login/oauth/access_token") {
        github.lastPoll = (await req.json()) as Record<string, unknown>;
        const step = github.script.shift() ?? "authorization_pending";
        if (typeof step === "string") return Response.json({ error: step, ...(step === "slow_down" ? { interval: 10 } : {}) });
        const access = `gho_${crypto.randomUUID()}`;
        tokensByAccess.set(access, step);
        return Response.json({ access_token: access, token_type: "bearer", scope: "" });
      }
      if (url.pathname === "/api/user") {
        const user = tokensByAccess.get((req.headers.get("authorization") ?? "").replace(/^Bearer /, ""));
        return user ? Response.json({ id: user.id, login: user.login, name: user.login }) : new Response("no", { status: 401 });
      }
      if (url.pathname === "/dns-query") {
        expect(req.headers.get("accept")).toBe("application/dns-json");
        const name = url.searchParams.get("name")!;
        dnsQueries.push(name);
        if (dnsFail) return new Response("SERVFAIL", { status: 502 });
        return Response.json({ Status: 0, Answer: (dns.get(name) ?? []).map((v) => ({ name, type: 16, TTL: 60, data: `"${v}"` })) });
      }
      return new Response("not found", { status: 404 });
    },
  });
});
afterAll(() => {
  server.stop(true);
  delete (globalThis as { caches?: unknown }).caches;
});

// ── Harness ──

interface Harness {
  env: Env;
  d1: FakeD1;
  r2: FakeR2;
  cache: FakeCache;
  call(method: string, path: string, opts?: { token?: string; json?: unknown; body?: RequestInit["body"]; headers?: Record<string, string> }): Promise<Response>;
  login(login: string, id: number): Promise<string>;
  publish(token: string, pkg: Uint8Array, name?: string): Promise<Response>;
}

function harness(): Harness {
  const d1 = new FakeD1();
  const r2 = new FakeR2();
  const cache = new FakeCache();
  (globalThis as { caches?: unknown }).caches = { default: cache };
  const base = `http://localhost:${server.port}`;
  const env: Env = {
    DB: d1,
    PACKAGES: r2,
    GITHUB_URL: base,
    GITHUB_API_URL: `${base}/api`,
    PUBLIC_URL: "https://registry.halolang.com",
    GITHUB_CLIENT_ID: "test-client",
    GITHUB_CLIENT_SECRET: "test-secret",
    DOH_URL: `${base}/dns-query`,
  };
  const call: Harness["call"] = async (method, path, opts = {}) => {
    const pending: Promise<unknown>[] = [];
    const headers: Record<string, string> = { ...opts.headers };
    if (opts.token) headers.authorization = `Bearer ${opts.token}`;
    let body = opts.body;
    if (opts.json !== undefined) {
      body = JSON.stringify(opts.json);
      headers["content-type"] ??= "application/json";
    }
    const res = await worker.fetch(new Request(`https://registry.halolang.com/${path}`, { method, headers, body }), env, { waitUntil: (p) => void pending.push(p) });
    await Promise.all(pending);
    return res;
  };
  const login = async (name: string, id: number) => {
    github.script = [{ id, login: name }];
    const start = (await (await call("POST", "v1/auth/device")).json()) as { device_code: string };
    const res = await call("POST", "v1/auth/device/token", { json: { device_code: start.device_code } });
    expect(res.status).toBe(200);
    return ((await res.json()) as { token: string }).token;
  };
  const publish: Harness["publish"] = (token, pkg, name) => {
    const n = name ?? (JSON.parse(new TextDecoder().decode(pkg)) as { manifest: { name: string } }).manifest.name;
    return call("PUT", `v1/packages/${n}`, { token, body: pkg, headers: { "content-type": PACKAGE_MEDIA_TYPE } });
  };
  return { env, d1, r2, cache, call, login, publish };
}

/** A PackageFileV2's bytes from a fixture folder; `edit` may change files (text) and the manifest. */
function buildPackage(
  fixture: string,
  edit: { manifest?: (m: Record<string, unknown>) => void; files?: (f: Record<string, string>) => void; hosted?: Record<string, unknown>; format?: string } = {},
): Uint8Array {
  const dir = join(FIXTURES, fixture);
  const text: Record<string, string> = {};
  const walk = (rel: string) => {
    for (const entry of readdirSync(join(dir, rel))) {
      const p = rel ? `${rel}/${entry}` : entry;
      if (statSync(join(dir, p)).isDirectory()) walk(p);
      else text[p] = readFileSync(join(dir, p), "utf8");
    }
  };
  walk("");
  const manifest = JSON.parse(text["halo.json"]!) as Record<string, unknown>;
  edit.manifest?.(manifest);
  text["halo.json"] = JSON.stringify(manifest, null, 2);
  edit.files?.(text);
  const files = Object.fromEntries(Object.entries(text).map(([k, v]) => [k, Buffer.from(v, "utf8").toString("base64")]));
  return new TextEncoder().encode(JSON.stringify({ format: edit.format ?? PACKAGE_FORMAT_V2, manifest, files, ...(edit.hosted ? { hosted: edit.hosted } : {}) }));
}

const version = (v: string) => (m: Record<string, unknown>) => void (m.version = v);

async function setupAcme(h: Harness): Promise<string> {
  const token = await h.login("Acme", 1);
  expect((await h.publish(token, buildPackage("acme-zendesk"))).status).toBe(201);
  expect((await h.publish(token, buildPackage("acme-support-kit"))).status).toBe(201);
  return token;
}

// ── Tests ──

describe("sign-in (GitHub device flow)", () => {
  test("happy path: user, own scope, token; GitHub's token is never stored", async () => {
    const h = harness();
    github.script = ["authorization_pending", { id: 42, login: "Alice" }];
    const start = await h.call("POST", "v1/auth/device");
    expect(start.status).toBe(200);
    const s = (await start.json()) as { device_code: string; user_code: string; verification_uri: string; interval: number; expires_in: number };
    expect(s.user_code).toBe("ABCD-1234");
    expect(s.interval).toBe(5);

    const pending = await h.call("POST", "v1/auth/device/token", { json: { device_code: s.device_code } });
    expect(pending.status).toBe(428);
    expect(((await pending.json()) as { code: string }).code).toBe("authorization_pending");
    expect(github.lastPoll).toMatchObject({ client_id: "test-client", device_code: s.device_code, grant_type: "urn:ietf:params:oauth:grant-type:device_code" });

    const ok = await h.call("POST", "v1/auth/device/token", { json: { device_code: s.device_code } });
    expect(ok.status).toBe(200);
    const t = (await ok.json()) as { token: string; login: string };
    expect(t.login).toBe("alice");
    expect(t.token).toMatch(/^halo_[A-Za-z0-9_-]{43}$/);

    // Only the sha256 is stored; nothing GitHub issued is.
    const dump = JSON.stringify(h.d1.db.query("SELECT * FROM tokens").all()) + JSON.stringify(h.d1.db.query("SELECT * FROM users").all());
    expect(dump).not.toContain(t.token);
    expect(dump).not.toContain("gho_");
    expect(h.d1.db.query("SELECT token_hash FROM tokens").get()).toEqual({ token_hash: createHash("sha256").update(t.token).digest("hex") });
    // The device code is used up.
    expect((await h.call("POST", "v1/auth/device/token", { json: { device_code: s.device_code } })).status).toBe(410);

    const who = (await (await h.call("GET", "v1/whoami", { token: t.token })).json()) as { login: string; scopes: unknown[]; token: { readOnly: boolean } };
    expect(who.login).toBe("alice");
    expect(who.scopes).toEqual([{ scope: "@alice", role: "owner" }]);
    expect(who.token.readOnly).toBe(false);
  });

  test("slow_down maps to 429 with retry-after; expired_token to 410; unknown codes to 410", async () => {
    const h = harness();
    github.script = ["slow_down", "expired_token"];
    const s = (await (await h.call("POST", "v1/auth/device")).json()) as { device_code: string };
    const slow = await h.call("POST", "v1/auth/device/token", { json: { device_code: s.device_code } });
    expect(slow.status).toBe(429);
    expect(slow.headers.get("retry-after")).toBe("10");
    expect(((await slow.json()) as { code: string }).code).toBe("slow_down");
    const expired = await h.call("POST", "v1/auth/device/token", { json: { device_code: s.device_code } });
    expect(expired.status).toBe(410);
    expect(((await expired.json()) as { code: string }).code).toBe("expired_token");
    expect((await h.call("POST", "v1/auth/device/token", { json: { device_code: "never-issued" } })).status).toBe(410);
  });

  test("a GitHub login is the user's id's label: a renamed account's old login doesn't block whoever has it now", async () => {
    const h = harness();
    const oldBob = await h.login("bob", 7);
    expect((await h.call("POST", "v1/scopes", { token: oldBob, json: { scope: "@bobcorp" } })).status).toBe(201);
    // GitHub user 7 renames to "robert"; a different GitHub user (8) now has "bob" and signs in.
    const newBob = await h.login("bob", 8);
    const who = (await (await h.call("GET", "v1/whoami", { token: newBob })).json()) as { login: string; scopes: { scope: string }[] };
    expect(who.login).toBe("bob");
    // @bob stays with the account that made it (user 7); the new bob gets no personal scope.
    expect(who.scopes).toEqual([]);
    expect(h.d1.db.query("SELECT github_id, login FROM users ORDER BY github_id").all()).toEqual([
      { github_id: 7, login: "bob~7" },
      { github_id: 8, login: "bob" },
    ]);
    // The old token still works, as user 7; signing in again takes the new login.
    expect(((await (await h.call("GET", "v1/whoami", { token: oldBob })).json()) as { login: string }).login).toBe("bob~7");
    const robert = await h.login("robert", 7);
    const me = (await (await h.call("GET", "v1/whoami", { token: robert })).json()) as { login: string; scopes: { scope: string }[] };
    expect(me.login).toBe("robert");
    expect(me.scopes.map((s) => s.scope)).toEqual(["@bob", "@bobcorp", "@robert"]);
    // Swapping logins between two accounts works too.
    await h.login("robert", 8);
    const bobAgain = await h.login("bob", 7);
    expect(((await (await h.call("GET", "v1/whoami", { token: bobAgain })).json()) as { login: string }).login).toBe("bob");
    expect(h.d1.db.query("SELECT github_id, login FROM users ORDER BY github_id").all()).toEqual([
      { github_id: 7, login: "bob" },
      { github_id: 8, login: "robert" },
    ]);
  });

  test("signing in again keeps the same user and scope", async () => {
    const h = harness();
    await h.login("bob", 7);
    const t2 = await h.login("bob", 7);
    expect(h.d1.db.query("SELECT COUNT(*) AS n FROM users").get()).toEqual({ n: 1 });
    expect(h.d1.db.query("SELECT COUNT(*) AS n FROM tokens").get()).toEqual({ n: 2 });
    expect((await h.call("GET", "v1/whoami", { token: t2 })).status).toBe(200);
    expect((await h.call("GET", "v1/whoami", { token: "halo_nope" })).status).toBe(401);
    expect((await h.call("GET", "v1/whoami")).status).toBe(401);
  });
});

describe("tokens", () => {
  test("create (secret shown once), list, read-only and scope-limited tokens, delete", async () => {
    const h = harness();
    const token = await h.login("acme", 1);
    // @acme is acme's user scope; make an org scope too.
    expect((await h.call("POST", "v1/scopes", { token, json: { scope: "@acme-labs" } })).status).toBe(201);

    const ro = await h.call("POST", "v1/tokens", { token, json: { name: "ci read", readOnly: true } });
    expect(ro.status).toBe(201);
    const roBody = (await ro.json()) as { id: string; token: string; readOnly: boolean };
    expect(roBody.readOnly).toBe(true);
    expect(roBody.token).toStartWith("halo_");

    const limited = (await (await h.call("POST", "v1/tokens", { token, json: { name: "labs only", scopes: ["@acme-labs"] } })).json()) as { id: string; token: string };

    const list = (await (await h.call("GET", "v1/tokens", { token })).json()) as { tokens: { id: string; name: string; current?: boolean }[] };
    expect(list.tokens.map((t) => t.name)).toEqual(["halo login", "ci read", "labs only"]);
    expect(JSON.stringify(list)).not.toContain(roBody.token);
    expect(list.tokens.find((t) => t.current)?.name).toBe("halo login");

    // Read-only: can read, can't publish or create tokens.
    expect((await h.call("GET", "v1/whoami", { token: roBody.token })).status).toBe(200);
    const roPublish = await h.publish(roBody.token, buildPackage("acme-zendesk"));
    expect(roPublish.status).toBe(403);
    expect(((await roPublish.json()) as { code: string }).code).toBe("read_only_token");
    expect((await h.call("POST", "v1/tokens", { token: roBody.token, json: { name: "x" } })).status).toBe(403);

    // Limited to @acme-labs: can't publish to @acme, can publish to @acme-labs.
    const wrongScope = await h.publish(limited.token, buildPackage("acme-zendesk"));
    expect(wrongScope.status).toBe(403);
    expect(((await wrongScope.json()) as { code: string }).code).toBe("token_scope");
    const labs = buildPackage("acme-zendesk", { manifest: (m) => void (m.name = "@acme-labs/zendesk") });
    expect((await h.publish(limited.token, labs)).status).toBe(201);
    // ...and can't mint a token for wider scopes.
    expect((await h.call("POST", "v1/tokens", { token: limited.token, json: { scopes: ["@acme"] } })).status).toBe(403);

    expect((await h.call("DELETE", `v1/tokens/${roBody.id}`, { token })).status).toBe(200);
    expect((await h.call("GET", "v1/whoami", { token: roBody.token })).status).toBe(401);
    expect((await h.call("DELETE", `v1/tokens/${roBody.id}`, { token })).status).toBe(404);
  });
});

describe("scopes", () => {
  test("create org scopes; reserved, invalid and taken names are refused", async () => {
    const h = harness();
    const token = await h.login("carol", 3);
    const created = await h.call("POST", "v1/scopes", { token, json: { scope: "@widgets" } });
    expect(created.status).toBe(201);
    expect(await created.json()).toEqual({ scope: "@widgets", kind: "org", members: [{ login: "carol", role: "owner" }], packages: [] });
    for (const scope of ["@halo", "@anthropic", "@npm"]) {
      const r = await h.call("POST", "v1/scopes", { token, json: { scope } });
      expect(r.status).toBe(403);
      expect(((await r.json()) as { code: string }).code).toBe("reserved_scope");
    }
    for (const scope of ["widgets", "@Widgets", "@a/b", "@", "@x."]) expect((await h.call("POST", "v1/scopes", { token, json: { scope } })).status).toBe(400);
    expect((await h.call("POST", "v1/scopes", { token, json: { scope: "@widgets" } })).status).toBe(409);
    expect((await h.call("POST", "v1/scopes", { token, json: { scope: "@carol" } })).status).toBe(409);
    expect((await h.call("GET", "v1/scopes/@nope")).status).toBe(404);
  });

  test("members: owners manage, publishers publish, non-members get 403, the last owner stays", async () => {
    const h = harness();
    const owner = await h.login("acme", 1);
    const pub = await h.login("pat", 2);
    const outsider = await h.login("eve", 3);

    const denied = await h.publish(outsider, buildPackage("acme-zendesk"));
    expect(denied.status).toBe(403);
    expect(((await denied.json()) as { code: string }).code).toBe("forbidden");

    expect((await h.call("PUT", "v1/scopes/@acme/members/pat", { token: owner, json: { role: "publisher" } })).status).toBe(200);
    expect((await h.call("PUT", "v1/scopes/@acme/members/nobody", { token: owner, json: { role: "publisher" } })).status).toBe(404);
    expect((await h.publish(pub, buildPackage("acme-zendesk"))).status).toBe(201);
    // A publisher can yank but not manage members.
    expect((await h.call("PUT", "v1/scopes/@acme/members/eve", { token: pub, json: { role: "owner" } })).status).toBe(403);
    expect((await h.call("POST", "v1/packages/@acme/zendesk/versions/1.0.0/yank", { token: pub, json: { reason: "oops" } })).status).toBe(200);

    // Last owner: can't be removed or demoted.
    const last = await h.call("DELETE", "v1/scopes/@acme/members/acme", { token: owner });
    expect(last.status).toBe(409);
    expect(((await last.json()) as { code: string }).code).toBe("last_owner");
    expect((await h.call("PUT", "v1/scopes/@acme/members/acme", { token: owner, json: { role: "publisher" } })).status).toBe(409);
    // With a second owner, the first can leave.
    expect((await h.call("PUT", "v1/scopes/@acme/members/pat", { token: owner, json: { role: "owner" } })).status).toBe(200);
    expect((await h.call("DELETE", "v1/scopes/@acme/members/acme", { token: owner })).status).toBe(200);
    const doc = (await (await h.call("GET", "v1/scopes/@acme")).json()) as { members: unknown[]; packages: string[] };
    expect(doc.members).toEqual([{ login: "pat", role: "owner" }]);
    expect(doc.packages).toEqual(["@acme/zendesk"]);
  });

  test("domain verification through a DNS TXT record", async () => {
    const h = harness();
    const token = await h.login("acme", 1);
    await h.publish(token, buildPackage("acme-zendesk"));
    expect((await h.call("POST", "v1/scopes/@acme/verify", { token, json: { domain: "not a domain" } })).status).toBe(400);
    const first = (await (await h.call("POST", "v1/scopes/@acme/verify", { token, json: { domain: "Acme.com" } })).json()) as { record: string; value: string; verified: boolean };
    expect(first.record).toBe("_halo.acme.com");
    expect(first.value).toMatch(/^halo-verify=/);
    expect(first.verified).toBe(false);

    // Not there yet.
    expect(((await (await h.call("POST", "v1/scopes/@acme/verify", { token, json: { domain: "acme.com" } })).json()) as { verified: boolean }).verified).toBe(false);
    // Doc cached before verification...
    await h.call("GET", "v1/packages/@acme/zendesk.json");
    dns.set("_halo.acme.com", ["v=spf1 -all", first.value]);
    const done = (await (await h.call("POST", "v1/scopes/@acme/verify", { token, json: { domain: "acme.com" } })).json()) as { verified: boolean; value: string };
    expect(done).toMatchObject({ verified: true, value: first.value });
    expect(((await (await h.call("GET", "v1/scopes/@acme")).json()) as { verified: string }).verified).toBe("acme.com");
    // ...is purged, so the badge shows.
    expect(((await (await h.call("GET", "v1/packages/@acme/zendesk.json")).json()) as PackageDoc).verified).toBe("acme.com");
    expect(await (await h.call("GET", "@acme/zendesk")).text()).toContain("verified: acme.com");
    // Only owners verify.
    const other = await h.login("eve", 3);
    expect((await h.call("POST", "v1/scopes/@acme/verify", { token: other, json: { domain: "acme.com" } })).status).toBe(403);
  });
});

describe("publishing", () => {
  let h: Harness;
  let token: string;
  beforeEach(async () => {
    h = harness();
    token = await h.login("acme", 1);
  });

  test("dependencies must exist: support-kit before zendesk fails, after it works", async () => {
    const early = await h.publish(token, buildPackage("acme-support-kit"));
    expect(early.status).toBe(400);
    const err = (await early.json()) as { code: string; problems: string[] };
    expect(err.code).toBe("missing_dependencies");
    expect(err.problems).toEqual(["@acme/zendesk: not in this registry"]);

    const z = await h.publish(token, buildPackage("acme-zendesk"));
    expect(z.status).toBe(201);
    const zBody = (await z.json()) as { name: string; version: string; sha256: string; url: string };
    expect(zBody).toMatchObject({ name: "@acme/zendesk", version: "1.0.0", url: "https://registry.halolang.com/@acme/zendesk/v/1.0.0" });

    // A range nothing satisfies is listed too.
    const tooNew = await h.publish(token, buildPackage("acme-support-kit", { manifest: (m) => void (m.dependencies = { "@acme/zendesk": "^2.0.0" }) }));
    expect(((await tooNew.json()) as { problems: string[] }).problems[0]).toContain("no version matches ^2.0.0");

    expect((await h.publish(token, buildPackage("acme-support-kit"))).status).toBe(201);
  });

  test("docs and index carry the server-computed exports and permissions", async () => {
    await h.publish(token, buildPackage("acme-zendesk"));
    await h.publish(token, buildPackage("acme-support-kit"));

    const z = (await (await h.call("GET", "v1/packages/@acme/zendesk.json")).json()) as PackageDoc;
    expect(z.distTags).toEqual({ latest: "1.0.0" });
    const zv = z.versions["1.0.0"]!;
    expect(zv.exports.providers).toEqual(["Zendesk"]);
    expect(zv.permissions).toEqual({ network: ["*.zendesk.com"], env: ["ZENDESK_TOKEN"], spawn: [], code: false, hosted: [] });
    expect(zv.file).toBe("v1/files/@acme/zendesk/1.0.0.halotool");
    expect(zv.publishedBy).toBe("acme");
    expect(z.readme).toContain("# @acme/zendesk");

    const kit = (await (await h.call("GET", "v1/packages/@acme/support-kit.json")).json()) as PackageDoc;
    const kv = kit.versions["1.2.0"]!;
    // Only the exported file's declarations; internal.halo stays private.
    expect(kv.exports).toEqual({ pipelines: ["Triage"], agents: ["Triager"], tools: ["Desk"], stores: [], schemas: ["Classification"], policies: [], providers: [], skills: [] });
    expect(kv.permissions.env).toEqual(["ZENDESK_SUBDOMAIN"]);
    expect(kv.models.fast?.suggested).toBe("anthropic/claude-haiku-4-5");
    expect(kv.dependencies).toEqual({ "@acme/zendesk": "^1.0.0" });
    expect(kv.halo).toBe(">=0.8.0");
    expect(kit).toMatchObject({ license: "MIT", repository: "https://github.com/acme/halo-support-kit", keywords: ["support", "triage"] });

    const index = await h.call("GET", "v1/index.json");
    expect(index.headers.get("access-control-allow-origin")).toBe("*");
    const summaries = (await index.json()) as PackageSummary[];
    expect(summaries.map((s) => [s.name, s.latest])).toEqual([
      ["@acme/support-kit", "1.2.0"],
      ["@acme/zendesk", "1.0.0"],
    ]);
    // The GET without .json works too, and unknown packages are ApiError 404s with CORS.
    expect((await h.call("GET", "v1/packages/@acme/zendesk")).status).toBe(200);
    const missing = await h.call("GET", "v1/packages/@acme/nope.json");
    expect(missing.status).toBe(404);
    expect(missing.headers.get("access-control-allow-origin")).toBe("*");
    expect(((await missing.json()) as { code: string }).code).toBe("not_found");
    // Preflight
    const pre = await h.call("OPTIONS", "v1/index.json");
    expect(pre.status).toBe(204);
    expect(pre.headers.get("access-control-allow-methods")).toContain("GET");
  });

  test("file download: immutable, sha256 ETag, 304, download count", async () => {
    const bytes = buildPackage("acme-zendesk");
    const sha = createHash("sha256").update(bytes).digest("hex");
    expect(((await (await h.publish(token, bytes)).json()) as { sha256: string }).sha256).toBe(sha);
    expect([...h.r2.objects.keys()]).toEqual([`files/@acme/zendesk/1.0.0/${sha}.halotool`]);

    const res = await h.call("GET", "v1/files/@acme/zendesk/1.0.0.halotool");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(res.headers.get("etag")).toBe(`"${sha}"`);
    expect(res.headers.get("content-type")).toBe(PACKAGE_MEDIA_TYPE);
    const body = new Uint8Array(await res.arrayBuffer());
    expect(createHash("sha256").update(body).digest("hex")).toBe(sha);

    await h.call("GET", "v1/files/@acme/zendesk/1.0.0.halotool");
    const notModified = await h.call("GET", "v1/files/@acme/zendesk/1.0.0.halotool", { headers: { "if-none-match": `"${sha}"` } });
    expect(notModified.status).toBe(304);
    expect(h.d1.db.query("SELECT version, count FROM downloads_daily").all()).toEqual([{ version: "1.0.0", count: 2 }]);
    expect(((await (await h.call("GET", "v1/index.json")).json()) as PackageSummary[])[0]!.downloads).toBe(2);
    expect((await h.call("GET", "v1/files/@acme/zendesk/9.9.9.halotool")).status).toBe(404);
  });

  test("two publishes of one version racing: one wins, and the file served is the winner's", async () => {
    const a = buildPackage("acme-zendesk");
    const b = buildPackage("acme-zendesk", { files: (f) => void (f["README.md"] += "\nthe other one") });
    const results = await Promise.all([h.publish(token, a), h.publish(token, b)]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    const doc = (await (await h.call("GET", "v1/packages/@acme/zendesk.json")).json()) as PackageDoc;
    const sha = doc.versions["1.0.0"]!.sha256;
    const file = new Uint8Array(await (await h.call("GET", "v1/files/@acme/zendesk/1.0.0.halotool")).arrayBuffer());
    expect(createHash("sha256").update(file).digest("hex")).toBe(sha);
    // The loser's file was removed; only the winner's is stored.
    expect([...h.r2.objects.keys()]).toEqual([`files/@acme/zendesk/1.0.0/${sha}.halotool`]);
  });

  test("a package just under the raw size cap publishes (base64 makes it bigger on the wire); over it, it's refused", async () => {
    const near = buildPackage("acme-zendesk", { files: (f) => void (f["data/blob.txt"] = "x".repeat(MAX_PACKAGE_BYTES - 64 * 1024)) });
    expect(near.byteLength).toBeGreaterThan(MAX_PACKAGE_BYTES);
    expect(near.byteLength).toBeLessThan(MAX_PACKAGE_WIRE_BYTES);
    expect((await h.publish(token, near)).status).toBe(201);
    const over = buildPackage("acme-zendesk", { manifest: (m) => void (m.version = "1.0.1"), files: (f) => void (f["data/blob.txt"] = "x".repeat(MAX_PACKAGE_BYTES + 1)) });
    const res = await h.publish(token, over);
    expect(res.status).toBe(413);
    expect(((await res.json()) as { code: string }).code).toBe("too_large");
  });

  test("hosted packages: hosted sources, badly shaped interfaces and a missing auth are refused, as the CLI refuses them", async () => {
    await h.publish(token, buildPackage("acme-zendesk"));
    const hosted = (m: Record<string, unknown>) => {
      m.version = "1.3.0";
      m.hosted = { endpoint: "https://halo.acme.com", auth: { type: "bearer", env: "ACME_HALO_KEY" }, exports: ["DraftReply"] };
    };
    const iface = { DraftReply: { params: [{ name: "ticket", type: "String" }], returns: "String", effects: [{ target: "Desk.add_comment", effect: "write" }] } };
    const source = await h.publish(token, buildPackage("acme-support-kit", { manifest: hosted, hosted: iface, files: (f) => void (f["hosted/draft.halo"] = "agent W [openai/gpt-4o]\npipeline DraftReply(ticket: String) -> String:\n  ticket |> W.prompt(\"hi\")\n") }));
    expect(source.status).toBe(400);
    expect(((await source.json()) as { problems: string[] }).problems).toContain("hosted/draft.halo isn't reached by exports, so it would be a hosted source; hosted sources must not be in the package");
    const shape = await h.publish(token, buildPackage("acme-support-kit", { manifest: hosted, hosted: { DraftReply: { params: "ticket" } } }));
    expect(((await shape.json()) as { problems: string[] }).problems).toContain("hosted: DraftReply: params must be a list of { name, type } strings");
    const noAuth = await h.publish(token, buildPackage("acme-support-kit", { manifest: (m) => (hosted(m), delete (m.hosted as { auth?: unknown }).auth), hosted: iface }));
    expect(((await noAuth.json()) as { problems: string[] }).problems.join()).toContain("hosted.auth is required");
    const ok = await h.publish(token, buildPackage("acme-support-kit", { manifest: hosted, hosted: iface }));
    expect(ok.status).toBe(201);
  });

  test("a version can't be published twice", async () => {
    expect((await h.publish(token, buildPackage("acme-zendesk"))).status).toBe(201);
    const again = await h.publish(token, buildPackage("acme-zendesk", { files: (f) => void (f["README.md"] += "\nchanged") }));
    expect(again.status).toBe(409);
    expect(((await again.json()) as { code: string }).code).toBe("version_exists");
  });

  test("the URL name must match the manifest", async () => {
    const res = await h.publish(token, buildPackage("acme-zendesk"), "@acme/other");
    expect(res.status).toBe(400);
    expect(((await res.json()) as { code: string }).code).toBe("name_mismatch");
  });

  test("manifest problems are all listed", async () => {
    const res = await h.publish(
      token,
      buildPackage("acme-zendesk", {
        manifest: (m) => {
          m.version = "one";
          m.description = "";
          m.env = ["lower"];
        },
      }),
    );
    expect(res.status).toBe(400);
    const err = (await res.json()) as { code: string; problems: string[] };
    expect(err.code).toBe("invalid_manifest");
    expect(err.problems.some((p) => p.startsWith("version must be semver"))).toBe(true);
    expect(err.problems).toContain("description is required");
    expect(err.problems).toContain("env must list environment variable names");
  });

  test("README is required, and capped", async () => {
    const none = await h.publish(token, buildPackage("acme-zendesk", { files: (f) => void delete f["README.md"] }));
    expect(none.status).toBe(400);
    expect(((await none.json()) as { problems: string[] }).problems.join()).toContain("README.md is required");
    const huge = await h.publish(token, buildPackage("acme-zendesk", { files: (f) => void (f["README.md"] = "x".repeat(300 * 1024)) }));
    expect(huge.status).toBe(400);
    expect(((await huge.json()) as { code: string }).code).toBe("readme_too_large");
  });

  test("unsafe paths, secrets, v1 files, wrong media type and oversized bodies are refused", async () => {
    for (const bad of ["../escape.halo", "/etc/passwd", "lib\\win.halo", "a//b", "C:/x"]) {
      const res = await h.publish(token, buildPackage("acme-zendesk", { files: (f) => void (f[bad] = "x") }));
      expect(res.status).toBe(400);
      expect(((await res.json()) as { problems: string[] }).problems[0]).toContain("unsafe file path");
    }
    const env = await h.publish(token, buildPackage("acme-zendesk", { files: (f) => void (f[".env"] = "SECRET=1") }));
    expect(((await env.json()) as { problems: string[] }).problems[0]).toContain(".env must not be published");

    const v1 = await h.publish(token, buildPackage("acme-zendesk", { format: "halo-tool/1" }));
    expect(v1.status).toBe(400);
    expect(((await v1.json()) as { code: string }).code).toBe("unsupported_format");

    const wrongType = await h.call("PUT", "v1/packages/@acme/zendesk", { token, body: buildPackage("acme-zendesk"), headers: { "content-type": "application/json" } });
    expect(wrongType.status).toBe(415);

    const big = await h.publish(token, new Uint8Array(MAX_PACKAGE_WIRE_BYTES + 1), "@acme/zendesk");
    expect(big.status).toBe(413);
    // A stream with no content-length is cut off too.
    const stream = new ReadableStream({
      start(c) {
        for (let i = 0; i < 9; i++) c.enqueue(new Uint8Array(1024 * 1024));
        c.close();
      },
    });
    const streamed = await h.call("PUT", "v1/packages/@acme/zendesk", { token, body: stream, headers: { "content-type": PACKAGE_MEDIA_TYPE } });
    expect(streamed.status).toBe(413);
    expect(h.r2.objects.size).toBe(0);
  });

  test("hard-coded models are refused; hosted packages need interfaces", async () => {
    await h.publish(token, buildPackage("acme-zendesk"));
    const hard = await h.publish(token, buildPackage("acme-support-kit", { files: (f) => void (f["lib/support.halo"] = f["lib/support.halo"]!.replace("[models.fast, temp: 0]", "[anthropic/claude-haiku-4-5]")) }));
    expect(hard.status).toBe(400);
    expect(((await hard.json()) as { problems: string[] }).problems[0]).toContain("hard-codes the model");

    const hosted = (m: Record<string, unknown>) => {
      m.version = "1.3.0";
      m.hosted = { endpoint: "https://halo.acme.com", auth: { type: "bearer", env: "ACME_HALO_KEY" }, exports: ["DraftReply"] };
    };
    const noIface = await h.publish(token, buildPackage("acme-support-kit", { manifest: hosted }));
    expect(noIface.status).toBe(400);
    expect(((await noIface.json()) as { problems: string[] }).problems[0]).toContain("no interface for DraftReply");

    const ok = await h.publish(token, buildPackage("acme-support-kit", { manifest: hosted, hosted: { DraftReply: { params: [{ name: "ticket", type: "String" }], returns: "String" } } }));
    expect(ok.status).toBe(201);
    const v = ((await (await h.call("GET", "v1/packages/@acme/support-kit.json")).json()) as PackageDoc).versions["1.3.0"]!;
    expect(v.hosted).toEqual({ endpoint: "https://halo.acme.com", pipelines: ["DraftReply"] });
    expect(v.permissions.hosted).toEqual(["halo.acme.com"]);
    expect(v.permissions.env).toContain("ACME_HALO_KEY");
    expect(v.exports.pipelines).toEqual(["DraftReply", "Triage"]);
    expect(await (await h.call("GET", "@acme/support-kit")).text()).toContain("Hosted by halo.acme.com");
  });

  test("prereleases and lower versions don't become latest", async () => {
    await h.publish(token, buildPackage("acme-zendesk"));
    expect((await h.publish(token, buildPackage("acme-zendesk", { manifest: version("2.0.0-beta.1") }))).status).toBe(201);
    expect((await h.publish(token, buildPackage("acme-zendesk", { manifest: version("0.9.0") }))).status).toBe(201);
    const doc = (await (await h.call("GET", "v1/packages/@acme/zendesk.json")).json()) as PackageDoc;
    expect(doc.distTags.latest).toBe("1.0.0");
    expect(Object.keys(doc.versions)).toEqual(["2.0.0-beta.1", "1.0.0", "0.9.0"]);
    await h.publish(token, buildPackage("acme-zendesk", { manifest: version("1.1.0") }));
    expect(((await (await h.call("GET", "v1/packages/@acme/zendesk.json")).json()) as PackageDoc).distTags.latest).toBe("1.1.0");
  });

  test("a first publish that is a prerelease is latest until a release arrives", async () => {
    await h.publish(token, buildPackage("acme-zendesk", { manifest: version("1.0.0-rc.1") }));
    expect(((await (await h.call("GET", "v1/packages/@acme/zendesk.json")).json()) as PackageDoc).distTags.latest).toBe("1.0.0-rc.1");
    await h.publish(token, buildPackage("acme-zendesk", { manifest: version("0.1.0") }));
    expect(((await (await h.call("GET", "v1/packages/@acme/zendesk.json")).json()) as PackageDoc).distTags.latest).toBe("0.1.0");
  });

  test("publishing to a scope that doesn't exist is a 404", async () => {
    const res = await h.publish(token, buildPackage("acme-zendesk", { manifest: (m) => void (m.name = "@ghost/zendesk") }));
    expect(res.status).toBe(404);
    expect(((await res.json()) as { code: string }).code).toBe("scope_not_found");
  });
});

describe("yank, deprecate, dist-tags", () => {
  test("yank and unyank move latest; the file stays downloadable", async () => {
    const h = harness();
    const token = await h.login("acme", 1);
    await h.publish(token, buildPackage("acme-zendesk"));
    await h.publish(token, buildPackage("acme-zendesk", { manifest: version("1.1.0") }));
    const y = await h.call("POST", "v1/packages/@acme/zendesk/versions/1.1.0/yank", { token, json: { reason: "broken auth" } });
    expect(y.status).toBe(200);
    let doc = (await (await h.call("GET", "v1/packages/@acme/zendesk.json")).json()) as PackageDoc;
    expect(doc.versions["1.1.0"]!.yanked).toBe("broken auth");
    expect(doc.distTags.latest).toBe("1.0.0");
    expect((await h.call("GET", "v1/files/@acme/zendesk/1.1.0.halotool")).status).toBe(200);

    // A yanked version can't be latest, and a dependency on it alone doesn't resolve.
    const tag = await h.call("PUT", "v1/packages/@acme/zendesk/dist-tags/latest", { token, json: { version: "1.1.0" } });
    expect(tag.status).toBe(400);

    expect((await h.call("DELETE", "v1/packages/@acme/zendesk/versions/1.1.0/yank", { token })).status).toBe(200);
    doc = (await (await h.call("GET", "v1/packages/@acme/zendesk.json")).json()) as PackageDoc;
    expect(doc.versions["1.1.0"]!.yanked).toBeUndefined();
    expect(doc.distTags.latest).toBe("1.1.0");
    expect((await h.call("POST", "v1/packages/@acme/zendesk/versions/9.0.0/yank", { token, json: {} })).status).toBe(404);
  });

  test("deprecate by range, and clear it", async () => {
    const h = harness();
    const token = await h.login("acme", 1);
    for (const v of ["0.9.0", "1.0.0", "1.1.0-beta.1", "2.0.0"]) await h.publish(token, buildPackage("acme-zendesk", { manifest: version(v) }));
    const res = await h.call("POST", "v1/packages/@acme/zendesk/deprecate", { token, json: { range: "<2.0.0", message: "Use 2.x" } });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { versions: string[] }).versions).toEqual(["1.1.0-beta.1", "1.0.0", "0.9.0"]);
    let doc = (await (await h.call("GET", "v1/packages/@acme/zendesk.json")).json()) as PackageDoc;
    expect(doc.versions["1.0.0"]!.deprecated).toBe("Use 2.x");
    expect(doc.versions["2.0.0"]!.deprecated).toBeUndefined();
    expect(await (await h.call("GET", "@acme/zendesk/v/1.0.0")).text()).toContain("deprecated: Use 2.x");

    expect((await h.call("POST", "v1/packages/@acme/zendesk/deprecate", { token, json: { range: "1.0.0", message: "" } })).status).toBe(200);
    doc = (await (await h.call("GET", "v1/packages/@acme/zendesk.json")).json()) as PackageDoc;
    expect(doc.versions["1.0.0"]!.deprecated).toBeUndefined();
    expect(doc.versions["0.9.0"]!.deprecated).toBe("Use 2.x");
    expect((await h.call("POST", "v1/packages/@acme/zendesk/deprecate", { token, json: { range: ">5", message: "x" } })).status).toBe(404);
    expect((await h.call("POST", "v1/packages/@acme/zendesk/deprecate", { token, json: { range: "not a range", message: "x" } })).status).toBe(400);
  });

  test("dist-tags: must point at a published version; latest can't be removed", async () => {
    const h = harness();
    const token = await h.login("acme", 1);
    await h.publish(token, buildPackage("acme-zendesk"));
    await h.publish(token, buildPackage("acme-zendesk", { manifest: version("2.0.0-beta.1") }));
    const put = await h.call("PUT", "v1/packages/@acme/zendesk/dist-tags/beta", { token, json: { version: "2.0.0-beta.1" } });
    expect(put.status).toBe(200);
    expect(((await put.json()) as { distTags: Record<string, string> }).distTags).toEqual({ latest: "1.0.0", beta: "2.0.0-beta.1" });
    expect((await h.call("PUT", "v1/packages/@acme/zendesk/dist-tags/beta", { token, json: { version: "3.0.0" } })).status).toBe(404);
    expect((await h.call("PUT", "v1/packages/@acme/zendesk/dist-tags/1.0.0", { token, json: { version: "1.0.0" } })).status).toBe(400);
    expect((await h.call("PUT", "v1/packages/@acme/zendesk/dist-tags/Bad Tag", { token, json: { version: "1.0.0" } })).status).toBe(400);
    const del = await h.call("DELETE", "v1/packages/@acme/zendesk/dist-tags/latest", { token });
    expect(del.status).toBe(400);
    expect(((await del.json()) as { code: string }).code).toBe("latest_required");
    expect((await h.call("DELETE", "v1/packages/@acme/zendesk/dist-tags/beta", { token })).status).toBe(200);
    expect(((await (await h.call("GET", "v1/packages/@acme/zendesk.json")).json()) as PackageDoc).distTags).toEqual({ latest: "1.0.0" });
    // Moving latest by hand works (even backwards).
    await h.call("PUT", "v1/packages/@acme/zendesk/dist-tags/latest", { token, json: { version: "2.0.0-beta.1" } });
    expect(((await (await h.call("GET", "v1/packages/@acme/zendesk.json")).json()) as PackageDoc).distTags.latest).toBe("2.0.0-beta.1");
    // Non-members can't.
    const eve = await h.login("eve", 9);
    expect((await h.call("PUT", "v1/packages/@acme/zendesk/dist-tags/beta", { token: eve, json: { version: "1.0.0" } })).status).toBe(403);
  });
});

describe("search", () => {
  test("ranks name matches over README mentions, pages, and handles odd input", async () => {
    const h = harness();
    const token = await setupAcme(h);
    // A package that only mentions zendesk in its README.
    await h.publish(
      token,
      buildPackage("acme-zendesk", {
        manifest: (m) => {
          m.name = "@acme/helpdesk";
          m.description = "Helpdesk utilities";
          m.keywords = ["helpdesk"];
        },
        files: (f) => void (f["README.md"] = "# Helpdesk\n\nWorks next to zendesk."),
      }),
    );
    const s = (await (await h.call("GET", "v1/search?q=zendesk")).json()) as SearchResponse;
    expect(s.total).toBe(3);
    expect(s.results[0]!.name).toBe("@acme/zendesk");
    expect(s.results.at(-1)!.name).toBe("@acme/helpdesk");

    const exact = (await (await h.call("GET", "v1/search?q=%40acme%2Fsupport-kit")).json()) as SearchResponse;
    expect(exact.results[0]!.name).toBe("@acme/support-kit");
    const prefix = (await (await h.call("GET", "v1/search?q=tria")).json()) as SearchResponse;
    expect(prefix.results.map((r) => r.name)).toEqual(["@acme/support-kit"]);

    const page = (await (await h.call("GET", "v1/search?q=zendesk&limit=1&offset=1")).json()) as SearchResponse;
    expect(page.results.length).toBe(1);
    expect(page.total).toBe(3);
    expect(page.results[0]!.name).toBe(s.results[1]!.name);

    const all = (await (await h.call("GET", "v1/search")).json()) as SearchResponse;
    expect(all.total).toBe(3);
    for (const q of ['"', "AND OR NOT", "*", "zen\u0000desk", "(((("]) expect((await h.call("GET", `v1/search?q=${encodeURIComponent(q)}`)).status).toBe(200);
    expect(((await (await h.call("GET", "v1/search?q=nothingmatches")).json()) as SearchResponse).total).toBe(0);
  });
});

describe("pages", () => {
  test("package page: install line, example use, permissions first, exports, models, versions", async () => {
    const h = harness();
    await setupAcme(h);
    const res = await h.call("GET", "@acme/support-kit");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const page = await res.text();
    expect(page).toContain("halo add @acme/support-kit");
    expect(page).toContain("use &quot;@acme/support-kit&quot; { Triage, Triager, Desk, Classification } with models(fast: anthropic/claude-haiku-4-5)");
    expect(page.indexOf('id="permissions"')).toBeLessThan(page.indexOf('id="readme"'));
    expect(page.indexOf('id="permissions"')).toBeLessThan(page.indexOf('id="exports"'));
    expect(page).toContain("ZENDESK_SUBDOMAIN");
    expect(page).toContain("models.fast");
    expect(page).toContain('href="/@acme/zendesk"');
    expect(page).toContain('href="/@acme/support-kit/v/1.2.0"');
    expect(page).not.toMatch(/<(script|link|img)\b/i);
    expect(page).toContain("prefers-color-scheme: dark");

    const home = await (await h.call("GET", "")).text();
    expect(home).toContain('href="/@acme/support-kit"');
    expect(home).toContain('role="search"');
    const results = await (await h.call("GET", "?q=triage")).text();
    expect(results).toContain('href="/@acme/support-kit"');
    expect(results).not.toContain('href="/@acme/zendesk"');

    expect((await h.call("GET", "@acme/nope")).status).toBe(404);
    expect((await h.call("GET", "@acme/support-kit/v/9.9.9")).status).toBe(404);
  });

  test("README HTML is escaped: no script, no event handlers, no javascript: links", async () => {
    const h = harness();
    const token = await h.login("acme", 1);
    const readme = [
      "# Hello <script>alert(1)</script>",
      "",
      "<script>alert('xss')</script>",
      '<img src=x onerror="alert(2)">',
      "",
      "[click](javascript:alert(3)) and [ok](https://example.com/a_b_c) and ![logo](https://cdn.example.com/x.png)",
      "",
      "```halo",
      'use "@acme/zendesk" { Zendesk } <b>',
      "```",
    ].join("\n");
    await h.publish(token, buildPackage("acme-zendesk", { files: (f) => void (f["README.md"] = readme) }));
    const page = await (await h.call("GET", "@acme/zendesk")).text();
    expect(page).not.toContain("<script");
    expect(page).not.toMatch(/<img/i);
    expect(page).not.toContain("javascript:");
    expect(page).toContain("&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;");
    expect(page).toContain("onerror=&quot;alert(2)&quot;");
    expect(page).toContain('<a href="https://example.com/a_b_c" rel="nofollow noopener ugc">ok</a>');
    expect(page).toContain("[image: logo]");
    expect(page).toContain('<pre><code class="language-halo">use &quot;@acme/zendesk&quot; { Zendesk } &lt;b&gt;</code></pre>');
  });

  test("markdown renderer basics", () => {
    expect(renderMarkdown("## Title\n\nSome **bold**, *em* and `x < y`.\n\n- a\n- b\n\n1. one\n2. two\n\n> quote\n\n---")).toBe(
      [
        '<h2 id="title">Title</h2>',
        "<p>Some <strong>bold</strong>, <em>em</em> and <code>x &lt; y</code>.</p>",
        "<ul><li>a</li><li>b</li></ul>",
        "<ol><li>one</li><li>two</li></ol>",
        "<blockquote><p>quote</p></blockquote>",
        "<hr>",
      ].join("\n"),
    );
    expect(renderMarkdown("[x](JaVaScRiPt:alert(1))")).toBe("<p>x</p>");
    expect(renderMarkdown("[x]( data:text/html,hi)")).toBe("<p>x</p>");
    expect(renderMarkdown("| a | b |\n|---|---|\n| <i>1</i> | 2 |")).toBe("<table><thead><tr><th>a</th><th>b</th></tr></thead><tbody><tr><td>&lt;i&gt;1&lt;/i&gt;</td><td>2</td></tr></tbody></table>");
  });
});

describe("edge cache", () => {
  test("docs, index and pages are cached, and purged when a write changes them", async () => {
    const h = harness();
    const token = await h.login("acme", 1);
    await h.publish(token, buildPackage("acme-zendesk"));
    const before = (await (await h.call("GET", "v1/packages/@acme/zendesk.json")).json()) as PackageDoc;
    await h.call("GET", "v1/index.json");
    await h.call("GET", "@acme/zendesk");
    await h.call("GET", "@acme/zendesk/v/1.0.0");
    await h.call("GET", "");
    // Docs and pages are keyed by the package's revision (bumped by the publish) and verified domain.
    const key = "https://registry.halolang.com/v1/packages/@acme/zendesk.json?rev=1.";
    expect([...h.cache.entries.keys()].sort()).toEqual(
      ["https://registry.halolang.com/", "https://registry.halolang.com/@acme/zendesk?rev=1.", "https://registry.halolang.com/@acme/zendesk/v/1.0.0?rev=1.", key, "https://registry.halolang.com/v1/index.json"].sort(),
    );
    expect(h.cache.entries.get(key)!.headers.get("cache-control")).toBe("public, max-age=60");
    // Served from the cache: a change behind the Worker's back isn't seen...
    h.d1.db.exec("UPDATE packages SET description = 'changed behind the cache'");
    expect(((await (await h.call("GET", "v1/packages/@acme/zendesk.json")).json()) as PackageDoc).description).toBe(before.description);
    // ...until a publish purges it.
    await h.publish(token, buildPackage("acme-zendesk", { manifest: version("1.0.1") }));
    expect(h.cache.entries.size).toBe(0);
    const after = (await (await h.call("GET", "v1/packages/@acme/zendesk.json")).json()) as PackageDoc;
    expect(Object.keys(after.versions)).toEqual(["1.0.1", "1.0.0"]);
    expect(await (await h.call("GET", "@acme/zendesk")).text()).toContain("1.0.1");

    // Yank purges too, and moves the revision.
    await h.call("GET", "v1/packages/@acme/zendesk.json");
    expect(h.cache.entries.has(key.replace("rev=1.", "rev=2."))).toBe(true);
    await h.call("POST", "v1/packages/@acme/zendesk/versions/1.0.0/yank", { token, json: { reason: "x" } });
    expect(h.cache.entries.size).toBe(0);
    await h.call("GET", "v1/packages/@acme/zendesk.json");
    expect([...h.cache.entries.keys()]).toEqual([key.replace("rev=1.", "rev=3.")]);
  });
});

describe("stats", () => {
  const today = new Date().toISOString().slice(0, 10);
  const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
  // Stats are cached for five minutes and carry no revision; each read here wants a fresh one.
  const stats = async (h: Harness, path: string) => {
    h.cache.entries.clear();
    const res = await h.call("GET", path);
    expect(res.status).toBe(200);
    return (await res.json()) as PackageStats;
  };
  /** A package that depends on `deps` and exports one provider: the zendesk fixture, renamed. */
  const dependent = (name: string, deps: Record<string, string>, v = "1.0.0") =>
    buildPackage("acme-zendesk", {
      manifest: (m) => Object.assign(m, { name, version: v, description: `${name} for tests`, dependencies: deps }),
      files: (f) => void (f["README.md"] = `# ${name}\n`),
    });

  test("downloads: by day (zero-filled), by version, last 7 and 30 days, and the window", async () => {
    const h = harness();
    const token = await setupAcme(h);
    expect((await h.publish(token, buildPackage("acme-zendesk", { manifest: version("1.1.0") }))).status).toBe(201);
    await h.call("GET", "v1/files/@acme/zendesk/1.0.0.halotool");
    await h.call("GET", "v1/files/@acme/zendesk/1.0.0.halotool");
    await h.call("GET", "v1/files/@acme/zendesk/1.1.0.halotool");
    const id = (h.d1.db.query("SELECT id FROM packages WHERE name = '@acme/zendesk'").get() as { id: number }).id;
    const insert = h.d1.db.prepare("INSERT INTO downloads_daily (package_id, version, day, count) VALUES (?, ?, ?, ?)");
    insert.run(id, "1.0.0", daysAgo(10), 5);
    insert.run(id, "1.0.0", daysAgo(100), 7);

    const s = await stats(h, "v1/packages/@acme/zendesk/stats");
    expect(s.name).toBe("@acme/zendesk");
    expect(s.latest).toBe("1.1.0");
    expect(s.days).toBe(30);
    expect(s.downloads.daily).toHaveLength(30);
    expect(s.downloads.daily[0]!.day).toBe(daysAgo(29));
    expect(s.downloads.daily.at(-1)).toEqual({ day: today, count: 3 });
    expect(s.downloads.daily.filter((d) => d.count).map((d) => d.day)).toEqual([daysAgo(10), today]);
    expect(s.downloads).toMatchObject({ total: 15, last7: 3, last30: 8, period: 8 });
    expect(s.downloads.versions).toEqual([
      { version: "1.1.0", total: 1, period: 1 },
      { version: "1.0.0", total: 14, period: 7 },
    ]);

    // Another window: last7 and last30 stay put; the period and the per-version period follow it.
    const year = await stats(h, "v1/packages/@acme/zendesk/stats?days=365");
    expect(year.downloads).toMatchObject({ total: 15, last7: 3, last30: 8, period: 15 });
    expect(year.downloads.daily).toHaveLength(365);
    const week = await stats(h, "v1/packages/@acme/zendesk/stats?days=7");
    expect(week.downloads.versions.find((v) => v.version === "1.0.0")).toEqual({ version: "1.0.0", total: 14, period: 2 });
    // Odd values clamp or fall back.
    expect((await stats(h, "v1/packages/@acme/zendesk/stats?days=0")).days).toBe(1);
    expect((await stats(h, "v1/packages/@acme/zendesk/stats?days=9999")).days).toBe(365);
    expect((await stats(h, "v1/packages/@acme/zendesk/stats?days=abc")).days).toBe(30);

    // A package nobody downloaded lists its versions with zeros.
    const kit = await stats(h, "v1/packages/@acme/support-kit/stats");
    expect(kit.downloads).toMatchObject({ total: 0, period: 0, versions: [{ version: "1.2.0", total: 0, period: 0 }] });

    const res = await h.call("GET", "v1/packages/@acme/zendesk/stats");
    expect(res.headers.get("cache-control")).toBe("public, max-age=300");
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    const missing = await h.call("GET", "v1/packages/@acme/nope/stats");
    expect(missing.status).toBe(404);
    expect(((await missing.json()) as { code: string }).code).toBe("not_found");
  });

  test("dependents: direct and through other packages, with shortest chains; ranges that miss latest; cycles end", async () => {
    const h = harness();
    const token = await setupAcme(h); // support-kit -> zendesk
    expect((await h.publish(token, dependent("@acme/inbox", { "@acme/support-kit": "^1.2.0" }))).status).toBe(201);
    expect((await h.publish(token, dependent("@acme/desk", { "@acme/inbox": "^1.0.0" }))).status).toBe(201);
    // Depends on zendesk directly and through support-kit: it's direct.
    expect((await h.publish(token, dependent("@acme/both", { "@acme/zendesk": "1.0.0", "@acme/support-kit": "^1.0.0" }))).status).toBe(201);

    const z = await stats(h, "v1/packages/@acme/zendesk/stats");
    expect(z.dependents.direct).toBe(2);
    expect(z.dependents.transitive).toBe(4);
    expect(z.dependents.packages).toEqual([
      { name: "@acme/both", version: "1.0.0", depth: 1, chain: ["@acme/both", "@acme/zendesk"], range: "1.0.0", onLatest: true },
      { name: "@acme/support-kit", version: "1.2.0", depth: 1, chain: ["@acme/support-kit", "@acme/zendesk"], range: "^1.0.0", onLatest: true },
      { name: "@acme/inbox", version: "1.0.0", depth: 2, chain: ["@acme/inbox", "@acme/support-kit", "@acme/zendesk"] },
      { name: "@acme/desk", version: "1.0.0", depth: 3, chain: ["@acme/desk", "@acme/inbox", "@acme/support-kit", "@acme/zendesk"] },
    ]);
    const leaf = await stats(h, "v1/packages/@acme/desk/stats");
    expect(leaf.dependents).toEqual({ direct: 0, transitive: 0, packages: [] });

    // A new major: the dependents' ranges no longer include latest.
    expect((await h.publish(token, buildPackage("acme-zendesk", { manifest: version("2.0.0") }))).status).toBe(201);
    const z2 = await stats(h, "v1/packages/@acme/zendesk/stats");
    expect(z2.dependents.packages.filter((d) => d.depth === 1).map((d) => [d.name, d.onLatest])).toEqual([
      ["@acme/both", false],
      ["@acme/support-kit", false],
    ]);

    // Only latest versions count: support-kit 1.3.0 drops zendesk, and its chain goes with it.
    expect((await h.publish(token, dependent("@acme/support-kit", {}, "1.3.0"))).status).toBe(201);
    const z3 = await stats(h, "v1/packages/@acme/zendesk/stats");
    expect(z3.dependents.packages.map((d) => d.name)).toEqual(["@acme/both"]);

    // A cycle (zendesk 2.1.0 -> desk -> inbox -> support-kit 1.4.0 -> zendesk) ends, and a package
    // never lists itself.
    expect((await h.publish(token, dependent("@acme/support-kit", { "@acme/zendesk": "^2.0.0" }, "1.4.0"))).status).toBe(201);
    expect((await h.publish(token, dependent("@acme/zendesk", { "@acme/desk": "^1.0.0" }, "2.1.0"))).status).toBe(201);
    const cyc = await stats(h, "v1/packages/@acme/inbox/stats");
    expect(cyc.dependents.packages.map((d) => [d.name, d.depth])).toEqual([
      ["@acme/desk", 1],
      ["@acme/zendesk", 2],
      ["@acme/both", 3],
      ["@acme/support-kit", 3],
    ]);
    expect(cyc.dependents.packages.find((d) => d.name === "@acme/support-kit")!.chain).toEqual(["@acme/support-kit", "@acme/zendesk", "@acme/desk", "@acme/inbox"]);
  });

  test("the package page shows recent downloads and dependents", async () => {
    const h = harness();
    const token = await setupAcme(h);
    await h.publish(token, dependent("@acme/inbox", { "@acme/support-kit": "^1.2.0" }));
    await h.call("GET", "v1/files/@acme/zendesk/1.0.0.halotool");
    const page = await (await h.call("GET", "@acme/zendesk")).text();
    expect(page).toContain("1 download in the last 30 days");
    expect(page).toContain('<svg class="spark"');
    expect(page).toContain(`<title>${today}: 1</title>`);
    expect(page).toContain('id="dependents"');
    expect(page).toContain("1 package directly, 1 more through them.");
    expect(page).toContain('<a href="/@acme/support-kit">@acme/support-kit</a> <code>^1.0.0</code>');
    expect(page).not.toMatch(/<(script|link|img)\b/i);
    expect(await (await h.call("GET", "@acme/inbox")).text()).toContain("No packages depend on this one yet.");
  });

  test("halo stats: one package, and a whole scope", async () => {
    const h = harness();
    const token = await setupAcme(h);
    await h.call("GET", "v1/files/@acme/zendesk/1.0.0.halotool");
    await h.publish(token, dependent("@acme/inbox", { "@acme/support-kit": "^1.2.0" }));
    const fetchFn = (async (input: string | URL | Request, init?: RequestInit) => {
      const pending: Promise<unknown>[] = [];
      const res = await worker.fetch(input instanceof Request ? new Request(input, init) : new Request(String(input), init), h.env, { waitUntil: (p) => void pending.push(p) });
      await Promise.all(pending);
      return res;
    }) as typeof fetch;
    const cwd = mkdtempSync(join(tmpdir(), "halo-stats-"));
    try {
      const run = async (...args: string[]) => {
        const lines: string[] = [];
        const code = await runPackageCommand("stats", [...args, "--registry", "https://registry.halolang.com"], { cwd, fetch: fetchFn, log: (l) => lines.push(l) });
        return { code, text: lines.join("\n") };
      };
      const one = await run("@acme/zendesk");
      expect(one.code).toBe(0);
      expect(one.text).toContain("1 last 7 days · 1 last 30 days · 1 all time");
      expect(one.text).toContain("1 direct · 2 in all");
      expect(one.text).toContain("@acme/support-kit@1.2.0  ^1.0.0");
      expect(one.text).toContain("@acme/inbox@1.0.0  via @acme/support-kit");

      const json = await run("@acme/zendesk", "--days", "7", "--json");
      expect((JSON.parse(json.text) as PackageStats).downloads.daily).toHaveLength(7);

      const scope = await run("@acme");
      expect(scope.code).toBe(0);
      const rows = scope.text.split("\n");
      expect(rows[1]).toMatch(/^@acme\/zendesk\s+1\s+1\s+1\/2/);
      expect(rows.at(-1)).toMatch(/^all\s+1\s+1$/);

      expect((await run("@acme", "--days", "0")).code).toBe(1);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});

describe("routing", () => {
  test("unknown routes and methods are ApiErrors", async () => {
    const h = harness();
    const r = await h.call("GET", "v1/nope");
    expect(r.status).toBe(404);
    expect(await r.json()).toMatchObject({ code: "not_found" });
    expect((await h.call("PATCH", "v1/packages/@acme/zendesk")).status).toBe(405);
    expect((await h.call("GET", "v1/packages/notscoped.json")).status).toBe(404);
    expect((await h.call("GET", "v1/packages/@Bad/Name.json")).status).toBe(400);
    expect((await h.call("POST", "v1/auth/device/token", { body: "not json", headers: { "content-type": "application/json" } })).status).toBe(400);
  });

  test("an encoded name (@acme%2fzendesk) reaches the same package", async () => {
    const h = harness();
    const token = await h.login("acme", 1);
    await h.publish(token, buildPackage("acme-zendesk"));
    expect((await h.call("GET", "v1/packages/%40acme%2Fzendesk.json")).status).toBe(200);
  });
});

// ── Security regressions ──

/** Elements and attributes a rendered README may contain; anything else is a finding. */
const README_ELEMENTS: Record<string, Record<string, (v: string) => boolean>> = {
  ...Object.fromEntries(["h1", "h2", "h3", "h4", "h5", "h6"].map((t) => [t, { id: (v: string) => /^[\p{L}\p{N}_-]*$/u.test(v) }])),
  ...Object.fromEntries(["p", "pre", "blockquote", "ul", "li", "hr", "table", "thead", "tbody", "tr", "th", "td", "strong", "em", "del"].map((t) => [t, {}])),
  code: { class: (v) => /^language-[\w+#.-]+$/.test(v) },
  ol: { start: (v) => /^\d+$/.test(v) },
  a: { href: (v) => safeHref(v), rel: (v) => v === "nofollow noopener ugc" },
};

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);?/gi, (m, e: string) => {
    if (e[0] === "#") return String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", colon: ":", tab: "\t", newline: "\n" } as Record<string, string>)[e.toLowerCase()] ?? m;
  });
}

/** What a browser would follow: http(s), mailto, or a relative URL (not protocol-relative). */
function safeHref(raw: string): boolean {
  const v = decodeEntities(raw).replace(/[\u0000- \u007f]/g, "").toLowerCase();
  if (/^(https?:|mailto:)/.test(v)) return true;
  if (/^[^/?#]*:/.test(v)) return false;
  return !v.startsWith("//") && !v.includes("\\");
}

/** Parse rendered HTML with a real HTML parser (HTMLRewriter) and with a strict tokenizer; list what's not allowed. */
async function auditHtml(html: string): Promise<string[]> {
  const problems: string[] = [];
  let anchors = 0;
  const rw = new HTMLRewriter()
    .on("*", {
      element(el) {
        const allowed = README_ELEMENTS[el.tagName];
        if (!allowed) return void problems.push(`element <${el.tagName}>`);
        for (const [name, value] of el.attributes) {
          if (/^on/i.test(name)) problems.push(`event handler ${name}=${value} on <${el.tagName}>`);
          else if (!allowed[name]) problems.push(`attribute ${name} on <${el.tagName}>`);
          else if (!allowed[name]!(value)) problems.push(`bad ${name}="${value}" on <${el.tagName}>`);
        }
        if (el.tagName === "a") {
          if (anchors) problems.push("<a> inside <a>");
          anchors++;
          el.onEndTag(() => void anchors--);
        }
      },
      comments(c) {
        problems.push(`comment ${c.text}`);
      },
    })
    .onDocument({ doctype: () => void problems.push("doctype") });
  await rw.transform(new Response(html)).text();
  // Strict tokenizer: every "<" starts an allowed tag whose attributes are all name="value" with
  // no quotes or angle brackets in the value; text between tags has no raw < > " ' at all.
  const tag = /<(\/?)([a-z][a-z0-9]*)((?:\s+[a-z]+="[^"<>]*")*)\s*>/y;
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    const text = html.slice(i, lt < 0 ? html.length : lt);
    if (/[<>"']/.test(text)) problems.push(`raw markup character in text: ${JSON.stringify(text.slice(0, 80))}`);
    if (lt < 0) break;
    tag.lastIndex = lt;
    const m = tag.exec(html);
    if (!m || !README_ELEMENTS[m[2]!]) {
      problems.push(`unexpected markup at ${lt}: ${JSON.stringify(html.slice(lt, lt + 80))}`);
      i = lt + 1;
      continue;
    }
    i = tag.lastIndex;
  }
  return problems;
}

/** A small seeded PRNG, so a failing fuzz case is reproducible. */
function prng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NASTY_READMES = [
  "[x](<https://a.com/x/onmouseover=alert(document.domain)//>)",
  "[x](<https://a.com/x/autofocus/onfocus=alert(document.domain)//>)",
  '[x](`"onmouseover=1`)',
  "[`a`](https://a.com)",
  '[<https://a.com/"onx=1>](https://b.com)',
  "[x](https://a.com/<https://b.com/>)",
  "<https://a.com/[x](https://b.com)>",
  "[[x](https://a.com)](https://b.com)",
  "[![i](https://a.com/i.png)](https://b.com)",
  '![<https://a.com/x" onerror=alert(1) x=">](https://b.com)',
  "[x](javascript:alert(1))",
  "[x](JAVASCRIPT:alert(1))",
  "[x]( javascript:alert(1))",
  "[x](java\tscript:alert(1))",
  "[x](<java script:alert(1)>)",
  "[x](javascript&colon;alert(1))",
  "[x](&#106;avascript:alert(1))",
  "[x](&#x6A;avascript:alert(1))",
  "[x](\u0000javascript:alert(1))",
  "[x](\u0001javascript:alert(1))",
  "[x](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)",
  "[x](DaTa:text/html,<script>alert(1)</script>)",
  "[x](vbscript:msgbox(1))",
  "[x](//evil.com)",
  "[x](/\\evil.com)",
  "[x](\\\\evil.com)",
  '[x](https://a.com "title" onmouseover="alert(1)")',
  "[x](https://a.com 'ti\"tle')",
  "[x](https://a.com (title))",
  '[x](https://a.com/"onmouseover=alert(1)//)',
  "[x](https://a.com/'onmouseover=alert(1)//)",
  "[x](https://a.com/`onmouseover=alert(1)//)",
  '[x](https://a.com/>"<script>alert(1)</script>)',
  '<https://a.com/"onmouseover=alert(1)>',
  "<https://a.com/'x>",
  "<javascript:alert(1)>",
  "<script>alert(1)</script>",
  '<img src=x onerror="alert(1)">',
  '<a href="javascript:alert(1)">x</a>',
  "<!-- comment --><svg onload=alert(1)>",
  "`<script>alert(1)</script>`",
  "``<img src=x onerror=alert(1)>``",
  "```\n<script>alert(1)</script>\n```",
  '```"><script>alert(1)</script>\n```',
  "```js onload=alert(1)\nx\n```",
  "    <iframe src=javascript:alert(1)>",
  "# <script>x</script> heading `code` [l](https://a.com)",
  '# "onmouseover=alert(1) x="',
  "> <img src=x onerror=alert(1)>\n> [x](javascript:alert(1))",
  "- [x](javascript:alert(1))\n- <b>b</b>\n- **[y](https://a.com/_x_)**",
  "1. a\n2. <i>b</i>",
  '| <script> | [x](javascript:1) |\n|---|---|\n| `<b>` | <https://a.com/"> |',
  "**[x](https://a.com/**y**)**",
  "*[x](https://a.com/*y*)*",
  "_[x](https://a.com/_y_)_",
  "~~[x](https://a.com/~~y~~)~~",
  "[x](https://a.com/\u0000)",
  "\u00000\u0000",
  "[x](\u00000\u0000)",
  "0 [x](0)",
  "[unclosed(https://a.com",
  "[x](https://a.com",
  "[x](<https://a.com)",
  "<https://a.com",
  "`unclosed code [x](javascript:1)",
  "**unclosed *em _x ~~y",
  "[x](https://a.com/(a(b)c))",
  "[x](mailto:a@b.com) [y](#frag) [z](./rel/path?q=1&r=2)",
  "&lt;script&gt; &amp;amp; &#x3c;b&#x3e;",
];

const FRAGMENTS = [
  "[", "]", "(", ")", "<", ">", "`", "``", "!", "*", "**", "_", "~~", '"', "'", "&", "#", ";", ":", "\\", "\n", "\n\n", " ", "\t",
  "\u0000", "", "", "0", "1",
  "https://a.com/", "http://b.org", "javascript:", "JaVa\tScRiPt:", "data:", "vbscript:", "mailto:", "//evil", "&colon;", "&#106;",
  "onmouseover=alert(1)", "onerror=", "<script>", "</script>", "<img src=x>", "<a href=", "<svg/onload=1>",
  "[x](", "](https://a.com)", "(<", ">)", "![", "# ", "> ", "- ", "1. ", "```", "    ", "| a | b |\n|---|---|\n",
];

describe("security", () => {
  test("README renderer: a link destination never puts markup inside an attribute (reviewer repro)", async () => {
    const repro = renderMarkdown("[x](<https://a.com/x/onmouseover=alert(document.domain)//>)");
    expect(await auditHtml(repro)).toEqual([]);
    expect(repro).toBe('<p><a href="https://a.com/x/onmouseover=alert(document.domain)//" rel="nofollow noopener ugc">x</a></p>');
    expect(await auditHtml(renderMarkdown('[x](`"onmouseover=1`)'))).toEqual([]);
    expect(renderMarkdown("[`a`](https://a.com)")).toBe('<p><a href="https://a.com" rel="nofollow noopener ugc"><code>a</code></a></p>');
    // No sentinel, quote or bracket ever reaches an href.
    for (const md of NASTY_READMES) for (const m of renderMarkdown(md).matchAll(/href="([^"]*)"/g)) expect(m[1]).not.toMatch(/[\u0000<>"'`\\]/);
  });

  test("README renderer fuzz: only allowlisted elements and attributes, no handlers, only http(s)/mailto/relative URLs", async () => {
    const corpus = [...NASTY_READMES];
    const rand = prng(20261111);
    const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)]!;
    for (let n = 0; n < 3000; n++) {
      const parts: string[] = [];
      const len = 1 + Math.floor(rand() * 12);
      for (let k = 0; k < len; k++) parts.push(rand() < 0.2 ? pick(NASTY_READMES) : pick(FRAGMENTS));
      corpus.push(parts.join(""));
    }
    const findings: string[] = [];
    for (const md of corpus) {
      const html = renderMarkdown(md);
      const problems = await auditHtml(html);
      if (problems.length) findings.push(`${JSON.stringify(md)}\n  → ${html}\n  ${problems.join("\n  ")}`);
    }
    expect(findings.slice(0, 5)).toEqual([]);
    // Hostile input stays cheap (no quadratic scans or catastrophic backtracking).
    const t0 = performance.now();
    renderMarkdown("[".repeat(20_000) + "`".repeat(5_000) + "<".repeat(20_000) + "*".repeat(5_000) + "](".repeat(5_000));
    renderMarkdown(Array.from({ length: 4000 }, (_, k) => "`".repeat(k % 50 + 1)).join("x"));
    expect(performance.now() - t0).toBeLessThan(2000);
  });

  test("HTML responses carry CSP, nosniff, Referrer-Policy and frame denial, including cache hits and 404s", async () => {
    const h = harness();
    await setupAcme(h);
    // A page cached by an older deploy, without the headers.
    await h.call("GET", "@acme/zendesk/v/1.0.0");
    for (const key of h.cache.entries.keys()) await h.cache.put(key, new Response("<p>old</p>", { headers: { "content-type": "text/html; charset=utf-8" } }));
    for (const path of ["", "", "?q=triage", "@acme/support-kit", "@acme/support-kit", "@acme/zendesk/v/1.0.0", "@acme/nope", "nothing/here", "robots.txt"]) {
      const res = await h.call("GET", path);
      expect({ path, nosniff: res.headers.get("x-content-type-options") }).toEqual({ path, nosniff: "nosniff" });
      expect(res.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
      if ((res.headers.get("content-type") ?? "").startsWith("text/html")) {
        expect({ path, csp: res.headers.get("content-security-policy") }).toEqual({ path, csp: PAGE_CSP });
        expect(res.headers.get("x-frame-options")).toBe("DENY");
      }
    }
    // API responses are nosniff too.
    expect((await h.call("GET", "v1/packages/@acme/zendesk.json")).headers.get("x-content-type-options")).toBe("nosniff");
    expect((await h.call("GET", "v1/nope")).headers.get("x-content-type-options")).toBe("nosniff");
    // The page needs nothing the CSP forbids: no scripts or external styles, and the form submits to itself.
    const page = await (await h.call("GET", "@acme/support-kit")).text();
    expect(page).not.toMatch(/<script|<link|<img|<iframe|\son[a-z]+=/i);
    expect(page).toContain('<form class="search" action="/" method="get"');
  });

  test("hosted endpoints must be public https hosts unless ALLOW_LOCAL_HOSTED_ENDPOINTS is set", async () => {
    const h = harness();
    const token = await h.login("acme", 1);
    await h.publish(token, buildPackage("acme-zendesk"));
    const iface = { DraftReply: { params: [{ name: "ticket", type: "String" }], returns: "String", effects: [] } };
    let n = 0;
    const tryEndpoint = async (endpoint: string) => {
      const pkg = buildPackage("acme-support-kit", {
        manifest: (m) => {
          m.version = `1.3.${n++}`;
          m.hosted = { endpoint, auth: { type: "bearer", env: "ACME_HALO_KEY" }, exports: ["DraftReply"] };
        },
        hosted: iface,
      });
      return h.publish(token, pkg);
    };
    for (const endpoint of [
      "http://localhost:4573",
      "https://localhost",
      "https://api.localhost",
      "https://LOCALHOST.",
      "https://127.0.0.1",
      "https://127.1.2.3:8443",
      "https://2130706433",
      "https://0x7f.0.0.1",
      "https://0.0.0.0",
      "https://10.0.0.5",
      "https://172.16.3.4",
      "https://172.31.255.255",
      "https://192.168.1.1",
      "https://169.254.169.254",
      "https://100.64.0.1",
      "https://[::1]",
      "https://[::]",
      "https://[fe80::1]",
      "https://[fc00::1]",
      "https://[fd12:3456::1]",
      "https://[::ffff:127.0.0.1]",
      "https://[::ffff:10.0.0.1]",
      "https://[64:ff9b::a00:1]",
      "https://printer.local",
      "https://db.internal",
      "https://router.home.arpa",
      "https://intranet",
    ]) {
      const res = await tryEndpoint(endpoint);
      expect({ endpoint, status: res.status }).toEqual({ endpoint, status: 400 });
      expect(((await res.json()) as { problems?: string[]; error: string }).problems?.join() ?? "").toContain("hosted.endpoint");
    }
    for (const endpoint of ["https://halo.acme.com", "https://8.8.8.8", "https://172.32.0.1", "https://[2606:4700::1111]"]) {
      expect({ endpoint, status: (await tryEndpoint(endpoint)).status }).toEqual({ endpoint, status: 201 });
    }
    h.env.ALLOW_LOCAL_HOSTED_ENDPOINTS = "true";
    expect((await tryEndpoint("http://localhost:4573")).status).toBe(201);
  });

  test("scope-limited and read-only tokens can't create tokens, revoke other tokens or create scopes", async () => {
    const h = harness();
    const token = await h.login("acme", 1);
    const make = async (body: unknown) => (await (await h.call("POST", "v1/tokens", { token, json: body })).json()) as { id: string; token: string };
    const limited = await make({ name: "acme only", scopes: ["@acme"] });
    const ro = await make({ name: "read", readOnly: true });
    const other = await make({ name: "other" });

    for (const [i, t] of [limited, ro].entries()) {
      // No new tokens, not even narrower or read-only ones.
      for (const body of [{ name: "x" }, { name: "x", scopes: ["@acme"] }, { name: "x", readOnly: true }]) {
        expect((await h.call("POST", "v1/tokens", { token: t.token, json: body })).status).toBe(403);
      }
      // No revoking other tokens.
      expect((await h.call("DELETE", `v1/tokens/${other.id}`, { token: t.token })).status).toBe(403);
      // No new scopes.
      expect((await h.call("POST", "v1/scopes", { token: t.token, json: { scope: `@new-${i}` } })).status).toBe(403);
    }
    expect((await h.call("GET", "v1/whoami", { token: other.token })).status).toBe(200);
    expect(h.d1.db.query("SELECT COUNT(*) AS n FROM tokens").get()).toEqual({ n: 4 });
    expect(h.d1.db.query("SELECT COUNT(*) AS n FROM scopes").get()).toEqual({ n: 1 });
    // A token may still revoke itself (logging out).
    expect((await h.call("DELETE", `v1/tokens/${limited.id}`, { token: limited.token })).status).toBe(200);
    expect((await h.call("DELETE", `v1/tokens/${ro.id}`, { token: ro.token })).status).toBe(200);
    // The full token does all three.
    expect((await h.call("POST", "v1/scopes", { token, json: { scope: "@acme-labs" } })).status).toBe(201);
    expect((await h.call("DELETE", `v1/tokens/${other.id}`, { token })).status).toBe(200);
    expect((await h.call("POST", "v1/tokens", { token, json: { name: "y" } })).status).toBe(201);
  });

  test("last owner: the guard is in the write itself, so a concurrent demotion or removal can't orphan the scope", async () => {
    for (const op of ["demote", "remove"] as const) {
      const h = harness();
      const a = await h.login("acme", 1);
      await h.login("pat", 2);
      expect((await h.call("PUT", "v1/scopes/@acme/members/pat", { token: a, json: { role: "owner" } })).status).toBe(200);
      const pat = (h.d1.db.query("SELECT id FROM users WHERE login = 'pat'").get() as { id: number }).id;
      // Just before the Worker's write to scope_members, another request demotes pat (the
      // other owner): any check that ran before this point saw two owners.
      const prepare = h.d1.prepare.bind(h.d1);
      let raced = false;
      h.d1.prepare = (sql: string) => {
        if (!raced && /^\s*(INSERT|UPDATE|DELETE)\b[\s\S]*scope_members/i.test(sql)) {
          raced = true;
          h.d1.db.query("UPDATE scope_members SET role = 'publisher' WHERE user_id = ? AND scope_id = (SELECT id FROM scopes WHERE name = '@acme')").run(pat);
        }
        return prepare(sql);
      };
      const res =
        op === "demote"
          ? await h.call("PUT", "v1/scopes/@acme/members/acme", { token: a, json: { role: "publisher" } })
          : await h.call("DELETE", "v1/scopes/@acme/members/acme", { token: a });
      expect(raced).toBe(true);
      expect({ op, status: res.status }).toEqual({ op, status: 409 });
      expect(((await res.json()) as { code: string }).code).toBe("last_owner");
      expect(h.d1.db.query("SELECT COUNT(*) AS n FROM scope_members m JOIN scopes s ON s.id = m.scope_id WHERE s.name = '@acme' AND m.role = 'owner'").get()).toEqual({ n: 1 });
    }
    // And two real concurrent demotions of each other leave one owner.
    const h = harness();
    const a = await h.login("acme", 1);
    const p = await h.login("pat", 2);
    await h.call("PUT", "v1/scopes/@acme/members/pat", { token: a, json: { role: "owner" } });
    const both = await Promise.all([
      h.call("PUT", "v1/scopes/@acme/members/pat", { token: a, json: { role: "publisher" } }),
      h.call("PUT", "v1/scopes/@acme/members/acme", { token: p, json: { role: "publisher" } }),
    ]);
    // One wins; the other is refused (409 by the guard, or 403 if it runs after the winner
    // already demoted its caller).
    expect(both.filter((r) => r.status === 200).length).toBe(1);
    expect(both.map((r) => r.status).filter((s) => s !== 200)[0]).toBeOneOf([403, 409]);
    expect(h.d1.db.query("SELECT COUNT(*) AS n FROM scope_members m JOIN scopes s ON s.id = m.scope_id WHERE s.name = '@acme' AND m.role = 'owner'").get()).toEqual({ n: 1 });
  });

  test("a yank, deprecation or dist-tag change is visible at once in another colo's cache (docs and pages are keyed by revision)", async () => {
    const h = harness();
    const token = await h.login("acme", 1);
    await h.publish(token, buildPackage("acme-zendesk"));
    await h.publish(token, buildPackage("acme-zendesk", { manifest: version("1.1.0") }));
    const thisColo = h.cache;
    const otherColo = new FakeCache();
    const inColo = async <T,>(cache: FakeCache, f: () => Promise<T>) => {
      (globalThis as { caches?: unknown }).caches = { default: cache };
      try {
        return await f();
      } finally {
        (globalThis as { caches?: unknown }).caches = { default: thisColo };
      }
    };
    const getDocNow = async () => (await (await h.call("GET", "v1/packages/@acme/zendesk.json")).json()) as PackageDoc;
    // Warm this colo's cache.
    expect((await getDocNow()).versions["1.1.0"]!.yanked).toBeUndefined();
    expect(await (await h.call("GET", "@acme/zendesk")).text()).not.toContain("yanked");
    expect(await (await h.call("GET", "@acme/zendesk/v/1.1.0")).text()).not.toContain("yanked");
    expect(thisColo.entries.size).toBeGreaterThan(0);

    // The writes land in another colo, whose purge can't reach this one.
    await inColo(otherColo, async () => {
      expect((await h.call("POST", "v1/packages/@acme/zendesk/versions/1.1.0/yank", { token, json: { reason: "broken auth" } })).status).toBe(200);
    });
    const doc = await getDocNow();
    expect(doc.versions["1.1.0"]!.yanked).toBe("broken auth");
    expect(doc.distTags.latest).toBe("1.0.0");
    expect(await (await h.call("GET", "@acme/zendesk/v/1.1.0")).text()).toContain("yanked: broken auth");
    expect(await (await h.call("GET", "@acme/zendesk")).text()).toContain("v1.0.0 · latest");

    await inColo(otherColo, async () => {
      expect((await h.call("POST", "v1/packages/@acme/zendesk/deprecate", { token, json: { range: "<1.1.0", message: "Use 1.1" } })).status).toBe(200);
    });
    expect((await getDocNow()).versions["1.0.0"]!.deprecated).toBe("Use 1.1");
    expect(await (await h.call("GET", "@acme/zendesk/v/1.0.0")).text()).toContain("deprecated: Use 1.1");

    await inColo(otherColo, async () => {
      expect((await h.call("PUT", "v1/packages/@acme/zendesk/dist-tags/beta", { token, json: { version: "1.0.0" } })).status).toBe(200);
    });
    expect((await getDocNow()).distTags.beta).toBe("1.0.0");
    await inColo(otherColo, async () => {
      expect((await h.call("DELETE", "v1/packages/@acme/zendesk/dist-tags/beta", { token })).status).toBe(200);
    });
    expect((await getDocNow()).distTags.beta).toBeUndefined();

    // An unchanged package is still served from the cache.
    h.d1.db.exec("UPDATE packages SET description = 'changed behind the cache'");
    expect((await getDocNow()).description).not.toBe("changed behind the cache");
  });

  test("a verified domain is re-checked after 30 days; a removed TXT record clears the badge", async () => {
    const h = harness();
    const token = await h.login("acme", 1);
    await h.publish(token, buildPackage("acme-zendesk"));
    const first = (await (await h.call("POST", "v1/scopes/@acme/verify", { token, json: { domain: "acme.dev" } })).json()) as { value: string };
    dns.set("_halo.acme.dev", [first.value]);
    expect(((await (await h.call("POST", "v1/scopes/@acme/verify", { token, json: { domain: "acme.dev" } })).json()) as { verified: boolean }).verified).toBe(true);
    const queries = () => dnsQueries.filter((q) => q === "_halo.acme.dev").length;
    const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
    const verifiedAt = () => (h.d1.db.query("SELECT verified_at FROM scopes WHERE name = '@acme'").get() as { verified_at: string | null }).verified_at;

    // Fresh: renders don't touch DNS.
    let before = queries();
    expect(((await (await h.call("GET", "v1/packages/@acme/zendesk.json")).json()) as PackageDoc).verified).toBe("acme.dev");
    await h.call("GET", "@acme/zendesk");
    await h.call("GET", "v1/scopes/@acme");
    expect(queries()).toBe(before);

    // 31 days old, record still there: re-checked once, and the date moves.
    h.d1.db.query("UPDATE scopes SET verified_at = ? WHERE name = '@acme'").run(ago(31));
    before = queries();
    await h.call("GET", "@acme/zendesk");
    expect(queries()).toBe(before + 1);
    expect(Date.parse(verifiedAt()!)).toBeGreaterThan(Date.now() - 60_000);
    await h.call("GET", "@acme/zendesk");
    expect(queries()).toBe(before + 1);

    // A DNS failure keeps the badge and retries later, not on every request.
    h.d1.db.query("UPDATE scopes SET verified_at = ? WHERE name = '@acme'").run(ago(31));
    dnsFail = true;
    try {
      before = queries();
      await h.call("GET", "v1/packages/@acme/zendesk.json");
      await h.call("GET", "v1/packages/@acme/zendesk.json");
      expect(queries()).toBe(before + 1);
      expect(((await (await h.call("GET", "v1/scopes/@acme")).json()) as { verified?: string }).verified).toBe("acme.dev");
    } finally {
      dnsFail = false;
    }

    // 31 days old and the record is gone: the badge goes, from the scope, the doc and the page.
    h.d1.db.query("UPDATE scopes SET verified_at = ? WHERE name = '@acme'").run(ago(31));
    dns.delete("_halo.acme.dev");
    await h.call("GET", "v1/scopes/@acme");
    expect(verifiedAt()).toBeNull();
    expect(((await (await h.call("GET", "v1/scopes/@acme")).json()) as { verified?: string }).verified).toBeUndefined();
    expect(((await (await h.call("GET", "v1/packages/@acme/zendesk.json")).json()) as PackageDoc).verified).toBeUndefined();
    expect(await (await h.call("GET", "@acme/zendesk")).text()).not.toContain("verified: acme.dev");
  });
});
