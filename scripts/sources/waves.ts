/**
 * What the catalogue generator needs of the content waves (kept free of the network code):
 * each wave's drop date, each source's institution, and how a kept picture is filed.
 */
import type { ArchiveGroup } from "../archive/source";
import type { ShirtCategory } from "../../types/shirt";
import { trimDangling } from "../gen/titles";
import { LICENSE_LABEL, type License } from "./_license";
import type { Selected } from "./_types";
import type { SourceId } from "./ranges";

/** Each wave's drop: at most 12 of its designs (four per category) are new that week, the rest a week earlier. */
export const WAVE_DROP: Record<number, string> = { 1: "2026-09-28", 2: "2026-09-30", 3: "2026-10-01" };

/** The institution a design is "from" in its description, and the credit's source line. */
export const INSTITUTION: Record<SourceId, string> = {
  wikimedia: "Wikimedia Commons collection",
  met: "Metropolitan Museum of Art",
  artic: "Art Institute of Chicago",
  cleveland: "Cleveland Museum of Art",
  smithsonian: "Smithsonian Institution",
  loc: "Library of Congress",
  noaa: "NOAA Office of Coast Survey's historical chart collection",
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
  noaa: "NOAA Office of Coast Survey",
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
/** From wave 2 on: a chart named in French or in the plural (Commons' "18th-century French nautical charts", "maps of …"). */
const MAP_2 = /\bmaps?\b|\bcharts?\b|\bcarte\b|atlas|bathymetr|coast survey/i;
/** From wave 2 on: a building's drawing (a lighthouse elevation on Commons) is architecture. */
const BUILDING_2 = /architectural (?:elevation|drawing|plan)s?|drawings of [\w\s]+ lighthouse/i;
/** From wave 2 on: East Asian work named by its culture ("Chinese (culture or style)") too. */
const BRUSH_2 = new RegExp(`${BRUSH.source}|chinese|japanese|korean`, "i");
/** From wave 2 on: natural history by name only ("plate", "illustration" or a fishing boat's lithograph don't make a specimen). */
const NATURE_2 = /specimen|natural history|zoolog|botan|kunstformen|challenger|haeckel/i;
const SHIP_PLAN = /lines plan|sail plan|cross sections? of ships|ship ?plan|architectura navalis|construction plan|shipbuilding|half model|profile of the|plan of a ship/i;
const VESSEL = /\b(?:ship|vessel|schooner|lightship|steamer|steamboat|boat|barge|ferry|tug)\b/i;
const MEASURED = /measured drawing|architectural drawing/i;
/** From wave 3 on: the sky's charts and atlases go with the maps (a star atlas, a planisphere, a map of the moon). */
const SKY_3 = /celestial|c[eé]leste?\b|coelestis|constellation|planisph|star (?:chart|map|atlas)|uranometria|coelest|firmament|hemispher|selenograph|\bmoon\b|lunar|\bkarte\b|\bkaart\b|\bmappa\b|nautical chart|coast survey/i;
/** From wave 3 on: lettering and type (an alphabet, a type specimen, ornamental letters) is Type. */
const TYPE_3 = /\balphabets?\b|type specimens?|specimens? of (?:printing )?types?|typefaces?|\blettering\b|ornamental letters?|decorated initials?/i;
/** From wave 3 on: a building's elevation, plan or section in line work is architecture. */
const BUILDING_3 = /\belevations?\b|ground plan|floor plan|\bsections?\b|fa[cç]ade|architectur|cornice|entablature|orders? of architecture|\b(?:doric|ionic|corinthian|tuscan) order|vitruvius|édifices/i;
/** From wave 3 on: knots and signal codes are technical line work. */
const KNOT_3 = /\bknots?\b|\bsplices?\b|\bhitch(?:es)?\b|signal flags?|code of signals|signal code/i;

/** The archive group whose character (features, screen, tee) a kept picture takes, and its shop category. */
export function filing(s: Pick<Selected, "mode" | "classification" | "title" | "tags" | "source" | "wave">): { group: ArchiveGroup; category: ShirtCategory } {
  const text = [s.classification, s.title, ...s.tags].join(" · ");
  if (s.mode !== "ink" || PHOTO.test(s.classification)) return { group: "art-photo", category: "photographs" };
  const later = s.wave !== undefined && s.wave >= 2;
  const third = s.wave !== undefined && s.wave >= 3;
  if ((later ? MAP_2 : MAP).test(text) || (third && SKY_3.test(text))) return { group: "etching", category: "sky" };
  if (third && TYPE_3.test(text)) return { group: "etching", category: "type" };
  // Ship plans and a vessel's measured drawing are technical line work; a building's is architecture.
  // A HABS/HAER sheet on Commons is a measured drawing too (its title names the survey).
  const measured = MEASURED.test(s.classification) || /\b(?:HABS|HAER)\b/.test(s.title);
  if (SHIP_PLAN.test(text) || (measured && VESSEL.test(s.title))) return { group: "etching", category: "systems" };
  if (measured || (later && BUILDING_2.test(text)) || (third && BUILDING_3.test(text))) return { group: "etching", category: "architecture" };
  if (TECH.test(text) || (third && KNOT_3.test(text))) return { group: "etching", category: "systems" };
  if ((later ? BRUSH_2 : BRUSH).test(text)) return { group: "ukiyo-e", category: "brush" };
  // Commons files are all classed "Plate" by the adapter: after the first (natural-history) wave, only their own words count.
  const plateText = s.source === "wikimedia" && s.wave !== 1 ? [s.title, ...s.tags].join(" · ") : text;
  if ((later ? NATURE_2 : PLATE).test(plateText) || (s.source === "wikimedia" && s.wave === 1)) return { group: "natural-history", category: "specimens" };
  return { group: "etching", category: "etched" };
}

/** A record title as a design name of at most 60 characters: its first clause if that fits, else cut at a word. */
export function shortName(t: string, max = 60): string {
  // A plate's running number ("43. The Sea Wolf") is the book's, not what the picture shows.
  let s = t.replace(/\s+/g, " ").replace(/^\d+\.\s+/, "").trim();
  // A library record's statement of responsibility ("… de la Méditerranée / par M. …") is not the name.
  if (s.length > max && / \/ /.test(s)) s = s.replace(/ \/ .*$/, "");
  if (s.length > max) s = s.replace(/\s+(?:ritad av|ritad af|drawn by|dessiné par|getekend door)\s.*$/i, "");
  if (s.length <= max) return s;
  const clause = /^(.{12,}?)\s*(?:[:;,(]| - | — )/.exec(s)?.[1];
  if (clause && clause.length <= max) return trimDangling(clause);
  // Cut at a word, never on a dangling one ("… between 35th and").
  return trimForeignDangling(trimDangling(s.slice(0, max + 1).replace(/\s+\S*$/, "").replace(/[\s,.;:\/-]+$/, "")));
}

/** French, Dutch and Swedish words a cut record title can't end on either (the shared list covers English and a few more). */
const FOREIGN_DANGLING = /\s+(?:pour|par|depuis|jusqu'?à|avec|sur|dans|vers|entre|van|het|een|voor|op|till|av|af|och|med|från|för|y|por|para|con)$/i;
function trimForeignDangling(t: string): string {
  let s = t;
  for (let prev = ""; prev !== s; ) (prev = s), (s = trimDangling(s.replace(FOREIGN_DANGLING, "")));
  return s;
}
