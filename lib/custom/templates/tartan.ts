/**
 * Your Tartan: a swatch of cloth woven to the sett (derived from the name,
 * or edited), with a fringe of loose warp at each end. There is no textile
 * design among the catalogue's variants, so it is drawn like the nearest,
 * the Tiling (Truchet) designs: a square repeat filling a framed field, its
 * tone made by the pattern alone. Here the tiles are threads: the 2/2 twill
 * (lib/custom/draw/tartan) shows each warp or weft float as a stroke along
 * its thread, the tone's weight, the densest capped so it never fills.
 * The sett is centred on its first pivot, so the swatch is symmetric.
 */
import { INK, caption, f1, captionLines, type Lines, house } from "../kit";
import { WEIGHT, deriveSett, repeatOf } from "../draw/tartan";
import type { CustomSpec } from "../spec";
import { parseSett, type Params, type Tone } from "../specs/tartan";
import { mulberry32 } from "../rng";
import { wrap } from "../svg";
import type { BaseColor } from "@/types/shirt";

/** The swatch's box (the fringe outside it, above and below). */
const BOX = { x: 24, y: 34, w: 252, h: 262 };
const FRINGE = 7;
/** Air at each end of a float. */
const END = 0;

/** The drawing, the caption's lines as ours, and where the caption sits. */
function tartanDraw(p: Params): [string, Lines, number] {
  const sett = p.t ? parseSett(p.t)! : deriveSett(p.n);
  const rep = repeatOf(sett);
  const u = Math.min(4.6, Math.max(3.2, BOX.w / rep.length));
  const cols = Math.floor(BOX.w / u), rows = Math.floor(BOX.h / u);
  const x0 = 150 - (cols * u) / 2, y0 = BOX.y + (BOX.h - rows * u) / 2;
  const tone = (i: number, n: number) => rep[(((i - Math.floor(n / 2)) % rep.length) + rep.length) % rep.length];
  const warpUp = (i: number, j: number) => (i + j) % 4 < 2;
  const d: Record<string, string> = {};
  const add = (key: string, s: string) => (d[key] = (d[key] ?? "") + s);
  // Warp floats: down each column, the runs where the warp is on top.
  for (let i = 0; i < cols; i++) {
    const t = tone(i, cols);
    if (!WEIGHT[t]) continue;
    const x = f1(x0 + (i + 0.5) * u);
    for (let j = 0; j < rows; ) {
      if (!warpUp(i, j)) {
        j++;
        continue;
      }
      let k = j;
      while (k < rows && warpUp(i, k)) k++;
      add(t, `M${x} ${f1(y0 + j * u + END)}V${f1(y0 + k * u - END)}`);
      j = k;
    }
  }
  // Weft floats: along each row, where the weft is on top.
  for (let j = 0; j < rows; j++) {
    const t = tone(j, rows);
    if (!WEIGHT[t]) continue;
    const y = f1(y0 + (j + 0.5) * u);
    for (let i = 0; i < cols; ) {
      if (warpUp(i, j)) {
        i++;
        continue;
      }
      let k = i;
      while (k < cols && !warpUp(k, j)) k++;
      add(t, `M${f1(x0 + i * u + END)} ${y}H${f1(x0 + k * u - END)}`);
      i = k;
    }
  }
  const width = (t: Tone) => f1(Math.max(0.4, u * WEIGHT[t]));
  let s = "";
  for (const t of ["K", "D", "L"] as Tone[]) if (d[t]) s += `<path d="${d[t]}" fill="none" stroke="${INK}" stroke-width="${width(t)}"/>`;

  // The selvedges, and a fringe of loose warp at each end (every thread, blank ones at the finest weight), a little uneven.
  const rnd = mulberry32(rep.length * 7919 + cols);
  s += `<path d="M${f1(x0)} ${f1(y0)}V${f1(y0 + rows * u)}M${f1(x0 + cols * u)} ${f1(y0)}V${f1(y0 + rows * u)}" fill="none" stroke="${INK}" stroke-width=".5"/>`;
  const fringe: Record<string, string> = {};
  for (let i = 0; i < cols; i++) {
    const t = tone(i, cols);
    const key = WEIGHT[t] ? t : "L";
    const x = f1(x0 + (i + 0.5) * u);
    fringe[key] = (fringe[key] ?? "") + `M${x} ${f1(y0 - 1)}V${f1(y0 - FRINGE * (0.7 + 0.3 * rnd()))}M${x} ${f1(y0 + rows * u + 1)}V${f1(y0 + rows * u + FRINGE * (0.7 + 0.3 * rnd()))}`;
  }
  for (const t of ["K", "D", "L"] as Tone[]) if (fringe[t]) s += `<path d="${fringe[t]}" fill="none" stroke="${INK}" stroke-width="${width(t)}" stroke-linecap="round"/>`;

  const written = sett.map(([t, c]) => `${t}${c}`).join(" ");
  return [s, [`The ${p.n} Sett`, `${written} · 2/2 twill`, p.w], 338];
}
/** The caption's lines (ours). */
export const tartanCaption = (p: Params): Lines => tartanDraw(p)[1];

export function tartanBody(p: Params): string {
  const [s, lines, y] = tartanDraw(p);
  return s + caption(y, ...captionLines(lines, p.cap));
}

export const captionOf = (spec: CustomSpec) => tartanCaption((spec as { p: Params }).p);

export const render = (spec: CustomSpec, color: BaseColor) => house(() => wrap(tartanBody((spec as { p: Params }).p), color));
