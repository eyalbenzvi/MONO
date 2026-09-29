/**
 * Your Number: a number that matters on the catalogue's dial (lib/custom/
 * draw/instruments). The scale ranges itself in 1-2-5 steps so the needle
 * lands between a quarter and three quarters of the arc; the value sits in
 * the dial's window and the label under it. A time (h:mm:ss) can go on a
 * stopwatch instead: seconds round the face, the minute hand, and the hours
 * on a sub-dial.
 */
import { DEG, caption, captionLines, circle, dot, line, rect, text, type Lines } from "../kit";
import { dial } from "../draw/instruments";
import { parseClock, type CustomSpec, type NumberParams } from "../spec";
import { wrap } from "../svg";
import type { BaseColor } from "@/types/shirt";

const CX = 150, CY = 168, R = 104;
const NICE = [1, 2, 5];

/** The smallest 1-2-5 number at or above x (x > 0). */
function niceAbove(x: number): number {
  let p = 10 ** Math.floor(Math.log10(x));
  for (;;) {
    for (const n of NICE) if (n * p >= x - 1e-9) return n * p;
    p *= 10;
  }
}

/** A scale for a value: [min, max], the major step, and minor ticks per major, with the value between 25% and 75% of it. */
export function scaleFor(v: number): { min: number; max: number; step: number; minor: number } {
  const a = Math.abs(v);
  // Zero sits in the middle of a scale either side of it.
  if (a === 0) return { min: -5, max: 5, step: 1, minor: 5 };
  const span = niceAbove(a / 0.75);
  const step = niceAbove(span / 8);
  const [min, max] = v > 0 ? [0, span] : [-span, 0];
  const lead = String(step / 10 ** Math.floor(Math.log10(step)))[0];
  return { min, max, step, minor: lead === "2" ? 4 : 5 };
}

/** A number as a dial label: short (thousands as k), no trailing zeros. */
function label(n: number): string {
  const a = Math.abs(n);
  if (a >= 10000) return `${n / 1000}k`;
  return String(Math.round(n * 1000) / 1000);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** The knurled bezel round the face (a line every 3°), as a real instrument's rim is cut. */
function knurl(): string {
  let s = "";
  for (let k = 0; k < 120; k++) {
    const a = (k / 120) * Math.PI * 2;
    s += line(CX + Math.cos(a) * (R + 16), CY + Math.sin(a) * (R + 16), CX + Math.cos(a) * (R + 22), CY + Math.sin(a) * (R + 22), 0.9);
  }
  return s + circle(CX, CY, R + 23, 1);
}

function valueWindow(value: string, unit: string): string {
  const shown = [value, unit].filter(Boolean).join(" ");
  const size = Math.min(15, 104 / (0.6 * Math.max(4, shown.length)));
  const w = Math.max(56, shown.length * size * 0.62 + 16);
  return rect(CX - w / 2, CY + 34, w, 24, 1.2) + text(CX, CY + 46 + size * 0.36, shown, size, { bold: true });
}

function numberFace(v: number, unit: string): string {
  const s = scaleFor(v);
  const majors = Math.round((s.max - s.min) / s.step);
  const ticks = majors * s.minor;
  return dial({
    from: -135,
    to: 135,
    ticks,
    major: s.minor,
    labels: (i) => label(s.min + (i / s.minor) * s.step),
    needle: (v - s.min) / (s.max - s.min),
    r: R,
    cx: CX,
    cy: CY,
    inner: valueWindow(label(v), unit),
  });
}

function stopwatch(secs: number, shown: string): string {
  const [h, m, sec] = [Math.floor(secs / 3600), Math.floor((secs % 3600) / 60), secs % 60];
  let s = dial({ from: 0, to: 360, ticks: 60, major: 5, labels: (i) => (i < 60 ? String(i || 60) : ""), needle: sec / 60, r: R, cx: CX, cy: CY });
  // The crown and its button, as a stopwatch has them.
  s += rect(CX - 9, CY - R - 40, 18, 12, 1.4) + line(CX, CY - R - 28, CX, CY - R - 23, 1.6);
  // The minute hand (a minute a sixtieth of the face, as the seconds).
  const am = (m / 60) * 360 * DEG - Math.PI / 2;
  s += line(CX, CY, CX + Math.cos(am) * (R * 0.62), CY + Math.sin(am) * (R * 0.62), 3.2);
  // Hours on a sub-dial above the centre (0–12, a turn every twelve).
  const [sx, sy, sr] = [CX, CY - 44, 20];
  s += circle(sx, sy, sr, 1);
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2 - Math.PI / 2;
    s += line(sx + Math.cos(a) * sr, sy + Math.sin(a) * sr, sx + Math.cos(a) * (sr - (k % 3 ? 3 : 6)), sy + Math.sin(a) * (sr - (k % 3 ? 3 : 6)), k % 3 ? 0.6 : 1);
  }
  const ah = ((h % 12) / 12) * Math.PI * 2 - Math.PI / 2;
  s += line(sx, sy, sx + Math.cos(ah) * (sr - 5), sy + Math.sin(ah) * (sr - 5), 1.6) + dot(sx, sy, 1.6) + text(sx, sy + sr + 9, "HOURS", 5, { spacing: 1 });
  return s + valueWindow(shown, "");
}

export function numberBody(p: NumberParams): string {
  const secs = typeof p.v === "string" ? parseClock(p.v) : null;
  let face: string;
  let shown: string;
  if (secs !== null) {
    const [h, m, s] = [Math.floor(secs / 3600), Math.floor((secs % 3600) / 60), secs % 60];
    shown = `${h}:${pad(m)}:${pad(s)}`;
    // On the dial a time reads in hours (the needle at its fraction of an hour past the whole ones).
    face = p.face === "stopwatch" ? stopwatch(secs, shown) : numberFace(Math.round((secs / 3600) * 1000) / 1000, "h").replace(/>[\d.]+ h</, `>${shown}<`);
  } else {
    shown = [label(p.v as number), p.u].filter(Boolean).join(" ");
    face = numberFace(p.v as number, p.u);
  }
  return knurl() + face + caption(338, ...captionLines(numberCaption(p), p.cap));
}

/** The number as its window shows it ("3.4 kg", "1:23:45"). */
function shownOf(p: NumberParams): string {
  const secs = typeof p.v === "string" ? parseClock(p.v) : null;
  if (secs === null) return [label(p.v as number), p.u].filter(Boolean).join(" ");
  const [h, m, s] = [Math.floor(secs / 3600), Math.floor((secs % 3600) / 60), secs % 60];
  return `${h}:${pad(m)}:${pad(s)}`;
}

/** The caption's lines (ours): the label (or the number) and what it's shown on. */
export function numberCaption(p: NumberParams): Lines {
  const shown = shownOf(p);
  return [p.l ?? shown, p.l ? shown : p.face === "stopwatch" ? "Stopwatch" : p.u ? `Dial · ${p.u}` : "Dial"];
}

export const captionOf = (spec: CustomSpec) => numberCaption((spec as { p: NumberParams }).p);

export const render = (spec: CustomSpec, color: BaseColor) => wrap(numberBody((spec as { p: NumberParams }).p), color);
