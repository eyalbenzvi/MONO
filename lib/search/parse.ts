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
export const WEIGHT = { exact: 1, prefix: 0.8, fuzzy1: 0.6, fuzzy2: 0.35, expand: 0.5 } as const;
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
      const tokens = words(p);
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

/** The lexicon phrase starting at word i (exact words; a single long word may carry a typo), if any. */
function phraseAt(ws: string[], i: number, typing: boolean, known: (w: string) => boolean): { phrase: Phrase; len: number } | null {
  const tryList = (first: string) => {
    for (const phrase of PHRASES.get(first) ?? []) {
      const t = phrase.tokens;
      if (i + t.length > ws.length) continue;
      const ok = t.every((tok, k) => tok === ws[i + k] || (k === t.length - 1 && k > 0 && typing && i + k === ws.length - 1 && ws[i + k].length >= 2 && tok.startsWith(ws[i + k])));
      if (ok) return { phrase, len: t.length };
    }
    return null;
  };
  const exact = tryList(ws[i]);
  if (exact) return exact;
  const w = ws[i];
  // "photgraph" → the Photograph chip; "photog" (still typing) too.
  if (typing && i === ws.length - 1 && w.length >= 3) {
    const hit = SINGLE_WORDS.find((p) => p.length > w.length && p.startsWith(w) && PHRASES.get(p)!.some((x) => x.tokens.length === 1 && x.entry.facet));
    if (hit) return { phrase: PHRASES.get(hit)!.find((x) => x.tokens.length === 1)!, len: 1 };
  }
  // A word the catalog knows as it is isn't a typo for a lexicon word.
  const k = known(w) ? 0 : maxEdits(w.length);
  if (k) {
    const near = closest(w, SINGLE_WORDS, SINGLE_WORDS.map(() => 0), 1)[0];
    if (near) {
      const phrase = PHRASES.get(SINGLE_WORDS[near.at])!.find((x) => x.tokens.length === 1);
      if (phrase) return { phrase, len: 1 };
    }
  }
  return null;
}

/** Facets whose own name the query mentions: an artist, a pattern, a source… (from the index tables, never a fixed list). */
function tableSuggestions(index: SearchIndex, ws: string[], prefix: string | null): Suggestion[] {
  const said = new Set(ws.filter((w) => w.length >= 4 && !STOPWORDS.has(w)));
  const out: Suggestion[] = [];
  for (const kind of TABLE_KINDS) {
    for (const e of index.file.tables[kind]) {
      if (!e.count) continue;
      const label = kind === "era" ? eraLabel(e.id) : e.label;
      const tokens = words(label).filter((t) => !STOPWORDS.has(t));
      const hit = tokens.some((t) => said.has(t) || (prefix !== null && prefix.length >= 3 && t.length > prefix.length && t.startsWith(prefix)));
      if (hit) out.push({ facet: { kind, value: e.id }, label, kind: KIND_LABELS[kind] });
    }
  }
  return out;
}

export function parseQuery(query: string, index: SearchIndex, catalog: readonly ShirtProduct[]): ParsedQuery {
  const typing = query.length > 0 && !/\s$/.test(query);
  const ws = words(query);
  const soft: ParsedQuery["soft"] = {};
  const suggestions: Suggestion[] = [];
  const expansions = new Map<number, string[]>();
  // Lexicon phrases, longest first; their words still search as text.
  for (let i = 0; i < ws.length; ) {
    const hit = phraseAt(ws, i, typing, (w) => index.termId.has(stem(w)));
    if (!hit) {
      i++;
      continue;
    }
    const { entry } = hit.phrase;
    if (entry.facet) suggestions.push({ facet: entry.facet, label: facetLabel(index, entry.facet), kind: KIND_LABELS[entry.facet.kind] });
    if (entry.soft) Object.assign(soft, entry.soft);
    if (entry.expand) expansions.set(i, [...(expansions.get(i) ?? []), ...entry.expand]);
    // Every other entry for the same phrase counts too (a word can be a look and a leaning).
    for (const other of LEXICON)
      if (other !== entry && other.phrases.some((p) => words(p).join(" ") === hit.phrase.tokens.join(" "))) {
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
    if (STOPWORDS.has(w)) return;
    const t = stem(w);
    const alts = new Map<number, number>();
    const add = (term: number, weight: number) => alts.set(term, Math.max(alts.get(term) ?? 0, weight));
    const exact = index.termId.get(t);
    if (exact !== undefined) add(exact, WEIGHT.exact);
    if (w === prefix) {
      const ids = withPrefix(index, w);
      ids.sort((a, b) => index.file.df[b] - index.file.df[a]);
      for (const id of ids.slice(0, PREFIX_TERMS)) add(id, WEIGHT.prefix);
    }
    // (A query naming a design exactly isn't corrected: "mono-0123" isn't a typo for "moon".)
    if (!alts.size && !named.length) {
      // Against the stems and the words as written ("specixs" is one letter from "species", whose stem is "specy").
      const { list, term, df } = fuzzyList(index);
      // The closest few stand in (the most used is shown as the correction): "sveen" may be "seen" or "seven".
      const near = [...closest(t, list, df), ...closest(w, list, df)].sort((a, b) => a.dist - b.dist || df[b.at] - df[a.at]);
      for (const x of near.slice(0, 3)) add(term[x.at], x.dist === 1 ? WEIGHT.fuzzy1 : WEIGHT.fuzzy2);
      if (near.length) corrected.push({ from: w, to: shownOf(index, term[near[0].at]) });
    }
    for (const x of expansions.get(i) ?? []) {
      const id = index.termId.get(stem(clean(x)));
      if (id !== undefined) add(id, WEIGHT.expand);
    }
    const list = [...alts].map(([term, weight]) => ({ term, w: weight }));
    slots.push({ word: w, alts: list, idf: list.reduce((m, a) => Math.max(m, idfOf(index, a.term)), 0) });
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
  return { slots, prefix, suggestions, completions, soft, corrected, exact: named };
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
