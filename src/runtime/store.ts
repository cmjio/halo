import type { ExecutionContext } from "./runtime.js";
import { readFileSync, writeFileSync, existsSync } from "fs";

export interface StorePlugin {
  provider: string;
  load(ctx: ExecutionContext, config: Record<string, unknown>): Promise<string | null>;
  save(ctx: ExecutionContext, data: string, config: Record<string, unknown>): Promise<void>;
}

export class StoreRegistry {
  private plugins = new Map<string, StorePlugin>();

  register(plugin: StorePlugin): this {
    this.plugins.set(plugin.provider, plugin);
    return this;
  }

  get(provider: string): StorePlugin | undefined {
    return this.plugins.get(provider);
  }
}

// ── Built-in Store Providers ─────

export class FileStorePlugin implements StorePlugin {
  provider = "File";

  async load(ctx: ExecutionContext, config: Record<string, unknown>): Promise<string | null> {
    const filePath = config.arg0 as string;
    if (!filePath) return null;
    
    if (existsSync(filePath)) {
      try {
        const content = readFileSync(filePath, "utf-8");
        return content;
      } catch (err) {
        console.error(`Failed to load store from ${filePath}:`, err);
        return null;
      }
    }
    return null;
  }

  async save(ctx: ExecutionContext, data: string, config: Record<string, unknown>): Promise<void> {
    const filePath = config.arg0 as string;
    if (!filePath) return;

    try {
      let content = "";
      if (existsSync(filePath)) {
        content = readFileSync(filePath, "utf-8");
      }
      
      const MAX_INTERACTIONS = 10;
      let interactions = content ? content.split("\n\n").filter(Boolean) : [];
      interactions.push(data);
      
      if (interactions.length > MAX_INTERACTIONS) {
        interactions = interactions.slice(interactions.length - MAX_INTERACTIONS);
      }
      
      writeFileSync(filePath, interactions.join("\n\n"), "utf-8");
    } catch (err) {
      console.error(`Failed to save store to ${filePath}:`, err);
    }
  }
}
