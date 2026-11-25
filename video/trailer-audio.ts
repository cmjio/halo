/**
 * The trailer's soundtrack, synthesized from trailer.html's cues (window.AUDIO_EVENTS) so every
 * sound lands on its frame. Music: a pad and an accelerating arpeggio while the agent gets out
 * of hand, dead silence on the freeze, a 120 BPM groove from the logo to the montage, and a
 * held chord for the outro. Returns a 48 kHz stereo 16-bit WAV.
 */

export type Cue = { t: number; type: string; [k: string]: unknown };
export type Sections = Record<"wake" | "power" | "freeze" | "land" | "logo" | "rules" | "ask" | "plan" | "replay" | "montage" | "outro" | "end", number>;

const SR = 48000;
const TAU = Math.PI * 2;
const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);
let seed = 7;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;

export function renderTrailerAudio(cues: Cue[], S: Sections): Uint8Array {
  const N = Math.ceil(S.end * SR);
  const music = new Float32Array(N), drums = new Float32Array(N), fx = new Float32Array(N), send = new Float32Array(N);
  const at = (t: number) => Math.floor(t * SR);
  function add(t0: number, dur: number, gen: (x: number) => number, out: Float32Array, gain: number, wet = 0) {
    const s = at(t0), n = Math.min(N - s, Math.ceil(dur * SR));
    for (let i = 0; i < n; i++) {
      if (s + i < 0) continue;
      const v = gen(i / SR) * gain;
      out[s + i] += v;
      if (wet) send[s + i] += v * wet;
    }
  }
  const env = (x: number, a: number, d: number) => (x < a ? x / a : Math.exp(-(x - a) / d));
  const hold = (x: number, a: number, len: number, r: number) => (x < a ? x / a : x < len ? 1 : Math.max(0, 1 - (x - len) / r));
  const warm = (f: number, x: number, harm = 6) => {
    let v = 0;
    for (let h = 1; h <= harm; h++) v += (Math.sin(TAU * f * h * x) + Math.sin(TAU * f * 1.005 * h * x + h)) / h ** 1.5;
    return v * 0.5;
  };
  // a one-pole lowpassed noise source, for whooshes; cutoff follows f(x)
  const whoosh = (cut: (x: number) => number) => { let y = 0, y2 = 0; return (x: number) => { const a = Math.min(0.99, cut(x) / SR * TAU); y += a * (rand() - y); y2 += a * (y - y2); return y2 * 3; }; };
  // a sine whose frequency glides along f(x): integrate the phase
  const glide = (f: (x: number) => number) => { let ph = 0, last = 0; return (x: number) => { ph += TAU * f(x) * (x - last); last = x; return Math.sin(ph); }; };

  // ── music: wake + power ──
  const Am = [45, 52, 57, 60, 64];
  for (const n of Am) add(0.6, S.freeze - 0.6, (x) => warm(midi(n), x, 4) * hold(x, 2.5, S.freeze - 0.6 - 0.05, 0.05), music, 0.035, 0.5);
  // arpeggio, speeding up with the orbit
  { const notes = [69, 72, 76, 79, 81, 79, 76, 72]; let t = S.power + 0.2, k = 0;
    while (t < S.freeze - 0.05) {
      const p = (t - S.power) / (S.freeze - S.power);
      const step = 0.25 * (1 - p * 0.72);
      const n = notes[k % notes.length] + (p > 0.55 ? 12 : 0);
      add(t, 0.25, (x) => (Math.sin(TAU * midi(n) * x) + 0.3 * Math.sin(TAU * midi(n) * 2 * x)) * env(x, 0.003, 0.08 + 0.05 * (1 - p)), music, 0.07 + p * 0.05, 0.35);
      t += step; k++;
    }
  }
  // the riser into the freeze, and a pulse that makes it feel like an alarm
  add(8.4, S.freeze - 8.4, (x) => { const p = x / (S.freeze - 8.4); return rand() * 0.4 * p * p + Math.sin(TAU * (180 + 1200 * p * p) * x) * 0.12 * p; }, fx, 0.4, 0.2);
  for (let t = 8.6; t < S.freeze - 0.1; t += 0.25) add(t, 0.12, (x) => Math.sign(Math.sin(TAU * 220 * x)) * env(x, 0.002, 0.04), music, 0.03);

  // ── groove: logo → outro, 120 BPM (beat 0.5 s, bar 2 s) ──
  const beat = 0.5, g0 = S.logo, g1 = S.outro;
  const prog = [[45, 57, 60, 64], [41, 57, 60, 65], [48, 55, 60, 64], [43, 55, 59, 62]]; // Am F C G
  const quiet = (t: number) => (t > 25.0 && t < 27.7) || (t > 38.35 && t < 39.0); // the nap; the rewind
  for (let bar = 0, t = g0; t < g1 - 0.01; bar++, t += 4 * beat) {
    const ch = prog[bar % 4];
    const len = Math.min(4 * beat, g1 - t);
    for (const n of ch.slice(1)) add(t, len + 0.6, (x) => warm(midi(n), x, 4) * hold(x, 0.2, len, 0.6), music, 0.022, 0.45);
    // bass: eighths with a lift on the last
    for (let e = 0; e < 8; e++) {
      const te = t + e * beat / 2;
      if (te >= g1 || quiet(te)) continue;
      const n = ch[0] - 12 + (e === 7 ? 7 : 0);
      add(te, 0.24, (x) => warm(midi(n), x, 5) * env(x, 0.005, 0.12), music, 0.09);
    }
  }
  for (let b = 0, t = g0; t < g1 - 0.01; b++, t += beat) {
    if (quiet(t)) continue;
    const m = t >= S.montage;
    add(t, 0.4, glide((x) => 45 + 110 * Math.exp(-x * 28)), drums, m ? 0.55 : 0.42);                 // kick
    add(t + beat / 2, 0.06, (x) => (rand() - 0) * env(x, 0.001, 0.018), drums, 0.07);               // offbeat hat
    if (b % 2 === 1) add(t, 0.2, (x) => rand() * env(x, 0.002, 0.07) * (1 + 0.5 * Math.sin(TAU * 190 * x)), drums, 0.16, 0.25); // clap
  }
  // outro: a held, brighter chord
  for (const n of [57, 61, 64, 68, 71]) add(S.outro, S.end - S.outro, (x) => warm(midi(n), x, 4) * hold(x, 1.2, S.end - S.outro - 1.6, 1.4), music, 0.03, 0.6);

  // ── sound effects ──
  const bell = (t: number, n: number, g: number, d = 0.6) => add(t, d * 4, (x) => (Math.sin(TAU * midi(n) * x) + 0.4 * Math.sin(TAU * midi(n) * 2.01 * x) + 0.2 * Math.sin(TAU * midi(n) * 3.98 * x)) * env(x, 0.003, d), fx, g, 0.6);
  for (const c of cues) {
    const t = c.t;
    switch (c.type) {
      case "spark": for (let k = 0; k < 6; k++) bell(t + k * 0.03, 96 + Math.floor(rand() * 8), 0.02, 0.3); break;
      case "pop": {
        const n = 72 + Number(c.pitch ?? 0);
        add(t, 0.16, glide((x) => midi(n) * (0.7 + 0.3 * Math.min(1, x * 40))), fx, c.harsh ? 0.07 : 0.1);
        if (c.harsh) add(t, 0.1, (x) => Math.sign(Math.sin(TAU * midi(n - 12) * x)) * env(x, 0.002, 0.04), fx, 0.04);
        break;
      }
      case "blink": add(t, 0.05, (x) => Math.sin(TAU * 1900 * x) * env(x, 0.002, 0.012), fx, 0.05); break;
      case "look": add(t, 0.2, whoosh((x) => 900 + 2000 * x), fx, 0.05); break;
      case "chirp": {
        const ns = c.happy ? [76, 81, 88] : [79, 86];
        ns.forEach((n, i) => add(t + i * 0.07, 0.14, glide((x) => midi(n) * (0.85 + 0.15 * Math.min(1, x * 30))), fx, 0.07, 0.3));
        break;
      }
      case "thud": add(t, 0.3, glide((x) => 40 + 70 * Math.exp(-x * 30)), fx, 0.3); break;
      case "fall": add(t, 0.42, glide((x) => 2200 * Math.exp(-x * 5) + 250), fx, 0.06, 0.3); break;
      case "boom": {
        const g = c.light ? 0.6 : 1;
        add(t, 2.2, glide((x) => 28 + 60 * Math.exp(-x * 7)), fx, 0.85 * g);
        add(t, 0.8, (x) => rand() * env(x, 0.001, 0.14), fx, 0.3 * g, 0.7);
        for (const n of [81, 85, 88, 93]) bell(t, n, 0.05 * g, 1.2);
        break;
      }
      case "glass": for (let k = 0; k < (c.soft ? 5 : 10); k++) bell(t + rand() * 0.04 + 0.04, 100 + Math.floor(rand() * 10), c.soft ? 0.012 : 0.025, 0.12); add(t, 0.05, (x) => rand() * env(x, 0.001, 0.01), fx, 0.12); break;
      case "rollback": for (let k = 0; k < 10; k++) add(t + k * 0.05, 0.05, (x) => Math.sin(TAU * midi(96 - k * 2) * x) * env(x, 0.002, 0.015), fx, 0.04); break;
      case "hit": for (const n of [57, 64, 69, 72, 76]) add(t, 1.6, (x) => warm(midi(n), x, 5) * env(x, 0.004, 0.5), fx, 0.05, 0.5); break;
      case "whoosh": add(t, c.long ? 0.9 : 0.5, whoosh((x) => (c.long ? 300 + 5000 * (x / 0.9) ** 2 : 600 + 3000 * x)), fx, 0.14, 0.2); break;
      case "key": add(t, 0.03, (x) => (rand() * 0.6 + Math.sin(TAU * 3200 * x)) * env(x, 0.0005, 0.006), fx, c.soft ? 0.03 : 0.045); break;
      case "toss": add(t, 0.32, whoosh((x) => 800 + (c.hard ? 6000 : 3000) * x), fx, c.hard ? 0.16 : 0.1); break;
      case "ding": bell(t, c.high ? 93 : 88, 0.08, 0.5); bell(t + 0.08, c.high ? 100 : 95, 0.05, 0.5); break;
      case "block": {
        add(t, 0.45, (x) => (Math.sign(Math.sin(TAU * 74 * x)) * 0.5 + rand() * 0.3) * env(x, 0.002, 0.14), fx, 0.2, 0.3);
        add(t, 0.5, glide((x) => 50 + 90 * Math.exp(-x * 25)), fx, 0.5);
        break;
      }
      case "stamp": add(t, 0.25, (x) => (Math.sin(TAU * 130 * x) * 0.7 + rand() * 0.5) * env(x, 0.001, 0.05), fx, 0.3, 0.2); break;
      case "ouch": add(t, 0.35, glide((x) => 700 - 380 * Math.min(1, x / 0.3) + 60 * Math.sin(x * 120)), fx, 0.04, 0.2); break;
      case "card": add(t, 0.5, whoosh((x) => 400 + 2400 * x), fx, 0.08, 0.2); break;
      case "yawn": add(t, 0.7, glide((x) => 420 - 170 * (x / 0.7) + 14 * Math.sin(x * 40)), fx, 0.035, 0.4); break;
      case "snore": for (let k = 0; k < 2; k++) { const s = t + k * 1.1; const w = whoosh((x) => 260 + 140 * Math.sin(x * 70)); add(s, 0.9, (x) => w(x) * Math.sin(Math.PI * Math.min(1, x / 0.9)), fx, 0.12); } break;
      case "tick": add(t, 0.02, (x) => Math.sin(TAU * (c.soft ? 2400 : 3000) * x) * env(x, 0.0005, 0.005), fx, 0.05); break;
      case "click": add(t, 0.02, (x) => rand() * env(x, 0.0005, 0.004), fx, 0.2); add(t + 0.09, 0.02, (x) => rand() * env(x, 0.0005, 0.004), fx, 0.14); break;
      case "chime": [84, 88, 91, 96].forEach((n, i) => bell(t + i * 0.06, n, 0.05, 0.5)); break;
      case "boing": add(t, 0.5, glide((x) => 330 + 160 * Math.sin(x * 110) * Math.exp(-x * 6)), fx, 0.06, 0.2); break;
      case "whip": add(t, 0.4, whoosh((x) => 7000 * Math.exp(-x * 7) + 300), fx, 0.2, 0.15); break;
      case "sweep": add(t, 1.25, glide((x) => 220 + 700 * (x / 1.25) ** 1.5), fx, 0.035, 0.3); break;
      case "rewind": add(t, 0.5, (x) => { const f = 900 * (1 - x / 0.5) + 120 + 90 * Math.sin(x * 160); return Math.sign(Math.sin(TAU * f * x)) * 0.4 + rand() * 0.2; }, fx, 0.05, 0.1); break;
      case "zap": add(t, 0.22, glide((x) => 300 + 3500 * (x / 0.22) ** 2), fx, 0.06, 0.3); break;
      case "riser": add(t, S.montage - t, (x) => { const p = x / (S.montage - t); return rand() * 0.5 * p * p + Math.sin(TAU * (200 + 1400 * p * p) * x) * 0.15 * p; }, fx, 0.4, 0.3); break;
      case "slam": {
        const i = Number(c.i ?? 0);
        add(t, 0.9, (x) => rand() * env(x, 0.001, 0.25), fx, 0.12, 0.5); // crash
        add(t, 0.8, glide((x) => 40 + 100 * Math.exp(-x * 22)), fx, 0.6);
        const root = [45, 41, 48, 43, 45, 41][i % 6];
        add(t, 0.7, (x) => warm(midi(root), x, 6) * env(x, 0.003, 0.25), fx, 0.12);
        break;
      }
      case "merge": for (let k = 0; k < 3; k++) add(t, 0.4, glide((x) => midi(70 + k * 5) * (1 - 0.4 * (x / 0.4)) ), fx, 0.04, 0.4); break;
      case "chord": for (const n of [69, 73, 76, 80, 83, 88]) bell(t, n, 0.035, 1.6); break;
      case "wink": add(t, 0.07, glide(() => midi(88)), fx, 0.06); add(t + 0.1, 0.12, glide((x) => midi(83) * (1 - x)), fx, 0.06); break;
    }
  }

  // ── reverb (Schroeder), mix, and the silence on the freeze ──
  const wetL = new Float32Array(N), wetR = new Float32Array(N);
  const reverb = (out: Float32Array, spread: number) => {
    const combs = [1557, 1617, 1491, 1422].map((d) => ({ buf: new Float32Array(d + spread), i: 0 }));
    const aps = [225, 556].map((d) => ({ buf: new Float32Array(d + spread), i: 0 }));
    for (let n = 0; n < N; n++) {
      let s = 0;
      for (const c of combs) { const y = c.buf[c.i]!; c.buf[c.i] = send[n]! * 0.5 + y * 0.85; c.i = (c.i + 1) % c.buf.length; s += y; }
      for (const a of aps) { const y = a.buf[a.i]!; const v = s + y * 0.5; a.buf[a.i] = v; a.i = (a.i + 1) % a.buf.length; s = y - v * 0.5; }
      out[n] = s * 0.28;
    }
  };
  reverb(wetL, 0);
  reverb(wetR, 23);
  const L = new Float32Array(N), R = new Float32Array(N);
  let peak = 0;
  const f0 = at(S.freeze), f1 = at(S.land);
  for (let n = 0; n < N; n++) {
    const silent = n >= f0 && n < f1;
    const m = silent ? 0 : music[n]! + drums[n]!;
    const wet = silent ? 0 : 1;
    const fade = Math.min(1, (N - n) / (SR * 0.6));
    L[n] = Math.tanh((m + fx[n]! + wetL[n]! * wet) * 1.25) * fade;
    R[n] = Math.tanh((m + fx[n]! + wetR[n]! * wet) * 1.25) * fade;
    peak = Math.max(peak, Math.abs(L[n]!), Math.abs(R[n]!));
  }
  const norm = 0.89 / (peak || 1);
  const data = new DataView(new ArrayBuffer(44 + N * 4));
  const str = (o: number, s: string) => [...s].forEach((ch, i) => data.setUint8(o + i, ch.charCodeAt(0)));
  str(0, "RIFF"); data.setUint32(4, 36 + N * 4, true); str(8, "WAVE");
  str(12, "fmt "); data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, 2, true);
  data.setUint32(24, SR, true); data.setUint32(28, SR * 4, true); data.setUint16(32, 4, true); data.setUint16(34, 16, true);
  str(36, "data"); data.setUint32(40, N * 4, true);
  for (let n = 0; n < N; n++) {
    data.setInt16(44 + n * 4, Math.round(L[n]! * norm * 32767), true);
    data.setInt16(46 + n * 4, Math.round(R[n]! * norm * 32767), true);
  }
  return new Uint8Array(data.buffer);
}
