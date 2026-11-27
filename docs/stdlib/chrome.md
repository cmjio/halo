# `Chrome`

A real headless browser tab. Unlike [`Browser`](./tools.md#browser), which only fetches a page's text, `Chrome` runs the page's JavaScript and can click, type, and take screenshots.

```halo
tool Web : Chrome(allow: ["example.com", "*.example.com"], maxChars: 8000)

pipeline Search(term: String) -> Result:
  term
    |> Web.open(url: "https://example.com/search")
    |> Web.fill(selector: "input[name=q]", value: "{{term}}")
    |> Web.press(key: "Enter")
    |> Web.wait(selector: ".results")
    |> Web.text(selector: ".results") as results
```

An agent can use it too (`Agent.task(tool: Web, ...)`): it sees each method below with its arguments, and picks them itself.

| Method | Arguments | Returns |
|---|---|---|
| `open` | `url` | `{ url, title, text }`, after the page loads |
| `click` | `selector`, `timeout_ms` | `{ clicked, navigated, url, title }` |
| `fill` | `selector`, `value` | `{ filled, value, url, title }` |
| `press` | `key` (`"Enter"`, `"Tab"`, `"Escape"`, arrows, or one character), `selector` | `{ pressed, url, title }` |
| `select` | `selector`, `value` (an option's value or label) | `{ selected, label, url, title }` |
| `text` | `selector` (optional) | The page's or element's readable text |
| `html` | `selector` (optional) | The page's HTML, or the element's outer HTML |
| `links` | `limit` (default 200) | `[{ text, href }]` |
| `frames` | | `[{ selector, src, host, title?, sealed? }]`: the page's `<iframe>`s, each with a selector `frame:` can use |
| `wait` | `selector`, `timeout_ms` (default 10000) | `{ selector, found, waited_ms }` (`found: false` on timeout, not an error) |
| `screenshot` | `path` (optional), `fullPage` | `{ path, bytes }`, or `{ image }` with no path: an [image](/guide/files) a model the result reaches is sent |
| `back` | | `{ wentBack, url, title }` |
| `evaluate` | `script` | The expression's value. Only with `allowScript: true` |
| `hand_over` | `reason` | `{ handedOver, url, title, text }`, once a person says they've done it. Only with `headless: false` |
| `fill_secrets`, `fill_secret` | `fields` (selector → wallet ref), or `selector` and `ref` | `{ filled, armed, url, title }` for a personal item; `{ filled, locked, next }` for a card or other secret, after which only `hand_over` works. Only with a [wallet](./wallet.md) |

Selectors are CSS. `click`, `fill`, `press`, `select`, `text`, `html`, `links`, `frames` and `wait` take `frame:` to work inside a frame: a selector for an `<iframe>` in the page, or a list of selectors for a frame inside a frame (`frame: ["#checkout", "iframe[title=\"Card\"]"]`). Cross-site frames, such as a payment provider's, run in their own process and work the same way. `click`, `fill`, `press` and `select` wait up to `timeout_ms` (default 5 seconds) for a visible match, and `click` waits for any navigation it starts. `open`'s `text` and `text`/`html` are capped at `maxChars` (default 15000).

Declaration arguments: `allow:` (hosts), `allowScript:`, `wallet:` (see [The wallet](./wallet.md)), `maxChars:`, `timeout_ms:` (each browser command and page load, default 30000), `idle_ms:` (default 300000), `launch_timeout_ms:` (how long the browser may take to start, default 45000; a cold first start can be slow), `headless:` (default `true`), and `chrome:` (the browser's path).

**Sessions.** Each tool gets one browser per run, with a fresh, empty profile, so `open` → `fill` → `click` → `text` all act on the same tab. Calls on it run one at a time. The browser closes after `idle_ms` without calls, when the runtime closes, and when the process exits; its profile directory is deleted.

## Safety

- Only `http` and `https` pages can be opened.
- `allow:` lists the hosts the tab may be on: `"example.com"` matches that host exactly, and `"*.example.com"` matches its subdomains. `open` refuses any other host. When a click, key press, form submit, redirect or script would take the tab to another host, the request is blocked before it leaves the browser, the tab stays on (or returns to) the previous page, and the call fails with `TOOL_ARGUMENT`. Frames inside an allowed page aren't restricted.
- Links and scripts that open a new tab or window are closed at once; the call's result lists them under `closedPopups`. Use `open` on the link's `href` instead.
- `alert()` dialogs are accepted; `confirm()` and `prompt()` are dismissed, so a page can't get a "yes" by asking. Their messages appear under `dialogs`.
- `click`, `fill`, `press`, `select`, `back` and `evaluate` are marked as **external** effects, since a click can submit a form or buy something; `open`, `text`, `html`, `links`, `wait` and `screenshot` are **read**. Use [policies](./policies.md) to gate the external ones.
- Halo's own page code (finding elements, reading text) runs in an isolated world: it sees the page's DOM but not its scripts, so a page can't change what Halo finds by replacing `document.querySelector` or the like. `evaluate` runs in the page's own world, so a script sees the page's globals.
- `evaluate` runs arbitrary JavaScript in the page, so it doesn't exist (and isn't shown to agents) unless the tool is declared with `allowScript: true`.
- `screenshot` writes only under the current directory, and always as `.png`.
- Every browser command has a timeout.

## Handing over to a person

`hand_over(reason: "...")` asks a person to do a step themselves in the open window (confirm a payment with their bank, type a one-time code, solve a CAPTCHA, press Pay) and waits until they answer "done". It goes through the run's approval path, so in a terminal it asks there, and otherwise the run pauses until it's answered. It needs `headless: false`. Afterwards the call reports where the tab is without sending it back, since the person may have gone to their bank's page.

## What it needs

Chrome, Chromium, Microsoft Edge, or Brave. Halo looks for `chrome:` on the declaration, then `CHROME_PATH`, then the standard install locations on macOS and Linux, then `chromium` / `google-chrome` on `PATH`. If none is found, the call fails with `TOOL_CONFIG`. There is nothing to `bun install`: Halo starts the browser with `--headless=new --remote-debugging-pipe` and talks to it over the Chrome DevTools Protocol on that pipe. There is no debugging port, so no other program on the machine can attach to the browser and read the pages it has open. In a Linux container, install `chromium` (Halo adds `--no-sandbox` when it runs as root).
