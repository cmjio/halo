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
- A package's http tool whose manifest says `"type": "oauth"`. The tool is its own connection: `tool Notes : notes()`, then `halo auth login Notes`. Its client id comes from the variable the manifest names, or `clientId:` on the declaration. To use your own connection instead, write `notes(auth: MyNotes)`.

A tool takes `auth:` or `apiKey:`, not both. `halo validate` says so, and checks that `auth:` names an `OAuth` declaration.

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

- The link is signed for that run, that pause and that connection. It works once, for 10 minutes. Studio makes a new one each time it shows the run.
- Opening it shows a page that names the provider and the scopes. Continuing sends you to the provider's sign-in. The callback checks the `state` and the PKCE verifier, stores the token, and resumes the run.
- Whoever opens the link chooses the account the run acts as. Until Halo knows who people are, a link is offered only for runs the server's operator started (through the API, Studio, or its own schedules and watches). For any other run, run `halo auth login Google` on the server, then press **Check again** in Studio.

See [Serving pipelines](../production/serving.md#connecting-an-account).

## halo plan and halo validate

`halo plan` shows each tool's connection and whether this machine is connected:

```
  1      Drive.files
         ...
         auth: Google (oauth, authorization_code) [https://www.googleapis.com/auth/drive.readonly] · connected as you@example.com, access token expires in 41 min

Acts as: Drive through Google (oauth, authorization_code) [https://www.googleapis.com/auth/drive.readonly]: connected as you@example.com, access token expires in 41 min
```

It warns when the provider granted wider scopes than the declaration asks for.

`halo validate` checks each `OAuth` declaration (a provider Halo knows, a client id, a grant, the URLs that grant needs) and each `auth:`.
