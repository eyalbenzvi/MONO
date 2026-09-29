import { describe, expect, it } from "vitest";
import { carry } from "@/lib/custom/carry";
import { madeBySlug, type MadeProduct } from "@/lib/custom/products";

const m = (s: string) => madeBySlug(s) as MadeProduct;

describe("carrying a print's input to its siblings", () => {
  it("a night's date and words go to the other date products; the year to the Year of Moons", () => {
    const sky = { t: "sky", v: 1, p: { c: 293397, d: "1991-03-14", w: "The night we met" } } as const;
    expect(carry(sky, m("moon"))).toMatchObject({ t: "night", p: { d: "1991-03-14", w: "The night we met" } });
    expect(carry(sky, m("year"))).toMatchObject({ t: "moon", p: { y: 1991 } });
    expect(carry(sky, m("place"))).toMatchObject({ t: "place", p: { d: "1991-03-14" } });
  });
  it("a name goes to the ASCII letters (split to fit) and back", () => {
    expect(carry({ t: "code", v: 1, p: { x: "MAYA", k: "card" } }, m("ascii"))).toMatchObject({ t: "ascii", p: { x: ["MAYA"] } });
    expect(carry({ t: "code", v: 1, p: { x: "HAPPY BIRTHDAY", k: "card" } }, m("ascii"))).toMatchObject({ p: { x: ["HAPPY", "BIRTHDAY"] } });
    expect(carry({ t: "ascii", v: 1, p: { x: ["MAYA"], f: "#" } }, m("code"))).toMatchObject({ t: "code", p: { x: "MAYA" } });
  });
  it("nothing to carry gives null (the plain link)", () => {
    expect(carry({ t: "house", v: 1, p: { fl: 3, wn: 3, r: "flat", dr: "c" } }, m("number"))).toBeNull();
  });
});
