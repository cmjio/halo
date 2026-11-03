/**
 * Renders the Halo showcase video: scene.html is a pure function of time
 * (window.render(t)), so each frame is a screenshot after render(t).
 *
 *   bun render.ts                 # out/halo-showcase.mp4 (or .webm, see below)
 *   bun render.ts --still 10.5    # out/still-10.5.png, for checking a moment
 *   bun render.ts --audio         # out/soundtrack.wav only
 *
 * Uses the installed Google Chrome. The terminal scenes follow the real CLI's
 * output (halo debug, halo plan) for the example in CODE; see RUN below.
 */
import { chromium } from "playwright-core";
import { highlight } from "../site/src/highlight.ts";
import { renderAudio } from "./audio.ts";

const FPS = 30;
const W = 1920, H = 1080;

const CODE = `policy Safe   : Block(PromptInjection) & Redact(APIKey)
policy Budget : MaxSpend(0.25)

agent Writer [anthropic/claude-haiku-4-5, temp: 0.4]
  system "You write short, friendly explanations."
  requires Safe, Budget

pipeline Explain(topic: String) -> Result:
  topic
    |> Writer.explain("Explain {{topic}} in three sentences.") as explanation
    |! yield(msg: "Publish this?", [context.data.explanation]) as review
    |? (context.data.review.approved == true)
    |> System.Print()`;

const OPS = [
  `|> Writer.explain(topic) as draft`,
  `|? (review.approved == true)`,
  `|* each(i in issues) => Label()`,
  `|<> loop(Fixer, "tests fail", max: 3)`,
  `|! yield(msg: "Publish this?")`,
  `~> listen(Slack.Reaction)`,
];

// The glue a hand-written workflow grows: illustrative, for the opening.
const GLUE = `async function explain(topic: string, ctx: Ctx) {
  // retry with backoff
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (/ignore (all )?previous/i.test(topic)) throw new Blocked("injection");
      const prompt = redact(\`Explain \${topic} in three sentences.\`);
      const res = await withTimeout(client.messages.create({
        model: "claude-haiku-4-5", max_tokens: 400, temperature: 0.4,
        system: "You write short, friendly explanations.",
        messages: [{ role: "user", content: prompt }],
      }), 30_000);
      spend += res.usage.input_tokens * IN_RATE + res.usage.output_tokens * OUT_RATE;
      if (spend > 0.25) throw new BudgetExceeded(spend);
      await db.runs.update(ctx.runId, { step: "explained", text: res.content[0].text });
      return await waitForApproval(ctx, res.content[0].text);
    } catch (e) {
      if (e instanceof Blocked || e instanceof BudgetExceeded) throw e;
      await sleep(2 ** attempt * 1000 + Math.random() * 250);
    }
  }
  throw new Error("explain failed after 3 attempts");
}

// redact secrets by regex
function redact(s: string) {
  return s.replace(/sk-[A-Za-z0-9_-]{20,}/g, "[REDACTED]")
          .replace(/AKIA[0-9A-Z]{16}/g, "[REDACTED]");
}

// approval webhook, and resume after a restart
app.post("/approve/:runId", async (req, res) => {
  const run = await db.runs.find(req.params.runId);
  if (!run || run.status !== "waiting") return res.status(404).end();
  if (!verifySignature(req)) return res.status(401).end();
  await db.runs.update(run.id, { status: "approved", by: req.user.id });
  queue.push({ runId: run.id, resumeAt: "approved" });
  res.json({ ok: true });
});

async function waitForApproval(ctx: Ctx, text: string) {
  await db.runs.update(ctx.runId, { status: "waiting" });
  await slack.post({ channel: "#review", text, actions: approveButtons(ctx.runId) });
  return new Promise((resolve) => approvals.once(ctx.runId, resolve));
}
`;

// A small TypeScript highlighter for the glue, in the same colors.
const TS_KW = /^(async|await|function|const|let|for|if|try|catch|throw|return|new|instanceof|of)$/;
function highlightTs(line: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const re = /(\/\/.*$)|("(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)|(\/(?:[^/\\\n]|\\.)+\/[gi]*)|(\b\d[\d_.]*\b)|([A-Za-z_]\w*)/g;
  let out = "", last = 0;
  for (const m of line.matchAll(re)) {
    out += esc(line.slice(last, m.index));
    last = m.index! + m[0].length;
    const [text, comment, str, regex, num, word] = m;
    if (comment) out += `<span class="t-comment">${esc(text)}</span>`;
    else if (str || regex) out += `<span class="t-string">${esc(text)}</span>`;
    else if (num) out += `<span class="t-number">${text}</span>`;
    else if (TS_KW.test(word!)) out += `<span class="t-kw">${text}</span>`;
    else if (/^[A-Z]/.test(word!)) out += `<span class="t-type">${text}</span>`;
    else out += text;
  }
  return out + esc(line.slice(last));
}

// What a real run printed is shown in the CLI's own format (halo debug). The
// answer, timings and cost are illustrative: runs here are mocked, so there is
// no real model answer to show. Replace them with a live run's if you have one.
const RUN = {
  answer: [
    "Tide pools are rocky pockets of seawater left at low tide.",
    "Crabs, anemones and sea stars live there, riding out the waves.",
    "Visit at low tide, and leave everything where you found it.",
  ],
  callMs: 1184,
  callCost: "0.00034",
  waitMs: 3912,
  totalMs: 5126,
};

const lines = CODE.split("\n");
const SCENE_DATA = {
  code: lines.map((l) => ({ html: highlight(l), len: l.length })),
  ops: OPS.map(highlight),
  glue: GLUE.trimEnd().split("\n").map(highlightTs),
  ...RUN,
};

const outDir = `${import.meta.dir}/out`;
await Bun.$`mkdir -p ${outDir}`;

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await page.addInitScript((data) => ((window as any).SCENE_DATA = data), SCENE_DATA);
await page.goto(`file://${import.meta.dir}/scene.html`);
await page.evaluate(() => document.fonts.ready);
const duration: number = await page.evaluate(() => (window as any).DURATION);

// The soundtrack follows the scene's own cues.
const { cues, sections } = await page.evaluate(() => ({ cues: (window as any).AUDIO_EVENTS, sections: (window as any).AUDIO_SECTIONS }));
const wav = `${outDir}/soundtrack.wav`;
if (process.argv.includes("--audio")) {
  await Bun.write(wav, renderAudio(cues, sections));
  console.log(wav);
  await browser.close();
  process.exit(0);
}

const stillAt = process.argv.indexOf("--still");
if (stillAt !== -1) {
  for (const arg of process.argv.slice(stillAt + 1)) {
    await page.evaluate((t) => (window as any).render(t), Number(arg));
    await page.screenshot({ path: `${outDir}/still-${arg}.png` });
    console.log(`${outDir}/still-${arg}.png`);
  }
  await browser.close();
  process.exit(0);
}

// A system ffmpeg makes an H.264 MP4. Without one, Playwright's bundled
// ffmpeg (VP8 only, JPEG input only) makes a WebM.
const systemFfmpeg = Bun.which("ffmpeg");
const bundled = `${process.env.HOME}/Library/Caches/ms-playwright/ffmpeg-1011/ffmpeg-mac`;
if (!systemFfmpeg && !(await Bun.file(bundled).exists())) throw new Error("ffmpeg not found");
const mp4 = !!systemFfmpeg;
const out = `${outDir}/halo-showcase.${mp4 ? "mp4" : "webm"}`;
const encode = mp4
  ? ["-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p", "-movflags", "+faststart"]
  : ["-c:v", "libvpx", "-b:v", "12M", "-crf", "4", "-qmin", "0", "-qmax", "24", "-deadline", "good", "-cpu-used", "1", "-pix_fmt", "yuv420p"];
// Frames go to one stream file first: Playwright's ffmpeg reads neither stdin
// nor numbered image files, only a single file of concatenated images.
const ext = mp4 ? "png" : "jpg";
const stream = `${outDir}/frames.${ext}stream`;
const writer = Bun.file(stream).writer();
const frames = Math.round(duration * FPS);
for (let f = 0; f < frames; f++) {
  await page.evaluate((t) => (window as any).render(t), f / FPS);
  writer.write(await page.screenshot(mp4 ? { type: "png" } : { type: "jpeg", quality: 95 }));
  if (f % FPS === 0) process.stdout.write(`\r${f}/${frames} frames`);
}
await writer.end();
await browser.close();

// Only the MP4 gets the soundtrack: the bundled ffmpeg has no audio encoder.
if (mp4) await Bun.write(wav, renderAudio(cues, sections));
const audio = mp4 ? ["-i", wav, "-c:a", "aac", "-b:a", "192k", "-shortest"] : [];
const ffmpeg = Bun.spawn(
  [systemFfmpeg ?? bundled, "-y", "-loglevel", "error", "-f", "image2pipe", "-c:v", mp4 ? "png" : "mjpeg",
   "-framerate", String(FPS), "-i", stream, ...audio, ...encode, out],
  { stdout: "inherit", stderr: "inherit" },
);
if ((await ffmpeg.exited) !== 0) throw new Error("ffmpeg failed");
await Bun.$`rm -f ${stream}`;
console.log(`\n${out}`);
