# Types & Schemas

Halo is fundamentally strongly-typed. While LLMs output unstructured strings, Halo forces them into deterministic boxes using Schemas.

## Primitives

Halo supports the following primitive types out of the box:
- `String`: Text data.
- `Number`: Integers or floats.
- `Boolean`: `true` or `false`.
- `List<T>`: An array of a specific type (e.g., `List<String>`).
- `JSON`: An escape-hatch primitive for unstructured nested objects.

## Domain Primitives

Halo includes special types designed specifically for AI workflows:

### `Asset`
The `Asset` type represents a multimodal blob (like an Image, Video, or Audio file).
When you pass an `Asset` through the pipeline, the runtime stores the binary data in memory and passes a lightweight reference to the LLM.

```halo
pipeline Vision(image: Asset) -> Result:
  image |> VQA_Agent.prompt("What is in this image?")
```

### `Embedding`
The `Embedding` type is a native vector array representation `[0.12, -0.45, ...]`.

## Custom Schemas

You can define custom structured types using the `schema` keyword.

```halo
schema UserProfile {
  id: String
  age: Number
  tags: List<String>
  isPremium: Boolean
}
```

## Schema Enforcement

When a pipeline defines a schema as its return type, the Halo runtime uses **Structural Forcing**.

```halo
pipeline ExtractProfile(text: String) -> UserProfile:
  text |> ExtractionAgent.extract()
```

If the LLM generates JSON that misses the `isPremium` field, the pipeline will **throw a Type Error** and halt, rather than passing malformed data to your backend. (To handle this automatically, use the `@retry` compiler directive).
