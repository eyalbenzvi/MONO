/**
 * The search engine: facets filter, BM25F scores the text, and the final
 * order blends relevance with the shopper's leanings, their taste (only once
 * it's known), the editorial rank and print quality. Runs in the browser on
 * the static index; nothing is sent anywhere.
 */
import { dedupeByFamily, paceByVariant } from "@/lib/catalog";
import { makeScorer } from "@/lib/recommendation";
import type { ShirtProduct, UserProfileVector } from "@/types/shirt";
import { facetFilter, type Facet } from "./facets";
import { FIELDS, type SearchIndex } from "./format";
import { likeScores } from "./like";
import { stem, terms } from "./normalize";
import { parseQuery, type ParsedQuery, type Slot, type Suggestion } from "./parse";

/** Field weights (BM25F), in FIELDS order: title, subject, tags, credit, body. */
export const FIELD_WEIGHTS = [3, 3, 2, 1.5, 1];
export const K1 = 1.2;
export const B = 0.75;
/** Designs whose score is within this much of each other may be reordered to vary the algorithm (never across a bigger gap). */
export const PACE_BAND = 0.15;
/** A design that has a facet the words name ("on black", "1880s") rises this much (a lift, not a filter). */
export const W_HINT = 0.2;
/** The query is the design's whole title (or subject): it leads. */
export const W_TITLE = 1;

/** The final score: relevance first, then these. */
export const W_TEXT = 1;
export const W_SOFT = 0.25;
export const W_PERSONAL = 0.15;
export const W_EDITORIAL = 0.1;
export const W_QUALITY = 0.05;
export const WEAK_PENALTY = 0.3;
/** "Like this" alongside text. */
export const W_LIKE = 0.5;

export interface SearchOptions {
  query: string;
  facets: readonly Facet[];
  vector?: UserProfileVector;
  /** The taste is known (the same condition as "For you"): only then does it count. */
  tasteKnown?: boolean;
  seen?: ReadonlySet<string>;
  /** The viewer's top matches (the "Top matches" facet). */
  matches?: ReadonlySet<string>;
  now?: number;
  /** The shop's current order: facets alone filter it, keeping that order. */
  order?: readonly { shirt: ShirtProduct }[];
  /** The words exactly as typed (no typo correction). */
  literal?: boolean;
  /** false: every scored design, best first (for checks on the family collapse). */
  collapse?: boolean;
}

export interface SearchHit {
  shirt: ShirtProduct;
  score: number;
  variations: number;
}

export interface SearchResult {
  /** "text": ranked by relevance, one per family, paced; "filter": the shop's order narrowed (the shop collapses and diversifies it as usual). */
  mode: "text" | "filter";
  results: SearchHit[];
  total: number;
  corrected: ParsedQuery["corrected"];
  suggestions: Suggestion[];
  completions: string[];
  relaxed: { droppedTerms: string[]; droppedFacets: Facet[] } | null;
}

/** Each design's relevance to the words (0 when none match), and how many words it matched. */
function textScores(index: SearchIndex, slots: Slot[]): { score: Float64Array; matched: Uint8Array } {
  const n = index.n;
  const score = new Float64Array(n);
  const matched = new Uint8Array(n);
  const best = new Float64Array(n);
  const tfw = new Float64Array(n);
  for (const slot of slots) {
    best.fill(0);
    for (const { term, w } of slot.alts) {
      // BM25F: field-weighted, length-normalized term counts, saturated once.
      const touched: number[] = [];
      FIELDS.forEach((_, f) => {
        const { docs, tf } = index.postings(f, term);
        const len = index.len[f];
        const avg = index.avgLen[f];
        for (let k = 0; k < docs.length; k++) {
          const d = docs[k];
          if (tfw[d] === 0) touched.push(d);
          tfw[d] += (FIELD_WEIGHTS[f] * tf[k]) / (1 - B + (B * len[d]) / avg);
        }
      });
      // A stand-in (completion, expansion, typo) never counts as rarer than the word's own anchor term.
      const idfOf = (t: number) => Math.log(1 + (n - index.file.df[t] + 0.5) / (index.file.df[t] + 0.5));
      const idf = w === 1 || slot.anchor < 0 ? idfOf(term) : Math.min(idfOf(term), idfOf(slot.anchor));
      for (const d of touched) {
        const s = w * idf * ((tfw[d] * (K1 + 1)) / (tfw[d] + K1));
        if (s > best[d]) best[d] = s;
        tfw[d] = 0;
      }
    }
    for (let d = 0; d < n; d++)
      if (best[d] > 0) {
        score[d] += best[d];
        matched[d]++;
      }
  }
  return { score, matched };
}

/** Each design's title and subject as index terms (cached per catalog). */
const titleKeys = new WeakMap<readonly ShirtProduct[], string[]>();
function titleKey(catalog: readonly ShirtProduct[]) {
  let k = titleKeys.get(catalog);
  if (!k) titleKeys.set(catalog, (k = catalog.map((s) => terms(s.title).join(" "))));
  return k;
}

/** "Our pick" without the day's rotation: the editorial rank (cached per catalog). */
const editorialOrder = new WeakMap<readonly ShirtProduct[], { shirt: ShirtProduct }[]>();
function editorial(catalog: readonly ShirtProduct[]) {
  let o = editorialOrder.get(catalog);
  if (!o) editorialOrder.set(catalog, (o = [...catalog].sort((a, b) => a.rank - b.rank).map((shirt) => ({ shirt }))));
  return o;
}

function run(index: SearchIndex, catalog: readonly ShirtProduct[], opts: SearchOptions, parsed: ParsedQuery, slots: Slot[], facets: readonly Facet[]): { mode: SearchResult["mode"]; hits: SearchHit[] } {
  const pass = facetFilter({ index, catalog, now: opts.now, seen: opts.seen, matches: opts.matches }, facets);
  const like = facets.find((f) => f.kind === "like");
  const from = like ? catalog.findIndex((s) => s.id === like.value) : -1;
  const sim = from !== -1 ? likeScores(index, catalog, from) : null;
  const words = slots.filter((s) => s.alts.length);

  const softKeys = Object.entries(parsed.soft) as [keyof ShirtProduct["features"], 1 | -1][];
  const hints = parsed.hints.map((f) => facetFilter({ index, catalog, now: opts.now }, [f]));
  // Facets alone: the shop's own order, narrowed. (Words that only lean or name a facet — "minimal", "victorian" — rank instead.)
  if (!words.length && !sim && !parsed.exact.length && !softKeys.length && !hints.length) {
    const order = opts.order ?? editorial(catalog);
    const at = new Map(catalog.map((s, i) => [s, i]));
    return { mode: "filter", hits: order.filter((x) => pass(at.get(x.shirt) ?? -1)).map((x) => ({ shirt: x.shirt, score: 0, variations: 0 })) };
  }

  const { score: text, matched } = textScores(index, words);
  const n = catalog.length;
  let max = 0;
  for (let i = 0; i < n; i++) if (pass(i) && text[i] > max) max = text[i];
  const personal = opts.tasteKnown && opts.vector ? makeScorer(opts.vector) : null;
  const exact = new Set(parsed.exact);
  const said = slots.map((x) => stem(x.word)).join(" ");
  const titles = titleKey(catalog);
  const named: { shirt: ShirtProduct; score: number }[] = parsed.exact.map((i) => ({ shirt: catalog[i], score: 100 - catalog[i].rank / n }));
  const titled = new Set<ShirtProduct>();
  const scored: { shirt: ShirtProduct; score: number }[] = [];
  for (let i = 0; i < n; i++) {
    const s = catalog[i];
    if (exact.has(i)) continue;
    if (!pass(i)) continue;
    // With words, a design must match one; "like this" alone orders everything but the design's own family.
    if (words.length && text[i] === 0) continue;
    if (sim && !words.length && s.family === catalog[from].family) continue;
    const isTitle = !!said && titles[i] === said;
    if (isTitle) titled.add(s);
    // Relevance scaled by the share of words matched: a design with every word beats one rare word alone.
    let rel = words.length ? (text[i] / max) * (matched[i] / words.length) + (isTitle ? W_TITLE : 0) : 0;
    if (sim) rel = words.length ? rel + W_LIKE * sim[i] : sim[i];
    const soft = softKeys.length ? softKeys.reduce((a, [k, dir]) => a + (dir === 1 ? s.features[k] : 1 - s.features[k]), 0) / softKeys.length : 0;
    const hinted = hints.reduce((a, h) => a + (h(i) ? W_HINT : 0), 0);
    const score =
      W_TEXT * rel +
      hinted +
      W_SOFT * soft +
      W_PERSONAL * (personal ? personal(s.features).score / 100 : 0) +
      W_EDITORIAL * (1 - s.rank / n) +
      W_QUALITY * (s.weak ? 0 : 1) -
      (s.weak ? WEAK_PENALTY : 0);
    scored.push({ shirt: s, score });
  }
  scored.sort((a, b) => b.score - a.score || a.shirt.rank - b.shirt.rank);
  // One per family — its best-matching member —, then variant pacing (no category or colour rules: relevance wins).
  named.sort((a, b) => b.score - a.score);
  if (opts.collapse === false) return { mode: "text", hits: [...named, ...scored].map((x) => ({ ...x, variations: 0 })) };
  // What the query names exactly (an id, a whole title) leads, unpaced; the rest one per family, paced.
  const lead = dedupeByFamily([...named, ...scored.filter((x) => titled.has(x.shirt))]);
  const ledBy = new Set(lead.map((x) => x.shirt.family));
  return { mode: "text", hits: [...lead, ...paceInBands(dedupeByFamily(scored.filter((x) => !ledBy.has(x.shirt.family))))] };
}

/** Variant pacing within runs of near-equal scores only, so variety never puts a weak match above a strong one. */
function paceInBands<T extends { shirt: ShirtProduct; score: number }>(list: T[]): T[] {
  const out: T[] = [];
  for (let i = 0; i < list.length; ) {
    let j = i + 1;
    while (j < list.length && list[i].score - list[j].score <= PACE_BAND) j++;
    out.push(...paceByVariant(list.slice(i, j)));
    i = j;
  }
  return out;
}

export function search(index: SearchIndex, catalog: readonly ShirtProduct[], opts: SearchOptions): SearchResult {
  const parsed = parseQuery(opts.query, index, catalog, { literal: opts.literal });
  const slots = parsed.slots;
  const facets = [...opts.facets];
  let out = run(index, catalog, opts, parsed, slots, facets);
  // Never a dead end. Words are ORed (a design needs one), so dropping a known word can't help — only facets
  // go, latest first. Words the catalog doesn't know at all are reported (nothing stood in for them).
  const droppedTerms = slots.some((s) => s.alts.length) ? [] : slots.map((s) => s.word);
  const droppedFacets: Facet[] = [];
  while (!out.hits.length && facets.length) {
    droppedFacets.push(facets.pop()!);
    out = run(index, catalog, opts, parsed, slots, facets);
  }
  return {
    mode: out.mode,
    results: out.hits,
    total: out.hits.length,
    corrected: parsed.corrected,
    suggestions: parsed.suggestions,
    completions: parsed.completions,
    relaxed: droppedTerms.length || droppedFacets.length ? { droppedTerms, droppedFacets } : null,
  };
}
