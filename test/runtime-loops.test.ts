import { expect, test, describe } from "bun:test";
import { parse } from "../src/parser/index.js";
import { LanglyRuntime } from "../src/runtime/runtime.js";

describe("Langly Runtime - Loops", () => {
  test("pipeline loops back to target stage until condition is false", async () => {
    const src = `
      tool Shell : Bash()
      agent SWE [mock/swe]
      pipeline AutoDev() -> Result:
        "Code"
          |> SWE.prompt("Draft code")
          |> Shell.execute("bun check")
          |<> loop(SWE, "context.data.Shell.exitCode != 0")
    `;
    const ast = parse(src);
    const rt = new LanglyRuntime({ apiKey: "test-key" }).load(ast);

    // Mock SWE
    rt.mockAll({
      "SWE.prompt": "Mocked SWE response"
    });

    // Mock Shell Tool
    let shellExecutions = 0;
    const shellTool = rt.toolRegistry.get("Bash");
    if (shellTool) {
      shellTool.execute = async () => {
        shellExecutions++;
        // Fails twice, succeeds on 3rd try
        return {
          exitCode: shellExecutions < 3 ? 1 : 0
        };
      };
    }

    await rt.execute("AutoDev", {});

    expect(shellExecutions).toBe(3);
  });
});
