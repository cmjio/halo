import { test, expect } from "bun:test";
import { parse } from "../src/parser/index";

test("debug guardrail parsing", () => {
  const src = `
guardrail NoProfanity : Block(Profanity)
mind M [openai/gpt-4]
  requires NoProfanity
stream Test(x: String) -> Result:
  x |> M.prompt("hi") |> System.Print()
`;
  const result = parse(src);
  console.log("Errors:", result.errors);
  console.log("Guardrails:", JSON.stringify(result.guardrails, null, 2));
  console.log("Minds:", JSON.stringify(result.minds, null, 2));
  expect(result.errors).toEqual([]);
  expect(result.guardrails.length).toBeGreaterThan(0);
  if (result.guardrails[0]) {
    expect(result.guardrails[0].rules[0]?.args).toContain("Profanity");
  }
});
