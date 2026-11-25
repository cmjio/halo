import DefaultTheme from "vitepress/theme";
import type { Theme } from "vitepress";
import Playground from "./Playground.vue";
import ProvidersTable from "./ProvidersTable.vue";
import PackageList from "./PackageList.vue";
import RecordedRun from "./RecordedRun.vue";
import Home from "./Home.vue";
import { installMetrickleEvents } from "./metrickle";
import "./custom.css";
import "./primer.css";

export default {
  extends: DefaultTheme,
  enhanceApp({ app, router }) {
    app.component("Playground", Playground);
    app.component("ProvidersTable", ProvidersTable);
    app.component("PackageList", PackageList);
    app.component("RecordedRun", RecordedRun);
    app.component("Home", Home);
    if (!import.meta.env.SSR) installMetrickleEvents(router);
  },
} satisfies Theme;
