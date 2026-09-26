import { describe, expect, it } from "vitest";
import { clampPan, rubberBand, zoomAt } from "@/lib/zoom";

const frame = { w: 300, h: 400 };

describe("U5: zoom maths", () => {
  it("the point zoomed at stays where it is", () => {
    const t = zoomAt(2, 50, -40, { s: 1, x: 0, y: 0 }, frame);
    // A content point q under (50, -40) at 1× is at t + 2q after.
    expect(t.x + 2 * 50).toBeCloseTo(50);
    expect(t.y + 2 * -40).toBeCloseTo(-40);
  });

  it("the picture always covers its frame: pan is limited by the overflow, none at 1× or below", () => {
    expect(clampPan({ s: 2, x: 1000, y: -1000 }, frame)).toEqual({ s: 2, x: 150, y: -200 });
    expect(clampPan({ s: 0.9, x: 20, y: 20 }, frame)).toEqual({ s: 0.9, x: 0, y: 0 });
  });

  it("a pinch past the range meets resistance and stops at 0.85× and max + 0.5", () => {
    expect(rubberBand(2, 1, 4)).toBe(2);
    expect(rubberBand(5, 1, 4)).toBeCloseTo(4 + 1 / 3);
    expect(rubberBand(10, 1, 4)).toBe(4.5);
    expect(rubberBand(0.1, 1, 4)).toBe(0.85);
  });
});
