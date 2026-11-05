# Types & Schemas

Models answer in text. If an answer is entirely JSON, optionally inside a `` ```json `` fence, Halo parses it into an object, so gates and later stages can read fields like `context.data.review.score`. A `schema` declares the shape a pipeline must return.

## Schemas

```halo
schema Address { city: String, zip: String }

schema UserProfile {
  id: String,
  age: Integer,
  tags: Array<String>,
  isPremium: Boolean,
  address: Address,
}

agent Extractor [openai/gpt-4o-mini, temp: 0]
  system "Extract a user profile. Reply with JSON only."

pipeline ExtractProfile(text: String) -> UserProfile:
  text |> Extractor.extract()
```

Field types:

| Type | Accepts |
|---|---|
| `String` | a string |
| `Number` | a finite number |
| `Integer` | a whole number |
| `Boolean` | `true` / `false` |
| `Array`, `List`, `Array<T>` | a list (every item checked against `T`) |
| `Object`, `JSON` | an object |
| `Any`, `Result` | anything |
| another schema's name | an object matching that schema |

Every field is required. Extra fields are allowed.

A type name that's a near miss of a built-in type or a declared schema (`Numbr`, `Profil`) is a validation error. Any other undeclared name (`Report`, `GitHub.Issue`) is a warning: it documents the value but isn't checked.

## Enforcement

When a pipeline is declared `-> SchemaName`, the runtime checks the output once the pipeline completes. A string output is parsed as JSON first.

A built-in return type is checked the same way. A model answers in text, so plain text is read as the declared type first: `-> Number` accepts `"42"`, `-> Boolean` accepts `"true"`, and `-> Array<String>` accepts a JSON list. `-> String` rejects an object or a list. If the output doesn't match, the run throws a `SchemaValidationError` (code `SCHEMA_VALIDATION`) with the problem, for example `missing field "isPremium"`. If it matches, the output is returned parsed.

`@retry` does not retry schema failures. To have the model fix bad JSON, add a `Require(JSON)` policy to the agent together with `@correct(n)`. That checks the answer at the agent call and asks the model again (see [Directives](./compiler-directives.md#correct)).

Halted and paused runs aren't checked. Neither are `-> Result`, `-> Any`, or a return type that isn't declared.

## Parameters

Parameter types (`text: String`, `items: List`, `user: UserProfile`) are checked by the validator, not at runtime:

- Reading a field a schema doesn't have from a schema-typed parameter (`user.height`, `{{user.height}}`, `context.input.user.height`) is an error.
- Passing a value to another pipeline that can't be its parameter's type is an error, when the validator can tell the value's type: a literal (`Double(n: "three")`), or one of the caller's own parameters or their fields (`Double(n: user.name)`). A whole number can go to a `Number`, and a `Number` to an `Integer`, but a written `1.5` can't go to an `Integer`. `Object`, `JSON` and `Map` match any schema.

Values that come from models and tools aren't known until the pipeline runs, so they aren't checked here. The CLI requires that every parameter is given.

There are no `Asset` or `Embedding` types. Multimodal inputs are not supported.
