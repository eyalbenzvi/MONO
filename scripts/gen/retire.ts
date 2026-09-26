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
