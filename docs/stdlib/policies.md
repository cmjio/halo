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
| `Block(cat, ...)` | prompt and answer | Fails if any category is detected |
| `Redact(cat, ...)` | prompt and answer | Replaces matches with `[REDACTED:<cat>]` |
| `MaxWords(n)`, `MaxChars(n)` | answer | Fails above the limit |
| `MaxTokens(n)` | answer | Fails if the provider reports more than `n` completion tokens |
| `MaxSpend(usd)` | before and after each call | Fails once the **run's** cost reaches the limit. Each call's reply is capped (`max_tokens`, sent even to providers with no default) so the call fits in what is left, and calls in flight count at their most, so parallel calls (`|*`, `each`) can't overshoot it: a call that doesn't fit waits for those in flight to finish, and near the limit replies get shorter. If a run fails, calls already sent still count in its cost |
| `Require(JSON)`, `Enforce(JSON)` | answer | Fails unless the answer is JSON. An answer that wraps its JSON in prose or a ```` ```json ```` fence counts, and the JSON is what the agent returns |
| `Require(XML)` | answer | Fails unless the answer is well-formed XML |
| `Require(Citation)` | answer | Fails unless the answer cites like `[1]` or `[doc_id]` |
| `MatchRegex("pattern")` | answer | Fails unless the pattern matches |
| `Validate("field", "op", value)` | answer | Compares a field of the JSON answer with a literal or a `"context.…"` path. `op` is one of `== != < <= > >=`. Numbers compare as numbers (`"4"` counts as 4); `true`, `[]`, and `""` are not numbers, so `<` and `>` fail on them. |
| `LogViolation()` | — | Also logs this policy's violations with `logger.warn` |

Redaction runs before blocking, so `Redact(Email) & Block(Email)` never blocks. Both also check the text with look-alikes folded, so `１２３‑45‑6789` is still an SSN: fullwidth and other-script digits, accents, invisible characters (zero-width, bidi, tag characters, variation selectors), Cyrillic and Greek letters that look Latin, dash and space look-alikes, and HTML and `%` escapes. They read objects field by field (keys and numbers too), so a line break before a value doesn't hide it, and an output's redacted or blocked text is what telemetry and Studio keep. They don't decode base64, and can't see a value split across several fields.

### Categories

| Category | `Block` | `Redact` | Detects |
|---|---|---|---|
| `PromptInjection` | ✓ | | "ignore previous instructions", "reveal the system prompt", "you are now DAN"… |
| `DestructiveOps` | ✓ | | `DROP TABLE`, `TRUNCATE`, `DELETE FROM`, `rm -rf`, `git push --force`, `mkfs` |
| `Profanity` | ✓ | | a short English word list |
| `Markdown` | ✓ | | bold, headings, code fences |
| `PII` | ✓ | ✓ | SSN, credit card, email, and phone |
| `SSN`, `CreditCard`, `Email`, `Phone`, `APIKey` | ✓ | ✓ | each alone (credit cards are Luhn-checked; API keys are OpenAI, Anthropic, AWS, GitHub, Slack, and Google formats) |
| `IPAddress` | | ✓ | IPv4 addresses |

The detectors are regular expressions. They catch common patterns, not every possible variant.

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

**Patterns** match `"Tool.method"`: `Repo` (any method of `Repo`), `Repo.create_pr`, `Repo.*`, `*.delete`, or `*`. A `*` doesn't cross the dot.

**Effects** are `read`, `write`, and `external`. Each method of each provider has one; `halo tools` lists them, and `halo plan` shows them for a pipeline. `external` means the call acts outside this machine or can't be taken back (a POST, a Slack message, a shell command, a click in `Chrome`); `write` changes local or stored state (a file, a KV key, a SQL statement such as `SQLite.execute`). For an MCP server's tools, the effect comes from the server's own annotations (see [MCP](../guide/integrations/mcp.md#effects)). An effect is a description written by whoever made the provider, not something Halo measures. Built-in providers err on the side of `external`: `Code.run` is `external`, because a snippet can use the network and start programs, so `AllowEffects(read, write)` excludes it.

How they combine:

- A hidden method isn't offered to the model. If the model calls it anyway, the call is refused.
- Every `AllowTools` and `AllowEffects` rule on the agent must allow a method, so several policies narrow what's allowed.
- Refused calls (by `AllowTools`, `DenyTools`, `AllowEffects`, or `DenyArgs`) are recorded in `context.meta.violations` with `phase: "tool"` and emit a `violation` event. The run doesn't fail: the model is told the call was refused, and continues.
- `ApproveTools` and `ApproveEffects` apply after the refusal checks, so a refused call is never put to a person. See [Approvals](../guide/agents-with-tools.md#approvals) for how a person answers, and when a run can't pause.
- If an agent's policies allow none of its tools' methods, the call fails with `TOOL_CONFIG`.

**`DenyArgs`** is case-insensitive. With no argument name, it checks every string, number and boolean in the arguments, at any depth, each on its own. With a name, it checks only that argument, and a missing argument is checked as `""`. Each value is also checked with look-alike characters folded and JSON escapes decoded. To allow only some values, write a negative lookahead: `"^(?!bun test[\\w ./-]*$)"` refuses any `command` that isn't `bun test` followed by plain arguments. `$` matches only at the very end, so a second line (`bun test\nrm -rf .`) is refused.

In a Halo string, a regular expression's backslash is written `\\`: `"\\.test\\."` is the regex `\.test\.`. `halo validate` reports a pattern that isn't a valid regular expression, an effect that isn't one of the three, and a tool name that isn't declared.

Tool rules don't apply to tool calls the pipeline makes itself (`|> Files.write(...)`) or to `Agent.task(tool: T)`, which runs `T` before the agent sees anything. Those calls are written in the pipeline, so `halo plan` lists them.

## Not enforced

The validator warns about each of these, and the runtime **ignores** them:

- `Tone(...)`, `Anonymize(...)`, `MaxDensity(...)`: these would need a model to judge the output, and that isn't implemented.
- `Require(...)` with anything other than `JSON`, `XML`, or `Citation`, for example `Require(Approver)`. For human approval, use `|! yield`.
- `Enforce(...)` with anything other than `JSON`.
- `Block`/`Redact` with any other category, for example `Block(Competitors)` or `Block(HateSpeech)`.
- Any other rule name.

There is no API for custom policy rules. To run your own checks, do them in a tool provider or a `System` method (`runtime.registerSystem`) placed after the agent stage, and call `System.Fail(...)` or throw.
