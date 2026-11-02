import { expect, test, describe } from "bun:test";
import { parse } from "../src/parser/index.js";
import { LanglyRuntime } from "../src/runtime/runtime.js";

describe("Langly Runtime - Schema Validation", () => {
  test("throws SchemaValidationError if return value does not match schema", async () => {
    const src = `
      schema UserProfile:
        id: String
        role: String
      pipeline AnalyzeUser() -> UserProfile:
        "invalid data"
    `;
    const ast = parse(src);
    const rt = new LanglyRuntime().load(ast);

    // "invalid data" is a string, but UserProfile expects an object with id and role
    expect(rt.execute("AnalyzeUser", {})).rejects.toThrow("Schema validation failed: Output is not valid JSON");
  });

  test("passes if return value matches schema", async () => {
    const src = `
      schema UserProfile:
        id: String
        role: String
      tool REST: REST()
      pipeline AnalyzeUser() -> UserProfile:
        "valid data" |> REST.execute()
    `;
    const ast = parse(src);
    const rt = new LanglyRuntime().load(ast);

    // Mock REST tool to return a valid object
    const restTool = rt.toolRegistry.get("REST");
    if (restTool) {
      restTool.execute = async () => ({ id: "123", role: "admin" });
    }

    const result = await rt.execute("AnalyzeUser", {});
    expect(result).toEqual({ id: "123", role: "admin" });
  });

  test("allows primitive return types", async () => {
    const src = `
      pipeline ReturnString() -> String:
        "hello"
    `;
    const ast = parse(src);
    const rt = new LanglyRuntime().load(ast);

    const result = await rt.execute("ReturnString", {});
    expect(result).toBe("hello");
  });
});
