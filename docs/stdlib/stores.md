# Built-in Stores

A `store` is a persistent memory primitive. While `tools` are generally stateless (like a calculator or a REST API), `stores` hold long-term state that agents can query and append to over time.

## `VectorStore`

The default implementation for Retrieval-Augmented Generation (RAG). It automatically chunks text, generates embeddings (using `text-embedding-3-small`), and performs cosine similarity search.

**Parameters:**
- `provider`: `"pinecone"`, `"chroma"`, or `"weaviate"`.
- `namespace`: String. Used to isolate data.

```halo
store KnowledgeBase : VectorStore("pinecone", namespace: "internal-docs")

agent Researcher [openai/gpt-4o]
  equips KnowledgeBase
```

When an agent is equipped with a `VectorStore`, the Halo runtime automatically exposes two functions to the LLM:
1. `search(query: string)`
2. `append(document: string)`

## `SQLite` (Local Storage)

For simple key-value persistence without setting up a vector database, Halo provides a local SQLite store.

```halo
store LocalCache : SQLite("cache.db")
```

This is particularly useful when testing multi-agent swarms locally, as agents can pass messages to each other through the SQLite store without consuming token bandwidth.
