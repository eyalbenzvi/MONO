/**
 * Personalised prints ("Make it yours"): a customer's own inputs for two of
 * the computed templates, the night sky over a city on a date (`sky`, from the
 * Night Sky designs) and the moon's phases for a year (`moon`, from the Moon
 * Phases designs), drawn with the catalogue's own code. The spec itself
 * (types, validation, links) is lib/custom/spec, re-exported here.
 */
import type { BaseColor } from "@/types/shirt";
import { longDate } from "./kit";
import { DEFAULT_TIME, parseDate, parseTime, type City, type CustomSpec, type SkyParams } from "./spec";
import { wrap } from "./svg";
import { moonBody } from "./templates/moon";
import { latLon, skyBody, type SkyData } from "./templates/sky";
import { localToUtc } from "./tz";

export * from "./spec";

/** The local time used for a sky spec (none given: the evening) and its UTC moment, in the city's zone. */
export function skyMoment(p: SkyParams, city: City) {
  const [y, mo, d] = parseDate(p.d)!;
  const [h, mi] = parseTime(p.t ?? DEFAULT_TIME)!;
  const at = localToUtc(city.tz, y, mo, d, h, mi);
  return { y, mo, d, h: at.h, mi: at.mi, jd: at.utc / 86400000 + 2440587.5 };
}

const pad = (n: number) => String(n).padStart(2, "0");

export function customTitle(spec: CustomSpec, city?: City): string {
  if (spec.t === "moon") return `Moon Phases of ${spec.p.y}`;
  const [y, mo, d] = parseDate(spec.p.d)!;
  return `Night Sky over ${city?.name ?? "your city"}, ${longDate(y, mo, d)}`;
}

/** The page's summary line: "Tel Aviv · 14 March 1991", or the year. */
export function customSummary(spec: CustomSpec, city?: City): string {
  if (spec.t === "moon") return String(spec.p.y);
  const [y, mo, d] = parseDate(spec.p.d)!;
  return `${city?.name ?? "Your city"} · ${longDate(y, mo, d)}`;
}

/**
 * The caption's name line: the kit shrinks names over 22 characters; one still
 * wider than the print (bold, spaced: 7 units a character) is cut with "…".
 */
export const TITLE_MAX = 36;
export const fitName = (name: string) => (name.length > TITLE_MAX ? `${name.slice(0, TITLE_MAX - 1).trimEnd()}…` : name);

/** The personalised print's body (white ink, unwrapped). */
export function customBody(spec: CustomSpec, data: { sky?: SkyData; city?: City }): string {
  if (spec.t === "moon") return moonBody({ year: spec.p.y, south: spec.p.s === 1 });
  const city = data.city!;
  const m = skyMoment(spec.p, city);
  const date = longDate(m.y, m.mo, m.d);
  const sub = spec.p.t ? `${date} · ${pad(m.h)}:${pad(m.mi)} local` : date;
  return skyBody({ place: city, jd: m.jd, caption: { title: fitName(city.name), sub, sub2: latLon(city.lat, city.lon) } }, data.sky!);
}

/** The whole print for a tee colour (white ink on black; inks swapped on white). */
export const renderCustomSvg = (spec: CustomSpec, teeColor: BaseColor, data: { sky?: SkyData; city?: City }) => wrap(customBody(spec, data), teeColor);
