# Halo OAuth: tools that act as an account, with tokens the run never holds

| | |
|---|---|
| Status | Draft proposal. Nothing here is built. |
| Date | 27 November 2026 |
| Builds on | The mail provider's token refresh (`src/runtime/mail/provider.ts`), REST and package http providers, `MCP` over HTTP, the trust file (`src/registry/trust.ts`), the wallet's Keychain and 1Password sources, signed approval links, `\|! yield` and paused runs, `@checkpoint`, idempotency keys, `halo plan` |

This lives outside `docs/` because everything under `docs/` is published to halolang.com.

New commands, settings and error codes here (`halo auth`, `OAuth(...)`, `AllowAuth`, `AUTH_REQUIRED`, `/connect/...`) are placeholders.

## Summary

Most services a pipeline wants to act on (Google Drive, Microsoft 365, Notion, Linear, Salesforce, hosted MCP servers) want OAuth, not an API key. Halo can only take a token someone pasted into the environment. Tokens pasted that way expire within an hour, and nothing refreshes them, so long or paused runs fail.

This proposal adds one way to sign tools in:

- **`OAuth` is a declaration** that names a provider, a client, a grant and scopes. REST tools, package tools and `MCP` take it with `auth:`.
- **One token broker** gets, caches, refreshes and stores tokens for every tool, including mail (whose `oauthToken` moves into it). It refreshes before expiry and retries once after a 401.
- **Tokens live outside the project**, in the Keychain, the Linux secret service or a 0600 file under `~/.config/halo`, or 1Password. Never in `.halo/`, checkpoints, recordings, traces or Studio.
- **`halo auth login <Tool>`** connects an account in the browser (loopback redirect, PKCE) or with a device code on a headless machine.
- **A run that loses its connection pauses** with `waitingFor: "connect Drive"` instead of failing, and resumes once someone reconnects, from the terminal, Studio, an approval page or Slack.
- **The model never sees or sets auth.** A token goes only to its tool's origin, as a header the runtime adds after the model's arguments are checked.

Multi-user `halo serve` (each person's own Drive) needs user identity first, so it is the last phase.

## What exists today

- **Mail is the only OAuth.** `oauthToken()` (`src/runtime/mail/provider.ts:128-140`) posts a form to a token endpoint and caches the access token in a module-level `Map`, until 60 seconds before `expires_in`. Gmail uses the refresh token grant (`:146-156`). Outlook uses a refresh token or client credentials (`:159-177`). SMTP and IMAP send the token as XOAUTH2 (`src/runtime/mail/smtp.ts:70`, `src/runtime/mail/imap.ts:72`). The refresh token comes from the declaration, so someone had to get it by hand. A rotated refresh token in the response is dropped.
- **Everything else is a static token.** Slack and GitHub read `token:` or `apiKey:` (`src/runtime/integrations.ts:35-39`). REST sends `apiKey:` as a Bearer header (`src/runtime/tools.ts:209-212`). Package http providers have `HttpAuth` with `bearer | header | query | basic | none` (`src/registry/manifest.ts:32-40`, applied at `src/registry/providers.ts:84-91`). `MCP` over HTTP sends `apiKey:` as Bearer plus any `headers:` (`src/runtime/mcp.ts:482-487`). A 401 from an MCP server only adds "check the tool's apiKey:" to the error (`src/runtime/mcp.ts:283`).
- **`Env.*` is read at each call** (`src/runtime/runtime.ts:1811`), so a resumed run sees the current value. That's why "refresh it outside Halo and resume" works today, but only by hand.
- **REST keeps a request under the tool's URL** (`src/runtime/tools.ts:197-202`), and package providers do the same (`src/registry/providers.ts:79-80`). The broker can rely on that for "only the tool's origin".
- **Things to reuse:**
  - The trust file lives outside the project, in `~/.config/halo/trust.json` or `$XDG_CONFIG_HOME/halo/trust.json`, so a repo can't grant itself trust (`src/registry/trust.ts:5-21`).
  - The wallet stores values in the macOS Keychain through `security -i`, with the value on stdin, never argv (`src/wallet-cli.ts:155-180`), and reads 1Password with `op` (`src/runtime/wallet.ts:259-266`).
  - Approval links are HMAC-signed per run and pause (`src/serve/server.ts:400-410`). They have no expiry and aren't single-use; they don't need to be, because a pause is answered once.
  - Paused runs (`waitingFor`, `src/runtime/runtime.ts:225-227`), `halo resume`, `@checkpoint`, `halo rewind`.
  - Each tool call has an idempotency key derived from the run's (`src/runtime/runtime.ts:206-208`). Mail uses it as the Message-ID.
- **`halo serve` has one token** (`HALO_SERVE_TOKEN`, `src/serve/server.ts:340`) and no idea who a person is. Slack requests are verified as coming from Slack (`:1188`), not as coming from a particular user Halo knows.
- **`halo plan` shows effects and approvals** (`src/plan.ts:43`, `:111-125`), not auth, accounts or scopes.

## Goals

- Connect a tool to an account once, and have every run use it until someone disconnects it.
- Runs of any length, including ones paused for days, keep working, or pause and say what they need.
- An access or refresh token never reaches a model, a prompt, a log, a recording, a snapshot, a trace, Studio, an approval message or another tool.
- A token goes only to the origin of the tool it was issued for.
- `halo plan` and `halo validate` say which account each tool acts as, with what scopes, until when.
- One implementation for every kind of tool, so the security rules are written and tested once.

## Non-goals (for now)

- Halo as an OAuth server. Serving pipelines over MCP with OAuth is a separate question.
- SAML, Kerberos, mTLS client certificates, DPoP. DPoP may come later; see [Open questions](#open-questions).
- The implicit grant and the password grant. OAuth 2.1 drops both.
- Bundling client ids for every service. A few presets, and packages may ship theirs.
- Token exchange (RFC 8693) and on-behalf-of flows.

## Design

### 1. The `OAuth` declaration

Halo's declarations take strings, numbers, references and lists, not nested calls or records (`src/parser/types.ts:41-52`). So `auth: OAuth(...)` inline would need a grammar change. Like the wallet's `Vault` (`Chrome(wallet: [Card])`), the OAuth connection is its own declaration and tools name it:

```halo
tool Google : OAuth(
  provider: "google",
  clientId: Env.GOOGLE_CLIENT_ID,
  clientSecret: Env.GOOGLE_CLIENT_SECRET,
  grant: "authorization_code",
  scopes: ["https://www.googleapis.com/auth/drive.readonly"]
)

tool Drive : REST("www.googleapis.com/drive/v3", auth: Google)
```

One declaration is one connection: one client, one grant, one set of scopes, one account. Several tools can share it (`Drive` and `Sheets` both on `Google`). A tool takes `auth:` or `apiKey:`, not both; the validator says so.

Settings:

| Setting | Meaning |
|---|---|
| `provider:` | A preset (`"google"`, `"microsoft"`, `"github"`, `"slack"`, `"notion"`), which fills in the endpoints and issuer. Or leave it out and give `issuer:` (discovered by RFC 8414) or `authorizeUrl:`, `tokenUrl:` and `deviceUrl:` |
| `clientId:` | The app's client id. Usually `Env.X`, but it is not a secret |
| `clientSecret:` | Only for confidential clients. Desktop and CLI apps are public clients and have none |
| `grant:` | `"authorization_code"` (a person signs in, default), `"client_credentials"` (the app is the account), `"device"` (a person signs in on another device) |
| `scopes:` | The scopes asked for. The plan's source of truth |
| `audience:` / `resource:` | RFC 8707 resource indicator, where a provider uses it |
| `tenant:` | For the `microsoft` preset |
| `as:` | `"service"` (default) or `"invoker"`; see [multi-user](#9-multi-user-halo-serve) |
| `store:` | `"default"`, `"keychain"`, `"secret-service"`, `"file"`, `"1password"`; see [storage](#3-where-tokens-live) |

A client credentials connection is fully described by its declaration and secret, so it needs no login:

```halo
tool Graph   : OAuth(provider: "microsoft", tenant: "contoso.com", grant: "client_credentials",
                     clientId: Env.GRAPH_CLIENT_ID, clientSecret: Env.GRAPH_SECRET,
                     scopes: ["https://graph.microsoft.com/.default"])
tool Sharepoint : REST("graph.microsoft.com/v1.0/sites", auth: Graph)
```

**Mail.** `Email(via: "gmail")` and `"outlook"` take `auth:` too. Their current `refreshToken:` and `clientId:` settings keep working, read through the broker, and `halo migrate` offers the `auth:` form.

**Packages.** A package's http provider gains a fifth `HttpAuth` type:

```json
"auth": {
  "type": "oauth",
  "authorizeUrl": "https://api.notion.com/v1/oauth/authorize",
  "tokenUrl": "https://api.notion.com/v1/oauth/token",
  "deviceUrl": null,
  "issuer": null,
  "scopes": [],
  "clientId": "c0ffee-public-id",
  "pkce": "S256"
}
```

The consumer then writes `tool Notion : notion()` and runs `halo auth login Notion`, with no `OAuth` declaration. The tool is its own connection, built from the manifest. A consumer may override with `notion(auth: MyNotion)` to use their own client. The installer shows the endpoints and scopes, as it shows `auth.env` today (`src/registry/install.ts:254`). The endpoints must be `https` and must be on the package's `baseUrl` host or a host the manifest lists in `authHosts`, which install shows.

**MCP.** An HTTP MCP server either takes a declared connection, or discovers one (section 8):

```halo
tool Linear : MCP(url: "https://mcp.linear.app/mcp", auth: "discover", scopes: ["read"])
tool Docs   : MCP(url: "https://docs.internal/mcp", auth: InternalSSO)
```

Stdio MCP servers do their own auth and don't take `auth:`.

### 2. The broker

One module, `src/runtime/oauth/broker.ts`, owns every token. Providers ask it for a header, never for a token:

```ts
interface TokenBroker {
  /** The Authorization header for this connection, valid for at least `minValidMs`. Throws AuthRequired. */
  header(conn: Connection, opts: { origin: string; minValidMs?: number; signal?: AbortSignal }): Promise<string>;
  /** After a 401: drop the cached access token, refresh once, return a new header or throw AuthRequired. */
  rejected(conn: Connection, header: string, wwwAuthenticate?: string): Promise<string>;
}
```

What it does:

- **Cache.** Access tokens are held in memory per connection and account. The store holds them too, so the next run (or another process) doesn't refresh needlessly.
- **Proactive refresh.** It refreshes when less than 60 seconds or 10% of the lifetime is left, whichever is longer. 60 seconds is mail's margin today.
- **One retry after a 401.** The provider calls `rejected()`. The broker refreshes (unless another call already did) and the provider sends the request once more with the same idempotency key. A second 401 is `AUTH_REQUIRED`. A 401 means the server refused before acting, so the retry doesn't do anything twice. A 403 is not retried: it's a missing scope or permission, not a stale token. It is reported with the scopes the connection has.
- **Refresh failures.** `invalid_grant` (revoked, expired, password changed) is `AUTH_REQUIRED`: the run pauses (section 6). A network error or a 5xx from the token endpoint is retried with backoff like any tool error, and is never treated as a revoked grant.
- **Rotation.** If the response has a new `refresh_token`, it replaces the old one before the access token is used (section 3).
- **`client_credentials`** has no refresh token. The broker asks again when the token expires, holding the client secret only for that call.
- **Origin binding.** Each connection knows the origins it may send to: the tool's URL origin, plus for MCP the resource from its metadata. `header()` refuses any other origin. Providers request with `redirect: "manual"` and follow only same-origin redirects with the header; a cross-origin redirect is followed without it, or refused for MCP. We shouldn't rely on what Bun's `fetch` strips on redirect.
- **Concurrency inside one process.** One refresh per connection at a time. Other calls wait for its result.

Mail's `oauthToken()` and its `tokens` map go away; `gmailToken()` and `graph()` call `broker.header()`.

### 3. Where tokens live

Never in the project. Not in `.halo/`, `halo.json`, `halo.lock`, checkpoints, paused-run snapshots, recordings, the trace, telemetry, Studio's API or error messages. A test asserts this for a token's full value and its last 12 characters (as the wallet's tests do).

| Store | Where | Default on |
|---|---|---|
| `keychain` | macOS Keychain, service `halo-oauth`, through `security -i` with the value on stdin (as `src/wallet-cli.ts:155` does) | macOS |
| `secret-service` | libsecret over D-Bus (`secret-tool store`, value on stdin) | Linux with a session bus and an unlocked keyring |
| `file` | `~/.config/halo/oauth/<key>.json`, mode 0600, directory 0700, owner checked on read | Linux without a keyring, containers, CI |
| `1password` | An item per connection, read with `op read`, written with `op item edit` | Opt in |
| `env` | `HALO_OAUTH_<TOOL>_REFRESH_TOKEN`; read only, never rotated back | Opt in, for CI with a long-lived token |

`HALO_OAUTH_DIR` moves the file store, like `HALO_TRUST_FILE`. `halo serve` adds a store backed by its state database, encrypted with a key outside it (section 9).

**What is stored**, per entry: issuer, client id, the account's subject and display name (from the ID token or a userinfo call), granted scopes, the refresh token, the access token and its expiry, when it was connected and by whom. The refresh token and access token are the only secrets. Everything else is also written to an index file (`~/.config/halo/oauth/index.json`) so `halo auth list` and `halo plan` work without unlocking the Keychain.

**The key** is the project's real path, the connection's name, the issuer, the client id, and the Halo user (always `local` until section 9). Keyed by project like the trust file, so one repo's pipeline can't use a connection another repo made just by declaring the same name. See open questions for sharing across projects.

**Rotation must be atomic, across processes.** Providers that rotate refresh tokens (Microsoft, Okta, Auth0, most OAuth 2.1 servers for public clients) may treat reuse of an old one as theft and revoke the whole grant. Two runs refreshing at once would do exactly that. So a refresh takes a lock:

1. Take `~/.config/halo/oauth/<key>.lock` (`open` with `O_EXCL`, holding pid, host and start time; stale after 30 seconds or when the pid is gone, like the wallet's stale-profile sweep).
2. Read the store again. If another process already refreshed and the token is fresh, use it and release.
3. Refresh. Write the new refresh token and access token in one write: a single Keychain item update, or a temp file, `fsync` and `rename` for the file store.
4. Release.

If the write in step 3 fails after the provider rotated, the old refresh token is dead and the new one is lost. The broker says so plainly and the connection becomes "needs reconnect". This is rare and can't be avoided without the provider's help.

### 4. The CLI: `halo auth`

```
halo auth login  <Tool> [--device] [--no-browser] [--file app.halo]
halo auth logout <Tool> [--revoke]
halo auth list   [--file app.halo]
halo auth status <Tool>
```

`login` (authorization code):

1. Generate `state` (32 random bytes) and a PKCE verifier, `S256` always. A provider whose metadata doesn't list `S256` is refused unless the declaration says `pkce: "none"`, which `halo validate` warns about.
2. Listen on `127.0.0.1`, a random port, path `/callback/<random>`. Not `localhost`, which may resolve to `::1` or be rebound. The redirect URI is `http://127.0.0.1:<port>/callback/<random>` (RFC 8252 says loopback redirects may use any port, and Google, Microsoft and GitHub allow it for desktop clients).
3. Open the browser (or print the URL with `--no-browser`).
4. Accept **one** request. Check its path and `state` with a constant-time compare, then close the listener. Anything else gets a 400 and doesn't count. A `Host` header other than `127.0.0.1:<port>` is refused.
5. Time out after 5 minutes.
6. Exchange the code with the verifier. Check `iss` in the response if the server sent one (RFC 9207), and the ID token's `iss` and `aud` if there is one.
7. Store the token. Print the account and the granted scopes, and warn if they are wider than declared (section 5).

`login --device` (RFC 8628) prints a URL and a user code, then polls the token endpoint at the server's `interval`, backing off on `slow_down`. It's the default when there's no display (`$DISPLAY` and `$WAYLAND_DISPLAY` unset on Linux, or `SSH_CONNECTION` set). A connection declared `grant: "device"` always uses it.

`logout` deletes the entry; `--revoke` also calls the provider's revocation endpoint (RFC 7009) if it has one. `list` shows every connection in the file and its state: connected (account, expiry), not connected, needs reconnect, service (client credentials). `status` shows one, and checks it with a refresh.

`login` needs a terminal or an open browser. Under `halo serve` the same flow runs through `/connect` (section 7).

### 5. `halo plan` and `halo validate`

`halo plan` gains an auth section:

```
Auth
  Drive, Sheets   Google (authorization_code)   chris@example.com
                  drive.readonly                 access token expires in 41 min, refresh token kept
  Sharepoint      Graph (client_credentials)    app 7c1f... in contoso.com
                  .default                       service
  Linear          discovered: mcp.linear.app     not connected   run: halo auth login Linear
```

It reads the index file, not the store, so it doesn't need to unlock anything or call the provider.

`halo validate`:

- **Error:** `auth:` naming something that isn't an `OAuth` declaration; `auth:` with `apiKey:`; `as: "invoker"` outside `halo serve` with identity (section 9); a non-`https` endpoint other than loopback.
- **Warning, wider than declared.** Providers can grant more than asked (Google's incremental auth with `include_granted_scopes`, a GitHub token's existing scopes, a reused grant). When the granted scopes, recorded at login, are wider than `scopes:`, validate warns and names the extra ones. `--strict` makes it an error. Only the declared scopes are sent on refresh, where the provider supports narrowing.
- **Warning, narrower than declared.** Probably a person unticked a box at consent; the tool will get 403s.
- **`--strict`:** a connection that isn't connected, for a pipeline that is about to run.

A policy rule limits which connections an agent's tools may use, for symmetry with `AllowSecrets`:

```halo
policy DriveOnly : AllowAuth("Google")
```

### 6. Runs and time

A connection can stop working mid-run: the refresh token was revoked, expired (Google's refresh tokens for apps in "testing" expire after 7 days), or the person changed their password. Today that's an `HttpError` and the run fails, after the work already done.

With the broker, `AUTH_REQUIRED` from a tool call **pauses** the run at that call:

```
status:     paused
waitingFor: connect Google
message:    Google (chris@example.com) needs signing in again: the refresh token was revoked.
```

- The paused run's snapshot holds the connection's name and why, not a token.
- `halo resume <runId>` checks the connection first. If it's still not connected, it says so and stays paused. `halo auth login Drive` followed by `halo resume` continues.
- Under `halo serve`, the pause appears in Studio and on the approval page with a Connect button (section 7).
- **The call runs again from the start**, with the same idempotency key. The call that failed never reached the service (a 401 is refused before any action), so it's safe. Mail already uses the key as the Message-ID, so a resent message is the same message.
- **Fan-outs.** If 50 items of a `|* each` hit `AUTH_REQUIRED`, the run pauses once. Items that finished keep their results.
- **`@checkpoint`, `halo rewind` and `halo replay`** never hold tokens, so they work across reconnects. A rewound run uses whatever is connected now. Replay uses recordings and needs no auth, unless `--live-tools`.
- **Account changes.** If someone reconnects with a **different account** than the one the run started with (the subject differs), the run doesn't resume silently. It asks (`|! yield`, built-in): "Drive was chris@example.com when this run started and is now ops@example.com. Continue?". The run records the subject at its first call.
- **Scope changes.** If the declaration's scopes changed between the start of a run and its resume (a deploy in between), the run resumes on the declaration it started with, as paused runs already do. If the stored grant no longer covers those scopes, it pauses again for reconnect.
- **Timeouts.** A run paused for auth waits like any pause. `serve` may give these pauses their own expiry (`authPauseTimeout`), after which the run fails with `AUTH_REQUIRED`.

`halo run` in a terminal doesn't pause; it offers to sign in on the spot ("Google needs signing in. Open the browser? [Y/n]"), then continues. `--no-interactive` and CI fail with the error and the command to run.

### 7. Connecting mid-run

A pipeline can ask for a connection before it needs it, so a person signs in at the start instead of an hour later:

```halo
pipeline Weekly() -> Result:
  |! yield(connect: Google, msg: "Connect the Google account whose Drive you want summarised")
  |> Drive.list(q: "'root' in parents")
  ...
```

`yield(connect: X)` passes at once if `X`'s connection works (it does a refresh to check), and otherwise pauses with `waitingFor: "connect X"`. The response stored at `context.data.yield` is `{ connected: true, account: "chris@example.com" }`, never a token. The account's display name is the only thing about the connection a pipeline or model can see.

**The `/connect` link.** Under `halo serve`, the paused run gets a link:

```
https://halo.example.com/connect/<runId>/<pauseId>?sig=<hmac>&exp=<unix>
```

- Signed with the serve signing key over `connect:<runId>:<pauseId>:<connection>:<exp>`, like approval links (`src/serve/server.ts:410`) with the connection and an expiry added.
- **Short-lived:** 15 minutes by default. Studio and Slack make a fresh one each time it's shown.
- **Single-use:** the server records its `sig` when the person is sent to the provider; a second use is refused. The OAuth `state` is tied to that use.
- **Bound to the run's owner.** Without identity (today), the link is a bearer credential like an approval link, and whoever opens it chooses the account the run acts as. That's acceptable only for service connections owned by the operator, so **without identity, `/connect` works only for `as: "service"` connections and only from Studio with the serve token**, never from Slack or an unauthenticated approval page. With identity (section 9), the link works only for the person who started the run, or for the connection's named owner.
- The redirect URI is `https://<publicUrl>/connect/callback`, one fixed path. It must be registered with the provider, and `publicUrl` must be set; without it, `/connect` is off and the pause says to run `halo auth login` on the host.
- The callback checks `state` (one-time, stored server-side for 10 minutes), the PKCE verifier and the issuer, stores the token, and resumes the run.

In Slack, the pause message gets a Connect button that opens the link in the browser. Slack never sees the token or the code.

### 8. MCP authorization

The MCP specification (2025-06-18 and later) says how an HTTP MCP server asks for OAuth. `auth: "discover"` implements the client side:

1. The first request without a token gets `401` with `WWW-Authenticate: Bearer resource_metadata="https://.../.well-known/oauth-protected-resource"`.
2. Halo fetches the protected resource metadata (RFC 9728). Its `resource` must equal the MCP server's URL (origin and path, normalized). It lists `authorization_servers`.
3. Halo fetches each authorization server's metadata (RFC 8414, falling back to OpenID Connect discovery). Its `issuer` must equal the URL it was fetched from.
4. If the declaration has no `clientId`, Halo registers one with dynamic client registration (RFC 7591), as a public client with a loopback redirect. The registration is stored with the connection.
5. Login runs as in section 4, with `resource=<MCP URL>` on the authorize and token requests (RFC 8707), so the token is only good for that server.
6. Every request sends the token. A later `401` with `error="insufficient_scope"` and a `scope` parameter means the tool needs more; that is a reconnect with the new scope list, which a person approves. Halo never widens scopes on its own.

**Risks, and the checks for them:**

- **Phishing.** A malicious or compromised MCP server can point at any authorization server, including one that looks like Google. The person sees a real-looking sign-in page. So `halo auth login` shows the authorization server's host before opening the browser, and `halo plan` shows it. With `--strict`, the authorization server must be on the MCP server's registrable domain or listed in the declaration (`authServers: ["auth.linear.app"]`). Package MCP servers pin it in the manifest.
- **SSRF.** Discovery makes Halo fetch URLs a server chose. Under `halo serve` that's a request from inside the network. Discovery URLs must be `https`, must not resolve to loopback, link-local, private or metadata addresses (169.254.169.254) unless the declaration's own URL does, get no cookies or credentials, follow no redirects, have a 5 second timeout and a 64 KB size cap. The resolved address is the one connected to, so DNS rebinding can't swap it.
- **DCR abuse.** A registration endpoint can return anything. Halo keeps only `client_id` (and `client_secret` if given), checks the returned `redirect_uris` match what it sent, and never sends a registration anything about the person.
- **Token passthrough.** The MCP spec forbids a server passing the client's token on to other services. Halo can't check that; the resource indicator limits what a stolen token can do. The docs say so.
- **Mix-up.** With several authorization servers, a code from one could be sent to another. The broker keeps the issuer with `state` and checks `iss` on the response (RFC 9207) where the server supports it.

The existing MCP 401 hint (`src/runtime/mcp.ts:283`) becomes: with `auth:`, `AUTH_REQUIRED` and a pause; without it, "this server wants OAuth: add `auth: "discover"` and run `halo auth login <Tool>`" when the 401 has a `resource_metadata`.

### 9. Multi-user `halo serve`

"Each person's own Drive" needs Halo to know who a person is. Today it doesn't: there's one token, and approval links and Slack buttons are answered by whoever has them. So this comes last, and in two steps.

**First, identity.**

- **Studio** signs people in with OIDC (any issuer: Google Workspace, Entra, Okta), configured in `halo.json` under `serve.identity`. Sessions are cookies (`HttpOnly`, `Secure`, `SameSite=Lax`), and the serve token stays for the API and scripts.
- **Slack** users are known by their verified Slack user id from the signed request, mapped to an identity by email through Slack's API or a table in `serve.identity.slack`.
- **API callers** pass a consumer key that maps to a person, as consumer keys do today.
- Every run records `owner`: the identity that started it, or `service` for schedules, watches and webhooks.

**Then, per-person tokens.**

```halo
tool MyDrive : OAuth(provider: "google", as: "invoker", clientId: Env.GOOGLE_CLIENT_ID,
                     scopes: ["https://www.googleapis.com/auth/drive.file"])
tool TeamBot : OAuth(provider: "slack", as: "service", ...)
```

- `as: "service"`: one token, owned by the operator, used by every run. The only kind allowed without identity, and the only kind schedules, watches and webhooks can use.
- `as: "invoker"`: the token of the run's owner. A run owned by `service` that reaches an invoker connection is a validation error, caught by `halo validate` from the trigger.
- Tokens are stored per (connection, person) in the serve state database, encrypted with AES-GCM under a key kept outside it (`HALO_OAUTH_KEY`, or the Keychain on macOS). Deleting a person deletes their tokens.
- A person manages their own connections at `/me/connections` in Studio: connect, see scopes, disconnect.
- Approving a run doesn't lend the approver's tokens to it. The run uses its owner's.

### 10. What the model and the pipeline can see

- `auth:` is a declaration setting, never a call argument. The constrain step (`src/runtime/runtime.ts:2432`) drops `auth`, and any `Authorization` or `Cookie` header a call passes, before the provider runs.
- An agent's tool schema doesn't mention auth.
- Errors say "Drive needs signing in", with the connection name and account, never the token, code, or the token endpoint's response body (it can echo the refresh token).
- The broker's own HTTP calls are not tool calls: they aren't recorded or traced, except as `auth_refreshed` / `auth_required` events with the connection name.
- `Env.*` can't hold a connection: `auth: Env.X` is a validation error.

## Example

```halo
tool Google : OAuth(provider: "google", clientId: Env.GOOGLE_CLIENT_ID,
                    scopes: ["https://www.googleapis.com/auth/drive.readonly",
                             "https://www.googleapis.com/auth/gmail.send"])
tool Drive  : REST("www.googleapis.com/drive/v3", auth: Google)
tool Mail   : Email(via: "gmail", auth: Google, from: "chris@example.com")

agent Summariser [anthropic/claude-sonnet-4-5]
  equips Drive

@checkpoint
pipeline Weekly() -> Result:
  |! yield(connect: Google, msg: "Connect your Google account")
  |> Drive.list(q: "modifiedTime > '2026-11-20'") as files
  |> Summariser.summarise("Summarise this week's changes to these files.", [context.data.files]) as summary
  |> Mail.send(to: "team@example.com", subject: "This week", body: context.data.summary)
```

```
$ halo auth login Google
Opening accounts.google.com to connect Google (2 scopes)...
Connected chris@example.com. Granted: drive.readonly, gmail.send.
$ halo run weekly.halo Weekly
```

## Threat model

| Attack | What stops it |
|---|---|
| A prompt injection asks the agent to send the token somewhere | The agent never has it. The header is added after the arguments are checked, and only for the tool's origin |
| The agent passes `headers: { Authorization: ... }` or a URL on another host | Auth headers are stripped from arguments; REST and package tools refuse URLs outside the tool's URL |
| A cross-origin redirect carries the token away | `redirect: "manual"`; the header only goes to the connection's origins |
| A repo declares a connection with the same name as one in another project, to use it | Store keys include the project's real path |
| A repo changes `authorizeUrl` or `tokenUrl` to steal codes or refresh tokens | The stored token is keyed by issuer and client id. A changed endpoint is a different connection, with nothing stored, and `halo auth login` shows the new host. Refresh sends the refresh token only to the token URL recorded with it, never to a newly declared one |
| A malicious MCP server points discovery at a lookalike sign-in page | Login shows the authorization server's host; `--strict` and packages pin it; resource and issuer checks |
| Discovery used for SSRF under `halo serve` | https only, no private addresses, no redirects, size and time caps, resolved address pinned |
| Another local process catches the loopback redirect | PKCE (a stolen code is useless without the verifier), random path, `state`, one request, 127.0.0.1 only |
| CSRF on the callback, or a login with the attacker's account | `state` checked, single-use; issuer checked; account shown after login |
| Two runs refresh a rotating refresh token at once, and the provider revokes the grant | Cross-process lock and re-read before refresh |
| A `/connect` link leaks (Slack history, a forwarded email) | 15 minutes, single-use, and without identity only from Studio with the token; with identity, only for the run's owner |
| Tokens in a checkpoint, recording or trace end up in git or a bug report | Never written there; tests check for the value |
| The token endpoint's error body echoes the refresh token | Error bodies from token endpoints are never shown or logged, only `error` and `error_description` |
| A provider grants wider scopes than declared | Recorded at login, shown by plan, warned by validate, error under `--strict` |
| Malware running as the user reads the store | Out of scope, as for the wallet. The Keychain's prompt helps for interactive use; the file store doesn't |

## Alternatives considered

- **Inline `auth: OAuth(...)`.** Reads better for a one-off tool. Needs nested calls in declaration values, which the grammar doesn't have, and two tools couldn't share a connection without repeating it. A later grammar change could allow both forms.
- **Keep tokens in `Env.*` and refresh them with a helper outside Halo** (`oauth2l`, `gcloud auth print-access-token`). Works today, by hand. Paused runs and serve still break, and nothing knows which account a tool acts as.
- **A sidecar or a hosted broker** (Nango, Composio, Pipedream Connect). Good for teams who already have one; a `store: "nango"` backend could come later. Not the default, because it sends every token through a third party.
- **Store tokens in `.halo/`, encrypted.** The key would have to live somewhere the project can't reach, at which point it's the same as the store above, with a worse failure (an encrypted token committed to git).
- **One store key per issuer and account, shared across projects.** Fewer logins. But any repo you run could declare the same connection and use your Drive. Possible later with an explicit `halo auth share` (see open questions).

## Rollout

Each phase ships on its own and is useful without the next.

| Phase | What | Unblocks |
|---|---|---|
| 1 | **Broker, stores and client credentials.** `OAuth` declaration with `grant: "client_credentials"`; `auth:` on REST and package tools (`"type": "oauth"` in manifests, client credentials only); the broker with refresh, 401 retry, origin binding, `redirect: "manual"`; Keychain and file stores with the lock; mail moved onto the broker (keeping its settings); `halo plan` shows auth | Microsoft Graph, Salesforce, Auth0 management APIs and other app-to-app services with no hand-pasted tokens. Mail keeps rotated refresh tokens |
| 2 | **Authorization code and device flow, `halo auth`.** PKCE, loopback redirect, device flow, `login/logout/list/status`, presets for Google, Microsoft, GitHub, Slack, Notion; ID token and `iss` checks; validate's scope warnings; `AllowAuth` | A person's Drive, Gmail, calendar, GitHub, Notion from the CLI and from one-person `halo serve` |
| 3 | **Connecting mid-run.** `AUTH_REQUIRED` pauses, `yield(connect:)`, resume checks, account-change question, `/connect` links in Studio (service connections, serve token) | Long and scheduled runs that survive revoked or expired tokens, and headless serve hosts |
| 4 | **MCP authorization.** `auth:` on MCP, `auth: "discover"` with RFC 9728, 8414, 7591 and 8707, SSRF and issuer checks, `insufficient_scope` reconnects | Hosted MCP servers that only take OAuth (Linear, Atlassian, Notion, Asana, Sentry...) |
| 5 | **Multi-user serve.** OIDC sign-in for Studio, verified Slack users, run owners, `as: "invoker"`, per-person encrypted tokens, `/me/connections`, `/connect` links bound to the owner and allowed from Slack | A team sharing one Halo server, each person's runs acting as themselves |

`secret-service` and `1password` stores can land in any phase after 1.

## Testing

All against local fixtures: a small OAuth server on `Bun.serve` that issues, refreshes, rotates and revokes tokens, detects refresh token reuse, and can be told to misbehave. No test talks to a real provider.

| Test | Expects |
|---|---|
| Two processes refresh a rotating token at the same moment | One refresh; neither reuses the old token; the fixture's reuse detection never fires |
| Kill a process between the provider's rotation and the store write | Connection marked "needs reconnect", with a clear message |
| 401 then 200 | One retry, same idempotency key |
| 401, 401 | `AUTH_REQUIRED`, run paused, no third request |
| 403 | Not retried, error names the granted scopes |
| `invalid_grant` on refresh mid-fan-out | One pause; finished items kept; resume after reconnect completes the rest |
| 5xx from the token endpoint | Retried as a tool error; not `AUTH_REQUIRED` |
| REST call to another host; a 302 to another host | Refused; redirect followed without the header |
| Agent passes `Authorization` in `headers:` | Stripped |
| Loopback: wrong `state`, wrong path, second request, `Host: evil` | 400, listener stays for the real one; second request refused |
| Login with an account other than the run's first | The built-in question |
| Granted scopes wider than declared | Validate warning; `--strict` error |
| MCP: `resource` mismatch, issuer mismatch, discovery URL on 10.0.0.1 or 169.254.169.254, a redirect in discovery | Each refused |
| DCR returns other `redirect_uris` | Refused |
| `/connect` link reused, expired, or opened without the serve token (phase 3) | Refused |
| The access and refresh tokens' values and last 12 characters | Absent from `.halo/`, checkpoints, snapshots, recordings, traces, telemetry, Studio's API, errors and plan output |

## Open questions

- **Public client ids in packages.** A package that ships a client id makes its publisher the "app" every user consents to. Who owns it, who pays for verification (Google requires review for sensitive scopes), and what happens when the publisher's app is suspended? Options: packages never ship one (each user registers their own, painful); packages may ship one and the installer shows whose it is; or Halo ships a few for its presets and becomes that publisher. This decides how easy phase 2 is for people.
- **Halo's own presets.** Should `provider: "google"` come with a Halo client id, or always need the user's? A Halo id means Halo owns a Google Cloud project, a consent screen, and the risk that every Halo user's grant is revoked at once.
- **Sharing connections across projects.** Keyed per project is safe but means logging in again per repo. An explicit `halo auth share Google --with ../other-repo`? Or key by account, with the trust file deciding which projects may use it?
- **The Linux store.** `secret-tool` is often missing on servers and in containers, and the keyring is locked without a desktop session. Is the 0600 file the default on Linux, with `secret-service` opt-in, or the other way round?
- **The state store on diskless hosts.** `/connect` needs `state` and PKCE verifiers kept for 10 minutes, and the lock needs a shared place. On serverless or multi-worker hosts, that's the run store (it already implements `take()` in the cloud proposal) or Redis. Which one is the default, and does phase 3 require it?
- **Scopes changed between plan and resume.** This proposal resumes on the declaration the run started with. Should a resume after a deploy that *narrowed* scopes use the narrower set instead?
- **Serve's encryption key.** `HALO_OAUTH_KEY` in the environment is the simplest; the Keychain doesn't exist on Linux servers; a KMS is a dependency. Which for phase 5?
- **DPoP (RFC 9449).** Binding tokens to a key Halo holds makes a stolen token useless elsewhere. Few providers support it. Worth doing when the broker is written, or later?
- **Who may disconnect a service connection** under multi-user serve: any signed-in person, or a named admin list?
