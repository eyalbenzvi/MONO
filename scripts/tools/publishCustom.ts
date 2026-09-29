/**
 * Publishes the personalised prints' data for the browser, before every build
 * (npm "prebuild", beside publishIndex): public/data/cities.<hash>.json (the
 * place list, data/cities) and public/data/sky.<hash>.json (the stars the
 * charts draw, magnitude 4.8 and brighter, and the constellation figures, from
 * data/sky), public/data/countries.<hash>.json (Your Countries' outlines,
 * data/countries) and public/data/airports.<hash>.json (Your Flights'
 * airports, data/airports), named by their content, and
 * data/custom.manifest.json, which the app imports to know those names.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../..");
const DIR = path.join(ROOT, "public", "data");
const MANIFEST = path.join(ROOT, "data", "custom.manifest.json");
/** The faintest star a chart draws (lib/custom/templates/sky): fainter ones would only be skipped. */
const FAINTEST = 4.8;

const read = (...p: string[]) => JSON.parse(readFileSync(path.join(ROOT, ...p), "utf8"));
const named = (stem: string, json: string) => ({ json, file: `${stem}.${createHash("sha256").update(json).digest("hex").slice(0, 10)}.json` });

export function publishedCustom() {
  const stars = (read("data", "sky", "stars.json") as [number, number, number][]).filter((s) => s[2] <= FAINTEST);
  const lines = (read("data", "sky", "constellations.json") as { lines: [number, number][][] }[]).flatMap((c) => c.lines);
  return {
    cities: named("cities", JSON.stringify(read("data", "cities", "cities.json"))),
    sky: named("sky", JSON.stringify({ stars, lines })),
    countries: named("countries", JSON.stringify(read("data", "countries", "countries.json"))),
    airports: named("airports", JSON.stringify(read("data", "airports", "airports.json"))),
  };
}

if (require.main === module) {
  const out = publishedCustom();
  mkdirSync(DIR, { recursive: true });
  const files = new Set(Object.values(out).map((o) => o.file));
  for (const f of readdirSync(DIR)) if (/^(cities|sky|countries|airports)\.[0-9a-f]+\.json$/.test(f) && !files.has(f)) rmSync(path.join(DIR, f));
  for (const { json, file } of Object.values(out)) writeFileSync(path.join(DIR, file), json);
  writeFileSync(MANIFEST, `${JSON.stringify(Object.fromEntries(Object.entries(out).map(([k, o]) => [k, o.file])), null, 2)}\n`);
  console.log(`custom → ${Object.values(out).map((o) => `public/data/${o.file} (${(o.json.length / 1024).toFixed(0)} KB)`).join(", ")}`);
}
