/**
 * Red team: the two pure components behind an armed browser session, fuzzed, then confirmed in Chrome.
 *
 *   1. checkArmedSelector (src/runtime/providers/selector.ts): an accepted selector's canonical form,
 *      run by Chrome, must never be able to tell two typed values apart.
 *   2. The redaction pass (REDACT in chrome.ts) and TypedValues.mask (wallet.ts): no echo of a typed
 *      value (8+ consecutive digits of a card, a whole name/email/phone) may survive both.
 *
 * Every test asserts the SECURE outcome, so a failing test is a confirmed attack.
 */
import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { HaloError } from "../src/runtime/errors.js";
import { chromeProvider, closeChromeSessions, findChrome } from "../src/runtime/providers/chrome.js";
import { checkArmedSelector } from "../src/runtime/providers/selector.js";
import type { ToolApprovalRequest, ToolCall, ToolServices, WalletEvent } from "../src/runtime/tools.js";
import { captureWalletEnv, resetWalletEnv, TypedValues, walletItem } from "../src/runtime/wallet.js";

const CARD = "4000056655665556"; // Stripe test Visa debit: not a palindrome, so a reversed echo is distinct
const NAME = "Ada Lovelace";
const EMAIL = "ada.l+pay@example.com";
const PHONE = "+447700900123";

/** Arabic-Indic and full-width digits folded to ASCII, then only digits kept. */
const digitsOf = (s: string) =>
  s
    .normalize("NFKC")
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0))
    .replace(/\D/g, "");

/** 8 or more consecutive digits of the card (forwards or backwards) anywhere in the text's digits. */
function cardLeak(out: string, card = CARD): string | undefined {
  let decoded = out;
  try {
    decoded = decodeURIComponent(out.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&"));
  } catch {}
  const d = digitsOf(decoded);
  const rev = [...d].reverse().join("");
  for (let i = 0; i + 8 <= card.length; i++) {
    const piece = card.slice(i, i + 8);
    if (d.includes(piece) || rev.includes(piece)) return piece;
  }
  return undefined;
}

const typedWith = (pairs: Record<string, string>) => {
  const t = new TypedValues();
  for (const [k, v] of Object.entries(pairs)) t.add(k, v);
  return t;
};

/** What the in-page pass does to plain text (same patterns, flags "gi"), then mask: both layers. */
function bothLayers(t: TypedValues, text: string): string {
  let s = text;
  s = t.mask(s); // (stands in for the page's redaction pass, which uses the same matchers)
  return t.mask(s);
}

// ───────────────────────── 1. Selector checker: pure fuzz ─────────────────────────

const rnd = (() => {
  let x = 0x9e3779b9;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 0x100000000;
  };
})();
const pick = <T>(a: readonly T[]): T => a[Math.floor(rnd() * a.length)]!;

const TYPES = ["input", "INPUT", "div", "iframe", "IFRAME", "a", "*", "\\69nput", "i\\6e put", "\\69 frame", "in\\put", "\\000069nput", "textarea", "select", "option", "p", "span", "form", "body", "html"];
const ATTR_NAMES = [
  "value", "VALUE", "v\\61lue", "v\\61 lue", "\\76 alue", "valu\\65", "v\\000061lue", "va\\lue", "data-value", "checked", "title", "href", "class", "id", "name", "type",
  "placeholder", "aria-label", "data-testid", "autocomplete", "role", "for", "aria-labelledby", "lang", "dir", "style", "pattern", "selected", "xlink|href", "*|value", "|value",
  "valuе", "value ", "val\\\nue", "\\value",
];
const OPS = ["", "=", "^=", "$=", "*=", "~=", "|="];
const VALS = ['"4"', "'4'", "4", "x", '"x" i', '"x" s', "x i", '"4"i', "\\34", '"\\34"', '"a\\\nb"', '""', "-", "--x", '"]"', '"\\"]"'];
const PSEUDOS = [
  ":first-child", ":last-child", ":only-child", ":first-of-type", ":root", ":nth-child(2n+1)", ":nth-child(1)", ":nth-of-type(odd)", ":nth-last-child(-n+3)",
  ":nth-child(n of [value])", ":nth-child(1 of :checked)", ":nth-child( 1)", ":nth-child( 1)", ":nth-child(n of [value])", ":checked", ":invalid", ":valid",
  ":placeholder-shown", ":user-invalid", ":autofill", ":-webkit-autofill", ":-internal-autofill-selected", ":empty", ":read-write", ":read-only", ":defined", ":lang(en)",
  ":dir(ltr)", ":scope", ":host", ":host(*)", "::slotted(*)", ":focus", ":focus-within", ":hover", ":indeterminate", ":default", ":required", ":in-range", ":out-of-range",
  ":blank", ":has(*)", ":HAS(*)", ":h\\61s(*)", ":\\68 as(*)", ":NOT(*)", ":n\\6ft([value])", ":not([value])", ":is([value])", ":where(:checked)", ":-webkit-any([value])",
  ":matches([value])", ":any-link", ":link", ":target", ":state(x)", ":popover-open", ":open", ":modal", ":picture-in-picture", ":fullscreen", ":-internal-shadow-host-has-appearance",
];
const COMBS = [" ", ">", " > ", "+", "~", " ~ ", "||", ",", ", ", "\t", " ", " ", "\f", "\r\n", "\r", "\n", "", "&", " & "];
const JUNK = [")", "(", "\\", '"', "'", "/*", "*/", "&", "|", "\0", "\\0", "\\\n", "\\\r\n", "\\d800", "\\ffffff", "\\110000", "]", "[", ":", "::", "#", ".", "%", "@", ";", "{", "}", "!", "\\a", "﻿", "​"];

function genAttr(): string {
  const n = pick(ATTR_NAMES);
  const op = pick(OPS);
  const ws = rnd() < 0.2 ? " " : "";
  return op ? `[${ws}${n}${ws}${op}${ws}${pick(VALS)}${ws}]` : `[${ws}${n}${ws}]`;
}
function genCompound(depth: number): string {
  let s = rnd() < 0.6 ? pick(TYPES) : "";
  const k = 1 + Math.floor(rnd() * 3);
  for (let i = 0; i < k; i++) {
    const r = rnd();
    if (r < 0.15) s += pick(["#card", "#\\31 23", "#c\\61rd", ".x", ".\\78", ".pay"]);
    else if (r < 0.5) s += genAttr();
    else if (r < 0.75) s += pick(PSEUDOS);
    else if (depth < 3) s += `${pick([":not", ":is", ":where", ":NOT", ":\\69s", ":Is"])}(${genList(depth + 1)})`;
    else s += pick(PSEUDOS);
  }
  return s || "*";
}
function genComplex(depth: number): string {
  let s = genCompound(depth);
  const k = Math.floor(rnd() * 3);
  for (let i = 0; i < k; i++) s += pick(COMBS) + genCompound(depth);
  return s;
}
function genList(depth: number): string {
  const k = 1 + Math.floor(rnd() * 2);
  return Array.from({ length: k }, () => genComplex(depth)).join(pick([",", ", ", " ,", " ,"]));
}
function mutate(s: string): string {
  const k = 1 + Math.floor(rnd() * 2);
  for (let i = 0; i < k; i++) {
    const at = Math.floor(rnd() * (s.length + 1));
    const r = rnd();
    if (r < 0.6) s = s.slice(0, at) + pick(JUNK) + s.slice(at);
    else if (r < 0.8) s = s.slice(0, at) + s.slice(at + 1);
    else s = s.slice(0, at) + s.slice(at).toUpperCase();
  }
  return s;
}

/** Hand-written candidates, each a known trick. */
const HANDMADE = [
  'input[value^="4"]', 'input[v\\61lue^="4"]', "input[v\\61 lue]", "input[\\76 alue]", "input[\\000076alue]", "input[va\\lue]", 'input[valu\\65 ^="4"]', "input[value i]",
  'input[VALUE="4" i]', '[value="4"s]', "input[ value ]", "input[value ]", "input[val\\\nue]", "input[val\\\r\nue]", "*|input[value]", "input[*|value]", "input[|value]",
  "input[xlink|href]", "input[ns|value]", 'input:nth-child(n of [value^="4"])', "input:nth-child(1 of [value])", "input:nth-child(1 of :checked)",
  "input:nth-child( 2n + 1 of :checked)", "input:not(:not([value]))", ":is(:where(:not([value])))", ":is(:is(:is(:is(:is(:is(:is(:is([value]))))))))",
  ":is(" + "*,".repeat(200) + "*)", ":not(" .repeat(120) + "*" + ")".repeat(120), "input:has(+ x)", "div:has(input)", "input:HAS(x)", "input:h\\61s(x)", "input:\\68 as(x)",
  "input:-webkit-autofill", "input:-internal-autofill-selected", "input:autofill", "input:defined", "input:lang(en)", "input:dir(ltr)", ":scope > input", ":host", "::slotted(input)",
  "& input", "input &", "input:is(&)", "a,b", "a,,b", "a ,b", "input||td", "input /* c */", 'input[title="/*"]', '[title="*/"]', "input\\", "input\\\n", "#\\0", "#\\d800",
  "#\\110000", "#\\ffffff", ".a\\31\r\n.b", "#a\\ \\5b value\\5d", "#a\\[value\\]", "#\\23 a", "x:not([class=a],[value])", "iframe[title^='4']", "IFRAME[TITLE^='4']",
  "\\69 frame[title^='4']", "ifr\\61me[title^='4']", "iframe:is([title^='4'])", "iframe :is([title^='4'])", "iframe[title^='4'] > input", "input[title^='4']",
  "a[href^='4']", "A[HREF^='4']", "area[href]", "div[href]", "link[href]", "input:checked", "input:read-write", "input:empty", "input:placeholder-shown", "input:user-invalid",
  "input:invalid", "input:valid", "input:blank", "input:in-range", "input:-webkit-any([value])", "input:matches([value])", "input:state(x)", "input:nth-child(1):checked",
  "input:nth-child(even of [value])", "input:nth-last-child(n of [value])", "input:nth-of-type(n of [value])", "input:nth-child(n)of [value]", "input:nth-child(1)[value]",
  "input:nth-child(1\\29 [value])", "input:nth-child(1) [value]", "[class~=\"x\"] [value]", "[class=\"\\\"][value=\\\"\"]", "[id='\\'][value]']", "[id=\"\\\n\"][value]",
  "[class=a\\]][value]", "[class|=\"a\"]", "[class|=a]", "[class|value]", "[class=x I]", "[class=x S]", "[class=xi]", "[class=x\ti]", "[class=x\ni]", "[class='x'i]",
  "﻿input[value]", "input​[value]", "input:​checked", " input", "input [value]", "input [value]",
];

function idempotent(canonical: string): boolean {
  const again = checkArmedSelector(canonical);
  return again.ok && again.canonical === canonical;
}

const ACCEPTED: string[] = [];
const accept = (s: string) => {
  const r = checkArmedSelector(s);
  if (r.ok) ACCEPTED.push(r.canonical);
  return r;
};

describe("selector checker (pure)", () => {
  test("S1. fuzz: every accepted selector's canonical form is a fixed point and names no unsafe attribute or pseudo-class", () => {
    const bad: string[] = [];
    const cands = [...HANDMADE];
    for (let i = 0; i < 40_000; i++) cands.push(rnd() < 0.5 ? genList(0) : mutate(genList(0)));
    for (const s of cands) {
      let r;
      try {
        r = accept(s);
      } catch (e) {
        bad.push(`threw on ${JSON.stringify(s)}: ${e}`);
        continue;
      }
      if (!r.ok) continue;
      if (!idempotent(r.canonical)) bad.push(`not a fixed point: ${JSON.stringify(s)} -> ${JSON.stringify(r.canonical)}`);
      // A canonical form is built only from safe pieces; check its words anyway.
      if (/\[(?!(id|name|type|autocomplete|role|for|placeholder|aria-label|aria-labelledby|data-testid|class|href|title)[\]=~|^$*\s])/i.test(r.canonical.replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/\\./g, ""))) bad.push(`unsafe attribute in ${JSON.stringify(r.canonical)}`);
      if (/:(?!(first-child|last-child|only-child|first-of-type|last-of-type|only-of-type|root|nth-child|nth-last-child|nth-of-type|nth-last-of-type|not|is|where)\b)/.test(r.canonical.replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/\\./g, ""))) bad.push(`unsafe pseudo in ${JSON.stringify(r.canonical)}`);
    }
    expect(ACCEPTED.length).toBeGreaterThan(200); // (fewer since armed sessions take exact [attr=...] only, and no .class)
    expect(bad).toEqual([]);
  });
});

// ───────────────────────── 2. Masker: pure ─────────────────────────

describe("masker (pure, both layers on plain text)", () => {
  const t = typedWith({ "Card.number": CARD, "Me.full_name": NAME, "Me.email": EMAIL, "Me.phone": PHONE });
  const g = ["4000", "0566", "5566", "5556"];
  const cases: Array<[string, string]> = [
    ["M1. separators of 4 characters", g.join(" -- ")],
    ["M2. '>' between groups", g.join(">")],
    ["M2b. '<' between groups", g.join("<")],
    ["M3. four zero-width spaces between groups", g.join("​​​​")],
    ["M3b. soft hyphen + 3 ZWSP + word joiner", g.join("­​​​⁠")],
    ["M4. full-width digits", [...CARD].map((d) => String.fromCharCode(0xff10 + +d)).join("")],
    ["M4b. Arabic-Indic digits", [...CARD].map((d) => String.fromCharCode(0x660 + +d)).join("")],
    ["M4c. mathematical bold digits", [...CARD].map((d) => String.fromCodePoint(0x1d7ce + +d)).join("")],
    ["M5. five tags between groups (html)", g.join("<b><i><u><s><em>")],
    ["M6. a tag longer than 300 characters between groups (html)", g.join(`<span data-x="${"a".repeat(300)}">`)],
    ["M7. nbsp in an attribute serialized as &nbsp;", `<div data-card="${g.join("&nbsp;")}">`],
    ["M7b. & in an attribute serialized as &amp;", `<div data-card="${g.join("&amp;")}">`],
    ["M8. reversed digits", [...CARD].reverse().join("")],
    ["M9. the first 12 digits only", CARD.slice(0, 12)],
    ["M10. href percent-encoding nbsp-formatted groups", `http://shop/r?cc=${encodeURIComponent(g.join(" "))}`],
    ["M10b. href percent-encoding two spaces", `http://shop/r?cc=${encodeURIComponent(g.join("  "))}`],
    ["M11. combining mark after each digit", [...CARD].map((d) => d + "̲").join("")],
    ["M11b. combining marks, 4 per digit", [...CARD].map((d) => d + "̴̵̲̳").join("")],
  ];
  for (const [name, echo] of cases) {
    test(`${name}: ${JSON.stringify(echo.slice(0, 60))}`, () => {
      expect(cardLeak(bothLayers(t, echo))).toBeUndefined();
    });
  }

  const textCases: Array<[string, string, string]> = [
    ["M12. name with a non-breaking space", NAME.replace(" ", " "), NAME],
    ["M12b. name with two spaces (html keeps them)", NAME.replace(" ", "  "), NAME],
    ["M12c. name split by a line break (innerText of <br>)", NAME.replace(" ", "\n"), NAME],
    ["M12d. name with Cyrillic homoglyphs", "Аda Lovelace".replace("e", "е"), NAME],
    ["M12e. name in full-width letters", [...NAME].map((c) => (c === " " ? " " : String.fromCharCode(c.charCodeAt(0) + 0xfee0))).join(""), NAME],
    ["M13. email with the + percent-encoded", encodeURIComponent(EMAIL), EMAIL],
    ["M13b. email with @ as (at)", EMAIL.replace("@", " (at) "), EMAIL],
    ["M13c. email upper-case (should be masked)", EMAIL.toUpperCase(), EMAIL],
    ["M14. phone in national format", "07700 900123", PHONE],
    ["M14b. phone without +", "447700900123", PHONE],
    ["M14c. phone as +44 (0)7700 900123", "+44 (0)7700 900123", PHONE],
  ];
  const norm = (s: string) => s.normalize("NFKC").toLowerCase().replace(/[\s ]+/g, "").replace(/[Ѐ-ӿ]/g, (c) => ({ "а": "a", "е": "e", "о": "o", "с": "c" })[c] ?? c);
  // Documented limits (docs/stdlib/wallet.md, Limits): look-alike letters and spelled-out @. Only personal items rely on text masking; a card locks the browser.
  const LIMITS = new Set(["M12d. name with Cyrillic homoglyphs", "M13b. email with @ as (at)"]);
  for (const [name, echo, value] of textCases) {
    (LIMITS.has(name) ? test.skip : test)(`${name}: ${JSON.stringify(echo)}`, () => {
      const out = bothLayers(t, `Hello ${echo}!`);
      if (value === PHONE) expect(digitsOf(out)).not.toContain(PHONE.slice(3)); // the 10 national digits
      else expect(norm(decodeURIComponent(out.replace(/ \(at\) /g, "@")))).not.toContain(norm(value));
    });
  }

  test("M15. values with regex metacharacters are masked (O'Brien (Jr.), a+b@x.com, $1.*[x])", () => {
    const m = typedWith({ "Me.full_name": "O'Brien (Jr.)", "Me.email": "a+b@x.com", "Me.address": "Flat $1.*[x] ^|\\" });
    expect(m.mask("to O'Brien (Jr.) at a+b@x.com, Flat $1.*[x] ^|\\")).toBe("to [wallet Me.full_name] at [wallet Me.email], [wallet Me.address]");
  });

  test("M16. stored formatted numbers still mask the plain echo", () => {
    const m = typedWith({ "Card.number": "4000 0566 5566 5556" });
    expect(m.mask(`n=${CARD}`)).toBe("n=[wallet Card.number]");
    const d = typedWith({ "Card.number": "4000-0566-5566-5556" });
    expect(d.mask("4000 0566 5566 5556")).toBe("[wallet Card.number]");
  });

  // Documented limit (docs/stdlib/wallet.md, Limits): text masking, which only personal items rely on (a card locks the browser).
  test.skip("M17. short values (cvc 123, expiry 12/34, zip 94016) are not masked when echoed", () => {
    const m = typedWith({ "Card.cvc": "123", "Card.expiry": "12/34", "Me.zip": "94016" });
    const out = m.mask("Security code 123, expires 12/34, ZIP 94016");
    expect(out).not.toContain("123");
    expect(out).not.toContain("12/34");
    expect(out).not.toContain("94016");
  });

  test("M18. ReDoS: the mask over hostile text stays under 1s", () => {
    const hostile = [
      ("4" + "<" + "x".repeat(298)).repeat(2000),
      ("4000056655665555" + "<a>".repeat(4)).repeat(5000),
      ("4" + "<>".repeat(4) + "   ").repeat(20000),
      [...CARD.slice(0, 15)].map((d) => d + "<" + "9".repeat(299) + ">" + "  ").join("").repeat(300),
      ("4" + "<".repeat(301)).repeat(3000),
      [...CARD.slice(0, 15)].map((d) => d + ("<" + "4".repeat(70) + ">").repeat(4) + "   ").join("").repeat(200),
    ];
    const times: number[] = [];
    for (const h of hostile) {
      const t0 = performance.now();
      t.mask(h);
      times.push(Math.round(performance.now() - t0));
    }
    console.log("M18 mask times (ms) for", hostile.map((h) => h.length), times);
    expect(Math.max(...times)).toBeLessThan(1000);
  });

  // Documented limit (docs/stdlib/wallet.md, Limits): text masking, which only personal items rely on (a card locks the browser).
  test.skip("M19. low priority: a 6-digit value masks ordinary page text (prices, dates, phone numbers)", () => {
    const m = typedWith({ "Me.passport_no": "X1234567T", "Me.code": "123456" });
    const page = "Total $1,234.56 on 2023-12-04 56; call 01234 567890; order #12-34-56";
    const out = m.mask(page);
    console.log("M19 false positives:", out);
    expect(out).toBe(page);
  });
});

// ───────────────────────── Browser harness ─────────────────────────

const chrome = findChrome();
let server: ReturnType<typeof Bun.serve>;
let BASE = "";

const FORM = `<input id="card" autocomplete="cc-number"><input id="nm" autocomplete="name"><input id="em" autocomplete="email"><input id="ph" autocomplete="tel">`;
/** Echo pages: each defines echo(v, field) run on every input. */
const PAGES: Record<string, string> = {
  sep4: `$("o").textContent = "Card " + g(v).join(" -- ");`,
  gt: `$("o").textContent = "Card " + g(v).join(">");`,
  zw: `$("o").textContent = "Card " + g(v).join("\\u200b\\u200b\\u200b\\u200b");`,
  fullwidth: `$("o").textContent = "Card " + [...v].map((d) => String.fromCharCode(0xff10 + +d)).join("");`,
  arabic: `$("o").textContent = "Card " + [...v].map((d) => String.fromCharCode(0x660 + +d)).join("");`,
  reversed: `$("o").innerHTML = '<span style="display:inline-flex;flex-direction:row-reverse">' + [...v].reverse().map((d) => "<span>" + d + "</span>").join("") + "</span>";`,
  partial: `$("o").textContent = "Card starting " + v.slice(0, 12) + "…";`,
  shadowsplit: `$("o").textContent = "Card " + v.slice(0, 8); const h = $("sh"); (h.shadowRoot || h.attachShadow({ mode: "open" })).textContent = v.slice(8);`,
  shadowfull: `const h = $("sh"); (h.shadowRoot || h.attachShadow({ mode: "open" })).textContent = v;`,
  attrtrunc: `$("h").setAttribute("data-card", v);`,
  attrnbsp: `$("h").setAttribute("data-card", g(v).join("\\u00a0"));`,
  hrefnbsp: `$("lnk").href = "/receipt?cc=" + encodeURIComponent(g(v).join("\\u00a0"));`,
  linktitle: `$("lnk").textContent = ""; $("lnk").style.cssText = "display:inline-block;width:9px;height:9px"; $("lnk").title = "x".repeat(185) + v;`,
  arialabel: `$("pv").setAttribute("aria-label", "Card " + v);`,
  namenbsp: `if (f === "nm") $("o").textContent = "Hi " + v.replace(" ", "\\u00a0") + "!";`,
  namebr: `if (f === "nm") $("o").innerHTML = "Hi " + v.replace(" ", "<br>") + "!";`,
  phone: `if (f === "ph") $("o").textContent = "We'll call 0" + v.slice(3, 7) + " " + v.slice(7);`,
  redos: `$("o").textContent = ("4" + "<" + "x".repeat(298)).repeat(20000) + [...v.slice(0,15)].map((d) => d + ("<" + "4".repeat(70) + ">").repeat(4) + "   ").join("").repeat(300);`,
};
const page = (name: string) => `<!doctype html><title>Shop</title>${FORM}
<p id="o"></p><x-card id="sh"></x-card><div id="h">.</div><a id="lnk" href="/receipt">Receipt</a><div id="pv" role="img" style="width:20px;height:20px;background:#000"></div>
<script>
  const $ = (id) => document.getElementById(id);
  const g = (v) => v.match(/.{1,4}/g) || [];
  for (const el of document.querySelectorAll("input")) el.addEventListener("input", () => { const v = el.value, f = el.id; if (f === "card" || ${name.startsWith("name") || name === "phone"}) { ${PAGES[name]} } });
</script>`;

/** The selector-fuzz page: elements whose value-dependent state the fuzz flips. */
const FUZZ = `<!doctype html><title>Fuzz</title>
<form id="f"><input id="card" class="x" name="n" type="text" autocomplete="cc-number" placeholder="Card" pattern="4.*" required aria-label="Card">
<input id="cb" type="checkbox"><textarea id="ta"></textarea><select id="sel"><option>a</option><option id="o2">b</option></select>
<div id="echo" class="x pay"></div><iframe id="fr" title="Secure"></iframe><a id="lk" href="/x">l</a><span id="sp" lang="en" dir="ltr"></span></form>
<script>
  window.__state = (v) => {
    const c = document.getElementById("card");
    c.value = v; if (v) c.setAttribute("value", v); else c.removeAttribute("value");
    c.setAttribute("data-value", v); c.setAttribute("title", v);
    document.getElementById("cb").checked = v.startsWith("4");
    document.getElementById("ta").value = v;
    document.getElementById("sel").selectedIndex = v.startsWith("4") ? 1 : 0;
    document.getElementById("echo").textContent = v;
    document.getElementById("sp").textContent = v;
    document.getElementById("o2").setAttribute("value", v);
    document.getElementById("echo").setAttribute("href", v);
  };
</script>`;

beforeAll(() => {
  if (!chrome) return;
  server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch: (req) => {
      const p = new URL(req.url).pathname.slice(1);
      const html = p === "fuzz" ? FUZZ : PAGES[p] ? page(p) : "<title>x</title>";
      return new Response(html, { headers: { "Content-Type": "text/html", "Cache-Control": "no-store" } });
    },
  });
  BASE = `http://127.0.0.1:${server.port}`;
});
afterAll(async () => {
  await closeChromeSessions();
  server?.stop(true);
  resetWalletEnv();
});
afterEach(() => closeChromeSessions());

let n = 0;
function agent(opts: { script?: boolean } = {}) {
  const runId = `rt-parsers-${++n}`;
  const items = {
    Card: walletItem("Card", (k) => ({ source: "env", ...(process.env.WALLET_RT_PERSONAL === "1" ? {} : { kind: "card" }), fields: ["number:cc-number"], hosts: ["127.0.0.1"] })[k as string]),
    Me: walletItem("Me", (k) => ({ source: "env", fields: ["full_name", "email", "phone"], hosts: ["127.0.0.1"] })[k as string]),
  };
  const run = async (method: string, named: Record<string, unknown> = {}) => {
    const cfg: Record<string, unknown> = opts.script ? { allow: ["127.0.0.1"], allowScript: true } : { headless: false, allow: ["127.0.0.1"], wallet: ["Card", "Me"] };
    const call: ToolCall = { tool: { name: "Web", provider: "Chrome", args: [], namedArgs: {}, argList: [] }, method, positional: [], named, config: (k) => cfg[k as string], viaAgent: true, signal: new AbortController().signal, runId };
    const services = { wallet: (names: string[]) => names.map((x) => items[x as "Card" | "Me"]), approve: async (_: ToolApprovalRequest) => true, walletEvent: (_: WalletEvent) => {}, env: {} } as unknown as ToolServices;
    return chromeProvider(call, services).catch((e: unknown) => e as HaloError);
  };
  return run;
}
const out = (r: unknown) => (r instanceof Error ? `ERROR ${r.message}` : typeof r === "string" ? r : JSON.stringify(r));

function setValues(card = CARD) {
  resetWalletEnv();
  captureWalletEnv({ HALO_WALLET_CARD_NUMBER: card, HALO_WALLET_ME_FULL_NAME: NAME, HALO_WALLET_ME_EMAIL: EMAIL, HALO_WALLET_ME_PHONE: PHONE });
}

async function armedOn(pageName: string, fields: Record<string, string> = { "#card": "Card.number" }) {
  setValues();
  const run = agent();
  await run("open", { url: `${BASE}/${pageName}` });
  const f = await run("fill_secrets", { fields });
  if (f instanceof Error) throw f;
  return run;
}

// ───────────────────────── Browser: selector differential fuzz ─────────────────────────

describe.skipIf(!chrome)("selector checker in Chrome", () => {
  test("S2. no accepted canonical selector matches differently when only the typed value changes", async () => {
    const canon = [...new Set(ACCEPTED)];
    expect(canon.length).toBeGreaterThan(200);
    const run = agent({ script: true }); // unarmed, for the oracle only: checks canonical text as Chrome parses it
    await run("open", { url: `${BASE}/fuzz` });
    const script = `(() => { const sels = ${JSON.stringify(canon)}; const diff = []; let invalid = 0;
      const snap = () => sels.map((s) => { try { return [...document.querySelectorAll(s)].map((e) => e.id || e.tagName).join(","); } catch { return "!"; } });
      const states = ["", "4000056655665556", "5", "4", "abc"]; const snaps = states.map((v) => (window.__state(v), snap()));
      sels.forEach((s, i) => { if (snaps[0][i] === "!") invalid++; for (const sn of snaps) if (sn[i] !== snaps[0][i]) { diff.push([s, snaps.map((x) => x[i])]); break; } });
      return { n: sels.length, invalid, diff: diff.slice(0, 20) }; })()`;
    const raw = await run("evaluate", { script });
    if (raw instanceof Error) throw raw;
    const r = raw as { n: number; invalid: number; diff: unknown[] };
    console.log(`S2: ${r.n} canonical selectors in Chrome, ${r.invalid} invalid in Chrome`);
    expect(r.diff).toEqual([]);
  }, 120_000);

  test("S3. armed: wait() with handmade tricks never finds a value-dependent match", async () => {
    const run = await armedOn("arialabel");
    const found: string[] = [];
    for (const s of ['input[value^="4"]', "input[v\\61lue^='4']", "#card:nth-child(1 of [value])", "input:placeholder-shown", "input:invalid", "input:not(:placeholder-shown)", ":is(input):has(x)", "input[value i]", "#card:-webkit-autofill"]) {
      const r = out(await run("wait", { selector: s, timeout_ms: 1 }));
      if (r.includes('"found":true') || r.includes('"found":false')) found.push(`${s} -> ${r}`);
    }
    expect(found).toEqual([]);
  }, 60_000);

  test("S4. page-dependent: a page that mirrors the number into aria-label (allowed) answers prefix probes", async () => {
    const run = await armedOn("arialabel");
    let known = "";
    for (let pos = 0; pos < 8; pos++) {
      for (const d of "0123456789") {
        const r = out(await run("wait", { selector: `[aria-label^="Card ${known}${d}"]`, timeout_ms: 1 }));
        if (r.includes('"found":true')) {
          known += d;
          break;
        }
      }
    }
    console.log("S4 recovered by [aria-label^=] probes:", known);
    expect(known.length).toBeLessThan(8);
  }, 120_000);
});

// ───────────────────────── Browser: echoes past both layers ─────────────────────────

describe.skipIf(!chrome)("echoes in Chrome (redaction pass + mask)", () => {
  const read = async (pageName: string, method: string, named: Record<string, unknown> = {}, fields?: Record<string, string>) => {
    const run = await armedOn(pageName, fields);
    const r = out(await run(method, named));
    return r;
  };
  const cases: Array<[string, string, string, Record<string, unknown>]> = [
    ["B1. 4-char separators", "sep4", "text", { selector: "#o" }],
    ["B2. '>' separators", "gt", "text", { selector: "#o" }],
    ["B3. 4 zero-width spaces", "zw", "text", { selector: "#o" }],
    ["B4. full-width digits", "fullwidth", "text", { selector: "#o" }],
    ["B5. Arabic-Indic digits", "arabic", "text", { selector: "#o" }],
    ["B6. digits in reversed DOM order (row-reverse)", "reversed", "html", { selector: "#o" }],
    ["B7. first 12 digits echoed", "partial", "text", { selector: "#o" }],
    ["B8. split across a shadow root: light half", "shadowsplit", "text", {}],
    ["B9. whole number in a shadow root, cut by maxChars", "shadowfull", "text", { selector: "#sh", maxChars: 15 }],
    ["B10. number in an attribute, html cut by maxChars", "attrtrunc", "html", { selector: "#h", maxChars: '<div id="h" data-card="'.length + 15 }],
    ["B11. nbsp-grouped number in an attribute (html &nbsp;)", "attrnbsp", "html", { selector: "#h" }],
    ["B12. nbsp-grouped number in a link href (links)", "hrefnbsp", "links", {}],
    ["B17. number at char 185 of an empty link's title, cut to 200 in the page before the mask (links)", "linktitle", "links", {}],
  ];
  for (const [name, p, method, named] of cases) {
    test(`${name}: ${method}(${JSON.stringify(named)})`, async () => {
      const r = await read(p, method, named);
      const leak = cardLeak(r);
      console.log(`${name} ->`, r.slice(0, 200));
      if (leak) console.log(`${name} LEAK ${leak}:`, r.slice(0, 300));
      expect(leak).toBeUndefined();
    }, 60_000);
  }

  test("B8b. split across a shadow root: both halves together", async () => {
    const run = await armedOn("shadowsplit");
    const a = out(await run("text", { selector: "#o" }));
    const b = out(await run("text", { selector: "#sh" }));
    console.log("B8b", JSON.stringify(a), JSON.stringify(b));
    expect(digitsOf(a + b)).not.toContain(CARD);
  }, 60_000);

  test("B13. name with a non-breaking space", async () => {
    const r = await read("namenbsp", "text", { selector: "#o" }, { "#nm": "Me.full_name" });
    console.log("B13", JSON.stringify(r));
    expect(r.replace(/ /g, " ")).not.toContain(NAME);
  }, 60_000);

  test("B14. name split by <br>", async () => {
    const r = await read("namebr", "text", { selector: "#o" }, { "#nm": "Me.full_name" });
    console.log("B14", JSON.stringify(r));
    expect(r.replace(/\s+/g, " ")).not.toContain(NAME);
  }, 60_000);

  test("B15. phone echoed in national format", async () => {
    const r = await read("phone", "text", { selector: "#o" }, { "#ph": "Me.phone" });
    console.log("B15", JSON.stringify(r));
    expect(digitsOf(r)).not.toContain(PHONE.slice(3));
  }, 60_000);

  test("B16. ReDoS: a hostile page doesn't stall text()", async () => {
    const run = await armedOn("redos");
    const t0 = Date.now();
    const r = await run("text", { selector: "#o", maxChars: 50 });
    const ms = Date.now() - t0;
    console.log("B16 text() on hostile page took", ms, "ms", out(r).slice(0, 80));
    expect(ms).toBeLessThan(5000);
  }, 120_000);
});
