import { describe, expect, it } from "vitest";
import { productSuite } from "./productSuite";
import { FRONTPAGE_COPY, HEADLINES, HEADLINE_MAX, PAPER_NAME_MAX, STANDFIRST_MAX, headlineFit } from "@/lib/custom/specs/frontpage";
import { render } from "@/lib/custom/templates/frontpage";
import { validate } from "@/lib/custom/spec";
import { mulberry32 } from "../../scripts/gen/core";

const W = (n: number) => "W".repeat(n);
const rnd = mulberry32(0xf00d);
const words = ["Local", "man", "finds", "keys", "in", "the", "fridge", "again", "woman", "wins", "the", "raffle", "twice", "dog", "declines", "bath", "nobody", "surprised"];
const phrase = (max: number) => {
  let s = "";
  for (;;) {
    const w = words[Math.floor(rnd() * words.length)];
    if ((s ? `${s} ${w}` : w).length > max) return s;
    s = s ? `${s} ${w}` : w;
    if (rnd() < 0.08) return s;
  }
};
const fuzz: Record<string, unknown>[] = [
  { n: "Al", h: "Yes" },
  { n: W(PAPER_NAME_MAX), h: `${W(15)} ${W(15)} ${W(16)}`, s: "Neighbours consulted, found to be mostly fine about it. Cake described as adequate. Party ran late, very lat.", d: "2100-12-31" },
  ...HEADLINES.map((h, i) => ({ n: ["Noa", "Dan", "Grandad"][i % 3], h })),
];
for (let i = 0; i < 24; i++) fuzz.push({ n: ["Noa", "Dan", "Jean-Luc"][i % 3], h: phrase(HEADLINE_MAX) || "Yes", ...(i % 2 ? { s: phrase(STANDFIRST_MAX) || "Fine." } : {}), ...(i % 3 ? { d: "2019-06-02" } : {}) });

productSuite({
  slug: "frontpage",
  refuse: [{}, { n: "Al" }, { h: "Yes" }, { n: W(PAPER_NAME_MAX + 1), h: "Yes" }, { n: "Al", h: W(HEADLINE_MAX + 1) }, { n: "Al", h: W(40) }, { n: "Al", h: "Yes", s: W(STANDFIRST_MAX + 1) }, { n: "Al", h: "Yes", d: "2019-02-30" }],
  longest: { n: "Ã".repeat(PAPER_NAME_MAX), h: "ÃÃÃÃÃ ".repeat(8).trim(), s: "ÃÃÃÃ ".repeat(22).trim(), d: "2026-12-31" },
  // The name, a 48-character headline and a 110-character standfirst, all in two-byte letters (the worst case, 500): a front page is its words.
  linkMax: 540,
  fuzz,
});

describe("frontpage copy", () => {
  it("our copy is short paragraphs in the house voice: no paragraph over 130 characters, the name in some", () => {
    expect(FRONTPAGE_COPY).toHaveLength(30);
    for (const p of FRONTPAGE_COPY) expect(p.length).toBeLessThanOrEqual(130);
    expect(FRONTPAGE_COPY.filter((p) => p.includes("{n}")).length).toBeGreaterThanOrEqual(6);
  });
  it("every headline of ours fits", () => {
    for (const h of HEADLINES) expect(headlineFit(h), h).not.toBeNull();
  });
  it("prints the name where the copy asks for it, and always ends on page two", () => {
    const svg = render(validate({ t: "frontpage", v: 1, p: { n: "Zed", h: "Yes" } })!, "black");
    expect(svg).toContain("Zed");
    expect(svg).toContain("be quite good.");
    expect(svg).not.toContain("{n}");
  });
});
