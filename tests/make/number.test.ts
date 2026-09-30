import { describe, expect, it } from "vitest";
import { render, scaleFor } from "@/lib/custom/templates/number";
import { UNITS, validate, type CustomSpec } from "@/lib/custom/spec";
import { mulberry32 } from "../../scripts/gen/core";
import { gate } from "./fuzz";

describe("Your Number: the template", () => {
  it("ranges the scale so the needle lands between 25% and 75% of the arc (1-2-5 steps)", () => {
    const rnd = mulberry32(0x5ca1e);
    const values = [0, 0.001, 1, 3.4, 62, 99999, -99999, -12.5, 100, 7.5, ...Array.from({ length: 2000 }, () => Math.round((rnd() - 0.3) * 10 ** (1 + rnd() * 4) * 1000) / 1000)];
    for (const v of values) {
      const s = scaleFor(v);
      const t = (v - s.min) / (s.max - s.min);
      expect(t, String(v)).toBeGreaterThanOrEqual(0.25);
      expect(t, String(v)).toBeLessThanOrEqual(0.75);
      expect(String(Number((s.step / 10 ** Math.floor(Math.log10(s.step))).toPrecision(3)))).toMatch(/^[125]$/);
    }
  });
  it("is deterministic", () => {
    const spec: CustomSpec = { t: "number", v: 1, p: { v: 3.4, u: "kg", l: "Birth weight", face: "dial" } };
    expect(render(spec, "black")).toBe(render(spec, "black"));
  });
  it("0, negatives, 99999, decimals, times to 99:59:59 on both faces, every unit, with and without a label: all pass the gate", () => {
    const rnd = mulberry32(0x1234);
    const specs: unknown[] = [];
    const nums = [0, -1, -12.5, -99999, 99999, 3.4, 0.005, 62, 1000, 12345.678];
    for (const v of nums) for (const u of [...UNITS, "laps", "m/s"]) specs.push({ t: "number", v: 1, p: { v, u, ...(rnd() < 0.5 ? { l: "Our first flat" } : {}), face: "dial" } });
    const times = ["0:00:00", "0:00:01", "3:41:07", "12:00:00", "23:59:59", "99:59:59", "1:05:00"];
    for (const v of times) for (const face of ["dial", "stopwatch"]) specs.push({ t: "number", v: 1, p: { v, u: "", l: "First marathon", face } });
    for (let i = 0; i < 200; i++) specs.push({ t: "number", v: 1, p: { v: Math.round((rnd() - 0.4) * 10 ** (rnd() * 5) * 100) / 100, u: UNITS[i % UNITS.length], ...(i % 3 ? {} : { l: "x".repeat(28) }), face: "dial" } });
    const failures: string[] = [];
    for (const raw of specs) {
      const spec = validate(raw);
      expect(spec, JSON.stringify(raw)).not.toBeNull();
      const color = rnd() < 0.5 ? "black" : "white";
      const bad = gate(render(spec!, color), color);
      if (bad) failures.push(`${JSON.stringify(spec!.p)} ${color}: ${bad}`);
    }
    expect(failures.slice(0, 5)).toEqual([]);
  }, 600_000);
});
