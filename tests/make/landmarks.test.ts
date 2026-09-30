import { describe, expect, it } from "vitest";
import { productSuite } from "./productSuite";
import { JOURNAL_NAME_MAX, LANDMARKS_MAX, LANDMARKS_MIN, LANDMARK_IDS } from "@/lib/custom/specs/landmarks";
import { gridOf } from "@/lib/custom/templates/landmarks";
import { ART } from "./render";
import art from "../../data/art/landmarks.json";
import { mulberry32 } from "../../scripts/gen/core";

const W = (n: number) => "W".repeat(n);
const rnd = mulberry32(0x1a4d);
const some = (n: number) => [...LANDMARK_IDS].sort(() => rnd() - 0.5).slice(0, n);
const fuzz: Record<string, unknown>[] = [
  { x: LANDMARK_IDS.slice(0, LANDMARKS_MIN).map((id) => [id]) },
  { n: W(JOURNAL_NAME_MAX), x: LANDMARK_IDS.slice(0, LANDMARKS_MAX).map((id) => [id, 2100]) },
  // Every landmark in a full grid, in threes.
  ...Array.from({ length: Math.ceil(LANDMARK_IDS.length / LANDMARKS_MAX) }, (_, k) => ({ n: "Noa", x: LANDMARK_IDS.slice(k * LANDMARKS_MAX, (k + 1) * LANDMARKS_MAX).concat(LANDMARK_IDS.slice(0, Math.max(0, LANDMARKS_MIN - (LANDMARK_IDS.length - k * LANDMARKS_MAX)))).map((id, i) => [id, 2000 + i]) })),
];
for (let i = 0; i < 18; i++) fuzz.push({ ...(i % 2 ? { n: "Noa" } : {}), x: some(LANDMARKS_MIN + Math.floor(rnd() * (LANDMARKS_MAX - LANDMARKS_MIN + 1))).map((id) => (rnd() < 0.7 ? [id, 1990 + Math.floor(rnd() * 36)] : [id])) });

productSuite({
  slug: "landmarks",
  refuse: [
    {}, { x: [["eiffel"], ["pisa"]] }, { x: LANDMARK_IDS.slice(0, LANDMARKS_MAX + 1).map((id) => [id]) }, { x: [["eiffel"], ["pisa"], ["atlantis"]] }, { x: [["eiffel"], ["pisa"], ["pisa"]] },
    { x: [["eiffel", 1800], ["pisa"], ["petra"]] }, { n: W(JOURNAL_NAME_MAX + 1), x: [["eiffel"], ["pisa"], ["petra"]] }, { x: [["eiffel", 2000, 1], ["pisa"], ["petra"]] },
  ],
  longest: { n: "Ã".repeat(JOURNAL_NAME_MAX), x: ["neuschwanstein", "machupicchu", "sydneyopera", "westernwall", "empirestate", "brandenburg", "burjkhalifa", "towerbridge", "goldengate"].map((id) => [id, 2026]) },
  // Nine landmarks by their longest ids, each with its year, and the name in two-byte letters (the worst case, 348): the page is its list.
  linkMax: 380,
  fuzz,
});

describe("landmarks: the drawings", () => {
  it("every landmark has its drawing, public domain or CC0, with its Commons record", () => {
    const rows = art as { id: string; license?: string; error?: string; source?: { record: string } }[];
    for (const id of LANDMARK_IDS) {
      const r = rows.find((x) => x.id === id);
      expect(r?.error, id).toBeUndefined();
      expect(["PD", "PDM", "CC0", "US-Gov"], id).toContain(r!.license);
      expect(r!.source!.record, id).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
      expect(ART[`landmarks/${id}`], id).toBeDefined();
    }
  });
  it("every drawing passes the checks alone, in its frame (measured as it was made, scripts/sources/makeArt.ts), and in the grid (the fuzz above: each one in a full page)", () => {
    for (const r of art as { id: string; passes?: boolean; checks?: { quality: number }[] }[]) {
      expect(r.passes, r.id).toBe(true);
      expect(Math.min(...r.checks!.map((c) => c.quality)), r.id).toBeGreaterThanOrEqual(53);
    }
  });
  it("the grid keeps every frame on the page, three across", () => {
    for (let n = LANDMARKS_MIN; n <= LANDMARKS_MAX; n++) for (const t of gridOf(n)) {
      expect(t.x).toBeGreaterThanOrEqual(24);
      expect(t.x + t.w).toBeLessThanOrEqual(276.01);
      expect(t.y).toBeGreaterThanOrEqual(30);
      expect(t.y + t.h).toBeLessThanOrEqual(292.01);
    }
  });
});
