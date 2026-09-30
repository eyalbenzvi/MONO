/**
 * Your Receipt, three ways. The receipt: a narrow slip with torn zigzag
 * ends, in the mono, the items at 1x and 0.00 with dot leaders, the total,
 * PAID IN FULL and a Code 128 barcode of the day (lib/custom/draw/code128).
 * The terms: a page in the serif, numbered clauses, two signature lines. The
 * review: five stars (filled for each given), the quote, who wrote it and
 * "Verified partner since", in a hairline frame.
 */
import { INK, arcText, caption, captionLines, circle, f1, line, longDate, rect, text, textWidth, type Family, type Lines } from "../kit";
import { code128Bars } from "../draw/code128";
import { parseDate } from "../specKit";
import { QUOTE_W, TERMS_W, quoteFit, termsFit, type Params } from "../specs/receipt";
import type { CustomSpec } from "../spec";
import { wrap } from "../svg";
import type { BaseColor } from "@/types/shirt";

const SERIF = "serif" as const;

/** The caption's lines (ours). */
export function receiptCaption(p: Params): Lines {
  if (p.k === "review") return [`${p.n} out of 5`, `Reviewed by ${p.by}`, p.y ? `Verified partner since ${p.y}` : "Verified partner"];
  const d = p.d ? parseDate(p.d) : null;
  const n = p.x!.length;
  if (p.k === "terms") return [p.h!, `${n} clauses, agreed`, d ? `In effect from ${longDate(...d)}` : "In effect until further notice"];
  return [p.h!, `${n} ${n === 1 ? "item" : "items"} · total 0.00`, d ? longDate(...d) : undefined];
}

const fit = (s: string, w: number, max: number, family: Family = "mono", bold = false) => Math.round(Math.min(max, (max * w) / textWidth(s, max, { family, bold })) * 10) / 10;

/** A torn edge: zigzag teeth along y from x0 to x1, pointing up (-1) or down (1). */
const teeth = (x0: number, x1: number, y: number, dir: number, w = 6, h = 4) => {
  let d = "";
  const n = Math.round(Math.abs(x1 - x0) / w);
  for (let i = 0; i < n; i++) d += `L${f1(x0 + (i + 0.5) * ((x1 - x0) / n))} ${f1(y + dir * h)}L${f1(x0 + (i + 1) * ((x1 - x0) / n))} ${f1(y)}`;
  return d;
};

function slip(p: Params): string {
  const X0 = 78, X1 = 222, T = 22, B = 318;
  const L = X0 + 9, R = X1 - 9, SIZE = 7.2;
  let s = `<path d="M${X0} ${T}${teeth(X0, X1, T, -1)}L${X1} ${B}${teeth(X1, X0, B, 1)}Z" fill="none" stroke="${INK}" stroke-width="1" stroke-linejoin="round"/>`;
  const [y, mo, d] = parseDate(p.d)!;
  const head = p.h!.toUpperCase();
  s += text(150, 46, head, fit(head, R - L, 12, "mono", true), { bold: true });
  s += text(150, 58, "EST. THE DAY WE MET", 6, { spacing: 1 });
  s += text(L, 72, `${String(d).padStart(2, "0")}/${String(mo).padStart(2, "0")}/${y}`, 6.5, { anchor: "start" }) + text(R, 72, "TILL 1 · COVERS 2", 6.5, { anchor: "end" });
  const dash = (at: number) => `<path d="M${L} ${at}H${R}" fill="none" stroke="${INK}" stroke-width=".7" stroke-dasharray="2 2"/>`;
  s += dash(78);
  // The items: 1x, the item, dot leaders, 0.00.
  const cols = Math.floor((R - L) / (0.602 * SIZE));
  let at = 92;
  for (const item of p.x!) {
    const left = `1x ${item.toUpperCase()}`;
    const dots = Math.max(1, cols - left.length - 5);
    s += text(L, at, `${left} ${".".repeat(dots)}`, SIZE, { anchor: "start" }) + text(R, at, "0.00", SIZE, { anchor: "end" });
    at += 12;
  }
  s += dash(at - 4);
  at += 8;
  s += text(L, at, "SUBTOTAL", SIZE, { anchor: "start" }) + text(R, at, "0.00", SIZE, { anchor: "end" });
  s += text(L, at + 14, "TOTAL", 10, { anchor: "start", bold: true }) + text(R, at + 14, "0.00", 10, { anchor: "end", bold: true });
  s += text(150, at + 30, "*** PAID IN FULL ***", 7, { spacing: 0.5 });
  // The barcode of the day, the figures under it, and the small print at the foot.
  const code = `${y}${String(mo).padStart(2, "0")}${String(d).padStart(2, "0")}`;
  const bars = code128Bars(code, 0, 0, 1.3, 26)!;
  const bx = 150 - bars.width / 2;
  s += code128Bars(code, bx, 260, 1.3, 26)!.svg + text(150, 294, code.split("").join(" "), 6.5);
  s += text(150, 306, "NO REFUNDS · NO RETURNS", 6, { spacing: 0.6 });
  return s;
}

function terms(p: Params): string {
  let s = rect(30, 26, 240, 292, 1) + rect(34, 30, 232, 284, 0.4);
  s += text(150, 62, p.h!, fit(p.h!, TERMS_W, 20, SERIF, true), { family: SERIF, bold: true });
  const d = p.d ? parseDate(p.d) : null;
  s += line(90, 72, 210, 72, 0.6) + text(150, 86, d ? `In effect from ${longDate(...d)}` : "In effect until further notice", 8, { family: SERIF });
  const fitted = termsFit(p.x!)!;
  const { size } = fitted;
  const x0 = 150 - TERMS_W / 2;
  let y = 108 + size;
  fitted.fits.forEach((f, i) => {
    s += text(x0, y, `${i + 1}.`, size, { family: SERIF, bold: true, anchor: "start" });
    f.lines.forEach((l, j) => (s += text(x0 + 16, y + j * size * 1.3, l, size, { family: SERIF, anchor: "start" })));
    y += f.lines.length * size * 1.3 + size * 0.9;
  });
  // Signed by both parties.
  s += line(52, 290, 140, 290, 0.6) + line(160, 290, 248, 290, 0.6);
  s += text(96, 300, "The party of the first part", 5.5, { family: SERIF }) + text(204, 300, "The party of the second part", 5.5, { family: SERIF });
  // The seal between them.
  s += circle(150, 258, 17, 1) + circle(150, 258, 14, 0.4) + arcText("SIGNED · SEALED", 150, 258, 10.5, 0, 4.2, true, { family: SERIF, bold: true }) + star(150, 262, 4, true);
  return s;
}

/** A five-pointed star as a path: filled, or outlined. */
function star(cx: number, cy: number, r: number, filled: boolean): string {
  let d = "";
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const rr = i % 2 ? r * 0.42 : r;
    d += `${i ? "L" : "M"}${f1(cx + rr * Math.cos(a))} ${f1(cy + rr * Math.sin(a))}`;
  }
  return filled ? `<path d="${d}Z" fill="${INK}"/>` : `<path d="${d}Z" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>`;
}

function review(p: Params): string {
  let s = rect(30, 30, 240, 286, 1);
  for (let i = 0; i < 5; i++) s += star(90 + i * 30, 66, 12, i < p.n!);
  s += text(150, 92, `${p.n} OUT OF 5`, 7, { spacing: 2 });
  // The breakdown, as a review page shows it: one review, so one row full and four empty.
  for (let k = 5; k >= 1; k--) {
    const y = 102 + (5 - k) * 8;
    s += text(104, y + 5, `${k}`, 6, { anchor: "end" }) + rect(110, y, 80, 5, 0.6);
    if (k === p.n) for (let x = 111.5; x < 190; x += 2.2) s += line(x, y + 0.6, x, y + 4.4, 0.8);
    s += text(196, y + 5, k === p.n ? "100%" : "0%", 6, { anchor: "start" });
  }
  const f = quoteFit(p.q!)!;
  const lead = f.size * 1.3;
  const top = 200 - ((f.lines.length - 1) * lead) / 2;
  f.lines.forEach((l, i) => (s += text(150, top + i * lead, l, f.size, { family: SERIF })));
  const by = `${p.by}`;
  s += text(150, top + f.lines.length * lead + 8, `— ${by}`, fit(`— ${by}`, QUOTE_W, 11, SERIF, true), { family: SERIF, bold: true });
  // Verified, with a tick in a ring.
  const v = p.y ? `Verified partner since ${p.y}` : "Verified partner";
  const w = textWidth(v, 8, { family: SERIF });
  const tx = 150 - (w + 16) / 2;
  s += `<circle cx="${f1(tx + 5)}" cy="276" r="5" fill="none" stroke="${INK}" stroke-width=".8"/><path d="M${f1(tx + 2.6)} 276.2l1.8 1.8l3.2-3.6" fill="none" stroke="${INK}" stroke-width=".9" stroke-linecap="round" stroke-linejoin="round"/>`;
  s += text(tx + 16, 278.8, v, 8, { family: SERIF, anchor: "start" });
  s += text(150, 298, "Was this review helpful?  Yes (1)  No (0)", 6.5, { family: SERIF });
  return s;
}

export function receiptBody(p: Params): string {
  const body = p.k === "terms" ? terms(p) : p.k === "review" ? review(p) : slip(p);
  return body + caption(344, ...captionLines(receiptCaption(p), p.cap));
}

export const captionOf = (spec: CustomSpec) => receiptCaption((spec as { p: Params }).p);

export const render = (spec: CustomSpec, color: BaseColor) => wrap(receiptBody((spec as { p: Params }).p), color);
