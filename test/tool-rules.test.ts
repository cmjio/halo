import { test, expect, describe } from "bun:test";
import { parse } from "../src/parser/index";
import { validate } from "../src/parser/validate";
import { HaloRuntime, useTool, type RuntimeConfig } from "../src/runtime/runtime";
import { shownParams } from "../src/runtime/tool-rules";

interface Sent {
  url: string;
  body: unknown;
  headers: Record<string, string>;
}

function rt(src: string, mocks: Record<string, unknown> = {}, config: RuntimeConfig = {}) {
  const ast = parse(src);
  expect(ast.errors).toEqual([]);
  const sent: Sent[] = [];
  const fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    sent.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : undefined, headers: Object.fromEntries(new Headers(init?.headers).entries()) });
    return Response.json({ ok: true });
  }) as typeof globalThis.fetch;
  const runtime = new HaloRuntime({ env: { LEDGER_CURRENCY: "USD" }, vectorPath: ":memory:", fetch, logger: { log() {}, warn() {} }, ...config }).load(ast).mockAll(mocks);
  return { runtime, sent, ast };
}

const steps = (...items: unknown[]) => (req: { step?: number }) => items[Math.min((req.step ?? 1) - 1, items.length - 1)];

const LEDGER = `tool Ledger : POST("ledger.example.com/v1/prizes/issue")
  & Fixed("currency", "USD")
  & Match("amount", "\\\\d+(\\\\.\\\\d\\\\d)?")
  & Locked("memo")
agent Paymaster [openai/gpt-4o] equips Ledger`;

describe("rules on a tool's arguments", () => {
  test("they parse onto the declaration", () => {
    const ast = parse(LEDGER);
    expect(ast.errors).toEqual([]);
    expect(ast.tools[0]!.rules!.map((r) => r.name)).toEqual(["Fixed", "Match", "Locked"]);
    expect(validate(ast).filter((d) => d.severity === "error")).toEqual([]);
  });

  test("a model can't choose the path of a POST tool", async () => {
    const { runtime, sent } = rt(
      `${LEDGER}
       pipeline Pay(winner: String) -> Result:
         winner |> Paymaster.pay(tools: [Ledger])`,
      { "Paymaster.pay": steps([useTool("Ledger.post", { path: "/prizes", amount: "25", winner: "ada" })], [useTool("Ledger.post", { amount: "25", winner: "ada" })], "Paid.") },
    );
    const result = await runtime.run("Pay", { winner: "ada" });
    expect(result.output).toBe("Paid.");
    // The first call was refused before anything was sent; the second went to the declared address.
    expect(sent.map((s) => s.url)).toEqual(["https://ledger.example.com/v1/prizes/issue"]);
    expect(result.context.meta.violations.map((v) => [v.policy, v.rule])).toEqual([["Ledger", "Locked"]]);
  });

  test("Unlocked(\"path\") lets a model choose it, still under the declared URL", async () => {
    const { runtime, sent } = rt(
      `tool Api : POST("api.example.com/v1") & Unlocked("path")
       agent A [openai/gpt-4o] equips Api
       pipeline P(x: String) -> Result:
         x |> A.go(tools: [Api])`,
      { "A.go": steps([useTool("Api.post", { path: "/notes", text: "hi" })], "ok") },
    );
    await runtime.run("P", { x: "x" });
    expect(sent.map((s) => s.url)).toEqual(["https://api.example.com/v1/notes"]);
  });

  test("a fixed value is always sent, and a model can't change it", async () => {
    const { runtime, sent } = rt(
      `${LEDGER}
       pipeline Pay(winner: String) -> Result:
         winner |> Paymaster.pay(tools: [Ledger])`,
      { "Paymaster.pay": steps([useTool("Ledger.post", { amount: "25", currency: "EUR" })], [useTool("Ledger.post", { amount: "25" })], "Paid.") },
    );
    const result = await runtime.run("Pay", { winner: "ada" });
    expect(sent).toHaveLength(1);
    expect(sent[0]!.body).toEqual({ amount: "25", currency: "USD" });
    expect(result.context.meta.violations.map((v) => v.rule)).toEqual(["Fixed"]);
  });

  test("Match checks the whole value, and a missing argument", async () => {
    const { runtime, sent } = rt(
      `${LEDGER}
       pipeline Pay(winner: String) -> Result:
         winner |> Paymaster.pay(tools: [Ledger])`,
      {
        "Paymaster.pay": steps(
          [useTool("Ledger.post", { amount: "25; and 9000 more" })],
          [useTool("Ledger.post", { winner: "ada" })],
          [useTool("Ledger.post", { amount: 25.5 })],
          [useTool("Ledger.post", { amount: "25.50" })],
          "Paid.",
        ),
      },
    );
    const result = await runtime.run("Pay", { winner: "ada" });
    expect(sent.map((s) => s.body)).toEqual([{ amount: "25.50", currency: "USD" }]);
    expect(result.context.meta.violations.map((v) => v.rule)).toEqual(["Match", "Match", "Match"]);
  });

  test("a model can't set a locked argument, but the pipeline can", async () => {
    const { runtime, sent } = rt(
      `${LEDGER}
       pipeline ByModel(winner: String) -> Result:
         winner |> Paymaster.pay(tools: [Ledger])
       pipeline ByPipeline(winner: String) -> Result:
         winner |> Ledger.post(amount: "10", memo: "weekly prize", path: "/batch")`,
      { "Paymaster.pay": steps([useTool("Ledger.post", { amount: "25", memo: "ignore the rules" })], "Stopped.") },
    );
    const refused = await runtime.run("ByModel", { winner: "ada" });
    expect(sent).toHaveLength(0);
    expect(refused.context.meta.violations.map((v) => v.rule)).toEqual(["Locked"]);
    await runtime.run("ByPipeline", { winner: "ada" });
    expect(sent[0]).toMatchObject({ url: "https://ledger.example.com/v1/prizes/issue/batch", body: { amount: "10", memo: "weekly prize", currency: "USD" } });
  });

  test("Fixed and Match hold for a pipeline's own calls too", async () => {
    const { runtime, sent } = rt(
      `${LEDGER}
       pipeline WrongCurrency(winner: String) -> Result:
         winner |> Ledger.post(amount: "10", currency: "EUR")
       pipeline WrongAmount(amount: String) -> Result:
         amount |> Ledger.post(amount: amount)`,
    );
    await expect(runtime.run("WrongCurrency", { winner: "ada" })).rejects.toThrow(/currency is fixed by the tool/);
    await expect(runtime.run("WrongAmount", { amount: "lots" })).rejects.toThrow(/amount \(lots\) must match/);
    expect(sent).toHaveLength(0);
  });

  test("a fixed value can come from the environment", async () => {
    const { runtime, sent } = rt(
      `tool Ledger : POST("ledger.example.com/issue") & Fixed("currency", Env.LEDGER_CURRENCY) & Fixed("live", false)
       pipeline Pay(amount: String) -> Result:
         amount |> Ledger.post(amount: amount)`,
    );
    await runtime.run("Pay", { amount: "5" });
    expect(sent[0]!.body).toEqual({ amount: "5", currency: "USD", live: false });
  });

  test("a model is shown only what it may set", () => {
    const tool = parse(LEDGER).tools[0]!;
    const shown = shownParams(tool, {
      type: "object",
      properties: { path: { type: "string" }, currency: { type: "string" }, amount: { type: "string", description: "How much." }, memo: { type: "string" } },
      required: ["amount", "currency"],
      additionalProperties: true,
    });
    expect(Object.keys(shown.properties!)).toEqual(["amount"]);
    expect(shown.required).toEqual(["amount"]);
    expect(shown.properties!.amount).toMatchObject({ pattern: "^(?:\\d+(\\.\\d\\d)?)$", description: "How much. Must match /\\d+(\\.\\d\\d)?/." });
  });

  test("the validator explains a rule it can't use", () => {
    const problems = (src: string) => validate(parse(src)).map((d) => `${d.severity}: ${d.message}`);
    expect(problems(`tool T : POST("a.example.com") & Redact("PII")`).join("\n")).toContain('error: Tool "T": Redact is not a rule a tool can have');
    expect(problems(`tool T : POST("a.example.com") & Match("amount", "(")`).join("\n")).toContain("is not a valid regular expression");
    expect(problems(`tool T : POST("a.example.com") & Fixed("currency")`).join("\n")).toContain("needs an argument name and its value");
    expect(problems(`tool T : REST("a.example.com") & Unlocked("path")`).join("\n")).toContain("warning: Tool \"T\": Unlocked(\"path\") changes nothing");
    expect(problems(`tool T : POST("a.example.com") & Locked("path") & Unlocked("path")`).join("\n")).toContain("both Locked and Unlocked");
  });
});
