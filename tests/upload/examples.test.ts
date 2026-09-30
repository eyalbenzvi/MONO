import { describe, expect, it } from "vitest";
import saved from "../../data/upload/examples.json";
import { examples } from "../../scripts/tools/buildYoursExamples";
import { tooSmall } from "@/lib/upload/convert";
import { BAR, tier } from "@/lib/upload/measure";

describe("the From yours examples are the converter's own output", () => {
  it("regenerating them gives the same prints (no retouching), each one a customer's file would get", async () => {
    const now = await examples();
    expect(now.map((e) => e.ex)).toEqual(saved);
    expect(now.map((e) => [e.ex.kind, e.ex.mode])).toEqual([
      ["photo", "dots"],
      ["drawing", "line"],
    ]);
    for (const e of now) {
      // The print bar and the rest of the tier's checks, a near-copy of a catalogue design included.
      expect(e.ex.quality).toBeGreaterThanOrEqual(53);
      expect(e.dup).toBeGreaterThan(BAR.nearDuplicate);
      expect(tier(e.measures, e.ex.tee, e.dup).tier).not.toBe("refuse");
    }
    // The photograph is big enough for Full, as a customer's file must be.
    const photo = now.find((e) => e.ex.kind === "photo")!.input.pixels;
    expect(tooSmall(photo.w, photo.h, "full")).toBe(false);
    // The credit stays with the data, though the tiles no longer show it.
    expect(now.find((e) => e.ex.kind === "photo")!.ex.credit).toMatch(/CC0/);
  }, 120_000);
});
