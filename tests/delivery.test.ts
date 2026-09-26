import { describe, expect, it } from "vitest";
import { addBusinessDays, arrivalRange, formatArrival } from "@/lib/delivery";

describe("delivery estimate (F12)", () => {
  it("counts business days only", () => {
    // Friday 2 Oct 2026 + 1 business day = Monday 5 Oct
    expect(addBusinessDays(new Date(2026, 9, 2, 15), 1)).toEqual(new Date(2026, 9, 5));
    expect(addBusinessDays(new Date(2026, 9, 5, 9), 5)).toEqual(new Date(2026, 9, 12));
  });

  it("arrival window = ship days + transit days from the policy", () => {
    const { from, to } = arrivalRange(new Date(2026, 8, 28, 10)); // Mon 28 Sep
    expect(from).toEqual(new Date(2026, 9, 5)); // +5 business days
    expect(to).toEqual(new Date(2026, 9, 9)); // +9 business days
    expect(formatArrival({ from, to })).toBe("Mon 5 – Fri 9 Oct");
  });

  it("names both months when the window spans two", () => {
    expect(formatArrival({ from: new Date(2026, 9, 29), to: new Date(2026, 10, 3) })).toBe("Thu 29 Oct – Tue 3 Nov");
  });
});
