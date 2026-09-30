import { describe, expect, it } from "vitest";
import airportsFile from "../../data/airports/airports.json";
import countriesFile from "../../data/countries/countries.json";
import { decodeAirports, decodeCountries, searchAirports, type AirportsFile, type CountriesFile } from "@/lib/custom/data";
import { EE_X, EE_Y, equalEarth } from "@/lib/custom/equalEarth";
import { WORDS } from "@/lib/custom/specKit";

const countries = decodeCountries(countriesFile as unknown as CountriesFile);
const airports = decodeAirports(airportsFile as unknown as AirportsFile);

describe("Make: the countries (Natural Earth, public domain)", () => {
  it("Equal Earth: the edges of the world where they should be", () => {
    expect(equalEarth(0, 0)).toEqual([0, 0]);
    expect(equalEarth(180, 0)[0]).toBeCloseTo(EE_X, 3);
    expect(equalEarth(0, 90)[1]).toBeCloseTo(EE_Y, 3);
  });
  it("every country has a unique alpha-3, a printable name and a point; the big ones an outline, the tiny ones none", () => {
    expect(countries.list.length).toBeGreaterThan(200);
    expect(new Set(countries.list.map((c) => c.a3)).size).toBe(countries.list.length);
    for (const c of countries.list) {
      expect(WORDS.test(c.name), c.name).toBe(true);
      expect(Math.abs(c.point[0]) <= EE_X * 1000 && Math.abs(c.point[1]) <= EE_Y * 1000, c.name).toBe(true);
      expect(c.rings.length === 0 || c.area > 0, c.name).toBe(true);
    }
    for (const a3 of ["FRA", "ISR", "JPN", "BRA", "AUS"]) expect(countries.byA3(a3)!.rings.length, a3).toBeGreaterThan(0);
    for (const a3 of ["MCO", "VAT", "SGP", "MLT", "LIE"]) expect(countries.byA3(a3)!.rings, a3).toEqual([]);
  });
});

describe("Make: the airports (OurAirports, public domain)", () => {
  it("unique IATA codes, printable names, real coordinates", () => {
    expect(airports.list.length).toBeGreaterThan(1500);
    expect(new Set(airports.list.map((a) => a.iata)).size).toBe(airports.list.length);
    for (const a of airports.list) {
      expect(/^[A-Z]{3}$/.test(a.iata)).toBe(true);
      expect(WORDS.test(a.name) && WORDS.test(a.city), a.iata).toBe(true);
      expect(Math.abs(a.lat) <= 90 && Math.abs(a.lon) <= 180, a.iata).toBe(true);
    }
  });
  it("search by code, then by city or name", () => {
    expect(searchAirports(airports, "nrt")[0].iata).toBe("NRT");
    expect(searchAirports(airports, "heathrow")[0].iata).toBe("LHR");
    expect(searchAirports(airports, "tel aviv").map((a) => a.iata)).toContain("TLV");
    expect(searchAirports(airports, "")).toEqual([]);
  });
});
