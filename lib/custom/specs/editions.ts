/**
 * Limited Editions: a collector's label for a family. Up to EDITIONS_MAX
 * numbered rows (a name and, if given, the year), and a round seal with the
 * maker's role and the year the series began ("Grandpa · est. 1952"). Drawn
 * by lib/custom/templates/editions.
 */
import { FIRST_YEAR, LAST_YEAR, int, label, type Cap, type CapRule } from "../specKit";
import type { CheckContext, ProductMeta } from "./types";

/** An edition: its name, and the year it came out. */
export type Edition = [name: string, year?: number];

export interface Params {
  /** The editions, No. 1 first. */
  x: Edition[];
  /** The maker, on the seal ("Grandpa"). */
  r: string;
  /** The year the series was established (absent: the seal says so without one). */
  e?: number;
  cap?: Cap;
}

export const NAME = "Limited Editions";
export const EDITIONS_MAX = 8;
export const EDITION_NAME_MAX = 14;
export const ROLE_MAX = 12;

/** The caption: every line can go (each gated with it hidden, tests/make/captions.test.ts). */
export const CAP: CapRule = { hide: [true, true, true] };

export function check(p: Record<string, unknown>, _ctx: CheckContext): Params | null {
  if (!Array.isArray(p.x) || p.x.length < 1 || p.x.length > EDITIONS_MAX) return null;
  const x: Edition[] = [];
  for (const e of p.x as unknown[]) {
    if (!Array.isArray(e) || e.length < 1 || e.length > 2 || !label(e[0], EDITION_NAME_MAX)) return null;
    if (e.length === 2 && !int(e[1], FIRST_YEAR, LAST_YEAR)) return null;
    x.push(e.length === 2 ? [e[0], e[1] as number] : [e[0]]);
  }
  if (!label(p.r, ROLE_MAX)) return null;
  if (p.e !== undefined && !int(p.e, FIRST_YEAR, LAST_YEAR)) return null;
  return { x, r: p.r as string, ...(p.e !== undefined ? { e: p.e as number } : {}) };
}

export const detail = (p: Params) => `${p.r} · ${p.x.length} ${p.x.length === 1 ? "edition" : "editions"}`;

export const PRODUCT: ProductMeta<Params> = {
  line: "A numbered series of your family, from one maker.",
  from: "Your people, numbered",
  group: "people",
  base: "guilloche",
  bases: ["guilloche"],
  wordsHint: "Grandpa",
  hints: { dense: "Try fewer or shorter names.", faint: "Try another name or two." },
  example: { x: [["Dana", 1978], ["Avi", 1981], ["Maya", 2015], ["Noa", 2018], ["Ari", 2021]], r: "Grandpa", e: 1952 },
};
