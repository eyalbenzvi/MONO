/**
 * Your Metro Map: your story as a transit map. 2–4 lines (people or eras,
 * up to 10 characters each) and 4–16 stations in order (up to 14
 * characters), each with the lines that stop there (a bit per line); every
 * line stops at two stations at least and shares one with another line
 * (one network; four stations at least, as fewer would draw a lone line,
 * too faint to print). Optional words for the title. Drawn by
 * lib/custom/templates/metro.
 */
import { int, label, wordsOf } from "../specKit";
import type { CheckContext, ProductMeta } from "./types";

export interface Params {
  /** The lines' names, in order (their order sets their stroke: solid, double, dashed, dotted). */
  l: string[];
  /** The stations, in order along the map. */
  s: string[];
  /** Per station, the lines that stop there: bit i for line i. */
  k: number[];
  w?: string;
}

export const NAME = "Your Metro Map";
export const METRO_LINES = [2, 4] as const;
/** At least four: fewer is a line, not a map. */
export const METRO_STATIONS = [4, 16] as const;
export const LINE_MAX = 10;
export const STATION_MAX = 14;
export const LINE_STYLES = ["solid", "double", "dashed", "dotted"] as const;

/** Why these lines and stops don't make a map (one line), or null. */
export function metroProblem(lines: number, k: readonly number[]): string | null {
  if (k.length < METRO_STATIONS[0]) return `Add at least ${METRO_STATIONS[0]} stations`;
  if (k.length > METRO_STATIONS[1]) return `Up to ${METRO_STATIONS[1]} stations`;
  if (k.some((m) => m === 0)) return "Every station needs a line";
  for (let i = 0; i < lines; i++) if (k.filter((m) => m & (1 << i)).length < 2) return "Every line needs two stations";
  // One network: every line meets another at a station (else it's lines side by side, not a map).
  for (let i = 0; i < lines; i++) if (!k.some((m) => m & (1 << i) && m !== 1 << i)) return "Every line needs to share a station with another";
  return null;
}

export function check(p: Record<string, unknown>, _ctx: CheckContext): Params | null {
  const { l, s, k } = p;
  if (!Array.isArray(l) || l.length < METRO_LINES[0] || l.length > METRO_LINES[1] || !l.every((x) => label(x, LINE_MAX))) return null;
  if (!Array.isArray(s) || !Array.isArray(k) || s.length !== k.length || !s.every((x) => label(x, STATION_MAX))) return null;
  if (!k.every((m) => int(m, 1, (1 << l.length) - 1)) || metroProblem(l.length, k as number[])) return null;
  const words = wordsOf(p);
  if (!words) return null;
  return { l: [...(l as string[])], s: [...(s as string[])], k: [...(k as number[])], ...words };
}

export const detail = (p: Params) => p.w ?? p.l.join(" · ");

export const PRODUCT: ProductMeta<Params> = {
  line: "Your story as a metro map: its people as lines, its places as stations.",
  from: "Lines and their stations",
  group: "people",
  base: "schematic",
  wordsHint: "How we got here",
  example: {
    l: ["Noa", "Dan", "Maya"],
    s: ["Haifa", "Tel Aviv", "Army", "Jaffa", "Berlin", "Wedding", "Florentin", "Maya born", "Ramat Gan", "Home"],
    k: [1, 3, 2, 1, 2, 3, 3, 7, 6, 7],
    w: "How we got here",
  },
  hints: { dense: "Try fewer stations, or shorter names.", faint: "Try more stations." },
};
