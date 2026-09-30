/**
 * Every Make template drawn as the page draws it, in the tests: the data a
 * template needs (the sky, the place list, a spec's city) read from data/,
 * never fetched.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import cities from "../../data/cities/cities.json";
import countriesFile from "../../data/countries/countries.json";
import airportsFile from "../../data/airports/airports.json";
import { decodeAirports, decodeCities, decodeCountries, type AirportsFile, type CitiesFile, type CountriesFile } from "@/lib/custom/data";
import { loadRenderer, type RenderData } from "@/lib/custom/renderers";
import type { CustomSpec } from "@/lib/custom/spec";

const ROOT = path.resolve(__dirname, "..", "..");
const readJson = (f: string) => JSON.parse(readFileSync(path.join(ROOT, f), "utf8"));

export const places = decodeCities(cities as unknown as CitiesFile);
export const countries = decodeCountries(countriesFile as unknown as CountriesFile);
export const airports = decodeAirports(airportsFile as unknown as AirportsFile);
export const SKY = { stars: readJson("data/sky/stars.json"), lines: (readJson("data/sky/constellations.json") as { lines: [number, number][][] }[]).flatMap((c) => c.lines) };

/** What any template may need, for a spec: the sky, every place, and the spec's own city. */
export function dataFor(spec: CustomSpec): RenderData {
  const c = (spec.p as { c?: unknown }).c;
  return { sky: SKY, places: places.list, countries, airports, ...(typeof c === "number" ? { city: places.byId(c) } : {}) };
}

/** A spec drawn in a colour, with its data. */
export async function drawSpec(spec: CustomSpec, color: "black" | "white"): Promise<string> {
  return (await loadRenderer(spec.t))(spec, color, dataFor(spec));
}
