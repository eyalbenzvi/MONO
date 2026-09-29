/**
 * Your Metro Map: your story as a transit map, drawn like the catalogue's
 * schematics (standard symbols, one line weight, labels beside). The layout
 * is the simple one that never fails: the stations run down a single trunk
 * in the order given; where two or more lines stop, the station sits on the
 * trunk (an interchange, the lines running side by side in lanes through
 * it); a station only one line stops at sits on that line's branch, a
 * column to one side of the trunk (the first branch left, the next right,
 * the third and fourth further out). A line leaves the trunk just before
 * its branch station and comes back just after, by 45° (a horizontal step
 * between, when the gap is short), always between two station rows, so it
 * never runs through a station it doesn't stop at off the trunk. Lines are
 * told apart by their stroke (solid, double, dashed, dotted), never by
 * colour. Station names are placed one by one at the first of eight places
 * round the station that is clear of the lines, the stations and the names
 * already set (vertical rather than horizontal, as the names then have
 * their own rows); the whole is then centred on the print.
 */
import { INK, caption, f1, text } from "../kit";
import { mulberry32 } from "../rng";
import type { CustomSpec } from "../spec";
import { LINE_STYLES, type Params as MetroParams } from "../specs/metro";
import { GROUND, wrap } from "../svg";
import type { BaseColor } from "@/types/shirt";

const LANE = 7.6;
/** A branch's distance from the trunk (and from the next branch out): at least, at most. */
const BRANCH = [26, 64] as const;
const TOP = 30, BOTTOM = 282;
/** Rows never further apart than this (a short map stays a map, not a few lonely stations). */
const UNIT_MAX = 60;
const FONT = 7.4, CH = 0.602 * FONT;
const MIN_X = 14, MAX_X = 286;
/** The map is drawn larger than its own units when the names leave room (1.2 times, a map of few stations up to 1.7): lines, stations and names bolder, or a sparse map prints too faint. */
/** Rows at least this far apart in the map's own units before it's drawn larger. */
const ROW_MIN = 19;
const SCALE_MIN = 0.85;
const SCALE = (stations: number) => Math.max(1.2, Math.min(1.7, 2 - 0.05 * stations));

type Pt = [number, number];
interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
/** Whether a segment crosses a box (Liang–Barsky). */
function segHits(p: Pt, q: Pt, b: Box): boolean {
  let [t0, t1] = [0, 1];
  const [dx, dy] = [q[0] - p[0], q[1] - p[1]];
  for (const [pp, qq] of [[-dx, p[0] - b.x0], [dx, b.x1 - p[0]], [-dy, p[1] - b.y0], [dy, b.y1 - p[1]]]) {
    if (pp === 0) {
      if (qq < 0) return false;
    } else {
      const t = qq / pp;
      if (pp < 0) t0 = Math.max(t0, t);
      else t1 = Math.min(t1, t);
      if (t0 > t1) return false;
    }
  }
  return true;
}

/** A line's path drawn in its style (solid, double, dashed, dotted). */
function stroke(d: string, style: (typeof LINE_STYLES)[number]): string {
  const base = `d="${d}" fill="none" stroke-linejoin="round"`;
  if (style === "double") return `<path ${base} stroke="${INK}" stroke-width="5" stroke-linecap="butt"/><path ${base} stroke="${GROUND}" stroke-width="1.8" stroke-linecap="butt"/>`;
  if (style === "dashed") return `<path ${base} stroke="${INK}" stroke-width="3.6" stroke-linecap="butt" stroke-dasharray="6 3"/>`;
  if (style === "dotted") return `<path ${base} stroke="${INK}" stroke-width="3.8" stroke-linecap="round" stroke-dasharray=".1 5.6"/>`;
  return `<path ${base} stroke="${INK}" stroke-width="3.6" stroke-linecap="round"/>`;
}

export interface MetroLayout {
  /** Each line's route through the stations it stops at. */
  routes: Pt[][];
  /** Each station: where it is, its marker's half-width, and (on the trunk) the lanes of the lines that stop. */
  stations: { x: number; y: number; half: number; trunk: boolean; stops: number[] }[];
  /** The stations' rows (y), and the gaps between rows where a line changes column. */
  rows: number[];
  changed: number[];
  /** The rows' spacing (a gap with a change of column is twice this). */
  unit: number;
}

/** The map in its own units: the trunk at x = 0, the first row at y = 0, the rows within `span`. */
export function layout(p: MetroParams, span = BOTTOM - TOP): MetroLayout {
  const n = p.l.length, N = p.s.length;
  const bit = (j: number, i: number) => (p.k[j] >> i) & 1;
  const count = (j: number) => p.l.reduce((c, _, i) => c + bit(j, i), 0);
  const lane = (i: number) => (i - (n - 1) / 2) * LANE;
  const half = ((n - 1) / 2) * LANE;
  // Branches: lines with a station of their own, by how many they have; left, right, then further out.
  const branchy = p.l.map((_, i) => i).filter((i) => p.k.some((m) => m === 1 << i));
  branchy.sort((a, b) => p.k.filter((m) => m === 1 << b).length - p.k.filter((m) => m === 1 << a).length || a - b);
  const trunk = (j: number) => count(j) >= 2;
  const stops = p.l.map((_, i) => p.k.flatMap((m, j) => ((m >> i) & 1 ? [j] : [])));
  // Where each line changes column (on and off the trunk): the gap before a branch station, or after it.
  const changes: { i: number; gap: number }[] = [];
  stops.forEach((js, i) => js.slice(1).forEach((b, t) => trunk(js[t]) !== trunk(b) && changes.push({ i, gap: trunk(b) ? js[t] : b - 1 })));
  // Rows: evenly spaced (at most UNIT_MAX apart); a gap where a line changes column twice as tall (or as its 45° needs, if less).
  const changed = new Set(changes.map((c) => c.gap));
  const unit0 = Math.min(UNIT_MAX, span / (N - 1 + changed.size));
  // Too tight for that: every row ROW_MIN apart (the pills and names need it), what's left shared among the change gaps.
  const tight = unit0 < ROW_MIN;
  const unit = tight ? Math.min(ROW_MIN, span / (N - 1)) : unit0;
  const tall = tight ? unit + Math.max(0, span - unit * (N - 1)) / Math.max(1, changed.size) : 2 * unit;
  // Branches as far out as the names allow (a side's outermost column and its longest name within half the print), and no
  // further than a change of column can go at 45° in its gap.
  const levels = Math.ceil(branchy.length / 2);
  const longest = Math.max(...p.s.map((x) => x.length)) * CH + 10;
  const branch = levels ? Math.max(BRANCH[0], Math.min(BRANCH[1], tall - 14, (134 - half - longest) / levels)) : 0;
  const column = new Map<number, number>();
  branchy.forEach((i, r) => column.set(i, (r % 2 ? 1 : -1) * (half + branch * (1 + Math.floor(r / 2)))));
  const at = (i: number, j: number) => (trunk(j) ? lane(i) : column.get(i)!);
  const hs = Array.from({ length: N - 1 }, (_, g) => {
    if (!changed.has(g)) return unit;
    const dx = Math.max(...changes.filter((c) => c.gap === g).map((c) => Math.abs(column.get(c.i)! - lane(c.i))));
    return Math.min(tall, Math.max(unit, dx + 9));
  });
  const ys = [0];
  hs.forEach((h) => ys.push(ys[ys.length - 1] + h));

  const routes = stops.map((js, i) => {
    const pts: Pt[] = [[at(i, js[0]), ys[js[0]]]];
    js.slice(1).forEach((b, t) => {
      const a = js[t];
      const [xa, xb] = [at(i, a), at(i, b)];
      if (xa !== xb) {
        const gap = trunk(b) ? a : b - 1;
        const [ya, yb] = [ys[gap], ys[gap + 1]];
        const dx = xb - xa, sg = Math.sign(dx);
        const diag = Math.min(Math.abs(dx), yb - ya - 9);
        // Staggered by line, so two lines changing in one gap never run on top of each other.
        const mid = (ya + yb) / 2 + (i - (n - 1) / 2) * 1.5;
        const y1 = mid - diag / 2;
        pts.push([xa, y1]);
        if (diag >= Math.abs(dx)) pts.push([xb, y1 + diag]);
        else pts.push([xa + (sg * diag) / 2, mid], [xb - (sg * diag) / 2, mid], [xb, y1 + diag]);
      }
      pts.push([xb, ys[b]]);
    });
    return pts;
  });
  const stations = p.k.map((m, j) => {
    if (!trunk(j)) return { x: column.get(Math.log2(m))!, y: ys[j], half: 0, trunk: false, stops: [] as number[] };
    // An interchange is one pill across the whole trunk (every lane), so the pills line up down it.
    return { x: 0, y: ys[j], half, trunk: true, stops: p.l.map((_, i) => i).filter((i) => bit(j, i)).map(lane) };
  });
  return { routes, stations, rows: ys, changed: [...changed], unit: unit0 };
}

/**
 * The river every city map has, across the map (a margin beyond its names) between two station
 * rows (the tallest gap near the middle where no line changes column, if
 * there is one): two banks at 0° and 45° with a jog or two (from the station
 * names), the water hatched. It never meets a station; the lines cross it.
 */
function river(p: MetroParams, rows: number[], changed: number[], x0: number, x1: number): string {
  const gaps = rows.slice(1).map((y, g) => ({ g, h: y - rows[g], mid: (y + rows[g]) / 2 }));
  if (!gaps.length) return "";
  const centre = (TOP + BOTTOM) / 2;
  // Tall enough to run between the stations' markers and names; one where no line changes column if there is one.
  const roomy = gaps.filter((x) => x.h >= 24);
  const pool = roomy.length ? roomy : gaps.filter((x) => x.h >= 17);
  if (!pool.length) return "";
  const score = (x: (typeof gaps)[number]) => x.h * 0.2 - Math.abs(x.mid - centre) * 0.15 - (changed.includes(x.g) ? 12 : 0);
  const gap = pool.reduce((a, b) => (score(b) > score(a) ? b : a));
  let seed = 0x811c9dc5;
  for (const ch of p.s.join("|")) seed = Math.imul(seed ^ ch.charCodeAt(0), 0x01000193) >>> 0;
  const rnd = mulberry32(seed);
  const wide = Math.max(5, Math.min(14, gap.h - 14));
  const jog = Math.max(0, Math.min(14, gap.h - wide - 14));
  const y0 = gap.mid - jog / 2;
  // The centre line: level, down a jog at 45°, level, back up (or not), level.
  const len = x1 - x0;
  const xa = x0 + len * (0.12 + rnd() * 0.25), xb = xa + len * (0.2 + rnd() * 0.3);
  const back = rnd() < 0.6;
  const pts: Pt[] = [[x0, y0], [xa, y0], [xa + jog, y0 + jog], [xb, y0 + jog]];
  if (back) pts.push([xb + jog, y0], [x1, y0]);
  else pts.push([x1, y0 + jog]);
  const cy = (x: number) => {
    for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) return pts[i - 1][1] + ((pts[i][1] - pts[i - 1][1]) * (x - pts[i - 1][0])) / (pts[i][0] - pts[i - 1][0] || 1);
    return pts[pts.length - 1][1];
  };
  const bank = (off: number) => pts.map(([x, y], i) => `${i ? "L" : "M"}${f1(x)} ${f1(y + off)}`).join("");
  let hatch = "";
  for (let x = x0 + 2; x < x1 - 1; x += 2.6) hatch += `M${f1(x)} ${f1(cy(x) - wide / 2 + 1.4)}V${f1(cy(x) + wide / 2 - 1.4)}`;
  return `<path d="${bank(-wide / 2)}${bank(wide / 2)}" fill="none" stroke="${INK}" stroke-width=".9" stroke-linejoin="round"/><path d="${hatch}" fill="none" stroke="${INK}" stroke-width=".45"/>`;
}

/** The map laid out and its names placed (in the map's units), and the scale it's drawn at. */
export function metroPlan(p: MetroParams) {
  // Larger when the rows leave room for it (rows never closer than ROW_MIN, down to SCALE_MIN).
  let sc = SCALE(p.s.length);
  let map = layout(p, (BOTTOM - TOP) / sc);
  if (map.unit < ROW_MIN) {
    // A dense map is drawn smaller instead (to SCALE_MIN), so its rows keep their room.
    sc = Math.max(SCALE_MIN, (sc * map.unit) / ROW_MIN);
    map = layout(p, (BOTTOM - TOP) / sc);
  }
  const { routes, stations } = map;
  // The map is laid out round x = 0; labels are placed there too, and the whole is centred after.
  const segs: [Pt, Pt][] = routes.flatMap((r) => r.slice(1).map((q, t) => [r[t], q] as [Pt, Pt]));
  const marks: Box[] = stations.map((s) => ({ x0: s.x - s.half - 5, y0: s.y - 5, x1: s.x + s.half + 5, y1: s.y + 5 }));
  const placed: { box: Box; x: number; y: number; anchor: "start" | "end" | "middle"; label: string }[] = [];
  const cols = stations.map((s) => s.x);
  const [left, right] = [Math.min(...cols) - 60, Math.max(...cols) + 60];
  stations.forEach((s, j) => {
    const label = p.s[j];
    const w = label.length * CH, h = FONT * 0.8;
    const e = s.half + 6;
    // Outward first for a branch; the trunk's names to the right.
    const side = s.trunk ? 1 : Math.sign(s.x) || 1;
    const cands: [number, number, "start" | "end" | "middle"][] = [
      [s.x + side * e, s.y + h / 2, side > 0 ? "start" : "end"],
      [s.x - side * e, s.y + h / 2, side > 0 ? "end" : "start"],
      [s.x + side * (e - 1), s.y - 3.5, side > 0 ? "start" : "end"],
      [s.x + side * (e - 1), s.y + h + 3.5, side > 0 ? "start" : "end"],
      [s.x - side * (e - 1), s.y - 3.5, side > 0 ? "end" : "start"],
      [s.x - side * (e - 1), s.y + h + 3.5, side > 0 ? "end" : "start"],
      [s.x, s.y - 6.5, "middle"],
      [s.x, s.y + h + 6.5, "middle"],
    ];
    let best: { score: number; c: (typeof cands)[number]; box: Box } | null = null;
    cands.forEach((c, k) => {
      const x0 = c[2] === "start" ? c[0] : c[2] === "end" ? c[0] - w : c[0] - w / 2;
      const box = { x0: x0 - 1, y0: c[1] - h - 1, x1: x0 + w + 1, y1: c[1] + 1.5 };
      const score =
        placed.filter((q) => overlaps(q.box, box)).length * 100 +
        marks.filter((m, t) => t !== j && overlaps(m, box)).length * 40 +
        segs.filter(([a, b]) => segHits(a, b, box)).length * 12 +
        (box.x0 < left || box.x1 > right ? 5 : 0) +
        k * 0.5;
      if (!best || score < best.score) best = { score, c, box };
    });
    const b = best!;
    placed.push({ box: b.box, x: b.c[0], y: b.c[1], anchor: b.c[2], label });
  });

  return { ...map, sc, segs, marks, placed };
}

export function metroBody(p: MetroParams): string {
  const { routes, stations, rows, changed, sc, segs, placed } = metroPlan(p);
  let s = "";
  // Lines first, the last line under the first, each cased in the ground so it crosses the river and the others cleanly.
  for (let i = routes.length - 1; i >= 0; i--) {
    const d = routes[i].map(([x, y], t) => `${t ? "L" : "M"}${f1(x)} ${f1(y)}`).join("");
    s += `<path d="${d}" fill="none" stroke="${GROUND}" stroke-width="7.6" stroke-linejoin="round"/>` + stroke(d, LINE_STYLES[i]);
  }
  for (const st of stations) {
    if (st.trunk) s += `<path d="M${f1(st.x - st.half)} ${f1(st.y)}H${f1(st.x + st.half)}" fill="none" stroke="${INK}" stroke-width="9" stroke-linecap="round"/><path d="M${f1(st.x - st.half)} ${f1(st.y)}H${f1(st.x + st.half)}" fill="none" stroke="${GROUND}" stroke-width="5.6" stroke-linecap="round"/>`;
    else s += `<circle cx="${f1(st.x)}" cy="${f1(st.y)}" r="3.7" fill="${GROUND}" stroke="${INK}" stroke-width="1.7"/>`;
    // In the pill, a dot on the lane of each line that stops.
    for (const x of st.stops) s += `<circle cx="${f1(x)}" cy="${f1(st.y)}" r="1.3" fill="${INK}"/>`;
  }
  for (const q of placed) s += `<rect x="${f1(q.box.x0)}" y="${f1(q.box.y0)}" width="${f1(q.box.x1 - q.box.x0)}" height="${f1(q.box.y1 - q.box.y0)}" fill="${GROUND}"/>` + text(q.x, q.y, q.label, FONT, { anchor: q.anchor });

  // Scaled (a short map drawn bolder, see SCALE) and centred on the print, the map and its names inside the margins.
  const xs = [...placed.flatMap((q) => [q.box.x0, q.box.x1]), ...stations.flatMap((st) => [st.x - st.half - 4, st.x + st.half + 4]), ...segs.flatMap(([a, b]) => [a[0] - 2, b[0] + 2])];
  const [lo, hi] = [Math.min(...xs), Math.max(...xs)];
  const k = Math.min(sc, (MAX_X - MIN_X) / (hi - lo));
  const tx = 150 - ((lo + hi) / 2) * k, ty = (TOP + BOTTOM) / 2 - (rows[rows.length - 1] / 2) * k;
  // The river as wide as the map and its names and a margin each side (never narrower than half the print).
  const reach = Math.min(134, Math.max(80, ((hi - lo) * k) / 2 + 30));
  let out = river(p, rows.map((y) => ty + y * k), changed, 150 - reach, 150 + reach) + `<g transform="translate(${f1(tx)} ${f1(ty)}) scale(${Math.round(k * 1000) / 1000})">${s}</g>`;

  // The key: each line's stroke and its name, in one or two rows.
  const keyRows = p.l.length <= 2 ? [p.l.map((_, i) => i)] : [[0, 1], p.l.map((_, i) => i).slice(2)];
  keyRows.forEach((row, r) => {
    const y = 298 + r * 11;
    const widths = row.map((i) => 20 + 5 + p.l[i].length * 0.602 * 7);
    let x = 150 - (widths.reduce((a, b) => a + b, 0) + (row.length - 1) * 14) / 2;
    row.forEach((i, t) => {
      out += stroke(`M${f1(x)} ${f1(y - 2.4)}H${f1(x + 20)}`, LINE_STYLES[i]) + text(x + 25, y, p.l[i], 7, { anchor: "start" });
      x += widths[t] + 14;
    });
  });
  const route = `${p.s[0]} to ${p.s[p.s.length - 1]}`;
  const title = p.w ?? (route.length <= 30 ? route : "Our Map");
  return out + caption(338, title, `${p.l.length} lines · ${p.s.length} stations`, p.w && route.length <= 44 ? route : undefined);
}

export const render = (spec: CustomSpec, color: BaseColor) => wrap(metroBody((spec as { p: MetroParams }).p), color);
