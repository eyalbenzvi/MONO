/**
 * Your Route: the way you went, as a contour map of its own (drawn like the
 * catalogue's Topographic Contours). The route bold, rings of equal distance
 * round it as the contours (the level lines of its distance field, marching
 * squares), a quiet grid of crosses one scale-bar length apart, the start an
 * open ring and the finish a bullseye, north up. Under it, when the file
 * had heights, the profile as a strip of bars. No place is named or kept:
 * the spec holds the shape only (lib/custom/specs/route).
 */
import { CAP, INK, STROKE, caption, fitSize, f1, line, longDate, text, captionLines, type Lines, house } from "../kit";
import { titleWords } from "../specKit";
import { isolines } from "../draw/islandMarch";
import type { Point } from "../draw/paths";
import { simplify } from "../stroke";
import { ELEV_Q, km, routeElevation, routePoints, type Params } from "../specs/route";
import { parseDate, type CustomSpec } from "../spec";
import { GROUND, wrap } from "../svg";
import type { BaseColor } from "@/types/shirt";

const FX0 = 22, FX1 = 278, FY0 = 28;
/** Rings round the route: their distance (print units) and weight; the first seven always, the rest while the rings cover under COVER of the frame (a thin route in a wide frame). */
const RINGS: [number, number][] = [[5, 0.75], [10, 0.65], [15, 0.55], [20, 0.5], [26, 0.45], [33, 0.45], [41, 0.4], [49, 0.4], [57, 0.4], [65, 0.4], [73, 0.4], [81, 0.4], [89, 0.4]];
const COVER = 0.55;
const MARGIN = 26;
const CELL = 1.5;
const NICE = [10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10_000, 20_000, 25_000, 50_000, 100_000, 200_000, 250_000, 500_000];
const dist = (m: number) => (m >= 1000 ? `${m / 1000} km` : `${m} m`);

const pathOf = (pts: Point[], width: number | string, extra = "") => {
  let d = "";
  pts.forEach(([x, y], i) => (d += `${i ? "L" : "M"}${f1(x)} ${f1(y)}`));
  return `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"${extra}/>`;
};

/** The drawing, the caption's lines as ours, and where the caption sits. */
function routeDraw(p: Params): [string, Lines, number] {
  const grid = routePoints(p.r)!;
  const elev = p.e ? routeElevation(p.e) : null;
  const FY1 = elev ? 228 : 300;
  const gw = Math.max(...grid.map((q) => q[0])), gh = Math.max(...grid.map((q) => q[1]));
  const [bw, bh] = [FX1 - FX0 - 2 * MARGIN, FY1 - FY0 - 2 * MARGIN];
  const s = Math.min(bw / Math.max(gw, 1), bh / Math.max(gh, 1));
  const ox = (FX0 + FX1) / 2 - (gw * s) / 2, oy = (FY0 + FY1) / 2 - (gh * s) / 2;
  const pts: Point[] = grid.map(([x, y]) => [ox + x * s, oy + y * s]);
  let out = "";

  // The grid: a cross every scale-bar length (a file's route), or every 32 units (a drawn one).
  const perM = p.m ? s / p.m : 0;
  const bar = p.m ? (NICE.find((L) => L * perM >= 34) ?? NICE[NICE.length - 1]) : 0;
  const step = p.m ? bar * perM : 32;
  let cross = "";
  if (step >= 16) {
    const cx0 = ox - Math.ceil((ox - FX0) / step) * step, cy0 = oy - Math.ceil((oy - FY0) / step) * step;
    for (let x = cx0; x <= FX1; x += step)
      for (let y = cy0; y <= FY1; y += step) if (x > FX0 + 4 && x < FX1 - 4 && y > FY0 + 4 && y < FY1 - 4) cross += `M${f1(x - 2.2)} ${f1(y)}H${f1(x + 2.2)}M${f1(x)} ${f1(y - 2.2)}V${f1(y + 2.2)}`;
  }
  if (cross) out += `<path d="${cross}" fill="none" stroke="${INK}" stroke-width="${STROKE.hairline}"/>`;

  // The rings: level lines of the distance to the route, within the frame.
  const nx = Math.ceil((FX1 - FX0) / CELL) + 1, ny = Math.ceil((FY1 - FY0) / CELL) + 1;
  const far = RINGS[RINGS.length - 1][0] + 2;
  const field = new Float32Array(nx * ny).fill(far);
  for (let i = 0; i + 1 < pts.length; i++) {
    const [[ax, ay], [bx, by]] = [pts[i], pts[i + 1]];
    const [dx, dy] = [bx - ax, by - ay];
    const len2 = dx * dx + dy * dy || 1;
    const [i0, i1] = [Math.max(0, Math.floor((Math.min(ax, bx) - far - FX0) / CELL)), Math.min(nx - 1, Math.ceil((Math.max(ax, bx) + far - FX0) / CELL))];
    const [j0, j1] = [Math.max(0, Math.floor((Math.min(ay, by) - far - FY0) / CELL)), Math.min(ny - 1, Math.ceil((Math.max(ay, by) + far - FY0) / CELL))];
    for (let j = j0; j <= j1; j++)
      for (let k = i0; k <= i1; k++) {
        const [x, y] = [FX0 + k * CELL, FY0 + j * CELL];
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2));
        const d = Math.hypot(x - ax - t * dx, y - ay - t * dy);
        if (d < field[j * nx + k]) field[j * nx + k] = d;
      }
  }
  // Level lines of the negated field (inside = nearer than the ring).
  const neg = field.map((v) => -v);
  let rings = 7;
  while (rings < RINGS.length && field.filter((v) => v <= RINGS[rings - 1][0]).length < COVER * field.length) rings++;
  for (const [d, w] of RINGS.slice(0, rings))
    for (const run of isolines(neg, nx, ny, -d)) {
      const ring = simplify(run.pts.map(([x, y]) => [FX0 + x * CELL, FY0 + y * CELL] as Point), 0.25) as Point[];
      if (ring.length > 1) out += pathOf(run.closed ? [...ring, ring[0]] : ring, w);
    }

  // The frame, with ticks at the grid's lines along it.
  out += `<rect x="${FX0}" y="${FY0}" width="${FX1 - FX0}" height="${FY1 - FY0}" fill="none" stroke="${INK}" stroke-width="${STROKE.regular}"/>`;
  // The route, bold (less so when it is long and winds a lot in its box); the start an open ring, the finish a bullseye.
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  out += pathOf(pts, f1(Math.min(2.6, Math.max(1.4, 2.6 * Math.sqrt(1400 / len)))));
  const [sx, sy] = pts[0], [ex, ey] = pts[pts.length - 1];
  out += `<circle cx="${f1(ex)}" cy="${f1(ey)}" r="5.6" fill="${GROUND}" stroke="${INK}" stroke-width="1.1"/><circle cx="${f1(ex)}" cy="${f1(ey)}" r="2.8" fill="${INK}"/>`;
  out += `<circle cx="${f1(sx)}" cy="${f1(sy)}" r="4" fill="${GROUND}" stroke="${INK}" stroke-width="1.8"/>`;

  // Under the frame: the scale bar (a file's route) on the left, north on the right.
  const ry = FY1 + 9;
  if (p.m) {
    const L = bar * perM;
    out += line(FX0, ry, FX0 + L, ry, STROKE.bold) + line(FX0 + L, ry, FX0 + 2 * L, ry, STROKE.hairline) + [0, L, 2 * L].map((x) => line(FX0 + x, ry - 2.5, FX0 + x, ry + 2.5, STROKE.fine)).join("");
    out += text(FX0 + 2 * L + 5, ry + (CAP.plex * 5.5) / 2, dist(bar * 2).toUpperCase(), 5.5, { anchor: "start", spacing: 0.5 });
  }
  out += `<path d="M${FX1 - 3} ${ry + 3}L${FX1 - 3} ${ry - 4}M${FX1 - 5.5} ${ry - 1.5}L${FX1 - 3} ${ry - 4}L${FX1 - 0.5} ${ry - 1.5}" fill="none" stroke="${INK}" stroke-width="${STROKE.fine}" stroke-linecap="round" stroke-linejoin="round"/>` + text(FX1 - 9, ry + (CAP.plex * 6) / 2, "N", 6, { anchor: "end", bold: true });

  // The profile: a bar every 2.4 units from the ground line up to the height, the height as a line along the tops.
  let sub2: string | undefined;
  if (elev) {
    const [X0, X1, Y0, YH] = [52, 278, 300, 40];
    const n = Math.floor((X1 - X0) / 2.4);
    const hAt = (t: number) => {
      const f = t * (elev.q.length - 1), i = Math.min(elev.q.length - 2, Math.floor(f));
      return (elev.q[i] + (elev.q[i + 1] - elev.q[i]) * (f - i)) / ELEV_Q;
    };
    let bars = "";
    const top: Point[] = [];
    for (let i = 0; i <= n; i++) {
      const x = X0 + ((X1 - X0) * i) / n, y = Y0 - 3 - hAt(i / n) * YH;
      bars += `M${f1(x)} ${Y0}V${f1(y)}`;
      top.push([x, y]);
    }
    out += `<path d="${bars}" fill="none" stroke="${INK}" stroke-width="${STROKE.hairline}"/>` + pathOf(top, STROKE.regular) + line(X0 - 3, Y0, X1, Y0, STROKE.fine);
    // The heights: the highest and lowest, fitted to the gutter left of the profile.
    const tag = (m: number, y: number) => {
      const t = `${m} M`;
      const fs = fitSize(t, X0 - FX0 - 6, 5, { track: 0.1, floor: 4.5 });
      return text(X0 - 6, y + (CAP.plex * fs) / 2, t, fs, { anchor: "end", spacing: Math.round(fs) / 10 });
    };
    out += `<path d="M${X0 - 5} ${Y0 - 3 - YH}H${X1}" fill="none" stroke="${INK}" stroke-width="${STROKE.hairline}" stroke-dasharray=".5 2.5" stroke-linecap="round"/>`;
    out += tag(elev.hi, Y0 - 3 - YH) + tag(elev.lo, Y0 - 3);
    sub2 = `${elev.lo}–${elev.hi} m above sea level`;
  }

  const date = p.d ? parseDate(p.d) : null;
  const dist0 = p.k !== undefined ? km(p.k) : undefined;
  const title = titleWords(p) ?? dist0 ?? "My route";
  const sub = [title === dist0 ? undefined : dist0, date ? longDate(...date) : undefined].filter(Boolean).join(" · ") || (p.m ? undefined : "Drawn by hand");
  return [out, [title, sub || sub2, sub ? sub2 : undefined], 338];
}
/** The caption's lines (ours). */
export const routeCaption = (p: Params): Lines => routeDraw(p)[1];

export function routeBody(p: Params): string {
  const [s, lines, y] = routeDraw(p);
  return s + caption(y, ...captionLines(lines, p.cap));
}

export const captionOf = (spec: CustomSpec) => routeCaption((spec as { p: Params }).p);

export const render = (spec: CustomSpec, color: BaseColor) => house(() => wrap(routeBody((spec as { p: Params }).p), color));
