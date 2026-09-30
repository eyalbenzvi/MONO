/**
 * Your Receipt, three ways. The receipt: a narrow slip with torn zigzag
 * ends, in the mono, the items at 1x and 0.00 with dot leaders, the total,
 * PAID IN FULL and a Code 128 barcode of the day (lib/custom/draw/code128).
 * The terms: a page in the serif, numbered clauses, two signature lines. The
 * review: five stars (filled for each given), the quote, who wrote it and
 * "Verified partner since", in a hairline frame.
 */
import { INK, STROKE, caption, captionLines, circle, clip, f1, fitSize, line, longDate, rect, text, textWidth, type Family, type Lines, house } from "../kit";
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

/** A line fitted to a width in its face: the size (at most `max`, never under `floor`) and the line, cut there if it must be. */
const fitLine = (s: string, w: number, max: number, family: Family, bold = false, floor = 5) => {
  const size = fitSize(s, w, max, { family, bold, floor });
  return { size, line: clip(s, w, size, { family, bold }) };
};
const DISPLAY = "display" as const;

/** A torn edge: zigzag teeth along y from x0 to x1, pointing up (-1) or down (1). */
const teeth = (x0: number, x1: number, y: number, dir: number, w = 6, h = 4) => {
  let d = "";
  const n = Math.round(Math.abs(x1 - x0) / w);
  for (let i = 0; i < n; i++) d += `L${f1(x0 + (i + 0.5) * ((x1 - x0) / n))} ${f1(y + dir * h)}L${f1(x0 + (i + 1) * ((x1 - x0) / n))} ${f1(y)}`;
  return d;
};

function slip(p: Params): string {
  const X0 = 78, X1 = 222, SIZE = 7.2;
  const L = X0 + 9, R = X1 - 9;
  // The slip is as long as what it prints, centred on the print (between y 22 and 318).
  const n = p.x!.length;
  const len = 92 + 12 * n + 8 + 46 + 58 - 22;
  const T = Math.round(170 - len / 2), B = T + len, o = T - 22;
  let s = `<path d="M${X0} ${T}${teeth(X0, X1, T, -1)}L${X1} ${B}${teeth(X1, X0, B, 1)}Z" fill="none" stroke="${INK}" stroke-width="${STROKE.fine}" stroke-linejoin="round"/>`;
  const [y, mo, d] = parseDate(p.d)!;
  const head = fitLine(p.h!.toUpperCase(), R - L, 12, "plex", true, 6);
  s += text(150, o + 46, head.line, head.size, { bold: true });
  s += text(150 + 0.36, o + 58, "EST. THE DAY WE MET", 6, { spacing: 0.72 });
  s += text(L, o + 72, `${String(d).padStart(2, "0")}/${String(mo).padStart(2, "0")}/${y}`, 6.5, { anchor: "start" }) + text(R, o + 72, "TILL 1 · COVERS 2", 6.5, { anchor: "end" });
  const dash = (at: number) => `<path d="M${L} ${at}H${R}" fill="none" stroke="${INK}" stroke-width="${STROKE.hairline}" stroke-dasharray="2 2"/>`;
  s += dash(o + 78);
  // The items: 1x, the item, dot leaders, 0.00.
  const cols = Math.floor((R - L) / (0.6 * SIZE));
  let at = o + 92;
  for (const item of p.x!) {
    const left = `1x ${item.toUpperCase()}`;
    const dots = Math.max(1, cols - left.length - 5);
    // An item longer in capitals than its line (ß is SS) is set smaller, clear of the price.
    const size = Math.min(SIZE, Math.floor(((cols - 4) / (left.length + 1 + dots)) * SIZE * 10) / 10);
    s += text(L, at, `${left} ${".".repeat(dots)}`, size, { anchor: "start" }) + text(R, at, "0.00", SIZE, { anchor: "end" });
    at += 12;
  }
  s += dash(at - 4);
  at += 8;
  s += text(L, at, "SUBTOTAL", SIZE, { anchor: "start" }) + text(R, at, "0.00", SIZE, { anchor: "end" });
  s += text(L, at + 14, "TOTAL", 10, { anchor: "start", bold: true }) + text(R, at + 14, "0.00", 10, { anchor: "end", bold: true });
  s += text(150, at + 30, "*** PAID IN FULL ***", 7, { spacing: 0.35 });
  // The barcode of the day, the figures under it, and the small print at the foot.
  const code = `${y}${String(mo).padStart(2, "0")}${String(d).padStart(2, "0")}`;
  const bars = code128Bars(code, 0, 0, 1.3, 26)!;
  const bx = 150 - bars.width / 2, by = at + 46;
  s += code128Bars(code, bx, by, 1.3, 26)!.svg + text(150, by + 34, code.split("").join(" "), 6.5);
  s += text(150 + 0.36, by + 46, "NO REFUNDS · NO RETURNS", 6, { spacing: 0.72 });
  return s;
}

function terms(p: Params): string {
  let s = rect(30, 26, 240, 292, STROKE.regular) + rect(34, 30, 232, 284, STROKE.hairline);
  const h = fitLine(p.h!, TERMS_W, 22, SERIF, true, 9);
  s += text(150, 62, h.line, h.size, { family: SERIF, bold: true });
  const d = p.d ? parseDate(p.d) : null;
  s += line(96, 72, 204, 72, STROKE.fine) + text(150, 86, d ? `In effect from ${longDate(...d)}` : "In effect until further notice", 8, { family: SERIF });
  // The clauses (the spec keeps them within 168 units), centred in the page between the head and the signatures.
  const fitted = termsFit(p.x!)!;
  const { size } = fitted;
  const lines = fitted.fits.reduce((a, f) => a + f.lines.length, 0);
  const total = lines * size * 1.3 + (fitted.fits.length - 1) * size * 0.9;
  const x0 = 150 - TERMS_W / 2;
  let y = 102 + Math.max(0, (174 - total) / 2) + size;
  fitted.fits.forEach((f, i) => {
    s += text(x0, y, `${i + 1}.`, size, { family: SERIF, bold: true, anchor: "start" });
    f.lines.forEach((l, j) => (s += text(x0 + 16, y + j * size * 1.3, l, size, { family: SERIF, anchor: "start" })));
    y += f.lines.length * size * 1.3 + size * 0.9;
  });
  // Signed by both parties, the seal between them.
  s += line(50, 294, 128, 294, STROKE.hairline) + line(172, 294, 250, 294, STROKE.hairline);
  s += text(89, 303, "The party of the first part", 5.5, { family: SERIF }) + text(211, 303, "The party of the second part", 5.5, { family: SERIF });
  s += circle(150, 294, 12, STROKE.regular) + circle(150, 294, 9.5, STROKE.hairline) + star(150, 294.6, 5.5, true);
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
  return filled ? `<path d="${d}Z" fill="${INK}"/>` : `<path d="${d}Z" fill="none" stroke="${INK}" stroke-width="${STROKE.bold}" stroke-linejoin="round"/>`;
}

function review(p: Params): string {
  let s = rect(30, 30, 240, 286, STROKE.regular);
  for (let i = 0; i < 5; i++) s += star(90 + i * 30, 66, 12, i < p.n!);
  s += text(150 + 0.42, 92, `${p.n} OUT OF 5`, 7, { spacing: 0.84 });
  // The breakdown, as a review page shows it: one review, so one row full and four empty.
  for (let k = 5; k >= 1; k--) {
    const y = 102 + (5 - k) * 8;
    s += text(104, y + 5, `${k}`, 6, { anchor: "end" }) + rect(110, y, 80, 5, STROKE.hairline);
    if (k === p.n) for (let x = 111.5; x < 190; x += 2.2) s += line(x, y + 0.6, x, y + 4.4, STROKE.fine);
    s += text(196, y + 5, k === p.n ? "100%" : "0%", 6, { anchor: "start" });
  }
  // The quote: in Playfair when the spec's fit sets it at a display size (the face is narrower, so its lines hold), else the reading serif.
  const f = quoteFit(p.q!)!;
  const face = f.size >= 14 ? DISPLAY : SERIF;
  const lead = f.size * (face === DISPLAY ? 1.22 : 1.3);
  const top = 196 - ((f.lines.length - 1) * lead) / 2;
  f.lines.forEach((l, i) => (s += text(150, top + i * lead, l, f.size, { family: face })));
  // Who wrote it, as a tracked label in the house mono.
  const by = fitLine(`— ${p.by!.toUpperCase()}`, QUOTE_W, 8, "plex", false, 5);
  const sp = Math.round(by.size * 1.2) / 10;
  s += text(150 + sp / 2, top + (f.lines.length - 1) * lead + f.size * 0.6 + 16, clip(by.line, QUOTE_W, by.size, { spacing: sp }), by.size, { spacing: sp });
  // Verified, with a tick in a ring.
  const v = p.y ? `Verified partner since ${p.y}` : "Verified partner";
  const w = textWidth(v, 8, { family: SERIF });
  const tx = 150 - (w + 16) / 2;
  s += `<circle cx="${f1(tx + 5)}" cy="276" r="5" fill="none" stroke="${INK}" stroke-width="${STROKE.fine}"/><path d="M${f1(tx + 2.6)} 276.2l1.8 1.8l3.2-3.6" fill="none" stroke="${INK}" stroke-width="${STROKE.fine}" stroke-linecap="round" stroke-linejoin="round"/>`;
  s += text(tx + 16, 278.8, v, 8, { family: SERIF, anchor: "start" });
  s += text(150, 298, "Was this review helpful?  Yes (1)  No (0)", 6.5, { family: SERIF });
  return s;
}

export function receiptBody(p: Params): string {
  const body = p.k === "terms" ? terms(p) : p.k === "review" ? review(p) : slip(p);
  return body + caption(344, ...captionLines(receiptCaption(p), p.cap));
}

export const captionOf = (spec: CustomSpec) => receiptCaption((spec as { p: Params }).p);

export const render = (spec: CustomSpec, color: BaseColor) => house(() => wrap(receiptBody((spec as { p: Params }).p), color));
