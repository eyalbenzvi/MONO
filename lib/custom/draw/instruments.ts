/**
 * Instrument faces laid out on their real scales: the round dial (ticks on an
 * arc, labels, a needle) and the slide rule's logarithmic scales. The
 * catalogue sets its needles at fixed readings; a template sets them at a
 * customer's own number.
 */
import { DEG, INK, circle, dot, esc, f1, line, text } from "../kit";

export interface Dial {
  /** Where the scale starts and ends, degrees clockwise from twelve o'clock. */
  from: number;
  to: number;
  /** Divisions of the scale, and every how many a major (labelled) tick falls. */
  ticks: number;
  major: number;
  /** The label at major tick i ("" for none). */
  labels: (i: number) => string;
  /** The needle's reading, as a fraction of the scale (0 at `from`, 1 at `to`). */
  needle: number;
  /** The scale's radius. */
  r?: number;
  /** Anything drawn over the face last (a unit, a maker's name). */
  inner?: string;
  /** Words set round the face, each at a fraction of the scale (a barometer's STORMY to VERY DRY). */
  words?: [number, string][];
  cx?: number;
  cy?: number;
}

/** A round dial: bezel, ticks on an arc, labels, words, the needle and its hub. */
export function dial(o: Dial): string {
  const CX = o.cx ?? 150, CY = o.cy ?? 160, R = o.r ?? 105;
  let s = circle(CX, CY, R + 14, 1.6) + circle(CX, CY, R + 10, 0.6);
  const ang = (t: number) => (o.from + (o.to - o.from) * t - 90) * DEG;
  for (let i = 0; i <= o.ticks; i++) {
    const a = ang(i / o.ticks);
    const major = i % o.major === 0;
    s += line(CX + Math.cos(a) * R, CY + Math.sin(a) * R, CX + Math.cos(a) * (R - (major ? 12 : 6)), CY + Math.sin(a) * (R - (major ? 12 : 6)), major ? 1.6 : 0.7);
    if (major) {
      const lab = o.labels(i);
      if (lab) s += text(CX + Math.cos(a) * (R - 24), CY + Math.sin(a) * (R - 24) + 4, lab, 11, { bold: true });
    }
  }
  for (const [t, w] of o.words ?? []) {
    const a = ang(t);
    s += `<text x="${f1(CX + Math.cos(a) * (R - 42))}" y="${f1(CY + Math.sin(a) * (R - 42))}" fill="${INK}" font-size="6.5" font-family="DejaVu Sans Mono, monospace" text-anchor="middle" letter-spacing="1" transform="rotate(${f1((a / DEG) + 90)} ${f1(CX + Math.cos(a) * (R - 42))} ${f1(CY + Math.sin(a) * (R - 42))})">${esc(w)}</text>`;
  }
  const a = ang(o.needle);
  s += line(CX - Math.cos(a) * 16, CY - Math.sin(a) * 16, CX + Math.cos(a) * (R - 8), CY + Math.sin(a) * (R - 8), 2.2) + circle(CX, CY, 5, 1.4) + dot(CX, CY, 2);
  return s + (o.inner ?? "");
}

/** The needle's fraction for a value on a linear scale from `min` to `max`, held to the scale's ends. */
export const dialFraction = (value: number, min: number, max: number) => Math.min(1, Math.max(0, (value - min) / (max - min)));

export type SlideScale = "A" | "C" | "D" | "CI";

/** Where a number falls on each scale, as a fraction of its length: A squares (two decades), C and D one decade, CI reciprocals. */
const POS: Record<SlideScale, (x: number) => number> = {
  A: (x) => Math.log10(x) / 2,
  C: (x) => Math.log10(x),
  D: (x) => Math.log10(x),
  CI: (x) => 1 - Math.log10(x),
};
const DECADE = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8, 9, 10];
const LABELS: Record<SlideScale, number[]> = { A: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100], C: DECADE, D: DECADE, CI: DECADE };

/** One slide-rule scale standing upright at x, 1 at the top (y0) and `len` long: each mark at the logarithm of its number. */
export function slideScale(name: SlideScale, x: number, y0: number, len: number): string {
  const pos = POS[name], labels = LABELS[name];
  let s = line(x, y0, x, y0 + len, 1.2) + text(x, y0 - 8, name, 8, { bold: true });
  const top = name === "A" ? 100 : 10;
  // Ticks in whole hundredths, so labels stay exact.
  for (let h = 100; h <= top * 100; h += h < (name === "A" ? 1000 : 200) ? (name === "A" ? 50 : 5) : name === "A" ? 500 : 10) {
    const v = h / 100;
    const t = pos(v);
    const y = y0 + t * len;
    const major = labels.some((l) => Math.abs(l - v) < 1e-6);
    s += line(x, y, x - (major ? 9 : 4), y, major ? 1 : 0.5);
    if (major) s += text(x + 4, y + 2.2, String(v), 5.5, { anchor: "start" });
  }
  return s;
}

/**
 * The A, C, D and CI scales side by side (as the catalogue's print sets
 * them), with, when `mark` is given, the cursor's hairline across them at that
 * number on the D scale (1 to 10).
 */
export function slideRule(o: { y0?: number; len?: number; xs?: [number, number, number, number]; mark?: number } = {}): string {
  const y0 = o.y0 ?? 36, len = o.len ?? 256, xs = o.xs ?? [60, 120, 180, 240];
  const names: SlideScale[] = ["A", "C", "D", "CI"];
  let s = names.map((n, i) => slideScale(n, xs[i], y0, len)).join("");
  if (o.mark !== undefined && o.mark >= 1 && o.mark <= 10) {
    const y = y0 + POS.D(o.mark) * len;
    s += line(xs[0] - 16, y, xs[3] + 16, y, 0.6);
  }
  return s;
}
