/**
 * Your Taste: a plant grown from a taste. A phyllotaxis head (the
 * catalogue's seed heads) on an L-system stem (its plants), every part of
 * it set by one axis of the taste, quantised to tenths (lib/custom/
 * tasteCode), so near tastes grow the same plant. The caption names the
 * taste (its archetype) and its three strongest traits.
 *
 * | Axis                          | What it sets                                             |
 * | ----------------------------- | -------------------------------------------------------- |
 * | nature, pictorial             | leaves: how many (nature) and how big (pictorial)        |
 * | geometric                     | the branching: the golden angle exact at 1, jittered at 0 |
 * | density                       | the L-system's rewrites (3–6) and the head's seed count  |
 * | line_art                      | the stroke: thin at 1                                    |
 * | clean_minimal                 | pruning: fewer branches                                  |
 * | dark_industrial               | angular joints (else the branches are smoothed)          |
 * | retro, classic                | engraved hatching on the leaves                          |
 * | wit                           | one leaf out of place                                    |
 * | photographic, halftone_raster | the head as stipple (else as seeds in rings)             |
 * | typography                    | the caption set larger                                   |
 * | architectural                 | a straight stem on a stake                               |
 * | abstract                      | the head replaced by concentric rings                    |
 * | contrast                      | the seeds filled (else open)                             |
 * | figurative                    | the seeds grow outwards (else shrink)                    |
 */
import { DEG, INK, caption, captionLines, circle, clip, f1, fitSize, line, text, type Lines, house } from "../kit";
import { lsystem, turtle } from "../draw/botany";
import { polyline, type Point } from "../draw/paths";
import { tasteFromQ } from "../tasteCode";
import type { CustomSpec, TasteParams } from "../spec";
import { wrap } from "../svg";
import { archetypeOf } from "@/lib/taste";
import { FEATURE_LABELS, type BaseColor, type FeatureKey } from "@/types/shirt";
import { mulberry32 } from "../rng";

const HEAD = { x: 150, y: 94 };
const GROUND = 302;

/** Chaikin's corner cutting: a branch's polyline smoothed (two passes). */
function smooth(pts: Point[]): Point[] {
  let p = pts;
  for (let k = 0; k < 2; k++) {
    if (p.length < 3) return p;
    const out: Point[] = [p[0]];
    for (let i = 0; i < p.length - 1; i++) {
      const [a, b] = [p[i], p[i + 1]];
      out.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]], [0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]);
    }
    out.push(p[p.length - 1]);
    p = out;
  }
  return p;
}

/** The L-system's lines scaled about their root (the turtle's start, 0 0) and set on the stem's foot: at most `half` wide either side, `h` tall. */
function rooted(lines: Point[][], half: number, h: number): Point[][] {
  let [reach, top] = [0, 0];
  for (const l of lines) for (const [x, y] of l) (reach = Math.max(reach, Math.abs(x))), (top = Math.min(top, y));
  const k = Math.min(half / (reach || 1), h / (-top || 1));
  return lines.map((l) => l.map(([x, y]) => [150 + x * k, GROUND + y * k] as Point));
}

/** A leaf: a pointed oval along its angle, hatched when engraved. */
function leaf(x: number, y: number, angle: number, size: number, w: number, hatch: boolean): string {
  const [c, s] = [Math.cos(angle), Math.sin(angle)];
  const at = (u: number, v: number) => `${f1(x + u * c - v * s)} ${f1(y + u * s + v * c)}`;
  const half = size * 0.32;
  let out = `<path d="M${at(0, 0)}Q${at(size / 2, half)} ${at(size, 0)}Q${at(size / 2, -half)} ${at(0, 0)}Z" fill="none" stroke="${INK}" stroke-width="${f1(w)}" stroke-linejoin="round"/>`;
  out += line(x, y, x + size * 0.85 * c, y + size * 0.85 * s, w * 0.6);
  if (hatch) for (let k = 1; k < 5; k++) {
    const u = (size * k) / 5;
    const v = half * Math.sin((Math.PI * k) / 5) * 0.8;
    out += `<line x1="${at(u, -v).split(" ")[0]}" y1="${at(u, -v).split(" ")[1]}" x2="${at(u, v).split(" ")[0]}" y2="${at(u, v).split(" ")[1]}" stroke="${INK}" stroke-width="${f1(w * 0.5)}"/>`;
  }
  return out;
}

export function tasteBody(p: TasteParams): string {
  const v = tasteFromQ(p.q);
  const rng = mulberry32(parseInt(p.q.slice(0, 6), 36) + 1);
  const w = 1.9 - 0.9 * v.line_art;
  const straight = v.architectural >= 0.6;
  // The stem and its branches: an L-system, pruned by clean_minimal, walked with geometric's regularity.
  const iter = 3 + Math.round(3 * v.density);
  const rule = v.clean_minimal >= 0.6 ? "F[+X]F[-X]X" : v.clean_minimal >= 0.3 ? "F[+X]F[-X]+X" : "F+[[X]-X]-F[-FX]+X";
  const str = lsystem({ axiom: "X", rules: { X: rule, F: "FF" }, iter: Math.min(iter, v.clean_minimal >= 0.6 ? 6 : 5) });
  const jitterAmp = 1 - v.geometric;
  const lines = turtle(str, straight ? 18 : 22.5, 0, () => 0.5 + (rng() - 0.5) * jitterAmp);
  // Rooted where the stem meets the ground (so the branches grow from the plant, not beside it), scaled to reach at most 80 either side and to stop under the head.
  let fitted = rooted(lines, 80, GROUND - (HEAD.y + 52 + 14));
  if (v.dark_industrial < 0.5) fitted = fitted.map(smooth);
  let body = `<path d="${fitted.map((l) => polyline(l)).join("")}" fill="none" stroke="${INK}" stroke-width="${f1(w)}" stroke-linecap="round" stroke-linejoin="${v.dark_industrial >= 0.5 ? "miter" : "round"}"/>`;
  // The main stem up to the head, straight on a stake when architectural.
  body += line(150, GROUND, HEAD.x, HEAD.y + 57, w * 1.4);
  if (straight) body += line(158, GROUND + 4, 158, HEAD.y + 66, w * 0.8) + line(150, HEAD.y + 80, 158, HEAD.y + 80, w * 0.6) + line(150, HEAD.y + 150, 158, HEAD.y + 150, w * 0.6);
  body += line(96, GROUND, 204, GROUND, w);

  // Leaves along the stem: nature sets how many, pictorial how big; wit puts one out of place.
  const leaves = 6 + Math.round(8 * v.nature);
  const size = 16 + 16 * v.pictorial;
  const hatch = (v.retro + v.classic) / 2 >= 0.5;
  const odd = v.wit >= 0.6 ? Math.floor(rng() * leaves) : -1;
  for (let i = 0; i < leaves; i++) {
    const t = (i + 0.5) / leaves;
    const y = GROUND - 12 - t * (GROUND - HEAD.y - 70);
    const side = i % 2 ? 1 : -1;
    const a = (side > 0 ? -30 : 210) * DEG + (rng() - 0.5) * jitterAmp * 0.5;
    body += i === odd ? leaf(150 + side * 50, y - 6, a + Math.PI, size * 0.8, w, hatch) : leaf(150, y, a, size * (1 - t * 0.4), w, hatch);
  }

  // The head: rings when abstract; else seeds, stippled or in open or filled seeds.
  const seeds = 200 + Math.round(260 * v.density);
  const R = 52;
  if (v.abstract >= 0.6) for (let k = 1; k <= 7; k++) body += circle(HEAD.x, HEAD.y, (R * k) / 7, k % 2 ? w : w * 0.5);
  else {
    const stipple = Math.max(v.photographic, v.halftone_raster) >= 0.5;
    const filled = v.contrast >= 0.5;
    const angle = 137.508 + (1 - v.geometric) * (rng() - 0.5) * 3;
    for (let i = 1; i <= seeds; i++) {
      const r = R * Math.sqrt(i / seeds);
      const th = i * angle * DEG;
      const grow = v.figurative >= 0.5 ? Math.sqrt(i / seeds) : 1 - Math.sqrt(i / seeds) * 0.7;
      const size = stipple ? 0.7 + 0.6 * grow : 1 + 1.6 * grow;
      const [x, y] = [HEAD.x + r * Math.cos(th), HEAD.y + r * Math.sin(th)];
      body += filled || stipple ? `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(size)}" fill="${INK}"/>` : circle(x, y, size, 0.7);
    }
    body += circle(HEAD.x, HEAD.y, R + 5, w);
  }

  // The caption: the taste's name and its three strongest traits (or the visitor's lines); typography sets it larger.
  const [name, sub, sub2] = captionLines(tasteCaption(p), p.cap);
  if (v.typography >= 0.6) {
    // The house lockup a size up: the name in Space Grotesk Bold capitals (tracked lightly, as large capitals are), the lines in Plex.
    const t = name?.toUpperCase();
    if (t) {
      const size = fitSize(t, 256, 17, { family: "grotesk", bold: true, track: 0.05 });
      body += text(150, 334, t, size, { family: "grotesk", bold: true, spacing: Math.round(size * 0.5) / 10 });
    }
    const small = (l: string, y: number, max: number) => {
      const size = fitSize(l, 256, max, { track: 0.05, floor: 4.5 });
      return text(150, y, clip(l, 256, size, { spacing: Math.round(size * 0.5) / 10 }), size, { spacing: Math.round(size * 0.5) / 10 });
    };
    if (sub) body += small(sub, 352, 8.4);
    if (sub2) body += small(sub2, 364, 7.2);
  } else body += caption(336, name, sub, sub2);
  return body;
}

/** The caption's lines (ours): the taste's name and its strongest traits. */
export function tasteCaption(p: TasteParams): Lines {
  const { name, traits } = archetypeOf(tasteFromQ(p.q));
  return [name, traits.length ? traits.map((k: FeatureKey) => FEATURE_LABELS[k]).join(" · ") : "Still finding its way"];
}

export const captionOf = (spec: CustomSpec) => tasteCaption((spec as { p: TasteParams }).p);

export const render = (spec: CustomSpec, color: BaseColor) => house(() => wrap(tasteBody((spec as { p: TasteParams }).p), color));
