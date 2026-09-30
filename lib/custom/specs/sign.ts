/**
 * Your Sign: a sign, three ways. A street sign (the name in condensed
 * capitals, a small line under it), a round plaque (words round its top,
 * up to three lines in the middle) or a warning sign (a triangle or a panel,
 * one of twelve pictograms, CAUTION and a line). Drawn by
 * lib/custom/templates/sign.
 */
import { PICTOGRAMS, type Pictogram } from "../draw/pictograms";
import { label, type Cap, type CapRule } from "../specKit";
import type { CheckContext, ProductMeta } from "./types";

export type SignStyle = "street" | "plaque" | "warning";

export interface Params {
  s: SignStyle;
  /** The street's name; the words round the plaque's top (not a warning). */
  n?: string;
  /** The line under the street's name, or the warning's line. */
  l?: string;
  /** The plaque's lines, one to three. */
  x?: string[];
  /** The warning's pictogram, and whether it sits on a panel (else in a bare triangle). */
  pc?: Pictogram;
  pn?: 1;
  cap?: Cap;
}

export const NAME = "Your Sign";
export const SIGN_STYLES: readonly SignStyle[] = ["street", "plaque", "warning"];
export const STREET_MAX = 18;
export const ARC_MAX = 28;
export const SIGN_LINE_MAX = 28;
export const PLAQUE_LINE_MAX = 22;
export const PLAQUE_LINES = 3;

/** The caption: every line can go (each gated with it hidden, tests/make/captions.test.ts). */
export const CAP: CapRule = { hide: [true, true, true] };

export function check(p: Record<string, unknown>, _ctx: CheckContext): Params | null {
  if (p.s === "street") {
    if (!label(p.n, STREET_MAX) || (p.l !== undefined && !label(p.l, SIGN_LINE_MAX))) return null;
    if (p.x !== undefined || p.pc !== undefined || p.pn !== undefined) return null;
    return { s: "street", n: p.n as string, ...(p.l !== undefined ? { l: p.l as string } : {}) };
  }
  if (p.s === "plaque") {
    if (!label(p.n, ARC_MAX)) return null;
    if (!Array.isArray(p.x) || p.x.length < 1 || p.x.length > PLAQUE_LINES || !p.x.every((v) => label(v, PLAQUE_LINE_MAX))) return null;
    if (p.l !== undefined || p.pc !== undefined || p.pn !== undefined) return null;
    return { s: "plaque", n: p.n as string, x: [...(p.x as string[])] };
  }
  if (p.s === "warning") {
    if (!PICTOGRAMS.includes(p.pc as Pictogram) || !label(p.l, SIGN_LINE_MAX)) return null;
    if (p.pn !== undefined && p.pn !== 1) return null;
    if (p.n !== undefined || p.x !== undefined) return null;
    return { s: "warning", pc: p.pc as Pictogram, l: p.l as string, ...(p.pn === 1 ? { pn: 1 as const } : {}) };
  }
  return null;
}

export const detail = (p: Params) => (p.s === "warning" ? `Caution · ${p.l}` : p.n!);

export const PRODUCT: ProductMeta<Params> = {
  line: "A street named after you, a plaque on your house, or a warning about you.",
  from: "A name, or a warning",
  group: "form",
  base: "poster",
  bases: ["poster", "type-data"],
  wordsHint: "Maya Lane",
  hints: { dense: "Try a shorter line.", faint: "Try a longer name or line." },
  example: { s: "warning", pc: "mug", l: "Not before the first coffee", pn: 1 },
};
