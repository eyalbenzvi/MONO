/**
 * Your Family Tree: a genealogical fan chart drawn as a full circle, like the
 * catalogue's Concentric designs (rings of even line weight around one
 * centre). You in the middle; each generation a ring split into 2^g sectors,
 * father's side above the horizon, mother's below, so every ancestor sits
 * directly outside their child. Names run along their ring glyph by glyph
 * (each letter a rotated group: the canvas preview draws no textPath), turned
 * so they read left to right, on top and bottom alike; the years follow on a
 * smaller line. A ring shares one size, the largest its longest name allows.
 * Blank slots are hatched. A double rule and a ring of ticks close it.
 */
import { INK, arcText as arcTextKit, caption, circle, f1, text, captionLines, type Lines } from "../kit";
import { titleWords } from "../specKit";
import type { CustomSpec } from "../spec";
import { familyYears, yearsText, type Params } from "../specs/family";
import { wrap } from "../svg";
import type { BaseColor } from "@/types/shirt";

const CX = 150, CY = 176, R = 128;
/** A monospace advance (em) and the air added between letters (em). */
const ADV = 0.602, TRACK = 0.08;
const DEG = Math.PI / 180;
const HATCH_GAP = 2.7, HATCH_W = 0.5;

const pt = (r: number, a: number): [number, number] => [CX + r * Math.sin(a * DEG), CY - r * Math.cos(a * DEG)];

/** Ring edges from the centre out: the middle disc, then one ring a generation (the outer rings deeper, they carry two lines on shorter arcs). */
function radii(gens: number): number[] {
  return gens === 4 ? [0, 31, 60, 90, R] : [0, 36, 76, R];
}

/** Letters along a ring of the chart (lib/custom/kit arcText, centred on the chart). */
const arcText = (s: string, r: number, mid: number, size: number, up: boolean, bold = false) => arcTextKit(s, CX, CY, r, mid, size, up, { bold });

/** The angle (degrees) a line of n letters takes at radius r. */
const span = (n: number, size: number, r: number) => (n * (ADV + TRACK) * size) / r / DEG;

/** Parallel hatching inside an annular sector (r0–r1, angles a0–a1 ≤ 180° apart), kept `inset` clear of its edges; computed, never clipped. */
function hatch(r0: number, r1: number, a0: number, a1: number, dir: number, inset = 1.3): string {
  const u0 = [Math.sin(a0 * DEG), -Math.cos(a0 * DEG)], u1 = [Math.sin(a1 * DEG), -Math.cos(a1 * DEG)];
  const [dx, dy] = [Math.cos(dir * DEG), Math.sin(dir * DEG)];
  const [nx, ny] = [-dy, dx];
  const lo = r0 ? r0 + inset : 0, hi = r1 - inset;
  let d = "";
  for (let k = -Math.ceil(hi / HATCH_GAP); k <= Math.ceil(hi / HATCH_GAP); k++) {
    // The line p(t) = c + t·dir, offset k gaps from the centre along the normal.
    const c = [nx * k * HATCH_GAP, ny * k * HATCH_GAP];
    const cc = c[0] * c[0] + c[1] * c[1];
    if (cc >= hi * hi) continue;
    const hOut = Math.sqrt(hi * hi - cc);
    let segs: [number, number][] = [[-hOut, hOut]];
    if (lo && cc < lo * lo) {
      const hIn = Math.sqrt(lo * lo - cc);
      segs = [[-hOut, -hIn], [hIn, hOut]];
    }
    // The wedge: to the clockwise side of the first edge and the anticlockwise side of the second (cross products, in screen axes).
    const half = (ux: number, uy: number, sign: number): [number, number] => {
      // sign · cross(u, p) ≥ inset, p = c + t·dir → A + B t ≥ inset.
      const A = sign * (ux * c[1] - uy * c[0]), B = sign * (ux * dy - uy * dx);
      if (Math.abs(B) < 1e-9) return A >= inset ? [-1e9, 1e9] : [1, -1];
      const t = (inset - A) / B;
      return B > 0 ? [t, 1e9] : [-1e9, t];
    };
    for (const [p, q] of [half(u0[0], u0[1], 1), half(u1[0], u1[1], -1)]) segs = segs.map(([s, e]) => [Math.max(s, p), Math.min(e, q)] as [number, number]);
    for (const [s, e] of segs) {
      if (e - s < 1.2) continue;
      d += `M${f1(c[0] + s * dx + CX)} ${f1(c[1] + s * dy + CY)}L${f1(c[0] + e * dx + CX)} ${f1(c[1] + e * dy + CY)}`;
    }
  }
  return d;
}

/** Where a sector's lines sit: the name's radius and the years' (upper half: the name outside; lower half: inside, so each reads name, then years, top to bottom). */
function lineRadii(r0: number, r1: number, size: number, up: boolean, withYears: boolean): [rName: number, rYear: number] {
  const rm = (r0 + r1) / 2;
  if (!withYears) return [rm, rm];
  const ySize = yearSize(size);
  const block = size * 0.72 + Math.max(1.8, size * 0.42) + ySize * 0.72;
  const [outer, inner] = [rm + block / 2, rm - block / 2];
  return up ? [outer - size * 0.36, inner + ySize * 0.36] : [inner + size * 0.36, outer - ySize * 0.36];
}
const yearSize = (size: number) => Math.max(3.2, size * 0.74);
/** The air left at each end of a sector's line, in print units. */
const END_AIR = 2.6;

/** A generation's name size: its cap, or less (a tenth at a time), until every name and its years fit their sector's arc and the ring's depth. */
function ringSize(names: string[], years: string[], r0: number, r1: number, sweep: number, cap: number): number {
  const fits = (size: number) =>
    names.every((nm, k) => {
      if (!nm) return true;
      const up = Math.cos((-90 + (k + 0.5) * sweep) * DEG) >= 0;
      const [rn, ry] = lineRadii(r0, r1, size, up, !!years[k]);
      const ok = (n: number, sz: number, r: number) => span(n, sz, r) + (2 * END_AIR) / r / DEG <= sweep;
      const block = years[k] ? size * 0.72 + Math.max(1.8, size * 0.42) + yearSize(size) * 0.72 : size * 0.72;
      return ok([...nm].length, size, rn) && (!years[k] || ok(years[k].length, yearSize(size), ry)) && block <= r1 - r0 - 4;
    });
  let size = cap;
  while (size > 3.2 && !fits(size)) size = Math.round((size - 0.1) * 10) / 10;
  return size;
}

/** The drawing, the caption's lines as ours, and where the caption sits. */
function familyDraw(p: Params): [string, Lines, number] {
  const gens = p.n.length === 15 ? 4 : 3;
  const rs = radii(gens);
  const ys = familyYears(p).map(yearsText);
  let s = "";

  // Ornament: the outer double rule and a ring of ticks, as on the Concentric designs.
  s += circle(CX, CY, R, 1.2) + circle(CX, CY, R + 5, 0.5);
  let ticks = "";
  for (let a = 0; a < 360; a += 5) {
    const [x0, y0] = pt(R + 1.8, a), [x1, y1] = pt(R + (a % 45 === 0 ? 5 : 3.4), a);
    ticks += `M${f1(x0)} ${f1(y0)}L${f1(x1)} ${f1(y1)}`;
  }
  s += `<path d="${ticks}" fill="none" stroke="${INK}" stroke-width=".5"/>`;
  for (let g = 1; g < gens; g++) s += circle(CX, CY, rs[g], 0.9);

  let hatches = "", rules = "";
  for (let g = 1; g < gens; g++) {
    const count = 2 ** g, sweep = 360 / count;
    const first = count - 1;
    const names = p.n.slice(first, first + count), years = ys.slice(first, first + count);
    const [r0, r1] = [rs[g], rs[g + 1]];
    const size = ringSize(names, years, r0, r1, sweep, (gens === 4 ? [0, 9, 8, 7.4] : [0, 10.5, 10])[g]);
    for (let k = 0; k < count; k++) {
      const a0 = -90 + k * sweep, a1 = a0 + sweep, mid = (a0 + a1) / 2;
      // The divider between sectors (from this ring out; the inner ring's divider continues it).
      const [x0, y0] = pt(r0, a0), [x1, y1] = pt(r1, a0);
      rules += `M${f1(x0)} ${f1(y0)}L${f1(x1)} ${f1(y1)}`;
      const nm = names[k];
      if (!nm) {
        // Hatched: a slant of its own per generation, turned with the sector, so neighbouring blanks read apart.
        hatches += hatch(r0, r1, a0, a1, mid + [0, 45, 60, 75][g]);
        continue;
      }
      const up = Math.cos(mid * DEG) >= 0;
      const [rName, rYear] = lineRadii(r0, r1, size, up, !!years[k]);
      s += arcText(nm, rName, mid, size, up);
      if (years[k]) s += arcText(years[k], rYear, mid, yearSize(size), up);
    }
  }
  if (hatches) s += `<path d="${hatches}" fill="none" stroke="${INK}" stroke-width="${HATCH_W}" stroke-linecap="round"/>`;
  s += `<path d="${rules}" fill="none" stroke="${INK}" stroke-width=".9"/>`;

  // The middle: you, set straight (two lines when a long name has a space), bold, the years under it.
  const root = p.n[0];
  const r0 = rs[1];
  const words = root.split(" ");
  let lines = [root];
  if (root.length > 9 && words.length > 1) {
    let best = [root];
    for (let i = 1; i < words.length; i++) {
      const cand = [words.slice(0, i).join(" "), words.slice(i).join(" ")];
      if (Math.max(...cand.map((l) => l.length)) < Math.max(...best.map((l) => l.length))) best = cand;
    }
    lines = best;
  }
  const longest = Math.max(...lines.map((l) => l.length));
  const rootSize = Math.min(gens === 4 ? 8.5 : 10, (r0 * 1.62) / (ADV * longest));
  const rootYear = Math.min(rootSize * 0.74, (r0 * 1.5) / (ADV * Math.max(1, ys[0].length)));
  const lh = rootSize * 1.1;
  const h = lines.length * lh + (ys[0] ? rootYear * 1.2 : 0);
  let y = CY - h / 2 + rootSize * 0.8;
  for (const l of lines) (s += text(CX, y, l, f1Size(rootSize), { bold: true })), (y += lh);
  if (ys[0]) s += text(CX, y - lh + rootSize * 0.35 + rootYear * 1.2, ys[0], f1Size(rootYear));
  // A fine second rule inside the middle disc, as the Concentric designs double their rings.
  s += circle(CX, CY, r0 - 2.6, 0.4);

  const named = p.n.filter(Boolean).length;
  const title = titleWords(p) ?? "Family tree";
  return [s, [title, `${gens === 4 ? "Four" : "Three"} generations · ${named} of ${p.n.length} names`, undefined], 340];
}
/** The caption's lines (ours). */
export const familyCaption = (p: Params): Lines => familyDraw(p)[1];

export function familyBody(p: Params): string {
  const [s, lines, y] = familyDraw(p);
  return s + caption(y, ...captionLines(lines, p.cap));
}

const f1Size = (v: number) => Math.round(v * 10) / 10;

export const captionOf = (spec: CustomSpec) => familyCaption((spec as { p: Params }).p);

export const render = (spec: CustomSpec, color: BaseColor) => wrap(familyBody((spec as { p: Params }).p), color);
