/**
 * The element table Your Name in Elements spells with (lib/custom/draw/elements.ts),
 * written from PubChem's periodic table (NCBI, public domain), fetched once:
 *
 *   npx tsx scripts/tools/buildElements.ts
 *
 * The raw download is kept in data/elements/pubchem.json so the table can be
 * rebuilt offline; the module holds the number, symbol, name, group and period.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../..");
const RAW = path.join(ROOT, "data", "elements", "pubchem.json");
const OUT = path.join(ROOT, "lib", "custom", "draw", "elements.ts");
const URL = "https://pubchem.ncbi.nlm.nih.gov/rest/pug/periodictable/JSON";

/** Group (1–18, 0 for the lanthanides and actinides) and period, from the atomic number. */
function place(z: number): [number, number] {
  const starts = [1, 3, 11, 19, 37, 55, 87, 119];
  const period = starts.findIndex((s, i) => z >= s && z < starts[i + 1]) + 1;
  const k = z - starts[period - 1];
  if (period === 1) return [z === 1 ? 1 : 18, 1];
  if (period <= 3) return [k < 2 ? k + 1 : k + 11, period];
  if (period <= 5) return [k + 1, period];
  // Periods 6 and 7: two s, then the f-block (group 0), then d and p.
  if (k < 2) return [k + 1, period];
  if (k < 17) return [k === 2 ? 3 : 0, period];
  return [k - 13, period];
}

async function main() {
  if (!existsSync(RAW)) writeFileSync(RAW, JSON.stringify(await (await fetch(URL)).json()));
  const rows = (JSON.parse(readFileSync(RAW, "utf8")) as { Table: { Row: { Cell: string[] }[] } }).Table.Row.map((r) => r.Cell);
  const els = rows.map((c) => ({ z: Number(c[0]), sym: c[1], name: c[2] })).sort((a, b) => a.z - b.z);
  if (els.length !== 118) throw new Error(`expected 118 elements, got ${els.length}`);
  const lines = els.map((e) => `  [${e.z}, ${JSON.stringify(e.sym)}, ${JSON.stringify(e.name)}, ${place(e.z).join(", ")}],`);
  writeFileSync(
    OUT,
    `/**
 * The 118 elements: atomic number, symbol, IUPAC English name, group (1–18;
 * 0 for the lanthanides and actinides) and period. Written by
 * scripts/tools/buildElements.ts from PubChem's periodic table (NCBI,
 * public domain); don't edit by hand.
 */
export type Element = readonly [z: number, symbol: string, name: string, group: number, period: number];

export const ELEMENTS: readonly Element[] = [
${lines.join("\n")}
];
`,
  );
  console.log(`${els.length} elements → ${path.relative(ROOT, OUT)}`);
}
main();
