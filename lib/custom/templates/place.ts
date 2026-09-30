/**
 * Your Place: where you were when it happened. The globe turned so the
 * place sits at its centre (orthographic, as a navigator's globe is drawn):
 * the land hatched inside bold coastlines (Your Countries' outlines, data/
 * countries, Natural Earth: lib/custom/globe, each coast cut where it goes
 * over the horizon), a 15° graticule over the sea. The place is a target of
 * rings, the land cleared round it; under the globe, the hours of daylight
 * every day of that year at that latitude (the catalogue's Daylight charts,
 * NOAA's solar declination), the day itself drawn bold. The place list
 * (data/cities, GeoNames) names the place.
 */
import { CAP, INK, STROKE, caption, captionLines, circle, dot, f1, house, line, longDate, shortMonth, text, type Lines } from "../kit";
import { titleWords } from "../specKit";
import { coords, parseDate, type City, type CustomSpec, type PlaceParams } from "../spec";
import { GROUND, wrap } from "../svg";
import { landPaths, seaGraticule, tracePolylines, vec } from "../globe";
import { loadCities, loadCountries, type Countries } from "../data";
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
/** Hours and minutes, rounded to the minute as a whole (11.995 h is 12h 00m, not 11h 00m). */
const hm = (h: number) => {
  const m = Math.round(h * 60);
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
};
/** The day's light, as the caption says it: the midnight sun and the polar night by name, never "0h of daylight". */
const daylightWords = (h: number) => (h >= 24 ? "midnight sun" : h <= 0 ? "polar night" : `${hm(h)} of daylight`);

export function placeBody(p: PlaceParams, countries?: Countries): string {
  const view = { centre: vec(p.la, p.lo), k: R, cx: CX, cy: CY, r: R };
  // The graticule over the sea; the land hatched, its coasts bold.
  const land = landPaths(countries, view, { gap: 2.4 });
  let s = `<path d="${tracePolylines(seaGraticule(countries, 15), view, 0.15, 0)}" fill="none" stroke="${INK}" stroke-width="${STROKE.hairline}"/>`;
  if (land.hatch) s += `<path d="${land.hatch}" fill="none" stroke="${INK}" stroke-width="${STROKE.hairline}"/>`;
  if (land.coast) s += `<path d="${land.coast}" fill="none" stroke="${INK}" stroke-width=".9" stroke-linejoin="round" stroke-linecap="round"/>`;
  s += circle(CX, CY, R, STROKE.regular);
  // The place: the land cleared inside the inner ring and round the outer ring and the cross; rings, a cross with a gap, a dot.
  const halo = (r: number, w: number) => `<circle cx="${CX}" cy="${CY}" r="${r}" fill="none" stroke="${GROUND}" stroke-width="${w}"/>`;
  s += `<circle cx="${CX}" cy="${CY}" r="7.4" fill="${GROUND}"/>` + halo(12, 2.7);
  s += `<path d="M${CX - 22} ${CY}H${CX - 14}M${CX + 14} ${CY}H${CX + 22}M${CX} ${CY - 22}V${CY - 14}M${CX} ${CY + 14}V${CY + 22}" fill="none" stroke="${GROUND}" stroke-width="3"/>`;
  s += circle(CX, CY, 6, 1) + circle(CX, CY, 12, 0.7) + `<circle cx="${CX}" cy="${CY}" r="2.2" fill="${INK}"/>`;
  s += line(CX - 22, CY, CX - 14, CY, 1) + line(CX + 14, CY, CX + 22, CY, 1) + line(CX, CY - 22, CX, CY - 14, 1) + line(CX, CY + 14, CX, CY + 22, 1);

  // The year's daylight at this latitude, one bar every third day; the day bold.
  const date = p.d ? parseDate(p.d) : null;
  const year = date?.[0] ?? 2025;
  const days = Math.round((Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 86_400_000);
  const X0 = 46, XW = 208, Y0 = 300, YH = 56;
  const xOf = (doy: number) => X0 + ((doy - 1) / (days - 1)) * XW;
  const yOf = (h: number) => Y0 - (h / 24) * YH;
  let bars = "";
  for (let doy = 1; doy <= days; doy += 3) {
    const h = daylight(p.la, doy);
    if (h > 0.05) bars += `M${f1(xOf(doy))} ${Y0}V${f1(yOf(h))}`;
  }
  s += `<path d="${bars}" fill="none" stroke="${INK}" stroke-width="${STROKE.hairline}"/>` + line(X0 - 4, Y0, X0 + XW + 4, Y0, STROKE.fine);
  // The 12- and 24-hour levels: a dotted hairline across, a label outside the axis.
  for (const h of [12, 24]) {
    s += `<path d="M${X0 - 4} ${f1(yOf(h))}H${X0 + XW + 4}" fill="none" stroke="${INK}" stroke-width="${STROKE.hairline}" stroke-dasharray=".5 2.5" stroke-linecap="round"/>`;
    s += text(X0 - 7, yOf(h) + (CAP.plex * 4.5) / 2, `${h}H`, 4.5, { anchor: "end", spacing: 0.4 });
  }
  MONTH_START.forEach((doy, m) => (s += text(xOf(doy + 14), Y0 + 9, shortMonth(m + 1)[0], 4.5, { spacing: 0.5 })));
  // The chart's own head: what it counts, the year; the day marked bold, its hours at the marker.
  s += text(X0 - 4, Y0 - YH - 14, "HOURS OF DAYLIGHT", 4.5, { anchor: "start", spacing: 0.55 });
  s += text(X0 + XW + 4, Y0 - YH - 14, String(year), 4.5, { anchor: "end", spacing: 0.55 });
  if (date) {
    const doy = dayOfYear(...date);
    const x = xOf(doy);
    s += line(x, Y0 + 2, x, Y0 - YH - 1, STROKE.bold) + dot(x, Y0 + 2, 1.6);
  }
  return s;
}

/** The caption's lines (ours): the words (the visitor's title), else the city or the coordinates; the place; the day and its daylight. */
export function placeCaption(p: PlaceParams, city?: City): Lines {
  const date = p.d ? parseDate(p.d) : null;
  const sub2 = date ? `${longDate(...date)} · ${daylightWords(daylight(p.la, dayOfYear(...date)))}` : undefined;
  const where = coords(p.la, p.lo);
  const title = titleWords(p) ?? city?.name ?? where;
  return [title, title === where ? (city ? `${city.name}, ${city.country}` : "Where I was") : where, sub2];
}

const cityOf = (p: PlaceParams, data: RenderData) => (p.c !== undefined ? (data.places?.find((c) => c.id === p.c) ?? data.city) : undefined);
export const captionOf = (spec: CustomSpec, data: RenderData = {}) => placeCaption((spec as { p: PlaceParams }).p, cityOf((spec as { p: PlaceParams }).p, data));

export const render = (spec: CustomSpec, color: BaseColor, data: RenderData = {}) => {
  const p = (spec as { p: PlaceParams }).p;
  return house(() => wrap(placeBody(p, data.countries) + caption(342, ...captionLines(placeCaption(p, cityOf(p, data)), p.cap)), color));
};

/** The countries (the land) and the place list (the place's name), for the page, the index cards and the bag. */
export async function prepare(spec: CustomSpec): Promise<RenderData> {
  const [places, countries] = await Promise.all([loadCities(), loadCountries()]);
  const c = (spec as { p: PlaceParams }).p.c;
  return { places: places.list, countries, ...(c !== undefined ? { city: places.byId(c) } : {}) };
}
