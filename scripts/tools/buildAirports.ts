/**
 * The airports of Your Flights (run by hand; needs the network): OurAirports'
 * airports.csv (public domain), kept to large airports and medium airports
 * with scheduled service, each with an IATA code. Written as
 * data/airports/airports.json in columns: IATA code, name, city, country
 * (ISO 3166-1 alpha-2), latitude and longitude to two decimals. Names in a
 * script the print can't set are left out (the words' rule is Latin).
 * Deterministic: sorted by code, no timestamp.
 *
 *   tsx scripts/tools/buildAirports.ts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { WORDS } from "../../lib/custom/specKit";

const ROOT = path.resolve(__dirname, "../..");
const CACHE = path.join(ROOT, "node_modules", ".cache", "mono-airports");
const OUT = path.join(ROOT, "data", "airports", "airports.json");
const URL = "https://davidmegginson.github.io/ourairports-data/airports.csv";

/** One CSV line into fields (quoted fields may hold commas and doubled quotes). */
function fields(line: string): string[] {
  const out: string[] = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') (cur += '"'), i++;
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") out.push(cur), (cur = "");
    else cur += ch;
  }
  out.push(cur);
  return out;
}

/** A name as the print sets it: spaces tidied, and only when the words' rule allows it. */
/** A name as the print can set it: dashes and quotes made plain ("Rome–Fiumicino" was dropped for its dash), else "" when a character still can't print. */
const printable = (s: string) => {
  const t = s
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[\u2018\u2019\u02bc]/g, "'")
    .replace(/[\u201c\u201d"]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return t && WORDS.test(t) ? t : "";
};

async function main() {
  mkdirSync(CACHE, { recursive: true });
  const file = path.join(CACHE, "airports.csv");
  if (!existsSync(file)) {
    const r = await fetch(URL);
    if (!r.ok) throw new Error(`${URL}: HTTP ${r.status}`);
    writeFileSync(file, Buffer.from(await r.arrayBuffer()));
  }
  const [head, ...lines] = readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean);
  const col = Object.fromEntries(fields(head).map((h, i) => [h, i]));
  const byCode = new Map<string, { iata: string; name: string; city: string; country: string; lat: number; lon: number }>();
  for (const line of lines) {
    const f = fields(line);
    const type = f[col.type], iata = f[col.iata_code];
    if (!/^[A-Z]{3}$/.test(iata)) continue;
    if (!(type === "large_airport" || (type === "medium_airport" && f[col.scheduled_service] === "yes"))) continue;
    const name = printable(f[col.name]);
    // The city as a board shows it: "Paris", not "Paris (Roissy-en-France, Val-d'Oise)".
    const city = printable(f[col.municipality].replace(/\s*\(.*\)\s*$/, "")) || name;
    if (!name) continue;
    const prev = byCode.get(iata);
    // One airport per code: a large one over a medium one.
    if (prev && type !== "large_airport") continue;
    byCode.set(iata, { iata, name, city, country: f[col.iso_country], lat: Math.round(Number(f[col.latitude_deg]) * 100) / 100, lon: Math.round(Number(f[col.longitude_deg]) * 100) / 100 });
  }
  const rows = [...byCode.values()].sort((a, b) => (a.iata < b.iata ? -1 : 1));
  const out = {
    source: "OurAirports, airports.csv (ourairports.com/data, via davidmegginson.github.io/ourairports-data)",
    credit: "OurAirports, public domain",
    kept: "large airports, and medium airports with scheduled service, with an IATA code",
    iata: rows.map((r) => r.iata),
    name: rows.map((r) => r.name),
    city: rows.map((r) => r.city),
    country: rows.map((r) => r.country),
    lat: rows.map((r) => r.lat),
    lon: rows.map((r) => r.lon),
  };
  mkdirSync(path.dirname(OUT), { recursive: true });
  const json = `{\n${Object.entries(out).map(([k, v]) => `${JSON.stringify(k)}:${JSON.stringify(v)}`).join(",\n")}\n}\n`;
  writeFileSync(OUT, json);
  console.log(`airports: ${rows.length}, ${(json.length / 1024).toFixed(0)} KB`);
}

if (require.main === module) void main();
