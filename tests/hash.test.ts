import { describe, expect, it } from "vitest";
import { wordsSeed } from "@/lib/custom/draw/crossword";
import { specHash, validate } from "@/lib/custom/spec";
import { fnv1aChars, fnv1aCodePoints, fnv1aUnits } from "@/lib/hash";
import { hash01 } from "@/lib/recommendation";
import { idsHash } from "@/lib/search/format";

// Pinned from the ten copies these replaced: kept values (bag line keys, print seeds, the search index check) must never move.
describe("hashes: the same values as before, byte for byte", () => {
  it("the three FNV-1a readings", () => {
    expect(["ASCII", "Noa 😀 é", ""].map(fnv1aUnits)).toEqual([3164024976, 1609097545, 2166136261]);
    expect(["ASCII", "Noa 😀 é", ""].map(fnv1aChars)).toEqual([3164024976, 4095323573, 2166136261]);
    expect(["ASCII", "Noa 😀 é", ""].map(fnv1aCodePoints)).toEqual([3164024976, 1101849510, 2166136261]);
  });
  it("their callers", () => {
    expect(["ASCII", "Noa 😀 é", ""].map((s) => idsHash([s, "x"]))).toEqual(["48b3f164", "9ab7d785", "51cfa8c9"]);
    expect(["ASCII", "Noa 😀 é", ""].map(hash01)).toEqual([0.7366819716989994, 0.37464721710421145, 0.5043428998906165]);
    expect(["ASCII", "Noa 😀 é", ""].map((s) => wordsSeed([s, "y"]))).toEqual([1100440651, 996922946, 1489315442]);
    expect(specHash(validate({ t: "moon", v: 1, p: { y: 1991, w: "Noa" } })!)).toBe("1ekwti7");
  });
});
