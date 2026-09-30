/**
 * Your Dinosaur: a palaeontology plate. A skeleton (one of eight, drawn in
 * code as a monograph's restoration, lib/custom/draw/dinosaurs), a
 * scientific name made from the child's
 * name (an ending of the visitor's choosing, never an existing genus
 * exactly), the facts (discovered, height, diet) and a scale bar in the
 * child's own height. Drawn by lib/custom/templates/dinosaur.
 */
import genera from "../../../data/dinosaurs/genera.json";
import { FIRST_YEAR, LAST_YEAR, int, label, type Cap, type CapRule } from "../specKit";
import type { CheckContext, ProductMeta } from "./types";

export const PLATES = ["tyrannosaurus", "triceratops", "stegosaurus", "brontosaurus", "allosaurus", "diplodocus", "iguanodon", "pteranodon"] as const;
export type Plate = (typeof PLATES)[number];
export const ENDINGS = ["saurus", "raptor", "don", "ceratops"] as const;
export type Ending = (typeof ENDINGS)[number];
/** The second half of the name, with what it means (the editor says). */
export const SPECIES = { rex: "king", magnus: "large", velox: "swift", minimus: "smallest", horridus: "bristling", dormiens: "asleep", gloriosus: "glorious", esuriens: "hungry" } as const;
export type Species = keyof typeof SPECIES;

/** Each plate: what the print calls it, the ending it suggests, when it lived, and the caption's remark on it. */
export const PLATE_INFO: Record<Plate, { name: string; ending: Ending; period: string; note: string }> = {
  tyrannosaurus: { name: "Tyrannosaurus", ending: "raptor", period: "Late Cretaceous", note: "Arms as found" },
  triceratops: { name: "Triceratops", ending: "ceratops", period: "Late Cretaceous", note: "Three horns, one frill" },
  stegosaurus: { name: "Stegosaurus", ending: "saurus", period: "Late Jurassic", note: "Plates in two rows" },
  brontosaurus: { name: "Brontosaurus", ending: "saurus", period: "Late Jurassic", note: "A genus again since 2015" },
  allosaurus: { name: "Allosaurus", ending: "raptor", period: "Late Jurassic", note: "Horns over the eyes" },
  diplodocus: { name: "Diplodocus", ending: "saurus", period: "Late Jurassic", note: "Mostly neck and tail" },
  iguanodon: { name: "Iguanodon", ending: "don", period: "Early Cretaceous", note: "The spike is a thumb" },
  pteranodon: { name: "Pteranodon", ending: "don", period: "Late Cretaceous", note: "Not strictly a dinosaur" },
};

export interface Params {
  /** The child's name. */
  n: string;
  /** The plate. */
  k: Plate;
  /** The name's ending (absent: the plate's own). */
  e?: Ending;
  /** The species (absent: rex). */
  s?: Species;
  /** Discovered (the year born; optional). */
  y?: number;
  /** Height, cm (optional). */
  h?: number;
  /** Diet (optional). */
  d?: string;
  cap?: Cap;
}

export const NAME = "Your Dinosaur";
export const DINO_NAME_MAX = 14;
export const DIET_MAX = 14;
export const HEIGHT_MIN = 40, HEIGHT_MAX = 220;

/** The caption: every line can go (each gated with it hidden, tests/make/captions.test.ts). */
export const CAP: CapRule = { hide: [true, true, true] };

/** The genera there are, by ending (data/dinosaurs/genera.json, from Wikipedia's list): a made-up name is never one of them. */
const TAKEN = new Set(ENDINGS.flatMap((e) => (genera as unknown as Record<Ending, string[]>)[e].map((stem) => `${stem}${e}`)));
export const isGenus = (name: string) => TAKEN.has(name);

/** The name's stem: the first name's letters, accents dropped, capitalised ("Zoë Levi" → "Zoe"). */
export function stemOf(name: string): string {
  const first = name.normalize("NFD").replace(/\p{M}/gu, "").split(/[\s-]+/)[0].replace(/[^A-Za-z]/g, "").toLowerCase();
  return first.charAt(0).toUpperCase() + first.slice(1);
}

/**
 * The genus: the stem and the ending, joined as the names are (an o after a
 * consonant before -saurus and -don: Tomosaurus, Tomodon; Tomraptor,
 * Tomceratops), and when that is a genus already, the next joining that
 * isn't (Noasaurus is Argentinian: Noaosaurus).
 */
export function genusOf(name: string, ending: Ending): string {
  const stem = stemOf(name);
  const vowel = /[aeiouy]$/i.test(stem);
  const first = !vowel && (ending === "saurus" || ending === "don") ? "o" : "";
  for (const join of [first, "o", "i", "ia", "ae", "io"]) {
    const g = `${stem}${join}${ending}`;
    if (!isGenus(g)) return g;
  }
  return `${stem}ioaeo${ending}`;
}

/** The whole name: genus and species. */
export const scientificName = (p: Pick<Params, "n" | "k" | "e" | "s">) => `${genusOf(p.n, p.e ?? PLATE_INFO[p.k].ending)} ${p.s ?? "rex"}`;

export function check(p: Record<string, unknown>, _ctx: CheckContext): Params | null {
  if (!label(p.n, DINO_NAME_MAX) || stemOf(p.n as string).length < 2) return null;
  if (!(PLATES as readonly unknown[]).includes(p.k)) return null;
  if (p.e !== undefined && !(ENDINGS as readonly unknown[]).includes(p.e)) return null;
  if (p.s !== undefined && !(typeof p.s === "string" && Object.hasOwn(SPECIES, p.s))) return null;
  if (p.y !== undefined && !int(p.y, FIRST_YEAR, LAST_YEAR)) return null;
  if (p.h !== undefined && !int(p.h, HEIGHT_MIN, HEIGHT_MAX)) return null;
  if (p.d !== undefined && !label(p.d, DIET_MAX)) return null;
  const k = p.k as Plate;
  return { n: p.n as string, k, ...(p.e !== undefined ? { e: p.e as Ending } : {}), ...(p.s !== undefined ? { s: p.s as Species } : {}), ...(p.y !== undefined ? { y: p.y as number } : {}), ...(p.h !== undefined ? { h: p.h as number } : {}), ...(p.d !== undefined ? { d: p.d as string } : {}) };
}

export const detail = (p: Params) => scientificName(p);

export const PRODUCT: ProductMeta<Params> = {
  line: "A palaeontology plate of a new species, named after its discoverer’s child.",
  from: "A name, a skeleton, a height",
  group: "name",
  base: "type-data",
  bases: ["type-data", "poster"],
  wordsHint: "Maya",
  hints: { dense: "Try another skeleton.", faint: "Try another skeleton." },
  example: { n: "Maya", k: "triceratops", s: "horridus", y: 2019, h: 112, d: "pasta" },
};
