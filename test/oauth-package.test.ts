/**
 * A package's http provider that signs in with OAuth ("type": "oauth"): the manifest's checks, and
 * the tool as its own connection. Against the fake server in test/fixtures/oauth-server.ts.
 */

import { test, expect, afterAll } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "../src/parser/index";
import { HaloRuntime } from "../src/runtime/runtime";
import { TokenBroker, authorizationRequest, checkRedirect } from "../src/runtime/oauth";
import { checkManifest, permissionsOf, type HttpProviderSpec } from "../src/registry/manifest";
import { httpProvider, packageConnection } from "../src/registry/providers";
import { connectionsOf } from "../src/auth-cli";
import { startFakeOAuth } from "./fixtures/oauth-server";

const s = startFakeOAuth();
const dir = mkdtempSync(join(tmpdir(), "halo-oauth-pkg-"));
afterAll(() => {
  s.stop();
  rmSync(dir, { recursive: true, force: true });
});

const spec = (auth: Record<string, unknown>): HttpProviderSpec => ({
  kind: "http",
  description: "Notes",
  baseUrl: `${s.issuer}/api`,
  auth: { type: "oauth", authorizeUrl: `${s.issuer}/authorize`, tokenUrl: `${s.issuer}/token`, revokeUrl: `${s.issuer}/revoke`, scopes: ["read"], env: ["NOTES_CLIENT_ID"], ...auth } as HttpProviderSpec["auth"],
  methods: [{ name: "list_pages", description: "List pages", effect: "read", http: { method: "GET", path: "/pages" } }],
});

test("the manifest's endpoints must be https and on the API's host or authHosts, and install shows them", () => {
  const manifest = (auth: Record<string, unknown>) => ({ name: "notes", version: "1.0.0", description: "Notes", providers: { Notes: { ...spec(auth), baseUrl: "https://api.notes.example/v1" } } });
  expect(() => checkManifest(manifest({ authorizeUrl: "https://api.notes.example/oauth/authorize", tokenUrl: "https://api.notes.example/oauth/token", revokeUrl: undefined }))).not.toThrow();
  expect(() => checkManifest(manifest({ authorizeUrl: "https://evil.example/authorize", tokenUrl: "https://api.notes.example/oauth/token", revokeUrl: undefined }))).toThrow(/authorizeUrl is on evil.example, which is neither the API's host nor in authHosts/);
  expect(() => checkManifest(manifest({ authorizeUrl: "https://login.notes.example/authorize", tokenUrl: "https://login.notes.example/token", revokeUrl: undefined, authHosts: ["login.notes.example"] }))).not.toThrow();
  expect(() => checkManifest(manifest({ authorizeUrl: "http://login.notes.example/authorize", tokenUrl: "https://api.notes.example/t", revokeUrl: undefined }))).toThrow(/authorizeUrl must be an https URL/);
  expect(() => checkManifest(manifest({ grant: "password", revokeUrl: undefined, authorizeUrl: "https://api.notes.example/a", tokenUrl: "https://api.notes.example/t" }))).toThrow(/grant must be/);
  const m = checkManifest(manifest({ authorizeUrl: "https://login.notes.example/authorize", tokenUrl: "https://login.notes.example/token", revokeUrl: undefined, authHosts: ["login.notes.example"] }));
  expect(permissionsOf(m).network).toEqual(["api.notes.example", "login.notes.example"]);
});

test("the package tool is its own connection: halo auth finds it, and its calls carry the token", async () => {
  const built = httpProvider("Notes", spec({}));
  const ast = parse(`tool Notes : Notes()\npipeline P(q: String) -> Result:\n  q |> Notes.list_pages()`);
  const env = { NOTES_CLIENT_ID: s.clientId };
  const broker = new TokenBroker();
  // What halo auth login Notes would find.
  const [declared] = connectionsOf(ast, { env, project: dir, providerInfo: (p) => (p === "Notes" ? built.info : undefined) });
  expect(declared).toMatchObject({ name: "Notes", tools: ["Notes"], conn: { clientId: s.clientId, tokenUrl: `${s.issuer}/token`, scopes: ["read"] } });
  const rt = new HaloRuntime({ env, logger: { log() {}, warn() {} }, projectRoot: dir, broker }).load(ast).registerToolProvider("Notes", built.provider, built.info);
  // Not connected yet: the run waits for it.
  const paused = await rt.run("P", { q: "x" });
  expect(paused.context.meta.paused?.waitingFor).toBe("connect:Notes");
  const conn = declared!.conn!;
  const req = authorizationRequest(conn, "http://127.0.0.1:1/cb");
  const back = new URL((await fetch(req.url, { redirect: "manual" })).headers.get("location")!);
  await broker.exchangeCode(conn, checkRedirect(conn, back.searchParams, req.state), req.verifier, "http://127.0.0.1:1/cb");
  const done = await rt.signal(paused.runId, "connect:Notes", null);
  expect(done.output).toMatchObject({ ok: true, path: "/api/pages" });
  // The same connection whichever way it's built.
  expect(packageConnection("Notes", spec({}).auth!, () => undefined, env, dir)).toEqual(conn);
});
