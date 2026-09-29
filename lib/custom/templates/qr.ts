/**
 * Your Link: the address as a QR code that scans (lib/custom/draw/qr, level
 * Q, version 4 and up), drawn like the catalogue's Terminal prints: the code
 * in dots inside corner registration marks, its version and mask set small
 * at the marks as a machine would label them, the address in type under it,
 * the caption below.
 *
 * Drawn so it both scans and prints in one ink: every module a separate dot
 * (filled squares would run together into solid slabs of ink), each finder
 * a rounded ring round a dot (the 1:1:3:1:1 a scanner looks for), each
 * alignment pattern a small ring round a dot, and four modules of clear
 * ground kept all round (the quiet zone; the marks sit outside it). On a
 * white tee it is an ordinary dark-on-light code; on a black tee the ink is
 * white, so the code is inverted, which the phone cameras (iOS Camera,
 * Google Lens and Android's own) read.
 */
import { INK, caption, f1, line, text, captionLines, type Lines } from "../kit";
import { titleWords } from "../specKit";
import { encodeQr } from "../draw/qr";
import { hostOf, linkUrl, type Params } from "../specs/qr";
import { wrap } from "../svg";
import type { BaseColor } from "@/types/shirt";
import type { CustomSpec } from "../spec";

/** The code's box (modules only; the quiet zone is outside it). */
const CODE = { x: 56, y: 50, s: 188 };
/** The registration marks' distance from the code: at least four modules at any version from 4 (a module is 188/33 ≈ 5.7 at most). */
const QUIET = 24;
/** The print always uses at least this version: a short address isn't a crude 21-module blob. */
export const QR_MIN_VERSION = 4;

const square = (x: number, y: number, s: number) => `M${f1(x)} ${f1(y)}H${f1(x + s)}V${f1(y + s)}H${f1(x)}Z`;
const ringPath = (x: number, y: number, s: number, width: number) =>
  `<path d="${square(x, y, s)}" fill="none" stroke="${INK}" stroke-width="${f1(width)}" stroke-linejoin="miter"/>`;
/** A filled square with softened corners (the finder's centre), drawn inside its s × s cell. */
const block = (x: number, y: number, s: number) => {
  const r = 0.04 * s;
  return `<path d="${square(x + r + 0.02 * s, y + r + 0.02 * s, s - 2 * r - 0.04 * s)}" fill="${INK}" stroke="${INK}" stroke-width="${f1(2 * r)}" stroke-linejoin="round"/>`;
};
const disc = (cx: number, cy: number, r: number) => `<circle cx="${f1(cx)}" cy="${f1(cy)}" r="${Math.round(r * 100) / 100}" fill="${INK}"/>`;

/** The address in one to three even lines, broken after a / . - ? & = _ # where one falls near the middle. */
export function addressLines(a: string): string[] {
  if (a.length <= 34) return [a];
  const n = Math.min(3, Math.ceil(a.length / 40));
  const target = Math.ceil(a.length / n);
  const out: string[] = [];
  let s = a;
  while (s.length > target + 4 && out.length < n - 1) {
    let cut = -1;
    for (let i = Math.min(s.length - 1, target + 4); i >= target - 6; i--)
      if ("/.-?&=_#".includes(s[i - 1])) {
        cut = i;
        break;
      }
    if (cut < 0) cut = target;
    out.push(s.slice(0, cut));
    s = s.slice(cut);
  }
  out.push(s);
  return out;
}

function marks(x0: number, y0: number, x1: number, y1: number): string {
  const L = 12;
  let s = "";
  for (const [x, y, dx, dy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]])
    s += line(x, y, x + dx * L, y, 1) + line(x, y, x, y + dy * L, 1);
  return s;
}

/** The drawing, the caption's lines as ours, and where the caption sits. */
function qrDraw(p: Params): [string, Lines, number] {
  const url = linkUrl(p);
  const qr = encodeQr(url, QR_MIN_VERSION);
  if (!qr) return ["", ["Your link", "Too long for a code", undefined], 338];
  const { size, dark, align, version, mask } = qr;
  const m = CODE.s / size;
  const at = (i: number) => i * m;
  let s = "";
  // Finders: a ring one module wide on the outer square, a dot three modules across.
  const special = new Set<number>();
  const claim = (cx: number, cy: number, r: number) => {
    for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) special.add(y * size + x);
  };
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
    claim(cx, cy, 3);
    const x = CODE.x + at(cx - 3) + m / 2, y = CODE.y + at(cy - 3) + m / 2;
    s += ringPath(x, y, 6 * m, 0.92 * m);
    s += block(CODE.x + at(cx - 1), CODE.y + at(cy - 1), 3 * m);
  }
  for (const [cx, cy] of align) {
    claim(cx, cy, 2);
    s += ringPath(CODE.x + at(cx - 2) + m / 2, CODE.y + at(cy - 2) + m / 2, 4 * m, 0.92 * m);
    s += block(CODE.x + at(cx), CODE.y + at(cy), m);
  }
  // Every other dark module a dot.
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) if (dark[y][x] && !special.has(y * size + x)) s += disc(CODE.x + at(x) + m / 2, CODE.y + at(y) + m / 2, 0.4 * m);
  // Registration marks outside the quiet zone, labelled like a terminal print.
  const [x0, y0, x1, y1] = [CODE.x - QUIET, CODE.y - QUIET, CODE.x + CODE.s + QUIET, CODE.y + CODE.s + QUIET];
  s += marks(x0, y0, x1, y1);
  s += text(x0, y0 - 6, `${size} x ${size} MODULES`, 6, { anchor: "start", spacing: 0.6 });
  s += text(x1, y0 - 6, `MASK ${mask.toString(2).padStart(3, "0")} · LEVEL Q`, 6, { anchor: "end", spacing: 0.6 });
  // The address, as it prints (no scheme), in type under the marks.
  const lines = addressLines(p.a);
  const longest = Math.max(...lines.map((l) => l.length));
  const size2 = Math.min(11, 256 / (0.602 * longest));
  const lead = size2 * 1.3;
  // Centred between the marks and the caption.
  const top = (y1 + 326) / 2 - ((lines.length - 1) * lead) / 2 + size2 * 0.35;
  lines.forEach((l, i) => (s += text(150, top + i * lead, l, Math.round(size2 * 10) / 10, { bold: true })));
  const host = hostOf(p.a);
  const title = titleWords(p) ?? (host.length <= 28 ? host : `${host.slice(0, 27)}…`);
  return [s, [title, `QR code · version ${version} · error correction Q`, "A quarter of it can be lost and it still reads"], 342];
}
/** The caption's lines (ours). */
export const qrCaption = (p: Params): Lines => qrDraw(p)[1];

/** The print's body (white ink, unwrapped). */
export function qrBody(p: Params): string {
  const [s, lines, y] = qrDraw(p);
  return s + caption(y, ...captionLines(lines, p.cap));
}

export const captionOf = (spec: CustomSpec) => qrCaption((spec as { p: Params }).p);

export const render = (spec: CustomSpec, color: BaseColor) => wrap(qrBody((spec as { p: Params }).p), color);
