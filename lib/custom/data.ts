/**
 * The personalised prints' data in the browser: the place list and the sky
 * (published by scripts/tools/publishCustom.ts), each fetched once on first
 * need and kept. The editor warms both when its entry is pointed at.
 */
import manifest from "@/data/custom.manifest.json";
import { assetUrl } from "@/lib/catalog";
import { clean } from "@/lib/search/normalize";
import type { City } from "./index";
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
