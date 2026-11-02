---
title: Tool providers
---

# Tool providers

Every provider you can declare with `tool Name : Provider(args)`: the built-in ones, and the ones in the [package registry](/packages). Each method has an effect, which [tool policies](/stdlib/policies) and `halo plan` use: <span class="e read">read</span> changes nothing, <span class="e write">write</span> changes local state, <span class="e external">external</span> acts on the world. Hover a method for its description.

<ProvidersTable />

Details and arguments for each: [built-in tools](/stdlib/tools), [local tools](/stdlib/local-tools), [Chrome](/stdlib/chrome), [MCP](/guide/integrations/mcp), [stores](/stdlib/stores).
