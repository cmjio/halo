# Patterns you can read and prove

| | |
|---|---|
| Status | Draft proposal. Step 0 of the [rollout](#rollout) is built (one safe engine, fail closed, validate checks); the rest isn't. |
| Date | 27 November 2026 |
| Builds on | `DenyArgs`, `MatchRegex`, `Match` on tools, `Data.filter` `matches`, gates, `@expect`, schemas, `src/runtime/safe-regex.ts` |

This lives outside `docs/` because everything under `docs/` is published to halolang.com.

## Summary

Halo uses regular expressions in four places: policies (`DenyArgs`, `MatchRegex`), tool rules (`Match`), `Data.filter`, and searches. They are where a policy is most likely to be wrong. A regex is hard to read, easy to get almost right, and its meaning changes from place to place: `Match` covers the whole value, `DenyArgs` searches.

This proposal does four things:

1. **Structural matchers** replace most regexes in policies: `AllowCommands`, `AllowPaths`, `AllowUrls`. They parse the value the way the tool will use it, then compare parts.
2. **Patterns** you can read: built-in ones (`Pattern.email`, `Pattern.uuid`), and a `pattern` declaration in plain words, with examples that validate checks.
3. **One meaning everywhere.** A pattern means the whole value. `contains` means anywhere in it. Gates, `@expect`, `System.Extract`, schemas and policies all use the same two words.
4. **Proved claims.** `Never(Sh.run, command, contains: ["rm -rf"])` is checked by `halo validate` against every rule on that argument, with automata. It holds for every input, not just the ones a test tried. When it doesn't hold, validate shows a value that gets through.

Every pattern still compiles to the same linear-time engine. No pattern a policy or a model writes can stall a run.

## What exists today

As of this branch:

- Every policy, tool-rule and filter regex runs through `src/runtime/safe-regex.ts`. It compiles a pattern once and caches it.
- Most patterns run on RE2 (the `re2js` package), in time linear in the text. `.` and `\s` keep their JavaScript meaning. A leading lookahead like `^(?!echo [a-z]+$)` is split into separate anchored RE2 checks.
- A pattern RE2 can't run (a backreference, or a lookahead in the middle) runs on JavaScript's engine on a worker. The main thread waits at most 250ms.
- A check that can't be decided fails closed. `DenyArgs` refuses the call. `MatchRegex` and `Match` count a violation. `Data.filter` errors instead of dropping the row.
- `halo validate` compiles patterns with the runtime's options. It warns when a pattern needs the slower engine, and it is an error for a `DenyArgs` pattern that also has a nested repeat like `(a+)+`.
- `Git.grep` with `regex: true` is POSIX ERE. `\d`, `\w` and `\s` are rewritten as classes. `\b` and `\1` are errors.

### Gaps

- **Allow-lists are written as negative regexes.** `DenyArgs("Sh.run", "command", "^(?!(git status|git diff)$)")` is the common way to say "only these commands". It's hard to read, and it's easy to leave a gap (`git diff; rm -rf .` is fine if the `$` is missing).
- **The value a regex sees is not the value the tool uses.** A shell parses quotes and `$()`. A filesystem resolves `..` and symlinks. A URL parser decodes `%2e`. `DenyArgs` tries four normalized forms of each value, but no regex can track a real parser.
- **Meanings differ.** `Match` is anchored; `DenyArgs` and `MatchRegex` search. `Data.filter` is case-insensitive; `MatchRegex` is not. `Git.grep` is POSIX.
- **Common shapes are written again and again**, each time slightly differently: emails, UUIDs, versions, dates, ticket IDs.
- **A policy is sampled, not proved.** Tests try a few inputs. Nobody knows whether some other input gets through.

## Goals

- Let authors say what is allowed in the terms the tool uses: commands, paths, hosts.
- Make every pattern readable aloud, and checked against examples before a run.
- Give a pattern one meaning, wherever it appears.
- Prove the claims that matter most ("this agent can never run `curl`") from the rules, at validate time.
- Keep the linear-time guarantee for every pattern, whoever writes it.
- Keep every existing pipeline working.

## Non-goals

- A general parser language. Patterns are regular languages: no recursion, no backreferences, no counting beyond fixed bounds.
- Proving things about models. A claim is about what the rules let through, not about what a model will try.
- Replacing JSON Schema. Schemas gain a `pattern` link; they don't change shape.

## Design

### 1. Structural matchers

Each matcher parses the argument first, then checks the parts. A value that doesn't parse is refused.

A tool's provider says which of its arguments are commands, paths or URLs. So a matcher names the tool, not the argument, and it covers every argument of that kind. `Workspace.edit` has a path; `Bash.run` has a command; `Http.get` has a URL.

#### `AllowCommands`

```halo
policy Shell : AllowCommands(Sh.run,
    "git status",
    "git diff *",          // one more word, any word
    "git log --oneline **", // any number of words
    "bun test **")
```

Semantics:

- The command is parsed with the shell parser Halo already uses for `Bash` placeholders (`src/runtime/shell.ts`).
- It must be **one simple command**: words only. `;`, `&&`, `||`, `|`, `&`, `$(...)`, backticks, redirections, here-docs, subshells and variable assignments are refused.
- Its words (after quote removal) must start with one allowed list. `*` is one word; `**` is any number of words, only at the end. A word in the list is compared exactly.
- A word from the model that starts with `-` matches `*` only if the entry says `-*`. So `"git diff *"` doesn't allow `git diff --output=/etc/passwd`.
- Several `AllowCommands` on one agent must all allow a command, as `AllowTools` does today.

Edge cases:

- `git  status` (two spaces) and `'git' status` are allowed: they parse to the same words.
- `GIT status` is refused. Commands are case-sensitive.
- `env git status` and `command git status` are refused unless `env` or `command` is in the list.
- A word with a glob character (`*.ts`) is refused unless quoted, since the shell would expand it.

#### `AllowPaths`

```halo
policy Files : AllowPaths(Repo.*, under: ["src/", "test/"], ext: [".ts", ".md"])
```

- The path is normalized as the provider will use it: `.` and `..` resolved, repeated `/` collapsed, and on Workspace, symlinks resolved inside the root.
- `under:` compares whole segments, so `src/` allows `src/a.ts` but not `src-old/a.ts`.
- `ext:` compares the last extension, case-insensitively. `a.ts.exe` has the extension `.exe`.
- A path outside every `under` is refused, including one that leaves the root.

#### `AllowUrls`

```halo
policy Web : AllowUrls(Fetch.*, host: ["api.github.com", "*.example.com"], under: ["/repos/acme/"])
```

- The URL is parsed with WHATWG `URL`. A URL with a user name or password is refused.
- `host:` is compared after IDNA (punycode) conversion and lower-casing. `*.example.com` matches `a.example.com` and `a.b.example.com`, not `example.com`.
- `under:` compares the path after percent-decoding unreserved characters and resolving `.` and `..`, by whole segments.
- Only `https:` is allowed unless `scheme: ["http"]` is given. A port other than the scheme's default must be listed in `host:` (`"localhost:8080"`).

These three cover most `DenyArgs` lines in the examples and blueprints. `DenyArgs` stays for the rest.

### 2. Built-in patterns

A small library, each written once, tested against public corpora, and documented with what it does not accept.

| Name | Matches | Doesn't match |
|---|---|---|
| `Pattern.email` | `ann@example.com`, `a.b+c@sub.example.org` | quoted local parts, IP-literal domains, a missing TLD |
| `Pattern.uuid` | any RFC 9562 UUID, either case | braces, no hyphens |
| `Pattern.uuid_v4` | version 4 only | other versions |
| `Pattern.semver` | `1.2.3`, `1.0.0-rc.1+build.5` (semver.org 2.0) | `v1.2.3`, `1.2` |
| `Pattern.iso_date` | `2026-11-27` | `2026-13-01`, `2026-02-30` |
| `Pattern.iso_datetime` | `2026-11-27T10:00:00Z`, with offsets and fractions | a missing zone |
| `Pattern.url` | absolute `http:` and `https:` URLs | relative URLs, other schemes |
| `Pattern.hostname` | `api.example.com` | a trailing dot, labels over 63 characters |
| `Pattern.ipv4` | `192.168.0.1` | leading zeros, octets over 255 |
| `Pattern.slug` | `my-post-2` | upper case, leading or trailing `-` |
| `Pattern.e164` | `+442071838750` | spaces, a missing `+` |
| `Pattern.hex`, `Pattern.base64`, `Pattern.jwt` | as named | |

`iso_date` checks the calendar, including leap years. That is still a regular language, just a large one, so it runs on the same engine.

A built-in pattern can be used anywhere a pattern can, including in existing rules: `MatchRegex(Pattern.uuid)`, `Match("id", Pattern.uuid)`.

### 3. The `pattern` declaration

```halo
pattern Ticket : "TICKET-" digit{1..6}

pattern Sku [ignore_case] : upper{3} "-" digit{4} ("-" ("S" | "M" | "L"))?

pattern Branch : ("feature" | "fix") "/" Slug
pattern Slug   : lower (lower | digit | "-")* (lower | digit)

pattern Invoice : "INV-" year: digit{4} "-" number: digit{5}
```

The language:

| Form | Means |
|---|---|
| `"text"` | exactly this text. Escapes as in Halo strings. |
| `digit` `letter` `upper` `lower` `alnum` `word` `space` `hex` | one character of that kind (ASCII unless the pattern says `[unicode]`) |
| `any` | any one character except a line break |
| `any_of("abc")`, `none_of("/\\")`, `"a".."f"` | one character from a set, or not from it, or in a range |
| `x y` | `x` then `y` |
| <code>x &#124; y</code> | `x` or `y` |
| `x?` `x*` `x+` | optional, any number, one or more |
| `x{3}` `x{1..6}` `x{2..}` | exactly 3, 1 to 6, 2 or more (bounds up to 1000) |
| `Name` | another pattern, by name. Cycles are an error. |
| `name: x` | a named capture, for `System.Extract` |
| `regex("…")` | an escape hatch: an RE2 regex, as in rules today. It must compile on RE2. |

Semantics:

- **A pattern is anchored.** `Ticket` matches `TICKET-42` and not `see TICKET-42`. To search, write `contains Ticket` (see [One meaning](#6-one-meaning-everywhere)).
- **Options** go in brackets, as on agents: `[ignore_case]`, `[unicode]` (classes include non-ASCII letters and digits), `[multiline]` (`any` also matches a line break).
- **It compiles to RE2**, so it runs in linear time. Halo builds its own automaton from the pattern too, for hover, near misses and proofs.
- A pattern is a value of its own kind. It can't be built at run time, so a model can't write one. A model that needs to search writes a `regex(...)` string, which runs on the same safe engine.

### 4. Examples on a pattern

```halo
pattern Ticket : "TICKET-" digit{1..6}
  matches "TICKET-1", "TICKET-123456"
  rejects "ticket-1", "TICKET-", "TICKET-1234567", "see TICKET-1"
```

- `halo validate` and the LSP check every example. A `matches` that doesn't match, or a `rejects` that does, is an error on that string.
- Hover on a pattern shows it in English, built from the automaton:

  ```
  Ticket: the text "TICKET-", then 1 to 6 digits (0-9). Nothing before or after.
    matches  TICKET-1, TICKET-123456
    near misses (rejected)
      TICKET-          no digits
      TICKET-1234567   7 digits
      ticket-1         lower case (the pattern is case-sensitive)
      TICKET-1a        a letter after the digits
  ```

- **Near misses** are generated, not written. Halo takes the shortest accepted strings, makes one edit at a time (insert, delete, change case, swap a class), and keeps the ones the automaton rejects. They show the edges of a pattern, which is where mistakes are.
- The LSP offers a quick fix: "add these near misses as `rejects`", so the author signs off on each edge.

### 5. Proved claims

```halo
policy Shell : AllowCommands(Sh.run, "git status", "git diff *", "bun test **")
  & Never(Sh.run, contains: ["rm ", "curl", "| sh", Pattern.url])
  & Always(Sh.run, is: regex("[ -~]*"))   // printable ASCII only
```

- `Never(tool, contains: [...])` claims that no value the other rules allow contains any of these.
- `Always(tool, is: P)` claims that every value the other rules allow is in `P`.
- An argument can be named when a tool has several: `Never(Api.post, body, contains: [...])`.

How it is checked:

- Each rule on the argument is a regular language over its characters: `Match` and patterns directly; `AllowCommands`, `AllowPaths`, `AllowUrls` as the languages of the strings they accept; `DenyArgs` as the complement of its search language.
- The allowed language `L` is their intersection. `Never` holds when `L ∩ Σ*·(C₁|C₂|…)·Σ*` is empty. `Always` holds when `L ⊆ P`. Both are decidable for regular languages.
- Validate builds DFAs over **character classes**, not single characters, so the alphabet stays small with Unicode. Case-insensitive rules fold first.
- `DenyArgs` checks normalized forms of a value (JSON-unescaped, path-normalized). The proof runs once per form, with the normalization as a transducer in front.
- **When a claim fails, validate shows a value that gets through**, the shortest one:

  ```
  Policy "Shell": Never(Sh.run, contains: "curl") doesn't hold.
    "bun test curl" is allowed by AllowCommands(Sh.run, …, "bun test **").
  ```

- A claim is also checked at run time, as a deny rule. So it holds even where the proof can't be run (see edge cases), and the proof says it was never needed.

Edge cases:

- A rule that isn't regular (a `DenyArgs` with a backreference) can't take part. Validate says "can't prove: … uses a backreference" and the claim is an error until the rule is rewritten.
- A product too large to build (over a state limit) is an error, "couldn't prove within limits", never a silent pass.
- An argument with no rules at all allows every string, so any `Never` on it fails, with the claimed text itself as the counterexample.
- Values that aren't strings are checked as their JSON text, as `DenyArgs` does today.

### 6. One meaning everywhere

A pattern means the whole value. `contains` means anywhere in it. The same words work in every place:

```halo
pipeline Triage(text: String) -> Result:
  text
    |? (text contains Ticket)
    |> System.Extract(text, Ticket) as ticket        // { match: "TICKET-42", ... }
    |> System.Extract(context.data.invoice, Invoice)  // { match, year, number }
    |? (context.data.ticket.match is Ticket)

@expect("output.id is Pattern.uuid", "!(output.summary contains Pattern.email)")

schema Customer:
  id: String is Pattern.uuid
  email: String is Pattern.email
```

- **Gates and branches**: `x is P` and `x contains P`, alongside `==`, `>`, `&&`. A value that isn't a string is never `is P`.
- **`@expect`** uses gate syntax, so it gets the same two forms.
- **`System.Extract(text, P)`** returns the first match anywhere in the text, with named captures as fields, or `null`. `all: true` returns a list. A capture inside a repeat holds its last match.
- **Schemas**: `String is P` adds a check after the model answers, with the same engine. When `P` fits the JSON Schema `pattern` subset that model providers accept, it is also sent to the provider, so constrained decoding can use it. When it doesn't, it is only checked locally.
- **Policies and tool rules** take a pattern name as well as a string. `Match("id", Ticket)` and `MatchRegex(Ticket)` are anchored, because a pattern always is. `DenyArgs("Sh.run", "command", contains: Ticket)` searches.

A string regex keeps its meaning where it is today, so nothing changes under existing pipelines.

## Compatibility and migration

1. **Nothing breaks.** String regexes in `DenyArgs`, `MatchRegex`, `Match` and `Data.filter` keep working, on the safe engine.
2. **Validate hints.** A `DenyArgs` that is an allow-list in disguise (`^(?!...)` on a command, path or URL argument) gets an info hint naming the matcher to use instead.
3. **`halo migrate`** rewrites the clear cases:
   - `DenyArgs("Sh.run", "command", "^(?!(git status|bun test)$)")` → `AllowCommands(Sh.run, "git status", "bun test")`.
   - `Match("path", "src/[^/]+\\.ts")` on a Workspace tool → `AllowPaths(…, under: ["src/"], ext: [".ts"])`, only when the languages are equal (checked with the same automata as claims).
   - `MatchRegex("^TICKET-\\d{1,6}$")` → a `pattern` declaration and `MatchRegex(Ticket)`, again only when the languages are equal.
   - Anything else is left alone, with a note.
4. **No deprecation** of string regexes is planned. They stay the escape hatch.

## Rollout

0. **One safe engine.** *(Built.)* `safe-regex.ts`, fail closed, compile once, validate checks with the runtime's options, Git.grep as POSIX.
1. **Built-in patterns.** `src/runtime/patterns.ts` with `Pattern.*`, each as an RE2 regex and as an automaton. Usable in `Match`, `MatchRegex`, `DenyArgs`. Tests from published corpora (the semver.org suite, RFC 9562 examples).
2. **Structural matchers.** Argument kinds on provider metadata (command, path, URL), then `AllowCommands`, `AllowPaths`, `AllowUrls` in `policies.ts`, plus validate checks and `halo plan` output. The `migrate` rewrite for the clear `DenyArgs` cases.
3. **`pattern` declarations.** Grammar (`grammars/`), AST, a compiler to RE2 source, validate (cycles, bounds, examples), LSP hover with the English explanation and near misses. The automaton lives in a new `src/patterns/automata.ts`: Thompson NFA, subset construction over character classes, minimization. re2js doesn't expose its automata, so Halo builds its own from the pattern AST.
4. **One meaning.** `is` and `contains` in the condition grammar (gates, branches, loops, `@expect`), `System.Extract`, `String is P` in schemas and its JSON Schema export.
5. **Proved claims.** `Never` and `Always`: each rule's language, products, emptiness and inclusion, shortest counterexamples, state limits. Run in `halo validate` and CI; the runtime check is the deny rule.

Each step is useful on its own. Steps 1 and 2 remove most hand-written regexes from policies before the new syntax lands.

## Open questions

- **Should `Never` fail closed at validate time?** This proposal makes an unproven claim an error. A team adopting claims on a large policy may want a warning first: `Never(…, prove: false)`?
- **Unicode by default?** ASCII classes are predictable and small. Most ticket IDs, SKUs and slugs are ASCII. Names and addresses aren't. `[unicode]` per pattern is the current answer.
- **Patterns from packages.** `use "@acme/patterns" { Sku }` works like any other declaration. Should a registry package's patterns carry their examples into the consumer's validate run?
- **Commands beyond one simple command.** `AllowCommands` refuses pipelines. Allowing `a | b` when both are allowed is safe for most commands but not for `sh`. Worth it?
- **Provider JSON Schema dialects.** Providers accept different `pattern` subsets. Halo may need a per-provider list of what to send.
- **The 250ms limit** for patterns RE2 can't run is a constant. Should a policy be able to raise it, or should validate simply refuse those patterns in deny rules?
