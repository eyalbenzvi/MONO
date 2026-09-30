import { describe, expect, it } from "vitest";
import { clamp, clamp01, nonce } from "@/lib/math";

describe("lib/math", () => {
  it("clamps", () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
    expect([clamp01(-0.5), clamp01(0.25), clamp01(7)]).toEqual([0, 0.25, 1]);
  });
  it("a nonce differs call to call", () => {
    expect(nonce()).not.toBe(nonce());
  });
});
