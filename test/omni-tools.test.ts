import { expect, test, describe } from "bun:test";
import { parse } from "../src/parser/index.js";
import { LanglyRuntime } from "../src/runtime/runtime.js";

describe("Langly Omni-Connectors", () => {
  test("GitHub Tool executes and parses args", async () => {
    const src = `
      tool Repo : GitHub("mock-token")
      pipeline GitHubDemo() -> Result:
        "123" |> Repo.execute(method: "comment", prId: "{{context.current}}", body: "Looks good")
    `;
    const ast = parse(src);
    const rt = new LanglyRuntime().load(ast);
    const result = await rt.execute("GitHubDemo", {});
    expect((result as any).method).toBe("comment");
    expect((result as any).prId).toBe("123");
    expect((result as any).body).toBe("Looks good");
  });

  test("Bash Tool executes shell commands", async () => {
    const src = `
      tool Shell : Bash()
      pipeline BashDemo() -> Result:
        "echo hello" |> Shell.execute()
    `;
    const ast = parse(src);
    const rt = new LanglyRuntime().load(ast);
    const result = await rt.execute("BashDemo", {});
    expect((result as any).command).toBe("echo hello");
    expect((result as any).stdout).toBe("hello");
  });

  test("Browser Tool executes web scraping", async () => {
    const src = `
      tool Web : Browser("headless")
      pipeline BrowserDemo(url: String) -> Result:
        url |> Web.execute(method: "scrape")
    `;
    const ast = parse(src);
    const rt = new LanglyRuntime().load(ast);
    const result = await rt.execute("BrowserDemo", { url: "https://example.com" });
    expect((result as any).url).toBe("https://example.com");
    expect((result as any).content).toContain("Example Domain");
  });
});
