import { describe, test, expect } from "bun:test";
import { parse } from "../src/parser/index.js";
import { readdirSync, readFileSync } from "fs";

/**
 * TDD: System prompts on all role/power/control examples.
 * These tests are written FIRST — they will fail until the
 * example files are updated with system directives.
 */

// Helper to parse an example file
function parseExample(name: string) {
  const source = readFileSync(`examples/${name}`, "utf-8");
  return parse(source);
}

// Helper to assert an agent has a system prompt containing a keyword
function expectSystemPrompt(fileName: string, agentName: string, mustContain: string[]) {
  test(`${fileName} → ${agentName} has system prompt`, () => {
    const result = parseExample(fileName);
    expect(result.errors).toEqual([]);
    const agent = result.agents.find(a => a.name === agentName);
    expect(agent).toBeDefined();
    expect(agent!.system).toBeDefined();
    expect(agent!.system!.length).toBeGreaterThan(10);
    for (const keyword of mustContain) {
      expect(agent!.system!.toLowerCase()).toContain(keyword.toLowerCase());
    }
  });
}

// ──────────────────────────────────────
// 21: Software Engineer
// ──────────────────────────────────────
describe("21-role-software-engineer.halo", () => {
  expectSystemPrompt("21-role-software-engineer.halo", "Triage", ["incident", "classify"]);
  expectSystemPrompt("21-role-software-engineer.halo", "Diagnoser", ["diagnos", "root cause"]);
  expectSystemPrompt("21-role-software-engineer.halo", "CodeReviewer", ["review", "safe"]);
});

// ──────────────────────────────────────
// 22: UX Designer
// ──────────────────────────────────────
describe("22-role-ux-designer.halo", () => {
  expectSystemPrompt("22-role-ux-designer.halo", "Auditor", ["accessibility", "WCAG"]);
  expectSystemPrompt("22-role-ux-designer.halo", "TokenMaster", ["design", "token"]);
  expectSystemPrompt("22-role-ux-designer.halo", "MockArtist", ["visual", "mock"]);
});

// ──────────────────────────────────────
// 23: UX Researcher
// ──────────────────────────────────────
describe("23-role-ux-researcher.halo", () => {
  expectSystemPrompt("23-role-ux-researcher.halo", "ThematicAnalyst", ["theme", "interview"]);
  expectSystemPrompt("23-role-ux-researcher.halo", "DataTrier", ["validat", "metric"]);
  expectSystemPrompt("23-role-ux-researcher.halo", "ReportSynthesizer", ["report", "research"]);
});

// ──────────────────────────────────────
// 24: QA Engineer
// ──────────────────────────────────────
describe("24-role-qa-engineer.halo", () => {
  expectSystemPrompt("24-role-qa-engineer.halo", "TestArchitect", ["test", "generat"]);
  expectSystemPrompt("24-role-qa-engineer.halo", "FlakyDetector", ["flaky", "unstable"]);
});

// ──────────────────────────────────────
// 25: Product Manager
// ──────────────────────────────────────
describe("25-role-product-manager.halo", () => {
  expectSystemPrompt("25-role-product-manager.halo", "Clustering", ["cluster", "request"]);
  expectSystemPrompt("25-role-product-manager.halo", "Strategist", ["strateg", "priorit"]);
  expectSystemPrompt("25-role-product-manager.halo", "Writer", ["roadmap", "brief"]);
});

// ──────────────────────────────────────
// 30: Content Moderation
// ──────────────────────────────────────
describe("30-control-moderation.halo", () => {
  expectSystemPrompt("30-control-moderation.halo", "TriageAgent", ["triage", "content"]);
  expectSystemPrompt("30-control-moderation.halo", "ReviewAgent", ["review", "edge case"]);
  expectSystemPrompt("30-control-moderation.halo", "PolicyExpert", ["policy", "regulat"]);
});

// ──────────────────────────────────────
// 31: Analyst Swarm
// ──────────────────────────────────────
describe("31-power-analyst-swarm.halo", () => {
  expectSystemPrompt("31-power-analyst-swarm.halo", "Researcher", ["research", "anomal"]);
  expectSystemPrompt("31-power-analyst-swarm.halo", "ReportWriter", ["report", "briefing"]);
  expectSystemPrompt("31-power-analyst-swarm.halo", "RiskAssessor", ["risk", "decision"]);
});

// ──────────────────────────────────────
// 99: Custom Demo
// ──────────────────────────────────────
describe("99-custom-demo.halo", () => {
  expectSystemPrompt("99-custom-demo.halo", "Researcher", ["researcher", "facts"]);
  expectSystemPrompt("99-custom-demo.halo", "Analyst", ["analyst", "synthesize"]);
});

// ──────────────────────────────────────
// Global: All examples still parse cleanly
// ──────────────────────────────────────
describe("All examples parse without errors", () => {
  const files = readdirSync("examples").filter(f => f.endsWith(".halo")).sort();
  for (const f of files) {
    test(`${f} parses cleanly`, () => {
      const result = parseExample(f);
      expect(result.errors).toEqual([]);
    });
  }
});
