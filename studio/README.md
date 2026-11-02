# Halo Studio

The web UI served by `halo serve` at `/`: recent runs with their status and cost, each run as a chart of its stages and model/tool calls, an inspector for prompts and answers, a form to start pipelines, and Approve/Reject for paused runs.

It's a React app bundled by Bun's HTML imports (`index.html` → `src/main.tsx`); there's no separate build step or dev server. It talks to the server's `/api` on the same origin. If the server has a token, open Studio once with `?token=<HALO_SERVE_TOKEN>`.

```bash
halo serve            # or: bun run studio
bunx tsc -p studio/tsconfig.json
```
