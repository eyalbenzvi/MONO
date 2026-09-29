/**
 * Your Tree Rings: a cross-section of a tree that grew one ring a year of
 * yours, drawn like the catalogue's Concentric designs (nested outlines of
 * one weight, turning slowly) but grown rather than ruled. Each ring's width
 * follows its year (good wide, hard narrow, the first few wider as a young
 * tree's are), with seeded noise; every ring shares a seeded lean (the pith
 * off centre, a lobe or two) plus a wobble of its own, so no two prints are
 * plain circles. Wide rings show their wood as line density: close lines
 * for the latewood, dotted lines far apart for the earlywood. Medullary rays cross the
 * rings in dashes; decades carry a dendrochronologist's dots (one a decade,
 * two at fifty, three at a hundred); the bark is a rough band with fissures.
 * A scar is a wedge the rings stop short of, closing over the years after,
 * its face charred. Rings are never closer than a printable line and gap:
 * over a long span the lean flattens, the air narrows and the widths even
 * out to fit.
 */
import { INK, caption, dot, f1, polyline } from "../kit";
import type { CustomSpec } from "../spec";
import type { Params } from "../specs/rings";
import { mulberry32 } from "../rng";
import { GROUND, wrap } from "../svg";
import { fnv1aChars } from "@/lib/hash";
import type { BaseColor } from "@/types/shirt";

/** The disc's box, bark included: its centre and size. */
const BOX = { x: 150, y: 168, w: 250, h: 256 };
/** The cambium's farthest reach before fitting (the rings' outside, inside the bark), and the bark's widest. */
const RIN = 116, BARK = 6.4;
const K = 180;
/** Ring lines and the air between them, at the least. */
const LINE = 0.42, GAP_MIN = 0.62, GAP_WANT = 1.1;
/** Line spacing inside a wide ring: latewood close, earlywood far apart. */
const LATE = 1.7, EARLY = 3.4;
const PER_RING = 0.06;
/** Years a scar takes to close. */
const HEAL = 7;
const FACTOR: Record<string, number> = { "0": 0.45, "1": 1, "2": 1.7 };

const fnv = fnv1aChars;
const TAU = Math.PI * 2;
const angDist = (a: number, b: number) => Math.abs(((((a - b) % TAU) + TAU + Math.PI) % TAU) - Math.PI);

export function ringsBody(p: Params): string {
  const n = p.c - p.b + 1;
  const rnd = mulberry32(fnv(`rings:${p.b}`));
  // Widths from the marks, a young tree's first rings wider, seeded noise.
  const raw = [...p.m].map((d, i) => FACTOR[d] * (0.7 + 0.6 * rnd()) * (1 + 0.7 * Math.exp(-i / 4)));
  // The lean: shared harmonics (the pith off centre, lobes), bounded by 1.
  const ph = [rnd() * TAU, rnd() * TAU, rnd() * TAU];
  const common = (t: number) => 0.6 * Math.cos(t - ph[0]) + 0.25 * Math.cos(2 * t - ph[1]) + 0.15 * Math.cos(3 * t - ph[2]);
  // Fit: the lean as strong as the span allows (35% at most), each ring at least a line and a gap on its narrow side.
  let pitch = LINE + GAP_WANT;
  let lean = 0.35;
  const fits = () => (n * pitch) / (1 - lean - PER_RING) <= RIN / (1 + lean + PER_RING);
  // Give up lean down to 15% first, then air down to the least, then the rest of the lean.
  while (!fits() && lean > 0.15) lean -= 0.01;
  while (!fits() && pitch > LINE + GAP_MIN) pitch -= 0.01;
  while (!fits() && lean > 0) lean = Math.max(0, lean - 0.01);
  const wMin = pitch / (1 - lean - PER_RING);
  const room = RIN / (1 + lean + PER_RING);
  // Water-fill: the scale that makes max(wMin, s·raw) sum to the room.
  let [lo, hi] = [0, room / Math.min(...raw)];
  for (let it = 0; it < 50; it++) {
    const s = (lo + hi) / 2;
    if (raw.reduce((a, w) => a + Math.max(wMin, s * w), 0) > room) hi = s;
    else lo = s;
  }
  const widths = raw.map((w) => Math.max(wMin, lo * w));
  // Each ring's own wobble.
  const own = widths.map(() => [1 + Math.floor(rnd() * 4), rnd() * TAU, 0.4 + 0.6 * rnd()] as const);
  const th = Array.from({ length: K }, (_, k) => (k / K) * TAU);
  const radii: number[][] = [];
  let acc = new Array(K).fill(0);
  widths.forEach((w, i) => {
    const [f, phase, amp] = own[i];
    acc = acc.map((a, k) => a + w * (1 + lean * common(th[k]) + PER_RING * amp * Math.sin(f * th[k] + phase)));
    radii.push(acc);
  });

  // The lean's bound is loose (the harmonics seldom all peak together): scale the disc, bark included, to fill its
  // box, and centre that box (a leaning tree's pith sits off centre, as it should).
  const last = radii[n - 1];
  const xs = th.map((t, k) => (last[k] + BARK) * Math.cos(t)), ys = th.map((t, k) => (last[k] + BARK) * Math.sin(t));
  const [bx0, bx1, by0, by1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const grow = Math.min(BOX.w / (bx1 - bx0), BOX.h / (by1 - by0));
  radii.forEach((r) => r.forEach((v, k) => (r[k] = v * grow)));
  widths.forEach((w, i) => (widths[i] = w * grow));
  const CX = BOX.x - ((bx0 + bx1) / 2) * grow, CY = BOX.y - ((by0 + by1) / 2) * grow;

  // Scars: a seeded angle each, the wedge closing over HEAL years.
  const scars = (p.s ?? []).map((y) => {
    const r = mulberry32(fnv(`scar:${p.b}:${y}`));
    return { k: y - p.b, at: r() * TAU, half: 0.26 + 0.1 * r() };
  });
  const gapAt = (j: number, t: number) => scars.some((s) => j >= s.k && j < s.k + HEAL && angDist(t, s.at) < s.half * (1 - (j - s.k) / HEAL));
  const inWedge = (t: number) => scars.some((s) => angDist(t, s.at) < s.half + 0.06);
  const pt = (r: number, t: number): [number, number] => [CX + r * Math.cos(t), CY + r * Math.sin(t)];
  /** A ring line (as a radius per sample) as path data, broken where `skip` says, closed when it's whole. */
  const trace = (rad: (k: number) => number, skip: (t: number) => boolean) => {
    const on = th.map((t) => !skip(t));
    if (on.every(Boolean)) return polyline(th.map((t, k) => pt(rad(k), t)), true);
    let d = "";
    const start = on.findIndex((v, k) => !v && on[(k + 1) % K]) + 1;
    let run: [number, number][] = [];
    for (let q = 0; q <= K; q++) {
      const k = (start + q) % K;
      if (on[k] && q < K) run.push(pt(rad(k), th[k]));
      else if (run.length) {
        if (run.length > 1) d += polyline(run);
        run = [];
      }
    }
    return d;
  };

  let lines = "", fine = "";
  let bold = "";
  radii.forEach((r, j) => {
    // A decade's last ring is drawn bold: the decades read at a glance, and a long, even span still has a grain.
    if ((p.b + j) % 10 === 9 && j < n - 1) bold += trace((k) => r[k], (t) => gapAt(j, t));
    else lines += trace((k) => r[k], (t) => gapAt(j, t));
    // Wide rings show their wood as line density: the latewood (the ring's outer third) in close lines, the earlywood
    // inside it in dotted lines far apart. Spacing is set on the ring's narrow side, so it never crowds.
    const inner = j ? radii[j - 1] : null;
    const w = Math.min(...r.map((v, k) => v - (inner ? inner[k] : 0)));
    const within = (f: number) => (k: number) => (inner ? inner[k] : 0) + (r[k] - (inner ? inner[k] : 0)) * f;
    const late = Math.floor((w * 0.34) / LATE);
    for (let q = 1; q <= late; q++) lines += trace(within(1 - (q * LATE) / w), (t) => gapAt(j, t));
    const early = Math.floor((w * 0.66 - LATE) / EARLY);
    for (let q = 1; q <= early; q++) fine += trace(within(1 - (late * LATE + LATE * 0.5 + q * EARLY) / w), (t) => gapAt(j, t));
  });
  // Heavier lines where the rings are wide (a sparse field needs the weight to carry), never eating into the narrowest gap.
  const lineW = Math.max(LINE, Math.min(0.8, (0.22 * RIN) / n, pitch * grow - GAP_MIN));
  let s = `<path d="${lines}" fill="none" stroke="${INK}" stroke-width="${f1(lineW)}" stroke-linejoin="round"/>`;
  if (bold) s += `<path d="${bold}" fill="none" stroke="${INK}" stroke-width="${f1(Math.min(1, pitch * 0.7))}" stroke-linejoin="round"/>`;
  if (fine) s += `<path d="${fine}" fill="none" stroke="${INK}" stroke-width=".4" stroke-dasharray=".5 1.6" stroke-linecap="round"/>`;

  // Scar faces: the last whole ring inside each wedge, charred (bold, with short burnt ticks).
  for (const sc of scars) {
    const face = sc.k ? radii[sc.k - 1] : null;
    let d = "";
    const ks = th.map((t, k) => [t, k] as const).filter(([t]) => angDist(t, sc.at) < sc.half);
    ks.forEach(([t, k], i) => {
      const r0 = face ? face[k] : 0;
      const [x, y] = pt(r0 + 0.3, t);
      d += `${i ? "L" : "M"}${f1(x)} ${f1(y)}`;
    });
    for (const [t, k] of ks.filter((_, i) => i % 2 === 1)) {
      const r0 = face ? face[k] : 0;
      const [x0, y0] = pt(r0 + 0.6, t);
      const [x1, y1] = pt(r0 + 1.6 + 1.2 * ((k * 7) % 3) * 0.5, t);
      d += `M${f1(x0)} ${f1(y0)}L${f1(x1)} ${f1(y1)}`;
    }
    s += `<path d="${d}" fill="none" stroke="${INK}" stroke-width=".9" stroke-linecap="round" stroke-linejoin="round"/>`;
  }

  // Medullary rays: dashed, from a seeded ring outwards, none through a scar.
  const outer = radii[n - 1];
  const at = (rs: number[], t: number) => rs[Math.round((((t % TAU) + TAU) % TAU) / (TAU / K)) % K];
  let rays = "";
  const nRays = 28 + Math.floor(rnd() * 16);
  for (let i = 0; i < nRays; i++) {
    const t = ((i + 0.5 * rnd()) / nRays) * TAU;
    if (inWedge(t)) continue;
    // From a seeded ring (in a young tree, from part way out), to the bark.
    const r0 = n < 4 ? at(outer, t) * (0.15 + 0.45 * rnd()) : at(radii[Math.floor(rnd() * n * 0.6)], t);
    const [x0, y0] = pt(r0, t), [x1, y1] = pt(at(outer, t) - 0.8, t);
    rays += `M${f1(x0)} ${f1(y0)}L${f1(x1)} ${f1(y1)}`;
  }
  if (rays) s += `<path d="${rays}" fill="none" stroke="${INK}" stroke-width=".5" stroke-dasharray="2 2.6"/>`;

  // Checks: two to four drying cracks from the bark inwards, cut through the rings (the ground over them), clear of the scars.
  const nChecks = n < 2 ? 0 : 2 + Math.floor(rnd() * 3);
  for (let i = 0; i < nChecks; i++) {
    let t0 = ((i + 0.3 + 0.4 * rnd()) / nChecks) * TAU;
    for (let tries = 0; tries < 8 && inWedge(t0); tries++) t0 += 0.35;
    if (inWedge(t0)) continue;
    const depth = 0.3 + 0.35 * rnd();
    const wig = rnd() * TAU;
    const side = (sgn: number) =>
      Array.from({ length: 13 }, (_, q) => {
        const f = q / 12;
        const r = at(outer, t0) * (1 - depth * (1 - f)) + (f === 1 ? 0.6 : 0);
        const half = (1.9 * f + 0.15) / r;
        return pt(r, t0 + 0.012 * Math.sin(9 * f + wig) + sgn * half);
      });
    const pts = [...side(-1), ...side(1).reverse()];
    s += `<path d="${polyline(pts, true)}" fill="${GROUND}" stroke="${INK}" stroke-width=".4" stroke-linejoin="round"/>`;
  }

  // The pith, and the decade dots along one radius (clear of the scars).
  s += dot(CX, CY, 1.1);
  let td = rnd() * TAU;
  for (let tries = 0; tries < 12 && inWedge(td); tries++) td += 0.5;
  for (let j = 0; j < n; j++) {
    const y = p.b + j;
    if (y % 10 || j === 0) continue;
    const mid = (at(radii[j], td) + (j ? at(radii[j - 1], td) : 0)) / 2;
    const count = y % 100 === 0 ? 3 : y % 50 === 0 ? 2 : 1;
    for (let q = 0; q < count; q++) {
      const off = (q - (count - 1) / 2) * 2.2;
      const [x, yy] = pt(mid, td);
      s += dot(x - Math.sin(td) * off, yy + Math.cos(td) * off, 0.65);
    }
  }

  // The bark: the cambium bold, a rough outer edge, fissures between.
  const barkW = th.map((t) => 3.4 + 1.6 * (0.5 + 0.5 * Math.sin(5 * t + ph[1])) + 1.4 * rnd());
  s += `<path d="${polyline(th.map((t, k) => pt(outer[k] + 0.2, t)), true)}" fill="none" stroke="${INK}" stroke-width=".9"/>`;
  s += `<path d="${polyline(th.map((t, k) => pt(outer[k] + barkW[k], t)), true)}" fill="none" stroke="${INK}" stroke-width=".8" stroke-linejoin="round"/>`;
  let fis = "";
  for (let k = 0; k < K; k += 2) {
    const t = th[k] + (rnd() - 0.5) * 0.02;
    const [x0, y0] = pt(outer[k] + 1.3, t), [x1, y1] = pt(outer[k] + barkW[k] * (0.55 + 0.4 * rnd()), t);
    fis += `M${f1(x0)} ${f1(y0)}L${f1(x1)} ${f1(y1)}`;
  }
  s += `<path d="${fis}" fill="none" stroke="${INK}" stroke-width=".5" stroke-linecap="round"/>`;

  const count = (d: string) => [...p.m].filter((x) => x === d).length;
  const good = count("2"), hard = count("0");
  const bits = [good ? `${good} good ${good === 1 ? "year" : "years"}` : "", hard ? `${hard} hard` : ""].filter(Boolean);
  const sc = p.s ?? [];
  if (sc.length) bits.push(sc.length === 1 ? `a scar in ${sc[0]}` : `scars in ${sc.slice(0, -1).join(", ")} and ${sc[sc.length - 1]}`);
  const span = n === 1 ? `${p.b} · one ring` : `${p.b}–${p.c} · ${n} rings`;
  return s + caption(344, p.w ?? "Tree rings", span, bits.join(" · ") || undefined);
}

export const render = (spec: CustomSpec, color: BaseColor) => wrap(ringsBody((spec as { p: Params }).p), color);
