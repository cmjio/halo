/**
 * LLM Router
 * 
 * Routes requests to the best model based on:
 * - Cost constraints (max cost per request)
 * - Performance requirements (latency, quality)
 * - Model capabilities (vision, function calling, etc.)
 * - User preferences
 */

import type { LLMRequest, ModelInfo } from "./adapter";

export interface RouterConfig {
  /** Maximum cost per 1k tokens (input + output combined) */
  maxCostPer1kTokens?: number;
  
  /** Preferred providers (in order) */
  preferredProviders?: string[];
  
  /** Required capabilities */
  requiredCapabilities?: ModelCapability[];
  
  /** Maximum latency in ms */
  maxLatency?: number;
  
  /** Strategy for model selection */
  strategy?: "cost-optimized" | "performance" | "balanced" | "local-first";
}

export type ModelCapability = 
  | "vision"
  | "function-calling"
  | "json-mode"
  | "streaming"
  | "large-context"
  | "reasoning";

export interface RoutedRequest extends LLMRequest {
  /** Original model ID requested */
  originalModel: string;
  
  /** Actually selected model (after routing) */
  selectedModel: string;
  
  /** Estimated cost for this request */
  estimatedCost?: number;
  
  /** Routing decision reason */
  routingReason?: string;
}

export class LLMRouter {
  private config: RouterConfig;
  private modelCache = new Map<string, ModelInfo[]>();
  
  constructor(config: RouterConfig = {}) {
    this.config = {
      strategy: "balanced",
      ...config,
    };
  }
  
  /**
   * Route a request to the best model based on configuration.
   * Returns the model ID to use and estimated cost.
   */
  async route(
    requestedModel: string,
    promptTokens: number,
    estimatedOutputTokens: number,
    availableModels?: ModelInfo[],
  ): Promise<{ model: string; estimatedCost: number; reason: string }> {
    // If no routing needed, return original model
    if (this.config.strategy === undefined && !this.config.maxCostPer1kTokens) {
      return {
        model: requestedModel,
        estimatedCost: 0,
        reason: "No routing configured, using original model",
      };
    }
    
    // Fetch available models if not provided
    const models = availableModels ?? await this.getAvailableModels();
    
    // Filter by capabilities if required
    let candidates = this.filterByCapabilities(models);
    
    // Filter by provider preferences
    candidates = this.filterByProviderPreferences(candidates);
    
    // Filter by cost constraints
    candidates = this.filterByCost(candidates, promptTokens, estimatedOutputTokens);
    
    // Filter by latency requirements
    candidates = this.filterByLatency(candidates);
    
    // Select best model based on strategy
    const selected = this.selectByStrategy(
      candidates,
      promptTokens,
      estimatedOutputTokens,
    );
    
    if (!selected) {
      throw new Error(`No suitable model found for request. Candidates: ${candidates.length}`);
    }
    
    const reason = this.getRoutingReason(selected, requestedModel);
    
    return {
      model: selected.id,
      estimatedCost: this.estimateCost(selected, promptTokens, estimatedOutputTokens),
      reason,
    };
  }
  
  /** Get all available models from all providers */
  private async getAvailableModels(): Promise<ModelInfo[]> {
    // In production, this would fetch from provider APIs
    // For now, return a static list
    return [
      // OpenAI
      { id: "openai/gpt-4o", name: "GPT-4o", costPer1kTokens: { input: 0.005, output: 0.015 }, contextWindow: 128000 },
      { id: "openai/gpt-4o-mini", name: "GPT-4o Mini", costPer1kTokens: { input: 0.00015, output: 0.0006 }, contextWindow: 128000 },
      { id: "openai/o1-mini", name: "O1 Mini", costPer1kTokens: { input: 0.003, output: 0.012 }, contextWindow: 128000 },
      
      // Anthropic
      { id: "anthropic/claude-3-5-sonnet", name: "Claude 3.5 Sonnet", costPer1kTokens: { input: 0.003, output: 0.015 }, contextWindow: 200000 },
      { id: "anthropic/claude-3-opus", name: "Claude 3 Opus", costPer1kTokens: { input: 0.015, output: 0.075 }, contextWindow: 200000 },
      { id: "anthropic/claude-3-haiku", name: "Claude 3 Haiku", costPer1kTokens: { input: 0.00025, output: 0.00125 }, contextWindow: 200000 },
      
      // Google
      { id: "google/gemini-1.5-pro", name: "Gemini 1.5 Pro", costPer1kTokens: { input: 0.00125, output: 0.00375 }, contextWindow: 1000000 },
      { id: "google/gemini-1.5-flash", name: "Gemini 1.5 Flash", costPer1kTokens: { input: 0.000075, output: 0.0003 }, contextWindow: 1000000 },
      
      // Local (Ollama)
      { id: "ollama/llama3.1", name: "Llama 3.1 (Local)", costPer1kTokens: { input: 0, output: 0 }, contextWindow: 128000 },
      { id: "ollama/mistral", name: "Mistral (Local)", costPer1kTokens: { input: 0, output: 0 }, contextWindow: 32000 },
    ];
  }
  
  private filterByCapabilities(models: ModelInfo[]): ModelInfo[] {
    if (!this.config.requiredCapabilities?.length) return models;
    
    return models.filter(m => {
      // In production, check actual model capabilities
      // For now, assume all models support basic capabilities
      return true;
    });
  }
  
  private filterByProviderPreferences(models: ModelInfo[]): ModelInfo[] {
    if (!this.config.preferredProviders?.length) return models;
    
    const preferred = models.filter(m => 
      this.config.preferredProviders!.some(p => m.id.startsWith(p))
    );
    
    return preferred.length > 0 ? preferred : models;
  }
  
  private filterByCost(
    models: ModelInfo[],
    promptTokens: number,
    outputTokens: number,
  ): ModelInfo[] {
    if (!this.config.maxCostPer1kTokens) return models;
    
    return models.filter(m => {
      const cost = this.estimateCost(m, promptTokens, outputTokens);
      const costPer1k = (cost / (promptTokens + outputTokens)) * 1000;
      return costPer1k <= this.config.maxCostPer1kTokens!;
    });
  }
  
  private filterByLatency(models: ModelInfo[]): ModelInfo[] {
    if (!this.config.maxLatency) return models;
    
    // In production, check actual latency metrics
    // For now, prefer local models for low latency
    const fastModels = models.filter(m => m.id.startsWith("ollama/"));
    return fastModels.length > 0 ? fastModels : models;
  }
  
  private selectByStrategy(
    models: ModelInfo[],
    promptTokens: number,
    outputTokens: number,
  ): ModelInfo | undefined {
    if (models.length === 0) return undefined;
    
    switch (this.config.strategy) {
      case "cost-optimized":
        return models.reduce((cheapest, current) => {
          const cheapestCost = this.estimateCost(cheapest, promptTokens, outputTokens);
          const currentCost = this.estimateCost(current, promptTokens, outputTokens);
          return currentCost < cheapestCost ? current : cheapest;
        });
      
      case "performance":
        // Prefer larger, more capable models
        return models.find(m => 
          m.id.includes("opus") || m.id.includes("gpt-4") || m.id.includes("gemini-1.5-pro")
        ) ?? models[0];
      
      case "local-first":
        const local = models.find(m => m.id.startsWith("ollama/"));
        return local ?? models[0];
      
      case "balanced":
      default:
        // Balance cost and performance
        return models.reduce((best, current) => {
          const bestScore = this.calculateBalancedScore(best, promptTokens, outputTokens);
          const currentScore = this.calculateBalancedScore(current, promptTokens, outputTokens);
          return currentScore > bestScore ? current : best;
        });
    }
  }
  
  private calculateBalancedScore(
    model: ModelInfo,
    promptTokens: number,
    outputTokens: number,
  ): number {
    const cost = this.estimateCost(model, promptTokens, outputTokens);
    const costScore = Math.max(0, 100 - cost * 1000); // Lower cost = higher score
    const contextScore = Math.min(100, (model.contextWindow ?? 0) / 1000); // Larger context = higher score
    
    return costScore * 0.6 + contextScore * 0.4; // Weight cost more heavily
  }
  
  private estimateCost(
    model: ModelInfo,
    promptTokens: number,
    outputTokens: number,
  ): number {
    if (!model.costPer1kTokens) return 0;
    const inputCost = (promptTokens / 1000) * model.costPer1kTokens.input;
    const outputCost = (outputTokens / 1000) * model.costPer1kTokens.output;
    return inputCost + outputCost;
  }
  
  private getRoutingReason(model: ModelInfo, originalModel: string): string {
    if (model.id === originalModel) {
      return "Using originally requested model";
    }
    return `Routed to ${model.name} based on ${this.config.strategy} strategy`;
  }
}

// ── Cost Tracking ─────

export class CostTracker {
  private totalCost = 0;
  private requestCount = 0;
  private modelCosts = new Map<string, { cost: number; count: number }>();
  
  /** Record a request's actual cost */
  recordUsage(model: string, actualCost: number): void {
    this.totalCost += actualCost;
    this.requestCount++;
    
    const existing = this.modelCosts.get(model) ?? { cost: 0, count: 0 };
    this.modelCosts.set(model, {
      cost: existing.cost + actualCost,
      count: existing.count + 1,
    });
  }
  
  /** Get total cost so far */
  getTotalCost(): number {
    return this.totalCost;
  }
  
  /** Get cost breakdown by model */
  getCostBreakdown(): Record<string, { cost: number; count: number; avgCost: number }> {
    const breakdown: Record<string, { cost: number; count: number; avgCost: number }> = {};
    
    for (const [model, data] of this.modelCosts.entries()) {
      breakdown[model] = {
        cost: data.cost,
        count: data.count,
        avgCost: data.cost / data.count,
      };
    }
    
    return breakdown;
  }
  
  /** Reset tracking */
  reset(): void {
    this.totalCost = 0;
    this.requestCount = 0;
    this.modelCosts.clear();
  }
}
