/**
 * Titles that name what you see (content overhaul, Part 5). The first sets'
 * titles were two stock words ("Concrete Lattice", "Typed Output"); later
 * sets told repeats apart with numerals ("Front View II"). Here every drawn
 * design is titled by what it shows — its subject, a poster by its phrase —
 * and where two designs would share that name, the better print keeps it
 * and the other is taken out: a title never carries a numeral the work
 * didn't have, and siblings sold in both colours can't be told apart by
 * their colourway.
 */
import type { SourceCategory } from "../../types/shirt";

/** Sources whose titles were stock word pairs (sets 1–3). */
const WORD_TITLED = new Set<SourceCategory>(["architectural", "geometric", "typography", "halftone", "waves", "scenes", "slogans", "pixel", "emblems", "objects", "ascii", "caricatures", "famousart", "iconic"]);
/** Tempo words the harmonographs were named with (not what they show). */
const TEMPO = /^(Slow|Quiet|Long|Late|Still|Soft|Deep|Low|Pale|Faint|Lento|Largo) /;
const NUMERAL = /\s+(II|III|IV|V|VI|VII|VIII|IX|X|XI|XII|\d+)$/;

export interface TitleInput {
  id: string;
  n: number;
  source: SourceCategory;
  variant: string;
  medium: string;
  title: string;
  subject: string;
  /** The design's own sentence (a poster's phrase is quoted in it). */
  base: string;
  quality: number;
}

const titleCase = (s: string) => s.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase()).replace(/\b(A|An|The|And|Of|In|On|To|For)\b/g, (w, _m, i) => (i === 0 ? w : w.toLowerCase()));

/** What a drawn design's title should be, before repeats are resolved. */
export function plainTitle(d: TitleInput): string {
  if (d.variant === "poster") {
    const phrase = /“([^”]+)”/.exec(d.base)?.[1];
    if (phrase) return titleCase(phrase);
  }
  if (d.variant === "harmonograph") return d.title.replace(TEMPO, "Harmonograph, ").replace(NUMERAL, "");
  if (d.variant.startsWith("lsystem-")) return `L-System ${titleCase(d.variant.slice(8))}`;
  if (WORD_TITLED.has(d.source)) return d.subject.replace(NUMERAL, "");
  return d.title.replace(NUMERAL, "");
}

/**
 * New titles for the drawn designs, and the ones taken out because a
 * better print already shows (and is titled) the same thing. `taken` holds
 * the titles of the other designs (photographs, archive works).
 */
export function plainTitles(list: TitleInput[], taken: Set<string>): { titles: Map<string, string>; retire: Map<string, string> } {
  const titles = new Map<string, string>();
  const retire = new Map<string, string>();
  const groups = new Map<string, TitleInput[]>();
  for (const d of list) {
    if (d.medium !== "drawn") continue;
    const t = plainTitle(d);
    const key = t.toLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), { ...d, title: t }]);
  }
  const lower = new Set([...taken].map((t) => t.toLowerCase()));
  for (const [key, members] of groups) {
    members.sort((a, b) => b.quality - a.quality || a.n - b.n);
    members.forEach((d, i) => {
      if (i === 0 && !lower.has(key)) titles.set(d.id, d.title);
      else retire.set(d.id, "Part 5: another design shows the same thing (titles name what they show)");
    });
  }
  return { titles, retire };
}

/** The first sentence of a description (the first sets added a quip after it). */
export const firstSentence = (s: string) => /^.*?[.!?](?=\s|$)/.exec(s.trim())?.[0] ?? s;
export const isWordTitled = (source: SourceCategory) => WORD_TITLED.has(source);
