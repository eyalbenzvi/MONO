import { describe, expect, it } from "vitest";
import { PATTERNS, code128Modules, code128Values } from "@/lib/custom/draw/code128";

describe("Code 128", () => {
  it("each symbol is eleven modules (the stop thirteen), and no two alike", () => {
    PATTERNS.forEach((p, i) => expect([...p].reduce((a, c) => a + Number(c), 0), String(i)).toBe(i === 106 ? 13 : 11));
    expect(new Set(PATTERNS).size).toBe(107);
    // Every symbol has an even number of bar modules (the standard's parity rule).
    PATTERNS.slice(0, 106).forEach((p, i) => expect((Number(p[0]) + Number(p[2]) + Number(p[4])) % 2, String(i)).toBe(0));
  });
  it("figures go in code set C, two to a symbol, with the weighted check", () => {
    // 20160814: start C (105), 20 16 08 14; check (105 + 20·1 + 16·2 + 8·3 + 14·4) mod 103 = 237 mod 103 = 31.
    expect(code128Values("20160814")).toEqual([105, 20, 16, 8, 14, 31, 106]);
  });
  it("text goes in code set B, one character to a symbol, with the weighted check", () => {
    // "AB": start B (104), A = 33, B = 34; check (104 + 33·1 + 34·2) mod 103 = 205 mod 103 = 102.
    expect(code128Values("AB")).toEqual([104, 33, 34, 102, 106]);
    // An odd run of figures is code set B too.
    expect(code128Values("123")![0]).toBe(104);
  });
  it("refuses what it can't encode, and the modules add up", () => {
    expect(code128Values("")).toBeNull();
    expect(code128Values("é")).toBeNull();
    expect(code128Modules(code128Values("20160814")!).reduce((a, b) => a + b, 0)).toBe(6 * 11 + 13);
  });
});
