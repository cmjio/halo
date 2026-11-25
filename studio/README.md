# Halo Studio

The web UI served by `halo serve` at `/`.

- **Pipelines** (the home page): every pipeline the server runs, its schedules and webhooks, and a form to start it.
- **Runs**: recent runs with their status, duration and cost. Each run opens as a timeline of its stages, model calls and tool calls; select a step to read its prompt, answer and result. Time a run spent waiting for someone is left off the timeline.
- **Paused runs**: Approve, Reject, or send another answer.
- **Evolve**: start `halo evolve` runs, read the variants and their diffs, and apply one.

The controls (dialog, dropdowns, segmented controls, tooltips, switches, steppers, the resizable details panel) are [Ark UI](https://ark-ui.com) components, wrapped in `src/ui.tsx` and styled in `src/App.css`.

It's a React app bundled by Bun's HTML imports (`index.html` → `src/main.tsx`); there's no separate build step or dev server. It talks to the server's `/api` on the same origin. If the server has a token, Studio asks for it, or open it once with `?token=<HALO_SERVE_TOKEN>`.

`src/trace.ts` turns a run's telemetry rows into the steps on the timeline; it has no DOM in it and is tested in `test/studio.test.ts`.

```bash
halo serve            # or: bun run studio
bunx tsc -p studio/tsconfig.json
bun test test/studio.test.ts
```
