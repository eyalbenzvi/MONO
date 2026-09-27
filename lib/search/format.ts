/**
 * The search index file (public/data/search.<hash>.json, written by
 * scripts/tools/searchIndex.ts from lib/search/build) and its decoder. Designs
 * are addressed by their position in the catalog (the order of SHIRTS).
 */

/** The format this code reads; the builder writes it and the loader checks it. */
export const SEARCH_VERSION = 1;

/** Text fields, in the order of `post` and `len`. */
export const FIELDS = ["title", "subject", "tags", "credit", "body"] as const;
export type Field = (typeof FIELDS)[number];

/** A facet value the index knows, with how many designs carry it. */
export interface TableEntry {
  id: string;
  label: string;
  count: number;
}

export interface SearchIndexFile {
  v: number;
  /** Designs, and a hash of their ids in order: a stale index is refused, never misread. */
  n: number;
  ids: string;
  /** Sorted index terms (stems), how many designs have each, and a nicer surface word where it differs. */
  vocab: string[];
  df: number[];
  shown: string[];
  /** [field][term]: the designs with the term, delta-coded base 36, ".": a term used k > 1 times reads "d*k". */
  post: string[][];
  /** [field]: each design's length in terms, base 36, "." between. */
  len: string[];
  /** Facet columns, one entry per design (index into `tables`, -1 for none; `look` is a bit mask; `era` a decade, year / 10). */
  cols: { style: number[]; source: number[]; artist: number[]; era: number[]; look: number[] };
  tables: { style: TableEntry[]; source: TableEntry[]; artist: TableEntry[]; era: TableEntry[]; look: TableEntry[]; variant: TableEntry[]; category: TableEntry[]; medium: TableEntry[] };
  /** Quantized visual measures, 5 characters per design (symmetry, detail, coverage, extent, aspect), and a 64-bit dHash, 16 hex each. */
  visual: { m: string; h: string };
}

/** 64 levels per character (the visual measures). */
export const Q64 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_";
export const VISUAL_KEYS = ["symmetry", "detail", "coverage", "extent", "aspect"] as const;

/** FNV-1a over the id list: cheap to check in the browser, enough to catch a stale file. */
export function idsHash(ids: readonly string[]): string {
  let h = 0x811c9dc5;
  const s = ids.join(",");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16);
}

/** One term's postings in one field. */
export interface Postings {
  docs: Int32Array;
  tf: Uint8Array;
}

export interface SearchIndex {
  file: SearchIndexFile;
  n: number;
  /** Term → its position in vocab. */
  termId: Map<string, number>;
  /** Postings, decoded on first use. */
  postings: (field: number, term: number) => Postings;
  /** [field][design] term counts, and each field's mean. */
  len: Uint16Array[];
  avgLen: number[];
  /** A design's dHash as two 32-bit halves. */
  hash: Uint32Array;
}

const EMPTY: Postings = { docs: new Int32Array(0), tf: new Uint8Array(0) };

function decodePostings(s: string): Postings {
  if (!s) return EMPTY;
  const parts = s.split(".");
  const docs = new Int32Array(parts.length);
  const tf = new Uint8Array(parts.length);
  let at = 0;
  parts.forEach((p, i) => {
    const star = p.indexOf("*");
    at += parseInt(star === -1 ? p : p.slice(0, star), 36);
    docs[i] = at;
    tf[i] = star === -1 ? 1 : parseInt(p.slice(star + 1), 36);
  });
  return { docs, tf };
}

/**
 * The index ready to query, or null when it doesn't belong to this catalog
 * (another format, other designs): search then stays off rather than
 * pointing at the wrong designs.
 */
export function decodeIndex(file: SearchIndexFile, catalogIds: readonly string[]): SearchIndex | null {
  if (!file || file.v !== SEARCH_VERSION || file.n !== catalogIds.length || file.ids !== idsHash(catalogIds)) return null;
  const termId = new Map(file.vocab.map((t, i) => [t, i]));
  const cache = FIELDS.map(() => new Map<number, Postings>());
  const len = file.len.map((s) => Uint16Array.from(s.split("."), (x) => parseInt(x, 36)));
  const hash = new Uint32Array(file.n * 2);
  for (let i = 0; i < file.n; i++) {
    hash[i * 2] = parseInt(file.visual.h.slice(i * 16, i * 16 + 8), 16);
    hash[i * 2 + 1] = parseInt(file.visual.h.slice(i * 16 + 8, i * 16 + 16), 16);
  }
  return {
    file,
    n: file.n,
    termId,
    postings: (f, t) => {
      let p = cache[f].get(t);
      if (!p) cache[f].set(t, (p = decodePostings(file.post[f][t])));
      return p;
    },
    len,
    avgLen: len.map((l) => l.reduce((a, b) => a + b, 0) / Math.max(1, l.length) || 1),
    hash,
  };
}

/** A design's visual measure (0–1). */
export const visualOf = (index: SearchIndex, pos: number, key: (typeof VISUAL_KEYS)[number]) => Q64.indexOf(index.file.visual.m[pos * 5 + VISUAL_KEYS.indexOf(key)]) / 63;
