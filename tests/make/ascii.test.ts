import { describe, expect, it } from "vitest";
import { asciiRows, render } from "@/lib/custom/templates/ascii";
import { ASCII_FILLS, validate, type CustomSpec } from "@/lib/custom/spec";
import { mulberry32 } from "../../scripts/gen/core";
import { gate } from "./fuzz";

describe("Your ASCII: the template", () => {
  it("types each lit pixel of the pixel font in the chosen character", () => {
    // The letters sit inside a glow five cells deep: strip it to read them.
    const letters = (rows: string[], r: number) => rows[r + 5].replace(/[+=\-:.]/g, " ").trim();
    expect(letters(asciiRows({ x: ["HI"], f: "#" }), 0)).toBe("#   #  ###");
    expect(letters(asciiRows({ x: ["HI"], f: "self" }), 3)).toBe("HHHHH   I");
    expect(letters(asciiRows({ x: ["HI"], f: "phrase", p: "ab" }), 0)).toBe("a   b  aba");
    expect(asciiRows({ x: ["I"], f: "@", s: 1 })[6]).toContain("@/");
    // The glow fades outwards: + next to the letters, . at its edge.
    const top = asciiRows({ x: ["I"], f: "#" });
    expect(top[4]).toContain("+");
    expect(top[0].trim()).toMatch(/^\.+$/);
  });
  it("validates lines, characters, fills and the phrase", () => {
    expect(validate({ t: "ascii", v: 1, p: { x: ["noa"], f: "#" } })).toEqual({ t: "ascii", v: 1, p: { x: ["NOA"], f: "#" } });
    for (const p of [{ x: [], f: "#" }, { x: ["A", "B", "C"], f: "#" }, { x: ["ÉCOLE"], f: "#" }, { x: ["ABCDEFGHI"], f: "#" }, { x: ["..."], f: "#" }, { x: ["A"], f: "*" }, { x: ["A"], f: "phrase" }, { x: ["A"], f: "#", p: "x" }, { x: ["A"], f: "phrase", p: "  " }])
      expect(validate({ t: "ascii", v: 1, p }), JSON.stringify(p)).toBeNull();
  });
  it("is deterministic", () => {
    const spec: CustomSpec = { t: "ascii", v: 1, p: { x: ["NOA", "1991"], f: "self", s: 1 } };
    expect(render(spec, "black")).toBe(render(spec, "black"));
  });
  it("one letter to two lines of eight, every fill, shadow or not: all pass the gate", () => {
    const rnd = mulberry32(0xa5c11);
    const CH = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789?!.:-+/";
    const word = (n: number) => Array.from({ length: n }, () => CH[Math.floor(rnd() * CH.length)]).join("");
    const specs: unknown[] = [];
    for (const f of ASCII_FILLS)
      for (const x of [["I"], ["1."], ["NOA"], ["WWWWWWWW"], ["MMMMMMMM", "88888888"], ["HELLO", "WORLD"], ["A" + word(Math.floor(rnd() * 8))], ["B" + word(3), "C" + word(7)]])
        for (const s of [0, 1]) specs.push({ t: "ascii", v: 1, p: { x, f, ...(f === "phrase" ? { p: "love, from tel aviv" } : {}), ...(s ? { s: 1 } : {}), ...(rnd() < 0.3 ? { w: "For Maya" } : {}) } });
    const failures: string[] = [];
    specs.forEach((raw, i) => {
      const spec = validate(raw);
      expect(spec, JSON.stringify(raw)).not.toBeNull();
      const color = i % 2 ? "white" : "black";
      const bad = gate(render(spec!, color), color);
      if (bad) failures.push(`${JSON.stringify(spec!.p)} ${color}: ${bad}`);
    });
    expect(failures.slice(0, 5)).toEqual([]);
  }, 600_000);
});
