import { describe, expect, it } from "vitest";
import cities from "../../data/cities/cities.json";
import { journeyBody, render } from "@/lib/custom/templates/journey";
import { decodeCities, type CitiesFile } from "@/lib/custom/data";
import { encodeMake, validate, type City, type CustomSpec } from "@/lib/custom/spec";
import { PRODUCT, check } from "@/lib/custom/specs/journey";
import { mulberry32 } from "../../scripts/gen/core";
import { gate } from "./fuzz";

const places = decodeCities(cities as unknown as CitiesFile);
const ctx = { cityById: places.byId };
const spec = (p: Record<string, unknown>) => validate({ t: "journey", v: 1, p }, places.byId);
const [TLV, ROME, LON, NYC, SYD, MAD, WLG] = [293397, 3169070, 2643743, 5128581, 2147714, 3117735, 2179537];
const FORBIDDEN = /clipPath|<pattern|clip-path|<mask|textPath|<defs|<use|opacity|gradient|<ellipse|<polygon|<polyline/;

describe("Your Journey: the spec", () => {
  it("accepts the example, in its own key order", () => {
    expect(check(PRODUCT.example as unknown as Record<string, unknown>, ctx)).toEqual(PRODUCT.example);
    expect(JSON.stringify(spec({ w: "Hi", c: [TLV, ROME] })!.p)).toBe(`{"c":[${TLV},${ROME}],"w":"Hi"}`);
  });
  it("drops unknown keys", () => {
    expect(spec({ c: [TLV, ROME], z: 1 })!.p).toEqual({ c: [TLV, ROME] });
  });
  it("refuses wrong types, counts, repeats in a row, unknown cities and untidy words", () => {
    for (const p of [
      {},
      { c: TLV },
      { c: [TLV] },
      { c: [] },
      { c: [TLV, ROME, LON, NYC, SYD, MAD, WLG, TLV, ROME] },
      { c: [TLV, TLV] },
      { c: [TLV, "3169070"] },
      { c: [TLV, 1.5] },
      { c: [TLV, -1] },
      { c: [TLV, 0x100000000] },
      { c: [TLV, 12345] },
      { c: [TLV, ROME], w: "" },
      { c: [TLV, ROME], w: " Hi" },
      { c: [TLV, ROME], w: "x".repeat(29) },
      { c: [TLV, ROME], w: "日本" },
      { c: [TLV, ROME], w: 5 },
    ])
      expect(spec(p), JSON.stringify(p)).toBeNull();
    // Without the place list any id in range will do; with it, only a known city.
    expect(validate({ t: "journey", v: 1, p: { c: [TLV, 12345] } })).not.toBeNull();
    // Back again is a journey; the same place twice in a row isn't.
    expect(spec({ c: [TLV, ROME, TLV] })).not.toBeNull();
  });
  it("the longest link fits", () => {
    const longest = [...places.list].sort((a, b) => b.id - a.id).slice(0, 8).map((c) => c.id);
    const s = spec({ c: longest, w: "W".repeat(28) })!;
    const n = encodeMake(s).length;
    expect(n).toBeLessThan(300);
    console.log(`journey: longest ?make= ${n} characters`);
  });
});

describe("Your Journey: the template", () => {
  it("is deterministic and draws only what the preview can", () => {
    const s = spec(PRODUCT.example as unknown as Record<string, unknown>)!;
    const a = render(s, "black", { places: places.list });
    expect(a).toBe(render(s, "black", { places: places.list }));
    expect(a).not.toMatch(FORBIDDEN);
    expect(a).not.toMatch(/ transform=/);
  });
  it("the example passes the gate in both colours", () => {
    const s = spec(PRODUCT.example as unknown as Record<string, unknown>)!;
    for (const color of ["black", "white"] as const) expect(gate(render(s, color, { places: places.list }), color)).toBeNull();
  });
  it("an exactly antipodal leg is drawn round the side facing us", () => {
    const A: City = { id: 1, name: "Here", ascii: "Here", country: "X", lat: 10, lon: 20, pop: 1e6, tz: "UTC" };
    const B: City = { ...A, id: 2, name: "There", lat: -10, lon: -160 };
    const svg = journeyBody({ c: [1, 2] }, [A, B, ...places.list]);
    expect(svg).not.toMatch(/NaN|Infinity/);
    expect(svg).toContain("20,020 km");
  });
  it("without the place list it still draws a globe", () => {
    const svg = render({ t: "journey", v: 1, p: { c: [TLV, ROME] } } as CustomSpec, "black");
    expect(svg).not.toMatch(/NaN|Infinity/);
  });
  it("anywhere, any number of stops, the longest names, back and forth: all pass the gate", () => {
    const rnd = mulberry32(0x70e1);
    const byName = [...places.list].sort((a, b) => b.name.length - a.name.length);
    const north = [...places.list].sort((a, b) => b.lat - a.lat), south = [...north].reverse();
    const pick = () => places.list[Math.floor(rnd() * places.list.length)].id;
    const trips: { c: number[]; w?: string }[] = [
      { c: [LON, 2988507] },
      { c: [MAD, WLG] },
      { c: [MAD, WLG, MAD, WLG, MAD, WLG, MAD, WLG] },
      { c: byName.slice(0, 8).map((c) => c.id), w: "W".repeat(28) },
      { c: byName.slice(0, 2).map((c) => c.id) },
      { c: [north[0].id, south[0].id] },
      { c: [north[0].id, north[1].id, north[2].id] },
      { c: [LON, NYC, 5856195, 1850147, SYD, 3369157, 3435910, 3413829] },
      { c: [TLV, 281184] },
    ];
    for (let i = 0; i < 120; i++) {
      const n = 2 + Math.floor(rnd() * 7);
      const c: number[] = [];
      // Half the trips stay in one region (the lens zooms in), half go anywhere.
      const home = places.list[Math.floor(rnd() * places.list.length)];
      const local = places.list.filter((x) => Math.abs(x.lat - home.lat) < 8 && Math.abs(x.lon - home.lon) < 10);
      while (c.length < n) {
        const id = i % 2 && local.length > 1 ? local[Math.floor(rnd() * local.length)].id : pick();
        if (c[c.length - 1] !== id) c.push(id);
      }
      trips.push({ c, ...(i % 3 === 0 ? { w: "A year away" } : {}) });
    }
    const failures: string[] = [];
    trips.forEach((p, i) => {
      const s = spec(p);
      expect(s, JSON.stringify(p)).not.toBeNull();
      const colors: ("black" | "white")[] = i % 3 ? ["black"] : ["black", "white"];
      for (const color of colors) {
        const svg = render(s!, color, { places: places.list });
        const bad = gate(svg, color) ?? (/NaN|Infinity/.test(svg) ? "NaN" : null);
        if (bad) failures.push(`${JSON.stringify(p)} ${color}: ${bad}`);
      }
    });
    expect(failures.slice(0, 5)).toEqual([]);
  }, 600_000);
});
