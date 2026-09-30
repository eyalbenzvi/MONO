/**
 * Your First Message: chat bubbles in the serif. A hairline frame, who it's
 * with at the top, the day on a divider, their messages on the left in open
 * bubbles and yours on the right in bubbles with a second rule inside, each
 * with its time, and "Read" under the last of yours.
 */
import { INK, caption, captionLines, f1, line, longDate, rect, text, textWidth, type Lines } from "../kit";
import { parseDate } from "../specKit";
import { THREAD_H, threadFit, type Params } from "../specs/message";
import type { CustomSpec } from "../spec";
import { wrap } from "../svg";
import type { BaseColor } from "@/types/shirt";

const SERIF = "serif" as const;

/** The caption's lines (ours). */
export function messageCaption(p: Params): Lines {
  const d = p.d ? parseDate(p.d) : null;
  const n = p.m.length;
  const mine = [...p.m].reverse().find(([s]) => s === 1);
  return [p.n ? `Messages with ${p.n}` : "The first messages", `${n} ${n === 1 ? "message" : "messages"}${d ? ` · ${longDate(...d)}` : ""}`, mine ? `Read at ${mine[2]}` : undefined];
}

/** A bubble: a rounded box with a small tail at its lower outer corner, as one path. */
function bubble(x0: number, y0: number, w: number, h: number, left: boolean, inset = 0): string {
  const [a, b, c, e] = [x0 + inset, y0 + inset, x0 + w - inset, y0 + h - inset];
  const r = Math.min(9, (e - b) / 2) - inset / 2;
  const t = 5;
  const d = left
    ? `M${f1(a + r)} ${f1(b)}H${f1(c - r)}Q${f1(c)} ${f1(b)} ${f1(c)} ${f1(b + r)}V${f1(e - r)}Q${f1(c)} ${f1(e)} ${f1(c - r)} ${f1(e)}H${f1(a + 6)}L${f1(a - t)} ${f1(e + t * 0.6)}L${f1(a)} ${f1(e - 5)}V${f1(b + r)}Q${f1(a)} ${f1(b)} ${f1(a + r)} ${f1(b)}Z`
    : `M${f1(a + r)} ${f1(b)}H${f1(c - r)}Q${f1(c)} ${f1(b)} ${f1(c)} ${f1(b + r)}V${f1(e - 5)}L${f1(c + t)} ${f1(e + t * 0.6)}L${f1(c - 6)} ${f1(e)}H${f1(a + r)}Q${f1(a)} ${f1(e)} ${f1(a)} ${f1(e - r)}V${f1(b + r)}Q${f1(a)} ${f1(b)} ${f1(a + r)} ${f1(b)}Z`;
  return `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${inset ? 0.45 : 1.1}" stroke-linejoin="round"/>`;
}

export function messageBody(p: Params): string {
  let s = rect(30, 26, 240, 292, 1);
  // The top: who it's with, and a rule.
  const who = p.n ?? "Messages";
  s += text(150, 50, who, 13, { family: SERIF, bold: true }) + line(30, 60, 270, 60, 0.6);
  // The day on a divider.
  const d = p.d ? parseDate(p.d) : null;
  const day = d ? longDate(...d).toUpperCase() : "THE FIRST DAY";
  const dw = textWidth(day, 6.5, { spacing: 1 }) + day.length;
  s += line(48, 76, 150 - dw / 2 - 6, 76, 0.5) + line(150 + dw / 2 + 6, 76, 252, 76, 0.5) + text(150, 78.3, day, 6.5, { spacing: 1 });

  const fit = threadFit(p.m)!;
  const { size } = fit;
  const lead = size * 1.25;
  const pad = size * 0.55;
  const heights = fit.fits.map((f) => f.lines.length * lead + size * 1.1);
  const total = heights.reduce((a, h) => a + h + size * 1.25, 0);
  let y = 88 + (THREAD_H - total) / 2;
  // The box to write in, at the foot: a rounded field, an arrow beside it.
  s += line(30, 284, 270, 284, 0.6);
  s += `<path d="M58 292H226Q234 292 234 300Q234 308 226 308H58Q50 308 50 300Q50 292 58 292Z" fill="none" stroke="${INK}" stroke-width=".9"/>` + text(60, 302.6, "Write a message", 7.5, { family: SERIF, anchor: "start" });
  s += `<circle cx="252" cy="300" r="8" fill="none" stroke="${INK}" stroke-width="1"/><path d="M252 305V295.5M248 299l4-4 4 4" fill="none" stroke="${INK}" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/>`;
  const lastMine = p.m.map(([side]) => side).lastIndexOf(1);
  p.m.forEach(([side, , time], i) => {
    const f = fit.fits[i];
    const w = Math.max(...f.lines.map((l) => textWidth(l, size, { family: SERIF }))) + pad * 2 + 4;
    const h = heights[i];
    const left = side === 0;
    const x0 = left ? 50 : 250 - w;
    s += bubble(x0, y, w, h, left);
    if (!left) s += bubble(x0, y, w, h, left, 2.6);
    f.lines.forEach((l, j) => (s += text(x0 + pad + 2, y + size * 0.55 + (j + 0.8) * lead, l, size, { family: SERIF, anchor: "start" })));
    const note = i === lastMine ? `${time} · Read` : time;
    s += text(left ? x0 + 2 : x0 + w - 2, y + h + size * 1.05, note, 6, { anchor: left ? "start" : "end" });
    y += h + size * 1.25;
  });
  return s + caption(344, ...captionLines(messageCaption(p), p.cap));
}

export const captionOf = (spec: CustomSpec) => messageCaption((spec as { p: Params }).p);

export const render = (spec: CustomSpec, color: BaseColor) => wrap(messageBody((spec as { p: Params }).p), color);
