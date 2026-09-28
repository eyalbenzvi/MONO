/**
 * The place list of the personalised sky prints (run by hand; needs the
 * network): GeoNames' cities15000 and countryInfo, kept to cities of at least
 * POP_FLOOR people plus every national capital, written as
 * data/cities/cities.json in columns (as data/shirts.index.json). Ids are
 * GeoNames ids, so a shared link keeps naming the same city. Deterministic:
 * sorted by id, coordinates to 4 decimals, no timestamp.
 *
 *   tsx scripts/tools/buildCities.ts
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../..");
const CACHE = path.join(ROOT, "node_modules", ".cache", "mono-cities");
const OUT = path.join(ROOT, "data", "cities", "cities.json");
const BASE = "https://download.geonames.org/export/dump";
/** Cities this big or more: 100,000 was over the 80 KB (gzipped) budget at 134 KB; 200,000 fits (71 KB, tests/custom.test.ts). */
export const POP_FLOOR = Number(process.env.POP_FLOOR ?? 200000);

async function fetchTo(url: string, file: string) {
  if (existsSync(file)) return;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  writeFileSync(file, Buffer.from(await r.arrayBuffer()));
}

async function main() {
  mkdirSync(CACHE, { recursive: true });
  await fetchTo(`${BASE}/cities15000.zip`, path.join(CACHE, "cities15000.zip"));
  await fetchTo(`${BASE}/countryInfo.txt`, path.join(CACHE, "countryInfo.txt"));
  const countries = new Map<string, string>();
  for (const line of readFileSync(path.join(CACHE, "countryInfo.txt"), "utf8").split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const c = line.split("\t");
    countries.set(c[0], c[4]);
  }
  const tsv = execFileSync("unzip", ["-p", path.join(CACHE, "cities15000.zip"), "cities15000.txt"], { maxBuffer: 1 << 30 }).toString("utf8");
  const rows: { id: number; name: string; ascii: string; country: string; lat: number; lon: number; pop: number; tz: string }[] = [];
  for (const line of tsv.split("\n")) {
    const c = line.split("\t");
    if (c.length < 18) continue;
    const pop = Number(c[14]);
    const capital = c[7] === "PPLC";
    if (pop < POP_FLOOR && !capital) continue;
    const country = countries.get(c[8]);
    if (!country || !c[17]) continue;
    const r4 = (v: string) => Math.round(Number(v) * 1e4) / 1e4;
    rows.push({ id: Number(c[0]), name: c[1], ascii: c[2], country, lat: r4(c[4]), lon: r4(c[5]), pop, tz: c[17] });
  }
  rows.sort((a, b) => a.id - b.id);
  const zones = [...new Set(rows.map((r) => r.tz))].sort();
  const head = {
    source: "GeoNames cities15000 and countryInfo (download.geonames.org/export/dump)",
    credit: "GeoNames, CC BY 4.0",
    kept: `population ≥ ${POP_FLOOR.toLocaleString("en-GB")}, and every national capital`,
    zones,
  };
  const columns = {
    id: rows.map((r) => r.id),
    name: rows.map((r) => r.name),
    // Empty where it's the name itself (most are).
    ascii: rows.map((r) => (r.ascii === r.name ? "" : r.ascii)),
    country: rows.map((r) => r.country),
    lat: rows.map((r) => r.lat),
    lon: rows.map((r) => r.lon),
    pop: rows.map((r) => r.pop),
    tz: rows.map((r) => zones.indexOf(r.tz)),
  };
  const body = Object.entries({ ...head, ...columns }).map(([k, v]) => `${JSON.stringify(k)}:${JSON.stringify(v)}`);
  writeFileSync(OUT, `{\n${body.join(",\n")}\n}\n`);
  console.log(`${rows.length} cities, ${zones.length} zones → ${path.relative(ROOT, OUT)}`);
}

main().catch((e) => (console.error(e), process.exit(1)));
