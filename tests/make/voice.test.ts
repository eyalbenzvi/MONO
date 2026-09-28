import { describe, expect, it } from "vitest";
import { render } from "@/lib/custom/templates/voice";
import { validate, type CustomSpec } from "@/lib/custom/spec";
import { mulberry32 } from "../../scripts/gen/core";
import { gate } from "./fuzz";

const gcd = (x: number, y: number): number => (y ? gcd(y, x % y) : x);

describe("Your Voice: the template", () => {
  it("is deterministic", () => {
    const spec: CustomSpec = { t: "voice", v: 1, p: { a: 3, b: 2, d: 0.012, ph: 1.2, f: 196 } };
    expect(render(spec, "black")).toBe(render(spec, "black"));
  });
  it("every ratio up to 7:6 (1:1 is refused), the fastest and slowest fades, phases round the circle, low to high pitch: all pass the gate", () => {
    const rnd = mulberry32(0x70ce);
    const failures: string[] = [];
    for (let a = 1; a <= 7; a++)
      for (let b = 1; b <= 7; b++) {
        if (gcd(a, b) !== 1) continue;
        if (a === b) {
          expect(validate({ t: "voice", v: 1, p: { a, b, d: 0.01, ph: 1, f: 200 } })).toBeNull();
          continue;
        }
        for (const d of [0.003, 0.006, 0.012, 0.02, 0.03])
          for (let k = 0; k < 3; k++) {
            const ph = Math.round(rnd() * 628) / 100, f = 50 + Math.floor(rnd() * 950);
            const raw = { t: "voice", v: 1, p: { a, b, d, ph, f, ...(k === 2 ? { w: "Maya, humming" } : {}) } };
            const spec = validate(raw);
            expect(spec, JSON.stringify(raw)).not.toBeNull();
            const color = k % 2 ? "white" : "black";
            const bad = gate(render(spec!, color), color);
            if (bad) failures.push(`${JSON.stringify(spec!.p)} ${color}: ${bad}`);
          }
      }
    expect(failures.slice(0, 5)).toEqual([]);
  }, 600_000);
});
