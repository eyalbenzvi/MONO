/**
 * Your Landmarks: a page of a travel journal. Three to nine of fifty landmarks, each
 * a line drawing (lib/custom/draw/landmarks) in a small taped-in frame with
 * its name and the year you were there, and the name and the
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
  arc: "Arc de Triomphe",
  stbasils: "St Basil’s Cathedral",
  stonehenge: "Stonehenge",
  atomium: "Atomium",
  stpeters: "St Peter’s Basilica",
  hagiasophia: "Hagia Sophia",
  matterhorn: "Matterhorn",
  kinderdijk: "Kinderdijk Windmills",
  chichenitza: "Chichén Itzá",
  spaceneedle: "Space Needle",
  cntower: "CN Tower",
  chrysler: "Chrysler Building",
  gatewayarch: "Gateway Arch",
  petronas: "Petronas Towers",
  heaven: "Temple of Heaven",
  kinkakuji: "Golden Pavilion",
  itsukushima: "Itsukushima Shrine",
  marinabay: "Marina Bay Sands",
  taipei101: "Taipei 101",
  table: "Table Mountain",
  kilimanjaro: "Kilimanjaro",
  abusimbel: "Abu Simbel",
  djenne: "Great Mosque of Djenné",
  uluru: "Uluru",
  harbour: "Sydney Harbour Bridge",
  moai: "Easter Island Moai",
} as const;
export type Landmark = keyof typeof LANDMARKS;
export const LANDMARK_IDS = Object.keys(LANDMARKS) as Landmark[];

/** The picker's regions, in its order. */
export const REGIONS = ["Europe", "Asia", "Africa", "Americas", "Oceania"] as const;
export type Region = (typeof REGIONS)[number];

/** Each landmark's region (the picker's groups) and where it is (what the picker's filter also matches: "paris", "japan"). */
export const LANDMARK_PLACES: Record<Landmark, [region: Region, where: string]> = {
  eiffel: ["Europe", "Paris, France"],
  colosseum: ["Europe", "Rome, Italy"],
  bigben: ["Europe", "London, United Kingdom"],
  tajmahal: ["Asia", "Agra, India"],
  giza: ["Africa", "Giza, Egypt"],
  machupicchu: ["Americas", "Cusco, Peru"],
  greatwall: ["Asia", "China"],
  sydneyopera: ["Oceania", "Sydney, Australia"],
  goldengate: ["Americas", "San Francisco, United States"],
  liberty: ["Americas", "New York, United States"],
  westernwall: ["Asia", "Jerusalem"],
  petra: ["Asia", "Jordan"],
  acropolis: ["Europe", "Athens, Greece"],
  sagrada: ["Europe", "Barcelona, Spain"],
  towerbridge: ["Europe", "London, United Kingdom"],
  pisa: ["Europe", "Pisa, Italy"],
  redeemer: ["Americas", "Rio de Janeiro, Brazil"],
  fuji: ["Asia", "Japan"],
  angkor: ["Asia", "Siem Reap, Cambodia"],
  brandenburg: ["Europe", "Berlin, Germany"],
  burjkhalifa: ["Asia", "Dubai, United Arab Emirates"],
  empirestate: ["Americas", "New York, United States"],
  neuschwanstein: ["Europe", "Bavaria, Germany"],
  santorini: ["Europe", "Greece"],
  arc: ["Europe", "Paris, France"],
  stbasils: ["Europe", "Moscow, Russia"],
  stonehenge: ["Europe", "Wiltshire, United Kingdom"],
  atomium: ["Europe", "Brussels, Belgium"],
  stpeters: ["Europe", "Vatican City"],
  hagiasophia: ["Europe", "Istanbul, Turkey"],
  matterhorn: ["Europe", "Zermatt, Switzerland"],
  kinderdijk: ["Europe", "Netherlands"],
  chichenitza: ["Americas", "Yucatán, Mexico"],
  spaceneedle: ["Americas", "Seattle, United States"],
  cntower: ["Americas", "Toronto, Canada"],
  chrysler: ["Americas", "New York, United States"],
  gatewayarch: ["Americas", "St Louis, United States"],
  petronas: ["Asia", "Kuala Lumpur, Malaysia"],
  heaven: ["Asia", "Beijing, China"],
  kinkakuji: ["Asia", "Kyoto, Japan"],
  itsukushima: ["Asia", "Miyajima, Japan"],
  marinabay: ["Asia", "Singapore"],
  taipei101: ["Asia", "Taipei, Taiwan"],
  table: ["Africa", "Cape Town, South Africa"],
  kilimanjaro: ["Africa", "Tanzania"],
  abusimbel: ["Africa", "Aswan, Egypt"],
  djenne: ["Africa", "Djenné, Mali"],
  uluru: ["Oceania", "Northern Territory, Australia"],
  harbour: ["Oceania", "Sydney, Australia"],
  moai: ["Oceania", "Rapa Nui, Chile"],
};

/** Letters without their accents, lower case, one kind of apostrophe: how the picker's filter matches ("chichen" finds Chichén Itzá). */
const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").replace(/’/g, "'").toLowerCase();

/** The landmarks the picker shows: in one region (or all), matching the filter by name or by where it is. */
export function shownLandmarks(region: Region | "All", filter: string): Landmark[] {
  const q = fold(filter.trim());
  return LANDMARK_IDS.filter((id) => (region === "All" || LANDMARK_PLACES[id][0] === region) && (!q || fold(`${LANDMARKS[id]} ${LANDMARK_PLACES[id][1]}`).includes(q)));
}

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
  line: "A page of a travel journal: every landmark you’ve stood in front of, drawn.",
  from: "The landmarks you’ve seen",
  group: "travels",
  base: "contours",
  bases: ["contours", "type-data"],
  wordsHint: "Noa",
  hints: { dense: "Try fewer landmarks.", faint: "Try another landmark or two." },
  example: { n: "Noa", x: [["eiffel", 2009], ["colosseum", 2012], ["tajmahal", 2015], ["towerbridge", 2017], ["pisa", 2019], ["acropolis", 2026]] },
};
