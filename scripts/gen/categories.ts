/**
 * The shop's categories (the brand book's scheme, content overhaul Part 4):
 * every design is filed by what it shows and how it was made, whichever
 * generator (or archive group) made it. The generator keeps its own source
 * categories so ids, prints and names never change.
 */
import type { ShirtCategory, SourceCategory } from "../../types/shirt";
import type { ArchiveGroup } from "../archive/source";

/** Archive groups in the shop's categories (an etched or ornament print of a building goes to Architecture: see displayCategory). */
export const ARCHIVE_DISPLAY: Record<ArchiveGroup, ShirtCategory> = {
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
 * The shop category of a design: what it shows and how it was made,
 * whichever generator made it.
 */
export function displayCategory(source: SourceCategory, variant: string, title = ""): ShirtCategory {
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
    case "archive": {
      const shown = ARCHIVE_DISPLAY[variant.replace(/^archive-/, "") as ArchiveGroup];
      return (shown === "etched" || shown === "pattern") && BUILDING.test(title) ? "architecture" : shown;
    }
  }
}
