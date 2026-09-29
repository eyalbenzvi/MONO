import { describe, expect, it } from "vitest";
import { cellsAcross, evolve, render, wordBits } from "@/lib/custom/templates/automaton";
import { AUTOMATON_MAX, AUTOMATON_RULES, PRODUCT, automatonWordProblem, check } from "@/lib/custom/specs/automaton";
import { wordsProblem } from "@/lib/custom/lexicon";
import { encodeMake, validate, type CustomSpec } from "@/lib/custom/spec";
import { mulberry32 } from "../../scripts/gen/core";
import { gate } from "./fuzz";

const ok = (p: unknown) => validate({ t: "automaton", v: 1, p });
const ex = PRODUCT.example;
const FORBIDDEN = /clipPath|<pattern|clip-path|<mask|textPath|<defs|<use|opacity|gradient|<ellipse|<polygon|<polyline/;
const CH = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,'&:!?()-";

describe("Your Automaton: the spec", () => {
  it("accepts the example and drops unknown keys, in a fixed key order", () => {
    expect(check(ex as never, {})).toEqual(ex);
    expect(ok({ ...ex, zz: 1 })).toEqual({ t: "automaton", v: 1, p: ex });
    expect(Object.keys(ok({ s: 1, r: 90, x: "Noa" })!.p)).toEqual(["x", "r", "s"]);
  });
  it("rejects wrong types, ranges, unknown rules and non-canonical forms", () => {
    const bad: unknown[] = [
      {},
      { x: "Maya" },
      { r: 30 },
      { x: 5, r: 30 },
      { x: "", r: 30 },
      { x: " Maya", r: 30 },
      { x: "Maya ", r: 30 },
      { x: "Ma  ya", r: 30 },
      { x: "Zoë", r: 30 },
      { x: "Maya~", r: 30 },
      { x: "x".repeat(AUTOMATON_MAX + 1), r: 30 },
      { x: "Maya", r: 31 },
      { x: "Maya", r: "30" },
      { x: "Maya", r: 256 },
      { x: "Maya", r: 30, s: 0 },
      { x: "Maya", r: 30, s: true },
    ];
    for (const p of bad) expect(ok(p), JSON.stringify(p)).toBeNull();
  });
  it("the editor's word check says what's wrong in one line; refusals come from the lexicon", () => {
    expect(automatonWordProblem("Maya Cohen")).toBeNull();
    expect(automatonWordProblem("Zoë")).toBe('ASCII letters only. Try "e".');
    expect(automatonWordProblem("x".repeat(11))).toBe(`Up to ${AUTOMATON_MAX} characters`);
    expect(automatonWordProblem("a☃")).toBe("Letters and numbers.");
    expect(wordsProblem("N1KE")).not.toBeNull();
    expect(wordsProblem(ex.x)).toBeNull();
  });
});

describe("Your Automaton: the automaton", () => {
  it("sets the word's ASCII bits as the first row, centred", () => {
    expect(wordBits("A").join("")).toBe("01000001");
    expect(wordBits("Ab")).toHaveLength(16);
    const g = evolve(wordBits("A"), 30, 65, 3);
    expect([...g[0]].join("").indexOf("1")).toBe(Math.floor((65 - 8) / 2) + 1);
  });
  it("follows the rule's numbering (rule 90: each cell the XOR of its two neighbours)", () => {
    const g = evolve([1], 90, 65, 3);
    expect([...g[1]].map((v, i) => (v ? i : -1)).filter((i) => i >= 0)).toEqual([31, 33]);
    expect([...g[2]].map((v, i) => (v ? i : -1)).filter((i) => i >= 0)).toEqual([30, 34]);
  });
  it("the ring is odd and never a multiple of three (the additive rules never cancel out)", () => {
    for (let n = 1; n <= AUTOMATON_MAX; n++) {
      const c = cellsAcross(8 * n);
      expect(c % 2).toBe(1);
      expect(c % 3).not.toBe(0);
      expect(c).toBeGreaterThanOrEqual(8 * n + 8);
    }
  });
  it("no rule dies out or fills solid, over many words", () => {
    const rnd = mulberry32(0xa070);
    const words = ["!", "I", ".", "-", "WWWWWWWWWW", "aaaaaaaaaa", "(((((((((("];
    for (let i = 0; i < 60; i++) words.push(Array.from({ length: 1 + Math.floor(rnd() * AUTOMATON_MAX) }, () => CH[Math.floor(rnd() * CH.length)]).join(""));
    const bad: string[] = [];
    for (const r of AUTOMATON_RULES)
      for (const w of words) {
        const cols = cellsAcross(8 * w.length);
        const g = evolve(wordBits(w), r, cols, 90);
        // Every stretch of ten rows keeps some ink and never two thirds of its cells; the lower half of the print at least a tenth.
        const lit = (rows: Uint8Array[]) => rows.reduce((a, row) => a + row.reduce((b, v) => b + v, 0), 0) / (rows.length * cols);
        for (let j = 10; j + 10 <= g.length; j += 10) {
          const d = lit(g.slice(j, j + 10));
          if (d < 0.02 || d > 0.67) bad.push(`${r} ${w} rows ${j}: ${d.toFixed(2)}`);
        }
        if (lit(g.slice(45)) < 0.1) bad.push(`${r} ${w} lower half: ${lit(g.slice(45)).toFixed(2)}`);
      }
    expect(bad.slice(0, 5)).toEqual([]);
  });
});

describe("Your Automaton: the template", () => {
  it("is deterministic, and writes only what the canvas draws", () => {
    const spec = ok(ex)!;
    const svg = render(spec, "black");
    expect(svg).toBe(render(spec, "black"));
    expect(svg).not.toMatch(FORBIDDEN);
    expect(render(ok({ ...ex, s: 1 })!, "white")).not.toMatch(FORBIDDEN);
  });
  it("the example passes the gate on both tees", () => {
    const spec = ok(ex)!;
    for (const c of ["black", "white"] as const) expect(gate(render(spec, c), c)).toBeNull();
  });
  it("the longest link fits", () => {
    const len = encodeMake(ok({ x: "&&&&&&&&&&", r: 150, s: 1 })!).length;
    console.log(`automaton: longest ?make= is ${len} characters`);
    expect(len).toBeLessThan(300);
  });
  it("every rule, dots and squares, one character to ten: all pass the gate", () => {
    const rnd = mulberry32(0x5eed);
    // The edges: the sparsest and densest bytes, one character and ten, each ring width (65, 73, 83, 89 cells).
    const edges = ["!", "I", ".", "Maya", "WWWWWWWWWW", "aaaaaaaaaa", "()()()()()", "Maya Cohen", "123456789", "Alexandria"];
    const raws: Record<string, unknown>[] = [];
    AUTOMATON_RULES.forEach((r, k) => edges.forEach((x, i) => raws.push({ x, r, ...((i + k) % 2 ? { s: 1 } : {}) })));
    for (let i = 0; i < 150; i++) {
      const x = Array.from({ length: 1 + Math.floor(rnd() * AUTOMATON_MAX) }, () => CH[Math.floor(rnd() * CH.length)]).join("");
      raws.push({ x, r: AUTOMATON_RULES[Math.floor(rnd() * AUTOMATON_RULES.length)], ...(rnd() < 0.5 ? { s: 1 } : {}) });
    }
    const failures: string[] = [];
    raws.forEach((raw, i) => {
      const spec = ok(raw) as CustomSpec;
      expect(spec, JSON.stringify(raw)).not.toBeNull();
      const colors: ("black" | "white")[] = i % 4 ? ["black"] : ["black", "white"];
      for (const c of colors) {
        const bad = gate(render(spec, c), c);
        if (bad) failures.push(`${JSON.stringify(raw)} ${c}: ${bad}`);
      }
    });
    expect(failures.slice(0, 5)).toEqual([]);
  }, 600_000);
});
