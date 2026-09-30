/**
 * Your Landmarks: a page of a travel journal. Three to nine landmarks, each
 * a drawing (data/art/landmarks: public-domain or CC0 pictures from
 * Wikimedia Commons, traced or screened at build time) in a small taped-in
 * frame with its name and the year you were there, and the name and the
 * years under the page ("NOA · 2009–2026"). Drawn by
 * lib/custom/templates/landmarks.
 */
import { FIRST_YEAR, LAST_YEAR, int, label, type Cap, type CapRule } from "../specKit";
import type { CheckContext, ProductMeta } from "./types";

/** The landmarks, in the picker's order: the id a link carries, and the name the print sets. */
export const LANDMARKS = {
  eiffel: "Eiffel Tower",
  colosseum: "Colosseum",
  bigben: "Big Ben",
  tajmahal: "Taj Mahal",
  giza: "Pyramids of Giza",
  machupicchu: "Machu Picchu",
  greatwall: "Great Wall",
  sydneyopera: "Sydney Opera House",
  goldengate: "Golden Gate Bridge",
  liberty: "Statue of Liberty",
  westernwall: "Western Wall",
  petra: "Petra",
  acropolis: "Acropolis",
  sagrada: "Sagrada Família",
  towerbridge: "Tower Bridge",
  pisa: "Leaning Tower of Pisa",
  redeemer: "Christ the Redeemer",
  fuji: "Mount Fuji",
  angkor: "Angkor Wat",
  brandenburg: "Brandenburg Gate",
  burjkhalifa: "Burj Khalifa",
  empirestate: "Empire State Building",
  neuschwanstein: "Neuschwanstein",
  santorini: "Santorini",
} as const;
export type Landmark = keyof typeof LANDMARKS;
export const LANDMARK_IDS = Object.keys(LANDMARKS) as Landmark[];

/** A visit: the landmark, and the year (optional). */
export type Visit = [id: Landmark, year?: number];

export interface Params {
  /** Whose journal (optional). */
  n?: string;
  x: Visit[];
  cap?: Cap;
}

export const NAME = "Your Landmarks";
export const LANDMARKS_MIN = 3, LANDMARKS_MAX = 9;
export const JOURNAL_NAME_MAX = 14;

/** The caption: every line can go (each gated with it hidden, tests/make/captions.test.ts). */
export const CAP: CapRule = { hide: [true, true, true] };

export function check(p: Record<string, unknown>, _ctx: CheckContext): Params | null {
  if (p.n !== undefined && !label(p.n, JOURNAL_NAME_MAX)) return null;
  if (!Array.isArray(p.x) || p.x.length < LANDMARKS_MIN || p.x.length > LANDMARKS_MAX) return null;
  const x: Visit[] = [];
  for (const e of p.x as unknown[]) {
    if (!Array.isArray(e) || e.length < 1 || e.length > 2 || typeof e[0] !== "string" || !Object.hasOwn(LANDMARKS, e[0])) return null;
    if (e.length === 2 && !int(e[1], FIRST_YEAR, LAST_YEAR)) return null;
    // Each landmark once.
    if (x.some(([id]) => id === e[0])) return null;
    x.push(e.length === 2 ? [e[0] as Landmark, e[1] as number] : [e[0] as Landmark]);
  }
  return { ...(p.n !== undefined ? { n: p.n as string } : {}), x };
}

export const detail = (p: Params) => `${p.x.length} landmarks`;

export const PRODUCT: ProductMeta<Params> = {
  line: "A page of a travel journal: every landmark you've stood in front of, drawn.",
  from: "The landmarks you've seen",
  group: "travels",
  base: "contours",
  bases: ["contours", "type-data"],
  wordsHint: "Noa",
  hints: { dense: "Try fewer landmarks.", faint: "Try another landmark or two." },
  example: { n: "Noa", x: [["eiffel", 2009], ["colosseum", 2012], ["tajmahal", 2015], ["towerbridge", 2017], ["pisa", 2019], ["acropolis", 2026]] },
};
