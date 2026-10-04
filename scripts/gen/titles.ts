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
/** Roman numerals only: a year or a figure at the end of a title is part of what it names ("Moon Phases of 1969"). */
const NUMERAL = /\s+(II|III|IV|V|VI|VII|VIII|IX|X|XI|XII)$/;

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

/**
 * The catalogue's house style for titles (applied to every title the
 * generator builds; a title set by hand in data/curation/titles.json is
 * written in it already and is left as it is):
 * - Title Case: every word capitalised but the small ones (articles,
 *   conjunctions, prepositions — "Sunset over the Sea"), lower-case except
 *   at the start of the title or of a part after a colon, semicolon, full
 *   stop or opening bracket; foreign particles ("Vase de Marbre", "Veduta
 *   del Tempio") the same. Only first letters change, so acronyms
 *   ("NATO", "U.S.", "H.M.S."), words already capitalised inside
 *   ("McKim") and a bracketed scientific name ("(Trillium simile)": genus
 *   capitalised, species not) stay as they are;
 * - a record's "--" becomes ": " after a series name ("The Voyage of Life:
 *   Youth"), else ", "; " - " becomes ", " ("Sidewall, Sample");
 * - typographic apostrophes and single quotes (’ ‘).
 */
const SMALL = new Set(
  (
    "a an the and but or nor of in on for to with at by from between into onto over under near as via versus vs vs. upon among amongst after " +
    "before above below along across beyond through toward towards off per " +
    // foreign particles
    "de du des la le les un une à au aux et en sur pour par di del della degli dei e ed von und der zu aan y el"
  ).split(" "),
);
/** A lower-case particle may start a word with an elided article: "d’Escalliers", "l’Ordre", "dell’Interno". */
const ELIDED = /^(d|l|dell|dall|nell|all|sull|qu)’/i;
/** Records whose "--" joins a series name to the picture's own ("The Voyage of Life--Youth"). */
const SERIES_DASH = /^(The Voyage of Life|Winter at Sea|On the Schroon)--/;
/** A bracketed scientific name: "(Trillium simile)", "(Solea lunata & c)", "(Iris species)". */
const BINOMIAL = /^[A-Z][a-z]+(?: (?:[a-z×][a-z-]*|&)\b.*)?$/;
/** A capital that names a thing rather than an article: "Letter A", "Plate A". */
const NAMED_LETTER = /^(Letter|Plate|Figure|Fig\.|Model|Type|Series|Vitamin)$/;

const isBinomial = (s: string) => BINOMIAL.test(s) && s.includes(" ") && !SMALL.has(s.split(" ")[1]);

function titleCaseWords(s: string): string {
  const words = s.split(" ");
  let start = true;
  return words
    .map((w, i) => {
      const atStart = start;
      // The next word starts a part after a colon, semicolon, full stop (not an abbreviation) or an em dash.
      const lead = /^[(‘"“[]*/.exec(w)![0];
      const core = w.slice(lead.length);
      start = /[:;—]$/.test(w) || (/[.!?]$/.test(core) && !/^(St|Mt|Ft|Dr|Jr|Sr|Mr|Mrs|No|Vol|vol|[A-Z])\.$/.test(core) && !/\.[A-Za-z]+\.$/.test(core)) || w === "–";
      if (!core) return w;
      const bare = core.replace(/[,:;.!?)\]’”"]+$/, "");
      const lower = bare.toLowerCase();
      const small = SMALL.has(lower) || ELIDED.test(bare) || SMALL.has(lower.replace(/’$/, ""));
      // The first word, a bracket's first, and the last word keep a capital ("San Juan del Sur", not "del sur").
      if (atStart || lead.includes("(") || (i === words.length - 1 && !ELIDED.test(bare))) return lead + core[0].toUpperCase() + core.slice(1);
      if (small) {
        // "A" after "Letter" names a letter; an all-capitals word is an acronym.
        if (bare === "A" && i > 0 && NAMED_LETTER.test(words[i - 1])) return w;
        if (bare.length > 1 && bare === bare.toUpperCase() && !ELIDED.test(bare)) return w;
        // An elided article keeps the next word's capital: "de l’Ordre", "sur l’Orfèvrerie".
        const elided = /^(\p{L}+’)(\p{L})(.*)$/u.exec(core);
        if (elided && ELIDED.test(core) && !SMALL.has((elided[2] + elided[3]).toLowerCase().replace(/[,:;.]+$/, ""))) return lead + elided[1].toLowerCase() + elided[2].toUpperCase() + elided[3];
        return lead + core[0].toLowerCase() + core.slice(1);
      }
      return /^\p{Ll}/u.test(core) ? lead + core[0].toUpperCase() + core.slice(1) : w;
    })
    .join(" ");
}

export function houseTitle(title: string): string {
  let t = title.replace(/[ \t\n]+/g, " ").trim();
  t = t.replace(SERIES_DASH, "$1: ").replace(/\s*--\s*/g, ", ").replace(/ - /g, ", ");
  // Quotes and apostrophes: an opening quote after a space or bracket, else an apostrophe.
  t = t.replace(/(^|[\s(])'(?=\S)/g, "$1‘").replace(/'/g, "’");
  const parts = t.split(/(\([^()]*\))/);
  // Case words across the whole title (so a word's place — first, after a colon — is known), then restore the scientific names.
  const kept: string[] = [];
  const masked = parts
    .map((part) => {
      const inner = /^\((.*)\)$/.exec(part)?.[1];
      if (inner !== undefined && isBinomial(inner)) {
        kept.push(part);
        return `(\u0000${kept.length - 1}\u0000)`;
      }
      return part;
    })
    .join("");
  return titleCaseWords(masked).replace(/\(\u0000(\d+)\u0000\)/g, (_m, k) => kept[Number(k)]);
}

/** Words a title can't end on: an article, a conjunction, a preposition — what's left when a longer record title is cut at a word. */
export const DANGLING = /\s+(?:a|an|the|and|or|nor|but|of|in|on|for|to|with|at|by|from|between|into|onto|over|under|near|as|via|after|before|above|below|along|across|beyond|through|toward|towards|upon|among|amongst|de|du|des|la|le|les|à|et|di|del|della|degli|dei|e|ed|von|und|der|zu|etc|&)\.?$/i;

/** A title cut short at a word, without the dangling words and list numbers ("1. … 2. Female. 3") it was left with. */
export function trimDangling(t: string): string {
  let s = t.trim();
  for (let prev = ""; prev !== s; ) {
    prev = s;
    s = s.replace(/[\s,;:–—-]+$/, "").replace(DANGLING, "").replace(/(?<!\b(?:Plate|Plates|No\.|Fig\.|Figure|Take|Vol\.))\s+\d{1,3}\.?$/, "");
  }
  return s;
}

/** The first sentence of a description (the first sets added a quip after it). */
export const firstSentence = (s: string) => /^.*?[.!?](?=\s|$)/.exec(s.trim())?.[0] ?? s;
export const isWordTitled = (source: SourceCategory) => WORD_TITLED.has(source);
