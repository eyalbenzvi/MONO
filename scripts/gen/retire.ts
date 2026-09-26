/**
 * Retired designs: the silliest, most childish or most repetitive prints,
 * taken out of the catalog after a content review (about 40%). The
 * generator still makes every design (so ids and prints of the rest never
 * change), then drops these before families, ranks and neighbours.
 *
 * Rules (with the reviewer's reasons):
 * - whole variants of joke content: caricatures (office-joke stereotypes),
 *   pun icons / odd-one-out puzzles / joke diagrams, joke receipts, fake
 *   warning signs and misattributed quotes, 8-bit sprites / game screens /
 *   terminal jokes, ASCII "LOL/NOPE" banners and robot doodles, icon-plus-
 *   meme-caption "iconic" variants, novelty badges / labels / tickets;
 * - repeats: a second photograph of the same subject (the better one
 *   stays), and near-identical homages (the best 12 of each);
 * - within some variants, only the strongest (by print quality) stay.
 */
export interface RetireInput {
  id: string;
  category: string;
  variant: string;
  quality: number;
  subject: string;
  photo?: unknown;
}

const WHOLE_VARIANTS = new Set([
  // caricatures (all four)
  "caricature-portrait", "caricature-wanted", "caricature-mugshot", "caricature-bobble",
  // objects
  "objecticon", "oddoneout", "diagram",
  // slogans
  "receipt", "warning", "quote",
  // pixel
  "sprite", "gamescreen", "terminal", "ascii",
  // ascii
  "ascii-banner", "ascii-art",
  // iconic: icon + meme caption
  "iconic-anchor", "iconic-astronaut", "iconic-atom", "iconic-dna", "iconic-dove", "iconic-earthrise",
  "iconic-footprint", "iconic-launch", "iconic-palms", "iconic-plane", "iconic-ufo",
  // emblems
  "badge", "label", "ticket",
]);

/** Keep only the best N (by quality) of these variants. */
const KEEP_TOP: Record<string, number> = {
  poster: 20,
  crest: 25,
  woodcut: 25,
  "ascii-shade": 25,
  "iconic-landmark": 25,
  monoform: 20,
  gesture: 20,
};
/** Homages (famous art): the best 12 of each. */
const HOMAGE_KEEP = 12;

/**
 * Photographs and scans whose backdrop was never cut out: the picture lands
 * on the tee as a rectangle of ink (content overhaul, Part 0). Cut-outs of
 * them come back through the halftone pipeline (scripts/photos/halftone).
 */
export const NOT_CUT_OUT = /^(photo-(wildlife|flight|machines)-frame|archive-(art-photo|archive-photo|locomotion))$/;

/** Retired whatever its measures (whole variants, backdrops never cut out): not worth measuring. */
export const alwaysRetired = (variant: string) => WHOLE_VARIANTS.has(variant) || NOT_CUT_OUT.test(variant);

/** The retired designs and why each went (the reason before a colon is its kind). */
export function retiredIds(list: RetireInput[]): Map<string, string> {
  const out = new Map<string, string>();
  const add = (id: string, why: string) => out.has(id) || out.set(id, why);
  const byQuality = (a: RetireInput, b: RetireInput) => b.quality - a.quality || a.id.localeCompare(b.id);
  const groups = new Map<string, RetireInput[]>();
  for (const s of list) {
    if (WHOLE_VARIANTS.has(s.variant)) {
      add(s.id, "content review: joke or novelty variant");
      continue;
    }
    if (NOT_CUT_OUT.test(s.variant)) {
      add(s.id, "backdrop not cut out: prints as a rectangle (Part 0)");
      continue;
    }
    const keep = KEEP_TOP[s.variant] ?? (s.variant.startsWith("art-") ? HOMAGE_KEEP : undefined);
    if (keep !== undefined) groups.set(s.variant, [...(groups.get(s.variant) ?? []), s]);
  }
  for (const [variant, members] of groups) {
    const keep = KEEP_TOP[variant] ?? HOMAGE_KEEP;
    members.sort(byQuality).slice(keep).forEach((s) => add(s.id, "content review: repeats of one variant"));
  }
  // Photographs: one per subject (the best print of it).
  const bySubject = new Map<string, RetireInput[]>();
  for (const s of list) if (s.photo) bySubject.set(`${s.category}|${s.subject}`, [...(bySubject.get(`${s.category}|${s.subject}`) ?? []), s]);
  for (const members of bySubject.values()) members.sort(byQuality).slice(1).forEach((s) => add(s.id, "content review: second photograph of a subject"));
  return out;
}

/* ------------------------------------------------------------------ */
/* Content overhaul (Part 1): what goes, by rule                        */
/* ------------------------------------------------------------------ */

export interface OverhaulInput extends RetireInput {
  n: number;
  medium: "drawn" | "ink" | "photo";
  family: string;
  title: string;
  /** The design's own sentence. */
  base: string;
  /** The ink's bounding box as a share of the print (scripts/gen/quality assessPrint). */
  extent: number;
  flags: string[];
}

/** Whole variants taken out, with the reason (Part 1.1–1.6). */
const OVERHAUL_VARIANTS: [RegExp, string][] = [
  [/^art-/, "Part 1.1: Masterworks parody homage"],
  [/^iconic-/, "Part 1.2: souvenir landmark or travel poster"],
  [/^woodcut$/, "Part 1.3: clip-art icon in a sunburst"],
  [/^pixelscape$/, "Part 1.4: pixel sunset clone"],
  [/^(gesture|scatter|ridges)$/, "Part 1.5: scribble, scattered primitives or pulsar ridges"],
  [/^(word|manifesto|repeat)$/, "Part 1.6: random words set as type"],
  [/^stamp$/, "Part 1.6: stamp dated 2026"],
  [/^coordinates$/, "Part 1.6: invented survey coordinates (not real data)"],
  [/^crest$/, "Part 1.6: novelty crest with a joke motto"],
];
/** Type posters that set a real phrase (the rest are jokes): kept. */
const REAL_PHRASE_POSTERS = new Set(["mono-1082", "mono-1762"]);
/** Near-duplicates (Part 1.7): at most this many of one family, of one generated subject. */
export const PER_FAMILY = 2;
export const PER_SUBJECT = 5;
/** Archive crops that are a sliver of the print (Part 1.10). */
export const ARCHIVE_SLIVER = 0.25;

/**
 * The content overhaul's removals (Part 1), on the designs that survived
 * the earlier reviews. Picks within a group go by the quality score
 * (scripts/gen/quality assessPrint), best first.
 */
export function overhaulRetired(list: OverhaulInput[]): Map<string, string> {
  const out = new Map<string, string>();
  const add = (id: string, why: string) => out.has(id) || out.set(id, why);
  const best = (a: OverhaulInput, b: OverhaulInput) => b.quality - a.quality || a.n - b.n;
  for (const s of list) {
    const whole = OVERHAUL_VARIANTS.find(([re]) => re.test(s.variant));
    if (whole) add(s.id, whole[1]);
    else if (s.variant === "poster" && !REAL_PHRASE_POSTERS.has(s.id)) add(s.id, "Part 1.6: type poster with a joke, not a real phrase");
    // Part 1.9: 5- and 6-fold star rosettes read as a pentagram or hexagram.
    else if (s.variant === "rosette" && /\b[56]-fold\b/.test(s.base)) add(s.id, "Part 1.9: star rosette reading as a pentagram or hexagram");
    // Part 1.10: a sliver of a picture, a paper edge or vignette, a flat snapshot (archive prints; cut-out objects may be wide).
    else if (s.medium === "ink" && (s.extent < ARCHIVE_SLIVER || s.flags.includes("vignette") || s.flags.includes("flat")))
      add(s.id, `Part 1.10: unusable crop (${s.extent < ARCHIVE_SLIVER ? "sliver" : s.flags.includes("vignette") ? "paper edge or vignette" : "flat picture"})`);
  }
  // Part 1.7: near-duplicates among the generated designs — the best of each family, then of each subject.
  const groups = (key: (s: OverhaulInput) => string, keep: number, why: string) => {
    const by = new Map<string, OverhaulInput[]>();
    for (const s of list) if (s.medium === "drawn" && !out.has(s.id)) by.set(key(s), [...(by.get(key(s)) ?? []), s]);
    for (const members of by.values()) members.sort(best).slice(keep).forEach((s) => add(s.id, why));
  };
  groups((s) => s.family, PER_FAMILY, "Part 1.7: near-duplicate (more than two of one family)");
  groups((s) => s.subject.toLowerCase(), PER_SUBJECT, "Part 1.7: one generated subject too many times (more than five)");
  // Photographs: one per subject — the retitled, generic subject (Part 1.8, Part 2).
  const photos = new Map<string, OverhaulInput[]>();
  for (const s of list) if (s.medium === "photo" && !out.has(s.id)) {
    const key = s.title.replace(/, Take \d+$/, "").toLowerCase();
    photos.set(key, [...(photos.get(key) ?? []), s]);
  }
  for (const members of photos.values()) members.sort(best).slice(1).forEach((s) => add(s.id, "Part 2: one photograph per subject"));
  return out;
}
