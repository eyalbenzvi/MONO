import { describe, expect, it } from "vitest";
import { render } from "@/lib/custom/templates/house";
import { DOORS, ROOFS, validate, type CustomSpec } from "@/lib/custom/spec";
import { mulberry32 } from "../../scripts/gen/core";
import { gate } from "./fuzz";

describe("Your House: the template", () => {
  it("is deterministic", () => {
    const spec: CustomSpec = { t: "house", v: 1, p: { fl: 3, wn: 4, r: "pitched", dr: "c", no: 14 } };
    expect(render(spec, "black")).toBe(render(spec, "black"));
  });
  it("draws no clip paths or patterns (the canvas preview can't)", () => {
    const svg = render({ t: "house", v: 1, p: { fl: 12, wn: 9, r: "flat", dr: "l" } }, "white");
    expect(svg).not.toMatch(/clipPath|<pattern|clip-path/);
  });
  it("every roof × door × floors 1–12 × windows 1–9 passes the gate", () => {
    const rnd = mulberry32(0x40a5e);
    const failures: string[] = [];
    let n = 0;
    for (const r of ROOFS)
      for (const dr of DOORS)
        for (let fl = 1; fl <= 12; fl++)
          for (let wn = 1; wn <= 9; wn++) {
            // The whole grid on one colour, a quarter of it again on the other.
            const extra = rnd();
            const raw = { t: "house", v: 1, p: { fl, wn, r, dr, ...(extra < 0.5 ? { no: Math.floor(rnd() * 10000) } : {}), ...(extra > 0.7 ? { w: "The Old Bakery" } : {}) } };
            const spec = validate(raw);
            expect(spec, JSON.stringify(raw)).not.toBeNull();
            const colors: ("black" | "white")[] = n++ % 4 ? ["black"] : ["black", "white"];
            for (const color of colors) {
              const bad = gate(render(spec!, color), color);
              if (bad) failures.push(`${JSON.stringify(spec!.p)} ${color}: ${bad}`);
            }
          }
    expect(failures.slice(0, 5)).toEqual([]);
  }, 1_200_000);
});
