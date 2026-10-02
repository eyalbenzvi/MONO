/**
 * The designers' review material for a gated studio run (scripts/studio/briefs/review-designers.md, step 1):
 * every delivered design three ways (the flat print, on its main tee, on the opposite tee, marked when it isn't
 * offered there), as contact sheets of five rows, before anything reaches the shop.
 *
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/studio/reviewSheets.ts <run> <out-dir>
 *
 * Writes <out-dir>/sheet-NN.png and <out-dir>/img/*, and data/studio/<run>/review/designs.json (the review's
 * numbering of the run's folders, with each design's title and family), which approve.ts reads.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { mockup, type Grey } from "../images/bake";
import { modelFor } from "../../lib/models";
import type { BaseColor } from "../../types/shirt";
import type { Listed } from "./approve";
import { gatedTees, type PrintMeasures } from "./publish";

const ROOT = path.resolve(__dirname, "..", "..");
const PUBLIC = path.join(ROOT, "public");

/** The details file's fields (as publish.ts reads them). */
function details(file: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = /^([A-Za-z ]+):\s*(.*)$/.exec(line.trim());
    if (m) out[m[1].trim().toLowerCase()] = m[2].trim();
  }
  return out;
}

/** The print flat on a tee colour at the shop's 1500 × 2000 (bake.ts's flatPrint, from a delivered file). */
async function flat(file: string, color: BaseColor): Promise<Grey> {
  const alpha = sharp(file).ensureAlpha().extractChannel("alpha").resize(1500, 2000, { fit: "fill" });
  const { data, info } = await (color === "black" ? alpha : alpha.negate()).raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

const label = (text: string, w: number, h: number, size: number) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><text x="4" y="${h - 8}" font-family="sans-serif" font-size="${size}" fill="#000">${text.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</text></svg>`);

async function main() {
  const [run, out] = process.argv.slice(2);
  if (!run || !out) throw new Error("usage: reviewSheets.ts <run> <out-dir>");
  const runDir = path.join(ROOT, "data", "studio", run);
  const folders = readdirSync(runDir).filter((d) => /^\d{2}-\d-/.test(d)).sort();
  mkdirSync(path.join(out, "img"), { recursive: true });
  const listed: Listed[] = [];
  const rows: Buffer[] = [];
  const [W, H, CAP] = [300, 412, 34];
  for (const [i, folder] of folders.entries()) {
    const abs = path.join(runDir, folder);
    const files = readdirSync(abs);
    const txt = files.find((f) => f.endsWith(".txt"));
    if (!txt || !existsSync(path.join(abs, "print.json"))) throw new Error(`${folder}: needs its details file and print.json`);
    const slug = txt.replace(/\.txt$/, "");
    const d = details(path.join(abs, txt));
    const measures = JSON.parse(readFileSync(path.join(abs, "print.json"), "utf8")) as PrintMeasures;
    const tees = gatedTees(measures);
    const no = i + 1;
    listed.push({ no, folder, title: d.title ?? slug, family: (d.family ?? "objects").toLowerCase() });
    const file = path.join(abs, files.includes(`${slug}.png`) ? `${slug}.png` : `${slug}-white.png`);
    const cells: { img: Buffer; cap: string }[] = [];
    const flatWhite = await flat(file, "white");
    cells.push({ img: await sharp(flatWhite.data, { raw: { width: 1500, height: 2000, channels: 1 } }).resize(W, H).png().toBuffer(), cap: "the print (ink as black)" });
    const other: BaseColor = tees.baseColor === "black" ? "white" : "black";
    for (const color of [tees.baseColor, other]) {
      const model = modelFor({ n: 90000 + no }, color)!;
      const buf = readFileSync(path.join(PUBLIC, "models", `${model.id}.webp`));
      const photo = { ...(await sharp(buf).metadata()), buf };
      const img = await mockup(color, await flat(file, color), 720, photo, model.box);
      writeFileSync(path.join(out, "img", `${no}-${color}.webp`), img);
      const tag = color === tees.baseColor ? "main tee" : tees.single ? "NOT offered (shown for review)" : "also offered";
      cells.push({ img: await sharp(img).resize(W, H, { fit: "inside", background: "#e9e9e9" }).png().toBuffer(), cap: `${color} tee: ${tag}` });
    }
    const composite = [
      { input: label(`#${no}  ${d.title ?? slug}  (${folder}, ${listed[i].family})`, 3 * W + 40, 36, 20), left: 0, top: 0 },
      ...cells.flatMap((c, k) => [
        { input: c.img, left: 10 + k * (W + 10), top: 40 },
        { input: label(c.cap, W, CAP, 14), left: 10 + k * (W + 10), top: 40 + H },
      ]),
    ];
    rows.push(await sharp({ create: { width: 3 * W + 40, height: 40 + H + CAP, channels: 3, background: "#e9e9e9" } }).composite(composite).png().toBuffer());
  }
  for (let p = 0; p < rows.length; p += 5) {
    const chunk = rows.slice(p, p + 5);
    const h = 40 + H + CAP;
    await sharp({ create: { width: 3 * W + 40, height: h * chunk.length, channels: 3, background: "#fff" } })
      .composite(chunk.map((input, k) => ({ input, left: 0, top: k * h })))
      .png()
      .toFile(path.join(out, `sheet-${String(p / 5 + 1).padStart(2, "0")}.png`));
  }
  mkdirSync(path.join(runDir, "review"), { recursive: true });
  writeFileSync(path.join(runDir, "review", "designs.json"), `${JSON.stringify(listed, null, 1)}\n`);
  console.log(`${run}: ${folders.length} designs → ${Math.ceil(rows.length / 5)} sheets in ${out}; data/studio/${run}/review/designs.json`);
}

if (require.main === module) void main();
