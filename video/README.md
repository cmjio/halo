# Showcase video

A 60-second, 1920×1080 video of Halo, with a soundtrack:

1. **Hook**: a hand-written workflow scrolls past (retries, redaction, spend tracking, approval webhooks), then "What if you could just declare it?"
2. **Logo**
3. **The language**: `explain.halo` types itself out, with notes on its policies, agent and pipeline
4. **It runs**: `halo debug` in a terminal beside the source; each line lights up as it runs, the run pauses at `|! yield`, and someone types `approve`
5. **A policy blocks an attack**: a prompt injection is stopped by `Block(PromptInjection)` before the model is called
6. **Operators**: `|>`, `|?`, `|*`, `|<>`, `|!`, `~>`
7. **`halo plan`**: the worst-case cost before a run
8. **Outro**: install command and halolang.com

```bash
cd video && bun install
bun render.ts               # out/halo-showcase.mp4 (or .webm, see below)
bun render.ts --still 12 30 # out/still-12.png, out/still-30.png
bun render.ts --audio       # out/soundtrack.wav only
```

[`scene.html`](scene.html) is a pure function of time (`window.render(t)`) and lists its sound cues in `window.AUDIO_EVENTS`. [`render.ts`](render.ts) opens it in the installed Google Chrome, screenshots every frame, synthesizes the soundtrack from the cues with [`audio.ts`](audio.ts), and encodes both with ffmpeg. Halo code is colored with the site's own [`highlight()`](../site/src/highlight.ts).

**What's real:** the terminal scenes follow the CLI's own output for this file. The policy block and `halo plan` output were captured from real runs. The model's answer, its timings and its cost are illustrative, because runs here were mocked. To show a live run's numbers instead, edit `RUN` in `render.ts`. The glue code in the hook is illustrative too.

With ffmpeg on the PATH it writes an H.264 MP4 with AAC audio. Without it, it uses Playwright's bundled ffmpeg (`~/Library/Caches/ms-playwright/ffmpeg-*`) and writes a silent VP8 `out/halo-showcase.webm`. That build reads neither stdin nor numbered image files, so the frames go into one file of concatenated images first.
