// Redact(APIKey) and Block(APIKey): the secrets they find, and ordinary text they leave alone.

import { test, expect, describe } from "bun:test";
import { parse } from "../src/parser/index";
import { HaloRuntime } from "../src/runtime/runtime";
import { redact } from "../src/runtime/policies";

const R = "[REDACTED:APIKey]";
const b64 = (n: number) => "Ab3dEf9hIjKlMn0pQrStUvWxYz12345678901234567890abcdefghijklmnopqrstuvwxyz".repeat(4).slice(0, n);

const secrets: Array<[string, string, string]> = [
  // [what, text, the secret part that must be gone]
  ["AWS secret access key", "aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY", "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"],
  ["AWS secret in JSON", `{"SecretAccessKey": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"}`, "wJalrXUtnFEMI/K7MDENG"],
  ["Stripe webhook secret", "STRIPE_WEBHOOK_SECRET=whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw", "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw"],
  ["PGP private key", "-----BEGIN PGP PRIVATE KEY BLOCK-----\nVersion: GnuPG v2\n\nlQOYBF0xyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcd\n=Ab12\n-----END PGP PRIVATE KEY BLOCK-----", "lQOYBF0xyzABCDEFGHIJ"],
  ["truncated PEM", "here is the key:\n-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW\nQyNTUxOQAAACBQ", "b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQ"],
  ["truncated encrypted PEM", "-----BEGIN RSA PRIVATE KEY-----\nProc-Type: 4,ENCRYPTED\nDEK-Info: AES-128-CBC,ABCDEF0123456789\n\nMIIEowIBAAKCAQEAu1SU1LfVLPHCozMxH2Mo4lgOEePzNm0tRgeLezV6ffAt0gun", "MIIEowIBAAKCAQEAu1SU1LfVLPHC"],
  ["PEM in JSON", `{"key":"-----BEGIN PRIVATE KEY-----\\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASC\\nBKcwggSjAgEAAoIBAQC7\\n-----END PRIVATE KEY-----\\n"}`, "MIIEvQIBADANBgkqhkiG9w0BAQEFAASC"],
  ["JWT with a non-object payload", "token eyJhbGciOiJIUzI1NiJ9.WyJhZG1pbiIsInVzZXIiXQ.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk", "WyJhZG1pbiIsInVzZXIiXQ.dBjftJeZ4CVP"],
  ["JWT", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c", "SflKxwRJSMeKKF2QT4fw"],
  ["Slack webhook", "post to https://hooks.slack.com/" + "services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX please", "T00000000/B00000000/XXXX"],
  ["npm token", "//registry.npmjs.org/:_authToken=npm_" + b64(36).replace(/[^A-Za-z0-9]/g, "a"), "npm_Ab3dEf9h"],
  ["Hugging Face token", "HF_TOKEN=hf_" + "aBcDeFgHiJkLmNoPqRsTuVwXyZ012345", "hf_aBcDeFgHiJkLmNoP"],
  ["SendGrid key", "SG." + "aBcDeFgHiJkLmNoPqRsTuV" + "." + "aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789_-abcde", "aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789"],
  ["Postgres URL password", "DATABASE_URL=postgres://app:hunter2hunter2@db.internal:5432/app", "hunter2hunter2"],
  ["Redis URL password", "redis://:s3cr3tpass@cache:6379", "s3cr3tpass"],
  ["HTTPS URL credentials", "https://deploy:ghtoken123456@git.example.com/repo.git", "ghtoken123456"],
  ["age secret key", "AGE-SECRET-KEY-1QYQSZQGPQYQSZQGPQYQSZQGPQYQSZQGPQYQSZQGPQYQSZQGPQYQSZQGPQY", "QYQSZQGPQYQSZQGP"],
  ["hex secret next to its name", 'client_secret: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"', "9f86d081884c7d659a2feaa0c55ad015"],
  ["hex API key", "API_KEY=0123456789abcdef0123456789abcdef", "0123456789abcdef0123456789abcdef"],
  ["Bearer token in an echoed header", "unauthorized, you sent: Bearer abcDEF123456ghiJKL789xyz", "abcDEF123456ghiJKL789xyz"],
];

const ordinary: Array<[string, string]> = [
  ["UUID", "request 123e4567-e89b-12d3-a456-426614174000 failed"],
  ["git SHA", "fixed in commit 9fceb02d0ae598e95dc970b74767f19372d61af8, see the key changes"],
  ["git SHA after sha:", "sha: 9fceb02d0ae598e95dc970b74767f19372d61af8"],
  ["data URI image", "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="],
  ["URL without credentials", "see https://example.com:8080/path?q=1 and postgres://db.internal:5432/app"],
  ["prose about keys", "The key rotation runs nightly; the token expires after an hour. Use a Bearer token."],
  ["identifiers", "call hf_hub_download() and npm_config_cache, then SG.send()"],
  ["an email address", "mail bob@example.com"],
  ["a truncated-PEM-looking word", "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA\n-----END PUBLIC KEY-----"],
];

describe("Redact(APIKey)", () => {
  for (const [what, text, part] of secrets) {
    test(`masks ${what}`, () => {
      const out = redact(text, ["APIKey"]);
      expect(out).toContain(R);
      expect(out).not.toContain(part);
    });
  }
  for (const [what, text] of ordinary) {
    test(`leaves ${what} alone`, () => {
      expect(redact(text, ["APIKey"])).toBe(text);
    });
  }
  test("keeps the URL around a password", () => {
    expect(redact("postgres://app:hunter2hunter2@db/app", ["APIKey"])).toBe(`postgres://app:${R}@db/app`);
  });
  test("a truncated key doesn't eat the prose after a blank line of short words", () => {
    const out = redact("-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASC\n\nthat is all, thanks", ["APIKey"]);
    expect(out).toContain("that is all, thanks");
    expect(out).not.toContain("MIIEvQIBADANBgkq");
  });
  test("stays fast on long runs", () => {
    const t0 = performance.now();
    redact("key=" + "a".repeat(50_000) + " Bearer " + "b".repeat(50_000) + " postgres://" + "u".repeat(10_000), ["APIKey"]);
    redact("-----BEGIN PRIVATE KEY-----" + " aaaaaaaaaaaaa".repeat(5_000), ["APIKey"]);
    expect(performance.now() - t0).toBeLessThan(3000);
  });
});

test("Redact(APIKey) on an object reads a secret field's name with its value", async () => {
  const rt = new HaloRuntime()
    .load(parse(`policy G : Redact(APIKey)\nagent A [openai/gpt-4o]\n  requires G\npipeline P(x: String) -> Result:\n  x |> A.say()`))
    .mockAll({ "A.say": { SecretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY", commit: "9fceb02d0ae598e95dc970b74767f19372d61af8" } });
  const r = await rt.run("P", { x: "go" });
  expect(r.output).toEqual({ SecretAccessKey: R, commit: "9fceb02d0ae598e95dc970b74767f19372d61af8" });
});

describe("Block(APIKey)", () => {
  test("refuses the new kinds of secret, and passes ordinary text", async () => {
    const run = async (text: string) => {
      const rt = new HaloRuntime().load(parse(`policy G : Block(APIKey)\nagent A [openai/gpt-4o]\n  requires G\npipeline P(x: String) -> Result:\n  x |> A.say()`)).mockAll({ "A.say": text });
      try {
        await rt.run("P", { x: "go" });
        return "passed";
      } catch {
        return "blocked";
      }
    };
    for (const [what, text] of secrets) expect(await run(text), what).toBe("blocked");
    for (const [what, text] of ordinary) expect(await run(text), what).toBe("passed");
  });
});
