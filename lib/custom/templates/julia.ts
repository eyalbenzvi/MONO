/**
 * Your Fractal: your date as a Julia set. The day picks a value of c from a
 * band of them curated along the edge of the Mandelbrot set (where the
 * Julia sets are most intricate and still hold together: each one fuzzed
 * through the print gate before it went in the table), and the set of
 * z → z² + c is drawn in escape-time contours (lib/custom/draw/julia):
 * lines, never greys. Drawn like the catalogue's Lorenz attractors, the
 * nearest of its mathematical designs: hairlines traced from an equation,
 * one ink, the equation's numbers in the caption.
 */
import { INK, STROKE, caption, captionLines, line, longDate, text, type Lines, house } from "../kit";
import { juliaDrawing } from "../draw/julia";
import { dayNumber, parseDate, titleWords, type Cap } from "../specKit";
import type { CustomSpec } from "../spec";
import type { Params } from "../specs/julia";
import { wrap } from "../svg";
import type { BaseColor } from "@/types/shirt";

/**
 * The band: values of c (re, im × 10⁴) on or just inside the Mandelbrot set's
 * edge, by angle round the main cardioid and its bulbs; each passes the gate
 * on both tees (scripts/tools/juliaBand.ts made and checked the list).
 */
export const BAND: readonly (readonly [number, number])[] = [
  [3160, 400], [3440, 520], [3640, 720], [3760, 960], [3680, 1200], [4040, 1280], [3840, 1440], [4160, 1560],
  [3760, 1680], [4280, 1960], [4000, 1920], [3760, 2040], [4320, 2240], [4000, 2200], [3760, 2320], [3960, 2640],
  [3720, 2760], [4120, 3040], [4360, 3240], [3800, 3080], [4600, 3480], [4120, 3320], [4360, 3560], [3840, 3360],
  [4600, 3840], [4040, 3560], [3600, 3440], [3800, 3680], [3520, 3680], [3360, 3880], [3560, 4080], [3560, 4360],
  [3320, 4200], [3120, 4360], [3600, 5040], [3000, 4600], [3280, 4840], [3360, 5120], [3920, 5640], [3040, 4920],
  [2800, 4760], [3480, 5480], [3120, 5200], [3720, 5840], [2800, 5040], [3200, 5440], [3880, 6120], [3480, 5760],
  [2880, 5280], [3600, 6120], [3200, 5720], [2960, 5520], [2560, 5120], [3320, 5960], [2640, 5360], [3600, 6400],
  [2960, 5840], [2720, 5600], [2320, 5200], [2400, 5440], [3600, 6840], [2920, 6120], [2680, 5880], [2120, 5360],
  [2400, 5720], [2600, 6120], [2000, 5600], [1920, 5840], [1640, 5720], [1720, 6360], [1560, 6120], [1400, 5920],
  [1640, 6600], [1440, 6360], [1280, 6160], [1080, 6000], [1360, 6600], [1120, 6440], [1280, 6920], [840, 6160],
  [760, 6480], [600, 6240], [520, 6560], [360, 6320], [160, 6520], [-80, 6400], [200, 7600], [360, 8080], [-40, 7160],
  [-320, 6520], [-40, 7440], [-240, 6960], [40, 7960], [240, 8600], [120, 8240], [-280, 7280], [-200, 7640],
  [-520, 6720], [-80, 8400], [-480, 7040], [-200, 8040], [-680, 6520], [-440, 7480], [-400, 7800], [-600, 7280],
  [-720, 6880], [-440, 8120], [-400, 8400], [-640, 7640], [-880, 6680], [-800, 7120], [-640, 7920], [-800, 7440],
  [-520, 8800], [-640, 8320], [-1000, 6920], [-880, 7720], [-800, 8120], [-720, 8560], [-1000, 7280], [-800, 8800],
  [-1080, 7520], [-1000, 7960], [-920, 8400], [-720, 9640], [-1200, 7080], [-1000, 8640], [-1080, 8200], [-1160, 7760],
  [-920, 9280], [-1000, 8960], [-1280, 7320], [-1400, 6920], [-1000, 9520], [-1480, 6520], [-1200, 8440],
  [-1280, 8000], [-1360, 7560], [-1200, 8800], [-1480, 7160], [-1200, 9240], [-1360, 8240], [-1160, 9840],
  [-1440, 7800], [-1600, 6760], [-1560, 7400], [-1440, 8560], [-1440, 8880], [-1680, 7000], [-1560, 8040],
  [-1760, 6480], [-1640, 7640], [-1600, 8360], [-1760, 7240], [-1760, 7880], [-1880, 6760], [-1680, 8960],
  [-1840, 7480], [-1760, 8560], [-1800, 8160], [-1960, 7000], [-2040, 6480], [-1960, 7720], [-2040, 7240],
  [-2040, 7960], [-2040, 8240], [-2120, 7480], [-2160, 6800], [-2240, 7040], [-2240, 7720], [-2280, 6560],
  [-2280, 8040], [-2280, 8320], [-2320, 7280], [-2320, 8640], [-2400, 7520], [-2480, 6400], [-2520, 8480],
  [-2520, 7760], [-2720, 7600], [-2760, 6400], [-2880, 8440], [-2880, 6680], [-3040, 6400], [-3240, 6240],
  [-3440, 6600], [-3480, 6160], [-3640, 6760], [-3640, 6440], [-3680, 6000], [-3880, 6840], [-3800, 6240],
  [-3920, 6520], [-3920, 5920], [-4160, 6040], [-4200, 5760], [-4640, 6280], [-4440, 5640], [-4560, 5960],
  [-5080, 6880], [-4800, 6080], [-4680, 5720], [-4920, 6320], [-4680, 5440], [-5240, 6640], [-4920, 5840],
  [-5360, 6880], [-5080, 6120], [-5240, 6320], [-4920, 5560], [-5480, 6560], [-5200, 5880], [-5640, 6760],
  [-4960, 5240], [-5440, 6160], [-5200, 5600], [-5640, 6360], [-5480, 5880], [-5200, 5320], [-6000, 6880],
  [-5880, 6600], [-5440, 5520], [-5880, 6280], [-5240, 5040], [-6240, 6800], [-5640, 5680], [-5560, 5280],
  [-6160, 6280], [-5760, 5440], [-5480, 4960], [-5760, 4920], [-5680, 4640], [-5880, 4440], [-6120, 4640],
  [-6400, 4960], [-6120, 4360], [-6520, 4720], [-6360, 4520], [-6200, 4120], [-6800, 4720], [-6600, 4440],
  [-6440, 4200], [-7080, 4760], [-6880, 4480], [-6320, 3880], [-6560, 3800], [-6880, 3840], [-6520, 3520],
  [-6840, 3520], [-7080, 3680], [-6640, 3280], [-7320, 3600], [-6920, 3280], [-7160, 3400], [-6880, 3000],
  [-7120, 3080], [-7120, 2800], [-7360, 2880], [-7040, 2520], [-7280, 2440], [-9200, 3240], [-7200, 2200],
  [-10280, 3640], [-9360, 3040], [-8640, 2720], [-9840, 3240], [-9040, 2840], [-10440, 3440], [-10200, 3280],
  [-7280, 1960], [-10040, 3080], [-8320, 2360], [-8560, 2440], [-9840, 2920], [-9240, 2680], [-9000, 2560],
  [-9600, 2720], [-10200, 2880], [-8160, 2080], [-10000, 2720], [-8800, 2280], [-9400, 2480], [-11520, 3240],
  [-8520, 2160], [-7400, 1720], [-9160, 2320], [-9760, 2520], [-10720, 2840], [-11200, 3000], [-10280, 2640],
  [-7960, 1840], [-11840, 3120], [-11600, 3000], [-8360, 1920], [-9600, 2320], [-9000, 2120], [-10000, 2440],
  [-8720, 2000], [-11120, 2760], [-11400, 2840], [-9360, 2160], [-10680, 2560], [-10360, 2400], [-9840, 2240],
  [-11960, 2880], [-11680, 2760], [-11040, 2520], [-11320, 2600], [-8200, 1680], [-9200, 1960], [-10160, 2240],
  [-7440, 1440], [-8560, 1760], [-7920, 1560], [-9600, 2040], [-8920, 1840], [-10600, 2320], [-11560, 2520],
  [-11920, 2600], [-10880, 2280], [-10000, 2040], [-11240, 2360], [-10400, 2120], [-9440, 1840], [-7760, 1360],
  [-8400, 1520], [-9800, 1880], [-12160, 2480], [-8760, 1600], [-11760, 2360], [-10680, 2080], [-11480, 2280],
  [-9120, 1680], [-8120, 1400], [-10240, 1920], [-11080, 2120], [-7520, 1200], [-9640, 1680], [-10520, 1880],
  [-10040, 1760], [-9360, 1600], [-11320, 2040], [-10880, 1920], [-11640, 2080], [-7960, 1200], [-10320, 1680],
  [-11120, 1840], [-11880, 2000], [-9880, 1560], [-10720, 1720], [-11480, 1840], [-7760, 1040], [-12320, 1920],
  [-10120, 1480], [-10960, 1640], [-11720, 1760], [-10520, 1520], [-11280, 1640], [-7480, 920], [-12120, 1760],
  [-12520, 1760], [-10760, 1440], [-9880, 1280], [-11520, 1560], [-10320, 1320], [-11120, 1440], [-11880, 1560],
  [-12320, 1600], [-10560, 1240], [-11360, 1360], [-11680, 1360], [-10920, 1240], [-10120, 1120], [-12160, 1400],
  [-7640, 720], [-11920, 1280], [-11160, 1160], [-10360, 1040], [-12400, 1280], [-11520, 1160], [-10720, 1040],
  [-12680, 1240], [-11760, 1080], [-12120, 1120], [-10960, 960], [-11320, 960], [-10520, 840], [-12440, 1000],
  [-11960, 920], [-11560, 880], [-7520, 480], [-10760, 760], [-11120, 760], [-12200, 840], [-13200, 920],
  [-11760, 720], [-11360, 680], [-12920, 760], [-12560, 720], [-13480, 760], [-12000, 640], [-10920, 560],
  [-12280, 600], [-13200, 640], [-10680, 480], [-11560, 520], [-11160, 480], [-12760, 560], [-11800, 440],
  [-13560, 520], [-13000, 480], [-12480, 440], [-12080, 400], [-13280, 400], [-11360, 320], [-10840, 280],
  [-13720, 320], [-12680, 280], [-11600, 240], [-12280, 240], [-11080, 200], [-13080, 240], [-11880, 200],
  [-13480, 200], [-10680, 80], [-12520, 80], [-12840, 80], [-13880, 80], [-11280, 40], [-12080, 40], [-13240, 40],
  [-11720, 0], [-10920, 0]
];

/** The day's entry: days since 1970 stepped through the band by a stride coprime to its length, so neighbouring days differ. */
export function bandIndex(d: string): number {
  const n = BAND.length;
  let stride = 37;
  while (gcdOf(stride, n) !== 1) stride++;
  return (((dayNumber(d) * stride) % n) + n) % n;
}
const gcdOf = (a: number, b: number): number => (b ? gcdOf(b, a % b) : a);

const BOX = { x: 30, y: 32, w: 240, h: 274 };

/** c written as the caption has it: "c = -0.7269 + 0.1889i". */
export const cLabel = (re: number, im: number) => `c = ${re < 0 ? "-" : ""}${(Math.abs(re) / 1e4).toFixed(4)} ${im < 0 ? "-" : "+"} ${(Math.abs(im) / 1e4).toFixed(4)}i`;

/** The caption's lines for a set: the title, then one line with the day in it when the title is the words (the print's depth stays the same). */
const juliaLines = (re: number, im: number, title: string, day?: string): Lines => [title, `${day ? `${day} · ` : ""}Julia set · ${cLabel(re, im)}`, undefined];

export function juliaFor(re: number, im: number, title: string, day?: string, cap?: Cap): string {
  const j = juliaDrawing(re / 1e4, im / 1e4, BOX);
  return (
    `<path d="${j.bands}" fill="none" stroke="${INK}" stroke-width="${STROKE.hairline}" stroke-linejoin="round"/>` +
    (j.inner ? `<path d="${j.inner}" fill="none" stroke="${INK}" stroke-width="${STROKE.hairline}" stroke-linejoin="round"/>` : "") +
    `<path d="${j.edge}" fill="none" stroke="${INK}" stroke-width="${STROKE.regular}" stroke-linejoin="round"/>` +
    plate() +
    // One line under the title, with the day in it when the title is the words (the print's depth stays the same).
    caption(338, ...captionLines(juliaLines(re, im, title, day), cap))
  );
}

/**
 * The plate round the set: crop marks at the drawing box's corners (hairlines,
 * clear of the contours, which keep to an oval inside it), the map at the top
 * left and the drawing's depth at the bottom right, in Plex at its smallest.
 */
function plate(): string {
  const [x0, y0, x1, y1, m] = [BOX.x - 6, BOX.y - 4, BOX.x + BOX.w + 6, BOX.y + BOX.h + 4, 9];
  let s = "";
  for (const [x, y, dx, dy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) s += line(x, y, x + dx * m, y, STROKE.hairline) + line(x, y, x, y + dy * m, STROKE.hairline);
  s += text(x0 + m + 3, y0 + 1.6, "z → z² + c", 4.5, { anchor: "start", spacing: 0.2 });
  s += text(x1 - m - 3, y1 + 1.6, "ESCAPE TIME · 400 STEPS", 4.5, { anchor: "end", spacing: 0.5 });
  return s;
}

/** The set's c for the day, and the caption's title and day (the visitor's words, else the day). */
function juliaOf(p: Params): [number, number, string, string | undefined] {
  const [y, mo, d] = parseDate(p.d)!;
  const [re, im] = BAND[bandIndex(p.d)];
  const w = titleWords(p);
  return [re, im, w ?? longDate(y, mo, d), w ? longDate(y, mo, d) : undefined];
}

/** The caption's lines (ours). */
export const juliaCaption = (p: Params): Lines => juliaLines(...juliaOf(p));

export function juliaBody(p: Params): string {
  return juliaFor(...juliaOf(p), p.cap);
}

export const captionOf = (spec: CustomSpec) => juliaCaption((spec as { p: Params }).p);

export const render = (spec: CustomSpec, color: BaseColor) => house(() => wrap(juliaBody((spec as { p: Params }).p), color));
