/**
 * Spelling a word in chemical symbols (Your Name in Elements): dynamic
 * programming over the word, each step a one- or two-letter symbol, the
 * fewest tiles winning (on a tie, the two-letter symbol earlier in the word).
 * A letter no symbol covers (J, Q, and others in some places) becomes a gap
 * tile at a cost far above any real one, so the template always has
 * something to draw; the editor offers only words with no gap.
 */
import { ELEMENTS, type Element } from "./elements";

export type Tile = { el: Element } | { miss: string };

const BY_SYMBOL = new Map(ELEMENTS.map((e) => [e[1].toUpperCase(), e]));
const MISS = 1000;

/** The word (capitals A–Z) as tiles: fewest symbols, gaps only where nothing fits. */
export function spell(word: string): Tile[] {
  const w = word.toUpperCase();
  const n = w.length;
  const cost = new Array<number>(n + 1).fill(Infinity);
  const step = new Array<number>(n + 1).fill(0);
  cost[n] = 0;
  for (let i = n - 1; i >= 0; i--) {
    // Two letters first, so a tie keeps the two-letter symbol.
    for (const len of [2, 1]) {
      if (i + len > n || !BY_SYMBOL.has(w.slice(i, i + len))) continue;
      const c = 1 + cost[i + len];
      if (c < cost[i]) (cost[i] = c), (step[i] = len);
    }
    if (MISS + cost[i + 1] < cost[i]) (cost[i] = MISS + cost[i + 1]), (step[i] = 0);
  }
  const out: Tile[] = [];
  for (let i = 0; i < n; ) {
    const len = step[i];
    if (len === 0) out.push({ miss: w[i] }), i++;
    else out.push({ el: BY_SYMBOL.get(w.slice(i, i + len))! }), (i += len);
  }
  return out;
}

export const spellable = (word: string) => spell(word).every((t) => "el" in t);

/** The letters no symbol can take in this word, in order, once each. */
export const missing = (word: string) => [...new Set(spell(word).flatMap((t) => ("miss" in t ? [t.miss] : [])))];

/** The nearest word the symbols can spell: one letter dropped (the earliest that works), or null. */
export function nearestSpellable(word: string, minLen = 2): string | null {
  const w = word.toUpperCase();
  if (w.length - 1 < minLen) return null;
  for (let i = 0; i < w.length; i++) {
    const v = w.slice(0, i) + w.slice(i + 1);
    if (spellable(v)) return v;
  }
  return null;
}
