# The Wallet

A wallet holds card and personal details that a browser agent can type into a page but never read. The values stay in the macOS Keychain, 1Password or the environment. Models, conversations, telemetry, recordings, paused runs and approval messages only ever see names like `Card.number`.

**Put a virtual card in it.** A card that's locked to one merchant, single-use, or has a low limit (from your bank, Revolut, Privacy, or Stripe Issuing for a business) caps anything that goes wrong at one bad charge with one merchant. Everything below makes that unlikely; a card like that makes it cheap.

```halo
tool Card : Vault(source: "keychain", kind: "card", fields: ["number", "expiry", "cvc", "name"],
                  hosts: ["www.britishairways.com"], pay_via: ["js.stripe.com"])
tool Me   : Vault(source: "keychain", fields: ["full_name", "email", "phone"],
                  hosts: ["www.britishairways.com"], ask: false)
tool Web  : Chrome(headless: false, allow: ["www.britishairways.com"], wallet: [Card, Me])

policy Booking : AllowWallet("Card", "Me")

agent Booker [anthropic/claude-sonnet-4-5, max_steps: 60]
  system "Book the flight described. Use the wallet for passenger and payment details; never ask for them in chat. After filling the card, hand over so the person presses Pay."
  equips Web, Card, Me
  requires Booking

pipeline BookFlight(trip: String) -> Result:
  trip |> Booker.book(tools: auto)
```

```bash
halo wallet add Card number     # typed at a hidden prompt, stored in the Keychain
halo wallet add Card expiry
halo wallet add Card cvc
halo wallet list
```

A person approves the card fill, seeing the item and the exact sites. The browser is then theirs: they check the booking, press Pay and confirm with their bank in the open window, and say "done". The booking agent never learns the number, and never touches the page again after typing it.

## The rule

> A wallet value leaves Halo only as keystrokes into one approved element, on one approved chain of sites.

There is no method that returns a value. `Vault` has one method, `list`, which describes the item.

What happens after typing depends on the item:

- **A secret item (a card, a passport): the browser becomes the person's.** The agent can call only `hand_over`. It can't read the page, take a screenshot, test a selector, click, type or navigate. The person finishes in the window, and when they answer, the browser closes and its profile is deleted. This is a hard guarantee, and it's why secret items need `headless: false`.
- **A personal item (a name, an email, a phone): the browser stays the agent's**, and what the page shows of the value is masked. That's a best effort: a page can re-encode text in more ways than any mask can follow (see [Limits](#limits)). Mark anything that must not leak `secret: true`.

The red-team reviews behind this design, and every attack tried, are in `proposals/halo-wallet.md`.

## `Vault`

Each `Vault` declaration is one item.

| Setting | Means |
|---|---|
| `source:` | `"keychain"` (macOS), `"1password"` (with `vault:`), `"env"`, or `"mock"` (test values) |
| `fields:` | The field names. Each gets the standard `autocomplete` token for its name (`number` on a card is `cc-number`, `email` is `email`, `phone` is `tel`). Give one yourself with `"loyalty:username"`, or none with `"passport_no:off"` |
| `kind: "card"` | A card: always secret, with the card tokens, and a hint such as "Visa ending 4242" |
| `secret: true` | Any other item that must be treated like a card (a passport). Every fill asks, hosts are exact, it can be typed only with `headless: false`, and once it's typed the browser is the person's (see [After a secret](#after-a-secret-the-person-finishes)) |
| `hosts:` | **Required.** The sites the item may be typed on. The top page, and every frame down to the field, must be on one of them (or on `pay_via:`). A secret item takes exact hosts; a personal item may use `*.example.com` |
| `pay_via:` | Payment-frame hosts (`js.stripe.com`, `checkoutshopper-live.adyen.com`). They count only as frames inside a page on `hosts:`, never as the page itself |
| `ask:` | For a personal item, `false` types it without asking. A secret item always asks |
| `hint:` | What the agent may know about the item, if not computed |
| `item:` | The name the source stores it under (default: the declaration's name) |
| `serve: true` | The item may be used under `halo serve` or `halo mcp`, where anyone who can start a run could use it |

`halo validate` refuses:
- an item with no `hosts:`;
- a `*.` host on a secret item;
- a host where anyone can publish a page (`sites.google.com`, `*.github.io`, `*.vercel.app`, `*.myshopify.com` and others), named or covered by a pattern;
- a payment provider's host in `hosts:` instead of `pay_via:`.

That last rule matters because a Stripe card frame is served from `js.stripe.com` on every merchant's site, an attacker's included.

### Sources

| Source | Values come from | Stored with |
|---|---|---|
| `keychain` | `security find-generic-password -s halo-wallet -a <item>.<field> -w` | `halo wallet add`. The item trusts no app, so macOS asks before anything, Halo included, reads it |
| `1password` | `op read op://<vault>/<item>/<field>` | 1Password |
| `env` | `HALO_WALLET_<ITEM>_<FIELD>`. Halo takes these out of its environment when it starts, so no command, package or `Env.X` sees them later. A `.env` file holding them is refused | Your environment |
| `mock` | A Stripe test card (`4242…`, `12/34`, `123`) and stand-ins | Nothing |

A value is read when it's typed and not kept anywhere else.

## Typing: `fill_secrets`

A browser declared with `wallet: [...]` has `fill_secrets(fields: { selector: ref })`, and `fill_secret(selector:, ref:)` for one field (the form a pipeline can write itself):

```halo
|> Web.fill_secret(selector: "#cc", ref: "Card.number", frame: "#payframe")
```

A ref is `Item.field`, with a format for fields sites shape differently: `"Card.expiry:MM/YY"`, `":MM/YYYY"`, `":MMYY"`, `":MM"`, `":YYYY"`, and `"Card.number:1-4"` for one box of a number split across four.

Before anything is typed, every field passes these checks, or nothing is typed:

1. **The ref.** The item is in this browser's wallet, the field exists, and an agent's `AllowWallet` rules cover it.
2. **The chain.** The top page's host is in the item's `hosts:` and the browser's `allow:`. Every frame from the top page down to the field is in `hosts:` or `pay_via:`. Every page in the chain is `https` (or this machine). A sandboxed frame with no origin is refused.
3. **The element.** A visible, enabled `<input>` (text, tel, number, email, password, month) or `<select>`. Not a textarea, an editable region, or a search box.
4. **Its `autocomplete`.** It agrees with the field's token, or says nothing. An element marked `autocomplete="email"` won't take `Card.number`.
5. **A person approves.** Every fill of a secret item, and a personal one unless it says `ask: false` and no `ApproveWallet` rule asks.

Then Halo checks the page again. If the frames, their URLs or the elements changed while the person decided, nothing is typed. For each field it then:
- focuses that exact element and checks it has focus;
- reads the value from the source and types it;
- checks focus didn't move while typing.

If the page moved focus during typing, the value may have gone into another element: the run stops with `WALLET_INCIDENT`, and the browser is closed.

### Payment frames

Card fields are often in a payment provider's frame. `frames` lists a page's frames with a selector for each, and `frame:` works inside one:

```halo
|> Web.frames()
|> Web.fill_secret(selector: "#cardnumber", ref: "Card.number", frame: "iframe[title=\"Secure card number input frame\"]")
```

## After a secret: the person finishes

Once a secret item is typed, every call except `hand_over` fails with `WALLET_LOCKED` and tells the agent to hand over. `fill_secrets` returns `{ filled, locked: true, next }`, with nothing about the page, not even its title.

`hand_over(reason: "...")` asks the person to check the page and finish in the open window. Their answer is all the agent gets back: `{ handedOver: true, closed: true }` for "done", or `{ handedOver: false, said: "…", closed: true }` with what they typed (a booking reference, or what went wrong). Then the browser closes and its profile is deleted, so nothing typed stays anywhere. `--auto-approve` and `halo test` can't answer it, except for the `mock` source.

So fill every other field first, and the card last; several fields, a card's and a person's, can go in one `fill_secrets`.

Why so strict: earlier versions let the agent keep reading the page with typed values masked, and a red team got the card out more than 20 ways, without ever breaking the mask's own logic. The page did the work: reversing digits with CSS, drawing them in a canvas or a shadow root, full-width digits, entities, one digit per element, a class per digit, prefix tests on a mirrored `aria-label`, a form posting to another host, a `select` that submits. A locked browser offers none of that to an agent.

## After a personal item: masked, best effort

A personal item leaves the browser to the agent, with these rules from the first value typed until the browser closes:

| | |
|---|---|
| The filled field | `text` returns `[sealed Me.email]`; `html` shows `value="[sealed Me.email]"`; `fill`, `select` and keys other than Enter and Tab are refused |
| Everything read from a page | Before `text`, `html`, `links` or a page summary reads anything, Halo blanks typed values (6 or more characters) in the whole document, text and attributes alike, and puts the page back afterwards, in one step the page can't run during. Text is normalized first (digits of any script, full-width forms, zero-width characters, entities and percent-encoding), a number is found with up to 8 characters or tags between its digits and by any 8 of its digits in a row (a phone in national format), and a name across line breaks. What's returned is masked again, then cut to `maxChars` |
| Selectors | Element names, `#id`, and exact attribute tests on `[name]`, `[type]`, `[autocomplete]`, `[role]`, `[for]`, `[placeholder]`, `[aria-label]`, `[aria-labelledby]`, `[data-testid]`, `a[href]` and `iframe[title]`, with `:nth-child()`, `:first-child`, `:not()`, `:is()` and `:where()`. No `.class` and no partial tests (`^=` `*=` `$=` `~=` `\|=`): a page derives classes and labels from what's typed, and a partial test answers a guess a character at a time |
| `screenshot` | Refused: a page can draw a value where no check of its text can see it |
| `evaluate` | A browser with a wallet can't have `allowScript: true` |

Selectors are parsed by Halo, escapes and all, and Chrome is given Halo's canonical form, so what Chrome matches is exactly what was checked.

### Each submission asks

While the page a personal value was typed into is still loaded (even if it re-drew the field), or a sealed field is still in a page, a `click`, or pressing Enter or Space, may submit it. Each one asks a person first, and one approval allows one submission. If a form holding the value would send it to a host its item doesn't allow (its `action`, or a button's `formaction`), the submission is refused; otherwise the question says where the form sends. A control character (`"\r"`) isn't accepted as a key.

## The question a person sees

```
Booker wants to type Card (Visa ending 4242): number, expiry, cvc (policy Booking)
  page     britishairways.com       https://www.britishairways.com/checkout
  field in stripe.com               https://js.stripe.com/v3/elements-inner-card.html  (payment frame, inside britishairways.com)
```

It's built from what Halo checked, not from anything the page wrote (no page title). An `ApproveTools` or `ApproveEffects` rule on the call is folded into this one question.

Who can answer:
- `--auto-approve` and `halo test` answer only for the `mock` source; a mock for `"approval"` likewise.
- Under `halo serve`, a wallet question can't be answered from a signed approval link or a Slack button, since anyone holding one could answer. Use Studio, signed in with the server's token, or the API.
- `onInterrupt` in your own code can answer.

A run that pauses keeps its browser open for the answer, for up to `approval_hold_ms` (default an hour). A resumed run types only if the page is the same one that was approved.

## The program around a wallet

A program (a `.halo` file and what it imports) that has a browser with a wallet can't also have a tool that runs commands or code as you, because such a tool could read the Keychain, 1Password or the environment directly:
- `Bash` and `Code`;
- `Remote` over SSH (Docker, E2B and Daytona sandboxes are fine);
- `Git`;
- `Workspace` with `write:`, or a folder outside the project or not written out (`Env.X`);
- `Remote` sandboxes with a `from:` or `root:` outside the project;
- an `MCP` server, unless its `url:` is written out as an `http(s)` address or it's declared `wallet_safe: true` (`url: null` or an unset `Env.X` starts a local command).

These are checked when the program loads, so a pipeline that never uses the browser can't run them either. A folder written as `"./docs"` that is really a link out of the project is caught when a run starts. `Git` counts too, since git runs a repository's hooks.

Research with a shell in one file, and book with a wallet in another.

`halo validate` also refuses wallet use where it would run more than once:
- inside `|*` or `|* each` (best-of-N is a fan-out);
- in the stages a `|<> loop` runs again;
- in a pipeline or agent with `@retry`.

Inside a branch arm it warns, since the stage can't pause there for a person.

## Policies

| Rule | Means |
|---|---|
| `AllowWallet("Card", "Me.email", ...)` | The items or fields an agent may use. Without it, an agent can type nothing from a wallet, though it can call `Vault.list`. Every `AllowWallet` rule on the agent must allow a ref |
| `ApproveWallet("Me.address", ...)` | Ask for these even where the item says `ask: false` |

They take `Item`, `Item.field`, `Item.*` and `*`. A pipeline's own calls aren't limited by them; the person approving still is.

## Plans, replays, and `halo evolve`

- `halo plan` shows `fill_secrets` as a `wallet` effect that asks.
- A recording keeps the sealed results, so a replay types nothing; `--live-tools` types for real and asks again.
- The fence (`halo compare`, `halo evolve`) treats any change to what an agent with a wallet is told, or to a call that types from one, as outside it. A person must read that change.

## `halo wallet`

| Command | Does |
|---|---|
| `halo wallet add <Item> <field>` | Reads the value at a hidden prompt, twice (or from stdin with `--stdin`), checks it (a card number's check digit, an expiry's shape, a CVC's length; `--force` skips that), and stores it in the Keychain with its hint. It's handed to `security` on its standard input, never on a command line |
| `halo wallet list` | Each Vault: its source, which fields are set or missing, its hint. Never a value |
| `halo wallet remove <Item> [field]` | Removes values from the Keychain |
| `halo wallet check [files]` | The declarations, the program around them, and missing fields |
| `halo wallet log` | The audit log: each fill, refusal, decline, submission and incident, with the chain of sites and who acted. Never a value |

The audit log is `.halo/wallet.log` (`<stateDir>/wallet.log` under `halo serve`), and each entry is also a `wallet` telemetry event.

## The browser it types in

A browser with a wallet runs in incognito mode, so it writes no session file, history or disk cache: without that, Chrome saves an open page's form contents to the profile on a timer, card number included. Autofill, saved cards, saved passwords and form history are also turned off. The profile is deleted when the browser closes, and profiles left behind by a Halo that was killed are removed the next time a wallet browser starts.

## Limits

- **Personal items are masked, not locked.** Text masking can't follow every encoding a page might use. Known gaps: values under 6 characters (a CVC, an expiry, a ZIP code) aren't masked as text; look-alike letters from other alphabets; an email spelled out ("ada (at) example.com"); a name reordered ("Lovelace, Ada"); a page that shows part of a number (the first 6 and last 4 digits); classes a page derives from what's typed (a card brand, a length). A value that must not leak belongs in a `secret: true` item, which locks the browser.
- **The `env` source and other programs.** Halo removes `HALO_WALLET_` values from its environment when it starts, and wipes them from the process's own environment block so `ps eww` can't show them. But Bun keeps the environment it started with for any process started without an explicit environment: Halo's own processes pass one, but code in an installed package that starts processes may not. Use the Keychain or 1Password on a machine you share with other software.
- A page script that moves focus while a value is typed is detected afterwards: the run stops, but the value may already be in another element on that merchant's page.
- Anything else running as you can use `security` or `op` as you. The Keychain prompt and 1Password's Touch ID are the guard there, for interactive use.
- Packages that run their own code (`halo install --trust`) run as you too; a wallet program trusts them as it trusts its own code.
- A merchant's own page can do anything with what is typed into it, by design: that's why `hosts:` names it, and why a virtual card limits the damage.
