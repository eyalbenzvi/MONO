/**
 * Drawing kit of the computed prints (the seventh set, and the personalised
 * sky and moon prints built on it): white ink on the 300 × 400 canvas (the
 * wrapper swaps the inks for a white tee). Pure: the generator and the
 * browser draw with the same code, so a personalised print is the catalogue
 * print with other inputs.
 */
import { julian } from "./astro";
import fontWidths from "./fontWidths.json";

const WIDTHS = fontWidths as Record<Exclude<Family, "mono">, { regular: Record<string, number>; bold?: Record<string, number> }>;

export const INK = "#FFFFFF";
export const DEG = Math.PI / 180;
/** SVG coordinate precision (as scripts/gen/core n1). */
const n1 = (n: number) => Math.round(n * 10) / 10;
export const f1 = (n: number) => n1(n).toString();

/** Text made safe inside SVG markup. */
export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * The print's type families: DejaVu Sans Mono (every print until now), and
 * the Make prints' own (scripts/tools/buildPrintFonts.py): a text serif, a
 * condensed sans and a blackletter for mastheads. The SVG names the family;
 * resvg (the gate) and the canvas preview load the same files.
 */
export type Family = "mono" | "serif" | "condensed" | "blackletter";
export const FONT_FAMILY: Record<Family, string> = {
  mono: "DejaVu Sans Mono, monospace",
  serif: "Libre Caslon Text, serif",
  condensed: "Oswald, sans-serif",
  blackletter: "UnifrakturMaguntia, serif",
};
export interface TextOpts {
  anchor?: "start" | "middle" | "end";
  bold?: boolean;
  spacing?: number;
  /** Mono unless given (and then written exactly as before, so every earlier print stays byte for byte). */
  family?: Family;
}

/** Text in the print's type (monospace unless a family is given), centred unless an anchor is given. */
export const text = (x: number, y: number, s: string, size: number, opts: TextOpts = {}) =>
  `<text x="${f1(x)}" y="${f1(y)}" fill="${INK}" font-size="${size}" font-family="${FONT_FAMILY[opts.family ?? "mono"]}" text-anchor="${opts.anchor ?? "middle"}"${opts.bold ? ` font-weight="bold"` : ""}${opts.spacing ? ` letter-spacing="${opts.spacing}"` : ""}>${esc(s)}</text>`;

/** DejaVu Sans Mono's advance, em (every character alike). */
export const MONO_ADVANCE = 0.602;
/** A character the face lacks (it falls back): measured as a wide letter, so a line is never under-measured. */
const MISSING = 0.6;
/**
 * A line's width in print units, as it sets: the face's own advances
 * (lib/custom/fontWidths.json, from the font files), plus letter-spacing after
 * every character (SVG's and the canvas's rule). Kerning is left out: it only
 * ever narrows a line.
 */
export function textWidth(s: string, size: number, opts: Pick<TextOpts, "bold" | "spacing" | "family"> = {}): number {
  const chars = [...s];
  const family = opts.family ?? "mono";
  let em = 0;
  if (family === "mono") em = chars.length * MONO_ADVANCE;
  else {
    const faces = WIDTHS[family];
    const face = (opts.bold ? faces.bold : undefined) ?? faces.regular;
    for (const ch of chars) em += (face[ch] ?? MISSING * 1000) / 1000;
  }
  return em * size + chars.length * (opts.spacing ?? 0);
}

/** Words wrapped to a width at one size: the lines (greedy, word by word), or null when a word alone is wider. */
export function wrapWords(words: string, width: number, size: number, opts: Pick<TextOpts, "bold" | "spacing" | "family"> = {}): string[] | null {
  const lines: string[] = [];
  let line = "";
  for (const word of words.split(/\s+/).filter(Boolean)) {
    if (textWidth(word, size, opts) > width) return null;
    const next = line ? `${line} ${word}` : word;
    if (textWidth(next, size, opts) <= width) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** The fit of a text: its lines and the size they set at. */
export interface Fit {
  lines: string[];
  size: number;
}
/**
 * Words set to fit a box: wrapped to `width` at `size`, then a `step`
 * smaller at a time down to `floor`, until they take at most `maxLines`
 * lines. Null when they can't fit even at the floor: the editor then says
 * TOO_LONG, and nothing is drawn smaller than the floor.
 */
export function fitText(words: string, width: number, opts: Pick<TextOpts, "bold" | "spacing" | "family"> & { size: number; floor: number; maxLines: number; step?: number }): Fit | null {
  const step = opts.step ?? 0.5;
  for (let size = opts.size; size >= opts.floor - 1e-9; size = Math.round((size - step) * 100) / 100) {
    const lines = wrapWords(words, width, size, opts);
    if (lines && lines.length <= opts.maxLines) return { lines, size };
  }
  return null;
}
/** What the editor says when a text can't fit the print (fitText null). */
export const TOO_LONG = "Too long for the print. Try shorter.";

/** The air arcText adds between letters, em. */
export const ARC_TRACK = 0.08;
/**
 * Letters along a circle (centre cx, cy; radius r) centred on angle `mid`
 * (degrees, clockwise from the top): each glyph a rotated group, as the
 * canvas preview draws no textPath. `up`: the letters' tops face outwards
 * (the upper half); else inwards and set the other way round, so the lower
 * half reads left to right too. Monospace letters step evenly; another
 * family steps by each glyph's own advance.
 */
export function arcText(s: string, cx: number, cy: number, r: number, mid: number, size: number, up: boolean, opts: { bold?: boolean; family?: Family; track?: number } = {}): string {
  const chars = [...s];
  const track = opts.track ?? ARC_TRACK;
  const family = opts.family ?? "mono";
  // Each letter's centre along the arc, degrees from the line's middle.
  let offs: number[];
  if (family === "mono") {
    const step = ((MONO_ADVANCE + track) * size) / r / DEG;
    offs = chars.map((_, i) => (i - (chars.length - 1) / 2) * step);
  } else {
    const w = chars.map((ch) => textWidth(ch, size, { family, bold: opts.bold }) + track * size);
    const total = w.reduce((a, b) => a + b, 0);
    let at = -total / 2;
    offs = w.map((wi) => {
      const c = at + wi / 2;
      at += wi;
      return c / r / DEG;
    });
  }
  let out = "";
  chars.forEach((ch, i) => {
    if (ch === " ") return;
    const a = up ? mid + offs[i] : mid - offs[i];
    const [x, y] = [cx + r * Math.sin(a * DEG), cy - r * Math.cos(a * DEG)];
    const rot = up ? a : a + 180;
    out += `<g transform="rotate(${f1(rot)} ${f1(x)} ${f1(y)})"><text x="${f1(x)}" y="${f1(y + 0.35 * size)}" fill="${INK}" font-size="${f1(size)}" font-family="${FONT_FAMILY[family]}" text-anchor="middle"${opts.bold ? ` font-weight="bold"` : ""}>${esc(ch)}</text></g>`;
  });
  return out;
}

/**
 * A line of letters turned by `deg` about its centre (cx, cy): each glyph
 * placed along the turned baseline and rotated on its own, as arcText does,
 * since the canvas preview draws no transformed text runs.
 */
export function turnedText(s: string, cx: number, cy: number, deg: number, size: number, opts: { bold?: boolean; family?: Family; spacing?: number } = {}): string {
  const chars = [...s];
  const family = opts.family ?? "mono";
  const w = chars.map((ch) => textWidth(ch, size, { family, bold: opts.bold }) + (opts.spacing ?? 0));
  const total = w.reduce((a, b) => a + b, 0);
  const [c, sn] = [Math.cos(deg * DEG), Math.sin(deg * DEG)];
  let at = -total / 2;
  let out = "";
  chars.forEach((ch, i) => {
    const u = at + w[i] / 2;
    at += w[i];
    if (ch === " ") return;
    const [x, y] = [cx + u * c, cy + u * sn];
    out += `<g transform="rotate(${f1(deg)} ${f1(x)} ${f1(y)})"><text x="${f1(x)}" y="${f1(y + 0.35 * size)}" fill="${INK}" font-size="${f1(size)}" font-family="${FONT_FAMILY[family]}" text-anchor="middle"${opts.bold ? ` font-weight="bold"` : ""}>${esc(ch)}</text></g>`;
  });
  return out;
}

/** A polyline as path data (one decimal). */
export function polyline(points: [number, number][], close = false): string {
  let d = "";
  let last = "";
  points.forEach(([x, y], i) => {
    const p = `${f1(x)} ${f1(y)}`;
    if (p === last) return;
    d += (i === 0 ? "M" : "L") + p;
    last = p;
  });
  return d + (close ? "Z" : "");
}

export const path = (d: string, width = 1, extra = "") => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"${extra}/>`;
export const line = (x1: number, y1: number, x2: number, y2: number, width = 1) => `<line x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}" stroke="${INK}" stroke-width="${width}" stroke-linecap="round"/>`;
export const circle = (cx: number, cy: number, r: number, width = 1) => `<circle cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(r)}" fill="none" stroke="${INK}" stroke-width="${width}"/>`;
export const dot = (cx: number, cy: number, r: number) => `<circle cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(r)}" fill="${INK}"/>`;
export const rect = (x: number, y: number, w: number, h: number, width = 1) => `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(h)}" fill="none" stroke="${INK}" stroke-width="${width}"/>`;

/** A caption's three lines: the title, the line under it, the one under that (absent: not drawn). */
export type Lines = [string | undefined, (string | undefined)?, (string | undefined)?];
/**
 * A caption's lines as printed: each line ours (the template's default)
 * unless the visitor's `cap` has one for it; "" hides it. With no `cap`,
 * exactly the defaults, so every print made before captions stays byte for
 * byte.
 */
export function captionLines(defaults: readonly (string | undefined)[], cap?: readonly (string | null)[]): Lines {
  const at = (i: number) => {
    const c = cap?.[i];
    return c === null || c === undefined ? defaults[i] : c || undefined;
  };
  return [at(0), at(1), at(2)];
}

/** A title block under a print: the name set bold and spaced, a line under it. A hidden title leaves its lines in place. */
export function caption(y: number, title: string | undefined, sub?: string, sub2?: string): string {
  let s = title ? text(150, y, title.toUpperCase(), title.length > 22 ? 10 : 12, { bold: true, spacing: title.length > 22 ? 1 : 2.5 }) : "";
  // Sized to fit the print's width (a monospace character is 0.6 em).
  const fit = (t: string, max: number) => Math.min(max, 264 / (0.6 * t.length));
  if (sub) s += text(150, y + 15, sub, fit(sub, 8));
  if (sub2) s += text(150, y + 27, sub2, fit(sub2, 7));
  return s;
}

export { julian };
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const longDate = (y: number, mo: number, d: number) => `${d} ${MONTHS[mo - 1]} ${y}`;
export const shortMonth = (mo: number) => MONTHS[mo - 1].slice(0, 3).toUpperCase();
export const norm360 = (a: number) => ((a % 360) + 360) % 360;
