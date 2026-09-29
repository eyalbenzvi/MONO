/**
 * Your Family Orbits: a family as a solar system (lib/custom/templates/orbits):
 * the eldest (or whoever you choose) the sun, everyone else on an orbit by
 * age, each at the angle of their birthday. Names and birth dates; the
 * dates travel packed (days since 1900 as varints), so nine people still fit a link.
 */
import { isObj, label, packInts, parseDate, unpackInts, wordsOf } from "../specKit";
import type { CheckContext, ProductMeta } from "./types";

export interface Params {
  /** The names, as typed (up to ORBIT_NAME characters each), in the order given. */
  n: string[];
  /** Their birth dates, packed: days since 1900-01-01, one per name, in the same order (packDays). */
  b: string;
  /** Who's the sun, by position in `n`, when it isn't the eldest. */
  s?: number;
  w?: string;
}

export const NAME = "Your Family Orbits";
export const ORBIT_MIN = 2;
export const ORBIT_MAX = 9;
export const ORBIT_NAME = 12;

const EPOCH = Date.UTC(1900, 0, 1);
const LAST = (Date.UTC(2100, 11, 31) - EPOCH) / 86_400_000;
/** "YYYY-MM-DD" → days since 1900-01-01 (a valid date in 1900–2100). */
export const dayOf = (d: string) => {
  const [y, m, dd] = parseDate(d)!;
  return (Date.UTC(y, m - 1, dd) - EPOCH) / 86_400_000;
};
/** Days since 1900-01-01 → [year, month, day]. */
export const dateOf = (n: number): [number, number, number] => {
  const t = new Date(EPOCH + n * 86_400_000);
  return [t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()];
};
/** Birth dates ("YYYY-MM-DD") as the spec's `b`. */
export const packDays = (dates: string[]) => packInts(dates.map(dayOf));
/** The spec's `b` read back: days since 1900, or null. */
export const unpackDays = (b: unknown): number[] | null => {
  const v = unpackInts(b, 3 * ORBIT_MAX);
  return v && v.every((n) => n >= 0 && n <= LAST) ? v : null;
};
/** The eldest's position (the first of them on a tie): the sun unless another is chosen. */
export const eldest = (days: number[]) => days.indexOf(Math.min(...days));

export function check(p: Record<string, unknown>, _ctx: CheckContext): Params | null {
  if (!isObj(p) || !Array.isArray(p.n) || p.n.length < ORBIT_MIN || p.n.length > ORBIT_MAX) return null;
  if (!p.n.every((s) => label(s, ORBIT_NAME))) return null;
  const days = unpackDays(p.b);
  if (!days || days.length !== p.n.length) return null;
  // The sun: a position in the list, and written only when it isn't the eldest (one spelling per print).
  if (p.s !== undefined && (typeof p.s !== "number" || !Number.isInteger(p.s) || p.s < 0 || p.s >= days.length || p.s === eldest(days))) return null;
  const w = wordsOf(p);
  if (!w) return null;
  return { n: [...(p.n as string[])], b: p.b as string, ...(p.s !== undefined ? { s: p.s as number } : {}), ...w };
}

export const detail = (p: Params) => p.w ?? `${p.n.length} people`;

export const PRODUCT: ProductMeta<Params> = {
  line: "Your family as a solar system: an orbit each, a birthday for its place.",
  from: "Names and birthdays",
  group: "people",
  base: "orbit-moons",
  bases: ["orbit-moons", "orbit-halley"],
  wordsHint: "The Levins",
  // Miriam 1948-03-14, David 1951-11-02, Ruth 1976-06-21, Jonathan 1979-01-30, Noa 2008-09-05, Ella 2012-04-17.
  example: { n: ["Miriam", "David", "Ruth", "Jonathan", "Noa", "Ella"], b: "iJMC6KcCtLQDpsMDnOwE7IAF", w: "The Levins" },
  hints: { dense: "Try fewer people.", faint: "Try more people." },
};
