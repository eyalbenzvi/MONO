/**
 * Design numbers by where they come from. Every range is fixed once written
 * down: a design's number never moves, so adding a source never renumbers
 * anything. The sources of the content waves (docs/content/waves.md) get
 * 1,000 numbers each, from 8001 on; a source that fills its block gets a new
 * block at the end of the table, never one in between.
 */

export interface IdRange {
  first: number;
  last: number;
  /** Who numbers designs in it. */
  what: string;
}

/** The ranges numbered before the waves (scripts/generateCatalog.ts). */
export const EXISTING: IdRange[] = [
  { first: 1, last: 2800, what: "generated sets 1–3 (legacy, expansion, set3)" },
  { first: 2801, last: 3400, what: "Smithsonian photographs (scripts/photos)" },
  { first: 3401, last: 3830, what: "generated set 5" },
  { first: 3831, last: 5516, what: "Smithsonian archive (data/archive/archive.json)" },
  { first: 5517, last: 7000, what: "archive additions (data/archive/additions.json)" },
  { first: 7001, last: 8000, what: "generated set 7" },
];

/** A source of the waves: its blocks of 1,000 (first numbers), in order of use. */
export const SOURCE_BLOCKS = {
  wikimedia: [8001],
  met: [9001],
  artic: [10001],
  cleveland: [11001],
  smithsonian: [12001],
  loc: [13001],
  noaa: [14001],
  nasa: [15001],
  usgs: [16001],
  wellcome: [17001],
  archiveorg: [18001],
  rijksmuseum: [19001],
  // Not a collection: the studio's own illustrations (data/studio/catalogue.json, scripts/studio/publish.ts).
  studio: [20001],
} as const satisfies Record<string, readonly number[]>;
export type SourceId = keyof typeof SOURCE_BLOCKS;
export const SOURCE_IDS = Object.keys(SOURCE_BLOCKS) as SourceId[];

export const BLOCK = 1000;

/** Every range, the existing and the sources' blocks. */
export function allRanges(): IdRange[] {
  const blocks = SOURCE_IDS.flatMap((s) => SOURCE_BLOCKS[s].map((first) => ({ first, last: first + BLOCK - 1, what: s })));
  return [...EXISTING, ...blocks].sort((a, b) => a.first - b.first);
}

/** The source (or existing range) a number belongs to. */
export const rangeOf = (n: number) => allRanges().find((r) => n >= r.first && n <= r.last) ?? null;

/**
 * The next free numbers of a source, given the numbers it already used:
 * its blocks in order, never a used number. Throws when its blocks are full
 * (add a block to SOURCE_BLOCKS).
 */
export function nextNumbers(source: SourceId, used: Iterable<number>, count: number): number[] {
  const taken = new Set(used);
  const out: number[] = [];
  for (const first of SOURCE_BLOCKS[source])
    for (let n = first; n < first + BLOCK && out.length < count; n++) if (!taken.has(n)) out.push(n);
  if (out.length < count) throw new Error(`${source}: its id blocks are full (${count - out.length} more needed); add a block in scripts/sources/ranges.ts`);
  return out;
}
