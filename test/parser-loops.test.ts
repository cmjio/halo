import { expect, test, describe } from "bun:test";
import { parse } from "../src/parser/index.js";

describe("Langly Parser - Loops", () => {
  test("parses a loop operator", () => {
    const src = `
      pipeline AutoDev() -> String:
        "Code"
          |> SWE.prompt("Draft code")
          |> Shell.execute("bun check")
          |<> loop(SWE, "context.data.Shell.execute.exitCode != 0")
    `;
    const ast = parse(src);
    const loopStage = ast.pipelines[0]!.pipeline[3] as any;
    expect(loopStage.kind).toBe("loop");
    expect(loopStage.target).toBe("SWE");
    expect(loopStage.condition).toBe("context.data.Shell.execute.exitCode != 0");
  });
});
