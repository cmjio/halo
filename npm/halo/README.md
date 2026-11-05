# @halolang/halo

The `halo` CLI for [Halo](https://halolang.com), a declarative language for AI workflows, installed through npm.

```bash
npx @halolang/halo init my-project          # no install
npm install --save-dev @halolang/halo       # then: npx halo test main.halo
```

Works with npm, pnpm, Yarn and Bun on macOS, Linux (glibc and musl, x64 and arm64) and Windows x64. It needs no Bun or other runtime: npm installs the standalone `halo` binary for your machine as an optional dependency (`@halolang/halo-<platform>`), and this package runs it.

In a `package.json` script:

```json
{
  "scripts": {
    "pipelines:test": "halo test pipelines/support.halo --mocks samples/mocks.json",
    "pipelines:serve": "halo serve pipelines/"
  }
}
```

If your install skips optional dependencies (`--omit=optional`), or your CPU has no AVX2, install with `curl -fsSL https://halolang.com/install.sh | sh` instead. `HALO_BINARY=/path/to/halo` makes this package run a binary you choose.

Docs: [halolang.com/docs](https://halolang.com/docs/). Source: [github.com/cmjio/halo](https://github.com/cmjio/halo). MIT licensed.
