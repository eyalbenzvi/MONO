/**
 * Builds the search index from the full catalog (data/shirts.json) and the
 * cached visual measures. Pure: scripts/tools/searchIndex.ts writes its
 * output, and tests build it in memory. Nothing here names a category,
 * variant or design — tables and look tags come from the data.
 */
import { CATEGORY_LABELS, FEATURE_KEYS, type CatalogEntry } from "@/types/shirt";
import { FIELDS, Q64, SEARCH_VERSION, VISUAL_KEYS, idsHash, type SearchIndexFile, type TableEntry } from "./format";
import { eraLabel } from "./facets";
import { ARTIST_PREFIXES, ARTIST_SUFFIXES, LOOK_TAGS, MEDIUM_LABELS, TAG_HIGH, TAG_LOW, TAG_MAX_SHARE, UNTAGGED_KEYS, hasVariantLabel, humanizeId, labelCase, sourceOf, typographic, variantLabel } from "./labels";
import { LEXICON } from "./lexicon";
import { STOPWORDS, clean, stem, terms, words } from "./normalize";

/** Structured search metadata from the content pipeline (all optional; the builder falls back to parsing text). */
export interface SearchMeta {
  artist?: string;
  year?: number | [number, number];
  source?: string;
  scientific?: string;
  tags?: string[];
  printedText?: string;
}
export type SearchEntry = Pick<CatalogEntry, "id" | "title" | "subject" | "summary" | "description" | "style" | "category" | "medium" | "variant" | "features" | "photo"> &
  Partial<Pick<CatalogEntry, "printCm">> & { search?: SearchMeta };

export interface VisualMetrics {
  symmetry: number;
  detail: number;
  coverage: number;
  extent: number;
  aspect: number;
  /** 64-bit difference hash, 16 hex. */
  dhash: string;
}

/* Parsers for designs without structured metadata ----------------------- */

const PARTICLES = new Set(["de", "van", "von", "da", "di", "del", "della", "der", "la", "le", "du", "y", "ter"]);
/** "Mary Vaux Walcott" is a name; "step from its equations" isn't. */
const nameLike = (s: string) => {
  const w = s.trim().split(/\s+/);
  return w.length >= 2 && w.length <= 6 && !/\d/.test(s) && w.every((x) => /^\p{Lu}/u.test(x) || PARTICLES.has(x));
};

/**
 * The artist named in the summary: the last "by …" before a parenthesis (the first may be part of a title),
 * without attribution prefixes ("follower of"), nationality or place suffixes ("Swiss", "Grand Rapids MI")
 * and date scraps ("n.d.", "ca.") — lists of such words are data (lib/search/labels).
 */
export function artistOf(e: SearchEntry): string | undefined {
  if (e.search?.artist) return e.search.artist;
  const m = /.* by ([^()]+?) \(/.exec(e.summary);
  if (!m) return undefined;
  let name = m[1].trim().replace(/\s+(n\.d\.|ca\.?)$/i, "");
  for (const p of ARTIST_PREFIXES) if (name.toLowerCase().startsWith(`${p} `)) name = name.slice(p.length + 1);
  const w = name.split(/\s+/);
  // A US state at the end, and the city before it ("Frederick Stuart Church Grand Rapids MI").
  if (w.length > 3 && /^[A-Z]{2}$/.test(w[w.length - 1])) {
    w.pop();
    w.splice(Math.max(3, w.length - 2));
  }
  while (w.length > 2 && ARTIST_SUFFIXES.includes(w[w.length - 1])) w.pop();
  name = w.join(" ");
  return nameLike(name) ? name : undefined;
}

/**
 * The year a design was made, from the summary's last parenthesis: a year anywhere in it ("ca.1936",
 * "after 1924", "Dated 1741"); a short range's middle ("1744–56"); a long one (a dynasty, a lifetime)
 * says nothing about the print and gives no year; a century alone gives its middle.
 */
export function yearOf(e: SearchEntry): number | undefined {
  const y = e.search?.year;
  if (typeof y === "number") return y;
  if (Array.isArray(y)) return y[1] - y[0] > 50 ? undefined : Math.round((y[0] + y[1]) / 2);
  const parens = [...e.summary.matchAll(/\(([^()]*)\)/g)].map((m) => m[1]);
  for (const p of parens.reverse()) {
    const r = /(\d{4})\s*[-–]\s*(\d{2,4})\b/.exec(p);
    if (r) {
      const a = Number(r[1]);
      const b = r[2].length === 4 ? Number(r[2]) : Math.floor(a / 10 ** r[2].length) * 10 ** r[2].length + Number(r[2]);
      if (b >= a) return b - a > 50 ? undefined : Math.round((a + b) / 2);
    }
    const one = /\b(1[0-9]{3})\b/.exec(p);
    if (one) return Number(one[1]);
    const c = /(\d{1,2})(?:st|nd|rd|th)\b[^)]*century/i.exec(p);
    if (c) return (Number(c[1]) - 1) * 100 + 50;
  }
  return undefined;
}

export function scientificOf(e: SearchEntry): string | undefined {
  if (e.search?.scientific) return e.search.scientific;
  return /\(([A-Z][a-z]+ [a-z]+)\)/.exec(`${e.title} ${e.subject}`)?.[1];
}

export const sourceOfEntry = (e: SearchEntry) => sourceOf(e.search?.source ?? e.photo?.credit ?? "");

/* The index ------------------------------------------------------------- */

const slug = (s: string) => clean(s).replace(/ /g, "-");
const b36 = (n: number) => n.toString(36);

/** The value at quantile q of a list (sorted copy). */
function quantile(values: number[], q: number) {
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))];
}

/** A table of the values a column takes, most common first (ties by label), and each design's index into it. */
function table(values: (readonly [id: string, label: string] | null)[]): { entries: TableEntry[]; col: number[] } {
  const counts = new Map<string, TableEntry>();
  for (const v of values) if (v) counts.set(v[0], { id: v[0], label: v[1], count: (counts.get(v[0])?.count ?? 0) + 1 });
  const entries = [...counts.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  const at = new Map(entries.map((e, i) => [e.id, i]));
  return { entries, col: values.map((v) => (v ? at.get(v[0])! : -1)) };
}

const NEUTRAL: VisualMetrics = { symmetry: 0.5, detail: 0.5, coverage: 0.5, extent: 0.5, aspect: 1, dhash: "0".repeat(16) };

export function buildSearchIndex(catalog: readonly SearchEntry[], visual: Readonly<Record<string, VisualMetrics>>): { file: SearchIndexFile; warnings: string[] } {
  const warnings: string[] = [];
  const vis = catalog.map((e) => visual[e.id] ?? NEUTRAL);
  const missing = catalog.filter((e) => !visual[e.id]).length;
  if (missing) warnings.push(`${missing} designs without visual measures (neutral values used)`);

  // Facet columns.
  const artists = catalog.map((e) => artistOf(e));
  const sources = catalog.map((e) => sourceOfEntry(e));
  const years = catalog.map((e) => yearOf(e));
  // Labels read in sentence case like every other chip ("Line-Art" → "Line art", "ASCII-Art" → "ASCII art").
  const style = table(catalog.map((e) => [slug(e.style), labelCase(e.style.replace(/-/g, " ").toLowerCase())] as const));
  const source = table(sources.map((s) => (s ? ([s.id, s.label] as const) : null)));
  const artist = table(artists.map((a) => (a ? ([slug(a), typographic(a)] as const) : null)));
  const variant = table(catalog.map((e) => [e.variant, variantLabel(e.variant)] as const));
  const category = table(catalog.map((e) => [e.category, typographic((CATEGORY_LABELS as Record<string, string>)[e.category] ?? humanizeId(e.category))] as const));
  const medium = table(catalog.map((e) => [e.medium, MEDIUM_LABELS[e.medium] ?? humanizeId(e.medium)] as const));
  const era = years.map((y) => (y === undefined ? -1 : Math.floor(y / 10)));
  // Era values: the centuries and decades that occur.
  const eraEntries = [
    ...table(era.map((d) => (d < 0 ? null : ([`c${Math.floor(d / 10) + 1}`, eraLabel(`c${Math.floor(d / 10) + 1}`)] as const)))).entries,
    ...table(era.map((d) => (d < 0 ? null : ([`d${d * 10}`, `${d * 10}s`] as const)))).entries,
  ];

  // Look tags: one end of a feature or visual measure, cut at the catalog's percentiles.
  const value = (i: number, key: string) => (key in catalog[i].features ? catalog[i].features[key as keyof CatalogEntry["features"]] : (vis[i] as unknown as Record<string, number>)[key]);
  const tags: { id: string; label: string; test: (i: number) => boolean }[] = [];
  for (const t of LOOK_TAGS) {
    const known = (FEATURE_KEYS as readonly string[]).includes(t.key) || (VISUAL_KEYS as readonly string[]).includes(t.key);
    if (!known) continue; // its feature is gone: so is the tag
    const all = catalog.map((_, i) => value(i, t.key));
    const mid = quantile(all, 0.5);
    const cut = quantile(all, t.side === "high" ? TAG_HIGH : TAG_LOW);
    const inclusive = (i: number) => (t.side === "high" ? value(i, t.key) >= cut && value(i, t.key) > mid : value(i, t.key) <= cut && value(i, t.key) < mid);
    // Many designs sharing the cut value would swell the tag: then only those strictly past it.
    const strict = catalog.filter((_, i) => inclusive(i)).length > catalog.length * TAG_MAX_SHARE;
    tags.push({ id: t.id, label: t.label, test: (i) => inclusive(i) && (!strict || (t.side === "high" ? value(i, t.key) > cut : value(i, t.key) < cut)) });
  }
  for (const k of FEATURE_KEYS) if (!LOOK_TAGS.some((t) => t.key === k) && !UNTAGGED_KEYS.includes(k)) warnings.push(`feature "${k}" has no look tag label`);
  const lookCounts = tags.map((t) => catalog.filter((_, i) => t.test(i)).length);
  const lookKept = tags.filter((_, j) => lookCounts[j] > 0);
  const look = catalog.map((_, i) => lookKept.reduce((m, t, b) => (t.test(i) ? m | (1 << b) : m), 0));

  // Text fields.
  // Boilerplate — a sentence (numbers masked) found in more than a tenth of descriptions ("printed as a one-ink
  // halftone", "The print measures … cm") — says nothing about any one design: it isn't indexed.
  const sentences = (t: string) => t.split(/(?<=[.!?])\s+/);
  const mask = (x: string) => clean(x).replace(/\d+/g, "#");
  const often = new Map<string, number>();
  for (const e of catalog) for (const x of new Set(sentences(e.description).map(mask))) often.set(x, (often.get(x) ?? 0) + 1);
  // Also the tail a summary shares with many ("…, printed as a one-ink halftone."): clauses after the last comma.
  const tail = (x: string) => mask(x.split(",").slice(-1)[0]);
  const tails = new Map<string, number>();
  for (const e of catalog) for (const x of sentences(e.description)) tails.set(tail(x), (tails.get(tail(x)) ?? 0) + 1);
  const boiler = (x: string) => (often.get(mask(x)) ?? 0) > catalog.length * 0.1;
  const body = (d: string) =>
    sentences(d)
      .filter((x) => !boiler(x))
      .map((x) => ((tails.get(tail(x)) ?? 0) > catalog.length * 0.1 && x.includes(",") ? x.slice(0, x.lastIndexOf(",")) : x))
      .join(" ");
  const fieldText = (e: SearchEntry, i: number): Record<(typeof FIELDS)[number], string> => {
    const titleWords = new Set(terms(e.title));
    return {
      title: e.title,
      // The subject's own words only (it often repeats the title, which would count twice).
      subject: words(e.subject).filter((w) => !titleWords.has(stem(w))).join(" "),
      // How it's made and what kind of design (the style — "Vintage" on most — and the source are facets, not words to match).
      tags: [...(e.search?.tags ?? []), e.search?.printedText ?? "", variantLabel(e.variant), category.entries[category.col[i]].label, medium.entries[medium.col[i]].label].join(" "),
      // Who made it (the artist, the photographer), not the institution ("…Air and Space Museum" isn't about space).
      credit: [artists[i] ?? "", (e.photo?.credit ?? "").split(",").filter((seg) => !sourceOf(seg)).join(" "), scientificOf(e) ?? ""].join(" "),
      body: body(e.description),
    };
  };
  const perField = FIELDS.map(() => new Map<string, Map<number, number>>());
  const lens = FIELDS.map(() => [] as number[]);
  const surface = new Map<string, Map<string, number>>();
  catalog.forEach((e, i) => {
    const text = fieldText(e, i);
    FIELDS.forEach((f, fi) => {
      const ts = terms(text[f]);
      lens[fi].push(ts.length);
      for (const t of ts) {
        let m = perField[fi].get(t);
        if (!m) perField[fi].set(t, (m = new Map()));
        m.set(i, (m.get(i) ?? 0) + 1);
      }
      for (const w of clean(text[f]).split(" ")) {
        if (!w || STOPWORDS.has(w)) continue;
        const s = stem(w);
        const m = surface.get(s) ?? new Map<string, number>();
        m.set(w, (m.get(w) ?? 0) + 1);
        surface.set(s, m);
      }
    });
  });
  const vocab = [...new Set(perField.flatMap((m) => [...m.keys()]))].sort();
  const df = vocab.map((t) => new Set(perField.flatMap((m) => [...(m.get(t)?.keys() ?? [])])).size);
  const shown = vocab.map((t) => {
    const best = [...(surface.get(t) ?? [])].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
    return best && best !== t ? best : "";
  });
  const post = perField.map((m) =>
    vocab.map((t) => {
      const docs = [...(m.get(t) ?? [])].sort((a, b) => a[0] - b[0]);
      let prev = 0;
      return docs
        .map(([d, tf]) => {
          const s = b36(d - prev) + (tf > 1 ? `*${b36(tf)}` : "");
          prev = d;
          return s;
        })
        .join(".");
    }),
  );

  // Visual: quantized measures and hashes.
  const q = (x: number) => Q64[Math.max(0, Math.min(63, Math.round(x * 63)))];
  const m = vis.map((v) => q(v.symmetry) + q(Math.min(1, v.detail / 0.25)) + q(v.coverage) + q(v.extent) + q((Math.log2(Math.max(0.25, Math.min(4, v.aspect))) + 2) / 4)).join("");

  // Soft checks (warnings only).
  const unlabelled = variant.entries.filter((v) => !hasVariantLabel(v.id)).map((v) => `${v.id} → ${v.label}`);
  if (unlabelled.length) warnings.push(`${unlabelled.length} variants humanized from their id: ${unlabelled.join(", ")}`);
  for (const c of category.entries) if (!(c.id in CATEGORY_LABELS)) warnings.push(`category "${c.id}" has no label`);
  const odd = [...new Set(catalog.filter((e, i) => e.photo?.credit && !sources[i]).map((e) => e.photo!.credit.split(",").pop()!.trim()))];
  if (odd.length) warnings.push(`credits with no known source: ${odd.map((s) => JSON.stringify(s)).join(", ")}`);
  const tableOf = { style: style.entries, source: source.entries, artist: artist.entries, era: eraEntries, look: lookKept.map((t) => ({ id: t.id, label: t.label, count: lookCounts[tags.indexOf(t)] })), variant: variant.entries, category: category.entries, medium: medium.entries };
  const vocabSet = new Set(vocab);
  for (const entry of LEXICON) {
    const f = entry.facet;
    if (f && f.kind in tableOf && !tableOf[f.kind as keyof typeof tableOf].some((e) => e.id === f.value)) warnings.push(`lexicon "${entry.phrases[0]}" → ${f.kind}:${f.value}, not in this catalog`);
    const gone = (entry.expand ?? []).filter((w) => !vocabSet.has(stem(w)));
    if (entry.expand && gone.length === entry.expand.length) warnings.push(`lexicon "${entry.phrases[0]}" expands to nothing in this catalog`);
  }

  const file: SearchIndexFile = {
    v: SEARCH_VERSION,
    n: catalog.length,
    ids: idsHash(catalog.map((e) => e.id)),
    vocab,
    df,
    shown,
    post,
    len: lens.map((l) => l.map(b36).join(".")),
    cols: { style: style.col, source: source.col, artist: artist.col, era, look },
    tables: tableOf,
    visual: { m, h: vis.map((v) => v.dhash).join("") },
  };
  return { file, warnings };
}
