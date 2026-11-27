// ── Language-level catalog of built-ins, shared by the validator and runtime ──

export const DIRECTIVES = ["timeout", "retry", "checkpoint", "shadow", "correct", "cascade", "thread", "expect", "private"] as const;

/** Types a schema field, parameter or return can name (besides declared schemas). `Result` is the usual unchecked return type, like `Any`. */
export const SCHEMA_TYPES = ["String", "Number", "Integer", "Boolean", "Array", "List", "Object", "Map", "JSON", "Any", "Result", "Image", "Document", "Audio", "Video"] as const;

/** The built-in types that hold a file, and the fields a pipeline can read from one. A program's own schema of the same name replaces the built-in. */
export const MEDIA_TYPE_NAMES = ["Image", "Document", "Audio", "Video"] as const;
export const MEDIA_FIELDS: Record<string, string> = { type: "String", size: "Integer", name: "String", sha256: "String", format: "String", width: "Integer", height: "Integer", pages: "Integer", duration: "Number", url: "String" };

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
  Image: "an image (PNG, JPEG, GIF or WebP): a model the value reaches is sent the image; read its type, size, name, width and height",
  Document: "a document (PDF, Word, PowerPoint, email, CSV, Markdown, HTML, JSON or text): a model the value reaches is sent it, or its text; read its type, format, size, name and pages",
  Audio: "an audio file (MP3, WAV, M4A, AAC, Ogg, FLAC, WebM): a model the value reaches is sent it, or its transcript; read its type, size, name and duration",
  Video: "a video (MP4, MOV, WebM, or a YouTube link): Gemini is sent it; other models get its transcript and frames; read its type, size, duration, width and height",
};

/** System methods with built-in behavior. */
export const SYSTEM_METHODS = ["Print", "Log", "Sleep", "Fail", "Pick", "Value"] as const;

/** Methods of the built-in `Thread`, which changes a `@thread` pipeline's thread state. */
export const THREAD_METHODS = ["set", "append", "clear"] as const;

/** System methods that emit an event to `onSystemEvent` (logged when no handler is set). */
export const SYSTEM_EVENTS = ["ResolveIncident", "Publish", "Distribute", "TriggerWebhook", "Notify"] as const;

export const TOOL_PROVIDERS = [
  "REST", "GET", "POST", "VectorStore", "PostgreSQL", "SQL", "Bash", "Browser", "File", "Slack", "Email", "Handoff", "GitHub", "Linear", "Figma",
  "MCP", "Chrome", "Vault", "Workspace", "KV", "SQLite", "Code", "Documents", "Clock", "Calc", "Data", "Git", "WebSearch", "Skills", "Remote", "Transcribe", "SMS",
] as const;

/** Content categories detectable by `Block(...)`. */
export const BLOCK_CATEGORIES = ["Profanity", "DestructiveOps", "PromptInjection", "PII", "SSN", "CreditCard", "Email", "Phone", "APIKey", "IPAddress", "Markdown"] as const;

/** Content categories removable by `Redact(...)`. */
export const REDACT_CATEGORIES = ["PII", "SSN", "CreditCard", "Email", "Phone", "APIKey", "IPAddress"] as const;

/** Policy rules on the tool calls an agent chooses. */
export const TOOL_RULES = ["AllowTools", "DenyTools", "AllowEffects", "ApproveTools", "ApproveEffects", "DenyArgs"] as const;

/** What a tool method can do (see ToolEffect). */
export const TOOL_EFFECTS = ["read", "write", "external", "wallet"] as const;

/** Policy rules the runtime enforces deterministically. */
export const ENFORCED_RULES = ["Block", "Redact", "MaxWords", "MaxChars", "MaxTokens", "MaxSpend", "LogViolation", "Enforce", "Require", "MatchRegex", "Validate", "AllowHosts", "AllowFiles", "AllowSecrets", "AllowMedia", "AllowWallet", "ApproveWallet", ...TOOL_RULES] as const;

/** What `AllowMedia(...)` can name: a kind, or one media type. */
export const MEDIA_NAMES = ["image", "document", "audio", "video", "pdf", "png", "jpeg", "gif", "webp", "mpeg", "mp3", "wav", "mp4", "webm", "ogg", "flac", "aac", "quicktime", "mov"] as const;

/**
 * A host for AllowHosts or a sandbox's hosts: ("pypi.org", or "*.pythonhosted.org" for it and its
 * subdomains). A name, not an address: no IP literals (the last label starts with a letter), and
 * not localhost.
 */
export const HOST_PATTERN = /^(?!(.*\.)?localhost$)(\*\.)?([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)*[a-z]([a-z0-9-]*[a-z0-9])?$/i;

/** A secret's name for AllowSecrets or a sandbox's secrets: (an environment variable name). */
export const SECRET_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Names that can't be secrets: setting them changes how the sandbox's shell, its proxy, or Docker itself runs. */
export const RESERVED_SECRET = /^(PATH|HOME|USER|SHELL|PWD|IFS|ENV|BASH_ENV|TMPDIR|LD_\w*|DYLD_\w*|DOCKER_\w*|HALO_\w*|(HTTPS?|ALL|NO|FTP)_PROXY)$/i;

/**
 * A folder or file for AllowFiles or a sandbox's files:, relative to the project it's copied from:
 * normalized ("src/billing"), or undefined when it isn't one (absolute, "..", empty, a NUL).
 * "." means the whole project.
 */
export function scopePath(path: string): string | undefined {
  if (!path || path.includes("\0") || path.includes("\\") || path.startsWith("/")) return undefined;
  const parts = path.split("/").filter((p) => p && p !== ".");
  if (parts.some((p) => p === "..")) return undefined;
  return parts.length ? parts.join("/") : ".";
}

/** Whether `path` (relative, with forward slashes) is one of `files` or inside one of them. */
export function inFiles(path: string, files: string[]): boolean {
  return files.some((f) => f === "." || path === f || path.startsWith(f + "/"));
}

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
