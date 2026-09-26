import { describe, expect, it } from "vitest";
import { SHIRTS } from "@/lib/catalog";
import { becauseOf, BECAUSE_MIN } from "@/lib/because";
import { centeredCosine, biggestShift, updateUserVector } from "@/lib/recommendation";
import { createInitialVector } from "@/types/shirt";

describe("U4: the learning, felt — reasons that are true", () => {
  it("'Because you liked …' names the closest saved design from another family, and only when it's alike", () => {
    const shirt = SHIRTS[40];
    const alike = SHIRTS.filter((s) => s.family !== shirt.family).sort((a, b) => centeredCosine(b.features, shirt.features) - centeredCosine(a.features, shirt.features));
    const far = alike[alike.length - 1];
    expect(becauseOf(shirt, [far.id, alike[0].id])!.id).toBe(alike[0].id);
    expect(becauseOf(shirt, [far.id])).toBeNull();
    expect(becauseOf(shirt, [shirt.id])).toBeNull();
    expect(becauseOf(shirt, [])).toBeNull();
    expect(centeredCosine(alike[0].features, shirt.features)).toBeGreaterThan(BECAUSE_MIN);
  });

  it("'Noted: more …' names the dimension the swipe actually moved", () => {
    const v = createInitialVector();
    const s = SHIRTS.find((x) => x.features.line_art > 0.8)!;
    const after = updateUserVector(v, s.features, "like");
    const k = biggestShift(v, after, "like")!;
    expect(after[k] - v[k]).toBe(Math.max(...Object.keys(v).map((key) => after[key as keyof typeof v] - v[key as keyof typeof v])));
  });
});
