<script setup lang="ts">
/**
 * halolang.com's home page. Its words are in site/src/home.ts (which also makes /index.md
 * for agents); everything it shows is generated: the example files and what the CLI said
 * about them, a real `halo plan`, and a recorded run of the fixer (site/build.ts).
 */
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import data from "../generated/lite.json";
import { runSteps, type SiteData } from "../../../site/src/render.ts";
import { HOME, answerHtml, haloHtml, inline, outputHtml, planHtml, planSummary, type HomeExample } from "../../../site/src/home.ts";
import { escapeHtml } from "../../../site/src/highlight.ts";

const site = data as unknown as SiteData & { home: { examples: HomeExample[]; plan: { cmd: string; text: string } } };
const h = HOME;
const run = runSteps(site);
const examples = site.home.examples.map((e) => ({ ...e, about: h.examplesAbout[e.file] ?? "", sourceHtml: haloHtml(e.source), outputHtml: outputHtml(e.output) }));
const plan = planHtml(site.home.plan.text);
const planSum = planSummary(site.home.plan.text);
const proofLabel = (label: string) => (label.startsWith("$ ") ? `<span>$</span> ${escapeHtml(label.slice(2))}` : escapeHtml(label));
const resultHtml = (text: string, ok: boolean) => {
  const html = escapeHtml(text);
  return ok ? html : html.replace(/(\d+ pass \d+ fail)$/, '<span class="fail">$1</span>');
};
const pipelineCalls = run.toolCalls - run.modelToolCalls;

// ── Tabs: the active look is a copy of the tab row clipped to the selected tab, so the colour
// travels with the indicator. Keyboard switches are instant: keyboard actions never animate.
type TabSet = { index: number; clip: string; instant: boolean; animate: number };
const tabs = reactive<Record<"os" | "ex", TabSet>>({
  os: { index: 0, clip: "inset(0 100% 0 0 round 7px)", instant: true, animate: 0 },
  ex: { index: 0, clip: "inset(0 100% 0 0 round 7px)", instant: true, animate: 0 },
});
const lists = { os: ref<HTMLElement>(), ex: ref<HTMLElement>() };
const osList = lists.os;
const exList = lists.ex;
function clip(name: "os" | "ex") {
  const list = lists[name].value;
  const tab = list?.children[tabs[name].index] as HTMLElement | undefined;
  if (!list || !tab) return;
  tabs[name].clip = `inset(0 ${list.offsetWidth - tab.offsetLeft - tab.offsetWidth}px 0 ${tab.offsetLeft}px round 7px)`;
}
function select(name: "os" | "ex", i: number, how: "pointer" | "keyboard") {
  const t = tabs[name];
  if (t.index === i) return;
  t.index = i;
  t.instant = how === "keyboard";
  if (how === "pointer") t.animate++;
  clip(name);
  if (how === "keyboard") nextTick(() => (lists[name].value?.children[i] as HTMLElement | undefined)?.focus());
}
function onTabKey(name: "os" | "ex", count: number, ev: KeyboardEvent) {
  const i = tabs[name].index;
  const next = { ArrowRight: (i + 1) % count, ArrowLeft: (i - 1 + count) % count, Home: 0, End: count - 1 }[ev.key];
  if (next === undefined) return;
  ev.preventDefault();
  select(name, next, "keyboard");
}
// A click from the keyboard (Enter/Space) has detail 0: switch without motion.
const onTabClick = (name: "os" | "ex", i: number, ev: MouseEvent) => select(name, i, ev.detail === 0 ? "keyboard" : "pointer");

// ── Copy ──
const copied = reactive<Record<string, boolean>>({});
const announce = ref("");
const timers = new Map<string, ReturnType<typeof setTimeout>>();
async function copy(key: string, text: string) {
  let ok = false;
  try {
    await navigator.clipboard.writeText(text);
    ok = true;
  } catch {
    const ta = Object.assign(document.createElement("textarea"), { value: text, readOnly: true });
    Object.assign(ta.style, { position: "fixed", opacity: "0" });
    document.body.appendChild(ta);
    ta.select();
    try {
      ok = document.execCommand("copy");
    } catch {}
    ta.remove();
  }
  copied[key] = ok;
  announce.value = ok ? "Copied to clipboard" : "Couldn't copy: select the text and copy it instead";
  clearTimeout(timers.get(key));
  timers.set(key, setTimeout(() => ((copied[key] = false), (announce.value = "")), 1600));
}
const installText = computed(() => h.install[tabs.os.index]!.lines.join("\n"));
const startText = h.start.commands.map((c) => c.cmd).join("\n");

// ── Plan highlight ──
const filter = ref<"all" | "read" | "write" | "approval">("all");
const toggleFilter = (f: typeof filter.value) => (filter.value = filter.value === f && f !== "all" ? "all" : f);

// ── The recorded run: plays once at reading pace when it scrolls into view; "halo replay"
// shows it again almost at once, the way a replay feels. Rendered complete, so without
// JavaScript, with reduced motion, or already on screen, nothing is ever hidden.
const runEl = ref<HTMLElement>();
const runState = ref<"done" | "armed" | "playing">("done");
const shown = ref(run.steps.length);
const replayed = ref(false);
const progress = ref(0);
let playTimers: ReturnType<typeof setTimeout>[] = [];
let observer: IntersectionObserver | undefined;
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
function play(gaps: number[]) {
  playTimers.forEach(clearTimeout);
  playTimers = [];
  shown.value = 0;
  progress.value = 0;
  runState.value = "playing";
  let t = 0;
  gaps.forEach((gap, i) => {
    t += gap;
    playTimers.push(setTimeout(() => ((shown.value = i + 1), (progress.value = (i + 1) / gaps.length)), t));
  });
  playTimers.push(setTimeout(() => (runState.value = "done"), t + 300));
}
const readingPace = () => run.steps.map((s, i) => (i === 0 ? 120 : Math.min(900, 260 + JSON.stringify(s).length * 0.6)));
function replay() {
  replayed.value = true;
  if (reduced()) return;
  play(run.steps.map((_, i) => (i === 0 ? 0 : 38)));
}

// The loop plays itself, muted, while it's on screen; with reduced motion it waits for a press of play.
const loopEl = ref<HTMLVideoElement>();
const loopControls = ref(true);
let loopObserver: IntersectionObserver | undefined;

// Until hydration measures the tabs, the selected tab is styled directly.
const ready = ref(false);
let resize: ResizeObserver | undefined;

onMounted(() => {
  clip("os");
  clip("ex");
  document.fonts?.ready.then(() => (clip("os"), clip("ex")));
  resize = new ResizeObserver(() => (clip("os"), clip("ex")));
  for (const l of [lists.os.value, lists.ex.value]) if (l) resize.observe(l);

  const el = runEl.value;
  if (el && !reduced() && "IntersectionObserver" in window && el.getBoundingClientRect().top > innerHeight * 0.75) {
    runState.value = "armed";
    observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        observer?.disconnect();
        play(readingPace());
      },
      { rootMargin: "0px 0px -25% 0px", threshold: 0.1 },
    );
    observer.observe(el);
  }
  ready.value = true;

  const video = loopEl.value;
  if (video && !reduced() && "IntersectionObserver" in window) {
    loopControls.value = false;
    loopObserver = new IntersectionObserver(([e]) => (e?.isIntersecting ? video.play().catch(() => (loopControls.value = true)) : video.pause()), { threshold: 0.25 });
    loopObserver.observe(video);
  }
});
onBeforeUnmount(() => {
  observer?.disconnect();
  loopObserver?.disconnect();
  resize?.disconnect();
  playTimers.forEach(clearTimeout);
  timers.forEach(clearTimeout);
});
</script>

<template>
  <div class="hh" :class="{ ready }">
    <!-- Hero -->
    <section class="hero" aria-labelledby="hh-title">
      <div class="wrap hero-grid">
        <div>
          <h1 id="hh-title">{{ h.title }}</h1>
          <p class="lede">{{ h.lede }}</p>
          <ul class="proof">
            <li v-for="p in h.proof" :key="p.label"><b v-html="proofLabel(p.label)"></b><span v-html="inline(p.text)"></span></li>
          </ul>

          <div class="install" id="install">
            <div class="install-head">
              <div class="tabs">
                <div ref="osList" role="tablist" aria-label="Install for" @keydown="onTabKey('os', h.install.length, $event)">
                  <button
                    v-for="(o, i) in h.install"
                    :key="o.label"
                    class="tab press"
                    role="tab"
                    type="button"
                    :id="`hh-os-${i}`"
                    :aria-controls="`hh-os-p${i}`"
                    :aria-selected="tabs.os.index === i"
                    :tabindex="tabs.os.index === i ? 0 : -1"
                    @click="onTabClick('os', i, $event)"
                  >{{ o.label }}</button>
                </div>
                <div class="tabs-overlay" :class="{ instant: tabs.os.instant }" :style="{ clipPath: tabs.os.clip }" aria-hidden="true">
                  <span v-for="o in h.install" :key="o.label" class="tab">{{ o.label }}</span>
                </div>
              </div>
              <span class="install-label">install</span>
            </div>
            <div class="cmdrow">
              <div class="cmd-stack">
                <pre
                  v-for="(o, i) in h.install"
                  :key="o.label"
                  class="cmd"
                  role="tabpanel"
                  :id="`hh-os-p${i}`"
                  :aria-labelledby="`hh-os-${i}`"
                  :hidden="tabs.os.index !== i"
                ><template v-for="(l, k) in o.lines" :key="k"><span class="p">{{ o.prompt }} </span>{{ l }}<template v-if="k === o.lines.length - 1 && o.comment">   <span class="c"># <span v-html="inline(o.comment)"></span></span></template>{{ k < o.lines.length - 1 ? "\n" : "" }}</template></pre>
              </div>
              <button class="copy press" type="button" :data-copied="copied.install" :data-install-copy="installText" aria-label="Copy install command" @click="copy('install', installText)">
                <svg class="i-copy" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 10a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z" /><path d="M16 8v-2a2 2 0 0 0 -2 -2h-8a2 2 0 0 0 -2 2v8a2 2 0 0 0 2 2h2" /></svg>
                <svg class="i-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg>
              </button>
            </div>
            <div class="install-foot" v-html="inline(h.installNote)"></div>
          </div>

          <div class="ctas">
            <a class="btn btn-primary press" href="/guide/quickstart">Quickstart
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="M13 18l6 -6" /><path d="M13 6l6 6" /></svg></a>
            <a class="btn btn-ghost press" href="/playground">Playground</a>
            <a class="quiet" href="#run">See a recorded run</a>
          </div>
        </div>

        <!-- Examples -->
        <div>
          <div class="card">
            <div class="card-head">
              <div class="tabs tabs-dark">
                <div ref="exList" role="tablist" aria-label="Example files" @keydown="onTabKey('ex', examples.length, $event)">
                  <button
                    v-for="(e, i) in examples"
                    :key="e.file"
                    class="tab press"
                    role="tab"
                    type="button"
                    :id="`hh-ex-${i}`"
                    :aria-controls="`hh-ex-p${i}`"
                    :aria-selected="tabs.ex.index === i"
                    :tabindex="tabs.ex.index === i ? 0 : -1"
                    @click="onTabClick('ex', i, $event)"
                  >{{ e.file.replace(/\.halo$/, "") }}<span class="tab-sub">{{ e.verb }}</span></button>
                </div>
                <div class="tabs-overlay" :class="{ instant: tabs.ex.instant }" :style="{ clipPath: tabs.ex.clip }" aria-hidden="true">
                  <span v-for="e in examples" :key="e.file" class="tab">{{ e.file.replace(/\.halo$/, "") }}<span class="tab-sub">{{ e.verb }}</span></span>
                </div>
              </div>
              <span class="note">real CLI output</span>
            </div>
            <div class="stack">
              <div
                v-for="(e, i) in examples"
                :key="e.file + (tabs.ex.index === i ? tabs.ex.animate : '')"
                class="panel"
                :class="{ enter: tabs.ex.index === i && !tabs.ex.instant }"
                role="tabpanel"
                :id="`hh-ex-p${i}`"
                :aria-labelledby="`hh-ex-${i}`"
                :data-active="tabs.ex.index === i"
                :tabindex="tabs.ex.index === i ? 0 : -1"
              >
                <pre class="src" :aria-label="e.file"><code v-html="e.sourceHtml"></code></pre>
                <pre class="out"><code v-html="e.outputHtml"></code></pre>
              </div>
            </div>
          </div>
          <p class="caption"><span class="about" v-html="inline(examples[tabs.ex.index]!.about)"></span> <span v-html="inline(h.examplesCaption)"></span></p>
        </div>
      </div>
    </section>

    <!-- The words, for someone new to agents -->
    <section class="sec terms-sec" id="terms" aria-labelledby="hh-terms">
      <div class="wrap">
        <p class="kicker">{{ h.terms.kicker }}</p>
        <h2 id="hh-terms">{{ h.terms.title }}</h2>
        <dl class="terms">
          <div v-for="t in h.terms.items" :key="t.term"><dt>{{ t.term }}</dt><dd v-html="inline(t.text)"></dd></div>
        </dl>
      </div>
    </section>

    <!-- What agents can do -->
    <section class="sec" id="can" aria-labelledby="hh-can">
      <div class="wrap">
        <p class="kicker">{{ h.can.kicker }}</p>
        <h2 id="hh-can">{{ h.can.title }}</h2>
        <p class="can-body">{{ h.can.body }}</p>
        <ul class="can">
          <li v-for="c in h.can.items" :key="c.title">
            <a :href="c.link" class="press">
              <code>{{ c.code }}</code>
              <b>{{ c.title }}</b>
              <span>{{ c.text }}</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="M13 18l6 -6" /><path d="M13 6l6 6" /></svg>
            </a>
          </li>
        </ul>
      </div>
    </section>

    <!-- Policy + the recorded run -->
    <section class="sec" id="run" aria-labelledby="hh-run">
      <div class="wrap sec-grid">
        <div class="sticky">
          <p class="kicker">{{ h.run.kicker }}</p>
          <h2 id="hh-run">{{ h.run.title }}</h2>
          <p v-html="inline(h.run.body)"></p>
          <dl class="rules">
            <div v-for="r in h.run.rules" :key="r.name">
              <dt v-html="escapeHtml(r.name).replace(/ \/ /g, ' <span>/</span> ')"></dt>
              <dd>{{ r.text }}</dd>
            </div>
          </dl>
          <a class="more" :href="h.run.more.link">{{ h.run.more.text }}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="M13 18l6 -6" /><path d="M13 6l6 6" /></svg></a>
        </div>

        <div>
          <div ref="runEl" class="run" :data-state="runState" :data-replayed="replayed">
            <div class="run-head">
              <code><span class="o-prompt">$</span>{{ run.command }}</code>
              <div class="run-ctl">
                <span class="run-model">{{ run.model }}</span>
                <button class="btn-sm press" type="button" aria-describedby="hh-replay-desc" @click="replay">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19.95 11a8 8 0 1 0 -.5 4m.5 5v-5h-5" /></svg>
                  halo replay
                </button>
              </div>
            </div>
            <div class="progress" aria-hidden="true"><i :style="{ transform: `scaleX(${runState === 'playing' ? progress : 0})` }"></i></div>
            <ol class="steps" aria-label="A recorded run of the fixer">
              <li v-for="(s, i) in run.steps" :key="s.n" class="step" :class="{ shown: i < shown, pipeline: s.who === 'pipeline' }" :data-n="s.n">
                <div>
                  <div class="who">
                    <template v-if="s.who === 'pipeline'">pipeline → checks for itself</template>
                    <template v-else-if="s.answer !== undefined">model → answer</template>
                    <template v-else>model → {{ s.calls.length }} tool call{{ s.calls.length > 1 ? "s" : "" }}</template>
                  </div>
                  <template v-for="c in s.calls" :key="c.target + c.args">
                    <div class="call"><span class="chip" :class="c.effect">{{ c.effect }}</span><span class="target">{{ c.target }}</span><span class="args">({{ c.args }})</span></div>
                    <div v-if="c.result" class="result" :class="{ ok: c.ok }" v-html="resultHtml(c.result, c.ok)"></div>
                  </template>
                  <div v-if="s.answer !== undefined" class="answer" v-html="answerHtml(s.answer)"></div>
                </div>
              </li>
            </ol>
            <div class="replay-note" aria-live="polite">
              <div><p id="hh-replay-desc"><b>halo replay</b> feeds the recording back with no model or tool calls. This run replays in {{ run.replayMs }} ms, for $0.</p></div>
            </div>
            <div class="run-foot">
              <span>{{ run.seconds }}s · {{ run.modelCalls }} model calls · {{ run.toolCalls }} tool calls<template v-if="pipelineCalls"> ({{ pipelineCalls }} by the pipeline)</template> · ${{ run.cost }}</span>
              <span class="ok">{{ run.tally }}</span>
            </div>
          </div>
          <p class="caption" v-html="inline(h.run.caption)"></p>
        </div>
      </div>
    </section>

    <!-- Plan + replay -->
    <section class="sec" id="plan" aria-labelledby="hh-plan">
      <div class="wrap sec-grid">
        <div class="sticky">
          <p class="kicker">{{ h.plan.kicker }}</p>
          <h2 id="hh-plan">{{ h.plan.title }}</h2>
          <p v-html="inline(h.plan.body)"></p>
          <div class="replay-box">
            <p v-html="inline(h.plan.replay)"></p>
            <a class="more" :href="h.plan.more.link">{{ h.plan.more.text }}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="M13 18l6 -6" /><path d="M13 6l6 6" /></svg></a>
          </div>
        </div>

        <div>
          <div class="card">
            <div class="card-head"><code class="plan-cmd"><span class="o-prompt">$ </span>{{ site.home.plan.cmd }}</code></div>
            <pre class="src plan-out" :data-filter="filter"><code v-html="plan.html"></code></pre>
          </div>
          <div class="plan-tools" role="group" aria-labelledby="hh-plan-lbl">
            <span class="lbl" id="hh-plan-lbl">Highlight</span>
            <div class="seg">
              <button type="button" class="press" :aria-pressed="filter === 'all'" @click="toggleFilter('all')">all</button>
              <button type="button" class="press" :aria-pressed="filter === 'read'" @click="toggleFilter('read')">read <span class="ct">{{ plan.counts.read }}</span></button>
              <button type="button" class="press" :aria-pressed="filter === 'write'" @click="toggleFilter('write')">write <span class="ct">{{ plan.counts.write }}</span></button>
              <button type="button" class="press" :aria-pressed="filter === 'approval'" @click="toggleFilter('approval')">needs approval <span class="ct">{{ plan.counts.approval }}</span></button>
            </div>
          </div>
          <dl class="plan-sum">
            <div><dt>Acts without asking</dt><dd>{{ planSum.acts }}</dd></div>
            <div><dt>Needs a person</dt><dd>{{ planSum.approval }}</dd></div>
            <div><dt>Worst case</dt><dd>{{ planSum.worst }}<small v-if="planSum.limit">{{ planSum.limit }}</small></dd></div>
          </dl>
        </div>
      </div>
    </section>

    <!-- Video -->
    <section class="sec" id="minute" aria-labelledby="hh-min">
      <div class="wrap">
        <p class="kicker">{{ h.minute.kicker }}</p>
        <h2 id="hh-min">{{ h.minute.title }}</h2>
        <p class="minute-body" v-html="inline(h.minute.body)"></p>
        <div class="video-frame">
          <video ref="loopEl" muted loop playsinline preload="metadata" :controls="loopControls" :poster="h.minute.poster" :src="h.minute.video" aria-label="Halo's trailer: a policy refusing a tool call, halo plan, and halo replay"></video>
        </div>
      </div>
    </section>

    <!-- Start -->
    <section class="sec" id="start" aria-labelledby="hh-start">
      <div class="wrap start-grid">
        <div>
          <p class="kicker">{{ h.start.kicker }}</p>
          <h2 id="hh-start">{{ h.start.title }}</h2>
          <p v-html="inline(h.start.body)"></p>
          <div class="first">
            <div class="first-head"><span>terminal</span>
              <button class="copy press" type="button" :data-copied="copied.start" aria-label="Copy the first commands" @click="copy('start', startText)">
                <svg class="i-copy" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 10a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z" /><path d="M16 8v-2a2 2 0 0 0 -2 -2h-8a2 2 0 0 0 -2 2v8a2 2 0 0 0 2 2h2" /></svg>
                <svg class="i-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg>
              </button>
            </div>
            <pre tabindex="0" aria-label="First commands"><template v-for="(c, k) in h.start.commands" :key="c.cmd"><span class="p">$ </span>{{ c.cmd }}<span v-if="c.comment" class="c">   # {{ c.comment }}</span>{{ k < h.start.commands.length - 1 ? "\n" : "" }}</template></pre>
          </div>
          <div class="ctas">
            <a class="btn btn-primary press" href="/guide/quickstart">Open the Quickstart
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="M13 18l6 -6" /><path d="M13 6l6 6" /></svg></a>
          </div>
        </div>
        <div>
          <p class="kicker">where next</p>
          <ul class="next">
            <li v-for="n in h.next" :key="n.link">
              <a :href="n.link"><b>{{ n.text }}</b><span>{{ n.about }}</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6l-6 6" /></svg></a>
            </li>
          </ul>
        </div>
      </div>
    </section>

    <footer class="foot">
      <div class="wrap">
        <code>curl -fsSL https://halolang.com/install.sh | sh</code>
        <nav aria-label="Footer">
          <a href="/guide/quickstart">Quickstart</a>
          <a href="/reference/cli">CLI</a>
          <a href="/examples/">Examples</a>
          <a href="/playground">Playground</a>
          <a href="https://github.com/cmjio/halo">GitHub</a>
        </nav>
      </div>
    </footer>

    <div class="sr" aria-live="polite">{{ announce }}</div>
  </div>
</template>

<style src="./home.css"></style>
