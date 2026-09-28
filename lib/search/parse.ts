/**
 * A query, read: the words to search for (each with the index terms that
 * stand for it — itself, completions of a word still being typed, a typo's
 * correction, a subject's related words), the facets it suggests (chips the
 * shopper accepts; never applied by themselves), leanings on the design
 * features, and an exact design when it names one.
 */
import type { FeatureKey, ShirtProduct } from "@/types/shirt";
import { KIND_LABELS, TABLE_KINDS, eraLabel, type Facet } from "./facets";
import type { SearchIndex } from "./format";
import { closest, maxEdits } from "./fuzzy";
import { LEXICON, type LexiconEntry } from "./lexicon";
import { STOPWORDS, clean, stem, words } from "./normalize";

/** How much each way of standing for a word counts (engine scores are multiplied by these). */
export const WEIGHT = { exact: 1, morph: 0.9, prefix: 0.8, fuzzy1: 0.6, fuzzy2: 0.35, expand: 0.5 } as const;
/** Completions of a word still being typed, at most (the most used first). */
const PREFIX_TERMS = 50;

export interface Alt {
  term: number;
  w: number;
}
/** One word of the query and the index terms that may stand for it. */
export interface Slot {
  word: string;
  alts: Alt[];
  /** The term that anchors the word (its exact term, else its most used one): nothing standing in for it counts as rarer. */
  anchor: number;
  /** Its rarest term's IDF (the relaxation drops the most common word first). */
  idf: number;
}
export interface Suggestion {
  facet: Facet;
  label: string;
  /** The small grey kind next to it ("artist"). */
  kind: string;
}
export interface ParsedQuery {
  slots: Slot[];
  /** The last word, while it's still being typed (no space after it). */
  prefix: string | null;
  suggestions: Suggestion[];
  /** Words that could complete the one being typed (shown, most used first). */
  completions: string[];
  soft: Partial<Record<FeatureKey, 1 | -1>>;
  /** Facets the words name ("on black", "this week", "1880s"): a gentle lift for designs that have them, never a filter. */
  hints: Facet[];
  corrected: { from: string; to: string }[];
  /** Catalog positions the query names exactly (an id, SKU or number). */
  exact: number[];
}

type Phrase = { tokens: string[]; entry: LexiconEntry };
/** Lexicon phrases by first word, longest first. */
const PHRASES = (() => {
  const m = new Map<string, Phrase[]>();
  for (const entry of LEXICON)
    for (const p of entry.phrases) {
      // Stemmed, like the query's words ("ships" meets "ship").
      const tokens = words(p).map(stem);
      if (!tokens.length) continue;
      m.set(tokens[0], [...(m.get(tokens[0]) ?? []), { tokens, entry }]);
    }
  for (const list of m.values()) list.sort((a, b) => b.tokens.length - a.tokens.length);
  return m;
})();
const SINGLE_WORDS = [...PHRASES.keys()];

export const idfOf = (index: SearchIndex, term: number) => Math.log(1 + (index.n - index.file.df[term] + 0.5) / (index.file.df[term] + 0.5));
const shownOf = (index: SearchIndex, term: number) => index.file.shown[term] || index.file.vocab[term];

/** Vocabulary terms starting with `p` (binary search over the sorted list). */
function withPrefix(index: SearchIndex, p: string): number[] {
  const { vocab } = index.file;
  let lo = 0;
  let hi = vocab.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (vocab[mid] < p) lo = mid + 1;
    else hi = mid;
  }
  const out: number[] = [];
  for (let i = lo; i < vocab.length && vocab[i].startsWith(p); i++) out.push(i);
  return out;
}

/** What typos are matched against: every stem and every surface word, each pointing at its term. */
const fuzzyLists = new WeakMap<SearchIndex, { list: string[]; term: number[]; df: number[] }>();
function fuzzyList(index: SearchIndex) {
  let f = fuzzyLists.get(index);
  if (!f) {
    const { vocab, shown, df } = index.file;
    const list = [...vocab];
    const term = vocab.map((_, i) => i);
    shown.forEach((w, i) => {
      if (w) {
        list.push(w);
        term.push(i);
      }
    });
    fuzzyLists.set(index, (f = { list, term, df: term.map((t) => df[t]) }));
  }
  return f;
}

/** A design named by id (mono-0123), SKU (MN-ART-B-0123) or number (067, No. 67). */
function exactOf(q: string, catalog: readonly ShirtProduct[]): number[] {
  const s = q.trim();
  const byN = (n: number) => catalog.flatMap((x, i) => (x.n === n ? [i] : []));
  const byNo = (no: number) => catalog.flatMap((x, i) => (x.no === no ? [i] : []));
  let m: RegExpExecArray | null;
  if ((m = /^mono-?(\d+)$/i.exec(s))) return byN(Number(m[1]));
  if ((m = /^mn-[a-z]{3}-[bw]-(\d+)$/i.exec(s))) return byN(Number(m[1]));
  if ((m = /^(?:no\.?|#)\s*(\d+)$/i.exec(s))) return byNo(Number(m[1]));
  if ((m = /^(\d+)$/.exec(s))) return [...new Set([...byNo(Number(m[1])), ...byN(Number(m[1]))])];
  return [];
}

/** The lexicon phrase starting at word i (stems compared; a long unknown word may carry a typo), if any. */
function phraseAt(ws: string[], i: number, typing: boolean, known: (w: string) => boolean, vocabDist: (w: string) => number = () => Infinity): { phrase: Phrase; len: number; typo?: boolean } | null {
  const st = ws.map(stem);
  for (const phrase of PHRASES.get(st[i]) ?? []) {
    const t = phrase.tokens;
    if (i + t.length > ws.length) continue;
    const ok = t.every((tok, k) => tok === st[i + k] || (k === t.length - 1 && k > 0 && typing && i + k === ws.length - 1 && ws[i + k].length >= 2 && tok.startsWith(ws[i + k])));
    if (ok) return { phrase, len: t.length };
  }
  const w = ws[i];
  // "photog" (still typing) → the Photograph chip.
  if (typing && i === ws.length - 1 && w.length >= 3) {
    const hit = SINGLE_WORDS.find((p) => p.length > w.length && p.startsWith(w) && PHRASES.get(p)!.some((x) => x.tokens.length === 1 && x.entry.facet));
    if (hit) return { phrase: PHRASES.get(hit)!.find((x) => x.tokens.length === 1)!, len: 1 };
  }
  // A typo for a lexicon word ("photgraph"): only a long word the catalog doesn't know ("bats" isn't "cats").
  const k = known(w) || w.length < 6 ? 0 : maxEdits(w.length);
  if (k) {
    const near = closest(st[i], SINGLE_WORDS, SINGLE_WORDS.map(() => 0), 1)[0];
    // Only when no word of the catalogue is closer ("fountxin" is the fountain it has, not the lexicon's mountains).
    if (near && near.dist <= vocabDist(w)) {
      const phrase = PHRASES.get(SINGLE_WORDS[near.at])!.find((x) => x.tokens.length === 1);
      if (phrase) return { phrase, len: 1, typo: true };
    }
  }
  return null;
}

const PARTICLES = new Set(["de", "van", "von", "da", "di", "del", "della", "der", "la", "le", "du", "y", "ter", "the"]);
/** Suggestions from the index tables, at most this many (the largest first). */
const TABLE_SUGGESTIONS = 3;

/**
 * Facets whose own name the query mentions: an artist (by surname), an era,
 * a source… (from the index tables, never a fixed list). A word shared by
 * many labels ("museum", "john") or common in the catalog names nothing.
 * Looks come from the lexicon only ("text" must not offer "No text").
 */
function tableSuggestions(index: SearchIndex, ws: string[], prefix: string | null): Suggestion[] {
  const said = new Set(ws.filter((w) => w.length >= 4 && !STOPWORDS.has(w)).map(stem));
  const common = (t: string) => (index.file.df[index.termId.get(stem(t)) ?? -1] ?? 0) > index.n * 0.2;
  const out: (Suggestion & { count: number })[] = [];
  for (const kind of TABLE_KINDS) {
    if (kind === "look") continue;
    const entries = index.file.tables[kind].filter((e) => e.count > 0);
    const tokensOf = (label: string) => words(label).filter((t) => !STOPWORDS.has(t) && !PARTICLES.has(t));
    const uses = new Map<string, number>();
    for (const e of entries) for (const t of new Set(tokensOf(kind === "era" ? eraLabel(e.id) : e.label))) uses.set(t, (uses.get(t) ?? 0) + 1);
    for (const e of entries) {
      const label = kind === "era" ? eraLabel(e.id) : e.label;
      const all = tokensOf(label);
      // An artist by surname (or two of their names); anything else by a telling word of its label.
      const telling = (kind === "artist" ? all.slice(-1) : all).filter((t) => (uses.get(t) ?? 0) <= 2 && !common(t));
      const two = kind === "artist" && all.filter((t) => said.has(stem(t))).length >= 2;
      const typed = kind === "artist" && prefix !== null && prefix.length >= 4 && telling.some((t) => t.length > prefix.length && t.startsWith(prefix));
      if (two || typed || telling.some((t) => said.has(stem(t)))) out.push({ facet: { kind, value: e.id }, label, kind: KIND_LABELS[kind], count: e.count });
    }
  }
  const seen = new Set<string>();
  return out
    .sort((a, b) => b.count - a.count)
    .filter((s) => !seen.has(s.label.toLowerCase()) && seen.add(s.label.toLowerCase()))
    .slice(0, TABLE_SUGGESTIONS)
    .map(({ count: _count, ...s }) => s);
}

/** `literal`: the words as typed, no typo correction (the shopper asked for exactly that). */
export function parseQuery(query: string, index: SearchIndex, catalog: readonly ShirtProduct[], { literal = false } = {}): ParsedQuery {
  const typing = query.length > 0 && !/\s$/.test(query);
  const ws = words(query);
  const soft: ParsedQuery["soft"] = {};
  const suggestions: Suggestion[] = [];
  const hints: Facet[] = [];
  const expansions = new Map<number, string[]>();
  // Words a facet phrase uses up ("on black", "this week", "no text"): they're the facet, not text to find.
  const consumed = new Set<number>();
  // Words read as a lexicon word with a typo ("mountian" → "mountain"): said back, and searched as that word.
  const typos = new Map<number, string>();
  // Lexicon phrases, longest first; a single subject word still searches as text.
  for (let i = 0; i < ws.length; ) {
    const hit = phraseAt(ws, i, typing, (w) => index.termId.has(stem(w)), (w) => {
      const { list, df } = fuzzyList(index);
      const near = [...closest(stem(w), list, df, 1, w.length), ...closest(w, list, df, 1, w.length)];
      return near.length ? Math.min(...near.map((x) => x.dist)) : Infinity;
    });
    if (!hit) {
      i++;
      continue;
    }
    const { entry } = hit.phrase;
    if (hit.typo) typos.set(i, entry.phrases.find((p) => words(p).map(stem).join(" ") === hit.phrase.tokens[0]) ?? hit.phrase.tokens[0]);
    if (entry.facet) {
      suggestions.push({ facet: entry.facet, label: facetLabel(index, entry.facet), kind: KIND_LABELS[entry.facet.kind] });
      hints.push(entry.facet);
      if (["tee", "new", "era"].includes(entry.facet.kind) || hit.len > 1) for (let k = i; k < i + hit.len; k++) consumed.add(k);
    }
    if (entry.soft) Object.assign(soft, entry.soft);
    if (entry.expand) expansions.set(i, [...(expansions.get(i) ?? []), ...entry.expand]);
    // Every other entry for the same phrase counts too (a word can be a look and a leaning).
    for (const other of LEXICON)
      if (other !== entry && other.phrases.some((p) => words(p).map(stem).join(" ") === hit.phrase.tokens.join(" "))) {
        if (other.facet && !suggestions.some((s) => s.facet.kind === other.facet!.kind && s.facet.value === other.facet!.value))
          suggestions.push({ facet: other.facet, label: facetLabel(index, other.facet), kind: KIND_LABELS[other.facet.kind] });
        if (other.soft) Object.assign(soft, other.soft);
        if (other.expand) expansions.set(i, [...(expansions.get(i) ?? []), ...other.expand]);
      }
    i += hit.len;
  }

  const prefix = typing && ws.length ? ws[ws.length - 1] : null;
  const named = exactOf(query, catalog);
  const corrected: ParsedQuery["corrected"] = [];
  const slots: Slot[] = [];
  ws.forEach((w, i) => {
    if (STOPWORDS.has(w) || consumed.has(i)) return;
    const t = stem(w);
    const alts = new Map<number, number>();
    const add = (term: number, weight: number) => alts.set(term, Math.max(alts.get(term) ?? 0, weight));
    const exact = index.termId.get(t);
    if (exact !== undefined) add(exact, WEIGHT.exact);
    const fixed = typos.get(i);
    if (fixed !== undefined) {
      const id = index.termId.get(stem(fixed));
      if (id !== undefined) add(id, WEIGHT.fuzzy1);
      corrected.push({ from: w, to: id !== undefined ? shownOf(index, id) : fixed });
    }
    if (w === prefix) {
      const ids = withPrefix(index, w);
      ids.sort((a, b) => index.file.df[b] - index.file.df[a]);
      for (const id of ids.slice(0, PREFIX_TERMS)) add(id, WEIGHT.prefix);
    }
    for (const x of expansions.get(i) ?? []) {
      const id = index.termId.get(stem(clean(x)));
      if (id !== undefined) add(id, WEIGHT.expand);
    }
    // Another form of the word ("engrave" → "engraving"s, "tree" → "trees").
    if (!alts.size)
      for (const f of [`${w}s`, `${w.replace(/e$/, "")}ing`, `${w}ed`, `${w}es`]) {
        const id = index.termId.get(stem(f));
        if (id !== undefined) add(id, WEIGHT.morph);
      }
    // Typos last: never for a word the lexicon already resolved, a number, or a query naming a design ("mono-0123" isn't "moon").
    if (!alts.size && !named.length && !literal && !/\d/.test(w)) {
      // Against the stems and the words as written ("specixs" is one letter from "species", whose stem is "specy").
      const { list, term, df } = fuzzyList(index);
      // The closest few stand in (the most used is shown as the correction): "sveen" may be "seen" or "seven".
      // And the word without a final "e" ("engnie" is a swap from "engin", engine's stem).
      const bare = w.length > 4 && w.endsWith("e") ? [w.slice(0, -1)] : [];
      // A typo inside an -ing ending ("lookxng"): the word before it, when the catalogue has it as it is.
      const ing = /^[a-z]{3,}.ng$/.test(w) ? index.termId.get(stem(w.slice(0, -3))) : undefined;
      if (ing !== undefined) add(ing, WEIGHT.fuzzy1);
      const near = [t, w, ...bare]
        .flatMap((x) => closest(x, list, df, 3, w.length))
        .sort((a, b) => a.dist - b.dist || df[b.at] - df[a.at])
        .filter((x, k, all) => all.findIndex((y) => term[y.at] === term[x.at]) === k);
      for (const x of near.slice(0, 3)) add(term[x.at], x.dist === 1 ? WEIGHT.fuzzy1 : WEIGHT.fuzzy2);
      if (near.length) corrected.push({ from: w, to: shownOf(index, term[near[0].at]) });
      else if (ing !== undefined) corrected.push({ from: w, to: shownOf(index, ing) });
    }
    const list = [...alts].map(([term, weight]) => ({ term, w: weight }));
    const anchor = exact ?? list.reduce((best, a) => (best === -1 || index.file.df[a.term] > index.file.df[best] ? a.term : best), -1);
    slots.push({ word: w, alts: list, anchor, idf: list.reduce((m, a) => Math.max(m, idfOf(index, a.term)), 0) });
  });

  for (const s of tableSuggestions(index, ws, prefix)) if (!suggestions.some((x) => x.facet.kind === s.facet.kind && x.facet.value === s.facet.value)) suggestions.push(s);
  const completions =
    prefix && prefix.length >= 2
      ? withPrefix(index, prefix)
          .filter((id) => index.file.vocab[id] !== prefix)
          .sort((a, b) => index.file.df[b] - index.file.df[a])
          .slice(0, 3)
          .map((id) => shownOf(index, id))
      : [];
  return { slots, prefix, suggestions, completions, soft, hints, corrected, exact: named };
}

/** A facet's name as the shopper reads it. */
export function facetLabel(index: SearchIndex, f: Facet): string {
  if (f.kind === "era") return eraLabel(f.value);
  if (f.kind === "tee") return f.value === "black" ? "Black tee" : "White tee";
  if (f.kind === "new") return "New this week";
  if (f.kind === "seen") return "Not seen yet";
  if (f.kind === "match") return "Top matches";
  if (f.kind === "like") return "Like this";
  const e = (TABLE_KINDS as readonly string[]).includes(f.kind) ? index.file.tables[f.kind as (typeof TABLE_KINDS)[number]].find((x) => x.id === f.value) : undefined;
  return e?.label ?? f.value;
}
