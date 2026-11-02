# Embeddings

By default a `VectorStore` embeds text as hashed bag-of-words vectors, so search matches words, not meaning. Give it `embeddings:` to use a model instead. Then "where is my money" finds "refunds take five days".

```halo
store Notes : VectorStore(namespace: "support", embeddings: "openai/text-embedding-3-small")
```

The methods (`log`, `search`, `delete`, `count`) and search options (`limit`, `min_score`, `tags`, `exclude_tags`, `order`) work the same as with hashed vectors. Scores are cosine similarities, so they run higher than hashed scores. Tune `min_score` for your model.

## Options

| Arg | Meaning |
|---|---|
| `embeddings:` | `"provider/model"`. Leave it out, or use `"hashed"`, for the built-in vectors (no network, no key). |
| `apiKey:` | The provider key. Defaults to the provider's env var (below). |
| `embeddingsUrl:` | Base URL of the API: any OpenAI-compatible server, or another Ollama host. |
| `dimensions:` | Ask for shorter vectors, if the model supports it (OpenAI `text-embedding-3-*`, Gemini). |
| `url:` | A Postgres URL. Stores entries in Postgres with pgvector instead of local SQLite (see below). |
| `table:` | The Postgres table (default `halo_vectors`). Letters, digits and `_`, optionally `schema.table`. |

## Providers

| `embeddings:` | Request | Key |
|---|---|---|
| `openai/text-embedding-3-small` (or `-large`) | `POST https://api.openai.com/v1/embeddings` | `OPENAI_API_KEY` |
| `google/gemini-embedding-001`, `google/text-embedding-004` | `POST …/models/{model}:batchEmbedContents` | `GEMINI_API_KEY` or `GOOGLE_API_KEY` |
| `ollama/nomic-embed-text` (any Ollama model) | `POST {OLLAMA_HOST}/api/embed` (default `http://localhost:11434`) | none |
| `anything/model` + `embeddingsUrl:` | `POST {embeddingsUrl}/embeddings`, OpenAI format | `apiKey:`, if the server needs one |

```halo
store Docs : VectorStore(embeddings: "together/BAAI/bge-base-en-v1.5", embeddingsUrl: "https://api.together.xyz/v1", apiKey: Env.TOGETHER_KEY)
```

Requests are batched (up to 256 texts for OpenAI, 100 for Google, 64 for Ollama). Vectors are normalized. Embeddings of identical text are cached in the process (the most recent 20,000), so repeating a query costs nothing. Google gets entries as `RETRIEVAL_DOCUMENT` and searches as `RETRIEVAL_QUERY`.

## One model per namespace

Every entry records its model and vector size. A namespace holds one model's vectors only. Logging to it or searching it with another model (or with hashed vectors, or another `dimensions:`) fails with a `VECTOR_MODEL_MISMATCH` error. Vectors from different models can't be compared. To switch models, use a new `namespace:`, or delete the namespace's entries first.

## Local storage

Model vectors go in the same SQLite file as hashed ones (`.halo/vectors.sqlite`). Search loads a namespace's vectors into memory once and compares the query to all of them. On a laptop, a search takes about 15 ms at 20,000 entries of 256 dims, and about 250 ms at 100,000 entries of 1,536 dims. Memory use is entries × dims × 4 bytes, so the larger case needs about 600 MB. Past that size, use Postgres. Rows added or deleted by another process are picked up on the next search.

## Postgres with pgvector

```halo
store Memory : VectorStore(url: Env.DATABASE_URL, embeddings: "openai/text-embedding-3-small", namespace: "support")
```

On first use Halo runs `CREATE EXTENSION IF NOT EXISTS vector`, so the role needs that permission, or the extension must already be installed. It then creates the table, and an HNSW cosine index for each vector size it sees. Sizes up to 2,000 dims are indexed as `vector`, sizes up to 4,000 as `halfvec` (pgvector 0.7 or later). Larger vectors are searched without an index. Many stores and namespaces can share one table. Hashed vectors work here too: leave out `embeddings:`. HNSW search is approximate. With narrow `tags:` filters, it can return fewer than `limit` hits.

## Cost

Each `log` embeds one text, and each `search` embeds its query unless it's cached. That includes the automatic search when an agent `equips` the store, which runs on every call to that agent. Embedding models are cheap: `text-embedding-3-small` costs about $0.02 per million tokens. But a busy agent still makes a network round trip per call. Ollama runs locally, with no cost and no key. Embedding costs are not counted in Halo's cost tracking.
