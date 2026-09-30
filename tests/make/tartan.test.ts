import { describe, expect, it } from "vitest";
import { render } from "@/lib/custom/templates/tartan";
import { deriveSett, repeatOf } from "@/lib/custom/draw/tartan";
import { PRODUCT, check, parseSett, settText, type Tone } from "@/lib/custom/specs/tartan";
import { encodeMake, validate, type CustomSpec } from "@/lib/custom/spec";
import { mulberry32 } from "../../scripts/gen/core";
import { gate } from "./fuzz";

const ok = (p: unknown) => validate({ t: "tartan", v: 1, p });
const FORBIDDEN = /clipPath|<pattern|clip-path|<mask|textPath|<defs|<use|opacity|gradient|<ellipse|<polygon|<polyline/;

describe("Your Tartan: the spec", () => {
  it("accepts the example, drops unknown keys, keeps a fixed key order", () => {
    expect(check(PRODUCT.example as never, {})).toEqual(PRODUCT.example);
    expect(ok({ w: "Est. 1952", t: "K8W2D12L4", n: "Mackenzie", z: 1 })).toEqual({ t: "tartan", v: 1, p: { n: "Mackenzie", t: "K8W2D12L4", w: "Est. 1952" } });
    expect(Object.keys(ok({ w: "Est. 1952", t: "K8W2D12L4", n: "Mackenzie" })!.p)).toEqual(["n", "t", "w"]);
    expect(ok({ n: "O'Brien-Núñez" })).not.toBeNull();
  });
  it("rejects wrong types, ranges, unknown values, non-canonical forms and over-limit inputs", () => {
    for (const p of [
      { n: "" },
      { n: " Mackenzie" },
      { n: "Mac  Kenzie" },
      { n: "M".repeat(19) },
      { n: "Mackenzie☃" },
      { n: 7 },
      { n: "Ng", t: "" },
      { n: "Ng", t: "K8W2D12" },
      { n: "Ng", t: "K8W2D12L4K2W2D2L2K2" },
      { n: "Ng", t: "K8K2D12L4" },
      { n: "Ng", t: "K08W2D12L4" },
      { n: "Ng", t: "K0W2D12L4" },
      { n: "Ng", t: "K17W2D12L4" },
      { n: "Ng", t: "k8w2d12l4" },
      { n: "Ng", t: "R8W2D12L4" },
      { n: "Ng", t: "K8 W2 D12 L4" },
      { n: "Ng", t: "K16W16K16W16D2" },
      { n: "Ng", t: ["K", 8] },
      { n: "Ng", w: "" },
      { n: "Ng", w: "x".repeat(29) },
      {},
    ])
      expect(ok(p), JSON.stringify(p)).toBeNull();
  });
  it("derives a valid sett from any name, the same one every time, case aside", () => {
    const rnd = mulberry32(0x7a27a);
    for (let i = 0; i < 300; i++) {
      const name = Array.from({ length: 1 + Math.floor(rnd() * 18) }, () => "abcdefghijklmnopqrstuvwxyz'-"[Math.floor(rnd() * 28)]).join("");
      const s = deriveSett(name);
      expect(parseSett(settText(s)), name).toEqual(s);
    }
    expect(deriveSett("Mackenzie")).toEqual(deriveSett("MACKENZIE"));
    // A symmetric repeat: out and back, each pivot once.
    expect(repeatOf([["K", 2], ["W", 1], ["D", 3], ["L", 1]] as [Tone, number][]).join("")).toBe("KKWDDDLDDDW");
  });
});

describe("Your Tartan: the template", () => {
  it("is deterministic, and writes only what the canvas draws", () => {
    const spec = ok({ n: "Mackenzie", t: "K8W2D12L4", w: "Est. 1952" })!;
    const svg = render(spec, "black");
    expect(svg).toBe(render(spec, "black"));
    expect(svg).not.toMatch(FORBIDDEN);
    expect(svg).toContain("THE MACKENZIE SETT");
  });
  it("the example passes the gate on both tees", () => {
    const spec = ok(PRODUCT.example)!;
    for (const c of ["black", "white"] as const) expect(gate(render(spec, c), c)).toBeNull();
  });
  it("the longest link fits", () => {
    const len = encodeMake(ok({ n: "W".repeat(18), t: "K16D16K16D2L2W2K2D8", w: "W".repeat(28) })!).length;
    console.log(`tartan: longest ?make= is ${len} characters`);
    expect(len).toBeLessThan(300);
  });
  it("names long and short, derived setts and edited ones to the extremes: all pass the gate", () => {
    const rnd = mulberry32(0x7a2);
    const raws: Record<string, unknown>[] = [];
    // The extremes of an edited sett: the densest everywhere it can be, the faintest, the finest, the widest.
    for (const t of ["K16D16K16D16", "K16L1K16L1K16L1K12W1", "D16K16D16K16", "W16L16W16L16", "L16W16L16W16", "W1L1W1L1", "K1D1K1D1", "K1W1K1W1K1W1K1W1", "W16K1W16K1W16K1", "K16W16K16W16", "L1K16L1K16L1K16L1"])
      raws.push({ n: "Ng", t });
    for (const n of ["O", "Ng", "W".repeat(18), "O'Brien-Núñez", "Mackenzie", "Levi", "Smith"]) raws.push({ n, ...(rnd() < 0.4 ? { w: "W".repeat(28) } : {}) });
    const T = "KDLW";
    for (let i = 0; i < 90; i++) {
      const name = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[Math.floor(rnd() * 26)] + Array.from({ length: Math.floor(rnd() * 12) }, () => "abcdefghijklmnopqrstuvwxyz"[Math.floor(rnd() * 26)]).join("");
      if (i % 2) {
        raws.push({ n: name, ...(rnd() < 0.3 ? { w: "Est. 1952" } : {}) });
        continue;
      }
      // A random edited sett within the limits.
      for (;;) {
        const k = 4 + Math.floor(rnd() * 5);
        const s: string[] = [];
        let sum = 0;
        for (let j = 0; j < k; j++) {
          let t = T[Math.floor(rnd() * 4)];
          while (s.length && s[s.length - 1][0] === t) t = T[Math.floor(rnd() * 4)];
          const c = 1 + Math.floor(rnd() * 16);
          s.push(`${t}${c}`);
          sum += c;
        }
        if (sum <= 64) {
          raws.push({ n: name, t: s.join("") });
          break;
        }
      }
    }
    const failures: string[] = [];
    raws.forEach((raw, i) => {
      const spec = ok(raw) as CustomSpec;
      expect(spec, JSON.stringify(raw)).not.toBeNull();
      const colors: ("black" | "white")[] = i % 4 ? ["black"] : ["black", "white"];
      for (const c of colors) {
        const bad = gate(render(spec, c), c);
        if (bad) failures.push(`${JSON.stringify(raw)} ${c}: ${bad}`);
      }
    });
    expect(failures.slice(0, 5)).toEqual([]);
  }, 600_000);
});
