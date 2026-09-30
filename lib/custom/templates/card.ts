/**
 * Your Business Card: a card 85 by 55 centred on the print, in a hairline
 * frame with the printer's crop marks at its corners and the edge of the card
 * under it. Classic: the serif, centred, the company spaced at the top and a
 * rule under the name. Modern: the condensed face, flush left against a
 * vertical rule. Bone: the mono, small and spaced, the contact at the top.
 */
import { DEG, INK, caption, dot, captionLines, f1, line, text, textWidth, type Family, type Lines } from "../kit";
import type { Params } from "../specs/card";
import type { CustomSpec } from "../spec";
import { GROUND, wrap } from "../svg";
import type { BaseColor } from "@/types/shirt";

const W = 250, H = Math.round((W * 55) / 85);
const X0 = 150 - W / 2, Y0 = 176 - H / 2, X1 = X0 + W, Y1 = Y0 + H;

/** The caption's lines (ours). */
export function cardCaption(p: Params): Lines {
  return [p.n, `${p.ti}, ${p.co}`, "Business card, 85 by 55, enlarged"];
}

/** A size that sets a line within a width (capped). */
const fit = (s: string, w: number, max: number, family: Family, bold = false, spacing = 0) =>
  Math.round(Math.min(max, (max * w) / (textWidth(s, max, { family, bold }) + [...s].length * spacing)) * 10) / 10;

/** The printer's crop marks: two short rules off each corner. */
function cropMarks(): string {
  let d = "";
  for (const [x, y, sx, sy] of [[X0, Y0, -1, -1], [X1, Y0, 1, -1], [X0, Y1, -1, 1], [X1, Y1, 1, 1]] as const) d += `M${x} ${y + sy * 6}V${y + sy * 18}M${x + sx * 6} ${y}H${x + sx * 18}`;
  // The proof's notes under the card: the run and the size.
  return `<path d="${d}" fill="none" stroke="${INK}" stroke-width=".6"/>` + text(X0, Y1 + 30, "PROOF · 1 OF 500", 6.5, { anchor: "start", spacing: 1 }) + text(X1, Y1 + 30, "85 × 55 MM · 400 GSM", 6.5, { anchor: "end", spacing: 1 });
}

function classic(p: Params): string {
  const F = "serif" as const;
  const inner = W - 40;
  let s = text(150, Y0 + 30, p.co.toUpperCase(), fit(p.co.toUpperCase(), inner, 8.5, F, false, 2.2), { family: F, spacing: 2.2 });
  s += text(150, Y0 + 74, p.n, fit(p.n, inner, 22, F, true), { family: F, bold: true });
  s += line(126, Y0 + 84, 174, Y0 + 84, 0.6);
  s += text(150, Y0 + 100, p.ti, fit(p.ti, inner, 12, F), { family: F });
  if (p.ct) s += text(150, Y1 - 18, p.ct, fit(p.ct, inner, 9, F), { family: F });
  return s;
}

function modern(p: Params): string {
  const F = "condensed" as const;
  const x = X0 + 30, inner = X1 - 22 - x;
  let s = line(X0 + 20, Y0 + 26, X0 + 20, Y0 + 96, 2.4);
  s += text(x, Y0 + 50, p.n.toUpperCase(), fit(p.n.toUpperCase(), inner, 24, F, true, 0.6), { family: F, bold: true, anchor: "start", spacing: 0.6 });
  s += text(x, Y0 + 70, p.ti, fit(p.ti, inner, 13, F), { family: F, anchor: "start" });
  s += text(x, Y0 + 92, p.co.toUpperCase(), fit(p.co.toUpperCase(), inner, 10, F, true, 1.4), { family: F, bold: true, anchor: "start", spacing: 1.4 });
  if (p.ct) s += line(x, Y1 - 32, X1 - 22, Y1 - 32, 0.5) + text(x, Y1 - 16, p.ct, fit(p.ct, inner, 10, F), { family: F, anchor: "start" });
  return s;
}

function bone(p: Params): string {
  const inner = W - 36;
  let s = "";
  // The contact at the top left, the card's number at the top right, as a numbered run has.
  if (p.ct) s += text(X0 + 18, Y0 + 24, p.ct, fit(p.ct, W - 110, 7, "mono"), { anchor: "start" });
  s += text(X1 - 18, Y0 + 24, "NO. 0001", 7, { anchor: "end", spacing: 1 });
  s += text(150, Y0 + H / 2 + 2, p.n.toUpperCase(), fit(p.n.toUpperCase(), inner, 14, "mono", true, 3), { bold: true, spacing: 3 });
  // Two fine rules round the title, and a row of fine dots over the company.
  s += line(96, Y0 + H / 2 + 8, 204, Y0 + H / 2 + 8, 0.4) + line(96, Y0 + H / 2 + 24, 204, Y0 + H / 2 + 24, 0.4);
  for (let i = 0; i < 31; i++) s += dot(90 + i * 4, Y1 - 30, 0.5);
  s += text(150, Y0 + H / 2 + 18, p.ti.toUpperCase(), fit(p.ti.toUpperCase(), inner, 8, "mono", false, 1.5), { spacing: 1.5 });
  s += text(150, Y1 - 16, p.co.toUpperCase(), fit(p.co.toUpperCase(), inner, 8, "mono", false, 2.5), { spacing: 2.5 });
  return s;
}

/** A card's outline turned about the print's card centre by `deg` and moved by (dx, dy): the stack behind the one on top. */
function turned(deg: number, dx: number, dy: number): string {
  const [c, sn] = [Math.cos(deg * DEG), Math.sin(deg * DEG)];
  const cx = 150, cy = (Y0 + Y1) / 2;
  const at = (x: number, y: number) => `${f1(cx + dx + (x - cx) * c - (y - cy) * sn)} ${f1(cy + dy + (x - cx) * sn + (y - cy) * c)}`;
  return `<path d="M${at(X0, Y0)}L${at(X1, Y0)}L${at(X1, Y1)}L${at(X0, Y1)}Z" fill="none" stroke="${INK}" stroke-width="1.2"/>`;
}

/** An engraved border band just inside the card's edge: two rules and fine diagonals between them. */
function band(inset: number, width: number, pitch: number): string {
  const [a0, b0, a1, b1] = [X0 + inset, Y0 + inset, X1 - inset, Y1 - inset];
  const [c0, d0, c1, d1] = [a0 + width, b0 + width, a1 - width, b1 - width];
  const rules = `<path d="M${f1(a0)} ${f1(b0)}H${f1(a1)}V${f1(b1)}H${f1(a0)}ZM${f1(c0)} ${f1(d0)}H${f1(c1)}V${f1(d1)}H${f1(c0)}Z" fill="none" stroke="${INK}" stroke-width=".8"/>`;
  let d = "";
  // Along the top and bottom, then the sides: each diagonal crosses the band once.
  for (let x = a0; x < a1 - width; x += pitch) d += `M${f1(x)} ${f1(b0)}l${width} ${width}M${f1(x)} ${f1(d1)}l${width} ${width}`;
  for (let y = d0; y < d1 - width; y += pitch) d += `M${f1(a0)} ${f1(y)}l${width} ${width}M${f1(c1)} ${f1(y)}l${width} ${width}`;
  return rules + `<path d="${d}" fill="none" stroke="${INK}" stroke-width=".45"/>`;
}

export function cardBody(p: Params): string {
  // Two more cards under it, turned a little, as a box of them spills; the top card hides what's under it.
  let s = turned(-6, -6, 10) + turned(4, 8, 6);
  s += `<rect x="${X0}" y="${Y0}" width="${W}" height="${H}" fill="${GROUND}" stroke="${INK}" stroke-width="1.5"/>` + cropMarks();
  s += band(6, 5, 3.4);
  s += p.s === "modern" ? modern(p) : p.s === "bone" ? bone(p) : classic(p);
  return s + caption(344, ...captionLines(cardCaption(p), p.cap));
}

export const captionOf = (spec: CustomSpec) => cardCaption((spec as { p: Params }).p);

export const render = (spec: CustomSpec, color: BaseColor) => wrap(cardBody((spec as { p: Params }).p), color);
