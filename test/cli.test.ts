import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { rmSync, existsSync } from "fs";
import { join } from "path";
import { runCli } from "../src/cli.js";

// Helper to run the CLI directly in the same process
async function executeCli(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  let stdout = "";
  let stderr = "";
  
  const mockLogger = {
    log: (msg: string) => { stdout += msg + "\n"; },
    error: (msg: string) => { stderr += msg + "\n"; }
  };

  const exitCode = await runCli(args, mockLogger);
  return { stdout, stderr, exitCode };
}

describe("Halo CLI (P0)", () => {
  const testProjectDir = "test-halo-project";

  beforeAll(() => {
    if (existsSync(testProjectDir)) {
      rmSync(testProjectDir, { recursive: true, force: true });
    }
  });

  afterAll(() => {
    if (existsSync(testProjectDir)) {
      rmSync(testProjectDir, { recursive: true, force: true });
    }
  });

  test("init creates a valid project structure", async () => {
    const { stdout, stderr, exitCode } = await executeCli(["init", testProjectDir]);
    
    expect(exitCode).toBe(0);
    expect(stdout).toContain(`Project "${testProjectDir}" created successfully!`);
    
    // Verify files were created with correct names (Halo, not Langly)
    expect(existsSync(join(testProjectDir, "halo.json"))).toBe(true);
    expect(existsSync(join(testProjectDir, "src", "main.halo"))).toBe(true);
    expect(existsSync(join(testProjectDir, ".env.example"))).toBe(true);
    
    // Verify content of main.halo does not contain .ly or Langly
    const mainHaloContent = await Bun.file(join(testProjectDir, "src", "main.halo")).text();
    expect(mainHaloContent).not.toContain(".ly");
  });

  test("validate succeeds on valid file", async () => {
    const { stdout, stderr, exitCode } = await executeCli(["validate", "examples/01-hello.halo"]);
    
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Valid syntax");
    expect(stderr).toBe("");
  });

  test("validate fails on invalid file", async () => {
    // Create a temporary file with syntax errors
    const badFile = "test-bad-syntax.halo";
    await Bun.write(badFile, "pipeline Bad : this is not valid syntax");
    
    try {
      const { stdout, stderr, exitCode } = await executeCli(["validate", badFile]);
      
      expect(exitCode).toBe(1);
      expect(stderr).toContain("Syntax error");
    } finally {
      rmSync(badFile, { force: true });
    }
  });

  test("run executes pipeline in mock mode", async () => {
    // 01-hello.halo expects { name: String }
    const { stdout, stderr, exitCode } = await executeCli([
      "run", 
      "examples/01-hello.halo", 
      "--args", '{"name": "Alice"}',
      "--mock",
      "--api-key", "test-key"
    ]);
    
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Alice"); 
  });

  test("test command is an alias for run --mock", async () => {
    const { stdout, stderr, exitCode } = await executeCli([
      "test", 
      "examples/01-hello.halo", 
      "--args", '{"name": "Bob"}',
      "--api-key", "test-key"
    ]);
    
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Bob");
  });

});
