/**
 * Your Passport: a page of entry stamps. A fine guilloche grid (two families
 * of waves crossing, hairlines only, never a solid ground) with the stamps
 * set over it, the grid stopping short of each. Every stamp is drawn in code:
 * a shape (a ring, a double ring, a rectangle, a rounded one, an octagon or a
 * hexagon) turned a little by rotating its own coordinates, holding the
 * country's code, its name, the day and a small plane or train. Where they
 * land is seeded by the list (lib/custom/rng), none over another. The name
 * heads the page; the foot says what the page isn't.
 */
import { INK, arcText, caption, captionLines, circle, f1, line, polyline, text, textWidth, turnedText, type Lines } from "../kit";
import { mulberry32 } from "../rng";
import { parseDate } from "../specKit";
import type { Params, Stamp } from "../specs/passport";
import { loadCountries, type Countries } from "../data";
import type { CustomSpec } from "../spec";
import type { RenderData } from "../renderers";
import { wrap } from "../svg";
import type { BaseColor } from "@/types/shirt";

type Pt = [number, number];
const COND = "condensed" as const;
/** The page, and the grid's field inside it. */
const PX0 = 22, PX1 = 278, PY0 = 26, PY1 = 322;
const GX0 = 28, GX1 = 272, GY0 = 66, GY1 = 298;
const SHAPES = ["ring", "double", "rect", "rounded", "octagon", "hexagon"] as const;
type Shape = (typeof SHAPES)[number];
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** A country's name as a stamp sets it: capitals, accents dropped, the stamp's letters only. */
const stampName = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toUpperCase().replace(/[^A-Z0-9 .-]/g, "").replace(/\s+/g, " ").trim();

const dayOf = (d: Stamp[1]) => {
  const p = typeof d === "string" ? parseDate(d) : null;
  return p ? `${String(p[2]).padStart(2, "0")} ${MONTHS[p[1] - 1]} ${p[0]}` : "";
};

/** The caption's lines (ours): the name, how many stamps from how many countries, the years. */
export function passportCaption(p: Params): Lines {
  const n = p.x.length;
  const places = new Set(p.x.map(([a3]) => a3)).size;
  const ys = p.x.flatMap(([, d]) => (typeof d === "string" ? [Number(d.slice(0, 4))] : []));
  const span = ys.length ? (Math.min(...ys) === Math.max(...ys) ? `Stamped in ${ys[0]}` : `Stamped ${Math.min(...ys)}–${Math.max(...ys)}`) : "Stamped, undated";
  return [p.n, `${n} ${n === 1 ? "stamp" : "stamps"} · ${places} ${places === 1 ? "country" : "countries"}`, span];
}

/** A string's hash (FNV-1a): the layout's seed. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}

interface Placed {
  s: Stamp;
  cx: number;
  cy: number;
  r: number;
  deg: number;
  shape: Shape;
}

/** Where the stamps land: seeded by the list, each clear of the others, shrinking them all a little whenever they won't fit. */
export function layout(x: Stamp[]): Placed[] {
  const seed = hash(JSON.stringify(x));
  let r = x.length <= 1 ? 58 : x.length <= 2 ? 50 : x.length <= 4 ? 42 : x.length <= 6 ? 36 : x.length <= 8 ? 32 : 29;
  for (let attempt = 0; attempt < 40; attempt++, r *= 0.96) {
    const rnd = mulberry32(seed + attempt);
    const out: Placed[] = [];
    for (const [i, s] of x.entries()) {
      let best: Pt | null = null;
      // The best of a few tries: the spot furthest from the rest, so they spread over the page.
      let far = -1;
      for (let t = 0; t < 60; t++) {
        const c: Pt = [GX0 + r + rnd() * (GX1 - GX0 - 2 * r), GY0 + r + rnd() * (GY1 - GY0 - 2 * r)];
        const gap = Math.min(Infinity, ...out.map((o) => Math.hypot(o.cx - c[0], o.cy - c[1]) - o.r - r));
        if (gap < 4) continue;
        const score = Math.min(gap, 40) + rnd() * 6;
        if (score > far) (far = score), (best = c);
      }
      if (!best) break;
      out.push({ s, cx: best[0], cy: best[1], r, deg: (rnd() - 0.5) * 36, shape: SHAPES[(hash(s[0]) + i) % SHAPES.length] });
    }
    if (out.length === x.length) return out;
  }
  // Unreachable for PASSPORT_MAX stamps at the smallest size; a stacked column all the same.
  return x.map((s, i) => ({ s, cx: 150, cy: GY0 + 20 + i * 24, r: 11, deg: 0, shape: "rect" }));
}

/** Local stamp coordinates (u across, v down, about the centre) turned by deg and moved to the centre. */
const turn = (cx: number, cy: number, deg: number) => {
  const [c, s] = [Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180)];
  return (u: number, v: number): Pt => [cx + u * c - v * s, cy + u * s + v * c];
};

/**
 * A 100 × 100 drawing (absolute M, L, H, V, Q, Z and relative circle arcs)
 * `size` wide, turned by deg about (cx, cy): each point rotated, so the
 * drawing needs no transform.
 */
function turnedPath(d: string, cx: number, cy: number, size: number, deg: number, width: number): string {
  const k = size / 100;
  const at = turn(cx, cy, deg);
  const rad = (deg * Math.PI) / 180;
  let [x, y] = [0, 0];
  const pt = (px: number, py: number) => ((x = px), (y = py), at((px - 50) * k, (py - 50) * k).map(f1).join(" "));
  const out = d.replace(/([MLHVQZa])([^MLHVQZa]*)/g, (_, cmd: string, args: string) => {
    const n = args.trim() ? args.trim().split(/[\s,]+/).map(Number) : [];
    if (cmd === "H") return `L${pt(n[0], y)}`;
    if (cmd === "V") return `L${pt(x, n[0])}`;
    if (cmd === "Z") return "Z";
    if (cmd === "a") {
      const [dx, dy] = [n[5] * k, n[6] * k];
      return `a${f1(n[0] * k)} ${f1(n[1] * k)} 0 ${n[3]} ${n[4]} ${f1(dx * Math.cos(rad) - dy * Math.sin(rad))} ${f1(dx * Math.sin(rad) + dy * Math.cos(rad))}`;
    }
    const pts: string[] = [];
    for (let i = 0; i + 1 < n.length; i += 2) pts.push(pt(n[i], n[i + 1]));
    return cmd + pts.join(" ");
  });
  return `<path d="${out}" fill="none" stroke="${INK}" stroke-width="${f1(width)}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

const ring = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
const PLANE = "M50 8Q56 8 56 18V40L92 56V64L56 54V78L68 86V92L50 88L32 92V86L44 78V54L8 64V56L44 40V18Q44 8 50 8Z";
const TRAIN = `M18 22H72Q90 22 90 40V74H18ZM26 32H42V46H26ZM50 32H66V46H50ZM74 32Q84 32 84 44V46H74ZM18 56H90${ring(32, 80, 7)}${ring(54, 80, 7)}${ring(76, 80, 7)}M6 94H94`;

/** A shape's outline for a stamp of bounding radius r, in local coordinates. */
function outline(shape: Shape, r: number): Pt[] {
  const poly = (n: number, off: number, sx = 1): Pt[] => Array.from({ length: n }, (_, i) => [r * sx * Math.cos(off + (i * 2 * Math.PI) / n), r * Math.sin(off + (i * 2 * Math.PI) / n)]);
  if (shape === "octagon") return poly(8, Math.PI / 8);
  if (shape === "hexagon") return poly(6, 0);
  // A rectangle inside the circle, wider than tall; the rounded one with quarter circles at its corners.
  const [hw, hh] = [r * 0.8, r * 0.6];
  if (shape === "rect") return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
  const q = r * 0.2, pts: Pt[] = [];
  const corners: [number, number, number][] = [[hw - q, -hh + q, -90], [hw - q, hh - q, 0], [-hw + q, hh - q, 90], [-hw + q, -hh + q, 180]];
  for (const [ux, uy, a0] of corners) for (let a = 0; a <= 90; a += 15) pts.push([ux + q * Math.cos(((a0 + a) * Math.PI) / 180), uy + q * Math.sin(((a0 + a) * Math.PI) / 180)]);
  return pts;
}

/** The largest size, up to max, at which a line fits the width (a shorter name when even `floor` won't). */
function fitLine(s: string, width: number, max: number, floor: number): { s: string; size: number } {
  let words = s.split(" ");
  for (;;) {
    const t = words.join(" ");
    const size = Math.min(max, width / Math.max(1, textWidth(t, 1, { bold: true })));
    if (size >= floor || words.length === 1) return { s: t, size: Math.max(size, Math.min(floor, max)) };
    words = words.slice(0, -1);
    // Never ending on a joining word ("UNITED STATES OF").
    while (words.length > 1 && /^(OF|AND|THE|DE|DU|DA|DEL|ET)$/.test(words[words.length - 1])) words = words.slice(0, -1);
  }
}

function drawStamp(o: Placed, countries?: Countries): string {
  const { cx, cy, r, deg, shape } = o;
  const [a3, d, train] = o.s;
  const at = turn(cx, cy, deg);
  const name = stampName(countries?.byA3(a3)?.name ?? "");
  const day = dayOf(d);
  const icon = (u: number, v: number, size: number) => turnedPath(train ? TRAIN : PLANE, ...at(u, v), size, deg + (train ? 0 : 90), 5 * (size / 100) + 0.3);
  let s = "";
  if (shape === "ring" || shape === "double") {
    s += circle(cx, cy, r - 1, 1.4) + (shape === "double" ? circle(cx, cy, r - 3.6, 0.6) : "");
    const inner = r * 0.64;
    s += circle(cx, cy, inner, 0.8);
    const band = (shape === "double" ? r - 3.6 : r - 1) - inner;
    const size = Math.min(band * 0.62, 6.5);
    const mid = (r - 1 + inner) / 2 - (shape === "double" ? 1.3 : 0);
    // The name round the top, the day round the foot (each shortened to the arc it has).
    const arcLen = (Math.PI * mid * 0.9);
    if (name) {
      const fit = fitLine(name, arcLen, size, size * 0.7);
      s += arcText(fit.s, cx, cy, mid, deg, fit.size, true, { bold: true });
    }
    if (day) s += arcText(day, cx, cy, mid, 180 + deg, Math.min(size, arcLen / textWidth(day, 1)), false);
    s += turnedText(a3, ...at(0, inner * 0.12), deg, inner * 0.62, { bold: true });
    s += icon(0, -inner * 0.58, inner * 0.5);
    s += turnedPath(`M20 50H80`, ...at(0, inner * 0.6), inner * 1.1, deg, 0.7);
    return s;
  }
  const pts = outline(shape, r - 1).map(([u, v]) => at(u, v));
  s += `<path d="${polyline(pts, true)}" fill="none" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>`;
  const insetPts = outline(shape, r - 4.2).map(([u, v]) => at(u, v));
  s += `<path d="${polyline(insetPts, true)}" fill="none" stroke="${INK}" stroke-width=".6" stroke-linejoin="round"/>`;
  // Inside: the name, the code large beside the plane or train, a rule, the day.
  const w = r * 1.18;
  if (name) {
    const fit = fitLine(name, w, r * 0.16, 3.2);
    s += turnedText(fit.s, ...at(0, -r * 0.34), deg, fit.size, { bold: true });
  }
  s += turnedText(a3, ...at(-r * 0.14, r * 0.02), deg, r * 0.36, { bold: true });
  s += icon(r * 0.46, r * 0.0, r * 0.3);
  s += `<path d="M${at(-w / 2, r * 0.22).map(f1).join(" ")}L${at(w / 2, r * 0.22).map(f1).join(" ")}" fill="none" stroke="${INK}" stroke-width=".7"/>`;
  s += turnedText(day || "ADMITTED", ...at(0, r * 0.38), deg, Math.min(r * 0.14, w / textWidth(day || "ADMITTED", 1)));
  return s;
}

/** The guilloche grid: two families of waves crossing, each broken where it would run under a stamp. */
function grid(stamps: Placed[]): string {
  const pitch = 7.5, amp = 2.4, len = 26;
  const clear = (x: number, y: number) => stamps.every((o) => Math.hypot(x - o.cx, y - o.cy) > o.r + 2.5);
  let d = "";
  for (const ph of [0, Math.PI]) {
    for (let y0 = GY0 + amp; y0 <= GY1 - amp + 0.01; y0 += pitch) {
      let run: Pt[] = [];
      const flush = () => (run.length > 1 && (d += polyline(run)), (run = []));
      for (let x = GX0; x <= GX1 + 0.01; x += 2) {
        const y = y0 + amp * Math.sin((x / len) * 2 * Math.PI + ph + y0 * 0.11);
        if (clear(x, y)) run.push([x, y]);
        else flush();
      }
      flush();
    }
  }
  return `<path d="${d}" fill="none" stroke="${INK}" stroke-width=".35"/>`;
}

export function passportBody(p: Params, countries?: Countries): string {
  const stamps = layout(p.x);
  // The page: its edge, the head with the name, the grid's frame.
  let s = `<path d="M${PX0 + 8} ${PY0}H${PX1 - 8}Q${PX1} ${PY0} ${PX1} ${PY0 + 8}V${PY1 - 8}Q${PX1} ${PY1} ${PX1 - 8} ${PY1}H${PX0 + 8}Q${PX0} ${PY1} ${PX0} ${PY1 - 8}V${PY0 + 8}Q${PX0} ${PY0} ${PX0 + 8} ${PY0}Z" fill="none" stroke="${INK}" stroke-width="1.4"/>`;
  s += text(GX0, 46, "ARRIVALS", 15, { family: COND, bold: true, anchor: "start", spacing: 2 });
  const who = p.n.toUpperCase();
  s += text(GX1, 46, who, Math.min(11, 150 / textWidth(who, 1, { bold: true })), { bold: true, anchor: "end" });
  s += text(GX0, 58, "PAGE 7", 5.5, { anchor: "start", spacing: 1 }) + text(GX1, 58, "HOLDER", 5.5, { anchor: "end", spacing: 1 });
  s += line(GX0, 62, GX1, 62, 0.6) + line(GX0, GY1 + 4, GX1, GY1 + 4, 0.6);
  s += grid(stamps);
  for (const o of stamps) s += drawStamp(o, countries);
  s += text(150, PY1 - 12, "THIS PAGE IS NOT A TRAVEL DOCUMENT. IT IS A SHIRT.", 5.5, { spacing: 0.5 });
  return s + caption(346, ...captionLines(passportCaption(p), p.cap));
}

export const captionOf = (spec: CustomSpec) => passportCaption((spec as { p: Params }).p);

export const render = (spec: CustomSpec, color: BaseColor, data: RenderData = {}) => wrap(passportBody((spec as { p: Params }).p, data.countries), color);

/** The countries' names, for the index cards and the bag (the editor passes its own). */
export async function prepare(): Promise<RenderData> {
  return { countries: await loadCountries() };
}
