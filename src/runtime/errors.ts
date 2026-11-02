/**
 * Halo errors. Every error has a stable `code`, so callers can branch on it:
 *
 *   try { await runtime.execute(...) }
 *   catch (e) {
 *     if (e instanceof PolicyViolation) ...
 *     if (e instanceof HaloError && e.code === "SCHEMA_VALIDATION") ...
 *   }
 *
 * `retryable` tells @retry whether another attempt can help.
 */
export class HaloError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(message: string, options: { code?: string; retryable?: boolean; cause?: unknown } = {}) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "HaloError";
    this.code = options.code ?? "HALO_ERROR";
    this.retryable = options.retryable ?? false;
  }
}

/** A policy rejected content. Deterministic, so never retried (but `@correct` can ask the model to fix it). */
export class PolicyViolation extends HaloError {
  constructor(message: string, readonly policy: string, readonly rule: string) {
    super(message, { code: "POLICY_VIOLATION" });
    this.name = "PolicyViolation";
  }
}

/** A pipeline's output does not match the schema it declares with `-> Schema`. */
export class SchemaValidationError extends HaloError {
  constructor(readonly schema: string, readonly detail: string) {
    super(`Schema validation failed for "${schema}": ${detail}`, { code: "SCHEMA_VALIDATION" });
    this.name = "SchemaValidationError";
  }
}

export class TimeoutError extends HaloError {
  constructor(message: string) {
    super(message, { code: "TIMEOUT", retryable: true });
    this.name = "TimeoutError";
  }
}

export class HttpError extends HaloError {
  constructor(message: string, readonly status: number, readonly body: string) {
    super(message, { code: "HTTP_ERROR", retryable: status === 408 || status === 429 || status >= 500 });
    this.name = "HttpError";
  }
}

/** `|<> loop(...)` ran its maximum number of times and the condition still holds. */
export class LoopLimitError extends HaloError {
  constructor(message: string) {
    super(message, { code: "LOOP_LIMIT" });
    this.name = "LoopLimitError";
  }
}

/** `signal()` was called for a run that is not paused, or with the wrong event. */
export class SignalError extends HaloError {
  constructor(message: string, code: "RUN_NOT_FOUND" | "SIGNAL_MISMATCH") {
    super(message, { code });
    this.name = "SignalError";
  }
}

export function isRetryable(err: unknown): boolean {
  if (err instanceof HaloError) return err.retryable;
  // fetch() rejects with a TypeError on network failures (DNS, connection reset).
  return err instanceof TypeError && /fetch|network|connect|socket/i.test(err.message);
}
