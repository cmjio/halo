<script setup lang="ts">
import data from "../generated/lite.json";
import { runHtml } from "../../../site/src/render.ts";

const html = runHtml(data as never);
</script>

<template>
  <div class="log" v-html="html" aria-label="A recorded run of the fixer"></div>
</template>
