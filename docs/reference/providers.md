---
title: Tool providers
---

# Tool providers

Every provider you can declare with `tool Name : Provider(args)`: the built-in ones, and the ones in the [package registry](/packages). Each method has an effect, which [tool policies](/stdlib/policies) and `halo plan` use: <span class="e read">read</span> changes nothing, <span class="e write">write</span> changes local state, <span class="e external">external</span> acts on the world. Hover a method for its description.

<ProvidersTable />

Details and arguments for each: [built-in tools](/stdlib/tools), [local tools](/stdlib/local-tools), [Chrome](/stdlib/chrome), [MCP](/guide/integrations/mcp), [stores](/stdlib/stores).

## Model prices

Model providers are chosen by the model id's prefix (see [agent](/guide/reference#agent)). What a call costs comes from the provider when it says (OpenRouter), then from `"prices"` in halo.json (USD per million tokens, by model id as written), then from Halo's table:

| Provider | Prices Halo knows |
|---|---|
| `anthropic/` | The Claude models on [Anthropic's pricing page](https://platform.claude.com/docs/en/about-claude/pricing), by exact id |
| `openai/` | `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`, `gpt-3.5-turbo` |
| `google/`, `gemini/` | `gemini-1.5-flash`, `gemini-1.5-pro` |
| `openrouter/` | None ahead of a call; each call's billed cost after it |
| `together/`, `replicate/`, other OpenAI-compatible | None |
| `ollama/`, `local/` | Free |

A model with no price can't be used by an agent under `MaxSpend`: add it to `"prices"`. Without `MaxSpend`, its cost is a rough estimate, marked `priced: false`. See [Model prices](/stdlib/policies#model-prices).
