/**
 * Maps & Sky (Part 3, the Wanderer): the sky computed, not drawn from
 * imagination — the stars above a real place at a real moment (Yale Bright
 * Star Catalogue positions via data/sky, sidereal time from the date), the
 * moon's phase for every day of a year (Meeus's low-precision series), the
 * planets on a date (JPL's Keplerian elements, valid 1800–2050), the sun's
 * analemma and the length of daylight (NOAA's solar equations), Halley's
 * orbit and the Galilean moons from their measured elements.
 */
import { readFileSync } from "node:fs";
import nodePath from "node:path";
import { DEG, INK, caption, circle, dot, f1, julian, line, longDate, norm360, path, polyline, shortMonth, text, type Set7Design } from "./kit";
import { latLon, skyChart } from "../../../lib/custom/templates/sky";
import { moonBody } from "../../../lib/custom/templates/moon";
export { moonPhase } from "../../../lib/custom/astro";

const SKY = nodePath.resolve(__dirname, "..", "..", "..", "data", "sky");

/* ------------------------------------------------------------------ */
/* The stars above a place                                              */
/* ------------------------------------------------------------------ */

interface Place {
  name: string;
  lat: number;
  lon: number;
  /** Standard time offset from UTC, hours. */
  utc: number;
}

/**
 * Local midnight on the year's longest night: 21 December in the north, 21 June in the south (2000).
 * Few places, far apart in latitude: nearby skies look alike (near-duplicates, Part 1.7).
 */
const PLACES: Place[] = [
  { name: "Reykjavík", lat: 64.147, lon: -21.942, utc: 0 },
  { name: "Jerusalem", lat: 31.778, lon: 35.235, utc: 2 },
  { name: "Singapore", lat: 1.352, lon: 103.82, utc: 8 },
  { name: "Sydney", lat: -33.869, lon: 151.209, utc: 10 },
  { name: "Ushuaia", lat: -54.801, lon: -68.303, utc: -3 },
];

/** The chart at a place's local time (standard time, `utc` hours ahead of UTC). */
const chartAt = (stars: [number, number, number][], lines: [number, number][][], p: Place, when: { y: number; mo: number; d: number; h: number; mi: number }) =>
  skyChart({ stars, lines }, p, julian(when.y, when.mo, when.d, when.h, when.mi) - p.utc / 24);

function skyDesigns(): Set7Design[] {
  const stars: [number, number, number][] = JSON.parse(readFileSync(nodePath.join(SKY, "stars.json"), "utf8"));
  const cons: { lines: [number, number][][] }[] = JSON.parse(readFileSync(nodePath.join(SKY, "constellations.json"), "utf8"));
  const lines = cons.flatMap((c) => c.lines);
  const out: Set7Design[] = [];
  const features = { nature: 0.55, geometric: 0.4, line_art: 0.5, abstract: 0.3, clean_minimal: 0.45, classic: 0.35, pictorial: 0.3, density: 0.3, contrast: 0.75, typography: 0.2 };
  for (const p of PLACES) {
    const north = p.lat >= 0;
    const when = { y: 2000, mo: north ? 12 : 6, d: 21, h: 0, mi: 0 };
    out.push({
      body: chartAt(stars, lines, p, when) + caption(318, p.name, `${longDate(when.y, when.mo, when.d)} · 00:00 local`, latLon(p.lat, p.lon)),
      variant: "sky-night",
      category: "sky",
      title: `Night Sky over ${p.name}, ${longDate(when.y, when.mo, when.d)}`,
      subject: `Night Sky over ${p.name}`,
      description: `The stars above ${p.name} at local midnight on ${longDate(when.y, when.mo, when.d)}, the longest night of that year there: every star to magnitude 4.8 in its real place, the constellation figures, the horizon as the circle.`,
      features,
      sigKey: `night-${p.name}`,
    });
  }
  // Two nights of record: the launch of Sputnik 1, and the Leonid meteor storm seen across North America.
  const events: [Place, { y: number; mo: number; d: number; h: number; mi: number }, string, string][] = [
    [{ name: "Baikonur", lat: 45.92, lon: 63.342, utc: 5 }, { y: 1957, mo: 10, d: 5, h: 0, mi: 28 }, "Sputnik 1 lifted off", "5 October 1957 · 00:28 local"],
    [{ name: "Boston", lat: 42.36, lon: -71.059, utc: -5 }, { y: 1833, mo: 11, d: 13, h: 4, mi: 0 }, "the great Leonid meteor storm peaked", "13 November 1833 · 04:00 local"],
  ];
  for (const [p, when, what, sub] of events)
    out.push({
      body: chartAt(stars, lines, p, when) + caption(318, p.name, sub, latLon(p.lat, p.lon)),
      variant: "sky-night",
      category: "sky",
      title: `Night Sky over ${p.name}, ${longDate(when.y, when.mo, when.d)}`,
      subject: `Night Sky over ${p.name}`,
      description: `The stars above ${p.name} at the moment ${what}: every star to magnitude 4.8 in its real place, the constellation figures, the horizon as the circle.`,
      features,
      sigKey: `night-${p.name}`,
    });
  return out;
}

/* ------------------------------------------------------------------ */
/* The moon, every day of a year                                        */
/* ------------------------------------------------------------------ */

function moonDesigns(): Set7Design[] {
  const out: Set7Design[] = [];
  const years: [number, string][] = [
    [1969, "the year of the first landing"],
    [2000, ""],
    [2026, ""],
  ];
  for (const [year, why] of years) {
    const body = moonBody({ year });
    out.push({
      body,
      variant: "moon-year",
      category: "sky",
      title: `Moon Phases of ${year}`,
      subject: `Moon Phases of ${year}`,
      description: `The moon's phase for every day of ${year}${why ? `, ${why}` : ""}, month by month, computed for midnight UTC.`,
      features: { nature: 0.45, geometric: 0.55, clean_minimal: 0.5, typography: 0.25, abstract: 0.35, density: 0.35, contrast: 0.7, classic: 0.35, line_art: 0.3 },
      sigKey: `moon-${year}`,
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* The planets on a date                                                */
/* ------------------------------------------------------------------ */

/** JPL's approximate Keplerian elements (Standish, 1800–2050): a (AU), e, L, ϖ (°) at J2000 and per century. */
const PLANETS: [string, number, number, number, number, number, number, number][] = [
  // name, a, e, e/cy, L, L/cy, ϖ, ϖ/cy
  ["Mercury", 0.38709927, 0.20563593, 0.00001906, 252.2503235, 149472.67411175, 77.45779628, 0.16047689],
  ["Venus", 0.72333566, 0.00677672, -0.00004107, 181.9790995, 58517.81538729, 131.60246718, 0.00268329],
  ["Earth", 1.00000261, 0.01671123, -0.00004392, 100.46457166, 35999.37244981, 102.93768193, 0.32327364],
  ["Mars", 1.52371034, 0.0933941, 0.00007882, -4.55343205, 19140.30268499, -23.94362959, 0.44441088],
  ["Jupiter", 5.202887, 0.04838624, -0.00013253, 34.39644051, 3034.74612775, 14.72847983, 0.21252668],
  ["Saturn", 9.53667594, 0.05386179, -0.00050991, 49.95424423, 1222.49362201, 92.59887831, -0.41897216],
  ["Uranus", 19.18916464, 0.04725744, -0.00004397, 313.23810451, 428.48202785, 170.9542763, 0.40805281],
  ["Neptune", 30.06992276, 0.00859048, 0.00005105, -55.12002969, 218.45945325, 44.96476227, -0.32241464],
];

/** A planet's heliocentric position (AU, in its orbit's plane) at a Julian date. */
function planetAt(p: (typeof PLANETS)[number], jd: number): { x: number; y: number; a: number; e: number; w: number } {
  const T = (jd - 2451545) / 36525;
  const [, a, e0, de, L0, dL, w0, dw] = p;
  const e = e0 + de * T;
  const w = w0 + dw * T;
  const M = norm360(L0 + dL * T - w) * DEG;
  let E = M;
  for (let i = 0; i < 12; i++) E = E - (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  const xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const r = Math.hypot(xp, yp), v = Math.atan2(yp, xp) + w * DEG;
  return { x: r * Math.cos(v), y: r * Math.sin(v), a, e, w };
}

function planetDesigns(): Set7Design[] {
  const dates: [number, number, number, string, string][] = [
    [1957, 10, 4, "Sputnik 1", "the day Sputnik 1 was launched"],
    [1969, 7, 20, "Apollo 11", "the day Apollo 11 landed on the moon"],
    [1977, 8, 20, "Voyager 2", "the day Voyager 2 was launched"],
    [2006, 1, 19, "New Horizons", "the day New Horizons left for Pluto"],
  ];
  const out: Set7Design[] = [];
  const CX = 150, CY = 160, RMAX = 122;
  // Distances on a square-root scale, so Mercury and Neptune share the print.
  const sc = (r: number) => 10 + (RMAX - 10) * Math.sqrt(r / 30.4);
  for (const [y, mo, d, name, what] of dates) {
    const jd = julian(y, mo, d, 12, 0);
    let body = circle(CX, CY, 4, 0.9) + dot(CX, CY, 1.4);
    for (const p of PLANETS) {
      const { x, y: py, a, e, w } = planetAt(p, jd);
      const orbit: [number, number][] = [];
      for (let k = 0; k <= 180; k++) {
        const E = (k / 180) * Math.PI * 2;
        const xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
        const r = Math.hypot(xp, yp), v = Math.atan2(yp, xp) + w * DEG;
        orbit.push([CX + sc(r) * Math.cos(v), CY - sc(r) * Math.sin(v)]);
      }
      body += path(polyline(orbit, true), 0.55);
      const r = Math.hypot(x, py), v = Math.atan2(py, x);
      const [px, pyy] = [CX + sc(r) * Math.cos(v), CY - sc(r) * Math.sin(v)];
      body += dot(px, pyy, 2.6);
      const out2 = sc(r) + 9;
      body += text(CX + out2 * Math.cos(v), CY - out2 * Math.sin(v) + 2.2, p[0].slice(0, 2).toUpperCase(), 5.5, { bold: true });
    }
    body += caption(318, name, longDate(y, mo, d), "Sun at the centre · distances on a square-root scale");
    out.push({
      body,
      variant: "planets-date",
      category: "sky",
      title: `The Planets on ${longDate(y, mo, d)}`,
      subject: `Planet Positions, ${longDate(y, mo, d)}`,
      description: `Where the eight planets stood around the sun on ${what}: their real orbits and positions, computed from their orbital elements and seen from above the solar system.`,
      features: { geometric: 0.7, abstract: 0.45, clean_minimal: 0.55, line_art: 0.6, nature: 0.3, density: 0.2, contrast: 0.7, typography: 0.15, retro: 0.2 },
      sigKey: `planets-${y}-${mo}`,
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* The sun: analemma and daylight                                       */
/* ------------------------------------------------------------------ */

/** The sun's declination (rad) and the equation of time (minutes) on a day of the year (NOAA). */
function sun(doy: number): { decl: number; eqt: number } {
  const g = ((2 * Math.PI) / 365) * (doy - 1);
  const eqt = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  return { decl, eqt };
}
const MONTH_START = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];

function sunDesigns(): Set7Design[] {
  const out: Set7Design[] = [];
  for (const [name, lat] of [["Greenwich", 51.477]] as const) {
    const phi = lat * DEG;
    const pts: [number, number][] = [];
    for (let doy = 1; doy <= 365; doy++) {
      const { decl, eqt } = sun(doy);
      const H = (eqt / 4) * DEG; // at 12:00 mean time the sun is eqt minutes from the meridian
      const alt = Math.asin(Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.cos(H));
      const az = Math.atan2(-Math.sin(H) * Math.cos(decl), Math.cos(phi) * Math.sin(decl) - Math.sin(phi) * Math.cos(decl) * Math.cos(H));
      pts.push([az, alt]);
    }
    // Az about the meridian (south in the north, north in the south), exaggerated ×4 so the figure reads.
    const mer = lat >= 0 ? Math.PI : 0;
    const dz = pts.map(([az]) => Math.atan2(Math.sin(az - mer), Math.cos(az - mer)));
    const alts = pts.map((p) => p[1]);
    const [a0, a1] = [Math.min(...alts), Math.max(...alts)];
    const X = (z: number) => 150 + (z / DEG) * 4 * 3.2;
    const Y = (a: number) => 280 - ((a - a0) / (a1 - a0)) * 230;
    let body = line(40, 290, 260, 290, 0.8);
    for (let k = 0; k < 365; k += 2) body += dot(X(dz[k]), Y(alts[k]), 1.05);
    MONTH_START.forEach((doy, m) => {
      const [x, y] = [X(dz[doy - 1]), Y(alts[doy - 1])];
      body += circle(x, y, 3, 0.7) + text(x + (dz[doy - 1] >= 0 ? 8 : -8), y + 2, shortMonth(m + 1), 5.5, { anchor: dz[doy - 1] >= 0 ? "start" : "end" });
    });
    body += text(260, 285, `${Math.round(a0 / DEG)}°`, 5.5, { anchor: "end" }) + text(260, Y(a1) + 2, `${Math.round(a1 / DEG)}°`, 5.5, { anchor: "end" });
    body += caption(318, `Analemma, ${name}`, "The sun at 12:00 every day of a year", `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? "N" : "S"} · east–west ×4`);
    out.push({
      body,
      variant: "analemma",
      category: "sky",
      title: `Analemma at ${name}`,
      subject: `Analemma at ${name}`,
      description: `Where the sun stands at noon by the clock, every day of a year at ${name}: the figure of eight the tilt of the earth and its elliptical orbit trace, computed from the solar equations.`,
      features: { geometric: 0.55, abstract: 0.55, clean_minimal: 0.6, line_art: 0.45, nature: 0.35, density: 0.15, contrast: 0.65, typography: 0.15 },
      sigKey: `analemma-${name}`,
    });
  }
  for (const [name, lat] of [["Tromsø", 69.649], ["Reykjavík", 64.147], ["London", 51.507], ["Jerusalem", 31.778]] as const) {
    const phi = lat * DEG;
    const hours: number[] = [];
    for (let doy = 1; doy <= 365; doy++) {
      const { decl } = sun(doy);
      const c = (Math.sin(-0.833 * DEG) - Math.sin(phi) * Math.sin(decl)) / (Math.cos(phi) * Math.cos(decl));
      hours.push(c <= -1 ? 24 : c >= 1 ? 0 : (2 * Math.acos(c)) / DEG / 15);
    }
    const X0 = 40, XW = 220, Y0 = 280, YH = 220;
    let body = line(X0, Y0, X0 + XW, Y0, 0.8) + line(X0, Y0, X0, Y0 - YH, 0.8);
    for (const h of [6, 12, 18, 24]) body += line(X0 - 3, Y0 - (h / 24) * YH, X0, Y0 - (h / 24) * YH, 0.8) + text(X0 - 6, Y0 - (h / 24) * YH + 2, String(h), 5.5, { anchor: "end" });
    for (let doy = 1; doy <= 365; doy += 3) {
      const x = X0 + ((doy - 1) / 364) * XW;
      if (hours[doy - 1] > 0.05) body += line(x, Y0, x, Y0 - (hours[doy - 1] / 24) * YH, 0.7);
    }
    MONTH_START.forEach((doy, m) => (body += text(X0 + ((doy + 14) / 364) * XW, Y0 + 10, shortMonth(m + 1)[0], 5.5)));
    const longest = Math.max(...hours), shortest = Math.min(...hours);
    const fmt = (h: number) => `${Math.floor(h)}h ${String(Math.round((h % 1) * 60)).padStart(2, "0")}m`;
    body += caption(318, `Daylight, ${name}`, `Hours of daylight each day · ${Math.abs(lat).toFixed(2)}°N`, `Longest ${longest >= 24 ? "24h (midnight sun)" : fmt(longest)} · shortest ${shortest <= 0 ? "0h (polar night)" : fmt(shortest)}`);
    out.push({
      body,
      variant: "daylight",
      category: "sky",
      title: `Hours of Daylight in ${name}`,
      subject: `Daylight Chart, ${name}`,
      description: `How long the sun is up in ${name} on each day of the year, from sunrise to sunset, one line every third day, computed from the sun's declination at ${Math.abs(lat).toFixed(1)}° north.`,
      features: { geometric: 0.55, clean_minimal: 0.5, line_art: 0.55, abstract: 0.45, typography: 0.2, density: 0.4, contrast: 0.7, nature: 0.3 },
      sigKey: `daylight-${name}`,
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Orbits: Halley's comet, Jupiter's moons                              */
/* ------------------------------------------------------------------ */

function orbitDesigns(): Set7Design[] {
  const out: Set7Design[] = [];
  {
    // Halley: a = 17.834 AU, e = 0.96714. Equal times → equal areas swept from the sun.
    const a = 17.834, e = 0.96714, b = a * Math.sqrt(1 - e * e);
    const s = 250 / (2 * a);
    const cx = 150, fy = 60; // perihelion near the top, the sun at the focus
    const P = (E: number): [number, number] => [cx + b * Math.sin(E) * s, fy + (a * (1 - Math.cos(E)) - a * (1 - e)) * s];
    const orbit: [number, number][] = [];
    for (let k = 0; k <= 360; k++) orbit.push(P((k / 360) * Math.PI * 2));
    let body = path(polyline(orbit, true), 0.9) + circle(cx, fy, 3.2, 0.9) + dot(cx, fy, 1.2);
    for (let k = 0; k < 16; k++) {
      const M = (k / 16) * Math.PI * 2;
      let E = M;
      for (let i = 0; i < 40; i++) E = E - (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
      const [x, y] = P(E);
      body += line(cx, fy, x, y, 0.5) + dot(x, y, 1.8);
    }
    body += caption(332, "Halley's Comet", "Equal areas in equal times: a mark every 4.8 years", "a = 17.83 AU · e = 0.967 · period 76 years");
    out.push({
      body,
      variant: "orbit-halley",
      category: "sky",
      title: "Halley's Comet and Kepler's Second Law",
      subject: "Halley's Comet Orbit",
      description: "The orbit of Halley's comet to scale, with its position at sixteen equal steps of its 76-year period: the lines from the sun sweep equal areas, Kepler's second law, bunched where the comet races past the sun.",
      features: { geometric: 0.7, abstract: 0.5, clean_minimal: 0.65, line_art: 0.65, nature: 0.25, density: 0.1, contrast: 0.65, classic: 0.3 },
      sigKey: "halley",
    });
  }
  {
    const moons: [string, number, number][] = [
      ["Io", 421.7, 1.769],
      ["Europa", 671.0, 3.551],
      ["Ganymede", 1070.4, 7.155],
      ["Callisto", 1882.7, 16.689],
    ];
    const CX = 150, CY = 160;
    let body = circle(CX, CY, 9, 1) + text(CX, CY + 2.5, "J", 7, { bold: true });
    for (const [name, a, period] of moons) {
      const r = 18 + (a / 1882.7) * 102;
      body += circle(CX, CY, r, 0.7);
      for (let day = 0; day < Math.min(period, 17); day++) {
        const ang = (day / period) * Math.PI * 2 - Math.PI / 2;
        body += dot(CX + r * Math.cos(ang), CY + r * Math.sin(ang), day === 0 ? 2.4 : 1.3);
      }
      body += text(CX, CY - r - 4, name.toUpperCase(), 5.5, { spacing: 1 });
    }
    body += caption(318, "Galilean Moons", "Io, Europa, Ganymede, Callisto: a dot for each day", "Orbits to scale · Callisto 1.88 million km out");
    out.push({
      body,
      variant: "orbit-moons",
      category: "sky",
      title: "The Galilean Moons of Jupiter",
      subject: "Galilean Moons of Jupiter",
      description: "Jupiter's four large moons on their orbits drawn to scale, with a dot for where each is on every day: Io laps the planet in under two days, Callisto takes more than sixteen.",
      features: { geometric: 0.75, abstract: 0.5, clean_minimal: 0.6, line_art: 0.55, nature: 0.25, density: 0.15, contrast: 0.65, typography: 0.15 },
      sigKey: "galilean",
    });
  }
  return out;
}

export function skySet(): Set7Design[] {
  return [...skyDesigns(), ...moonDesigns(), ...planetDesigns(), ...sunDesigns(), ...orbitDesigns()];
}
