/**
 * Langly Error Hierarchy
 * 
 * Every error knows its domain. Consumers can catch by type:
 * 
 *   try { await runtime.execute(...) }
 *   catch (e) {
 *     if (e instanceof PolicyViolation) { ... }
 *     if (e instanceof SchemaValidationError) { ... }
 *   }
 */

// ── Base ─────

export class LanglyError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "LanglyError";
  }
}

// ── Parse / Resolution ─────

export class ParseError extends LanglyError {
  constructor(message: string) {
    super(message, "PARSE_ERROR");
    this.name = "ParseError";
  }
}

export class UndefinedVariableError extends LanglyError {
  constructor(public readonly variable: string) {
    super(`Undefined variable "${variable}"`, "UNDEFINED_VARIABLE");
    this.name = "UndefinedVariableError";
  }
}

// ── Entity Not Found ─────

export class PipelineNotFoundError extends LanglyError {
  constructor(public readonly streamName: string) {
    super(`Pipeline "${streamName}" not found`, "STREAM_NOT_FOUND");
    this.name = "PipelineNotFoundError";
  }
}

export class AgentNotFoundError extends LanglyError {
  constructor(public readonly agentName: string) {
    super(`Agent "${agentName}" not found`, "MIND_NOT_FOUND");
    this.name = "AgentNotFoundError";
  }
}

export class ToolNotFoundError extends LanglyError {
  constructor(public readonly toolName: string) {
    super(`Tool "${toolName}" not found`, "TOOL_NOT_FOUND");
    this.name = "ToolNotFoundError";
  }
}

export class AdapterNotFoundError extends LanglyError {
  constructor(public readonly modelId: string) {
    super(
      `No adapter found for model "${modelId}". Register an adapter with runtime.registerAdapter().`,
      "ADAPTER_NOT_FOUND"
    );
    this.name = "AdapterNotFoundError";
  }
}

// ── Guardrails ─────

export class PolicyViolation extends LanglyError {
  constructor(
    public readonly guardrailName: string,
    message: string,
  ) {
    super(message, "GUARDRAIL_VIOLATION");
    this.name = "PolicyViolation";
  }
}

// ── Schema ─────

export class SchemaValidationError extends LanglyError {
  constructor(
    public readonly structName: string,
    public readonly detail: string,
  ) {
    super(`Schema validation failed: ${detail}`, "SCHEMA_VALIDATION");
    this.name = "SchemaValidationError";
  }
}

// ── Runtime ─────

export class TimeoutError extends LanglyError {
  constructor(public readonly duration: string) {
    super(`Timeout after ${duration}`, "TIMEOUT");
    this.name = "TimeoutError";
  }
}

export class ApiKeyMissingError extends LanglyError {
  constructor() {
    super(
      "No API key set for LLM call. Set LANGLY_API_KEY or pass apiKey in RuntimeConfig.",
      "API_KEY_MISSING"
    );
    this.name = "ApiKeyMissingError";
  }
}

export class ToolExecutionError extends LanglyError {
  constructor(
    public readonly toolName: string,
    message: string,
  ) {
    super(message, "TOOL_EXECUTION_ERROR");
    this.name = "ToolExecutionError";
  }
}

export class ProviderNotFoundError extends LanglyError {
  constructor(public readonly provider: string) {
    super(`Unknown tool provider: ${provider}`, "PROVIDER_NOT_FOUND");
    this.name = "ProviderNotFoundError";
  }
}

export class SignalMismatchError extends LanglyError {
  constructor(public readonly expected: string, public readonly received: string) {
    super(`Expected signal '${expected}' but received '${received}'`, "SIGNAL_MISMATCH");
    this.name = "SignalMismatchError";
  }
}

export class LoopTargetError extends LanglyError {
  constructor(public readonly target: string) {
    super(`Loop target '${target}' not found in pipeline`, "LOOP_TARGET_NOT_FOUND");
    this.name = "LoopTargetError";
  }
}

export class MaxDepthExceededError extends LanglyError {
  constructor(depth: number) {
    super(`Pipeline execution exceeded maximum depth of ${depth}. Possible infinite loop detected.`, "MAX_DEPTH_EXCEEDED");
    this.name = "MaxDepthExceededError";
  }
}
