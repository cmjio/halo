import { test, expect } from "bun:test";
import { parse } from "../src/parser/index";

test("debug policy parsing", () => {
  const src = `
policy NoProfanity : Block(Profanity)
agent M [openai/gpt-4]
  requires NoProfanity
pipeline Test(x: String) -> Result:
  x |> M.prompt("hi") |> System.Print()
`;
  const result = parse(src);
  console.log("Errors:", result.errors);
  console.log("Guardrails:", JSON.stringify(result.policies, null, 2));
  console.log("Minds:", JSON.stringify(result.agents, null, 2));
  expect(result.errors).toEqual([]);
  expect(result.policies.length).toBeGreaterThan(0);
  if (result.policies[0]) {
    expect(result.policies[0].rules[0]?.args).toContain("Profanity");
  }
});
