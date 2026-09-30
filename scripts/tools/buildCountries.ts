/**
 * The countries of Your Countries (run by hand; needs the network): Natural
 * Earth's Admin 0 countries at 1:110m (public domain), each outline
 * projected in Equal Earth (lib/custom/equalEarth), simplified
 * (Douglas-Peucker) and rounded to thousandths; and the tiny countries 1:110m
 * leaves out (Natural Earth's tiny countries points, 1:50m) as a point each.
 * Written as data/countries/countries.json in columns. Deterministic: sorted
 * by name, no timestamp.
 *
 *   tsx scripts/tools/buildCountries.ts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { equalEarth } from "../../lib/custom/equalEarth";

const ROOT = path.resolve(__dirname, "../..");
const CACHE = path.join(ROOT, "node_modules", ".cache", "mono-countries");
const OUT = path.join(ROOT, "data", "countries", "countries.json");
const BASE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson";
/** Simplification tolerance in projected units (the world is 5.4 across; the print draws it 280 wide: 0.004 is a fifth of a print unit). */
const TOLERANCE = 0.004;
/** Rounding: thousandths of a unit, as integers. */
const Q = 1000;

async function fetchTo(url: string, file: string) {
  if (existsSync(file)) return;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  writeFileSync(file, Buffer.from(await r.arrayBuffer()));
}

type Ring = [number, number][];
function simplify(pts: Ring, tol: number): Ring {
  if (pts.length < 4) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let far = -1, best = tol;
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((bx - ax) * (ay - pts[i][1]) - (ax - pts[i][0]) * (by - ay)) / len;
      if (d > best) (best = d), (far = i);
    }
    if (far >= 0) (keep[far] = 1), stack.push([a, far], [far, b]);
  }
  return pts.filter((_, i) => keep[i]);
}

/** A closed ring simplified: split at its farthest point from the start (a ring's ends are one point, so no line joins them), each half simplified. */
function simplifyRing(pts: Ring, tol: number): Ring {
  let m = 0;
  pts.forEach(([x, y], i) => {
    if (Math.hypot(x - pts[0][0], y - pts[0][1]) > Math.hypot(pts[m][0] - pts[0][0], pts[m][1] - pts[0][1])) m = i;
  });
  if (m === 0) return [];
  return [...simplify(pts.slice(0, m + 1), tol), ...simplify(pts.slice(m), tol).slice(1)];
}

const area = (r: Ring) => Math.abs(r.reduce((s, [x, y], i) => { const [x2, y2] = r[(i + 1) % r.length]; return s + x * y2 - x2 * y; }, 0)) / 2;

interface Feature { properties: Record<string, string | number>; geometry: { type: string; coordinates: unknown } }
const codeOf = (p: Feature["properties"]) => [String(p.ISO_A2_EH), String(p.ADM0_A3)] as const;

async function main() {
  mkdirSync(CACHE, { recursive: true });
  const big = path.join(CACHE, "ne_110m_admin_0_countries.geojson");
  const tiny = path.join(CACHE, "ne_50m_admin_0_tiny_countries.geojson");
  await fetchTo(`${BASE}/ne_110m_admin_0_countries.geojson`, big);
  await fetchTo(`${BASE}/ne_50m_admin_0_tiny_countries.geojson`, tiny);
  const rows: { a2: string; a3: string; name: string; rings: number[][]; point: [number, number]; area: number }[] = [];
  const seen = new Set<string>();
  for (const f of (JSON.parse(readFileSync(big, "utf8")) as { features: Feature[] }).features) {
    const [a2, a3] = codeOf(f.properties);
    const polys = (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates) as [number, number][][][];
    const rings: number[][] = [];
    let total = 0;
    for (const poly of polys)
      for (const ring of poly.slice(0, 1)) {
        // Outer rings only (a 1:110m hole is a lake or an enclave the print wouldn't show).
        const r = simplifyRing(ring.map(([lo, la]) => equalEarth(lo, la)), TOLERANCE);
        if (r.length < 4) continue;
        total += area(r);
        rings.push(r.flatMap(([x, y]) => [Math.round(x * Q), Math.round(-y * Q)]));
      }
    const [lx, ly] = equalEarth(Number(f.properties.LABEL_X), Number(f.properties.LABEL_Y));
    const key = a2 !== "-99" ? a2 : a3;
    seen.add(key);
    rows.push({ a2: a2 === "-99" ? "" : a2, a3, name: String(f.properties.NAME_EN || f.properties.NAME), rings, point: [Math.round(lx * Q), Math.round(-ly * Q)], area: Math.round(total * Q * Q) });
  }
  for (const f of (JSON.parse(readFileSync(tiny, "utf8")) as { features: Feature[] }).features) {
    const [a2, a3] = codeOf(f.properties);
    // A tiny country the 1:110m map already has (Ascension is Britain's, the Canaries Spain's) isn't a country of its own here.
    if (a2 === "-99" || seen.has(a2) || !/^(Sovereign country|Country|Dependency)$/.test(String(f.properties.TYPE))) continue;
    seen.add(a2);
    const [lo, la] = f.geometry.coordinates as [number, number];
    const [x, y] = equalEarth(lo, la);
    rows.push({ a2, a3, name: String(f.properties.NAME_EN || f.properties.NAME), rings: [], point: [Math.round(x * Q), Math.round(-y * Q)], area: 0 });
  }
  // Natural Earth leaves Cabo Verde out of both the 1:110m countries and the tiny countries: a United Nations member, it goes in as a point at Praia.
  if (!seen.has("CV")) {
    const [x, y] = equalEarth(-23.51, 14.93);
    rows.push({ a2: "CV", a3: "CPV", name: "Cabo Verde", rings: [], point: [Math.round(x * Q), Math.round(-y * Q)], area: 0 });
  }
  rows.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const out = {
    source: "Natural Earth, Admin 0 countries 1:110m and tiny countries 1:50m (naturalearthdata.com, via github.com/nvkelso/natural-earth-vector)",
    credit: "Natural Earth, public domain",
    projection: "Equal Earth; x east, y down; thousandths of a unit (the world is about 5.41 by 2.63)",
    a2: rows.map((r) => r.a2),
    a3: rows.map((r) => r.a3),
    name: rows.map((r) => r.name),
    point: rows.map((r) => r.point),
    area: rows.map((r) => r.area),
    rings: rows.map((r) => r.rings),
  };
  mkdirSync(path.dirname(OUT), { recursive: true });
  const json = `{\n${Object.entries(out).map(([k, v]) => `${JSON.stringify(k)}:${JSON.stringify(v)}`).join(",\n")}\n}\n`;
  writeFileSync(OUT, json);
  console.log(`countries: ${rows.length} (${rows.filter((r) => !r.rings.length).length} as points), ${(json.length / 1024).toFixed(0)} KB`);
}

if (require.main === module) void main();
