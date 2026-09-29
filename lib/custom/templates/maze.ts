/**
 * Your Maze: a perfect maze whose one way through spells the initials
 * (lib/custom/draw/maze), drawn like the catalogue's Matrix designs: a
 * letter hidden in a regular grid of cells, the way the LED grid hides a
 * figure in its dots. Walls are runs of one weight (merged along each grid
 * line); the entrance and exit are gaps in the frame with an arrow at each.
 * With `s: 1` the way through is drawn as a thin dotted line, and the
 * letters appear.
 */
import { INK, caption, f1 } from "../kit";
import { AREA, E, S, buildMaze } from "../draw/maze";
import type { CustomSpec } from "../spec";
import { MAZE_LEVEL_NAMES, dotted, type Params } from "../specs/maze";
import { wrap } from "../svg";
import type { BaseColor } from "@/types/shirt";

const TOP = 32;

export function mazeBody(p: Params): string {
  const mz = buildMaze(p.x, p.d);
  const { cols, rows, cell, open } = mz;
  const x0 = 150 - (cols * cell) / 2, y0 = TOP + (AREA.h - rows * cell) / 2;
  const X = (c: number) => x0 + c * cell, Y = (r: number) => y0 + r * cell;
  const wall = Math.min(1.1, Math.max(0.5, cell * 0.14));
  let d = "";
  // Horizontal walls: the top of each row (the frame's top included), then the frame's bottom, as runs.
  for (let r = 0; r <= rows; r++) {
    let run = -1;
    for (let c = 0; c <= cols; c++) {
      const shut = c < cols && (r === rows ? !(open[(r - 1) * cols + c] & S) : r === 0 ? !(open[c] & 1) : !(open[r * cols + c] & 1));
      if (shut && run < 0) run = c;
      if (!shut && run >= 0) (d += `M${f1(X(run))} ${f1(Y(r))}H${f1(X(c))}`), (run = -1);
    }
  }
  // Vertical walls: the left of each column, then the frame's right.
  for (let c = 0; c <= cols; c++) {
    let run = -1;
    for (let r = 0; r <= rows; r++) {
      const shut = r < rows && (c === 0 || c === cols ? true : !(open[r * cols + c - 1] & E));
      if (shut && run < 0) run = r;
      if (!shut && run >= 0) (d += `M${f1(X(c))} ${f1(Y(run))}V${f1(Y(r))}`), (run = -1);
    }
  }
  let s = `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${f1(wall)}" stroke-linecap="square"/>`;

  // In at the top, out at the bottom: an arrow at each gap.
  const arrow = (x: number, ya: number, yb: number) => `<path d="M${f1(x)} ${f1(ya)}V${f1(yb)}M${f1(x - 2.6)} ${f1(yb - 2.8)}L${f1(x)} ${f1(yb)}L${f1(x + 2.6)} ${f1(yb - 2.8)}" fill="none" stroke="${INK}" stroke-width=".9" stroke-linecap="round" stroke-linejoin="round"/>`;
  const [entry, exit] = [mz.path[0], mz.path[mz.path.length - 1]];
  s += arrow(X((entry % cols) + 0.5), y0 - 11, y0 - 2.5);
  s += arrow(X((exit % cols) + 0.5), Y(rows) + 2.5, Y(rows) + 11);

  if (p.s) {
    const pts = mz.path.map((q) => `${f1(X((q % cols) + 0.5))} ${f1(Y(Math.floor(q / cols) + 0.5))}`);
    const w = Math.max(0.5, Math.min(0.9, cell * 0.16));
    s += `<path d="M${f1(X((entry % cols) + 0.5))} ${f1(y0 - 1)}L${pts.join("L")}L${f1(X((exit % cols) + 0.5))} ${f1(Y(rows) + 1)}" fill="none" stroke="${INK}" stroke-width="${f1(w)}" stroke-dasharray="${f1(w)} ${f1(Math.max(1.2, w * 2))}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }

  const sub = p.s ? "The one way through, dotted." : "In at the top, out at the bottom. One way through.";
  return s + caption(340, p.w ?? dotted(p.x), sub, `${MAZE_LEVEL_NAMES[p.d]} · ${cols} by ${rows}`);
}

export const render = (spec: CustomSpec, color: BaseColor) => wrap(mazeBody((spec as { p: Params }).p), color);
