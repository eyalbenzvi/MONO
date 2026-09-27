/**
 * The solid-block check over the catalogue (content overhaul, Part 0): every
 * print rendered at its own size, refused if it lands on the tee as a slab
 * of ink. Prints the refusals; exits 1 if there are any.
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/tools/blockCheck.ts [--json out.json]
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import type { CatalogEntry } from "../../types/shirt";
import { rasterInk, solidBlock, svgInk, type BlockCheck } from "../gen/quality";

const ROOT = path.resolve(__dirname, "..", "..");

/**
 * A drawn print is checked as rendered at the check's size; a raster print at its own size (a halftone's
 * dots stay dots — shrunk, a mesh of them would average into a false solid grey).
 */
export async function checkPrint(s: Pick<CatalogEntry, "backPrintUrl" | "baseColor" | "medium">): Promise<BlockCheck> {
  const file = path.join(ROOT, "public", s.backPrintUrl);
  if (file.endsWith(".svg")) return solidBlock(svgInk(readFileSync(file, "utf8"), s.baseColor));
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return solidBlock(rasterInk(data, info.width, info.height, s.medium, s.baseColor));
}

async function main() {
  const catalog: CatalogEntry[] = JSON.parse(readFileSync(path.join(ROOT, "data", "shirts.json"), "utf8"));
  const out: Record<string, BlockCheck> = {};
  const refused: string[] = [];
  for (const s of catalog) {
    const c = await checkPrint(s);
    out[s.id] = c;
    if (c.reject) refused.push(`${s.id} ${c.reject} · ${s.variant} · ${s.title}`);
  }
  const json = process.argv.indexOf("--json");
  if (json > 0) writeFileSync(process.argv[json + 1], JSON.stringify(out));
  for (const r of refused) console.log(r);
  console.log(`${refused.length} of ${catalog.length} prints are solid ink blocks`);
  process.exitCode = refused.length ? 1 : 0;
}

if (require.main === module) void main();
