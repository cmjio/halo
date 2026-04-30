import { test, expect, describe } from "bun:test";
import {
  OpenAIAdapter,
  AnthropicAdapter,
  GoogleAdapter,
  OpenRouterAdapter,
  TogetherAdapter,
  ReplicateAdapter,
  OllamaAdapter,
  AdapterRegistry,
} from "../src/runtime/adapter";
import type { LLMRequest } from "../src/runtime/adapter";

describe("LLM Adapters", () => {
  // ── OpenAI Adapter ─────

  const openai = new OpenAIAdapter();

  test("OpenAI: canHandle detects openai/ and oai/ prefixes", () => {
    expect(openai.canHandle("openai/gpt-4o")).toBe(true);
    expect(openai.canHandle("oai/gpt-4o-mini")).toBe(true);
    expect(openai.canHandle("anthropic/claude")).toBe(false);
  });

  test("OpenAI: transforms request correctly", () => {
    const req: LLMRequest = {
      model: "gpt-4o",
      messages: [{ role: "user", content: "Hello" }],
      temperature: 0.5,
    };
    const transformed = openai.transformRequest(req) as Record<string, unknown>;
    expect(transformed["model"]).toBe("gpt-4o");
    expect(transformed["temperature"]).toBe(0.5);
  });

  test("OpenAI: parses response correctly", () => {
    const response = {
      choices: [{ message: { content: "Hello from OpenAI!" } }],
      usage: { prompt_tokens: 10, completion_tokens: 20 },
    };
    const parsed = openai.parseResponse(response);
    expect(parsed.text).toBe("Hello from OpenAI!");
    expect(parsed.usage?.promptTokens).toBe(10);
  });

  test("OpenAI: estimates cost correctly", () => {
    const cost = openai.estimateCost("gpt-4o", 1000, 500);
    // 1k input * 0.005 + 0.5k output * 0.015 = 5 + 7.5 = 12.5
    expect(cost).toBeCloseTo(0.0125, 4);
  });

  // ── Anthropic Adapter ─────

  const anthropic = new AnthropicAdapter();

  test("Anthropic: canHandle detects anthropic/ and claude/ prefixes", () => {
    expect(anthropic.canHandle("anthropic/claude-3-sonnet")).toBe(true);
    expect(anthropic.canHandle("claude/opus")).toBe(true);
    expect(anthropic.canHandle("openai/gpt")).toBe(false);
  });

  test("Anthropic: transforms request correctly", () => {
    const req: LLMRequest = {
      model: "claude-3-sonnet-20240229",
      messages: [
        { role: "system", content: "You are helpful" },
        { role: "user", content: "Hello" },
      ],
      temperature: 0.3,
      maxTokens: 2048,
    };
    const transformed = anthropic.transformRequest(req) as Record<string, unknown>;
    expect(transformed["model"]).toBe("claude-3-sonnet-20240229");
    expect(transformed["system"]).toBe("You are helpful");
    expect(transformed["max_tokens"]).toBe(2048);
  });

  // ── Google Adapter ─────

  const google = new GoogleAdapter();

  test("Google: canHandle detects google/, gemini/, gemini- prefixes", () => {
    expect(google.canHandle("google/gemini-1.5-pro")).toBe(true);
    expect(google.canHandle("gemini/gemini-1.5-flash")).toBe(true);
    expect(google.canHandle("gemini-1.5-pro")).toBe(true);
    expect(google.canHandle("openai/gpt")).toBe(false);
  });

  test("Google: builds correct URL", () => {
    const url = google.getUrl("gemini-1.5-pro");
    expect(url).toContain("generativelanguage.googleapis.com");
    expect(url).toContain("gemini-1.5-pro");
  });

  // ── Ollama Adapter ─────

  const ollama = new OllamaAdapter();

  test("Ollama: canHandle detects ollama/ and local/ prefixes", () => {
    expect(ollama.canHandle("ollama/llama3.1")).toBe(true);
    expect(ollama.canHandle("local/mistral")).toBe(true);
    expect(ollama.canHandle("openai/gpt")).toBe(false);
  });

  test("Ollama: cost is always 0 (local models)", () => {
    const cost = ollama.estimateCost("llama3.1", 10000, 5000);
    expect(cost).toBe(0);
  });

  // ── Adapter Registry ─────

  test("AdapterRegistry: finds correct adapter for model ID", () => {
    const registry = new AdapterRegistry();
    
    const openaiAdapter = registry.findAdapter("openai/gpt-4o");
    expect(openaiAdapter?.id).toBe("openai");

    const anthropicAdapter = registry.findAdapter("anthropic/claude-3-sonnet");
    expect(anthropicAdapter?.id).toBe("anthropic");

    const ollamaAdapter = registry.findAdapter("ollama/llama3.1");
    expect(ollamaAdapter?.id).toBe("ollama");
  });

  test("AdapterRegistry: can register custom adapters", () => {
    const registry = new AdapterRegistry();
    
    // Create a custom adapter that handles "custom/" prefix
    class CustomAdapter extends OpenAIAdapter {
      override id = "custom";
      override canHandle(modelId: string): boolean {
        return modelId.startsWith("custom/");
      }
    }
    
    registry.register(new CustomAdapter());

    const adapter = registry.findAdapter("custom/test-model");
    expect(adapter?.id).toBe("custom");
  });
});
