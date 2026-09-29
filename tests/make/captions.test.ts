import { describe, expect, it } from "vitest";
import { captionLines } from "@/lib/custom/kit";
import { MADE } from "@/lib/custom/products";
import { loadCaptioner } from "@/lib/custom/renderers";
import { capRuleFor, encodeMake, validate } from "@/lib/custom/spec";
import { capOf, titleWords } from "@/lib/custom/specKit";
import { CAP_LINK_EXTRA, captionedLinkMax, MAX_CAP, SOME_CAP, withCap } from "./captions";
import { gate } from "./fuzz";
import { dataFor, drawSpec } from "./render";

describe("captions: the spec (specKit capOf)", () => {
  it("absent or all ours is no cap; trailing ours are dropped; each line the words' rule and its length", () => {
    expect(capOf({})).toEqual({});
    expect(capOf({ cap: [null, null] })).toEqual({});
    expect(capOf({ cap: ["Noa", null, null] })).toEqual({ cap: ["Noa"] });
    expect(capOf({ cap: [null, "Line two"] })).toEqual({ cap: [null, "Line two"] });
    for (const bad of [5, "x", {}, [1], [" Noa"], ["Noa "], ["N  oa"], ["W".repeat(25)], [null, "W".repeat(37)], ["a", "b", "c", "d"], ["日本"], ["a<b"]]) expect(capOf({ cap: bad }), JSON.stringify(bad)).toBeNull();
  });
  it("an empty line hides it only where the product allows", () => {
    expect(capOf({ cap: [""] })).toBeNull();
    expect(capOf({ cap: ["", null, ""] }, { hide: [true, false, true] })).toEqual({ cap: ["", null, ""] });
    expect(capOf({ cap: [null, ""] }, { hide: [true, false, true] })).toBeNull();
  });
  it("the render's lines: ours unless the visitor's, hidden when empty", () => {
    expect(captionLines(["A", "B", "C"])).toEqual(["A", "B", "C"]);
    expect(captionLines(["A", "B", "C"], ["X", null, ""])).toEqual(["X", "B", undefined]);
    expect(captionLines(["A"], [null, "Y"])).toEqual(["A", "Y", undefined]);
  });
  it("the title's words: cap[0] over a link's old w", () => {
    expect(titleWords({ w: "Old" })).toBe("Old");
    expect(titleWords({ w: "Old", cap: ["New"] })).toBe("New");
    expect(titleWords({ w: "Old", cap: [null, "x"] })).toBe("Old");
    expect(titleWords({ w: "Old", cap: [""] })).toBe("Old");
  });
});

/** Every From ours product draws the visitor's caption. */
const PRODUCTS = MADE;

describe("captions: every From ours product", () => {
  it("has its caption's lines, and a spec without cap round-trips unchanged", async () => {
    for (const m of PRODUCTS) {
      const lines = (await loadCaptioner(m.template))(m.example, dataFor(m.example));
      expect(lines[0], m.slug).toBeTruthy();
      expect(validate(m.example), m.slug).toEqual(m.example);
      expect("cap" in m.example.p, m.slug).toBe(false);
    }
  });
  it("all three lines the visitor's: the example passes the gate on both tees, and the lines print", async () => {
    const failures: string[] = [];
    for (const m of PRODUCTS) {
      const s = validate(withCap(m.example, SOME_CAP))!;
      expect(s, m.slug).not.toBeNull();
      for (const color of ["black", "white"] as const) {
        const svg = await drawSpec(s, color);
        const bad = gate(svg, color);
        if (bad) failures.push(`${m.slug} ${color}: ${bad}`);
        if (!svg.includes("Every Sunday since 2010")) failures.push(`${m.slug}: line two not printed`);
      }
    }
    expect(failures).toEqual([]);
  }, 600_000);
  it("a line may be hidden only where hiding it still passes the gate on both tees", async () => {
    const failures: string[] = [];
    for (const m of PRODUCTS) {
      const rule = capRuleFor(m.template);
      for (let i = 0; i < 3; i++) {
        const cap = [null, null, null].map((_, j) => (j === i ? "" : null));
        const s = validate(withCap(m.example, cap));
        if (!rule.hide?.[i]) {
          expect(s, `${m.slug} line ${i}`).toBeNull();
          continue;
        }
        for (const color of ["black", "white"] as const) {
          const bad = gate(await drawSpec(s!, color), color);
          if (bad) failures.push(`${m.slug} line ${i} hidden, ${color}: ${bad}`);
        }
      }
    }
    expect(failures).toEqual([]);
  }, 600_000);
  it("the example with every line at its longest: a short enough link, and the gate on both tees", async () => {
    const failures: string[] = [];
    for (const m of PRODUCTS) {
      const s = validate(withCap(m.example, MAX_CAP))!;
      const n = encodeMake(s).length;
      expect(n - encodeMake(validate(m.example)!).length, m.slug).toBeLessThanOrEqual(CAP_LINK_EXTRA);
      expect(n, m.slug).toBeLessThanOrEqual(captionedLinkMax(m.slug));
      for (const color of ["black", "white"] as const) {
        const bad = gate(await drawSpec(s, color), color);
        if (bad) failures.push(`${m.slug} ${color}: ${bad}`);
      }
    }
    expect(failures).toEqual([]);
  }, 600_000);
});
