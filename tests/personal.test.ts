import { describe, expect, it } from "vitest";
import { SHIRTS } from "@/lib/catalog";
import { becauseOf, BECAUSE_MIN } from "@/lib/because";
import { centeredCosine } from "@/lib/recommendation";

describe("U4: the learning, felt — reasons that are true", () => {
  it("'Because you saved …' names the closest saved design from another family, and only when it's clearly alike (0.7)", () => {
    const shirt = SHIRTS[40];
    const alike = SHIRTS.filter((s) => s.family !== shirt.family).sort((a, b) => centeredCosine(b.features, shirt.features) - centeredCosine(a.features, shirt.features));
    const far = alike[alike.length - 1];
    expect(becauseOf(shirt, [far.id, alike[0].id])!.id).toBe(alike[0].id);
    expect(becauseOf(shirt, [far.id])).toBeNull();
    expect(becauseOf(shirt, [shirt.id])).toBeNull();
    expect(becauseOf(shirt, [])).toBeNull();
    expect(centeredCosine(alike[0].features, shirt.features)).toBeGreaterThan(BECAUSE_MIN);
    expect(BECAUSE_MIN).toBe(0.7);
  });
});
