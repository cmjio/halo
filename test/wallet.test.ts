import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, utimesSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse, validate } from "../src/parser/index";
import { HaloRuntime } from "../src/runtime/runtime";
import { plan } from "../src/plan";
import { checkFence as fence } from "../src/fence";
import { checkArmedSelector } from "../src/runtime/providers/selector";
import { sweepStaleProfiles } from "../src/runtime/providers/chrome";
import {
  captureWalletEnv,
  cardHint,
  dotenvWithWallet,
  formatProblem,
  formatValue,
  hostCovers,
  hostMatches,
  keychainComment,
  luhn,
  parseExpiry,
  parseRef,
  readWalletValue,
  registrableDomain,
  resetWalletEnv,
  setWalletBackends,
  tokenAgrees,
  TypedValues,
  walletAllows,
  walletItem,
  walletItemProblems,
  walletLimits,
  walletProgramProblem,
  walletUnsafeTool,
} from "../src/runtime/wallet";

const quiet = { logger: { log() {}, warn() {} } };
const settings = (o: Record<string, unknown>) => (k: string | number) => o[k as string];
const CARD = { source: "mock", kind: "card", fields: ["number", "expiry", "cvc", "name"], hosts: ["www.shop.example"], pay_via: ["js.stripe.com"] };
const errors = (src: string) => validate(parse(src)).filter((d) => d.severity === "error").map((d) => d.message);
const warnings = (src: string) => validate(parse(src)).filter((d) => d.severity === "warning").map((d) => d.message);

describe("Vault declarations", () => {
  test("a card is always secret, and gets the standard autocomplete tokens", () => {
    const item = walletItem("Card", settings(CARD));
    expect(item.secret).toBe(true);
    expect(item.ask).toBe(true);
    expect(item.fields).toEqual([
      { name: "number", token: "cc-number" },
      { name: "expiry", token: "cc-exp" },
      { name: "cvc", token: "cc-csc" },
      { name: "name", token: "cc-name" },
    ]);
    expect(item.account).toBe("Card");
  });

  test("personal fields get their tokens; name:token and name:off override them", () => {
    const item = walletItem("Me", settings({ source: "mock", fields: ["full_name", "email", "phone", "passport_no:off", "loyalty:username"], hosts: ["*.shop.example"] }));
    expect(item.secret).toBe(false);
    expect(item.ask).toBe(true);
    expect(item.fields).toEqual([{ name: "full_name", token: "name" }, { name: "email", token: "email" }, { name: "phone", token: "tel" }, { name: "passport_no" }, { name: "loyalty", token: "username" }]);
  });

  const problems = (o: Record<string, unknown>) => walletItemProblems("X", settings(o));

  test("hosts: is required, and a secret item takes exact hosts only", () => {
    expect(problems({ source: "mock", fields: ["a"] })).toContain('hosts: is required: the sites the item may be typed on, e.g. hosts: ["www.example.com"]');
    expect(problems({ ...CARD, hosts: ["*.shop.example"] })).toContain('hosts: "*.shop.example": a secret item takes exact hosts, not *. patterns (name each host it may be typed on)');
    expect(problems({ ...CARD, pay_via: ["*.adyen.com"] })).toContain('pay_via: "*.adyen.com": a secret item takes exact hosts, not *. patterns (name each host it may be typed on)');
    expect(problems({ source: "mock", fields: ["email"], hosts: ["*.shop.example"] })).toEqual([]);
  });

  test("a host where anyone can publish is refused, named or covered", () => {
    expect(problems({ ...CARD, hosts: ["sites.google.com"] })[0]).toContain('"sites.google.com" is a host where anyone can publish a page');
    expect(problems({ source: "mock", fields: ["email"], hosts: ["*.google.com"] })[0]).toContain('"*.google.com" covers sites.google.com');
    expect(problems({ source: "mock", fields: ["email"], hosts: ["*.app"] })[0]).toContain('hosts: "*.app" is not a host name');
    expect(problems({ source: "mock", fields: ["email"], hosts: ["*.vercel.app"] })[0]).toContain('"*.vercel.app" is a host where anyone can publish a page');
    expect(problems({ source: "mock", fields: ["email"], hosts: ["acme.github.io"] })[0]).toContain('"acme.github.io" covers *.github.io');
  });

  test("a payment provider goes in pay_via:, never hosts:", () => {
    expect(problems({ ...CARD, hosts: ["js.stripe.com"] })).toContain(`hosts: "js.stripe.com" is a payment provider's host; it serves every merchant's frames, so put it in pay_via: (it then counts only inside a page on hosts:)`);
    expect(problems({ ...CARD, hosts: ["checkoutshopper-live.adyen.com"] }).some((p) => p.includes("payment provider"))).toBe(true);
  });

  test("other rules: source, ask: false on a secret, pay_via on a personal item, card secret: false, fields", () => {
    expect(problems({ ...CARD, source: undefined })).toContain('source: is required ("keychain", "1password", "env" or "mock")');
    expect(problems({ ...CARD, source: "vault" })[0]).toBe('source: is "keychain", "1password", "env" or "mock", not "vault"');
    expect(problems({ ...CARD, source: "1password" })).toContain('source: "1password" needs vault:, the 1Password vault the item is in');
    expect(problems({ ...CARD, ask: false })).toContain("ask: false isn't allowed on a secret item: typing it always asks");
    expect(problems({ ...CARD, secret: false })).toContain("a card is always secret; remove secret: false");
    expect(problems({ source: "mock", fields: ["email"], hosts: ["a.example"], pay_via: ["js.stripe.com"] })).toContain("pay_via: is for secret items (cards and identity numbers)");
    expect(problems({ ...CARD, fields: ["Number"] })[0]).toContain('fields: "Number" should be a lowercase name');
    expect(problems({ ...CARD, fields: ["cvc", "cvc"] })).toContain('fields: "cvc" is listed twice');
  });

  test("loopback hosts are allowed, for testing against a local server", () => {
    expect(problems({ ...CARD, hosts: ["127.0.0.1"], pay_via: ["localhost"] })).toEqual([]);
    expect(problems({ ...CARD, hosts: ["shop.localhost"] })).toEqual([]);
  });
});

describe("hosts", () => {
  test("hostMatches: exact, or *. for subdomains only", () => {
    expect(hostMatches("www.shop.example", "www.shop.example")).toBe(true);
    expect(hostMatches("WWW.Shop.Example.", "www.shop.example")).toBe(true);
    expect(hostMatches("a.shop.example", "*.shop.example")).toBe(true);
    expect(hostMatches("shop.example", "*.shop.example")).toBe(false);
    expect(hostMatches("evilshop.example", "*.shop.example")).toBe(false);
  });

  test("hostCovers: whether two patterns share a host", () => {
    expect(hostCovers("*.google.com", "sites.google.com")).toBe(true);
    expect(hostCovers("sites.google.com", "*.google.com")).toBe(true);
    expect(hostCovers("*.io", "*.github.io")).toBe(true);
    expect(hostCovers("*.github.io", "*.io")).toBe(true);
    expect(hostCovers("www.google.com", "sites.google.com")).toBe(false);
    expect(hostCovers("*.example.com", "*.example.org")).toBe(false);
  });

  test("registrableDomain", () => {
    expect(registrableDomain("www.britishairways.com")).toBe("britishairways.com");
    expect(registrableDomain("checkout.shop.co.uk")).toBe("shop.co.uk");
    expect(registrableDomain("127.0.0.1")).toBe("127.0.0.1");
    expect(registrableDomain("localhost")).toBe("localhost");
  });
});

describe("refs and formats", () => {
  test("parseRef", () => {
    expect(parseRef("Card.number")).toEqual({ item: "Card", field: "number", raw: "Card.number" });
    expect(parseRef(" Card.expiry:MM/YY ")).toEqual({ item: "Card", field: "expiry", format: "MM/YY", raw: "Card.expiry:MM/YY" });
    expect(() => parseRef("card")).toThrow('"card" is not a wallet ref');
    expect(() => parseRef(42)).toThrow("A wallet ref is a string");
  });

  test("expiry formats, from any stored shape", () => {
    for (const stored of ["03/29", "3/2029", "2029-03", "0329", "03 - 29"]) {
      const f = (fmt: string) => formatValue(parseRef(`Card.expiry:${fmt}`), stored);
      expect([f("MM/YY"), f("MM/YYYY"), f("MM-YY"), f("MMYY"), f("MM"), f("M"), f("YY"), f("YYYY")]).toEqual(["03/29", "03/2029", "03-29", "0329", "03", "3", "29", "2029"]);
    }
    expect(parseExpiry("13/29")).toBeUndefined();
    expect(formatProblem(parseRef("Card.expiry:DD"))).toContain("an expiry format is one of");
    expect(() => formatValue(parseRef("Card.expiry:MM"), "soon")).toThrow("isn't stored as an expiry date");
  });

  test("a part of a number, for split fields", () => {
    const n = "4242 4242 4242 1234";
    expect(formatValue(parseRef("Card.number:13-16"), n)).toBe("1234");
    expect(formatValue(parseRef("Card.number:1-4"), n)).toBe("4242");
    expect(() => formatValue(parseRef("Card.number:15-20"), n)).toThrow("out of range");
    expect(formatProblem(parseRef("Card.number:0-4"))).toContain("counts digits from 1");
    expect(formatProblem(parseRef("Card.number:abc"))).toContain('takes a part of its digits, like ":1-4"');
  });

  test("card hints and Luhn", () => {
    expect(cardHint("4242 4242 4242 4242")).toBe("Visa ending 4242");
    expect(cardHint("5555555555554444")).toBe("Mastercard ending 4444");
    expect(cardHint("2223003122003222")).toBe("Mastercard ending 3222");
    expect(cardHint("378282246310005")).toBe("American Express ending 0005");
    expect(cardHint("6011111111111117")).toBe("Discover ending 1117");
    expect(luhn("4242424242424242")).toBe(true);
    expect(luhn("4242424242424241")).toBe(false);
    expect(luhn("4242")).toBe(false);
  });

  test("autocomplete tokens agree, disagree, or say nothing", () => {
    expect(tokenAgrees("cc-number", [])).toBe(true);
    expect(tokenAgrees("cc-number", ["off"])).toBe(true);
    expect(tokenAgrees("cc-number", ["section-pay", "billing", "cc-number"])).toBe(true);
    expect(tokenAgrees("cc-number", ["email"])).toBe(false);
    expect(tokenAgrees("cc-exp", ["cc-exp-month"])).toBe(true);
    expect(tokenAgrees(undefined, ["email"])).toBe(false);
    expect(tokenAgrees(undefined, ["on"])).toBe(true);
  });

  test("a Keychain item's comment (its hint) is read from its attributes", () => {
    expect(keychainComment(`keychain: "x"\nattributes:\n    "acct"<blob>="Card.number"\n    "icmt"<blob>="Visa ending 4242"\n`)).toBe("Visa ending 4242");
    expect(keychainComment(`"acct"<blob>="Card.number"`)).toBeUndefined();
  });
});

describe("masking typed values", () => {
  const typed = new TypedValues();
  typed.add("Card.number", "4242424242424242");
  typed.add("Card.cvc", "123");
  typed.add("Me.email", "ada@example.com");

  test("a number matches with spaces, dashes or markup between its digits", () => {
    expect(typed.mask("Card 4242 4242 4242 4242 ok")).toBe("Card [wallet Card.number] ok");
    expect(typed.mask("4242-4242-4242-4242")).toBe("[wallet Card.number]");
    expect(typed.mask("4242</span><span>4242</span><span>4242</span><span>4242")).toBe("[wallet Card.number]");
    expect(typed.mask("ending 4242")).toBe("ending 4242");
  });

  test("text values match ignoring case; short values aren't masked as text", () => {
    expect(typed.mask("Receipt sent to ADA@example.com")).toBe("Receipt sent to [wallet Me.email]");
    expect(typed.mask("Gate 123")).toBe("Gate 123");
  });

  test("found() names the ref; maskDeep masks keys and nested strings", () => {
    expect(typed.found("x 4242 4242 4242 4242")).toBe("Card.number");
    expect(typed.found("nothing")).toBeUndefined();
    expect(typed.maskDeep<unknown>({ "ada@example.com": ["4242424242424242", { n: 1 }] })).toEqual({ "[wallet Me.email]": ["[wallet Card.number]", { n: 1 }] });
  });
});

describe("sources", () => {
  const card = walletItem("Card", settings({ ...CARD, source: "env" }));
  beforeEach(() => resetWalletEnv());
  afterAll(() => {
    resetWalletEnv();
    setWalletBackends({});
  });

  test("env: values move out of the environment into the wallet", async () => {
    const env: Record<string, string | undefined> = { HALO_WALLET_CARD_NUMBER: "4242424242424242", OTHER: "x" };
    captureWalletEnv(env);
    expect(env).toEqual({ OTHER: "x" });
    expect(await readWalletValue(card, "number")).toBe("4242424242424242");
    await expect(readWalletValue(card, "cvc")).rejects.toThrow("Card.cvc is not set (set HALO_WALLET_CARD_CVC");
    await expect(readWalletValue(card, "pin")).rejects.toThrow('Card has no field "pin"');
  });

  test("a runtime takes HALO_WALLET_ variables out of the process environment when it starts", async () => {
    process.env.HALO_WALLET_CARD_CVC = "321";
    new HaloRuntime(quiet);
    expect(process.env.HALO_WALLET_CARD_CVC).toBeUndefined();
    expect(await readWalletValue(card, "cvc")).toBe("321");
  });

  test("mock values, and the Keychain through a backend", async () => {
    expect(await readWalletValue(walletItem("Card", settings(CARD)), "number")).toBe("4242424242424242");
    const seen: string[] = [];
    setWalletBackends({ keychain: async (account, { reveal }) => (seen.push(`${account}:${reveal}`), account === "Card.number" ? "5555555555554444" : undefined) });
    const kc = walletItem("Card", settings({ ...CARD, source: "keychain" }));
    expect(await readWalletValue(kc, "number")).toBe("5555555555554444");
    await expect(readWalletValue(kc, "cvc")).rejects.toThrow("halo wallet add Card cvc");
    expect(seen).toEqual(["Card.number:true", "Card.cvc:true"]);
  });

  test("a .env file holding wallet values is found", () => {
    const dir = mkdtempSync(join(tmpdir(), "halo-dotenv-"));
    try {
      expect(dotenvWithWallet(dir)).toBeUndefined();
      writeFileSync(join(dir, ".env"), "OPENAI_API_KEY=x\n");
      expect(dotenvWithWallet(dir)).toBeUndefined();
      writeFileSync(join(dir, ".env.local"), "# cards\nexport HALO_WALLET_CARD_NUMBER=4242\n");
      expect(dotenvWithWallet(dir)).toBe(".env.local");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("selectors in an armed session", () => {
  const ok = (s: string) => checkArmedSelector(s);
  test("layout selectors pass, in canonical form", () => {
    expect(ok("#cardNumber")).toEqual({ ok: true, canonical: "#cardNumber" });
    expect(ok("form > button[type=submit]")).toEqual({ ok: true, canonical: 'form > button[type="submit"]' });
    expect(ok("li:nth-child( 2n + 1 )")).toEqual({ ok: true, canonical: "li:nth-child(2n+1)" });
    expect(ok("button:is(#pay, [data-testid=pay])")).toEqual({ ok: true, canonical: 'button:is(#pay, [data-testid="pay"])' });
    expect(ok("#\\31 23")).toEqual({ ok: true, canonical: "#\\31 23" });
    expect(ok('iframe[title="Secure card"]')).toEqual({ ok: true, canonical: 'iframe[title="Secure card"]' });
  });

  test("anything that can test what a field holds is refused", () => {
    for (const s of [".pay", '[aria-label^="Card 4"]', '[placeholder*="42"]', '[name~="cc"]', 'input[value^="4"]', 'input[v\\61lue^="4"]', "input[VALUE]", 'input[ value = "4" ]', ":not([value])", "div:has(input)", "input:invalid", "input:placeholder-shown", "input:checked", "::part(x)", "*|input", 'input[data-value="4"]', "x/* c */"]) {
      expect(ok(s).ok).toBe(false);
    }
  });
});

describe("a program with a wallet", () => {
  const chrome = (args: string) => ({ name: "Web", provider: "Chrome", argList: parse(`tool Web : Chrome(${args})`).tools[0]!.argList });
  const tool = (src: string) => parse(src).tools[0]!;

  test("tools that run commands or code as you", () => {
    expect(walletUnsafeTool(tool(`tool S : Bash()`))).toBe("runs shell commands as you");
    expect(walletUnsafeTool(tool(`tool S : Code()`))).toBe("runs code as you");
    expect(walletUnsafeTool(tool(`tool S : Remote("deploy@build.example.com")`))).toBe("runs commands on a machine over SSH");
    expect(walletUnsafeTool(tool(`tool S : Remote("docker")`))).toBeUndefined();
    expect(walletUnsafeTool(tool(`tool S : Workspace("./notes", write: true)`))).toBe("can change files (write:)");
    expect(walletUnsafeTool(tool(`tool S : Workspace(root: Env.HOME)`))).toBe("reads files outside the project");
    expect(walletUnsafeTool(tool(`tool S : Git(".")`))).toBe("runs git, which runs the repository's hooks and configured commands as you");
    expect(walletUnsafeTool(tool(`tool S : Remote("docker", from: "/Users")`))).toBe("copies files from outside the project (from:)");
    expect(walletUnsafeTool(tool(`tool S : MCP("bash -c x", url: null)`))).toContain("starts a local MCP server");
    expect(walletUnsafeTool(tool(`tool S : MCP(url: Env.MCP_URL)`))).toContain("starts a local MCP server");
    expect(walletUnsafeTool(tool(`tool S : Workspace("../other")`))).toBe("reads files outside the project");
    expect(walletUnsafeTool(tool(`tool S : Workspace("./notes")`))).toBeUndefined();
    expect(walletUnsafeTool(tool(`tool S : MCP("npx -y server-x")`))).toContain("starts a local MCP server");
    expect(walletUnsafeTool(tool(`tool S : MCP("npx -y server-x", wallet_safe: true)`))).toBeUndefined();
    expect(walletUnsafeTool(tool(`tool S : MCP(url: "https://mcp.example.com")`))).toBeUndefined();
  });

  test("the first problem, only when a browser has a wallet", () => {
    expect(walletProgramProblem([tool(`tool S : Bash()`)])).toBeUndefined();
    expect(walletProgramProblem([chrome("wallet: [Card]"), tool(`tool S : Bash()`)])).toBe(`Tool "S" runs shell commands as you, so it can't be in the same program as a wallet (Web has wallet:). Put the work that needs it in a separate .halo file`);
  });

  test("AllowWallet narrows across policies; ApproveWallet adds up", () => {
    const policies = new Map([
      ["A", { rules: [{ name: "AllowWallet", args: ["Card", "Me.email"] }, { name: "ApproveWallet", args: ["Me.email"] }] }],
      ["B", { rules: [{ name: "AllowWallet", args: ["Card.*", "Me"] }] }],
    ]);
    const limits = walletLimits(["A", "B"], policies);
    expect(limits).toEqual({ allow: [["Card", "Me.email"], ["Card.*", "Me"]], approve: ["Me.email"] });
    expect(walletAllows(limits, { item: "Card", field: "cvc" })).toBe(true);
    expect(walletAllows(limits, { item: "Me", field: "email" })).toBe(true);
    expect(walletAllows(limits, { item: "Me", field: "phone" })).toBe(false);
    expect(walletAllows(walletLimits([], policies), { item: "Card", field: "number" })).toBe(false);
  });
});

describe("halo validate: the wallet", () => {
  const VAULT = `tool Card : Vault(source: "mock", kind: "card", fields: ["number", "expiry", "cvc"], hosts: ["www.shop.example"], pay_via: ["js.stripe.com"])`;
  const WEB = `tool Web : Chrome(allow: ["www.shop.example"], wallet: [Card])`;

  test("a well-formed wallet has no errors", () => {
    expect(errors(`${VAULT}\n${WEB}\npipeline P(url: String) -> Result:\n  url |> Web.open(url: url)\n    |> Web.fill_secret(selector: "#cc", ref: "Card.number")`)).toEqual([]);
  });

  test("a Vault's settings are checked as written", () => {
    expect(errors(`tool Card : Vault(source: "mock", kind: "card", fields: ["number"], hosts: ["*.shop.example"])\n${WEB}`)).toEqual([
      'Tool "Card" (Vault): hosts: "*.shop.example": a secret item takes exact hosts, not *. patterns (name each host it may be typed on)',
    ]);
    expect(errors(`tool Card : Vault(source: "mock", fields: ["n"], hosts: [Env.HOST])\n${WEB}`)).toContain('Tool "Card": a Vault holds names, not values (Env.HOST would be a value); its values stay in its source');
    expect(warnings(`${VAULT}\n${WEB.replace("wallet: [Card]", "wallet: [Card], colour: \"red\"")}`)).toEqual([]);
    expect(warnings(`tool Card : Vault(source: "mock", kind: "card", fields: ["number"], hosts: ["a.example"], colour: "red")\n${WEB}`)).toContain('Tool "Card": Vault has no setting "colour" (it has source, kind, fields, secret, hosts, pay_via, ask, hint, serve, item, vault)');
  });

  test("wallet: names Vaults; no page scripts with a wallet; a Vault in no wallet is a warning", () => {
    expect(errors(`tool Me : Bash()\ntool Web : Chrome(wallet: [Me])`)).toContain('Tool "Web": wallet: Me is not a Vault tool');
    expect(errors(`${VAULT}\ntool Web : Chrome(wallet: [Card], allowScript: true)`)).toContain('Tool "Web": a browser with a wallet can\'t run page scripts (allowScript: true): a script could read what was typed');
    expect(warnings(VAULT)).toContain("Vault Card is in no browser's wallet: (declare one with Chrome(wallet: [Card]))");
  });

  test("Env.HALO_WALLET_ can't be read anywhere", () => {
    expect(errors(`tool Api : GET("https://api.example.com", apiKey: Env.HALO_WALLET_CARD_NUMBER)`)).toEqual([
      `Tool "Api": Env.HALO_WALLET_CARD_NUMBER can't be read: HALO_WALLET_ variables move into the wallet when Halo starts, and only a browser with that wallet can type them`,
    ]);
  });

  test("no tool that runs commands as you in the same program", () => {
    expect(errors(`${VAULT}\n${WEB}\ntool Sh : Bash()`)).toEqual([
      `Tool "Sh" runs shell commands as you, so it can't be in the same program as a wallet (Web has wallet:): it could read the wallet's source directly. Put the work that needs it in a separate .halo file`,
    ]);
  });

  test("no wallet use that would run more than once", () => {
    const head = `${VAULT}\n${WEB}\nagent Booker [anthropic/claude-sonnet-4-5]\n  equips Web\n`;
    expect(errors(`${head}pipeline P(urls: List) -> Result:\n  urls |* each(u in urls) => Web.fill_secret(selector: "#cc", ref: "Card.number")`)[0]).toContain("uses a wallet inside |* each");
    expect(errors(`${head}pipeline P(t: String) -> Result:\n  t |* { Booker.book(tools: auto), Booker.book(tools: auto) }`)[0]).toContain("Booker uses a wallet inside a fan-out (|*)");
    expect(errors(`${head}pipeline P(t: String) -> Result:\n  t |> Booker.book(tools: auto)\n    |<> loop(Booker, "context.data.done != true", max: 2)`)[0]).toContain("loop(Booker, ...) runs Booker again, which uses a wallet");
    expect(errors(`${head}@retry(2)\npipeline P(t: String) -> Result:\n  t |> Booker.book(tools: auto)`)).toContain('Pipeline "P" uses a wallet, so it can\'t have @retry: a retry could type and pay again');
    expect(errors(`${VAULT}\n${WEB}\n@retry(2)\nagent Booker [anthropic/claude-sonnet-4-5]\n  equips Web\npipeline P(t: String) -> Result:\n  t |> Booker.book(tools: auto)`)).toContain('Agent "Booker" equips a browser with a wallet, so it can\'t have @retry: a retry could type and pay again');
    expect(warnings(`${head}pipeline P(t: String) -> Result:\n  t |? { (t == "x") => Booker.book(tools: auto), else => System.Value(t) }`).some((w) => w.includes("inside a branch arm, which can't pause"))).toBe(true);
    // A called pipeline that uses the wallet counts, inside a fan-out.
    expect(errors(`${head}pipeline Pay(t: String) -> Result:\n  t |> Booker.book(tools: auto)\npipeline P(ts: List) -> Result:\n  ts |* each(t in ts) => Pay(t)`)[0]).toContain("Pay uses a wallet inside |* each");
  });

  test("AllowWallet and ApproveWallet patterns", () => {
    expect(errors(`${VAULT}\n${WEB}\npolicy W : AllowWallet("Card", "Card.number", "Card.*")`)).toEqual([]);
    expect(errors(`${VAULT}\n${WEB}\npolicy W : AllowWallet("card number")`)).toContain('Policy "W": AllowWallet(card number) should name a Vault, or a Vault\'s field: "Card", "Card.number" or "Card.*"');
    expect(warnings(`${VAULT}\n${WEB}\npolicy W : ApproveWallet("Passport")`)).toContain('Policy "W": ApproveWallet(Passport): Passport is not a Vault tool declared here');
  });
});

describe("the runtime and the wallet", () => {
  test("Vault.list describes the item and never returns a value", async () => {
    const rt = new HaloRuntime(quiet).load(parse(`tool Card : Vault(source: "mock", kind: "card", fields: ["number", "cvc"], hosts: ["www.shop.example"])\npipeline P(x: String) -> Result:\n  x |> Card.list()`));
    const { output } = await rt.run("P", { x: "" });
    expect(output).toEqual([
      {
        item: "Card",
        secret: true,
        fields: ["number", "cvc"],
        hint: "Visa ending 4242",
        hosts: ["www.shop.example"],
        asks: true,
        use: 'Type a field with the browser\'s fill_secrets(fields: { "<css selector>": "Card.number" }). You never see the values.',
      },
    ]);
    expect(JSON.stringify(output)).not.toContain("4242424242424242");
  });

  test("Vault has no method that returns a value", async () => {
    const rt = new HaloRuntime(quiet).load(parse(`tool Card : Vault(source: "mock", kind: "card", fields: ["number"], hosts: ["a.example"])\npipeline P(x: String) -> Result:\n  x |> Card.get(field: "number")`));
    await expect(rt.run("P", { x: "" })).rejects.toThrow("Card (Vault) has one method, list. Its values are never returned");
  });

  test("a program with a wallet and a shell won't load, whether or not a run uses the browser", () => {
    expect(() => new HaloRuntime(quiet).load(parse(`tool Card : Vault(source: "mock", kind: "card", fields: ["number"], hosts: ["a.example"])\ntool Web : Chrome(wallet: [Card], chrome: "/nonexistent")\ntool Sh : Bash()\npipeline P(x: String) -> Result:\n  x |> Sh.run(command: "true")`))).toThrow(`Tool "Sh" runs shell commands as you, so it can't be in the same program as a wallet`);
  });

  test("under halo serve, a wallet item needs serve: true", async () => {
    const src = (serve: string) => `tool Card : Vault(source: "mock", kind: "card", fields: ["number"], hosts: ["a.example"]${serve})\ntool Web : Chrome(wallet: [Card], chrome: "/nonexistent")\npipeline P(x: String) -> Result:\n  x |> Web.open(url: "https://a.example")`;
    await expect(new HaloRuntime({ ...quiet, serving: true }).load(parse(src(""))).run("P", { x: "" })).rejects.toThrow("Card can't be used while Halo serves pipelines to others");
    // With serve: true it gets as far as looking for the browser.
    await expect(new HaloRuntime({ ...quiet, serving: true }).load(parse(src(", serve: true"))).run("P", { x: "" })).rejects.toThrow("could not start /nonexistent");
  });

  test("an env-source wallet is refused while a .env file holds wallet values", async () => {
    const dir = mkdtempSync(join(tmpdir(), "halo-dotenv-run-"));
    const cwd = process.cwd();
    try {
      writeFileSync(join(dir, ".env"), "HALO_WALLET_CARD_NUMBER=4242424242424242\n");
      process.chdir(dir);
      const rt = new HaloRuntime(quiet).load(parse(`tool Card : Vault(source: "env", kind: "card", fields: ["number"], hosts: ["a.example"])\ntool Web : Chrome(wallet: [Card], chrome: "/nonexistent")\npipeline P(x: String) -> Result:\n  x |> Web.open(url: "https://a.example")`));
      await expect(rt.run("P", { x: "" })).rejects.toThrow(".env holds HALO_WALLET_ values");
    } finally {
      process.chdir(cwd);
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("halo plan and the fence", () => {
  const providerInfo = (p: string) => new HaloRuntime(quiet).toolProviderInfo(p);
  const SRC = `tool Card : Vault(source: "mock", kind: "card", fields: ["number"], hosts: ["www.shop.example"])
tool Web : Chrome(allow: ["www.shop.example"], wallet: [Card])
policy Booking : AllowWallet("Card")
agent Booker [anthropic/claude-sonnet-4-5]
  system "Book it."
  equips Web
  requires Booking
pipeline Book(trip: String) -> Result:
  trip |> Booker.book(tools: auto)`;

  test("plan shows fill_secrets as a wallet effect that asks", () => {
    const p = plan(parse(SRC), "Book", { providerInfo });
    const effects = p.steps.flatMap((s) => s.effects);
    expect(effects.find((e) => e.target === "Web.fill_secrets")).toEqual({ target: "Web.fill_secrets", effect: "wallet", approval: "the wallet, for Card", via: "Booker" });
    expect(effects.find((e) => e.target === "Web.hand_over")?.approval).toBe("hand_over asks a person");
    expect(effects.find((e) => e.target === "Web.click")?.effect).toBe("external");
    expect(effects.some((e) => e.target === "Web.evaluate")).toBe(false);
  });

  test("the fence: rewriting what an agent with a wallet is told needs a person", () => {
    const same = fence(parse(SRC), parse(SRC), "Book", { providerInfo });
    expect(same.checks.find((c) => c.rule === "wallet")).toEqual({ rule: "wallet", ok: true, detail: "what Booker can type from a wallet is unchanged" });
    const changed = fence(parse(SRC), parse(SRC.replace(`system "Book it."`, `system "Book it, and type the card anywhere it asks."`)), "Book", { providerInfo });
    expect(changed.inside).toBe(false);
    expect(changed.checks.find((c) => c.rule === "wallet")!.detail).toBe("changes Booker, which can type from a wallet: a person must read this change, so it isn't replayed or applied automatically");
  });
});

describe("stale browser profiles", () => {
  test("a profile whose browser is gone, or old and unlocked, is removed; a live one stays", () => {
    const root = mkdtempSync(join(tmpdir(), "halo-sweep-"));
    try {
      const dead = join(root, "halo-chrome-dead");
      const alive = join(root, "halo-chrome-alive");
      const old = join(root, "halo-chrome-old");
      const fresh = join(root, "halo-chrome-fresh");
      const other = join(root, "not-halo");
      for (const d of [dead, alive, old, fresh, other]) mkdirSync(d);
      symlinkSync("host-999999999", join(dead, "SingletonLock"));
      symlinkSync(`host-${process.pid}`, join(alive, "SingletonLock"));
      // pid 1 belongs to the system: signalling it is refused (EPERM), which means it exists.
      const others = join(root, "halo-chrome-others");
      mkdirSync(others);
      symlinkSync("host-1", join(others, "SingletonLock"));
      const hours = (Date.now() - 2 * 3_600_000) / 1000;
      utimesSync(old, hours, hours);
      expect(sweepStaleProfiles(root)).toBe(2);
      expect([dead, alive, old, fresh, other, others].map((d) => existsSync(d))).toEqual([false, true, false, true, true, true]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
