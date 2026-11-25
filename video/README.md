# Videos

## Trailer

Halo's launch trailer: 54.6 seconds, 1920×1080 at 60 fps, with a soundtrack ([`trailer.html`](trailer.html), [`trailer.ts`](trailer.ts), [`trailer-audio.ts`](trailer-audio.ts)). The home page's "Watch the trailer" opens it.

The character is the logo: an orb (the agent, with eyes) and the ring above it (the halo: the rules).

1. **Wake**: a spark becomes the orb; it opens its eyes, looks around, hops. "Meet your agent."
2. **Power**: tool chips spring out of it into an orbit, then dangerous ones join; the orbit speeds up, the spend counter races, the camera shakes. "Which is exactly the problem."
3. **The halo**: time freezes, the ring drops and lands, a shockwave shatters the dangerous calls, the spend rolls back to $0, and the wordmark slides out from behind the orb
4. **Rules**: an iris opens inside the ring onto the policy being typed; `Repo.read` passes the gate, `Repo.delete` is refused at it (the token it broke lights up)
5. **Ask**: an approval card; the agent falls asleep while the clock spins from Tuesday to Thursday; a cursor approves; it wakes and posts
6. **Plan**: a whip pan to the pipeline drawing itself and the cost meter filling to ≤ $0.1948 under MaxSpend $0.25
7. **Replay**: the nodes shrink into the run's timeline; the orb rides the playhead through the run (19.8 s, $0.0852), rewinds, and replays it in 19 ms for $0
8. **Montage**: one word a beat (Sandboxes, Real browsers, Schedules, Any model, Memory, Teams), each with the orb in it
9. **Outro**: three orbs merge, the halo lands again, the wordmark, the tagline, the install command, a wink

```bash
cd video && bun install
bun trailer.ts                 # ../docs/public/video/halo-trailer.mp4 and halo-trailer.jpg (the poster)
bun trailer.ts --still 11.3 20 # out/trailer-11.3.png, out/trailer-20.png
bun trailer.ts --fps 30        # a quicker draft
bun trailer.ts --audio         # out/trailer.wav only
```

`trailer.html` is a pure function of time (`window.render(t)`) built from a small motion kit: eased tweens, damped springs, decaying wobbles for impacts, squash and stretch, seeded particles and noise, so a re-render is identical. It lists its sound cues in `window.AUDIO_EVENTS`; `trailer-audio.ts` synthesizes the score from them (a 120 BPM groove; silence on the freeze), so every sound lands on its frame. The policy is colored with the site's own `highlight()`; the plan, run and replay numbers are the ones the home page shows.

## Home page loop

A silent 16-second, 1280×720 loop that plays muted on the home page ([`loop.html`](loop.html), [`loop.ts`](loop.ts)):

1. The HaloLang wordmark ([`assets/halolang-mark.png`](assets/halolang-mark.png))
2. **Refused before it runs**: the fixer's `FixerTools` policy from `examples/engineering/software-team.halo`, and what the runtime's `PolicyEngine` says to `Code.edit` on `acceptance.test.ts` (refused) and on `stats.ts` (allowed)
3. **Planned before it starts**: `halo plan` for that file's `FixUntilGreen` pipeline
4. **Replayed for $0**: the recorded fixer run's time and cost against its replay, to scale
5. The wordmark again, so the end joins the start

```bash
cd video && bun install
bun loop.ts             # ../docs/public/video/halo-loop.mp4 and halo-loop.jpg (the poster)
bun loop.ts --still 7 10 # out/loop-7.png, out/loop-10.png
```

Nothing on screen is typed in by hand: `loop.ts` reads the policy from the example, asks the real `PolicyEngine` for its verdicts (and fails if the test file stops being refused), runs `halo plan`, and takes the run's numbers from `site/data/fixer-run.json`. Re-render after changing any of them.

## Showcase video

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
