import { describe, expect, it } from "vitest";
import { CODE_MAX, codeProblem, customTitle, decodeMake, decodeStroke, encodeMake, encodeStroke, specHash, validate, type CustomSpec } from "@/lib/custom/spec";
import { EXAMPLE_LINES, exampleStroke, simplify, strokeSpec } from "@/lib/custom/stroke";
import { tasteFromQ, tasteQ } from "@/lib/custom/tasteCode";
import { FEATURE_KEYS } from "@/types/shirt";

const ok = (spec: unknown) => expect(validate(spec), JSON.stringify(spec)).not.toBeNull();
const no = (spec: unknown) => expect(validate(spec), JSON.stringify(spec)).toBeNull();

describe("Make, from ours: the six new specs validate strictly and round-trip", () => {
  it("Your Taste: 17 base-36 digits of 0–10", () => {
    ok({ t: "taste", v: 1, p: { q: "5".repeat(17) } });
    ok({ t: "taste", v: 1, p: { q: "0123456789a012345" } });
    for (const q of ["5".repeat(16), "5".repeat(18), "b".repeat(17), "A".repeat(17), 5]) no({ t: "taste", v: 1, p: { q } });
    const v = Object.fromEntries(FEATURE_KEYS.map((k, i) => [k, (i % 11) / 10]));
    expect(tasteQ(tasteFromQ(tasteQ(v)))).toBe(tasteQ(v));
    expect(tasteQ({})).toBe("5".repeat(17));
  });

  it("Your Name: each code's character set, capitals except binary, at most 20", () => {
    ok({ t: "code", v: 1, p: { x: "NOA", k: "morse" } });
    ok({ t: "code", v: 1, p: { x: "Noa & Sam!", k: "binary", h: 1 } });
    ok({ t: "code", v: 1, p: { x: "R2-D2 / 1977", k: "card" } });
    no({ t: "code", v: 1, p: { x: "noa", k: "morse" } }); // not in the code's own form (capitals)
    no({ t: "code", v: 1, p: { x: "NOA!", k: "braille" } });
    no({ t: "code", v: 1, p: { x: "X".repeat(CODE_MAX + 1), k: "binary" } });
    no({ t: "code", v: 1, p: { x: "", k: "tape" } });
    no({ t: "code", v: 1, p: { x: "NOA", k: "semaphore" } });
    no({ t: "code", v: 1, p: { x: "NOA", k: "tape", h: 2 } });
    expect(codeProblem("RENÉ", "tape")).toEqual({ ch: "É", instead: "E" });
    expect(codeProblem("€5", "binary")).toEqual({ ch: "€", instead: null });
    expect(codeProblem("NOA 7", "morse")).toBeNull();
  });

  it("Your Line: a stroke of 2–256 points on the grid, 600 bytes at most; repeats 6/8/12/16/24; mirror", () => {
    const pts: [number, number][] = [
      [128, 128],
      [200, 100],
      [255, 0],
      [0, 255],
    ];
    const s = encodeStroke(pts);
    expect(decodeStroke(s)).toEqual(pts);
    ok({ t: "line", v: 1, p: { s, n: 12 } });
    ok({ t: "line", v: 1, p: { s, n: 24, m: 1, w: "For Maya" } });
    for (const n of [5, 7, 10, 32, "12"]) no({ t: "line", v: 1, p: { s, n } });
    no({ t: "line", v: 1, p: { s: encodeStroke([[1, 1]]), n: 12 } });
    no({ t: "line", v: 1, p: { s: "!!!", n: 12 } });
    const long = Array.from({ length: 257 }, (_, i) => [i % 256, (i * 7) % 256] as [number, number]);
    no({ t: "line", v: 1, p: { s: encodeStroke(long), n: 12 } });
    // Simplified hard enough to fit, a drawn line always does.
    const scribble = Array.from({ length: 3000 }, (_, i) => [500 + 400 * Math.sin(i / 7), 500 + 400 * Math.cos(i / 11)] as [number, number]);
    const fitted = strokeSpec(scribble, 1000)!;
    expect(decodeStroke(fitted)!.length).toBeLessThanOrEqual(256);
    expect(strokeSpec([[10, 10], [10, 10]], 1000)).toBeNull();
    for (let i = 0; i < EXAMPLE_LINES.length; i++) ok({ t: "line", v: 1, p: { s: exampleStroke(i), n: 12 } });
    expect(simplify([[0, 0], [0.5, 0.001], [1, 0]], 0.004)).toEqual([[0, 0], [1, 0]]);
  });

  it("Your Voice: a:b both 1–7 and coprime, damping, phase, pitch", () => {
    ok({ t: "voice", v: 1, p: { a: 3, b: 2, d: 0.012, ph: 1.57, f: 196 } });
    ok({ t: "voice", v: 1, p: { a: 2, b: 1, d: 0.003, ph: 0, f: 50, w: "Hum" } });
    for (const p of [{ a: 4, b: 2 }, { a: 1, b: 1 }, { a: 8, b: 1 }, { a: 0, b: 1 }, { d: 0.2 }, { d: 0.01234 }, { ph: 7 }, { f: 40 }, { f: 196.5 }])
      no({ t: "voice", v: 1, p: { a: 3, b: 2, d: 0.012, ph: 1.57, f: 196, ...p } });
  });

  it("Your House: floors 1–12, windows 1–9, roof, door, number 0–9999", () => {
    ok({ t: "house", v: 1, p: { fl: 3, wn: 4, r: "pitched", dr: "c", no: 14, w: "Elm Street" } });
    ok({ t: "house", v: 1, p: { fl: 12, wn: 9, r: "dome", dr: "l" } });
    for (const p of [{ fl: 0 }, { fl: 13 }, { wn: 10 }, { r: "gable" }, { dr: "x" }, { no: 10000 }, { no: -1 }, { fl: 2.5 }])
      no({ t: "house", v: 1, p: { fl: 3, wn: 4, r: "flat", dr: "c", ...p } });
  });

  it("Your Number: a number or a time, a unit, a label, the face (a stopwatch only for a time)", () => {
    ok({ t: "number", v: 1, p: { v: 3.4, u: "kg", l: "Birth weight", face: "dial" } });
    ok({ t: "number", v: 1, p: { v: "3:41:07", u: "", l: "First marathon", face: "stopwatch" } });
    ok({ t: "number", v: 1, p: { v: "3:41:07", u: "", face: "dial" } });
    ok({ t: "number", v: 1, p: { v: 62, u: "m²", face: "dial" } });
    ok({ t: "number", v: 1, p: { v: -12.5, u: "°C", face: "dial" } });
    ok({ t: "number", v: 1, p: { v: 0, u: "laps", face: "dial" } });
    for (const p of [{ v: 3.4, face: "stopwatch" }, { v: 100000 }, { v: 1.2345 }, { v: "3:61:00" }, { v: "100:00:00" }, { u: "toolong" }, { u: "<b>" }, { face: "clock" }, { l: "x".repeat(29) }])
      no({ t: "number", v: 1, p: { v: 3.4, u: "kg", face: "dial", ...p } });
  });

  it("every new spec round-trips through a link and hashes by content, not key order", () => {
    const specs: CustomSpec[] = [
      { t: "taste", v: 1, p: { q: "0123456789a012345" } },
      { t: "code", v: 1, p: { x: "NOA", k: "card", h: 1 } },
      { t: "line", v: 1, p: { s: exampleStroke(0), n: 16, m: 1, w: "For Maya" } },
      { t: "voice", v: 1, p: { a: 3, b: 2, d: 0.012, ph: 1.57, f: 196 } },
      { t: "house", v: 1, p: { fl: 3, wn: 4, r: "stepped", dr: "r", no: 14 } },
      { t: "number", v: 1, p: { v: "3:41:07", u: "", l: "First marathon", face: "stopwatch" } },
    ];
    for (const s of specs) {
      expect(decodeMake(encodeMake(s))).toEqual(s);
      expect(customTitle(s)).toMatch(/^Your /);
    }
    expect(specHash({ t: "house", v: 1, p: { no: 14, dr: "r", r: "stepped", wn: 4, fl: 3 } } as unknown as CustomSpec)).toBe(specHash(specs[4]));
    expect(customTitle(specs[1])).toBe("Your Name in Code · NOA");
    expect(customTitle(specs[3])).toBe("Your Voice · 196 Hz");
    expect(customTitle(specs[4])).toBe("Your House · No. 14");
    expect(customTitle(specs[5])).toBe("Your Number · First marathon");
  });
});
