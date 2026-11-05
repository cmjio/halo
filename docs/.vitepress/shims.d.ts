// Single-file components, for docs/.vitepress/theme/index.ts (vitepress compiles them).
declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent;
  export default component;
}
