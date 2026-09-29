import { describe, expect, it } from "vitest";
import { FONT_FAMILY, text, textWidth, type Family } from "@/lib/custom/kit";
import { wrap } from "@/lib/custom/svg";
import { svgInk } from "../../scripts/gen/quality";

/** The ink's left and right edges of one line set at (20, 200), in print units (rendered at 1200 px: 4 px a unit). */
function inkSpan(body: string): [number, number] {
  const r = svgInk(wrap(body, "black"), "black", 1200);
  let x0 = r.w, x1 = -1;
  for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) if (r.ink[y * r.w + x] > 0.5) (x0 = Math.min(x0, x)), (x1 = Math.max(x1, x));
  return [x0 / 4, (x1 + 1) / 4];
}

describe("Make: the print fonts", () => {
  it("mono stays exactly as every print has written it", () => {
    expect(text(10, 20, "Noa", 12)).toBe('<text x="10" y="20" fill="#FFFFFF" font-size="12" font-family="DejaVu Sans Mono, monospace" text-anchor="middle">Noa</text>');
    expect(textWidth("Noa", 10)).toBeCloseTo(18.06, 6);
  });
  it("the gate reads each face from its own file (a family it couldn't find would set in the fallback, at other widths)", () => {
    const line = "HAMBURGEFONSTIV hamburgefonstiv";
    const spans = new Map<Family, number>();
    for (const family of Object.keys(FONT_FAMILY) as Family[]) {
      const [x0, x1] = inkSpan(text(20, 200, line, 12, { anchor: "start", family }));
      const measured = textWidth(line, 12, { family });
      // The ink sits inside the advance box, within a glyph's side bearings of it.
      expect(x1 - x0, family).toBeLessThanOrEqual(measured + 1);
      expect(x1 - x0, family).toBeGreaterThan(measured - 4);
      spans.set(family, x1 - x0);
    }
    expect(new Set([...spans.values()].map((v) => Math.round(v))).size).toBe(4);
    // Condensed is narrower than the serif; bold is wider than regular.
    expect(textWidth(line, 12, { family: "condensed" })).toBeLessThan(textWidth(line, 12, { family: "serif" }));
    expect(textWidth(line, 12, { family: "serif", bold: true })).toBeGreaterThan(textWidth(line, 12, { family: "serif" }));
  });
  it("every character the words' rule allows is in the serif and the condensed faces", () => {
    for (const family of ["serif", "condensed"] as const) {
      const [x0, x1] = inkSpan(text(20, 200, "Zoë Ångström-Łódź & Co. (1990)", 12, { anchor: "start", family }));
      expect(x1 - x0, family).toBeGreaterThan(60);
    }
  });
});
