# Halo Retrieval: retrieval as pipelines you can test, compare and evolve

| | |
|---|---|
| Status | Draft proposal. Nothing here is built. |
| Date | 17 November 2026 |
| Builds on | `VectorStore`, `Documents`, embeddings and pgvector, `equips` context, pipelines calling pipelines, policies, `halo plan` / `replay` / `compare` / `evolve`, the scopes proposal |

## Summary

A reviewer wrote that Halo is "not built for heavy RAG engineering": if the hard part is custom chunking, multi-vector re-ranking or knowledge-graph ingestion, LangChain and LlamaIndex have far richer primitives. That's true today. Halo has one `VectorStore` with one vector per entry, no chunker, no lexical index worth the name, no re-ranking and no fusion. `Documents.extract` returns a single blob of text.

The obvious fix is to add the missing features as more arguments on `VectorStore`. This proposal doesn't do that. A retrieval framework inside one tool would be a weaker copy of LlamaIndex, and it would sit outside everything that makes Halo worth using.

Instead, **retrieval becomes ordinary pipelines over a common value, the `Passage`**:

- **Ingestion** is a pipeline: extract, chunk, add representations, then `Index.ingest`. Each step is a call, so custom chunking is any stage that returns passages: a built-in strategy, an agent, `Code`, or your own tool provider.
- **Query** is a pipeline: search, fuse, re-rank, expand, gate. Multi-query is `|* each`, fusion is a call, and abstaining is a `|?` gate.
- **An agent `equips` a retriever pipeline**, not just a store. Every call to the agent runs the pipeline and gets back cited passages. A knowledge graph, LlamaIndex or a hosted search service plugs in as a retriever pipeline that calls MCP or REST.

Because retrieval is made of pipelines and declared stores, Halo's existing machinery works on it unchanged: `halo plan` prices it, `halo replay` replays it, `halo compare` checks a new chunk size against recorded questions, `halo evolve` tunes `size:`, `limit:` and `keep:` inside a fence, and policies screen every passage.

All of that needs to know which passages *should* have been found. **The feedback loop** supplies it: when a person approves, edits or rejects an answer at `|! yield`, the runtime turns the decision into relevance labels for the passages behind it. An edit that adds what retrieval missed is a recall failure caught by a person. Those labels become the test set that `halo test` and `halo evolve` score retrieval on, and the questions nothing answered become a list of gaps in the documents.

That's the part LangChain and LlamaIndex don't have, and it's the answer to the review: Halo gets richer primitives *and* the engineering loop around them, fed by review work people already do.

## Why this, and why Halo

Heavy RAG work is mostly not about writing the retriever. It's about finding out whether the change you just made to it helped. "Is 512 tokens with 64 overlap better than heading-based chunks?" "Does the re-ranker earn its latency?" "Did the new embedding model break questions about refunds?" In LangChain or LlamaIndex, answering those means writing an evaluation harness, a cache and a way to replay real traffic.

Halo already has those pieces for pipelines: recordings of real runs, `@expect`, `compare`, `evolve` with a fence, and a trace. They don't reach retrieval today because retrieval is hidden inside the `VectorStore` provider and the `equips` auto-search. Bringing retrieval out into pipelines is what lets them reach it.

What Halo should *not* try to match:

- **Loaders.** LlamaIndex has hundreds. Halo has `Documents` (text, Markdown, HTML, CSV, JSON, DOCX, PDF), `REST`, `MCP` and the registry. That's enough to get text in; the rest is out of scope.
- **Graph construction.** Building and maintaining a property graph from documents is a large product of its own. Halo consumes one through a retriever pipeline (see [Knowledge graphs and other engines](#knowledge-graphs-and-other-engines)).
- **Exotic index types.** ColBERT late interaction, tree and summary indexes, learned sparse vectors. A registry backend or an external engine can supply them.

## Goals

- Make every retrieval step a call on a common value (`Passage`), so pipelines compose them with the operators Halo already has.
- Let custom chunking be any stage that produces passages, with good built-in strategies for the common cases.
- Support hybrid search (lexical and dense), fusion, re-ranking, multiple representations per passage and small-to-big expansion.
- Let an agent equip a retriever pipeline, with citations it can be held to.
- Keep indexes incremental and versioned by their recipe, so changing a chunk size builds a new version beside the old one instead of failing or overwriting it.
- Make retrieval visible to `plan`, `replay`, `compare`, `evolve`, `@expect`, policies and scopes.
- Count embedding and re-ranking costs, which aren't counted today.
- Turn human review at `yield` into relevance labels, so retrieval can be measured and tuned without anyone writing a test set.

## Non-goals (for now)

- Training models from the labels: fine-tuning embedders or re-rankers. Labels choose between recipes; they don't train weights.

- A loader ecosystem, graph construction, or hosted vector databases in core. Registry packages can add backends through an interface (see [Backends](#backends)).
- A block-form `index` declaration with its own grammar. Flat named arguments on `store … : Index(...)` cover the recipe (see [Open questions](#open-questions)).
- Replacing `VectorStore`. It stays as agent memory: short entries, logs, recall. `Index` is for documents.

## A worked example

A support agent answers from a handbook of Markdown files, cites what it used, and says so when the handbook doesn't cover the question.

```halo
policy Safe : Block(PromptInjection) & Redact(Email)

store Handbook : Index(
  embeddings: "openai/text-embedding-3-small",
  chunk: "headings", size: 800, overlap: 80,
  lexical: true,
  redact: Safe,
)

tool Ranker : Rerank("cohere/rerank-v3.5")

agent Rewriter [anthropic/claude-haiku-4-5, temp: 0.3]
  system "Rewrite the question three ways a help article might phrase it. Answer a JSON list of strings."

agent Support [anthropic/claude-sonnet-4-5]
  system "Answer only from the passages. Cite them as [n]. If they don't answer the question, say so."
  equips Retrieve
  requires Safe

// Ingestion: run it on a schedule, or from CI when the handbook changes.
pipeline Sync() -> Result:
  "./handbook" |> Handbook.sync(glob: "**/*.md")

// Retrieval: an ordinary pipeline, so it can be tested, compared and evolved.
@expect("output.length <= 6")
pipeline Retrieve(query: String) -> Array<Passage>:
  query
    |> Rewriter.variants() as variants
    |* each(q in context.data.variants, concurrency: 3) => Handbook.search(query: q, mode: "hybrid", limit: 20)
    |> System.Fuse(method: "rrf")
    |> Ranker.rerank(query: query, keep: 6) as hits
    |? (context.data.hits.0.scores.rerank >= 0.2)
    |> Handbook.expand(to: "section")

pipeline Ask(question: String) -> Result:
  question |> Support.answer()
```

What happens on `halo run support.halo -p Ask --arg question="How long do refunds take?"`:

1. `Support.answer()` runs `Retrieve` with the call's input as `query`.
2. `Retrieve` searches three phrasings in parallel, fuses the three lists with reciprocal rank fusion, re-ranks the top passages against the original question, keeps six, and expands each to its whole section.
3. If even the best passage scores under 0.2, the gate halts `Retrieve`. The agent then gets no passages and a note saying nothing relevant was found, so it says it doesn't know instead of guessing.
4. Each passage is checked against `Safe`. One that trips `Block(PromptInjection)` is dropped and recorded as a violation; the call goes on with the rest.
5. The agent sees the passages numbered `[1]` to `[6]`. The `[n]` markers in its answer become passage ids in `context.data.answer.citations`.

Changing `size: 800` to `size: 400` and running `halo compare support.halo --from main` builds a second index version and replays recorded questions against both. `halo evolve` can do the same search over `size:`, `limit:` and `keep:` on its own.

## The design

### `Passage`: the common value

Every retrieval step takes or returns a list of passages. `Passage` is a built-in schema, so a pipeline can declare `-> Array<Passage>` and gates can read its fields:

| Field | Meaning |
|---|---|
| `id` | Stable: a hash of the document, span and index version. |
| `text` | The passage text. |
| `source` | Where it came from: a path or URL. |
| `doc` | The document key, which `ingest` and `forget` use. |
| `span` | `{ start, end }` character offsets in the document, plus `page` for PDFs. |
| `heading` | The heading path (`["Billing", "Refunds"]`), when the chunker knows it. |
| `score` | The score from the latest step that ranked it. |
| `scores` | Every step's score by name: `{ dense: 0.71, lexical: 12.3, rrf: 0.032, rerank: 0.88 }`. |
| `tags`, `metadata` | Copied from the document at ingest, plus anything a step adds. |

`scores` keeps each step's opinion, so a gate can read the re-ranker's score even after expansion, and a trace shows why a passage made it.

Anything that returns objects with at least `text` and `source` is turned into passages where a `Passage` is expected: the `id` is derived from them and the other fields default. That's how outside engines plug in.

### Ingestion

#### Chunking

`Documents.chunk` splits text into passages without storing them:

```halo
  |> Docs.extract() as doc
  |> Docs.chunk(text: context.data.doc.text, by: "headings", size: 800, overlap: 80)
```

| `by:` | Splits on | Notes |
|---|---|---|
| `"tokens"` | a token budget, at word boundaries | `size:` and `overlap:` are in tokens (estimated, see [Open questions](#open-questions)) |
| `"sentences"` | sentence ends, packed up to `size:` | |
| `"headings"` | Markdown and HTML headings, then sentences inside sections over `size:` | fills `heading` |
| `"pages"` | PDF pages | fills `span.page` |
| `"lines"` | lines, packed up to `size:` | for logs and code |
| `"records"` | one passage per CSV row or JSON array item | |

Custom chunking is whatever stage you put there instead. An agent that splits a contract into clauses, a `Code` call, or a TypeScript tool provider all work, as long as they return passages. `Index.ingest(passages: ...)` stores them as given.

```halo
pipeline IngestContract(path: String) -> Result:
  path
    |> Docs.extract() as doc
    |> Clauses.split(text: context.data.doc.text) as clauses    // an agent answering [{ text, heading }]
    |> Contracts.ingest(doc: path, passages: context.data.clauses)
```

#### The `Index` store

```halo
store Handbook : Index(embeddings: "openai/text-embedding-3-small", chunk: "headings", size: 800, overlap: 80, lexical: true)
```

The declaration is the **recipe**: the chunker and its settings, the embedding model and `dimensions:`, `lexical:`, `parents:` and the representation kinds. The recipe is used when `ingest` or `sync` gets raw text. When they get passages, the chunker settings are skipped.

| Method | Arguments | Returns |
|---|---|---|
| `ingest` | `doc:`, and `text:`, `path:` or `passages:`; `tags:`, other named args as metadata | `{ doc, status: "added"\|"changed"\|"unchanged", passages }` |
| `sync` | a folder (or the input), `glob:`, `tags:` | `{ added, changed, removed, unchanged, passages, cost }` |
| `search` | `query:`, `mode:` (`"dense"`, `"lexical"`, `"hybrid"`), `limit` (10), `tags:`, `exclude_tags:`, `min_score` | `Array<Passage>` |
| `expand` | input passages, `to:` (`"section"`, `"doc"`), or `neighbors:` (n) | `Array<Passage>`, merged where they overlap |
| `represent` | `passage:` (an id), `kind:`, `text:` | `{ passage, kind }` |
| `forget` | `doc:` or `tags:` | `{ removed }` |
| `docs` / `count` | — | the documents with their content hashes / the passage count |

Ingestion is **incremental and idempotent**. Each document is stored with a hash of its content. `ingest` with an unchanged document does nothing and costs nothing. A changed document's passages are replaced in one transaction. `sync` also forgets documents that are no longer in the folder. Running `Sync` on every push is cheap.

#### Several representations per passage

Embedding the raw chunk text is often the weakest way to find it. A passage can carry other representations, each embedded and searched, all leading back to the same passage:

```halo
pipeline Enrich() -> Result:
  Handbook.docs()
    |* each(p in context.current, concurrency: 8) => Questioner.questions(text: p.text) as qs
    |> Handbook.represent(passage: p.id, kind: "questions", text: context.data.qs)
```

A search scores a passage by its best-matching representation (`scores.dense` records which one matched). Representations are part of the recipe, so they're versioned with it. This covers what LangChain calls the multi-vector retriever: summaries, hypothetical questions or keywords pointing at a passage or its parent.

#### Small-to-big

`parents: "section"` on the recipe keeps each section's span while searching smaller chunks. `expand(to: "section")` swaps hits for their sections, merging hits that share one. `expand(neighbors: 1)` adds the passages either side instead.

### Query

The query side is calls on `Array<Passage>`. Composing them is the pipeline's job.

| Call | What it does |
|---|---|
| `Index.search(mode: "hybrid")` | Lexical (BM25) and dense search, fused with RRF. `"dense"` and `"lexical"` run one alone. |
| `System.Fuse(method: "rrf", k: 60)` | Fuses the lists of a `\|*` fan-out into one, deduplicated by `id`. `method: "max"` keeps each passage's best score instead. |
| `Ranker.rerank(query:, keep:)` | Re-scores the input passages against the query and keeps the best `keep`. Sets `scores.rerank`. |
| `Index.expand(...)` | Small-to-big, as above. |
| `System.Pack(budget: 3000, order: "score")` | Keeps passages until a token budget is spent. `order: "source"` puts them back in document order. |

Re-rankers are a tool provider:

```halo
tool Ranker : Rerank("cohere/rerank-v3.5")                      // also voyage/…, jina/…
tool Ranker : Rerank("bge-reranker", url: "http://localhost:8080")  // any server with a /rerank endpoint
tool Ranker : Rerank(agent: Grader)                              // an LLM judge: the Grader agent scores each passage
```

Patterns that LangChain and LlamaIndex ship as classes are a few lines of pipeline here:

- **Multi-query / RAG-fusion:** a rewriting agent, `|* each` over its phrasings, `System.Fuse`.
- **HyDE:** an agent drafts a hypothetical answer; search with the draft as `query:`.
- **Abstain:** `|?` on `hits.0.scores.rerank`. A halted retriever gives the agent no passages.
- **Routing:** `|? { (cond) => Handbook.search(...), else => Changelog.search(...) }`.
- **Corrective RAG:** a grader agent judges the hits; `|? { ... else => Web.search(...) }` falls back to web search.

### Retrievers are pipelines, and agents equip them

`equips` accepts a pipeline whose return type is `Array<Passage>` and whose first parameter is `query: String`. On every call to the agent, the runtime runs that pipeline with the call's input as the query, then adds the passages to the prompt, numbered:

```
Passages (from Retrieve):
[1] Billing › Refunds — handbook/billing.md
Refunds go back to the original payment method within five business days...
[2] ...
```

- **The simple case stays simple.** Equipping an `Index` store directly runs a default retriever: hybrid search, `limit: 5`, `min_score` from the recipe. Equipping a `VectorStore` works as it does today.
- **Citations.** An agent that equips a retriever is told to cite as `[n]`. After the answer, the runtime maps the markers to passage ids and stores them as `citations` beside the answer (`context.data.answer.citations`), and in `context.meta`. `@expect("output.citations.length > 0")` makes uncited answers fail `halo test`. A marker that doesn't match a passage it was given is recorded as an invalid citation.
- **Agentic RAG.** An agent called with `tools: [Retrieve]` gets the retriever as a tool it can call when it chooses, with its own queries, instead of up front.
- **Sub-pipeline rules apply.** The retriever's model calls count toward the agent's `MaxSpend`, appear in the trace under the agent's stage, and are mocked or recorded like any other call.

### Knowledge graphs and other engines

The retriever contract is how everything Halo doesn't build comes in. A LlamaIndex property-graph index served over MCP becomes a retriever:

```halo
tool Graph : MCP("uvx my-llamaindex-graph-server")

pipeline GraphRetrieve(query: String) -> Array<Passage>:
  query
    |> Graph.retrieve(query: query, depth: 2) as nodes
    |> System.Pick(context.data.nodes, fields: ["text", "source", "metadata"])
```

Whatever comes back with `text` and `source` becomes passages. From there it can be fused with `Handbook.search`, re-ranked, gated and cited like the rest. The same goes for a LangChain retriever behind REST, a hosted search API, or a SQL query. Halo's documentation should say so directly: build the graph with LlamaIndex, orchestrate with Halo.

### Policies and scopes

Retrieved text is untrusted input: a poisoned document is an indirect prompt injection into every question that retrieves it.

- **Per passage, not per prompt.** Today the whole built prompt goes through the agent's input policies, so one bad passage makes every question that retrieves it fail. A retriever's passages are now checked one at a time against the agent's policies. A passage that trips a `Block` is dropped and recorded in `context.meta.violations` with its `id` and `source`. `Redact` rewrites the passage text.
- **At ingest.** `redact:` on the recipe names a policy whose `Redact` rules run before embedding, so personal data never reaches the embedding provider or the index. `Block` rules at ingest tag the passage `flagged` rather than refusing the document, so `halo` can report it.
- **Scopes.** The scopes proposal gains a `tags` field. A stage run `within` a scope with `tags: ["tenant:acme"]` searches only passages carrying that tag. The filter is applied in the backend query, not in the prompt, so a model can't talk its way past it. In `halo serve`, each tenant's indexes live in its own namespace.

### Plan, replay, compare, evolve, test

This is where the design pays off.

- **Recipe versions.** An index is stored under a version: a hash of its recipe. Changing `size:` or `embeddings:` makes a new version, built beside the old one (lazily on the first `ingest`/`sync`, or with `halo index build`). Searches use the version that matches the declaration. A branch with a different chunk size never touches main's index. This replaces `VECTOR_MODEL_MISMATCH` for `Index`. `halo index ls` and `halo index prune` manage versions.
- **`halo plan`** lists every retrieval call with its embedding, re-ranking and model cost, and for `sync`, an ingestion estimate from the documents' size and whether a new version must be built.
- **`halo replay`** records each retrieval's passages (ids and text). By default replay answers retrieval with what the run got, so it's deterministic even after the index changes. With `--live-tools`, retrieval runs against the current index: that's how a new recipe is tried on real questions.
- **`halo compare --from main`** notices that the recipes differ, builds the missing version (its cost is in the plan, and it asks first unless `--yes`), and replays recorded questions with live retrieval on both sides. The report shows answers side by side, plus how many cited passages changed.
- **`halo evolve`** can treat recipe and query arguments as knobs: `size`, `overlap`, `by`, `mode`, `limit`, `keep`, the re-ranker. The fence gets an `ingestBudget`, since every recipe it tries is an index build.
- **Retrieval tests.** `halo test -p Retrieve --golden questions.jsonl`, where each line is `{ "query": ..., "relevant": ["billing.md", ...] }` (documents or passage ids), reports recall@k, MRR and nDCG, and fails under `--min-recall`. That tests retrieval without paying for a single answer.

### Backends

| Backend | Dense | Lexical | Notes |
|---|---|---|---|
| Local SQLite (default) | brute-force cosine, as `VectorStore` today | FTS5 with BM25 | one file, `.halo/index.sqlite` |
| Postgres (`url:`) | pgvector HNSW | `tsvector` with a GIN index, `ts_rank_cd` | many indexes per table, as `VectorStore` today |

`registerIndexBackend(name, backend)` lets a registry package add Qdrant, pgvecto.rs, Turbopuffer and others. The backend interface takes passages, representations and filters, and returns scored passages; fusion, re-ranking and expansion stay in core so they behave the same everywhere.

## The feedback loop: reviews become labels

Every way of evaluating retrieval above needs to know which passages *should* have been found. Producing that is the expensive part of RAG engineering: someone writes questions and marks the right documents, and the set goes stale as the documents change. Most teams never do it, so they tune retrieval by feel.

Many Halo pipelines already have a person in the loop. The support-inbox blueprint has someone approve, reject or edit every draft at `|! yield` before it's sent. Each of those decisions says something about the retrieval behind the draft. This section turns them into relevance labels, as a side effect of review work people already do.

### What a decision says

When a reviewer answers a `yield` that shows an answer built from retrieved passages:

| Decision | Label | Why |
|---|---|---|
| **Approved as is** | the cited passages: `relevant` (weak) | The reviewer accepted an answer resting on them. Weak, because approvals can be rubber stamps. |
| **Approved with edits** | text the reviewer **added**: searched against the index. A passage that matches it but wasn't retrieved: `missed`. Nothing matches: `gap`. | The strongest signal. The reviewer knew something retrieval didn't find, or the documents don't contain. |
| | cited passages whose content the edit **removed**: `doubtful` | The answer used them, and the reviewer took that part out. |
| **Rejected** | the cited passages: `doubtful` (weak) | Something was wrong, but not necessarily retrieval. |
| **Retriever abstained** and the reviewer wrote the reply | as for added text: `missed` or `gap` | Retrieval said there was nothing, and a person found an answer. |

Passages that were retrieved but not cited get **no label**. Models skip relevant passages all the time, so "not cited" isn't evidence of "not relevant".

`missed` is the label that matters most. It's a recall failure that a person caught, and it's exactly what a new chunk size or a re-ranker has to fix.

### Linking a decision to its retrieval

The runtime already records each agent call. It now also records the passages each call was given and the ones it cited. A `yield` names the answer it's asking about with `about:`:

```halo
    |! yield(msg: "Approve to send, reject, or send {\"approved\": true, \"reply\": \"...\"}", [context.data.draft], about: draft, edited: "reply")
```

- `about: draft` is the binding whose retrieval is being judged. The runtime follows it back to the agent call that produced it and that call's passages.
- `edited: "reply"` names the field in the reviewer's answer that holds their edited text, which is diffed against `draft.reply`.

The link is explicit rather than inferred. A `yield` can show several values, and a wrong guess would quietly mislabel data. `halo validate` warns when a `yield` shows an answer built from retrieved passages and has no `about:`.

### Labels outlive the chunking

A label can't point at a passage id, because ids include the index version and the whole point is to compare versions. Labels are anchored to the **document and a character span** (plus a hash of the span's text). To score a new version, a label counts as found when a retrieved passage overlaps its span. When a document changes so that the span's text no longer matches, its labels are marked stale and leave the test set until they're seen again.

Labels are stored in `.halo/labels.sqlite`, one row per label: the run, the query, the document and span, the label, its weight, what produced it (`approve`, `edit`, `reject`, `abstain`, `manual`), and when.

### Using them

```bash
halo labels                                   # counts by pipeline, label and source; stale labels
halo labels review                            # step through candidate labels: keep, drop or correct
halo labels gaps                              # questions that found nothing, grouped by topic
halo test support.halo -p Retrieve --golden labels --min-recall 0.8
halo evolve support.halo -p Retrieve --criteria retrieval.md --golden labels
```

- **`--golden labels`** builds the test set from the label store instead of a file: one case per query, relevant spans from `relevant` and `missed` labels with enough weight, and `doubtful` ones excluded. `halo labels export` writes it as JSONL, so it can be reviewed and committed.
- **`halo evolve`** can use recall on the labelled set as an objective next to the judge's score. Its usual split into a proposal set and a held-out set applies, so a recipe can't win by fitting the questions it was tuned on.
- **`halo labels gaps`** is the report of questions the documents don't answer, from `gap` labels and abstentions. It's a to-do list for whoever writes the documents, and it needs no retrieval changes at all.

### Noise, and how the design limits it

Reviewer decisions are cheap, plentiful and noisy. The design doesn't pretend otherwise:

- **Weights, not verdicts.** An approval counts for less than an edit. A query enters the test set only once its labels pass a weight threshold, or after a person keeps it in `halo labels review`.
- **People can correct it.** `halo labels review` lets someone fix or drop labels, and those `manual` labels outrank the automatic ones.
- **Held-out sets.** Evolve and compare report on questions the recipe wasn't tuned on.
- **Labels are outside the fence.** Nothing `evolve` proposes can write, weight or delete labels.

### Privacy

Labels hold real questions, and in the support inbox, customers' own words.

- Queries pass through the pipeline's `Redact` policies before they're stored, as recorded passages should (see [Open questions](#open-questions)).
- `labels.keep` in `halo.json` sets how long they're kept (default 180 days).
- In `halo serve`, labels belong to the tenant whose run produced them. They're never pooled across tenants, and a tenant's test set only scores that tenant's index.
- `evolve`'s proposer sees recall numbers and the labelled spans' document names, not the stored questions, as the evolve proposal already requires for recordings.

### On the support-inbox blueprint

The blueprint is the first place to build this, because most of the loop already exists:

1. `Knowledge` becomes an `Index` with heading-based chunking. Today `IndexKnowledge` stores each article whole, so a long article is one vector.
2. `Writer` equips a `Retrieve` pipeline instead of receiving `context.data.articles`, and its self-reported `sources` field gives way to citations.
3. The `yield` gets `about: draft, edited: "reply"`.
4. A scheduled pipeline runs `halo labels gaps` weekly and posts it for the docs owner.

After a few weeks of normal use, the team has a test set they never wrote, a recall number for their retrieval, and a list of questions their articles don't answer. `halo evolve` can then try chunk sizes and a re-ranker against that set, and the winner arrives as a pull request with a `compare` report.

## Changes to what exists

| Today | After |
|---|---|
| `VectorStore` is the only store for retrieval. | `VectorStore` stays as memory. `Index` is for documents. They share embedding and backend code. |
| `VectorStore.upsert` is an alias of `insert`: it adds a duplicate. | `upsert` takes a `key:` and replaces the entry with that key. (A fix worth landing on its own.) |
| `Documents.extract` returns one blob, cut at 200,000 characters. | `Documents.chunk` splits it; `Index.sync` streams large documents through the chunker instead of truncating. |
| Equipping a store adds up to 3 hits to the prompt, uncited. | Equipping a retriever pipeline or an `Index` adds numbered passages; answers carry `citations`. |
| The whole built prompt goes through input policies. | Passages are checked one by one; a bad one is dropped, not fatal. |
| Embedding costs aren't counted. | Embedding and re-ranking costs count in `context.meta`, `MaxSpend` and `halo plan`. |
| `equips` names tools only. | `equips` also names retriever pipelines; `validate` checks their signature. |
| Changing a namespace's embedding model fails. | For `Index`, it builds a new recipe version. |
| A `yield` records the answer it got. | A `yield` with `about:` also records labels for the passages behind that answer. |
| Agent calls record their prompt and answer. | They also record the passages they were given and cited. |

The grammar doesn't change: `Index(...)` is a `storeDecl`, `equips` already takes identifiers, `about:` and `edited:` are named arguments, and every new call is a `callExpr`.

## Rollout

1. **`Passage`, `Documents.chunk`, `System.Fuse`, `System.Pack`.** Pure and offline. Useful with `VectorStore` straight away. Fix `upsert`.
2. **`Index` on SQLite.** `ingest`, `sync`, `forget`, `search` (dense, FTS5 lexical, hybrid), recipe versions, `halo index`. Count embedding costs.
3. **Retrievers in `equips`.** Numbered passages, citations, per-passage policies, abstention on a halted retriever.
4. **`Rerank`, `represent`, `expand`.** Cohere, Voyage, Jina, any `/rerank` server, and `agent:`.
5. **The loop.** Retrieval in `plan`, recorded passages in `replay`, recipe builds in `compare`, recipe knobs and `ingestBudget` in `evolve`, `--golden` in `halo test`, `tags` in scopes.
6. **The feedback loop.** Passages recorded per agent call, `about:` and `edited:` on `yield`, the label store, `halo labels` (`review`, `gaps`, `export`), `--golden labels`. Migrate the support-inbox blueprint to use it.
7. **Postgres parity, `registerIndexBackend`,** and a worked example of a LlamaIndex graph retriever over MCP, plus a docs page, "Halo and RAG frameworks", saying plainly what to use each for.

Steps 1 to 3 already answer most of the review. Steps 5 and 6 are what make the answer Halo's own. `halo labels gaps` is useful on its own as soon as step 3 lands, so it could ship early.

## Risks

- **Becoming the framework we said we wouldn't build.** The guard is the contract: core owns `Passage`, the calls in the tables above, and the loop around them. New retrieval ideas arrive as pipelines, agents or registry backends, not as new `Index` arguments.
- **Index builds are the expensive part.** `compare` and `evolve` can each trigger a full re-embed. Plans must show it, `compare` asks first, and `evolve` stops at `ingestBudget`.
- **Version sprawl.** Every recipe tried leaves an index behind. `halo index prune` removes versions no declaration uses, and `evolve` prunes the ones it made.
- **Citations depend on the model.** Mapping `[n]` back is reliable; whether the model cites honestly isn't. `@expect` and a judge can check it, but Halo shouldn't claim grounding it doesn't verify.
- **Label noise.** Reviewers rubber-stamp, and models cite the top passages more often than the right ones, so `relevant` labels lean toward whatever retrieval already ranks first. Weights, `halo labels review`, the emphasis on `missed` labels and held-out sets limit this but don't remove it. The docs should say a labelled set is a starting point, not ground truth.
- **Few reviewers, few labels.** A pipeline with no `yield`, or with little traffic, gets no labels. The loop helps teams that already review; others still write a golden file by hand.
- **Coercing outside results.** Turning any `{ text, source }` into passages is convenient and can hide a mapping bug. `validate --strict` warns when a retriever's output isn't checked against `Passage`.

## Open questions

- **Tokens.** `size:` in tokens needs a tokenizer per model, or an estimate. Start with characters ÷ 4, labelled as an estimate, and allow `unit: "chars"`?
- **A block-form `index` declaration.** A recipe with representations and parents is a lot for one line. Is it worth new grammar, or are multi-line named arguments enough?
- **Default retriever settings.** Should equipping an `Index` default to hybrid search? It's better on most corpora but needs the lexical index built.
- **Should citations be a policy?** `RequireCitations` would refuse uncited answers at run time (with `@correct` asking again), not just in tests.
- **Matching edits to passages.** Finding the passage that an added sentence came from is itself a search, and it can be wrong. What score counts as a match, and should a `missed` label wait for a second decision that agrees?
- **Other sources of labels.** Thumbs up and down in a chat UI, or a customer replying "that didn't help", are decisions too. Should `Thread` or a webhook be able to record labels against an earlier run?
- **Where recorded passages live.** Recordings are unredacted today. Recorded passages could contain whatever the index holds; they probably need the same `redact:` as ingestion.
