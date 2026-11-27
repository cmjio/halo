/**
 * What a model call costs, for MaxSpend and a run's reported cost.
 *
 * A price comes from halo.json "prices" (keyed by the model as written in the .halo file,
 * USD per million tokens) or else from the adapter's own table, which knows only the models
 * it lists exactly. A model with neither has no price: under MaxSpend its calls are refused,
 * since the limit couldn't be kept.
 */

import type { ProviderAdapter } from "./adapter.js";

/** halo.json "prices": USD per million tokens, by model ref (e.g. "openrouter/openai/o1-pro"). */
export type Prices = Record<string, { input: number; output: number }>;

/** USD per 1,000 tokens, in and out (the adapters' unit). */
export interface Price {
  in: number;
  out: number;
}

/** A model's price for a call with this many input tokens, or undefined when Halo doesn't know it. */
export function priceOf(model: string, inputTokens: number, adapter: ProviderAdapter | undefined, prices?: Prices): Price | undefined {
  const set = prices?.[model];
  if (set && Number.isFinite(set.input) && Number.isFinite(set.output)) return { in: set.input / 1000, out: set.output / 1000 };
  return adapter?.price?.(model, inputTokens);
}

/** USD for a call at a price. */
export function costAt(price: Price, inputTokens: number, outputTokens: number): number {
  return (inputTokens / 1000) * price.in + (outputTokens / 1000) * price.out;
}

/** What to add to halo.json for a model with no price, for the message that refuses it. */
export function missingPriceMessage(model: string): string {
  return `MaxSpend can't be enforced: Halo has no price for ${model}. Add it to "prices" in halo.json, in USD per million tokens: {"prices": {"${model}": {"input": ..., "output": ...}}}`;
}

/** Problems with a halo.json "prices" value, for a clear error at startup. */
export function pricesProblem(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) return `"prices" must be an object of {"model": {"input": n, "output": n}} (USD per million tokens)`;
  for (const [model, p] of Object.entries(value as Record<string, unknown>)) {
    const v = p as { input?: unknown; output?: unknown } | null;
    if (!v || typeof v !== "object" || typeof v.input !== "number" || typeof v.output !== "number" || v.input < 0 || v.output < 0) {
      return `"prices"."${model}" must be {"input": n, "output": n}, in USD per million tokens`;
    }
  }
  return undefined;
}
