import { expect, it } from "vitest";
import { productSuite } from "./productSuite";
import { BORDERS, BORDER_TILES, MOTIFS, MOTIF_GRIDS } from "@/lib/custom/draw/sampler";
import { SAMPLER_NAME_MAX, SAMPLER_WORDS_MAX, wordRows } from "@/lib/custom/specs/sampler";

const W = (n: number) => "W".repeat(n);
const fuzz: Record<string, unknown>[] = [];
BORDERS.forEach((b, i) => {
  fuzz.push({ n: "A", b, mo: [MOTIFS[i]] });
  fuzz.push({ n: [W(SAMPLER_NAME_MAX), "Maya", "Jean-Luc", "Noa O.", "WWWWWWW"][i % 5], y: 1900 + i * 40, w: ["Home is where the tea is", "WWWWWWWWWWWWW WWWWWWWWWWWW", "Be kind", "1 2 3"][i % 4], b, mo: [MOTIFS[(i + 1) % 8], MOTIFS[(i + 3) % 8], MOTIFS[(i + 5) % 8]].slice(0, 1 + (i % 3)) });
});
MOTIFS.forEach((m, i) => fuzz.push({ n: "Maya", b: BORDERS[i % 6], mo: [m, MOTIFS[(i + 4) % 8]] }));

productSuite({
  slug: "sampler",
  refuse: [
    {}, { n: "Maya", b: "diamonds" }, { n: "Maya", b: "lace", mo: ["tree"] }, { n: "Maya", b: "diamonds", mo: [] }, { n: "Maya", b: "diamonds", mo: ["tree", "tree", "tree", "tree"] }, { n: "Maya", b: "diamonds", mo: ["cat"] },
    { n: "Zoë", b: "diamonds", mo: ["tree"] }, { n: W(SAMPLER_NAME_MAX + 1), b: "diamonds", mo: ["tree"] }, { n: "Maya", w: "WWWWWWWWWWWWWW", b: "diamonds", mo: ["tree"] }, { n: "Maya", w: "a b c d e f g h i j k l m n", b: "diamonds", mo: ["tree"] }, { n: "Maya", y: 1899, b: "diamonds", mo: ["tree"] },
  ],
  longest: { n: W(SAMPLER_NAME_MAX), y: 2100, w: "WWWWWWWWWWWWW WWWWWWWWWWWW", b: "diamonds", mo: ["crown", "ship", "flower"] },
  fuzz,
});

it("the patterns are well formed: tiles three rows deep, motifs eleven square", () => {
  for (const b of BORDERS) expect(BORDER_TILES[b].length, b).toBe(3), expect(new Set(BORDER_TILES[b].map((r) => r.length)).size, b).toBe(1);
  for (const m of MOTIFS) expect(MOTIF_GRIDS[m].length, m).toBe(11), MOTIF_GRIDS[m].forEach((r) => expect(r.length, m).toBe(11));
  expect(wordRows("Home is where the tea is")).toEqual(["HOME IS WHERE", "THE TEA IS"]);
  expect(wordRows(`${W(SAMPLER_WORDS_MAX)}`)).toBeNull();
});
