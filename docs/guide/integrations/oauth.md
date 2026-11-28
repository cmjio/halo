# OAuth

Many services want OAuth, not an API key: Google Drive, Gmail, Microsoft 365, Slack, GitHub apps. Halo signs a tool in for you. You connect an account once, and every run uses it. Halo refreshes the token before it expires. A run never holds the token, and a model never sees it.

## Declare a connection

A connection is its own declaration. Tools name it with `auth:`.

```halo
tool Google : OAuth(
  provider: "google",
  clientId: Env.GOOGLE_CLIENT_ID,
  clientSecret: Env.GOOGLE_CLIENT_SECRET,
  scopes: ["https://www.googleapis.com/auth/drive.readonly"]
)

tool Drive : REST("https://www.googleapis.com/drive/v3", auth: Google)
```

One declaration is one connection: one app, one grant, one set of scopes, one account. Several tools can share it.

Halo ships no client ids. Register an app with the provider and give its client id with `clientId:`. A desktop or CLI app is a public client and has no secret; leave `clientSecret:` out.

| Setting | What it is |
|---|---|
| `provider:` | `"google"`, `"github"`, `"microsoft"` or `"slack"`. Fills in the provider's URLs. Leave it out and give the URLs yourself |
| `clientId:` | Your app's client id. Required |
| `clientSecret:` | Only for a confidential client. Read it from `Env` |
| `scopes:` | The scopes to ask for |
| `grant:` | `"authorization_code"` (the default: a person signs in), `"client_credentials"` (the app is the account), `"device"` (a person signs in on another device) |
| `tenant:` | Your directory, for `provider: "microsoft"` (default `"common"`) |
| `authorizeUrl:`, `tokenUrl:`, `deviceUrl:`, `revokeUrl:` | The provider's endpoints, for one Halo has no preset for. `https` only |
| `issuer:` | The issuer a sign-in answer must come from, when the provider says (RFC 9207) |
| `audience:`, `resource:` | Sent with the token request, for providers that use them |
| `as:` | `"service"` (the default: one token every run shares) or `"invoker"` (each run uses the token of the person who started it; see [Each person's own account](#each-person-s-own-account)) |

The authorization code grant always uses PKCE and a random `state`.

A client credentials connection needs no sign-in. Its secret is enough:

```halo
tool Graph : OAuth(provider: "microsoft", tenant: "contoso.com", grant: "client_credentials",
                   clientId: Env.GRAPH_CLIENT_ID, clientSecret: Env.GRAPH_SECRET,
                   scopes: ["https://graph.microsoft.com/.default"])
tool Sites : REST("https://graph.microsoft.com/v1.0/sites", auth: Graph)
```

## Connect it

Run this in the project folder, where you run `halo run`:

```sh
halo auth login Google
```

Halo opens your browser at the provider's sign-in page. It listens on `127.0.0.1` for the answer, on a random port and path, for one request and 5 minutes. It checks the answer's `state` (and `iss`, when the provider sends it), then trades the code for tokens. If it can't open a browser, it prints the link.

On a machine with no browser (a server over SSH), use the device flow. Halo prints a code and an address to open on any device:

```sh
halo auth login Google --device
```

Then:

- `halo auth status Google` shows the account, the scopes granted and when the token expires.
- `halo auth list` shows every connection in the project and whether this machine is connected.
- `halo auth logout Google` revokes the token at the provider, when it can, and forgets it.

Register the redirect address with the provider. For `halo auth login` that is `http://127.0.0.1` with any port (Google, Microsoft and GitHub allow this for desktop apps). For `halo serve`, it is `https://<your server>/connect/callback`.

## Which tools take `auth:`

- `REST`, `GET` and `POST`. The token goes only to the tool's own origin.
- `Slack`, `GitHub`, `Linear` and `Figma`, in place of their token.
- `Email` with `via: "gmail"` or `"outlook"`. Its older settings still work: a refresh token in `Env` with `clientId:`, or an app's client secret. Halo keeps a refresh token the provider rotates, and uses it next time.
- `MCP` with `url:`. Every request to the server carries the token. Or `auth: "discover"`, and Halo finds the server's own sign-in (see [MCP servers that sign in with OAuth](#mcp-servers-that-sign-in-with-oauth)). A server run as a command signs in by itself and takes no `auth:`.
- A package's http tool whose manifest says `"type": "oauth"`. The tool is its own connection: `tool Notes : notes()`, then `halo auth login Notes`. Its client id comes from the variable the manifest names, or `clientId:` on the declaration. To use your own connection instead, write `notes(auth: MyNotes)`.

A tool takes `auth:` or `apiKey:`, not both. `halo validate` says so, and checks that `auth:` names an `OAuth` declaration.

## MCP servers that sign in with OAuth

A hosted MCP server that wants OAuth says so the way the [MCP specification](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization) describes: a request without a token gets `401` and a `WWW-Authenticate` header naming its metadata. `auth: "discover"` follows it:

```halo
tool Tracker : MCP(url: "https://mcp.tracker.example/mcp", auth: "discover", scopes: ["read"])
```

```sh
$ halo auth login Tracker
Tracker's server (mcp.tracker.example) signs in at auth.tracker.example, asking for: read.
Tracker declares no clientId:, so Halo registers itself at auth.tracker.example as a new client (dynamic client registration).
Opening auth.tracker.example to connect Tracker (1 scope)...
Connected you@example.com. Granted: read.
```

What `halo auth login` does:

1. Asks the server for nothing, without a token, and reads its `401`'s `resource_metadata` (or looks at `/.well-known/oauth-protected-resource`).
2. Reads that protected resource metadata (RFC 9728). Its `resource` must be this server's URL. It names the authorization server.
3. Reads the authorization server's metadata (RFC 8414, else OpenID Connect discovery). Its `issuer` must be the address it was fetched for. One that names another issuer is refused: that is how a mix-up, or a lookalike sign-in page, shows itself.
4. Prints where you'll sign in and the scopes, before anything else happens. Check the host: a malicious server can point at any sign-in page.
5. Without `clientId:`, registers Halo there as a public client for this sign-in (RFC 7591). Only the client id (and a secret, if one is issued) is kept, outside the project with the tokens. Registered redirect addresses other than the one Halo sent are refused.
6. Signs you in with PKCE, sending `resource=<the server's URL>` with the authorize and the token requests (RFC 8707), so the token is good for that server only.

The scopes asked for are the tool's `scopes:`, else the ones the server's `401` names, else the ones its metadata lists. A server that answers a call `403` with `error="insufficient_scope"` pauses the run, as a revoked token does: add the scope to `scopes:` and sign in again. Halo never widens scopes by itself.

Discovery only follows `https` (`http` only on `127.0.0.1`, for local servers), sends no cookies or credentials, follows no redirects, and gives up after 5 seconds or 64 KB. Under `halo serve` it also refuses addresses inside the network (private, link-local, `169.254.169.254`), and loopback unless serve itself listens on loopback.

An `MCP` tool with `auth: "discover"` also takes `clientId:` and `clientSecret:` (an app you registered there yourself), and `as:`. `halo plan` shows it as `oauth, discovered: auth.tracker.example`, or `discovered at sign-in` before you've signed in.

With a declared connection instead (`auth: TrackerSSO`), `halo auth login` still reads the server's metadata when it publishes some, and refuses to sign in if it says tokens come from another origin than the declaration's `tokenUrl:`. Give the declaration `resource:` with the server's URL if its authorization server wants one.

## Where tokens live

Never in the project. Not in `.halo/`, checkpoints, recordings, telemetry, Studio or a model's context.

- On macOS, in the Keychain, under the service `halo-oauth`.
- Elsewhere, in `~/.config/halo/credentials.json` (or `$XDG_CONFIG_HOME/halo/`), readable only by you.
- `HALO_CREDENTIALS_FILE=/path/credentials.json` moves the file and keeps the tokens in it. `HALO_CREDENTIALS_STORE=file` keeps them in the file on macOS too. Use one of these on CI, where nothing can answer a Keychain prompt.

The file keeps who is connected, the scopes and the expiry for every connection, so `halo plan` and `halo auth list` don't need to unlock anything.

A connection is stored for this project's folder. Another repo that declares a connection with the same name doesn't get yours. A changed `tokenUrl` or `clientId` is a new connection with nothing stored.

## How a token is used

- Halo keeps the access token in memory and refreshes it 60 seconds before it expires.
- When the provider sends a new refresh token, Halo stores it before using the new access token. Two runs refreshing at once take turns, so neither spends a token the other has replaced.
- A `401` from the service refreshes the token once and sends the request once more. A second `401` means the connection needs signing in again.
- The token is added as a header after the call's arguments are checked. A model can't set or see `auth:`. A redirect to another host is followed without the token.
- A token a service echoes back shows as `[secret Google access token]`, as a value from `Env` does.

## When a run needs a connection

A run that reaches a tool whose connection isn't connected, or whose refresh token was revoked or expired, doesn't fail. It pauses, waiting for `connect:Google`:

```
‖ Paused at stage 1 Drive.files, waiting for connect:Google: Google needs signing in: it isn't connected on this machine. Connect it with: halo auth login Google
  Connect it with: halo auth login Google
  Then continue with: halo resume weekly.halo 6f1c…
```

Connect it, then resume the run. The stage that needed it runs again. Its tool calls have the same [idempotency keys](../../stdlib/tools.md#idempotency-keys), so a service that honours them does nothing twice. An agent picks its conversation up at the call that needed the connection. A run inside `|*` pauses once. `@checkpoint` runs resume from their checkpoint as usual.

To ask before the work starts, put a connect step first:

```halo
pipeline Weekly() -> Result:
  |! yield(connect: Google, msg: "Allow read access to your Drive?")
  |> Drive.files(q: "'root' in parents")
```

It goes on at once when Google is connected. Otherwise the run pauses with that message. `context.data.yield` is `{ connected: true, connection: "Google", account: "you@example.com" }`, never a token.

## Under `halo serve`

A paused run waiting for a connection gets a link to connect it: `/connect/<runId>/Google?exp=…&sig=…`. Studio shows a **Connect Google** button, and a Slack announcement has one next to Approve and Reject.

- The link is signed for that run, that pause, that connection and the person it was made for. It works once, for 10 minutes. Studio makes a new one each time it shows the run.
- Opening it shows a page that names the provider and the scopes. Continuing sends you to the provider's sign-in. The callback checks the `state` and the PKCE verifier, stores the token, and resumes the run.
- Whoever opens the link chooses the account. So a link is offered only to the right person. For a service connection (the default), that's the operator or an admin, for a run a person started through the API, Studio or `/mcp`. For an `as: "invoker"` connection, it's the user who started the run, and the token is stored for them. A run a webhook, schedule or watch started gets no link: run `halo auth login Google` on the server, then press **Check again** in Studio.

See [Serving pipelines](../production/serving.md#connecting-an-account).

## Each person's own account

When several people share one `halo serve` (see [users](../production/serving.md#users-and-who-owns-a-run)), a connection can act as whoever started the run:

```halo
tool MyDrive : OAuth(provider: "google", clientId: Env.GOOGLE_CLIENT_ID, as: "invoker",
                     scopes: ["https://www.googleapis.com/auth/drive.file"])
tool TeamBot : OAuth(provider: "slack", clientId: Env.SLACK_CLIENT_ID, clientSecret: Env.SLACK_CLIENT_SECRET,
                     scopes: ["chat:write"])
```

- `as: "service"` (the default): one token, which every run uses.
- `as: "invoker"`: the token of the user who started the run. Alice's run uses Alice's Drive. Her token is stored under her name, next to the shared ones.

A run with no person behind it (a webhook's, a schedule's, a watch's, one started with the operator's `HALO_SERVE_TOKEN`, a package consumer's) can't use an invoker connection: the call fails and says so. `halo validate` warns when a pipeline that `halo.json`'s schedules, webhooks or watches start reaches one. With `halo run` on your own machine, an invoker connection is simply yours.

Each user connects their own: the Connect link a paused run offers them, or on the server:

```sh
halo auth login MyDrive --user alice
```

An `MCP` tool with `auth: "discover"` takes `as: "invoker"` too.

## halo plan and halo validate

`halo plan` shows each tool's connection and whether this machine is connected:

```
  1      Drive.files
         ...
         auth: Google (oauth, authorization_code) [https://www.googleapis.com/auth/drive.readonly] · connected as you@example.com, access token expires in 41 min

Acts as: Drive through Google (oauth, authorization_code) [https://www.googleapis.com/auth/drive.readonly]: connected as you@example.com, access token expires in 41 min
```

It warns when the provider granted wider scopes than the declaration asks for.

`halo validate` checks each `OAuth` declaration (a provider Halo knows, a client id, a grant, the URLs that grant needs, `as:`) and each `auth:`, including an `MCP` tool's.
