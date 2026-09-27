import { describe, expect, it } from "vitest";
import { halvings, smoothWidth, SMOOTH_FROM } from "@/lib/downscale";

describe("halftone prints are shrunk properly, never by the phone's GPU (recording bug: prints in blocks)", () => {
  it("a print shown smaller than its file gets a canvas at least the size shown, in a few sizes only", () => {
    const w = smoothWidth(1500, 330); // a Discover card's print at 3× DPR
    expect(w).toBeGreaterThanOrEqual(330);
    expect(w).toBeLessThan(330 * 1.25 + 1);
    // A pinch from 1× to 4× redraws a handful of times, not every frame.
    const sizes = new Set(Array.from({ length: 300 }, (_, i) => smoothWidth(1500, 330 + i * 3)));
    expect(sizes.size).toBeLessThanOrEqual(8);
  });

  it("no canvas when the file is shown at (about) its size or larger", () => {
    expect(smoothWidth(240, 270)).toBe(0); // a grid thumbnail
    expect(smoothWidth(1500, 1500 / SMOOTH_FROM + 1)).toBe(0);
    expect(smoothWidth(1500, 0)).toBe(0);
    expect(smoothWidth(0, 300)).toBe(0);
  });

  it("the shrink goes through exact halvings (each averages every dot), the last step under 2×", () => {
    expect(halvings(1500, 305)).toEqual([750, 375, 305]);
    expect(halvings(1500, 750)).toEqual([750]);
    const steps = halvings(1500, 200);
    expect(steps[steps.length - 1]).toBe(200);
    for (let i = 1; i < steps.length; i++) expect(steps[i - 1] / steps[i]).toBeLessThanOrEqual(2.01);
  });
});
