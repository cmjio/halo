<script setup lang="ts">
// Loaded in the browser only: it brings Halo's parser, validator, and planner, and every example.
import { onMounted, ref } from "vue";

const host = ref<HTMLElement>();
onMounted(async () => {
  const [{ mountPlayground }, data] = await Promise.all([import("../../../site/src/playground.ts"), import("../generated/data.json")]);
  const example = new URLSearchParams(location.search).get("example") ?? undefined;
  mountPlayground(host.value!, data.default as never, example);
});
</script>

<template>
  <div ref="host" class="pg-host"><p class="pg-loading">Loading the playground…</p></div>
</template>
