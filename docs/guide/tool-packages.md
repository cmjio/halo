# Packages

A package brings things into a project that someone else wrote: tool providers (a service's REST API described as data, an MCP server, or a module of code), and `.halo` files with agents, pipelines, policies, schemas and tools. Names are scoped, like npm's: `@acme/support-kit`. Halo's own packages are in `@halo`, and a bare name means one of them: `stripe` is `@halo/stripe`.

## Using packages

```bash
halo search                    # what the registry has
halo search issues             # matches names, descriptions and keywords
halo info @halo/jira           # versions, exports, model slots, permissions, README
halo add stripe                # the latest version, as "^1.0.0" in halo.json
halo add @acme/support-kit@~1.2 # a range of your choosing
halo add @halo/github-mcp --trust  # it starts a program, so it needs --trust
halo tools                     # every provider in this project, with its methods
halo remove stripe
```

`halo add` writes the range into `halo.json`, installs the package and everything it depends on, pins them in `halo.lock`, and prints what each one can reach and how to use it:

```
✓ @halo/stripe@1.0.0
    network: api.stripe.com
    reads env: STRIPE_API_KEY
    runs its own code: no

  @halo/stripe ^1.0.0 is in halo.json. Use it:
    use "@halo/stripe" { Stripe }
    tool X : Stripe(...)
```

```json
{
  "dependencies": {
    "@halo/stripe": "^1.0.0",
    "@acme/support-kit": "^1.2.0"
  }
}
```

Then use what it exports. A `.halo` file names the package and the names it wants; the version comes from `halo.json` and `halo.lock`:

```halo
use "@acme/support-kit" { Triage } with models(fast: anthropic/claude-haiku-4-5)
use "@halo/stripe" { Stripe }

policy Refunds : ApproveTools("Pay.create_refund")

tool Pay : Stripe()

agent Billing [openai/gpt-4o]
  equips Pay
  requires Refunds

pipeline Refund(request: String) -> Result:
  request |> Billing.handle("Find the charge this customer means and refund it.", tools: [Pay])
```

A provider from a package you depend on directly also works without `use` (`tool Pay : Stripe()`), as long as no other direct dependency has a provider of the same name; `@halo/stripe#Stripe` always names it exactly.

The key comes from the variable the package names (`STRIPE_API_KEY` here). `Stripe(apiKey: Env.OTHER_KEY)`, or the key as the first argument, overrides it. `halo tools` shows each method colored by its effect (read, write, external), and agents see the same methods and descriptions (see [Agents with Tools](./agents-with-tools.md)).

### Model slots

A package's agents don't pick a model: they declare slots in its `halo.json` (`models`), and you fill them, so you choose what you pay for. Fill them on the `use` line, or for the whole project in `halo.json`:

```json
{ "models": { "smart": "anthropic/claude-sonnet-4-5" } }
```

The `use` line wins. `halo info` lists a package's slots with what each needs and a suggested model, and `halo add` puts the suggestions in the example `use` line it prints.

**Cascades.** A slot holds one model. A package that wants a bigger model when a call fails cascades through another of its slots, `@cascade(models.smart)`, so every model it can move up to is one you bound; `halo publish` refuses a package whose `@cascade` or `@shadow` names a fixed model, since you'd pay for a model you never chose. A cascade inside a package runs inside that package's agents: you choose the models at each step, the package chooses when to move up. You can't put your own `@cascade` on a package's agent; to get one, wrap its pipeline in yours, or ask the publisher for another slot. (Project files can use slots in cascades too: `@cascade(models.big)` takes `big` from `halo.json`.)

### What `halo add` takes

| Spec | Adds |
|---|---|
| `stripe`, `@halo/stripe` | The newest version, as `^x.y.z` |
| `@acme/kit@^1.2.0`, `@acme/kit@1.2.3` | That range or version |
| `./my-package` | A package folder (with `halo.json`, or a v1 `halo-tool.json`), packed on the fly |
| `my-package-1.0.0.halotool` | A packed file |
| `https://example.com/acme-kit-1.0.0.halotool` | A packed file, downloaded. Plain `http://` is refused except on localhost |

Packages are unpacked into `.halo/packages/@scope/name/`.

### Versions

`dependencies` holds npm-style ranges: `^1.2.0`, `~1.2.0`, `1.2.3`, `>=1.0.0 <2.0.0`, `1.x`, `*`. Halo picks **one version of each package** for the whole project: the newest that satisfies every range that asks for it, including the ranges in other packages' `halo.json`. If none does, `halo install` stops and prints each chain of requirements:

```
No version of @acme/zendesk satisfies every requirement:
  halo.json → @acme/zendesk ^1.0.0
  halo.json → @acme/support-kit@2.0.0 → @acme/zendesk ^2.0.0
```

- Prereleases (`2.0.0-beta.1`) are picked only by a range that names one.
- A yanked version is never picked, but a `halo.lock` that already pins it still installs it.
- A package's `"halo"` range must accept your Halo, or Halo picks an older version that does, or says to run `halo upgrade`.

```bash
halo outdated                  # newer versions, within your ranges (Wanted) and beyond them (Latest)
halo update                    # move everything to Wanted
halo update @acme/kit --latest # move past the range, and rewrite it in halo.json
```

### Registries

The default registry is `https://registry.halolang.com/` (in a checkout of Halo, the bundled `registry/` folder). To use another, pass `--registry <https URL or folder>`, set `HALO_REGISTRY`, or add `"registry"` to `halo.json`; the flag wins over the variable, and the variable over `halo.json`. A scope can have its own:

```json
{ "registries": { "@acme": "https://halo.acme.internal" } }
```

A package stays with the registry it was locked from while your settings still name that registry for it (its scope's registry, or `--registry`, `HALO_REGISTRY`, `"registry"` or Halo's own), so `--registry` for one command doesn't move it. A `halo.lock` entry from any other registry is ignored with a warning, and the package is resolved from the registry your settings choose: `halo.lock` alone can't send a package, or your token, somewhere else. Every file is checked against the sha256 in the registry's package document, and against `halo.lock`.

A version is written exactly `MAJOR.MINOR.PATCH` or `MAJOR.MINOR.PATCH-PRERELEASE`: no leading `v`, no spaces, and no build metadata (`+...`), so one version has one spelling and can't be published twice.

### `halo.lock`

```json
{
  "lockfileVersion": 2,
  "packages": {
    "@acme/support-kit": {
      "version": "1.2.0",
      "source": "registry:default",
      "sha256": "ab3f…",
      "dependencies": { "@acme/zendesk": "1.0.0" },
      "permissions": { "network": [], "env": ["ZENDESK_SUBDOMAIN"], "spawn": [], "code": false, "hosted": [] },
      "direct": true
    },
    "@acme/zendesk": {
      "version": "1.0.0",
      "source": "registry:default",
      "sha256": "91c0…",
      "dependencies": {},
      "permissions": { "network": ["*.zendesk.com"], "env": ["ZENDESK_TOKEN"], "spawn": [], "code": false, "hosted": [] },
      "direct": false
    }
  }
}
```

Commit `halo.json` and `halo.lock`. `halo install` installs exactly what the lock pins, at the pinned checksums, and resolves again only what changed in `halo.json`. If any package runs its own code (`"code": true`), it refuses unless you pass `--trust`: check the lock first. Don't commit `.halo/`: it's install output, and `halo install` rebuilds it.

`permissions` are each package's own. The install summary shows them per package, says which dependency added each one, and adds them up.

`source` says where a package came from:

| `source` | Means |
|---|---|
| `registry:default` | Halo's registry, wherever Halo is installed |
| `registry:https://halo.acme.internal/` | Another registry |
| `vendor/acme-kit`, `vendor/acme-kit-1.0.0.halotool` | A folder or file inside the project |
| `https://…/acme-kit-1.0.0.halotool`, `/abs/path/…` | A URL, or a file or folder outside the project |

`halo run`, `debug`, `test`, `plan`, `tools`, `serve` and `mcp` load packages from `.halo/packages`. `halo validate` reads the packages' `.halo` files and provider names (to check what you `use`), and never loads package code. Each package's `package.halotool` must match the pinned sha256, or the command stops and asks you to run `halo install`. The unpacked files are rewritten from that verified package before anything loads, so an edited file in `.halo/packages` never runs.

A Halo 0.8 `halo.lock` (with `tools`) still loads. The next `halo install` (or `halo add`) moves its packages into `halo.json` `dependencies` (`stripe` becomes `@halo/stripe`) and rewrites the lock as version 2.

## Security

What a package's providers can do depends on their kind.

| Kind | What runs | Needs `--trust` |
|---|---|---|
| `http` | Nothing from the package. Halo builds each request from the manifest | No |
| `mcp` with `url` | Nothing locally. Halo talks to that server | No |
| `mcp` with `command` | That command, as your user | Yes |
| `module` | The package's code, inside Halo's own process | Yes |

- **An http package** can only send requests under its declared base URL: a path that would leave it is refused, `{name}` path values are URL-encoded, and `{{site}}`-style parts of the base URL come only from the tool declaration (letters, digits, `.`, `-` and `_`), never from a model. But the package decides which host gets your key: a manifest that sends `OPENAI_API_KEY` to its own server is valid. Read `network` and `reads env` before you install.
- **A command** (stdio MCP) gets only `PATH`, `HOME`, and the variables the manifest lists, but runs with your files and network. The checksum covers the manifest, not what the command fetches: `npx -y some-server` or a Docker image without a digest runs whatever is current when it starts.
- **A module** runs in Halo's process, with every environment variable (all your API keys), your files, and the network. Treat it like any dependency you `bun install`. Its own `node_modules` aren't packed, so it can import only Bun's built-ins, files in the package, and what Halo itself can resolve.
- **A hosted export** runs on its publisher's server: your inputs are sent there. The install summary says so (`sends your inputs to: …`).
- **`--trust` is kept on this machine, not in `halo.lock`.** `halo add --trust` (or `halo install --trust`) records each code-running package's exact sha256 in `.halo/trust.json`. It loads only if `.halo/trust.json` has the checksum `halo.lock` pins, so a pull request that moves a package to a new version, or adds one that runs code, stops the next command with a message to trust it again. Don't commit `.halo/trust.json`.
- **Checksums** catch a download that differs from the registry's package document or from `halo.lock`, and installed files that changed afterwards. They don't protect against a malicious publisher. A package installed from a folder, file or URL has no registry checksum; whatever was read is pinned.
- **Updates.** A locked version never changes under you: `halo.lock` pins its sha256 and the registry never replaces a published file. When `halo update` moves to a version that reaches a new host, env variable, hosted endpoint or command, the install summary says `reaches more than before: …`.
- **Policies a package exports only narrow.** Every rule restricts (`AllowTools` lists what's allowed, `DenyTools` removes, approval rules add a step), and an agent under several policies gets what all of them allow, so a package's policy can't loosen yours. It binds nothing until one of your agents `requires` it. Your policies, in turn, bind your agents: a package's agents run under the package's own policies, so read what its agents equip (and its `network`) the way you'd read any dependency.
- **Skills a package ships** are instructions added to an agent's prompt when that agent names them. They don't add tools: an agent can only call what it `equips`, whatever a skill says.
- **Effects** (`read`, `write`, `external`) are what the publisher wrote. Policies that select by effect (`AllowEffects(read)`) trust that. To be sure, name methods: `AllowTools("Pay.list_charges", "Pay.get_customer")`.

### An allow-list in `halo.json`

Without one, `halo install` shows what each package reaches and stops only for packages that run their own code. With one, it fails closed: every package, including those added by other packages, must stay inside it, or nothing is installed. Use it in CI so a new dependency or version can't reach somewhere you didn't approve:

```json
{
  "allow": {
    "network": ["*.zendesk.com", "api.stripe.com"],
    "env": ["ZENDESK_*", "STRIPE_API_KEY"],
    "hosted": ["replies.acme.com"],
    "spawn": [],
    "code": false
  }
}
```

A missing list allows nothing of its kind. In hosts, `*` is one DNS label; in env names, any characters; a lone `"*"` allows anything. A package whose base URL is `https://{{subdomain}}.zendesk.com` reaches `*.zendesk.com`, so only a pattern at least that broad covers it. `"code": true` allows code-running packages; they still need `--trust`.

```
These packages need more than halo.json "allow" permits:
  @acme/inner@1.0.0 (added by @acme/support-kit@1.2.0)
      network: collect.example.com
      env: OPENAI_API_KEY
Nothing was installed. Add what you accept to "allow" in halo.json, or stay on a version that fits.
```

The permissions it checks are computed by `halo install` from the downloaded package itself, not taken from the registry's page; the same lists are in `halo.lock` (`permissions`) and in the registry's JSON (`v1/packages/@scope/name.json`, each version's `permissions`), so other tools can check them too.

## Writing a package

```bash
halo init --package --name @you/greeter   # halo.json, README.md, lib/main.halo
```

A package is a folder with a `halo.json` that has a `name` and a `version`, and a `README.md` (the registry shows it as the package's page).

```json
{
  "name": "@acme/support-kit",
  "version": "1.2.0",
  "description": "Ticket triage for Zendesk",
  "license": "MIT",
  "repository": "https://github.com/acme/halo-support-kit",
  "keywords": ["support", "zendesk"],
  "halo": ">=0.9.0",
  "exports": ["lib/support.halo"],
  "models": {
    "fast": { "description": "Classifies tickets. Needs tool calls.", "suggested": "anthropic/claude-haiku-4-5" }
  },
  "providers": {
    "Zendesk": {
      "kind": "http",
      "description": "The Zendesk Support API",
      "baseUrl": "https://{{subdomain}}.zendesk.com/api/v2",
      "auth": { "type": "bearer", "env": "ZENDESK_TOKEN" },
      "methods": [
        { "name": "get_ticket", "description": "Read a ticket by id", "effect": "read", "http": { "method": "GET", "path": "/tickets/{id}.json" } }
      ]
    }
  },
  "env": ["ZENDESK_SUBDOMAIN"],
  "dependencies": { "@halo/stripe": "^1.0.0" }
}
```

| Field | Rule |
|---|---|
| `name` | `@scope/name`: lowercase letters, digits, `-`, `.` and `_`, at most 214 characters. You publish into scopes you own (`halo whoami`) |
| `version` | Semver: `1.2.3`, optionally with a prerelease (`1.2.3-beta.1`) |
| `description` | Required |
| `license`, `repository`, `homepage`, `keywords` | Optional. Shown on the package page and by `halo info` |
| `halo` | The Halo versions it works with, as a range |
| `exports` | The public `.halo` files. Every declaration in them is exported; other files stay private |
| `models` | Model slots its agents use: `agent Triager [models.fast]` |
| `providers` | Tool providers, keyed by the name used in `tool X : Name()`: a capital letter, then letters and digits |
| `skills` | A folder of skills (`SKILL.md` layout) |
| `env` | Environment variables it reads beyond what the providers declare |
| `dependencies` | Other packages, by range |
| `hosted` | Pipelines that run on your own server, on your models and keys. See [Hosted packages](./hosted-packages.md) |

A package must export something: `exports`, `providers`, `skills` or `hosted`. `halo pack` and `halo publish` check the manifest and list every problem at once.

**Agents use model slots, not model ids.** Everyone who uses your package pays for its tokens, so they choose the model: `halo publish` refuses a package whose agents hard-code one (`[openai/gpt-4o]`), in any of its `.halo` files, exported or not. Declare a slot in `models` with a description of what it needs, and write `[models.<slot>]`. Only the sources of [hosted pipelines](./hosted-packages.md) may name a model: they run on your server with your keys, and they never ship (the package holds only their interfaces).

`halo pack` and `halo publish` run the same checks on the `.halo` files as the registry does when it receives the package, so what passes `halo publish --dry-run` is accepted:

- every file parses;
- every agent in a shipped file uses a slot declared in `models`;
- no two exported files declare the same name;
- `use` names only files inside the package, or packages in its `dependencies`;
- there is a `README.md`;
- for a [hosted package](./hosted-packages.md): every hosted pipeline has a well-formed interface, `hosted.auth` is set, and no `.halo` file that `exports` doesn't reach (a hosted source) is in the package.

The registry also computes the exports and permissions itself from the files (the tools your `.halo` files declare, the hosts and env they reach, your providers, and hosted endpoints), rather than trusting the client.

A v1 package (a `halo-tool.json` with only `providers` and a bare name) still packs and installs. To publish it to a registry, move its fields into a `halo.json` with a scoped name, and add a README.

Every provider has a `kind` and a `description`.

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
halo pack                         # → acme-support-kit-1.2.0.halotool
halo pack ./kit --out dist/
halo login                        # once per registry: prints a code and a URL to approve it at
halo publish --dry-run            # check, and print the exports, model slots and permissions
halo publish                      # to the registry for its scope (or --registry)
```

`halo pack` writes one file: JSON holding `halo.json` and every file in the folder (base64), except dotfiles, `node_modules`, `.halo/`, `halo.lock`, `.env` files and other `.halotool` files. A package's files can add up to at most 5 MB (the packed file, with base64 and the JSON around it, may be up to 8 MB, which is what a registry accepts). It prints the sha256 and the permissions.

`halo publish` packs the folder (or takes a `.halotool`), runs the checks, and prints what it computed before uploading. For a package with `hosted`, `halo pack` and `halo publish` leave the hosted sources out and write each hosted pipeline's interface (parameters, return type, schemas and tool effects) instead; see [Hosted packages](./hosted-packages.md). A version can be published once; bump the version for a new one. `halo login` saves a token in `~/.halo/credentials.json` (readable only by you), per registry; `HALO_TOKEN` overrides it, which is how CI publishes: it applies to Halo's registry, or to the one `HALO_TOKEN_REGISTRY` names, never to a registry named only by a project's `halo.json` or `halo.lock`. A package can't ship a literal serve token or its consumer keys file: see [Hosted packages](./hosted-packages.md#consumer-keys).

After publishing:

```bash
halo yank @acme/support-kit@1.2.1 --reason "breaks triage"   # hidden from resolution; locks that pin it still install it
halo unyank @acme/support-kit@1.2.1
halo deprecate @acme/support-kit@"<1.0" "Use 1.x"           # shown when it's installed ("" clears it)
halo dist-tag add @acme/support-kit@2.0.0-beta.1 beta
halo owner add @acme someone --role publisher                # who can publish in a scope
halo scope create @acme
halo scope verify @acme acme.com                             # a DNS TXT record proves the domain
halo token create --name ci --scope @acme                    # tokens for CI; also: token list, token revoke <id>
```

### Hosting a registry

A registry can be a folder of static files. `halo publish --registry ./site` writes this layout, which any HTTPS host (object storage, GitHub Pages, a CDN) can serve:

```
v1/index.json                                 every package: name, description, latest
v1/packages/@acme/support-kit.json            the package's document: versions, sha256s, permissions, README
v1/files/@acme/support-kit/1.2.0.halotool     the package files
```

`halo yank`, `deprecate` and `dist-tag` work on a folder registry too. Projects use it with `--registry https://tools.example.com/`, `HALO_REGISTRY`, or `"registries": { "@acme": "https://tools.example.com/" }` in `halo.json`. `halo add` computes the permissions it prints and records from the package itself, not from the registry's document.

A v1 registry (one `index.json` with `"format": "halo-registry/1"`) is still read, so old lockfiles that point at one keep installing. `halo publish x.halotool --registry ./index.json` still adds a v1 package to one.
