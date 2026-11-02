import { expect, test, describe } from "bun:test";
import { parse } from "../src/parser/index.js";

describe("Langly Parser - Schemas", () => {
  test("parses a simple schema declaration", () => {
    const src = `
      schema UserProfile {
        id: String
        role: String
      }
    `;
    const ast = parse(src);
    if (ast.errors.length) console.log("AST ERRORS:", ast.errors);
    expect(ast.schemas.length).toBe(1);
    expect(ast.schemas[0]!.name).toBe("UserProfile");
    expect(ast.schemas[0]!.fields).toEqual([
      { name: "id", type: "String" },
      { name: "role", type: "String" }
    ]);
  });

  test("parses a schema with array types", () => {
    const src = `
      schema Team {
        users: Array<String>
        active: Boolean
      }
    `;
    const ast = parse(src);
    expect(ast.schemas.length).toBe(1);
    expect(ast.schemas[0]!.fields[0]!.type).toBe("Array<String>");
  });

  test("pipeline declaration can return a custom schema type", () => {
    const src = `
      schema UserProfile {
        id: String
      }
      pipeline AnalyzeUser(userId: String) -> UserProfile:
        userId |> Writer.prompt("test")
    `;
    const ast = parse(src);
    expect(ast.pipelines[0]!.returnType).toBe("UserProfile");
  });
});
