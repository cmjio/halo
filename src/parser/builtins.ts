// ── Language-level catalog of built-ins, shared by the validator and runtime ──

export const DIRECTIVES = ["timeout", "retry", "checkpoint", "shadow", "correct", "thread", "expect"] as const;

/** Types a schema field, parameter or return can name (besides declared schemas). `Result` is the usual unchecked return type, like `Any`. */
export const SCHEMA_TYPES = ["String", "Number", "Integer", "Boolean", "Array", "List", "Object", "Map", "JSON", "Any", "Result"] as const;

/** What each built-in type accepts, for editors (hover, completions). */
export const TYPE_DESCRIPTIONS: Record<(typeof SCHEMA_TYPES)[number], string> = {
  String: "a string",
  Number: "a finite number",
  Integer: "a whole number",
  Boolean: "true or false",
  Array: "a list; Array<T> checks every item against T",
  List: "a list (same as Array); List<T> checks every item against T",
  Object: "an object",
  Map: "an object (same as Object)",
  JSON: "an object (same as Object)",
  Any: "anything (not checked)",
  Result: "anything (not checked); the usual return type of a pipeline whose output isn't checked",
};

/** System methods with built-in behavior. */
export const SYSTEM_METHODS = ["Print", "Log", "Sleep", "Fail", "Pick", "Value"] as const;

/** Methods of the built-in `Thread`, which changes a `@thread` pipeline's thread state. */
export const THREAD_METHODS = ["set", "append", "clear"] as const;

/** System methods that emit an event to `onSystemEvent` (logged when no handler is set). */
export const SYSTEM_EVENTS = ["ResolveIncident", "Publish", "Distribute", "TriggerWebhook", "Notify"] as const;

export const TOOL_PROVIDERS = [
  "REST", "GET", "POST", "VectorStore", "PostgreSQL", "SQL", "Bash", "Browser", "File", "Slack", "Email", "GitHub", "Linear", "Figma",
  "MCP", "Chrome", "Workspace", "KV", "SQLite", "Code", "Documents", "Clock", "Calc", "Data", "Git", "WebSearch", "Skills", "Remote",
] as const;

/** Content categories detectable by `Block(...)`. */
export const BLOCK_CATEGORIES = ["Profanity", "DestructiveOps", "PromptInjection", "PII", "SSN", "CreditCard", "Email", "Phone", "APIKey", "Markdown"] as const;

/** Content categories removable by `Redact(...)`. */
export const REDACT_CATEGORIES = ["PII", "SSN", "CreditCard", "Email", "Phone", "APIKey", "IPAddress"] as const;

/** Policy rules on the tool calls an agent chooses. */
export const TOOL_RULES = ["AllowTools", "DenyTools", "AllowEffects", "ApproveTools", "ApproveEffects", "DenyArgs"] as const;

/** What a tool method can do (see ToolEffect). */
export const TOOL_EFFECTS = ["read", "write", "external"] as const;

/** Policy rules the runtime enforces deterministically. */
export const ENFORCED_RULES = ["Block", "Redact", "MaxWords", "MaxChars", "MaxTokens", "MaxSpend", "LogViolation", "Enforce", "Require", "MatchRegex", "Validate", ...TOOL_RULES] as const;

/** What `Require(...)` can check. Anything else (e.g. Require(Approver)) needs a judge and is not enforced. */
export const REQUIRE_CHECKS = ["JSON", "XML", "Citation"] as const;

/** Policy rules that are recognized but need an AI judge, so they are not enforced yet. */
export const UNENFORCED_RULES = ["Tone", "Anonymize", "MaxDensity"] as const;

/** Top-level namespaces of `context`. */
export const CONTEXT_NAMESPACES = ["data", "input", "meta", "trace", "current", "thread"] as const;

export function includes<T extends string>(list: readonly T[], value: string): value is T {
  return (list as readonly string[]).includes(value);
}

/** Parse a duration like "500ms", "30s", "5m", "1h", "2d" into milliseconds (NaN if invalid). */
export function parseDuration(d: string): number {
  const m = d.trim().match(/^(\d+)(ms|s|m|h|d)$/);
  if (!m) return NaN;
  const unit = { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[m[2] as "ms" | "s" | "m" | "h" | "d"];
  return Number(m[1]) * unit;
}
