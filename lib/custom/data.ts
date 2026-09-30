/**
 * The personalised prints' data in the browser: the place list and the sky
 * (published by scripts/tools/publishCustom.ts), each fetched once on first
 * need and kept. The editor warms both when its entry is pointed at.
 */
import manifest from "@/data/custom.manifest.json";
import { assetUrl } from "@/lib/catalog";
import { clean } from "@/lib/search/normalize";
import type { ArtFile } from "./art";
import type { City } from "./spec";
import type { SkyData } from "./templates/sky";

/** data/cities/cities.json: one column per field, zones as indexes. */
export interface CitiesFile {
  zones: string[];
  id: number[];
  name: string[];
  ascii: string[];
  country: string[];
  lat: number[];
  lon: number[];
  pop: number[];
  tz: number[];
}

export interface Places {
  list: City[];
  byId: (id: number) => City | undefined;
  /** Each city's words, cleaned (name, its ASCII spelling, country), for the search. */
  words: string[][];
}

export function decodeCities(f: CitiesFile): Places {
  const list: City[] = f.id.map((id, i) => ({ id, name: f.name[i], ascii: f.ascii[i] || f.name[i], country: f.country[i], lat: f.lat[i], lon: f.lon[i], pop: f.pop[i], tz: f.zones[f.tz[i]] }));
  const map = new Map(list.map((c) => [c.id, c]));
  const words = list.map((c) => [...new Set(clean(`${c.name} ${c.ascii} ${c.country}`).split(" ").filter(Boolean))]);
  return { list, byId: (id) => map.get(id), words };
}

let cities: Promise<Places> | null = null;
let sky: Promise<SkyData> | null = null;
const get = <T>(file: string) => fetch(assetUrl(`/data/${file}`)).then((r) => (r.ok ? (r.json() as Promise<T>) : Promise.reject(new Error(`${file}: ${r.status}`))));

export function loadCities(): Promise<Places> {
  cities ??= get<CitiesFile>(manifest.cities).then(decodeCities);
  // A failed fetch may be tried again later.
  cities.catch(() => (cities = null));
  return cities;
}
export function loadSky(): Promise<SkyData> {
  sky ??= get<SkyData>(manifest.sky);
  sky.catch(() => (sky = null));
  return sky;
}

/** data/countries/countries.json: Natural Earth's countries in Equal Earth (scripts/tools/buildCountries.ts), in columns. */
export interface CountriesFile {
  a2: string[];
  a3: string[];
  name: string[];
  /** A label point (or the country itself, when it's too small for an outline), thousandths of a unit, y down. */
  point: [number, number][];
  /** The outline's area, square thousandths (0 for a point). */
  area: number[];
  /** Outer rings, each x, y, x, y… in thousandths of a unit, y down. */
  rings: number[][][];
}
export interface Country {
  /** ISO 3166-1 alpha-2 ("" for a country without one), then alpha-3 (Natural Earth's, always set: the id). */
  a2: string;
  a3: string;
  name: string;
  point: [number, number];
  area: number;
  rings: number[][];
}
export interface Countries {
  list: Country[];
  byA3: (a3: string) => Country | undefined;
}
export function decodeCountries(f: CountriesFile): Countries {
  const list = f.a3.map((a3, i) => ({ a2: f.a2[i], a3, name: f.name[i], point: f.point[i], area: f.area[i], rings: f.rings[i] }));
  const map = new Map(list.map((c) => [c.a3, c]));
  return { list, byA3: (a3) => map.get(a3) };
}

/** data/airports/airports.json: OurAirports' airports with an IATA code (scripts/tools/buildAirports.ts), in columns. */
export interface AirportsFile {
  iata: string[];
  name: string[];
  city: string[];
  country: string[];
  lat: number[];
  lon: number[];
}
export interface Airport {
  iata: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
}
export interface Airports {
  list: Airport[];
  byCode: (iata: string) => Airport | undefined;
}
export function decodeAirports(f: AirportsFile): Airports {
  const list = f.iata.map((iata, i) => ({ iata, name: f.name[i], city: f.city[i], country: f.country[i], lat: f.lat[i], lon: f.lon[i] }));
  const map = new Map(list.map((a) => [a.iata, a]));
  return { list, byCode: (c) => map.get(c.toUpperCase()) };
}

let countries: Promise<Countries> | null = null;
let airports: Promise<Airports> | null = null;
export function loadCountries(): Promise<Countries> {
  countries ??= get<CountriesFile>(manifest.countries).then(decodeCountries);
  countries.catch(() => (countries = null));
  return countries;
}
export function loadAirports(): Promise<Airports> {
  airports ??= get<AirportsFile>(manifest.airports).then(decodeAirports);
  airports.catch(() => (airports = null));
  return airports;
}

const art = new Map<string, Promise<ArtFile>>();
/** A traced picture of the Make prints ("dinosaurs/triceratops"), fetched once; rejected when there's none by that name. */
export function loadArt(key: string): Promise<ArtFile> {
  const file = (manifest.art as Record<string, string>)[key];
  if (!file) return Promise.reject(new Error(`no picture ${key}`));
  if (!art.has(key)) {
    const p = get<ArtFile>(file);
    p.catch(() => art.delete(key));
    art.set(key, p);
  }
  return art.get(key)!;
}

/** Up to n airports for what's typed: its code first ("nrt"), then word starts of its city or name ("tokyo", "heathrow"), accents folded; the biggest names first. */
export function searchAirports(list: Airports, q: string, n = 6): Airport[] {
  const code = q.trim().toUpperCase();
  const exact = /^[A-Z]{3}$/.test(code) ? list.byCode(code) : undefined;
  const qs = clean(q).split(" ").filter(Boolean);
  if (!qs.length) return [];
  const hits = list.list.filter((a) => a !== exact && qs.every((x) => clean(`${a.city} ${a.name}`).split(" ").some((y) => y.startsWith(x))));
  // A city's own airport first ("London" before London's smaller fields' namesakes elsewhere), then by name.
  hits.sort((a, b) => Number(!clean(a.city).startsWith(qs[0])) - Number(!clean(b.city).startsWith(qs[0])) || (a.name < b.name ? -1 : 1));
  return [...(exact ? [exact] : []), ...hits].slice(0, n);
}

/**
 * Up to n cities for what's typed: every word of it starts a word of the
 * city's name or country ("tel" → Tel Aviv; "york" → New York), accents
 * folded ("reykjavik" → Reykjavík). Names that start with it first, then the
 * biggest.
 */
export function searchCities(places: Places, q: string, n = 6): City[] {
  const qs = clean(q).split(" ").filter(Boolean);
  if (!qs.length) return [];
  const head = qs.join(" ");
  const hits: { c: City; lead: number }[] = [];
  places.list.forEach((c, i) => {
    const w = places.words[i];
    if (!qs.every((x) => w.some((y) => y.startsWith(x)))) return;
    const lead = clean(c.name).startsWith(head) || clean(c.ascii).startsWith(head) ? 0 : 1;
    hits.push({ c, lead });
  });
  return hits.sort((a, b) => a.lead - b.lead || b.c.pop - a.c.pop || a.c.id - b.c.id).slice(0, n).map((h) => h.c);
}
