import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import shirts from "../data/shirts.json";
import { julian } from "@/lib/custom/kit";
import { wrap } from "@/lib/custom/svg";
import { moonBody } from "@/lib/custom/templates/moon";
import { latLon, skyBody } from "@/lib/custom/templates/sky";
import { localToUtc } from "@/lib/custom/tz";
import { decodeCities, searchCities } from "@/lib/custom/data";
import { publishedCustom } from "../scripts/tools/publishCustom";
import { customSummary, customTitle, decodeMake, encodeMake, renderCustomSvg, specHash, templateFor, validate, type City, type CustomSpec } from "@/lib/custom";

const LIB = path.resolve(__dirname, "..", "lib", "custom");
const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(path.join(dir, e.name)) : e.name.endsWith(".ts") ? [path.join(dir, e.name)] : []));

describe("personalised prints: lib/custom is shared by the generator and the browser", () => {
  it("imports nothing from Node (it runs in the browser too)", () => {
    for (const f of files(LIB)) expect(readFileSync(f, "utf8"), path.relative(LIB, f)).not.toMatch(/from "node:|require\(/);
  });
});

const ROOT = path.resolve(__dirname, "..");
const readJson = (f: string) => JSON.parse(readFileSync(path.join(ROOT, f), "utf8"));
const SKY = { stars: readJson("data/sky/stars.json"), lines: (readJson("data/sky/constellations.json") as { lines: [number, number][][] }[]).flatMap((c) => c.lines) };
type Entry = { id: string; n: number; variant: string; baseColor: "black" | "white"; title: string };
const CATALOGUE = shirts as unknown as Entry[];
const print = (n: number) => readFileSync(path.join(ROOT, "public", "prints", `print_${n}.svg`), "utf8");

/** The catalogue's own inputs (scripts/gen/set7/sky.ts), by the design's title. */
const SKIES: Record<string, { lat: number; lon: number; utc: number; when: [number, number, number, number, number]; sub: string }> = {
  Reykjavík: { lat: 64.147, lon: -21.942, utc: 0, when: [2000, 12, 21, 0, 0], sub: "21 December 2000 · 00:00 local" },
  Jerusalem: { lat: 31.778, lon: 35.235, utc: 2, when: [2000, 12, 21, 0, 0], sub: "21 December 2000 · 00:00 local" },
  Singapore: { lat: 1.352, lon: 103.82, utc: 8, when: [2000, 12, 21, 0, 0], sub: "21 December 2000 · 00:00 local" },
  Sydney: { lat: -33.869, lon: 151.209, utc: 10, when: [2000, 6, 21, 0, 0], sub: "21 June 2000 · 00:00 local" },
  Ushuaia: { lat: -54.801, lon: -68.303, utc: -3, when: [2000, 6, 21, 0, 0], sub: "21 June 2000 · 00:00 local" },
  Baikonur: { lat: 45.92, lon: 63.342, utc: 5, when: [1957, 10, 5, 0, 28], sub: "5 October 1957 · 00:28 local" },
  Boston: { lat: 42.36, lon: -71.059, utc: -5, when: [1833, 11, 13, 4, 0], sub: "13 November 1833 · 04:00 local" },
};

describe("personalised prints: the templates are the catalogue's", () => {
  it("the ten base designs come out byte for byte from the templates with the catalogue's inputs", () => {
    const base = CATALOGUE.filter((s) => s.variant === "sky-night" || s.variant === "moon-year");
    expect(base).toHaveLength(10);
    for (const s of base) {
      let body: string;
      if (s.variant === "moon-year") body = moonBody({ year: Number(/\d{4}/.exec(s.title)![0]) });
      else {
        const name = /over (.+?),/.exec(s.title)![1];
        const p = SKIES[name];
        const [y, mo, d, h, mi] = p.when;
        body = skyBody({ place: p, jd: julian(y, mo, d, h, mi) - p.utc / 24, caption: { title: name, sub: p.sub, sub2: latLon(p.lat, p.lon) } }, SKY);
      }
      expect(wrap(body, s.baseColor), s.id).toBe(print(s.n));
    }
  });

  it("templateFor: exactly the ten base designs", () => {
    const withTemplate = CATALOGUE.filter((s) => templateFor(s));
    expect(withTemplate.map((s) => s.variant).sort()).toEqual([...Array(7).fill("sky-night"), ...Array(3).fill("moon-year")].sort());
    expect(templateFor({ variant: "sky-night" })).toBe("sky");
    expect(templateFor({ variant: "moon-year" })).toBe("moon");
    expect(templateFor({ variant: "planets-date" })).toBeNull();
  });
});

const TLV: City = { id: 293397, name: "Tel Aviv", ascii: "Tel Aviv", country: "Israel", lat: 32.0809, lon: 34.7806, pop: 432892, tz: "Asia/Jerusalem" };
const cities = new Map([[TLV.id, TLV]]);
const byId = (id: number) => cities.get(id);

describe("personalised prints: a spec", () => {
  const sky = (p: Record<string, unknown>) => validate({ t: "sky", v: 1, p }, byId);
  it("is validated strictly: types, ranges, real dates, version, known city; extra keys dropped", () => {
    expect(sky({ c: TLV.id, d: "1991-03-14" })).toEqual({ t: "sky", v: 1, p: { c: TLV.id, d: "1991-03-14" } });
    expect(sky({ c: TLV.id, d: "1991-03-14", t: "23:05", x: 1 })).toEqual({ t: "sky", v: 1, p: { c: TLV.id, d: "1991-03-14", t: "23:05" } });
    expect(validate({ t: "sky", v: 1, p: { c: TLV.id, d: "1991-03-14" }, extra: true }, byId)).toEqual({ t: "sky", v: 1, p: { c: TLV.id, d: "1991-03-14" } });
    expect(sky({ c: TLV.id, d: "2000-02-29" })).not.toBeNull();
    expect(sky({ c: TLV.id, d: "1900-02-29" })).toBeNull();
    expect(sky({ c: TLV.id, d: "2023-02-29" })).toBeNull();
    for (const d of ["1899-12-31", "2101-01-01", "1991-3-14", "1991-13-01", "1991-04-31", 19910314, ""]) expect(sky({ c: TLV.id, d }), String(d)).toBeNull();
    expect(sky({ c: TLV.id, d: "1900-01-01" })).not.toBeNull();
    expect(sky({ c: TLV.id, d: "2100-12-31" })).not.toBeNull();
    for (const t of ["24:00", "7:05", "23:60", 2300, ""]) expect(sky({ c: TLV.id, d: "1991-03-14", t }), String(t)).toBeNull();
    for (const c of [0, -5, 1.5, "293397", 12345]) expect(sky({ c, d: "1991-03-14" }), String(c)).toBeNull();
    expect(validate({ t: "sky", v: 2, p: { c: TLV.id, d: "1991-03-14" } }, byId)).toBeNull();
    expect(validate({ t: "moon", v: 1, p: { y: 1991 } })).toEqual({ t: "moon", v: 1, p: { y: 1991 } });
    expect(validate({ t: "moon", v: 1, p: { y: 1991, s: 1 } })).toEqual({ t: "moon", v: 1, p: { y: 1991, s: 1 } });
    for (const p of [{ y: 1899 }, { y: 2101 }, { y: 1991.5 }, { y: "1991" }, { y: 1991, s: 0 }, { y: 1991, s: true }]) expect(validate({ t: "moon", v: 1, p }), JSON.stringify(p)).toBeNull();
    for (const bad of [null, 1, "x", [], { t: "planets", v: 1, p: {} }, { t: "moon", v: 1 }]) expect(validate(bad)).toBeNull();
  });

  it("round-trips through a link; garbage is null", () => {
    const specs: CustomSpec[] = [{ t: "sky", v: 1, p: { c: TLV.id, d: "1991-03-14", t: "23:00" } }, { t: "moon", v: 1, p: { y: 1969, s: 1 } }];
    for (const s of specs) {
      expect(decodeMake(encodeMake(s), byId)).toEqual(s);
      expect(encodeMake(s)).toMatch(/^[A-Za-z0-9_-]+$/);
    }
    for (const g of ["", "!!!", "eyJ0IjoibW9vbiJ9", "a".repeat(300), 42, null, btoa('{"t":"moon","v":1,"p":{"y":3000}}')]) expect(decodeMake(g, byId), String(g)).toBeNull();
    expect(specHash(specs[0])).toBe(specHash({ t: "sky", v: 1, p: { t: "23:00", d: "1991-03-14", c: TLV.id } } as unknown as CustomSpec));
    expect(specHash(specs[0])).not.toBe(specHash({ t: "sky", v: 1, p: { c: TLV.id, d: "1991-03-15", t: "23:00" } }));
  });

  it("titles and summaries", () => {
    const s: CustomSpec = { t: "sky", v: 1, p: { c: TLV.id, d: "1991-03-14" } };
    expect(customTitle(s, TLV)).toBe("Night Sky over Tel Aviv, 14 March 1991");
    expect(customSummary(s, TLV)).toBe("Tel Aviv · 14 March 1991");
    expect(customTitle({ t: "moon", v: 1, p: { y: 1991 } })).toBe("Moon Phases of 1991");
    expect(customSummary({ t: "moon", v: 1, p: { y: 1991 } })).toBe("1991");
  });

  it("renders the same print twice; the caption says the date, or the date and the local time given", () => {
    const s: CustomSpec = { t: "sky", v: 1, p: { c: TLV.id, d: "1991-03-14" } };
    const a = renderCustomSvg(s, "black", { sky: SKY, city: TLV });
    expect(renderCustomSvg(s, "black", { sky: SKY, city: TLV })).toBe(a);
    expect(a).toContain(">14 March 1991<");
    expect(a).toContain(">TEL AVIV<");
    expect(renderCustomSvg({ ...s, p: { ...s.p, t: "23:00" } }, "white", { sky: SKY, city: TLV })).toContain(">14 March 1991 · 23:00 local<");
    const south = renderCustomSvg({ t: "moon", v: 1, p: { y: 1991, s: 1 } }, "black", {});
    expect(south).toContain("Waxing lit on the left, as seen from the south");
    expect(south).not.toBe(renderCustomSvg({ t: "moon", v: 1, p: { y: 1991 } }, "black", {}));
  });
});

describe("personalised prints: local time to UTC, for that date", () => {
  const utc = (tz: string, y: number, mo: number, d: number, h: number, mi: number) => new Date(localToUtc(tz, y, mo, d, h, mi).utc).toISOString().slice(0, 16);
  it("keeps summer time and historic offsets", () => {
    // Israel: summer time from 29 March 2024 (02:00 → 03:00), back 27 October.
    expect(utc("Asia/Jerusalem", 2024, 3, 28, 22, 0)).toBe("2024-03-28T20:00");
    expect(utc("Asia/Jerusalem", 2024, 3, 30, 22, 0)).toBe("2024-03-30T19:00");
    expect(utc("America/New_York", 2024, 3, 9, 22, 0)).toBe("2024-03-10T03:00");
    expect(utc("America/New_York", 2024, 3, 10, 22, 0)).toBe("2024-03-11T02:00");
    expect(utc("Europe/London", 2024, 3, 30, 22, 0)).toBe("2024-03-30T22:00");
    expect(utc("Europe/London", 2024, 3, 31, 22, 0)).toBe("2024-03-31T21:00");
    expect(utc("Europe/London", 2024, 10, 26, 22, 0)).toBe("2024-10-26T21:00");
    expect(utc("Europe/London", 2024, 10, 27, 22, 0)).toBe("2024-10-27T22:00");
  });
  it("moves a time the clocks skip to the next minute that exists", () => {
    // New York, 10 March 2024: 02:00–02:59 doesn't exist; 02:30 is 03:00 EDT.
    const r = localToUtc("America/New_York", 2024, 3, 10, 2, 30);
    expect([new Date(r.utc).toISOString().slice(0, 16), r.h, r.mi]).toEqual(["2024-03-10T07:00", 3, 0]);
  });
  it("uses local mean time before a zone's standard time (Jerusalem, 1910: +2:20:40)", () => {
    expect(new Date(localToUtc("Asia/Jerusalem", 1910, 1, 1, 22, 0).utc).toISOString()).toBe("1910-01-01T19:39:20.000Z");
  });
});

describe("personalised prints: the data", () => {
  const citiesFile = readJson("data/cities/cities.json");
  const places = decodeCities(citiesFile);
  const gz = (s: string) => gzipSync(s).length / 1024;
  const published = publishedCustom();

  it("fits its budgets: cities ≤ 80 KB and the sky ≤ 30 KB gzipped, published under their content hashes", () => {
    expect(gz(published.cities.json)).toBeLessThanOrEqual(80);
    expect(gz(published.sky.json)).toBeLessThanOrEqual(30);
    const m = readJson("data/custom.manifest.json");
    expect(m).toEqual({ cities: published.cities.file, sky: published.sky.file });
    expect(readFileSync(path.join(ROOT, "public", "data", m.cities), "utf8")).toBe(published.cities.json);
  });

  it("the place list is sorted by id, credits its source, and every zone is one this runtime knows", () => {
    expect(citiesFile.credit).toBe("GeoNames, CC BY 4.0");
    const ids: number[] = citiesFile.id;
    expect(ids.every((id, i) => i === 0 || id > ids[i - 1])).toBe(true);
    for (const z of citiesFile.zones as string[]) expect(() => new Intl.DateTimeFormat("en", { timeZone: z }), z).not.toThrow();
    // National capitals are kept whatever their size (Reykjavík, about 120,000 people).
    expect(places.list.some((c) => c.name === "Reykjavík")).toBe(true);
  });

  it("finds cities by the start of a word of the city or country, accents folded, the biggest first", () => {
    const names = (q: string) => searchCities(places, q).map((c) => `${c.name}, ${c.country}`);
    expect(names("tel")[0]).toBe("Tel Aviv, Israel");
    expect(names("york")).toContain("New York City, United States");
    expect(names("reykjavik")[0]).toBe("Reykjavík, Iceland");
    expect(searchCities(places, "a")).toHaveLength(6);
    expect(names("zzzz")).toEqual([]);
    expect(names("israel").length).toBeGreaterThan(0);
  });

  it("the sky data draws the same charts as the catalogue's full star list", () => {
    const s: CustomSpec = { t: "sky", v: 1, p: { c: TLV.id, d: "1991-03-14" } };
    const full = renderCustomSvg(s, "black", { sky: SKY, city: TLV });
    expect(renderCustomSvg(s, "black", { sky: JSON.parse(published.sky.json), city: TLV })).toBe(full);
  });
});
