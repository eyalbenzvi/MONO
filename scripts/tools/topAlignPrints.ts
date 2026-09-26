/**
 * Every picture print starts at the top of its print area (T2 feedback: a
 * wide picture centred in the 3:4 area sat lower on the tee than a tall one,
 * so prints looked unevenly placed). Moves each WebP print's picture up to a
 * TOP margin and updates its box in data/photos and data/archive. Idempotent.
 *
 *   npx tsx scripts/tools/topAlignPrints.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

export const TOP = 0.03;
const ROOT = path.resolve(__dirname, "..", "..");
const catalog: { n: number; photo?: { image?: string }; backPrintUrl: string }[] = JSON.parse(readFileSync(path.join(ROOT, "data", "shirts.json"), "utf8"));
const byKey = new Map(catalog.filter((s) => s.photo?.image && s.backPrintUrl.endsWith(".webp")).map((s) => [s.photo!.image!, s]));

async function run(file: string) {
  const list: { key: string; box: [number, number, number, number] }[] = JSON.parse(readFileSync(file, "utf8"));
  let moved = 0;
  for (const p of list) {
    const s = byKey.get(p.key);
    const [x0, y0, x1, y1] = p.box;
    if (!s || y0 <= TOP + 0.001) continue;
    const f = path.join(ROOT, "public", s.backPrintUrl);
    const img = sharp(f);
    const { width: W, height: H } = await img.metadata();
    const top = Math.round(y0 * H!), h = Math.round((y1 - y0) * H!), to = Math.round(TOP * H!);
    const { data } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const out = Buffer.alloc(data.length); // transparent
    data.copy(out, to * W! * 4, top * W! * 4, (top + h) * W! * 4);
    // Back to grey + alpha (as written by the fetch tools).
    const la = Buffer.alloc(W! * H! * 2);
    for (let i = 0; i < W! * H!; i++) (la[i * 2] = out[i * 4]), (la[i * 2 + 1] = out[i * 4 + 3]);
    const flat = la.every((v, i) => i % 2 === 1 || v === 0);
    writeFileSync(f, await sharp(la, { raw: { width: W!, height: H!, channels: 2 } }).webp(flat ? { quality: 50, alphaQuality: 50, effort: 6 } : { quality: 80, alphaQuality: 90, effort: 6 }).toBuffer());
    p.box = [x0, TOP, x1, Math.round((TOP + (y1 - y0)) * 1000) / 1000];
    moved++;
  }
  writeFileSync(file, `[\n${list.map((c) => JSON.stringify(c)).join(",\n")}\n]\n`);
  console.log(path.relative(ROOT, file), moved, "moved up");
}

(async () => {
  await run(path.join(ROOT, "data", "photos", "photos.json"));
  await run(path.join(ROOT, "data", "archive", "archive.json"));
})();
