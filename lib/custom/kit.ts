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

/** A title block under a print: the name set bold and spaced, a line under it. */
export function caption(y: number, title: string, sub?: string, sub2?: string): string {
  let s = text(150, y, title.toUpperCase(), title.length > 22 ? 10 : 12, { bold: true, spacing: title.length > 22 ? 1 : 2.5 });
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
