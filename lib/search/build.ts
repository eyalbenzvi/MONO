/**
 * Builds the search index from the full catalog (data/shirts.json) and the
 * cached visual measures. Pure: scripts/tools/searchIndex.ts writes its
 * output, and tests build it in memory. Nothing here names a category,
 * variant or design — tables and look tags come from the data.
 */
import { CATEGORY_LABELS, FEATURE_KEYS, type CatalogEntry } from "@/types/shirt";
import { FIELDS, Q64, SEARCH_VERSION, VISUAL_KEYS, idsHash, type SearchIndexFile, type TableEntry } from "./format";
import { EXTRA_TAGS, LOOK_TAGS, MEDIUM_LABELS, TAG_HIGH, TAG_LOW, UNTAGGED_KEYS, WIDE_ASPECT, hasVariantLabel, humanizeId, sourceOf, variantLabel } from "./labels";
import { LEXICON } from "./lexicon";
import { STOPWORDS, clean, stem, terms } from "./normalize";

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

export function artistOf(e: SearchEntry): string | undefined {
  if (e.search?.artist) return e.search.artist;
  const m = / by ([^()]+?) \(/.exec(e.summary);
  return m && nameLike(m[1]) ? m[1].trim() : undefined;
}

/** The year a design was made (a range's middle); a century alone gives its middle. */
export function yearOf(e: SearchEntry): number | undefined {
  const y = e.search?.year;
  if (typeof y === "number") return y;
  if (Array.isArray(y)) return Math.round((y[0] + y[1]) / 2);
  const m = /\((?:ca\.? )?(\d{4})/.exec(e.summary);
  if (m) return Number(m[1]);
  const c = /\((?:early |late |mid-?)?(\d{1,2})(?:st|nd|rd|th)(?:[-–]\d{1,2}(?:st|nd|rd|th))? century\)/.exec(e.summary);
  return c ? (Number(c[1]) - 1) * 100 + 50 : undefined;
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
  const style = table(catalog.map((e) => [slug(e.style), e.style.replace(/-/g, " ")] as const));
  const source = table(sources.map((s) => (s ? ([s.id, s.label] as const) : null)));
  const artist = table(artists.map((a) => (a ? ([slug(a), a] as const) : null)));
  const variant = table(catalog.map((e) => [e.variant, variantLabel(e.variant)] as const));
  const category = table(catalog.map((e) => [e.category, (CATEGORY_LABELS as Record<string, string>)[e.category] ?? humanizeId(e.category)] as const));
  const medium = table(catalog.map((e) => [e.medium, MEDIUM_LABELS[e.medium] ?? humanizeId(e.medium)] as const));
  const era = years.map((y) => (y === undefined ? -1 : Math.floor(y / 10)));
  // Era values: the centuries and decades that occur.
  const eraEntries = [
    ...table(era.map((d) => (d < 0 ? null : ([`c${Math.floor(d / 10) + 1}`, `${Math.floor(d / 10) * 100}s`] as const)))).entries,
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
    tags.push({ id: t.id, label: t.label, test: (i) => (t.side === "high" ? value(i, t.key) >= cut && value(i, t.key) > mid : value(i, t.key) <= cut && value(i, t.key) < mid) });
  }
  const typo = catalog.map((e) => e.features.typography ?? 0);
  const typoLow = quantile(typo, TAG_LOW);
  tags.push({ id: "wide", label: EXTRA_TAGS[0].label, test: (i) => vis[i].aspect > WIDE_ASPECT });
  tags.push({ id: "notext", label: EXTRA_TAGS[1].label, test: (i) => typo[i] <= typoLow && !catalog[i].search?.printedText });
  for (const k of FEATURE_KEYS) if (!LOOK_TAGS.some((t) => t.key === k) && !UNTAGGED_KEYS.includes(k)) warnings.push(`feature "${k}" has no look tag label`);
  const lookCounts = tags.map((t) => catalog.filter((_, i) => t.test(i)).length);
  const lookKept = tags.filter((_, j) => lookCounts[j] > 0);
  const look = catalog.map((_, i) => lookKept.reduce((m, t, b) => (t.test(i) ? m | (1 << b) : m), 0));

  // Text fields.
  const fieldText = (e: SearchEntry, i: number): Record<(typeof FIELDS)[number], string> => ({
    title: e.title,
    subject: e.subject,
    tags: [...(e.search?.tags ?? []), e.search?.printedText ?? "", variantLabel(e.variant), e.style, category.entries[category.col[i]].label, medium.entries[medium.col[i]].label].join(" "),
    credit: [artists[i] ?? "", e.photo?.credit ?? "", sources[i]?.label ?? "", scientificOf(e) ?? ""].join(" "),
    body: e.description,
  });
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
