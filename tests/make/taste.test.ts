import { describe, expect, it } from "vitest";
import { render } from "@/lib/custom/templates/taste";
import { tasteQ } from "@/lib/custom/tasteCode";
import { validate, type CustomSpec } from "@/lib/custom/spec";
import { mulberry32 } from "@/lib/custom/rng";
import { mulberry32 as genRng } from "../../scripts/gen/core";
import { FEATURE_KEYS } from "@/types/shirt";
import { gate } from "./fuzz";

describe("Your Taste: the template", () => {
  it("is deterministic, and near tastes grow the same plant", () => {
    const v = Object.fromEntries(FEATURE_KEYS.map((k, i) => [k, (i % 5) / 5]));
    const near = Object.fromEntries(FEATURE_KEYS.map((k, i) => [k, (i % 5) / 5 + 0.02]));
    const spec: CustomSpec = { t: "taste", v: 1, p: { q: tasteQ(v) } };
    expect(render(spec, "black")).toBe(render(spec, "black"));
    expect(tasteQ(near)).toBe(tasteQ(v));
  });
  it("the browser's seeded randomness is the generator's", () => {
    const [a, b] = [mulberry32(42), genRng(42)];
    for (let i = 0; i < 20; i++) expect(a()).toBe(b());
  });
  it("500 random tastes and the 17 one-hot ones pass the gate with no text wider than the print", () => {
    const rnd = mulberry32(0x7a57e);
    const vectors = [
      ...FEATURE_KEYS.map((k) => Object.fromEntries(FEATURE_KEYS.map((j) => [j, j === k ? 1 : 0]))),
      ...Array.from({ length: 500 }, () => Object.fromEntries(FEATURE_KEYS.map((k) => [k, rnd()]))),
    ];
    const failures: string[] = [];
    for (const v of vectors) {
      const spec = validate({ t: "taste", v: 1, p: { q: tasteQ(v) } });
      expect(spec).not.toBeNull();
      const color = rnd() < 0.5 ? "black" : "white";
      const bad = gate(render(spec!, color), color);
      if (bad) failures.push(`${(spec!.p as { q: string }).q} ${color}: ${bad}`);
    }
    expect(failures.slice(0, 5)).toEqual([]);
  }, 600_000);
});
