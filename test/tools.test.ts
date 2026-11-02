import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { parse } from "../src/parser/index.js";
import { LanglyRuntime } from "../src/runtime/runtime.js";
import { Database } from "bun:sqlite";

describe("Langly Tool Connectors", () => {
  let dbPath = "test-langly.sqlite";

  beforeAll(() => {
    // Setup a dummy sqlite DB for PostgreSQL native connector test
    const db = new Database(dbPath);
    db.run("CREATE TABLE IF NOT EXISTS users (id TEXT, name TEXT, type TEXT)");
    db.run("INSERT INTO users (id, name, type) VALUES ('u1', 'Alice', 'admin')");
    db.run("INSERT INTO users (id, name, type) VALUES ('u2', 'Bob', 'user')");
    db.close();
  });

  afterAll(() => {
    import("fs").then(fs => {
      if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    });
  });

  test("PostgreSQL tool connects and queries using bun:sqlite fallback for testing", async () => {
    const src = `
      tool DB : PostgreSQL("test-langly.sqlite")
      pipeline SqlDemo(uid: String) -> Result:
        uid |> DB.execute(query: "SELECT * FROM users WHERE id = '{{context.input.uid}}'")
    `;
    const ast = parse(src);
    const rt = new LanglyRuntime().load(ast);

    const result = await rt.execute("SqlDemo", { uid: "u1" });
    // Expect the result to be the parsed rows from SQLite
    expect(Array.isArray(result)).toBe(true);
    expect((result as any[])[0].name).toBe("Alice");
    expect((result as any[])[0].type).toBe("admin");
  });

  test("VectorStore tool executes cosine similarity over in-store strings", async () => {
    const src = `
      tool KB : VectorStore("mock-index")
      pipeline VectorDemo(q: String) -> Result:
        q |> KB.execute(method: "search", query: "{{context.input.q}}")
    `;
    const ast = parse(src);
    const rt = new LanglyRuntime().load(ast);
    
    // We can pre-load the vector store in the test via runtime API
    const vectorTool = rt.toolRegistry.get("VectorStore") as any;
    vectorTool.seed("mock-index", [
      "Policies for admin: Everything is allowed.",
      "Policies for user: Restricted access.",
      "How to reset password: click link."
    ]);

    const result = await rt.execute("VectorDemo", { q: "admin policies" });
    // We expect the most relevant chunk
    expect(result).toBe("Policies for admin: Everything is allowed.");
  });
});
