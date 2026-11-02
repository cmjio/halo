<script setup lang="ts">
import data from "../generated/lite.json";
import { packagesHtml } from "../../../site/src/render.ts";

const html = packagesHtml(data as never);
</script>

<template>
  <div class="ledger" v-html="html"></div>
</template>
