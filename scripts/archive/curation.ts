/**
 * Curation of the archive designs (from reviewing the contact sheets of
 * fetchArchive.ts sheet): how many of each group are kept, which pictures
 * are left out and why, and names where a record's own title says nothing.
 */
import { mulberry32, shuffle } from "../gen/core";
import { ARCHIVE_FIRST_N, ARCHIVE_GROUPS, type ArchiveGroup, type ArchiveSource } from "./source";
import review from "./review.json";

/**
 * The prints kept, per group, by key: picked by eye from the numbered
 * contact sheets (fetchArchive.ts sheet), best print quality first. Left
 * out: people (a figure the record didn't name), text-only sheets and
 * title pages, blank, faint or damaged scans, a mount or frame that prints
 * as a block, playing cards, and repeats of one plate.
 */
export const REVIEWED: Partial<Record<ArchiveGroup, string[]>> = review;

/** Most kept per group (the review's own counts; a test keeps them honest). */
export const PER_GROUP: Record<ArchiveGroup, number> = Object.fromEntries(
  (Object.keys(ARCHIVE_GROUPS) as ArchiveGroup[]).map((g) => [g, REVIEWED[g]?.length ?? 0]),
) as Record<ArchiveGroup, number>;

/** Keys never used (none yet beyond what the review left out). */
export const EXCLUDE = new Set<string>([]);

/** Names for records whose titles only say what the object is. */
export const NAMES: Record<string, string> = {};

/**
 * Which picture becomes which design: groups interleaved (neighbouring ids
 * differ), each group's pictures in a seeded shuffle of their keys.
 */
export function archiveOrder(all: ArchiveSource[]): { n: number; source: ArchiveSource }[] {
  const groups = Object.keys(ARCHIVE_GROUPS) as ArchiveGroup[];
  const queues = groups.map((g, k) => shuffle(mulberry32(0x61726368 ^ (k * 0x9e37)), all.filter((a) => a.group === g).sort((a, b) => a.key.localeCompare(b.key))));
  const out: { n: number; source: ArchiveSource }[] = [];
  for (let round = 0; out.length < all.length; round++)
    for (const q of queues) if (round < q.length) out.push({ n: ARCHIVE_FIRST_N + out.length, source: q[round] });
  return out;
}
