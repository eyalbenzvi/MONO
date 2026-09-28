import { describe, expect, it } from "vitest";
import { render } from "@/lib/custom/templates/line";
import { LINE_REPEATS, encodeStroke, validate, type CustomSpec } from "@/lib/custom/spec";
import { EXAMPLE_LINES, exampleStroke } from "@/lib/custom/stroke";
import { mulberry32 } from "../../scripts/gen/core";
import { gate } from "./fuzz";

describe("Your Line: the template", () => {
  it("is deterministic", () => {
    const spec: CustomSpec = { t: "line", v: 1, p: { s: exampleStroke(1), n: 12 } };
    expect(render(spec, "white")).toBe(render(spec, "white"));
    expect(render(spec, "white")).not.toBe(render({ ...spec, p: { ...spec.p, m: 1 } }, "white"));
  });

  it("500 random strokes and the degenerate ones (a dot, a straight line, 256 points), every repeat, mirrored or not, pass the gate", () => {
    const rnd = mulberry32(0x11ae);
    const strokes: string[] = [
      encodeStroke([[128, 128], [128, 128]]),
      encodeStroke([[20, 128], [235, 128]]),
      encodeStroke([[128, 128], [255, 128]]),
      encodeStroke(Array.from({ length: 256 }, (_, i) => [Math.round(128 + 120 * Math.cos(i / 9)), Math.round(128 + 120 * Math.sin(i / 7))] as [number, number])),
      ...EXAMPLE_LINES.map((_, i) => exampleStroke(i)),
    ];
    while (strokes.length < 505) {
      const n = 2 + Math.floor(rnd() * 60);
      let [x, y] = [Math.floor(rnd() * 256), Math.floor(rnd() * 256)];
      const pts: [number, number][] = [[x, y]];
      for (let i = 1; i < n; i++) {
        x = Math.max(0, Math.min(255, x + Math.round((rnd() - 0.5) * 60)));
        y = Math.max(0, Math.min(255, y + Math.round((rnd() - 0.5) * 60)));
        pts.push([x, y]);
      }
      strokes.push(encodeStroke(pts));
    }
    const failures: string[] = [];
    strokes.forEach((s, i) => {
      const n = LINE_REPEATS[i % LINE_REPEATS.length];
      const spec = validate({ t: "line", v: 1, p: { s, n, ...(i % 3 === 0 ? { m: 1 } : {}), ...(i % 4 === 0 ? { w: "For Maya" } : {}) } });
      expect(spec, s).not.toBeNull();
      const color = rnd() < 0.5 ? "black" : "white";
      const bad = gate(render(spec!, color), color);
      if (bad) failures.push(`${i} n=${n} ${color}: ${bad}`);
    });
    expect(failures.slice(0, 5)).toEqual([]);
  }, 600_000);
});

describe("Your Line: the product's example", () => {
  it("is the second example line, written out", async () => {
    const { MADE } = await import("@/lib/custom/products");
    const made = MADE.find((m) => m.slug === "line")!;
    expect((made.example.p as { s: string }).s).toBe(exampleStroke(1));
  });
});
