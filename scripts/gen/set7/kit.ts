/**
 * Shared pieces of the seventh set (content overhaul, Part 3): designs made
 * from real data — star positions, orbital elements, scales and tables,
 * standard circuits, instrument faces. White ink on the 300 × 400 canvas
 * (the generator swaps the inks for a white tee).
 */
import type { FeatureKey, ShirtCategory } from "../../../types/shirt";
import { n1 } from "../core";

export interface Set7Design {
  body: string;
  variant: string;
  /** The shop category it is filed under (Part 4). */
  category: ShirtCategory;
  title: string;
  /** What the print shows, for its page title and search; the title when unset. */
  subject?: string;
  description: string;
  features: Partial<Record<FeatureKey, number>>;
  /** Near-identical designs share a key (families). */
  sigKey: string;
}

export const INK = "#FFFFFF";
export const DEG = Math.PI / 180;
export const f1 = (n: number) => n1(n).toString();

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Monospace text, centred unless an anchor is given. */
export const text = (x: number, y: number, s: string, size: number, opts: { anchor?: "start" | "middle" | "end"; bold?: boolean; spacing?: number } = {}) =>
  `<text x="${f1(x)}" y="${f1(y)}" fill="${INK}" font-size="${size}" font-family="DejaVu Sans Mono, monospace" text-anchor="${opts.anchor ?? "middle"}"${opts.bold ? ` font-weight="bold"` : ""}${opts.spacing ? ` letter-spacing="${opts.spacing}"` : ""}>${esc(s)}</text>`;

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

/** Julian date of a UTC moment. */
export const julian = (y: number, mo: number, d: number, h = 0, mi = 0) => Date.UTC(y, mo - 1, d, h, mi) / 86400000 + 2440587.5;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const longDate = (y: number, mo: number, d: number) => `${d} ${MONTHS[mo - 1]} ${y}`;
export const shortMonth = (mo: number) => MONTHS[mo - 1].slice(0, 3).toUpperCase();
export const norm360 = (a: number) => ((a % 360) + 360) % 360;
