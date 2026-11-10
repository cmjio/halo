<script setup lang="ts">
// Loaded in the browser only: it brings Halo's parser, validator, and planner, and every example.
import { onMounted, ref } from "vue";

const host = ref<HTMLElement>();
onMounted(async () => {
  const [{ mountPlayground, decodeShared }, data] = await Promise.all([import("../../../site/src/playground.ts"), import("../generated/data.json")]);
  const params = new URLSearchParams(location.search);
  // ?example=01-hello, ?challenge=budget, or #code=… (a link made with the Share button).
  const shared = location.hash.match(/^#code=(.+)$/)?.[1];
  const code = shared ? await decodeShared(shared) : undefined;
  mountPlayground(host.value!, data.default as never, {
    example: params.get("example") ?? undefined,
    challenge: params.get("challenge") ?? undefined,
    code,
  });
});
</script>

<template>
  <div ref="host" class="pg-host"><p class="pg-loading">Warming up the playground…</p></div>
</template>
