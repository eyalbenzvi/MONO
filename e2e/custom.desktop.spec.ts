import path from "node:path";
import { expect, test } from "@playwright/test";
import { build } from "esbuild";
import shirts from "../data/shirts.json";
import models from "../data/models/models.json";
import manifest from "../data/custom.manifest.json";

type Entry = { n: number; variant: string; title: string };
type Model = { id: string; color: "black" | "white"; box: [number, number, number, number] };
const ALL = shirts as unknown as Entry[];
/** Every computed design a made-for-you template draws (the canvas is checked on all their prints). */
const COMPUTED = ALL.filter((s) => ["sky-night", "moon-year", "planets-date"].includes(s.variant));
/** The designs the made-for-you tees wear (lib/catalog madeProduct: the first of each variant): their model photos are the ones that ship. */
const WORN = ["sky-night", "moon-year", "planets-date"].map((v) => ALL.find((s) => s.variant === v)!);
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";
/** lib/models modelFor, by the same rule (the test runs outside the app's aliases). */
const modelFor = (n: number, color: "black" | "white") => {
  const list = (models as Model[]).filter((m) => m.color === color);
  return list[(Math.imul(n, 2654435761) >>> 0) % list.length];
};

/** lib/custom's browser code as one script (lib/catalog's assetUrl stood in for). */
async function bundle() {
  const out = await build({
    entryPoints: [path.join(__dirname, "fixtures", "customEntry.ts")],
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
    tsconfig: path.join(__dirname, "..", "tsconfig.json"),
    plugins: [
      {
        name: "catalog",
        setup(b) {
          b.onResolve({ filter: /^@\/lib\/catalog$/ }, () => ({ path: "catalog", namespace: "stub" }));
          b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({ contents: `export const assetUrl = (u) => ${JSON.stringify(BASE_PATH)} + u;`, loader: "js" }));
        },
      },
    ],
  });
  return out.outputFiles[0].text;
}

// A page of the site is the canvas; the CSP is set aside for the test's own script (the app never evaluates one).
test.use({ bypassCSP: true });

test("M4: a personalised print is drawn like the baked pictures (under 2% mean difference, each design a made-for-you tee wears, both colours)", async ({ page }) => {
  await page.goto("about/");
  await page.evaluate(await bundle());
  const results: { n: number; color: string; diff: number }[] = [];
  for (const s of WORN)
    for (const color of ["black", "white"] as const) {
      const m = modelFor(s.n, color);
      const diff = await page.evaluate(
        async ({ n, color, model, base }) => {
          const c = (window as unknown as { __custom: any }).__custom;
          const W = 720;
          const H = Math.round(W / (512 / 704));
          const [photo, baked, svgText] = await Promise.all([c.loadImage(`${base}/models/${model.id}.webp`), c.loadImage(`${base}/img/m/${n}-${color}-${W}.webp`), fetch(`${base}/img/p/${n}-${color}.svg`).then((r) => r.text()), c.loadCanvasFonts()]);
          const a = document.createElement("canvas");
          a.width = W;
          a.height = H;
          c.drawMockup(a.getContext("2d"), W, H, photo, svgText, model.box, color);
          const b = document.createElement("canvas");
          b.width = W;
          b.height = H;
          b.getContext("2d")!.drawImage(baked, 0, 0, W, H);
          const pa = a.getContext("2d")!.getImageData(0, 0, W, H).data;
          const pb = b.getContext("2d")!.getImageData(0, 0, W, H).data;
          let sum = 0;
          for (let i = 0; i < pa.length; i += 4) sum += Math.abs(pa[i] - pb[i]) + Math.abs(pa[i + 1] - pb[i + 1]) + Math.abs(pa[i + 2] - pb[i + 2]);
          return sum / ((pa.length / 4) * 3 * 255);
        },
        { n: s.n, color, model: m, base: BASE_PATH },
      );
      results.push({ n: s.n, color, diff });
    }
  console.log(`parity (mean absolute difference): ${results.map((r) => `${r.n}-${r.color} ${(r.diff * 100).toFixed(2)}%`).join(", ")}`);
  for (const r of results) expect(r.diff, `${r.n} ${r.color}`).toBeLessThan(0.02);
});

test("M4: the canvas draws a print as the browser draws its SVG (the print alone, every sky, moon and planets design, under 2% mean difference)", async ({ page }) => {
  await page.goto("about/");
  await page.evaluate(await bundle());
  const diffs = await page.evaluate(
    async ({ ns, base }) => {
      const c = (window as unknown as { __custom: any }).__custom;
      await c.loadCanvasFonts();
      const css = await c.loadFontCss();
      const out: [number, number, number, number][] = [];
      for (const n of ns) {
        const svg = await fetch(`${base}/img/p/${n}-black.svg`).then((r) => r.text());
        const img = await c.svgImage(c.withFonts(svg, css));
        const [W, H] = [600, 800];
        const a = c.printCanvas(svg, W, H);
        const b = document.createElement("canvas");
        b.width = W;
        b.height = H;
        b.getContext("2d")!.drawImage(img, 0, 0, W, H);
        const pa = a.getContext("2d").getImageData(0, 0, W, H).data;
        const pb = b.getContext("2d")!.getImageData(0, 0, W, H).data;
        let sum = 0;
        let inkA = 0;
        let inkB = 0;
        for (let i = 0; i < pa.length; i += 4) (sum += Math.abs(pa[i] - pb[i])), (inkA += pa[i]), (inkB += pb[i]);
        out.push([n, sum / ((pa.length / 4) * 255), inkA / ((pa.length / 4) * 255), inkB / ((pa.length / 4) * 255)]);
      }
      return out;
    },
    { ns: COMPUTED.map((s) => s.n), base: BASE_PATH },
  );
  console.log(`canvas vs SVG image: ${diffs.map(([n, d, a, b]) => `${n} ${(d * 100).toFixed(2)}% (ink ${(a * 100).toFixed(1)}% / ${(b * 100).toFixed(1)}%)`).join(", ")}`);
  for (const [n, d, a, b] of diffs) {
    expect(d, String(n)).toBeLessThan(0.02);
    // Both drew the print (neither is an empty ground).
    expect(Math.min(a, b), String(n)).toBeGreaterThan(0.01);
  }
});

test("the later products: the canvas draws each example as the browser draws its SVG (both colours, under 2% mean difference)", async ({ page }) => {
  await page.goto("about/");
  await page.evaluate(await bundle());
  const diffs = await page.evaluate(async () => {
    const c = (window as unknown as { __custom: any }).__custom;
    await c.loadCanvasFonts();
    const css = await c.loadFontCss();
    const out: [string, number, number][] = [];
    // The first twelve draw in lib/custom (index) or are checked above; the later ones each in a chunk of their own.
    const early = ["sky", "moon", "night", "planets", "taste", "code", "line", "voice", "house", "number", "place", "ascii"];
    for (const m of c.MADE.filter((m: { template: string }) => !early.includes(m.template)))
      for (const color of ["black", "white"]) {
        const render = await c.loadRenderer(m.template);
        const svg = render(m.example, color, await c.prepareData(m.example));
        const img = await c.svgImage(c.withFonts(svg, css));
        const [W, H] = [600, 800];
        const a = c.printCanvas(svg, W, H);
        const b = document.createElement("canvas");
        b.width = W;
        b.height = H;
        b.getContext("2d")!.drawImage(img, 0, 0, W, H);
        const pa = a.getContext("2d").getImageData(0, 0, W, H).data;
        const pb = b.getContext("2d")!.getImageData(0, 0, W, H).data;
        let sum = 0;
        for (let i = 0; i < pa.length; i += 4) sum += Math.abs(pa[i] - pb[i]);
        let ink = 0;
        for (let i = 0; i < pb.length; i += 4) ink += color === "black" ? pb[i] : 255 - pb[i];
        out.push([`${m.slug}-${color}`, sum / ((pa.length / 4) * 255), ink / ((pb.length / 4) * 255)]);
      }
    return out;
  });
  console.log(`later products, canvas vs SVG image: ${diffs.map(([n, d]) => `${n} ${(d * 100).toFixed(2)}%`).join(", ")}`);
  for (const [n, d, ink] of diffs) {
    expect(d, n).toBeLessThan(0.02);
    // The print was drawn (not an empty ground on both sides).
    expect(ink, n).toBeGreaterThan(0.01);
  }
});

test("M4: a sky print renders (SVG and picture) in well under 100 ms at 4× CPU throttling", async ({ page }) => {
  await page.goto("about/");
  await page.evaluate(await bundle());
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const ms = await page.evaluate(
    async ({ base, skyFile, model }) => {
      const c = (window as unknown as { __custom: any }).__custom;
      const data = { sky: await fetch(`${base}/data/${skyFile}`).then((r) => r.json()), city: { id: 293397, name: "Tel Aviv", ascii: "Tel Aviv", country: "Israel", lat: 32.0809, lon: 34.7806, pop: 432892, tz: "Asia/Jerusalem" } };
      await c.loadCanvasFonts();
      const photo = await c.loadImage(`${base}/models/${model.id}.webp`);
      const times: number[] = [];
      const split: number[] = [];
      for (let i = 0; i < 6; i++) {
        const t = performance.now();
        const svg = c.renderCustomSvg({ t: "sky", v: 1, p: { c: 293397, d: `1991-03-${String(10 + i).padStart(2, "0")}` } }, "black", data);
        split.push(performance.now() - t);
        // The picture as the product page draws it on a phone: 360 CSS px at 3×, the photo and the print in its box.
        const cv = document.createElement("canvas");
        cv.width = 1080;
        cv.height = 1485;
        c.drawMockup(cv.getContext("2d"), 1080, 1485, photo, svg, model.box, "black");
        times.push(performance.now() - t);
      }
      // The first includes warming up; the rest are what a change in the editor costs (median of five).
      const median = (v: number[]) => v.slice(1).sort((a, b) => a - b)[2];
      return { total: median(times), svg: median(split) };
    },
    { base: BASE_PATH, skyFile: manifest.sky, model: modelFor(WORN[0].n, "black") },
  );
  console.log(`sky render at 4× CPU throttling: ${ms.total.toFixed(1)} ms (the SVG ${ms.svg.toFixed(1)} ms, the picture the rest; target ≤ 50)`);
  expect(ms.total).toBeLessThan(100);
});
