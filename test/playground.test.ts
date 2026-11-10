import { describe, expect, test } from "bun:test";
import { parse } from "../src/parser/index";
import { validate } from "../src/parser/validate";
import { plan, type Plan } from "../src/plan";
import { BUILTIN_PROVIDER_INFO } from "../src/runtime/provider-info";
import { CHALLENGES, TRACKS, type CheckInput } from "../site/src/challenges";

/** What the playground hands a challenge's check, built the same way. */
function input(source: string): CheckInput {
  const ast = parse(source);
  const problems = ast.errors.length ? [] : validate(ast, { toolProviders: Object.keys(BUILTIN_PROVIDER_INFO) });
  const plans: Plan[] = ast.errors.length ? [] : ast.pipelines.map((p) => plan(ast, p.name, { providerInfo: (x) => BUILTIN_PROVIDER_INFO[x] }));
  return { source, ast, problems, plans };
}

describe("playground challenges", () => {
  test("ids are unique, since solved challenges are remembered by id", () => {
    expect(new Set(CHALLENGES.map((c) => c.id)).size).toBe(CHALLENGES.length);
  });

  test("challenges are listed track by track, in the tracks' order", () => {
    const order = CHALLENGES.map((c) => TRACKS.indexOf(c.track));
    expect(order.every((t) => t >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(new Set(CHALLENGES.map((c) => c.track)).size).toBe(TRACKS.length);
  });

  for (const c of CHALLENGES) {
    test(`${c.id}: the starter isn't solved yet, but it parses`, () => {
      const i = input(c.starter);
      expect(i.ast.errors).toEqual([]);
      expect(c.check(i)).toBe(false);
    });

    test(`${c.id}: the solution solves it, with no errors or warnings`, () => {
      const i = input(c.solution);
      expect(i.ast.errors).toEqual([]);
      expect(i.problems).toEqual([]);
      expect(c.check(i)).toBe(true);
    });
  }
});
