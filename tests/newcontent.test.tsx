// @vitest-environment jsdom
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import full from "@/data/shirts.json";
import archive from "@/data/archive/archive.json";
import stars from "@/data/sky/stars.json";
import { PrintImage } from "@/components/PrintImage";
import { SHIRTS, needsInvert, printUrl } from "@/lib/catalog";
import { productTitle } from "@/lib/seo";
import { type CatalogEntry } from "@/types/shirt";
import { TOTAL } from "../scripts/gen/constants";
import { ARCHIVE_FIRST_N, ARCHIVE_GROUPS, ARCHIVE_H, ARCHIVE_W, type ArchiveSource } from "../scripts/archive/source";
import { EXCLUDE, PER_GROUP, archiveOrder } from "../scripts/archive/curation";
import { set5Designs } from "../scripts/gen/set5";

const FULL = full as unknown as CatalogEntry[];
const SOURCES = archive as unknown as ArchiveSource[];
const PUBLIC = path.resolve(__dirname, "..", "public");
const ARCHIVE_DESIGNS = FULL.filter((s) => s.variant.startsWith("archive-"));

afterEach(cleanup);

describe("T8: the fifth set — generated from real data and maths", () => {
  it("star charts are the real sky: every constellation figure is drawn on stars from the catalogue, named in Latin and English", () => {
    const sky = FULL.filter((s) => s.variant.startsWith("sky-"));
    expect(sky.length).toBeGreaterThan(40);
    expect((stars as number[][]).length).toBeGreaterThan(2000);
    const orion = sky.find((s) => s.title === "Orion, the Hunter")!;
    expect(orion).toBeDefined();
    expect(orion.subject).toBe("Orion Constellation");
    expect(productTitle(orion)).toContain("Orion");
    // Corrected names: the Great Bear (not "Big Dipper"), and Serpens' head and tail apart.
    const names = set5Designs().map((d) => d.title);
    expect(names).toContain("Ursa Major, the Great Bear");
    expect(names.some((t) => t.includes("Big Dipper"))).toBe(false);
    // Orion's print carries its coordinates: RA 5h, Dec near the equator.
    const svg = readFileSync(path.join(PUBLIC, orion.backPrintUrl), "utf8");
    expect(svg).toMatch(/RA 05h \d\dm · Dec [+−]0\d°/);
  });

  it("every fifth-set design is a strong, drawn, two-tone print (the faint ones were left out)", () => {
    const fifth = FULL.filter((s) => s.n > TOTAL && s.n < ARCHIVE_FIRST_N);
    expect(fifth.length).toBeGreaterThan(300);
    for (const s of fifth) {
      expect(s.medium).toBe("drawn");
      expect(existsSync(path.join(PUBLIC, s.backPrintUrl)), s.id).toBe(true);
    }
    expect(new Set(fifth.map((s) => s.category))).toEqual(new Set(["landscapes", "abstract", "botanical", "ornament"]));
  });
});

describe("T8: the archive — public-domain works from Smithsonian Open Access", () => {
  it("each archive design is one committed source, in the fetch tool's order, its print present", () => {
    expect(ARCHIVE_DESIGNS.length).toBe(SOURCES.length);
    const byN = new Map(FULL.map((s) => [s.n, s]));
    for (const { n, source } of archiveOrder(SOURCES)) {
      const s = byN.get(n)!;
      expect(s, String(n)).toBeDefined();
      expect(s.photo!.image).toBe(source.key);
      expect(s.variant).toBe(`archive-${source.group}`);
      expect(s.photo!.url).toBe(`https://collections.si.edu/search/detail/edanmdm:${source.record}`);
      expect(existsSync(path.join(PUBLIC, s.backPrintUrl)), s.backPrintUrl).toBe(true);
      expect(EXCLUDE.has(source.key)).toBe(false);
    }
    for (const g of Object.keys(ARCHIVE_GROUPS) as (keyof typeof ARCHIVE_GROUPS)[]) expect(SOURCES.filter((a) => a.group === g).length, g).toBeLessThanOrEqual(PER_GROUP[g]);
  });

  it("credits name the artist or photographer where the record does, and always the museum", () => {
    for (const s of ARCHIVE_DESIGNS) {
      expect(s.photo!.credit, s.id).toMatch(/Smithsonian|Museum|Archives|Gallery|Cooper Hewitt/);
      expect(s.title.length, s.id).toBeLessThanOrEqual(60);
    }
  });

  it("ink prints are the original's marks as one ink; photographs are greyscale — every picture whole on its print", async () => {
    for (const s of ARCHIVE_DESIGNS.filter((_, i) => i % 40 === 0)) {
      const img = sharp(path.join(PUBLIC, s.backPrintUrl));
      const meta = await img.metadata();
      expect([meta.width, meta.height, meta.hasAlpha], s.id).toEqual([ARCHIVE_W, ARCHIVE_H, true]);
      if (s.medium === "ink") {
        // Black ink: every visible pixel is black; the ink's strength is its alpha.
        const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
        let off = 0;
        for (let i = 0; i < info.width * info.height; i++) if (data[i * 4 + 3] > 0 && data[i * 4] > 8) off++;
        expect(off, s.id).toBe(0);
      }
    }
    for (const a of SOURCES) {
      const [x0, y0, x1, y1] = a.box;
      expect(Math.min(x0, y0, 1 - x1, 1 - y1), a.key).toBeGreaterThanOrEqual(0.02);
    }
  });
});

describe("T8: ink prints turn for a black tee; photographs never do", () => {
  it("needsInvert: an ink print is inverted (to white ink) on a black tee, never on a white one", () => {
    const ink = SHIRTS.find((s) => s.medium === "ink")!;
    expect(ink.backPrintUrl).toMatch(/\.webp$/);
    expect(printUrl(ink, "black")).toBe(ink.backPrintUrl);
    expect(needsInvert(ink, "black")).toBe(true);
    expect(needsInvert(ink, "white")).toBe(false);
  });

  it("PrintImage: an inverted ink print sits on a white ground, which the invert turns black like the tee", () => {
    const ink = SHIRTS.find((s) => s.medium === "ink")!;
    const { container, rerender } = render(<PrintImage shirt={ink} color="black" />);
    let cls = container.querySelector("img")!.className;
    expect(cls).toMatch(/\binvert\b/);
    expect(cls).toMatch(/\bbg-white\b/);
    rerender(<PrintImage shirt={ink} color="white" />);
    cls = container.querySelector("img")!.className;
    expect(cls).not.toMatch(/\binvert\b/);
    expect(cls).toMatch(/\bbg-white\b/);
    // A drawn SVG brings its own ground.
    const drawn = SHIRTS.find((s) => s.medium === "drawn")!;
    rerender(<PrintImage shirt={drawn} color={drawn.baseColor} />);
    expect(container.querySelector("img")!.className).not.toMatch(/\bbg-(black|white)\b/);
  });
});
