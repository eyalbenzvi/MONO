import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import full from "@/data/shirts.json";
import index from "@/data/shirts.index.json";
import manifest from "@/data/shirts.index.manifest.json";
import { SHIRTS, CALIBRATION_IDS, checkIndexHead, dedupeByFamily, diversify, getShirtById, shardFile } from "@/lib/catalog";
import { topPicks } from "@/lib/match";
import { rankShirts } from "@/lib/recommendation";
import { productDescription, productTitle } from "@/lib/seo";
import { FEATURE_KEYS, createInitialVector, type CatalogEntry } from "@/types/shirt";
import { WEAK_QUALITY, measurePrint } from "../scripts/gen/quality";
import { SUBJECT_NOUN_CATEGORIES } from "../scripts/gen/subject";
import { TOTAL } from "../scripts/gen/constants";

const FULL = full as unknown as CatalogEntry[];
const byId = new Map(FULL.map((s) => [s.id, s]));

describe("I01: names that say what the print shows", () => {
  it("every design has a subject, and the SEO title reads 'Name — Subject Style Tee | MONO'", () => {
    for (const s of FULL) expect(s.subject.length, s.id).toBeGreaterThan(2);
    const eclipse = FULL.find((s) => s.subject === "Solar Eclipse")!;
    expect(productTitle(eclipse)).toBe(`${eclipse.title} — Solar Eclipse Line-Art Tee | MONO`);
    // The style isn't repeated when the subject already names it.
    const ascii = FULL.find((s) => s.subject.startsWith("ASCII "))!;
    expect(productTitle(ascii)).toBe(`${ascii.title} — ${ascii.subject} Tee | MONO`);
  });

  it("no two meta descriptions are the same, and none carries the stock closing line", () => {
    const metas = FULL.map(productDescription);
    expect(new Set(metas).size).toBe(FULL.length);
    for (const s of FULL) expect(productDescription(s)).not.toContain(s.description.slice(s.summary.length).trim() || "\u0000");
  });

  it("objects, caricatures and iconic images are named after what they show — no filler nouns", () => {
    const FILLER = /\b(Thing|Relic|Item|Object|Artifact|Gadget|Gizmo|Trinket|Thingamajig|Kit|Utensil|Keepsake|Souvenir|Tool|Piece|Suspect|Character|Type|Specimen|Persona|View|Sight|Wonder|Stop|Mark|Moment)$/;
    // (SUBJECT_NOUN_CATEGORIES: the objects' woodcuts and the iconic images that remain.)
    expect(SUBJECT_NOUN_CATEGORIES).toContain("iconic");
    for (const s of FULL.filter((x) => x.variant === "woodcut" || x.variant.startsWith("iconic-"))) {
      expect(s.title, s.id).not.toMatch(FILLER);
    }
    const obj = FULL.find((s) => s.variant === "iconic-landmark")!;
    expect(obj.title.toLowerCase()).toContain(obj.subject.split(" ")[0].toLowerCase().replace(/[^a-z]/g, "") || "");
  });

  it("a name's noun repeats at most 15 times within a kind of print", () => {
    const counts = new Map<string, number>();
    // Generated names only: an archive work keeps its own title ("Harbor", "Twilight").
    for (const s of FULL.filter((x) => !x.variant.startsWith("archive-"))) {
      const key = `${s.variant}|${s.title.split(" ").slice(1).join(" ")}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    expect(Math.max(...counts.values())).toBeLessThanOrEqual(15);
  });
});

describe("F06: print quality", () => {
  it("scores every print; a lone small square is weak (and after the T7 review no weak print is left)", () => {
    for (const s of FULL) expect(s.quality).toBeGreaterThanOrEqual(WEAK_QUALITY);
    const square = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400" width="300" height="400"><rect width="300" height="400" fill="#000000"/><rect x="130" y="180" width="40" height="40" fill="#FFFFFF"/></svg>`;
    const m = measurePrint(square, "black");
    expect(m.quality).toBeLessThan(WEAK_QUALITY);
    expect(m.printCm.width).toBeLessThan(14);
  });

  it("weak prints never rate taste, never lead the shop and never get picked for you", () => {
    for (const id of CALIBRATION_IDS) expect(getShirtById(id)!.weak, id).toBe(false);
    const v = createInitialVector();
    for (const sort of ["popular", "match", "new"] as const) {
      const top = diversify(dedupeByFamily(rankShirts(v, SHIRTS, sort))).slice(0, 96);
      expect(top.some((x) => x.shirt.weak), sort).toBe(false);
    }
    for (const k of FEATURE_KEYS) {
      const lean = createInitialVector();
      lean[k] = 1;
      expect(topPicks(lean, 3).some((s) => s.weak)).toBe(false);
    }
  });

  it("the real print size comes from the ink, within the 28 × 37 cm print area", () => {
    for (const s of FULL) {
      expect(s.printCm.width).toBeGreaterThanOrEqual(1);
      expect(s.printCm.width).toBeLessThanOrEqual(28);
      expect(s.printCm.height).toBeLessThanOrEqual(37);
    }
  });
});

describe("I12: explicit drop dates", () => {
  it("every design carries its own drop date: weekly Mondays, forty a week; the photographs and the new sets dropped together", () => {
    for (const s of FULL) {
      expect(s.dropDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(new Date(`${s.dropDate}T00:00:00Z`).getUTCDay()).toBe(1);
    }
    const perDrop = new Map<string, number>();
    for (const s of FULL.filter((x) => x.n <= TOTAL && !x.photo)) perDrop.set(s.dropDate, (perDrop.get(s.dropDate) ?? 0) + 1);
    expect(Math.max(...perDrop.values())).toBe(40);
    // The week they were added, not spread over invented future weeks.
    expect(new Set(FULL.filter((x) => x.photo || x.n > TOTAL).map((x) => x.dropDate))).toEqual(new Set(["2026-09-21"]));
    expect(SHIRTS[0].dropDate).toBe(Date.parse(`${FULL[0].dropDate}T00:00:00Z`));
  });
});

describe("R21: the index head describes the data", () => {
  it("carries v, keys, shard size and shard hashes; the app refuses a mismatch", () => {
    expect(index.v).toBe(6);
    expect(index.keys).toEqual([...FEATURE_KEYS]);
    expect(index.shards).toHaveLength(Math.ceil(FULL[FULL.length - 1].n / index.shardSize));
    expect(() => checkIndexHead({ v: 5, keys: [...FEATURE_KEYS] })).toThrow(/v5/);
    expect(() => checkIndexHead({ v: 6, keys: [...FEATURE_KEYS].reverse() })).toThrow(/feature keys/);
    // T8: how each print is made, one letter per design.
    expect(index.medium).toMatch(/^[dip]+$/);
    expect(index.medium).toHaveLength(FULL.length);
    expect(() => checkIndexHead(index)).not.toThrow();
  });

  it("shard files (and the published index) are named by their content hash, and nothing else sits in public/data", () => {
    const dir = path.resolve(__dirname, "..", "public", "data");
    const files = readdirSync(dir).sort();
    expect(files).toEqual([...index.shards.map((_, k) => path.basename(shardFile(k))), manifest.file].sort());
    index.shards.forEach((hash, k) => {
      const json = readFileSync(path.join(dir, path.basename(shardFile(k))), "utf8");
      expect(createHash("sha256").update(json).digest("hex").slice(0, 10)).toBe(hash);
    });
  });

  it("ids are unchanged after retiring designs: mono-0001 first, the first sets never above mono-<TOTAL>, the index carries each n", () => {
    expect(FULL[0].id).toBe("mono-0001");
    // The first four sets keep their numbers; the fifth and sixth run on after them.
    expect(FULL.filter((s) => s.variant.startsWith("photo-")).every((s) => s.n > 2800 && s.n <= TOTAL)).toBe(true);
    expect(FULL.filter((s) => s.medium === "ink").every((s) => s.n > TOTAL)).toBe(true);
    expect(index.n).toEqual(FULL.map((s) => s.n));
  });
});
