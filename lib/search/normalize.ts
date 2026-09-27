/**
 * Search text normalization, shared by the index builder (Node) and the
 * browser: the same words must come out of a design's text and a shopper's
 * query. English only for now; the word lists are data, so another language
 * can add its own.
 */

/** Words that say nothing about a design (a query for "a tee with a wave" is "wave"). */
export const STOPWORDS = new Set(["the", "a", "an", "of", "and", "from", "with", "in", "on", "tee", "tees", "shirt", "shirts", "t", "print", "prints", "design", "designs"]);

/** British → American (the index and the query fold to one spelling). */
const SPELLING: [RegExp, string][] = [
  [/^colour/, "color"],
  [/^grey/, "gray"],
  [/^centre/, "center"],
  [/^metre/, "meter"],
  [/^theatre/, "theater"],
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

/** A light rule stemmer: plurals and -ing, so "waves" finds "wave" and "drawing" finds "draw". */
export function stem(word: string): string {
  let w = word;
  for (const [re, to] of SPELLING) w = w.replace(re, to);
  if (/\d/.test(w) || w.length <= 3) return w;
  if (w.endsWith("ies") && w.length > 4) return `${w.slice(0, -3)}y`;
  if (w.endsWith("sses")) return w.slice(0, -2);
  if (/(x|z|ch|sh)es$/.test(w)) return w.slice(0, -2);
  if (w.endsWith("s") && !/(ss|us|is)$/.test(w)) return w.slice(0, -1);
  if (w.endsWith("ing") && w.length - 3 >= 4) return w.slice(0, -3);
  return w;
}

/** Cleaned words, stopwords kept (lexicon phrases such as "on black" need them). */
export const words = (text: string): string[] => (text ? clean(text).split(" ").filter(Boolean) : []);

/** The index terms of a text: cleaned, stopwords out, stemmed. */
export const terms = (text: string): string[] => words(text).filter((w) => !STOPWORDS.has(w)).map(stem);
