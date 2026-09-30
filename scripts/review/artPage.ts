/**
 * The owner's review page for a Make print's artwork (scripts/sources/makeArt.ts):
 * each picture as it prints (the tracing on its tee), the scanned page it came
 * from beside it, its source, licence and record, and the numbers (outlines,
 * points, size, the checks on both tees). Keep / reject / maybe and Export,
 * as every selection page (scripts/review/reviewPage.ts).
 *
 *   tsx scripts/review/artPage.ts <set>        dinosaurs | landmarks
 *
 * Writes node_modules/.cache/mono-review/art-<set>/index.html and its pages (never committed).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { artSvg, type ArtFile } from "../../lib/custom/art";
import { cacheDir } from "../sources/_pipeline";
import { writeHub } from "./hubPage";
import { OUT, inkThumb, originalThumb, writePages, type ReviewItem } from "./reviewPage";

const ROOT = path.resolve(__dirname, "..", "..");

interface Row {
  id: string;
  name?: string;
  error?: string;
  source?: { title: string; author: string; year: number; plate: string; record: string; ia: string; page: number };
  licenseLabel?: string;
  turned?: number;
  traced?: { rings: number; points: number };
  bytes?: number;
  checks?: { color: string; quality: number; flags: string[]; solid: unknown }[];
  passes?: boolean;
}

async function main() {
  const set = process.argv[2];
  const rows = JSON.parse(readFileSync(path.join(ROOT, "data", "art", `${set}.json`), "utf8")) as Row[];
  const dir = path.join(OUT, `art-${set}`);
  mkdirSync(dir, { recursive: true });
  const items: ReviewItem[] = [];
  for (const r of rows) {
    if (r.error || !r.source) continue;
    const art = JSON.parse(readFileSync(path.join(ROOT, "data", "art", set, `${r.id}.json`), "utf8")) as ArtFile;
    const svgFile = path.join(dir, `${r.id}.svg`);
    writeFileSync(svgFile, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400" width="300" height="400"><rect width="300" height="400" fill="#000"/>${artSvg(art, 20, 40, 260, 320)}</svg>`);
    items.push({
      id: r.id,
      title: r.name ?? r.id,
      maker: r.source.author,
      date: String(r.source.year),
      source: `${r.source.title} (${r.source.plate})`,
      license: r.licenseLabel ?? "",
      recordUrl: r.source.record,
      tee: "black",
      print: await inkThumb(svgFile, "drawn", "black"),
      original: await originalThumb(path.join(cacheDir("archiveorg"), "art", "clean", `${r.id}.jpg`)),
      numbers: [["outlines", r.traced?.rings ?? 0], ["points", r.traced?.points ?? 0], ["KB", Math.round((r.bytes ?? 0) / 1024)], ["quality (alone)", (r.checks ?? []).map((c) => c.quality).join(" / ")], ["page", r.source.page], ["turned", `${r.turned ?? 0}°`]],
      flags: [...new Set((r.checks ?? []).flatMap((c) => [...c.flags, ...(c.solid ? ["solid"] : [])]))],
      note: r.passes ? "passes the checks alone" : "under the line alone (the print's frame and words carry it)",
    });
  }
  const pages = writePages(path.join(dir, set), { title: `Make artwork: ${set}`, heading: `Make artwork: ${set}`, storageKey: `mono-art-${set}`, note: `Every ${set === "dinosaurs" ? "skeleton plate" : "drawing"} as it prints, traced from the scanned page beside it. The numbers are the scripts'; the pictures are yours to judge.` }, items);
  writeHub(dir, `Make artwork: ${set}`, `${items.length} pictures, public domain, each with its source and record.`);
  console.log(`${items.length} pictures on ${pages.length} page(s): ${path.relative(ROOT, path.join(dir, "index.html"))}`);
}
main().catch((e) => (console.error(e), process.exit(1)));
