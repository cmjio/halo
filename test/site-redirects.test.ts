import { expect, test } from "bun:test";
import { movedExample } from "../site/worker";

test("old example URLs redirect to the page the example has now", () => {
  expect(movedExample("/examples/74-software-team")).toBe("/examples/software-team");
  expect(movedExample("/examples/74-software-team.html")).toBe("/examples/software-team");
  expect(movedExample("/examples/casebook/021-ecommerce-refund")).toBe("/examples/ecommerce-refund");
  expect(movedExample("/examples/20-role-founder/")).toBe("/examples/founder");
});

test("current pages, and learn/'s numbered pages, aren't redirected", () => {
  expect(movedExample("/examples/software-team")).toBeUndefined();
  expect(movedExample("/examples/01-hello")).toBeUndefined();
  expect(movedExample("/examples/")).toBeUndefined();
  expect(movedExample("/guide/quickstart")).toBeUndefined();
});
