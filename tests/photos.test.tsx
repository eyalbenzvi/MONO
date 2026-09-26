// @vitest-environment jsdom
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, renderHook } from "@testing-library/react";
import full from "@/data/shirts.json";
import photos from "@/data/photos/photos.json";
import { PrintImage } from "@/components/PrintImage";
import { CALIBRATION_IDS, SHIRTS, getShirtById, needsInvert, printUrl } from "@/lib/catalog";
import { getCalibrationQueue, rankShirts, updateUserVector } from "@/lib/recommendation";
import { productTitle } from "@/lib/seo";
import { archetypeOf, ARCHETYPE_NAMES } from "@/lib/taste";
import { FEATURE_KEYS, createInitialVector, isPhoto, otherColor, type CatalogEntry } from "@/types/shirt";
import { PER_CATEGORY } from "../scripts/gen/constants";
import { EXCLUDE } from "../scripts/photos/curation";
import { PHOTO_CATEGORIES, PRINT_H, PRINT_W, photoOrder, type PhotoSource } from "../scripts/photos/source";

const FULL = full as unknown as CatalogEntry[];
/** The fourth set's photographs (the archive's have their own tests: tests/archive). */
const PHOTO_DESIGNS = FULL.filter((s) => s.variant.startsWith("photo-"));
const PUBLIC = path.resolve(__dirname, "..", "public");

afterEach(cleanup);

describe("photographs: where they come from", () => {
  it("600 CC0 photographs from Smithsonian Open Access, 200 per photo category, each file present", () => {
    expect(photos).toHaveLength(PER_CATEGORY * PHOTO_CATEGORIES.length);
    for (const c of PHOTO_CATEGORIES) expect(photos.filter((p) => p.category === c)).toHaveLength(PER_CATEGORY);
    for (const p of photos) {
      expect(EXCLUDE.has(p.key), p.key).toBe(false);
      expect(p.record).toMatch(/^(nzp|nasm)_/);
    }
    // Each design's print is its photograph, in the fetch tool's order.
    const byN = new Map(FULL.map((s) => [s.n, s]));
    for (const { n, photo } of photoOrder(photos as PhotoSource[], PER_CATEGORY)) {
      const s = byN.get(n);
      if (!s) continue; // retired (T7: one photograph per subject)
      expect(s.photo!.image, s.id).toBe(photo.key);
      expect(s.backPrintUrl).toBe(`/prints/print_${n}.webp`);
      expect(existsSync(path.join(PUBLIC, s.backPrintUrl)), s.backPrintUrl).toBe(true);
    }
  });

  it("every photo design names its photographer or museum and links its museum record", () => {
    expect(PHOTO_DESIGNS.length).toBeGreaterThan(400); // 600 fetched, one per subject kept (T7)
    const byKey = new Map(photos.map((p) => [p.key, p]));
    expect(new Set(PHOTO_DESIGNS.map((s) => s.photo!.image)).size).toBe(PHOTO_DESIGNS.length);
    for (const s of PHOTO_DESIGNS) {
      const src = byKey.get(s.photo!.image!);
      expect(src, s.id).toBeDefined();
      expect(s.photo!.url).toBe(`https://collections.si.edu/search/detail/edanmdm:${src!.record}`);
      expect(s.photo!.credit).toBe(src!.credit);
      expect(s.subject).toBe(src!.subject);
      expect(s.photo!.credit).toMatch(/Smithsonian|FONZ|Zoo|Museum/);
    }
    // Drawn designs carry no photo credit.
    expect(FULL.filter((s) => s.medium === "drawn").every((s) => !s.photo)).toBe(true);
  });

  it("titles are what the picture shows; one photograph per subject (no 'Take 2')", () => {
    for (const s of PHOTO_DESIGNS) {
      expect(s.title.length, s.title).toBeLessThanOrEqual(60);
      expect(s.title, s.id).not.toMatch(/Lindbergh|Earhart|Powell|, Take \d/);
    }
    expect(new Set(PHOTO_DESIGNS.map((s) => s.subject)).size).toBe(PHOTO_DESIGNS.length);
    const seal = PHOTO_DESIGNS.find((s) => s.title === s.subject)!;
    expect(productTitle(seal)).toBe(`${seal.subject} Photo Tee | MONO`);
  });
});

describe("photographs: whole, sharp, greyscale — and never inverted", () => {
  it("each print is the whole photograph: 750 × 1000, greyscale, transparent around the picture, not screened into dots", async () => {
    // Every 20th (30 prints): decoding all 600 is slow.
    for (const s of PHOTO_DESIGNS.filter((_, i) => i % 20 === 0)) {
      const file = path.join(PUBLIC, s.backPrintUrl);
      const img = sharp(file);
      const meta = await img.metadata();
      expect([meta.width, meta.height, meta.hasAlpha], s.id).toEqual([PRINT_W, PRINT_H, true]);
      const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
      let colour = 0, mid = 0, solid = 0;
      for (let i = 0; i < info.width * info.height; i++) {
        const [r, g, b, a] = [data[i * 4], data[i * 4 + 1], data[i * 4 + 2], data[i * 4 + 3]];
        if (a < 250) continue;
        solid++;
        if (Math.max(r, g, b) - Math.min(r, g, b) > 8) colour++;
        if (r > 40 && r < 215) mid++;
      }
      expect(colour / solid, s.id).toBeLessThan(0.01);
      // Continuous tone: plenty of mid-greys (a halftone or line screen is only black and white).
      expect(mid / solid, s.id).toBeGreaterThan(0.2);
    }
  });

  it("the picture is never cut: a photograph keeps its whole frame, and nothing touches the print's edge", () => {
    for (const p of photos as PhotoSource[]) {
      const [x0, y0, x1, y1] = p.box;
      expect(Math.min(x0, y0, 1 - x1, 1 - y1), p.key).toBeGreaterThan(0.02);
      // The long side fills the print area (fitted, not shrunk).
      expect(Math.max(x1 - x0, y1 - y0), p.key).toBeGreaterThan(0.7); // measured on solid alpha: a cut-out's soft edges and thin wires sit inside its 90% box
    }
  });

  it("printUrl / needsInvert: drawn prints flip with CSS; a photograph is the same positive file on both tees", () => {
    const drawn = SHIRTS[0];
    const photo = SHIRTS.find(isPhoto)!;
    const other = otherColor(photo.baseColor);
    expect(printUrl(drawn, otherColor(drawn.baseColor))).toBe(drawn.backPrintUrl);
    expect(needsInvert(drawn, otherColor(drawn.baseColor))).toBe(true);
    expect(printUrl(photo, other)).toBe(photo.backPrintUrl);
    expect(needsInvert(photo, other)).toBe(false);
  });

  it("PrintImage never inverts a photograph; it sits on its tee colour (the only one it's sold in, T3)", () => {
    const photo = SHIRTS.find(isPhoto)!;
    const other = otherColor(photo.baseColor);
    const { container, rerender } = render(<PrintImage shirt={photo} color={other} />);
    const img = container.querySelector("img")!;
    expect(img.getAttribute("src")).toMatch(new RegExp(`/prints/print_${photo.n}\\.webp$`));
    expect(img.className).not.toMatch(/\binvert\b/);
    // Asked for the other colour, it stays on its own (T3).
    expect(img.className).toMatch(photo.baseColor === "black" ? /\bbg-black\b/ : /\bbg-white\b/);
    rerender(<PrintImage shirt={SHIRTS[0]} color={otherColor(SHIRTS[0].baseColor)} />);
    expect(container.querySelector("img")!.className).toMatch(/\binvert\b/);
  });

  it("the share image draws the photograph as it is (no ink swap)", async () => {
    const photo = SHIRTS.find(isPhoto)!;
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    Object.defineProperty(HTMLImageElement.prototype, "decode", { configurable: true, value: () => Promise.resolve() });
    const { loadPrintImage } = await import("@/lib/shareImage");
    const img = (await loadPrintImage(photo, otherColor(photo.baseColor))) as HTMLImageElement;
    expect(img.src).toMatch(new RegExp(`/prints/print_${photo.n}\\.webp$`));
    expect(fetchSpy).not.toHaveBeenCalled();
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
    expect(mean("wildlife", "nature")).toBeGreaterThan(0.7); // measured on solid alpha: a cut-out's soft edges and thin wires sit inside its 90% box
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
    s.toggleSaved("mono-0006");
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
