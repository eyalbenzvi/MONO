/**
 * Measured building drawings: brick bonds in true brick proportions
 * (215 × 102.5 × 65 mm, 10 mm joints), Vignola's five orders in their module
 * proportions, and the brutalist facade grid of bays. The catalogue sets them
 * at fixed sizes and seeds; a template passes its own box and numbers.
 */
import { INK, circle, f1, line, path, polyline, rect, text } from "../kit";
import type { Box, Point } from "./paths";

/** A convex polygon cut to an axis-aligned box (Sutherland–Hodgman), so a turned brick ends exactly at the panel's edge. */
export function clipToBox(poly: Point[], x0: number, y0: number, x1: number, y1: number): Point[] {
  const edges: [(p: Point) => boolean, (a: Point, b: Point) => Point][] = [
    [(p) => p[0] >= x0, (a, b) => [x0, a[1] + ((b[1] - a[1]) * (x0 - a[0])) / (b[0] - a[0])]],
    [(p) => p[0] <= x1, (a, b) => [x1, a[1] + ((b[1] - a[1]) * (x1 - a[0])) / (b[0] - a[0])]],
    [(p) => p[1] >= y0, (a, b) => [a[0] + ((b[0] - a[0]) * (y0 - a[1])) / (b[1] - a[1]), y0]],
    [(p) => p[1] <= y1, (a, b) => [a[0] + ((b[0] - a[0]) * (y1 - a[1])) / (b[1] - a[1]), y1]],
  ];
  let out = poly;
  for (const [inside, cross] of edges) {
    const input = out;
    out = [];
    input.forEach((p, i) => {
      const prev = input[(i + input.length - 1) % input.length];
      if (inside(p)) {
        if (!inside(prev)) out.push(cross(prev, p));
        out.push(p);
      } else if (inside(prev)) out.push(cross(prev, p));
    });
    if (!out.length) break;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Brick bonds                                                          */
/* ------------------------------------------------------------------ */

export type Bond = "stretcher" | "english" | "flemish" | "header" | "herringbone";

/**
 * A panel of brickwork in a bond, clipped to its box and framed. `scale` is
 * print units per millimetre (0.3 makes a stretcher 67.5 wide with its
 * joint); `id` names the clip path, unique within the print.
 */
export function brickBond(bond: Bond, o: { box?: Box; scale?: number; id?: string } = {}): string {
  const S = o.scale ?? 0.3, L = 225 * S, Hd = 112.5 * S, C = 75 * S, J = 10 * S;
  const { x: X0, y: Y0, w: WW, h: HH } = o.box ?? { x: 30, y: 36, w: 240, h: 240 };
  const id = o.id ?? `c${bond}`;
  const brick = (x: number, y: number, w: number) => rect(x, y, w - J, C - J, 0.9);
  const course = (y: number, units: number[], offset: number) => {
    let s = "", x = X0 - offset;
    let i = 0;
    while (x < X0 + WW) {
      const w = units[i++ % units.length];
      s += brick(x, y, w);
      x += w;
    }
    return s;
  };
  const courses = (fn: (row: number, y: number) => string) => {
    let s = "";
    for (let row = 0, y = Y0; y < Y0 + HH; row++, y += C) s += fn(row, y);
    return s;
  };
  const herringbone = () => {
    // Herringbone (2:1 bricks): along each diagonal a flat brick, then an upright one beside it; the strips repeat
    // every four units. Turned 45° and cut to the panel exactly (each brick's outline clipped), so no line leaves it.
    const u = Hd;
    const cx = X0 + WW / 2, cy = Y0 + HH / 2;
    // How far the bricks must reach: the catalogue's 240 panel at 0.3 needs 190 around the centre, and 8 × 14 strips.
    const reach = Math.max(WW, HH) / 240, f = reach * (0.3 / S);
    const turn = ([x, y]: Point): Point => {
      const [dx, dy] = [x - cx, y - cy];
      return [cx + (dx - dy) * Math.SQRT1_2, cy + (dx + dy) * Math.SQRT1_2];
    };
    const brickAt = (x: number, y: number, w: number, h: number) => {
      const poly = clipToBox([turn([x, y]), turn([x + w, y]), turn([x + w, y + h]), turn([x, y + h])], X0, Y0, X0 + WW, Y0 + HH);
      return poly.length >= 3 ? path(polyline(poly, true), 0.9) : "";
    };
    let s = "";
    const mm = Math.ceil(8 * f), kk = Math.ceil(14 * f);
    for (let m = -mm; m <= mm; m++)
      for (let k = -kk; k <= kk; k++) {
        const ox = cx + (k + 4 * m) * u, oy = cy + k * u;
        // Only bricks that can reach the panel (turning keeps the distance to the centre).
        if (Math.hypot(ox + u - cx, oy + u / 2 - cy) > 190 * reach) continue;
        s += brickAt(ox, oy, 2 * u - J, u - J) + brickAt(ox + 2 * u, oy - u, u - J, 2 * u - J);
      }
    return s;
  };
  const bricks =
    bond === "stretcher" ? courses((r, y) => course(y, [L], r % 2 ? L / 2 : 0))
    : bond === "english" ? courses((r, y) => (r % 2 ? course(y, [Hd], Hd / 2) : course(y, [L], 0)))
    : bond === "flemish" ? courses((r, y) => course(y, [Hd, L], r % 2 ? Hd / 2 + L / 2 : 0))
    : bond === "header" ? courses((r, y) => course(y, [Hd], r % 2 ? Hd / 2 : 0))
    : herringbone();
  return `<defs><clipPath id="${id}"><rect x="${X0}" y="${Y0}" width="${WW}" height="${HH}"/></clipPath></defs><g clip-path="url(#${id})">${bricks}</g>` + rect(X0, Y0, WW, HH, 1.4);
}

/* ------------------------------------------------------------------ */
/* The five orders                                                      */
/* ------------------------------------------------------------------ */

/** Vignola's orders and their column heights in lower diameters. */
export const ORDERS: [string, number][] = [["Tuscan", 7], ["Doric", 8], ["Ionic", 9], ["Corinthian", 10], ["Composite", 10]];

/**
 * Classical columns side by side on one ground line, each with base, tapering
 * shaft, capital (volutes for Ionic and Composite, leaves for Corinthian and
 * Composite) and an entablature a quarter of its height. `d` is one lower
 * diameter; the first column stands at x0, the next `step` along.
 */
export function orders(o: { orders?: [string, number][]; base?: number; d?: number; x0?: number; step?: number } = {}): string {
  const list = o.orders ?? ORDERS, base = o.base ?? 262, D = o.d ?? 19, x0 = o.x0 ?? 42, step = o.step ?? 54;
  let s = line(18, base, 282, base, 1.2);
  list.forEach(([name, h], i) => {
    const cx = x0 + i * step;
    const colH = h * D, top = base - colH;
    const leafy = name === "Corinthian" || name === "Composite";
    const capH = leafy ? D * (7 / 6) : name === "Ionic" ? D / 3 : D / 2;
    const topW = D * (5 / 6);
    // Base: plinth and torus, half a diameter.
    s += rect(cx - D * 0.66, base - D / 4, D * 1.32, D / 4, 1) + rect(cx - D * 0.58, base - D / 2, D * 1.16, D / 4, 1);
    // Shaft: straight for its lower third, tapering to 5/6 D.
    const shaftBot = base - D / 2, shaftTop = top + capH, third = shaftBot - (shaftBot - shaftTop) / 3;
    s += path(polyline([[cx - D / 2, shaftBot], [cx - D / 2, third], [cx - topW / 2, shaftTop]]), 1.2) + path(polyline([[cx + D / 2, shaftBot], [cx + D / 2, third], [cx + topW / 2, shaftTop]]), 1.2);
    // Capital: bell or echinus up to the abacus.
    const abH = Math.min(D / 4, capH * 0.35);
    s += path(polyline([[cx - topW / 2, shaftTop], [cx - D * 0.62, top + abH], [cx + D * 0.62, top + abH], [cx + topW / 2, shaftTop]], true), 1) + rect(cx - D * 0.68, top, D * 1.36, abH, 1);
    if (name === "Ionic" || name === "Composite") s += circle(cx - D * 0.62, top + abH + D * 0.17, D * 0.17, 0.9) + circle(cx + D * 0.62, top + abH + D * 0.17, D * 0.17, 0.9);
    if (leafy) for (let k = 0; k < 3; k++) s += path(`M${f1(cx - topW / 2 + (k * topW) / 3)} ${f1(shaftTop)}q${f1(topW / 6)} ${f1(-capH * 0.55)} ${f1(topW / 3)} 0`, 0.8);
    // Entablature, a quarter of the column: architrave, frieze, cornice.
    const e = colH / 4;
    s += rect(cx - D * 0.62, top - e * 0.3, D * 1.24, e * 0.3, 1) + rect(cx - D * 0.62, top - e * 0.65, D * 1.24, e * 0.35, 0.8) + rect(cx - D * 0.85, top - e, D * 1.7, e * 0.35, 1);
    s += text(cx, base + 12, name.toUpperCase(), 5.5, { bold: true }) + text(cx, base + 21, `${h} D`, 5.5);
  });
  return s;
}

/* ------------------------------------------------------------------ */
/* Facade grid                                                          */
/* ------------------------------------------------------------------ */

export interface Facade {
  cols: number;
  rows: number;
  /** The gap between bays, in print units. */
  gap: number;
  /** The outline's stroke width. */
  sw: number;
  /** Rows filled solid from side to side (a band of spandrel). */
  bands: Set<number>;
  /** Whether a bay is filled, asked in reading order (row by row, band rows skipped). */
  filled: (row: number, col: number) => boolean;
  box: Box;
  /** The ink colour (the first catalogue set draws in more than white). */
  ink?: string;
}

/** A brutalist facade grid of bays, some filled; returns the drawing and how many bays came out filled (bands count whole). */
export function facadeGrid(o: Facade): { body: string; filled: number } {
  const { cols, rows, gap, sw, bands, box } = o;
  const ink = o.ink ?? INK;
  const { x: X0, y: Y0, w: IW, h: IH } = box;
  const cw = IW / cols;
  const ch = IH / rows;
  let filled = 0;
  let cells = `<rect x="${X0}" y="${Y0}" width="${IW}" height="${IH}"/>`;
  for (let r = 0; r < rows; r++) {
    if (bands.has(r)) {
      cells += `<rect x="${X0}" y="${f1(Y0 + r * ch + gap / 2)}" width="${IW}" height="${f1(ch - gap)}" fill="${ink}"/>`;
      filled += cols;
      continue;
    }
    for (let c = 0; c < cols; c++) {
      const on = o.filled(r, c);
      if (on) filled++;
      cells += `<rect x="${f1(X0 + c * cw + gap / 2)}" y="${f1(Y0 + r * ch + gap / 2)}" width="${f1(cw - gap)}" height="${f1(ch - gap)}"${on ? ` fill="${ink}"` : ""}/>`;
    }
  }
  return { body: `<g fill="none" stroke="${ink}" stroke-width="${sw}">${cells}</g>`, filled };
}
