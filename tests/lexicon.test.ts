import { describe, expect, it } from "vitest";
import { canonicalWords, refusal, wordsProblem, REFUSAL_LINE } from "@/lib/custom/lexicon";

describe("the words lexicon: every spelling trick lands on the same letters", () => {
  it("case and accents", () => {
    expect(refusal("NIKE")).toBe("brand");
    expect(refusal("Nïké")).toBe("brand");
    expect(refusal("Hermès")).toBe("brand");
  });
  it("leetspeak (0→o, 1→i, 3→e, 4→a, 5→s, 7→t, @→a, $→s)", () => {
    expect(refusal("n1k3")).toBe("brand");
    expect(refusal("4did4$")).toBe("brand");
    expect(refusal("@dida5")).toBe("brand");
    expect(refusal("r0l3x")).toBe("brand");
    expect(refusal("s7arbucks")).toBe("brand");
  });
  it("look-alike Cyrillic and Greek letters", () => {
    expect(refusal("nіkе")).toBe("brand"); // Cyrillic і and е
    expect(refusal("ԁіоr")).toBe("brand"); // Cyrillic ԁ, і, о
    expect(refusal("ρrαdα")).toBe("brand"); // Greek ρ, α
  });
  it("letters spaced or dotted apart", () => {
    expect(refusal("n i k e")).toBe("brand");
    expect(refusal("n.i.k.e")).toBe("brand");
    expect(refusal("N-I-K-E")).toBe("brand");
    expect(refusal("g u c c i")).toBe("brand");
  });
  it("repeated letters", () => {
    expect(refusal("niiiiike")).toBe("brand");
    expect(refusal("guuuccci")).toBe("brand");
  });
  it("reversed text", () => {
    expect(refusal("ekin")).toBe("brand");
    expect(refusal("ssenrednaw ekin")).toBe("brand");
  });
  it("phrases on consecutive words, and joined", () => {
    expect(refusal("Coca Cola forever")).toBe("brand");
    expect(refusal("cocacola")).toBe("brand");
    expect(refusal("i love star wars")).toBe("brand");
  });
  it("an odd split still meets the name when the whole text is it", () => {
    expect(refusal("NI KE")).toBe("brand");
  });
  it("whole words only: everyday words that contain a name stay printable", () => {
    for (const ok of ["Diorama", "Our wedding day", "The night we met", "Noa, welcome", "Sunrise over the bay", "Legoland memories", "Nikel street"]) expect(refusal(ok), ok).toBeNull();
    expect(refusal("")).toBeNull();
    expect(refusal("   ")).toBeNull();
  });
  it("slurs and hate codes are refused, and outrank a brand", () => {
    expect(refusal("1488")).toBe("refused");
    expect(refusal("h e i l  h i t l e r")).toBe("refused");
    expect(refusal("nike 1488")).toBe("refused");
    expect(refusal("S1EG HE1L")).toBe("refused");
  });
  it("says so in one line", () => {
    expect(wordsProblem("nike")).toBe(REFUSAL_LINE.brand);
    expect(wordsProblem("1488")).toBe(REFUSAL_LINE.refused);
    expect(wordsProblem("The year we moved")).toBeNull();
    expect(REFUSAL_LINE).toEqual({ brand: "Those words name a brand.", refused: "We don’t print that." });
  });
  it("canonical words: split, joined runs of singles, repeats collapsed", () => {
    expect(canonicalWords("N.I.K.E  Air!!")).toEqual(["nike", "air"]);
    expect(canonicalWords("Heeello   wörld")).toEqual(["helo", "world"]);
  });
});
