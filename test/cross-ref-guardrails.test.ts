import { describe, test, expect } from "bun:test";
import { parse } from "../src/parser/index.js";
import { LanglyRuntime } from "../src/runtime/runtime.js";
import { PolicyViolation } from "../src/errors.js";

describe("Cross-Reference Output Guardrails (Validate)", () => {

  test("Validate checks LLM output field against context.data value", async () => {
    const source = `
policy PayoutLimit : Validate(payout_amount, "<=", context.data.verify_coverage.max_payout)

agent ClaimsBot [openai/gpt-4o-mini, temp: 0.0]

agent Adjuster [openai/gpt-4o, temp: 0.2]
  requires PayoutLimit

pipeline ProcessClaim(claim: String) -> Result:
  claim
    |> ClaimsBot.verify_coverage("Check policy")
    |> Adjuster.calculate_payout("Calculate payout based on coverage")
`;
    const ast = parse(source);
    const runtime = new LanglyRuntime();
    runtime.load(ast);
    runtime.mockAll({
      "ClaimsBot.verify_coverage": JSON.stringify({ max_payout: 5000, covered: true }),
      "Adjuster.calculate_payout": JSON.stringify({ payout_amount: 7500, reasoning: "Severe damage" }),
    });

    // The Adjuster output has payout_amount=7500 which exceeds max_payout=5000
    try {
      await runtime.execute("ProcessClaim", { claim: "Water damage claim" });
      expect(true).toBe(false); // Should not reach
    } catch (e: any) {
      expect(e).toBeInstanceOf(PolicyViolation);
      expect(e.message).toContain("payout_amount");
    }
  });

  test("Validate passes when output is within limits", async () => {
    const source = `
policy PayoutLimit : Validate(payout_amount, "<=", context.data.verify_coverage.max_payout)

agent ClaimsBot [openai/gpt-4o-mini, temp: 0.0]

agent Adjuster [openai/gpt-4o, temp: 0.2]
  requires PayoutLimit

pipeline ProcessClaim(claim: String) -> Result:
  claim
    |> ClaimsBot.verify_coverage("Check policy")
    |> Adjuster.calculate_payout("Calculate payout based on coverage")
`;
    const ast = parse(source);
    const runtime = new LanglyRuntime();
    runtime.load(ast);
    runtime.mockAll({
      "ClaimsBot.verify_coverage": JSON.stringify({ max_payout: 10000, covered: true }),
      "Adjuster.calculate_payout": JSON.stringify({ payout_amount: 3000, reasoning: "Minor damage" }),
    });

    // payout_amount=3000 <= max_payout=10000, should pass
    const result = await runtime.execute("ProcessClaim", { claim: "Minor claim" });
    expect(result).toBeDefined();
  });

  test("Validate handles missing field gracefully", async () => {
    const source = `
policy PayoutLimit : Validate(nonexistent_field, "<=", context.data.verify_coverage.max_payout)

agent ClaimsBot [openai/gpt-4o-mini, temp: 0.0]

agent Adjuster [openai/gpt-4o, temp: 0.2]
  requires PayoutLimit

pipeline ProcessClaim(claim: String) -> Result:
  claim
    |> ClaimsBot.verify_coverage("Check policy")
    |> Adjuster.calculate_payout("Calculate payout")
`;
    const ast = parse(source);
    const runtime = new LanglyRuntime();
    runtime.load(ast);
    runtime.mockAll({
      "ClaimsBot.verify_coverage": JSON.stringify({ max_payout: 5000 }),
      "Adjuster.calculate_payout": JSON.stringify({ payout_amount: 3000 }),
    });

    // The field "nonexistent_field" doesn't exist in the output — should throw
    try {
      await runtime.execute("ProcessClaim", { claim: "test" });
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e).toBeInstanceOf(PolicyViolation);
      expect(e.message).toContain("nonexistent_field");
    }
  });
});
