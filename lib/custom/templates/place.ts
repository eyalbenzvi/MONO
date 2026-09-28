/**
 * Your Place: where you were when it happened. The globe turned so the
 * place sits at its centre (orthographic, as a navigator's globe is drawn),
 * a 15° graticule, and the world's cities of 200,000 people or more as dots
 * (data/cities, GeoNames): the only land drawn, so the continents show in
 * the lights of their cities, with no coastline data to carry. The place is
 * a target of rings; under the globe, the hours of daylight every day of
 * that year at that latitude (the catalogue's Daylight charts, NOAA's
 * solar declination), the day itself drawn bold.
 */
import { INK, caption, circle, f1, line, longDate, shortMonth, text } from "../kit";
import { coords, parseDate, type City, type CustomSpec, type PlaceParams } from "../spec";
import { wrap } from "../svg";
import type { RenderData } from "../renderers";
import type { BaseColor } from "@/types/shirt";

const DEG = Math.PI / 180;
const CX = 150, CY = 122, R = 96;
const MONTH_START = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];

/** The sun's declination (rad) on a day of the year (NOAA's series, as the catalogue's Daylight charts). */
function declination(doy: number): number {
  const g = ((2 * Math.PI) / 365) * (doy - 1);
  return 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
}
/** Hours from sunrise to sunset (the sun's upper limb, with refraction: −0.833°). */
export function daylight(lat: number, doy: number): number {
  const phi = lat * DEG, decl = declination(doy);
  const c = (Math.sin(-0.833 * DEG) - Math.sin(phi) * Math.sin(decl)) / (Math.cos(phi) * Math.cos(decl));
  return c <= -1 ? 24 : c >= 1 ? 0 : (2 * Math.acos(c)) / DEG / 15;
}
const dayOfYear = (y: number, m: number, d: number) => Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86_400_000) + 1;
const hm = (h: number) => (h >= 24 ? "24h (midnight sun)" : h <= 0 ? "0h (polar night)" : `${Math.floor(h)}h ${String(Math.round((h % 1) * 60) % 60).padStart(2, "0")}m`);

export function placeBody(p: PlaceParams, places: City[] = [], city?: City): string {
  const phi0 = p.la * DEG, lam0 = p.lo * DEG;
  const [s0, c0] = [Math.sin(phi0), Math.cos(phi0)];
  /** Screen position and whether it faces us. */
  const project = (lat: number, lon: number): [number, number, boolean] => {
    const phi = lat * DEG, dl = lon * DEG - lam0;
    const cosc = s0 * Math.sin(phi) + c0 * Math.cos(phi) * Math.cos(dl);
    return [CX + R * Math.cos(phi) * Math.sin(dl), CY - R * (c0 * Math.sin(phi) - s0 * Math.cos(phi) * Math.cos(dl)), cosc >= 0];
  };
  // The graticule, broken where it goes round the back.
  let d = "";
  const trace = (pts: [number, number, boolean][]) => {
    let pen = false;
    for (const [x, y, v] of pts) {
      if (!v) {
        pen = false;
        continue;
      }
      d += `${pen ? "L" : "M"}${f1(x)} ${f1(y)}`;
      pen = true;
    }
  };
  for (let lat = -75; lat <= 75; lat += 15) trace(Array.from({ length: 145 }, (_, i) => project(lat, -180 + i * 2.5)));
  for (let lon = -180; lon < 180; lon += 15) trace(Array.from({ length: 73 }, (_, i) => project(-90 + i * 2.5, lon)));
  let s = `<path d="${d}" fill="none" stroke="${INK}" stroke-width=".45"/>` + circle(CX, CY, R, 1.4);
  // The cities facing us, sized by population, none on the target itself.
  let dots = "";
  for (const c of places) {
    const [x, y, v] = project(c.lat, c.lon);
    if (!v || Math.hypot(x - CX, y - CY) < 16) continue;
    dots += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(Math.min(1.6, 0.7 + 0.3 * Math.log10(Math.max(1, c.pop / 2e5))))}" fill="${INK}"/>`;
  }
  s += dots;
  // The place: rings, a cross with a gap, a dot.
  s += circle(CX, CY, 6, 1) + circle(CX, CY, 12, 0.7) + `<circle cx="${CX}" cy="${CY}" r="2.2" fill="${INK}"/>`;
  s += line(CX - 22, CY, CX - 14, CY, 1) + line(CX + 14, CY, CX + 22, CY, 1) + line(CX, CY - 22, CX, CY - 14, 1) + line(CX, CY + 14, CX, CY + 22, 1);

  // The year's daylight at this latitude, one bar every third day; the day bold.
  const date = p.d ? parseDate(p.d) : null;
  const year = date?.[0] ?? 2025;
  const days = Math.round((Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 86_400_000);
  const X0 = 44, XW = 212, Y0 = 300, YH = 60;
  let bars = "";
  for (let doy = 1; doy <= days; doy += 3) {
    const h = daylight(p.la, doy);
    if (h > 0.05) bars += `M${f1(X0 + ((doy - 1) / (days - 1)) * XW)} ${Y0}V${f1(Y0 - (h / 24) * YH)}`;
  }
  s += `<path d="${bars}" fill="none" stroke="${INK}" stroke-width=".6"/>` + line(X0 - 4, Y0, X0 + XW + 4, Y0, 0.9);
  for (const h of [12, 24]) s += line(X0 - 4, Y0 - (h / 24) * YH, X0 - 1, Y0 - (h / 24) * YH, 0.8) + text(X0 - 7, Y0 - (h / 24) * YH + 2, `${h}h`, 5, { anchor: "end" });
  MONTH_START.forEach((doy, m) => (s += text(X0 + ((doy + 14) / (days - 1)) * XW, Y0 + 9, shortMonth(m + 1)[0], 5)));
  let sub2: string | undefined;
  if (date) {
    const doy = dayOfYear(...date);
    const h = daylight(p.la, doy);
    const x = X0 + ((doy - 1) / (days - 1)) * XW;
    s += line(x, Y0 + 2, x, Y0 - YH - 4, 2) + circle(x, Y0 - YH - 7, 2.4, 1);
    sub2 = `${longDate(...date)} · ${hm(h)} of daylight`;
  }
  const where = coords(p.la, p.lo);
  const title = p.w ?? city?.name ?? where;
  return s + caption(342, title, title === where ? (city ? `${city.name}, ${city.country}` : "Where I was") : where, sub2);
}

export const render = (spec: CustomSpec, color: BaseColor, data: RenderData = {}) => {
  const p = (spec as { p: PlaceParams }).p;
  const city = p.c !== undefined ? (data.places?.find((c) => c.id === p.c) ?? data.city) : undefined;
  return wrap(placeBody(p, data.places ?? [], city), color);
};
