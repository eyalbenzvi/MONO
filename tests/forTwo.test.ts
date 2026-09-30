import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import cities from "../data/cities/cities.json";
import { decodeCities, type CitiesFile } from "@/lib/custom/data";
import { TWO_EXAMPLE, forTwo, initialOf, readTwo, writeTwo, type TwoInputs } from "@/lib/custom/forTwo";
import { madeBySlug } from "@/lib/custom/products";
import { decodeMake, encodeMake, validate, type CustomSpec } from "@/lib/custom/spec";
import { loadRenderer, prepareData } from "@/lib/custom/renderers";
import { gate } from "./make/fuzz";

const places = decodeCities(cities as unknown as CitiesFile);
const TLV = places.byId(293397)!;
const SYDNEY = places.list.find((c) => c.name === "Sydney" && c.country.startsWith("Austral"))!;
const ROOT = path.resolve(__dirname, "..");
const readJson = (f: string) => JSON.parse(readFileSync(path.join(ROOT, f), "utf8"));
const SKY = { stars: readJson("data/sky/stars.json"), lines: (readJson("data/sky/constellations.json") as { lines: [number, number][][] }[]).flatMap((c) => c.lines) };
const TODAY = "2026-09-29";
const slugs = (i: TwoInputs, today = TODAY) => forTwo(i, today).map((c) => c.slug);
const LONDON = places.list.find((c) => c.name === "London" && c.country.startsWith("United Kingdom"))!;
const full: TwoInputs = { ...TWO_EXAMPLE, place: TLV };

describe("For two: which prints a date makes", () => {
  it("everything, in order, with a place and two names", () => {
    expect(slugs(full)).toEqual(["sky", "moon", "planets", "julia", "monogram", "place", "year", "weeks", "snowflake", "receipt", "message"]);
    // Where they live now, too: the signpost between the two.
    expect(slugs({ ...full, home: LONDON })).toEqual(["sky", "moon", "planets", "julia", "monogram", "place", "year", "weeks", "snowflake", "receipt", "message", "signpost"]);
  });
  it("every spec validates, round-trips a link, is its product's template, and carries the date, words and names", () => {
    for (const c of forTwo(full, TODAY)) {
      expect(validate(c.spec), c.slug).toEqual(c.spec);
      expect(decodeMake(encodeMake(c.spec), places.byId)).toEqual(c.spec);
      expect(madeBySlug(c.slug)?.template).toBe(c.spec.t);
    }
    const by = Object.fromEntries(forTwo(full, TODAY).map((c) => [c.slug, c.spec])) as Record<string, CustomSpec>;
    expect(by.sky).toEqual({ t: "sky", v: 1, p: { c: 293397, d: "2016-08-12", w: "The night we met" } });
    expect(by.moon).toEqual({ t: "night", v: 1, p: { d: "2016-08-12", w: "The night we met" } });
    expect(by.monogram).toEqual({ t: "monogram", v: 1, p: { x: "ND", s: "lace", y: 2016 } });
    expect(by.place).toMatchObject({ t: "place", p: { la: 32.08, lo: 34.78, c: 293397, d: "2016-08-12" } });
    expect(by.year).toEqual({ t: "moon", v: 1, p: { y: 2016, w: "The night we met" } });
    expect(by.weeks).toEqual({ t: "weeks", v: 1, p: { b: "2016-08-12", a: TODAY, n: 80, w: "The night we met" } });
    expect(by.snowflake).toEqual({ t: "snowflake", v: 1, p: { n: "Noa & David" } });
  });
  it("says what each is for them", () => {
    const lines = Object.fromEntries(forTwo(full, TODAY).map((c) => [c.slug, c.line]));
    expect(lines.sky).toBe("The sky over Tel Aviv that night");
    expect(lines.julia).toBe("12 August 2016 as a fractal");
    expect(lines.monogram).toBe("N and D, woven");
    expect(lines.year).toBe("Every moon of 2016");
    for (const l of Object.values(lines)) expect(l).not.toMatch(/!|premium|special|\bAI\b/i);
  });
  it("no place: no sky and no globe; south of the equator: the moons as seen from the south", () => {
    expect(slugs({ d: "2016-08-12" })).toEqual(["moon", "planets", "julia", "year", "weeks", "receipt"]);
    expect(slugs({ d: "2016-08-12", place: null })).not.toContain("sky");
    const south = forTwo({ d: "2016-08-12", place: SYDNEY }, TODAY);
    expect(south.find((c) => c.slug === "moon")!.spec.p).toMatchObject({ s: 1 });
    expect(south.find((c) => c.slug === "year")!.spec.p).toMatchObject({ s: 1 });
  });
  it("inputs out of range drop only the products that can't take them", () => {
    // The planets hold to 2050; a date to come has no weeks yet.
    expect(slugs({ d: "2060-06-01", place: TLV })).toEqual(["sky", "moon", "julia", "place", "year", "receipt"]);
    expect(slugs({ d: "2027-06-01" })).toEqual(["moon", "planets", "julia", "year", "receipt"]);
    // Today counts; past 80 years the grid grows to 90; past 90 there's no grid.
    expect(slugs({ d: TODAY })).toContain("weeks");
    expect(forTwo({ d: "1940-01-01" }, TODAY).find((c) => c.slug === "weeks")!.spec.p).toMatchObject({ n: 90 });
    expect(slugs({ d: "1930-01-01" })).not.toContain("weeks");
    // One name, or an initial the monogram can't draw: no monogram, no snowflake.
    expect(slugs({ d: "2016-08-12", a: "Noa" })).not.toContain("monogram");
    expect(slugs({ d: "2016-08-12", a: "Noa", b: "1Dan" })).not.toContain("monogram");
    expect(slugs({ d: "2016-08-12", a: "Noa", b: "1Dan" })).toContain("snowflake");
    // Both names too long together for the snowflake (20): the monogram stays.
    const long = slugs({ d: "2016-08-12", a: "Bartholomew", b: "Evangelina" });
    expect(long).toContain("monogram");
    expect(long).not.toContain("snowflake");
    // Words the print can't set are left off, not the prints.
    expect(forTwo({ d: "2016-08-12", w: "x".repeat(40) }, TODAY).every((c) => !("w" in c.spec.p))).toBe(true);
    expect(forTwo({ d: "2016-08-12", w: "x".repeat(40) }, TODAY)).toHaveLength(6);
  });
  it("no date, or not a real one: nothing", () => {
    for (const d of ["", "2016-02-30", "1899-12-31", "2101-01-01", "12/08/2016"]) expect(forTwo({ d }, TODAY), d).toEqual([]);
  });
  it("initials fold accents and refuse what the monogram can't draw", () => {
    expect(initialOf("Élodie")).toBe("E");
    expect(initialOf(" noa")).toBe("N");
    expect(initialOf("1Dan")).toBeNull();
    expect(initialOf("")).toBeNull();
  });
});

describe("For two: the receipt, the first messages and the signpost", () => {
  const by = (i: TwoInputs) => Object.fromEntries(forTwo(i, TODAY).map((c) => [c.slug, c.spec])) as Record<string, CustomSpec>;
  it("the receipt itemises what it was, our items and the years since, under both names", () => {
    expect(by(full).receipt).toEqual({ t: "receipt", v: 1, p: { k: "receipt", h: "Noa & David", x: ["The night we met", "Coffee, too strong", "Long walk", "Last train", "10 good years"], d: "2016-08-12" } });
    // No names, the two of them; words too long for an item, our first; a date this year, no years yet.
    expect(by({ d: "2026-01-01", w: "The longest night of the year" }).receipt.p).toEqual({ k: "receipt", h: "The two of us", x: ["First date", "Coffee, too strong", "Long walk", "Last train"], d: "2026-01-01" });
  });
  it("the first messages only between two named people", () => {
    expect(by(full).message).toEqual({ t: "message", v: 1, p: { n: "David", d: "2016-08-12", m: [[0, "Hi David. It was nice to meet you.", "21:02"], [1, "Hi Noa. It was. Same time next week?", "21:05"]] } });
    expect(slugs({ d: "2016-08-12", a: "Noa" })).not.toContain("message");
  });
  it("a signpost since: where they live now to where it was, two different cities, the year it started", () => {
    const s = by({ ...full, home: LONDON }).signpost;
    expect(s.p).toMatchObject({ k: "since", h: LONDON.id, y: 2016 });
    expect(forTwo({ ...full, home: LONDON }, TODAY).find((c) => c.slug === "signpost")!.line).toBe("London to Tel Aviv, since 2016");
    expect(slugs({ ...full, home: TLV })).not.toContain("signpost");
    expect(slugs({ d: "2016-08-12", home: LONDON })).not.toContain("signpost");
  });
});

describe("For two: the address", () => {
  it("round-trips, and drops a bad field alone", () => {
    const t = { d: "2016-08-12", w: "The night we met", a: "Noa", b: "David", c: 293397, h: 2643743 };
    expect(readTwo(new URLSearchParams(writeTwo(t)))).toEqual(t);
    expect(readTwo(new URLSearchParams("d=2016-02-30&w=Our+wedding&a=Noa&b=" + "x".repeat(30) + "&c=abc"))).toEqual({ w: "Our wedding", a: "Noa" });
    expect(readTwo(new URLSearchParams("c=none"))).toEqual({ c: "none" });
    expect(readTwo(new URLSearchParams("c=0"))).toEqual({});
  });
});

describe("For two: the prints pass the gate", () => {
  const draw = async (spec: CustomSpec, color: "black" | "white") => {
    const data: Record<string, unknown> = { sky: SKY, places: places.list };
    if (spec.t === "sky" || spec.t === "place") data.city = places.byId(spec.p.c!);
    // What a template loads for itself, read from disk here (the signpost's places are the list above).
    if (spec.t !== "signpost") Object.assign(data, await prepareData(spec));
    return (await loadRenderer(spec.t))(spec, color, data as never);
  };
  it("the example, and a southern winter's date with long names, in both colours", async () => {
    const cases: TwoInputs[] = [{ ...full, home: LONDON }, { d: "1994-07-03", w: "Our wedding", a: "Élodie", b: "Matthias", place: SYDNEY, home: TLV }];
    for (const i of cases)
      for (const c of forTwo(i, TODAY))
        for (const color of ["black", "white"] as const) expect(gate(await draw(c.spec, color), color), `${c.slug} ${color} ${i.d}`).toBeNull();
  }, 120_000);
});
