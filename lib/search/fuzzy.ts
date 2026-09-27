/**
 * Typo tolerance: a bounded Damerau-Levenshtein distance (a swap of two
 * neighbouring letters counts once) over the index vocabulary, only for
 * words with no exact or prefix hit.
 */

/** How many edits a word of this length may carry: none under 4 letters, 1 up to 7, 2 from 8. */
export const maxEdits = (len: number) => (len < 4 ? 0 : len < 8 ? 1 : 2);

// Rows reused across calls (words are short; no allocation per comparison).
let rows = [new Int32Array(64), new Int32Array(64), new Int32Array(64)];

/** The distance between a and b, or max + 1 as soon as it's sure to exceed max. */
export function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const n = a.length;
  const m = b.length;
  if (m + 1 > rows[0].length) rows = rows.map(() => new Int32Array(m + 1));
  // Three rows: the one before last (for swaps), the last, the current.
  let [prev2, prev, cur] = rows;
  for (let j = 0; j <= m; j++) prev[j] = j;
  for (let i = 1; i <= n; i++) {
    cur[0] = i;
    let rowMin = i;
    for (let j = 1; j <= m; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a.charCodeAt(i - 1) === b.charCodeAt(j - 2) && a.charCodeAt(i - 2) === b.charCodeAt(j - 1)) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    [prev2, prev, cur] = [prev, cur, prev2];
  }
  return prev[m];
}

/** The vocabulary's positions by word length (built once per list). */
const byLength = new WeakMap<readonly string[], number[][]>();
function lengths(vocab: readonly string[]) {
  let b = byLength.get(vocab);
  if (!b) {
    b = [];
    vocab.forEach((v, i) => (b![v.length] ??= []).push(i));
    byLength.set(vocab, b);
  }
  return b;
}

/**
 * The closest words in `vocab` to `word` (lowest distance, then the most
 * used), or none when the word is too short or nothing is close enough.
 */
export function closest(word: string, vocab: readonly string[], df: readonly number[], limit = 3): { at: number; dist: number }[] {
  const k = maxEdits(word.length);
  if (!k) return [];
  const found: { at: number; dist: number }[] = [];
  const buckets = lengths(vocab);
  for (let len = Math.max(4, word.length - k); len <= word.length + k; len++)
    for (const i of buckets[len] ?? []) {
      const v = vocab[i];
      if (v === word) continue;
      // Cheap filter for one edit: the words still share a letter among their first two, in place or shifted by one.
      if (k === 1 && v.charCodeAt(0) !== word.charCodeAt(0) && v.charCodeAt(1) !== word.charCodeAt(1) && v.charCodeAt(0) !== word.charCodeAt(1) && v.charCodeAt(1) !== word.charCodeAt(0)) continue;
      const d = distance(word, v, k);
      if (d <= k) found.push({ at: i, dist: d });
    }
  found.sort((a, b) => a.dist - b.dist || df[b.at] - df[a.at] || vocab[a.at].localeCompare(vocab[b.at]));
  return found.slice(0, limit);
}
