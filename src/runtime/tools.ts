import type { ExecutionContext } from "./runtime.js";
import { ToolExecutionError } from "../errors.js";

/** Interface for pluggable tool connectors. */
export interface ToolPlugin {
  /** The provider name used in DSL (e.g., "GitHub") */
  provider: string;
  /** Execute the tool logic */
  execute(
    args: string[],
    config: Record<string, unknown>,
    ctx: ExecutionContext
  ): Promise<unknown>;
}

export class ToolRegistry {
  private plugins = new Map<string, ToolPlugin>();

  register(plugin: ToolPlugin): this {
    this.plugins.set(plugin.provider, plugin);
    return this;
  }

  get(provider: string): ToolPlugin | undefined {
    return this.plugins.get(provider);
  }
}

// ── Built-in Tools ─────

export class RestTool implements ToolPlugin {
  provider = "REST";
  async execute(args: string[], config: Record<string, unknown>, _ctx: ExecutionContext): Promise<unknown> {
    let url = args[0] ?? "";
    if (config.path) url += config.path;
    if (config.query) url += `?${config.query}`;
    
    url = url.startsWith("http") ? url : `https://${url}`;

    const apiKey = config.apiKey as string;
    const res = await fetch(url, {
      method: "GET",
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    });
    if (!res.ok) throw new ToolExecutionError("REST", `REST error: ${await res.text()}`);
    return await res.json();
  }
}

export class PostTool implements ToolPlugin {
  provider = "POST";
  async execute(args: string[], config: Record<string, unknown>, _ctx: ExecutionContext): Promise<unknown> {
    let url = args[0] ?? "";
    if (config.path) url += config.path;
    if (config.query) url += `?${config.query}`;
    
    url = url.startsWith("http") ? url : `https://${url}`;

    const apiKey = config.apiKey as string;
    // Use explicit body if provided, otherwise build from named args
    const internalKeys = new Set(["apiKey", "path", "query", "method", "url", "body", "__args"]);
    let body = config.body;
    if (body === undefined) {
      const namedArgs: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(config)) {
        if (!internalKeys.has(k)) namedArgs[k] = v;
      }
      if (Object.keys(namedArgs).length > 0) body = namedArgs;
    }
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new ToolExecutionError("POST", `POST error: ${await res.text()}`);
    return await res.json();
  }
}

export class PostgreSQLTool implements ToolPlugin {
  provider = "PostgreSQL";
  async execute(args: string[], config: Record<string, unknown>, _ctx: ExecutionContext): Promise<unknown> {
    const query = config.query as string;
    if (!query) throw new ToolExecutionError("PostgreSQL", "PostgreSQL requires a 'query' argument");
    
    const dbUrl = args[0] ?? "";
    if (dbUrl.includes("sqlite") || dbUrl.includes("localhost")) {
      const sqlitePath = dbUrl.includes("sqlite") ? dbUrl : "test-langly.sqlite";
      const { Database } = await import("bun:sqlite");
      const db = new Database(sqlitePath);
      const rows = db.query(query).all();
      db.close();
      return rows;
    }
    return { result: "PostgreSQL actual driver not loaded", query };
  }
}

export class VectorStoreTool implements ToolPlugin {
  provider = "VectorStore";
  private stores = new Map<string, string[]>();

  seed(name: string, data: string[]) {
    if (!this.stores.has(name)) this.stores.set(name, []);
    this.stores.get(name)!.push(...data);
  }

  /** Convenience method for internal RAG queries. Returns top-K results as string[]. */
  search(namespace: string, query: string, topK: number = 3): string[] {
    const store = this.stores.get(namespace) ?? [];
    if (store.length === 0) return [];
    return this.cosineSimilaritySearch(store, query, topK);
  }

  async execute(args: string[], config: Record<string, unknown>, _ctx: ExecutionContext): Promise<unknown> {
    const method = config.method as string;
    const query = config.query as string;
    const indexName = args[0] ?? "default";
    const topK = (config.topK as number) ?? 1;
    
    if (method === "search" && query) {
      const results = this.search(indexName, query, topK);
      // Return single result for backward compat when topK = 1
      return topK === 1 ? (results[0] ?? null) : results;
    }
    return { result: `VectorStore ${method} called`, query };
  }

  /** TF-IDF cosine similarity search. */
  private cosineSimilaritySearch(docs: string[], query: string, topK: number): string[] {
    const tokenize = (text: string): string[] => 
      text.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(w => w.length > 1);

    // Build vocabulary from all docs + query
    const allTokens = new Set<string>();
    const docTokens = docs.map(d => tokenize(d));
    const queryTokens = tokenize(query);
    for (const tokens of [...docTokens, queryTokens]) {
      for (const t of tokens) allTokens.add(t);
    }

    // Compute IDF (inverse document frequency)
    const idf = new Map<string, number>();
    const N = docs.length + 1; // +1 for query as pseudo-doc
    for (const term of allTokens) {
      const docsWithTerm = docTokens.filter(tokens => tokens.includes(term)).length + 
        (queryTokens.includes(term) ? 1 : 0);
      idf.set(term, Math.log(N / (docsWithTerm + 1)) + 1);
    }

    // TF-IDF vector for a token list
    const toVector = (tokens: string[]): Map<string, number> => {
      const tf = new Map<string, number>();
      for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
      const vec = new Map<string, number>();
      for (const [term, count] of tf) {
        vec.set(term, (count / tokens.length) * (idf.get(term) ?? 1));
      }
      return vec;
    };

    // Cosine similarity between two sparse vectors
    const cosine = (a: Map<string, number>, b: Map<string, number>): number => {
      let dot = 0, magA = 0, magB = 0;
      for (const [k, v] of a) { magA += v * v; if (b.has(k)) dot += v * b.get(k)!; }
      for (const [, v] of b) magB += v * v;
      const denom = Math.sqrt(magA) * Math.sqrt(magB);
      return denom === 0 ? 0 : dot / denom;
    };

    const queryVec = toVector(queryTokens);
    const scored = docs.map((doc, i) => ({
      doc,
      score: cosine(queryVec, toVector(docTokens[i] || [])),
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK).filter(s => s.score > 0).map(s => s.doc);
  }
}

export class SlackTool implements ToolPlugin {
  provider = "Slack";
  async execute(args: string[], config: Record<string, unknown>, ctx: ExecutionContext): Promise<unknown> {
    return {
      channel: config.channel,
      text: config.text,
      langlyRunId: ctx.runId,
      buttons: config.buttons
    };
  }
}

export class EmailTool implements ToolPlugin {
  provider = "Email";
  async execute(args: string[], config: Record<string, unknown>, ctx: ExecutionContext): Promise<unknown> {
    return {
      to: config.to,
      subject: config.subject,
      body: config.body,
      langlyRunId: ctx.runId,
    };
  }
}

// ── Development & Design Connectors ─────

export class GitHubTool implements ToolPlugin {
  provider = "GitHub";
  async execute(args: string[], config: Record<string, unknown>, _ctx: ExecutionContext): Promise<unknown> {
    return {
      method: config.method,
      repo: args[0],
      prId: config.prId,
      body: config.body,
      result: "Mock GitHub success"
    };
  }
}

export class BashTool implements ToolPlugin {
  provider = "Bash";
  async execute(args: string[], config: Record<string, unknown>, ctx: ExecutionContext): Promise<unknown> {
    const command = config.command ?? ctx.current;
    if (typeof command !== "string") {
      throw new ToolExecutionError("Bash", "Bash command must be a string");
    }
    
    try {
      const proc = Bun.spawn(["bash", "-c", command]);
      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();
      
      const exitCode = await proc.exited;
      
      return {
        command,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode
      };
    } catch (e: any) {
      return {
        command,
        stdout: "",
        stderr: e.message,
        exitCode: 1
      };
    }
  }
}

export class FigmaTool implements ToolPlugin {
  provider = "Figma";
  async execute(args: string[], config: Record<string, unknown>, _ctx: ExecutionContext): Promise<unknown> {
    return {
      method: config.method,
      fileKey: args[0],
      nodeId: config.nodeId,
      result: "Mock Figma node data"
    };
  }
}

// ── Business & Research Connectors ─────

export class LinearTool implements ToolPlugin {
  provider = "Linear";
  async execute(args: string[], config: Record<string, unknown>, _ctx: ExecutionContext): Promise<unknown> {
    return {
      method: config.method,
      team: config.team,
      title: config.title,
      description: config.description,
      result: "Mock Linear ticket created: ENG-123"
    };
  }
}

export class BrowserTool implements ToolPlugin {
  provider = "Browser";
  async execute(args: string[], config: Record<string, unknown>, ctx: ExecutionContext): Promise<unknown> {
    const url = (config.url ?? ctx.current) as string;
    if (typeof url !== "string" || !url.startsWith("http")) {
      throw new ToolExecutionError("Browser", `Invalid URL for BrowserTool: ${url}`);
    }

    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Langly-Browser/1.0"
        }
      });
      
      if (!res.ok) {
        throw new ToolExecutionError("Browser", `HTTP Error ${res.status}: ${res.statusText}`);
      }

      const html = await res.text();
      
      // Strip HTML tags to get clean text for LLMs
      const cleanText = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      return {
        method: config.method,
        url,
        content: cleanText.slice(0, 15000) // Truncate to save context window
      };
    } catch (e: any) {
      throw new ToolExecutionError("Browser", `BrowserTool failed to fetch ${url}: ${e.message}`);
    }
  }
}

export class SearchTool implements ToolPlugin {
  provider = "SearchEngine";
  async execute(args: string[], config: Record<string, unknown>, _ctx: ExecutionContext): Promise<unknown> {
    return {
      query: config.query,
      result: "Mock Search Result: Competitor pricing is $99/mo."
    };
  }
}
