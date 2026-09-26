/**
 * The shop's categories (the content review's scheme, T8): every design is
 * filed by what it shows and how it was made, whichever generator (or
 * archive group) made it. The generator keeps its own source categories so
 * ids, prints and names never change.
 */
import type { ShirtCategory, SourceCategory } from "../../types/shirt";
import type { ArchiveGroup } from "../archive/source";

/** Archive groups in the shop's categories. */
export const ARCHIVE_DISPLAY: Record<ArchiveGroup, ShirtCategory> = {
  "ink-painting": "ink",
  "ukiyo-e": "ink",
  stencil: "ink",
  "gallery-print": "engraved",
  woodcut: "engraved",
  etching: "engraved",
  botanical: "botanical",
  "art-photo": "archive",
  "archive-photo": "archive",
  locomotion: "wildlife",
  patent: "machines",
  ornament: "ornament",
};

/**
 * The shop category of a design (the content review's scheme): what it
 * shows and how it was made, whichever generator made it.
 */
export function displayCategory(source: SourceCategory, variant: string): ShirtCategory {
  switch (source) {
    case "architectural":
    case "iconic":
      return "architecture";
    case "geometric":
      return variant === "tiling" ? "ornament" : "abstract";
    case "halftone":
    case "waves":
    case "curves":
      return "abstract";
    case "typography":
    case "slogans":
    case "emblems":
    case "caricatures":
      return "type";
    case "scenes":
    case "sky":
      return "landscapes";
    case "pixel":
    case "ascii":
      return "retro";
    case "objects": // woodcut illustrations
      return "engraved";
    case "famousart":
      return "masterworks";
    case "wildlife":
      return "wildlife";
    case "flight":
    case "machines":
      return "machines";
    case "botany":
      return "botanical";
    case "ornament":
      return "ornament";
    case "archive":
      return ARCHIVE_DISPLAY[variant.replace(/^archive-/, "") as ArchiveGroup];
  }
}

