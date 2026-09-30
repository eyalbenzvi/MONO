/**
 * Your Birth Announcement: a 1950s card. IT'S A GIRL, IT'S A BOY or HELLO
 * WORLD, the name large, a table of the day, the time, the weight and the
 * length (metric or imperial, as typed, in plausible ranges) and the city
 * (data/cities, by GeoNames id), and if wanted that night's moon. Drawn by
 * lib/custom/templates/birth.
 */
import { int, label, parseDate, parseTime, type Cap, type CapRule } from "../specKit";
import type { CheckContext, ProductMeta } from "./types";

export type Hello = "girl" | "boy" | "hello";

export interface Params {
  h: Hello;
  n: string;
  d: string;
  /** The time, hh:mm (optional). */
  t?: string;
  /** "i": imperial (the weight in ounces, the length in tenths of an inch); absent: metric (grams, millimetres). */
  u?: "i";
  wt?: number;
  ln?: number;
  /** The city (a GeoNames id in data/cities; optional). */
  c?: number;
  /** 1: that night's moon. */
  mo?: 1;
  cap?: Cap;
}

export const NAME = "Your Birth Announcement";
export const HELLOS: readonly Hello[] = ["girl", "boy", "hello"];
export const BABY_NAME_MAX = 18;
/** A name of one letter left the card too plain for the gate (flat): two at least. */
export const BABY_NAME_MIN = 2;
/** Plausible ranges, as typed: grams and millimetres, or ounces and tenths of an inch. */
export const WEIGHT = { metric: [400, 6500], imperial: [14, 230] } as const;
export const LENGTH = { metric: [250, 650], imperial: [100, 256] } as const;

/** The caption: every line can go (each gated with it hidden, tests/make/captions.test.ts). */
export const CAP: CapRule = { hide: [true, true, true] };

export function check(p: Record<string, unknown>, ctx: CheckContext): Params | null {
  if (!HELLOS.includes(p.h as Hello) || !label(p.n, BABY_NAME_MAX) || (p.n as string).length < BABY_NAME_MIN || !parseDate(p.d)) return null;
  if (p.t !== undefined && !parseTime(p.t)) return null;
  if (p.u !== undefined && p.u !== "i") return null;
  const sys = p.u === "i" ? "imperial" : "metric";
  if (p.wt !== undefined && !int(p.wt, WEIGHT[sys][0], WEIGHT[sys][1])) return null;
  if (p.ln !== undefined && !int(p.ln, LENGTH[sys][0], LENGTH[sys][1])) return null;
  if (p.c !== undefined && (!int(p.c, 1, 0xffffffff) || (ctx.cityById && !ctx.cityById(p.c as number)))) return null;
  if (p.mo !== undefined && p.mo !== 1) return null;
  return {
    h: p.h as Hello,
    n: p.n as string,
    d: p.d as string,
    ...(p.t !== undefined ? { t: p.t as string } : {}),
    ...(p.u === "i" ? { u: "i" as const } : {}),
    ...(p.wt !== undefined ? { wt: p.wt as number } : {}),
    ...(p.ln !== undefined ? { ln: p.ln as number } : {}),
    ...(p.c !== undefined ? { c: p.c as number } : {}),
    ...(p.mo === 1 ? { mo: 1 as const } : {}),
  };
}

/** The weight and length as printed: "3.4 kg", "7 lb 8 oz", "51 cm", "20.1 in". */
export const weightText = (p: Pick<Params, "u" | "wt">) => (p.wt === undefined ? "" : p.u === "i" ? `${Math.floor(p.wt / 16)} lb ${p.wt % 16} oz` : `${(p.wt / 1000).toFixed(p.wt % 100 ? (p.wt % 10 ? 3 : 2) : 1)} kg`);
export const lengthText = (p: Pick<Params, "u" | "ln">) => (p.ln === undefined ? "" : p.u === "i" ? `${(p.ln / 10).toFixed(p.ln % 10 ? 1 : 0)} in` : `${(p.ln / 10).toFixed(p.ln % 10 ? 1 : 0)} cm`);

export const detail = (p: Params) => p.n;

export const PRODUCT: ProductMeta<Params> = {
  line: "A birth announcement from the 1950s, with that night’s moon.",
  from: "A name, a day, a weight",
  group: "people",
  base: "moon-year",
  bases: ["moon-year", "type-data"],
  wordsHint: "Noa",
  hints: { dense: "Try a shorter name.", faint: "Add the time, the weight or the moon." },
  // Tel Aviv (GeoNames 293397).
  example: { h: "girl", n: "Noa", d: "2021-11-19", t: "04:12", wt: 3400, ln: 510, c: 293397, mo: 1 },
};
