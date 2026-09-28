/**
 * The metadata filter: which records of a world are worth downloading, from
 * the text the source gives (title, classification, tags, description) and
 * the image's size. No picture is looked at. Every refusal carries a reason,
 * counted per reason in the wave's counts.json.
 *
 * Figures in historical prints and drawings (a craftsman at a Diderot bench,
 * sailors on a deck) are allowed when they aren't the subject; a portrait, a
 * figure study or a nude is not. In a photograph, no person at all.
 */

export interface MetaInput {
  record: string;
  title: string;
  classification: string;
  tags: string[];
  description: string;
  /** A photograph (people rules are strict), or a drawing, print or plate. */
  photo: boolean;
  hasImage: boolean;
  width: number | null;
  height: number | null;
  date: string | null;
  maker: string | null;
  credit: string;
  sha?: string;
}

export interface MetaOptions {
  /** The world's keywords (lowercase; multi-word allowed). */
  keywords: readonly string[];
  /** Maritime signal flags are the subject (the sea wave): "flag" isn't refused. */
  signalFlags?: boolean;
  minShortSide?: number;
  /** The world's word must be in the title itself (general art museums, whose tags name what's somewhere in a scene). */
  titleMatch?: boolean;
}

export type Reason = "no-image" | "low-res" | "strip" | "duplicate" | "off-world" | "classification" | "people" | "text" | "brand" | "unsuitable" | "narrative";
export interface MetaDecision {
  keep: boolean;
  reasons: Reason[];
  score: number;
  matched: string[];
}

export const MIN_SHORT_SIDE = 1500;
export const MAX_ASPECT = 3;

const words = (list: string[]) => new RegExp(`\\b(?:${list.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "[\\s-]+")).join("|")})s?\\b`, "i");

export const PEOPLE = words(["portrait", "self-portrait", "man", "woman", "men", "women", "child", "children", "girl", "boy", "people", "crowd", "figure", "soldier", "family", "worker", "crew", "person", "lady", "gentleman", "sailor", "fisherman", "fishermen", "fisher", "youth", "bather", "bathers", "bathing", "gathering", "preparing", "dabblers", "vendor", "shop"]);
/** People as the subject of a print or drawing. */
export const PEOPLE_SUBJECT = words(["portrait", "self-portrait", "bust of", "head of a", "figure study", "study of a man", "study of a woman", "nude", "academy figure", "likeness"]);
export const TEXT = words(["cigarette", "tobacco", "trading card", "playing card", "letter", "manuscript", "document", "page of text", "title page", "certificate", "advertisement", "poster", "label", "trade card", "sheet music", "newspaper", "broadside", "book cover", "ticket", "stamp", "postage stamp", "coin", "banknote", "frontispiece", "bookplate", "calligraphy", "inscription"]);
export const BRAND = words(["logo", "insignia", "emblem", "coat of arms", "armorial", "official seal", "great seal", "seal of", "badge", "trademark", "brand"]);
const FLAG = words(["flag"]);
export const UNSUITABLE = words(["erotic", "nude", "violence", "execution", "war", "battle", "massacre", "devotional", "crucifixion", "madonna", "annunciation", "virgin and child", "holy family", "caricature", "satire", "satirical", "cartoon", "fashion plate", "fragment", "textile swatch", "swatch", "study sheet", "sketchbook page"]);
/**
 * A scene rather than a subject (with no eye on the picture, a story's title is the only warning):
 * sacred and mythological figures, fables, allegories. And a long title in a print or drawing tells
 * a story more often than it names a thing.
 */
export const NARRATIVE = words(["virgin", "saint", "st", "head of medusa", "medusa's head", "apocalypse", "revelation", "angel", "christ", "jonah", "tobias", "bible", "biblical", "apostle", "prophet", "triton", "galatea", "nereid", "neptune", "poseidon", "venus", "cupid", "putto", "putti", "god", "goddess", "allegory", "fable", "myth", "mythological", "legend", "renard", "miracle"]);
export const LONG_TITLE_WORDS = 7;
/** Scientific plates and specimens, where a long Latin title is still one subject. */
const PLATE_CLASS = words(["plate", "specimen", "natural history", "illustration", "zoology", "botany", "chromolithograph"]);

/** Classifications worth a print (preferred in the order). */
export const GOOD_CLASS = words(["print", "drawing", "photograph", "map", "chart", "illustration", "plate", "technical drawing", "patent drawing", "specimen", "scientific instrument", "engraving", "etching", "woodcut", "lithograph", "woodblock", "measured drawing", "architectural drawing"]);
/** Classifications that are never a print (a record's own label). */
export const BAD_CLASS = words(["textile", "costume", "ceramic", "furniture", "jewelry", "book", "manuscript", "coin", "medal", "sculpture", "vessel", "glass", "painting on canvas", "letter", "document", "ephemera", "stamp"]);

const yearOf = (date: string | null) => {
  const m = /\b(1[0-9]{3}|20[0-2][0-9])\b/.exec(date ?? "");
  return m ? Number(m[1]) : null;
};

/** The filter, for one record. `seen` holds the records and shas already kept (duplicates). */
export function metaFilter(c: MetaInput, o: MetaOptions, seen: { records: Set<string>; shas: Set<string> }): MetaDecision {
  const reasons: Reason[] = [];
  const title = c.title ?? "";
  const all = [title, c.classification, ...c.tags, c.description].join(" · ");
  const lower = all.toLowerCase();
  const matched = o.keywords.filter((k) => words([k]).test(lower));

  if (!c.hasImage) reasons.push("no-image");
  if (c.width && c.height) {
    if (Math.min(c.width, c.height) < (o.minShortSide ?? MIN_SHORT_SIDE)) reasons.push("low-res");
    if (Math.max(c.width, c.height) / Math.min(c.width, c.height) > MAX_ASPECT) reasons.push("strip");
  }
  if (seen.records.has(c.record) || (c.sha && seen.shas.has(c.sha))) reasons.push("duplicate");
  if (!matched.length || (o.titleMatch && !matched.some((k) => words([k]).test(title)))) reasons.push("off-world");
  if (c.classification && BAD_CLASS.test(c.classification) && !GOOD_CLASS.test(c.classification)) reasons.push("classification");
  // People: in a photograph anywhere in the title, classification or tags; in a print or drawing only as its subject.
  const named = [title, c.classification, ...c.tags].join(" · ");
  if (c.photo ? PEOPLE.test(named) : PEOPLE_SUBJECT.test(named) || (PEOPLE.test(title) && !matched.some((k) => words([k]).test(title)))) reasons.push("people");
  if (TEXT.test(named)) reasons.push("text");
  if (BRAND.test(named) || (FLAG.test(named) && !o.signalFlags)) reasons.push("brand");
  if (UNSUITABLE.test(named)) reasons.push("unsuitable");
  if (!c.photo && (NARRATIVE.test(title) || (!PLATE_CLASS.test(c.classification) && title.split(/\s+/).length > LONG_TITLE_WORDS))) reasons.push("narrative");

  const keep = reasons.length === 0;
  if (keep) {
    seen.records.add(c.record);
    if (c.sha) seen.shas.add(c.sha);
  }
  // Order (numbers from the metadata only): the world's words, a preferred classification, age, a full record.
  const year = yearOf(c.date);
  const age = year ? Math.max(0, Math.min(1.5, (2000 - year) / 200)) : 0;
  const titled = matched.filter((k) => words([k]).test(title)).length;
  const score = Math.round((matched.length + titled * 2 + (GOOD_CLASS.test(c.classification) ? 2 : 0) + age + (c.maker && c.date && c.credit ? 1 : 0)) * 100) / 100;
  return { keep, reasons, score, matched };
}

/** Counts per reason (a record refused for two reasons counts in both). */
export function countReasons(list: MetaDecision[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const d of list) for (const r of d.reasons) out[r] = (out[r] ?? 0) + 1;
  return out;
}
