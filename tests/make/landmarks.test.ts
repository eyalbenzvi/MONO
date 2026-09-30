import { describe, expect, it } from "vitest";
import { FORBIDDEN, productSuite } from "./productSuite";
import { gate } from "./fuzz";
import { JOURNAL_NAME_MAX, LANDMARKS, LANDMARKS_MAX, LANDMARKS_MIN, LANDMARK_IDS, LANDMARK_PLACES, REGIONS, check, shownLandmarks } from "@/lib/custom/specs/landmarks";
import { gridOf, landmarksBody } from "@/lib/custom/templates/landmarks";
import { landmarkBox, landmarkSvg } from "@/lib/custom/draw/landmarks";
import { wrap } from "@/lib/custom/svg";
import { rect } from "@/lib/custom/kit";
import { mulberry32 } from "../../scripts/gen/core";

const W = (n: number) => "W".repeat(n);
/** Nine of the longest ids (the longest link). */
const LONGEST_IDS = ["neuschwanstein", "machupicchu", "sydneyopera", "westernwall", "empirestate", "brandenburg", "burjkhalifa", "towerbridge", "itsukushima"];
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
  longest: { n: "Ã".repeat(JOURNAL_NAME_MAX), x: LONGEST_IDS.map((id) => [id, 2026]) },
  // Nine landmarks by their longest ids, each with its year, and the name in two-byte letters (the worst case, 350): the page is its list.
  linkMax: 380,
  fuzz,
});

describe("landmarks: the list", () => {
  it("fifty landmarks, each with its name, its region and where it is; the longest case has nine of the longest ids", () => {
    expect(LANDMARK_IDS).toHaveLength(50);
    expect(new Set(Object.values(LANDMARKS)).size).toBe(50);
    for (const id of LANDMARK_IDS) {
      const [region, where] = LANDMARK_PLACES[id];
      expect(REGIONS, id).toContain(region);
      expect(where.length, id).toBeGreaterThan(2);
      // A typographic apostrophe in the names the print sets.
      expect(LANDMARKS[id], id).not.toMatch(/'/);
    }
    for (const r of REGIONS) expect(LANDMARK_IDS.some((id) => LANDMARK_PLACES[id][0] === r), r).toBe(true);
    const lens = LANDMARK_IDS.map((id) => id.length).sort((a, b) => b - a).slice(0, LANDMARKS_MAX);
    expect(lens.reduce((a, b) => a + b)).toBe(LONGEST_IDS.join("").length);
  });
  it("the picker shows every landmark once across its regions, and its filter finds one by name or place, accents and apostrophes aside", () => {
    expect(shownLandmarks("All", "")).toEqual(LANDMARK_IDS);
    expect(REGIONS.flatMap((r) => shownLandmarks(r, "")).sort()).toEqual([...LANDMARK_IDS].sort());
    expect(shownLandmarks("All", "chichen")).toEqual(["chichenitza"]);
    expect(shownLandmarks("All", "st peter's")).toEqual(["stpeters"]);
    expect(shownLandmarks("All", "  JAPAN ")).toEqual(["fuji", "kinkakuji", "itsukushima"]);
    expect(shownLandmarks("Europe", "paris")).toEqual(["eiffel", "arc"]);
    expect(shownLandmarks("Asia", "paris")).toEqual([]);
    for (const id of LANDMARK_IDS) expect(shownLandmarks(LANDMARK_PLACES[id][0], LANDMARKS[id]), id).toContain(id);
  });
});

describe("landmarks: the drawings", () => {
  it("every landmark draws: line work only, the same every time, inside its box", () => {
    for (const id of LANDMARK_IDS) {
      const a = landmarkSvg(id, 10, 20, 67, 53);
      expect(a.length, id).toBeGreaterThan(500);
      expect(landmarkSvg(id, 10, 20, 67, 53), id).toBe(a);
      expect(a, id).not.toMatch(FORBIDDEN);
      expect(a, id).not.toMatch(/transform=|<text|<image/);
      // Every coordinate inside the box it was given (strokes aside).
      const nums = [...a.matchAll(/ d="([^"]*)"/g)].flatMap((m) => m[1].match(/-?\d*\.?\d+/g)!.map(Number));
      expect(Math.min(...nums), id).toBeGreaterThanOrEqual(0);
      expect(Math.max(...nums), id).toBeLessThanOrEqual(77.01);
      const { w, h } = landmarkBox(id);
      expect(Math.max(w, h), id).toBeGreaterThanOrEqual(96);
    }
  });
  it("the fine detail goes when a drawing is small, and the strokes stay printable", () => {
    for (const id of LANDMARK_IDS) {
      const small = landmarkSvg(id, 0, 0, 40, 30), big = landmarkSvg(id, 0, 0, 110, 100);
      expect(small.split("<path").length, id).toBeLessThanOrEqual(big.split("<path").length);
      for (const m of [...small.matchAll(/stroke-width="([\d.]+)"/g), ...big.matchAll(/stroke-width="([\d.]+)"/g)]) expect(Number(m[1]), id).toBeGreaterThanOrEqual(0.5);
    }
  });
  it("every landmark alone, in a frame on the page, passes the gate in both colours, as does a page of them (the fuzz above: each one in a full grid)", () => {
    for (const id of LANDMARK_IDS)
      for (const color of ["black", "white"] as const) expect(gate(wrap(rect(40, 60, 220, 240, 1.4) + landmarkSvg(id, 52, 72, 196, 216), color), color), `${id} on ${color}`).toBeNull();
  });
  it("every landmark leads a three-up page (its largest tile) and closes a nine-up one (its smallest), and the page passes the gate", () => {
    const others = (id: string, n: number) => LANDMARK_IDS.filter((o) => o !== id).slice(0, n);
    for (const id of LANDMARK_IDS)
      for (const x of [[id, ...others(id, 2)], [...others(id, 8), id]]) {
        const p = check({ n: "Noa", x: x.map((v, i) => [v, 2000 + i]) }, {} as never)!;
        expect(p, id).not.toBeNull();
        const body = landmarksBody(p);
        expect(body, id).toContain(LANDMARKS[id].toUpperCase().slice(0, 6));
        const color = x.length === 3 ? "black" : "white";
        expect(gate(wrap(body, color), color), `${id} in ${x.length}`).toBeNull();
      }
  });
  it("the grid keeps every frame on the page, three across", () => {
    for (let n = LANDMARKS_MIN; n <= LANDMARKS_MAX; n++) for (const t of gridOf(n)) {
      // Inside the page (x 22–278, y 28–324) with its margin, above the foot line.
      expect(t.x).toBeGreaterThanOrEqual(30);
      expect(t.x + t.w).toBeLessThanOrEqual(270.01);
      expect(t.y).toBeGreaterThanOrEqual(37);
      expect(t.y + t.h).toBeLessThanOrEqual(295.01);
    }
  });
});
