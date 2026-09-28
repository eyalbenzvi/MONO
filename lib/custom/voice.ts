/**
 * Your Voice: three seconds of sound reduced to the four numbers a
 * harmonograph needs, on the device. The samples are dropped as soon as the
 * numbers exist; only these are kept (in the spec, the bag line and a
 * shared link).
 *
 * - f: the fundamental (YIN, de Cheveigné & Kawahara 2002), the median over
 *   voiced frames, in Hz;
 * - a:b: the harmonic numbers of the two strongest partials, reduced to the
 *   nearest simple fraction with both terms at most 7 (a pure tone, with no
 *   second partial to speak of, takes the octave, 2:1);
 * - d: how fast the loudness fades, as the pendulums' damping;
 * - ph: where in its cycle the voice began, as the second pendulum's phase.
 */

export interface VoiceNumbers {
  f: number;
  a: number;
  b: number;
  d: number;
  ph: number;
}

const FRAME = 2048;
const HOP = 512;
/** YIN's threshold on the cumulative mean normalised difference: under it, a period. */
const YIN_THRESHOLD = 0.15;
const F_MIN = 60;
const F_MAX = 1000;
/** Voiced for at least this long, or it didn't catch a note. */
const MIN_VOICED_S = 0.3;

/** The period of one frame (samples, sub-sample by parabola), or null when it has none (noise, silence). */
function yin(x: Float32Array, start: number, sr: number): number | null {
  const tauMin = Math.floor(sr / F_MAX);
  const tauMax = Math.min(Math.ceil(sr / F_MIN), FRAME / 2);
  const d = new Float32Array(tauMax + 1);
  for (let tau = 1; tau <= tauMax; tau++) {
    let sum = 0;
    for (let i = 0; i < FRAME / 2; i++) {
      const diff = x[start + i] - x[start + i + tau];
      sum += diff * diff;
    }
    d[tau] = sum;
  }
  let running = 0;
  for (let tau = 1; tau <= tauMax; tau++) {
    running += d[tau];
    const cmnd = running ? (d[tau] * tau) / running : 1;
    d[tau] = cmnd;
  }
  for (let tau = tauMin; tau < tauMax; tau++) {
    if (d[tau] >= YIN_THRESHOLD) continue;
    while (tau + 1 < tauMax && d[tau + 1] < d[tau]) tau++;
    const [a, b, c] = [d[tau - 1], d[tau], d[tau + 1]];
    const shift = (a - c) / (2 * (a - 2 * b + c) || 1);
    return tau + (Math.abs(shift) < 1 ? shift : 0);
  }
  return null;
}

/** Magnitude of one frequency across the samples (Goertzel). */
function goertzel(x: Float32Array, from: number, to: number, freq: number, sr: number): number {
  const w = (2 * Math.PI * freq) / sr;
  const coeff = 2 * Math.cos(w);
  let [s1, s2] = [0, 0];
  for (let i = from; i < to; i++) {
    const s0 = x[i] + coeff * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  return Math.sqrt(Math.max(0, s1 * s1 + s2 * s2 - coeff * s1 * s2)) / (to - from);
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

/** The nearest fraction p:q with p, q ≤ 7 to a ratio ≥ 1. */
export function simpleRatio(r: number): [number, number] {
  let best: [number, number] = [1, 1];
  let err = Infinity;
  for (let q = 1; q <= 7; q++)
    for (let p = q; p <= 7; p++) {
      if (gcd(p, q) !== 1) continue;
      const e = Math.abs(p / q - r);
      if (e < err - 1e-9) (err = e), (best = [p, q]);
    }
  return best;
}

const median = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

/** The numbers from a recording (mono samples, −1…1), or null when no note was caught. */
export function analyseVoice(x: Float32Array, sr: number): VoiceNumbers | null {
  if (x.length < FRAME * 2) return null;
  const frames: { start: number; rms: number; period: number | null }[] = [];
  let peak = 0;
  for (let start = 0; start + FRAME < x.length; start += HOP) {
    let e = 0;
    for (let i = start; i < start + FRAME; i++) e += x[i] * x[i];
    const rms = Math.sqrt(e / FRAME);
    peak = Math.max(peak, rms);
    frames.push({ start, rms, period: null });
  }
  if (peak < 0.005) return null;
  for (const fr of frames) if (fr.rms > peak * 0.1) fr.period = yin(x, fr.start, sr);
  const voiced = frames.filter((fr) => fr.period !== null);
  if ((voiced.length * HOP) / sr < MIN_VOICED_S) return null;
  const f0 = sr / median(voiced.map((fr) => fr.period!));
  if (!(f0 >= F_MIN && f0 <= F_MAX)) return null;

  // The partials over the voiced stretch: the two strongest harmonics give the ratio.
  const from = voiced[0].start;
  const to = Math.min(x.length, voiced[voiced.length - 1].start + FRAME);
  const mags: { k: number; m: number }[] = [];
  for (let k = 1; k <= 8 && k * f0 < sr / 2; k++) mags.push({ k, m: goertzel(x, from, to, k * f0, sr) });
  mags.sort((p, q) => q.m - p.m);
  const [first, second] = mags;
  let [a, b]: [number, number] = [2, 1];
  if (second && second.m > first.m * 0.08) {
    const [hi, lo] = first.k > second.k ? [first.k, second.k] : [second.k, first.k];
    [a, b] = simpleRatio(hi / lo);
  }

  // The fade: the loudness after its peak, as a decay rate (per second), to damping.
  const iPeak = frames.reduce((best, fr, i) => (fr.rms > frames[best].rms ? i : best), 0);
  const tail = frames.slice(iPeak).filter((fr) => fr.rms > peak * 0.02);
  let rate = 0;
  if (tail.length > 3) {
    const t = tail.map((_, i) => (i * HOP) / sr);
    const y = tail.map((fr) => Math.log(fr.rms));
    const mt = t.reduce((s, v) => s + v, 0) / t.length;
    const my = y.reduce((s, v) => s + v, 0) / y.length;
    let [num, den] = [0, 0];
    for (let i = 0; i < t.length; i++) (num += (t[i] - mt) * (y[i] - my)), (den += (t[i] - mt) ** 2);
    rate = den ? Math.max(0, -num / den) : 0;
  }
  const d = Math.round(Math.min(0.03, Math.max(0.003, 0.004 + 0.004 * rate)) * 1e4) / 1e4;
  // The phase at the onset: where in the fundamental's cycle the first voiced frame begins.
  const ph = Math.round(((2 * Math.PI * f0 * (voiced[0].start / sr)) % (2 * Math.PI)) * 100) / 100;
  return { f: Math.round(f0), a, b, d, ph: Math.min(ph, 6.28) };
}
