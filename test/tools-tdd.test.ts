import { BashTool, BrowserTool } from "../src/runtime/tools.js";

async function runTDD() {
  console.log("=== Testing Real Tools ===");

  const ctx: any = { current: "", data: {}, input: {} };

  // 1. Test Bash Tool
  console.log("\\nTesting BashTool...");
  const bashTool = new BashTool();
  
  try {
    const bashResult = await bashTool.execute([], { command: 'echo "Hello Langly"' }, ctx) as any;
    if (bashResult.stdout.includes("Hello Langly") && bashResult.exitCode === 0) {
      console.log("✅ [PASSED] BashTool executed locally");
    } else {
      console.error("❌ [FAILED] BashTool returned:", bashResult);
      process.exit(1);
    }
  } catch (err) {
    const e = err as Error;
    if (e.message.includes("Mock")) {
       console.error("❌ [FAILED] BashTool is still mocked!");
       process.exit(1);
    }
    throw e;
  }

  // 2. Test Browser Tool
  console.log("\\nTesting BrowserTool...");
  const browserTool = new BrowserTool();
  
  try {
    const browserResult = await browserTool.execute([], { url: "https://example.com" }, ctx) as any;
    if (browserResult.content && browserResult.content.includes("Example Domain")) {
      console.log("✅ [PASSED] BrowserTool successfully fetched and parsed example.com");
    } else {
      console.error("❌ [FAILED] BrowserTool returned:", browserResult);
      process.exit(1);
    }
  } catch (err) {
    const e = err as Error;
    if (e.message && e.message.includes("Mock")) {
       console.error("❌ [FAILED] BrowserTool is still mocked!");
       process.exit(1);
    }
    throw e;
  }

  console.log("\\n🎉 All Tool TDD tests passed!");
}

runTDD().catch(console.error);
