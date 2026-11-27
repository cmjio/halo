/**
 * Secrets stay out of URLs: the API token only in the Authorization header, and a webhook's secret
 * only in x-halo-secret unless that webhook says `secretInQuery: true`.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startServer, type ServeOptions } from "../src/serve/server";

const tmp = mkdtempSync(join(tmpdir(), "halo-sec-serve-secrets-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));
const quiet = { log() {}, warn() {}, error() {} };

const FLOW = `pipeline Echo(event: Object) -> Result:
  event |> System.Log()
`;

async function serve(extra: Partial<ServeOptions>) {
  const dir = mkdtempSync(join(tmp, "app-"));
  await Bun.write(join(dir, "flow.halo"), FLOW);
  return startServer({ files: [join(dir, "flow.halo")], port: 0, stateDir: join(dir, ".halo"), scheduler: false, logger: quiet, env: {}, ...extra });
}

const post = (url: string, headers: Record<string, string> = {}) =>
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify({ a: 1 }) });

describe("secrets in URLs", () => {
  test("the API token is accepted only as a Bearer header", async () => {
    const s = await serve({ token: "Env.T", env: { T: "tok" } });
    try {
      expect((await fetch(`${s.url}/api/pipelines?token=tok`)).status).toBe(401);
      expect((await fetch(`${s.url}/api/pipelines`, { headers: { Authorization: "Bearer tok" } })).status).toBe(200);
      expect((await fetch(`${s.url}/mcp?token=tok`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })).status).toBe(401);
    } finally {
      await s.stop();
    }
  });

  test("a webhook secret in ?secret= is refused unless the webhook allows it", async () => {
    const s = await serve({
      webhooks: [
        { path: "strict", pipeline: "Echo", secret: "Env.S" },
        { path: "legacy", pipeline: "Echo", secret: "Env.S", secretInQuery: true },
      ],
      env: { S: "s3cret" },
    });
    try {
      const refused = await post(`${s.url}/hooks/strict?secret=s3cret`);
      expect(refused.status).toBe(401);
      expect(((await refused.json()) as { error: string }).error).toContain("x-halo-secret");
      expect((await post(`${s.url}/hooks/strict`, { "x-halo-secret": "s3cret" })).status).toBe(202);

      expect((await post(`${s.url}/hooks/legacy?secret=s3cret`)).status).toBe(202);
      expect((await post(`${s.url}/hooks/legacy?secret=wrong`)).status).toBe(401);
      expect((await post(`${s.url}/hooks/legacy`, { "x-halo-secret": "s3cret" })).status).toBe(202);
    } finally {
      await s.stop();
    }
  });
});
