/**
 * Your Monogram: two or three initials drawn as interlaced ribbons from a
 * constructed alphabet (lib/custom/draw/monogram), in one of three
 * arrangements, with an optional year.
 */
import { isObj, type Cap, type CapRule } from "../specKit";
import type { CheckContext, ProductMeta } from "./types";

export const MONO_STYLES = ["lace", "stack", "seal"] as const;
export type MonoStyle = (typeof MONO_STYLES)[number];

export interface Params {
  /** The initials, two or three capitals A–Z. */
  x: string;
  /** Side by side and woven, one above another, or in a round seal. */
  s: MonoStyle;
  /** The year under it (1900–2100). */
  y?: number;
  cap?: Cap;
}

export const NAME = "Your Monogram";
const INITIALS = /^[A-Z]{2,3}$/;

/** What's wrong with the initials as typed (one line), or null. */
export function initialsProblem(raw: string): string | null {
  const t = raw.replace(/[\s.]/g, "").toUpperCase();
  const bad = [...t].find((c) => !/[A-Z]/.test(c));
  if (bad) {
    const plain = bad.normalize("NFKD").replace(/\p{M}/gu, "");
    return /^[A-Z]$/.test(plain) ? `Letters A to Z only. Try "${plain}".` : "Letters A to Z only";
  }
  return t.length < 2 || t.length > 3 ? "Two or three letters" : null;
}

/** The caption: every line can go (each gated with it hidden, tests/make/captions.test.ts). */
export const CAP: CapRule = { hide: [true, true, true] };

export function check(p: Record<string, unknown>, _ctx: CheckContext): Params | null {
  if (!isObj(p) || typeof p.x !== "string" || !INITIALS.test(p.x)) return null;
  if (!(MONO_STYLES as readonly unknown[]).includes(p.s)) return null;
  if (p.y !== undefined && (typeof p.y !== "number" || !Number.isInteger(p.y) || p.y < 1900 || p.y > 2100)) return null;
  return { x: p.x, s: p.s as MonoStyle, ...(p.y !== undefined ? { y: p.y as number } : {}) };
}

export const detail = (p: Params) => [[...p.x].join("."), p.y].filter(Boolean).join(" · ");

export const PRODUCT: ProductMeta<Params> = {
  line: "Your initials, woven as ribbons.",
  from: "Two or three initials",
  group: "name",
  base: "rosette",
  bases: ["rosette", "guilloche"],
  example: { x: "NDL", s: "seal", y: 2024 },
  hints: { dense: "Try another arrangement.", faint: "Try another arrangement." },
};
