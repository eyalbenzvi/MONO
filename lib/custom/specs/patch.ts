/**
 * Your Mission Patch: a round patch for a family's mission. The mission's
 * name round the top, the crew round the foot, one of ten emblems in the
 * middle and the day under it, a stitched border round it all. Drawn by
 * lib/custom/templates/patch.
 */
import { EMBLEMS, type Emblem } from "../draw/emblems";
import { label, parseDate, type Cap, type CapRule } from "../specKit";
import type { CheckContext, ProductMeta } from "./types";

export interface Params {
  /** The mission ("Operation Beach"). */
  m: string;
  /** The crew, one to CREW_MAX names. */
  x: string[];
  e: Emblem;
  /** The day it launched (optional). */
  d?: string;
  cap?: Cap;
}

export const NAME = "Your Mission Patch";
export const MISSION_MAX = 22;
export const CREW_MAX = 6;
export const CREW_NAME_MAX = 10;

/** The caption: every line can go (each gated with it hidden, tests/make/captions.test.ts). */
export const CAP: CapRule = { hide: [true, true, true] };

/** The crew round the foot, as they print: at most 40 characters, so the letters stay a readable size. */
export const crewLine = (x: readonly string[]) => x.join(" · ").toUpperCase();
export const CREW_LINE_MAX = 44;

export function check(p: Record<string, unknown>, _ctx: CheckContext): Params | null {
  if (!label(p.m, MISSION_MAX) || !EMBLEMS.includes(p.e as Emblem)) return null;
  if (!Array.isArray(p.x) || p.x.length < 1 || p.x.length > CREW_MAX || !p.x.every((n) => label(n, CREW_NAME_MAX))) return null;
  if (crewLine(p.x as string[]).length > CREW_LINE_MAX) return null;
  if (p.d !== undefined && !parseDate(p.d)) return null;
  return { m: p.m as string, x: [...(p.x as string[])], e: p.e as Emblem, ...(p.d !== undefined ? { d: p.d as string } : {}) };
}

export const detail = (p: Params) => p.m;

export const PRODUCT: ProductMeta<Params> = {
  line: "A mission patch for your crew, whatever the mission was.",
  from: "A mission and its crew",
  group: "people",
  base: "orbit-moons",
  bases: ["orbit-moons", "celestial"],
  wordsHint: "Operation Beach",
  hints: { dense: "Try a shorter crew.", faint: "Try a longer mission name." },
  example: { m: "Operation Beach", x: ["Mum", "Dad", "Noa", "Ari"], e: "tent", d: "2024-08-03" },
};
