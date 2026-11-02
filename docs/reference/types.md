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
| `Any` | anything |
| another schema's name | an object matching that schema |

Every field is required. Extra fields are allowed. The validator warns about unknown type names.

## Enforcement

When a pipeline is declared `-> SchemaName`, the runtime checks the output once the pipeline completes. A string output is parsed as JSON first. If the output doesn't match, the run throws a `SchemaValidationError` (code `SCHEMA_VALIDATION`) with the problem, for example `missing field "isPremium"`. If it matches, the output is returned parsed.

`@retry` does not retry schema failures. To have the model fix bad JSON, add a `Require(JSON)` policy to the agent together with `@correct(n)`. That checks the answer at the agent call and asks the model again (see [Directives](./compiler-directives.md#correct)).

Halted and paused runs aren't checked. A return type that isn't a declared schema, like `Result`, isn't checked either.

## Parameters

Parameter types (`text: String`, `items: List`, `user: UserProfile`) document the pipeline. They are **not** checked at runtime. The CLI requires that every parameter is given.

There are no `Asset` or `Embedding` types. Multimodal inputs are not supported.
