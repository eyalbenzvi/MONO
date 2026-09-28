/**
 * Personalised prints ("Make it yours"): a customer's own inputs for two of
 * the computed templates, the night sky over a city on a date (`sky`, from the
 * Night Sky designs) and the moon's phases for a year (`moon`, from the Moon
 * Phases designs), drawn with the catalogue's own code. The spec itself
 * (types, validation, links) is lib/custom/spec, re-exported here.
 */
import type { BaseColor } from "@/types/shirt";
import { longDate } from "./kit";
import { DEFAULT_TIME, customDay, parseDate, parseTime, type City, type CustomSpec, type SkyParams } from "./spec";
import { wrap } from "./svg";
import { julian, moonPhase } from "./astro";
import { moonBody } from "./templates/moon";
import { nightBody, phaseName } from "./templates/night";
import { planetsBody } from "./templates/planets";
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
const dateOf = (d: string) => {
  const [y, mo, day] = parseDate(d)!;
  return longDate(y, mo, day);
};

/** The print's own line of detail, under its title in the bag: the words, else the place (a sky) or the day. */
export function customSummary(spec: CustomSpec, city?: City): string {
  const where = spec.t === "sky" && city ? city.name : "";
  return [spec.p.w ? `“${spec.p.w}”` : "", where].filter(Boolean).join(" · ") || customDay(spec);
}

/**
 * The caption's first line: the kit shrinks lines over 22 characters; one still
 * wider than the print (bold, spaced: 7 units a character) is cut with "…".
 */
export const TITLE_MAX = 36;
export const fitName = (name: string) => (name.length > TITLE_MAX ? `${name.slice(0, TITLE_MAX - 1).trimEnd()}…` : name);

/** When "Your Moon" is drawn: the evening of that day (20:00 UTC; a phase moves little in hours). */
const NIGHT_HOUR = 20;
/** When "Your Planets" is drawn: noon UTC, as the catalogue's. */
const PLANETS_HOUR = 12;
const jdOf = (d: string, h: number) => {
  const [y, mo, day] = parseDate(d)!;
  return julian(y, mo, day, h, 0);
};

/**
 * The personalised print's body (white ink, unwrapped). The customer's words,
 * when given, are its first line; then the day, and the detail that makes it
 * theirs (the place, the phase), smaller.
 */
export function customBody(spec: CustomSpec, data: { sky?: SkyData; city?: City }): string {
  const w = spec.p.w;
  if (spec.t === "moon") return moonBody({ year: spec.p.y, south: spec.p.s === 1, words: w });
  if (spec.t === "night") {
    const jd = jdOf(spec.p.d, NIGHT_HOUR);
    const { k, waxing } = moonPhase(jd);
    const date = dateOf(spec.p.d);
    const phase = phaseName(k, waxing);
    const sub2 = `${Math.round(k * 100)}% lit · as seen from the ${spec.p.s === 1 ? "south" : "north"}`;
    return nightBody({ jd, south: spec.p.s === 1, caption: { title: fitName(w ?? date), sub: w ? `${date} · ${phase}` : phase, sub2 } });
  }
  if (spec.t === "planets") {
    const date = dateOf(spec.p.d);
    return planetsBody({ jd: jdOf(spec.p.d, PLANETS_HOUR), caption: { title: fitName(w ?? date), sub: w ? date : "The eight planets around the sun", sub2: "Sun at the centre · distances on a square-root scale" }, rich: true });
  }
  const city = data.city!;
  const m = skyMoment(spec.p, city);
  const date = longDate(m.y, m.mo, m.d);
  const time = spec.p.t ? `${pad(m.h)}:${pad(m.mi)}` : "";
  const sub = w ? [date, time, city.name].filter(Boolean).join(" · ") : [time && `${time} local`, city.name].filter(Boolean).join(" · ");
  return skyBody({ place: city, jd: m.jd, caption: { title: fitName(w ?? date), sub, sub2: latLon(city.lat, city.lon) } }, data.sky!);
}

/** The whole print for a tee colour (white ink on black; inks swapped on white). */
export const renderCustomSvg = (spec: CustomSpec, teeColor: BaseColor, data: { sky?: SkyData; city?: City }) => wrap(customBody(spec, data), teeColor);
