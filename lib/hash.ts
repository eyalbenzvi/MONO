/**
 * FNV-1a, 32 bits, in the three ways this code base has always read a
 * string. They agree on plain ASCII and differ past it, and some results are
 * kept (a bag line's key, a print's seed), so each caller keeps its own
 * variant; tests/hash.test.ts pins their outputs.
 */
const OFFSET = 0x811c9dc5;
const PRIME = 0x01000193;

/** Over UTF-16 code units (an emoji counts as its two halves). */
export function fnv1aUnits(s: string): number {
  let h = OFFSET;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), PRIME) >>> 0;
  return h;
}

/** Over characters, each by its first code unit (an emoji counts once, by its high surrogate). */
export function fnv1aChars(s: string): number {
  let h = OFFSET;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), PRIME) >>> 0;
  return h;
}

/** Over code points. */
export function fnv1aCodePoints(s: string): number {
  let h = OFFSET;
  for (const ch of s) h = Math.imul(h ^ ch.codePointAt(0)!, PRIME) >>> 0;
  return h;
}
