/**
 * Your Landmarks: a page of a travel journal. The landmarks in a grid (three
 * across, one to three rows), each a line drawing (draw/landmarks) in a
 * frame taped in at its top corners, its name and the year under it,
 * and under the page the name and the years ("NOA · 2009–2026").
 */
import { INK, caption, captionLines, f1, rect, text, textWidth, type Lines } from "../kit";
import { landmarkSvg } from "../draw/landmarks";
import { LANDMARKS, type Params } from "../specs/landmarks";
import type { CustomSpec } from "../spec";
import { wrap } from "../svg";
import type { BaseColor } from "@/types/shirt";

const COND = "condensed" as const;
const AREA = { x: 24, y: 30, w: 252, h: 262 };
const GAP = 10;

/** The years as a span ("2009–2026"), or the one year, or nothing. */
export function spanOf(p: Params): string {
  const ys = p.x.flatMap(([, y]) => (y ? [y] : []));
  if (!ys.length) return "";
  const [lo, hi] = [Math.min(...ys), Math.max(...ys)];
  return lo === hi ? String(lo) : `${lo}–${hi}`;
}

/** The line under the page: the name and the years. */
export const footOf = (p: Params) => [p.n?.toUpperCase(), spanOf(p)].filter(Boolean).join(" · ") || "PLACES VISITED";

/** The caption's lines (ours). */
export function landmarksCaption(p: Params): Lines {
  const span = spanOf(p);
  return [p.n ? `${p.n}’s landmarks` : "Landmarks", `${p.x.length} landmarks${span ? ` · ${span}` : ""}`, "Every one drawn for the shirt"];
}

/** The grid for n tiles: three across, as many rows as it takes; tiles a little taller than wide. */
export function gridOf(n: number) {
  const cols = n === 4 ? 2 : 3;
  const rows = Math.ceil(n / cols);
  const w = (AREA.w - (cols - 1) * GAP) / cols;
  const h = Math.min((AREA.h - (rows - 1) * GAP) / rows, w * 1.3);
  const top = AREA.y + (AREA.h - (rows * h + (rows - 1) * GAP)) / 2;
  return Array.from({ length: n }, (_, i) => {
    const r = Math.floor(i / cols);
    // A short last row is centred.
    const inRow = Math.min(cols, n - r * cols);
    const left = AREA.x + (AREA.w - (inRow * w + (inRow - 1) * GAP)) / 2;
    return { x: left + (i % cols) * (w + GAP), y: top + r * (h + GAP), w, h };
  });
}

/** A strip of tape across a corner: a slanted rectangle, drawn by its corners. */
function tape(cx: number, cy: number, deg: number, len: number): string {
  const [c, s] = [Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180)];
  const pts = [[-len / 2, -2.6], [len / 2, -2.6], [len / 2, 2.6], [-len / 2, 2.6]].map(([u, v]) => `${f1(cx + u * c - v * s)} ${f1(cy + u * s + v * c)}`);
  return `<path d="M${pts.join("L")}Z" fill="none" stroke="${INK}" stroke-width=".6" stroke-linejoin="round"/>`;
}

export function landmarksBody(p: Params): string {
  let s = rect(14, 18, 272, 306, 0.6);
  const tiles = gridOf(p.x.length);
  p.x.forEach(([id, year], i) => {
    const t = tiles[i];
    s += rect(t.x, t.y, t.w, t.h, 1);
    s += tape(t.x + 5, t.y + 3, -35, 16) + tape(t.x + t.w - 5, t.y + 3, 35, 16);
    const label = t.h < 60 ? 11 : 15;
    s += landmarkSvg(id, t.x + 5, t.y + 7, t.w - 10, t.h - 12 - label);
    const name = LANDMARKS[id].toUpperCase();
    const size = Math.min(label < 15 ? 5 : 6, (t.w - 8) / textWidth(name, 1, { family: COND, bold: true }));
    s += text(t.x + t.w / 2, t.y + t.h - label + size + 1.5, name, Math.round(size * 10) / 10, { family: COND, bold: true, spacing: 0.3 });
    if (year) s += text(t.x + t.w / 2, t.y + t.h - 2.5, String(year), label < 15 ? 4 : 4.8);
  });
  const foot = footOf(p);
  s += text(150, 312, foot, Math.min(9, 240 / textWidth(foot, 1, { family: COND, bold: true, spacing: 0 }) ), { family: COND, bold: true, spacing: 1.5 });
  return s + caption(346, ...captionLines(landmarksCaption(p), p.cap));
}

export const captionOf = (spec: CustomSpec) => landmarksCaption((spec as { p: Params }).p);

export const render = (spec: CustomSpec, color: BaseColor) => wrap(landmarksBody((spec as { p: Params }).p), color);
