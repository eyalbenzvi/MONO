/**
 * The dinosaur genera Your Dinosaur's made-up names must never be (run by
 * hand; needs the network): Wikipedia's "List of dinosaur genera" (a list of
 * names, which are facts), kept to the genera ending as ours do (-saurus,
 * -raptor, -don, -ceratops) and written as data/dinosaurs/genera.json, each
 * ending with the stems before it, sorted. Deterministic: no timestamp.
 *
 *   tsx scripts/tools/buildGenera.ts
 */
import { writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../..");
const OUT = path.join(ROOT, "data", "dinosaurs", "genera.json");
const URL = "https://en.wikipedia.org/w/api.php?action=parse&page=List_of_dinosaur_genera&prop=wikitext|revid&format=json&formatversion=2";
export const ENDINGS = ["saurus", "raptor", "don", "ceratops"] as const;

async function main() {
  const r = await fetch(URL, { headers: { "User-Agent": "MONO-catalogue/1.0 (https://github.com/eyalbenzvi/mono; build-time data)" } });
  const j = (await r.json()) as { parse: { wikitext: string; revid: number } };
  const names = new Set<string>();
  for (const m of j.parse.wikitext.matchAll(/''\[\[([^\]|#]+)(?:\|[^\]]*)?\]\]''/g)) {
    const n = m[1].trim().replace(/\s*\(.*\)$/, "");
    if (/^[A-Z][a-z]+$/.test(n)) names.add(n);
  }
  const out: Record<string, string[]> = {};
  for (const e of ENDINGS) out[e] = [...names].filter((n) => n.endsWith(e) && n.length > e.length).map((n) => n.slice(0, -e.length)).sort();
  writeFileSync(OUT, `${JSON.stringify({ source: `https://en.wikipedia.org/w/index.php?title=List_of_dinosaur_genera&oldid=${j.parse.revid}`, genera: names.size, ...out })}\n`);
  console.log(`${names.size} genera; kept ${ENDINGS.map((e) => `${out[e].length} -${e}`).join(", ")}`);
}
main().catch((e) => (console.error(e), process.exit(1)));
