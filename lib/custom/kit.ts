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
 * condensed sans and a blackletter for mastheads; and the house faces every
 * Make print is set in (the type system below: HOUSE). The SVG names the
 * family; resvg (the gate) and the canvas preview load the same files.
 */
export type Family = "mono" | "serif" | "condensed" | "blackletter" | "plex" | "grotesk" | "roman" | "display";
export const FONT_FAMILY: Record<Family, string> = {
  mono: "DejaVu Sans Mono, monospace",
  serif: "Libre Caslon Text, serif",
  condensed: "Oswald, sans-serif",
  blackletter: "UnifrakturMaguntia, serif",
  plex: "IBM Plex Mono, monospace",
  grotesk: "Space Grotesk, sans-serif",
  roman: "Cinzel, serif",
  display: "Playfair Display, serif",
};
export interface TextOpts {
  anchor?: "start" | "middle" | "end";
  bold?: boolean;
  spacing?: number;
  /** Mono unless given (and then written exactly as before, so every earlier print stays byte for byte). */
  family?: Family;
}

/**
 * The house style: every Make print is drawn inside house() (each template's
 * render), where the print's default face is IBM Plex Mono, not DejaVu Sans
 * Mono, and the caption is the house lockup (caption, below). Outside it,
 * the kit draws exactly as before, so the catalogue's computed prints built
 * on the same templates (scripts/gen/set7) stay byte for byte. Drawing is
 * synchronous, so the scope is simply set and restored around the call.
 */
let inHouse = false;
export function house<T>(draw: () => T): T {
  const was = inHouse;
  inHouse = true;
  try {
    return draw();
  } finally {
    inHouse = was;
  }
}
/** The face a text is set in: its own, else the scope's default. */
export const faceOf = (family?: Family): Family => family ?? (inHouse ? "plex" : "mono");

/**
 * A line as a face can set it: a letter the face lacks (a place name's Ḥ or
 * ố in a face cut to the Latin it prints) becomes its base letter (Ḥ → H,
 * ố → ô or o), so it never falls back to another font, wider than measured.
 * The monospace face holds every place name's letters as they are.
 */
export function printable(s: string, family: Family = faceOf(), bold = false): string {
  if (family === "mono") return s;
  const faces = WIDTHS[family];
  const face = (bold ? faces.bold : undefined) ?? faces.regular;
  let out = "";
  for (const ch of s) {
    if (face[ch] !== undefined || ch === " ") {
      out += ch;
      continue;
    }
    // The letter with fewer marks, then bare: the first the face holds.
    const bare = ch.normalize("NFD");
    const one = bare.length > 2 ? (bare[0] + bare[1]).normalize("NFC") : "";
    out += one && face[one] !== undefined ? one : face[bare[0]] !== undefined ? bare[0] : ch;
  }
  return out;
}

/** Text in the print's type (monospace unless a family is given), centred unless an anchor is given. */
export const text = (x: number, y: number, s: string, size: number, opts: TextOpts = {}) =>
  `<text x="${f1(x)}" y="${f1(y)}" fill="${INK}" font-size="${size}" font-family="${FONT_FAMILY[faceOf(opts.family)]}" text-anchor="${opts.anchor ?? "middle"}"${opts.bold ? ` font-weight="bold"` : ""}${opts.spacing ? ` letter-spacing="${opts.spacing}"` : ""}>${esc(printable(s, faceOf(opts.family), opts.bold))}</text>`;

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
  const family = faceOf(opts.family);
  let em = 0;
  if (family === "mono") em = chars.length * MONO_ADVANCE;
  else {
    const faces = WIDTHS[family];
    const face = (opts.bold ? faces.bold : undefined) ?? faces.regular;
    for (const ch of printable(s, family, opts.bold)) em += (face[ch] ?? MISSING * 1000) / 1000;
  }
  return em * size + chars.length * (opts.spacing ?? 0);
}

/** Each face's capital height, em (the fonts' OS/2 sCapHeight): a line of capitals sits optically centred on y at baseline y + CAP * size / 2. */
export const CAP: Record<Family, number> = { mono: 0.729, serif: 0.77, condensed: 0.81, blackletter: 0.688, plex: 0.698, grotesk: 0.7, roman: 0.7, display: 0.708 };

/**
 * The house stroke scale (print units; 1 ≈ 0.93 mm on the tee): hairline for
 * rules and grids, fine for secondary line work, regular for the drawing, bold
 * for a frame or a key line. Nothing prints under 0.4 (below the screen's
 * reliable line), and a drawing's line sits near its type's stem: a 1.2 line
 * beside 9-unit bold capitals, a 0.8 one beside 7-unit text.
 */
export const STROKE = { hairline: 0.5, fine: 0.8, regular: 1.2, bold: 1.8 } as const;

/**
 * The size at which `s` fills `width` (its tracking counted, em per letter),
 * at most `max`, rounded down to a tenth; never under `floor` (a template
 * that must not overflow checks textWidth at the floor itself, or cuts).
 */
export function fitSize(s: string, width: number, max: number, opts: Pick<TextOpts, "bold" | "family"> & { track?: number; floor?: number } = {}): number {
  const per = textWidth(s, 1, opts) + [...s].length * (opts.track ?? 0);
  const size = per > 0 ? Math.min(max, width / per) : max;
  return Math.max(opts.floor ?? 0, Math.floor(size * 10) / 10);
}

/** A line cut to fit `width` at `size`, an ellipsis ending it when cut. */
export function clip(s: string, width: number, size: number, opts: Pick<TextOpts, "bold" | "family" | "spacing"> = {}): string {
  if (textWidth(s, size, opts) <= width) return s;
  const chars = [...s];
  while (chars.length > 1 && textWidth(chars.join("").trimEnd() + "…", size, opts) > width) chars.pop();
  return chars.join("").trimEnd() + "…";
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
  const family = faceOf(opts.family);
  const chars = [...printable(s, family, opts.bold)];
  const track = opts.track ?? ARC_TRACK;
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
  const family = faceOf(opts.family);
  const chars = [...printable(s, family, opts.bold)];
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
  if (inHouse) return houseCaption(y, title, sub, sub2);
  // Measured as set, in capitals (a letter may grow: ß is SS), and never wider than the print.
  const t = title?.toUpperCase();
  const long = !!t && t.length > 22;
  const spacing = long ? 1 : 2.5;
  let s = t ? text(150, y, t, Math.min(long ? 10 : 12, Math.floor(((264 / t.length - spacing) / MONO_ADVANCE) * 10) / 10), { bold: true, spacing }) : "";
  // Sized to fit the print's width (a monospace character is 0.6 em).
  const fit = (t: string, max: number) => Math.min(max, 264 / (0.6 * t.length));
  if (sub) s += text(150, y + 15, sub, fit(sub, 8));
  if (sub2) s += text(150, y + 27, sub2, fit(sub2, 7));
  return s;
}

/** The widest a caption line runs: the print less a 22-unit margin each side. */
const CAPTION_W = 256;
/** A size that sets `s` within `w` at most `max`, in tenths (never under `floor`). */
const sizeFor = (s: string, w: number, max: number, floor: number, opts: Pick<TextOpts, "bold" | "family">, track: number) =>
  Math.max(floor, Math.floor(Math.min(max, w / (textWidth(s, 1, opts) + [...s].length * track)) * 10) / 10);

/**
 * The house caption lockup (every Make print): the title in Space Grotesk
 * Bold capitals, tracked a sixth of an em; the lines under it in IBM Plex
 * Mono, lightly tracked, a step down each. The same baselines as the old
 * caption (y, y + 15, y + 27), so every layout keeps its place; the tracking
 * scales with the size, so a long title tightens as it shrinks.
 */
function houseCaption(y: number, title: string | undefined, sub?: string, sub2?: string): string {
  let s = "";
  const t = title?.toUpperCase();
  if (t) {
    const size = sizeFor(t, CAPTION_W, 12, 6, { family: "grotesk", bold: true }, 0.16);
    // SVG's letter-spacing follows the last letter too, and a centred line counts it: shifted half a space right, the letters centre.
    const spacing = Math.round(size * 1.6) / 10;
    s += text(150 + spacing / 2, y, t, size, { family: "grotesk", bold: true, spacing });
  }
  const small = (line: string, max: number) => {
    const size = sizeFor(line, CAPTION_W, max, 4.5, { family: "plex" }, 0.05);
    return { size, spacing: Math.round(size * 0.5) / 10 };
  };
  if (sub) {
    const f = small(sub, 7.6);
    s += text(150 + f.spacing / 2, y + 15, sub, f.size, { family: "plex", spacing: f.spacing });
  }
  if (sub2) {
    const f = small(sub2, 6.6);
    s += text(150 + f.spacing / 2, y + 27, sub2, f.size, { family: "plex", spacing: f.spacing });
  }
  return s;
}

export { julian };
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const longDate = (y: number, mo: number, d: number) => `${d} ${MONTHS[mo - 1]} ${y}`;
export const shortMonth = (mo: number) => MONTHS[mo - 1].slice(0, 3).toUpperCase();
export const norm360 = (a: number) => ((a % 360) + 360) % 360;
