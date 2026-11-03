/**
 * The soundtrack, synthesized from the scene's cues (window.AUDIO_EVENTS) so
 * every sound lands on its frame: a tense drone under the glue code, a hit on
 * the logo, a 100 BPM groove after it, and sound effects for typing, the
 * approval and the policy block. Returns a 48 kHz stereo 16-bit WAV.
 */

export type Cue = { t: number; type: string; soft?: boolean; pitch?: number };
export type Sections = { hookEnd: number; logo: number; run: number; block: number; outro: number; end: number };

const SR = 48000;
const TAU = Math.PI * 2;
const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);

// Deterministic noise, so a re-render sounds the same.
let seed = 1;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;

export function renderAudio(cues: Cue[], sec: Sections): Uint8Array {
  const N = Math.ceil(sec.end * SR);
  const music = new Float32Array(N); // ducked under the block
  const fx = new Float32Array(N);
  const send = new Float32Array(N); // to the reverb
  const at = (t: number) => Math.floor(t * SR);

  // A voice: f(phase-time, env) summed into buffers with gain.
  function voice(t0: number, dur: number, gen: (x: number, i: number) => number, out: Float32Array, gain: number, wet = 0) {
    const s = at(t0), n = Math.min(N - s, Math.ceil(dur * SR));
    for (let i = 0; i < n; i++) {
      if (s + i < 0) continue;
      const v = gen(i / SR, i) * gain;
      out[s + i] += v;
      if (wet) send[s + i] += v * wet;
    }
  }
  const env = (x: number, a: number, d: number) => (x < a ? x / a : Math.exp(-(x - a) / d));
  const pad = (x: number, a: number, len: number, r: number) => (x < a ? x / a : x < len ? 1 : Math.max(0, 1 - (x - len) / r));
  // Additive saw with soft top, two detuned voices.
  const warm = (f: number, x: number) => {
    let v = 0;
    for (let h = 1; h <= 6; h++) v += (Math.sin(TAU * f * h * x) + Math.sin(TAU * f * 1.004 * h * x + h)) / h ** 1.6;
    return v * 0.5;
  };

  // ---- hook: drone, ticking, riser ----
  voice(0, sec.hookEnd, (x) => {
    const swell = Math.min(1, x / 2) * (1 - Math.max(0, (x - (sec.hookEnd - 0.25)) / 0.25));
    return (Math.sin(TAU * 55 * x) * 0.7 + Math.sin(TAU * 82.41 * x + Math.sin(TAU * 0.3 * x)) * 0.4 + warm(110, x) * 0.12 * Math.min(1, x / 5)) * swell;
  }, music, 0.32, 0.2);
  // ticks speed up with the scroll
  for (let t = 0.4, gap = 0.3; t < 4.3; t += gap, gap = Math.max(0.09, gap * 0.94)) {
    voice(t, 0.03, (x) => rand() * env(x, 0.001, 0.006), fx, 0.18);
  }
  // riser into the logo
  const riseFrom = sec.hookEnd - 1.6;
  voice(riseFrom, 1.55, (x) => {
    const p = x / 1.55;
    return (rand() * 0.5 * p * p + Math.sin(TAU * (200 + 900 * p * p) * x) * 0.15 * p) * (p < 0.97 ? 1 : (1 - p) / 0.03);
  }, fx, 0.35, 0.3);

  // ---- groove: 100 BPM from the logo ----
  const beat = 0.6, bar = beat * 4, chordLen = bar * 2;
  const CHORDS = [
    [57, 60, 64, 67], // Am7
    [53, 57, 60, 64], // Fmaj7
    [48, 55, 59, 64], // Cmaj7
    [55, 59, 62, 64], // G6
  ];
  const ROOTS = [45, 41, 48, 43];
  const g0 = sec.logo;
  for (let k = 0, t = g0; t < sec.end; k++, t += chordLen) {
    const chord = CHORDS[k % 4];
    const last = t + chordLen >= sec.outro;
    const len = last ? sec.end - t : chordLen;
    for (const n of chord) voice(t, len + 1.2, (x) => warm(midi(n - 12), x) * pad(x, 0.5, len, 1.2) * (last ? Math.max(0, 1 - (x - (sec.end - t - 3)) / 3) : 1), music, 0.05, 0.5);
    if (last) break;
  }
  // bass, drums and arp run from the code scene until the outro
  const drumsFrom = sec.logo + 3.2, drumsTo = sec.outro;
  for (let t = drumsFrom, i = 0; t < drumsTo - 0.01; t += beat / 2, i++) {
    const k = Math.floor((t - g0) / chordLen) % 4;
    const f = midi(ROOTS[k] - 12);
    voice(t, 0.28, (x) => (Math.sin(TAU * f * x) + 0.3 * Math.sin(TAU * 2 * f * x)) * env(x, 0.005, 0.12), music, 0.22);
    if (i % 2 === 0) voice(t, 0.3, (x) => Math.sin(TAU * (45 + 90 * Math.exp(-x * 30)) * x) * env(x, 0.002, 0.11), music, 0.55);
    else if (t >= sec.run) {
      let hp = 0, prev = 0;
      voice(t, 0.06, (x) => { const r = rand(); hp = 0.6 * (hp + r - prev); prev = r; return hp * env(x, 0.001, 0.018); }, music, 0.14);
    }
  }
  // a plucked arpeggio through the run
  for (let t = sec.run, i = 0; t < sec.outro - 6.6; t += beat / 2, i++) {
    const k = Math.floor((t - g0) / chordLen) % 4;
    const n = CHORDS[k][[0, 2, 1, 3, 2, 1, 3, 2][i % 8]] + 12;
    voice(t, 0.5, (x) => (Math.sin(TAU * midi(n) * x) + 0.25 * Math.sin(TAU * 2 * midi(n) * x)) * env(x, 0.003, 0.16), music, 0.05, 0.6);
  }

  // ---- logo hit ----
  voice(sec.logo, 1.6, (x) => Math.sin(TAU * (32 + 70 * Math.exp(-x * 8)) * x) * env(x, 0.003, 0.5), fx, 0.9);
  voice(sec.logo, 0.5, (x) => rand() * env(x, 0.001, 0.08), fx, 0.25, 0.6);
  for (const n of [69, 72, 76, 79, 83]) voice(sec.logo, 3.5, (x) => Math.sin(TAU * midi(n) * x) * env(x, 0.004, 1.0), fx, 0.05, 0.9);

  // ---- sound effects from the cues ----
  const blipNotes = [76, 79, 81, 83, 86, 88];
  for (const c of cues) {
    switch (c.type) {
      case "key": {
        const g = (c.soft ? 0.05 : 0.11) * (0.7 + 0.3 * Math.abs(rand()));
        let lp = 0;
        voice(c.t, 0.03, (x) => { lp += 0.5 * (rand() - lp); return (rand() - lp) * env(x, 0.0005, 0.004); }, fx, g);
        break;
      }
      case "enter":
        voice(c.t, 0.06, (x) => (rand() * 0.6 + Math.sin(TAU * 180 * x)) * env(x, 0.001, 0.012), fx, 0.16);
        break;
      case "whoosh": {
        let lp = 0;
        voice(c.t - 0.2, 0.7, (x) => { const p = x / 0.7; lp += (0.02 + 0.25 * Math.sin(Math.PI * p)) * (rand() - lp); return lp * Math.sin(Math.PI * p) ** 2; }, fx, 0.5, 0.3);
        break;
      }
      case "blip": {
        const f = midi(blipNotes[(c.pitch ?? 2) % blipNotes.length]);
        voice(c.t, 0.4, (x) => Math.sin(TAU * f * x) * env(x, 0.002, 0.07), fx, 0.07, 0.5);
        break;
      }
      case "tag":
        voice(c.t, 0.3, (x) => Math.sin(TAU * (x < 0.07 ? midi(64) : midi(60)) * x) * env(x, 0.002, 0.09) * (1 + 0.5 * Math.sign(Math.sin(TAU * 260 * x)) * 0.3), fx, 0.09, 0.3);
        break;
      case "drop":
        voice(c.t, 1.2, (x) => Math.sin(TAU * (90 - 40 * x) * x) * env(x, 0.01, 0.4), fx, 0.3, 0.4);
        break;
      case "pause":
        voice(c.t, 0.25, (x) => Math.sin(TAU * midi(79) * x) * env(x, 0.003, 0.08), fx, 0.07, 0.5);
        voice(c.t + 0.14, 0.4, (x) => Math.sin(TAU * midi(74) * x) * env(x, 0.003, 0.12), fx, 0.07, 0.5);
        break;
      case "chime":
        for (const [n, d] of [[76, 0], [83, 0.07], [88, 0.14]] as const)
          voice(c.t + d, 1.8, (x) => (Math.sin(TAU * midi(n) * x) + 0.2 * Math.sin(TAU * midi(n) * 2.76 * x) * Math.exp(-x * 6)) * env(x, 0.002, 0.45), fx, 0.09, 0.7);
        break;
      case "done":
        for (const [n, d] of [[72, 0], [76, 0.08], [79, 0.16], [84, 0.24]] as const)
          voice(c.t + d, 0.8, (x) => Math.sin(TAU * midi(n) * x) * env(x, 0.003, 0.2), fx, 0.06, 0.6);
        break;
      case "block":
        voice(c.t, 0.9, (x) => Math.sin(TAU * (40 + 60 * Math.exp(-x * 12)) * x) * env(x, 0.002, 0.25), fx, 0.8);
        voice(c.t, 0.45, (x) => (Math.sign(Math.sin(TAU * 110 * x)) + Math.sign(Math.sin(TAU * 116.5 * x))) * 0.5 * env(x, 0.003, 0.14), fx, 0.09, 0.3);
        // duck the music under it
        for (let i = at(c.t), n = at(c.t + 1.6); i < n && i < N; i++) {
          const x = (i - at(c.t)) / SR;
          music[i] *= x < 0.05 ? 1 - 0.75 * (x / 0.05) : 0.25 + 0.75 * Math.min(1, (x - 0.05) / 1.55);
        }
        break;
      case "hit":
        break; // the logo hit is above
    }
  }

  // ---- reverb (Schroeder): four combs, two allpasses ----
  const wetL = new Float32Array(N), wetR = new Float32Array(N);
  const reverb = (out: Float32Array, spread: number) => {
    const combs = [1557, 1617, 1491, 1422].map((d) => ({ buf: new Float32Array(d + spread), i: 0 }));
    const aps = [225, 556].map((d) => ({ buf: new Float32Array(d + spread), i: 0 }));
    for (let n = 0; n < N; n++) {
      let s = 0;
      for (const c of combs) { const y = c.buf[c.i]; c.buf[c.i] = send[n] * 0.5 + y * 0.84; c.i = (c.i + 1) % c.buf.length; s += y; }
      for (const a of aps) { const y = a.buf[a.i]; const v = s + y * 0.5; a.buf[a.i] = v; a.i = (a.i + 1) % a.buf.length; s = y - v * 0.5; }
      out[n] = s * 0.3;
    }
  };
  reverb(wetL, 0);
  reverb(wetR, 23);

  // ---- mix, soft clip, normalize, fade the very end ----
  const L = new Float32Array(N), R = new Float32Array(N);
  let peak = 0;
  for (let n = 0; n < N; n++) {
    const dry = music[n] + fx[n];
    const fade = Math.min(1, (N - n) / (SR * 0.5));
    L[n] = Math.tanh((dry + wetL[n]) * 1.3) * fade;
    R[n] = Math.tanh((dry + wetR[n]) * 1.3) * fade;
    peak = Math.max(peak, Math.abs(L[n]), Math.abs(R[n]));
  }
  const norm = 0.89 / (peak || 1);

  const data = new DataView(new ArrayBuffer(44 + N * 4));
  const str = (o: number, s: string) => [...s].forEach((ch, i) => data.setUint8(o + i, ch.charCodeAt(0)));
  str(0, "RIFF"); data.setUint32(4, 36 + N * 4, true); str(8, "WAVE");
  str(12, "fmt "); data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, 2, true);
  data.setUint32(24, SR, true); data.setUint32(28, SR * 4, true); data.setUint16(32, 4, true); data.setUint16(34, 16, true);
  str(36, "data"); data.setUint32(40, N * 4, true);
  for (let n = 0; n < N; n++) {
    data.setInt16(44 + n * 4, Math.round(L[n] * norm * 32767), true);
    data.setInt16(46 + n * 4, Math.round(R[n] * norm * 32767), true);
  }
  return new Uint8Array(data.buffer);
}
