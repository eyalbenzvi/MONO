/**
 * Drawing library for the second 1,000 designs: illustrated objects and
 * icons (100×100 boxes), pixel sprites, a 5×7 pixel font, single-ink tone
 * patterns (halftone dots / hatching) and text-fitting helpers.
 *
 * Everything renders with exactly two colours (ink + ground): tones are
 * built from dot and line patterns, never grey fills or opacity.
 */
import { n1 } from "./core";
import { ADVANCES, GLYPHS, type FontStyle } from "./metrics";

export type { FontStyle };

/* ------------------------------------------------------------------ */
/* Text                                                                */
/* ------------------------------------------------------------------ */

export const SANS = `font-family="Helvetica, Arial, sans-serif"`;
export const SERIF = `font-family="Georgia, 'Times New Roman', serif"`;
export const MONO = `font-family="'Courier New', Courier, monospace"`;

export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Font style of a text run, for measuring. */
export function styleOf(font: string, weight: number | string = 400, italic = false): FontStyle {
  const bold = Number(weight) >= 600;
  if (font === MONO) return bold ? "monoBold" : "mono";
  if (font === SERIF) return italic ? "serifItalic" : bold ? "serifBold" : "serif";
  return bold ? "sansBold" : "sans";
}

const GLYPH_INDEX = new Map([...GLYPHS].map((ch, i) => [ch, i]));

/**
 * Rendered width of `txt` at `size` px, from measured glyph advances plus a
 * 4% safety margin (unknown glyphs count as wide).
 */
export function measure(txt: string, size: number, style: FontStyle, spacing = 0) {
  const adv = ADVANCES[style];
  let w = 0;
  for (const ch of txt) {
    const i = GLYPH_INDEX.get(ch);
    w += i === undefined ? 1 : adv[i];
  }
  const n = [...txt].length;
  return w * size * 1.04 + Math.max(0, n - 1) * spacing;
}

/** Largest font size (capped) at which `txt` fits `maxW`. */
export const sizeToFit = (txt: string, maxW: number, style: FontStyle, cap: number, spacing = 0) =>
  Math.min(cap, (maxW - Math.max(0, [...txt].length - 1) * spacing) / measure(txt, 1, style));

export function wrap(text: string, maxChars: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (!cur) cur = w;
    else if ((cur + " " + w).length <= maxChars) cur += " " + w;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

/**
 * Wrap + size text to fill a box: tries every line width and keeps the
 * layout with the largest font that fits both width and height.
 * `lines.length * size * lineH` is the block height.
 */
export function fitLines(text: string, boxW: number, boxH: number, style: FontStyle, lineH = 1.08, maxSize = 120) {
  let best = { lines: [text], size: 0 };
  for (let max = 4; max <= Math.max(4, text.length); max++) {
    const lines = wrap(text, max);
    const widest = Math.max(...lines.map((l) => measure(l, 1, style)));
    const size = Math.min(maxSize, boxW / widest, boxH / (lines.length * lineH));
    if (size > best.size) best = { lines, size };
  }
  return best;
}

/**
 * One line of text. If its measured width exceeds `maxW`, it's squeezed
 * to fit with textLength (so no font can overflow the print).
 */
export function textEl(
  txt: string,
  x: number,
  y: number,
  size: number,
  opts: { fill: string; font?: string; weight?: number | string; anchor?: "start" | "middle" | "end"; maxW?: number; italic?: boolean; spacing?: number; extra?: string },
) {
  const { fill, font = SANS, weight = 400, anchor = "start", maxW, italic = false, spacing = 0, extra = "" } = opts;
  const style = styleOf(font, weight, italic);
  // Too wide: shrink the font (down to 60%). Sizes come from the widest
  // fallback font, so the text then fits everywhere; textLength is only a
  // last resort because it also stretches narrower fonts to the full width.
  let fs = size;
  if (maxW && measure(txt, fs, style, spacing) > maxW) fs = Math.max(size * 0.6, sizeToFit(txt, maxW, style, size, spacing));
  const fit = maxW && measure(txt, fs, style, spacing) > maxW ? ` textLength="${n1(maxW)}" lengthAdjust="spacingAndGlyphs"` : "";
  return `<text x="${n1(x)}" y="${n1(y)}" font-size="${n1(fs)}" font-weight="${weight}"${italic ? ` font-style="italic"` : ""}${spacing ? ` letter-spacing="${spacing}"` : ""} text-anchor="${anchor}" ${font} fill="${fill}"${fit}${extra}>${esc(txt)}</text>`;
}

/* ------------------------------------------------------------------ */
/* Single-ink tones                                                    */
/* ------------------------------------------------------------------ */

/**
 * Pattern defs: t1–t5 = rotated halftone dots (light → dark),
 * l1–l3 = hatching (light → dark). Use as fill="url(#t3)".
 */
export function toneDefs(ink: string) {
  const dots = [0.7, 1.15, 1.6, 2.1, 2.6]
    .map(
      (r, i) =>
        `<pattern id="t${i + 1}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><circle cx="3" cy="3" r="${r}" fill="${ink}"/></pattern>`,
    )
    .join("");
  const lines = [0.8, 1.6, 2.6]
    .map(
      (w, i) =>
        `<pattern id="l${i + 1}" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)"><rect width="${w}" height="5" fill="${ink}"/></pattern>`,
    )
    .join("");
  return `<defs>${dots}${lines}</defs>`;
}

/* ------------------------------------------------------------------ */
/* Objects & icons (100×100 boxes)                                     */
/* ------------------------------------------------------------------ */

export interface Prim {
  d: string;
  /** Closed shapes can be filled (silhouette / woodcut); open ones are always strokes. */
  closed: boolean;
}

const rect = (x: number, y: number, w: number, h: number, r = 0): Prim => ({
  d:
    r > 0
      ? `M${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h - r}Q${x + w} ${y + h} ${x + w - r} ${y + h}H${x + r}Q${x} ${y + h} ${x} ${y + h - r}V${y + r}Q${x} ${y} ${x + r} ${y}Z`
      : `M${x} ${y}H${x + w}V${y + h}H${x}Z`,
  closed: true,
});
const circle = (cx: number, cy: number, r: number): Prim => ({
  d: `M${cx - r} ${cy}A${r} ${r} 0 1 0 ${cx + r} ${cy}A${r} ${r} 0 1 0 ${cx - r} ${cy}Z`,
  closed: true,
});
const open = (d: string): Prim => ({ d, closed: false });
const shape = (d: string): Prim => ({ d, closed: true });

export const OBJECTS: Record<string, Prim[]> = {
  coffee: [
    shape("M28 38 L72 38 L66 80 Q65 86 58 86 L42 86 Q35 86 34 80 Z"),
    open("M71 46 Q86 46 84 58 Q82 70 67 68"),
    open("M16 88 Q50 98 84 88"),
    open("M42 30 Q37 22 44 15"),
    open("M52 30 Q47 20 55 11"),
    open("M62 30 Q57 22 64 15"),
  ],
  cassette: [
    rect(10, 24, 80, 52, 5),
    rect(18, 30, 64, 16, 2),
    circle(34, 57, 8),
    circle(66, 57, 8),
    circle(34, 57, 3),
    circle(66, 57, 3),
    rect(28, 50, 44, 14, 3),
    open("M26 76 L32 67 L68 67 L74 76"),
    open("M22 36 H78"),
  ],
  camera: [
    rect(12, 32, 76, 48, 6),
    shape("M30 32 L36 22 L56 22 L62 32 Z"),
    circle(50, 56, 17),
    circle(50, 56, 10),
    circle(50, 56, 4),
    rect(70, 38, 10, 6, 1),
    rect(18, 26, 10, 6, 1),
  ],
  bulb: [
    shape("M50 12 C30 12 22 30 30 44 C35 52 38 56 38 64 L62 64 C62 56 65 52 70 44 C78 30 70 12 50 12 Z"),
    rect(40, 66, 20, 6, 1),
    rect(41, 73, 18, 5, 1),
    shape("M44 79 L56 79 L52 85 L48 85 Z"),
    open("M44 50 L47 42 L50 50 L53 42 L56 50"),
    open("M50 4 V0 M82 14 L86 10 M18 14 L14 10 M88 34 H94 M12 34 H6"),
  ],
  plane: [
    shape("M8 52 L92 18 L60 84 L48 60 Z"),
    open("M48 60 L92 18"),
    open("M48 60 L44 78 L58 67"),
    open("M6 74 Q22 82 36 76 M40 84 Q30 92 18 90"),
  ],
  cactus: [
    shape("M30 66 L70 66 L64 92 L36 92 Z"),
    rect(26, 59, 48, 8, 2),
    shape("M44 59 L44 24 Q44 13 50 13 Q56 13 56 24 L56 59 Z"),
    open("M44 46 L36 46 Q30 46 30 40 L30 31 Q30 26 34 26 Q38 26 38 31 L38 39 L44 39"),
    open("M56 38 L64 38 Q70 38 70 32 L70 24 Q70 19 66 19 Q62 19 62 24 L62 31 L56 31"),
    open("M47 28 L45 26 M53 36 L55 34 M47 48 L45 46 M53 52 L55 50"),
  ],
  headphones: [
    open("M20 60 Q20 16 50 16 Q80 16 80 60"),
    rect(12, 52, 18, 30, 6),
    rect(70, 52, 18, 30, 6),
    open("M30 60 V74 M70 60 V74"),
  ],
  key: [
    circle(28, 50, 17),
    circle(28, 50, 6),
    rect(44, 46, 46, 8, 1),
    open("M76 54 V65 H83 V54 M63 54 V61 H69 V54"),
  ],
  eye: [
    shape("M8 50 Q50 12 92 50 Q50 88 8 50 Z"),
    circle(50, 50, 17),
    circle(50, 50, 7),
    circle(57, 44, 3),
    open("M28 30 L24 21 M50 23 V12 M72 30 L76 21"),
  ],
  hourglass: [
    rect(22, 10, 56, 7, 2),
    rect(22, 83, 56, 7, 2),
    shape("M30 17 L70 17 L54 50 L70 83 L30 83 L46 50 Z"),
    shape("M37 29 L63 29 L52 47 L48 47 Z"),
    shape("M35 82 Q50 67 65 82 Z"),
    open("M50 50 V70"),
    open("M25 17 V83 M75 17 V83"),
  ],
  umbrella: [
    shape("M10 52 Q50 6 90 52 Q83 45 77 52 Q70 45 63 52 Q57 45 50 52 Q43 45 37 52 Q30 45 23 52 Q17 45 10 52 Z"),
    open("M50 52 V82 Q50 91 43 91 Q36 91 36 84"),
    open("M50 20 V13"),
    open("M18 64 L15 72 M30 70 L27 78 M72 70 L69 78 M84 62 L81 70"),
  ],
  envelope: [rect(10, 26, 80, 50, 3), open("M10 28 L50 58 L90 28"), open("M10 76 L40 52 M90 76 L60 52"), circle(50, 58, 6)],
  glasses: [circle(31, 54, 16), circle(69, 54, 16), open("M47 52 Q50 45 53 52"), open("M15 50 L6 42 M85 50 L94 42"), open("M23 47 L30 42")],
};

export const ICONS: Record<string, Prim[]> = {
  star: [shape("M50 10 L61 38 L91 38 L67 56 L76 86 L50 68 L24 86 L33 56 L9 38 L39 38 Z")],
  mountain: [shape("M8 82 L38 32 L52 54 L64 38 L92 82 Z"), open("M31 44 L38 50 L44 42")],
  wave: [open("M6 46 Q20 26 34 46 T62 46 T90 46"), open("M6 64 Q20 44 34 64 T62 64 T90 64")],
  moon: [shape("M62 14 A38 38 0 1 0 62 86 A30 30 0 1 1 62 14 Z")],
  sun: [circle(50, 50, 18), open("M50 8 V22 M50 78 V92 M8 50 H22 M78 50 H92 M20 20 L30 30 M70 70 L80 80 M80 20 L70 30 M30 70 L20 80")],
  bolt: [shape("M58 6 L26 56 L48 56 L40 94 L76 40 L54 40 L66 6 Z")],
  bird: [open("M10 50 Q28 32 50 50 Q72 32 90 50")],
  eye: OBJECTS.eye.slice(0, 3),
};

/**
 * Render primitives from a 100×100 box into the print.
 * - "line": everything stroked
 * - "solid": closed shapes filled with ink, details in ground colour on top
 * - "woodcut": closed shapes filled with a hatch/tone pattern + outlined
 */
export function drawPrims(
  prims: Prim[],
  x: number,
  y: number,
  size: number,
  style: "line" | "solid" | "woodcut",
  ink: string,
  ground: string,
  sw = 3,
  pattern = "l2",
) {
  const s = size / 100;
  const stroke = `stroke-width="${sw}" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"`;
  const body = prims
    .map((p, i) => {
      if (!p.closed || style === "line") return `<path d="${p.d}" fill="none" stroke="${ink}" ${stroke}/>`;
      if (style === "solid") {
        // First closed shape is the silhouette; later closed shapes are cut-outs.
        return i === prims.findIndex((q) => q.closed)
          ? `<path d="${p.d}" fill="${ink}"/>`
          : `<path d="${p.d}" fill="none" stroke="${ground}" ${stroke}/>`;
      }
      return `<path d="${p.d}" fill="url(#${pattern})" stroke="${ink}" ${stroke}/>`;
    })
    .join("");
  return `<g transform="translate(${n1(x)} ${n1(y)}) scale(${n1(s * 1000) / 1000})">${body}</g>`;
}

/* ------------------------------------------------------------------ */
/* Pixel art                                                           */
/* ------------------------------------------------------------------ */

export const SPRITES: Record<string, string[]> = {
  heart: ["..XX...XX..", ".XXXX.XXXX.", "XXXXXXXXXXX", "XXXXXXXXXXX", ".XXXXXXXXX.", "..XXXXXXX..", "...XXXXX...", "....XXX....", ".....X....."],
  star: [".....X.....", "....XXX....", "....XXX....", "XXXXXXXXXXX", ".XXXXXXXXX.", "..XXXXXXX..", "..XXXXXXX..", ".XXXX.XXXX.", ".XXX...XXX.", "XX.......XX"],
  alien: ["...XXXXX...", "..XXXXXXX..", ".XX.XXX.XX.", ".XXXXXXXXX.", ".XXXXXXXXX.", "..X.XXX.X..", ".X..X.X..X.", "X..X...X..X"],
  ghost: ["...XXXXX...", "..XXXXXXX..", ".XXXXXXXXX.", ".XX..X..XX.", ".XX..X..XX.", ".XXXXXXXXX.", ".XXXXXXXXX.", ".XXXXXXXXX.", ".XX.XX.XXX.", ".X...X...X."],
  rocket: ["....X....", "...XXX...", "..XXXXX..", "..XX.XX..", "..XX.XX..", "..XXXXX..", "..XXXXX..", ".XXXXXXX.", "XX.XXX.XX", "X..XXX..X", "....X....", "...X.X...", "..X...X.."],
  sword: ["...X...", "..XXX..", "..XXX..", "..XXX..", "..XXX..", "..XXX..", "..XXX..", "XXXXXXX", "..XXX..", "...X...", "...X...", "..XXX..", "..XXX.."],
  potion: ["...XXX...", "...X.X...", "...X.X...", "..XX.XX..", ".X.....X.", "X.......X", "XXXXXXXXX", "XXX.XXXXX", "XXXXX.XXX", ".XXXXXXX.", "..XXXXX.."],
  cat: ["X.........X", "XX.......XX", "XXXXXXXXXXX", "XX.XXXXX.XX", "XX.XXXXX.XX", "XXXXX.XXXXX", "X.XX...XX.X", ".XXXXXXXXX.", "..XXXXXXX.."],
  skull: ["..XXXXXXX..", ".XXXXXXXXX.", "XXXXXXXXXXX", "XX...X...XX", "XX...X...XX", "XXXXXXXXXXX", ".XXXX.XXXX.", "..XXXXXXX..", "..X.X.X.X..", "..XXXXXXX.."],
  cloud: ["....XXX......", "..XXXXXXX....", ".XXXXXXXXXXX.", "XXXXXXXXXXXXX", "XXXXXXXXXXXXX", ".XXXXXXXXXXX."],
  bolt: ["...XXXX", "..XXXX.", "..XXX..", ".XXX...", ".XXXXXX", "XXXXXX.", "...XXX.", "..XXX..", "..XX...", ".XX....", ".X....."],
  mug: ["..X.X.X....", ".X.X.X.....", "...........", "XXXXXXXX...", "XXXXXXXXXX.", "XXXXXXXX.XX", "XXXXXXXX.XX", "XXXXXXXXXX.", ".XXXXXX....", "XXXXXXXXX.."],
  smiley: ["...XXXXX...", ".XX.....XX.", ".X.......X.", "X..X...X..X", "X..X...X..X", "X.........X", "X.X.....X.X", "X..XXXXX..X", ".X.......X.", ".XX.....XX.", "...XXXXX..."],
  gamepad: ["..XXXXXXXXXXX..", ".XXXXXXXXXXXXX.", "XX.XXXXXXXX.XXX", "X...XXXXXXX.X.X", "XX.XXXXXXXXX.XX", "XXXXXX...XXXXXX", "XXXX.......XXXX", ".XX.........XX."],
};

const FONT: Record<string, string[]> = {
  A: [".XXX.", "X...X", "X...X", "XXXXX", "X...X", "X...X", "X...X"],
  B: ["XXXX.", "X...X", "X...X", "XXXX.", "X...X", "X...X", "XXXX."],
  C: [".XXX.", "X...X", "X....", "X....", "X....", "X...X", ".XXX."],
  D: ["XXXX.", "X...X", "X...X", "X...X", "X...X", "X...X", "XXXX."],
  E: ["XXXXX", "X....", "X....", "XXXX.", "X....", "X....", "XXXXX"],
  F: ["XXXXX", "X....", "X....", "XXXX.", "X....", "X....", "X...."],
  G: [".XXX.", "X...X", "X....", "X.XXX", "X...X", "X...X", ".XXXX"],
  H: ["X...X", "X...X", "X...X", "XXXXX", "X...X", "X...X", "X...X"],
  I: [".XXX.", "..X..", "..X..", "..X..", "..X..", "..X..", ".XXX."],
  J: ["..XXX", "...X.", "...X.", "...X.", "...X.", "X..X.", ".XX.."],
  K: ["X...X", "X..X.", "X.X..", "XX...", "X.X..", "X..X.", "X...X"],
  L: ["X....", "X....", "X....", "X....", "X....", "X....", "XXXXX"],
  M: ["X...X", "XX.XX", "X.X.X", "X.X.X", "X...X", "X...X", "X...X"],
  N: ["X...X", "X...X", "XX..X", "X.X.X", "X..XX", "X...X", "X...X"],
  O: [".XXX.", "X...X", "X...X", "X...X", "X...X", "X...X", ".XXX."],
  P: ["XXXX.", "X...X", "X...X", "XXXX.", "X....", "X....", "X...."],
  Q: [".XXX.", "X...X", "X...X", "X...X", "X.X.X", "X..X.", ".XX.X"],
  R: ["XXXX.", "X...X", "X...X", "XXXX.", "X.X..", "X..X.", "X...X"],
  S: [".XXXX", "X....", "X....", ".XXX.", "....X", "....X", "XXXX."],
  T: ["XXXXX", "..X..", "..X..", "..X..", "..X..", "..X..", "..X.."],
  U: ["X...X", "X...X", "X...X", "X...X", "X...X", "X...X", ".XXX."],
  V: ["X...X", "X...X", "X...X", "X...X", "X...X", ".X.X.", "..X.."],
  W: ["X...X", "X...X", "X...X", "X.X.X", "X.X.X", "X.X.X", ".X.X."],
  X: ["X...X", "X...X", ".X.X.", "..X..", ".X.X.", "X...X", "X...X"],
  Y: ["X...X", "X...X", ".X.X.", "..X..", "..X..", "..X..", "..X.."],
  Z: ["XXXXX", "....X", "...X.", "..X..", ".X...", "X....", "XXXXX"],
  "0": [".XXX.", "X...X", "X..XX", "X.X.X", "XX..X", "X...X", ".XXX."],
  "1": ["..X..", ".XX..", "..X..", "..X..", "..X..", "..X..", ".XXX."],
  "2": [".XXX.", "X...X", "....X", "...X.", "..X..", ".X...", "XXXXX"],
  "3": ["XXXXX", "...X.", "..X..", "...X.", "....X", "X...X", ".XXX."],
  "4": ["...X.", "..XX.", ".X.X.", "X..X.", "XXXXX", "...X.", "...X."],
  "5": ["XXXXX", "X....", "XXXX.", "....X", "....X", "X...X", ".XXX."],
  "6": ["..XX.", ".X...", "X....", "XXXX.", "X...X", "X...X", ".XXX."],
  "7": ["XXXXX", "....X", "...X.", "..X..", ".X...", ".X...", ".X..."],
  "8": [".XXX.", "X...X", "X...X", ".XXX.", "X...X", "X...X", ".XXX."],
  "9": [".XXX.", "X...X", "X...X", ".XXXX", "....X", "...X.", ".XX.."],
  "?": [".XXX.", "X...X", "....X", "...X.", "..X..", ".....", "..X.."],
  "!": ["..X..", "..X..", "..X..", "..X..", "..X..", ".....", "..X.."],
  ".": [".....", ".....", ".....", ".....", ".....", ".....", "..X.."],
  ":": [".....", "..X..", ".....", ".....", ".....", "..X..", "....."],
  "-": [".....", ".....", ".....", ".XXX.", ".....", ".....", "....."],
  "+": [".....", "..X..", "..X..", "XXXXX", "..X..", "..X..", "....."],
  "/": ["....X", "....X", "...X.", "..X..", ".X...", "X....", "X...."],
  " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
};

/** Width in cells of a pixel-font string (5 + 1 spacing per glyph). */
export const pixelTextCells = (txt: string) => txt.length * 6 - 1;

/** Turn a bitmap into merged horizontal runs of rects (compact SVG). */
export function bitmapRects(rows: string[], x0: number, y0: number, px: number, ink: string, gap = 0) {
  let out = "";
  rows.forEach((row, r) => {
    if (gap > 0) {
      // LED look: every pixel is its own square with a gap.
      for (let c = 0; c < row.length; c++)
        if (row[c] === "X") out += `<rect x="${n1(x0 + c * px)}" y="${n1(y0 + r * px)}" width="${n1(px - gap)}" height="${n1(px - gap)}"/>`;
      return;
    }
    let c = 0;
    while (c < row.length) {
      if (row[c] !== "X") {
        c++;
        continue;
      }
      let e = c;
      while (e < row.length && row[e] === "X") e++;
      out += `<rect x="${n1(x0 + c * px)}" y="${n1(y0 + r * px)}" width="${n1((e - c) * px + 0.2)}" height="${n1(px + 0.2)}"/>`;
      c = e;
    }
  });
  return `<g fill="${ink}">${out}</g>`;
}

/** Rows (strings of X / .) for a pixel-font text. Unknown chars render blank. */
export function pixelTextRows(txt: string): string[] {
  const rows = Array.from({ length: 7 }, () => "");
  [...txt.toUpperCase()].forEach((ch, i) => {
    const g = FONT[ch] ?? FONT[" "];
    for (let r = 0; r < 7; r++) rows[r] += (i ? "." : "") + g[r];
  });
  return rows;
}

/** Pixel text centred at cx, top at y, scaled to at most maxW wide. */
export function pixelText(txt: string, cx: number, y: number, maxW: number, ink: string, maxPx = 8) {
  const cells = pixelTextCells(txt);
  const px = Math.min(maxPx, maxW / cells);
  return { svg: bitmapRects(pixelTextRows(txt), cx - (cells * px) / 2, y, px, ink), height: 7 * px, px };
}
