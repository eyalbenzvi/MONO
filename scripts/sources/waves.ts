/**
 * What the catalogue generator needs of the content waves (kept free of the network code):
 * each wave's drop date, each source's institution, and how a kept picture is filed.
 */
import type { ArchiveGroup } from "../archive/source";
import type { ShirtCategory } from "../../types/shirt";
import { LICENSE_LABEL, type License } from "./_license";
import type { Selected } from "./_types";
import type { SourceId } from "./ranges";

/** Each wave's drop (a Monday): at most 40 of its designs are new that week, the rest a week earlier. */
export const WAVE_DROP: Record<number, string> = { 1: "2026-09-28", 2: "2026-09-28" };

/** The institution a design is "from" in its description, and the credit's source line. */
export const INSTITUTION: Record<SourceId, string> = {
  wikimedia: "Wikimedia Commons collection",
  met: "Metropolitan Museum of Art",
  artic: "Art Institute of Chicago",
  cleveland: "Cleveland Museum of Art",
  smithsonian: "Smithsonian Institution",
  loc: "Library of Congress",
  noaa: "NOAA Photo Library",
  nasa: "NASA image library",
  usgs: "US Geological Survey library",
  wellcome: "Wellcome Collection",
  archiveorg: "Internet Archive",
  rijksmuseum: "Rijksmuseum",
};
export const SOURCE_LINE: Record<SourceId, string> = {
  wikimedia: "Wikimedia Commons",
  met: "The Met Open Access",
  artic: "Art Institute of Chicago",
  cleveland: "Cleveland Museum of Art Open Access",
  smithsonian: "Smithsonian Open Access",
  loc: "Library of Congress",
  noaa: "NOAA",
  nasa: "NASA",
  usgs: "USGS",
  wellcome: "Wellcome Collection",
  archiveorg: "Internet Archive",
  rijksmuseum: "Rijksmuseum",
};
export const licenseLine = (l: License) => LICENSE_LABEL[l];

const PHOTO = /photograph|albumen|gelatin silver|platinum print|cyanotype/i;
const MAP = /\bmap\b|\bchart\b|atlas|bathymetr|coast survey/i;
const BRUSH = /woodblock|ukiyo|surimono|hanging scroll|handscroll|album leaf|ink on (?:paper|silk)|japan|china|korea/i;
const PLATE = /plate|specimen|natural history|zoolog|botan|illustration|kunstformen|challenger|haeckel|lithograph.*(?:fish|shell|coral)|chromolith/i;
const TECH = /patent|technical drawing|mechanical|machine|engine|diagram/i;
const SHIP_PLAN = /lines plan|sail plan|ship ?plan|architectura navalis|construction plan|shipbuilding|half model|profile of the|plan of a ship/i;
const VESSEL = /\b(?:ship|vessel|schooner|lightship|steamer|steamboat|boat|barge|ferry|tug)\b/i;
const MEASURED = /measured drawing|architectural drawing/i;

/** The archive group whose character (features, screen, tee) a kept picture takes, and its shop category. */
export function filing(s: Pick<Selected, "mode" | "classification" | "title" | "tags" | "source" | "wave">): { group: ArchiveGroup; category: ShirtCategory } {
  const text = [s.classification, s.title, ...s.tags].join(" · ");
  if (s.mode !== "ink" || PHOTO.test(s.classification)) return { group: "art-photo", category: "photographs" };
  if (MAP.test(text)) return { group: "etching", category: "sky" };
  // Ship plans and a vessel's measured drawing are technical line work; a building's is architecture.
  if (SHIP_PLAN.test(text) || (MEASURED.test(s.classification) && VESSEL.test(s.title))) return { group: "etching", category: "systems" };
  if (MEASURED.test(s.classification)) return { group: "etching", category: "architecture" };
  if (TECH.test(text)) return { group: "etching", category: "systems" };
  if (BRUSH.test(text)) return { group: "ukiyo-e", category: "brush" };
  if (PLATE.test(text) || (s.source === "wikimedia" && s.wave === 1)) return { group: "natural-history", category: "specimens" };
  return { group: "etching", category: "etched" };
}

/** A record title as a design name of at most 60 characters: its first clause if that fits, else cut at a word. */
export function shortName(t: string, max = 60): string {
  // A plate's running number ("43. The Sea Wolf") is the book's, not what the picture shows.
  const s = t.replace(/\s+/g, " ").replace(/^\d+\.\s+/, "").trim();
  if (s.length <= max) return s;
  const clause = /^(.{12,}?)\s*(?:[:;,(]| - | — )/.exec(s)?.[1];
  if (clause && clause.length <= max) return clause.trim();
  return s.slice(0, max + 1).replace(/\s+\S*$/, "").replace(/[\s,.;:-]+$/, "");
}
