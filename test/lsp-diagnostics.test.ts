import { expect, test, describe } from "bun:test";
import { getDiagnostics } from "../src/lsp/diagnostics.js";

describe("Langly LSP Diagnostics", () => {
  test("returns empty diagnostics for valid code", () => {
    const src = `
      tool Shell : Bash()
      pipeline Hello() -> Result:
        "hi" |> Shell.execute()
    `;
    const diagnostics = getDiagnostics(src);
    expect(diagnostics.length).toBe(0);
  });

  test("returns diagnostic for syntax error", () => {
    const src = `
      tool Shell Bash()
    `;
    const diagnostics = getDiagnostics(src);
    expect(diagnostics.length).toBeGreaterThan(0);
    expect(diagnostics[0]!.message).toContain("missing ':'");
    expect(diagnostics[0]!.range.start.line).toBe(1); // 0-indexed in LSP
  });
});
