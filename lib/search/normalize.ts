/**
 * Search text normalization, shared by the index builder (Node) and the
 * browser: the same words must come out of a design's text and a shopper's
 * query. English only for now; the word lists are data, so another language
 * can add its own.
 */

/** Words that say nothing about a design (a query for "a tee with a wave" is "wave"). */
export const STOPWORDS = new Set([
  "the", "a", "an", "of", "and", "from", "with", "in", "on", "as", "at", "by", "for", "to", "its", "it", "is", "are", "or", "this", "that", "into",
  "tee", "tees", "shirt", "shirts", "t", "print", "prints", "design", "designs",
  // Dates and measures in credits and captions ("ca. 1890", "n.d.", "22 × 33 cm"), and a lone letter ("ukiyo e").
  "ca", "cm", "n", "d", "e",
]);

/** British → American (the index and the query fold to one spelling). */
const SPELLING: [RegExp, string][] = [
  [/^colour/, "color"],
  [/^grey/, "gray"],
  [/^centre/, "center"],
  [/^metre/, "meter"],
  [/^theatre/, "theater"],
  [/^aeroplane/, "airplane"],
  [/^jewellery/, "jewelry"],
  [/^(harb|parl|hum|arm|hon|fav|neighb|vap|col|flav)our/, "$1or"],
  [/(.{3,})is(e|ed|es|ing|ation)$/, "$1iz$2"],
];

/** Lowercase, no accents, apostrophes joined (d'amalia → damalia), other punctuation a space. */
export function clean(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/(\p{L})['’](\p{L})/gu, "$1$2")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Words that only look like a plural or an -ing form. */
const KEEP = new Set(["evening", "morning", "nothing", "something", "anything", "everything", "ceiling", "herring", "sterling", "starling", "bunting", "lightning", "pudding", "wedding", "species", "series"]);

/**
 * A light rule stemmer: plurals, then -ing, so "waves" finds "wave" and
 * "engravings", "engraving" and "engrave"'s stem meet ("engrav").
 */
export function stem(word: string): string {
  let w = word;
  for (const [re, to] of SPELLING) w = w.replace(re, to);
  if (/\d/.test(w) || w.length <= 3 || KEEP.has(w)) return w;
  if (w.endsWith("ies") && w.length > 4) return `${w.slice(0, -3)}y`;
  if (w.endsWith("sses")) w = w.slice(0, -2);
  else if (/(x|ch|sh|zz)es$/.test(w)) w = w.slice(0, -2);
  else if (w.endsWith("s") && !/(ss|us|is)$/.test(w)) w = w.slice(0, -1);
  if (KEEP.has(w)) return w;
  if (w.endsWith("ing") && w.length - 3 >= 4) {
    w = w.slice(0, -3);
    // "running" → "run", but "falling", "dressing" keep their pair.
    if (/([^aeiouls])\1$/.test(w)) w = w.slice(0, -1);
    return w;
  }
  // "engrave" and "engraving" meet at "engrav".
  if (w.endsWith("e") && w.length > 4 && !/[aeiou]e$/.test(w)) return w.slice(0, -1);
  return w;
}

/** Cleaned words, stopwords kept (lexicon phrases such as "on black" need them). */
export const words = (text: string): string[] => (text ? clean(text).split(" ").filter(Boolean) : []);

/** The index terms of a text: cleaned, stopwords out, stemmed. */
export const terms = (text: string): string[] => words(text).filter((w) => !STOPWORDS.has(w)).map(stem);
