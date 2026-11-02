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

## Not enforced

The validator warns about each of these, and the runtime **ignores** them:

- `Tone(...)`, `Anonymize(...)`, `MaxDensity(...)`: these would need a model to judge the output, and that isn't implemented.
- `Require(...)` with anything other than `JSON`, `XML`, or `Citation`, for example `Require(Approver)`. For human approval, use `|! yield`.
- `Enforce(...)` with anything other than `JSON`.
- `Block`/`Redact` with any other category, for example `Block(Competitors)` or `Block(HateSpeech)`.
- Any other rule name.

There is no API for custom policy rules. To run your own checks, do them in a tool provider or a `System` method (`runtime.registerSystem`) placed after the agent stage, and call `System.Fail(...)` or throw.
