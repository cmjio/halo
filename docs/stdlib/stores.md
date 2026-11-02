# Stores

`store` is another way to write `tool` that reads better for things that hold data. Two built-in providers keep state across runs, and both are local files. When an agent `equips` one, the agent also gets context from it automatically.

## `VectorStore`

A searchable memory kept in a local SQLite file (`.halo/vectors.sqlite`, or `vectorPath` in `RuntimeConfig`). Entries are embedded as hashed bag-of-words vectors (words and word pairs). Search is lexical and deterministic, and it needs no network or API key. There is no hosted vector database support (Pinecone, Chroma, …), and there are no model embeddings. Each namespace is kept in memory as an inverted index, so a search at 100,000 entries takes tens of milliseconds (the first search in a process builds the index, about a second at that size), and entries added or deleted by another process are picked up on the next search.

```halo
store Notes : VectorStore(namespace: "support")

agent Helper [openai/gpt-4o-mini]
  equips Notes

pipeline Remember(fact: String) -> Result:
  fact |> Notes.log(content: fact, tags: ["faq"], source: "docs")

pipeline Lookup(question: String) -> Result:
  question |> Notes.search(query: question, limit: 3)

pipeline Ask(question: String) -> Result:
  question |> Helper.answer()
```

| Method | Arguments | Returns |
|---|---|---|
| `log` / `insert` / `add` / `upsert` / `save` / `store` | `content:` (or the input), `tags:`, any other named args as metadata | the saved entry: `{ stored, namespace, id, content, tags, metadata, createdAt }` |
| `search` / `query` / `find` / `recall` / `similar` | `query:` (or the input), `limit` (5), `min_score` (0), `tags:` (must have all), `exclude_tags:` (must have none), `order:` (`"score"`, or `"recent"` for newest first) | a list of `{ id, content, tags, metadata, createdAt, score }` |
| `delete` / `forget` | `id:` or `tags:` | `{ deleted }` |
| `count` | — | a number |

`namespace:` keeps stores in the same file apart. It defaults to the store's name.

**When equipped:** every call to the agent first searches the store with the call's input and adds up to 3 matches (score ≥ 0.1) to the prompt as "Relevant context". In `Ask` above, `Helper.answer()` gets that context without an explicit search. An agent call with `tool: Notes` searches the store with its arguments instead.

## `File`

A JSON file of text entries. It works well for chat history.

```halo
store History : File(".halo/chat.json", keep: 10)

agent Helper [openai/gpt-4o-mini]
  equips History

pipeline Chat(msg: String) -> Result:
  msg |> Helper.reply()
```

Methods: `read` (the last `keep` entries, joined), `append` (`content:` or the input), and `clear`. The file keeps the last `keep × 5` entries.

The path can hold placeholders, for one file per user: `File(".halo/history-{{user}}.json")`. The filled-in path must stay in the folder before the first placeholder (`.halo/` here), so a value like `../../x` is refused, and each value must stay one name (no `/` or `\`), so `x/../history-alice` can't reach another user's file in that folder. Appends to one file happen one at a time, so parallel calls (`each`) don't lose entries.

**When equipped:** each call to the agent adds the history to the prompt as "Conversation so far". After the answer, `User: <input>` and `Assistant: <answer>` are appended to the file, so the next run remembers the conversation.

## Databases

`PostgreSQL(Env.DATABASE_URL)` is a tool, not an automatic memory. Query it explicitly (see [Built-in Tools](./tools.md#postgresql-sql)). There is no SQLite key-value store provider.
