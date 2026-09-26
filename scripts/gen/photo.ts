/**
 * Photographs as single-ink screen prints (the photo categories).
 *
 * A photograph can't be flipped for the other tee colour the way the drawn
 * prints are: inverting a halftone turns it into a negative. So each photo
 * print is rendered twice, once per colourway, and both are positives:
 * on a black tee the white ink lays down the photograph's lights, on a
 * white tee the black ink lays down its darks.
 *
 * Input: data/photos/img/<key>.png — 180×240 grey + alpha (alpha 0 is
 * background removed around an isolated object; see scripts/photos).
 */
import { readFileSync } from "node:fs";
// @ts-expect-error — upng-js ships no types
import UPNG from "upng-js";
import type { BaseColor } from "../../types/shirt";
import { W, H } from "./core";

export interface Photo {
  w: number;
  h: number;
  /** Brightness 0–1. */
  gray: Float32Array;
  /** Coverage 0–1 (0 = removed background). */
  alpha: Float32Array;
}

export function loadPhoto(file: string): Photo {
  const png = UPNG.decode(readFileSync(file).buffer as ArrayBuffer);
  const rgba = new Uint8Array(UPNG.toRGBA8(png)[0]);
  const n = png.width * png.height;
  const gray = new Float32Array(n);
  const alpha = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    gray[i] = rgba[i * 4] / 255;
    alpha[i] = rgba[i * 4 + 3] / 255;
  }
  return { w: png.width, h: png.height, gray, alpha };
}

/** The photograph's place on the print: 264 × 352 (3:4), centred. */
export const REGION = { x: 18, y: 24, w: 264, h: 352 } as const;

export type Treatment = "dots" | "pop" | "lines";

export const TREATMENT_LABEL: Record<Treatment, string> = {
  dots: "a fine 45° halftone",
  pop: "a coarse, bold halftone",
  lines: "a horizontal line screen",
};

const smoothstep = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/**
 * Ink (0–1) at a print coordinate, for a tee colour: the lights in white
 * ink on black, the darks in black ink on white. Full-frame photographs
 * fade out over the last 14 units so the print has no hard box edge.
 */
export function inkAt(p: Photo, x: number, y: number, color: BaseColor, frame: boolean): number {
  const u = ((x - REGION.x) / REGION.w) * p.w - 0.5;
  const v = ((y - REGION.y) / REGION.h) * p.h - 0.5;
  if (u < -0.5 || v < -0.5 || u > p.w - 0.5 || v > p.h - 0.5) return 0;
  const x0 = Math.max(0, Math.min(p.w - 1, Math.floor(u)));
  const y0 = Math.max(0, Math.min(p.h - 1, Math.floor(v)));
  const x1 = Math.min(p.w - 1, x0 + 1);
  const y1 = Math.min(p.h - 1, y0 + 1);
  const fx = Math.min(1, Math.max(0, u - x0));
  const fy = Math.min(1, Math.max(0, v - y0));
  const at = (arr: Float32Array) =>
    (arr[y0 * p.w + x0] * (1 - fx) + arr[y0 * p.w + x1] * fx) * (1 - fy) + (arr[y1 * p.w + x0] * (1 - fx) + arr[y1 * p.w + x1] * fx) * fy;
  // A touch more contrast: screened midtones otherwise read as mud.
  const g = Math.min(1, Math.max(0, 0.5 + (at(p.gray) - 0.5) * 1.15));
  let a = at(p.alpha);
  if (frame) {
    const edge = Math.min(x - REGION.x, REGION.x + REGION.w - x, y - REGION.y, REGION.y + REGION.h - y);
    a *= smoothstep(0, 14, edge);
  }
  // White ink spreads on black cotton, black ink reads heavier on white: a
  // little more gamma on the lights, a little less on the darks.
  const ink = color === "black" ? Math.pow(g, 1.25) : Math.pow(1 - g, 1.1);
  return ink * a;
}

/** Mean ink over a small square (anti-aliasing for one screen cell). */
function cellInk(p: Photo, x: number, y: number, r: number, color: BaseColor, frame: boolean) {
  let s = 0;
  for (const dx of [-r, 0, r]) for (const dy of [-r, 0, r]) s += inkAt(p, x + dx, y + dy, color, frame);
  return s / 9;
}

const num = (n: number) => {
  const s = (Math.round(n * 100) / 100).toString();
  return s.replace(/^0\./, ".").replace(/^-0\./, "-.");
};

/**
 * Amplitude-modulated halftone: round dots on a screen of `pitch` units at
 * `angle`°, dot area = ink. Dots are grouped by size (one path per size)
 * and drawn as round-capped zero-length strokes in screen-cell units, which
 * keeps each print small.
 */
function halftone(p: Photo, color: BaseColor, frame: boolean, ink: string, pitch: number, angle: number): string {
  const rad = (angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const cx = W / 2;
  const cy = H / 2;
  const reach = Math.ceil(Math.hypot(REGION.w, REGION.h) / 2 / pitch) + 1;
  const levels = new Map<number, { i: number; j: number }[]>();
  for (let j = -reach; j <= reach; j++)
    for (let i = -reach; i <= reach; i++) {
      const x = cx + pitch * (i * cos - j * sin);
      const y = cy + pitch * (i * sin + j * cos);
      if (x < REGION.x - 1 || x > REGION.x + REGION.w + 1 || y < REGION.y - 1 || y > REGION.y + REGION.h + 1) continue;
      const a = cellInk(p, x, y, pitch / 3, color, frame);
      if (a < 0.04) continue;
      // Area fraction a of the cell → diameter in cell units (0.05 steps; overlap near solid).
      const d = Math.min(1.2, Math.round(2 * Math.sqrt(a / Math.PI) * 20) / 20);
      if (d < 0.1) continue;
      const list = levels.get(d) ?? [];
      list.push({ i, j });
      levels.set(d, list);
    }
  const paths = [...levels.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([d, cells]) => {
      let out = "";
      let pi = 0;
      let pj = 0;
      cells.forEach((c, k) => {
        out += k === 0 ? `M${c.i} ${c.j}h0` : `m${c.i - pi} ${c.j - pj}h0`;
        pi = c.i;
        pj = c.j;
      });
      return `<path stroke-width="${num(d)}" d="${out}"/>`;
    })
    .join("");
  return `<g fill="none" stroke="${ink}" stroke-linecap="round" transform="translate(${cx} ${cy}) rotate(${angle}) scale(${pitch})">${paths}</g>`;
}

/**
 * Line screen: horizontal lines `pitch` apart whose thickness follows the
 * ink, sampled every 2 units and grouped by thickness (ten steps).
 */
function lineScreen(p: Photo, color: BaseColor, frame: boolean, ink: string, pitch: number): string {
  const step = 2;
  const cols = Math.round(REGION.w / step);
  const rows = Math.floor(REGION.h / pitch);
  const levels = new Map<number, string[]>();
  for (let r = 0; r < rows; r++) {
    const y = REGION.y + (r + 0.5) * pitch;
    let runLevel = 0;
    let runStart = 0;
    const flush = (end: number) => {
      if (runLevel > 0 && end > runStart) {
        const l = levels.get(runLevel) ?? [];
        l.push(`M${runStart} ${r}h${end - runStart}`);
        levels.set(runLevel, l);
      }
    };
    for (let c = 0; c <= cols; c++) {
      let level = 0;
      if (c < cols) {
        const x = REGION.x + (c + 0.5) * step;
        let a = 0;
        for (const dy of [-pitch / 3, 0, pitch / 3]) a += inkAt(p, x, y + dy, color, frame);
        a /= 3;
        level = a < 0.05 ? 0 : Math.min(10, Math.max(1, Math.round(a * 10)));
      }
      if (level !== runLevel) {
        flush(c);
        runLevel = level;
        runStart = c;
      }
    }
  }
  const paths = [...levels.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([l, segs]) => `<path stroke-width="${num(l / 10)}" d="${segs.join("")}"/>`)
    .join("");
  // Local units: x in samples (2 units), y in lines; stroke width in line pitches.
  return `<g fill="none" stroke="${ink}" transform="translate(${REGION.x} ${REGION.y + pitch / 2}) scale(${step} ${pitch})">${paths}</g>`;
}

/** The print body (without the ground) for one tee colour. */
export function photoBody(p: Photo, treatment: Treatment, color: BaseColor, frame: boolean): string {
  const ink = color === "black" ? "#FFFFFF" : "#000000";
  if (treatment === "lines") return lineScreen(p, color, frame, ink, 4.4);
  if (treatment === "pop") return halftone(p, color, frame, ink, 6.2, 45);
  return halftone(p, color, frame, ink, 3.8, 45);
}

/** Average ink over the print area for a colour (0–1): density. */
export function photoCoverage(p: Photo, color: BaseColor, frame: boolean): number {
  let s = 0;
  let n = 0;
  for (let y = REGION.y; y < REGION.y + REGION.h; y += 4)
    for (let x = REGION.x; x < REGION.x + REGION.w; x += 4) {
      s += inkAt(p, x, y, color, frame);
      n++;
    }
  return s / n;
}
