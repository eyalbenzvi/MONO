/**
 * Your Business Card: a card 85 by 55 centred on the print, in a hairline
 * frame with the printer's crop marks at its corners and the edge of the card
 * under it. Classic: the serif, centred, the company spaced at the top and a
 * rule under the name. Modern: the condensed face, flush left against a
 * vertical rule. Bone: the mono, small and spaced, the contact at the top.
 */
import { DEG, INK, STROKE, caption, clip, dot, captionLines, f1, fitSize, line, text, type Family, type Lines, house } from "../kit";
import type { Params } from "../specs/card";
import type { CustomSpec } from "../spec";
import { GROUND, wrap } from "../svg";
import type { BaseColor } from "@/types/shirt";

/** The card: 85 by 55 at 2.6 units a millimetre, so it, its crop marks and the stack under it keep inside the live area (x 22–278). */
const W = 221, H = Math.round((W * 55) / 85);
const X0 = Math.round(150 - W / 2), Y0 = Math.round(170 - H / 2), X1 = X0 + W, Y1 = Y0 + H;
/** The card's scale against the 250-unit card the styles were drawn on. */
const K = W / 250;

/** The caption's lines (ours). */
export function cardCaption(p: Params): Lines {
  return [p.n, `${p.ti}, ${p.co}`, "Business card, 85 by 55, enlarged"];
}

/**
 * A line set within a width: its size (at most `max`, tracked `em` of it, never under `floor`), the tracking in
 * units, and the line, cut with an ellipsis if even the floor is too wide.
 */
function fit(s: string, w: number, max: number, family: Family, bold = false, em = 0, floor = 5) {
  const size = fitSize(s, w, max, { family, bold, track: em, floor });
  const spacing = Math.round(size * em * 100) / 100;
  return { size, spacing, line: clip(s, w, size, { family, bold, spacing }) };
}
/** A fitted line drawn at (x, y); a tracked centred line is nudged by half its tracking so it centres on its letters. */
function set(x: number, y: number, f: ReturnType<typeof fit>, family: Family, opts: { bold?: boolean; anchor?: "start" | "middle" | "end" } = {}) {
  const dx = (opts.anchor ?? "middle") === "middle" ? f.spacing / 2 : opts.anchor === "end" ? f.spacing : 0;
  return text(x + dx, y, f.line, f.size, { family, bold: opts.bold, anchor: opts.anchor, spacing: f.spacing || undefined });
}

/** The printer's crop marks: two short rules off each corner. */
function cropMarks(): string {
  let d = "";
  for (const [x, y, sx, sy] of [[X0, Y0, -1, -1], [X1, Y0, 1, -1], [X0, Y1, -1, 1], [X1, Y1, 1, 1]] as const) d += `M${x} ${y + sy * 5}V${y + sy * 15}M${x + sx * 5} ${y}H${x + sx * 15}`;
  // The proof's notes under the card: the run and the size.
  const tag = 6;
  return `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${STROKE.hairline}"/>` + text(X0, Y1 + 30, "PROOF · 1 OF 500", tag, { anchor: "start", spacing: tag * 0.12 }) + text(X1 + tag * 0.12, Y1 + 30, "85 × 55 MM · 400 GSM", tag, { anchor: "end", spacing: tag * 0.12 });
}

/** Classic: the reading serif, centred; the company in tracked capitals over the name in bold, a rule, the title. */
function classic(p: Params): string {
  const F = "serif" as const;
  const inner = W - 44;
  let s = set(150, Y0 + 30 * K, fit(p.co.toUpperCase(), inner, 8, F, false, 0.14), F);
  s += set(150, Y0 + 72 * K, fit(p.n, inner, 22, F, true, 0, 9), F, { bold: true });
  s += line(130, Y0 + 83 * K, 170, Y0 + 83 * K, STROKE.fine);
  s += set(150, Y0 + 99 * K, fit(p.ti, inner, 11.5, F), F);
  if (p.ct) s += set(150, Y1 - 19 * K, fit(p.ct, inner, 8.5, F), F);
  return s;
}

/** Modern: the condensed face flush left against a bold rule; the name in capitals, the company tracked. */
function modern(p: Params): string {
  const F = "condensed" as const;
  const x = X0 + 30 * K, inner = X1 - 20 * K - x;
  let s = line(X0 + 20 * K, Y0 + 27 * K, X0 + 20 * K, Y0 + 95 * K, STROKE.bold);
  s += set(x, Y0 + 50 * K, fit(p.n.toUpperCase(), inner, 24, F, true, 0.03, 9), F, { bold: true, anchor: "start" });
  s += set(x, Y0 + 70 * K, fit(p.ti, inner, 12.5, F), F, { anchor: "start" });
  s += set(x, Y0 + 91 * K, fit(p.co.toUpperCase(), inner, 8.5, F, true, 0.12), F, { bold: true, anchor: "start" });
  if (p.ct) s += line(x, Y1 - 32 * K, X1 - 20 * K, Y1 - 32 * K, STROKE.hairline) + set(x, Y1 - 17 * K, fit(p.ct, inner, 9.5, F), F, { anchor: "start" });
  return s;
}

/** Bone: the house mono, small and spaced, the contact at the top and the card's number, the company at the foot. */
function bone(p: Params): string {
  const F = "plex" as const;
  const inner = W - 40;
  const mid = Y0 + H / 2;
  let s = "";
  // The contact at the top left, the card's number at the top right, as a numbered run has.
  if (p.ct) s += set(X0 + 18, Y0 + 22 * K, fit(p.ct, W - 96, 6.5, F, false, 0, 4.5), F, { anchor: "start" });
  s += set(X1 - 18, Y0 + 22 * K, fit("NO. 0001", 60, 6, F, false, 0.12), F, { anchor: "end" });
  s += set(150, mid + 1, fit(p.n.toUpperCase(), inner, 13, F, true, 0.16, 6), F, { bold: true });
  // Two fine rules round the title, and a row of fine dots over the company.
  s += line(100, mid + 7, 200, mid + 7, STROKE.hairline) + line(100, mid + 22, 200, mid + 22, STROKE.hairline);
  for (let i = 0; i < 27; i++) s += dot(98 + i * 4, Y1 - 28 * K, 0.5);
  s += set(150, mid + 17, fit(p.ti.toUpperCase(), inner, 6.5, F, false, 0.16, 4.5), F);
  s += set(150, Y1 - 15 * K, fit(p.co.toUpperCase(), inner, 7, F, false, 0.2, 4.5), F);
  return s;
}

/** A card's outline turned about the print's card centre by `deg` and moved by (dx, dy): the stack behind the one on top. */
function turned(deg: number, dx: number, dy: number): string {
  const [c, sn] = [Math.cos(deg * DEG), Math.sin(deg * DEG)];
  const cx = 150, cy = (Y0 + Y1) / 2;
  const at = (x: number, y: number) => `${f1(cx + dx + (x - cx) * c - (y - cy) * sn)} ${f1(cy + dy + (x - cx) * sn + (y - cy) * c)}`;
  return `<path d="M${at(X0, Y0)}L${at(X1, Y0)}L${at(X1, Y1)}L${at(X0, Y1)}Z" fill="none" stroke="${INK}" stroke-width="${STROKE.regular}"/>`;
}

/** An engraved border band just inside the card's edge: two rules and fine diagonals between them. */
function band(inset: number, width: number, pitch: number): string {
  const [a0, b0, a1, b1] = [X0 + inset, Y0 + inset, X1 - inset, Y1 - inset];
  const [c0, d0, c1, d1] = [a0 + width, b0 + width, a1 - width, b1 - width];
  const rules = `<path d="M${f1(a0)} ${f1(b0)}H${f1(a1)}V${f1(b1)}H${f1(a0)}ZM${f1(c0)} ${f1(d0)}H${f1(c1)}V${f1(d1)}H${f1(c0)}Z" fill="none" stroke="${INK}" stroke-width="${STROKE.fine}"/>`;
  let d = "";
  // Along the top and bottom, then the sides: each diagonal crosses the band once.
  for (let x = a0; x < a1 - width; x += pitch) d += `M${f1(x)} ${f1(b0)}l${width} ${width}M${f1(x)} ${f1(d1)}l${width} ${width}`;
  for (let y = d0; y < d1 - width; y += pitch) d += `M${f1(a0)} ${f1(y)}l${width} ${width}M${f1(c1)} ${f1(y)}l${width} ${width}`;
  return rules + `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${STROKE.hairline}"/>`;
}

export function cardBody(p: Params): string {
  // Two more cards under it, turned a little, as a box of them spills; the top card hides what's under it.
  let s = turned(-6, -6, 10) + turned(4, 8, 6);
  s += `<rect x="${X0}" y="${Y0}" width="${W}" height="${H}" fill="${GROUND}" stroke="${INK}" stroke-width="${STROKE.bold}"/>` + cropMarks();
  s += band(5, 4.5, 3.4);
  s += p.s === "modern" ? modern(p) : p.s === "bone" ? bone(p) : classic(p);
  return s + caption(344, ...captionLines(cardCaption(p), p.cap));
}

export const captionOf = (spec: CustomSpec) => cardCaption((spec as { p: Params }).p);

export const render = (spec: CustomSpec, color: BaseColor) => house(() => wrap(cardBody((spec as { p: Params }).p), color));
