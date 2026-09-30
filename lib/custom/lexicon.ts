/**
 * The words MONO won't print (data/lexicon/refuse.json): brand and trademark
 * names, slurs, hate slogans and codes. Every printed text field goes through
 * it: "Your words", Your Name, the Your Number label, Your House's words, an
 * upload's file name, metadata and title, and Open Call titles.
 *
 * Both the list and the text are brought to one canonical form before they
 * are compared, so a spelling trick lands on the same letters: case and
 * accents, look-alike Cyrillic and Greek letters, leetspeak (0→o, 1→i, 3→e,
 * 4→a, 5→s, 7→t, @→a, $→s), letters spaced or dotted apart ("n.i.k.e"),
 * repeated letters ("niiike") and reversed text ("ekin"). Matching is on
 * whole words (a phrase: consecutive words), so "Diorama" is not "Dior".
 *
 * Loaded by the editors only (it's not in any page's first load).
 */
import LIST from "../../data/lexicon/refuse.json";

export type Refusal = "brand" | "refused";

/** The one line shown when words are refused (brand voice: plain, no lecture). */
export const REFUSAL_LINE: Record<Refusal, string> = {
  brand: "Those words name a brand.",
  refused: "We don’t print that.",
};

/** Cyrillic and Greek letters that look like Latin ones (lower case; upper case is lowered first). */
const HOMOGLYPHS: Record<string, string> = {
  а: "a", в: "b", е: "e", ё: "e", к: "k", м: "m", н: "h", о: "o", р: "p", с: "c", т: "t", у: "y", х: "x", і: "i", ї: "i", ј: "j", ѕ: "s", ԁ: "d", ɡ: "g", ո: "n", ս: "u",
  α: "a", β: "b", ε: "e", η: "n", ι: "i", κ: "k", ν: "v", ο: "o", ρ: "p", τ: "t", υ: "u", χ: "x", ϲ: "c", ω: "w", γ: "y", μ: "u",
};
const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", $: "s" };

/** Lower case, accents off, look-alikes and leetspeak to Latin letters. Everything else stays (spaces and punctuation split words later). */
function letters(text: string): string {
  let out = "";
  for (const ch of text.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase()) out += HOMOGLYPHS[ch] ?? LEET[ch] ?? ch;
  return out;
}

/**
 * The text as canonical words: split on anything that isn't a letter or a
 * digit, runs of single characters joined back ("n i k e" → "nike"), and
 * repeated letters collapsed ("niiike" → "nike"; the list goes through the
 * same, so "gucci" still meets "gucci").
 */
export function canonicalWords(text: string): string[] {
  const raw = letters(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const out: string[] = [];
  let run = "";
  for (const t of raw) {
    if ([...t].length === 1) {
      run += t;
      continue;
    }
    if (run) out.push(run), (run = "");
    out.push(t);
  }
  if (run) out.push(run);
  return out.map((w) => w.replace(/(.)\1+/gu, "$1"));
}

const ENTRIES: { words: string[]; kind: Refusal }[] = [
  ...LIST.brands.map((p) => ({ words: canonicalWords(p), kind: "brand" as const })),
  ...LIST.refused.map((p) => ({ words: canonicalWords(p), kind: "refused" as const })),
];

const hasRun = (hay: string[], needle: string[]) => {
  outer: for (let i = 0; i + needle.length <= hay.length; i++) {
    for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer;
    return true;
  }
  return false;
};

/**
 * Why these words can't be printed, or null. Checks the words as written and
 * reversed, and also the whole text joined (for "N I K E" split oddly across
 * separators); a slur outranks a brand when both appear.
 */
export function refusal(text: string): Refusal | null {
  const w = canonicalWords(text);
  if (!w.length) return null;
  const reversed = [...w].reverse().map((x) => [...x].reverse().join(""));
  const joined = [w.join("")];
  let found: Refusal | null = null;
  for (const e of ENTRIES)
    for (const hay of [w, reversed, joined]) {
      if (!hasRun(hay, e.words) && !(hay === joined && hasRun(hay, [e.words.join("")]))) continue;
      if (e.kind === "refused") return "refused";
      found = "brand";
    }
  return found;
}

/** The refusal line for these words, or null when they may be printed. */
export const wordsProblem = (text: string): string | null => {
  const r = refusal(text);
  return r ? REFUSAL_LINE[r] : null;
};
