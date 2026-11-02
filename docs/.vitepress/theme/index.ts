import DefaultTheme from "vitepress/theme";
import type { Theme } from "vitepress";
import Playground from "./Playground.vue";
import ProvidersTable from "./ProvidersTable.vue";
import PackageList from "./PackageList.vue";
import RecordedRun from "./RecordedRun.vue";
import "./custom.css";

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component("Playground", Playground);
    app.component("ProvidersTable", ProvidersTable);
    app.component("PackageList", PackageList);
    app.component("RecordedRun", RecordedRun);
  },
} satisfies Theme;
