// A secret read from Env.NAME is masked when a service echoes it back: in errors, tool results,
// what the model is told, events, recordings.

import { test, expect, describe, afterAll } from "bun:test";
import { parse } from "../src/parser/index";
import { HaloRuntime, useTool, type MockRequest } from "../src/runtime/runtime";
import { envSecretWorthMasking, mask, SecretRegistry } from "../src/runtime/secret-mask";

const SECRET = "supersecretvalue123";
const env = { MY_SECRET_KEY: SECRET, DEBUG: "true", PORT: "8080", REGION: "us-east-1" };

// Echoes the Authorization header: 401 on /deny, 200 on anything else.
const server = Bun.serve({
  port: 0,
  fetch: (req) => {
    const auth = req.headers.get("authorization") ?? "";
    if (new URL(req.url).pathname === "/deny") return new Response(`unauthorized, you sent: ${auth}`, { status: 401 });
    return Response.json({ ok: true, echo: auth, [auth]: "as a key too" });
  },
});
afterAll(() => server.stop());
const base = `http://localhost:${server.port}`;

describe("Env secrets echoed by a service", () => {
  test("a 401 quoting the Authorization header is masked in the error, events and recording", async () => {
    const events: string[] = [];
    const recorded: string[] = [];
    const rt = new HaloRuntime({ env, onEvent: (e) => void events.push(JSON.stringify(e)), recorder: (c) => void recorded.push(JSON.stringify(c)) }).load(
      parse(`tool Api : REST("${base}", apiKey: Env.MY_SECRET_KEY)\npipeline P(x: String) -> Result:\n  x |> Api.get(path: "/deny")`),
    );
    let message = "";
    try {
      const r = await rt.run("P", { x: "go" });
      message = JSON.stringify(r);
    } catch (e) {
      message = String((e as Error).message) + String((e as { body?: unknown }).body ?? "");
    }
    expect(message).toContain("401");
    expect(message).toContain("[secret MY_SECRET_KEY]");
    expect(message).not.toContain(SECRET);
    expect(events.join("\n")).not.toContain(SECRET);
    expect(recorded.join("\n")).not.toContain(SECRET);
  });

  test("a result that echoes the key is masked before the model sees it", async () => {
    const seen: string[] = [];
    const rt = new HaloRuntime({ env })
      .load(parse(`tool Api : REST("${base}", apiKey: Env.MY_SECRET_KEY)\nagent A [openai/gpt-4o]\n  equips Api\npipeline P(x: String) -> Result:\n  x |> A.work("go", tools: [Api])`))
      .mockAll({
        "A.work": (r: MockRequest) => {
          for (const m of r.messages ?? []) if ((m as { role?: string }).role === "tool") seen.push(String((m as { content?: unknown }).content));
          return (r.step ?? 1) === 1 ? [useTool("Api.get", { path: "/echo" })] : "done";
        },
      });
    await rt.run("P", { x: "go" });
    expect(seen.join("\n")).toContain("[secret MY_SECRET_KEY]");
    expect(seen.join("\n")).not.toContain(SECRET);
  });

  test("a pipeline's own tool result is masked too, and short or plain values are not", async () => {
    const rt = new HaloRuntime({ env }).load(
      parse(`tool Api : REST("${base}", apiKey: Env.MY_SECRET_KEY)\ntool Echo : REST("${base}", apiKey: Env.DEBUG)\npipeline P(x: String) -> Result:\n  x |> Api.get(path: "/echo")\npipeline Q(x: String) -> Result:\n  x |> Echo.get(path: "/echo")`),
    );
    const r = (await rt.run("P", { x: "go" })) as { output?: unknown };
    expect(JSON.stringify(r)).not.toContain(SECRET);
    // "true" from Env.DEBUG is too short and too common to mask.
    const q = (await rt.run("Q", { x: "go" })) as { output?: unknown };
    expect(JSON.stringify(q)).toContain("Bearer true");
  });
});

describe("which values are worth masking", () => {
  test("short values, booleans, numbers, plain URLs, hosts and paths are not", () => {
    for (const [n, v] of [["DEBUG", "true"], ["X", "1"], ["PORT", "8080"], ["MODE", "production"], ["BASE_URL", "https://api.example.com/v1"], ["HOST", "db.internal.example.com"], ["DIR", "./data/files"], ["REGION", "us-east-1"]]) {
      expect(envSecretWorthMasking(n!, v!)).toBe(false);
    }
  });
  test("keys, tokens and URLs with credentials are", () => {
    expect(envSecretWorthMasking("ANY", SECRET)).toBe(true);
    expect(envSecretWorthMasking("DATABASE_URL", "postgres://app:hunter22@db/app")).toBe(true);
    expect(envSecretWorthMasking("HOOK", "https://example.com/hook?token=abcdef123")).toBe(true);
    expect(envSecretWorthMasking("SLACK_WEBHOOK", "https://hooks.slack.com/services/T0/B0/xyz")).toBe(true);
    // A JWT has dots but isn't a host name.
    expect(envSecretWorthMasking("ID", "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJlc2lnbmF0dXJl")).toBe(true);
    // Even a short-looking value under a secret name, if 8+ characters.
    expect(envSecretWorthMasking("API_TOKEN", "12345678")).toBe(true);
    expect(envSecretWorthMasking("API_TOKEN", "1234567")).toBe(false);
  });
  test("mask() matches ignoring case, longest first", () => {
    const m = new Map([["A", "abcdefgh"], ["B", "abcdefghijkl"]]);
    expect(mask("x ABCDEFGHIJKL y abcdefgh", m)).toBe("x [secret B] y [secret A]");
  });
  test("the registry keeps names and values, and masks errors in place", () => {
    const r = new SecretRegistry();
    r.add("K", SECRET);
    r.add("D", "true");
    expect(r.secrets?.size).toBe(1);
    const e = r.maskError(Object.assign(new Error(`bad ${SECRET}`), { body: `body ${SECRET}` }));
    expect(e.message).toBe("bad [secret K]");
    expect((e as { body?: string }).body).toBe("body [secret K]");
  });
});
