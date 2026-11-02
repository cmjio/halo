import { describe, test, expect } from "bun:test";
import { parse } from "../src/parser/index.js";

describe("System Prompt - Parser", () => {

  test("parses agent with single-line system prompt", () => {
    const source = `
agent Helper [openai/gpt-4o, temp: 0.7]
  system "You are a helpful assistant."
`;
    const result = parse(source);
    expect(result.errors).toEqual([]);
    expect(result.agents).toHaveLength(1);
    expect(result.agents[0]!.name).toBe("Helper");
    expect(result.agents[0]!.system).toBe("You are a helpful assistant.");
  });

  test("parses agent with triple-quoted system prompt", () => {
    const source = `
agent Analyst [anthropic/claude-sonnet-4, temp: 0.1]
  system """
    You are a senior financial analyst.
    Always respond with structured JSON.
    Include confidence scores.
  """
`;
    const result = parse(source);
    expect(result.errors).toEqual([]);
    expect(result.agents).toHaveLength(1);
    expect(result.agents[0]!.system).toBeDefined();
    expect(result.agents[0]!.system).toContain("senior financial analyst");
    expect(result.agents[0]!.system).toContain("structured JSON");
    expect(result.agents[0]!.system).toContain("confidence scores");
  });

  test("agent without system prompt has undefined system field", () => {
    const source = `
agent Basic [openai/gpt-4o-mini, temp: 0.5]
`;
    const result = parse(source);
    expect(result.errors).toEqual([]);
    expect(result.agents).toHaveLength(1);
    expect(result.agents[0]!.system).toBeUndefined();
  });

  test("system prompt works alongside equips and requires", () => {
    const source = `
policy Safety : Block(Profanity)
tool API : REST("api.example.com")

agent Worker [openai/gpt-4o, temp: 0.3]
  system "You are a data processor. Output JSON only."
  equips API
  requires Safety
`;
    const result = parse(source);
    expect(result.errors).toEqual([]);
    expect(result.agents).toHaveLength(1);
    const agent = result.agents[0]!;
    expect(agent.system).toBe("You are a data processor. Output JSON only.");
    expect(agent.equips).toEqual(["API"]);
    expect(agent.requires).toEqual(["Safety"]);
  });

  test("system prompt works with directives", () => {
    const source = `
@shadow(Worker_V2)
agent Worker [anthropic/claude-sonnet-4, temp: 0.1]
  system "You are a researcher."
  equips API

tool API : REST("api.example.com")
`;
    const result = parse(source);
    expect(result.errors).toEqual([]);
    expect(result.agents).toHaveLength(1);
    const agent = result.agents[0]!;
    expect(agent.directives).toHaveLength(1);
    expect(agent.directives![0]!.name).toBe("shadow");
    expect(agent.system).toBe("You are a researcher.");
  });

  test("parses updated 19-system-prompts.halo example without errors", async () => {
    const source = await Bun.file("examples/19-system-prompts.halo").text();
    const result = parse(source);
    expect(result.errors).toEqual([]);
    // Should have 3 agents: Generic, Translator, Analyst
    expect(result.agents).toHaveLength(3);
    
    const generic = result.agents.find(a => a.name === "Generic")!;
    expect(generic.system).toBeUndefined();
    
    const translator = result.agents.find(a => a.name === "Translator")!;
    expect(translator.system).toContain("professional translator");
    
    const analyst = result.agents.find(a => a.name === "Analyst")!;
    expect(analyst.system).toContain("senior data analyst");
  });

  test("parses updated 20-role-founder.halo example without errors", async () => {
    const source = await Bun.file("examples/20-role-founder.halo").text();
    const result = parse(source);
    expect(result.errors).toEqual([]);
    
    const analyst = result.agents.find(a => a.name === "Analyst")!;
    expect(analyst.system).toContain("financial analyst");
    
    const summarizer = result.agents.find(a => a.name === "Summarizer")!;
    expect(summarizer.system).toContain("executive communications");
  });
});

describe("System Prompt - Runtime", () => {

  test("agent with system prompt has system field in runtime", async () => {
    const { LanglyRuntime } = await import("../src/runtime/runtime.js");
    
    const source = `
agent Helper [openai/gpt-4o, temp: 0.7]
  system "You are a helpful assistant who speaks like a pirate."

pipeline Greet(name: String) -> Result:
  name
    |> Helper.prompt("Say hello to {{name}}")
    |> System.Print()
`;

    const ast = parse(source);
    expect(ast.errors).toEqual([]);
    
    const rt = new LanglyRuntime({ apiKey: "test-key" });
    rt.load(ast);
    
    // Verify the agent was parsed with system prompt
    const agents = (rt as any).agents as Map<string, any>;
    const helper = agents.get("Helper");
    expect(helper).toBeDefined();
    expect(helper.system).toBe("You are a helpful assistant who speaks like a pirate.");
  });

  test("agent without system prompt has no system field in runtime", async () => {
    const { LanglyRuntime } = await import("../src/runtime/runtime.js");
    
    const source = `
agent Plain [openai/gpt-4o, temp: 0.7]

pipeline Greet(name: String) -> Result:
  name
    |> Plain.prompt("Say hello to {{name}}")
    |> System.Print()
`;

    const ast = parse(source);
    expect(ast.errors).toEqual([]);

    const rt = new LanglyRuntime({ apiKey: "test-key" });
    rt.load(ast);
    
    const agents = (rt as any).agents as Map<string, any>;
    const plain = agents.get("Plain");
    expect(plain).toBeDefined();
    expect(plain.system).toBeUndefined();
  });

  test("system prompt is preserved through mock execution", async () => {
    const { LanglyRuntime } = await import("../src/runtime/runtime.js");
    
    const source = `
agent Pirate [openai/gpt-4o, temp: 0.7]
  system "You are a pirate. Say arr."

pipeline Greet(name: String) -> Result:
  name
    |> Pirate.prompt("Say hello to {{name}}")
    |> System.Print()
`;

    const ast = parse(source);
    const rt = new LanglyRuntime({ apiKey: "test-key" });
    rt.load(ast).mockAll({ "Pirate.prompt": "Arr, hello Alice!" });
    
    // Mock execution still works — system prompt doesn't break anything
    const result = await rt.execute("Greet", { name: "Alice" });
    expect(result).toBe("Arr, hello Alice!");
  });
});
