// ============================================================
// STEP 18: VectorStore Operations
// ============================================================
// LEARN: How to use VectorStore for semantic memory
// WHY:  Store and search embeddings for RAG patterns
// ============================================================

// Define a vector database tool
tool KnowledgeBase : VectorStore(Env.PINECONE_KEY, namespace: "docs")

mind Analyzer [openai/gpt-4o, temp: 0.5]
  equips KnowledgeBase

// --- Store documents ---
stream IndexDocument(text: String, tags: String) -> Result:
  text
    // Store in vector DB with metadata
    |> KnowledgeBase.log(
        content: context.input.text,
        tags: [context.input.tags],
        source: "user-upload"
      )
    |> System.Print()

// --- Search similar documents ---
stream SearchDocs(query: String) -> Result:
  query
    // Semantic search
    |> KnowledgeBase.search(
        query: context.input.query,
        limit: 5,
        min_score: 0.8
      )
    // Analyze search results
    |> Analyzer.prompt("Answer this based on the search results")
    |> System.Print()

// VectorStore syntax:
//   tool Name : VectorStore(Env.KEY, namespace: "name")
//
// Operations: log (insert), search (query), delete, update
