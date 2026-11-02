<script setup lang="ts">
import { ref, watch } from "vue";
import data from "../generated/lite.json";
import { providersHtml } from "../../../site/src/render.ts";

const rows = providersHtml(data as never);
const query = ref("");
const table = ref<HTMLElement>();
watch(query, (q) => {
  const needle = q.trim().toLowerCase();
  for (const row of table.value?.querySelectorAll<HTMLElement>("tr[data-q]") ?? []) row.hidden = !!needle && !row.dataset.q!.includes(needle);
});
</script>

<template>
  <input v-model="query" class="filter" type="search" placeholder="Filter: provider or method…" aria-label="Filter providers" />
  <div class="table-wrap">
    <table ref="table" class="ref providers">
      <thead><tr><th>Provider</th><th>Methods</th><th>From</th></tr></thead>
      <tbody v-html="rows"></tbody>
    </table>
  </div>
</template>
