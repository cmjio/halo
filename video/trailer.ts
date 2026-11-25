/**
 * Renders Halo's launch trailer: trailer.html is a pure function of time (window.render(t)), so
 * each frame is a screenshot after render(t). The soundtrack is synthesized from the scene's own
 * cues (trailer-audio.ts), so every sound lands on its frame.
 *
 *   bun trailer.ts                  # ../docs/public/video/halo-trailer.mp4 and .jpg (the poster)
 *   bun trailer.ts --still 11.3 20  # out/trailer-11.3.png, out/trailer-20.png
 *   bun trailer.ts --audio          # out/trailer.wav only
 *   bun trailer.ts --fps 30         # a quicker draft (default 60)
 *
 * The policy on screen is highlighted with the site's own highlight(); the numbers (the plan's
 * $0.1948, the run's 19.8 s and $0.0852, its 19 ms replay) are the ones the home page shows.
 */
import { chromium } from "playwright-core";
import { highlight } from "../site/src/highlight.ts";
import { renderTrailerAudio } from "./trailer-audio.ts";

const W = 1920, H = 1080;
const fpsAt = process.argv.indexOf("--fps");
const FPS = fpsAt !== -1 ? Number(process.argv[fpsAt + 1]) : 60;

const CODE = `policy Guard : AllowTools("Repo.read", "Repo.comment")
  & ApproveTools("Repo.comment")
  & MaxSpend(0.25)

agent Triager [anthropic/claude-haiku-4-5]
  requires Guard`;

const SCENE_DATA = {
  code: CODE.split("\n").map((l) => ({ html: highlight(l), len: l.length })),
  install: "curl -fsSL https://halolang.com/install.sh | sh",
};

const outDir = `${import.meta.dir}/out`;
const publicDir = `${import.meta.dir}/../docs/public/video`;
await Bun.$`mkdir -p ${outDir}`;

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.addInitScript((data) => ((window as any).SCENE_DATA = data), SCENE_DATA);
await page.goto(`file://${import.meta.dir}/trailer.html`);
await page.evaluate(() => document.fonts.ready);
const duration: number = await page.evaluate(() => (window as any).DURATION);
const { cues, sections } = await page.evaluate(() => ({ cues: (window as any).AUDIO_EVENTS, sections: (window as any).AUDIO_SECTIONS }));
const wav = `${outDir}/trailer.wav`;

if (process.argv.includes("--audio")) {
  await Bun.write(wav, renderTrailerAudio(cues, sections));
  console.log(wav);
  await browser.close();
  process.exit(0);
}

const stillAt = process.argv.indexOf("--still");
if (stillAt !== -1) {
  for (const arg of process.argv.slice(stillAt + 1)) {
    if (arg.startsWith("--")) break;
    await page.evaluate((t) => (window as any).render(t), Number(arg));
    await page.screenshot({ path: `${outDir}/trailer-${arg}.png` });
    console.log(`${outDir}/trailer-${arg}.png`);
  }
  await browser.close();
  process.exit(0);
}

const ffmpeg = Bun.which("ffmpeg");
if (!ffmpeg) throw new Error("ffmpeg not found: the trailer needs it for H.264 and AAC");
const stream = `${outDir}/trailer-frames.jpgstream`;
const writer = Bun.file(stream).writer();
const frames = Math.round(duration * FPS);
for (let f = 0; f < frames; f++) {
  await page.evaluate((t) => (window as any).render(t), f / FPS);
  writer.write(await page.screenshot({ type: "jpeg", quality: 96 }));
  if (f % FPS === 0) process.stdout.write(`\r${f}/${frames} frames`);
}
await writer.end();
// the poster: the moment the wordmark has settled beside the haloed orb
await page.evaluate((t) => (window as any).render(t), 14.2);
await page.screenshot({ path: `${publicDir}/halo-trailer.jpg`, type: "jpeg", quality: 88 });
await browser.close();

await Bun.write(wav, renderTrailerAudio(cues, sections));
const out = `${publicDir}/halo-trailer.mp4`;
const enc = Bun.spawn(
  [ffmpeg, "-y", "-loglevel", "error", "-f", "image2pipe", "-c:v", "mjpeg", "-framerate", String(FPS), "-i", stream, "-i", wav,
   "-c:v", "libx264", "-preset", "slow", "-crf", "24", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
   "-af", "volume=-1.5dB", "-c:a", "aac", "-b:a", "160k", "-shortest", out],
  { stdout: "inherit", stderr: "inherit" },
);
if ((await enc.exited) !== 0) throw new Error("ffmpeg failed");
await Bun.$`rm -f ${stream}`;
console.log(`\n${out}`);
