# Guardrails & Safety

A system prompt can be talked around, but policy rules can't. They run in the runtime, in code, on every call to an agent that `requires` them.

```halo
policy Untrusted : Block(PromptInjection) & Redact(PII, APIKey)
policy Budget    : MaxSpend(5.00)
policy Shape     : Require(JSON) & MaxWords(400) & Block(Markdown)

@correct(2)
agent SupportBot [openai/gpt-4o-mini]
  system "You answer customer questions. Reply with JSON."
  requires Untrusted, Budget, Shape

pipeline Answer(question: String) -> Result:
  question |> SupportBot.answer()
```

On each `SupportBot` call:

1. **Budget.** If the run has already spent $5.00, the call fails before anything is sent.
2. **Input.** Emails, phone numbers, SSNs, cards, and API keys in the prompt are replaced with `[REDACTED:…]`. A prompt-injection pattern fails the call.
3. **Output.** The answer is redacted the same way. It must parse as JSON, stay under 400 words, and contain no Markdown. If it doesn't, `@correct(2)` sends the model its rejected answer and the reason, up to two more times. After that, the run throws a `PolicyViolation`.

Every violation is added to `context.meta.violations` and emitted as a `violation` event. `halo run` prints each one.

The full rule and category list is in [Policies](../../stdlib/policies.md). The detectors are pattern-based, so treat them as one layer of defense, not a guarantee.

## What is not enforced

`Tone(...)`, `Anonymize(...)`, `MaxDensity(...)`, `Require(Approver)`-style checks, and topic blocks like `Block(Competitors)` would each need a model to judge the content. The runtime **ignores** them, and `halo validate` warns about every one. Run `halo validate --strict` in CI to make those warnings fail the build.

## Other safety features

- **Secrets stay out of prompts.** `Env.X` works only in tool declarations, and `{{Env.X}}` is never filled in.
- **Shell quoting.** Values inserted into `Bash` commands are shell-quoted.
- **Read-only SQL.** `PostgreSQL` refuses writes unless the tool is declared with `readOnly: false`. A [`SQLite`](../../stdlib/sqlite.md) tool opens its file read-only unless it's declared with `write: true`. Its reads run with SQLite's `query_only` setting on, and SQL with `{{placeholders}}` in it is refused, so values have to go in `params:`.
- **Gates and approvals.** `|? (cond)` stops a run, and `|! yield` waits for a human (see [Human-in-the-Loop](./human-in-the-loop.md)).
- **Audit trail.** `context.trace` is a SHA-256 hash chain of every stage. `verifyTrace(trace)` checks the chain, which catches an edited entry unless every later hash was recomputed too.

## Custom checks

Policies can't be extended from TypeScript. To add your own check, register a tool provider and call it in a stage after the agent:

```ts
runtime.registerToolProvider("CompetitorCheck", async ({ positional: [text] }) => {
  if (/AcmeCorp|GlobalTech/.test(String(text))) throw new Error("Output mentions a competitor");
  return text; // pass the text through unchanged
});
```

```halo
tool  NoCompetitors : CompetitorCheck()
agent Marketer [anthropic/claude-haiku-4-5]

pipeline Tagline(product: String) -> Result:
  product |> Marketer.write_tagline() |> NoCompetitors.check()
```

`halo validate` warns that `CompetitorCheck` is an unknown provider. Pass `{ toolProviders: ["CompetitorCheck"] }` to `compile()` or `validate()` to tell it about the provider.
