import { describe, expect, it } from "vitest";
import cities from "../../data/cities/cities.json";
import { daylight, render } from "@/lib/custom/templates/place";
import { decodeCities, type CitiesFile } from "@/lib/custom/data";
import { coords, validate, type CustomSpec } from "@/lib/custom/spec";
import { mulberry32 } from "../../scripts/gen/core";
import { gate } from "./fuzz";

const places = decodeCities(cities as unknown as CitiesFile);

describe("Your Place: the template", () => {
  it("names the place in degrees and minutes, hemispheres included", () => {
    expect(coords(32.08, 34.78)).toBe("32°05′N 34°47′E");
    expect(coords(-33.87, -151.21)).toBe("33°52′S 151°13′W");
    expect(coords(0, 0)).toBe("0°00′N 0°00′E");
    expect(coords(10.999, 20)).toBe("11°00′N 20°00′E");
  });
  it("daylight: 12 hours at the equator, midnight sun and polar night beyond the circles", () => {
    expect(daylight(0, 80)).toBeGreaterThan(12);
    expect(daylight(0, 80)).toBeLessThan(12.3);
    expect(daylight(78, 172)).toBe(24);
    expect(daylight(78, 355)).toBe(0);
    expect(daylight(51.5, 172)).toBeCloseTo(16.6, 0);
  });
  it("keeps two decimals of a degree (about a kilometre) and no more", () => {
    expect(validate({ t: "place", v: 1, p: { la: 32.08, lo: 34.78 } })).not.toBeNull();
    for (const p of [{ la: 32.081, lo: 34.78 }, { la: 91, lo: 0 }, { la: 0, lo: 181 }, { la: 0, lo: 0, d: "2021-02-30" }, { la: 0, lo: 0, c: -1 }])
      expect(validate({ t: "place", v: 1, p })).toBeNull();
  });
  it("is deterministic", () => {
    const spec: CustomSpec = { t: "place", v: 1, p: { la: 32.08, lo: 34.78, d: "1991-03-14", w: "Where I heard" } };
    expect(render(spec, "black", { places: places.list })).toBe(render(spec, "black", { places: places.list }));
  });
  it("anywhere on earth, the poles and the date line, with and without a date or words: all pass the gate", () => {
    const rnd = mulberry32(0x91ace);
    const spots: [number, number][] = [[90, 0], [-90, 0], [0, 180], [0, -180], [66.56, 0], [-66.56, 179.99], [32.08, 34.78], [51.51, -0.13], [-33.87, 151.21], [64.15, -21.94], [0, 0]];
    for (let i = 0; i < 70; i++) spots.push([Math.round((rnd() * 180 - 90) * 100) / 100, Math.round((rnd() * 360 - 180) * 100) / 100]);
    const failures: string[] = [];
    spots.forEach(([la, lo], i) => {
      const day = `${1900 + Math.floor(rnd() * 200)}-${String(1 + Math.floor(rnd() * 12)).padStart(2, "0")}-${String(1 + Math.floor(rnd() * 28)).padStart(2, "0")}`;
      const raw = { t: "place", v: 1, p: { la, lo, ...(i % 3 ? { d: day } : {}), ...(i % 4 === 1 ? { w: "The night we met" } : {}) } };
      const spec = validate(raw);
      expect(spec, JSON.stringify(raw)).not.toBeNull();
      const color = i % 2 ? "white" : "black";
      const bad = gate(render(spec!, color, { places: places.list }), color);
      if (bad) failures.push(`${JSON.stringify(spec!.p)} ${color}: ${bad}`);
    });
    expect(failures.slice(0, 5)).toEqual([]);
  }, 600_000);
});
