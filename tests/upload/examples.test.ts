import { describe, expect, it } from "vitest";
import saved from "../../data/upload/examples.json";
import { examples } from "../../scripts/tools/buildYoursExamples";

describe("the From yours examples are the converter's own output", () => {
  it("regenerating them gives the same prints (no retouching), each passing the print bar", async () => {
    const now = await examples();
    expect(now.map((e) => e.ex)).toEqual(saved);
    for (const e of now) expect(e.ex.quality).toBeGreaterThanOrEqual(53);
  }, 120_000);
});
