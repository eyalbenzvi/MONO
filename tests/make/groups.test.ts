import { describe, expect, it } from "vitest";
import { GROUP_COUNTS, MADE, MAKE_GROUPS, groupsFrom } from "@/lib/custom/products";

describe("Make: the groups", () => {
  it("in order, the travels and the forms after the place", () => {
    expect(MAKE_GROUPS.map((g) => g.id)).toEqual(["date", "name", "place", "travels", "form", "people", "you"]);
    expect(MAKE_GROUPS.find((g) => g.id === "travels")!.label).toBe("From your travels");
    expect(MAKE_GROUPS.find((g) => g.id === "form")!.label).toBe("In a form you know");
  });
  it("?g= reads known groups only, in the groups' order", () => {
    expect(groupsFrom("?g=form.travels.nope")).toEqual(["travels", "form"]);
    expect(groupsFrom("?g=")).toEqual([]);
    expect(groupsFrom("")).toEqual([]);
  });
  it("every product is in a group, the counts add up, and the index lists products group by group", () => {
    expect(Object.values(GROUP_COUNTS).reduce((a, b) => a + b, 0)).toBe(MADE.length);
    const order = MAKE_GROUPS.map((g) => g.id);
    const seen = MADE.map((m) => order.indexOf(m.group));
    expect(seen.every((g) => g >= 0)).toBe(true);
    expect([...seen].sort((a, b) => a - b)).toEqual(seen);
  });
});
