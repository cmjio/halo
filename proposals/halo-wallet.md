# Halo Wallet: card and personal details an agent can type but never read

| | |
|---|---|
| Status | Built for Halo 1.7.0, as [The Wallet](../docs/stdlib/wallet.md), with the changes in [What was built](#what-was-built). The design below is the one that was red-teamed; where the two differ, the docs page is right |
| Date | 24 November 2026 |
| Builds on | `Chrome` (`src/runtime/providers/chrome.ts`), sandbox `secrets:` and its masking (`src/runtime/providers/remote.ts`), tool rules (`ApproveTools`, `AllowSecrets`), approvals and paused runs, `halo plan` / `replay` / the fence |

This lives outside `docs/` because everything under `docs/` is published to halolang.com.

## What was built

All of the rollout (steps 0 to 8), with these changes from the design:

| Design | Built | Why |
|---|---|---|
| One `Vault` with `items: { card: {...}, me: {...} }`, refs like `card.number` | One `Vault` per item (`tool Card : Vault(kind: "card", fields: [...], hosts: [...])`), `Chrome(wallet: [Card, Me])`, refs like `Card.number` | Halo has no record literals in declarations: `{ ... }` doesn't parse. One item per declaration also makes `AllowWallet("Card")` and the fence's checks name declarations |
| Field tokens as `fields: { number: "cc-number" }` | `fields: ["number", "loyalty:username", "passport_no:off"]` | Same reason |
| `fill_secrets` only | Also `fill_secret(selector:, ref:)` | A pipeline can't write `fields: { ... }` either, so the pipeline's own form takes strings |
| Frames listed in `links` and `text` | A separate `frames` method | Changing what `links` returns would break pipelines on pages with frames |
| "The run is closed off": per pipeline, at validate time and at run start | Per program (the `.halo` file and its imports), at validate time and when a wallet browser is first used | Simpler and stricter: an agent can be called from any pipeline in the file |
| Under `halo serve`, only named approvers (`serve: { approvers: [...] }`) | `serve: true` on the Vault, and wallet questions answered only through Studio or the API with the server's token, never a signed link or a Slack button | `halo serve` has one token, not users, so there's no one to name. A link is a bearer credential |
| Short values sealed, text masking from 6 characters | As designed, and the digit matcher also crosses HTML tags | The browser tests found a card-preview widget's `<span>`s defeating the 3-character gap |
| A policy's approval and the wallet's, both asked | Folded into one question, asked after the checks | Asking twice for one fill, once before the checks found the element, was worse on both counts |
| Approvals answered by stage | Answers are keyed to the request (`wallet:<hash of frames, URLs, elements, refs>`, `submit:…`, `tool:…`), so an answer to a paused run releases only the same request when it runs again | Needed for a provider to ask from inside its call, and it fixes a latent case where one answer could release a different request at the same stage |

**Red team of the implementation** (25 November 2026). Each attack is a test in `test/wallet-redteam.test.ts` or `test/wallet-run.test.ts`, written to succeed first, then fixed:

| | Attack | Was | Fix |
|---|---|---|---|
| A | `text(maxChars: N)` to cut the echoed number mid-way | Leaked the first 12 digits: the text was capped before it was masked | The page is redacted before it is read, and capped after |
| B | Read a card preview one `<span>` per digit with `:nth-child(k)` | Leaked the whole number, a digit at a time: masking matched whole values only | The redaction pass matches the document as one string and blanks every piece |
| C | Leave the merchant, then `back` to a page holding the value | Didn't reproduce in headless Chrome, but leaving disarmed the session, so a restored page would have been readable | An armed session stays armed until the browser closes |
| D | `press(key: "\\r")` | Submitted without asking: only `Enter` and `Space` were gated | Control characters aren't keys |
| E | Focus theft in an agent's run | The model was told "Error: …" and carried on | `WALLET_INCIDENT` stops the run |
| F | A page copying the value into `title` | `input[title^="4"]` probed it | `title` only on `<iframe>`, `href` only on links |
| G | A page re-rendering the card field, then Pay | Not gated: the gate followed the typed node | Gated while the document the value was typed into is loaded |
| H | A field turned into an email field while the person decides | Typed: the re-check compared nodes, not what they were | Every check runs again after approval |

Also fixed: the stale-profile sweep counted another user's browser as dead (EPERM); a wallet browser could open its own DevTools endpoint; `halo wallet add` could print `security`'s error with the value in it; long page URLs in a question are cut to 100 characters.

**Multi-agent red team** (25 November 2026). Five agents attacked the implementation in parallel, each on one surface, writing exploits as tests (`test/redteam-reads.test.ts`, `redteam-runtime.test.ts`, `redteam-submit.test.ts`, `redteam-parsers.test.ts`; the frames and hosts agent was stopped early, and its surface was covered in `redteam-chain.test.ts`). About 40 attacks worked, every one re-run before it counted. They showed that masking and guessing which actions submit can't be a boundary: the page re-encodes values (reversed with CSS, full-width or Arabic-Indic digits, entities, percent-encoding, one digit or one class per element, canvas, shadow roots, a mirrored `aria-label` probed by prefix) and submits by other means (`select` and `fill` handlers, arrow keys on radios, going back, two-step checkouts, a form posting to another host).

What changed:

| | Change | Answers |
|---|---|---|
| 1 | **After a secret item is typed, the browser is the person's.** Only `hand_over`, which closes the browser when they answer; secrets need `headless: false` | Every read, oracle, screenshot and submission attack on cards |
| 2 | Personal items: the redaction pass covers attributes and open shadow roots, matches normalized text (digit scripts, NFKC, zero-width, entities, percent-encoding), digits with gaps of up to 8 characters or tags and any 8 in a row, names across line breaks; masking happens before `maxChars` cuts; a linear digit matcher (an earlier regex took 16 s on a hostile page) | Most of the read attacks, for personal items (known gaps are in the docs' Limits) |
| 3 | Selectors: exact attribute tests only, no `.class`; no screenshots once anything is typed | Prefix oracles, class oracles, CSS/canvas/shadow screenshots |
| 4 | A form holding a typed value may send it only to the item's hosts | A form or `formaction` posting to another host |
| 5 | Wallet browsers run incognito | Chrome writing the card page's form state to `Sessions/` on disk |
| 6 | `HALO_WALLET_` values wiped from the native environment block (`bun:ffi`); Halo's spawns pass an explicit environment | `ps eww` showing the card; Chrome inheriting it |
| 7 | The program rule runs at load (not first use), covers `Git`, unwritten or outside folders, `Remote` `from:`, `MCP` without a written `http(s)` URL; folders' real paths checked at run start; the runtime refuses a `loop` that re-runs a wallet stage | `MCP(url: null)`, `Workspace(root: Env.X)`, symlinked folders, loops run from the SDK |
| 8 | `halo wallet add`: values capped and checked so a line never reaches `security -i`'s 4095-byte read | A long value running a second `security` command |

Judged by design, not changed: `Agent.method(tool: Web, ...)` is a call the pipeline writes, so `AllowWallet` doesn't apply (a person still approves). Left as documented limits: text masking's gaps for personal items, and Bun's startup environment for package code that spawns without one.

Also built, beyond the design: Halo's own page code now runs in an isolated world (a page can't change what `document.querySelector` returns to Halo); `halo plan` reads methods that depend on a declaration's settings (`ProviderInfo.methodsFor`), so it now shows Chrome's effects at all, and marks `fill_secrets` as the `wallet` effect with who asks.

Not yet checked: whether `security add-generic-password -T ""` makes macOS ask on every read on macOS 15 and 26 (the tests reach the Keychain through a backend hook, and `halo wallet add` was tested with a throwaway item only); and `op read` against a real 1Password account.

## Summary

An agent that books a flight or fills in a form has to enter a card number, a passport number, an address. Today the only way is to put the value in a prompt or a tool argument, where it goes to the model provider and is kept in telemetry, recordings and paused-run snapshots.

This proposal adds a wallet. Its rule:

> **A wallet value leaves Halo only as keystrokes into one approved element, on one approved chain of sites, and nothing about that element can be read back.**

- **`Vault` holds names, not values.** Values stay in the macOS Keychain, 1Password or the environment, and are read only at the moment they are typed. There is no method that returns one.
- **The agent fills by reference:** `Web.fill_secrets(fields: { "#cardNumber": "card.number", ... })`. Models, conversations, telemetry, recordings and snapshots only ever hold `card.number`.
- **Filled elements are sealed.** Halo protects them by *identity*, not by searching text for the value: their contents are never returned, never matched by selectors, never visible in screenshots. Payment frames are sealed whole.
- **Every site in the chain is checked.** The top page and every frame down to the field must be allowed for that item; a payment provider counts only on the merchant it is paired with.
- **A person approves each fill and each submission** that follows it, with the domains shown, bound to the exact frame and element. Wallet approvals are never automatic.
- **The run is closed off.** A pipeline that uses a wallet can't also give an agent a shell or code execution, and can't use it inside retries, loops, fan-outs or best-of-n.

The cheapest protection is outside Halo: **put a merchant-locked virtual card with a spending limit in the wallet.** Every remaining risk below then costs at most one bad charge with one merchant.

## What exists today

- `Env.NAME` works only in tool and store declarations, so a secret can't reach a prompt, but nothing can type it into a page.
- `Chrome.fill` types the value the call passes and returns it: `{ filled, value, ... }`.
- `Chrome` reads and writes only the top frame (`document.querySelector` in the main frame). Real checkouts put card fields in cross-origin payment iframes (Stripe, Adyen, Braintree, Checkout.com), so it can't reach them.
- `Chrome` checks hosts only for top-level navigations (`Fetch.enable` on `Document` requests, when `allow:` is set). Idle browsers close after 5 minutes (`idle_ms`), including while a run is paused.
- Docker sandbox `secrets:` has the right shape: names in the declaration, values from the environment, masked as `[secret NAME]`. Its masker skips values shorter than 4 characters (`remote.ts`, `mask`).
- **`Bash` passes Halo's whole environment to every command** (`src/runtime/integrations.ts`, `Bun.spawn(["bash", "-c", command], ...)` with no `env:`), so an agent with `Bash` can print every API key Halo was started with. `MCP` stdio servers already get only `PATH`, `HOME` and the variables named in `env:`. This is a problem today, without any wallet, and step 0 of the [rollout](#rollout) fixes it.
- `Workspace` has no rule against dotfiles, so it reads `.env`, which Bun loads automatically.
- `halo run --auto-approve` and `halo test` approve everything.

## Goals

- A wallet value never reaches a model, a log, a recording, a snapshot, a trace, Studio, an approval message, or another tool.
- Nothing an agent can do in the browser reveals anything about a typed value, including one character at a time.
- A value can be typed only into a page and frame chain its owner named.
- A person approves every fill of a secret and every submission after it, seeing what they need to judge it and nothing a page chose.
- A pipeline that uses a wallet replays, compares and plans like any other, without the wallet.

## Non-goals (for now)

- Storing values in Halo's state folder or Halo Cloud.
- Passing wallet values to anything but `Chrome`. Sandboxes already have `secrets:`.
- Defeating 3-D Secure, one-time codes or CAPTCHAs. Those go to a person (`hand_over`).
- Defending against other software running as your user. Anything that can run `security` or `op` as you can read what they hold; the design keeps Halo's own tools from doing so, not the rest of the machine.
- Protecting a value from the merchant you type it into, or from scripts the merchant's own page loads. That is what payment frames are for, and why they are sealed.

## Design

### 1. The `Vault` tool

```halo
tool Wallet : Vault(
  source: "keychain",                       # or "1password", "env", "mock"
  items: {
    card: {
      fields: ["number", "expiry", "cvc", "name"], secret: true,
      hosts: ["www.britishairways.com"],
      pay_via: ["js.stripe.com"]            # payment frames, only inside the hosts above
    },
    passport: { fields: ["number", "expiry", "nationality"], secret: true,
                hosts: ["www.britishairways.com"] },
    me: { fields: ["full_name", "email", "phone", "address", "postcode"],
          hosts: ["www.britishairways.com"] }
  })
```

| Setting | Means |
|---|---|
| `source:` | Where values are read from. One per wallet; declare two wallets to mix sources |
| `fields:` | The field names. Each maps to a standard `autocomplete` token by name (`number` on a card → `cc-number`, `email` → `email`), or is given one: `fields: { number: "cc-number" }` |
| `secret: true` | Card and identity numbers. Stricter rules throughout: no wildcards in `hosts:`, every fill and the next submission ask, payment frames sealed whole |
| `hosts:` | Where the item may be typed: the top page's host and every frame's host must be here, or in `pay_via:`. **Required for every item.** A secret item takes exact hosts only; a personal item may use `*.example.com` |
| `pay_via:` | Hosts of payment frames (Stripe, Adyen…). They count only as frames inside a page on `hosts:`, never as the top page, never on their own |
| `ask:` | For a personal item, `false` types it without asking (default: ask). Not accepted on a secret item |
| `hint:` | What the agent may know, such as `"Visa ending 4242"`. Computed for card numbers (brand, last four) unless set |

The validator checks the declaration:

- `items:` holds names. `Env.X` anywhere in it is an error, as with sandbox `secrets:`.
- A secret item with a wildcard host, or any item with no `hosts:`, is an error.
- A host known to serve other people's content (`sites.google.com`, `docs.google.com`, `*.github.io`, `*.pages.dev`, `*.vercel.app`, `*.netlify.app`, `*.web.app`, `*.myshopify.com`, `*.wixsite.com`, and a list kept in the repo) is an error in `hosts:`. A payment provider host (`js.stripe.com`, `*.adyen.com`…) in `hosts:` instead of `pay_via:` is an error.

**Sources.** A value is read when it is typed, held only for that call, and not cached.

| Source | Reads | Stores | Notes |
|---|---|---|---|
| `keychain` (macOS) | `security find-generic-password -s halo-wallet -a <project>/<wallet>/<item>.<field> -w` | `halo wallet add`, with `-T ""` so no app is trusted: **macOS asks you, in its own dialog, every time the value is read** | Interactive use only. That OS dialog is a second approval that nothing in a page or a model can answer |
| `1password` | `op read op://<vault>/<item>/<field>` with `vault:` | In 1Password | With the desktop app integration, `op` asks for Touch ID per session |
| `env` | `HALO_WALLET_<ITEM>_<FIELD>`, read **once at startup into the wallet and deleted from Halo's environment** | Your environment | For servers. A `.env` file holding wallet values is refused: Bun loads it, and file tools could read it |
| `mock` | Fixed test values (card `4242 4242 4242 4242`) | — | The only source `halo test` and `--auto-approve` accept |

(Whether `-T ""` makes `security` prompt on every read, rather than once per item, needs checking on macOS 15 and 26 before step 6.)

### 2. What the agent sees

`Vault` has one method, `list`:

```json
[
  { "item": "card", "secret": true, "fields": ["number", "expiry", "cvc", "name"],
    "hint": "Visa ending 4242", "hosts": ["www.britishairways.com"], "pay_via": ["js.stripe.com"] },
  { "item": "me", "secret": false, "fields": ["full_name", "email", "phone", "address", "postcode"], "missing": ["phone"] }
]
```

There is no `get`, and no option to add one.

### 3. The run is closed off

The red team's easiest attack didn't touch the browser: an agent with `Bash` ran `env`, or `security find-generic-password`. So a pipeline that declares a `Vault` (its own stages, the pipelines it calls, and every agent in them) is checked by the validator and again at run start:

- **No tool that runs commands or code as you:** `Bash`, `Code`, `Remote` over SSH, `Workspace` with `write: true` or a root above the project, and `MCP` stdio servers unless marked `wallet_safe: true` (an author's statement that the server can't be steered into running commands). Docker and cloud sandboxes are fine: they don't run as you and don't share Halo's environment.
- **No wallet-enabled `Chrome` inside `|*`, `|* each`, a branch arm, `@retry`, `|<> loop`, or best-of-n.** Each would repeat a payment. (Approvals can't pause there anyway; today the call fails with `APPROVAL_NEEDED`.)
- **Not under `halo serve` or `halo mcp`** unless the wallet says `serve: { approvers: ["alice@example.com"] }`, and then only a signed-in approver in Studio can answer its approvals. Bare approval links and Slack buttons can't (see [§6](#6-approval)).
- **Never with `connect:`** (a future option to attach to your own Chrome): your real profile would save and sync what was typed.

These are errors, not warnings. Splitting a task in two (one pipeline that researches with a shell, one that books with a wallet) is the supported way to need both.

### 4. Filling: `Chrome(wallet:)`

```halo
tool Web : Chrome(headless: false, allow: ["www.britishairways.com", "www.google.com"], wallet: Wallet)
```

That adds `fill_secrets(fields: { selector: ref, ... }, frame?)` (and `fill_secret` for one). A result never holds a value:

```json
{ "filled": { "#cardNumber": "card.number", "#expiry": "card.expiry:MM/YY", "#cvc": "card.cvc" },
  "sealed": ["js.stripe.com frame"], "armed": true,
  "url": "https://www.britishairways.com/checkout", "title": "Payment" }
```

**Frames.** `Chrome` gets real frame support, which plain `fill`, `click` and `text` need too: `Target.setAutoAttach` with `flatten: true`, so cross-origin frames become sessions; a `frame:` argument on element methods (a selector for the `<iframe>` in the top page); and frames listed with their origins in `links` and `text`.

**Checks, all before anything is typed.** If any fails, nothing is typed:

1. **The refs exist** and the agent may use them (`AllowWallet`, [§7](#7-policies)).
2. **The chain.** The top page's host is in the item's `hosts:`. Every frame from the top page down to the field is in `hosts:` or `pay_via:`. The browser's `allow:` covers the top page. A Stripe frame inside an attacker's page fails at the first step.
3. **The element** is a visible, enabled `<input>` (text, tel, number, email, password, month) or `<select>`, not a textarea, contenteditable, or `type=search` / `role=search` field.
4. **Its `autocomplete`** matches the field's token, or is absent. For a secret item, an element whose `autocomplete` says something else (`email` for `card.number`) is refused, and an element with none needs its `name`, `id` or label to look like the field (`card`, `cc`, `cvc`, `passport`…).
5. **Approval** ([§6](#6-approval)), bound to what these checks found.

**Typing.** After approval, Halo:

1. checks again that the frame target, the element (by its DevTools `backendNodeId`, not the selector) and the chain are the same ones the person approved. If anything changed, nothing is typed and the call fails;
2. focuses that node with `DOM.focus` and confirms it is the focused element in its frame;
3. reads the value from the source, types it with `Input.insertText`, and drops it;
4. confirms focus didn't move while typing. If it did, the value may have gone into another element. The run **stops** with a `WALLET_INCIDENT` error naming the element that got focus, and the session is closed and its profile deleted.

Fields that sites format differently take a format: `"card.expiry:MM/YY"`, `":MM"`, `":YYYY"`. A card number split across four boxes takes `"card.number:1-4"`, `":5-8"`, and so on, typed only as a full set of parts in one call.

### 5. Sealing: nothing reads back

Once a session has typed a wallet value it is **armed**, and Halo keeps a set of **sealed** nodes: every element it filled and, for a secret item, every `pay_via` frame on the page. Sealing is by identity, so it covers values of any length (a 3-digit CVC included) and doesn't need to recognise the value's text.

| Method | In an armed session |
|---|---|
| `text`, `html`, `links` | Sealed elements show `[sealed card.number]` in place of their value and attributes; a sealed frame shows `[sealed frame js.stripe.com]` and nothing inside it |
| Selectors (every method) | Parsed with a real CSS parser (escapes resolved). Only these attribute selectors are allowed: `id`, `name`, `type`, `autocomplete`, `role`, `for`, `placeholder`, `aria-label`, `aria-labelledby`, `data-testid`, `class` (`.x`). Never `value` or any other attribute. Pseudo-classes limited to `:nth-child`, `:nth-of-type`, `:first-child`, `:last-child`, `:not()` of allowed selectors. No `:has()`, `:valid`, `:invalid`, `:placeholder-shown`, `:checked`, `:empty`. A selector that matches **inside** a sealed element or frame is refused, whatever it is |
| `wait` | Waits for text or selectors against the **sealed view** only, so a match can't depend on a typed value. A selector wait follows the selector rules |
| Errors | "no element matches" names the selector, never anything about sealed nodes. An element lookup that would land on a sealed node says `sealed`, the same whether it matches or not |
| `screenshot` | Before capturing: every sealed element and frame gets `visibility: hidden` and a solid placeholder, in every frame, and the style is removed after. Then Halo searches the page's text for every typed value of 6 characters or more (digits compared with any run of up to 3 non-digits between them); if one appears outside a sealed node, the screenshot is refused and the agent is told to use `text` |
| `evaluate` | Refused on any `Chrome` with `wallet:`. The validator makes `allowScript: true` with `wallet:` an error |
| `fill`, `select`, `press` | Can't target a sealed element |

**Text masking stays as a second layer.** Everything returned also goes through the sandbox masker with the typed values, extended so digit sequences match with spaces, dashes, dots or short markup between digits. That catches a page that echoes the number elsewhere ("4242 4242 4242 4242" on a review page). It skips values under 6 characters, which sealing covers instead; masking them as text would hide every "123" on a page, and would itself tell the agent where the value appears.

**Disarming.** A session disarms when its top page leaves the item's hosts, or after a submission completes and the page no longer contains a sealed element. Sealed elements stay sealed for the session's life.

### 6. Approval

**Each fill of a secret item asks. So does the first submission after it:** in an armed session, a `click`, a `press` of Enter, a `select` that submits, or a navigation started from the page needs its own approval, and one approval allows one. That is what stops `@retry`, a confused agent, or a page that re-renders its Pay button from paying twice. Personal items ask unless `ask: false`.

What the person sees is built from what Halo checked, never from what the page says:

```
Booker wants to type card (Visa ending 4242): number, expiry, cvc
  page     britishairways.com    https://www.britishairways.com/checkout
  field in js.stripe.com          (payment frame, paired with britishairways.com)
```

- Registrable domains first and in bold (`britishairways.com`), then full URLs. No page title, no text from the page.
- `named` on the request: `{ target, refs, chain: [{ host, url }], agent, armed }`. No value, no hint beyond the declared one.
- The approval is for that frame target and those nodes. A paused run keeps its browser: `idle_ms` doesn't count while a run is paused waiting for a wallet approval. If the browser closed anyway (a restart), the call fails instead of running against a new page.

**Who can answer.** `--auto-approve` and `halo test` don't approve wallet requests unless the wallet's source is `mock`. Under `halo serve`, only a signed-in Studio user named in `serve: { approvers: [...] }` can answer; signed approval links and Slack buttons, which anyone holding them can press, are refused for wallet requests. An `onInterrupt` handler in your own code can answer, since it is your code.

### 7. Policies

| Rule | Means |
|---|---|
| `AllowWallet("card", "me.email", ...)` | The items or fields an agent may use. **Without it an agent can use none,** though it can call `Vault.list`. A pipeline's own stages aren't limited by it |
| `ApproveWallet("me.address", ...)` | Ask for these even where `ask: false` |

Both take `item`, `item.field` and `item.*`. `Redact(PII)` on the agent still helps: a card a person pastes into a prompt is masked before the model sees it.

### 8. Plan, replay, the fence and evolve

- **`halo plan`** shows wallet use as its own effect, `wallet`, with refs and the host chain: `Web.fill_secrets → card.{number,expiry,cvc} on britishairways.com via js.stripe.com (asks; next submission asks)`.
- **Recordings** keep the sealed results. Replay answers `fill_secrets` from the recording and types nothing. `--live-tools` types for real and asks again.
- **The fence** (`halo compare`) adds a `wallet` check: no new ref, item, host, `pay_via` or `ask: false`, and no dropped `AllowWallet` / `ApproveWallet`. A variant that changes the prompt of an agent equipped with a wallet tool is marked **needs review**: the fence can't see whether new instructions steer it somewhere bad.
- **`halo evolve`** never applies a variant of a wallet pipeline by itself.
- **Paused runs and checkpoints** hold refs only.

### 9. The audit log

Each fill and each submission approval writes one line to `.halo/wallet.log` (and a `wallet` telemetry event): time, run, agent, refs, host chain, who approved, and the outcome (typed, refused and why, incident). No values. `halo wallet log` reads it.

### 10. The browser profile

A wallet-enabled `Chrome` launches with autofill and form history off (`autofill.profile_enabled` and `autofill.credit_card_enabled` false in a `Preferences` file written before launch, `--disable-features=AutofillServerCommunication`), a minimal disk cache, and no session restore. Its profile folder is deleted on close, as today. At start, Halo also deletes `halo-chrome-*` folders left in the temp directory by runs that were killed.

### 11. The CLI

```bash
halo wallet add card number          # macOS hidden prompt; stored with no trusted apps
halo wallet add me email
halo wallet list                     # names, hints, which fields are set; never values
halo wallet remove card
halo wallet check examples/book-flight.halo   # declarations valid, refs set, the run is closed off
halo wallet log
```

### Handing over

`Chrome.hand_over(reason)` asks a person to do a step in the open window (3-D Secure, a one-time code, a CAPTCHA, **pressing Pay**) and continue. It is an ordinary approval request and needs `headless: false`. A submission the person makes counts as theirs: it doesn't use up an approval.

## Example

As built (the syntax differs from §1, see [What was built](#what-was-built)); the full file is `examples/patterns/wallet-checkout.halo`:

```halo
tool Card : Vault(source: "keychain", kind: "card", fields: ["number", "expiry", "cvc", "name"],
                  hosts: ["www.britishairways.com"], pay_via: ["js.stripe.com"])
tool Me   : Vault(source: "keychain", fields: ["full_name", "email", "phone"],
                  hosts: ["www.britishairways.com"], ask: false)
tool Search : WebSearch(engine: "brave", apiKey: Env.BRAVE_API_KEY)
tool Web    : Chrome(headless: false, allow: ["www.britishairways.com"], wallet: [Card, Me])

policy Booking : AllowTools("Search.*", "Web.*", "Card.list", "Me.list")
  & AllowWallet("Card", "Me")
  & Redact(PII)

agent Booker [anthropic/claude-sonnet-4-5, max_steps: 60]
  system "Book the flight described. Use the wallet for passenger and payment details; never ask for them in chat. After filling the card, hand over so the person presses Pay."
  equips Search, Web, Card, Me
  requires Booking

pipeline BookFlight(trip: String) -> Result:
  trip |> Booker.book(tools: auto)
```

A person approves the card fill once, then presses Pay themselves.

## Threat model

**What is protected:** wallet values. **From:** a model steered by a page or a search result (prompt injection); a malicious page or frame on, or embedded in, an allowed site; other tools in the same run; whoever holds an approval link; Halo's own logs and files. **Not from:** other software running as you, the merchant, or the merchant's own scripts.

Each row is an attack from the red-team review, and what now stops it.

| # | Attack | Stopped by | What's left |
|---|---|---|---|
| 1 | **Selector oracle.** After the card is typed, probe `input[value^="42"]` with `click` / `wait` / `text` and read "found" or "not found", one digit at a time (works where frameworks mirror the value into the attribute); then type the digits, spelled out, into a normal field | Selector rules (no `value` or other free attributes, no `:has`/`:valid`/…, real parser, nothing matches inside sealed nodes); sealed `wait`; errors identical for sealed nodes; `fill` can't touch sealed elements | Side channels through page behaviour the agent can trigger but not read, such as layout changes after typing. Low bandwidth; the virtual card caps the harm |
| 2 | **Frame-only host check.** An attacker page on an allowed host (`sites.google.com`) embeds a Stripe frame tied to the attacker's account; the frame passes `js.stripe.com` | Whole-chain check; `pay_via` counts only inside `hosts:`; exact hosts for secret items; user-content hosts refused | A merchant page on an allowed host that is itself compromised |
| 3 | **Other tools read the source.** `Bash` runs `env` (it inherits Halo's environment today), or `security find-generic-password`, or `op read`; `Workspace` reads `.env` | Step 0 gives `Bash` a clean environment; `env` source removes its variables at startup and refuses `.env`; pipelines with a wallet can't have command-running tools; Keychain items trust no app, so macOS asks each time | Other software running as you |
| 4 | **Short values.** A 3-digit CVC can't be masked as text, and masking it would hide every "123" and reveal where it appears | Sealing by identity; text masking only for values of 6+ characters | A page that echoes a CVC outside the sealed frame (merchant bug) |
| 5 | **Change after approval.** The person takes 10 minutes, the browser idles out, or the page swaps the frame or moves focus | Approval bound to frame target and `backendNodeId`; re-checked before typing; focus checked before and after, incident stops the run; no idle timeout while waiting | A page script moving focus during the few milliseconds of typing on a merchant page (detected, not prevented) |
| 6 | **Approval shows what the page chose.** A title like "British Airways – Secure Payment", lookalike subdomains under a wildcard | Domains from Halo's own checks only, no title; exact hosts for secret items | A person approving without reading |
| 7 | **Automatic approval.** `--auto-approve` or `halo test` types a real card in CI | Only the `mock` source is auto-approved | — |
| 8 | **Repeated payment.** One approved fill, then Pay pressed again by the agent, `@retry`, a loop or best-of-n | Each submission after a fill asks; one approval, one submission; wallet refused in retries, loops, fan-outs, best-of-n | The merchant charging twice for one submission |
| 9 | **Personal details sprayed.** An injected page asks for name, address and phone on any allowed host | `hosts:` required on every item; personal items ask by default | Details typed into an allowed merchant's wrong form |
| 10 | **Values left on disk.** Chrome's form history in the temp profile, left behind by a killed run; a real profile syncing to Google | Autofill and history off; stale profiles swept; no `connect:` with a wallet | Swap and crash dumps, as for any process |
| 11 | **Network guard bypass** (spelled-out digits, base64, split requests) | No longer relied on (see [Alternatives](#alternatives-considered)). The chain check and sealing are the protection | — |
| 12 | **Card-preview widgets** showing the number split across elements | Digit matching across short markup; screenshot refusal; preview widgets in payment frames are sealed whole | A merchant widget outside the frame with unusual markup |
| 13 | **Server-side misuse.** Anyone who can start a run on `halo serve` uses the card; anyone with the link approves | Off under `serve` unless approvers are named; only signed-in named approvers answer | A named approver's account being compromised |
| 14 | **Evolve steers the agent.** A variant keeps the refs but rewrites the prompt | Prompt changes on wallet agents marked needs review; evolve never applies them by itself | A human approving the variant without reading it |

## Recommended use

1. **Use a virtual card** (merchant-locked, single-use, or with a low limit), from your bank, Revolut, Privacy, or Stripe Issuing for a business. The docs page says this first.
2. **Hand over at Pay** (`hand_over`), as the example does.
3. **`headless: false`** for anything that pays.
4. **Exact hosts.** Allow the merchant's checkout host and its one payment provider, nothing wider.

## Alternatives considered

- **Mask by text only (the first draft).** Fails for short values, and the red team pulled a full card number through selectors without the masker ever seeing it. Sealing by identity is the design; text masking is the backup.
- **A network guard as a main protection (the first draft).** Spelled-out digits, encoding or split requests get past it, and payment frames encrypt on purpose. Dropped: it would cost a `Fetch` interception of every request and could give false confidence. A request blocklist may come back as an accident catcher.
- **Chrome's own autofill with your real profile.** CDP can't trigger it on a real profile without passing the card in (`Autofill.trigger` takes the data), Chrome asks for the CVC in a native dialog, and the real profile saves and syncs. Not with a wallet.
- **Placeholders in `fill`** (`value: "{{wallet.card.number}}"`). Every policy, approval and fence check would need to look inside strings, and a value built from parts blurs what was typed.
- **A tokenising API instead of a browser** (a flight API's booking endpoint, Stripe Link). Better wherever it exists. The wallet is for sites with only a web form.

## Limits

- Sealing covers what Halo typed and the frames it knows about. A merchant page that copies the value into its own DOM in a new form (an image, a canvas) can show it in a screenshot; the text check catches text, not pictures.
- JavaScript strings can't be wiped. A value is held only for the call that types it, but may stay in the heap until garbage collection.
- Anything running as you can use `security` or `op` as you. The Keychain dialog and Touch ID are the guard there, and only for interactive use.
- A focus change during typing is detected after the fact. The run stops, but the value may already be in another element on that merchant's page.

## Rollout

0. **`Bash` gets a clean environment** (`PATH`, `HOME`, and variables named in a new `env:`, as `MCP` does). This is a security fix on its own and ships first. It breaks pipelines whose commands rely on inherited variables, so `halo migrate` adds `env: [...]` with the names a project's commands use, and the changelog says so.
1. **Frames in `Chrome`:** auto-attach, `frame:`, frames listed with origins. Useful without a wallet.
2. **`Vault` with the `mock` and `env` sources, `fill_secret(s)`, chain and element checks, sealing, the selector rules, `AllowWallet`.**
3. **Approval:** binding and re-check, focus checks and incidents, submission approvals, no idle timeout while paused, auto-approve for `mock` only.
4. **The validator:** closed-off runs, no fan-out or retries, host rules, the user-content host list, `allowScript` with `wallet:`.
5. **Screenshots, the browser profile, the audit log.**
6. **The `keychain` and `1password` sources and `halo wallet`,** after checking how `-T ""` prompts.
7. **Plan, the fence's `wallet` check, evolve, `serve` approvers, Studio.**
8. **`hand_over`, `docs/stdlib/wallet.md`, an example in `examples/`.**

## Testing

Every attack in the [threat model](#threat-model) is a test that has to fail to get the card. They run on a local fixture: three `Bun.serve` servers on different ports, so the merchant page, the payment frame and an attacker are different origins. The merchant page mirrors input values into attributes, as React does, reflects the card number on a review page, and has a preview widget that splits it across spans.

| Test | Expects |
|---|---|
| Selector oracle: `input[value^=…]`, escaped `[v\61lue^=…]`, `:has()`, `:invalid`, a selector inside the sealed frame, `wait` for a prefix | Each refused or answered from the sealed view; no answer differs with the typed value |
| Stripe-style frame inside the attacker page | Refused at the chain check |
| `Bash` `env`, `security`, `op`, `Workspace` reading `.env` in a wallet pipeline | Validator error; with step 0 alone, `env` shows no Halo variables |
| CVC echoed in the frame; card number on the review page; split preview | Sealed / masked / screenshot refused |
| Frame swapped and focus stolen after approval | Nothing typed / `WALLET_INCIDENT`, session closed |
| `--auto-approve` with `env` source | Refused |
| Second Pay click; `@retry`; best-of-n | Second click asks; validator errors |
| The raw value, spaced, dashed, and as its last 6 digits | Absent from tool events, recordings, snapshots, approval messages, Studio's API, errors, `halo plan`, the audit log |
| Replay; `--live-tools` | Types nothing; asks again |

Browser tests run where `test/chrome.test.ts` runs. Selector parsing, masking, the validator and approval binding are tested without a browser.

## Open questions

- Should armed sessions refuse **all** selectors on elements outside the form being filled, rather than a list of safe attributes? Stricter, and may break real checkouts that need to click a terms checkbox.
- `hand_over` at Pay as the default, with the agent pressing Pay as an opt-in (`submit: true` on the item)?
- A shorter list of command-running tools, by marking which providers can run commands in `ProviderInfo` rather than naming them in the validator?
- Should step 0's clean `Bash` environment be the default immediately (a breaking change in 1.7.0) or opt-in for one release?
