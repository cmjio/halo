# Keys and signing: using a key without showing it

| | |
|---|---|
| Status | Draft proposal. Nothing here is built. Masking of `Env` values that a service echoes back (Halo 1.12.0) is the groundwork |
| Date | 27 November 2026 |
| Builds on | `Env.NAME` in tool declarations, the run's secret masking (`src/runtime/secret-mask.ts`), `Vault` sources (`src/runtime/wallet.ts`), `Halo-Signature` (`src/runtime/signing.ts`), `halo serve` webhooks and approval links (`src/serve/server.ts`), the installer (`docs/public/install.sh`), `halo.lock` |

This lives outside `docs/` because everything under `docs/` is published to halolang.com.

## Summary

Agents increasingly need to prove who they are. They sign a webhook, mint a short-lived token for a GitHub App, call AWS, or check that a request really came from Stripe. Today Halo has one way to hold a key: `Env.NAME`, sent as `Authorization: Bearer`. Anything else means a `Bash` tool with the key in its environment, where an agent with a shell can print it.

This proposal adds five things:

1. **A `Keys` tool.** It signs, verifies, makes JWTs and gives out a public key. It never returns key material. The model sees names (`Keys.sign(key: "deploy")`), never bytes.
2. **Request signing on HTTP tools.** `auth: Bearer(...)`, `Header(...)`, `Basic(...)`, `SigV4(...)`, `GitHubApp(...)`. The runtime builds the header after the model has chosen the call.
3. **Webhook verifier presets for `halo serve`.** `verify: "stripe"`, `"svix"`, `"github"`, `"slack"`, `"hmac-sha256"`, each with timestamp tolerance and replay protection by delivery ID.
4. **Key rotation.** Lists of secrets when verifying, a `kid` in `Halo-Signature`, and approval links with their own key.
5. **Signed releases and packages.** A signature on `SHA256SUMS`, checked by the installer against a pinned public key. Optional publisher signatures in `halo.lock`.

Encryption helpers (seal and open a value for a person, a file, or a later run) come last.

The rule for all of it:

> **Key material is read at the moment it is used, inside the runtime, and leaves only as a signature, a public key, or a header on a request the tool's rules allowed.**

## What exists today

- `Env.NAME` in a tool declaration reads the variable when the tool is used. Since 1.12.0 the runtime remembers each value it reads and masks it as `[secret NAME]` in tool results and errors.
- REST, GET and POST send `apiKey:` as `Authorization: Bearer <key>`. There is no other header, no Basic auth, no signing.
- `Remote` sandboxes take `secrets: ["NAME"]` and mask those values in what comes back.
- `Vault` reads card and personal items from the macOS Keychain, 1Password or the environment, only when they are typed (see the wallet proposal).
- `halo serve` signs run callbacks and `Handoff` items with `Halo-Signature: t=<unix>,v1=<hex>`, HMAC-SHA256 over `<t>.<body>`. There is one secret and no key ID.
- Webhooks check `x-halo-secret` or a GitHub-style `x-hub-signature-256`. `slack.signingSecret` checks Slack's buttons. There is no timestamp check for GitHub, no replay protection, and no Stripe or Svix format.
- Approval links are signed with the serve token, or with `.halo/serve-secret`. Rotating the token invalidates every outstanding link.
- The installer checks the download against the release's `SHA256SUMS`. The sums file comes from the same place as the binary, so whoever can replace one can replace both (audit finding #15).
- `halo.lock` pins each package's content hash. Nothing says who published it.

### Gaps

| Gap | Effect |
|---|---|
| Keys only as bearer tokens | A GitHub App, AWS, or any API that wants a signature needs a shell tool holding the key |
| A key in a `Bash` env | An agent with that shell can print it, or send it anywhere the shell can reach |
| No verifier presets | Each project re-implements Stripe's or Svix's scheme, often without the timestamp check |
| No replay protection | A captured webhook can be sent again and runs the pipeline again |
| One serve secret, no `kid` | A secret can't be rotated without breaking callbacks and links in flight |
| Unsigned releases | A compromised download host can ship a binary and matching sums |

## Design

### 1. The `Keys` tool

```halo
tool Signer : Keys(
  deploy:  Key(Env.DEPLOY_KEY, alg: "Ed25519"),
  app:     Key(file: "~/.config/acme/app.pem", alg: "RS256"),
  github:  Key(keychain: "acme-github-app", alg: "RS256"),
  vendor:  Key(op: "op://Shared/Vendor/signing key", alg: "ES256"),
  laptop:  Key(sshAgent: "SHA256:Xc3V…", alg: "Ed25519"),
  hooks:   Key(Env.HOOK_SECRET, alg: "HS256"),
)
```

Each entry is a name, a source and an algorithm. Supported algorithms: `RS256`, `ES256`, `Ed25519`, `HS256`.

Sources:

| Source | Written | Read |
|---|---|---|
| Environment | `Key(Env.NAME)` | the variable, PEM or base64 (or raw bytes for HS256) |
| File | `Key(file: "path")` | PEM, refused if the file is readable by others (mode wider than 0600) |
| macOS Keychain | `Key(keychain: "service")` | `security find-generic-password`, the same path the wallet uses |
| 1Password | `Key(op: "op://vault/item/field")` | `op read`, the same as the wallet |
| ssh-agent | `Key(sshAgent: "fingerprint")` | signs through `SSH_AUTH_SOCK`; the key never enters Halo |

Methods:

| Method | Returns | Notes |
|---|---|---|
| `sign(key:, data:)` | `{ signature, alg, kid }`, base64url | `data` is a string or a file reference |
| `verify(key:, data:, signature:)` | `{ valid }` | for an asymmetric key, only the public half is used |
| `jwt(key:, claims:, expiresIn:)` | `{ token, expiresAt }` | `iat` and `exp` are set by the runtime; `expiresIn` is capped (default cap 1 hour) |
| `public_key(key:)` | `{ pem, jwk, kid }` | refused for HS256 |

What it never does: return a private key, a secret, or an HMAC key. There is no `export`. `kid` is the SHA-256 of the public key (or, for HS256, an HMAC of a fixed label with the key), cut to 16 hex characters, so it can be logged.

Rules work as on other tools. `Fixed("key", "deploy")` pins the key. `Match("claims", ...)` isn't useful on an object, so `jwt` takes `allowClaims: ["sub", "aud", "repo"]` on the declaration: any other claim from a model's call is refused. `ApproveTools(Signer.sign)` asks a person before each signature, and the question shows the data's SHA-256 and its first 200 characters.

The token a `jwt` call returns is a secret too. The runtime adds it to the run's masked values, so it shows as `[secret Signer.jwt]` anywhere except the call that asked for it. A pipeline that passes it on uses `auth:` (below), not the model.

### 2. Request signing on HTTP tools

```halo
tool Api    : REST("api.acme.com", auth: Bearer(Env.ACME_TOKEN))
tool Legacy : GET("old.acme.com", auth: Header("X-Api-Key", Env.OLD_KEY))
tool Jira   : REST("acme.atlassian.net/rest/api/3", auth: Basic("bot@acme.com", Env.JIRA_TOKEN))
tool S3     : REST("acme-data.s3.eu-west-1.amazonaws.com", auth: SigV4(Env.AWS_ACCESS_KEY_ID, Env.AWS_SECRET_ACCESS_KEY, region: "eu-west-1", service: "s3"))
tool Repo   : REST("api.github.com", auth: GitHubApp(key: Signer.github, appId: "123456", installation: "7890"))
tool Hook   : POST("partner.example.com/in", auth: Signed(Signer.hooks, header: "X-Signature"))
```

- `apiKey:` stays, as shorthand for `auth: Bearer(...)`.
- The header is built after the model chose the call and after the tool's rules checked it. A model can't set or see it.
- `SigV4` signs the method, path, query, the headers Halo sends and the body's hash. `x-amz-security-token` is sent when a session token is given.
- `GitHubApp` makes a 10-minute app JWT with the `Keys` tool, swaps it for an installation token, and caches that token until 5 minutes before it expires. Neither token is returned or logged.
- `Signed(key, header:)` sends `t=<unix>,v1=<signature of t.body>` for partners that check Halo's own format, with `kid` when the key has one.
- Every value used to build the header is added to the run's masked values.
- `halo validate` errors on `auth:` and `apiKey:` together, and warns on `auth: Bearer(...)` over plain `http://` to anything but localhost.
- `halo plan` shows `auth: SigV4 (eu-west-1/s3)` and the key's name, never its value.

### 3. Webhook verifiers for `halo serve`

```json
"webhooks": [
  { "path": "stripe", "pipeline": "Payments", "verify": "stripe", "secret": ["Env.STRIPE_WHSEC", "Env.STRIPE_WHSEC_OLD"] },
  { "path": "clerk",  "pipeline": "Users",    "verify": "svix",   "secret": "Env.CLERK_WEBHOOK_SECRET" },
  { "path": "github", "pipeline": "Triage",   "verify": "github", "secret": "Env.GITHUB_WEBHOOK_SECRET" },
  { "path": "slack",  "pipeline": "Ask",      "verify": "slack",  "secret": "Env.SLACK_SIGNING_SECRET" },
  { "path": "acme",   "pipeline": "Orders",   "verify": { "hmac-sha256": { "header": "X-Acme-Signature", "encoding": "hex", "prefix": "sha256=", "timestamp": "X-Acme-Timestamp" } }, "secret": "Env.ACME_SECRET" }
]
```

| Preset | Signature | Signed text | Timestamp | Delivery ID |
|---|---|---|---|---|
| `stripe` | `Stripe-Signature: t=…,v1=…` (any `v1` may match) | `t.body` | `t` | event `id` in the body |
| `svix` | `svix-signature: v1,<base64> …` | `id.timestamp.body` | `svix-timestamp` | `svix-id` |
| `github` | `X-Hub-Signature-256: sha256=<hex>` | body | none in the scheme | `X-GitHub-Delivery` |
| `slack` | `X-Slack-Signature: v0=<hex>` | `v0:timestamp:body` | `X-Slack-Request-Timestamp` | none; the signature itself is remembered |
| `hmac-sha256` | a header you name, hex or base64, optional prefix | body, or `timestamp.body` if a timestamp header is named | optional | optional header |

Semantics:

- The check runs on the raw body, before it is parsed, with a constant-time compare.
- `tolerance` (default 300 seconds) refuses a timestamp too far from now, in either direction. A preset with no timestamp (`github`) relies on the delivery ID alone.
- A delivery ID seen in the last `replayWindow` (default 24 hours, at least the tolerance) gets `200` with `{"duplicate": true}` and starts nothing. The IDs live in `<stateDir>/deliveries.sqlite`, pruned as they age out. A `200` (not an error) stops the sender retrying.
- A failed check is `401` with a generic body. The reason (bad signature, too old, unknown key) goes to the server log only.
- `secret` may be a list. Each is tried; the log says which one matched (by position, not value), so the old one can be removed once nothing uses it.
- `secretInQuery` stays only for `verify` left out (the current `x-halo-secret` behaviour).
- `halo validate` (on `halo.json`) errors on an unknown preset, and warns on a webhook with neither `secret` nor `verify`.

### 4. Key rotation

- **Lists when verifying.** Anywhere Halo checks a signature (webhooks, `Keys.verify`, `verifySignature` in the SDK) it takes a list of secrets or keys and accepts any.
- **One key when signing.** Halo signs with the first. Rotation is: add the new key first, deploy, let traffic drain, remove the old one.
- **`kid` in `Halo-Signature`.** `Halo-Signature: t=…,kid=3f9a…,v1=…`. `kid` is the first 16 hex characters of SHA-256 of the secret (safe to show). A receiver that holds several secrets picks by `kid`, or tries each. Old receivers ignore it, so this is compatible.
- **Approval links get their own key.** `<stateDir>/link-keys.json` holds a list of `{ kid, secret, created }`. Links carry the `kid`. `halo serve rotate-links` adds a key and keeps the old one for `links.keep` (default 7 days). Rotating the API token no longer touches links, and a leaked link key doesn't give API access.
- **`halo keys rotate <name>`** for `Keys` entries in a file or the Keychain: writes the new key next to the old, prints the new public key, and leaves both until `--finish`.

### 5. Signed releases and packages

**Releases.** The release workflow signs `SHA256SUMS` with minisign, giving `SHA256SUMS.minisig`. The public key is pinned in `install.sh` and `install.ps1`, in `halo upgrade`, and printed in `SECURITY.md`. The installer:

1. downloads `SHA256SUMS` and `SHA256SUMS.minisig`,
2. checks the signature against the pinned key (with `minisign` if it's installed, otherwise a small Ed25519 check it carries; macOS and most Linux have `openssl` 3, which can verify Ed25519),
3. checks the binary against the sums, as it does now.

A missing or bad signature stops the install. `HALO_INSTALL_UNSIGNED=1` skips it, with a warning, for mirrors. This closes audit finding #15: a host that can replace the binary and the sums can't make the signature.

Sigstore (keyless, tied to the GitHub workflow's identity) is the alternative. It needs `cosign` on the user's machine to verify, which most don't have, so minisign comes first and Sigstore bundles are published alongside for those who want them.

The signing key lives in the release environment's secrets, used only by the publish job. A second, offline key is listed in `SECURITY.md` for emergencies: a release signed by it tells installers to trust a new primary key.

**Packages.** A package's publisher may sign its tarball's hash:

```json
"dependencies": { "@acme/tools": { "version": "2.1.0", "publisher": "ed25519:MCowBQYDK2VwAyEA…" } }
```

- `halo publish --sign <key>` adds a signature to the registry entry.
- `halo install` records the publisher's key in `halo.lock` on first install (trust on first use), and refuses a later version signed by a different key, or unsigned, unless `halo install --accept-publisher` says so.
- Optional: unsigned packages keep working as now. A `"requireSigned": true` in `halo.json` refuses them.

### 6. Encryption helpers

```halo
tool Box : Keys(team: Key(file: "~/.config/acme/team.age", alg: "X25519"))
```

- `Box.seal(to: "team", data:)` returns an age-format ciphertext. `Box.open(key: "team", data:)` returns the plaintext to the pipeline.
- What `open` returns is masked in what the model sees unless the declaration says `reveal: true`, so the usual pattern is: a pipeline opens a value and passes it straight to a tool argument.
- `halo keys seal` and `halo keys open` on the command line, for setting up.
- Uses: secrets in a repo that only the server can read, a paused run's sensitive input sealed in the snapshot, a file for a person.

## Threat model

| Threat | Covered by | Not covered |
|---|---|---|
| A model asks a tool to print a key | No method returns key material; results are masked | A tool with `reveal: true` that a model calls |
| A service echoes a key or token back | The run's masking (1.12.0), extended to tokens Halo mints | A service that re-encodes it (base64, reversed) |
| A model makes the runtime sign something harmful | `Fixed("key")`, `allowClaims`, `expiresIn` caps, `ApproveTools` | A pipeline that signs whatever the model hands it, with no rule |
| A shell tool reads a key from the environment | Keys don't need to be in `Bash`'s `env:` any more; `halo validate` warns when a `Keys` source variable is also passed to a shell | A key file a `Workspace` or `Bash` tool can read; keep key files outside the project |
| Webhook forgery | Presets with constant-time checks on the raw body | A leaked webhook secret |
| Webhook replay | Timestamp tolerance and delivery IDs | A replay inside the window to a second server without shared state |
| A leaked serve token used to forge approval links | Links have their own key | A leaked link key forges links until rotated |
| Rotation breaking traffic | Lists of secrets, `kid` | A receiver that only accepts one secret |
| A tampered download | Signed `SHA256SUMS`, pinned key | A compromised release key; the offline key is the recovery |
| A hijacked package | Publisher key pinned on first install | The first install itself (trust on first use) |
| Key material on disk in `.halo` | Never written: not to telemetry, recordings, snapshots or caches | Swap and core dumps |

Out of scope: hardware keys (YubiKey, Secure Enclave) beyond what ssh-agent offers, a key server, and certificate issuance.

## Phased plan

| Phase | What | Notes |
|---|---|---|
| 0 | Done in 1.12.0: mask every `Env` value a tool reads in results and errors; more `Redact(APIKey)` patterns; warn about `Fixed(arg, Env.SECRET)` on GET | groundwork |
| 1 | Webhook presets (`stripe`, `svix`, `github`, `slack`, `hmac-sha256`), tolerance, delivery-ID replay store, lists of secrets | small, no new syntax, the most asked for |
| 2 | Signed releases: minisign in the release workflow, pinned key in both installers and `halo upgrade`, `SECURITY.md` | closes audit finding #15 |
| 3 | `auth:` on HTTP tools: `Bearer`, `Header`, `Basic`, then `SigV4` | `apiKey:` becomes shorthand |
| 4 | The `Keys` tool with env and file sources, all four algorithms; `jwt`, `sign`, `verify`, `public_key`; `GitHubApp` auth | needs phase 3 |
| 5 | Keychain, 1Password and ssh-agent sources | shares the wallet's backends |
| 6 | `kid` in `Halo-Signature`, approval links with their own keys, `halo keys rotate` | compatible with old receivers |
| 7 | Publisher signatures in `halo.lock`, `requireSigned` | needs registry changes |
| 8 | Encryption helpers | last; least asked for |

Each phase ships with red-team tests written to succeed first, as the wallet's were: a model trying to extract a key through every method, a webhook replayed and re-signed, a release with a swapped binary.

## Open questions

- Should `Keys` refuse to load at all in a program that gives an agent a shell, like the wallet does? Probably not: the key never enters the shell. But a key file inside a `Workspace` root should be an error.
- Does `ssh-agent` signing need a person's confirmation by default? `ssh-add -c` already offers that, outside Halo.
- Minisign or plain Ed25519 with `openssl`? Minisign's format is small and well known; carrying a verifier in `install.sh` without `minisign` installed is the work.
- Where does the replay store live under Halo Cloud, with several servers? It has to be shared, or replay protection is per server.
