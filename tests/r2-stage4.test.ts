import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import full from "@/data/shirts.json";
import index from "@/data/shirts.index.json";
import { SHIRTS, CALIBRATION_IDS, checkIndexHead, dedupeByFamily, diversify, getShirtById, shardFile } from "@/lib/catalog";
import { topPicks } from "@/lib/match";
import { rankShirts } from "@/lib/recommendation";
import { productDescription, productTitle } from "@/lib/seo";
import { FEATURE_KEYS, SHIRT_CATEGORIES, createInitialVector, type CatalogEntry } from "@/types/shirt";
import { WEAK_QUALITY } from "../scripts/gen/quality";
import { SUBJECT_NOUN_CATEGORIES } from "../scripts/gen/subject";

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
    for (const s of FULL.filter((x) => SUBJECT_NOUN_CATEGORIES.includes(x.category))) {
      expect(s.title, s.id).not.toMatch(FILLER);
    }
    expect(byId.get("mono-1010")!.title.toLowerCase()).toContain(byId.get("mono-1010")!.subject.split(" ")[0].toLowerCase().replace(/[^a-z]/g, "") || "");
  });

  it("a name's noun repeats at most 15 times within a category", () => {
    const counts = new Map<string, number>();
    for (const s of FULL) {
      const key = `${s.category}|${s.title.split(" ").slice(1).join(" ")}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    expect(Math.max(...counts.values())).toBeLessThanOrEqual(15);
  });
});

describe("F06: print quality", () => {
  it("scores every print; a lone small square is weak", () => {
    for (const s of FULL) expect(s.quality).toBeGreaterThanOrEqual(0);
    const kinetic = FULL.find((s) => s.title === "Kinetic Unit")!;
    expect(kinetic.quality).toBeLessThan(WEAK_QUALITY);
    expect(getShirtById(kinetic.id)!.weak).toBe(true);
    const weak = FULL.filter((s) => s.quality < WEAK_QUALITY).length;
    expect(weak).toBeGreaterThan(5);
    expect(weak).toBeLessThan(FULL.length * 0.05);
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
    expect(FULL.find((s) => s.title === "Kinetic Unit")!.printCm.width).toBeLessThan(14);
  });
});

describe("I12: explicit drop dates", () => {
  it("every design carries its own drop date: weekly Mondays, forty a week", () => {
    for (const s of FULL) {
      expect(s.dropDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(new Date(`${s.dropDate}T00:00:00Z`).getUTCDay()).toBe(1);
    }
    const perDrop = new Map<string, number>();
    for (const s of FULL) perDrop.set(s.dropDate, (perDrop.get(s.dropDate) ?? 0) + 1);
    expect(Math.max(...perDrop.values())).toBe(40);
    expect(SHIRTS[0].dropDate).toBe(Date.parse(`${FULL[0].dropDate}T00:00:00Z`));
  });
});

describe("R21: the index head describes the data", () => {
  it("carries v, keys, shard size and shard hashes; the app refuses a mismatch", () => {
    expect(index.v).toBe(3);
    expect(index.keys).toEqual([...FEATURE_KEYS]);
    expect(index.shards).toHaveLength(Math.ceil(FULL.length / index.shardSize));
    expect(() => checkIndexHead({ v: 2, keys: [...FEATURE_KEYS] })).toThrow(/v2/);
    expect(() => checkIndexHead({ v: 3, keys: [...FEATURE_KEYS].reverse() })).toThrow(/feature keys/);
    expect(() => checkIndexHead(index)).not.toThrow();
  });

  it("shard files are named by their content hash, and nothing else sits in public/data", () => {
    const dir = path.resolve(__dirname, "..", "public", "data");
    const files = readdirSync(dir).sort();
    expect(files).toEqual(index.shards.map((_, k) => path.basename(shardFile(k))).sort());
    index.shards.forEach((hash, k) => {
      const json = readFileSync(path.join(dir, path.basename(shardFile(k))), "utf8");
      expect(createHash("sha256").update(json).digest("hex").slice(0, 10)).toBe(hash);
    });
  });

  it("categories stay 14 × 200 (ids mono-0001…mono-2800 unchanged)", () => {
    for (const c of SHIRT_CATEGORIES) expect(FULL.filter((s) => s.category === c)).toHaveLength(200);
    expect(FULL[0].id).toBe("mono-0001");
    expect(FULL[FULL.length - 1].id).toBe("mono-2800");
  });
});
