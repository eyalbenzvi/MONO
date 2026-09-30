import { describe, expect, it } from "vitest";
import { SHIRTS } from "@/lib/catalog";
import { closest, distance } from "@/lib/search/fuzzy";
import { clean, stem, terms, words } from "@/lib/search/normalize";
import { parseQuery } from "@/lib/search/parse";
import { LABEL_WORDS, VARIANT_LABELS, humanizeId, labelCase, sourceOf, titleCase, typographic } from "@/lib/search/labels";
import { LEXICON } from "@/lib/search/lexicon";
import { subjectChips } from "@/lib/search/runtime";
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
    expect(terms("a tee with the wave on it")).toEqual(["wave"]);
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

describe("search: label case", () => {
  it("writes acronyms in capitals", () => {
    expect(labelCase("nasa")).toBe("NASA");
    expect(labelCase("nyc")).toBe("NYC");
    expect(labelCase("ascii art")).toBe("ASCII art");
    expect(labelCase("led display")).toBe("LED display");
    expect(humanizeId("ibm-card")).toBe("IBM card");
    // Only whole words: "ledger", "nasal" and "us" are left alone.
    expect(labelCase("ledger")).toBe("Ledger");
    expect(labelCase("nasal")).toBe("Nasal");
    expect(labelCase("for us")).toBe("For us");
  });

  it("title-cases places, keeping particles lower-case", () => {
    expect(labelCase("new york")).toBe("New York");
    expect(labelCase("new england")).toBe("New England");
    expect(labelCase("old new york harbor")).toBe("Old New York harbor");
    expect(labelCase("new")).toBe("New");
    expect(labelCase("newest")).toBe("Newest");
    expect(titleCase("rio de janeiro")).toBe("Rio de Janeiro");
    expect(titleCase("stratford upon avon")).toBe("Stratford upon Avon");
    expect(titleCase("isle of man")).toBe("Isle of Man");
    expect(titleCase("la paz")).toBe("La Paz");
    expect(titleCase("new york nyc")).toBe("New York NYC");
  });

  it("uses typographic apostrophes", () => {
    expect(typographic("Halley's orbit")).toBe("Halley’s orbit");
    expect(typographic("Henri L'Evêque")).toBe("Henri L’Evêque");
    expect(typographic("the Wrights' flyer")).toBe("the Wrights’ flyer");
    expect(labelCase("jupiter's moons")).toBe("Jupiter’s moons");
    for (const label of Object.values(VARIANT_LABELS)) expect(label).not.toContain("'");
  });

  it("every label the index and the runtime produce is cased right", () => {
    const { file, index } = realIndex();
    const labels = [...Object.values(file.tables).flatMap((t) => t.map((e) => e.label)), ...subjectChips(index, SHIRTS).map((s) => s.label), ...LEXICON.flatMap((e) => e.phrases).map(labelCase)];
    for (const label of labels) {
      expect(label, label).not.toContain("'");
      expect(label, label).not.toMatch(/^\p{Ll}/u);
      for (const w of label.split(/[^\p{L}\p{N}]+/u)) if (LABEL_WORDS[w.toLowerCase()]) expect(w, label).toBe(LABEL_WORDS[w.toLowerCase()]);
      expect(label, label).not.toMatch(/\bNew (york|england)\b/);
    }
    const subjects = subjectChips(index, SHIRTS).map((s) => s.label);
    expect(subjects).toEqual(expect.arrayContaining(["NASA", "New York", "New England"]));
    expect(file.tables.style.map((e) => e.label)).toEqual(expect.arrayContaining(["Line art", "ASCII art", "Star chart"]));
    expect(file.tables.variant.find((e) => e.id === "orbit-halley")?.label).toBe("Halley’s orbit");
  });
});
