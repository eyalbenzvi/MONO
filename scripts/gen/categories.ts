/**
 * How designs are filed. The legacy filing (the brand book's scheme, content
 * overhaul Part 4: what a design shows and how it was made) still decides
 * features, screens and SKUs; the shop's categories go by subject
 * (shopCategory). The generator keeps its own source categories so ids,
 * prints and names never change.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { LEGACY_TO_SHOP, SHIRT_CATEGORIES, type LegacyCategory, type ShirtCategory, type SourceCategory } from "../../types/shirt";
import type { ArchiveGroup } from "../archive/source";

/** Archive groups in the shop's categories (an etched or ornament print of a building goes to Architecture: see displayCategory). */
export const ARCHIVE_DISPLAY: Record<ArchiveGroup, LegacyCategory> = {
  "ink-painting": "brush",
  "ukiyo-e": "brush",
  stencil: "pattern",
  ornament: "pattern",
  "gallery-print": "etched",
  woodcut: "etched",
  etching: "etched",
  "old-master": "etched",
  botanical: "specimens",
  "natural-history": "specimens",
  "art-photo": "photographs",
  "archive-photo": "photographs",
  locomotion: "photographs",
  patent: "photographs",
};

/** A title naming a building, a street or a city view: an etching of it is filed under Architecture. */
export const BUILDING = /\b(?:cathedral|church|chapel|abbey|basilica|temple|tempio|mosque|pagoda|shrine|palace|palazzo|castle|chateau|château|tower|tour|bridge|pont|ponte|arch|arco|gate|porta|facade|façade|colonnade|portico|cloister|piazza|street|rue|via|quay|quai|lighthouse|mill|ruins?|dome|capitol|courtyard|house|houses|building|buildings|skyline|fountain|fontana|veduta|view of|carceri)\b/i;

/**
 * The legacy filing of a design: what it shows and how it was made, whichever generator made it
 * (its features, screen and SKU go by it; the shop goes by shopCategory below).
 */
export function displayCategory(source: SourceCategory, variant: string, title = ""): LegacyCategory {
  switch (source) {
    case "architectural":
    case "iconic":
      return "architecture";
    case "geometric":
      return variant === "tiling" ? "pattern" : "systems";
    case "halftone":
    case "waves":
    case "curves":
      return "systems";
    case "typography":
    case "slogans":
    case "emblems":
    case "caricatures":
      return "type";
    case "scenes":
    case "sky":
      return "sky";
    case "pixel":
    case "ascii":
      return "terminal";
    case "objects": // woodcut illustrations
    case "famousart":
      return "etched";
    case "wildlife":
    case "flight":
    case "machines":
      return "photographs";
    case "botany":
      return "specimens";
    case "ornament":
      return "pattern";
    case "data": // the seventh set files each design itself (Set7Design.category)
      return "systems";
    case "studio": // the studio files each design itself (scripts/studio/publish.ts)
      return "specimens";
    case "archive": {
      const shown = ARCHIVE_DISPLAY[variant.replace(/^archive-/, "") as ArchiveGroup];
      return (shown === "etched" || shown === "pattern") && BUILDING.test(title) ? "architecture" : shown;
    }
  }
}

/**
 * The shop's categories by subject (what a design shows): each design in the shop is filed by hand in
 * shopCategories.json (mono id → category). A design not listed there (a new studio design files itself
 * with a shop category; a Make base or a retired design) falls back on its legacy filing.
 */
const FILED = JSON.parse(readFileSync(path.join(__dirname, "shopCategories.json"), "utf8")) as Record<string, ShirtCategory>;
for (const [id, c] of Object.entries(FILED)) if (!SHIRT_CATEGORIES.includes(c)) throw new Error(`shopCategories.json: ${id} → ${c}`);

/** The shop category of a design: filed by hand, else its own (a new studio design's), else from its legacy filing. */
export function shopCategory(id: string, category: LegacyCategory | ShirtCategory, source: SourceCategory): ShirtCategory {
  const filed = FILED[id];
  if (filed) return filed;
  if (category in LEGACY_TO_SHOP) return source === "wildlife" && category === "photographs" ? "animals" : LEGACY_TO_SHOP[category as LegacyCategory];
  return category as ShirtCategory;
}
