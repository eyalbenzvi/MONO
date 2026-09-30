import { describe, expect, it } from "vitest";
import { productSuite } from "./productSuite";
import { PASSPORT_MAX, PASSPORT_NAME_MAX, type Stamp } from "@/lib/custom/specs/passport";
import { COUNTRY_CODES } from "@/lib/custom/specs/countries";
import { layout } from "@/lib/custom/templates/passport";
import { countries } from "./render";
import { mulberry32 } from "../../scripts/gen/core";

const W = (n: number) => "W".repeat(n);
const rnd = mulberry32(0x9a55);
const pick = () => COUNTRY_CODES[Math.floor(rnd() * COUNTRY_CODES.length)];
const longName = [...countries.list].filter((c) => (COUNTRY_CODES as readonly string[]).includes(c.a3)).sort((a, b) => b.name.length - a.name.length).map((c) => c.a3);
const day = () => `${1950 + Math.floor(rnd() * 75)}-${String(1 + Math.floor(rnd() * 12)).padStart(2, "0")}-${String(1 + Math.floor(rnd() * 28)).padStart(2, "0")}`;
const fuzz: Record<string, unknown>[] = [
  { n: "Al", x: [["GBR"]] },
  { n: W(PASSPORT_NAME_MAX), x: longName.slice(0, PASSPORT_MAX).map((c) => [c, "2100-12-31", 1]) },
  { n: "Noa", x: [["FRA", 0, 1], ["FRA", 0, 1], ["FRA"]] },
];
for (let i = 0; i < 30; i++) {
  fuzz.push({
    n: ["Noa Cohen", "Dan", "Jean-Luc O'Neill"][i % 3],
    x: Array.from({ length: 1 + Math.floor(rnd() * PASSPORT_MAX) }, () => {
      const r = rnd();
      return r < 0.2 ? [pick()] : r < 0.5 ? [pick(), day(), 1] : r < 0.6 ? [pick(), 0, 1] : [pick(), day()];
    }),
  });
}

productSuite({
  slug: "passport",
  refuse: [
    {}, { x: [["GBR"]] }, { n: "Al", x: [] }, { n: "Al", x: Array.from({ length: PASSPORT_MAX + 1 }, () => ["GBR"]) }, { n: "Al", x: [["gbr"]] }, { n: "Al", x: [["XYZ"]] },
    { n: "Al", x: [["GBR", "2019-13-01"]] }, { n: "Al", x: [["GBR", 0]] }, { n: "Al", x: [["GBR", "2019-01-01", 2]] }, { n: "Al", x: [["GBR", "2019-01-01", 1, 1]] }, { n: W(PASSPORT_NAME_MAX + 1), x: [["GBR"]] },
  ],
  longest: { n: "Ã".repeat(PASSPORT_NAME_MAX), x: Array.from({ length: PASSPORT_MAX }, () => ["GBR", "2026-12-31", 1]) },
  // Ten stamps, each a country, a full day and the train: 410 at their longest, over the 300 a product keeps to.
  // A stamp without its day isn't one worth the shirt, and ten is a page; so the bound is 460 (with the caption's 160, still inside the 1,200 ?make= reads).
  linkMax: 460,
  fuzz,
});

describe("passport layout", () => {
  it("never lays a stamp over another, nor off the page", () => {
    for (const f of fuzz) {
      const placed = layout(f.x as Stamp[]);
      for (const [i, a] of placed.entries()) {
        expect(a.cx - a.r).toBeGreaterThanOrEqual(28);
        expect(a.cx + a.r).toBeLessThanOrEqual(272);
        expect(a.cy - a.r).toBeGreaterThanOrEqual(66);
        expect(a.cy + a.r).toBeLessThanOrEqual(298);
        for (const b of placed.slice(i + 1)) expect(Math.hypot(a.cx - b.cx, a.cy - b.cy)).toBeGreaterThanOrEqual(a.r + b.r);
      }
    }
  });
  it("is seeded by the list: the same stamps land in the same places, another list elsewhere", () => {
    const x: Stamp[] = [["GBR"], ["FRA", "2019-01-01"]];
    expect(layout(x)).toEqual(layout(JSON.parse(JSON.stringify(x))));
    expect(layout(x)).not.toEqual(layout([["GBR"], ["FRA", "2019-01-02"]]));
  });
});
