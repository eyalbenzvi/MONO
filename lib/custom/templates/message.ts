/**
 * Your First Message: chat bubbles in the serif. A hairline frame, who it's
 * with at the top, the day on a divider, their messages on the left in open
 * bubbles and yours on the right in bubbles with a second rule inside, each
 * with its time, and "Read" under the last of yours.
 */
import { INK, STROKE, caption, captionLines, clip, f1, fitSize, fitText, line, longDate, rect, text, textWidth, type Lines, house } from "../kit";
import { parseDate } from "../specKit";
import { BUBBLE_W, THREAD_H, threadFit, type Params } from "../specs/message";
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
  return `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${inset ? STROKE.hairline : STROKE.regular}" stroke-linejoin="round"/>`;
}

/**
 * The thread as set: in Playfair Display when a short thread fits at its display sizes (17 down to 14), by the
 * spec's measure of the thread's height; else in the reading serif at the size the spec fitted.
 */
function threadSet(m: Params["m"]) {
  for (let size = 17; size >= 14; size -= 0.5) {
    const fits = m.map(([, t]) => fitText(t, BUBBLE_W, { size, floor: size, maxLines: 4, family: "display" }));
    if (fits.some((f) => !f)) continue;
    const h = fits.reduce((a, f) => a + f!.lines.length * size * 1.25 + size * 2.35, 0);
    if (h <= THREAD_H) return { face: "display" as const, size, fits: fits.map((f) => f!) };
  }
  return { face: SERIF, ...threadFit(m)! };
}

export function messageBody(p: Params): string {
  let s = rect(30, 26, 240, 292, STROKE.regular);
  // The top, as a phone sets it: who it's with in the grotesk, fitted to the bar, and a rule.
  const who = p.n ?? "Messages";
  const ws = fitSize(who, 196, 14, { family: "grotesk", bold: true, floor: 8 });
  s += text(150, 43 + ws * 0.35, clip(who, 196, ws, { family: "grotesk", bold: true }), ws, { family: "grotesk", bold: true }) + line(30, 60, 270, 60, STROKE.hairline);
  // The day on a divider.
  const d = p.d ? parseDate(p.d) : null;
  const day = d ? longDate(...d).toUpperCase() : "THE FIRST DAY";
  const sp = 0.78;
  const dw = textWidth(day, 6.5, { spacing: sp }) - sp;
  s += line(48, 76, 150 - dw / 2 - 7, 76, STROKE.hairline) + line(150 + dw / 2 + 7, 76, 252, 76, STROKE.hairline) + text(150 + sp / 2, 78.3, day, 6.5, { spacing: sp });

  const fit = threadSet(p.m);
  const { size, face } = fit;
  const lead = size * 1.25;
  const pad = size * 0.55;
  const heights = fit.fits.map((f) => f.lines.length * lead + size * 1.1);
  const total = heights.reduce((a, h) => a + h + size * 1.25, 0);
  let y = 88 + (THREAD_H - total) / 2;
  // The box to write in, at the foot: a rounded field, an arrow beside it.
  s += line(30, 284, 270, 284, STROKE.hairline);
  s += `<path d="M58 292H226Q234 292 234 300Q234 308 226 308H58Q50 308 50 300Q50 292 58 292Z" fill="none" stroke="${INK}" stroke-width="${STROKE.fine}"/>` + text(61, 302.3, "Write a message", 6.5, { anchor: "start" });
  s += `<circle cx="252" cy="300" r="8" fill="none" stroke="${INK}" stroke-width="${STROKE.fine}"/><path d="M252 305V295.5M248 299l4-4 4 4" fill="none" stroke="${INK}" stroke-width="${STROKE.regular}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const lastMine = p.m.map(([side]) => side).lastIndexOf(1);
  p.m.forEach(([side, , time], i) => {
    const f = fit.fits[i];
    const w = Math.max(...f.lines.map((l) => textWidth(l, size, { family: face }))) + pad * 2 + 4;
    const h = heights[i];
    const left = side === 0;
    const x0 = left ? 50 : 250 - w;
    s += bubble(x0, y, w, h, left);
    if (!left) s += bubble(x0, y, w, h, left, 2.6);
    f.lines.forEach((l, j) => (s += text(x0 + pad + 2, y + size * 0.55 + (j + 0.8) * lead, l, size, { family: face, anchor: "start" })));
    const note = i === lastMine ? `${time} · Read` : time;
    s += text(left ? x0 + 2 : x0 + w - 2, y + h + size * 1.05, note, 6, { anchor: left ? "start" : "end" });
    y += h + size * 1.25;
  });
  return s + caption(344, ...captionLines(messageCaption(p), p.cap));
}

export const captionOf = (spec: CustomSpec) => messageCaption((spec as { p: Params }).p);

export const render = (spec: CustomSpec, color: BaseColor) => house(() => wrap(messageBody((spec as { p: Params }).p), color));
