import { describe, expect, it } from "vitest";
import { render } from "@/lib/custom/templates/elements";
import { PRODUCT, check } from "@/lib/custom/specs/elements";
import { ELEMENTS } from "@/lib/custom/draw/elements";
import { missing, nearestSpellable, spell, spellable } from "@/lib/custom/draw/elementsSpell";
import { wordsProblem } from "@/lib/custom/lexicon";
import { encodeMake, validate, type CustomSpec } from "@/lib/custom/spec";
import { mulberry32 } from "../../scripts/gen/core";
import { gate } from "./fuzz";

const ok = (p: unknown) => validate({ t: "elements", v: 1, p });
const ex = PRODUCT.example;
const FORBIDDEN = /clipPath|<pattern|clip-path|<mask|textPath|<defs|<use|opacity|gradient|<ellipse|<polygon|<polyline/;
const symbols = (w: string) => spell(w).map((t) => ("el" in t ? t.el[1] : `?${t.miss}`));

describe("Your Name in Elements: the spec", () => {
  it("accepts the example and drops unknown keys", () => {
    expect(check(ex as never, {})).toEqual(ex);
    expect(ok({ ...ex, zz: 1 })).toEqual({ t: "elements", v: 1, p: ex });
  });
  it("rejects wrong types, ranges and non-canonical forms", () => {
    for (const p of [{}, { x: 5 }, { x: ["ALICE"] }, { x: "Alice" }, { x: "alice" }, { x: " ALICE" }, { x: "AL ICE" }, { x: "A" }, { x: "ABCDEFGHIJKLM" }, { x: "ÉLIE" }, { x: "AL1CE" }, { x: "" }])
      expect(ok(p), JSON.stringify(p)).toBeNull();
  });
  it("the editor's word check says what's wrong in one line", async () => {
    const { elementsWordProblem } = await import("@/lib/custom/specs/elements");
    expect(elementsWordProblem("Alice")).toBeNull();
    expect(elementsWordProblem("Zoë")).toBe('Letters A to Z only. Try "E".');
    expect(elementsWordProblem("A")).toBe("2 to 12 letters.");
    expect(elementsWordProblem("Al ice")).toBe("Letters A to Z only, one word.");
    expect(wordsProblem("N1KE")).not.toBeNull();
    expect(wordsProblem(ex.x)).toBeNull();
  });
});

describe("Your Name in Elements: the spelling", () => {
  it("spells with one- and two-letter symbols, as few tiles as can be", () => {
    expect(symbols("ALICE")).toEqual(["Al", "I", "Ce"]);
    expect(symbols("CARBON")).toEqual(["Ca", "Rb", "O", "N"]);
    expect(symbols("NO")).toEqual(["No"]);
    expect(symbols("BACON")).toHaveLength(3);
    expect(spellable("SIMON")).toBe(true);
  });
  it("marks the letters nothing fits and finds the nearest word by dropping one", () => {
    expect(symbols("JOHN")).toEqual(["?J", "O", "H", "N"]);
    expect(spellable("JOHN")).toBe(false);
    expect(missing("QUIZ")).toContain("Q");
    expect(nearestSpellable("JOHN")).toBe("OHN");
    expect(nearestSpellable("JJ")).toBeNull();
    expect(nearestSpellable("QJ")).toBeNull();
  });
  it("every symbol in the table spells itself as one tile", () => {
    for (const e of ELEMENTS) if (e[1].length === 2) expect(spell(e[1].toUpperCase())).toEqual([{ el: e }]);
  });
});

describe("Your Name in Elements: the template", () => {
  it("is deterministic, and writes only what the canvas draws", () => {
    const spec = ok(ex)!;
    const svg = render(spec, "black");
    expect(svg).toBe(render(spec, "black"));
    expect(svg).not.toMatch(FORBIDDEN);
    expect(render(ok({ x: "JOHN" })!, "white")).not.toMatch(FORBIDDEN);
  });
  it("the example passes the gate on both tees", () => {
    const spec = ok(ex)!;
    for (const c of ["black", "white"] as const) expect(gate(render(spec, c), c)).toBeNull();
  });
  it("the longest link fits", () => {
    const len = encodeMake(ok({ x: "WWWWWWWWWWWW" })!).length;
    console.log(`elements: longest ?make= is ${len} characters`);
    expect(len).toBeLessThan(300);
  });
  it("two letters to twelve, one tile to twelve, gaps and all: all pass the gate", () => {
    const rnd = mulberry32(0xe1e3);
    const syms = ELEMENTS.map((e) => e[1].toUpperCase());
    const word = (n: number) => {
      let w = "";
      while (w.length < n) w += syms[Math.floor(rnd() * syms.length)];
      return w.slice(0, n);
    };
    // The edges: two letters in one tile or two, twelve one-letter tiles, six and seven tiles (one row full, the second begun), letters nothing fits.
    const words = ["NO", "HI", "BO", "ALICE", "HHHHHHHHHHHH", "UUUUUU", "CCCCCCC", "CACACACACACA", "RUTHERFORDSG", "JJJJJJJJJJJJ", "JQ", "QUIZ", "JOHN", "MMMMMMMMMMMM", "WWWWWWWWWWWW"];
    for (let i = 0; i < 150; i++) words.push(word(2 + Math.floor(rnd() * 11)));
    const failures: string[] = [];
    words.forEach((x, i) => {
      const spec = ok({ x }) as CustomSpec;
      expect(spec, x).not.toBeNull();
      const colors: ("black" | "white")[] = i % 4 ? ["black"] : ["black", "white"];
      for (const c of colors) {
        const bad = gate(render(spec, c), c);
        if (bad) failures.push(`${x} ${c}: ${bad}`);
      }
    });
    expect(failures.slice(0, 5)).toEqual([]);
  }, 600_000);
});
