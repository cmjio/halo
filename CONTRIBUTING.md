# Contributing to Halo

Thanks for helping. Bug reports, examples, docs fixes, tool packages and language changes are all welcome. By taking part you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Before you start

- **Bugs**: [open an issue](https://github.com/cmjio/halo/issues/new/choose) with the smallest `.halo` file that shows the problem, the command you ran, and `halo --version`.
- **Security problems**: don't open a public issue. See [SECURITY.md](SECURITY.md).
- **Small fixes** (typos, docs, an example, an obvious bug): open a pull request directly.
- **Language or runtime changes** (new syntax, operators, tools, CLI commands): open an issue first so we can agree on the design before you write it. Bigger ideas live in [`proposals/`](proposals/); a pull request that adds one is a good way to start a discussion.

## Setting up

Halo runs on [Bun](https://bun.sh) (CI uses the version in `.github/workflows/ci.yml`).

```bash
git clone https://github.com/cmjio/halo && cd halo
bun install
bun link            # puts your checkout on PATH as `halo`
```

Inside the repo, `bun run index.ts <command>` works the same as `halo <command>`. Most work needs no API key: `halo test` and `--mock` run every model call offline.

## Making a change

The [Layout](README.md#layout) section of the README says where things live. A few things to know:

- **The grammar is the source of truth.** Edit `grammars/Halo.g4`, then run `bun run generate` (needs Java 11+) and commit the regenerated `src/parser/generated/`. Don't edit the generated files by hand.
- **Keep the editors in step.** Syntax changes usually also touch `editors/` (VS Code, Zed, Sublime, tree-sitter), the LSP in `src/lsp/`, and the docs.
- **Docs ship with the code.** If you change behavior, update `docs/` and, where it applies, `README.md`. Preview the site with `bun run docs:dev`.
- **A change that breaks existing projects ships with a migration.** If a project that worked on the last release would behave differently, add an entry to `MIGRATIONS` in `src/migrate/index.ts` with the version that makes the change: `find` reports each place in a project it affects, and `apply` rewrites them when that can be done without guessing what the author meant. Add a row to the table in `docs/guide/production/upgrading.md`.
- **Examples must validate.** Anything in `examples/` or `blueprints/` is run by the test suite.
- **Add a test.** Tests live in `test/` and use `bun test`. A bug fix should come with a test that fails without it.

## Checks

Run what CI runs before you open a pull request:

```bash
bun run typecheck
bun test
bun run validate      # every example validates
```

## Pull requests

- Branch from `main` and keep each pull request to one change.
- Write commit messages in the imperative, saying what changes and why (e.g. "Let next and nightly builds of Halo install packages").
- Describe what you changed and how you tested it. Link the issue it fixes.
- CI must pass. A maintainer will review; please be patient.

Releases are cut by maintainers; see [`.github/RELEASING.md`](.github/RELEASING.md).

## License

Halo is [MIT licensed](LICENSE). By contributing, you agree that your contributions are licensed under the same terms.
