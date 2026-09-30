/**
 * Your Landmarks: a page of a travel journal. The landmarks in a grid (three
 * across, one to three rows), each a line drawing (draw/landmarks) in a
 * frame taped in at its top corners, its name and the year under it,
 * and under the page the name and the years ("NOA · 2009–2026").
 */
import { CAP, INK, STROKE, caption, captionLines, clip, f1, fitSize, rect, text, type Lines, house } from "../kit";
import { landmarkSvg } from "../draw/landmarks";
import { LANDMARKS, type Params } from "../specs/landmarks";
import type { CustomSpec } from "../spec";
import { wrap } from "../svg";
import type { BaseColor } from "@/types/shirt";

const COND = "condensed" as const;
const AREA = { x: 30, y: 37, w: 240, h: 258 };
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
  return `<path d="M${pts.join("L")}Z" fill="none" stroke="${INK}" stroke-width="${STROKE.hairline}" stroke-linejoin="round"/>`;
}

export function landmarksBody(p: Params): string {
  // The page, inside the live area.
  let s = rect(22, 28, 256, 296, STROKE.hairline);
  const tiles = gridOf(p.x.length);
  p.x.forEach(([id, year], i) => {
    const t = tiles[i];
    s += rect(t.x, t.y, t.w, t.h, STROKE.fine);
    s += tape(t.x + 5, t.y + 3, -35, 16) + tape(t.x + t.w - 5, t.y + 3, 35, 16);
    const label = t.h < 60 ? 12 : 15;
    s += landmarkSvg(id, t.x + 5, t.y + 7, t.w - 10, t.h - 12 - label);
    // The name in condensed capitals, sized to the tile (never under the face's smallest), the year under it in the mono.
    const name = LANDMARKS[id].toUpperCase();
    const room = t.w - 8;
    const size = fitSize(name, room, label < 15 ? 5.5 : 6.5, { family: COND, bold: true, track: 0.06, floor: 5 });
    const yName = t.y + t.h - label + 1.5 + size * CAP.condensed;
    s += text(t.x + t.w / 2, yName, clip(name, room, size, { family: COND, bold: true, spacing: size * 0.06 }), size, { family: COND, bold: true, spacing: Math.round(size * 0.6) / 10 });
    if (year) s += text(t.x + t.w / 2, t.y + t.h - 2.5, String(year), label < 15 ? 4.5 : 5, { spacing: 0.3 });
  });
  // The foot: the name and the years, tracked capitals fitted to the page.
  const foot = footOf(p);
  const fs = fitSize(foot, 230, 10, { family: COND, bold: true, track: 0.14, floor: 5 });
  s += text(150, 310 + (fs * CAP.condensed) / 2 - 3, clip(foot, 230, fs, { family: COND, bold: true, spacing: fs * 0.14 }), fs, { family: COND, bold: true, spacing: Math.round(fs * 1.4) / 10 });
  return s + caption(346, ...captionLines(landmarksCaption(p), p.cap));
}

export const captionOf = (spec: CustomSpec) => landmarksCaption((spec as { p: Params }).p);

export const render = (spec: CustomSpec, color: BaseColor) => house(() => wrap(landmarksBody((spec as { p: Params }).p), color));
