import { describe, expect, it } from "vitest";
import { SHIRTS } from "@/lib/catalog";
import { closest, distance } from "@/lib/search/fuzzy";
import { clean, stem, terms, words } from "@/lib/search/normalize";
import { parseQuery } from "@/lib/search/parse";
import { humanizeId, sourceOf } from "@/lib/search/labels";
import { realIndex } from "./searchFixture";

describe("search: normalizing text (shared by the index and the query)", () => {
  it("folds case, accents and apostrophes; punctuation is a space", () => {
    expect(clean("Mont-Saint-Michel, À L'Aube")).toBe("mont saint michel a laube");
    expect(clean("Gág's Café")).toBe("gags cafe");
    expect(words("D'Amalia’s  prints!")).toEqual(["damalias", "prints"]);
  });

  it("folds British spelling to American, and light plurals and -ing", () => {
    expect(terms("colours")).toEqual(terms("colors"));
    expect(terms("grey centre")).toEqual(terms("gray center"));
    expect(stem("realise")).toBe(stem("realize"));
    expect(stem("waves")).toBe(stem("wave"));
    expect(stem("butterflies")).toBe("butterfly");
    expect(stem("boxes")).toBe("box");
    expect(stem("drawing")).toBe("draw");
    expect(stem("glass")).toBe("glass");
    expect(stem("cactus")).toBe("cactus");
    expect(stem("iris")).toBe("iris");
    expect(stem("string")).toBe("string");
  });

  it("drops stopwords from terms, but keeps them for phrases like \"on black\"", () => {
    expect(terms("a tee with the wave on it")).toEqual(["wave", "it"]);
    expect(words("on black")).toEqual(["on", "black"]);
    const { index } = realIndex();
    const q = parseQuery("wave on black ", index, SHIRTS);
    expect(q.suggestions.some((s) => s.facet.kind === "tee" && s.facet.value === "black")).toBe(true);
  });
});

describe("search: typos", () => {
  it("counts a swap of neighbours as one edit, and stops early past the bound", () => {
    expect(distance("lighthouse", "lihgthouse", 2)).toBe(1);
    expect(distance("wave", "wavy", 1)).toBe(1);
    expect(distance("wave", "cactus", 1)).toBe(2);
  });

  it("allows no edits under 4 letters, one up to 7, two from 8", () => {
    const vocab = ["cat", "bird", "birds", "harmonograph"];
    const df = [1, 1, 1, 1];
    expect(closest("cot", vocab, df)).toEqual([]);
    expect(closest("brid", vocab, df)[0]).toEqual({ at: 1, dist: 1 });
    expect(closest("hramongraph", vocab, df)[0]).toEqual({ at: 3, dist: 2 });
  });

  it("a typo in a lexicon word still suggests its chip", () => {
    const { index } = realIndex();
    const q = parseQuery("photgraph ", index, SHIRTS);
    expect(q.suggestions.some((s) => s.facet.kind === "medium" && s.facet.value === "photo")).toBe(true);
  });
});

describe("search: labels", () => {
  it("humanizes an id without a label, and normalizes truncated museum credits", () => {
    expect(humanizeId("archive-etching")).toBe("Etching");
    expect(humanizeId("brick-bond")).toBe("Brick bond");
    expect(sourceOf("Roshan Patel, Smithsonian's National Zoo")?.id).toBe("zoo");
    expect(sourceOf("Someone, Smithsonian's Nati")?.id).toBe("zoo");
    expect(sourceOf("National Air and Space Museum, Smithsonian Institution")?.id).toBe("air-space");
    expect(sourceOf("Mehg")).toBeNull();
  });
});
