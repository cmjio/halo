# Tool Packages

A tool package adds providers to a project: a service's REST API described as data, an MCP server, or a module of code. Once installed, a package's provider is used like a built-in one: `tool Pay : Stripe()`.

## Using packages

```bash
halo search                    # what the registry has
halo search issues             # matches names, descriptions and publishers
halo add stripe                # the latest version
halo add jira@1.0.0            # a specific version
halo add github-mcp --trust    # it starts a program, so it needs --trust
halo tools                     # every provider in this project, with its methods
halo remove stripe
```

`halo add` prints what it installed and what the package can reach:

```
✓ stripe@1.0.0 → tool X : Stripe(...)
    network: api.stripe.com
    reads env: STRIPE_API_KEY
    runs its own code: no
```

Then declare and use the provider:

```halo
policy Refunds : ApproveTools("Pay.create_refund")

tool Pay : Stripe()

agent Billing [openai/gpt-4o]
  equips Pay
  requires Refunds

pipeline Refund(request: String) -> Result:
  request |> Billing.handle("Find the charge this customer means and refund it.", tools: [Pay])
```

The key comes from the variable the package names (`STRIPE_API_KEY` here). `Stripe(apiKey: Env.OTHER_KEY)`, or the key as the first argument, overrides it. `halo tools` shows each method colored by its effect (read, write, external), and agents see the same methods and descriptions (see [Agents with Tools](./agents-with-tools.md)).

`halo add` takes:

| Spec | Installs |
|---|---|
| `stripe`, `stripe@1.0.0` | That package from the registry, checked against the registry's sha256 |
| `./my-tool` | A package folder (one with `halo-tool.json`), packed on the fly |
| `my-tool-1.0.0.halotool` | A packed file |
| `https://example.com/my-tool-1.0.0.halotool` | A packed file, downloaded. Plain `http://` is refused except on localhost |

A package is unpacked into `.halo/tools/<name>/` and pinned in `halo.lock`. A package's provider can't take the name of a built-in provider or of another installed package's provider.

### The registry

The default registry is the `registry/index.json` that ships with Halo, read from disk. It has these first-party packages:

| Package | Provider | Kind | Key |
|---|---|---|---|
| `stripe` | `Stripe` | http | `STRIPE_API_KEY` |
| `jira` | `Jira` | http | `JIRA_EMAIL`, `JIRA_API_TOKEN`; declare with your site: `Jira(site: "acme")` |
| `notion` | `Notion` | http | `NOTION_API_KEY` |
| `sentry` | `Sentry` | http | `SENTRY_AUTH_TOKEN` |
| `github-mcp` | `GitHubMCP` | mcp (runs GitHub's server in Docker; needs `--trust`) | `GITHUB_PERSONAL_ACCESS_TOKEN` |
| `world-time` | `WorldTime` | module (needs `--trust`) | none |

To use another registry, pass `--registry <index.json path or https URL>` to `halo add` and `halo search`, set `HALO_REGISTRY`, or add `"registry": "https://..."` to `halo.json`. The flag wins over the variable, and the variable over `halo.json`.

### `halo.lock`

```json
{
  "tools": {
    "stripe": {
      "version": "1.0.0",
      "source": "registry:https://tools.example.com/index.json#stripe@1.0.0",
      "sha256": "ab3f…",
      "providers": ["Stripe"],
      "permissions": { "network": ["api.stripe.com"], "env": ["STRIPE_API_KEY"], "spawn": [], "code": false }
    }
  }
}
```

Commit `halo.lock`. `halo install` reinstalls every package it lists, at the pinned version and checksum. If any of them runs its own code (`"code": true`), it refuses unless you pass `--trust`: check the lock first, then run `halo install --trust`. Don't commit `.halo/tools`: it's install output (in `.halo/`, which `halo init` ignores), and `halo install` rebuilds it.

`source` says where a package came from:

| `source` | Means |
|---|---|
| `registry:default#stripe@1.0.0` | The registry that ships with Halo, wherever Halo is installed |
| `registry:https://tools.example.com/index.json#acme@1.0.0` | Another registry, as given to `--registry` (or `HALO_REGISTRY`, or `halo.json`) |
| `tools/acme`, `vendor/acme-1.0.0.halotool` | A folder or file inside the project, relative to the project folder |
| `https://…/acme-1.0.0.halotool`, `/abs/path/…` | A URL, or a file or folder outside the project, as given |

A relative `--registry` path is recorded as typed, so prefer an https URL for a registry a team shares.

`halo run`, `debug`, `test`, `plan`, `tools`, `serve` and `mcp` load the packages in `halo.lock` from `.halo/tools`. `halo validate` only reads the provider names from `halo.lock`, and never loads package code. Each one's `package.halotool` must match the pinned sha256, or the command stops and asks you to run `halo install`. The unpacked files are rewritten from that verified package before anything loads, so an edited file in `.halo/tools` never runs.

## Security

What a package can do depends on its kind.

| Kind | What runs | Needs `--trust` |
|---|---|---|
| `http` | Nothing from the package. Halo builds each request from the manifest | No |
| `mcp` with `url` | Nothing locally. Halo talks to that server | No |
| `mcp` with `command` | That command, as your user | Yes |
| `module` | The package's code, inside Halo's own process | Yes |

- **An http package** can only send requests under its declared base URL: a path that would leave it is refused, `{name}` path values are URL-encoded, and `{{site}}`-style parts of the base URL come only from the tool declaration (letters, digits, `.`, `-` and `_`), never from a model. But the package decides which host gets your key: a manifest that sends `OPENAI_API_KEY` to its own server is valid. Read `network` and `reads env` before you install.
- **A command** (stdio MCP) gets only `PATH`, `HOME`, and the variables the manifest lists, but runs with your files and network. The checksum covers the manifest, not what the command fetches: `npx -y some-server` or a Docker image without a digest runs whatever is current when it starts.
- **A module** runs in Halo's process, with every environment variable (all your API keys), your files, and the network. Treat it like any dependency you `bun install`. Its own `node_modules` aren't packed, so it can import only Bun's built-ins, files in the package, and what Halo itself can resolve.
- **`--trust` is kept on this machine, not in `halo.lock`.** `halo add --trust` (or `halo install --trust`) records the package's exact sha256 in `.halo/trust.json`. A module or stdio MCP package loads only if `.halo/trust.json` has the same checksum `halo.lock` pins, so a pull request that changes the lock to a new version, or adds a package that runs code, stops the next command with a message to trust it again. `halo install --trust` trusts every package in the lock that runs code, so read the lock (its `permissions` and `source`) before running it. Don't commit `.halo/trust.json`: trust is each machine's own decision.
- **`halo add` doesn't ask before installing.** It refuses code without `--trust`, and prints the permissions after installing. `halo search` shows them first.
- **Checksums** catch a download that differs from the registry's index, and installed files that changed afterwards. They don't protect against a malicious publisher, or a registry whose index and files were both replaced: the expected checksum comes from the same index. A package installed from a file, URL or folder has no expected checksum; whatever was read is pinned.
- **Effects** (`read`, `write`, `external`) are what the publisher wrote. Policies that select by effect (`AllowEffects(read)`) trust that. To be sure, name methods: `AllowTools("Pay.list_charges", "Pay.get_customer")`.

## Writing a package

A package is a folder with a `halo-tool.json` manifest, and for a module, its code.

```json
{
  "name": "acme",
  "version": "1.0.0",
  "description": "The Acme orders API",
  "publisher": "Acme Inc.",
  "homepage": "https://docs.acme.example",
  "license": "MIT",
  "providers": {
    "Acme": {
      "kind": "http",
      "description": "Acme orders",
      "baseUrl": "https://api.acme.example/v2",
      "auth": { "type": "bearer", "env": "ACME_API_KEY" },
      "methods": [
        {
          "name": "get_order",
          "description": "Get an order by id.",
          "effect": "read",
          "http": { "method": "GET", "path": "/orders/{id}" }
        },
        {
          "name": "cancel_order",
          "description": "Cancel an order that hasn't shipped. Refunds the customer.",
          "effect": "external",
          "http": { "method": "POST", "path": "/orders/{id}/cancel" },
          "params": { "type": "object", "properties": { "id": { "type": "string" }, "reason": { "type": "string" } }, "required": ["id"] }
        }
      ]
    }
  }
}
```

| Field | Rule |
|---|---|
| `name` | Lowercase letters, digits and dashes, starting with a letter or digit, up to 63 characters |
| `version` | `1.2.3`, optionally with a pre-release (`1.2.3-beta.1`) |
| `description` | Required |
| `publisher`, `homepage`, `license` | Optional. Shown by `halo search` and in the `--trust` message |
| `providers` | At least one. Each key is the provider name used in `tool X : Name()`: a capital letter, then letters and digits |

Every provider has a `kind` and a `description`. `halo pack` and `halo add` check the manifest and list every problem at once.

### `http`

| Field | Meaning |
|---|---|
| `baseUrl` | `https://` (or `http://` on localhost). `{{name}}` parts are filled from the declaration, e.g. `"https://{{site}}.atlassian.net/rest/api/3"` with `Jira(site: "acme")` |
| `auth.type` | `bearer` (`Authorization: Bearer <key>`), `header` (`<name>: <key>`), `query` (`?<name>=<key>`), `basic`, or `none` |
| `auth.env` | The variable holding the key. For `basic`, two: `["USER_VAR", "PASSWORD_VAR"]` |
| `auth.name` | The header or query parameter name, for `header` and `query` |
| `body` | How POST, PUT and PATCH send their arguments: `json` (default) or `form` (nested as `a[b]=1`, the way Stripe reads them) |
| `headers` | Fixed headers for every request, e.g. an API version |
| `methods` | At least one |

Each method:

| Field | Meaning |
|---|---|
| `name` | Lowercase snake_case |
| `description` | Required. Models read it to decide when to call the method, so say what it does and what it changes |
| `effect` | `read`, `write`, or `external`. A `GET` method must be `read` |
| `http.method` | `GET`, `POST`, `PUT`, `PATCH`, or `DELETE` |
| `http.path` | Starts with `/`, with no `..`, `?` or `#`. `{name}` segments are filled from arguments of that name |
| `params` | The arguments as JSON Schema. Default: the path's `{name}` parameters, required, plus anything else |

How a call becomes a request:

- `{name}` path segments take the argument of that name, URL-encoded, and it isn't sent again. A missing one fails with `TOOL_ARGUMENT`. A single positional value fills the first one: `Pay.get_customer("cus_123")`.
- The other named arguments become query parameters for `GET` and `DELETE`, and the body for the rest.
- The key is the declaration's `apiKey:` or first argument, else the variable in `auth.env`. For `basic`, the user is the declaration's `user:` or the first variable, and the password is `apiKey:` or the second variable.
- A JSON response is parsed; an empty one returns `{ ok: true, status }`. A non-2xx response fails with an `HttpError`, retryable under `@retry` for 408, 429 and 5xx.

### `mcp`

```json
"GitHubMCP": {
  "kind": "mcp",
  "description": "GitHub's MCP server (needs Docker)",
  "command": "docker run -i --rm -e GITHUB_PERSONAL_ACCESS_TOKEN ghcr.io/github/github-mcp-server",
  "env": ["GITHUB_PERSONAL_ACCESS_TOKEN"]
}
```

Exactly one of `command` (a stdio server) or `url` (`https://`, or `http://` on localhost; Streamable HTTP). `env` lists the variables a stdio server may see. A declaration can't point the provider at another command, URL or environment; other [MCP options](./integrations/mcp.md#options) (`apiKey:`, `headers:`, `cwd:`, `timeout_ms:`) still come from the declaration. The methods are whatever the server lists.

### `module`

```json
"WorldTime": { "kind": "module", "description": "Time zone arithmetic (runs locally, no network)", "entry": "index.ts" }
```

`entry` is a file in the package that exports `provider` (a `ToolProvider`, see [Custom Tools](./integrations/custom-tools.md)) and `info` (its methods, each with `name`, `description`, `params` and `effect`). A module that holds several providers can export `providers: { Name: { provider, info } }` instead. Without `info`, agents can't choose the provider's methods and `halo plan` can't describe them. `registry/src/world-time/` in the repository is a complete example.

### Packing and publishing

```bash
halo pack ./acme                                   # → acme-1.0.0.halotool
halo pack ./acme --out dist/
halo publish acme-1.0.0.halotool --registry ./registry/index.json
```

`halo pack` checks the manifest and writes one file: JSON holding the manifest and every file in the folder (base64), except dotfiles, `node_modules`, and other `.halotool` files. A package can be at most 5 MB. It prints the file's sha256 and the permissions.

`halo publish` adds a packed file to a registry index **on disk**: it copies the file to `packages/<name>-<version>.halotool` next to the index, and records its sha256, providers, permissions, and the time. A version that is already published is refused; bump the version. `latest` moves to the new version unless it is older than the current one. The index is created if it doesn't exist.

### Hosting a registry

A registry is static files: `index.json` and the `packages/` folder next to it. Publish into a local folder, then upload that folder to any HTTPS host (object storage, GitHub Pages, a CDN):

```bash
halo publish acme-1.0.0.halotool --registry ./site/index.json
# upload ./site, then:
halo add acme --registry https://tools.example.com/index.json
```

A version's `file` is resolved relative to the index, or can be an absolute `https://` URL.

```json
{
  "format": "halo-registry/1",
  "packages": {
    "acme": {
      "description": "The Acme orders API",
      "publisher": "Acme Inc.",
      "latest": "1.0.0",
      "versions": {
        "1.0.0": {
          "file": "packages/acme-1.0.0.halotool",
          "sha256": "…",
          "providers": ["Acme"],
          "permissions": { "network": ["api.acme.example"], "env": ["ACME_API_KEY"], "spawn": [], "code": false },
          "publishedAt": "2026-11-02T20:23:38.025Z"
        }
      }
    }
  }
}
```

`permissions` in the index is what `halo search` shows before install. `halo add` computes the permissions it prints and records from the package itself, not from the index.
