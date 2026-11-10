// The Halo library, from this checkout. The npm package (@halolang/halo) ships only the
// CLI binary, so in your own project add the library from GitHub instead:
//
//   bun add github:cmjio/halo
//
// and import from "halo". It needs Bun on the server: the runtime uses bun:sqlite, Bun.file
// and Bun.spawn, so it can't run in a browser (and shouldn't: it holds your model keys).
export * from "../../src/index.ts";
