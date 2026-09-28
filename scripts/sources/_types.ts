/**
 * A picture of a content wave, from search result to catalogue entry
 * (modelled on scripts/archive's ArchiveSource). Candidate: what the source's
 * record says (metadata only). Prepped: after the download, the master print
 * and its numbers. Selected: kept by the owner, numbered, committed to
 * data/sources/<source>.json.
 */
import type { ArchiveMode } from "../archive/source";
import type { License } from "./_license";
import type { SourceId } from "./ranges";

export interface Candidate {
  source: SourceId;
  /** Unique within the source (file-safe): used for the cache files. */
  key: string;
  /** The source's own record id and its page. */
  record: string;
  recordUrl: string;
  /** The largest image the source allows. */
  imageUrl: string;
  title: string;
  maker: string | null;
  date: string | null;
  /** The credit line as the record gives it (or "<maker>, <institution>"). */
  credit: string;
  license: License;
  /** Classification, medium or technique as given ("Print", "Etching", "Photograph"). */
  classification: string;
  /** Subjects, tags, department, object name, description: what the metadata filter reads. */
  tags: string[];
  description: string;
  width: number | null;
  height: number | null;
  /**
   * How it prints: "ink" (a drawing, print or plate: the marks become one ink), "photo" (the whole
   * photograph as a halftone, never inverted), "cut" (an object photographed on a backdrop, cut out).
   */
  mode: ArchiveMode;
  /** How halftone.py screens it: line work, tonal work (washes, watercolours, aquatints), or a photograph. */
  screen: "line" | "tonal" | "photo";
  /** The metadata filter's order (higher first) and the world's keywords it matched. */
  score: number;
  matched: string[];
}

export interface Prepped extends Candidate {
  /** Measures of the master (as ArchiveSource). */
  tone: number;
  contrast: number;
  coverage: number;
  detail: number;
  box: [number, number, number, number];
  /** sha256 (first 16) of the downloaded original: exact duplicates. */
  sha: string;
  /** The screened print's checks (scripts/gen/quality.ts): numbers only. */
  assess: { quality: number; ink: number; extent: number; flags: string[] };
  /** Refused as a solid block of ink (solidBlock's reason), or null. */
  solid: string | null;
  weak: boolean;
  /** The tee the photograph's halftone was baked for (halftone.py), or the ink print's tee. */
  tee: "black" | "white";
  flags: string[];
}

export interface Selected extends Prepped {
  n: number;
  wave: number;
  /** The design's name (the record's title, or the owner's override). */
  name: string;
}
