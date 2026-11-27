/**
 * Masking secret values in text: what a tool sends back, what an error says.
 *
 * A secret is a name and a value. A value is found ignoring case (a host name comes back
 * lowercased), longest first (so one secret that starts another can't leave its tail), and
 * replaced with `[secret NAME]`. This catches accidents (a service that echoes the key it was
 * sent), not a determined program. No node:* imports: the playground bundles this.
 */

/** A secret value shorter than this is left alone by mask() (it would match everywhere). */
export const SECRET_MIN = 4;

const ESCAPE = /[.*+?^${}()|[\]\\]/g;

const maskers = new WeakMap<Map<string, string>, ((text: string) => string) | null>();

function build(secrets: Map<string, string>, min: number): ((text: string) => string) | null {
  const byValue = new Map<string, string>();
  for (const [name, value] of secrets) {
    const v = value.trim().toLowerCase();
    if (v.length >= min && !byValue.has(v)) byValue.set(v, name);
  }
  if (!byValue.size) return null;
  const values = [...byValue.keys()].sort((a, b) => b.length - a.length);
  const re = new RegExp(values.map((v) => v.replace(ESCAPE, "\\$&")).join("|"), "gi");
  return (t: string) => t.replace(re, (hit) => `[secret ${byValue.get(hit.toLowerCase())}]`);
}

/** `text` with the value of every secret (name -> value) of 4 or more characters masked. */
export function mask(text: string, secrets: Map<string, string> | undefined): string {
  if (!secrets || !text) return text;
  let m = maskers.get(secrets);
  if (m === undefined) maskers.set(secrets, (m = build(secrets, SECRET_MIN)));
  return m ? m(text) : text;
}

/** mask() over every string in a value: keys too, inside plain objects and arrays. */
export function maskDeep<T>(value: T, secrets: Map<string, string> | undefined): T {
  if (!secrets || !secrets.size) return value;
  if (typeof value === "string") return mask(value, secrets) as T;
  if (Array.isArray(value)) return value.map((v) => maskDeep(v, secrets)) as T;
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [mask(k, secrets), maskDeep(v, secrets)])) as T;
  }
  return value;
}

/** An error's message (and stack, and an HttpError's body) masked in place. */
export function maskError<E>(e: E, secrets: Map<string, string> | undefined): E {
  if (!secrets || !secrets.size || !(e instanceof Error)) return e;
  e.message = mask(e.message, secrets);
  if (e.stack) e.stack = mask(e.stack, secrets);
  const body = (e as { body?: unknown }).body;
  if (typeof body === "string") Object.defineProperty(e, "body", { value: mask(body, secrets), enumerable: true, configurable: true, writable: false });
  return e;
}

/** At least this long for a value the runtime read from the environment to be masked. */
export const ENV_SECRET_MIN = 8;

/** A variable whose name says it holds a secret. */
const SECRET_WORD = /KEY|TOKEN|SECRET|PASS|PWD|AUTH|CRED|PRIVATE|SIGN|SALT|DSN|WEBHOOK|COOKIE|SESSION/i;

/**
 * Whether a value read from the environment is worth masking. Short values, numbers, booleans
 * and plain URLs (no user:password, no query) would mask ordinary text everywhere, so they're
 * left alone unless the variable's name says it's a secret (and then only if 8+ characters).
 */
export function envSecretWorthMasking(name: string, value: string): boolean {
  const v = value.trim();
  if (v.length < ENV_SECRET_MIN) return false;
  if (SECRET_WORD.test(name)) return true;
  if (/^(true|false|yes|no|on|off|null|none|undefined|production|development|staging|test)$/i.test(v)) return false;
  if (/^[-+]?\d+(\.\d+)?$/.test(v)) return false;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(v)) {
    try {
      const u = new URL(v);
      return !!(u.username || u.password || u.search);
    } catch {
      return true;
    }
  }
  // A file path or a host name is configuration, not a secret.
  if (/^[./~]/.test(v) || /^([a-z0-9-]{1,63}\.)+[a-z]{2,24}$/i.test(v)) return false;
  // Nor is a lowercase word or name made of words and short numbers: "localhost", "us-east-1".
  if (/^[a-z]+([-_]([a-z]+|\d{1,4}))*$/.test(v)) return false;
  return true;
}

/**
 * The secrets a runtime read from its environment (Env.NAME, provider keys, Vault sources), by
 * name. Only names and values in memory: never logged. Masking is by mask(), and the map is
 * replaced (not changed) when a secret is added, so mask()'s cache stays right.
 */
export class SecretRegistry {
  private map = new Map<string, string>();

  /** Remember `value` under `name` if it's worth masking. */
  add(name: string, value: unknown): void {
    if (typeof value !== "string" || !envSecretWorthMasking(name, value)) return;
    if (this.map.get(name) === value) return;
    const next = new Map(this.map);
    next.set(name, value);
    this.map = next;
  }

  get secrets(): Map<string, string> | undefined {
    return this.map.size ? this.map : undefined;
  }

  mask(text: string): string {
    return mask(text, this.secrets);
  }

  maskDeep<T>(value: T): T {
    return maskDeep(value, this.secrets);
  }

  maskError<E>(e: E): E {
    return maskError(e, this.secrets);
  }
}
