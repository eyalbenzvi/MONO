/**
 * The shop's tee balance, for the next design's call (docs/content/design-loop.md, "Tees"): how many designs
 * are offered on both tees and which one each leads with, and how many on one tee only. The aim: most on both,
 * leading with white and black about equally; the white-only and black-only groups small and of similar size.
 *
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/studio/teeBalance.ts
 */
import { readFileSync } from "node:fs";
import path from "node:path";

interface Row { colors: string[]; baseColor: string }

export function teeBalance(rows: Row[]) {
  const both = rows.filter((r) => r.colors.length === 2);
  const leadWhite = both.filter((r) => r.baseColor === "white").length;
  const leadBlack = both.length - leadWhite;
  const whiteOnly = rows.filter((r) => r.colors.length === 1 && r.colors[0] === "white").length;
  const blackOnly = rows.filter((r) => r.colors.length === 1 && r.colors[0] === "black").length;
  return {
    total: rows.length,
    both: both.length,
    leadWhite,
    leadBlack,
    whiteOnly,
    blackOnly,
    /** The tee a new design offered on both should lead with (the one behind; white on a tie). */
    nextDefault: leadBlack < leadWhite ? ("black" as const) : ("white" as const),
    /** The one-tee group that is behind: an idea made for that tee is wanted (white on a tie). */
    singleWanted: blackOnly < whiteOnly ? ("black" as const) : ("white" as const),
  };
}

if (require.main === module) {
  const raw = JSON.parse(readFileSync(path.resolve(__dirname, "..", "..", "data", "shirts.json"), "utf8"));
  const rows: Row[] = Array.isArray(raw) ? raw : raw.shirts;
  const b = teeBalance(rows);
  console.log(`${b.total} designs: ${b.both} on both (lead white ${b.leadWhite}, black ${b.leadBlack}), white only ${b.whiteOnly}, black only ${b.blackOnly}`);
  console.log(`next design on both tees leads with: ${b.nextDefault}; a one-tee design is wanted on: ${b.singleWanted}`);
}
