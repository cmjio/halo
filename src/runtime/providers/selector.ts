/**
 * CSS selectors an armed browser session accepts.
 *
 * After a wallet value is typed, a selector must not be able to ask anything about it. Many pages
 * mirror what is typed into the element's attributes (React's controlled inputs set `value`), so
 * `input[value^="42"]` would answer "is the first digit 4?" one probe at a time. An armed session
 * therefore takes only selectors built from attributes a page sets for its own layout, and
 * pseudo-classes that don't depend on what a field holds.
 *
 * The selector is parsed here (escapes resolved, so `[v\61lue]` is `value`), checked, and written
 * out again in a canonical form. The browser is given that canonical text, never the original,
 * so what Chrome parses is exactly what was checked.
 */

/** Attributes a selector may test in an armed session. */
export const SAFE_ATTRIBUTES = new Set(["id", "name", "type", "autocomplete", "role", "for", "placeholder", "aria-label", "aria-labelledby", "data-testid", "href", "title"]);

/**
 * Attributes a page might copy a typed value into on other elements (title, to show an overflowing
 * value), allowed only on the elements they're needed for: a frame's title (payment frames often
 * have no id), a link's href.
 */
const SCOPED: Record<string, string[]> = { title: ["iframe", "frame"], href: ["a", "area"] };

/** Pseudo-classes that don't depend on a field's contents. `:not`, `:is` and `:where` take selectors checked by the same rules. */
const STRUCTURAL = new Set(["first-child", "last-child", "only-child", "first-of-type", "last-of-type", "only-of-type", "root"]);
const NTH = new Set(["nth-child", "nth-last-child", "nth-of-type", "nth-last-of-type"]);
const NESTED = new Set(["not", "is", "where"]);

export type SelectorCheck = { ok: true; canonical: string } | { ok: false; reason: string };

class Refused extends Error {}

const refuse = (reason: string): never => {
  throw new Refused(reason);
};

/** Characters CSS treats as whitespace. */
const isWs = (c: string | undefined) => c === " " || c === "\t" || c === "\n" || c === "\r" || c === "\f";
const isNameStart = (c: string) => /[A-Za-z_]/.test(c) || c.charCodeAt(0) >= 0x80;
const isName = (c: string) => /[A-Za-z0-9_-]/.test(c) || c.charCodeAt(0) >= 0x80;

class Parser {
  i = 0;
  /** The element name of the compound being parsed ("" when it has none). */
  type = "";
  constructor(readonly s: string) {}

  peek(n = 0): string | undefined {
    return this.s[this.i + n];
  }

  ws(): boolean {
    const start = this.i;
    while (isWs(this.peek())) this.i++;
    return this.i > start;
  }

  /** One escape after a backslash: up to 6 hex digits (and one whitespace), or any other character. */
  escape(): string {
    this.i++; // the backslash
    const c = this.peek();
    if (c === undefined) refuse("a selector can't end with a backslash");
    if (c === "\n" || c === "\r" || c === "\f") refuse("a backslash before a line break isn't allowed in a selector");
    let hex = "";
    while (hex.length < 6 && /[0-9a-fA-F]/.test(this.peek() ?? "")) hex += this.s[this.i++];
    if (hex) {
      if (isWs(this.peek())) this.i++;
      const cp = parseInt(hex, 16);
      return cp === 0 || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff) ? "�" : String.fromCodePoint(cp);
    }
    this.i++;
    return c!;
  }

  /** An identifier, escapes resolved. */
  ident(what: string): string {
    let out = "";
    const start = this.i;
    for (;;) {
      const c = this.peek();
      if (c === "\\") out += this.escape();
      else if (c !== undefined && isName(c)) out += this.s[this.i++];
      else break;
    }
    const first = out[0];
    const ok = out.length > 0 && (isNameStart(first!) || (first === "-" && (out.length > 1 && (isNameStart(out[1]!) || out[1] === "-"))) || this.s[start] === "\\");
    if (!ok) refuse(`expected ${what} at position ${start + 1}`);
    return out;
  }

  string(): string {
    const q = this.s[this.i++]!;
    let out = "";
    for (;;) {
      const c = this.peek();
      if (c === undefined) refuse("a quoted string in the selector isn't closed");
      if (c === q) {
        this.i++;
        return out;
      }
      if (c === "\n" || c === "\r" || c === "\f") refuse("a quoted string in the selector can't hold a line break");
      if (c === "\\") {
        if (this.peek(1) === "\n") {
          this.i += 2;
          continue;
        }
        out += this.escape();
      } else out += this.s[this.i++];
    }
  }

  expect(c: string) {
    if (this.peek() !== c) refuse(`expected "${c}" at position ${this.i + 1}`);
    this.i++;
  }

  // selector-list = complex ("," complex)*
  list(nested: boolean): string {
    const parts: string[] = [];
    for (;;) {
      this.ws();
      parts.push(this.complex(nested));
      this.ws();
      if (this.peek() === ",") {
        this.i++;
        continue;
      }
      break;
    }
    return parts.join(", ");
  }

  complex(nested: boolean): string {
    let out = this.compound();
    for (;;) {
      const hadWs = this.ws();
      const c = this.peek();
      if (c === undefined || c === "," || (nested && c === ")")) return out;
      if (c === ">" || c === "+" || c === "~") {
        this.i++;
        this.ws();
        out += ` ${c} ${this.compound()}`;
      } else if (hadWs) {
        out += ` ${this.compound()}`;
      } else {
        refuse(`unexpected "${c}" at position ${this.i + 1}`);
      }
    }
  }

  compound(): string {
    const outer = this.type;
    try {
      return this.compoundInner();
    } finally {
      this.type = outer;
    }
  }

  compoundInner(): string {
    let out = "";
    let any = false;
    this.type = "";
    const c0 = this.peek();
    if (c0 === "*") {
      this.i++;
      out += "*";
      any = true;
    } else if (c0 !== undefined && (isNameStart(c0) || c0 === "\\" || c0 === "-")) {
      this.type = this.ident("an element name").toLowerCase();
      out += serializeIdent(this.type);
      any = true;
    }
    if (this.peek() === "|") refuse("namespaced selectors (ns|name) aren't allowed");
    for (;;) {
      const c = this.peek();
      if (c === "#") {
        this.i++;
        out += `#${serializeIdent(this.ident("an id"))}`;
      } else if (c === ".") {
        // Pages derive classes from what's typed (a card brand, a digit per element), and a class test is one guess at a time.
        refuse(`.class selectors can't be used after a wallet value is typed: a page can derive classes from what's typed. Use #id, [name="..."], [type="..."], [aria-label="..."], an element name, or :nth-child()`);
      } else if (c === "[") {
        out += this.attribute();
      } else if (c === ":") {
        out += this.pseudo();
      } else break;
      any = true;
    }
    if (!any) refuse(this.peek() === undefined ? "the selector is empty" : `unexpected "${this.peek()}" at position ${this.i + 1}`);
    return out;
  }

  attribute(): string {
    this.expect("[");
    this.ws();
    if (this.peek() === "|" || this.peek() === "*") refuse("namespaced attribute selectors aren't allowed");
    const name = this.ident("an attribute name").toLowerCase();
    if (this.peek() === "|" && this.peek(1) !== "=") refuse("namespaced attribute selectors aren't allowed");
    this.ws();
    if (!SAFE_ATTRIBUTES.has(name)) {
      refuse(`[${name}] can't be used after a wallet value is typed: a page can copy what's typed into its attributes. Use ${[...SAFE_ATTRIBUTES].map((a) => `[${a}]`).join(", ")}, or #id, .class and element names`);
    }
    const scope = SCOPED[name];
    if (scope && !scope.includes(this.type)) {
      refuse(`[${name}] can be used only on ${scope.map((t) => `<${t}>`).join(" or ")} after a wallet value is typed (write ${scope[0]}[${name}=...]): a page can copy what's typed into it`);
    }
    if (this.peek() === "]") {
      this.i++;
      return `[${name}]`;
    }
    let op = "";
    const c = this.peek();
    if (c === "=") op = "=";
    else if ((c === "~" || c === "|" || c === "^" || c === "$" || c === "*") && this.peek(1) === "=") op = `${c}=`;
    else refuse(`expected "]" or an operator like = in [${name}...]`);
    // Only whole-value tests: a prefix or substring test (^= *= $= ~= |=) answers a guess one character at a time.
    if (op !== "=") refuse(`[${name}${op}...] can't be used after a wallet value is typed: only an exact [${name}="..."] can, since a partial match answers a guess a character at a time`);
    this.i += op.length;
    this.ws();
    const q = this.peek();
    const value = q === '"' || q === "'" ? this.string() : this.ident("a value");
    this.ws();
    let flag = "";
    const f = this.peek();
    if (f !== undefined && /[iIsS]/.test(f) && (isWs(this.peek(1)) || this.peek(1) === "]")) {
      flag = ` ${f.toLowerCase()}`;
      this.i++;
      this.ws();
    }
    this.expect("]");
    return `[${name}${op}${serializeString(value)}${flag}]`;
  }

  pseudo(): string {
    this.expect(":");
    if (this.peek() === ":") refuse("pseudo-elements (::before, ::part) can't be used to find an element");
    const name = this.ident("a pseudo-class").toLowerCase();
    if (STRUCTURAL.has(name)) {
      if (this.peek() === "(") refuse(`:${name} takes no arguments`);
      return `:${name}`;
    }
    if (NTH.has(name)) {
      this.expect("(");
      this.ws();
      const start = this.i;
      while (this.peek() !== undefined && this.peek() !== ")") this.i++;
      const arg = this.s.slice(start, this.i).trim().toLowerCase().replace(/\s+/g, " ");
      if (!/^(odd|even|[+-]?\d+|[+-]?\d*n(\s*[+-]\s*\d+)?)$/.test(arg)) refuse(`:${name}(${arg}) takes an+b, odd or even (no "of" selector)`);
      this.expect(")");
      return `:${name}(${arg.replace(/\s/g, "")})`;
    }
    if (NESTED.has(name)) {
      this.expect("(");
      const inner = this.list(true);
      this.ws();
      this.expect(")");
      return `:${name}(${inner})`;
    }
    return refuse(
      `:${name} can't be used after a wallet value is typed${name === "has" ? "" : ": it can depend on what a field holds"}. Use :first-child, :last-child, :nth-child(...), :nth-of-type(...), :not(...), :is(...) or :where(...)`,
    );
  }
}

/** Write an identifier so the browser reads exactly it back (CSSOM's CSS.escape). */
export function serializeIdent(s: string): string {
  let out = "";
  const chars = [...s];
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i]!;
    const code = c.codePointAt(0)!;
    const digit = code >= 0x30 && code <= 0x39;
    if (code === 0) out += "�";
    else if ((code >= 1 && code <= 0x1f) || code === 0x7f || (i === 0 && digit) || (i === 1 && digit && chars[0] === "-")) out += `\\${code.toString(16)} `;
    else if (i === 0 && c === "-" && chars.length === 1) out += "\\-";
    else if (code >= 0x80 || c === "-" || c === "_" || digit || /[A-Za-z]/.test(c)) out += c;
    else out += `\\${c}`;
  }
  return out;
}

/** Write a string as a double-quoted CSS string. */
export function serializeString(s: string): string {
  let out = '"';
  for (const c of s) {
    const code = c.charCodeAt(0);
    if (c === '"' || c === "\\") out += `\\${c}`;
    else if (code < 0x20 || code === 0x7f) out += `\\${code.toString(16)} `;
    else out += c;
  }
  return `${out}"`;
}

/**
 * Check a selector for an armed session, and give the canonical text to send to the browser.
 * Anything the parser doesn't fully understand is refused, rather than guessed at.
 */
export function checkArmedSelector(selector: string): SelectorCheck {
  if (typeof selector !== "string" || !selector.trim()) return { ok: false, reason: "the selector is empty" };
  if (selector.length > 1000) return { ok: false, reason: "the selector is longer than 1000 characters" };
  if (/\/\*/.test(selector.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, ""))) return { ok: false, reason: "comments aren't allowed in a selector" };
  if (selector.includes("\0")) return { ok: false, reason: "a selector can't hold a NUL character" };
  try {
    const p = new Parser(selector);
    const canonical = p.list(false);
    p.ws();
    if (p.i !== selector.length) refuse(`unexpected "${selector[p.i]}" at position ${p.i + 1}`);
    return { ok: true, canonical };
  } catch (e) {
    if (e instanceof Refused) return { ok: false, reason: e.message };
    throw e;
  }
}
