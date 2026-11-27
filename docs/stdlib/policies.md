# Policies

A policy is a list of rules joined with `&`. An agent applies a policy with `requires`. Every rule below runs in code: no model judges the content, and the checks cost nothing. When a rule fails, the agent call throws a `PolicyViolation` (code `POLICY_VIOLATION`). The violation is recorded in `context.meta.violations` and emitted as a `violation` event. Violations are never retried, but `@correct(n)` can ask the model to fix its answer.

```halo
policy Safe    : Block(PromptInjection, DestructiveOps) & Redact(PII, APIKey) & LogViolation()
policy Budget  : MaxSpend(0.50)
policy Shape   : Require(JSON) & MaxWords(300)
policy Limits  : Validate("amount", "<=", "context.data.request.limit")

agent Refunder [openai/gpt-4o-mini]
  requires Safe, Budget, Shape, Limits
```

## Enforced rules

| Rule | Checked on | Effect |
|---|---|---|
| `Block(cat, ...)` | prompt, answer, and tool calls | Fails if any category is detected |
| `Redact(cat, ...)` | prompt, answer, and tool calls | Replaces matches with `[REDACTED:<cat>]` |
| `MaxWords(n)`, `MaxChars(n)` | answer | Fails above the limit |
| `MaxTokens(n)` | answer | Fails if the provider reports more than `n` completion tokens |
| `MaxSpend(usd)` | before and after each call | Fails once the **run's** cost reaches the limit. Each call's reply is capped (`max_tokens`, sent even to providers with no default) so the call fits in what is left, and calls in flight count at their most, so parallel calls (`|*`, `each`) can't overshoot it: a call that doesn't fit waits for those in flight to finish, and near the limit replies get shorter. If a run fails, calls already sent still count in its cost. It needs each model's exact price: a call to a model Halo has no price for is refused before it is sent. See [Model prices](#model-prices) |
| `Require(JSON)`, `Enforce(JSON)` | answer | Fails unless the answer is JSON. An answer that wraps its JSON in prose or a ```` ```json ```` fence counts, and the JSON is what the agent returns |
| `Require(XML)` | answer | Fails unless the answer is well-formed XML |
| `Require(Citation)` | answer | Fails unless the answer cites like `[1]` or `[doc_id]` |
| `MatchRegex("pattern")` | answer | Fails unless the pattern matches |
| `Validate("field", "op", value)` | answer | Compares a field of the JSON answer with a literal or a `"context.…"` path. `op` is one of `== != < <= > >=`. Numbers compare as numbers (`"4"` counts as 4); `true`, `[]`, and `""` are not numbers, so `<` and `>` fail on them. |
| `LogViolation()` | — | Also logs this policy's violations with `logger.warn` |
| `AllowMedia(kind, ...)` | images and documents sent to the agent | Lets an agent with `Block` or `Redact` be sent these kinds of file (`image`, `document`, `pdf`, `png`, `jpeg`, `gif`, `webp`), and limits any agent to them. See [Images and documents](#images-and-documents) |

Redaction runs before blocking, so `Redact(Email) & Block(Email)` never blocks.

Both apply everywhere text crosses the agent's boundary, so a model talked into moving something out of its answer can't route around them:

- **In:** the prompt, a `system:` given on the call (it can carry pipeline data), the results of tools it calls, and its own rejected answer when `@correct` sends it back (redacted, or withheld if a `Block` rule would stop it). The agent's declared `system` and skills are your text and are sent as written.
- **Out:** the answer, and the arguments of every tool call the agent chooses. A call whose arguments a `Block` rule matches is refused (a violation with `phase: "tool"`), and `Redact` masks the arguments before the tool sees them.

**`Block` and `Redact` are filters, so they're best-effort.** They catch the common spellings and the disguises below, but someone determined can always word an instruction or a command another way. Use them to catch the obvious, and keep what must never happen behind structure: `ApproveEffects(write, external)` so a person says yes first, a [sandbox](./remote.md) for code, a database role that can only read, and tool rules (`AllowTools`, `DenyArgs`, `Fixed`) that limit what a call can be at all.

They also read the text the ways a model can be asked to disguise it: a key, card or SSN spelled out one character at a time (`s k - a n t - …`) or written backwards, look-alikes folded (fullwidth and other-script digits, accents, invisible characters, Cyrillic and Greek letters that look Latin, dash and space look-alikes, soft hyphens), HTML entities and `%` escapes decoded, digits spread out or split by `_`, `/`, `*` or HTML tags (`1 2 3 - 4 5 - 6 7 8 9`), emails spelled out (`bob [at] example [dot] com`, `bob at example dot com`), defanged IPs (`10[.]0[.]0[.]1`), and base64 or hex runs decoded. The word categories (`PromptInjection`, `DestructiveOps`, `Profanity`) also read the text with comments and tags removed (`DROP/**/TABLE`), spread-out letters joined (`I-g-n-o-r-e`), and digits for letters undone (`1gn0re`). Objects are read field by field (keys and numbers too), and an output's redacted or blocked text is what telemetry and Studio keep.

### Images and documents

`Block` and `Redact` read text, so they can't see what is in a picture, a PDF, a recording or a video. An agent with either rule is sent none of those [files](../guide/files.md) unless one of its policies says `AllowMedia(...)`: the call is refused with a violation (`rule: "AllowMedia"`, `phase: "input"`), and an image a tool returns to it is left out, with the agent told why. A file's name is part of the text the rules read.

The detectors are patterns, so they are one layer, not a guarantee: they can't see a value split across several fields, spelled out in words, or in a cipher. What `Redact` removes from the input never reaches the model, so the dependable way to keep a value out of an answer is to redact it on the way in, or not pass it at all (`System.Pick`).

### Categories

| Category | `Block` | `Redact` | Detects |
|---|---|---|---|
| `PromptInjection` | ✓ | | "ignore previous instructions", "new instructions:", chat-template role markers, "reveal the system prompt", "you are now DAN", the same in Spanish, French, German, Portuguese and Italian… |
| `DestructiveOps` | ✓ | | `DROP TABLE`, `TRUNCATE`, `DELETE FROM`, an `UPDATE … SET` with no `WHERE`, `rm` with `-r`/`-R`/`--recursive` anywhere among its flags, `shutil.rmtree` and the other languages' recursive deletes, `find -delete`, `dd of=/dev/…`, `git push --force`/`-f`/`--mirror`/`--delete`, `git reset --hard`, `git clean -f`, `mkfs`, `terraform destroy`, `kubectl delete`, `aws s3 rm --recursive`… |
| `Profanity` | ✓ | | a short English word list |
| `Markdown` | ✓ | | bold, headings, code fences |
| `PII` | ✓ | ✓ | SSN, credit card, email, and phone |
| `SSN`, `CreditCard`, `Email`, `Phone`, `APIKey` | ✓ | ✓ | each alone (credit cards are Luhn-checked; phones include `+` international numbers; API keys are OpenAI, Anthropic, AWS, GitHub, GitLab, Slack, Stripe and Google formats, JWTs, and PEM private keys) |
| `IPAddress` | ✓ | ✓ | IPv4 addresses |

The detectors are regular expressions. They catch common patterns, not every possible variant.

### Model prices

`MaxSpend` counts each call at its model's price. Halo looks for one in this order:

1. What the provider says it billed, when it says (OpenRouter's `usage.cost`). This counts after the call.
2. `"prices"` in halo.json, in USD per million tokens, keyed by the model as you wrote it in the `.halo` file.
3. Halo's own table: the Claude models on [Anthropic's pricing page](https://platform.claude.com/docs/en/about-claude/pricing) (Haiku 5.5 at its higher price when the prompt is over 100,000 tokens), a few OpenAI and Gemini models, and `ollama/` models, which are free.

```json
{
  "prices": {
    "openrouter/acme/big-model": { "input": 2.5, "output": 10 },
    "vllm/my-model": { "input": 0, "output": 0 }
  }
}
```

The table matches a model only by its exact id (a dated snapshot like `-20250929` counts as its model). It doesn't guess from a name: `anthropic/claude-3-5-sonnet` has no price, and nor does any OpenRouter, Together, Replicate or other OpenAI-compatible model until you add one.

Under `MaxSpend`, a call to a model with no price is refused before it is sent, since the limit couldn't be kept:

```
MaxSpend can't be enforced: Halo has no price for openrouter/openai/o1-pro. Add it to "prices" in halo.json, in USD per million tokens: {"prices": {"openrouter/openai/o1-pro": {"input": ..., "output": ...}}}
```

It is a violation like any other (`rule: "MaxSpend"`, `phase: "budget"`). Without `MaxSpend` such a call still runs, and its cost is a rough estimate: its `llm` event and its entry in the run's calls say `priced: false`. `halo plan` says "no price" for these models, and leaves the run's worst case unknown.

Prices change. Halo's table is what the pricing page said when this Halo was released; add a model to `"prices"` to use a newer price, or a discount you have.

## Tool rules

These rules apply to the tool calls an agent chooses itself (an agent call with `tools:`, see [Agents with Tools](../guide/agents-with-tools.md)). They run in code, before the call.

```halo
policy FixerTools : AllowTools("Code.*", "Tests.run")
  & DenyTools("Code.delete")
  & DenyArgs("Code.write", "path", "\\.test\\.")
  & DenyArgs("Tests.run", "command", "^(?!bun test[\\w ./-]*$)")
  & ApproveEffects(external)
```

| Rule | Effect |
|---|---|
| `AllowTools(pattern, ...)` | Only matching methods are offered. Others are hidden |
| `DenyTools(pattern, ...)` | Matching methods are hidden |
| `AllowEffects(effect, ...)` | Only methods with these effects are offered |
| `ApproveTools(pattern, ...)` | A call to a matching method waits for a person's approval |
| `ApproveEffects(effect, ...)` | A call to a method with these effects waits for a person's approval |
| `DenyArgs(pattern, regex)` | A call is refused if any argument value, checked one at a time, matches `regex` |
| `DenyArgs(pattern, "arg", regex)` | A call is refused if that one argument matches `regex`. A missing argument counts as `""` |
| `AllowHosts(host, ...)` | The agent's Docker sandbox (`sandbox: "docker"` or `"auto"`) can reach only these hosts (`"pypi.org"`, `"*.pythonhosted.org"`). See [Allowed hosts](./remote.md#allowed-hosts) |
| `AllowFiles(path, ...)` | The agent's own sandbox starts with only these folders and files of the project (`"src/billing"`), and only changes to them are written back. See [Only some of the project](./remote.md#only-some-of-the-project) |
| `AllowSecrets(name, ...)` | The agent's Docker sandbox gets these environment variables for its commands, masked in what comes back. See [Secrets](./remote.md#secrets) |
| `AllowWallet(item, ...)` | The [wallet](./wallet.md) items or fields the agent may have a browser type (`"Card"`, `"Me.email"`, `"Card.*"`). Without one, an agent can type nothing from a wallet. Several narrow, like `AllowTools` |
| `ApproveWallet(item, ...)` | Ask a person before typing these, even for an item that says `ask: false` |

**Patterns** match `"Tool.method"`: `Repo` (any method of `Repo`), `Repo.create_pr`, `Repo.*`, `*.delete`, or `*`. A `*` doesn't cross the dot.

**Effects** are `read`, `write`, `external` and `wallet`. Each method of each provider has one; `halo tools` lists them, and `halo plan` shows them for a pipeline. `external` means the call acts outside this machine or can't be taken back (a POST, a Slack message, a shell command, a click in `Chrome`); `write` changes local or stored state (a file, a KV key, a SQL statement such as `SQLite.execute`); `wallet` types a value from a [wallet](./wallet.md) into a page (`Chrome.fill_secrets`). For an MCP server's tools, the effect comes from the server's own annotations (see [MCP](../guide/integrations/mcp.md#effects)). An effect is a description written by whoever made the provider, not something Halo measures. Built-in providers err on the side of `external`: `Code.run` is `external`, because a snippet can use the network and start programs, so `AllowEffects(read, write)` excludes it.

How they combine:

- A hidden method isn't offered to the model. If the model calls it anyway, the call is refused.
- Every `AllowTools` and `AllowEffects` rule on the agent must allow a method, so several policies narrow what's allowed.
- Refused calls (by `AllowTools`, `DenyTools`, `AllowEffects`, or `DenyArgs`) are recorded in `context.meta.violations` with `phase: "tool"` and emit a `violation` event. The run doesn't fail: the model is told the call was refused, and continues.
- `ApproveTools` and `ApproveEffects` apply after the refusal checks, so a refused call is never put to a person. See [Approvals](../guide/agents-with-tools.md#approvals) for how a person answers, and when a run can't pause.
- If an agent's policies allow none of its tools' methods, the call fails with `TOOL_CONFIG`.

**`DenyArgs`** is case-insensitive. With no argument name, it checks every string, number and boolean in the arguments, at any depth, each on its own. With a name, it checks only that argument, and a missing argument is checked as `""`. Each value is also checked with look-alike characters folded and JSON escapes decoded. To allow only some values, write a negative lookahead: `"^(?!bun test[\\w ./-]*$)"` refuses any `command` that isn't `bun test` followed by plain arguments. `$` matches only at the very end, so a second line (`bun test\nrm -rf .`) is refused.

A limit that belongs to the tool, whoever calls it, goes on the tool's declaration instead: `Fixed`, `Match` and `Locked` (see [Rules on a tool's arguments](./tools.md#rules-on-a-tool-s-arguments)).

In a Halo string, a regular expression's backslash is written `\\`: `"\\.test\\."` is the regex `\.test\.`. `halo validate` reports a pattern that isn't a valid regular expression, an effect that isn't one of the four, and a tool name that isn't declared.

Tool rules don't apply to tool calls the pipeline makes itself (`|> Files.write(...)`) or to `Agent.task(tool: T)`, which runs `T` before the agent sees anything. Those calls are written in the pipeline, so `halo plan` lists them.

## Not enforced

`Tone(...)`, `Anonymize(...)` and `MaxDensity(...)` would need a model to judge the output, and that isn't implemented. The validator warns about them, and the runtime **ignores** them.

Anything else a policy can't check is an error, because a rule that silently does nothing is worse than a file that doesn't load. That covers:

- a rule name Halo doesn't have (`maxspend`, `MaxSpnd`);
- a `Block`/`Redact` category it can't detect (`Block(Competitors)`, `Block(PromptInjecton)`);
- `Require(...)` with anything other than `JSON`, `XML` or `Citation` (for a person's approval, use `|! yield`);
- `Enforce(...)` with anything other than `JSON`.

When the name is close to a real one, the error says which (`maxspend(...) is not a policy rule; did you mean MaxSpend?`). A tool name in a tool rule that's close to a declared tool (`AllowTools("Cod.*")` with `tool Code`) is an error too. A tool name that matches nothing declared is a warning, because the policy may be shared with a file that declares it.

There is no API for custom policy rules. To run your own checks, do them in a tool provider or a `System` method (`runtime.registerSystem`) placed after the agent stage, and call `System.Fail(...)` or throw.
