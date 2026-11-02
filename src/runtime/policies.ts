import type { ExecutionContext } from "./runtime.js";
import { PolicyViolation } from "../errors.js";

/**
 * Policy execution phase.
 * - "input"  — runs on the prompt BEFORE it reaches the LLM
 * - "output" — runs on the response AFTER the LLM returns
 * - "both"   — runs on both input and output
 */
export type PolicyPhase = "input" | "output" | "both";

/** Interface for pluggable policy connectors. */
export interface PolicyPlugin {
  /** The rule name used in DSL (e.g., "Redact") */
  name: string;

  /**
   * Phase this policy runs in. Defaults to "output" for backward compat.
   * - "input": scrub/block the prompt before it reaches the LLM
   * - "output": validate/transform the LLM response
   * - "both": run on both input and output
   */
  phase?: PolicyPhase;
  
  /** Execute the policy logic. Returns the modified text or throws an error. */
  apply(
    text: string,
    args: string[],
    ctx: ExecutionContext,
    metrics?: { duration: number; completionTokens: number }
  ): Promise<string> | string;
}

export class PolicyRegistry {
  private plugins = new Map<string, PolicyPlugin>();

  register(plugin: PolicyPlugin): this {
    this.plugins.set(plugin.name, plugin);
    return this;
  }

  get(name: string): PolicyPlugin | undefined {
    return this.plugins.get(name);
  }
}

// ── Built-in Standard Library Policies ─────

export class BlockPlugin implements PolicyPlugin {
  name = "Block";
  phase: PolicyPhase = "both"; // Block harmful content in BOTH directions

  apply(text: string, args: string[]): string {
    const lowerText = text.toLowerCase();
    
    if (args.includes("Profanity") && /\b(damn|shit|fuck)\b/i.test(text)) {
      throw new PolicyViolation("Block", "Content blocked: Profanity detected");
    }
    if (args.includes("DestructiveOps") && ["DROP", "DELETE", "TRUNCATE", "rm -rf"].some(op => text.includes(op))) {
      throw new PolicyViolation("Block", "Content blocked: Destructive operations not allowed");
    }
    if (args.includes("HarmfulContent") && (lowerText.includes("bomb") || lowerText.includes("weapon"))) {
      throw new PolicyViolation("Block", "Content blocked: Harmful content detected");
    }
    if (args.includes("HateSpeech") && lowerText.includes("slur")) {
      throw new PolicyViolation("Block", "Content blocked: Hate speech detected");
    }
    if (args.includes("SexualContent") && lowerText.includes("nsfw")) {
      throw new PolicyViolation("Block", "Content blocked: Sexual content detected");
    }
    if (args.includes("PromptInjection") && ["ignore previous", "system override", "you are now", "bypass"].some(inj => lowerText.includes(inj))) {
      throw new PolicyViolation("Block", "Content blocked: Prompt injection / jailbreak override detected");
    }
    if (args.includes("Markdown") && /\*\*|__|###|```/.test(text)) {
      throw new PolicyViolation("Block", "Content blocked: Markdown formatting not allowed");
    }
    if (args.includes("Competitors") && ["competitor_a", "competitor_b"].some(c => lowerText.includes(c))) {
      throw new PolicyViolation("Block", "Content blocked: Competitor mention detected");
    }
    if (args.includes("DiscriminatoryLanguage") && ["whites only", "no blacks", "no mexicans"].some(d => lowerText.includes(d))) {
      throw new PolicyViolation("Block", "Content blocked: Discriminatory language detected");
    }
    if (args.includes("SteeringLanguage") && ["bad neighborhood", "ethnic area", "undesirable area"].some(s => lowerText.includes(s))) {
      throw new PolicyViolation("Block", "Content blocked: Steering language detected");
    }
    
    return text;
  }
}

export class MaxWordsPlugin implements PolicyPlugin {
  name = "MaxWords";
  phase: PolicyPhase = "output"; // Only check output length
  apply(text: string, args: string[]): string {
    const maxWords = parseInt(args[0] ?? "0");
    const wordCount = text.split(/\s+/).length;
    if (wordCount > maxWords) {
      throw new PolicyViolation("MaxWords", `Content exceeds max words: ${wordCount} > ${maxWords}`);
    }
    return text;
  }
}

export class MaxTokensPlugin implements PolicyPlugin {
  name = "MaxTokens";
  phase: PolicyPhase = "output"; // Needs completion metrics
  apply(text: string, args: string[], _ctx: ExecutionContext, metrics?: { completionTokens: number }): string {
    const maxTokens = parseInt(args[0] ?? "0");
    if (metrics && metrics.completionTokens > maxTokens) {
      throw new PolicyViolation("MaxTokens", `Content exceeds max tokens: ${metrics.completionTokens} > ${maxTokens}`);
    }
    return text;
  }
}

export class MaxLatencyPlugin implements PolicyPlugin {
  name = "MaxLatency";
  phase: PolicyPhase = "output"; // Needs duration metrics
  
  private parseDuration(d: string): number {
    const match = d.match(/^(\d+)([smhd])$/);
    if (!match || match.length < 3) return 0;
    const n = parseInt(match[1] || "0");
    const unit = match[2];
    switch (unit) {
      case "s": return n * 1000;
      case "m": return n * 60 * 1000;
      case "h": return n * 60 * 60 * 1000;
      case "d": return n * 24 * 60 * 60 * 1000;
      default: return 0;
    }
  }

  apply(text: string, args: string[], _ctx: ExecutionContext, metrics?: { duration: number }): string {
    const maxLatencyMs = this.parseDuration(args[0] ?? "0s");
    if (metrics && metrics.duration > maxLatencyMs) {
      throw new PolicyViolation("MaxLatency", `Execution exceeded max latency: ${metrics.duration}ms > ${maxLatencyMs}ms`);
    }
    return text;
  }
}

export class RedactPlugin implements PolicyPlugin {
  name = "Redact";
  phase: PolicyPhase = "both"; // Scrub PII from BOTH input and output
  apply(text: string, args: string[]): string {
    let redacted = text;
    if (args.includes("SSN")) {
      redacted = redacted.replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[REDACTED_SSN]");
    }
    if (args.includes("CreditCard")) {
      redacted = redacted.replace(/\b(?:\d[ -]*?){13,16}\b/g, "[REDACTED_CC]");
    }
    if (args.includes("HealthData")) {
      redacted = redacted.replace(/\b(diagnosis|patient|treatment)\b/gi, "[REDACTED_HEALTH]");
    }
    if (args.includes("APIKeys") || args.includes("Secrets") || args.includes("APIKey")) {
      redacted = redacted.replace(/AKIA[0-9A-Z]{16}/g, "[REDACTED_AWS_KEY]");
      redacted = redacted.replace(/Bearer\s+[a-zA-Z0-9\-_.]+/gi, "[REDACTED_BEARER_TOKEN]");
    }
    if (args.includes("Location")) {
      redacted = redacted.replace(/\b(New York|London|Paris|Tokyo|San Francisco|Seattle|Austin)\b/gi, "[REDACTED_LOCATION]");
    }
    return redacted;
  }
}

export class LogViolationPlugin implements PolicyPlugin {
  name = "LogViolation";
  phase: PolicyPhase = "output";
  apply(text: string): string {
    console.log(`[Policy] Violation logged`);
    return text;
  }
}

export class RequirePlugin implements PolicyPlugin {
  name = "Require";
  phase: PolicyPhase = "output"; // Validates LLM output format

  apply(text: string, args: string[], ctx: ExecutionContext): string {
    if (args.includes("JSON")) {
      try { JSON.parse(text); } catch (e) { throw new PolicyViolation("Require", "Require JSON failed: Output is not valid JSON"); }
    }
    if (args.includes("XML")) {
      if (!/\<\w+\>.*\<\/\w+\>/s.test(text)) throw new PolicyViolation("Require", "Require XML failed: Output is not valid XML");
    }
    if (args.includes("Citation")) {
      if (!/\[\w+\]/.test(text)) throw new PolicyViolation("Require", "Require Citation failed: Output missing citation marks like [1] or [doc_id]");
    }
    if (args.includes("Grounded")) {
      // Stub: in a real implementation this would check ctx.input 
      // against the output using NLP or NLI model.
    }
    if (args.includes("BrandVoice")) {
      const casualWords = ["gonna", "wanna", "dude", "bro"];
      if (casualWords.some(w => text.toLowerCase().includes(w))) {
        throw new PolicyViolation("Require", "Require BrandVoice failed: Output contains unauthorized casual language");
      }
    }
    return text;
  }
}

export class MatchRegexPlugin implements PolicyPlugin {
  name = "MatchRegex";
  phase: PolicyPhase = "output";
  apply(text: string, args: string[]): string {
    const pattern = args[0];
    if (pattern && !new RegExp(pattern).test(text)) {
      throw new PolicyViolation("MatchRegex", `MatchRegex failed: Output does not match pattern ${pattern}`);
    }
    return text;
  }
}

/**
 * Cross-reference validation policy.
 * Checks a field in the LLM output against a value from context.data.
 * 
 * DSL usage:
 *   policy PayoutLimit : Validate(payout_amount, "<=", context.data.verify_coverage.max_payout)
 * 
 * Args: [fieldName, operator, contextPath]
 */
export class ValidatePlugin implements PolicyPlugin {
  name = "Validate";
  phase: PolicyPhase = "output";

  apply(text: string, args: string[], ctx: ExecutionContext): string {
    if (args.length < 3) return text;

    const fieldName = args[0]!;
    const operator = args[1]!.replace(/^["']|["']$/g, "");
    const contextPath = args[2]!;

    // Parse the LLM output as JSON to extract the field
    let outputData: Record<string, unknown>;
    try {
      outputData = typeof text === "string" ? JSON.parse(text) : text as any;
    } catch {
      throw new PolicyViolation(
        "Validate",
        `Validate failed: Cannot parse LLM output as JSON to check field '${fieldName}'`
      );
    }

    // Extract field value from output
    const outputValue = outputData[fieldName];
    if (outputValue === undefined) {
      throw new PolicyViolation(
        "Validate",
        `Validate failed: Field '${fieldName}' not found in LLM output`
      );
    }

    // Resolve the reference value from context.data
    let refValue: unknown;
    if (contextPath.startsWith("context.data.")) {
      const path = contextPath.replace("context.data.", "");
      refValue = this.resolveNestedPath(ctx.data, path);
    } else if (contextPath.startsWith("context.input.")) {
      const path = contextPath.replace("context.input.", "");
      refValue = this.resolveNestedPath(ctx.input, path);
    } else {
      // Try as a literal number
      refValue = parseFloat(contextPath);
      if (isNaN(refValue as number)) refValue = contextPath;
    }

    if (refValue === undefined) {
      throw new PolicyViolation(
        "Validate",
        `Validate failed: Reference '${contextPath}' not found in context`
      );
    }

    // Compare
    const numOut = Number(outputValue);
    const numRef = Number(refValue);
    let passed = false;

    switch (operator) {
      case "<=": passed = numOut <= numRef; break;
      case ">=": passed = numOut >= numRef; break;
      case "<":  passed = numOut < numRef; break;
      case ">":  passed = numOut > numRef; break;
      case "==": passed = outputValue == refValue; break;
      case "!=": passed = outputValue != refValue; break;
      default:   passed = true; // Unknown operator, pass through
    }

    if (!passed) {
      throw new PolicyViolation(
        "Validate",
        `Validate failed: '${fieldName}' (${outputValue}) ${operator} '${contextPath}' (${refValue}) is false`
      );
    }

    return text;
  }

  private resolveNestedPath(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split(".");
    let current: unknown = obj;
    for (const part of parts) {
      if (current && typeof current === "object") {
        current = (current as Record<string, unknown>)[part];
      } else if (typeof current === "string") {
        try {
          const parsed = JSON.parse(current);
          current = parsed?.[part];
        } catch {
          return undefined;
        }
      } else {
        return undefined;
      }
    }
    return current;
  }
}

// MaxSpend requires access to the cost tracker, so we will handle it in the runtime 
// or pass a callback via a higher-order plugin. 
// For now, let's create a factory function that takes a cost tracker.
export function createMaxSpendPlugin(getTotalCost: () => number): PolicyPlugin {
  return {
    name: "MaxSpend",
    phase: "output" as PolicyPhase,
    apply(text: string, args: string[]): string {
      const maxSpend = parseFloat(args[0] ?? "0");
      const currentSpend = getTotalCost();
      if (currentSpend > maxSpend) {
        throw new PolicyViolation("MaxSpend", `Policy MaxSpend exceeded: $${currentSpend.toFixed(4)} > $${maxSpend.toFixed(2)}`);
      }
      return text;
    }
  };
}
