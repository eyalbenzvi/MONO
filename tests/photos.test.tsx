// @vitest-environment jsdom
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, renderHook } from "@testing-library/react";
import full from "@/data/shirts.json";
import photos from "@/data/photos/photos.json";
import { PrintImage } from "@/components/PrintImage";
import { CALIBRATION_IDS, SHIRTS, getShirtById, needsInvert, printUrl } from "@/lib/catalog";
import { getCalibrationQueue, rankShirts, updateUserVector } from "@/lib/recommendation";
import { productTitle } from "@/lib/seo";
import { archetypeOf, ARCHETYPE_NAMES } from "@/lib/taste";
import { FEATURE_KEYS, PHOTO_CATEGORIES, createInitialVector, isPhoto, otherColor, type BaseColor, type CatalogEntry } from "@/types/shirt";
import { PER_CATEGORY } from "../scripts/gen/constants";
import { EXCLUDE } from "../scripts/photos/curation";
import { REGION, loadPhoto } from "../scripts/gen/photo";

const FULL = full as unknown as CatalogEntry[];
const PHOTO_DESIGNS = FULL.filter((s) => s.photo);
const PUBLIC = path.resolve(__dirname, "..", "public");
const file = (s: CatalogEntry, c: BaseColor) => path.join(PUBLIC, printUrl(getShirtById(s.id)!, c));

afterEach(cleanup);

/** Render width and cell size (px) for comparing prints: a cell spans 20 print units, several screen dots. */
const RW = 150;
const CELL = 10;
/** How the print looks, 0 (dark) – 1 (light), averaged per cell (the pixel is what you see, ink or tee). */
function appearance(svg: string): number[] {
  const img = new Resvg(svg, { fitTo: { mode: "width", value: RW } }).render();
  const px = img.pixels; // a copy per access: read once
  const out: number[] = [];
  for (let y = 0; y + CELL <= img.height; y += CELL)
    for (let x = 0; x + CELL <= img.width; x += CELL) {
      let s = 0;
      for (let dy = 0; dy < CELL; dy++) for (let dx = 0; dx < CELL; dx++) s += px[((y + dy) * img.width + x + dx) * 4];
      out.push(s / CELL / CELL / 255);
    }
  return out;
}
const corr = (a: number[], b: number[]) => {
  const n = a.length;
  const ma = a.reduce((x, y) => x + y) / n;
  const mb = b.reduce((x, y) => x + y) / n;
  let sab = 0, sa = 0, sb = 0;
  for (let i = 0; i < n; i++) (sab += (a[i] - ma) * (b[i] - mb)), (sa += (a[i] - ma) ** 2), (sb += (b[i] - mb) ** 2);
  return sab / Math.sqrt(sa * sb);
};

describe("photographs: where they come from", () => {
  it("600 CC0 photographs from Smithsonian Open Access, 200 per photo category, each file present", () => {
    expect(photos).toHaveLength(PER_CATEGORY * PHOTO_CATEGORIES.length);
    for (const c of PHOTO_CATEGORIES) expect(photos.filter((p) => p.category === c)).toHaveLength(PER_CATEGORY);
    for (const p of photos) {
      expect(existsSync(path.resolve(__dirname, "..", "data", "photos", "img", `${p.key}.png`)), p.key).toBe(true);
      expect(EXCLUDE.has(p.key), p.key).toBe(false);
      expect(p.record).toMatch(/^(nzp|nasm)_/);
    }
  });

  it("every photo design names its photographer or museum and links its museum record", () => {
    expect(PHOTO_DESIGNS).toHaveLength(600);
    const byKey = new Map(photos.map((p) => [p.key, p]));
    expect(new Set(PHOTO_DESIGNS.map((s) => s.photo!.image)).size).toBe(600);
    for (const s of PHOTO_DESIGNS) {
      const src = byKey.get(s.photo!.image!);
      expect(src, s.id).toBeDefined();
      expect(s.photo!.url).toBe(`https://collections.si.edu/search/detail/edanmdm:${src!.record}`);
      expect(s.photo!.credit).toBe(src!.credit);
      expect(s.subject).toBe(src!.subject);
      expect(s.photo!.credit).toMatch(/Smithsonian|FONZ|Zoo|Museum/);
    }
    // Drawn designs carry no photo credit.
    expect(FULL.filter((s) => !isPhoto(s)).every((s) => !s.photo)).toBe(true);
  });

  it("titles are what the picture shows; a second photograph of a subject is its second take", () => {
    for (const s of PHOTO_DESIGNS) {
      expect(s.title.length, s.title).toBeLessThanOrEqual(60);
      expect(s.title, s.id).not.toMatch(/Lindbergh|Earhart|Powell/);
    }
    const takes = PHOTO_DESIGNS.filter((s) => / Take 2$/.test(s.title));
    expect(takes.length).toBeGreaterThan(10);
    for (const t of takes) expect(PHOTO_DESIGNS.find((s) => s.title === t.title.replace(/, Take 2$/, ""))?.subject).toBe(t.subject);
    const seal = PHOTO_DESIGNS.find((s) => s.title === s.subject)!;
    expect(productTitle(seal)).toBe(`${seal.subject} Photo Tee | MONO`);
  });
});

describe("photographs: the other colour is a positive, not a negative (invert)", () => {
  it("each photo design has a print per tee colour, strictly two-tone and small", () => {
    for (const s of PHOTO_DESIGNS) {
      for (const c of ["black", "white"] as const) {
        const f = file(s, c);
        expect(existsSync(f), f).toBe(true);
        expect(statSync(f).size).toBeLessThan(80 * 1024);
        const svg = readFileSync(f, "utf8");
        expect(svg).toContain(`fill="${c === "black" ? "#000000" : "#FFFFFF"}"`);
        for (const hex of new Set(svg.match(/#[0-9A-Fa-f]{6}\b/g))) expect(["#000000", "#FFFFFF"]).toContain(hex.toUpperCase());
      }
    }
  });

  it("both colourways look like the same picture; a CSS invert would look like its negative", () => {
    // Every 10th photograph (60), rendered as seen on its tee and compared
    // inside the picture (where the photograph's own mask is solid — not
    // the bare tee around a cut-out object, which is just the tee colour).
    const seen: number[] = [];
    let compared = 0;
    for (const s of PHOTO_DESIGNS.filter((_, i) => i % 10 === 0)) {
      const other = otherColor(s.baseColor);
      const a = appearance(readFileSync(file(s, s.baseColor), "utf8"));
      const b = appearance(readFileSync(file(s, other), "utf8"));
      const ph = loadPhoto(path.resolve(__dirname, "..", "data", "photos", "img", `${s.photo!.image}.png`));
      // Cell k's centre in print units (300-unit print rendered RW px wide).
      const cols = Math.floor(RW / CELL);
      const unit = 300 / RW;
      const inside = a.map((_, k) => {
        const x = ((k % cols) * CELL + CELL / 2) * unit;
        const y = (Math.floor(k / cols) * CELL + CELL / 2) * unit;
        // The whole cell (and a little around it) must be picture, not tee.
        const half = (CELL * unit) / 2 + 2;
        for (let yy = y - half; yy <= y + half; yy += 1)
          for (let xx = x - half; xx <= x + half; xx += 1) {
            const u = Math.floor(((xx - REGION.x) / REGION.w) * ph.w);
            const v = Math.floor(((yy - REGION.y) / REGION.h) * ph.h);
            if (u < 0 || v < 0 || u >= ph.w || v >= ph.h || ph.alpha[v * ph.w + u] < 0.95) return false;
          }
        return true;
      });
      const pa = a.filter((_, k) => inside[k]);
      const pb = b.filter((_, k) => inside[k]);
      // A thin or flat cut-out leaves too little solid, varied picture to compare.
      const sd = (l: number[]) => Math.sqrt(l.reduce((x, v) => x + (v - l.reduce((p, q) => p + q) / l.length) ** 2, 0) / l.length);
      if (pa.length < 20 || sd(pa) < 0.08) continue;
      compared++;
      // Screened at different angles and gammas the match is loose, but always positive;
      // the inverted print always goes the other way.
      expect(corr(pa, pb), s.id).toBeGreaterThan(0.2);
      expect(corr(pa.map((v) => 1 - v), pb), s.id).toBeLessThan(-0.2);
      seen.push(corr(pa, pb));
    }
    expect(compared).toBeGreaterThan(30);
    // And on the whole, clearly the same picture.
    expect(seen.reduce((x, y) => x + y) / seen.length).toBeGreaterThan(0.6);
  });

  it("printUrl / needsInvert: drawn prints flip with CSS, photographs switch file", () => {
    const drawn = SHIRTS[0];
    const photo = SHIRTS.find(isPhoto)!;
    const other = otherColor(photo.baseColor);
    expect(printUrl(drawn, otherColor(drawn.baseColor))).toBe(drawn.backPrintUrl);
    expect(needsInvert(drawn, otherColor(drawn.baseColor))).toBe(true);
    expect(printUrl(photo, other)).toBe(`/prints/print_${photo.n}_${other}.svg`);
    expect(printUrl(photo, photo.baseColor)).toBe(photo.backPrintUrl);
    expect(needsInvert(photo, other)).toBe(false);
  });

  it("PrintImage shows a photograph's other colour from its own file, without the invert class", () => {
    const photo = SHIRTS.find(isPhoto)!;
    const other = otherColor(photo.baseColor);
    const { container, rerender } = render(<PrintImage shirt={photo} color={other} />);
    const img = container.querySelector("img")!;
    expect(img.getAttribute("src")).toMatch(new RegExp(`/prints/print_${photo.n}_${other}\\.svg$`));
    expect(img.className).not.toMatch(/\binvert\b/);
    rerender(<PrintImage shirt={SHIRTS[0]} color={otherColor(SHIRTS[0].baseColor)} />);
    expect(container.querySelector("img")!.className).toMatch(/\binvert\b/);
  });

  it("the share image fetches the photograph's own file and doesn't swap its inks", async () => {
    const photo = SHIRTS.find(isPhoto)!;
    const other = otherColor(photo.baseColor);
    const svg = readFileSync(path.join(PUBLIC, printUrl(photo, other)), "utf8");
    const fetched: string[] = [];
    let blobText = "";
    vi.stubGlobal("fetch", vi.fn(async (u: string) => (fetched.push(u), new Response(svg))));
    const RealBlob = Blob;
    vi.stubGlobal("Blob", class extends RealBlob {
      constructor(parts: BlobPart[], opts?: BlobPropertyBag) {
        super(parts, opts);
        blobText = String(parts[0]);
      }
    });
    Object.assign(URL, { createObjectURL: () => "blob:x", revokeObjectURL: () => {} });
    Object.defineProperty(HTMLImageElement.prototype, "decode", { configurable: true, value: () => Promise.resolve() });
    const { loadPrintImage } = await import("@/lib/shareImage");
    await loadPrintImage(photo, other);
    expect(fetched[0]).toMatch(new RegExp(`print_${photo.n}_${other}\\.svg$`));
    expect(blobText.replace('width="900" height="1200"', 'width="300" height="400"')).toBe(svg);
    vi.unstubAllGlobals();
  });
});

describe("photographs: tagging and measuring taste", () => {
  it("a 'photographic' dimension: high on every photograph, zero on every drawing", () => {
    expect(FEATURE_KEYS).toContain("photographic");
    for (const s of SHIRTS) {
      if (isPhoto(s)) expect(s.features.photographic, s.id).toBeGreaterThanOrEqual(0.9);
      else expect(s.features.photographic, s.id).toBe(0);
    }
    // Subject features follow the category: animals are nature, engines industrial.
    const mean = (c: string, k: keyof (typeof SHIRTS)[number]["features"]) => {
      const l = SHIRTS.filter((s) => s.category === c);
      return l.reduce((a, s) => a + s.features[k], 0) / l.length;
    };
    expect(mean("wildlife", "nature")).toBeGreaterThan(0.8);
    expect(mean("machines", "dark_industrial")).toBeGreaterThan(mean("wildlife", "dark_industrial"));
  });

  it("the taste test always rates at least one photograph", () => {
    expect(CALIBRATION_IDS.some((id) => isPhoto(getShirtById(id)!))).toBe(true);
    // Guaranteed, not luck: with photographs that would otherwise lose, one still gets in.
    const pool = SHIRTS.filter((s) => !s.weak).slice(0, 60);
    const photo = SHIRTS.find((s) => isPhoto(s) && !s.weak)!;
    const q = getCalibrationQueue([...pool, photo], 10, undefined, isPhoto);
    expect(q).toHaveLength(10);
    expect(q.some(isPhoto)).toBe(true);
  });

  it("liking photographs moves the profile towards them, and the shop follows", () => {
    let v = createInitialVector();
    for (const s of SHIRTS.filter(isPhoto).slice(0, 8)) v = updateUserVector(v, s.features, "like");
    for (const s of SHIRTS.filter((x) => !isPhoto(x)).slice(0, 4)) v = updateUserVector(v, s.features, "dislike");
    expect(v.photographic).toBeGreaterThan(0.7);
    const top = rankShirts(v, SHIRTS, "match").slice(0, 24);
    expect(top.filter((r) => isPhoto(r.shirt)).length).toBeGreaterThanOrEqual(20);
    expect(archetypeOf({ ...createInitialVector(0.5), photographic: 0.95 }).name).toBe("The Documentarian");
    expect(ARCHETYPE_NAMES).not.toContain("The Photographer"); // a caricature's name
  });
});

describe("taste store v4: the new dimension, for people who already have a profile", () => {
  beforeEach(() => localStorage.clear());

  it("migrates v3 → v4 with the photo lean at neutral and everything else kept", async () => {
    const v3 = { ...Object.fromEntries(FEATURE_KEYS.filter((k) => k !== "photographic").map((k) => [k, 0.5])), wit: 0.9, geometric: 0.2 };
    localStorage.setItem("mono-taste", JSON.stringify({ state: { likedIds: ["mono-0001"], preferenceVector: v3, calibrationAcknowledged: true, onboardingSeen: true }, version: 3 }));
    vi.resetModules();
    const { useTasteStore } = await import("@/store/tasteStore");
    await useTasteStore.persist.rehydrate();
    const s = useTasteStore.getState();
    expect(s.preferenceVector).toEqual({ ...v3, photographic: 0.5 });
    expect(s.likedIds).toEqual(["mono-0001"]);
    s.toggleSaved("mono-0002");
    expect(JSON.parse(localStorage.getItem("mono-taste")!).version).toBe(4);
  });

  it("someone who finished the taste test before the photographs isn't sent back into it; the photos are dealt next", async () => {
    vi.resetModules();
    const { useTasteStore, useCalibrationProgress } = await import("@/store/tasteStore");
    // Everything in today's taste test seen except the photographs.
    const seen = CALIBRATION_IDS.filter((id) => !isPhoto(getShirtById(id)!));
    act(() => useTasteStore.setState({ seen, calibrationAcknowledged: true, deck: [] }));
    const { result } = renderHook(() => useCalibrationProgress());
    expect(result.current.done).toBeLessThan(result.current.total);
    expect(result.current.complete).toBe(true);
    act(() => useTasteStore.getState().fillDeck());
    expect(isPhoto(getShirtById(useTasteStore.getState().deck[0].id)!)).toBe(true);
  });
});
