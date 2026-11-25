/**
 * Renders the home page's hero loop: a silent ~16 s video that plays muted on a loop.
 *
 *   bun loop.ts                # ../docs/public/video/halo-loop.mp4 and halo-loop.jpg (poster)
 *   bun loop.ts --still 4.5 9  # out/loop-4.5.png, out/loop-9.png, for checking a moment
 *
 * loop.html is a pure function of time (window.render(t)); this screenshots every frame in
 * the installed Google Chrome and encodes them with ffmpeg. Everything on screen is real:
 *   - the FixerTools policy, as written in examples/engineering/software-team.halo
 *   - what the runtime's PolicyEngine says to two Code.edit calls under it
 *   - `halo plan` for that file's FixUntilGreen pipeline, run now
 *   - the recorded fixer run's time and cost, and its replay time (site/data/fixer-run.json)
 */
import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "../src/parser/index.ts";
import { PolicyEngine } from "../src/runtime/policies.ts";
import { highlight } from "../site/src/highlight.ts";

const FPS = 30;
const W = 1280, H = 720;
const root = join(import.meta.dir, "..");
const file = "examples/engineering/software-team.halo";
const source = readFileSync(join(root, file), "utf8");

// The policy, exactly as written.
const lines = source.split("\n");
const start = lines.findIndex((l) => l.startsWith("policy FixerTools"));
const policy = lines.slice(start, lines.findIndex((l, i) => i > start && !l.startsWith("  &")));

// What the runtime decides for two edits the fixer could ask for.
const program = parse(source);
const engine = new PolicyEngine(new Map(program.policies.map((p) => [p.name, p])));
const fixer = program.agents.find((a) => a.name === "Fixer")!;
const hooks = { onViolation: () => {} };
function verdict(path: string): { call: string; allowed: boolean; message: string } {
  const call = `Code.edit(path: "${path}")`;
  try {
    engine.checkToolCall(fixer, "Code.edit", "write", { path, old: "", new: "" }, hooks as never);
    return { call, allowed: true, message: "passes FixerTools, so it runs" };
  } catch (e) {
    return { call, allowed: false, message: (e as Error).message };
  }
}
const calls = [verdict("acceptance.test.ts"), verdict("stats.ts")];
if (calls[0]!.allowed || !calls[1]!.allowed) throw new Error(`FixerTools no longer refuses test edits: ${JSON.stringify(calls)}`);

// halo plan, run now. Only the fixer's step and the cost lines are shown.
const plan = Bun.spawnSync(["bun", join(root, "index.ts"), "plan", file, "--pipeline", "FixUntilGreen"], { cwd: root, env: { ...process.env, NO_COLOR: "1" } });
const planText = plan.stdout.toString();
if (plan.exitCode !== 0) throw new Error(`halo plan failed:\n${planText}${plan.stderr}`);
const planLines = planText.split("\n");
const fixStep = planLines.findIndex((l) => /^\s+1\s+Fixer\.fix/.test(l));
const fixEnd = planLines.findIndex((l, i) => i > fixStep && /chooses its own calls/.test(l));
const planShown = [
  `$ halo plan software-team.halo --pipeline FixUntilGreen`,
  planLines[0]!,
  "",
  ...planLines.slice(fixStep, fixEnd + 1),
  "  …",
  ...planLines.filter((l) => /^(Acts on the world without asking|Worst-case model cost):/.test(l)),
];

const run = JSON.parse(readFileSync(join(root, "site/data/fixer-run.json"), "utf8"));
const SCENE = {
  policy: policy.map((l) => highlight(l)),
  // The DenyArgs line that refuses Code.edit, to light up.
  denyLine: policy.findIndex((l) => l.includes('DenyArgs("Code.edit"')),
  calls,
  plan: planShown,
  run: { seconds: (run.durationMs / 1000).toFixed(1), cost: run.cost.toFixed(4), replayMs: run.replayMs },
};

const outDir = join(import.meta.dir, "out");
await Bun.$`mkdir -p ${outDir}`;
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await page.addInitScript((data) => ((window as any).SCENE = data), SCENE);
await page.goto(`file://${import.meta.dir}/loop.html`);
await page.evaluate(() => document.fonts.ready);
const duration: number = await page.evaluate(() => (window as any).DURATION);

const still = process.argv.indexOf("--still");
if (still >= 0) {
  for (const t of process.argv.slice(still + 1).map(Number)) {
    await page.evaluate((t) => (window as any).render(t), t);
    await page.screenshot({ path: join(outDir, `loop-${t}.png`) });
    console.log(join(outDir, `loop-${t}.png`));
  }
  await browser.close();
  process.exit(0);
}

const publicDir = join(root, "docs/public/video");
const mp4 = join(publicDir, "halo-loop.mp4");
const frames = Math.round(duration * FPS);
// H.264, no audio, yuv420p and faststart so it plays inline everywhere and starts before it's all loaded.
const ff = Bun.spawn(
  ["ffmpeg", "-v", "error", "-y", "-f", "image2pipe", "-framerate", String(FPS), "-i", "-", "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-tune", "animation", "-pix_fmt", "yuv420p", "-movflags", "+faststart", mp4],
  { stdin: "pipe" },
);
for (let i = 0; i < frames; i++) {
  await page.evaluate((t) => (window as any).render(t), i / FPS);
  ff.stdin.write(await page.screenshot({ type: "png" }));
  if (i % FPS === 0) process.stdout.write(`\r${(i / FPS).toFixed(0)}s / ${duration}s`);
}
ff.stdin.end();
if ((await ff.exited) !== 0) throw new Error("ffmpeg failed");
// The poster is the refusal, the loop's main moment.
await page.evaluate((t) => (window as any).render(t), (await page.evaluate(() => (window as any).POSTER_AT)) as number);
await page.screenshot({ path: join(publicDir, "halo-loop.jpg"), type: "jpeg", quality: 85 });
await browser.close();
console.log(`\n${mp4}`);
